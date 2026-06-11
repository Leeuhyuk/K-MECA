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
  el.innerHTML = (includeAll ? '<option value="">전체 의뢰 고객사</option>' : '') + clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}
function fillProductSelect(elId, clientId, selected='') {
  const el = inp(elId); if (!el) return;
  const list = clientId ? products.filter(p => p.clientId === clientId) : products;
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

/* ════ 유튜브 방식 사이드바: 미니(아이콘) ↔ 전체(고정) ════
   ☰ 클릭: 전체 고정 모드 ↔ 미니 레일 모드 전환
   미니 레일에 마우스 hover → 오버레이로 자동 펼침 (벗어나면 닫힘)
   미니 아이콘 클릭 → 바로 페이지 이동
*/
function toggleSidebar() {
  if (window.innerWidth <= 680) { toggleMobileSidebar(); return; }
  const body = document.body;
  if (body.classList.contains('sb-mini')) {
    // 미니 → 전체 고정 모드로 복귀
    body.classList.remove('sb-mini', 'sb-expanded', 'sb-collapsed');
  } else {
    // 전체 → 미니 레일 모드로 전환
    body.classList.add('sb-mini');
    body.classList.remove('sb-expanded', 'sb-collapsed');
    _initSbMini();
  }
  try { localStorage.setItem('mes_sbMini', body.classList.contains('sb-mini') ? '1' : ''); } catch(e){}
}

/* 미니 오버레이 닫기 (배경 딤 클릭 / 메뉴 이동 시) */
function closeSbOverlay() {
  document.body.classList.remove('sb-expanded');
}

/* 미니 레일 → 전체 모드로 복귀 */
function expandSidebar() {
  document.body.classList.remove('sb-mini', 'sb-expanded', 'sb-collapsed');
  try { localStorage.setItem('mes_sbMini', ''); } catch(e){}
}

/* 미니 레일 초기화: 각 .ni에 data-label 부여 + 오버레이 배경 + hover 펼침 */
let _sbHoverTimer = null;
function _initSbMini() {
  // data-label (툴팁용)
  document.querySelectorAll('.sidebar .ni').forEach(ni => {
    if (ni.dataset.label) return;
    const txt = ni.textContent.replace(/[0-9]/g,'').trim();
    ni.dataset.label = txt;
  });
  // 배경 오버레이
  if (!document.getElementById('sb-overlay')) {
    const ov = document.createElement('div');
    ov.id = 'sb-overlay';
    ov.className = 'sb-overlay';
    ov.addEventListener('click', closeSbOverlay);
    document.body.appendChild(ov);
  }
  // 미니 레일 hover → 오버레이 펼침 (마우스 벗어나면 닫힘, 깜빡임 방지 딜레이)
  const sb = document.querySelector('.sidebar');
  if (sb && !sb.dataset.hoverBound) {
    sb.dataset.hoverBound = '1';
    sb.addEventListener('mouseenter', () => {
      if (_sbHoverTimer) { clearTimeout(_sbHoverTimer); _sbHoverTimer = null; }
      if (document.body.classList.contains('sb-mini')) document.body.classList.add('sb-expanded');
    });
    sb.addEventListener('mouseleave', () => {
      if (_sbHoverTimer) clearTimeout(_sbHoverTimer);
      _sbHoverTimer = setTimeout(() => {
        document.body.classList.remove('sb-expanded');
      }, 180);
    });
  }
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
  if (id === currentPage) {                // 같은 페이지 재클릭: 드로어/오버레이만 닫기
    const sb = document.querySelector('.sidebar');
    if (sb && sb.classList.contains('mobile-open')) { sb.classList.remove('mobile-open'); document.getElementById('sidebar-backdrop')?.classList.remove('active'); }
    closeSbOverlay();
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
    calendar: '납기 캘린더'
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
      workers:'인사', system:'시스템 관리', inventory:'재고', finance:'재무', claims:'클레임', notes:'메모·할 일', statement:'거래명세표', taxinvoice:'세금계산서', salesdoc:'견적/수주'
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
  else if (id === 'process') { go('dashboard'); setTimeout(()=>switchDashTab('process'),50); return; }
  else if (id === 'inventory') renderInventory();
  else if (id === 'deliveries') { renderDeliveries(); if (currentDlvTab === 'closed') renderClosedProjects(); }
  else if (id === 'rfq') renderRfq();
  else if (id === 'po') renderPo();
  else if (id === 'partners') renderPartners();
  else if (id === 'finance') renderFinance();
  else if (id === 'as') renderAS();
  else if (id === 'bom') renderBom();
  else if (id === 'notes') renderNotes();
  else if (id === 'system') renderSystem();
  else if (id === 'calendar') renderCalendar();
  if (typeof watchBulk === 'function') watchBulk();   // 일괄 선택 체크박스 부착
}
