/* ════════ Popbill 외부 연동 (준비 단계) ════════
   실제 API 호출/비밀값 없음. 백엔드(Firebase Functions + Secret Manager) 연동 전
   화면 골격과 샘플 응답만 제공한다. 기존 업무 데이터에 자동 반영하지 않는다.
   상세 계획: docs/popbill-api-addition-review-checklist.md */

let popbillTab = 'overview';

function switchPopbillTab(tab) {
  popbillTab = tab;
  renderPopbill();
}

function renderPopbill() {
  const body = inp('popbill-body'); if (!body) return;
  document.querySelectorAll('#popbill-tabs [data-pbtab]').forEach(b =>
    b.classList.toggle('btn-primary', b.dataset.pbtab === popbillTab));
  const map = {
    overview:  _pbOverview,
    bizcheck:  _pbBizCheck,
    account:   _pbAccount,
    hometax:   _pbHometax,
    document:  _pbDocument,
    messaging: _pbMessaging,
    logs:      _pbLogs
  };
  body.innerHTML = (map[popbillTab] || _pbOverview)();
  if (popbillTab === 'logs') pbLoadLogs();
}

/* 공통: 미연동 안내 배너 */
function _pbNotReady(msg) {
  return `<div class="empty" style="padding:24px;">
    <i class="ti ti-lock"></i>
    <div style="margin-top:6px;">${msg || '백엔드 연동 후 활성화됩니다.'}</div>
    <div style="font-size:11px;color:var(--tx-s);margin-top:4px;">현재는 화면 골격만 제공하는 준비 단계입니다.</div>
  </div>`;
}

/* 공통: 비활성 입력 폼(시연용, 동작 없음) */
function _pbDisabledForm(fields, btnLabel) {
  const rows = fields.map(f => `
    <div class="ff" style="margin-bottom:10px;">
      <label>${f.label}</label>
      <input type="text" placeholder="${f.ph || ''}" disabled style="width:100%;height:32px;">
    </div>`).join('');
  return `<div class="card" style="max-width:520px;">
    ${rows}
    <button class="btn btn-primary" disabled style="opacity:.6;cursor:not-allowed;">
      <i class="ti ti-send"></i>${btnLabel}</button>
    <div style="font-size:11px;color:var(--tx-s);margin-top:8px;">* 백엔드 연동 전이라 비활성 상태입니다.</div>
  </div>`;
}

/* ── 개요: API 범위 + 진행 상태 ── */
function _pbOverview() {
  const cats = [
    { g: '데이터',   items: '사업자등록상태조회 · 기업정보조회', icon: 'ti-database', pri: '1순위' },
    { g: '금융',     items: '예금주조회 · 계좌조회',             icon: 'ti-credit-card', pri: '2순위' },
    { g: '데이터',   items: '홈택스수집(매입/매출 세금계산서)',   icon: 'ti-file-search', pri: '3순위' },
    { g: '전자문서', items: '전자세금계산서 · 현금영수증 · 전자명세서', icon: 'ti-file-dollar', pri: '4순위' },
    { g: '메시징',   items: '카카오톡 · 문자 · 팩스',            icon: 'ti-message-2', pri: '5순위' }
  ];
  const cards = cats.map(c => `
    <div class="card" style="display:flex;gap:10px;align-items:flex-start;">
      <i class="ti ${c.icon}" style="font-size:18px;color:var(--tx-i);margin-top:2px;"></i>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${c.g}
          <span class="nbadge" style="background:var(--br-s);color:var(--tx-s);margin-left:4px;">${c.pri}</span>
        </div>
        <div style="font-size:12px;color:var(--tx-s);margin-top:3px;">${c.items}</div>
        <div style="font-size:11px;color:var(--tx-s);margin-top:6px;"><i class="ti ti-clock"></i> 연동 대기</div>
      </div>
    </div>`).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">${cards}</div>`;
}

