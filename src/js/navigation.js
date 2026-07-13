/* ════════ UI 패널 및 대화창 조작 ════════ */
function togglePanel(id) {
  const p = inp(id); if (!p) return;
  const was = p.classList.contains('open');
  document.querySelectorAll(`#pg-${currentPage} .add-panel.open`).forEach(x => x.classList.remove('open'));
  if (!was) {
    p.classList.add('open');
    setTimeout(() => { const f = p.querySelector('input:not([readonly]), select, textarea'); if (f) f.focus(); }, 120);
  }
}
function closePanel(id) { inp(id)?.classList.remove('open'); }

const TOPNAV_GROUP_PAGES = {
  main: ['dashboard','clients','materials','deliveries','calendar'],
  process: ['orders','quality','claims','as'],
  inventory: ['inventory'],
  documents: ['notes','rfq','po'],
  business: ['salesdoc','statement','taxinvoice','partners','bom','finance','workers'],
  system: ['system']
};

function closeTopNavMenus() {
  document.querySelectorAll('.topnav-group.open').forEach(group => group.classList.remove('open'));
}

function setMegaMenuOpen(open) {
  const menu = inp('topnav');
  const button = inp('menu-toggle-btn');
  const backdrop = inp('sidebar-backdrop');
  if (!menu) return;
  menu.classList.toggle('mega-open', open);
  document.body.classList.toggle('mega-menu-open', open);
  document.body.classList.toggle('mega-menu-backdrop-active', open);
  button?.classList.toggle('active', open);
  button?.setAttribute('aria-expanded', open ? 'true' : 'false');
  backdrop?.classList.toggle('active', open);
  if (open) {
    closeTopbarAlerts();
    closeTopbarMoreMenu();
  }
}

function toggleMegaMenu() {
  setMegaMenuOpen(!inp('topnav')?.classList.contains('mega-open'));
}

function closeMegaMenu() {
  setMegaMenuOpen(false);
}

function toggleTopNavGroup(group, event) {
  if (event) event.stopPropagation();
  if (!group) return;
  const open = !group.classList.contains('open');
  closeTopNavMenus();
  closeTopbarAlerts();
  closeTopbarMoreMenu();
  if (open) group.classList.add('open');
}

function syncTopNavActive(page, inventoryKey) {
  document.querySelectorAll('.topnav-group, .topnav-menu button, .topnav-home').forEach(el => el.classList.remove('active'));
  const home = document.querySelector('.topnav-home');
  if (page === 'dashboard' && home?.classList.contains('topnav-home')) home.classList.add('active');
  const itemSelector = page === 'inventory' && inventoryKey
    ? `.topnav-menu button[data-top-page="inventory"][data-inventory-key="${inventoryKey}"]`
    : `.topnav-menu button[data-top-page="${page}"]`;
  const item = document.querySelector(itemSelector);
  if (item) {
    item.classList.add('active');
    item.closest('.topnav-group')?.classList.add('active');
  }
}

function openTopNavItem(page, inventoryKey) {
  closeMegaMenu();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (page !== 'dashboard' && typeof pageAllowed === 'function' && !pageAllowed(page)) {
    showToast('이 페이지에 접근할 권한이 없습니다.', 'error');
    return;
  }
  if (page === 'inventory') goInventory(inventoryKey || 'finished', null);
  else go(page, null);
  syncTopNavActive(page, inventoryKey);
}

function toggleTopbarAlerts() {
  const wrap = inp('topbar-alert');
  const button = inp('topbar-alert-btn');
  if (!wrap) return;
  closeMegaMenu();
  closeTopNavMenus();
  closeTopbarMoreMenu();
  const open = wrap.classList.toggle('open');
  if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && typeof renderTopbarAlerts === 'function') renderTopbarAlerts(true);
}
function closeTopbarAlerts() {
  const wrap = inp('topbar-alert');
  const button = inp('topbar-alert-btn');
  if (wrap) wrap.classList.remove('open');
  if (button) button.setAttribute('aria-expanded', 'false');
}

