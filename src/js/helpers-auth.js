/* ════════ HELPERS ════════ */
const GC_Dark = 'rgba(255,255,255,.06)';
const GC_Light = 'rgba(0,0,0,.05)';
const TC_Dark = '#868e96';
const TC_Light = '#495057';

/* HTML 이스케이프 — 사용자 입력을 innerHTML에 넣기 전 반드시 통과시킬 것 (XSS 방어) */
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function isDark() { return document.documentElement.classList.contains('dark'); }
function getGridColor() { return isDark() ? GC_Dark : GC_Light; }
function getTextColor() { return isDark() ? TC_Dark : TC_Light; }

// 커스텀 알림 토스트 (alert 대신 사용)
function showToast(message, type = 'success') {
  const container = inp('toast-container');
  if (!container) return;

  // 동일 메시지 중복 방지: 이미 같은 메시지가 있으면 타이머만 리셋
  const existing = [...container.querySelectorAll('.toast')].find(t => t.dataset.msg === message);
  if (existing) {
    clearTimeout(Number(existing.dataset.timer));
    const newTimer = setTimeout(() => {
      existing.style.animation = 'toastIn 0.25s reverse ease-out';
      setTimeout(() => { existing.remove(); }, 240);
    }, 3000);
    existing.dataset.timer = newTimer;
    return;
  }

  // 최대 4개 초과 시 가장 오래된 토스트 즉시 제거
  const toasts = container.querySelectorAll('.toast');
  if (toasts.length >= 4) {
    const oldest = toasts[0];
    clearTimeout(Number(oldest.dataset.timer));
    oldest.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.dataset.msg = message;

  let icon = 'ti-circle-check';
  if (type === 'error') icon = 'ti-circle-x';
  else if (type === 'info') icon = 'ti-info-circle';

  toast.innerHTML = `<i class="ti ${icon}"></i><span>${esc(message)}</span>`;
  container.appendChild(toast);

  const timer = setTimeout(() => {
    toast.style.animation = 'toastIn 0.25s reverse ease-out';
    setTimeout(() => { toast.remove(); }, 240);
  }, 3000);
  toast.dataset.timer = timer;
}

function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
function fmtW(n) {
  if (n >= 100000000) return `₩${(Math.round(n/1000000)/100).toFixed(2)}억`;
  if (n >= 10000) return `₩${Math.round(n/10000)}만`;
  return `₩${fmt(n)}`;
}
function today() { return new Date().toISOString().slice(0,10); }
function daysUntil(d) {
  if (!d) return 999;
  return Math.ceil((new Date(d) - new Date(today())) / 86400000);
}
function dayBadge(d) {
  const n = daysUntil(d);
  if (n < 0) return `<span class="day-badge day-urgent">D+${-n} 경과</span>`;
  if (n === 0) return `<span class="day-badge day-urgent">D-Day</span>`;
  if (n <= 14) return `<span class="day-badge day-urgent">D-${n}</span>`;
  if (n <= 30) return `<span class="day-badge day-warn">D-${n}</span>`;
  return `<span class="day-badge day-ok">D-${n}</span>`;
}
function v(id) { return document.getElementById(id)?.value || ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function inp(id) { return document.getElementById(id); }

function nextCode(prefix, list, field='id') {
  const nums = list.map(x => parseInt((x[field] || '').split('-').pop()) || 0);
  let n = (nums.length ? Math.max(...nums) : 0) + 1;
  let code = `${prefix}-${String(n).padStart(3, '0')}`;
  // 동시 등록 등으로 같은 번호가 이미 존재하면 빈 번호까지 증가 (중복 ID 방지)
  while (list.some(x => x[field] === code)) {
    n++; code = `${prefix}-${String(n).padStart(3, '0')}`;
  }
  return code;
}
/* KPI 카드 클릭 → 페이지의 상태 필터 select 를 해당 값으로 토글(같은 값 재클릭 시 전체 복구) 후 재렌더.
   renderFn 에 인자가 필요한 경우(renderSalesDoc('statement') 등) ...args 로 전달. */
function kpiFilter(selectId, value, renderFn, ...args) {
  const sel = inp(selectId); if (!sel) return;
  sel.value = (sel.value === value) ? '' : value;
  if (typeof window[renderFn] === 'function') window[renderFn](...args);
}
/* 정적 HTML KPI 카드의 활성(필터됨) 강조 토글. map = { 상태값: 카드값요소id } */
function _kpiActive(selectId, map) {
  const sel = inp(selectId); const fs = sel ? sel.value : '';
  Object.keys(map).forEach(val => {
    const valEl = inp(map[val]);
    const card = valEl && valEl.closest('.mc');
    if (card) {
      card.classList.add('clickable');
      card.classList.toggle('kpi-active', fs === val);
    }
  });
}
function getClientName(id) { return clients.find(c => c.id === id)?.name || id; }
function getProductById(id) { return products.find(p => p.id === id); }
function getProductName(id) { return getProductById(id)?.name || id; }
function getMatAmt(m) { return m.unitPrice * m.qty; }

function normalizeTimeValue(value, fallback='') {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return fallback;
  let hour, minute;
  if (/^\d{1,2}$/.test(raw)) {
    hour = Number(raw);
    minute = 0;
  } else if (/^\d{3,4}$/.test(raw)) {
    const padded = raw.padStart(4, '0');
    hour = Number(padded.slice(0, 2));
    minute = Number(padded.slice(2));
  } else {
    const match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return fallback || raw;
    hour = Number(match[1]);
    minute = Number(match[2]);
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback || raw;
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function statusBadge(s) {
  const m = {
    '생산중': 'bd-info', '진행중': 'bd-info', '발주': 'bd-info', '접수': 'bd-info', '처리중': 'bd-info',
    '완료': 'bd-ok', '입고완료': 'bd-ok', '합격': 'bd-ok', '근무중': 'bd-ok',
    '자재준비': 'bd-warn', '대기': 'bd-neu', '발주전': 'bd-neu', '견적': 'bd-neu', '설계중': 'bd-neu',
    '조치중': 'bd-warn', '지연': 'bd-err', '납기지연': 'bd-err', '결근': 'bd-err', '불합격': 'bd-err',
    '조건부합격': 'bd-warn', '정비지원': 'bd-warn', '휴가': 'bd-neu', '반차': 'bd-neu', '보류': 'bd-neu',
    '정상': 'bd-ok', '외근': 'bd-info', '연장근무': 'bd-info', '휴일근무': 'bd-info',
    '지각': 'bd-warn', '조퇴': 'bd-warn'
  };
  return `<span class="bd ${m[s] || 'bd-neu'}">${esc(s)}</span>`;
}

function pctBar(done, qty, w=60) {
  const p = qty > 0 ? Math.min(100, Math.round(done/qty*100)) : 0;
  const c = p === 100 ? '#37b24d' : p >= 70 ? '#185FA5' : '#f76707';
  return `
    <div style="display:flex; align-items:center; gap:6px;">
      <div class="pb" style="width:${w}px;"><div class="pf" style="width:${p}%; background:${c};"></div></div>
      <span style="font-size:11px; font-weight:600; width:30px;">${p}%</span>
    </div>`;
}

function empty(msg='데이터 정보가 존재하지 않습니다.') {
  return `<div class="empty"><i class="ti ti-inbox"></i>${msg}</div>`;
}

/* 공정 단계 색상 — 전역 (renderClients, renderProcess 등 공통 사용) */
const STAGE_COLORS = {
  '설계/도면':'#6741d9','자재발주':'#1c7ed6','가공/제작':'#e8590c',
  '조립':'#2b8a3e','배선/전기':'#0b7285','검사/시험':'#c92a2a',
  '완료':'#0ca678','납품':'#2b8a3e'
};
function stageColor(s) { return STAGE_COLORS[s] || '#868e96'; }

/* ════════ 권한 제어 ════════
   관리자 비밀번호 인증 기능 제거됨 — 클라우드 로그인(추후 구글 로그인 연동)이 인증 담당.
   세부 권한은 역할 기반(RBAC)으로 관리. */
function updateAdminUI() {
  const logoutItem = inp('topbar-logout-item');
  if (logoutItem) logoutItem.style.display = _cloudActive ? 'flex' : 'none';
  refreshPage(currentPage);
}

function checkAdminAction(fn = null) {
  if (fn) fn();
  return true;
}
