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
  el.innerHTML = (includeAll ? '<option value="">전체 의뢰 고객사</option>' : '') + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
function fillProductSelect(elId, clientId, selected='') {
  const el = inp(elId); if (!el) return;
  const list = clientId ? products.filter(p => p.clientId === clientId) : products;
  el.innerHTML = '<option value="">-- 품목 선택 --</option>' + list.map(p => `<option value="${p.id}"${p.id===selected?' selected':''}>${p.name}</option>`).join('');
}
function fillStageSelect(elId) {
  const el = inp(elId); if (!el) return;
  el.innerHTML = processStages.map(s => `<option>${s}</option>`).join('');
}
function fillWorkerSelect(elId, selected='') {
  const el = inp(elId); if (!el) return;
  el.innerHTML = '<option value="">— 작업원 선택 —</option>' +
    workers.map(w => `<option value="${w.name}"${w.name===selected?' selected':''}>${w.name} (라인${w.line}·${w.role})</option>`).join('');
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

/* 사이드바 토글 — 모바일은 드로어, 데스크톱은 접기/펴기(상태 저장) */
function toggleSidebar() {
  if (window.innerWidth <= 680) { toggleMobileSidebar(); return; }
  const c = document.body.classList.toggle('sb-collapsed');
  try { localStorage.setItem('mes_sbCollapsed', c ? '1' : ''); } catch(e){}
}
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && backdrop) {
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('active');
    } else {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('active');
    }
  }
}

/* ── 페이지 히스토리 스택 ── */
let pageHistory = [];

function go(id, el) {
  if (id === currentPage) {                // 같은 페이지 재클릭: 모바일 드로어만 닫기
    const sb = document.querySelector('.sidebar');
    if (sb && sb.classList.contains('mobile-open')) { sb.classList.remove('mobile-open'); document.getElementById('sidebar-backdrop')?.classList.remove('active'); }
    return;
  }
  if (currentPage) pageHistory.push(currentPage);
  if (pageHistory.length > 30) pageHistory.shift(); // 최대 30개 유지

  _goTo(id, el);
}

function goBack() {
  if (!pageHistory.length) return;
  const prev = pageHistory.pop();
  _goTo(prev, null);
}

function _goTo(id, el) {
  // 권한 게이트: 허용되지 않은 페이지는 차단 (대시보드는 항상 허용)
  if (id !== 'dashboard' && typeof pageAllowed === 'function' && !pageAllowed(id)) {
    showToast('이 페이지에 접근할 권한이 없습니다.', 'error');
    if (currentPage !== id) return;
    return;
  }
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  inp('pg-' + id).classList.add('active');

  if (el) {
    el.classList.add('active');
  } else {
    document.querySelectorAll('.ni').forEach(item => {
      if (item.getAttribute('onclick')?.includes(`'${id}'`)) item.classList.add('active');
    });
  }

  // Auto-close mobile drawer
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
  }
  if (backdrop && backdrop.classList.contains('active')) {
    backdrop.classList.remove('active');
  }

  const PN = {
    dashboard: '종합 대시보드', clients: '수주 정보 관리', materials: '자재 수급/발주',
    orders: '생산 지시 등록', process: '실시간 공정 관리', quality: '품질 및 검사',
    workers: '인사 관리', alerts: '시스템 알림 로그', inventory: '재고 관리',
    trash: '휴지통 데이터 복구', deliveries: '납품 현황',
    rfq: '견적요청서 관리', po: '구매발주서 관리', partners: '거래처 관리',
    finance: '재무 관리', claims: '고객 클레임 관리', as: '고객 A/S · 사후관리', bom: 'BOM · 자재명세', permissions: '권한 관리',
    statement: '거래명세표 관리', taxinvoice: '세금계산서 관리',
    salesdoc: '견적/수주 관리',
    calendar: '납기 캘린더',
    alimtalk: '알림톡 설정'
  };
  inp('ptitle').textContent = PN[id] || id;
  currentPage = id;
  _updateBackBtn();
  refreshPage(id);
  // 모바일: 페이지 이동 시 홈 오버레이 해제 + 하단 탭 동기화
  document.body.classList.remove('mhome');
  if (typeof syncMobileTab === 'function') syncMobileTab();
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
  invCategory = meta.cat;
  if (currentPage !== 'inventory' && currentPage) pageHistory.push(currentPage);
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  inp('pg-inventory').classList.add('active');
  if (el) el.classList.add('active');
  else document.querySelectorAll('.ni').forEach(item => {
    if (item.getAttribute('onclick')?.includes(`goInventory('${key}'`)) item.classList.add('active');
  });
  inp('ptitle').textContent = meta.title;
  currentPage = 'inventory';
  _updateBackBtn();
  renderInventory();
  // 모바일 드로어 닫기
  const sb = document.querySelector('.sidebar');
  if (sb && sb.classList.contains('mobile-open')) { sb.classList.remove('mobile-open'); document.getElementById('sidebar-backdrop')?.classList.remove('active'); }
}

function _updateBackBtn() {
  const btn = inp('back-btn');
  if (!btn) return;
  if (pageHistory.length > 0) {
    btn.style.display = 'inline-flex';
    const PN = {
      dashboard:'대시보드', clients:'수주관리', materials:'자재관리',
      orders:'생산지시', process:'공정관리', quality:'품질검사',
      workers:'인사', alerts:'알림', inventory:'재고', trash:'휴지통', finance:'재무', claims:'클레임', statement:'거래명세표', taxinvoice:'세금계산서', salesdoc:'견적/수주'
    };
    btn.title = `이전: ${PN[pageHistory[pageHistory.length-1]] || '이전 화면'}으로 돌아가기`;
  } else {
    btn.style.display = 'none';
  }
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
  else if (id === 'alerts') renderAlerts();
  else if (id === 'process') { go('dashboard'); setTimeout(()=>switchDashTab('process'),50); return; }
  else if (id === 'inventory') renderInventory();
  else if (id === 'deliveries') { renderDeliveries(); if (currentDlvTab === 'closed') renderClosedProjects(); }
  else if (id === 'trash') renderTrash();
  else if (id === 'rfq') renderRfq();
  else if (id === 'po') renderPo();
  else if (id === 'partners') renderPartners();
  else if (id === 'finance') renderFinance();
  else if (id === 'as') renderAS();
  else if (id === 'bom') renderBom();
  else if (id === 'permissions') renderPermissions();
  else if (id === 'calendar') renderCalendar();
  else if (id === 'alimtalk') { renderAlimtalkSettings(); }
  if (typeof watchBulk === 'function') watchBulk();   // 일괄 선택 체크박스 부착
}
