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
/* Gemini API 키. 클라이언트에 내려보내지 않는다 —
   예전에는 geminiConfig(mes_v2)에 키를 저장하고 브라우저가 직접 Google 을 호출했는데,
   그 문서는 읽기가 활성 사용자 전체에 열려 있어 staff 도 콘솔에서 키를 꺼낼 수 있었다.
   사용량 기반 과금이라 유출되면 그대로 청구된다. 키는 여기(Secret Manager)에만 둔다. */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const REGION = "asia-northeast3"; // 서울 — 국내 지연 최소화
const EMAIL_MAIL_COLLECTION = "mail";
const BOOTSTRAP_ADMIN_EMAILS = ["lgs7942@naver.com", "lgs79422@gmail.com"];
const MAX_EMAIL_TEXT = 12000;
const MAX_EMAIL_HTML = 20000;
const MAX_EMAIL_ATTACHMENT_BYTES = 650 * 1024;

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

async function requireActiveUser(request) {
  requireAuth(request);
  const email = String((request.auth.token && request.auth.token.email) || "").toLowerCase();
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) return;
  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists || userSnap.data().active === false) {
    throw new HttpsError("permission-denied", "승인된 사용자만 사용할 수 있습니다.");
  }
}

function clipString(value, max) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeEmail(value, label) {
  const email = clipString(value, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", `${label || "이메일"} 형식이 올바르지 않습니다.`);
  }
  return email;
}

function sanitizeEmailList(value, label) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const list = raw.map(v => String(v || "").trim()).filter(Boolean).map(v => sanitizeEmail(v, label));
  if (!list.length) {
    throw new HttpsError("invalid-argument", `${label || "수신 이메일"}을 입력하세요.`);
  }
  if (list.length > 5) {
    throw new HttpsError("invalid-argument", "수신자는 최대 5명까지 가능합니다.");
  }
  return list;
}

function estimateBase64Bytes(content) {
  const clean = String(content || "").replace(/\s/g, "");
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor(clean.length * 3 / 4) - padding;
}

