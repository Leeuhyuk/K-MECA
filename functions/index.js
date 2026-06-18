/* ════════════════════════════════════════════════════════════════
   MES Pro — Popbill 연동 백엔드 (Firebase Cloud Functions, gen2)

   - 비밀값(LinkID/SecretKey)은 Google Secret Manager에서 런타임에만 주입한다.
     소스/배포물에는 어떤 비밀값도 포함되지 않는다.
   - 1차 범위: 사업자등록상태조회(휴폐업) + 기업정보조회. 둘 다 단순 조회라 인증 흐름이 없다.
   - 호출은 로그인한 사용자만 허용(onCall + Firebase Auth). 기본은 테스트 모드.
   - 상세 계획: docs/popbill-api-addition-review-checklist.md
   ════════════════════════════════════════════════════════════════ */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const popbill = require("popbill");

initializeApp();
const db = getFirestore();

/* ── 환경/파라미터 ──────────────────────────────────────────────
   비밀값은 Secret Manager(defineSecret), 비밀 아님 식별/플래그는 defineString.
   값 등록 방법은 functions/README.md 참고. */
const POPBILL_LINK_ID = defineSecret("POPBILL_LINK_ID");
const POPBILL_SECRET_KEY = defineSecret("POPBILL_SECRET_KEY");
const POPBILL_CORP_NUM = defineString("POPBILL_CORP_NUM"); // 팝빌 회원(우리 회사) 사업자번호
const POPBILL_IS_TEST = defineString("POPBILL_IS_TEST", { default: "true" });

const REGION = "asia-northeast3"; // 서울 — 국내 지연 최소화

/* ── Popbill SDK 1회 설정 ───────────────────────────────────── */
let _configured = false;
function ensureConfigured() {
  if (_configured) return;
  popbill.config({
    LinkID: POPBILL_LINK_ID.value(),
    SecretKey: POPBILL_SECRET_KEY.value(),
    IsTest: POPBILL_IS_TEST.value() !== "false", // 기본 테스트, "false"일 때만 운영
    defaultErrorHandler: function (err) {
      logger.error("Popbill SDK error", { code: err && err.code });
    },
  });
  _configured = true;
}

/* ── 공통 헬퍼 ─────────────────────────────────────────────── */
function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
}

// 사업자번호: 숫자만 추출 후 10자리 검증 (하이픈 허용 입력)
function sanitizeCorpNum(raw) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length !== 10) {
    throw new HttpsError("invalid-argument", "사업자등록번호 10자리를 입력하세요.");
  }
  return digits;
}

// 은행코드: 숫자 3~4자리 (예: 0004 국민)
function sanitizeBankCode(raw) {
  const v = String(raw || "").replace(/[^0-9]/g, "");
  if (v.length < 3 || v.length > 4) {
    throw new HttpsError("invalid-argument", "은행을 선택하세요.");
  }
  return v;
}

// 계좌번호: 숫자만 6~20자리
function sanitizeAccountNumber(raw) {
  const v = String(raw || "").replace(/[^0-9]/g, "");
  if (v.length < 6 || v.length > 20) {
    throw new HttpsError("invalid-argument", "계좌번호를 정확히 입력하세요.");
  }
  return v;
}

// 회원 사업자번호 미설정 방지
function memberCorpNum() {
  const v = String(POPBILL_CORP_NUM.value() || "").replace(/[^0-9]/g, "");
  if (v.length !== 10) {
    throw new HttpsError("failed-precondition", "POPBILL_CORP_NUM 환경값이 설정되지 않았습니다.");
  }
  return v;
}

// 콜백 기반 SDK 호출을 Promise로 래핑
function callPopbill(invoke) {
  return new Promise((resolve, reject) => {
    invoke(
      (res) => resolve(res),
      (err) => reject(new HttpsError("internal", (err && err.message) || "Popbill 호출 실패", { code: err && err.code }))
    );
  });
}

/* ── 마스킹 ─────────────────────────────────────────────────
   로그에는 원문 대신 마스킹값만 저장한다(개인정보/민감정보 보호). */
function maskCorpNum(v) {
  const d = String(v || "").replace(/[^0-9]/g, "");
  if (d.length !== 10) return "***";
  return d.slice(0, 3) + "-**-***" + d.slice(8); // 123-**-***90
}
function maskAccount(v) {
  const d = String(v || "").replace(/[^0-9]/g, "");
  if (d.length < 4) return "***";
  return "****" + d.slice(-3); // ****890
}
function maskName(v) {
  const s = String(v || "").trim();
  if (s.length <= 1) return s || "-";
  return s[0] + "*".repeat(s.length - 1); // 홍** 형태
}

/* ── 조회 로그 기록 (Firestore popbill_logs) ─────────────────
   admin SDK로 기록하므로 Firestore 규칙을 우회한다(프론트는 읽기만).
   실패해도 본 조회 응답에는 영향 주지 않는다. */
