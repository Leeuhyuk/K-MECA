/* ════════════════════════════════════════════════════════════
   모바일 전용 홈 화면 + 하단 탭바
   - ≤680px 환경에서만 동작 (CSS 미디어쿼리와 연동)
   - 홈은 별도 UI, 세부 화면은 기존 페이지(go)를 재사용
   ════════════════════════════════════════════════════════════ */
function isMobileView() {
  return window.matchMedia('(max-width: 680px)').matches;
}

/* 하단 탭 클릭 핸들러 */
function mobileTab(tab) {
  if (tab === 'more') { toggleMobileSidebar(); return; }
  if (tab === 'home') { showMobileHome(); return; }
  if (tab === 'alerts') {
    go('system');
    if (currentPage === 'system') switchSystemTab('alerts');
    return;
  }
  // 나머지는 기존 페이지로 이동 (_goTo가 mhome 해제 + 탭 동기화 수행)
  go(tab);
}

/* 모바일 홈 표시 */
function showMobileHome() {
  document.body.classList.add('mhome');
  renderMobileHome();
  syncMobileTab();
  const mh = inp('mobile-home');
  if (mh) mh.scrollTop = 0;
}

/* 현재 상태에 맞춰 하단 탭 활성화 표시 동기화 */
function syncMobileTab() {
  const active = document.body.classList.contains('mhome')
    ? 'home'
    : (currentPage === 'system' && systemTab === 'alerts' ? 'alerts'
      : (['clients', 'materials'].includes(currentPage) ? currentPage : null));
  document.querySelectorAll('#mobile-tabbar .mtab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === active);
  });
  // 알림 배지 동기화
  const badge = inp('mtab-alert-badge');
  if (badge) {
    const n = (typeof alertsList !== 'undefined') ? alertsList.length : 0;
    badge.textContent = n > 99 ? '99+' : n;
    badge.style.display = n > 0 ? 'block' : 'none';
  }
}

/* 홈 화면 콘텐츠 렌더 (실데이터 기반 KPI · 바로가기 · 임박 납기 · 최근 알림) */
function renderMobileHome() {
  const el = inp('mobile-home');
  if (!el) return;

  const pending     = materials.filter(m => m.status === '발주전').length;
  const orderMats   = materials.filter(m => m.status === '발주중').length;
  const arrived     = materials.filter(m => m.status === '입고완료').length;
  const activeProds = products.filter(p => p.status !== '견적' && !['완료','납품'].includes(p.processStage)).length;
  const doneProds   = products.filter(p => ['완료','납품'].includes(p.processStage)).length;
  const lowStock    = inventory.filter(i => i.qty <= i.minQty && i.minQty > 0).length;
  const openDefects = defects.filter(d => d.status !== '완료').length;
  const openClaims  = claims.filter(c => c.status !== '완료').length;

  // 임박 납기 (진행 중 제품, 납기일 빠른 순)
  const deadlines = products
    .filter(p => p.deliveryDate && p.status !== '견적' && !['완료','납품'].includes(p.processStage))
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    .slice(0, 4);

  const recentAlerts = alertsList.slice(0, 4);
  const alertIco = { err: 'ti-alert-triangle', warn: 'ti-alert-circle', info: 'ti-info-circle' };
  const alertCol = { err: 'var(--tx-d)', warn: 'var(--tx-w)', info: 'var(--tx-i)' };

  el.innerHTML = `
    <div class="mh-hero">
      <span class="mh-greet">MES Pro</span>
      <span class="mh-date">${today()}</span>
    </div>

    <div class="mh-search">
      <i class="ti ti-search mh-s-ico"></i>
      <input type="text" id="mh-search-input" placeholder="통합 검색 (제품·고객사·자재·재고·직원…)"
             autocomplete="off" oninput="mhSearch(this.value)" onkeydown="mhSearchKeyDown(event)">
      <i class="ti ti-x mh-s-clear" id="mh-search-clear" onclick="mhSearchClear()"></i>
    </div>

    <div class="mh-kpis">
      <div class="mh-kpi" onclick="mobileGo('clients')">
        <div class="mh-k-lbl"><i class="ti ti-box" style="color:var(--tx-i);"></i>진행 중 프로젝트</div>
        <div class="mh-k-val" style="color:var(--tx-i);">${activeProds}<span style="font-size:13px;">건</span></div>
        <div class="mh-k-sub">완료 ${doneProds}건 · 전체 ${products.length}종</div>
      </div>
      <div class="mh-kpi" onclick="mobileGo('materials')">
        <div class="mh-k-lbl"><i class="ti ti-circle-dashed" style="color:var(--tx-t);"></i>발주 대기 자재</div>
        <div class="mh-k-val" style="color:${pending > 0 ? 'var(--tx-d)' : 'var(--tx-t)'};">${pending}<span style="font-size:13px;">건</span></div>
        <div class="mh-k-sub">발주중 ${orderMats} · 입고 ${arrived}</div>
      </div>
      <div class="mh-kpi" onclick="mobileGoInv()">
        <div class="mh-k-lbl"><i class="ti ti-packages" style="color:${lowStock > 0 ? 'var(--tx-d)' : 'var(--tx-ok)'};"></i>안전재고 미달</div>
        <div class="mh-k-val" style="color:${lowStock > 0 ? 'var(--tx-d)' : 'var(--tx-ok)'};">${lowStock}<span style="font-size:13px;">품목</span></div>
        <div class="mh-k-sub">전체 재고 ${inventory.length}종</div>
      </div>
      <div class="mh-kpi" onclick="mobileGo('quality')">
        <div class="mh-k-lbl"><i class="ti ti-shield-alert" style="color:${openDefects > 0 ? 'var(--tx-w)' : 'var(--tx-ok)'};"></i>미처리 품질장애</div>
        <div class="mh-k-val" style="color:${openDefects > 0 ? 'var(--tx-w)' : 'var(--tx-ok)'};">${openDefects}<span style="font-size:13px;">건</span></div>
        <div class="mh-k-sub">클레임 ${openClaims}건 처리중</div>
      </div>
    </div>

    <div class="mh-sec-title"><i class="ti ti-bolt"></i>바로가기</div>
    <div class="mh-quick">
      <div class="mh-qbtn" onclick="mobileAction('order')"><i class="ti ti-clipboard-plus"></i>생산지시</div>
      <div class="mh-qbtn" onclick="mobileAction('material')"><i class="ti ti-truck-loading"></i>자재발주</div>
      <div class="mh-qbtn" onclick="mobileGo('deliveries')"><i class="ti ti-truck-delivery"></i>납품현황</div>
      <div class="mh-qbtn" onclick="mobileGoProcess()"><i class="ti ti-layout-kanban"></i>공정관리</div>
    </div>

    <div class="mh-sec-title"><i class="ti ti-calendar-due"></i>임박 납기</div>
    <div class="mh-card">
      ${deadlines.length ? deadlines.map(p => `
        <div class="mh-row" onclick="mobileGoProcess()">
          <div class="mh-r-main">
            <div class="mh-r-t">${esc(p.name)}</div>
            <div class="mh-r-s">${esc(getClientName(p.clientId))} · ${esc(p.processStage)}</div>
          </div>
          ${dayBadge(p.deliveryDate)}
          <i class="ti ti-chevron-right"></i>
        </div>`).join('') : `<div class="mh-empty">진행 중인 납기 일정이 없습니다.</div>`}
    </div>

    <div class="mh-sec-title"><i class="ti ti-bell"></i>최근 알림</div>
    <div class="mh-card">
      ${recentAlerts.length ? recentAlerts.map(a => `
        <div class="mh-row" onclick="mobileGo('alerts')">
          <i class="ti ${alertIco[a.type] || 'ti-info-circle'} mh-r-ico" style="color:${alertCol[a.type] || 'var(--tx-i)'};"></i>
          <div class="mh-r-main">
            <div class="mh-r-t">${esc(a.title) || ''}</div>
            <div class="mh-r-s">${esc(a.sub) || ''}</div>
          </div>
          <i class="ti ti-chevron-right"></i>
        </div>`).join('') : `<div class="mh-empty">새로운 알림이 없습니다.</div>`}
    </div>`;
}