/* ── 사업자/기업조회: 백엔드(Functions) 호출 연결 ──
   functions: popbillCheckBizState(사업자상태), popbillCheckBizInfo(기업정보). 리전 asia-northeast3. */
const POPBILL_FN_REGION = 'asia-northeast3';

function _pbCloudReady() {
  return (typeof _cloudActive !== 'undefined' && _cloudActive) &&
         typeof firebase !== 'undefined' && firebase.app &&
         typeof firebase.app().functions === 'function';
}

function _pbCallable(name) {
  return firebase.app().functions(POPBILL_FN_REGION).httpsCallable(name);
}

function _pbBizCheck() {
  if (!_pbCloudReady()) {
    return _pbNotReady('클라우드 로그인 후, 백엔드(Functions) 배포가 완료되면 사용할 수 있습니다.');
  }
  return `<div class="card" style="max-width:560px;">
    <div class="ff" style="margin-bottom:10px;">
      <label>사업자등록번호</label>
      <input id="pb-biz-corpnum" type="text" inputmode="numeric" maxlength="12" placeholder="000-00-00000" style="width:100%;height:32px;">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="pbRunBizState()"><i class="ti ti-shield-check"></i>사업자상태 조회</button>
      <button class="btn" onclick="pbRunBizInfo()"><i class="ti ti-building-community"></i>기업정보 조회</button>
    </div>
    <div id="pb-biz-result" style="margin-top:12px;"></div>
  </div>`;
}

function _pbResultBox(id, html) { const el = inp(id); if (el) el.innerHTML = html; }
function _pbLoading(id) { _pbResultBox(id, '<div class="empty" style="padding:16px;"><i class="ti ti-loader"></i> 조회 중…</div>'); }
function _pbError(id, msg) { _pbResultBox(id, '<div class="empty" style="padding:16px;color:#e03131;"><i class="ti ti-alert-triangle"></i> ' + esc(msg || '조회 실패') + '</div>'); }

function _pbRenderObj(obj) {
  if (obj == null || typeof obj !== 'object') return '<pre>' + esc(obj) + '</pre>';
  const rows = Object.keys(obj).map(k =>
    `<tr><th style="text-align:left;padding:4px 10px;color:var(--tx-s);white-space:nowrap;vertical-align:top;">${esc(k)}</th>` +
    `<td style="padding:4px 10px;">${esc(obj[k])}</td></tr>`).join('');
  return `<table style="border-collapse:collapse;font-size:12px;width:100%;">${rows}</table>`;
}

function _pbReadCorpNum() {
  const cn = (inp('pb-biz-corpnum').value || '').replace(/[^0-9]/g, '');
  if (cn.length !== 10) { _pbError('pb-biz-result', '사업자등록번호 10자리를 입력하세요.'); return null; }
  return cn;
}

async function pbRunBizState() {
  const cn = _pbReadCorpNum(); if (!cn) return;
  _pbLoading('pb-biz-result');
  try {
    const res = await _pbCallable('popbillCheckBizState')({ corpNum: cn });
    _pbResultBox('pb-biz-result', '<div style="font-weight:600;margin-bottom:6px;">사업자등록상태</div>' + _pbRenderObj(res.data));
  } catch (e) { _pbError('pb-biz-result', _pbErrMsg(e)); }
}

async function pbRunBizInfo() {
  const cn = _pbReadCorpNum(); if (!cn) return;
  _pbLoading('pb-biz-result');
  try {
    const res = await _pbCallable('popbillCheckBizInfo')({ corpNum: cn });
    _pbResultBox('pb-biz-result', '<div style="font-weight:600;margin-bottom:6px;">기업정보</div>' + _pbRenderObj(res.data));
  } catch (e) { _pbError('pb-biz-result', _pbErrMsg(e)); }
}