function toggleTopbarMoreMenu() {
  const wrap = inp('topbar-more');
  const button = inp('topbar-more-btn');
  if (!wrap) return;
  closeMegaMenu();
  closeTopNavMenus();
  closeTopbarAlerts();
  const open = wrap.classList.toggle('open');
  if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function closeTopbarMoreMenu() {
  const wrap = inp('topbar-more');
  const button = inp('topbar-more-btn');
  if (wrap) wrap.classList.remove('open');
  if (button) button.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', function(event) {
  const moreWrap = inp('topbar-more');
  const alertWrap = inp('topbar-alert');
  const topnav = inp('topnav');
  if (moreWrap && !moreWrap.contains(event.target)) closeTopbarMoreMenu();
  if (alertWrap && !alertWrap.contains(event.target)) closeTopbarAlerts();
  if (topnav && !topnav.contains(event.target)) closeTopNavMenus();
});
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeMegaMenu();
    closeTopNavMenus();
    closeTopbarMoreMenu();
    closeTopbarAlerts();
  }
});

let _cfn = null;
function confirm_(title, msg, fn, btnCls = 'btn-danger', btnIcon = 'ti-trash') {
  _cfn = fn;
  inp('dlgTitle').textContent = title;
  inp('dlgMsg').innerHTML = msg;
  const okBtn = inp('dlgOkBtn');
  okBtn.className = `btn ${btnCls}`;
  okBtn.innerHTML = `<i class="ti ${btnIcon}"></i>실행`;
  okBtn.onclick = () => { if (_cfn) _cfn(); closeDlg(); };
  inp('confirmDlg').classList.add('open');
}
function closeDlg() { inp('confirmDlg').classList.remove('open'); _cfn = null; }

function fillClientSelect(elId, includeAll=false) {
  const el = inp(elId); if (!el) return;
  const entityType = String(elId || '').indexOf('proc-') === 0 ? 'processClient' : 'clients';
  const list = typeof visibleRecords === 'function' ? visibleRecords(clients, entityType) : clients;
  el.innerHTML = (includeAll ? '<option value="">전체 의뢰 고객사</option>' : '') + list.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}
function fillProductSelect(elId, clientId, selected='') {
  const el = inp(elId); if (!el) return;
  const entityType = String(elId || '').indexOf('proc-') === 0 ? 'processProduct' : 'products';
  const source = typeof visibleRecords === 'function' ? visibleRecords(products, entityType) : products;
  const list = clientId ? source.filter(p => p.clientId === clientId) : source;
  el.innerHTML = '<option value="">-- 품목 선택 --</option>' + list.map(p => `<option value="${esc(p.id)}"${p.id===selected?' selected':''}>${esc(p.name)}</option>`).join('');
}
function fillStageSelect(elId) {
  const el = inp(elId); if (!el) return;
  el.innerHTML = processStages.map(s => `<option>${esc(s)}</option>`).join('');
}
function fillWorkerSelect(elId, selected='') {
  const el = inp(elId); if (!el) return;
  el.innerHTML = '<option value="">— 작업원 선택 —</option>' +
    workers.map(w => `<option value="${esc(w.name)}"${w.name===selected?' selected':''}>${esc(w.name)} (라인${esc(w.line)}·${esc(w.role)})</option>`).join('');
}

/* 제품 등록 폼 - 공정단계 선택 시 자동 상태 미리보기 업데이트 */
function onPraStageChange(clientId) {
  const stage   = v('pra-stage');
  const derived = stageToStatus(stage);
  const c       = stageColor(stage);
  const preview = inp(`pra-status-preview-${clientId}`);
  if (preview) {
    preview.innerHTML = `
      <span class="bd" style="background:${c}18; color:${c}; border-color:${c}44; font-size:11px;">${derived}</span>
      <span style="font-size:10px; color:var(--tx-t); margin-left:6px;">공정단계에서 자동 결정됩니다</span>`;
  }
}

/* ════ 사이드바 모드 ════
   숨김 버튼 클릭: 사이드바 완전 숨김 ↔ 표시 (숨김 시 탑바에 표시 버튼만 노출)
   화면 폭 681~1280px: 숨김 상태가 아니면 자동으로 미니 레일(아이콘+명칭) 표시
   숨김 상태는 화면 크기가 변해도 유지 (localStorage 보존)
   미니 레일은 마우스를 올려도 아이콘 상태를 유지하며, 메뉴 클릭 시 바로 이동 */
