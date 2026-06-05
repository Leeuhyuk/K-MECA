/* ════════ HELPERS ════════ */
const GC_Dark = 'rgba(255,255,255,.06)';
const GC_Light = 'rgba(0,0,0,.05)';
const TC_Dark = '#868e96';
const TC_Light = '#495057';

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

  toast.innerHTML = `<i class="ti ${icon}"></i><span>${message}</span>`;
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
  return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
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

function statusBadge(s) {
  const m = {
    '생산중': 'bd-info', '진행중': 'bd-info', '발주': 'bd-info', '접수': 'bd-info', '처리중': 'bd-info',
    '완료': 'bd-ok', '입고완료': 'bd-ok', '합격': 'bd-ok', '근무중': 'bd-ok',
    '자재준비': 'bd-warn', '대기': 'bd-neu', '발주전': 'bd-neu', '견적': 'bd-neu', '설계중': 'bd-neu',
    '조치중': 'bd-warn', '지연': 'bd-err', '납기지연': 'bd-err', '결근': 'bd-err', '불합격': 'bd-err',
    '조건부합격': 'bd-warn', '정비지원': 'bd-warn', '휴가': 'bd-neu', '보류': 'bd-neu'
  };
  return `<span class="bd ${m[s] || 'bd-neu'}">${s}</span>`;
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

/* ════════ 관리자 권한 제어 코어 프로세스 ════════ */
function promptAdmin(callback = null) {
  pendingAdminCallback = callback;
  sv('adminPasswordInput', '');
  inp('adminAuthError').style.display = 'none';
  inp('adminAuthModal').classList.add('open');
  setTimeout(() => inp('adminPasswordInput')?.focus(), 150);
}

function closeAdminAuth() {
  inp('adminAuthModal').classList.remove('open');
  pendingAdminCallback = null;
}

function verifyAdminPassword() {
  const pw = v('adminPasswordInput');
  if (pw === adminPassword) {
    isAdmin = true;
    saveStorage('isAdmin', true);
    showToast('관리자 인증에 성공하였습니다.', 'success');
    closeAdminAuth();
    updateAdminUI();
    if (pendingAdminCallback) {
      const cb = pendingAdminCallback;
      pendingAdminCallback = null;
      cb();
    }
  } else {
    inp('adminAuthError').style.display = 'block';
    inp('adminPasswordInput').focus();
    showToast('비밀번호가 올바르지 않습니다.', 'error');
  }
}

function lockAdmin() {
  isAdmin = false;
  saveStorage('isAdmin', false);
  showToast('관리자 모드가 해제(잠금)되었습니다.', 'info');
  updateAdminUI();
}

// 관리자 비밀번호 변경 처리
function openAdminPasswordChange() {
  sv('currentPasswordInput', '');
  sv('newPasswordInput', '');
  sv('newPasswordConfirmInput', '');
  inp('adminPasswordChangeModal').classList.add('open');
  setTimeout(() => inp('currentPasswordInput')?.focus(), 150);
}

function closeAdminPasswordChange() {
  inp('adminPasswordChangeModal').classList.remove('open');
}

function submitAdminPasswordChange() {
  const currentPw = v('currentPasswordInput');
  const newPw = v('newPasswordInput').trim();
  const confirmPw = v('newPasswordConfirmInput').trim();

  if (currentPw !== adminPassword) {
    showToast('현재 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }
  if (!newPw) {
    showToast('새 비밀번호를 입력해주세요.', 'error');
    return;
  }
  if (newPw !== confirmPw) {
    showToast('새 비밀번호와 확인용 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  adminPassword = newPw;
  saveStorage('adminPassword', adminPassword);
  showToast('관리자 비밀번호가 성공적으로 업데이트되었습니다.', 'success');
  closeAdminPasswordChange();
}

function updateAdminUI() {
  const topbarRight = inp('topbar-admin-area');
  if (topbarRight) {
    if (_cloudActive) {   // 클라우드 로그인 시: 역할 텍스트 숨기고 로그아웃 버튼만 상단에 표시
      topbarRight.innerHTML = `<button class="btn btn-sm btn-danger" onclick="cloudLogout()" title="로그아웃" style="height:26px;padding:0 8px;"><i class="ti ti-logout"></i> 로그아웃</button>`;
    } else if (isAdmin) {
      topbarRight.innerHTML = `
        <span class="pill pill-ok" style="border-radius: 6px;"><i class="ti ti-lock-open"></i> 관리자</span>
        <button class="btn btn-sm" onclick="openAdminPasswordChange()" title="비밀번호 변경" style="height: 26px; padding: 0 8px; margin-right: 4px;"><i class="ti ti-key"></i> 변경</button>
        <button class="btn btn-sm btn-danger" onclick="lockAdmin()" title="관리자 권한 잠금" style="height: 26px; padding: 0 8px;"><i class="ti ti-lock"></i> 잠금</button>
      `;
    } else {
      topbarRight.innerHTML = `
        <button class="btn btn-sm btn-primary" onclick="promptAdmin()" title="관리자 모드 활성화" style="height: 26px; padding: 0 8px;"><i class="ti ti-shield-lock"></i> 관리자 인증</button>
      `;
    }
  }
  refreshPage(currentPage);
}

function checkAdminAction(fn = null) {
  if (_cloudActive) { if (fn) fn(); return true; }   // 클라우드 로그인 시: 역할/페이지 접근(RBAC)이 권한 관리 — 별도 비밀번호 불필요
  if (!isAdmin) {
    promptAdmin(fn);
    return false;
  }
  if (fn) fn();
  return true;
}