function _pbErrMsg(e) {
  if (!e) return '알 수 없는 오류';
  if (e.code === 'functions/unauthenticated') return '로그인이 필요합니다.';
  if (e.code === 'functions/failed-precondition') return (e.message || '') + ' (백엔드 환경값 설정 확인)';
  if (e.code === 'functions/not-found') return '백엔드 함수를 찾을 수 없습니다. firebase deploy 여부를 확인하세요.';
  if (e.code === 'functions/internal') return (e.message || 'Popbill 호출 실패') + ' — 키/설정을 확인하세요.';
  return e.message || String(e);
}

/* 예금주(성명)조회 — 은행/계좌번호로 예금주명 확인. 신원번호 불필요. */
const POPBILL_BANK_CODES = [
  ['0002', '산업은행'], ['0003', '기업은행'], ['0004', '국민은행'], ['0007', '수협'],
  ['0011', '농협'], ['0020', '우리은행'], ['0023', 'SC제일'], ['0027', '씨티'],
  ['0031', '대구은행'], ['0032', '부산은행'], ['0034', '광주은행'], ['0037', '전북은행'],
  ['0039', '경남은행'], ['0045', '새마을금고'], ['0048', '신협'], ['0071', '우체국'],
  ['0081', '하나은행'], ['0088', '신한은행'], ['0089', '케이뱅크'], ['0090', '카카오뱅크'], ['0092', '토스뱅크']
];

function _pbAccount() {
  if (!_pbCloudReady()) {
    return _pbNotReady('클라우드 로그인 후, 백엔드(Functions) 배포가 완료되면 사용할 수 있습니다.');
  }
  const opts = POPBILL_BANK_CODES.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
  return `<div class="card" style="max-width:560px;">
    <div class="ff" style="margin-bottom:10px;">
      <label>은행</label>
      <select id="pb-acc-bank" style="width:100%;height:32px;"><option value="">은행 선택</option>${opts}</select>
    </div>
    <div class="ff" style="margin-bottom:10px;">
      <label>계좌번호</label>
      <input id="pb-acc-num" type="text" inputmode="numeric" maxlength="20" placeholder="숫자만 입력" style="width:100%;height:32px;">
    </div>
    <button class="btn btn-primary" onclick="pbRunAccount()"><i class="ti ti-user-check"></i>예금주 조회</button>
    <div id="pb-acc-result" style="margin-top:12px;"></div>
  </div>`;
}

async function pbRunAccount() {
  const bankCode = (inp('pb-acc-bank').value || '');
  const accountNumber = (inp('pb-acc-num').value || '').replace(/[^0-9]/g, '');
  if (!bankCode) { _pbError('pb-acc-result', '은행을 선택하세요.'); return; }
  if (accountNumber.length < 6) { _pbError('pb-acc-result', '계좌번호를 정확히 입력하세요.'); return; }
  _pbLoading('pb-acc-result');
  try {
    const res = await _pbCallable('popbillCheckAccount')({ bankCode, accountNumber });
    _pbResultBox('pb-acc-result', '<div style="font-weight:600;margin-bottom:6px;">예금주 조회 결과</div>' + _pbRenderObj(res.data));
  } catch (e) { _pbError('pb-acc-result', _pbErrMsg(e)); }
}

/* ── 홈택스 전자세금계산서 수집 (부서사용자 방식) ──
   흐름: 부서사용자 상태 → (필요시)등록 → 수집요청(Job) → 상태확인 → 검색 */
let pbHtJobID = '';