const SB_AUTO_MINI_MAX = 1280;
const SIDEBAR_GROUP_STATE_KEY = 'mes_sidebarGroupCollapsed';
let _sidebarScrollTimer = null;
const SB_WIDE_MIN = 1180;
let _sidebarModeFrame = 0;
let _sidebarModeObserver = null;
let _sidebarHiddenForSession = false;

function readSidebarGroupState() {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUP_STATE_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch(e) {
    return {};
  }
}

function writeSidebarGroupState(state) {
  try { localStorage.setItem(SIDEBAR_GROUP_STATE_KEY, JSON.stringify(state || {})); } catch(e) {}
}

function sidebarGroupKey(label, index) {
  const text = String(label || '').trim().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '');
  return text || `group-${index + 1}`;
}

function sidebarGroupIconClass(label) {
  const text = String(label || '');
  if (text.includes('메인')) return 'ti-layout-dashboard';
  if (text.includes('공정')) return 'ti-settings-cog';
  if (text.includes('재고')) return 'ti-packages';
  if (text.includes('문서')) return 'ti-files';
  if (text.includes('경영')) return 'ti-briefcase';
  if (text.includes('외부')) return 'ti-plug-connected';
  if (text.includes('시스템')) return 'ti-settings';
  return 'ti-folder';
}

function setSidebarGroupOpen(group, open, persist = true) {
  if (!group) return;
  group.classList.toggle('is-open', !!open);
  group.classList.toggle('is-collapsed', !open);
  const toggle = group.querySelector('.nav-group-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (!persist) return;
  const key = group.dataset.sidebarGroupKey;
  if (!key) return;
  const state = readSidebarGroupState();
  state[key] = !open;
  writeSidebarGroupState(state);
}

function initSidebarExpandableGroups() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.expandableReady === '1') return;
  sidebar.dataset.expandableReady = '1';
  const savedState = readSidebarGroupState();

  Array.from(sidebar.querySelectorAll('.nav-g')).forEach((group, index) => {
    const label = Array.from(group.children).find(el => el.classList?.contains('nav-lbl'));
    const items = Array.from(group.children).filter(el => el.classList?.contains('ni'));
    if (!label || !items.length) return;

    const labelText = label.textContent.trim();
    const key = sidebarGroupKey(labelText, index);
    group.dataset.sidebarGroupKey = key;
    group.classList.add('sidebar-expandable-group');
    label.classList.add('nav-lbl-source');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-group-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', `${labelText} 메뉴 접기/펼치기`);

    const icon = document.createElement('i');
    icon.className = `ti ${sidebarGroupIconClass(labelText)} nav-group-icon`;

    const title = document.createElement('span');
    title.className = 'nav-group-title';
    title.textContent = labelText;

    const chevron = document.createElement('i');
    chevron.className = 'ti ti-chevron-down nav-group-chevron';

    toggle.append(icon, title, chevron);

    const submenu = document.createElement('div');
    submenu.className = 'nav-submenu';
    items.forEach(item => submenu.appendChild(item));

    label.insertAdjacentElement('afterend', toggle);
    toggle.insertAdjacentElement('afterend', submenu);

    toggle.addEventListener('click', () => {
      setSidebarGroupOpen(group, group.classList.contains('is-collapsed'));
    });

    const hasActiveItem = !!submenu.querySelector('.ni.active');
    setSidebarGroupOpen(group, hasActiveItem || !savedState[key], false);
  });

  syncSidebarExpandableGroups();
}

function syncSidebarExpandableGroups() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.expandableReady !== '1') return;
  sidebar.querySelectorAll('.nav-g.sidebar-expandable-group').forEach(group => {
    const visibleItems = Array.from(group.querySelectorAll('.ni')).filter(item => item.style.display !== 'none');
    const hasActiveItem = visibleItems.some(item => item.classList.contains('active'));
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.disabled = visibleItems.length === 0;
    if (hasActiveItem) setSidebarGroupOpen(group, true, false);
  });
}

function initSidebarScrollIndicator() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.scrollIndicatorBound) return;
  sidebar.dataset.scrollIndicatorBound = '1';
  sidebar.addEventListener('scroll', () => {
    sidebar.classList.add('is-scrolling');
    if (_sidebarScrollTimer) clearTimeout(_sidebarScrollTimer);
    _sidebarScrollTimer = setTimeout(() => {
      sidebar.classList.remove('is-scrolling');
      _sidebarScrollTimer = null;
    }, 800);
  }, { passive: true });
}

