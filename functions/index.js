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