async function writeLog(request, entry) {
  try {
    await db.collection("popbill_logs").add({
      type: entry.type,
      target: entry.target || "",   // 마스킹된 입력
      summary: entry.summary || "", // 마스킹된 결과 요약
      ok: !!entry.ok,
      errorCode: entry.errorCode || "",
      uid: (request.auth && request.auth.uid) || "",
      email: (request.auth && request.auth.token && request.auth.token.email) || "",
      isTest: POPBILL_IS_TEST.value() !== "false",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.warn("popbill log write failed", { code: e && e.code });
  }
}

/* ── 사업자등록상태조회(휴폐업) ─────────────────────────────── */
exports.popbillCheckBizState = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const checkCorpNum = sanitizeCorpNum(request.data && request.data.corpNum);
    const target = maskCorpNum(checkCorpNum);
    ensureConfigured();
    const svc = popbill.ClosedownService();
    try {
      const res = await callPopbill((success, error) =>
        svc.checkCorpNum(memberCorpNum(), checkCorpNum, success, error)
      );
      logger.info("popbillCheckBizState ok", { uid: request.auth.uid });
      await writeLog(request, { type: "bizState", target, ok: true, summary: (res && res.stateString) || "" });
      return res;
    } catch (e) {
      await writeLog(request, { type: "bizState", target, ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);

/* ── 기업정보조회 ──────────────────────────────────────────── */
exports.popbillCheckBizInfo = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const checkCorpNum = sanitizeCorpNum(request.data && request.data.corpNum);
    const target = maskCorpNum(checkCorpNum);
    ensureConfigured();
    const svc = popbill.BizInfoCheckService();
    try {
      const res = await callPopbill((success, error) =>
        svc.checkBizInfo(memberCorpNum(), checkCorpNum, success, error)
      );
      logger.info("popbillCheckBizInfo ok", { uid: request.auth.uid });
      await writeLog(request, { type: "bizInfo", target, ok: true, summary: (res && res.companyName) || "" });
      return res;
    } catch (e) {
      await writeLog(request, { type: "bizInfo", target, ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);

/* ── 예금주(성명)조회 ──────────────────────────────────────────
   checkAccountInfo: 신원번호 없이 은행/계좌번호로 예금주명 확인(성명조회). */
exports.popbillCheckAccount = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const d = request.data || {};
    const bankCode = sanitizeBankCode(d.bankCode);
    const accountNumber = sanitizeAccountNumber(d.accountNumber);
    const target = bankCode + " " + maskAccount(accountNumber);
    ensureConfigured();
    const svc = popbill.AccountCheckService();
    try {
      const res = await callPopbill((success, error) =>
        svc.checkAccountInfo(memberCorpNum(), bankCode, accountNumber, "", success, error)
      );
      logger.info("popbillCheckAccount ok", { uid: request.auth.uid });
      await writeLog(request, { type: "account", target, ok: true, summary: maskName(res && res.accountName) });
      return res;
    } catch (e) {
      await writeLog(request, { type: "account", target, ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);

/* ════════════════════════════════════════════════════════════════
   홈택스 전자세금계산서 수집 (부서사용자 방식)
   흐름: 부서사용자 상태확인 → (필요시) 등록 → 수집요청(Job) → 상태폴링 → 검색
   - 부서사용자 ID/PW는 저장하지 않고 등록 호출에만 전달한다.
   - RequestJob은 최대 3개월 단위, JobID는 1시간 유효. (Popbill 제약)
   ════════════════════════════════════════════════════════════════ */
const HT_QUERY_TYPES = ["SELL", "BUY", "TRUSTEE"]; // 매출/매입/위수탁
const HT_DATE_TYPES = ["W", "I", "S"];             // 작성일자/발행일자/전송일자

function sanitizeDate8(raw) {
  const d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length !== 8) throw new HttpsError("invalid-argument", "날짜는 YYYYMMDD 형식이어야 합니다.");
  return d;
}

function htService() {
  ensureConfigured();
  return popbill.HTTaxinvoiceService();
}

// 부서사용자 등록/로그인 상태 확인
exports.popbillHometaxDeptUserState = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const svc = htService();
    return await callPopbill((ok, err) => svc.checkLoginDeptUser(memberCorpNum(), ok, err));
  }
);

// 부서사용자 등록 (홈택스 조회 전용 계정 ID/PW를 Popbill에 등록)
exports.popbillHometaxRegisterDeptUser = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const d = request.data || {};
    const deptUserID = String(d.deptUserID || "").trim();
    const deptUserPWD = String(d.deptUserPWD || "");
    if (!deptUserID || !deptUserPWD) {
      throw new HttpsError("invalid-argument", "부서사용자 ID/PW를 입력하세요.");
    }
    const svc = htService();
    try {
      const res = await callPopbill((ok, err) =>
        svc.registDeptUser(memberCorpNum(), deptUserID, deptUserPWD, "", "", ok, err)
      );
      await writeLog(request, { type: "htDeptUser", target: maskName(deptUserID), ok: true });
      return res;
    } catch (e) {
      await writeLog(request, { type: "htDeptUser", target: maskName(deptUserID), ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);

// 수집 요청 → JobID 반환
exports.popbillHometaxRequestJob = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const d = request.data || {};
    const queryType = HT_QUERY_TYPES.includes(d.queryType) ? d.queryType : "SELL";
    const dType = HT_DATE_TYPES.includes(d.dType) ? d.dType : "W";
    const sDate = sanitizeDate8(d.sDate);
    const eDate = sanitizeDate8(d.eDate);
    const svc = htService();
    try {
      const jobID = await callPopbill((ok, err) =>
        svc.requestJob(memberCorpNum(), queryType, dType, sDate, eDate, "", ok, err)
      );
      await writeLog(request, { type: "htJob", target: `${queryType} ${sDate}~${eDate}`, ok: true, summary: String(jobID || "") });
      return { jobID: jobID };
    } catch (e) {
      await writeLog(request, { type: "htJob", target: `${queryType} ${sDate}~${eDate}`, ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);

// 수집 작업 상태 (jobState/errorCode 등)
exports.popbillHometaxJobState = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const jobID = String((request.data && request.data.jobID) || "").trim();
    if (!jobID) throw new HttpsError("invalid-argument", "jobID가 필요합니다.");
    const svc = htService();
    return await callPopbill((ok, err) => svc.getJobState(memberCorpNum(), jobID, "", ok, err));
  }
);

// 수집 결과 검색 (필터는 기본 전체)
exports.popbillHometaxSearch = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const d = request.data || {};
    const jobID = String(d.jobID || "").trim();
    if (!jobID) throw new HttpsError("invalid-argument", "jobID가 필요합니다.");
    const page = Number(d.page) > 0 ? Number(d.page) : 1;
    const perPage = Math.min(Number(d.perPage) > 0 ? Number(d.perPage) : 20, 1000);
    const svc = htService();
    // Type/TaxType/PurposeType 빈 배열 = 전체. TaxRegID 미사용.
    return await callPopbill((ok, err) =>
      svc.search(memberCorpNum(), jobID, [], [], [], "", 0, "", page, perPage, "D", "", "", ok, err)
    );
  }
);

/* ════════════════════════════════════════════════════════════════
   메시징 (문자) — 5순위
   - 읽기(발신번호 목록·단가)는 안전. 발송(sendSMS)은 외부 전송·과금이므로
     프론트에서 확인 후에만 호출되며, 기본 정책상 테스트 발송 용도다.
   ════════════════════════════════════════════════════════════════ */
function msgService() {
  ensureConfigured();
  return popbill.MessageService();
}

function maskPhone(v) {
  const d = String(v || "").replace(/[^0-9]/g, "");
  if (d.length < 4) return "***";
  return d.slice(0, 3) + "-****-" + d.slice(-4); // 010-****-5678
}

// 등록된 발신번호 목록 (읽기 전용)
exports.popbillMsgSenderNumbers = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const svc = msgService();
    return await callPopbill((ok, err) => svc.getSenderNumberList(memberCorpNum(), "", ok, err));
  }
);

// 문자 단가 정보 (읽기 전용)
exports.popbillMsgChargeInfo = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const messageType = ["SMS", "LMS", "MMS"].includes(request.data && request.data.messageType) ? request.data.messageType : "SMS";
    const svc = msgService();
    return await callPopbill((ok, err) => svc.getChargeInfo(memberCorpNum(), messageType, "", ok, err));
  }
);

// 문자(SMS) 발송 — 외부 전송·과금. 프론트에서 확인 후 호출.
exports.popbillSendSMS = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const d = request.data || {};
    const sender = String(d.sender || "").replace(/[^0-9]/g, "");
    const receiver = String(d.receiver || "").replace(/[^0-9]/g, "");
    const contents = String(d.contents || "").trim();
    if (!sender || !receiver || !contents) {
      throw new HttpsError("invalid-argument", "발신번호·수신번호·내용을 입력하세요.");
    }
    const svc = msgService();
    try {
      const receiptNum = await callPopbill((ok, err) =>
        svc.sendSMS(memberCorpNum(), sender, receiver, "", contents, "", false, "", "", "", ok, err)
      );
      await writeLog(request, { type: "sms", target: maskPhone(receiver), ok: true, summary: "전송요청" });
      return { receiptNum: receiptNum };
    } catch (e) {
      await writeLog(request, { type: "sms", target: maskPhone(receiver), ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);
