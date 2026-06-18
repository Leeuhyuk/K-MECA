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

function _pbHometax() {
  return _pbNotReady('홈택스수집은 인증(부서사용자/공동인증서)과 수집 작업 흐름이 필요해 백엔드 연동 후 활성화됩니다.');
}

function _pbDocument() {
  return _pbNotReady('전자세금계산서 등 문서 발행은 운영 영향이 커 테스트 샌드박스 연동 후 활성화됩니다.');
}

function _pbMessaging() {
  return _pbNotReady('카카오톡·문자·팩스는 기존 알림톡/API 설정과 중복 검토 후 연동합니다.');
}

function _pbLogs() {
  return `<div class="empty" style="padding:24px;">
    <i class="ti ti-history"></i>
    <div style="margin-top:6px;">호출 로그가 없습니다.</div>
    <div style="font-size:11px;color:var(--tx-s);margin-top:4px;">실제 연동 후 조회/전송 이력이 여기에 마스킹되어 표시됩니다.</div>
  </div>`;
}