function _pbHometax() {
  if (!_pbCloudReady()) {
    return _pbNotReady('클라우드 로그인 후, 백엔드(Functions) 배포가 완료되면 사용할 수 있습니다.');
  }
  const today = new Date();
  const ymd = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const monthAgo = new Date(today.getTime()); monthAgo.setMonth(monthAgo.getMonth() - 1);
  return `<div style="display:grid;gap:12px;max-width:680px;">
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px;">1. 부서사용자 상태</div>
      <button class="btn" onclick="pbHtCheckDeptUser()"><i class="ti ti-user-search"></i>상태 확인</button>
      <button class="btn btn-icon" onclick="pbHtShowRegister()" title="부서사용자 등록"><i class="ti ti-user-plus"></i></button>
      <div id="pb-ht-dept" style="margin-top:10px;"></div>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px;">2. 수집 요청</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;">
        <div class="ff"><label>유형</label>
          <select id="pb-ht-type" style="height:32px;"><option value="SELL">매출</option><option value="BUY">매입</option><option value="TRUSTEE">위수탁</option></select></div>
        <div class="ff"><label>시작일</label><input id="pb-ht-sdate" type="text" maxlength="10" value="${ymd(monthAgo)}" style="height:32px;width:120px;"></div>
        <div class="ff"><label>종료일</label><input id="pb-ht-edate" type="text" maxlength="10" value="${ymd(today)}" style="height:32px;width:120px;"></div>
        <button class="btn btn-primary" onclick="pbHtRequestJob()"><i class="ti ti-download"></i>수집 요청</button>
      </div>
      <div style="font-size:11px;color:var(--tx-s);margin-top:6px;">YYYYMMDD · 최대 3개월 단위 · 작성일자 기준</div>
      <div id="pb-ht-job" style="margin-top:10px;"></div>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px;">3. 상태 / 결과</div>
      <button class="btn" onclick="pbHtJobState()"><i class="ti ti-refresh"></i>상태 확인</button>
      <button class="btn btn-primary" onclick="pbHtSearch()"><i class="ti ti-list-search"></i>결과 검색</button>
      <div id="pb-ht-result" style="margin-top:10px;"></div>
    </div>
  </div>`;
}

async function pbHtCheckDeptUser() {
  _pbLoading('pb-ht-dept');
  try {
    const res = await _pbCallable('popbillHometaxDeptUserState')({});
    _pbResultBox('pb-ht-dept', '<div style="color:#2b8a3e;"><i class="ti ti-check"></i> 등록·로그인 가능</div>' + _pbRenderObj(res.data));
  } catch (e) {
    _pbResultBox('pb-ht-dept', '<div style="color:#e03131;"><i class="ti ti-alert-triangle"></i> ' + esc(_pbErrMsg(e)) + '</div>' +
      '<div style="font-size:11px;color:var(--tx-s);margin-top:4px;">부서사용자 미등록이면 아래에서 등록하세요.</div>');
    pbHtShowRegister();
  }
}

function pbHtShowRegister() {
  _pbResultBox('pb-ht-dept', `<div class="ff" style="margin-bottom:8px;"><label>부서사용자 ID</label>
      <input id="pb-ht-uid" type="text" autocomplete="off" style="width:100%;height:32px;"></div>
    <div class="ff" style="margin-bottom:8px;"><label>부서사용자 비밀번호</label>
      <input id="pb-ht-upw" type="password" autocomplete="new-password" style="width:100%;height:32px;"></div>
    <button class="btn btn-primary" onclick="pbHtRegisterDeptUser()"><i class="ti ti-user-plus"></i>등록</button>
    <div style="font-size:11px;color:var(--tx-s);margin-top:6px;">홈택스 조회 전용 부서사용자 계정입니다. 비밀번호는 저장되지 않고 등록에만 사용됩니다.</div>
    <div id="pb-ht-reg-result" style="margin-top:8px;"></div>`);
}

async function pbHtRegisterDeptUser() {
  const deptUserID = (inp('pb-ht-uid').value || '').trim();
  const deptUserPWD = (inp('pb-ht-upw').value || '');
  if (!deptUserID || !deptUserPWD) { _pbError('pb-ht-reg-result', '아이디와 비밀번호를 입력하세요.'); return; }
  _pbLoading('pb-ht-reg-result');
  try {
    await _pbCallable('popbillHometaxRegisterDeptUser')({ deptUserID, deptUserPWD });
    _pbResultBox('pb-ht-reg-result', '<div style="color:#2b8a3e;"><i class="ti ti-check"></i> 등록되었습니다. 상태 확인을 다시 눌러주세요.</div>');
  } catch (e) { _pbError('pb-ht-reg-result', _pbErrMsg(e)); }
}