function sanitizeMailAttachment(att) {
  const filename = clipString(att && att.filename, 120) || "document.pdf";
  const content = String((att && (att.content || att.base64)) || "")
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s/g, "");
  if (!content) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
    throw new HttpsError("invalid-argument", "PDF 첨부파일 형식이 올바르지 않습니다.");
  }
  if (estimateBase64Bytes(content) > MAX_EMAIL_ATTACHMENT_BYTES) {
    throw new HttpsError("invalid-argument", "PDF 첨부파일 용량이 너무 큽니다.");
  }
  return {
    filename: filename.replace(/[\\/:*?"<>|]/g, "_"),
    content,
    encoding: "base64",
    contentType: "application/pdf",
  };
}

function textToHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

exports.queueDocumentEmail = onCall(
  { region: REGION },
  async (request) => {
    await requireActiveUser(request);
    const d = request.data || {};
    const to = sanitizeEmailList(d.to, "수신 이메일");
    const subject = clipString(d.subject, 180);
    const text = clipString(d.text || d.message, MAX_EMAIL_TEXT);
    const html = clipString(d.html, MAX_EMAIL_HTML);
    if (!subject) {
      throw new HttpsError("invalid-argument", "메일 제목을 입력하세요.");
    }
    if (!text && !html) {
      throw new HttpsError("invalid-argument", "메일 본문을 입력하세요.");
    }

    const message = {
      subject,
      text: text || html.replace(/<[^>]+>/g, " "),
      html: html || textToHtml(text),
    };
    if (d.replyTo) message.replyTo = sanitizeEmail(d.replyTo, "답장 이메일");

    const attachments = Array.isArray(d.attachments)
      ? d.attachments.map(sanitizeMailAttachment).filter(Boolean)
      : [];
    if (attachments.length > 1) {
      throw new HttpsError("invalid-argument", "첨부파일은 1개만 발송할 수 있습니다.");
    }
    if (d.requireAttachment && !attachments.length) {
      throw new HttpsError("invalid-argument", "PDF 첨부파일이 준비되지 않았습니다.");
    }
    if (attachments.length) message.attachments = attachments;

    const ref = await db.collection(EMAIL_MAIL_COLLECTION).add({
      to,
      message,
      source: {
        docType: clipString(d.docType, 40),
        docId: clipString(d.docId, 80),
        attachmentCount: attachments.length,
      },
      createdBy: {
        uid: request.auth.uid,
        email: (request.auth.token && request.auth.token.email) || "",
      },
      createdAt: FieldValue.serverTimestamp(),
      status: "queued",
    });
    logger.info("document email queued", {
      uid: request.auth.uid,
      docType: clipString(d.docType, 40),
      hasAttachment: !!attachments.length,
    });
    return { id: ref.id };
  }
);

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

/* ════════════════════════════════════════════════════════════════
   전자세금계산서 발행 — 4순위 (테스트 발행 전용 샌드박스)
   - 운영영향이 크므로 IsTest=true(테스트 모드)에서만 발행 허용한다.
   - 정발행/영수/과세 고정, 공급자=우리 회사, 최소 입력만 받아 나머지는 테스트 기본값.
   ════════════════════════════════════════════════════════════════ */
function txService() {
  ensureConfigured();
  return popbill.TaxinvoiceService();
}
function isTestMode() {
  return POPBILL_IS_TEST.value() !== "false";
}
function toInt(v) {
  const n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// 테스트 세금계산서 정발행
exports.popbillIssueTaxinvoiceTest = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    if (!isTestMode()) {
      throw new HttpsError("failed-precondition", "테스트 발행은 테스트 모드에서만 허용됩니다(POPBILL_IS_TEST=true).");
    }
    const d = request.data || {};
    const invoiceeCorpNum = sanitizeCorpNum(d.invoiceeCorpNum);
    const invoiceeCorpName = String(d.invoiceeCorpName || "").trim() || "공급받는자";
    const itemName = String(d.itemName || "").trim() || "품목";
    const supplyCost = toInt(d.supplyCost);
    if (supplyCost <= 0) throw new HttpsError("invalid-argument", "공급가액을 입력하세요.");
    const tax = d.tax != null && String(d.tax) !== "" ? toInt(d.tax) : Math.round(supplyCost * 0.1);
    const total = supplyCost + tax;

    const now = new Date();
    const writeDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const mgtKey = "T" + Date.now(); // 공급자 문서관리번호(고유)
    const ourCorpNum = memberCorpNum();

    const Taxinvoice = {
      writeDate, chargeDirection: "정과금", issueType: "정발행", purposeType: "영수",
      issueTiming: "직접발행", taxType: "과세",
      invoicerCorpNum: ourCorpNum, invoicerMgtKey: mgtKey,
      invoicerCorpName: String(d.invoicerCorpName || "테스트공급자"),
      invoicerCEOName: String(d.invoicerCEOName || "대표자"),
      invoicerAddr: "주소", invoicerBizClass: "업종", invoicerBizType: "업태",
      invoicerContactName: "담당자", invoicerTEL: "070-0000-0000",
      invoicerEmail: String(d.invoicerEmail || ""), invoicerSMSSendYN: false,
      invoiceeType: "사업자", invoiceeCorpNum, invoiceeCorpName,
      invoiceeCEOName: String(d.invoiceeCEOName || "대표자"),
      invoiceeContactName1: "담당자", invoiceeEmail1: String(d.invoiceeEmail || ""),
      invoiceeSMSSendYN: false,
      supplyCostTotal: String(supplyCost), taxTotal: String(tax), totalAmount: String(total),
      detailList: [{ serialNum: 1, itemName, qty: "1", unitCost: String(supplyCost), supplyCost: String(supplyCost), tax: String(tax) }],
    };

    const svc = txService();
    try {
      const res = await callPopbill((ok, err) =>
        svc.registIssue(ourCorpNum, Taxinvoice, false, false, "테스트 발행", "", "", "", ok, err)
      );
      await writeLog(request, { type: "taxinvoice", target: maskCorpNum(invoiceeCorpNum), ok: true, summary: "발행 " + mgtKey });
      return { mgtKey, result: res };
    } catch (e) {
      await writeLog(request, { type: "taxinvoice", target: maskCorpNum(invoiceeCorpNum), ok: false, errorCode: (e && e.details && e.details.code) || (e && e.code) || "" });
      throw e;
    }
  }
);

// 발행 세금계산서 상태/요약 조회 (공급자 문서관리번호 기준)
exports.popbillTaxinvoiceInfo = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const mgtKey = String((request.data && request.data.mgtKey) || "").trim();
    if (!mgtKey) throw new HttpsError("invalid-argument", "문서관리번호가 필요합니다.");
    const svc = txService();
    return await callPopbill((ok, err) => svc.getInfo(memberCorpNum(), "SELL", mgtKey, "", ok, err));
  }
);