/* 모바일 홈 통합검색 — 기존 글로벌 검색 로직(onGlobalSearch/결과 드롭다운) 재사용 */
function mhSearch(q) {
  const clr = inp('mh-search-clear');
  if (clr) clr.style.display = q.trim() ? 'block' : 'none';
  // 결과 드롭다운을 홈 검색창 바로 아래에 위치시킴
  const box = inp('mh-search-input');
  if (box) document.documentElement.style.setProperty('--mh-results-top', (box.getBoundingClientRect().bottom + 6) + 'px');
  onGlobalSearch(q); // #global-search-results 에 결과 렌더 (모바일에서 fixed 위치로 표시)
}
function mhSearchClear() {
  const i = inp('mh-search-input'); if (i) { i.value = ''; i.focus(); }
  const clr = inp('mh-search-clear'); if (clr) clr.style.display = 'none';
  const r = inp('global-search-results'); if (r) r.style.display = 'none';
}
function mhSearchKeyDown(e) {
  if (e.key === 'Escape') { mhSearchClear(); return; }
  onGlobalSearchKeyDown(e); // 위/아래/Enter 키 결과 탐색 재사용
}

/* 홈 → 페이지 이동 헬퍼 (홈 해제 후 이동) */
function mobileGo(id) {
  document.body.classList.remove('mhome');
  if (id === 'alerts') {
    go('system');
    if (currentPage === 'system') switchSystemTab('alerts');
    return;
  }
  go(id);
}
function mobileGoInv() { document.body.classList.remove('mhome'); goInventory('finished'); syncMobileTab(); }
function mobileGoProcess() {
  document.body.classList.remove('mhome');
  if (currentPage !== 'dashboard') go('dashboard');
  if (typeof switchDashTab === 'function') switchDashTab('process');
  syncMobileTab();
}
function mobileAction(type) {
  document.body.classList.remove('mhome');
  syncMobileTab();
  if (type === 'order' && typeof openOrderAdd === 'function') openOrderAdd();
  else if (type === 'material' && typeof openMatAdd === 'function') openMatAdd();
}

/* 부팅 시: 모바일이면 홈 화면으로 진입 */
if (isMobileView()) {
  document.body.classList.add('mhome');
  renderMobileHome();
}
syncMobileTab();

/* 화면 크기 변경(회전/리사이즈) 대응 */
window.addEventListener('resize', () => {
  if (!isMobileView()) {
    // 데스크톱 전환 시 홈 오버레이 제거 (CSS상 영향 없지만 상태 정리)
    document.body.classList.remove('mhome');
  }
  syncMobileTab();
});