async function pbHtRequestJob() {
  const queryType = inp('pb-ht-type').value;
  const sDate = (inp('pb-ht-sdate').value || '').replace(/[^0-9]/g, '');
  const eDate = (inp('pb-ht-edate').value || '').replace(/[^0-9]/g, '');
  if (sDate.length !== 8 || eDate.length !== 8) { _pbError('pb-ht-job', '날짜를 YYYYMMDD로 입력하세요.'); return; }
  _pbLoading('pb-ht-job');
  try {
    const res = await _pbCallable('popbillHometaxRequestJob')({ queryType, dType: 'W', sDate, eDate });
    pbHtJobID = (res.data && res.data.jobID) || '';
    _pbResultBox('pb-ht-job', '<div style="color:#2b8a3e;"><i class="ti ti-check"></i> 수집 요청됨</div>' +
      '<div style="font-size:12px;margin-top:4px;">JobID: <code>' + esc(pbHtJobID) + '</code> (1시간 유효) — 잠시 후 상태 확인 → 결과 검색</div>');
  } catch (e) { _pbError('pb-ht-job', _pbErrMsg(e)); }
}

async function pbHtJobState() {
  if (!pbHtJobID) { _pbError('pb-ht-result', '먼저 수집 요청을 하세요.'); return; }
  _pbLoading('pb-ht-result');
  try {
    const res = await _pbCallable('popbillHometaxJobState')({ jobID: pbHtJobID });
    _pbResultBox('pb-ht-result', '<div style="font-weight:600;margin-bottom:6px;">작업 상태</div>' + _pbRenderObj(res.data) +
      '<div style="font-size:11px;color:var(--tx-s);margin-top:6px;">jobState=3, errorCode=1 이면 검색 가능합니다.</div>');
  } catch (e) { _pbError('pb-ht-result', _pbErrMsg(e)); }
}

async function pbHtSearch() {
  if (!pbHtJobID) { _pbError('pb-ht-result', '먼저 수집 요청을 하세요.'); return; }
  _pbLoading('pb-ht-result');
  try {
    const res = await _pbCallable('popbillHometaxSearch')({ jobID: pbHtJobID, page: 1, perPage: 50 });
    _pbResultBox('pb-ht-result', _pbRenderHtList(res.data));
  } catch (e) { _pbError('pb-ht-result', _pbErrMsg(e)); }
}