// 발행 문서 팝빌 팝업 URL
exports.popbillTaxinvoicePopupURL = onCall(
  { region: REGION, secrets: [POPBILL_LINK_ID, POPBILL_SECRET_KEY] },
  async (request) => {
    requireAuth(request);
    const mgtKey = String((request.data && request.data.mgtKey) || "").trim();
    if (!mgtKey) throw new HttpsError("invalid-argument", "문서관리번호가 필요합니다.");
    const svc = txService();
    const url = await callPopbill((ok, err) => svc.getPopUpURL(memberCorpNum(), "SELL", mgtKey, "", ok, err));
    return { url };
  }
);

/* ════════ AI (Gemini) 프록시 ════════════════════════════════════
   클라이언트가 Google 을 직접 호출하지 않는다. 키는 Secret Manager 에만 있고
   여기서만 쓴다(GEMINI_API_KEY 선언부 주석 참고).

   프롬프트는 서버가 소유한다. 클라이언트는 task 이름과 데이터만 보내고,
   무엇을 물을지는 AI_TASKS 가 정한다 — 임의 프롬프트를 받으면 남의 키로
   아무 질문이나 돌리는 통로가 된다.

   AI 는 초안·분류·검색까지만 한다. 금액 확정이나 승인 같은 결론은 내지 않는다. */

const AI_MODEL = "gemini-3.1-flash-lite";
const AI_MAX_INPUT_CHARS = 12000;   // 과금 폭주 방지
const AI_LOG_COLLECTION = "ai_logs";

/* task 별 지시문과 응답 스키마. 클라이언트는 key 만 고를 수 있다. */
const AI_TASKS = {
  // 기존 메모 요약 — 클라이언트 직접 호출(키 노출)에서 이관
  memoSummary: {
    label: "메모 요약",
    system:
      "너는 제조업 ERP의 업무 메모 정리 보조다. 주어진 메모(text)를 한국어로 정리한다. " +
      "summary 는 3문장 이내. 메모에 없는 사실을 지어내지 마라. " +
      "메모에 연도 없이 월·일만 있으면 today 기준 가장 가까운 미래로 해석하고, " +
      "dueDate 는 YYYY-MM-DD 로 쓴다. 날짜를 알 수 없으면 빈 문자열로 둔다.",
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        keyPoints: { type: "array", items: { type: "string" } },
        // 클라이언트(normalizeAiActionItems)가 text/owner/dueDate 를 읽는다 — 구조를 맞춘다
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              owner: { type: "string" },
              dueDate: { type: "string" },
            },
            required: ["text", "owner", "dueDate"],
          },
        },
        risks: { type: "array", items: { type: "string" } },
        suggestedTags: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "keyPoints", "actionItems", "risks", "suggestedTags"],
    },
  },
  // 1순위 — 견적 초안: RFQ + 과거 유사 견적을 주고 단가/비고 초안을 받는다
  quoteDraft: {
    label: "견적 초안",
    system:
      "너는 제조업 ERP의 견적 담당 보조다. 주어진 견적요청(rfq)과 과거 유사 견적(history)을 근거로 " +
      "각 품목의 단가 초안을 제안한다. 과거 이력에 없는 품목은 unitPrice 를 null 로 두고 reason 에 근거 없음을 밝힌다. " +
      "추측으로 숫자를 지어내지 마라. 금액은 원 단위 정수다.",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              unitPrice: { type: ["integer", "null"] },
              reason: { type: "string" },
            },
            required: ["itemName", "unitPrice", "reason"],
          },
        },
        note: { type: "string" },
      },
      required: ["items", "note"],
    },
  },
  // 2순위 — 클레임/AS 분류: 자유 텍스트에서 유형 추천 + 유사 이력 근거
  claimTriage: {
    label: "클레임 분류",
    system:
      "너는 제조업 ERP의 품질 담당 보조다. 클레임 내용(text)을 읽고 types 중에서 유형을 고르고, " +
      "과거 유사 사례(history)를 근거로 조치 방안 초안을 제안한다. types 에 없는 유형을 지어내지 마라. " +
      "확신이 낮으면 confidence 를 낮게 주고 이유를 밝힌다.",
    schema: {
      type: "object",
      properties: {
        type: { type: "string" },
        confidence: { type: "number" },
        action: { type: "string" },
        similar: { type: "array", items: { type: "string" } },
        reason: { type: "string" },
      },
      required: ["type", "confidence", "action", "reason"],
    },
  },
  // 3순위 — 자연어 검색: 질문을 필터 조건으로 변환 (실행은 클라이언트가 한다)
  searchFilter: {
    label: "자연어 검색",
    system:
      "너는 제조업 ERP의 검색 보조다. 사용자의 한국어 질문(query)을 주어진 fields 로만 이루어진 " +
      "필터 조건으로 바꾼다. entity 는 주어진 entities 의 entity 값 중 하나여야 하고, " +
      "field 는 그 entity 의 fields 에 있는 것만 쓴다. " +
      "op 는 =, !=, >, <, >=, <=, contains 만 쓴다. " +
      "날짜는 YYYY-MM-DD 로 쓰고, 기간은 >= 와 <= 두 조건으로 나눠 표현한다(from/to 같은 연산자는 없다). " +
      "'지난달' 같은 상대 표현은 today 를 기준으로 실제 날짜로 바꾼다. " +
      "해석할 수 없으면 filters 를 비우고 reason 에 이유를 쓴다.",
    schema: {
      type: "object",
      properties: {
        entity: { type: "string" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              // enum 으로 못박는다. 예전엔 그냥 string 이라 AI 가 지시문대로 from/to 를 주면
              // 클라이언트(_aiFilterMatch)가 모르는 연산자라 전부 불일치 → 결과 0건이 됐다.
              op: { type: "string", enum: ["=", "!=", ">", "<", ">=", "<=", "contains"] },
              value: { type: "string" },
            },
            required: ["field", "op", "value"],
          },
        },
        reason: { type: "string" },
      },
      required: ["entity", "filters", "reason"],
    },
  },
};