function toggleSidebar() {
  if (window.innerWidth >= SB_WIDE_MIN) {
    _sidebarHiddenForSession = true;
    document.body.classList.remove('wide-sidebar');
    closeMegaMenu();
    return;
  }
  closeMegaMenu();
}

function isSidebarHiddenByUser() {
  return _sidebarHiddenForSession === true;
}

function togglePrimaryMenu() {
  if (document.body.classList.contains('modern-shell') && window.innerWidth > 900) {
    window.dispatchEvent(new CustomEvent('mes:toggle-context-nav'));
    return;
  }
  if (window.innerWidth >= SB_WIDE_MIN && isSidebarHiddenByUser()) {
    _sidebarHiddenForSession = false;
    applySidebarMode();
    if (document.body.classList.contains('wide-sidebar')) return;
  }
  toggleMegaMenu();
}

function activePageTableOverflows() {
  const activePage = document.querySelector('.content.active');
  if (!activePage) return false;
  return Array.from(activePage.querySelectorAll('table')).some(table => {
    if (!table.offsetParent) return false;
    const wrap = table.parentElement;
    if (!wrap || wrap.clientWidth < 1) return false;
    return table.scrollWidth > wrap.clientWidth + 2;
  });
}

function scheduleSidebarModeCheck() {
  if (_sidebarModeFrame) cancelAnimationFrame(_sidebarModeFrame);
  _sidebarModeFrame = requestAnimationFrame(() => {
    _sidebarModeFrame = requestAnimationFrame(() => {
      _sidebarModeFrame = 0;
      applySidebarMode();
    });
  });
}

function initAdaptiveSidebarObserver() {
  const main = document.querySelector('.main');
  if (_sidebarModeObserver || !main) return;
  _sidebarModeObserver = new MutationObserver(scheduleSidebarModeCheck);
  _sidebarModeObserver.observe(main, { childList: true, subtree: true });
}

/* 현재 화면 폭·숨김 여부에 맞는 사이드바 모드 적용 (부팅·리사이즈·토글 시 호출) */
function applySidebarMode() {
  const body = document.body;
  try { localStorage.removeItem('mes_sbHidden'); } catch(e){}
  body.classList.remove('sb-mini', 'sb-expanded', 'sb-collapsed', 'wide-sidebar');
  if (window.innerWidth < SB_WIDE_MIN || isSidebarHiddenByUser()) return;
  closeMegaMenu();
  body.classList.add('wide-sidebar');
}
window.addEventListener('resize', scheduleSidebarModeCheck);

/* 미니 오버레이 닫기 (배경 딤 클릭 / 메뉴 이동 시) */
function closeSbOverlay() {
  closeMegaMenu();
}

function closeSelectionDetailOnNavigation() {
  window.__selectionDetailSuppressAutoOpen = true;
  if (typeof clearSelectionDetailSelection === 'function') {
    clearSelectionDetailSelection();
    return;
  }
  if (typeof closeSelectionDetailPanel === 'function') {
    closeSelectionDetailPanel(true);
    return;
  }
  document.getElementById('selection-detail-panel')?.classList.remove('open');
}