function _pbRenderHtList(data) {
  const list = data && Array.isArray(data.list) ? data.list : null;
  if (!list) return '<div style="font-weight:600;margin-bottom:6px;">검색 결과</div>' + _pbRenderObj(data);
  if (!list.length) return '<div class="empty" style="padding:16px;"><i class="ti ti-inbox"></i> 결과가 없습니다.</div>';
  const cols = Object.keys(list[0]).slice(0, 8);
  const head = cols.map(c => `<th style="padding:5px 8px;text-align:left;color:var(--tx-s);white-space:nowrap;">${esc(c)}</th>`).join('');
  const body = list.map(row =>
    '<tr>' + cols.map(c => `<td style="padding:5px 8px;">${esc(row[c])}</td>`).join('') + '</tr>').join('');
  return `<div style="font-weight:600;margin-bottom:6px;">검색 결과 (${list.length}건)</div>
    <div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;width:100%;">
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function _pbDocument() {
  return _pbNotReady('전자세금계산서 등 문서 발행은 운영 영향이 커 테스트 샌드박스 연동 후 활성화됩니다.');
}

/* ── 메시징(문자) — 읽기(발신번호·단가) + 테스트 발송 ── */
function _pbMessaging() {
  if (!_pbCloudReady()) {
    return _pbNotReady('클라우드 로그인 후, 백엔드(Functions) 배포가 완료되면 사용할 수 있습니다.');
  }
  return `<div style="display:grid;gap:12px;max-width:620px;">
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px;">발신 정보 (읽기 전용)</div>
      <button class="btn" onclick="pbMsgSenders()"><i class="ti ti-address-book"></i>발신번호 목록</button>
      <button class="btn" onclick="pbMsgCharge()"><i class="ti ti-coin"></i>문자 단가</button>
      <div id="pb-msg-info" style="margin-top:10px;"></div>
    </div>
    <div class="card" style="border-left:3px solid #e8590c;">
      <div style="font-weight:600;margin-bottom:4px;">테스트 발송 (SMS)</div>
      <div style="font-size:11px;color:#e8590c;margin-bottom:8px;"><i class="ti ti-alert-triangle"></i> 실제 문자가 전송되고 과금됩니다. 발송 전 확인창이 표시됩니다.</div>
      <div class="ff" style="margin-bottom:8px;"><label>발신번호 (사전 등록된 번호)</label><input id="pb-msg-sender" type="text" inputmode="numeric" placeholder="0212345678" style="width:100%;height:32px;"></div>
      <div class="ff" style="margin-bottom:8px;"><label>수신번호</label><input id="pb-msg-receiver" type="text" inputmode="numeric" placeholder="01012345678" style="width:100%;height:32px;"></div>
      <div class="ff" style="margin-bottom:8px;"><label>내용 (SMS 90바이트)</label><textarea id="pb-msg-content" rows="3" maxlength="90" style="width:100%;font-family:inherit;"></textarea></div>
      <button class="btn btn-primary" onclick="pbSendSMS()"><i class="ti ti-send"></i>테스트 발송</button>
      <div id="pb-msg-send-result" style="margin-top:10px;"></div>
    </div>
  </div>`;
}

async function pbMsgSenders() {
  _pbLoading('pb-msg-info');
  try {
    const res = await _pbCallable('popbillMsgSenderNumbers')({});
    const list = Array.isArray(res.data) ? res.data : (res.data && res.data.list) || null;
    if (list && list.length) {
      const rows = list.map(s => `<tr><td style="padding:4px 10px;">${esc(s.number || s.senderNumber || '')}</td><td style="padding:4px 10px;">${esc(s.representYN ? '대표' : '')}</td></tr>`).join('');
      _pbResultBox('pb-msg-info', '<div style="font-weight:600;margin-bottom:6px;">발신번호</div><table style="border-collapse:collapse;font-size:12px;">' + rows + '</table>');
    } else {
      _pbResultBox('pb-msg-info', '<div style="font-weight:600;margin-bottom:6px;">발신번호</div>' + _pbRenderObj(res.data));
    }
  } catch (e) { _pbError('pb-msg-info', _pbErrMsg(e)); }
}

async function pbMsgCharge() {
  _pbLoading('pb-msg-info');
  try {
    const res = await _pbCallable('popbillMsgChargeInfo')({ messageType: 'SMS' });
    _pbResultBox('pb-msg-info', '<div style="font-weight:600;margin-bottom:6px;">문자 단가(SMS)</div>' + _pbRenderObj(res.data));
  } catch (e) { _pbError('pb-msg-info', _pbErrMsg(e)); }
}

async function pbSendSMS() {
  const sender = (inp('pb-msg-sender').value || '').replace(/[^0-9]/g, '');
  const receiver = (inp('pb-msg-receiver').value || '').replace(/[^0-9]/g, '');
  const contents = (inp('pb-msg-content').value || '').trim();
  if (!sender || !receiver || !contents) { _pbError('pb-msg-send-result', '발신·수신번호와 내용을 입력하세요.'); return; }
  if (!confirm(`실제 문자를 전송합니다(과금).\n수신: ${receiver}\n내용: ${contents}\n\n발송하시겠습니까?`)) return;
  _pbLoading('pb-msg-send-result');
  try {
    const res = await _pbCallable('popbillSendSMS')({ sender, receiver, contents });
    _pbResultBox('pb-msg-send-result', '<div style="color:#2b8a3e;"><i class="ti ti-check"></i> 전송 요청됨</div><div style="font-size:12px;margin-top:4px;">접수번호: <code>' + esc((res.data && res.data.receiptNum) || '') + '</code></div>');
  } catch (e) { _pbError('pb-msg-send-result', _pbErrMsg(e)); }
}

/* ── 조회 로그: Firestore popbill_logs 읽기(백엔드가 마스킹해 기록) ── */
const POPBILL_LOG_TYPE = { bizState: '사업자상태', bizInfo: '기업정보', account: '예금주' };

function _pbLogs() {
  return `<div class="toolbar" style="margin-bottom:8px;">
      <button class="btn btn-icon" onclick="pbLoadLogs()" title="새로고침"><i class="ti ti-refresh"></i></button>
      <span style="font-size:12px;color:var(--tx-s);align-self:center;">최근 조회 이력 (민감정보는 마스킹되어 저장됩니다)</span>
    </div>
    <div id="pb-logs-body"><div class="empty" style="padding:24px;"><i class="ti ti-loader"></i> 불러오는 중…</div></div>`;
}

function _pbLogTime(ts) {
  try {
    const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!d) return '-';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch (e) { return '-'; }
}

async function pbLoadLogs() {
  const box = inp('pb-logs-body'); if (!box) return;
  if (typeof _fbDb === 'undefined' || !_fbDb) {
    box.innerHTML = '<div class="empty" style="padding:24px;"><i class="ti ti-cloud-off"></i> 클라우드 로그인 후 이용할 수 있습니다.</div>';
    return;
  }
  try {
    const snap = await _fbDb.collection('popbill_logs').orderBy('createdAt', 'desc').limit(50).get();
    if (snap.empty) {
      box.innerHTML = '<div class="empty" style="padding:24px;"><i class="ti ti-history"></i> 조회 이력이 없습니다.</div>';
      return;
    }
    const rows = snap.docs.map(doc => {
      const d = doc.data();
      const ok = d.ok
        ? '<span style="color:#2b8a3e;"><i class="ti ti-check"></i> 성공</span>'
        : '<span style="color:#e03131;"><i class="ti ti-x"></i> 실패' + (d.errorCode ? ' (' + esc(d.errorCode) + ')' : '') + '</span>';
      return `<tr>
        <td style="padding:6px 10px;white-space:nowrap;">${esc(_pbLogTime(d.createdAt))}</td>
        <td style="padding:6px 10px;">${esc(POPBILL_LOG_TYPE[d.type] || d.type)}${d.isTest ? ' <span class="nbadge" style="background:#868e96;">테스트</span>' : ''}</td>
        <td style="padding:6px 10px;">${esc(d.target)}</td>
        <td style="padding:6px 10px;">${esc(d.summary)}</td>
        <td style="padding:6px 10px;">${ok}</td>
        <td style="padding:6px 10px;color:var(--tx-s);">${esc(d.email)}</td>
      </tr>`;
    }).join('');
    box.innerHTML = `<div class="card" style="overflow-x:auto;">
      <table style="border-collapse:collapse;font-size:12px;width:100%;">
        <thead><tr style="color:var(--tx-s);text-align:left;">
          <th style="padding:6px 10px;">시각</th><th style="padding:6px 10px;">구분</th>
          <th style="padding:6px 10px;">대상</th><th style="padding:6px 10px;">결과요약</th>
          <th style="padding:6px 10px;">상태</th><th style="padding:6px 10px;">사용자</th>
        </tr></thead><tbody>${rows}</tbody>
      </table></div>`;
  } catch (e) {
    box.innerHTML = '<div class="empty" style="padding:24px;color:#e03131;"><i class="ti ti-alert-triangle"></i> 로그를 불러오지 못했습니다: ' + esc(e && e.message) + '</div>';
  }
}