async function aiWriteLog(request, entry) {
  try {
    await db.collection(AI_LOG_COLLECTION).add({
      task: entry.task || "",
      ok: !!entry.ok,
      errorCode: entry.errorCode || "",
      inputChars: entry.inputChars || 0,
      uid: (request.auth && request.auth.uid) || "",
      email: (request.auth && request.auth.token && request.auth.token.email) || "",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.warn("ai log write failed", { code: e && e.code });
  }
}

/* AI 실행. data = { task, payload }
   payload 는 task 별 입력(JSON). 프롬프트 문자열은 받지 않는다. */
exports.aiGenerate = onCall(
  { region: REGION, secrets: [GEMINI_API_KEY] },
  async (request) => {
    await requireActiveUser(request);

    const taskKey = String((request.data && request.data.task) || "").trim();
    const spec = AI_TASKS[taskKey];
    if (!spec) throw new HttpsError("invalid-argument", "지원하지 않는 AI 작업입니다.");

    const payload = (request.data && request.data.payload) || {};
    const payloadText = JSON.stringify(payload);
    if (payloadText.length > AI_MAX_INPUT_CHARS) {
      throw new HttpsError("invalid-argument", "AI 에 보낼 데이터가 너무 큽니다. 범위를 좁혀 주세요.");
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "AI 기능이 설정되지 않았습니다. 관리자에게 문의하세요.");

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(AI_MODEL) + ":generateContent?key=" + encodeURIComponent(apiKey);

    let res, data;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: spec.system }] },
          contents: [{ role: "user", parts: [{ text: payloadText }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: spec.schema,
          },
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      await aiWriteLog(request, { task: taskKey, ok: false, errorCode: "network", inputChars: payloadText.length });
      throw new HttpsError("unavailable", "AI 서버에 연결하지 못했습니다.");
    }

    if (!res.ok) {
      const code = (data.error && data.error.status) || String(res.status);
      // 원문 오류에 키가 섞일 수 있어 그대로 내보내지 않는다.
      logger.warn("aiGenerate upstream error", { task: taskKey, status: res.status, code });
      await aiWriteLog(request, { task: taskKey, ok: false, errorCode: code, inputChars: payloadText.length });
      throw new HttpsError("internal", `AI 호출에 실패했습니다. (${code})`);
    }

    const text =
      data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    let result;
    try {
      result = JSON.parse(text || "{}");
    } catch (e) {
      await aiWriteLog(request, { task: taskKey, ok: false, errorCode: "parse", inputChars: payloadText.length });
      throw new HttpsError("internal", "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
    }

    await aiWriteLog(request, { task: taskKey, ok: true, inputChars: payloadText.length });
    logger.info("aiGenerate ok", { task: taskKey, uid: request.auth.uid });
    return { task: taskKey, result };
  }
);