function closeFloatingEditorsOnNavigation() {
  closeSelectionDetailOnNavigation();
  if (typeof closeReactEntryPanels === 'function') closeReactEntryPanels();
  document.querySelectorAll('.add-panel.open').forEach(panel => panel.classList.remove('open'));
  document.querySelectorAll('.overlay.open').forEach(modal => {
    if (modal.id === 'confirmDlg') return;
    modal.classList.remove('open');
  });
  document.querySelectorAll('.bulk-doc-menu-wrap.open, .selection-detail-status-menu-wrap.open').forEach(menu => {
    menu.classList.remove('open');
  });
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/* 미니 레일 → 전체 모드로 복귀 (숨김 해제 포함) */
function expandSidebar() {
  _sidebarHiddenForSession = false;
  document.body.classList.remove('sb-mini', 'sb-expanded', 'sb-collapsed');
  try { localStorage.removeItem('mes_sbHidden'); } catch(e){}
}

/* 미니 레일 초기화: 각 메뉴에 표시용 라벨 정보 부여 */
function _initSbMini() {
  // data-label (툴팁용)
  document.querySelectorAll('.sidebar .ni').forEach(ni => {
    if (ni.dataset.label) return;
    const txt = ni.textContent.replace(/[0-9]/g,'').trim();
    ni.dataset.label = txt;
  });
}
function toggleMobileSidebar() {
  toggleMegaMenu();
}

/* ── 모듈형 SPA 라우팅 ──
   각 업무 화면은 하나의 index.html 안에서 동작하지만 고유 URL을 가진다.
   예: #/finance/labor, #/workers/att, #/inventory/parts */
let pageHistory = [];
let _routeApplying = false;
let _routeDepth = 0;

const ROUTE_SUBPAGES = {
  dashboard: ['overview','process','resources'],
  system: ['initial','permissions','company','columns','display','templates','backup','api','storage','drive','alimtalk','alerts','trash'],
  workers: ['roster','att','leave'],
  finance: ['dashboard','revenue','purchase','labor','cost','pnl','ar','etc'],
  notes: ['memos','todos','board','report'],
  salesdoc: ['quote','order'],
  deliveries: ['list','closed'],
  inventory: ['finished','parts','office']
};

function currentRouteSegment(page) {
  if (page === 'dashboard') return typeof currentDashTab === 'string' ? currentDashTab : 'overview';
  if (page === 'system') return typeof systemTab === 'string' ? systemTab : 'initial';
  if (page === 'workers') return typeof empTab === 'string' ? empTab : 'roster';
  if (page === 'finance') return typeof financeTab === 'string' ? financeTab : 'dashboard';
  if (page === 'notes') return typeof memoTab === 'string' ? memoTab : 'memos';
  if (page === 'salesdoc') return typeof salesTab === 'string' ? salesTab : 'quote';
  if (page === 'deliveries') return typeof currentDlvTab === 'string' ? currentDlvTab : 'list';
  if (page === 'inventory') {
    return invCategory === '완제품' ? 'finished' : invCategory === '사무비품' ? 'office' : 'parts';
  }
  return '';
}

function appRouteHash(page, segment) {
  const safePage = String(page || 'dashboard').replace(/[^a-z0-9-]/gi, '');
  const allowed = ROUTE_SUBPAGES[safePage];
  const safeSegment = allowed && allowed.includes(segment) ? segment : '';
  return '#/' + safePage + (safeSegment ? '/' + safeSegment : '');
}

function parseAppRoute() {
  const parts = String(location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  let page = parts[0] || 'dashboard';
  if (!inp('pg-' + page)) page = 'dashboard';
  const allowed = ROUTE_SUBPAGES[page] || [];
  const segment = allowed.includes(parts[1]) ? parts[1] : (allowed[0] || '');
  return { page, segment };
}

function writeAppRoute(page, segment, mode) {
  const hash = appRouteHash(page, segment);
  if (location.hash === hash && mode !== 'replace') return;
  if (mode === 'replace') {
    history.replaceState({ mesRoute:true, depth:_routeDepth }, '', hash);
  } else {
    _routeDepth += 1;
    history.pushState({ mesRoute:true, depth:_routeDepth }, '', hash);
  }
  updateTopbarBackButton();
}

function applyRouteSubpage(page, segment) {
  if (page === 'dashboard') currentDashTab = segment || 'overview';
  else if (page === 'system') systemTab = segment || 'initial';
  else if (page === 'workers') empTab = segment || 'roster';
  else if (page === 'finance') financeTab = segment || 'dashboard';
  else if (page === 'notes') memoTab = segment || 'memos';
  else if (page === 'salesdoc') salesTab = segment || 'quote';
  else if (page === 'deliveries') currentDlvTab = segment || 'list';
  else if (page === 'inventory') {
    const meta = INV_CATS[segment] || INV_CATS.finished;
    invCategory = meta.cat;
  }
}

function applyAppRoute() {
  const route = parseAppRoute();
  const canCheckPermission = typeof cloudConfigured !== 'function' || !cloudConfigured() || !!_cloudUser;
  if (canCheckPermission && route.page !== 'dashboard' && typeof pageAllowed === 'function' && !pageAllowed(route.page)) {
    showToast('이 페이지에 접근할 권한이 없습니다.', 'error');
    _routeDepth = 0;
    writeAppRoute('dashboard', '', 'replace');
    return _goTo('dashboard', null);
  }
  _routeApplying = true;
  try {
    applyRouteSubpage(route.page, route.segment);
    if (route.page === 'inventory') {
      const meta = INV_CATS[route.segment] || INV_CATS.finished;
      return _showInventoryPage(route.segment || 'finished', meta, null);
    }
    return _goTo(route.page, null);
  } finally {
    _routeApplying = false;
  }
}

function initAppRouter() {
  const route = parseAppRoute();
  const initialHash = appRouteHash(route.page, route.segment);
  const stateDepth = history.state && history.state.mesRoute ? Number(history.state.depth) || 0 : 0;
  _routeDepth = stateDepth;
  history.replaceState({ mesRoute:true, depth:_routeDepth }, '', initialHash);
  applyAppRoute();
  window.addEventListener('popstate', function(event) {
    _routeDepth = event.state && event.state.mesRoute ? Number(event.state.depth) || 0 : 0;
    applyAppRoute();
    updateTopbarBackButton();
  });
  window.addEventListener('hashchange', function() {
    const route = parseAppRoute();
    if (appRouteHash(currentPage, currentRouteSegment(currentPage)) !== appRouteHash(route.page, route.segment)) {
      applyAppRoute();
    }
  });
}

function syncCurrentSubRoute(page, segment) {
  if (_routeApplying || currentPage !== page) return;
  const nextHash = appRouteHash(page, segment);
  if (location.hash !== nextHash) writeAppRoute(page, segment, 'push');
  window.dispatchEvent(new CustomEvent('mes:navigation', { detail:{ page, segment } }));
}

function updateTopbarBackButton() {
  const btn = inp('topnav-back-btn');
  if (btn) btn.disabled = _routeDepth <= 0;
}

function go(id, el) {
  if (id === currentPage) {                // 같은 페이지 재클릭: 드로어/오버레이만 닫기
    closeFloatingEditorsOnNavigation();
    const sb = document.querySelector('.sidebar');
    if (sb && sb.classList.contains('mobile-open')) { sb.classList.remove('mobile-open'); document.getElementById('sidebar-backdrop')?.classList.remove('active'); }
    closeSbOverlay();
    return;
  }
  if (id !== 'dashboard' && typeof pageAllowed === 'function' && !pageAllowed(id)) {
    showToast('이 페이지에 접근할 권한이 없습니다.', 'error');
    return;
  }
  writeAppRoute(id, currentRouteSegment(id), 'push');
  _goTo(id, el);
}

function goBack() {
  if (_routeDepth <= 0) {
    updateTopbarBackButton();
    return;
  }
  history.back();
}

function _goTo(id, el) {
  // 권한 게이트: 허용되지 않은 페이지는 차단 (대시보드는 항상 허용)
  if (id !== 'dashboard' && typeof pageAllowed === 'function' && !pageAllowed(id)) {
    showToast('이 페이지에 접근할 권한이 없습니다.', 'error');
    if (currentPage !== id) return;
    return;
  }
  closeFloatingEditorsOnNavigation();
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  const page = inp('pg-' + id);
  if (!page) {
    showToast('요청한 화면을 찾을 수 없습니다.', 'error');
    return false;
  }
  page.classList.add('active');

  if (el) {
    el.classList.add('active');
  } else {
    document.querySelectorAll('.ni').forEach(item => {
      if (item.getAttribute('onclick')?.includes(`'${id}'`)) item.classList.add('active');
    });
  }

  // Auto-close mobile drawer + 미니 오버레이
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
  }
  if (backdrop && backdrop.classList.contains('active')) {
    backdrop.classList.remove('active');
  }
  closeSbOverlay();  // 유튜브 방식: 메뉴 이동 시 오버레이 자동 닫기

  const PN = {
    dashboard: '종합 대시보드', clients: '수주 정보 관리', materials: '자재 수급/발주',
    orders: '생산 지시 등록', process: '실시간 공정 관리', quality: '품질 및 검사',
    workers: '인사 관리', inventory: '재고 관리', deliveries: '납품 현황',
    rfq: '견적요청서 관리', po: '구매발주서 관리', partners: '거래처 관리',
    finance: '재무 관리', claims: '고객 클레임 관리', as: '고객 A/S · 사후관리', bom: 'BOM · 자재명세', system: '시스템 관리',
    notes: '메모·할 일',
    statement: '거래명세표 관리', taxinvoice: '세금계산서 관리',
    salesdoc: '견적/수주 관리',
    calendar: '납기 캘린더',
    popbill: 'Popbill API'
  };
  inp('ptitle').textContent = PN[id] || id;
  document.title = (PN[id] || id) + ' — ' + (typeof getAppBrandTitle === 'function' ? getAppBrandTitle() : 'MES Pro');
  currentPage = id;
  syncTopNavActive(id);
  syncSidebarExpandableGroups();
  refreshPage(id);
  scheduleSidebarModeCheck();
  updateTopbarBackButton();
  // 모바일: 페이지 이동 시 홈 오버레이 해제 + 하단 탭 동기화
  document.body.classList.remove('mhome');
  if (typeof syncMobileTab === 'function') syncMobileTab();
  window.dispatchEvent(new CustomEvent('mes:navigation', { detail:{ page:id, segment:currentRouteSegment(id) } }));
  return true;
}

/* 재고 관리 — 분류별(완제품/생산부품/사무비품) 사이드바 진입 */
const INV_CATS = {
  finished: { cat: '완제품',   title: '완제품 재고' },
  parts:    { cat: '생산부품', title: '생산부품 재고' },
  office:   { cat: '사무비품', title: '사무용 비품 재고' }
};
let invCategory = '완제품';

function goInventory(key, el) {
  const meta = INV_CATS[key] || INV_CATS.finished;
  if (currentPage === 'inventory' && invCategory === meta.cat) {
    closeFloatingEditorsOnNavigation();
    closeSbOverlay();
    return;
  }
  writeAppRoute('inventory', key in INV_CATS ? key : 'finished', 'push');
  _showInventoryPage(key, meta, el);
}

function _showInventoryPage(key, meta, el) {
  invCategory = meta.cat;
  closeFloatingEditorsOnNavigation();
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  inp('pg-inventory').classList.add('active');
  if (el) el.classList.add('active');
  else document.querySelectorAll('.ni').forEach(item => {
    if (item.getAttribute('onclick')?.includes(`goInventory('${key}'`)) item.classList.add('active');
  });
  inp('ptitle').textContent = meta.title;
  document.title = meta.title + ' — ' + (typeof getAppBrandTitle === 'function' ? getAppBrandTitle() : 'MES Pro');
  currentPage = 'inventory';
  syncTopNavActive('inventory', key);
  syncSidebarExpandableGroups();
  renderInventory();
  scheduleSidebarModeCheck();
  updateTopbarBackButton();
  // 모바일 드로어 닫기
  const sb = document.querySelector('.sidebar');
  if (sb && sb.classList.contains('mobile-open')) { sb.classList.remove('mobile-open'); document.getElementById('sidebar-backdrop')?.classList.remove('active'); }
  window.dispatchEvent(new CustomEvent('mes:navigation', { detail:{ page:'inventory', segment:key } }));
  return true;
}

function refreshPage(id) {
  if (id === 'dashboard') renderDashboard();
  else if (id === 'clients') renderClients();
  else if (id === 'materials') { syncFilterDropdowns(); renderMaterials(); }
  else if (id === 'orders') renderOrders();
  else if (id === 'process') renderProcess();
  else if (id === 'quality') renderQuality();
  else if (id === 'claims') renderClaims();
  else if (id === 'statement') renderSalesDoc('statement');
  else if (id === 'taxinvoice') renderSalesDoc('tax');
  else if (id === 'salesdoc') switchSalesTab(salesTab);
  else if (id === 'workers') switchEmpTab(empTab);
  else if (id === 'process') { go('dashboard'); setTimeout(()=>switchDashTab('process'),50); return; }
  else if (id === 'inventory') renderInventory();
  else if (id === 'deliveries') {
    renderDeliveries();
    switchDlvTab(currentDlvTab, inp('dlv-tab-' + currentDlvTab));
  }
  else if (id === 'rfq') renderRfq();
  else if (id === 'po') renderPo();
  else if (id === 'partners') renderPartners();
  else if (id === 'finance') renderFinance();
  else if (id === 'popbill') renderPopbill();
  else if (id === 'as') renderAS();
  else if (id === 'bom') renderBom();
  else if (id === 'notes') renderNotes();
  else if (id === 'system') renderSystem();
  else if (id === 'calendar') renderCalendar();
  if (typeof watchBulk === 'function') watchBulk();   // 일괄 선택 체크박스 부착
}
