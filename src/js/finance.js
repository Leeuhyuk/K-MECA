/* ════════ 재무 관리 ════════ */
let financeTab = 'dashboard';
const financeView = {};
const payrollSelected = new Set();
const arSelected = new Set();
const payreqSelected = new Set();
const etcSelected = new Set();
const fixedCostSelected = new Set();
let finPnlMonths = 6;
let finClosingMonth = today().slice(0,7);
let finInputTimer = null;
let finDashboardRange = 'month';
let fixedCostMonth = today().slice(0,7);
let fixedCostShowInactive = false;
function financeVisiblePoList() {
  if (typeof visiblePurchaseOrderList === 'function') return visiblePurchaseOrderList();
  return typeof visibleRecords === 'function' ? visibleRecords(poList || [], 'po') : (poList || []);
}
function financeVisibleDeliveries() {
  return typeof visibleRecords === 'function' ? visibleRecords(deliveries || [], 'delivery') : (deliveries || []);
}
function financeVisibleProducts() {
  return typeof visibleRecords === 'function' ? visibleRecords(products || [], 'products') : (products || []);
}
function financeVisibleEntries() {
  const rows = (financeData && Array.isArray(financeData.entries)) ? financeData.entries : [];
  return typeof visibleRecords === 'function' ? visibleRecords(rows, 'financeEntry') : rows;
}
function financeVisibleWorkers() {
  if (typeof visibleWorkersList === 'function') return visibleWorkersList();
  return typeof visibleRecords === 'function' ? visibleRecords(workers || [], 'worker') : (workers || []);
}

function finState(tab) {
  if (!financeView[tab]) financeView[tab] = {
    query:'', status:'', from:'', to:'', min:'', max:'', sort:'dateDesc', page:1, size:25
  };
  return financeView[tab];
}
function finSet(tab, key, value) {
  const state = finState(tab);
  state[key] = key === 'size' || key === 'page' ? Number(value) : value;
  if (key !== 'page') state.page = 1;
  if (tab === 'labor' && key !== 'page') payrollSelected.clear();
  if (tab === 'ar' && key !== 'page') arSelected.clear();
  if (tab === 'payreq' && key !== 'page') payreqSelected.clear();
  if (tab === 'etc' && key !== 'page') etcSelected.clear();
  renderFinance();
}
function finInput(tab,key,value){
  const state=finState(tab);state[key]=value;state.page=1;
  if (tab === 'labor') payrollSelected.clear();
  if (tab === 'ar') arSelected.clear();
  if (tab === 'payreq') payreqSelected.clear();
  if (tab === 'etc') etcSelected.clear();
  clearTimeout(finInputTimer);finInputTimer=setTimeout(renderFinance,250);
}
function finQuickRange(tab, preset) {
  const state = finState(tab), now = new Date();
  if (tab === 'labor') payrollSelected.clear();
  if (tab === 'ar') arSelected.clear();
  if (tab === 'payreq') payreqSelected.clear();
  if (tab === 'etc') etcSelected.clear();
  const fmt = dateText;   // 공통 'YYYY-MM-DD' 포매터 재사용
  if (preset === 'all') { state.from=''; state.to=''; }
  else if (preset === '7d') {
    state.from = fmt(new Date(now.getFullYear(),now.getMonth(),now.getDate()-6)); state.to=fmt(now);
  } else if (preset === 'prev') {
    state.from=fmt(new Date(now.getFullYear(),now.getMonth()-1,1)); state.to=fmt(new Date(now.getFullYear(),now.getMonth(),0));
  } else {
    state.from=fmt(new Date(now.getFullYear(),now.getMonth(),1)); state.to=fmt(now);
  }
  state.page=1; renderFinance();
}
const FIN_DATE_VIEW_TABS = new Set(['ar','payreq','revenue','purchase','etc']);
function finDateText(date) {
  return dateText(date);   // 공통 포매터로 위임(중복 제거)
}
function finDateDefault(mode) {
  const value = today();
  if (mode === 'year') return value.slice(0,4);
  if (mode === 'month') return value.slice(0,7);
  if (mode === 'day') return value;
  return '';
}
function finDateMode(tab) {
  const state = finState(tab);
  if (!state.dateMode) state.dateMode = (state.from || state.to) ? 'range' : 'all';
  return state.dateMode;
}
function finDateRange(mode, value) {
  const val = value || finDateDefault(mode);
  if (mode === 'year') return { from:`${val}-01-01`, to:`${val}-12-31` };
  if (mode === 'month') {
    const [year, month] = val.split('-').map(Number);
    return { from:`${val}-01`, to:finDateText(new Date(year, month, 0)) };
  }
  if (mode === 'day') return { from:val, to:val };
  return { from:'', to:'' };
}
function finApplyDateView(tab, mode, value='', from='', to='') {
  const state = finState(tab);
  state.dateMode = mode;
  state.dateValue = value;
  if (mode === 'range') {
    state.from = from || state.from || today().slice(0,7) + '-01';
    state.to = to || state.to || today();
    if (state.from && state.to && state.from > state.to) {
      const swap = state.from; state.from = state.to; state.to = swap;
    }
  } else if (mode === 'all') {
    state.from = ''; state.to = ''; state.dateValue = '';
  } else {
    state.dateValue = value || finDateDefault(mode);
    const range = finDateRange(mode, state.dateValue);
    state.from = range.from; state.to = range.to;
  }
  state.page = 1;
  if (tab === 'ar') arSelected.clear();
  if (tab === 'payreq') payreqSelected.clear();
  if (tab === 'etc') etcSelected.clear();
  renderFinance();
}
function finDateViewModeChange(tab, mode) {
  const value = finDateDefault(mode);
  const range = mode === 'range' ? { from:today().slice(0,7) + '-01', to:today() } : finDateRange(mode, value);
  finApplyDateView(tab, mode, value, range.from, range.to);
}
function finDateViewMove(tab, amount) {
  const state = finState(tab), mode = finDateMode(tab);
  if (mode === 'all' || mode === 'range') return;
  let value = state.dateValue || finDateDefault(mode);
  if (mode === 'year') value = String((parseInt(value,10) || new Date().getFullYear()) + amount);
  else if (mode === 'month') {
    const parts = value.split('-');
    const date = new Date(Number(parts[0]), (Number(parts[1]) || 1) - 1 + amount, 1);
    value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  } else if (mode === 'day') {
    const parts = value.split('-');
    const date = new Date(Number(parts[0]), (Number(parts[1]) || 1) - 1, Number(parts[2]) || 1);
    date.setDate(date.getDate() + amount);
    value = finDateText(date);
  }
  finApplyDateView(tab, mode, value);
}
function finDateViewToday(tab) {
  const mode = finDateMode(tab);
  if (mode === 'all' || mode === 'range') return;
  finApplyDateView(tab, mode, finDateDefault(mode));
}
function finDateViewReset(tab) {
  finApplyDateView(tab, 'all');
}
function finDateViewRangeChange(tab, field, value) {
  const state = finState(tab);
  state.dateMode = 'range';
  state[field] = value;
  if (state.from && state.to && state.from > state.to) {
    const swap = state.from; state.from = state.to; state.to = swap;
  }
  state.page = 1;
  if (tab === 'ar') arSelected.clear();
  if (tab === 'payreq') payreqSelected.clear();
  if (tab === 'etc') etcSelected.clear();
  renderFinance();
}
function finDateViewLabel(tab) {
  const state = finState(tab), mode = finDateMode(tab), value = state.dateValue || finDateDefault(mode);
  if (mode === 'all') return '전체 기간';
  if (mode === 'range') return '기간 선택';
  if (mode === 'year') return `${value}년`;
  if (mode === 'month') {
    const parts = value.split('-');
    return `${parts[0]}년 ${Number(parts[1])}월`;
  }
  const parts = value.split('-');
  return `${parts[0]}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
}
function finDateViewBar(tab) {
  const state = finState(tab), mode = finDateMode(tab), range = mode === 'range', disabled = mode === 'all' || mode === 'range';
  return `<div class="date-view-bar finance-date-view-bar" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:0 0 5px;padding:3px 6px;background:var(--bg-s);border:1px solid var(--br);border-radius:var(--rm);">
    <select class="date-view-mode-select" onchange="finDateViewModeChange('${tab}',this.value)" style="min-width:140px;">
      <option value="all"${mode==='all'?' selected':''}>전체</option>
      <option value="year"${mode==='year'?' selected':''}>년</option>
      <option value="month"${mode==='month'?' selected':''}>월</option>
      <option value="day"${mode==='day'?' selected':''}>일</option>
      <option value="range"${mode==='range'?' selected':''}>기간</option>
    </select>
    <div class="date-view-period"${range?'':' style="display:none;"'}>
      <input type="date" value="${state.from||''}" onchange="finDateViewRangeChange('${tab}','from',this.value)" title="시작일">
      <span>~</span>
      <input type="date" value="${state.to||''}" onchange="finDateViewRangeChange('${tab}','to',this.value)" title="종료일">
    </div>
    <button class="btn btn-sm date-view-nav" onclick="finDateViewMove('${tab}',-1)" title="이전" ${disabled?'disabled':''}><i class="ti ti-chevron-left"></i></button>
    <span class="date-view-label"${range?' style="display:none;"':''}>${finDateViewLabel(tab)}</span>
    <button class="btn btn-sm date-view-nav" onclick="finDateViewMove('${tab}',1)" title="다음" ${disabled?'disabled':''}><i class="ti ti-chevron-right"></i></button>
    <button class="btn btn-sm date-view-today" onclick="finDateViewToday('${tab}')" title="오늘" ${disabled?'disabled':''}>오늘</button>
    <button class="btn btn-sm date-view-reset" onclick="finDateViewReset('${tab}')" title="전체 보기"><i class="ti ti-x"></i></button>
  </div>`;
}
function finMatchDate(date, state) {
  const value = String(date || '').slice(0,10);
  return (!state.from || value >= state.from) && (!state.to || value <= state.to);
}
function finMatchAmount(amount,state){
  const value=Number(amount)||0;
  return (state.min==='' || value>=Number(state.min)) && (state.max==='' || value<=Number(state.max));
}
function finSort(list, state, dateFn, amountFn) {
  const copy = [...list];
  if (state.sort === 'dateAsc') copy.sort((a,b)=>String(dateFn(a)||'').localeCompare(String(dateFn(b)||'')));
  else if (state.sort === 'amountDesc') copy.sort((a,b)=>(amountFn(b)||0)-(amountFn(a)||0));
  else if (state.sort === 'amountAsc') copy.sort((a,b)=>(amountFn(a)||0)-(amountFn(b)||0));
  else copy.sort((a,b)=>String(dateFn(b)||'').localeCompare(String(dateFn(a)||'')));
  return copy;
}
function finPaged(list, state) {
  const pages = Math.max(1, Math.ceil(list.length/state.size));
  state.page = Math.min(Math.max(1,state.page),pages);
  const start=(state.page-1)*state.size;
  return { rows:list.slice(start,start+state.size), pages, total:list.length, start };
}
function finPager(tab, pageInfo) {
  const state=finState(tab);
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--tx-s);">
    <span>총 ${pageInfo.total.toLocaleString()}건 · ${pageInfo.total?pageInfo.start+1:0}-${Math.min(pageInfo.start+state.size,pageInfo.total)}건 표시</span>
    <div style="display:flex;align-items:center;gap:5px;">
      <button class="btn btn-sm" onclick="finSet('${tab}','page',1)" ${state.page<=1?'disabled':''}><i class="ti ti-chevrons-left"></i></button>
      <button class="btn btn-sm" onclick="finSet('${tab}','page',${state.page-1})" ${state.page<=1?'disabled':''}><i class="ti ti-chevron-left"></i></button>
      <span style="min-width:70px;text-align:center;font-weight:700;">${state.page} / ${pageInfo.pages}</span>
      <button class="btn btn-sm" onclick="finSet('${tab}','page',${state.page+1})" ${state.page>=pageInfo.pages?'disabled':''}><i class="ti ti-chevron-right"></i></button>
      <button class="btn btn-sm" onclick="finSet('${tab}','page',${pageInfo.pages})" ${state.page>=pageInfo.pages?'disabled':''}><i class="ti ti-chevrons-right"></i></button>
    </div>
  </div>`;
}
function finFilterBar(tab, options={}) {
  const state=finState(tab);
  const statuses=options.statuses||[];
  const useDateView = !options.noDate && FIN_DATE_VIEW_TABS.has(tab);
  const topBar = useDateView
    ? (tab === 'ar' && arSelected.size ? arSelectionBarHtml()
      : tab === 'payreq' && payreqSelected.size ? payreqSelectionBarHtml()
      : tab === 'etc' && etcSelected.size ? etcSelectionBarHtml()
      : finDateViewBar(tab))
    : '';
  return `${topBar}
    <div class="toolbar" style="margin-bottom:10px;">
    ${options.noDate||useDateView?'':`<input type="date" value="${state.from}" onchange="finSet('${tab}','from',this.value)" title="시작일">
    <span style="color:var(--tx-t);">~</span><input type="date" value="${state.to}" onchange="finSet('${tab}','to',this.value)" title="종료일">
    <button class="btn btn-sm" onclick="finQuickRange('${tab}','7d')">최근 7일</button>
    <button class="btn btn-sm" onclick="finQuickRange('${tab}','month')">이번 달</button>
    <button class="btn btn-sm" onclick="finQuickRange('${tab}','prev')">지난달</button>`}
    <input value="${esc(state.query)}" oninput="finInput('${tab}','query',this.value)" placeholder="${options.placeholder||'검색...'}" style="min-width:190px;">
    <input type="number" min="0" value="${state.min}" oninput="finInput('${tab}','min',this.value)" placeholder="최소 금액" style="width:110px;">
    <input type="number" min="0" value="${state.max}" oninput="finInput('${tab}','max',this.value)" placeholder="최대 금액" style="width:110px;">
    ${statuses.length?`<select onchange="finSet('${tab}','status',this.value)"><option value="">전체 상태</option>${statuses.map(x=>`<option${state.status===x?' selected':''}>${x}</option>`).join('')}</select>`:''}
    <select onchange="finSet('${tab}','sort',this.value)">
      <option value="dateDesc"${state.sort==='dateDesc'?' selected':''}>최신순</option>
      <option value="dateAsc"${state.sort==='dateAsc'?' selected':''}>오래된순</option>
      <option value="amountDesc"${state.sort==='amountDesc'?' selected':''}>금액 높은순</option>
      <option value="amountAsc"${state.sort==='amountAsc'?' selected':''}>금액 낮은순</option>
    </select>
    <select onchange="finSet('${tab}','size',this.value)" title="페이지당 표시">
      ${[10,25,50,100].map(n=>`<option value="${n}"${state.size===n?' selected':''}>${n}개</option>`).join('')}
    </select>
    <button class="btn btn-sm" onclick="exportFinanceViewXLS('${tab}')" title="현재 조회 결과 엑셀"><i class="ti ti-file-spreadsheet"></i></button>
    <button class="btn btn-sm" onclick="financeView['${tab}']=null;renderFinance()" title="조회 초기화"><i class="ti ti-refresh"></i></button>
  </div>`;
}
function payrollSelectionBarHtml(closed) {
  const selectedCount = payrollSelected.size;
  const single = payrollSelected.size === 1;
  return `<div class="selection-action-bar" id="payroll-selection-bar" style="display:flex;flex-wrap:wrap;">
    <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${selectedCount}명 선택</span>
    <button class="btn btn-sm" onclick="openSelectedPayrollEdit()" ${(!single||closed)?'disabled':''} title="${single?'선택한 직원 급여 수정':'한 명만 선택하면 수정할 수 있습니다.'}"><i class="ti ti-edit"></i>급여 수정</button>
    <button class="btn btn-sm" onclick="printSelectedPayslip()" ${single?'':'disabled'} title="${single?'선택한 직원 명세서 출력':'한 명만 선택하면 출력할 수 있습니다.'}"><i class="ti ti-printer"></i>명세서 출력</button>
    <button class="btn btn-sm" onclick="bulkConfirmPayroll(true)" ${(!selectedCount||closed)?'disabled':''}><i class="ti ti-checks"></i>확정</button>
    <button class="btn btn-sm drive-save-btn" onclick="bulkSavePayrollDrive()" ${selectedCount?'':'disabled'}><i class="ti ti-cloud-upload"></i>Drive 저장</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="clearPayrollSelection()" ${selectedCount?'':'disabled'}><i class="ti ti-x"></i>해제</button>
  </div>`;
}

function selectedPayrollWorkerId() {
  return [...payrollSelected][0] || '';
}

function openSelectedPayrollEdit() {
  if (payrollSelected.size !== 1) { showToast('직원 한 명만 선택하세요.', 'info'); return; }
  openPayrollEdit(selectedPayrollWorkerId());
}

function printSelectedPayslip() {
  if (payrollSelected.size !== 1) { showToast('직원 한 명만 선택하세요.', 'info'); return; }
  printPayslip(`${selectedPayrollWorkerId()}__${payrollMonth}`);
}

function payrollDateToolbarHtml(closed) {
  return `<div class="toolbar" style="margin-bottom:12px;">
    <button class="btn btn-sm" onclick="payrollMonth=shiftMonth(payrollMonth,-1);renderFinance()"><i class="ti ti-chevron-left"></i></button>
    <input type="month" value="${payrollMonth}" onchange="payrollMonth=this.value;renderFinance()" style="width:130px;">
    <button class="btn btn-sm" onclick="payrollMonth=shiftMonth(payrollMonth,1);renderFinance()"><i class="ti ti-chevron-right"></i></button>
    <button class="btn btn-sm" onclick="payrollMonth=today().slice(0,7);renderFinance()">이번 달</button>
    <button class="btn btn-sm" onclick="openPayrollSettings()"><i class="ti ti-settings"></i>계산 설정</button>
    <button class="btn btn-sm ${closed?'btn-danger':''}" onclick="toggleFinanceMonthClose('${payrollMonth}')"><i class="ti ${closed?'ti-lock':'ti-lock-open'}"></i>${closed?'마감됨':'월 마감'}</button>
    <button class="btn btn-sm" onclick="exportPayrollXLS()"><i class="ti ti-file-spreadsheet"></i>급여대장 XLSX</button>
  </div>`;
}

function togglePayrollRow(id, event) {
  if (event && event.target && event.target.closest('button,a,input,select,textarea,label')) return;
  togglePayrollSelect(id, !payrollSelected.has(id));
}

function payrollPageWorkerIdsFromDom() {
  const table = inp('finance-payroll-table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tbody tr[data-worker-id]')).map(row => row.dataset.workerId).filter(Boolean);
}

function refreshPayrollSelectionUi() {
  const closed = isFinanceMonthClosed(payrollMonth);
  const actionRow = inp('payroll-top-action-row');
  if (actionRow) actionRow.innerHTML = payrollSelected.size ? payrollSelectionBarHtml(closed) : payrollDateToolbarHtml(closed);
  const table = inp('finance-payroll-table');
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('tbody tr[data-worker-id]'));
  rows.forEach(row => {
    const checked = payrollSelected.has(row.dataset.workerId);
    row.classList.toggle('table-row-selected', checked);
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = checked;
  });
  const all = table.querySelector('thead input[type="checkbox"]');
  if (all) {
    const selectedRows = rows.filter(row => payrollSelected.has(row.dataset.workerId));
    all.checked = rows.length > 0 && selectedRows.length === rows.length;
    all.indeterminate = selectedRows.length > 0 && selectedRows.length < rows.length;
  }
}
function finPaymentMap(kind) {
  return kind === 'ap' ? financeData.paidPayable : financeData.paidReceivable;
}
function finPaymentRecord(kind, id, total) {
  const raw = finPaymentMap(kind)[id];
  const target = Math.max(0, Number(total) || 0);
  if (!raw) return { amount:0, remaining:target, status:'미처리', done:false, date:'', method:'', note:'' };
  if (raw === true) return { amount:target, remaining:0, status:'완료', done:true, date:'', method:'', note:'' };
  if (typeof raw === 'number') {
    const amount = Math.min(target, Math.max(0, raw));
    return { amount, remaining:Math.max(0, target - amount), status:amount >= target ? '완료' : '부분', done:amount >= target, date:'', method:'', note:'' };
  }
  const amount = Math.min(target, Math.max(0, Number(raw.amount) || 0));
  return {
    amount,
    remaining:Math.max(0, target - amount),
    status:amount >= target ? '완료' : (amount > 0 ? '부분' : '미처리'),
    done:amount >= target,
    date:raw.date || '',
    method:raw.method || '',
    note:raw.note || ''
  };
}
function finPaymentStatusBadge(kind, payment) {
  if (payment.status === '완료') return `<span class="bd bd-ok">${kind === 'ap' ? '지급완료' : '수금완료'}</span>`;
  if (payment.status === '부분') return `<span class="bd bd-warn">${kind === 'ap' ? '부분지급' : '부분수금'}</span>`;
  return `<span class="bd bd-neu">${kind === 'ap' ? '미지급' : '미수금'}</span>`;
}
function financePaymentRequests() {
  if (!financeData.paymentRequests) financeData.paymentRequests = [];
  financeData.paymentRequests.forEach(ensurePaymentRequestApprovalFields);
  return financeData.paymentRequests;
}
function financeCurrentUserName() {
  return localStorage.getItem('mes_myName') || (_cloudUser && (_cloudUser.displayName || _cloudUser.email)) || '';
}
const PAYREQ_APPROVAL_LABELS = {
  draft:'작성중',
  pending:'결재대기',
  approved:'승인',
  rejected:'반려'
};
function ensurePaymentRequestApprovalFields(req) {
  if (!req || typeof req !== 'object') return req;
  if (!req.approvalStatus) req.approvalStatus = 'approved';
  if (!Array.isArray(req.approvalHistory)) req.approvalHistory = [];
  return req;
}
function payreqApprovalStatus(req) {
  ensurePaymentRequestApprovalFields(req);
  return req && req.approvalStatus || 'approved';
}
function payreqApprovalLabel(req) {
  return PAYREQ_APPROVAL_LABELS[payreqApprovalStatus(req)] || payreqApprovalStatus(req);
}
function finPaymentRequestApprovalBadge(req) {
  const status = payreqApprovalStatus(req);
  const cls = { draft:'bd-neu', pending:'bd-warn', approved:'bd-ok', rejected:'bd-err' }[status] || 'bd-neu';
  return `<span class="bd ${cls}">${esc(PAYREQ_APPROVAL_LABELS[status] || status)}</span>`;
}
function payreqApprovalTone(req) {
  return { draft:'draft', pending:'pending', approved:'approved', rejected:'rejected' }[payreqApprovalStatus(req)] || 'draft';
}
function payreqApprovalRowClass(req) {
  return `payreq-row-${payreqApprovalTone(req)}`;
}
function payreqSourceSummaryHtml(p, pay, total) {
  const remaining = pay ? Number(pay.remaining) || 0 : 0;
  const docNo = esc(p.id || '');
  const supplier = esc(p.supplier || '공급처 미지정');
  const itemSummary = esc(finPoItemSummary(p));
  const payMethod = esc(p.payMethod || '현금');
  const remainingTone = remaining > 0 ? 'warn' : 'approved';
  return `
    <div class="payreq-report-head">
      <div class="payreq-report-title">
        <span class="payreq-id-pill">${docNo}</span>
        <strong>${supplier}</strong>
      </div>
      <span class="bd bd-warn">결제 요청</span>
    </div>
    <div class="payreq-report-body">
      <div>
        <span class="payreq-report-label">발주 품목</span>
        <span class="payreq-report-value">${itemSummary || '-'}</span>
      </div>
      <div>
        <span class="payreq-report-label">발주 금액</span>
        <span class="payreq-report-amount">${fmtW(total)}</span>
      </div>
      <div>
        <span class="payreq-report-label">미지급 금액</span>
        <span class="payreq-report-amount">${fmtW(remaining)}</span>
      </div>
    </div>
    <div class="payreq-report-foot">
      <span class="payreq-approval-mini"><i class="payreq-approval-dot ${remainingTone}"></i>결제조건 <b>${payMethod}</b></span>
      <span>구매발주서와 연결된 결제 요청입니다.</span>
    </div>`;
}
function payreqIsApprovalEditable(req) {
  const status = payreqApprovalStatus(req);
  return status === 'draft' || status === 'rejected';
}
function payreqCanSubmit(req) {
  return !!req && payreqIsApprovalEditable(req) && canEditRecord(req, 'paymentRequest') && !payreqIsPaidDone(req);
}
function payreqCanApproveAction(req) {
  if (!req || payreqApprovalStatus(req) !== 'pending') return false;
  if (typeof currentRole !== 'undefined' && currentRole === 'admin') return true;
  return roleFeatureAllowed('approve') && canViewRecord(req, 'paymentRequest');
}
function payreqIsApproved(req) {
  return payreqApprovalStatus(req) === 'approved';
}
function payreqIsPaymentActionable(req) {
  return !!req && payreqIsApproved(req) && !payreqIsPaidDone(req);
}
function finPaymentRequestForPo(poId) {
  return financePaymentRequests().find(r => r.sourceType === 'po' && r.poId === poId) || null;
}
function finPaymentRequestStatusBadge(status) {
  const cls = { '요청':'bd-warn', '확인':'bd-info', '지급예정':'bd-info', '지급완료':'bd-ok', '반려':'bd-err' }[status] || 'bd-neu';
  return `<span class="bd ${cls}">${esc(status || '미요청')}</span>`;
}
function finPaymentRequestCountsAsOpen(req) {
  const approval = payreqApprovalStatus(req);
  return approval !== 'draft' && approval !== 'rejected' && !['지급완료','반려'].includes(req && req.status);
}
function finPaymentRequestOpenCount() {
  return financePaymentRequests().filter(r => canViewRecord(r, 'paymentRequest') && finPaymentRequestCountsAsOpen(r)).length;
}
function finPaymentRequestApprovalPendingCount() {
  return financePaymentRequests().filter(r => canViewRecord(r, 'paymentRequest') && payreqApprovalStatus(r) === 'pending').length;
}
function updatePaymentRequestBadge() {
  const b = inp('payreqBadge'); if (!b) return;
  const n = finPaymentRequestApprovalPendingCount() || finPaymentRequestOpenCount();
  b.textContent = n;
  b.style.display = n ? '' : 'none';
}

function ensureFixedCostData() {
  if (!financeData.fixedCosts) financeData.fixedCosts = [];
  if (!financeData.fixedCostPayments) financeData.fixedCostPayments = [];
}
function fixedCostItems() {
  ensureFixedCostData();
  return financeData.fixedCosts;
}
function fixedCostPayments() {
  ensureFixedCostData();
  return financeData.fixedCostPayments;
}
function fixedCostPayDate(ym, dueDay) {
  const day = Math.min(31, Math.max(1, Number(dueDay) || 25));
  const [year, month] = String(ym || today().slice(0,7)).split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${ym}-${String(Math.min(day, last)).padStart(2,'0')}`;
}
function fixedCostPayment(itemId, ym=fixedCostMonth) {
  return fixedCostPayments().find(p => p.itemId === itemId && p.ym === ym) || null;
}
function fixedCostEffectiveRow(item, ym=fixedCostMonth) {
  const rec = fixedCostPayment(item.id, ym);
  const amount = rec && rec.amount != null ? Number(rec.amount) || 0 : Number(item.defaultAmount) || 0;
  return {
    id: rec?.id || '',
    itemId: item.id,
    ym,
    item,
    name: item.name || '',
    category: item.category || '기타',
    vendor: item.vendor || '',
    dueDate: rec?.dueDate || fixedCostPayDate(ym, item.dueDay),
    amount,
    status: rec?.status || '예정',
    paidDate: rec?.paidDate || '',
    method: rec?.method || item.method || '계좌이체',
    note: rec?.note ?? item.note ?? '',
    active: item.active !== false
  };
}
function fixedCostRows(ym=fixedCostMonth, includeInactive=false) {
  const source = typeof visibleRecords === 'function' ? visibleRecords(fixedCostItems(), 'fixedCost') : fixedCostItems();
  return source
    .filter(item => includeInactive || item.active !== false)
    .map(item => fixedCostEffectiveRow(item, ym));
}
function fixedCostExpenseMonth(ym) {
  return fixedCostRows(ym, false)
    .filter(row => row.status !== '보류')
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}
function fixedCostPaidMonth(ym) {
  return fixedCostRows(ym, false)
    .filter(row => row.status === '지급완료')
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}
function finFixedCostRange(rangeInfo) {
  return finRangeMonths(rangeInfo).reduce((sum, ym) => sum + fixedCostExpenseMonth(ym), 0);
}
function finFixedCostPaidRange(rangeInfo) {
  return finRangeMonths(rangeInfo).reduce((sum, ym) => sum + fixedCostPaidMonth(ym), 0);
}
function fixedCostSavePayment(itemId, ym, patch, options={}) {
  if (!options.skipGuard && !checkAdminAction()) return false;
  if (!options.skipGuard && !guardFinanceMonth(`${ym}-01`)) return false;
  const item = fixedCostItems().find(x => x.id === itemId);
  if (!item) return false;
  if (!options.skipGuard && !requireRecordPermission('edit', item, 'fixedCost')) return false;
  let rec = fixedCostPayment(itemId, ym);
  const before = rec ? _safeJsonClone(rec) : null;
  if (!rec) {
    rec = stampRecordCreate({
      id: nextCode('FCP', fixedCostPayments()),
      itemId,
      ym,
      amount: Number(item.defaultAmount) || 0,
      dueDate: fixedCostPayDate(ym, item.dueDay),
      status: '예정',
      paidDate: '',
      method: item.method || '계좌이체',
      note: item.note || '',
      createdAt: new Date().toISOString()
    }, 'fixedCostPayment');
    fixedCostPayments().push(rec);
  }
  Object.assign(rec, patch, { updatedAt:new Date().toISOString() });
  stampRecordUpdate(rec, before, 'fixedCostPayment');
  if (!options.skipAudit) {
    writeAuditLog('fixedCostPayment', rec.id, before ? 'update' : 'create', before, rec, { summary:options.auditSummary || '월 고정비 처리 변경', detail:`${ym} · ${item.name || itemId}` });
  }
  saveStorage('financeData', financeData);
  return true;
}
function fixedCostStatusBadge(status) {
  const cls = { '예정':'bd-neu', '결제요청':'bd-warn', '지급완료':'bd-ok', '보류':'bd-err' }[status] || 'bd-neu';
  return `<span class="bd ${cls}">${esc(status || '예정')}</span>`;
}
function shiftFixedCostMonth(amount) {
  const parts = fixedCostMonth.split('-').map(Number);
  const date = new Date(parts[0], (parts[1] || 1) - 1 + amount, 1);
  fixedCostMonth = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  fixedCostSelected.clear();
  renderFinance();
}
function setFixedCostMonth(value) {
  fixedCostMonth = value || today().slice(0,7);
  fixedCostSelected.clear();
  renderFinance();
}
function fixedCostMonthToolbarHtml() {
  return `<div class="toolbar fixed-cost-month-toolbar" style="margin-bottom:12px;">
    <button class="btn btn-sm" onclick="shiftFixedCostMonth(-1)"><i class="ti ti-chevron-left"></i></button>
    <input type="month" value="${fixedCostMonth}" onchange="setFixedCostMonth(this.value)" style="width:130px;">
    <button class="btn btn-sm" onclick="shiftFixedCostMonth(1)"><i class="ti ti-chevron-right"></i></button>
    <button class="btn btn-sm" onclick="setFixedCostMonth(today().slice(0,7))">이번 달</button>
    <button class="btn btn-sm ${fixedCostShowInactive?'btn-primary':''}" onclick="fixedCostShowInactive=!fixedCostShowInactive;renderFinance()"><i class="ti ti-eye"></i>미사용 포함</button>
    <button class="btn btn-sm btn-primary" onclick="openFixedCostAdd()"><i class="ti ti-plus"></i>항목 등록</button>
  </div>`;
}
function fixedCostBlankRow() {
  return { category:'기타', dueDay:25, method:'계좌이체', active:true };
}
function fixedCostMethodOptions(selected='계좌이체') {
  return ['계좌이체','자동이체','카드','현금','기타']
    .map(method => `<option value="${method}"${selected===method?' selected':''}>${method}</option>`)
    .join('');
}
const FIXED_COST_MODAL_FIELDS = [
  { key:'name', label:'항목명', required:true, cls:'fc-row-name', placeholder:'예: 공장 임대료', maxlength:80 },
  { key:'category', label:'분류', cls:'fc-row-category', placeholder:'분류', list:'fixed-cost-category-list', maxlength:40 },
  { key:'vendor', label:'지급처', cls:'fc-row-vendor', placeholder:'지급처', maxlength:80 },
  { key:'defaultAmount', label:'기본금액', cls:'fc-row-amount', type:'number', min:0, step:10, inputmode:'numeric', placeholder:'0', required:true },
  { key:'dueDay', label:'납부일', cls:'fc-row-due-day', type:'number', min:1, max:31, placeholder:'25' },
  { key:'method', label:'결제방법', cls:'fc-row-method', type:'select' },
  { key:'active', label:'사용', cls:'fc-row-active', type:'checkbox' },
  { key:'note', label:'비고', cls:'fc-row-note', placeholder:'비고', maxlength:200 }
];

function fixedCostModalNormalizeRow(row={}) {
  const data = Object.assign(fixedCostBlankRow(), row || {});
  return {
    id: data.id || '',
    name: data.name || '',
    category: data.category || '기타',
    vendor: data.vendor || '',
    defaultAmount: data.defaultAmount || '',
    dueDay: data.dueDay || 25,
    method: data.method || '계좌이체',
    active: data.active !== false,
    note: data.note || ''
  };
}

function fixedCostModalFieldValue(field, row) {
  if (field.type === 'checkbox') return !!row[field.key];
  return row[field.key] ?? '';
}

function fixedCostModalInputHtml(field, row, index) {
  const common = [
    `data-fc-field="${esc(field.key)}"`,
    `data-fc-index="${index}"`,
    field.cls ? `class="${esc(field.cls)}"` : '',
    field.placeholder ? `placeholder="${esc(field.placeholder)}"` : '',
    'onkeydown="fixedCostModalKeydown(event)"',
    field.maxlength ? `maxlength="${esc(field.maxlength)}"` : '',
    field.list ? `list="${esc(field.list)}"` : '',
    field.min != null ? `min="${esc(field.min)}"` : '',
    field.max != null ? `max="${esc(field.max)}"` : '',
    field.step != null ? `step="${esc(field.step)}"` : '',
    field.inputmode ? `inputmode="${esc(field.inputmode)}"` : ''
  ].filter(Boolean).join(' ');
  if (field.type === 'select') {
    return `<select ${common}>${fixedCostMethodOptions(row.method || '계좌이체')}</select>`;
  }
  if (field.type === 'checkbox') {
    return `<input type="checkbox" ${common} ${row.active !== false ? 'checked' : ''}>`;
  }
  const type = field.type || 'text';
  return `<input type="${esc(type)}" ${common} value="${esc(fixedCostModalFieldValue(field, row))}">`;
}

function fixedCostModalHeaderHtml(index) {
  return `<th class="batch-entry-shared-item-head" data-fc-index="${index}">
    <div class="batch-entry-shared-item-head-inner">
      <span>${esc(`항목 ${index + 1}`)}</span>
      <span class="batch-entry-shared-item-actions">
        <button type="button" title="항목 복제" onclick="duplicateFixedCostModalColumn(${index})"><i class="ti ti-copy"></i></button>
        <button type="button" title="항목 삭제" onclick="removeFixedCostModalColumn(${index})"><i class="ti ti-trash"></i></button>
      </span>
    </div>
  </th>`;
}

function renderFixedCostModalRows(rows) {
  const body = inp('fc-items-body');
  if (!body) return;
  const table = body.closest('table');
  const head = table?.querySelector('thead');
  const grid = table?.closest('.batch-entry-grid');
  const list = (rows && rows.length ? rows : [fixedCostBlankRow()]).map(fixedCostModalNormalizeRow);
  if (grid) {
    grid.classList.add('batch-entry-shared-grid', 'fixed-cost-shared-grid');
    const label = grid.querySelector(':scope > .batch-entry-label');
    if (label && !label.querySelector('small')) {
      const current = label.innerHTML.trim();
      label.innerHTML = `<span>${current}</span><small>좌측 라벨 고정 · 항목은 우측으로 추가</small>`;
    }
  }
  table?.classList.add('batch-entry-shared-label-table');
  if (head) {
    head.innerHTML = `<tr>
      <th class="batch-entry-shared-label-col">항목</th>
      ${list.map((_, index) => fixedCostModalHeaderHtml(index)).join('')}
      <th class="batch-entry-shared-add-col"><button type="button" class="doc-add-row" title="항목 추가" onclick="addFixedCostModalRow()"><i class="ti ti-plus"></i></button></th>
    </tr>`;
  }
  body.innerHTML = FIXED_COST_MODAL_FIELDS.map(field => `<tr data-fc-row="${esc(field.key)}">
    <th class="batch-entry-shared-label-cell">${esc(field.label)}${field.required ? ' <span>*</span>' : ''}</th>
    ${list.map((row, index) => `<td class="batch-entry-shared-value batch-entry-field-${esc(field.key)}" data-fc-index="${index}" data-fc-id="${esc(row.id || '')}">${fixedCostModalInputHtml(field, row, index)}</td>`).join('')}
    <td class="batch-entry-shared-add-spacer"></td>
  </tr>`).join('');
}
function addFixedCostModalRow(seed={}, afterBtn=null, focus=true) {
  const body = inp('fc-items-body');
  if (!body) return;
  const rows = fixedCostModalRowsFromDom({ keepEmpty:true });
  const current = afterBtn?.closest?.('[data-fc-index]');
  const afterIndex = current ? parseInt(current.dataset.fcIndex, 10) : NaN;
  const insertIndex = Number.isFinite(afterIndex) ? afterIndex + 1 : rows.length;
  rows.splice(insertIndex, 0, fixedCostModalNormalizeRow(seed));
  renderFixedCostModalRows(rows);
  if (focus) setTimeout(() => inp('fc-items-body')?.querySelector(`[data-fc-field="name"][data-fc-index="${insertIndex}"]`)?.focus(), 0);
}
function duplicateFixedCostModalColumn(index) {
  const rows = fixedCostModalRowsFromDom({ keepEmpty:true });
  rows.splice(index + 1, 0, fixedCostModalNormalizeRow(rows[index] || {}));
  renderFixedCostModalRows(rows);
}
function removeFixedCostModalColumn(index) {
  const rows = fixedCostModalRowsFromDom({ keepEmpty:true });
  if (rows.length <= 1) rows[0] = fixedCostModalNormalizeRow();
  else rows.splice(index, 1);
  renderFixedCostModalRows(rows);
}
function fixedCostModalKeydown(event) {
  if (event.key !== 'Enter') return;
  const target = event.target;
  if (!target || target.matches('button, textarea, input[type="checkbox"]')) return;
  const row = target.closest('tr[data-fc-row]');
  const body = inp('fc-items-body');
  if (!row || !body) return;
  const fieldRows = Array.from(body.querySelectorAll('tr[data-fc-row]'));
  const rowIndex = fieldRows.indexOf(row);
  const itemIndex = parseInt(target.dataset.fcIndex || '0', 10) || 0;
  if (rowIndex < 0) return;
  event.preventDefault();
  if (rowIndex < fieldRows.length - 1) {
    fieldRows[rowIndex + 1].querySelector(`[data-fc-index="${itemIndex}"] input, [data-fc-index="${itemIndex}"] select`)?.focus();
    return;
  }
  const count = fixedCostModalRowsFromDom({ keepEmpty:true }).length;
  if (itemIndex >= count - 1) addFixedCostModalRow({}, target, true);
  else body.querySelector(`[data-fc-field="name"][data-fc-index="${itemIndex + 1}"]`)?.focus();
}
function fixedCostModalRowsFromDom(options = {}) {
  const body = inp('fc-items-body');
  if (!body) return [];
  const indexes = Array.from(body.querySelectorAll('[data-fc-index]'))
    .map(el => parseInt(el.dataset.fcIndex, 10))
    .filter(n => Number.isFinite(n));
  if (indexes.length) {
    const count = Math.max(...indexes) + 1;
    const rows = Array.from({ length: count }, (_, index) => {
      const get = key => body.querySelector(`[data-fc-field="${key}"][data-fc-index="${index}"]`);
      const dueDayRaw = Number(get('dueDay')?.value) || 25;
      return {
        id: body.querySelector(`[data-fc-id][data-fc-index="${index}"]`)?.dataset.fcId || '',
        name: get('name')?.value.trim() || '',
        category: get('category')?.value.trim() || '기타',
        vendor: get('vendor')?.value.trim() || '',
        defaultAmount: Math.max(0, Number(get('defaultAmount')?.value) || 0),
        dueDay: Math.min(31, Math.max(1, dueDayRaw)),
        method: get('method')?.value || '계좌이체',
        active: !!get('active')?.checked,
        note: get('note')?.value.trim() || ''
      };
    });
    return options.keepEmpty ? rows : rows.filter(row => row.name || row.defaultAmount > 0 || row.vendor || row.note);
  }
  const rows = Array.from(body.querySelectorAll('tr')).map(row => {
    const dueDayRaw = Number(row.querySelector('.fc-row-due-day')?.value) || 25;
    return {
      id: row.dataset.fcId || '',
      name: row.querySelector('.fc-row-name')?.value.trim() || '',
      category: row.querySelector('.fc-row-category')?.value.trim() || '기타',
      vendor: row.querySelector('.fc-row-vendor')?.value.trim() || '',
      defaultAmount: Math.max(0, Number(row.querySelector('.fc-row-amount')?.value) || 0),
      dueDay: Math.min(31, Math.max(1, dueDayRaw)),
      method: row.querySelector('.fc-row-method')?.value || '계좌이체',
      active: !!row.querySelector('.fc-row-active')?.checked,
      note: row.querySelector('.fc-row-note')?.value.trim() || ''
    };
  });
  return options.keepEmpty ? rows : rows.filter(row => row.name || row.defaultAmount > 0 || row.vendor || row.note);
}
function fixedCostPasteLooksLikeHeader(cells) {
  const text = cells.map(cell => String(cell || '').trim()).join(' ');
  return /항목|항목명|분류|지급처|기본\s*금액|납부일|결제방법|사용|비고/.test(text);
}
function fixedCostNormalizeNumber(value) {
  return String(value || '').replace(/[,\s원₩]/g, '').replace(/[^\d.-]/g, '');
}
function fixedCostNormalizeDueDay(value) {
  const text = String(value || '').trim();
  const dateMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const raw = dateMatch ? Number(dateMatch[3]) : Number(text.replace(/[^\d]/g, ''));
  if (!raw) return '';
  return String(Math.min(31, Math.max(1, raw)));
}
function fixedCostNormalizeMethod(value) {
  const text = String(value || '').replace(/\s/g, '');
  if (!text) return '계좌이체';
  if (text.includes('자동')) return '자동이체';
  if (text.includes('카드')) return '카드';
  if (text.includes('현금')) return '현금';
  if (text.includes('계좌') || text.includes('이체')) return '계좌이체';
  return ['계좌이체','자동이체','카드','현금','기타'].includes(text) ? text : '기타';
}
function fixedCostPasteSetValue(el, value) {
  if (!el) return;
  const text = String(value || '').trim();
  if (el.classList.contains('fc-row-active')) {
    if (!text) return;
    el.checked = !/^(0|n|no|false|x|미사용|사용안함|비활성|해제|아니오)$/i.test(text);
    return;
  }
  if (el.classList.contains('fc-row-amount')) el.value = fixedCostNormalizeNumber(text);
  else if (el.classList.contains('fc-row-due-day')) el.value = fixedCostNormalizeDueDay(text);
  else if (el.classList.contains('fc-row-method')) el.value = fixedCostNormalizeMethod(text);
  else el.value = text;
}
function fixedCostPasteFromExcel(event) {
  const target = event.target;
  if (!target || !target.matches('input, select')) return;
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
  const startRow = target.closest('tr[data-fc-row]');
  const body = inp('fc-items-body');
  if (!startRow || !body) return;
  event.preventDefault();

  let rows = text.replace(/\r/g, '').split('\n').filter((line, idx, arr) => line.length || idx < arr.length - 1).map(line => line.split('\t'));
  if (rows.length && fixedCostPasteLooksLikeHeader(rows[0])) rows = rows.slice(1);
  if (!rows.length) return;

  const fieldRows = Array.from(body.querySelectorAll('tr[data-fc-row]'));
  const startField = fieldRows.indexOf(startRow);
  const startItem = parseInt(target.dataset.fcIndex || '0', 10) || 0;
  if (startField < 0) return;
  const nextRows = fixedCostModalRowsFromDom({ keepEmpty:true });
  rows.forEach((cells, rIdx) => {
    const field = FIXED_COST_MODAL_FIELDS[startField + rIdx];
    if (!field) return;
    const expectedLabel = String(field.label || '').replace(/\s*\*$/, '').trim();
    let values = cells.map(cell => String(cell || '').trim());
    if (values.length > 1 && values[0].replace(/\s*\*$/, '').trim() === expectedLabel) values = values.slice(1);
    values.forEach((cell, cIdx) => {
      const itemIndex = startItem + cIdx;
      while (nextRows.length <= itemIndex) nextRows.push(fixedCostModalNormalizeRow());
      const holder = document.createElement('div');
      holder.innerHTML = fixedCostModalInputHtml(field, fixedCostModalNormalizeRow(nextRows[itemIndex]), itemIndex);
      const input = holder.querySelector('input, select');
      fixedCostPasteSetValue(input, cell);
      if (field.type === 'checkbox') nextRows[itemIndex][field.key] = !!input.checked;
      else nextRows[itemIndex][field.key] = input.value;
    });
  });
  renderFixedCostModalRows(nextRows);
  setTimeout(() => body.querySelector(`[data-fc-field="${FIXED_COST_MODAL_FIELDS[startField]?.key}"][data-fc-index="${startItem}"]`)?.focus(), 0);
  showToast(`엑셀 붙여넣기 ${rows.length}행을 반영했습니다.`, 'success');
}
function fixedCostItemFromRow(row, id) {
  return {
    id,
    name: row.name,
    category: row.category || '기타',
    vendor: row.vendor,
    defaultAmount: row.defaultAmount,
    dueDay: row.dueDay,
    method: row.method || '계좌이체',
    note: row.note,
    active: row.active,
    updatedAt: new Date().toISOString()
  };
}
function openFixedCostAdd() {
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('finance', '고정비 등록')) return;
  delete inp('fixed-cost-modal').dataset.editId;
  inp('fixed-cost-modal-ttl').innerHTML = '<i class="ti ti-repeat" style="color:var(--tx-i);"></i>고정비 항목 일괄 등록';
  renderFixedCostModalRows();
  inp('fixed-cost-modal').classList.add('open');
  setTimeout(() => inp('fc-items-body')?.querySelector('.fc-row-name')?.focus(), 0);
}
function openFixedCostEdit(id) {
  if (!checkAdminAction()) return;
  const item = fixedCostItems().find(x => x.id === id);
  if (!item) return;
  if (!requireRecordPermission('edit', item, 'fixedCost')) return;
  inp('fixed-cost-modal').dataset.editId = id;
  inp('fixed-cost-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>고정비 항목 수정';
  renderFixedCostModalRows([item]);
  inp('fixed-cost-modal').classList.add('open');
}
function saveFixedCostItem() {
  if (!checkAdminAction()) return;
  ensureFixedCostData();
  const editId = inp('fixed-cost-modal').dataset.editId;
  const rows = fixedCostModalRowsFromDom();
  if (!rows.length) { showToast('등록할 고정비 항목을 입력하세요.', 'error'); return; }
  const invalid = rows.find(row => !row.name || row.defaultAmount <= 0);
  if (invalid) { showToast('항목명과 기본 금액은 필수입니다.', 'error'); return; }
  if (editId) {
    const existing = fixedCostItems().find(x => x.id === editId);
    if (existing) {
      if (!requireRecordPermission('edit', existing, 'fixedCost')) return;
      const before = _safeJsonClone(existing);
      Object.assign(existing, fixedCostItemFromRow(rows[0], editId));
      stampRecordUpdate(existing, before, 'fixedCost');
      writeAuditLog('fixedCost', editId, 'update', before, existing, { summary:'고정비 항목 수정', detail:`${rows[0].name} · ${fmtW(rows[0].defaultAmount)}` });
    }
    showToast('고정비 항목을 수정했습니다.', 'success');
  } else {
    if (typeof requireCreateAction === 'function' && !requireCreateAction('finance', '고정비 등록')) return;
    const created = [];
    rows.forEach(row => {
      const item = fixedCostItemFromRow(row, nextCode('FC', fixedCostItems()));
      item.createdAt = new Date().toISOString();
      stampRecordCreate(item, 'fixedCost');
      fixedCostItems().push(item);
      created.push(item);
      writeAuditLog('fixedCost', item.id, 'create', null, item, { summary:'고정비 항목 등록', detail:`${item.name} · ${fmtW(item.defaultAmount)}` });
    });
    financeData.fixedCosts.sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    showToast(`고정비 항목 ${created.length}건을 등록했습니다.`, 'success');
  }
  saveStorage('financeData', financeData);
  closeModal('fixed-cost-modal');
  renderFinance();
}
function deleteFixedCostItem(id) {
  if (!checkAdminAction()) return;
  const item = fixedCostItems().find(x => x.id === id);
  if (!item) return;
  if (!requireRecordPermission('delete', item, 'fixedCost')) return;
  confirm_('고정비 항목 삭제', `${item.name} 항목과 월별 처리 내역을 삭제하시겠습니까?`, () => {
    const payments = fixedCostPayments().filter(x => x.itemId === id);
    financeData.fixedCosts = fixedCostItems().filter(x => x.id !== id);
    financeData.fixedCostPayments = fixedCostPayments().filter(x => x.itemId !== id);
    writeAuditLog('fixedCost', id, 'delete', item, null, { summary:'고정비 항목 삭제', detail:`월별 처리 ${payments.length}건 함께 삭제` });
    saveStorage('financeData', financeData);
    renderFinance();
  }, 'btn-danger', 'ti-trash');
}
function updateFixedCostPayment(itemId, field, value) {
  const patch = {};
  if (field === 'amount') patch.amount = Math.max(0, Number(value) || 0);
  else if (field === 'status') {
    patch.status = value || '예정';
    if (patch.status === '지급완료' && !fixedCostPayment(itemId, fixedCostMonth)?.paidDate) patch.paidDate = today();
    if (patch.status !== '지급완료') patch.paidDate = '';
  } else if (field === 'paidDate') {
    patch.paidDate = value || '';
    if (value) patch.status = '지급완료';
  } else if (field === 'method') patch.method = value || '계좌이체';
  else if (field === 'note') patch.note = value || '';
  else if (field === 'dueDate') patch.dueDate = value || fixedCostPayDate(fixedCostMonth, 25);
  if (fixedCostSavePayment(itemId, fixedCostMonth, patch, { auditSummary:'월 고정비 수정' })) renderFinance();
}
function markFixedCostPaid(itemId) {
  if (fixedCostSavePayment(itemId, fixedCostMonth, { status:'지급완료', paidDate:today() }, { auditSummary:'고정비 지급완료' })) renderFinance();
}
function requestFixedCostPayment(itemId) {
  if (fixedCostSavePayment(itemId, fixedCostMonth, { status:'결제요청', paidDate:'' }, { auditSummary:'고정비 결제요청' })) renderFinance();
}
function holdFixedCostPayment(itemId) {
  if (fixedCostSavePayment(itemId, fixedCostMonth, { status:'보류', paidDate:'' }, { auditSummary:'고정비 보류' })) renderFinance();
}
function fixedCostPruneSelection(validIds) {
  const valid = new Set(validIds || []);
  let changed = false;
  fixedCostSelected.forEach(id => {
    if (!valid.has(id)) {
      fixedCostSelected.delete(id);
      changed = true;
    }
  });
  return changed;
}
function fixedCostToggleSelected(itemId, checked) {
  if (!itemId) return;
  if (checked) fixedCostSelected.add(itemId);
  else fixedCostSelected.delete(itemId);
  renderFinance();
}
function fixedCostToggleRow(event, itemId) {
  const target = event?.target;
  if (target?.closest?.('button,a,input,select,textarea,label')) return;
  fixedCostToggleSelected(itemId, !fixedCostSelected.has(itemId));
}
function fixedCostTogglePage(ids, checked) {
  (ids || []).forEach(id => checked ? fixedCostSelected.add(id) : fixedCostSelected.delete(id));
  renderFinance();
}
function clearFixedCostSelection() {
  fixedCostSelected.clear();
  renderFinance();
}
function selectedFixedCostId() {
  return [...fixedCostSelected][0] || '';
}
function openSelectedFixedCostMonthEdit() {
  if (fixedCostSelected.size !== 1) { showToast('고정비 항목 한 건만 선택하세요.', 'info'); return; }
  openFixedCostMonthEdit(selectedFixedCostId());
}
function openSelectedFixedCostItemEdit() {
  if (fixedCostSelected.size !== 1) { showToast('고정비 항목 한 건만 선택하세요.', 'info'); return; }
  openFixedCostEdit(selectedFixedCostId());
}
function fixedCostSelectedIds() {
  const itemIds = new Set(fixedCostItems().map(item => item.id));
  return [...fixedCostSelected].filter(id => itemIds.has(id));
}
function fixedCostBulkPatch(label, patchFactory) {
  const ids = fixedCostSelectedIds();
  if (!ids.length) { showToast('선택된 고정비 항목이 없습니다.', 'info'); return; }
  if (!checkAdminAction()) return;
  if (!guardFinanceMonth(`${fixedCostMonth}-01`)) return;
  let count = 0;
  ids.forEach(id => {
    const patch = typeof patchFactory === 'function' ? patchFactory(id) : patchFactory;
    if (fixedCostSavePayment(id, fixedCostMonth, patch, { skipGuard:true })) count++;
  });
  finAudit(label, `${fixedCostMonth} · ${count}건`);
  fixedCostSelected.clear();
  renderFinance();
  showToast(`${count}건을 처리했습니다.`, 'success');
}
function fixedCostBulkStatus(status) {
  if (status === '지급완료') {
    fixedCostBulkPatch('고정비 선택 지급완료', { status, paidDate:today() });
  } else if (status === '결제요청') {
    fixedCostBulkPatch('고정비 선택 결제요청', { status, paidDate:'' });
  } else if (status === '보류') {
    fixedCostBulkPatch('고정비 선택 보류', { status, paidDate:'' });
  }
}
function fixedCostBulkDelete() {
  const ids = fixedCostSelectedIds();
  if (!ids.length) { showToast('선택된 고정비 항목이 없습니다.', 'info'); return; }
  if (!checkAdminAction()) return;
  confirm_('고정비 항목 삭제', `선택한 고정비 ${ids.length}건과 월별 처리 이력을 삭제하시겠습니까?`, () => {
    const set = new Set(ids);
    financeData.fixedCosts = fixedCostItems().filter(item => !set.has(item.id));
    financeData.fixedCostPayments = fixedCostPayments().filter(pay => !set.has(pay.itemId));
    finAudit('고정비 선택 삭제', `${ids.length}건`);
    fixedCostSelected.clear();
    saveStorage('financeData', financeData);
    renderFinance();
  }, 'btn-danger', 'ti-trash');
}
function fixedCostSelectionBarHtml() {
  const count = fixedCostSelected.size;
  if (!count) return '';
  const single = count === 1;
  const auditBtn = (typeof managedAuditButtonHtml === 'function') ? `<button class="btn btn-sm" data-audit-detail-btn onclick="openAuditDetailsForRefs(fixedCostSelectedAuditRefs())"><i class="ti ti-history"></i>세부사항</button>` : '';
  return `<div class="selection-action-bar fixed-cost-selection-bar" style="display:flex;">
    <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span>
    ${auditBtn}
    <button class="btn btn-sm" onclick="fixedCostBulkStatus('지급완료')"><i class="ti ti-check"></i>지급완료</button>
    <button class="btn btn-sm" onclick="fixedCostBulkStatus('결제요청')"><i class="ti ti-send"></i>결제요청</button>
    <button class="btn btn-sm" onclick="fixedCostBulkStatus('보류')"><i class="ti ti-player-pause"></i>보류</button>
    <button class="btn btn-sm" onclick="openSelectedFixedCostMonthEdit()" ${single?'':'disabled'} title="${single?'선택한 월 고정비 수정':'한 건만 선택하면 수정할 수 있습니다.'}"><i class="ti ti-calendar-cog"></i>월별 수정</button>
    <button class="btn btn-sm" onclick="openSelectedFixedCostItemEdit()" ${single?'':'disabled'} title="${single?'선택한 항목 수정':'한 건만 선택하면 수정할 수 있습니다.'}"><i class="ti ti-edit"></i>항목 수정</button>
    <button class="btn btn-sm btn-danger" onclick="fixedCostBulkDelete()"><i class="ti ti-trash"></i>삭제</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="clearFixedCostSelection()"><i class="ti ti-x"></i>해제</button>
  </div>`;
}
function fixedCostSelectedAuditRefs() {
  return fixedCostSelectedIds().flatMap(itemId => {
    const refs = [{ entityType:'fixedCost', entityId:itemId }];
    const payment = fixedCostPayment(itemId, fixedCostMonth);
    if (payment && payment.id) refs.push({ entityType:'fixedCostPayment', entityId:payment.id });
    return refs;
  });
}
function ensureFixedCostMonthModal() {
  if (inp('fixed-cost-month-modal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="overlay" id="fixed-cost-month-modal">
      <div class="dlg" style="max-width:560px;width:96%;">
        <div class="dlg-title"><i class="ti ti-calendar-cog" style="color:var(--tx-i);"></i>월 고정비 수정</div>
        <input type="hidden" id="fcm-item-id">
        <div id="fcm-summary" class="fixed-cost-month-summary"></div>
        <div class="fg fg2">
          <div><label>예정일</label><input id="fcm-due-date" type="date"></div>
          <div><label>금액</label><input id="fcm-amount" type="number" min="0" step="10" inputmode="numeric"></div>
          <div><label>상태</label><select id="fcm-status"><option>예정</option><option>결제요청</option><option>지급완료</option><option>보류</option></select></div>
          <div><label>지급일</label><input id="fcm-paid-date" type="date"></div>
          <div><label>결제방법</label><select id="fcm-method">${fixedCostMethodOptions('계좌이체')}</select></div>
          <div style="grid-column:span 2;"><label>비고</label><input id="fcm-note" maxlength="200" placeholder="월별 특이사항"></div>
        </div>
        <div class="dlg-actions" style="margin-top:16px;">
          <button class="btn" onclick="closeModal('fixed-cost-month-modal')">취소</button>
          <button class="btn btn-primary" onclick="saveFixedCostMonthEdit()"><i class="ti ti-check"></i>저장</button>
        </div>
      </div>
    </div>`);
}
function openFixedCostMonthEdit(itemId) {
  const item = fixedCostItems().find(x => x.id === itemId);
  if (!item) return;
  ensureFixedCostMonthModal();
  const row = fixedCostEffectiveRow(item, fixedCostMonth);
  sv('fcm-item-id', itemId);
  sv('fcm-due-date', row.dueDate || fixedCostPayDate(fixedCostMonth, item.dueDay));
  sv('fcm-amount', Number(row.amount) || 0);
  sv('fcm-status', row.status || '예정');
  sv('fcm-paid-date', row.paidDate || '');
  sv('fcm-method', row.method || item.method || '계좌이체');
  sv('fcm-note', row.note || '');
  const summary = inp('fcm-summary');
  if (summary) {
    summary.innerHTML = `<b>${esc(row.name)}</b><span>${esc(monthLabel(fixedCostMonth))} · ${esc(row.category || '기타')} · ${esc(row.vendor || '지급처 미지정')}</span>`;
  }
  inp('fixed-cost-month-modal')?.classList.add('open');
}
function saveFixedCostMonthEdit() {
  const itemId = v('fcm-item-id');
  const status = v('fcm-status') || '예정';
  const patch = {
    dueDate: v('fcm-due-date') || fixedCostPayDate(fixedCostMonth, 25),
    amount: Math.max(0, Number(v('fcm-amount')) || 0),
    status,
    paidDate: status === '지급완료' ? (v('fcm-paid-date') || today()) : '',
    method: v('fcm-method') || '계좌이체',
    note: v('fcm-note') || ''
  };
  if (fixedCostSavePayment(itemId, fixedCostMonth, patch)) {
    finAudit('월 고정비 수정', `${fixedCostMonth} · ${itemId}`);
    closeModal('fixed-cost-month-modal');
    renderFinance();
  }
}
function poPaymentCell(p) {
  const total = finPoAmount(p);
  const pay = finPaymentRecord('ap', p.id, total);
  const req = finPaymentRequestForPo(p.id);
  if (pay.done) {
    const fullDate = pay.date || '';
    const shortDate = fullDate.length >= 10 ? fullDate.slice(5).replace('-', '.') : fullDate;
    const title = fullDate ? `지급완료 · ${fullDate}` : '지급완료';
    return `<div class="po-payment-cell po-payment-cell-paid" title="${esc(title)}">
      <span class="bd bd-ok po-payment-badge">지급완료</span>
      ${shortDate ? `<span class="po-payment-date">${esc(shortDate)}</span>` : ''}
    </div>`;
  }
  let label = '미요청';
  let cls = 'bd-neu';
  let title = '결제 요청 없음';
  if (req) {
    const approval = payreqApprovalStatus(req);
    const approvalLabel = payreqApprovalLabel(req);
    const requestStatus = req.status || '요청';
    const statusCls = { '요청':'bd-warn', '확인':'bd-info', '지급예정':'bd-info', '지급완료':'bd-ok', '반려':'bd-err' }[requestStatus] || 'bd-neu';
    if (requestStatus === '반려' || approval === 'rejected') {
      label = '반려';
      cls = 'bd-err';
    } else if (approval === 'approved' && requestStatus !== '요청') {
      label = requestStatus;
      cls = statusCls;
    } else if (approval === 'approved') {
      label = '승인';
      cls = 'bd-ok';
    } else {
      label = approvalLabel;
      cls = { draft:'bd-neu', pending:'bd-warn', rejected:'bd-err' }[approval] || 'bd-neu';
    }
    title = `결재 ${approvalLabel} · 지급 ${requestStatus}`;
  }
  const actionLabel = !req ? '요청' : (payreqIsApprovalEditable(req) ? '수정' : '보기');
  const actionTitle = !req ? '결제요청' : (payreqIsApprovalEditable(req) ? '요청수정' : '요청보기');
  return `<div class="po-payment-cell" title="${esc(title)}">
    <span class="bd ${cls} po-payment-badge">${esc(label)}</span>
    <button class="btn btn-sm po-payment-action" onclick="event.stopPropagation();openPaymentRequestFromPo('${esc(p.id)}')" title="${esc(actionTitle)}"><i class="ti ti-send"></i>${actionLabel}</button>
  </div>`;
}
function finPoAmount(p) { return typeof _docAmount === 'function' ? _docAmount(p, 'po') : (p.unitPrice||0)*(p.qty||0); }
function finPoItemSummary(p) { return typeof _docItemSummary === 'function' ? _docItemSummary(p) : (p.itemName || ''); }
function finPoItemSearchText(p) { return typeof _docItemsSearchText === 'function' ? _docItemsSearchText(p) : (p.itemName || '').toLowerCase(); }
function finPoCountsAsPurchase(p) {
  return ['발송완료','확인완료','입고완료'].includes(p?.status || '작성중');
}
function financeAccountingPoList() {
  return financeVisiblePoList().filter(finPoCountsAsPurchase);
}
function payreqApprovalSummaryHtml(req) {
  if (!req) return '';
  const statusTone = payreqApprovalTone(req);
  const decided = req.decidedAt ? `<span class="payreq-approval-mini"><i class="payreq-approval-dot ${statusTone}"></i>결정일 <b>${esc(req.decidedAt.slice(0, 10))}</b></span>` : '';
  const submitted = req.submittedAt ? `<span class="payreq-approval-mini"><i class="payreq-approval-dot pending"></i>요청일시 <b>${esc(req.submittedAt.slice(0, 16).replace('T', ' '))}</b></span>` : '';
  const approver = req.approverName ? `<span class="payreq-approval-mini"><i class="payreq-approval-dot approved"></i>승인자 <b>${esc(req.approverName)}</b></span>` : '';
  const note = req.decisionNote ? `<div class="payreq-muted-line" style="font-size:12px;">결정 메모: ${esc(req.decisionNote)}</div>` : '';
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;">
    <span style="font-weight:850;">결재 상태</span>${finPaymentRequestApprovalBadge(req)}${submitted}${approver}${decided}
  </div>${note}`;
}
function setPaymentRequestModalEditable(editable) {
  ['payreq-date','payreq-due','payreq-amount','payreq-assignee','payreq-requester','payreq-tax','payreq-note'].forEach(id => {
    const el = inp(id);
    if (el) el.disabled = !editable;
  });
  const draftBtn = inp('payreq-draft-btn');
  const submitBtn = inp('payreq-submit-btn');
  if (draftBtn) draftBtn.style.display = editable ? '' : 'none';
  if (submitBtn) submitBtn.style.display = editable ? '' : 'none';
}
function updatePaymentRequestModalState(req) {
  const summary = inp('payreq-approval-summary');
  if (summary) {
    summary.innerHTML = payreqApprovalSummaryHtml(req);
    summary.style.display = req ? '' : 'none';
  }
  setPaymentRequestModalEditable(!req || payreqIsApprovalEditable(req));
}
function financeFilteredRows(tab) {
  const s=finState(tab), q=s.query.trim().toLowerCase();
  if(tab==='revenue')return financeVisibleDeliveries().filter(d=>finMatchDate(d.deliveredAt,s)&&finMatchAmount((d.price||0)*(d.qty||0),s)&&(!q||[d.id,getClientName(d.clientId),d.productName,getProductName(d.productId)].join(' ').toLowerCase().includes(q)));
  if(tab==='purchase')return financeVisiblePoList().filter(p=>finMatchDate(p.date,s)&&finMatchAmount(finPoAmount(p),s)&&(!s.status||(p.status||'작성중')===s.status)&&(!q||[p.id,p.supplier,finPoItemSearchText(p)].join(' ').toLowerCase().includes(q)));
  if(tab==='payreq')return financePaymentRequests().filter(r=>canViewRecord(r,'paymentRequest')&&finMatchDate(r.requestDate,s)&&finMatchAmount(r.amount,s)&&(!s.status||r.status===s.status)&&(!q||[r.id,r.poId,r.supplier,r.itemSummary,r.assignee,r.requester,r.note,r.decisionNote,payreqApprovalLabel(r)].join(' ').toLowerCase().includes(q)));
  if(tab==='fixed')return fixedCostRows(fixedCostMonth, fixedCostShowInactive).filter(r=>finMatchAmount(r.amount,s)&&(!s.status||r.status===s.status)&&(!q||[r.name,r.category,r.vendor,r.method,r.note].join(' ').toLowerCase().includes(q)));
  if(tab==='cost')return financeCostInfoAllowed() ? financeVisibleProducts().filter(p=>finMatchAmount(prodUnitCost(p),s)&&(!q||[p.id,p.name,getClientName(p.clientId)].join(' ').toLowerCase().includes(q))) : [];
  if(tab==='labor')return financeVisibleWorkers().filter(w=>finMatchAmount(calcPayroll(w,payrollMonth).net,s)&&(!s.status||(calcPayroll(w,payrollMonth).confirmed?'확정':'작성중')===s.status)&&(!q||[w.id,w.name,w.dept,w.position].join(' ').toLowerCase().includes(q)));
  if(tab==='etc')return financeVisibleEntries().filter(e=>finMatchDate(e.date,s)&&finMatchAmount(e.amount,s)&&(!s.status||e.type===s.status)&&(!q||[e.id,e.category,e.title,e.note].join(' ').toLowerCase().includes(q)));
  return [];
}
function exportFinanceViewXLS(tab){
  if (typeof requireCsvAction === 'function' && !requireCsvAction('재무 엑셀 내보내기')) return;
  if(tab==='cost' && !financeCostInfoAllowed()){showToast('원가 내보내기 권한이 없습니다.','error');return;}
  if(typeof XLSX==='undefined'){showToast('엑셀 생성 라이브러리가 준비되지 않았습니다.','error');return;}
  if(tab==='ar'){
    const s=finState('ar'),q=s.query.trim().toLowerCase(),rows=[];
    financeVisibleDeliveries().filter(d=>{
      const total=(d.price||0)*(d.qty||0), pay=finPaymentRecord('ar',d.id,total);
      return finMatchDate(d.deliveredAt,s)&&finMatchAmount(total,s)&&(!s.status||pay.status===s.status)&&(!q||[d.id,getClientName(d.clientId),d.productName].join(' ').toLowerCase().includes(q));
    }).forEach(d=>{
      const total=(d.price||0)*(d.qty||0), pay=finPaymentRecord('ar',d.id,total);
      rows.push(['미수금',d.deliveredAt,getClientName(d.clientId),d.productName||getProductName(d.productId),total,pay.amount,pay.remaining,pay.status,pay.date,pay.method,pay.note]);
    });
    financeAccountingPoList().filter(p=>{
      const total=finPoAmount(p), pay=finPaymentRecord('ap',p.id,total);
      return finMatchDate(p.date,s)&&finMatchAmount(total,s)&&(!s.status||pay.status===s.status)&&(!q||[p.id,p.supplier,finPoItemSearchText(p)].join(' ').toLowerCase().includes(q));
    }).forEach(p=>{
      const total=finPoAmount(p), pay=finPaymentRecord('ap',p.id,total);
      rows.push(['미지급금',p.date,p.supplier,finPoItemSummary(p),total,pay.amount,pay.remaining,pay.status,pay.date,pay.method,pay.note]);
    });
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['구분','일자','거래처','품목','총액','처리액','잔액','상태','처리일','방법','메모'],...rows]);XLSX.utils.book_append_sheet(wb,ws,'채권채무');XLSX.writeFile(wb,`미수금_미지급금_${today()}.xlsx`);return;
  }
  const list=financeFilteredRows(tab); let header=[],rows=[];
  if(tab==='revenue'){header=['납품일','고객사','제품','수량','단가','매출액'];rows=list.map(d=>[d.deliveredAt,getClientName(d.clientId),d.productName||getProductName(d.productId),d.qty,d.price,(d.price||0)*(d.qty||0)]);}
  else if(tab==='purchase'){header=['발주일','공급처','품목','수량','단가','매입액','상태'];rows=list.map(p=>[p.date,p.supplier,finPoItemSummary(p),typeof _docQtySummary==='function'?_docQtySummary(p):p.qty,p.unitPrice,finPoAmount(p),p.status]);}
  else if(tab==='payreq'){header=['요청번호','요청일','희망지급일','발주번호','공급처','품목','요청금액','담당자','요청자','결재상태','지급상태','세금계산서','결정메모','비고'];rows=list.map(r=>[r.id,r.requestDate,r.dueDate,r.poId,r.supplier,r.itemSummary,r.amount,r.assignee,r.requester,payreqApprovalLabel(r),r.status,r.taxInvoiceStatus,r.decisionNote||'',r.note]);}
  else if(tab==='fixed'){header=['월','항목명','분류','지급처','예정일','금액','상태','지급일','결제방법','비고'];rows=list.map(r=>[r.ym,r.name,r.category,r.vendor,r.dueDate,r.amount,r.status,r.paidDate,r.method,r.note]);}
  else if(tab==='cost'){header=['코드','제품','고객사','재료비','노무비','경비','제조원가','수주단가'];rows=list.map(p=>[p.id,p.name,getClientName(p.clientId),typeof prodMaterialCost==='function'?prodMaterialCost(p):p.matCost,p.laborCost,p.ovhCost,prodUnitCost(p),p.price]);}
  else if(tab==='labor'){exportPayrollXLS();return;}
  else if(tab==='etc'){header=['일자','구분','분류','내용','금액','비고'];rows=list.map(e=>[e.date,e.type,e.category,e.title,e.amount,e.note]);}
  else {showToast('이 탭은 전용 내보내기를 사용하세요.','info');return;}
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([header,...rows]);XLSX.utils.book_append_sheet(wb,ws,'재무조회');XLSX.writeFile(wb,`재무_${tab}_${today()}.xlsx`);
}
function exportPnlXLS(){
  if (typeof requireCsvAction === 'function' && !requireCsvAction('손익 엑셀 내보내기')) return;
  if(typeof XLSX==='undefined'){showToast('엑셀 생성 라이브러리가 준비되지 않았습니다.','error');return;}
  const rows=finMonthList(finPnlMonths).map(m=>{const r=finRevenueMonth(m.ym),p=finPurchaseMonth(m.ym),l=finPayrollMonthly(m.ym),f=fixedCostExpenseMonth(m.ym),i=finEntryMonth(m.ym,'수입'),e=finEntryMonth(m.ym,'비용');return[m.ym,r,p,l,f,i,e,r-p-l-f-e+i];});
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['월','매출','매입/지출','인건비','고정비','기타수입','기타비용','순이익'],...rows]);XLSX.utils.book_append_sheet(wb,ws,'손익');XLSX.writeFile(wb,`손익계산_${finPnlMonths}개월_${today()}.xlsx`);
}
function finAudit(action, detail='') {
  if (typeof writeAuditLog === 'function') {
    writeAuditLog('finance', detail || action, 'update', null, null, { summary:action, detail });
    return;
  }
  financeData.auditLog.unshift({id:'FA-'+Date.now(),at:new Date().toISOString(),action,detail});
  financeData.auditLog=financeData.auditLog.slice(0,300);
}
const FINANCE_AUDIT_TYPES_LOCAL = new Set([
  'finance',
  'financePayment',
  'fixedCost',
  'fixedCostPayment',
  'paymentRequest',
  'payreq',
  'financeEntry'
]);
function financeAuditLogAllowed(log, source='') {
  if (!log) return false;
  const type = String(log.entityType || '').trim();
  if (type) {
    if (typeof isFinanceAuditLogEntry === 'function') return isFinanceAuditLogEntry(log) || FINANCE_AUDIT_TYPES_LOCAL.has(type);
    return FINANCE_AUDIT_TYPES_LOCAL.has(type);
  }
  return source === 'financeData' && !!(log.action || log.summary || log.detail);
}
function financeAuditRows() {
  const rows = [];
  const addRows = (list, source) => {
    if (!Array.isArray(list)) return;
    list.forEach(log => {
      if (financeAuditLogAllowed(log, source)) rows.push(log);
    });
  };
  addRows(Array.isArray(financeData.auditLog) ? financeData.auditLog : [], 'financeData');
  if (typeof auditLog !== 'undefined') addRows(auditLog, 'auditLog');
  if (typeof serverAuditLogCache !== 'undefined') addRows(serverAuditLogCache, 'server');
  const seen = new Set();
  return rows.filter(log => {
    const key = log.id || [log.at, log.entityType, log.entityId, log.action, log.summary || log.detail].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 300);
}
function financeAuditEntityLabel(log) {
  const type = String(log && log.entityType || '').trim();
  const labels = {
    finance: '재무',
    financePayment: '수금/지급',
    fixedCost: '고정비',
    fixedCostPayment: '월 고정비',
    paymentRequest: '결제요청',
    payreq: '결제요청',
    financeEntry: '기타 수입/비용'
  };
  return labels[type] || '재무';
}
function financeAuditActionText(log) {
  if (!log) return '변경';
  if (log.summary) return log.summary;
  if (typeof auditLabelForAction === 'function') return auditLabelForAction(log.action || '');
  return log.action || '변경';
}
function financeAuditDetailText(log) {
  if (!log) return '';
  return log.detail || log.entityId || '';
}
function financeAuditDateText(value) {
  if (!value) return '-';
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR');
}
function financeAuditTableHtml(rows) {
  if (!rows.length) return empty('아직 재무 변경 이력이 없습니다.');
  return `<div style="overflow-x:auto;">
    <table>
      <thead><tr><th>일시</th><th>분류</th><th>작업</th><th>상세</th></tr></thead>
      <tbody>${rows.slice(0,10).map(log=>`<tr>
        <td>${financeAuditDateText(log.at)}</td>
        <td><span class="finance-audit-type">${esc(financeAuditEntityLabel(log))}</span></td>
        <td style="font-weight:700;">${esc(financeAuditActionText(log))}</td>
        <td>${esc(financeAuditDetailText(log))}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
function financeDeliveryAmount(row) {
  return (Number(row && row.price) || 0) * (Number(row && row.qty) || 0);
}
function financeIntegrationStats(rangeInfo) {
  const deliveriesAll = financeVisibleDeliveries();
  const deliveries = deliveriesAll.filter(row => finDateInRange(row.deliveredAt, rangeInfo));
  const revenueAmount = deliveries.reduce((sum,row)=>sum+financeDeliveryAmount(row),0);
  const receivable = deliveries.reduce((sum,row)=>{
    const total = financeDeliveryAmount(row);
    return sum + finPaymentRecord('ar', row.id, total).remaining;
  },0);
  const poAll = financeVisiblePoList();
  const poInRange = poAll.filter(row => finDateInRange(row.date, rangeInfo));
  const purchaseRows = poInRange.filter(finPoCountsAsPurchase);
  const purchaseAmount = purchaseRows.reduce((sum,row)=>sum+finPoAmount(row),0);
  const payable = purchaseRows.reduce((sum,row)=>{
    const total = finPoAmount(row);
    return sum + finPaymentRecord('ap', row.id, total).remaining;
  },0);
  const payreqRows = financePaymentRequests()
    .filter(row => canViewRecord(row, 'paymentRequest'))
    .filter(row => finDateInRange(row.requestDate || row.dueDate, rangeInfo));
  const fixedRows = fixedCostRows(fixedCostMonth, false);
  const fixedActiveRows = fixedRows.filter(row => row.status !== '보류');
  return {
    deliveries,
    revenueAmount,
    receivable,
    revenueZeroCount: deliveries.filter(row => financeDeliveryAmount(row) <= 0).length,
    undatedDeliveries: deliveriesAll.filter(row => !row.deliveredAt).length,
    purchaseRows,
    purchaseAmount,
    payable,
    draftPoCount: poInRange.filter(row => !finPoCountsAsPurchase(row)).length,
    purchaseZeroCount: purchaseRows.filter(row => finPoAmount(row) <= 0).length,
    undatedPoCount: poAll.filter(row => !row.date).length,
    payreqRows,
    pendingApprovalCount: payreqRows.filter(row => payreqApprovalStatus(row) === 'pending').length,
    approvedOpenCount: payreqRows.filter(row => payreqIsApproved(row) && !payreqIsPaidDone(row) && row.status !== '반려').length,
    rejectedCount: payreqRows.filter(row => payreqApprovalStatus(row) === 'rejected' || row.status === '반려').length,
    fixedRows: fixedActiveRows,
    fixedTotal: fixedActiveRows.reduce((sum,row)=>sum+(Number(row.amount)||0),0),
    fixedPaidCount: fixedActiveRows.filter(row => row.status === '지급완료').length,
    fixedRequestCount: fixedActiveRows.filter(row => row.status === '결제요청').length
  };
}
function financeIntegrationMetricHtml(icon, label, value, sub, tab, tone='') {
  const toneClass = tone ? ` finance-link-stat-${tone}` : '';
  return `<button type="button" class="finance-link-stat${toneClass}" onclick="switchFinTab('${tab}')">
    <i class="ti ${icon}"></i>
    <span><b>${label}</b><strong>${value}</strong><em>${sub}</em></span>
  </button>`;
}
function financeIntegrationIssues(stats) {
  const issues = [];
  if (stats.undatedDeliveries) issues.push({ level:'warn', tab:'revenue', text:`납품일 없는 납품 ${stats.undatedDeliveries}건은 기간별 매출에서 빠질 수 있습니다.` });
  if (stats.revenueZeroCount) issues.push({ level:'warn', tab:'revenue', text:`매출 금액이 0원인 납품 ${stats.revenueZeroCount}건을 확인하세요.` });
  if (stats.draftPoCount) issues.push({ level:'info', tab:'purchase', text:`작성중 구매발주 ${stats.draftPoCount}건은 매입에 반영하지 않습니다.` });
  if (stats.undatedPoCount) issues.push({ level:'warn', tab:'purchase', text:`발주일 없는 구매발주 ${stats.undatedPoCount}건은 기간별 매입에서 빠질 수 있습니다.` });
  if (stats.purchaseZeroCount) issues.push({ level:'warn', tab:'purchase', text:`매입 금액이 0원인 반영 대상 발주 ${stats.purchaseZeroCount}건을 확인하세요.` });
  if (stats.pendingApprovalCount) issues.push({ level:'warn', tab:'payreq', text:`결재 승인 대기 중인 결제요청 ${stats.pendingApprovalCount}건이 있습니다.` });
  if (stats.rejectedCount) issues.push({ level:'danger', tab:'payreq', text:`반려된 결제요청 ${stats.rejectedCount}건은 지급 처리 전 재요청이 필요합니다.` });
  if (stats.receivable > 0) issues.push({ level:'info', tab:'ar', text:`선택 기간 미수금 잔액 ${fmtW(stats.receivable)}이 남아 있습니다.` });
  if (stats.payable > 0) issues.push({ level:'info', tab:'ar', text:`선택 기간 미지급금 잔액 ${fmtW(stats.payable)}이 남아 있습니다.` });
  return issues;
}
function financeIntegrationIssueHtml(issue) {
  const icon = issue.level === 'danger' ? 'ti-alert-octagon' : (issue.level === 'warn' ? 'ti-alert-triangle' : 'ti-info-circle');
  return `<button type="button" class="finance-link-issue finance-link-issue-${issue.level}" onclick="switchFinTab('${issue.tab}')">
    <i class="ti ${icon}"></i><span>${esc(issue.text)}</span>
  </button>`;
}
function financeIntegrationGuideHtml(rangeInfo = finRangeInfo()) {
  const stats = financeIntegrationStats(rangeInfo);
  const issues = financeIntegrationIssues(stats);
  const items = [
    ['ti-package-export', '매출', '납품 현황의 납품 완료/납품일 기준으로 반영'],
    ['ti-shopping-cart', '매입', '구매발주에서 작성중을 제외하고 발주·입고 흐름 반영'],
    ['ti-checklist', '결제요청', '구매발주 지급 전 승인 상태와 지급 처리 연결'],
    ['ti-repeat', '고정비/급여/기타', '월 마감 기준으로 손익과 변경 이력에 반영']
  ];
  return `<div class="card finance-flow-card">
    <div class="card-hd">
      <span class="card-ttl"><i class="ti ti-plug-connected"></i>재무 연동 기준</span>
      <span style="font-size:11px;color:var(--tx-t);">각 업무 데이터가 재무 요약에 반영되는 기준입니다.</span>
    </div>
    <div class="finance-flow-grid">${items.map(([icon,title,desc])=>`
      <div class="finance-flow-item">
        <i class="ti ${icon}"></i>
        <div><strong>${title}</strong><span>${desc}</span></div>
      </div>`).join('')}</div>
    <div class="finance-link-status">
      ${financeIntegrationMetricHtml('ti-trending-up', '매출 연동', `${stats.deliveries.length}건`, `${fmtW(stats.revenueAmount)} · 미수 ${fmtW(stats.receivable)}`, 'revenue', 'blue')}
      ${financeIntegrationMetricHtml('ti-trending-down', '매입 연동', `${stats.purchaseRows.length}건`, `${fmtW(stats.purchaseAmount)} · 미지급 ${fmtW(stats.payable)}`, 'purchase', 'orange')}
      ${financeIntegrationMetricHtml('ti-cash-banknote', '결제요청', `${stats.payreqRows.length}건`, `승인대기 ${stats.pendingApprovalCount} · 지급전 ${stats.approvedOpenCount}`, 'payreq', stats.pendingApprovalCount ? 'warn' : '')}
      ${financeIntegrationMetricHtml('ti-repeat', '고정비', `${stats.fixedRows.length}건`, `${monthLabel(fixedCostMonth)} · 지급완료 ${stats.fixedPaidCount}건`, 'fixed')}
    </div>
    <div class="finance-link-checks">
      <div class="finance-link-check-title"><i class="ti ti-stethoscope"></i>연동 점검</div>
      ${issues.length ? issues.slice(0,6).map(financeIntegrationIssueHtml).join('') : '<div class="finance-link-ok"><i class="ti ti-circle-check"></i>현재 기준에서 바로 확인할 연동 누락 의심 항목이 없습니다.</div>'}
    </div>
  </div>`;
}
function financeHometaxRows(rangeInfo) {
  const rows = Array.isArray(financeData.hometaxInvoices) ? financeData.hometaxInvoices : [];
  return rows.filter(row => !rangeInfo || finDateInRange(row.writeDate || row.collectedAt, rangeInfo));
}
function financeHometaxSummaryHtml(rangeInfo) {
  const rows = financeHometaxRows(rangeInfo);
  if (!rows.length) return '';
  const sales = rows.filter(row => row.type === '매출').reduce((sum,row)=>sum+(Number(row.amount)||0),0);
  const buys = rows.filter(row => row.type === '매입').reduce((sum,row)=>sum+(Number(row.amount)||0),0);
  const recent = rows.slice(0,5).map(row => `<tr>
    <td>${esc(row.writeDate || '—')}</td>
    <td>${esc(row.type || '—')}</td>
    <td>${esc(row.type === '매입' ? row.supplier : row.buyer) || '—'}</td>
    <td style="text-align:right;font-weight:700;">${fmtW(row.amount || 0)}</td>
  </tr>`).join('');
  return `<div class="card" style="margin-top:16px;">
    <div class="card-hd">
      <span class="card-ttl"><i class="ti ti-file-search"></i>홈택스 세금계산서 수집 자료</span>
      <span style="font-size:11px;color:var(--tx-t);">재무 장부 자동 반영 전 대사 참고</span>
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;margin-bottom:10px;">
      <span>수집 ${rows.length}건</span>
      <span>매출 자료 <b style="color:var(--tx-i);">${fmtW(sales)}</b></span>
      <span>매입 자료 <b style="color:#e8590c;">${fmtW(buys)}</b></span>
    </div>
    <div style="overflow-x:auto;"><table><thead><tr><th>작성일</th><th>구분</th><th>거래처</th><th style="text-align:right;">금액</th></tr></thead><tbody>${recent}</tbody></table></div>
  </div>`;
}
function isFinanceMonthClosed(ym) { return financeData.closedMonths.includes(ym); }
function toggleFinanceMonthClose(ym) {
  if (!checkAdminAction()) return;
  const closed=isFinanceMonthClosed(ym);
  confirm_(closed?'월 마감 해제':'월 마감', `${monthLabel(ym)}을 ${closed?'다시 수정 가능하게 열겠습니까?':'마감하여 재무·급여 수정을 잠그겠습니까?'}`, ()=>{
    if (closed) financeData.closedMonths=financeData.closedMonths.filter(x=>x!==ym);
    else financeData.closedMonths.push(ym);
    finAudit(closed?'월 마감 해제':'월 마감',ym);
    saveStorage('financeData',financeData); renderFinance();
  }, closed?'btn-primary':'btn-danger', closed?'ti-lock-open':'ti-lock');
}
function guardFinanceMonth(date) {
  const ym=String(date||'').slice(0,7);
  if (ym && isFinanceMonthClosed(ym)) { showToast(`${monthLabel(ym)}은 마감되어 수정할 수 없습니다.`,'error'); return false; }
  return true;
}

/* ── 집계 헬퍼 ── */
function finRevenueTotal()  { return financeVisibleDeliveries().reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseTotal() { return financeAccountingPoList().reduce((s,p)=>s+finPoAmount(p),0); }
function finPayrollMonthly(ym=today().slice(0,7)){
  const savedRows = (payrollRecords || []).filter(record => record.month === ym);
  const savedByWorker = new Map(savedRows.map(record => [record.workerId, record]));
  const savedTotal = savedRows.reduce((sum, record) => sum + (Number(record.gross) || 0), 0);
  if (ym !== today().slice(0,7)) return savedTotal;
  // 현재 월은 아직 확정 전일 수 있으므로 저장된 급여는 고정하고, 미저장 직원만 추정치로 보탭니다.
  return savedTotal + financeVisibleWorkers().filter(w => !savedByWorker.has(w.id)).reduce((s,w)=>{
    const hired = !w.hireDate || String(w.hireDate).slice(0,7) <= ym;
    if (!hired && !payrollRecord(w.id, ym)) return s;
    return s + calcPayroll(w,ym).gross;
  },0);
}
function finEntriesSum(type){ return financeVisibleEntries().filter(e=>e.type===type).reduce((s,e)=>s+(Number(e.amount)||0),0); }

function finMonthList(n) {
  const arr = [], base = new Date(today());
  for (let i=n-1; i>=0; i--) {
    const dd = new Date(base.getFullYear(), base.getMonth()-i, 1);
    const ym = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    arr.push({ ym, label: (dd.getMonth()+1)+'월' });
  }
  return arr;
}
function finRevenueMonth(ym)  { return financeVisibleDeliveries().filter(d=>(d.deliveredAt||'').slice(0,7)===ym).reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseMonth(ym) { return financeAccountingPoList().filter(p=>(p.date||'').slice(0,7)===ym).reduce((s,p)=>s+finPoAmount(p),0); }
function finEntryMonth(ym,type){ return financeVisibleEntries().filter(e=>e.type===type && (e.date||'').slice(0,7)===ym).reduce((s,e)=>s+(Number(e.amount)||0),0); }
function finRangeInfo(range = finDashboardRange) {
  const now = new Date(today());
  const fmt = dateText;   // 공통 'YYYY-MM-DD' 포매터 재사용
  if (range === 'prev') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { label:'지난달', from:fmt(first), to:fmt(last) };
  }
  if (range === 'year') return { label:'올해', from:`${now.getFullYear()}-01-01`, to:fmt(now) };
  if (range === 'all') return { label:'전체', from:'', to:'' };
  return { label:'이번 달', from:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to:fmt(now) };
}
function finDateInRange(date, rangeInfo) {
  const value = String(date || '').slice(0,10);
  return (!rangeInfo.from || value >= rangeInfo.from) && (!rangeInfo.to || value <= rangeInfo.to);
}
function finMonthsBetween(from, to) {
  const months = [];
  if (!from || !to) return months;
  const start = new Date(from.slice(0,7) + '-01');
  const end = new Date(to.slice(0,7) + '-01');
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return months;
}
function finRangeMonths(rangeInfo) {
  if (rangeInfo.from || rangeInfo.to) return finMonthsBetween(rangeInfo.from, rangeInfo.to);
  const set = new Set();
  financeVisibleDeliveries().forEach(d => { if (d.deliveredAt) set.add(String(d.deliveredAt).slice(0,7)); });
  financeAccountingPoList().forEach(p => { if (p.date) set.add(String(p.date).slice(0,7)); });
  financeVisibleEntries().forEach(e => { if (e.date) set.add(String(e.date).slice(0,7)); });
  payrollRecords.forEach(p => { if (p.month) set.add(p.month); });
  if (!set.size) set.add(today().slice(0,7));
  return [...set].sort();
}
function finRevenueRange(rangeInfo) { return financeVisibleDeliveries().filter(d=>finDateInRange(d.deliveredAt, rangeInfo)).reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseRange(rangeInfo) { return financeAccountingPoList().filter(p=>finDateInRange(p.date, rangeInfo)).reduce((s,p)=>s+finPoAmount(p),0); }
function finEntryRange(rangeInfo,type) { return financeVisibleEntries().filter(e=>e.type===type && finDateInRange(e.date, rangeInfo)).reduce((s,e)=>s+(Number(e.amount)||0),0); }
function finPayrollRange(rangeInfo) { return finRangeMonths(rangeInfo).reduce((sum, ym)=>sum+finPayrollMonthly(ym),0); }

/* ── 탭 전환 ── */
function financeCostInfoAllowed() {
  if (typeof canViewCostInfo === 'function') return canViewCostInfo();
  const role = (typeof currentRole !== 'undefined' && currentRole) || localStorage.getItem('mes_myRole') || 'staff';
  return role === 'admin' || role === 'manager';
}
function switchFinTab(tab) {
  if (tab === 'cost' && !financeCostInfoAllowed()) {
    if (typeof showToast === 'function') showToast('원가 조회 권한이 없습니다.', 'error');
    tab = 'dashboard';
  }
  financeTab = tab;
  syncCurrentSubRoute('finance', financeTab);
  renderFinance();
}

// 모던 셸 사이드바에서 재무 하위 탭으로 직접 이동(재고의 goInventory 와 대칭).
// 다른 페이지에 있으면 finance 로 이동하면서 현재 financeTab 세그먼트가 라우트에 실린다.
function goFinanceTab(tab) {
  const target = (tab === 'cost' && !financeCostInfoAllowed()) ? 'dashboard' : (tab || 'dashboard');
  financeTab = target;
  if (typeof currentPage !== 'undefined' && currentPage !== 'finance') {
    go('finance');
  } else {
    syncCurrentSubRoute('finance', target);
    renderFinance();
  }
}

function updateFinancePrimaryAction() {
  const button = inp('finance-primary-action');
  if (!button) return;
  if (financeTab === 'etc') {
    button.style.display = 'inline-flex';
    button.title = '기타 수입/비용 등록';
    button.innerHTML = '<i class="ti ti-plus"></i>기타 등록';
  } else if (financeTab === 'fixed') {
    button.style.display = 'inline-flex';
    button.title = '고정비 항목 등록';
    button.innerHTML = '<i class="ti ti-plus"></i>고정비 등록';
  } else {
    button.style.display = 'none';
  }
}

function openFinancePrimaryAction() {
  if (financeTab === 'etc') openFinanceAdd();
  else if (financeTab === 'fixed') openFixedCostAdd();
}

function renderFinance() {
  const body = inp('finance-body'); if (!body) return;
  if (financeTab === 'cost' && !financeCostInfoAllowed()) financeTab = 'dashboard';
  // 재무 하위 탭은 사이드바로 이동함. 등록 액션바는 현재 탭이 필요할 때만 노출.
  updatePaymentRequestBadge();
  updateFinancePrimaryAction();
  const map = {
    dashboard: _finDashboard, revenue: _finRevenue, purchase: _finPurchase,
    cost: _finCost, labor: _finLabor, pnl: _finPnl, ar: _finAR, payreq: _finPayRequests, fixed: _finFixedCost, etc: _finEtc
  };
  body.innerHTML = (map[financeTab] || _finDashboard)();
}

/* ── 재무 현황 대시보드 ── */
function _finDashboard() {
  const rangeInfo = finRangeInfo();
  const rev = finRevenueRange(rangeInfo), pur = finPurchaseRange(rangeInfo);
  const gross = rev - pur;
  const grossRate = rev > 0 ? Math.round(gross/rev*1000)/10 : 0;
  const payroll = finPayrollRange(rangeInfo);
  const inc = finEntryRange(rangeInfo,'수입'), exp = finEntryRange(rangeInfo,'비용');
  const fixedExp = finFixedCostRange(rangeInfo);
  const fixedPaid = finFixedCostPaidRange(rangeInfo);
  const net = rev - pur - payroll - fixedExp - exp + inc;
  const months = finMonthList(6);
  const maxV = Math.max(1, ...months.map(m => Math.max(finRevenueMonth(m.ym), finPurchaseMonth(m.ym))));
  const financeLogs = financeAuditRows();

  const bars = months.map(m => {
    const r = finRevenueMonth(m.ym), p = finPurchaseMonth(m.ym);
    const rh = Math.round(r/maxV*130), ph = Math.round(p/maxV*130);
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div style="display:flex;align-items:flex-end;gap:4px;height:140px;">
          <div title="매출 ${fmtW(r)}" style="width:16px;height:${rh}px;background:var(--tx-i);border-radius:3px 3px 0 0;"></div>
          <div title="매입 ${fmtW(p)}" style="width:16px;height:${ph}px;background:#e8590c;border-radius:3px 3px 0 0;"></div>
        </div>
        <div style="font-size:11px;color:var(--tx-s);font-weight:600;">${m.label}</div>
      </div>`;
  }).join('');

  return `
    <div class="toolbar" style="margin-bottom:12px;">
      <span style="font-size:11px;font-weight:700;color:var(--tx-s);">요약 기준</span>
      ${[
        ['month','이번 달'],['prev','지난달'],['year','올해'],['all','전체']
      ].map(([key,label])=>`<button class="btn btn-sm ${finDashboardRange===key?'btn-primary':''}" onclick="finDashboardRange='${key}';renderFinance()">${label}</button>`).join('')}
      <span style="font-size:10px;color:var(--tx-t);">${rangeInfo.from ? `${rangeInfo.from} ~ ${rangeInfo.to}` : '전체 기간'}</span>
    </div>
    <div class="toolbar" style="margin-bottom:12px;">
      <span style="font-size:11px;font-weight:700;color:var(--tx-s);">월 마감 관리</span>
      <input type="month" value="${finClosingMonth}" onchange="finClosingMonth=this.value;renderFinance()" style="width:130px;">
      <button class="btn btn-sm ${isFinanceMonthClosed(finClosingMonth)?'btn-danger':''}" onclick="toggleFinanceMonthClose('${finClosingMonth}')"><i class="ti ${isFinanceMonthClosed(finClosingMonth)?'ti-lock':'ti-lock-open'}"></i>${isFinanceMonthClosed(finClosingMonth)?'마감 해제':'월 마감'}</button>
      <span style="font-size:10px;color:var(--tx-t);">마감 월의 급여·수입·비용·수금/지급 처리가 잠깁니다.</span>
    </div>
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-up"></i>${rangeInfo.label} 매출 (납품 기준)</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(rev)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-down"></i>${rangeInfo.label} 매입/지출</div><div class="mc-val" style="color:#e8590c;">${fmtW(pur)}</div><div class="mc-sub">작성중 발주 제외</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-report-money"></i>매출총이익</div><div class="mc-val" style="color:${gross>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(gross)}</div><div class="mc-sub">이익률 ${grossRate}%</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash"></i>${rangeInfo.label} 인건비</div><div class="mc-val">${fmtW(payroll)}</div><div class="mc-sub">${finRangeMonths(rangeInfo).length}개월 반영</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-repeat"></i>${rangeInfo.label} 고정비</div><div class="mc-val" style="color:#e8590c;">${fmtW(fixedExp)}</div><div class="mc-sub">발생 기준 · 지급완료 ${fmtW(fixedPaid)}</div></div>
    </div>

    ${financeIntegrationGuideHtml()}

    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-calendar-stats"></i>${rangeInfo.label} 손익 요약</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:24px;padding:6px 4px;font-size:13px;">
        <div>매출 <b style="color:var(--tx-i);">${fmtW(rev)}</b></div>
        <div>− 매입/지출 <b style="color:#e8590c;">${fmtW(pur)}</b></div>
        <div>− 인건비 <b>${fmtW(payroll)}</b></div>
        <div>− 고정비(발생) <b>${fmtW(fixedExp)}</b></div>
        <div>− 기타비용 <b>${fmtW(exp)}</b></div>
        <div>+ 기타수입 <b>${fmtW(inc)}</b></div>
        <div style="border-left:2px solid var(--br);padding-left:24px;">순이익 <b style="color:${net>=0?'var(--tx-ok)':'var(--tx-err)'};font-size:15px;">${fmtW(net)}</b></div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-chart-bar"></i>월별 매출·매입 추이 (최근 6개월)</span>
        <div style="display:flex;gap:14px;font-size:11px;color:var(--tx-s);">
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--tx-i);border-radius:2px;"></span> 매출</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#e8590c;border-radius:2px;"></span> 매입</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;padding:10px 4px 0;">${bars}</div>
    </div>
    ${financeHometaxSummaryHtml(rangeInfo)}
    <div class="card" style="margin-top:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-history"></i>최근 재무 변경 이력</span><span style="font-size:10px;color:var(--tx-t);">재무 항목만 표시 · 최대 300건 보관</span></div>
      ${financeAuditTableHtml(financeLogs)}
    </div>`;
}

/* ── 매출 ── */
function _finRevenue() {
  const state=finState('revenue'), query=state.query.trim().toLowerCase();
  let list=financeVisibleDeliveries().filter(d=>finMatchDate(d.deliveredAt,state) && finMatchAmount((d.price||0)*(d.qty||0),state) &&
    (!query || [d.id,getClientName(d.clientId),d.productName,getProductName(d.productId)].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,d=>d.deliveredAt,d=>(d.price||0)*(d.qty||0));
  const total=list.reduce((sum,d)=>sum+(d.price||0)*(d.qty||0),0), page=finPaged(list,state);
  const body = page.rows.length ? page.rows.map(d => `
    <tr>
      <td>${d.deliveredAt||'—'}</td>
      <td>${getClientName(d.clientId)}</td>
      <td>${d.productName||getProductName(d.productId)}</td>
      <td>${d.qty}${d.unit||''}</td>
      <td class="amt-blue">${fmtW(d.price||0)}</td>
      <td style="font-weight:700;color:var(--tx-i);">${fmtW((d.price||0)*(d.qty||0))}</td>
    </tr>`).join('') : `<tr><td colspan="6">${empty('납품(매출) 내역이 없습니다.')}</td></tr>`;
  return `
    ${finFilterBar('revenue',{placeholder:'고객사·제품·번호 검색'})}
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-trending-up"></i>매출 내역 (납품 기준)</span>
        <span style="font-size:13px;">총 매출 <b style="color:var(--tx-i);">${fmtW(total)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>납품일</th><th>고객사</th><th>제품</th><th>수량</th><th>단가</th><th>매출액</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('revenue',page)}
    </div>`;
}

/* ── 매입/지출 ── */
function _finPurchase() {
  const state=finState('purchase'), query=state.query.trim().toLowerCase();
  let list=financeVisiblePoList().filter(p=>finMatchDate(p.date,state) && finMatchAmount(finPoAmount(p),state) && (!state.status || (p.status||'작성중')===state.status) &&
    (!query || [p.id,p.supplier,finPoItemSearchText(p)].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,p=>p.date,p=>finPoAmount(p));
  const total=list.reduce((sum,p)=>sum+finPoAmount(p),0);
  const accountingTotal=list.filter(finPoCountsAsPurchase).reduce((sum,p)=>sum+finPoAmount(p),0), page=finPaged(list,state);
  const body = page.rows.length ? page.rows.map(p => `
    <tr>
      <td>${esc(p.date)||'—'}</td>
      <td>${esc(p.supplier)||'—'}</td>
      <td>${esc(finPoItemSummary(p))||'—'}</td>
      <td>${esc(typeof _docQtySummary==='function'?_docQtySummary(p):p.qty)}${typeof _docQtySummary==='function'?'':(esc(p.unit)||'')}</td>
      <td>${fmtW(p.unitPrice||0)}</td>
      <td style="font-weight:700;color:#e8590c;">${fmtW(finPoAmount(p))}</td>
      <td>${statusBadge(p.status||'작성중')}</td>
    </tr>`).join('') : `<tr><td colspan="7">${empty('구매발주(매입) 내역이 없습니다.')}</td></tr>`;
  return `
    ${finFilterBar('purchase',{placeholder:'공급처·품목·발주번호 검색',statuses:['작성중','발송완료','확인완료','입고완료']})}
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-trending-down"></i>매입/지출 내역 (구매발주 기준)</span>
        <span style="font-size:13px;">조회 합계 <b style="color:#e8590c;">${fmtW(total)}</b> · 회계 반영 <b style="color:#e8590c;">${fmtW(accountingTotal)}</b></span></div>
      <div class="al al-info" style="margin-bottom:10px;"><i class="ti ti-info-circle"></i><div><div class="al-t">재무 반영 기준</div><div class="al-s">작성중 발주서는 손익·미지급 집계에서 제외하고, 발송완료·확인완료·입고완료 상태만 매입으로 반영합니다.</div></div></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>발주일</th><th>공급처</th><th>품목</th><th>수량</th><th>단가</th><th>매입액</th><th>상태</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('purchase',page)}
    </div>`;
}

function financePaymentSource(kind, id) {
  if (kind === 'ap') {
    const p = financeVisiblePoList().find(x => x.id === id);
    if (!p) return null;
    if (!finPoCountsAsPurchase(p)) return null;
    return { date:p.date, partner:p.supplier, item:finPoItemSummary(p), total:finPoAmount(p), title:'미지급금', po:p };
  }
  const d = financeVisibleDeliveries().find(x => x.id === id);
  if (!d) return null;
  return { date:d.deliveredAt, partner:getClientName(d.clientId), item:d.productName || getProductName(d.productId), total:(d.price||0)*(d.qty||0), title:'미수금', delivery:d };
}
function openFinancePayment(kind, id) {
  if (!checkAdminAction()) return;
  const src = financePaymentSource(kind, id);
  if (!src) { showToast('처리할 항목을 찾을 수 없습니다.', 'error'); return; }
  if (kind === 'ap') {
    const p = financeVisiblePoList().find(x => x.id === id);
    if (p && !requireRecordPermission('edit', p, 'po')) return;
    const req = finPaymentRequestForPo(id);
    if (!req || !payreqIsApproved(req)) { showToast('승인된 결제 요청이 있어야 지급 처리할 수 있습니다.', 'info'); return; }
  }
  const pay = finPaymentRecord(kind, id, src.total);
  sv('payment-kind', kind);
  sv('payment-id', id);
  inp('payment-modal-ttl').innerHTML = `<i class="ti ti-cash-banknote" style="color:var(--tx-i);"></i>${kind === 'ap' ? '지급 처리' : '수금 처리'}`;
  inp('payment-source-summary').innerHTML = `
    <div style="font-weight:800;margin-bottom:4px;">${esc(src.title)} · ${esc(id)}</div>
    <div style="font-size:12px;color:var(--tx-s);">${esc(src.partner)} · ${esc(src.item)}</div>
    <div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;font-size:12px;">
      <span>총액 <b>${fmtW(src.total)}</b></span><span>처리액 <b>${fmtW(pay.amount)}</b></span><span>잔액 <b style="color:#e8590c;">${fmtW(pay.remaining)}</b></span>
    </div>`;
  sv('payment-date', pay.date || today());
  sv('payment-amount', pay.remaining || src.total || 0);
  sv('payment-method', pay.method || '계좌이체');
  sv('payment-note', pay.note || '');
  inp('payment-modal').classList.add('open');
}
function saveFinancePayment() {
  if (!checkAdminAction()) return;
  const kind = v('payment-kind'), id = v('payment-id');
  const src = financePaymentSource(kind, id);
  if (!src) { showToast('처리할 항목을 찾을 수 없습니다.', 'error'); return; }
  if (kind === 'ap') {
    const req = finPaymentRequestForPo(id);
    if (!req || !payreqIsApproved(req)) { showToast('승인된 결제 요청이 있어야 지급 처리할 수 있습니다.', 'info'); return; }
  }
  const date = v('payment-date') || today();
  if (!guardFinanceMonth(date)) return;
  const amount = Math.max(0, Number(v('payment-amount')) || 0);
  if (amount <= 0) { showToast('처리금액을 입력하세요. 미처리는 되돌리기 버튼을 사용하세요.', 'error'); return; }
  const current = finPaymentRecord(kind, id, src.total);
  const nextAmount = Math.min(src.total, current.amount + amount);
  const before = _safeJsonClone(finPaymentMap(kind)[id] || current);
  finPaymentMap(kind)[id] = { amount:nextAmount, date, method:v('payment-method') || '계좌이체', note:v('payment-note') || '' };
  const pay = finPaymentRecord(kind, id, src.total);
  if (kind === 'ap') {
    const req = finPaymentRequestForPo(id);
    if (req && pay.done) {
      req.status = '지급완료';
      req.completedAt = new Date().toISOString();
      req.updatedAt = new Date().toISOString();
      stampRecordUpdate(req, null, 'paymentRequest');
    }
  }
  writeAuditLog('financePayment', id, 'update', before, finPaymentMap(kind)[id], { summary:kind === 'ap' ? '지급 처리' : '수금 처리', detail:`${id} · ${fmtW(amount)} · 누적 ${fmtW(nextAmount)} · ${pay.status}` });
  arSelected.delete(finPaymentRowKey(kind, id));
  saveStorage('financeData', financeData);
  closeModal('payment-modal');
  renderFinance();
  if (typeof renderPo === 'function') renderPo();
  showToast(kind === 'ap' ? '지급 처리가 저장되었습니다.' : '수금 처리가 저장되었습니다.', 'success');
}
function clearFinancePayment() {
  if (!checkAdminAction()) return;
  const kind = v('payment-kind'), id = v('payment-id');
  const src = financePaymentSource(kind, id);
  if (!src) return;
  if (!guardFinanceMonth(today())) return;
  const before = _safeJsonClone(finPaymentMap(kind)[id] || finPaymentRecord(kind, id, src.total));
  delete finPaymentMap(kind)[id];
  const req = kind === 'ap' ? finPaymentRequestForPo(id) : null;
  if (req && req.status === '지급완료') {
    req.status = '지급예정';
    delete req.completedAt;
    req.updatedAt = new Date().toISOString();
    stampRecordUpdate(req, null, 'paymentRequest');
  }
  writeAuditLog('financePayment', id, 'restore', before, null, { summary:kind === 'ap' ? '지급 미처리 복원' : '수금 미처리 복원', detail:id });
  arSelected.delete(finPaymentRowKey(kind, id));
  saveStorage('financeData', financeData);
  closeModal('payment-modal');
  renderFinance();
  if (typeof renderPo === 'function') renderPo();
  showToast('미처리 상태로 되돌렸습니다.', 'success');
}
function finPaymentRowKey(kind, id) {
  return `${kind}:${id}`;
}
function finPaymentKeyParts(key) {
  const idx = String(key || '').indexOf(':');
  return idx < 0 ? { kind:'', id:'' } : { kind:key.slice(0, idx), id:key.slice(idx + 1) };
}
function arPruneSelection(validKeys) {
  const valid = new Set(validKeys || []);
  arSelected.forEach(key => {
    if (!valid.has(key)) arSelected.delete(key);
  });
}
function arSelectedRows() {
  return [...arSelected].map(key => {
    const parts = finPaymentKeyParts(key);
    const src = financePaymentSource(parts.kind, parts.id);
    if (!src) return null;
    const pay = finPaymentRecord(parts.kind, parts.id, src.total);
    return { key, kind:parts.kind, id:parts.id, date:src.date, partner:src.partner, item:src.item, total:src.total, pay };
  }).filter(Boolean);
}
function arSelectedAuditRefs() {
  return arSelectedRows().map(row => ({ entityType:'financePayment', entityId:row.id }));
}
function arToggleSelected(key, checked) {
  if (!key) return;
  if (checked) arSelected.add(key);
  else arSelected.delete(key);
  renderFinance();
}
function arToggleRow(event, key) {
  const target = event?.target;
  if (target?.closest?.('button,a,input,select,textarea,label')) return;
  arToggleSelected(key, !arSelected.has(key));
}
function arTogglePage(keys, checked) {
  (keys || []).forEach(key => checked ? arSelected.add(key) : arSelected.delete(key));
  renderFinance();
}
function clearArSelection() {
  arSelected.clear();
  renderFinance();
}
function openSelectedFinancePayment() {
  const rows = arSelectedRows();
  if (rows.length !== 1) { showToast('수금/지급 항목 한 건만 선택하세요.', 'info'); return; }
  openFinancePayment(rows[0].kind, rows[0].id);
}
function arBulkClearPayment() {
  const rows = arSelectedRows().filter(row => row.pay.amount > 0);
  if (!rows.length) { showToast('미처리로 복원할 항목이 없습니다.', 'info'); return; }
  if (!checkAdminAction()) return;
  if (!guardFinanceMonth(today())) return;
  confirm_('수금/지급 미처리 복원', `선택한 처리 내역 ${rows.length}건을 미처리 상태로 되돌리시겠습니까?`, () => {
    rows.forEach(row => {
      delete finPaymentMap(row.kind)[row.id];
      const req = row.kind === 'ap' ? finPaymentRequestForPo(row.id) : null;
      if (req && req.status === '지급완료') {
        req.status = '지급예정';
        delete req.completedAt;
        req.updatedAt = new Date().toISOString();
      }
    });
    finAudit('수금/지급 선택 미처리 복원', `${rows.length}건`);
    arSelected.clear();
    saveStorage('financeData', financeData);
    renderFinance();
    if (typeof renderPo === 'function') renderPo();
    showToast(`${rows.length}건을 미처리 상태로 되돌렸습니다.`, 'success');
  }, 'btn-danger', 'ti-rotate-clockwise');
}
function arSelectionBarHtml() {
  const rows = arSelectedRows();
  const count = rows.length;
  const single = count === 1;
  const processed = rows.filter(row => row.pay.amount > 0).length;
  const singleLabel = single && rows[0].kind === 'ap' ? '지급 처리' : '수금 처리';
  const auditBtn = (typeof managedAuditButtonHtml === 'function') ? `<button class="btn btn-sm" data-audit-detail-btn onclick="openAuditDetailsForRefs(arSelectedAuditRefs())"><i class="ti ti-history"></i>세부사항</button>` : '';
  return `<div class="selection-action-bar ar-selection-bar" style="display:flex;">
    <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span>
    ${auditBtn}
    <button class="btn btn-sm" onclick="openSelectedFinancePayment()" ${single?'':'disabled'} title="${single?'선택한 항목 처리':'한 건만 선택하면 처리할 수 있습니다.'}"><i class="ti ti-cash-banknote"></i>${singleLabel}</button>
    <button class="btn btn-sm btn-danger" onclick="arBulkClearPayment()" ${processed?'':'disabled'}><i class="ti ti-rotate-clockwise"></i>미처리 복원</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="clearArSelection()"><i class="ti ti-x"></i>해제</button>
  </div>`;
}
function _finAR() {
  const state=finState('ar'), q=state.query.trim().toLowerCase(), rows=[];
  financeVisibleDeliveries().forEach(d => {
    const total=(d.price||0)*(d.qty||0), pay=finPaymentRecord('ar',d.id,total);
    rows.push({kind:'ar', id:d.id, date:d.deliveredAt, partner:getClientName(d.clientId), item:d.productName||getProductName(d.productId), total, pay});
  });
  financeAccountingPoList().forEach(p => {
    const total=finPoAmount(p), pay=finPaymentRecord('ap',p.id,total);
    rows.push({kind:'ap', id:p.id, date:p.date, partner:p.supplier, item:finPoItemSummary(p), total, pay});
  });
  let list=rows.filter(r => finMatchDate(r.date,state) && finMatchAmount(r.total,state) && (!state.status || r.pay.status===state.status) &&
    (!q || [r.id,r.partner,r.item].join(' ').toLowerCase().includes(q)));
  list=finSort(list,state,r=>r.date,r=>r.total);
  list.forEach(row => { row.key = finPaymentRowKey(row.kind, row.id); });
  arPruneSelection(list.map(row => row.key));
  const totalAr=list.filter(r=>r.kind==='ar').reduce((s,r)=>s+r.pay.remaining,0);
  const totalAp=list.filter(r=>r.kind==='ap').reduce((s,r)=>s+r.pay.remaining,0);
  const page=finPaged(list,state);
  const pageKeys = page.rows.map(row => row.key);
  const pageKeysJson = JSON.stringify(pageKeys);
  const allPageSelected = !!pageKeys.length && pageKeys.every(key => arSelected.has(key));
  const body=page.rows.length?page.rows.map(r=>{
    const checked = arSelected.has(r.key);
    const keyJson = JSON.stringify(r.key);
    return `<tr class="${checked?'table-row-selected':''}" onclick='arToggleRow(event, ${keyJson})' style="cursor:pointer;">
      <td class="finance-select-cell"><input class="finance-select-check" type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation()" onchange='arToggleSelected(${keyJson}, this.checked)'></td>
      <td>${r.kind==='ap'?'미지급금':'미수금'}</td>
      <td>${esc(r.date)||'—'}</td>
      <td style="font-weight:700;">${esc(r.partner)||'—'}<span style="display:block;font-size:10px;color:var(--tx-t);">${esc(r.id)}</span></td>
      <td>${esc(r.item)||'—'}</td>
      <td style="text-align:right;font-weight:700;">${fmtW(r.total)}</td>
      <td style="text-align:right;">${fmtW(r.pay.amount)}</td>
      <td style="text-align:right;color:${r.pay.remaining>0?'#e8590c':'var(--tx-ok)'};">${fmtW(r.pay.remaining)}</td>
      <td>${finPaymentStatusBadge(r.kind, r.pay)}</td>
      <td>${esc(r.pay.date || '—')}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="10">${empty('수금/지급 대상이 없습니다.')}</td></tr>`;
  return `
    ${finFilterBar('ar',{placeholder:'거래처·품목·번호 검색',statuses:['미처리','부분','완료']})}
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-receipt"></i>미수 잔액</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(totalAr)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash-banknote"></i>미지급 잔액</div><div class="mc-val" style="color:#e8590c;">${fmtW(totalAp)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-list-check"></i>조회 건수</div><div class="mc-val">${list.length}</div></div>
    </div>
    <div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-receipt"></i>수금/지급 처리</span><button class="btn btn-sm" onclick="exportFinanceViewXLS('ar')"><i class="ti ti-file-spreadsheet"></i>엑셀</button></div>
      <div style="overflow-x:auto;"><table class="finance-payment-table" data-no-managed-table><thead><tr><th class="finance-select-cell"><input class="finance-select-check" type="checkbox" ${allPageSelected?'checked':''} ${pageKeys.length?'':'disabled'} onclick="event.stopPropagation()" onchange='arTogglePage(${pageKeysJson}, this.checked)'></th><th>구분</th><th>일자</th><th>거래처</th><th>품목</th><th style="text-align:right;">총액</th><th style="text-align:right;">처리액</th><th style="text-align:right;">잔액</th><th>상태</th><th>처리일</th></tr></thead><tbody>${body}</tbody></table></div>${finPager('ar',page)}</div>`;
}
function openPaymentRequestFromPo(poId) {
  if (!checkAdminAction()) return;
  const p = financeVisiblePoList().find(x => x.id === poId);
  if (!p) { showToast('구매발주서를 찾을 수 없습니다.', 'error'); return; }
  if (!canViewRecord(p, 'po')) { showToast('이 발주서에 접근할 권한이 없습니다.', 'error'); return; }
  if (!finPoCountsAsPurchase(p)) { showToast('작성중 발주서는 결제 요청 전에 발송완료 이상으로 변경하세요.', 'info'); return; }
  const total = finPoAmount(p);
  const pay = finPaymentRecord('ap', p.id, total);
  if (pay.done) { showToast('이미 지급 완료된 발주서입니다.', 'info'); return; }
  const req = finPaymentRequestForPo(poId);
  sv('payreq-po-id', poId);
  inp('payreq-source-summary').innerHTML = payreqSourceSummaryHtml(p, pay, total);
  const assignees = financeVisibleWorkers().map(w => `<option value="${esc(w.name)}">${esc(w.dept || '')}${w.position ? ' · ' + esc(w.position) : ''}</option>`).join('');
  if (inp('payreq-assignee-list')) inp('payreq-assignee-list').innerHTML = assignees;
  sv('payreq-id', req?.id || '');
  sv('payreq-date', req?.requestDate || today());
  sv('payreq-due', req?.dueDate || '');
  sv('payreq-amount', req?.amount || pay.remaining || total);
  sv('payreq-assignee', req?.assignee || '');
  sv('payreq-requester', req?.requester || financeCurrentUserName());
  sv('payreq-tax', req?.taxInvoiceStatus || '미확인');
  sv('payreq-note', req?.note || '');
  updatePaymentRequestModalState(req);
  inp('payreq-modal').classList.add('open');
}
function savePaymentRequest(nextApprovalStatus = 'pending') {
  if (!checkAdminAction()) return;
  nextApprovalStatus = nextApprovalStatus === 'draft' ? 'draft' : 'pending';
  const poId = v('payreq-po-id');
  const p = financeVisiblePoList().find(x => x.id === poId);
  if (!p) { showToast('구매발주서를 찾을 수 없습니다.', 'error'); return; }
  const requestDate = v('payreq-date') || today();
  if (!guardFinanceMonth(requestDate)) return;
  const amount = Math.max(0, Number(v('payreq-amount')) || 0);
  if (amount <= 0) { showToast('요청 금액을 입력하세요.', 'error'); return; }
  const list = financePaymentRequests();
  let req = finPaymentRequestForPo(poId);
  const before = req ? _safeJsonClone(req) : null;
  if (before && !requireRecordPermission('edit', before, 'paymentRequest')) return;
  if (before && !payreqIsApprovalEditable(req)) { showToast('작성중 또는 반려 상태의 결제 요청만 수정할 수 있습니다.', 'info'); return; }
  if (!req) {
    req = stampRecordCreate({ id:nextCode('PAY', list), sourceType:'po', poId, status:'요청', approvalStatus:nextApprovalStatus, createdAt:new Date().toISOString() }, 'paymentRequest');
    list.unshift(req);
  } else if (req.status === '반려') {
    req.status = '요청';
  }
  const actor = typeof getCurrentActor === 'function' ? getCurrentActor() : {};
  Object.assign(req, {
    requestDate, dueDate:v('payreq-due'), amount,
    requester:v('payreq-requester') || financeCurrentUserName(),
    requesterUid: req.requesterUid || actor.userId || '',
    requesterEmail: req.requesterEmail || actor.email || '',
    assignee:v('payreq-assignee'), taxInvoiceStatus:v('payreq-tax') || '미확인',
    supplier:p.supplier || '', itemSummary:finPoItemSummary(p), payMethod:p.payMethod || '현금',
    note:v('payreq-note'), approvalStatus:nextApprovalStatus,
    submittedAt: nextApprovalStatus === 'pending' ? new Date().toISOString() : '',
    approverUid: '', approverName: '', decidedAt: '', decisionNote: '',
    updatedAt:new Date().toISOString()
  });
  stampRecordUpdate(req, before, 'paymentRequest');
  writeAuditLog('paymentRequest', req.id, before ? 'update' : 'create', before, req, {
    summary: nextApprovalStatus === 'draft' ? '결제 요청 작성중 저장' : '결재 요청 전송',
    detail:`${poId} · ${p.supplier || ''} · ${fmtW(amount)}`
  });
  saveStorage('financeData', financeData);
  if (nextApprovalStatus === 'pending' && typeof generateAlert === 'function') {
    generateAlert('info', `결제 요청: ${poId}`, `${req.assignee || '결제 담당자'} · ${p.supplier || ''} · ${fmtW(amount)}`, 'manual');
  }
  closeModal('payreq-modal');
  if (typeof renderPo === 'function') renderPo();
  renderFinance();
  showToast(nextApprovalStatus === 'draft' ? '작성중으로 저장했습니다.' : '결재 요청을 전송했습니다.', 'success');
}
function changePaymentRequestStatus(id, status) {
  if (!checkAdminAction()) return;
  const req = financePaymentRequests().find(r => r.id === id);
  if (!req) return;
  if (!roleFeatureAllowed('status') || !requireRecordPermission('edit', req, 'paymentRequest')) return;
  if (!payreqIsApproved(req)) { showToast('승인된 결제 요청만 지급 상태를 변경할 수 있습니다.', 'info'); return; }
  const before = _safeJsonClone(req);
  req.status = status;
  req.updatedAt = new Date().toISOString();
  stampRecordUpdate(req, before, 'paymentRequest');
  writeAuditLog('paymentRequest', req.id, 'statusChange', before, req, { summary:`결제 요청 상태 변경: ${before.status || ''} → ${status}` });
  payreqSelected.delete(id);
  saveStorage('financeData', financeData);
  renderFinance();
  if (typeof renderPo === 'function') renderPo();
}
function deletePaymentRequest(id) {
  if (!checkAdminAction()) return;
  const req = financePaymentRequests().find(r => r.id === id);
  if (!req) return;
  if (!requireRecordPermission('delete', req, 'paymentRequest')) return;
  confirm_('결제 요청 삭제', `${req.poId} 결제 요청을 삭제하시겠습니까?`, () => {
    financeData.paymentRequests = financePaymentRequests().filter(r => r.id !== id);
    writeAuditLog('paymentRequest', req.id, 'delete', req, null, { summary:'결제 요청 삭제', detail:req.poId });
    payreqSelected.delete(id);
    saveStorage('financeData', financeData);
    renderFinance();
    if (typeof renderPo === 'function') renderPo();
  }, 'btn-danger', 'ti-trash');
}
function payreqIsPaidDone(req) {
  const p = financeVisiblePoList().find(x => x.id === req?.poId);
  const pay = p ? finPaymentRecord('ap', p.id, finPoAmount(p)) : null;
  return !!(pay && pay.done);
}
function payreqPruneSelection(validIds) {
  const valid = new Set(validIds || []);
  payreqSelected.forEach(id => {
    if (!valid.has(id)) payreqSelected.delete(id);
  });
}
function payreqToggleSelected(id, checked) {
  if (!id) return;
  if (checked) payreqSelected.add(id);
  else payreqSelected.delete(id);
  renderFinance();
}
function payreqToggleRow(event, id) {
  const target = event?.target;
  if (target?.closest?.('button,a,input,select,textarea,label')) return;
  payreqToggleSelected(id, !payreqSelected.has(id));
}
function payreqTogglePage(ids, checked) {
  (ids || []).forEach(id => checked ? payreqSelected.add(id) : payreqSelected.delete(id));
  renderFinance();
}
function clearPayreqSelection() {
  payreqSelected.clear();
  renderFinance();
}
function payreqSelectedRows() {
  const ids = new Set(payreqSelected);
  return financePaymentRequests().filter(req => ids.has(req.id) && canViewRecord(req, 'paymentRequest'));
}
function payreqSelectedAuditRefs() {
  return payreqSelectedRows().map(req => ({ entityType:'paymentRequest', entityId:req.id }));
}
function payreqMutableSelectedRows() {
  return payreqSelectedRows().filter(req => !payreqIsPaidDone(req));
}
function payreqPaymentMutableSelectedRows() {
  return payreqSelectedRows().filter(req => payreqIsPaymentActionable(req));
}
function payreqSubmittableSelectedRows() {
  return payreqSelectedRows().filter(payreqCanSubmit);
}
function payreqApprovalPendingSelectedRows() {
  return payreqSelectedRows().filter(payreqCanApproveAction);
}
function selectedPayreqRow() {
  return payreqSelectedRows()[0] || null;
}
function openSelectedPaymentRequestEdit() {
  if (payreqSelected.size !== 1) { showToast('결제 요청 한 건만 선택하세요.', 'info'); return; }
  const req = selectedPayreqRow();
  if (!req || !payreqCanSubmit(req)) { showToast('작성중 또는 반려 상태의 요청만 수정할 수 있습니다.', 'info'); return; }
  openPaymentRequestFromPo(req.poId);
}
function openSelectedPaymentRequestPayment() {
  if (payreqSelected.size !== 1) { showToast('결제 요청 한 건만 선택하세요.', 'info'); return; }
  const req = selectedPayreqRow();
  if (!req) return;
  const p = financeVisiblePoList().find(x => x.id === req.poId);
  if (!p || !payreqIsPaymentActionable(req)) { showToast('승인된 결제 요청만 지급 처리할 수 있습니다.', 'info'); return; }
  openFinancePayment('ap', req.poId);
}
function payreqSubmitSelected() {
  const rows = payreqSubmittableSelectedRows();
  if (!rows.length) { showToast('결재 요청으로 전송할 작성중/반려 건이 없습니다.', 'info'); return; }
  rows.forEach(req => {
    const before = _safeJsonClone(req);
    req.approvalStatus = 'pending';
    req.status = '요청';
    req.submittedAt = new Date().toISOString();
    req.decisionNote = '';
    req.approverUid = '';
    req.approverName = '';
    req.decidedAt = '';
    req.updatedAt = new Date().toISOString();
    stampRecordUpdate(req, before, 'paymentRequest');
    writeAuditLog('paymentRequest', req.id, 'statusChange', before, req, { summary:'결재 요청 전송', source: rows.length > 1 ? 'bulkAction' : 'ui' });
  });
  payreqSelected.clear();
  saveStorage('financeData', financeData);
  renderFinance();
  if (typeof renderPo === 'function') renderPo();
  showToast(`${rows.length}건을 결재 요청으로 전송했습니다.`, 'success');
}
function payreqDecideSelected(nextStatus) {
  const rows = payreqApprovalPendingSelectedRows();
  if (!rows.length) { showToast('승인/반려할 결재대기 건이 없습니다.', 'info'); return; }
  // 결재 승인/반려는 서버 쓰기 계층(financeData = manager 이상)과 동일하게 제한한다.
  // canEditRecord 만으로는 부족 — 요청 작성자 본인(staff)도 통과해 자기 결재를 승인하는
  // 것처럼 보이고, 서버 거부 후 동기화 시점에야 되돌아가 혼란을 준다.
  if (currentRole !== 'admin' && currentRole !== 'manager') { showToast('결재 승인/반려 권한이 없습니다.', 'error'); return; }
  if (rows.some(req => !canEditRecord(req, 'paymentRequest'))) { showToast('결재 권한이 없는 결제 요청이 포함되어 있습니다.', 'error'); return; }
  const approved = nextStatus === 'approved';
  const note = approved ? '' : window.prompt('반려 사유를 입력하세요.', '') ;
  if (!approved && note === null) return;
  const actor = typeof getCurrentActor === 'function' ? getCurrentActor() : {};
  rows.forEach(req => {
    const before = _safeJsonClone(req);
    req.approvalStatus = approved ? 'approved' : 'rejected';
    req.status = approved ? (req.status === '반려' ? '요청' : (req.status || '요청')) : '반려';
    req.approverUid = actor.userId || '';
    req.approverName = actor.name || financeCurrentUserName() || '승인자';
    req.decidedAt = new Date().toISOString();
    req.decisionNote = approved ? (req.decisionNote || '') : String(note || '').trim();
    req.updatedAt = new Date().toISOString();
    if (!Array.isArray(req.approvalHistory)) req.approvalHistory = [];
    req.approvalHistory.push({ status:req.approvalStatus, at:req.decidedAt, by:req.approverName, note:req.decisionNote });
    stampRecordUpdate(req, before, 'paymentRequest');
    writeAuditLog('paymentRequest', req.id, approved ? 'approve' : 'reject', before, req, { summary: approved ? '결제 요청 승인' : '결제 요청 반려', detail:req.decisionNote || req.poId, source: rows.length > 1 ? 'bulkAction' : 'ui' });
  });
  payreqSelected.clear();
  saveStorage('financeData', financeData);
  renderFinance();
  if (typeof renderPo === 'function') renderPo();
  showToast(`${rows.length}건을 ${approved ? '승인' : '반려'}했습니다.`, 'success');
}
function payreqApproveSelected() { payreqDecideSelected('approved'); }
function payreqRejectSelected() { payreqDecideSelected('rejected'); }
function payreqBulkStatus(status) {
  const rows = payreqPaymentMutableSelectedRows();
  if (!rows.length) { showToast('승인되어 지급 진행 가능한 결제 요청이 없습니다.', 'info'); return; }
  if (!checkAdminAction()) return;
  if (rows.some(req => !canEditRecord(req, 'paymentRequest'))) { showToast('상태 변경 권한이 없는 결제 요청이 포함되어 있습니다.', 'error'); return; }
  rows.forEach(req => {
    const before = _safeJsonClone(req);
    req.status = status;
    req.updatedAt = new Date().toISOString();
    stampRecordUpdate(req, before, 'paymentRequest');
    writeAuditLog('paymentRequest', req.id, 'statusChange', before, req, { summary:`결제 요청 일괄 상태 변경: ${status}`, source:'bulkAction' });
  });
  payreqSelected.clear();
  saveStorage('financeData', financeData);
  renderFinance();
  if (typeof renderPo === 'function') renderPo();
  showToast(`${rows.length}건을 ${status} 상태로 변경했습니다.`, 'success');
}
function payreqBulkDelete() {
  const rows = payreqMutableSelectedRows();
  if (!rows.length) { showToast('삭제 가능한 결제 요청이 없습니다.', 'info'); return; }
  if (!checkAdminAction()) return;
  if (rows.some(req => !canDeleteRecord(req, 'paymentRequest'))) { showToast('삭제 권한이 없는 결제 요청이 포함되어 있습니다.', 'error'); return; }
  confirm_('결제 요청 삭제', `선택한 결제 요청 ${rows.length}건을 삭제하시겠습니까?`, () => {
    const ids = new Set(rows.map(req => req.id));
    financeData.paymentRequests = financePaymentRequests().filter(req => !ids.has(req.id));
    rows.forEach(req => writeAuditLog('paymentRequest', req.id, 'delete', req, null, { summary:'결제 요청 일괄 삭제', source:'bulkAction' }));
    payreqSelected.clear();
    saveStorage('financeData', financeData);
    renderFinance();
    if (typeof renderPo === 'function') renderPo();
  }, 'btn-danger', 'ti-trash');
}
function payreqSelectionBarHtml() {
  const selected = payreqSelectedRows();
  const count = selected.length;
  const mutableCount = selected.filter(req => !payreqIsPaidDone(req)).length;
  const paymentCount = payreqPaymentMutableSelectedRows().length;
  const submitCount = payreqSubmittableSelectedRows().length;
  const approveCount = payreqApprovalPendingSelectedRows().length;
  const single = count === 1;
  const singleReq = single ? selected[0] : null;
  const singleMutable = !!(singleReq && payreqCanSubmit(singleReq));
  const canPay = !!(singleReq && payreqIsPaymentActionable(singleReq) && financeVisiblePoList().some(p => p.id === singleReq.poId));
  const auditBtn = (typeof managedAuditButtonHtml === 'function') ? `<button class="btn btn-sm" data-audit-detail-btn onclick="openAuditDetailsForRefs(payreqSelectedAuditRefs())"><i class="ti ti-history"></i>세부사항</button>` : '';
  return `<div class="selection-action-bar payreq-selection-bar" style="display:flex;">
    <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span>
    ${auditBtn}
    <button class="btn btn-sm" onclick="payreqSubmitSelected()" ${submitCount?'':'disabled'}><i class="ti ti-send"></i>결재요청</button>
    <button class="btn btn-sm" data-payreq-action="approve" onclick="payreqApproveSelected()" ${approveCount?'':'disabled'}><i class="ti ti-check"></i>승인</button>
    <button class="btn btn-sm" data-payreq-action="reject" onclick="payreqRejectSelected()" ${approveCount?'':'disabled'}><i class="ti ti-ban"></i>반려</button>
    <button class="btn btn-sm" onclick="payreqBulkStatus('확인')" ${paymentCount?'':'disabled'}><i class="ti ti-check"></i>확인</button>
    <button class="btn btn-sm" onclick="payreqBulkStatus('지급예정')" ${paymentCount?'':'disabled'}><i class="ti ti-calendar-dollar"></i>지급예정</button>
    <button class="btn btn-sm" onclick="openSelectedPaymentRequestPayment()" ${canPay?'':'disabled'} title="${canPay?'선택한 요청 지급 처리':'한 건만 선택하면 지급 처리할 수 있습니다.'}"><i class="ti ti-cash-banknote"></i>지급처리</button>
    <button class="btn btn-sm" onclick="openSelectedPaymentRequestEdit()" ${singleMutable?'':'disabled'} title="${singleMutable?'선택한 요청 수정':'한 건만 선택하면 수정할 수 있습니다.'}"><i class="ti ti-edit"></i>요청 수정</button>
    <button class="btn btn-sm btn-danger" onclick="payreqBulkDelete()" ${mutableCount?'':'disabled'}><i class="ti ti-trash"></i>삭제</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="clearPayreqSelection()"><i class="ti ti-x"></i>해제</button>
  </div>`;
}
function _finPayRequests() {
  const state=finState('payreq'), q=state.query.trim().toLowerCase();
  let list=financePaymentRequests().filter(r => canViewRecord(r,'paymentRequest') && finMatchDate(r.requestDate,state) && finMatchAmount(r.amount,state) && (!state.status || r.status===state.status) &&
    (!q || [r.id,r.poId,r.supplier,r.itemSummary,r.assignee,r.requester,r.note,r.decisionNote,payreqApprovalLabel(r)].join(' ').toLowerCase().includes(q)));
  list=finSort(list,state,r=>r.requestDate,r=>r.amount);
  payreqPruneSelection(list.map(r => r.id));
  const open=list.filter(finPaymentRequestCountsAsOpen);
  const pendingApproval=list.filter(r=>payreqApprovalStatus(r)==='pending');
  const draftApproval=list.filter(r=>payreqApprovalStatus(r)==='draft');
  const amount=open.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const page=finPaged(list,state);
  const pageIds = page.rows.map(r => r.id);
  const pageIdsJson = JSON.stringify(pageIds);
  const allPageSelected = !!pageIds.length && pageIds.every(id => payreqSelected.has(id));
  const body=page.rows.length?page.rows.map(r=>{
    const p=financeVisiblePoList().find(x=>x.id===r.poId);
    const pay=p?finPaymentRecord('ap',p.id,finPoAmount(p)):null;
    const paidDone=!!(pay&&pay.done);
    const checked = payreqSelected.has(r.id);
    const reqIdJson = JSON.stringify(r.id);
    const rowClass = [checked ? 'table-row-selected' : '', payreqApprovalRowClass(r)].filter(Boolean).join(' ');
    return `<tr class="${rowClass}" onclick='payreqToggleRow(event, ${reqIdJson})' style="cursor:pointer;">
      <td class="payreq-check-cell"><input class="payreq-check" type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation()" onchange='payreqToggleSelected(${reqIdJson}, this.checked)'></td>
      <td>${esc(r.requestDate||'—')}<span class="payreq-muted-line">${r.submittedAt ? '요청 ' + esc(r.submittedAt.slice(0,16).replace('T',' ')) : ''}</span></td>
      <td>${esc(r.dueDate||'—')}</td>
      <td><span class="payreq-id-pill">${esc(r.poId)}</span><span class="payreq-muted-line">${esc(r.id)}</span></td>
      <td><div class="payreq-main-cell"><strong>${esc(r.supplier||'—')}</strong><span>${esc(r.itemSummary||'')}</span></div></td>
      <td style="text-align:right;"><span class="payreq-amount">${fmtW(r.amount)}</span></td>
      <td><div class="payreq-main-cell"><strong>${esc(r.assignee||'미지정')}</strong><span>요청 ${esc(r.requester||'')}</span></div></td>
      <td>${finPaymentRequestApprovalBadge(r)}${r.decisionNote?`<span class="payreq-muted-line">${esc(r.decisionNote)}</span>`:''}</td>
      <td>${paidDone?finPaymentRequestStatusBadge('지급완료'):finPaymentRequestStatusBadge(r.status)}</td>
      <td>${esc(r.taxInvoiceStatus||'미확인')}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="10">${empty('결제 요청이 없습니다.')}</td></tr>`;
  return `
    ${finFilterBar('payreq',{placeholder:'발주번호·공급처·담당자 검색',statuses:['요청','확인','지급예정','지급완료','반려']})}
    <div class="metrics payreq-approval-metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-send"></i>진행 요청</div><div class="mc-val" style="color:var(--tx-i);">${open.length}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-checklist"></i>결재대기</div><div class="mc-val" style="color:${pendingApproval.length>0?'var(--tx-w)':'var(--tx-s)'};">${pendingApproval.length}</div><div class="mc-sub">작성중 ${draftApproval.length}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash-banknote"></i>요청 금액</div><div class="mc-val" style="color:#e8590c;">${fmtW(amount)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-check"></i>지급완료</div><div class="mc-val">${financePaymentRequests().filter(r=>canViewRecord(r,'paymentRequest')&&r.status==='지급완료').length}</div></div>
    </div>
    <div class="card payreq-approval-card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-cash-banknote"></i>결제 요청함</span><span class="payreq-approval-subtitle">구매발주서와 연결된 결재 대기 문서</span></div>
      <div class="payreq-approval-table-wrap" style="overflow-x:auto;"><table class="payreq-table" data-no-managed-table><thead><tr><th class="payreq-check-cell"><input class="payreq-check" type="checkbox" ${allPageSelected?'checked':''} ${pageIds.length?'':'disabled'} onclick="event.stopPropagation()" onchange='payreqTogglePage(${pageIdsJson}, this.checked)'></th><th>요청일</th><th>희망지급일</th><th>발주번호</th><th>공급처 / 품목</th><th style="text-align:right;">금액</th><th>담당자</th><th>결재</th><th>지급상태</th><th>세금계산서</th></tr></thead><tbody>${body}</tbody></table></div>${finPager('payreq',page)}</div>`;
}

/* ── 제품별 제조원가 ── */
function toggleFinCostDetail(productId) {
  finCostDetailProductId = finCostDetailProductId === productId ? '' : productId;
  renderFinance();
}

function finCostDetailHtml(productId) {
  if (!productId) return '';
  const product = financeVisibleProducts().find(item => item.id === productId);
  if (!product) return '';
  const lines = typeof bomFor === 'function' ? bomFor(productId) : [];
  const unitCost = prodUnitCost(product);
  const price = Number(product.price) || 0;
  const margin = price - unitCost;
  const marginRate = price > 0 ? Math.round(margin / price * 1000) / 10 : 0;
  const rows = lines.length ? lines.map(line => {
    const qty = Number(line.qtyPer) || 0;
    const unitPrice = typeof bomLineUnitCost === 'function' ? bomLineUnitCost(line) : (Number(line.unitPrice) || 0);
    const amount = qty * unitPrice;
    const materialName = line.subProductId ? getProductName(line.subProductId) : (line.name || '-');
    return `<tr>
      <td style="font-weight:700;">${esc(materialName)}</td>
      <td>${esc(line.spec || '-')}</td>
      <td style="text-align:right;">${qty.toLocaleString('ko-KR')} ${esc(line.unit || 'EA')}</td>
      <td style="text-align:right;">${fmtW(unitPrice)}</td>
      <td style="text-align:right;font-weight:700;">${fmtW(amount)}</td>
      <td>${esc(line.supplier || '-')}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6">${empty('등록된 BOM 자재가 없습니다.')}</td></tr>`;
  return `<div class="card" style="margin-top:16px;border-color:var(--br-i);">
    <div class="card-hd">
      <span class="card-ttl"><i class="ti ti-list-details"></i>${esc(product.name)} 원가 상세</span>
      <span style="font-size:11px;color:var(--tx-t);">제품 행을 다시 누르면 접힙니다.</span>
    </div>
    <div class="metrics" style="margin-bottom:14px;">
      <div class="mc"><div class="mc-lbl">제조원가</div><div class="mc-val" style="color:#e8590c;">${fmtW(unitCost)}</div></div>
      <div class="mc"><div class="mc-lbl">수주단가</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(price)}</div></div>
      <div class="mc"><div class="mc-lbl">공헌이익</div><div class="mc-val" style="color:${margin>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(margin)}</div><div class="mc-sub">이익률 ${marginRate}%</div></div>
    </div>
    <div style="overflow-x:auto;"><table>
      <thead><tr><th>자재명</th><th>규격</th><th style="text-align:right;">소요량</th><th style="text-align:right;">단가</th><th style="text-align:right;">금액</th><th>공급처</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function _finCost() {
  const state=finState('cost'), query=state.query.trim().toLowerCase();
  let list=financeVisibleProducts().filter(p=>finMatchAmount(prodUnitCost(p),state) && (!query || [p.id,p.name,getClientName(p.clientId)].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,()=>'',p=>prodUnitCost(p));
  const allList=list, page=finPaged(list,state);
  let tCost=0, tRev=0, tMargin=0;
  allList.forEach(p=>{ const unitCost=prodUnitCost(p), price=Number(p.price)||0, qty=Number(p.qty)||0; tCost+=unitCost*qty; tRev+=price*qty; tMargin+=(price-unitCost)*qty; });
  const body = page.rows.length ? page.rows.map(p => {
    const materialCost = typeof prodMaterialCost === 'function' ? prodMaterialCost(p) : (Number(p.matCost) || 0);
    const unitCost = prodUnitCost(p);
    const price = Number(p.price)||0;
    const qty = Number(p.qty)||0;
    const margin = price - unitCost;
    const rate = price>0 ? Math.round(unitCost/price*1000)/10 : 0;
    return `
    <tr data-product-id="${esc(p.id)}" onclick="toggleFinCostDetail(this.dataset.productId)" style="cursor:pointer;${finCostDetailProductId===p.id?'outline:2px solid var(--br-i);':''}">
      <td style="font-weight:700;">${esc(p.id)}</td>
      <td style="font-weight:700;">${esc(p.name)}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${esc(getClientName(p.clientId))}</span></td>
      <td style="text-align:right;">${fmtW(materialCost)}</td>
      <td style="text-align:right;">${fmtW(p.laborCost||0)}</td>
      <td style="text-align:right;">${fmtW(p.ovhCost||0)}</td>
      <td style="text-align:right;font-weight:700;">${fmtW(unitCost)}</td>
      <td style="text-align:right;color:var(--tx-i);">${fmtW(price)}</td>
      <td style="text-align:right;"><span class="bd ${rate>90?'bd-err':rate>75?'bd-warn':'bd-ok'}">${rate}%</span></td>
      <td style="text-align:right;font-weight:700;color:${margin>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(margin)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="9">${empty('등록된 제품이 없습니다.')}</td></tr>`;
  const totRate = tRev>0 ? Math.round(tCost/tRev*1000)/10 : 0;
  return `
    ${finFilterBar('cost',{noDate:true,placeholder:'제품·코드·고객사 검색'})}
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-coin" style="color:var(--tx-i);"></i>수주 합계 (수량 반영)</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(tRev)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calculator" style="color:#e8590c;"></i>제조원가 합계</div><div class="mc-val" style="color:#e8590c;">${fmtW(tCost)}</div><div class="mc-sub">평균 원가율 ${totRate}%</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-report-money" style="color:var(--tx-ok);"></i>공헌이익 합계</div><div class="mc-val" style="color:${tMargin>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(tMargin)}</div></div>
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-calculator"></i>제품별 제조원가 / 공헌이익</span>
        <span style="font-size:11px;color:var(--tx-t);">단가 = 단위당 금액 · 합계는 수량 반영</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>코드</th><th>제품 / 고객사</th><th style="text-align:right;">재료비</th><th style="text-align:right;">노무비</th><th style="text-align:right;">경비</th><th style="text-align:right;">제조원가</th><th style="text-align:right;">수주단가</th><th style="text-align:right;">원가율</th><th style="text-align:right;">공헌이익</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('cost',page)}
    </div>
    ${finCostDetailHtml(finCostDetailProductId)}`;
}

function _finPnl() {
  const rows = finMonthList(finPnlMonths).map(m => {
    const revenue = finRevenueMonth(m.ym);
    const purchase = finPurchaseMonth(m.ym);
    const payroll = finPayrollMonthly(m.ym);
    const fixedCost = fixedCostExpenseMonth(m.ym);
    const income = finEntryMonth(m.ym, '수입');
    const expense = finEntryMonth(m.ym, '비용');
    const net = revenue - purchase - payroll - fixedCost - expense + income;
    return { ym:m.ym, revenue, purchase, payroll, fixedCost, income, expense, net };
  });
  const totals = rows.reduce((acc, r) => {
    acc.revenue += r.revenue; acc.purchase += r.purchase; acc.payroll += r.payroll;
    acc.fixedCost += r.fixedCost;
    acc.income += r.income; acc.expense += r.expense; acc.net += r.net;
    return acc;
  }, { revenue:0, purchase:0, payroll:0, fixedCost:0, income:0, expense:0, net:0 });
  const body = rows.map(r => `<tr>
    <td style="font-weight:700;">${r.ym}</td>
    <td style="text-align:right;color:var(--tx-i);">${fmtW(r.revenue)}</td>
    <td style="text-align:right;color:#e8590c;">${fmtW(r.purchase)}</td>
    <td style="text-align:right;">${fmtW(r.payroll)}</td>
    <td style="text-align:right;color:#e8590c;">${fmtW(r.fixedCost)}</td>
    <td style="text-align:right;color:var(--tx-i);">${fmtW(r.income)}</td>
    <td style="text-align:right;color:#e8590c;">${fmtW(r.expense)}</td>
    <td style="text-align:right;font-weight:800;color:${r.net>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(r.net)}</td>
  </tr>`).join('');
  return `
    <div class="toolbar" style="margin-bottom:12px;">
      <span style="font-size:11px;font-weight:700;color:var(--tx-s);">조회 개월</span>
      ${[3,6,12,24].map(n=>`<button class="btn btn-sm ${finPnlMonths===n?'btn-primary':''}" onclick="finPnlMonths=${n};renderFinance()">${n}개월</button>`).join('')}
      <button class="btn btn-sm" onclick="exportPnlXLS()"><i class="ti ti-file-spreadsheet"></i>엑셀</button>
    </div>
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-up"></i>매출 합계</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(totals.revenue)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-down"></i>매입/비용 합계</div><div class="mc-val" style="color:#e8590c;">${fmtW(totals.purchase + totals.fixedCost + totals.expense)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-repeat"></i>고정비 합계</div><div class="mc-val" style="color:#e8590c;">${fmtW(totals.fixedCost)}</div><div class="mc-sub">발생 기준</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-report-money"></i>순이익</div><div class="mc-val" style="color:${totals.net>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(totals.net)}</div></div>
    </div>
    <div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-report-money"></i>월별 손익</span></div>
      <div style="overflow-x:auto;"><table><thead><tr><th>월</th><th style="text-align:right;">매출</th><th style="text-align:right;">매입</th><th style="text-align:right;">인건비</th><th style="text-align:right;">고정비(발생)</th><th style="text-align:right;">기타수입</th><th style="text-align:right;">기타비용</th><th style="text-align:right;">순이익</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function openFinanceAdd() {
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('finance', '기타 수입/비용 등록')) return;
  sv('fin-type', '비용');
  sv('fin-date', today());
  sv('fin-cat', '기타');
  sv('fin-amount', '');
  sv('fin-title', '');
  sv('fin-note', '');
  inp('finance-modal').classList.add('open');
}
function saveFinanceEntry() {
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('finance', '기타 수입/비용 등록')) return;
  const date = v('fin-date') || today();
  if (!guardFinanceMonth(date)) return;
  const amount = Math.max(0, Number(v('fin-amount')) || 0);
  const title = v('fin-title').trim();
  if (!title) { showToast('내용을 입력하세요.', 'error'); return; }
  if (amount <= 0) { showToast('금액을 입력하세요.', 'error'); return; }
  const entry = {
    id: nextCode('FE', financeData.entries || []),
    type: v('fin-type') || '비용',
    date,
    category: v('fin-cat') || '기타',
    amount,
    title,
    note: v('fin-note') || '',
    createdAt: new Date().toISOString()
  };
  stampRecordCreate(entry, 'financeEntry');
  financeData.entries.unshift(entry);
  writeAuditLog('financeEntry', entry.id, 'create', null, entry, { summary:'기타 수입/비용 등록', detail:`${entry.type} · ${entry.category} · ${fmtW(entry.amount)}` });
  saveStorage('financeData', financeData);
  closeModal('finance-modal');
  renderFinance();
  showToast('기타 수입/비용 항목이 등록되었습니다.', 'success');
}
function deleteFinanceEntry(id) {
  if (!checkAdminAction()) return;
  const item = financeData.entries.find(e => e.id === id);
  if (!item) return;
  if (!requireRecordPermission('delete', item, 'financeEntry')) return;
  if (!guardFinanceMonth(item.date)) return;
  confirm_('기타 항목 삭제', `${item.title} 항목을 삭제하시겠습니까?`, () => {
    financeData.entries = financeData.entries.filter(e => e.id !== id);
    writeAuditLog('financeEntry', id, 'delete', item, null, { summary:'기타 수입/비용 삭제' });
    etcSelected.delete(id);
    saveStorage('financeData', financeData);
    renderFinance();
  }, 'btn-danger', 'ti-trash');
}
function etcPruneSelection(validIds) {
  const valid = new Set(validIds || []);
  etcSelected.forEach(id => {
    if (!valid.has(id)) etcSelected.delete(id);
  });
}
function etcToggleSelected(id, checked) {
  if (!id) return;
  if (checked) etcSelected.add(id);
  else etcSelected.delete(id);
  renderFinance();
}
function etcToggleRow(event, id) {
  const target = event?.target;
  if (target?.closest?.('button,a,input,select,textarea,label')) return;
  etcToggleSelected(id, !etcSelected.has(id));
}
function etcTogglePage(ids, checked) {
  (ids || []).forEach(id => checked ? etcSelected.add(id) : etcSelected.delete(id));
  renderFinance();
}
function clearEtcSelection() {
  etcSelected.clear();
  renderFinance();
}
function etcSelectedRows() {
  const ids = new Set(etcSelected);
  return (financeData.entries || []).filter(entry => ids.has(entry.id) && canViewRecord(entry, 'financeEntry'));
}
function etcSelectedAuditRefs() {
  return etcSelectedRows().map(row => ({ entityType:'financeEntry', entityId:row.id }));
}
function etcBulkDelete() {
  const rows = etcSelectedRows();
  if (!rows.length) { showToast('선택된 기타 항목이 없습니다.', 'info'); return; }
  if (!checkAdminAction()) return;
  if (rows.some(row => !canDeleteRecord(row, 'financeEntry'))) { showToast('삭제 권한이 없는 기타 항목이 포함되어 있습니다.', 'error'); return; }
  const locked = rows.find(row => row.date && isFinanceMonthClosed(row.date.slice(0,7)));
  if (locked) { showToast(`${monthLabel(locked.date.slice(0,7))}은 마감되어 삭제할 수 없습니다.`, 'error'); return; }
  confirm_('기타 항목 삭제', `선택한 기타 수입/비용 ${rows.length}건을 삭제하시겠습니까?`, () => {
    const ids = new Set(rows.map(row => row.id));
    financeData.entries = (financeData.entries || []).filter(entry => !ids.has(entry.id));
    rows.forEach(row => writeAuditLog('financeEntry', row.id, 'delete', row, null, { summary:'기타 수입/비용 일괄 삭제', source:'bulkAction' }));
    etcSelected.clear();
    saveStorage('financeData', financeData);
    renderFinance();
  }, 'btn-danger', 'ti-trash');
}
function etcSelectionBarHtml() {
  const count = etcSelectedRows().length;
  const auditBtn = (typeof managedAuditButtonHtml === 'function') ? `<button class="btn btn-sm" data-audit-detail-btn onclick="openAuditDetailsForRefs(etcSelectedAuditRefs())"><i class="ti ti-history"></i>세부사항</button>` : '';
  return `<div class="selection-action-bar etc-selection-bar" style="display:flex;">
    <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span>
    ${auditBtn}
    <button class="btn btn-sm btn-danger" onclick="etcBulkDelete()" ${count?'':'disabled'}><i class="ti ti-trash"></i>삭제</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="clearEtcSelection()"><i class="ti ti-x"></i>해제</button>
  </div>`;
}

function _finFixedCost() {
  const state = finState('fixed');
  let list = financeFilteredRows('fixed');
  list = finSort(list, state, row => row.dueDate, row => row.amount);
  const activeItems = (typeof visibleRecords === 'function' ? visibleRecords(fixedCostItems(), 'fixedCost') : fixedCostItems()).filter(item => item.active !== false);
  const monthRows = fixedCostRows(fixedCostMonth, false);
  const monthTotal = monthRows.filter(row => row.status !== '보류').reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const paidTotal = monthRows.filter(row => row.status === '지급완료').reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const requestTotal = monthRows.filter(row => row.status === '결제요청').reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  fixedCostPruneSelection(list.map(row => row.itemId));
  const page = finPaged(list, state);
  const pageIds = page.rows.map(row => row.itemId);
  const pageIdsJson = JSON.stringify(pageIds);
  const allPageSelected = !!pageIds.length && pageIds.every(id => fixedCostSelected.has(id));
  const body = page.rows.length ? page.rows.map(row => {
    const inactive = row.active ? '' : '<span class="bd bd-neu" style="margin-left:6px;">미사용</span>';
    const payInfo = row.status === '지급완료'
      ? `${esc(row.paidDate || '지급일 미입력')} · ${esc(row.method || '계좌이체')}`
      : esc(row.method || '계좌이체');
    const noteTitle = esc(row.note || '');
    const checked = fixedCostSelected.has(row.itemId);
    const itemIdJson = JSON.stringify(row.itemId);
    return `<tr class="${checked?'fixed-cost-selected-row':''}" onclick='fixedCostToggleRow(event, ${itemIdJson})'>
      <td class="fixed-cost-check-cell"><input class="fixed-cost-check" type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation()" onchange='fixedCostToggleSelected(${itemIdJson}, this.checked)'></td>
      <td style="font-weight:800;">${esc(row.name)}${inactive}<div style="font-size:10px;color:var(--tx-t);font-weight:600;">${esc(row.itemId)}</div></td>
      <td>${esc(row.category || '기타')}</td>
      <td>${esc(row.vendor || '—')}</td>
      <td>${esc(row.dueDate || '—')}</td>
      <td style="text-align:right;font-weight:800;color:#e8590c;">${fmtW(row.amount)}</td>
      <td>${fixedCostStatusBadge(row.status)}</td>
      <td>${payInfo}</td>
      <td class="fixed-cost-month-note" title="${noteTitle}">${row.note ? esc(row.note) : '—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="9">${empty('등록된 고정비 항목이 없습니다.')}</td></tr>`;
  return `
    <div id="fixed-cost-top-action-row">${fixedCostSelected.size ? fixedCostSelectionBarHtml() : fixedCostMonthToolbarHtml()}</div>
    ${finFilterBar('fixed',{noDate:true,placeholder:'항목·분류·지급처 검색',statuses:['예정','결제요청','지급완료','보류']})}
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-repeat"></i>사용 중 항목</div><div class="mc-val">${activeItems.length}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calendar-dollar"></i>${monthLabel(fixedCostMonth)} 고정비</div><div class="mc-val" style="color:#e8590c;">${fmtW(monthTotal)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-check"></i>지급완료</div><div class="mc-val" style="color:var(--tx-ok);">${fmtW(paidTotal)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-send"></i>결제요청</div><div class="mc-val" style="color:var(--tx-w);">${fmtW(requestTotal)}</div></div>
    </div>
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-repeat"></i>${monthLabel(fixedCostMonth)} 월 고정비</span>
        <span style="font-size:13px;">월 합계 <b style="color:#e8590c;">${fmtW(monthTotal)}</b></span>
      </div>
      <div style="overflow-x:auto;"><table class="fixed-cost-month-table" data-no-managed-table>
        <thead><tr><th class="fixed-cost-check-cell"><input class="fixed-cost-check" type="checkbox" ${allPageSelected?'checked':''} ${pageIds.length?'':'disabled'} onclick="event.stopPropagation()" onchange='fixedCostTogglePage(${pageIdsJson}, this.checked)'></th><th>항목</th><th>분류</th><th>지급처</th><th>예정일</th><th style="text-align:right;">금액</th><th>상태</th><th>지급/결제</th><th>비고</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('fixed',page)}
    </div>`;
}

function _finEtc() {
  const state=finState('etc'), query=state.query.trim().toLowerCase();
  let list=financeVisibleEntries().filter(e=>finMatchDate(e.date,state)&&finMatchAmount(e.amount,state)&&(!state.status||e.type===state.status)&&
    (!query||[e.id,e.category,e.title,e.note].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,e=>e.date,e=>e.amount);
  etcPruneSelection(list.map(e => e.id));
  const income=list.filter(e=>e.type==='수입').reduce((s,e)=>s+(Number(e.amount)||0),0);
  const expense=list.filter(e=>e.type==='비용').reduce((s,e)=>s+(Number(e.amount)||0),0);
  const page=finPaged(list,state);
  const pageIds = page.rows.map(e => e.id);
  const pageIdsJson = JSON.stringify(pageIds);
  const allPageSelected = !!pageIds.length && pageIds.every(id => etcSelected.has(id));
  const body=page.rows.length?page.rows.map(e=>{
    const checked = etcSelected.has(e.id);
    const idJson = JSON.stringify(e.id);
    return `<tr class="${checked?'table-row-selected':''}" onclick='etcToggleRow(event, ${idJson})' style="cursor:pointer;">
    <td class="finance-select-cell"><input class="finance-select-check" type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation()" onchange='etcToggleSelected(${idJson}, this.checked)'></td>
    <td>${esc(e.date)||'—'}</td><td>${statusBadge(e.type)}</td><td>${esc(e.category)||'기타'}</td>
    <td style="font-weight:700;">${esc(e.title)}</td>
    <td style="text-align:right;font-weight:700;color:${e.type==='수입'?'var(--tx-i)':'#e8590c'};">${fmtW(e.amount)}</td>
    <td>${esc(e.note||'—')}</td>
  </tr>`;
  }).join(''):`<tr><td colspan="7">${empty('기타 수입/비용 항목이 없습니다.')}</td></tr>`;
  return `
    ${finFilterBar('etc',{placeholder:'분류·내용·비고 검색',statuses:['수입','비용']})}
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-plus"></i>기타 수입</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(income)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-minus"></i>기타 비용</div><div class="mc-val" style="color:#e8590c;">${fmtW(expense)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-report"></i>순액</div><div class="mc-val" style="color:${income-expense>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(income-expense)}</div></div>
    </div>
    <div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-list-details"></i>기타 수입/비용</span></div>
      <div style="overflow-x:auto;"><table class="finance-etc-table" data-no-managed-table><thead><tr><th class="finance-select-cell"><input class="finance-select-check" type="checkbox" ${allPageSelected?'checked':''} ${pageIds.length?'':'disabled'} onclick="event.stopPropagation()" onchange='etcTogglePage(${pageIdsJson}, this.checked)'></th><th>일자</th><th>구분</th><th>분류</th><th>내용</th><th style="text-align:right;">금액</th><th>비고</th></tr></thead><tbody>${body}</tbody></table></div>${finPager('etc',page)}</div>`;
}

/* ── 급여 명세 (4대보험·원천징수·실지급액) ──
   아래 요율과 소득세 계산은 작성 보조용 초깃값입니다.
   실제 신고 자료를 확인한 뒤 월별 급여 편집 화면에서 공제액을 확정합니다. */
const PAYROLL_RATES = {
  pension:  0.045,    // 국민연금
  health:   0.03545,  // 건강보험
  ltcOfHealth: 0.1295,// 장기요양 (건강보험료 대비)
  employ:   0.009     // 고용보험
};
let payrollMonth = today().slice(0,7);

function payrollSettings() {
  return Object.assign({
    monthlyHours:209, dailyHours:8, overtimeMultiplier:1.5, holidayMultiplier:1.5,
    autoOvertime:true, autoAbsence:true, payDay:25
  }, financeData.payrollSettings || {});
}
function payrollRecord(workerId, ym=payrollMonth) {
  return payrollRecords.find(record => record.workerId === workerId && record.month === ym) || null;
}

function payrollAttendance(workerId, ym=payrollMonth) {
  if (typeof attendanceSummary === 'function') {
    return attendanceSummary(workerId, ym, payrollSettings().dailyHours);
  }
  return { workDays:0, absentDays:0, overtimeMinutes:0, holidayMinutes:0 };
}
/* 간이세액표(1인) 근사 — 월 급여 구간별 소득세 추정. 사이값은 선형 보간. */
const _INCOME_TAX_TABLE = [
  [1500000,0],[2000000,19520],[2500000,41630],[3000000,74350],
  [3500000,127220],[4000000,189920],[4500000,265470],[5000000,350470],
  [6000000,567220],[8000000,1170000]
];
function estIncomeTax(gross){
  const t = _INCOME_TAX_TABLE;
  if (gross <= t[0][0]) return 0;
  for (let i=1;i<t.length;i++){
    if (gross <= t[i][0]){
      const [g0,v0]=t[i-1],[g1,v1]=t[i];
      return Math.round((v0+(v1-v0)*(gross-g0)/(g1-g0))/10)*10;
    }
  }
  // 표 상한 초과: 한계세율 35% 근사 적용
  const [gl,vl]=t[t.length-1];
  return Math.round((vl+(gross-gl)*0.35)/10)*10;
}
function calcPayroll(w, ym=payrollMonth){
  const saved = payrollRecord(w.id, ym) || {};
  const settings=payrollSettings(), att=payrollAttendance(w.id,ym);
  const base = saved.base != null ? Number(saved.base) : (Number(w.salary)||0);
  const fixedAllowance = saved.fixedAllowance != null ? Number(saved.fixedAllowance) : (Number(w.fixedAllowance)||0);
  const mealAllowance = saved.mealAllowance != null ? Number(saved.mealAllowance) : (Number(w.mealAllowance)||0);
  const hourlyWage=(base+fixedAllowance)/Math.max(1,Number(settings.monthlyHours)||209);
  const autoOvertime=Math.round(hourlyWage*(att.overtimeMinutes/60)*(Number(settings.overtimeMultiplier)||1.5)/10)*10;
  const autoHoliday=Math.round(hourlyWage*(att.holidayMinutes/60)*(Number(settings.holidayMultiplier)||1.5)/10)*10;
  const overtime = saved.overtime != null ? Number(saved.overtime) : (settings.autoOvertime ? autoOvertime + autoHoliday : 0);
  const bonus = Number(saved.bonus)||0;
  const allowance = Number(saved.allowance)||0;
  const gross = base + fixedAllowance + mealAllowance + overtime + bonus + allowance;
  const taxablePay = Math.max(0,gross-mealAllowance);
  const pension = Math.round(taxablePay*PAYROLL_RATES.pension/10)*10;
  const health  = Math.round(taxablePay*PAYROLL_RATES.health/10)*10;
  const ltc     = Math.round(health*PAYROLL_RATES.ltcOfHealth/10)*10;
  const employ  = Math.round(taxablePay*PAYROLL_RATES.employ/10)*10;
  const incomeTax = estIncomeTax(taxablePay);
  const localTax  = Math.round(incomeTax*0.1/10)*10; // 지방소득세 = 소득세의 10%
  const actual = {
    pension: saved.pension != null ? Number(saved.pension) : pension,
    health: saved.health != null ? Number(saved.health) : health,
    ltc: saved.ltc != null ? Number(saved.ltc) : ltc,
    employ: saved.employ != null ? Number(saved.employ) : employ,
    incomeTax: saved.incomeTax != null ? Number(saved.incomeTax) : incomeTax,
    localTax: saved.localTax != null ? Number(saved.localTax) : localTax
  };
  const autoAbsence=Math.round(hourlyWage*(Number(settings.dailyHours)||8)*att.absentDays/10)*10;
  const absenceDeduction=saved.absenceDeduction != null ? Number(saved.absenceDeduction) : (settings.autoAbsence ? autoAbsence : 0);
  const otherDeduction = Number(saved.otherDeduction)||0;
  const deduction = actual.pension+actual.health+actual.ltc+actual.employ+actual.incomeTax+actual.localTax+absenceDeduction+otherDeduction;
  const net = gross - deduction;
  return {
    base,fixedAllowance,mealAllowance,overtime,bonus,allowance,gross,taxablePay,hourlyWage,autoOvertime,autoHoliday,
    ...actual,absenceDeduction,autoAbsence,otherDeduction,deduction,net,
    payDate:saved.payDate || `${ym}-${String(settings.payDay||25).padStart(2,'0')}`,
    note:saved.note || '',
    confirmed:!!saved.confirmed
  };
}

function _finLabor() {
  const state=finState('labor'), query=state.query.trim().toLowerCase(), closed=isFinanceMonthClosed(payrollMonth);
  let list=financeVisibleWorkers().filter(w=>finMatchAmount(calcPayroll(w,payrollMonth).net,state) && (!query || [w.id,w.name,w.dept,w.position].join(' ').toLowerCase().includes(query)));
  if (state.status) list=list.filter(w=>(calcPayroll(w,payrollMonth).confirmed?'확정':'작성중')===state.status);
  list=finSort(list,state,()=>'',w=>calcPayroll(w,payrollMonth).net);
  const allList=list, page=finPaged(list,state);
  const pageAllSelected = page.rows.length > 0 && page.rows.every(w => payrollSelected.has(w.id));
  let payroll=0, tDed=0, tNet=0;
  allList.forEach(w=>{const p=calcPayroll(w,payrollMonth);payroll+=p.gross;tDed+=p.deduction;tNet+=p.net;});
  const body = page.rows.length ? page.rows.map(w => {
    const p = calcPayroll(w, payrollMonth);
    const att = payrollAttendance(w.id, payrollMonth);
    return `
    <tr class="${payrollSelected.has(w.id)?'table-row-selected':''}" data-worker-id="${esc(w.id)}" onclick="togglePayrollRow(this.dataset.workerId,event)" style="cursor:pointer;">
      <td><input type="checkbox" ${payrollSelected.has(w.id)?'checked':''} onclick="event.stopPropagation()" onchange="togglePayrollSelect(this.closest('tr').dataset.workerId,this.checked)"></td>
      <td style="font-weight:700;">${esc(w.id)}</td>
      <td style="font-weight:700;">${esc(w.name)}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${esc(w.dept)||'—'} · ${esc(w.position)||'—'}</span></td>
      <td style="text-align:center;">${att.workDays}일<span style="font-size:9px;color:var(--tx-t);display:block;">연장 ${fmtHm(att.overtimeMinutes)} · 휴일 ${fmtHm(att.holidayMinutes)}</span></td>
      <td style="text-align:right;">${fmtW(p.base)}</td>
      <td style="text-align:right;">${fmtW(p.fixedAllowance+p.mealAllowance+p.overtime+p.bonus+p.allowance)}</td>
      <td style="text-align:right;font-weight:700;color:var(--tx-i);">${fmtW(p.gross)}</td>
      <td style="text-align:right;font-weight:700;color:var(--tx-d);">${fmtW(p.deduction)}</td>
      <td style="text-align:right;font-weight:700;color:var(--tx-ok);">${fmtW(p.net)}</td>
      <td style="text-align:center;">${p.confirmed?'<span class="bd bd-ok">확정</span>':'<span class="bd bd-warn">작성중</span>'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="10">${empty('조회 조건에 해당하는 직원이 없습니다.')}</td></tr>`;
  return `
    <div id="payroll-top-action-row">${payrollSelected.size ? payrollSelectionBarHtml(closed) : payrollDateToolbarHtml(closed)}</div>
    ${finFilterBar('labor',{noDate:true,placeholder:'사번·성명·부서 검색',statuses:['작성중','확정']})}
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash" style="color:var(--tx-i);"></i>${monthLabel(payrollMonth)} 지급총액</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(payroll)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-minus" style="color:var(--tx-d);"></i>공제 합계</div><div class="mc-val" style="color:var(--tx-d);">${fmtW(tDed)}</div><div class="mc-sub">4대보험 + 원천징수</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-wallet" style="color:var(--tx-ok);"></i>실지급 합계</div><div class="mc-val" style="color:var(--tx-ok);">${fmtW(tNet)}</div></div>
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-cash"></i>${monthLabel(payrollMonth)} 급여대장</span>
        <span style="font-size:11px;color:var(--tx-t);">자동 계산값은 초깃값이며 실제 신고·공제액 확인 후 확정하세요.</span></div>
      <div style="overflow-x:auto;"><table id="finance-payroll-table">
        <thead><tr><th><input type="checkbox" ${pageAllSelected?'checked':''} onchange="togglePayrollPage(this.checked)"></th><th>사번</th><th>성명/소속</th><th style="text-align:center;">근태</th><th style="text-align:right;">기본급</th><th style="text-align:right;">수당·상여</th><th style="text-align:right;">지급계</th><th style="text-align:right;">공제계</th><th style="text-align:right;">실지급액</th><th style="text-align:center;">상태</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('labor',page)}
    </div>`;
}

function togglePayrollSelect(id,checked){ if(checked)payrollSelected.add(id);else payrollSelected.delete(id);refreshPayrollSelectionUi(); }
function togglePayrollPage(checked){
  payrollPageWorkerIdsFromDom().forEach(id=>checked?payrollSelected.add(id):payrollSelected.delete(id));
  refreshPayrollSelectionUi();
}
function clearPayrollSelection(){payrollSelected.clear();refreshPayrollSelectionUi();}
function bulkConfirmPayroll(confirmed){
  if(isFinanceMonthClosed(payrollMonth)){showToast('마감된 월은 변경할 수 없습니다.','error');return;}
  if(!payrollSelected.size){showToast('직원을 선택하세요.','info');return;}
  const action = confirmed ? '확정' : '작성중 전환';
  confirm_(`급여 일괄 ${action}`, `${monthLabel(payrollMonth)} 급여 ${payrollSelected.size}명을 ${action}하시겠습니까?<br><span style="font-size:11px;color:var(--tx-t);">선택된 직원의 현재 계산값과 수정값이 급여대장에 저장됩니다.</span>`, ()=>{
    payrollSelected.forEach(workerId=>{
      const worker=workers.find(w=>w.id===workerId); if(!worker)return;
      const calculated=calcPayroll(worker,payrollMonth), current=payrollRecord(workerId,payrollMonth)||{};
      const record=Object.assign({},calculated,current,{workerId,month:payrollMonth,confirmed,updatedAt:new Date().toISOString()});
      const index=payrollRecords.findIndex(x=>x.workerId===workerId&&x.month===payrollMonth);
      if(index>=0)payrollRecords[index]=record;else payrollRecords.push(record);
    });
    finAudit(`급여 일괄 ${action}`,`${payrollMonth} · ${payrollSelected.size}명`);
    saveStorage('payrollRecords',payrollRecords);saveStorage('financeData',financeData);renderFinance();
    showToast(`급여 ${payrollSelected.size}명을 ${action}했습니다.`,'success');
  }, 'btn-primary', 'ti-checks');
}
function bulkSavePayrollDrive(){
  if(!payrollSelected.size){showToast('직원을 선택하세요.','info');return;}
  saveDocumentBundleToGoogleDrive('payslip',[...payrollSelected].map(id=>`${id}__${payrollMonth}`));
}

function parsePayrollDocKey(docKey) {
  const [workerId, month] = String(docKey || '').split('__');
  return { workerId, month: month || payrollMonth };
}

function payrollMoneyInput(id, label) {
  return `<div class="ff"><label>${label}</label><input id="${id}" type="number" min="0" step="10" inputmode="numeric" oninput="updatePayrollModalSummary()"></div>`;
}

function ensurePayrollModal() {
  if (inp('payroll-editor')) return;
  const modal = document.createElement('div');
  modal.className = 'overlay';
  modal.id = 'payroll-editor';
  modal.innerHTML = `
    <div class="dlg" style="width:min(820px,96vw);max-width:820px;">
      <div class="dlg-title"><i class="ti ti-cash"></i><span id="payroll-editor-title">급여명세서 작성</span></div>
      <input type="hidden" id="payroll-worker-id">
      <div style="display:grid;gap:14px;">
        <div class="al al-info"><i class="ti ti-info-circle"></i><div><div class="al-t">월별 급여 확정</div><div class="al-s">자동 계산액은 초깃값입니다. 실제 급여대장과 원천징수 자료를 확인한 뒤 공제액을 수정하고 확정하세요.</div></div></div>
        <div>
          <div style="font-size:12px;font-weight:800;margin-bottom:8px;">지급 항목</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
            ${payrollMoneyInput('payroll-base','기본급')}
            ${payrollMoneyInput('payroll-fixed-allowance','고정수당')}
            ${payrollMoneyInput('payroll-meal-allowance','식대·비과세수당')}
            ${payrollMoneyInput('payroll-overtime','연장·휴일근로수당')}
            ${payrollMoneyInput('payroll-bonus','상여금')}
            ${payrollMoneyInput('payroll-allowance','기타수당')}
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
            <div style="font-size:12px;font-weight:800;">공제 항목</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-sm" type="button" onclick="recalcPayrollFromAttendance()"><i class="ti ti-clock"></i>근태 다시 반영</button>
              <button class="btn btn-sm" type="button" onclick="recalcPayrollDeductions()"><i class="ti ti-calculator"></i>공제액 다시 계산</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
            ${payrollMoneyInput('payroll-pension','국민연금')}
            ${payrollMoneyInput('payroll-health','건강보험')}
            ${payrollMoneyInput('payroll-ltc','장기요양')}
            ${payrollMoneyInput('payroll-employ','고용보험')}
            ${payrollMoneyInput('payroll-income-tax','소득세')}
            ${payrollMoneyInput('payroll-local-tax','지방소득세')}
            ${payrollMoneyInput('payroll-absence-deduction','결근·무급휴가 차감')}
            ${payrollMoneyInput('payroll-other-deduction','기타공제')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:10px;">
          <div class="ff"><label>지급일</label><input id="payroll-pay-date" type="date"></div>
          <div class="ff"><label>비고</label><input id="payroll-note" maxlength="200" placeholder="급여 조정 사유 또는 참고사항"></div>
        </div>
        <div id="payroll-modal-summary" class="card" style="padding:12px;"></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;"><input id="payroll-confirmed" type="checkbox">급여명세서 확정</label>
      </div>
      <div class="dlg-actions" style="margin-top:16px;">
        <button class="btn" type="button" onclick="closeModal('payroll-editor')">취소</button>
        <button class="btn btn-primary" type="button" onclick="savePayrollRecord()"><i class="ti ti-device-floppy"></i>저장</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function payrollModalNumber(id) {
  return Math.max(0, Number(v(id)) || 0);
}

function openPayrollSettings() {
  let modal=inp('payroll-settings-modal');
  if(!modal){
    modal=document.createElement('div'); modal.className='overlay'; modal.id='payroll-settings-modal';
    modal.innerHTML=`<div class="dlg" style="width:min(650px,96vw);max-width:650px;">
      <div class="dlg-title"><i class="ti ti-settings"></i>급여 자동 계산 설정</div>
      <div class="fg fg2" style="gap:10px;">
        <div class="ff"><label>월 통상 근로시간</label><input id="ps-monthly-hours" type="number" min="1"></div>
        <div class="ff"><label>1일 기준 근로시간</label><input id="ps-daily-hours" type="number" min="1" step=".5"></div>
        <div class="ff"><label>연장근로 가산 배율</label><input id="ps-overtime-rate" type="number" min="1" step=".1"></div>
        <div class="ff"><label>휴일근로 가산 배율</label><input id="ps-holiday-rate" type="number" min="1" step=".1"></div>
        <div class="ff"><label>급여 지급일</label><input id="ps-pay-day" type="number" min="1" max="28"></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;"><input id="ps-auto-overtime" type="checkbox">근태에서 연장수당 자동 계산</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;"><input id="ps-auto-absence" type="checkbox">결근·무급휴가 자동 차감</label>
      </div>
      <div class="al al-warn" style="margin-top:12px;"><i class="ti ti-alert-triangle"></i><div><div class="al-t">계산 기준 확인 필요</div><div class="al-s">통상임금 포함 항목과 가산 기준은 회사 취업규칙·근로계약에 따라 다를 수 있습니다. 자동 계산 후 담당자가 반드시 확인하세요.</div></div></div>
      <div class="dlg-actions" style="margin-top:16px;"><button class="btn" onclick="closeModal('payroll-settings-modal')">취소</button><button class="btn btn-primary" onclick="savePayrollSettings()"><i class="ti ti-device-floppy"></i>저장</button></div>
    </div>`; document.body.appendChild(modal);
  }
  const s=payrollSettings();
  sv('ps-monthly-hours',s.monthlyHours);sv('ps-daily-hours',s.dailyHours);sv('ps-overtime-rate',s.overtimeMultiplier);
  sv('ps-holiday-rate',s.holidayMultiplier);sv('ps-pay-day',s.payDay);
  inp('ps-auto-overtime').checked=!!s.autoOvertime;inp('ps-auto-absence').checked=!!s.autoAbsence;
  modal.classList.add('open');
}
function savePayrollSettings(){
  financeData.payrollSettings={
    monthlyHours:Math.max(1,Number(v('ps-monthly-hours'))||209),
    dailyHours:Math.max(1,Number(v('ps-daily-hours'))||8),
    overtimeMultiplier:Math.max(1,Number(v('ps-overtime-rate'))||1.5),
    holidayMultiplier:Math.max(1,Number(v('ps-holiday-rate'))||1.5),
    payDay:Math.min(28,Math.max(1,Number(v('ps-pay-day'))||25)),
    autoOvertime:inp('ps-auto-overtime').checked,
    autoAbsence:inp('ps-auto-absence').checked
  };
  finAudit('급여 계산 설정 변경',JSON.stringify(financeData.payrollSettings));
  saveStorage('financeData',financeData);closeModal('payroll-settings-modal');renderFinance();showToast('급여 계산 설정을 저장했습니다.','success');
}

function openPayrollEdit(workerId) {
  const worker = workers.find(item => item.id === workerId);
  if (!worker) { showToast('직원 정보를 찾을 수 없습니다.', 'error'); return; }
  if (isFinanceMonthClosed(payrollMonth)) { showToast(`${monthLabel(payrollMonth)}은 마감되어 수정할 수 없습니다.`,'error'); return; }
  ensurePayrollModal();
  const payroll = calcPayroll(worker, payrollMonth);
  inp('payroll-worker-id').value = workerId;
  inp('payroll-editor-title').textContent = `${worker.name} · ${monthLabel(payrollMonth)} 급여명세서`;
  const values = {
    'payroll-base':payroll.base, 'payroll-overtime':payroll.overtime,
    'payroll-fixed-allowance':payroll.fixedAllowance, 'payroll-meal-allowance':payroll.mealAllowance,
    'payroll-bonus':payroll.bonus, 'payroll-allowance':payroll.allowance,
    'payroll-pension':payroll.pension, 'payroll-health':payroll.health,
    'payroll-ltc':payroll.ltc, 'payroll-employ':payroll.employ,
    'payroll-income-tax':payroll.incomeTax, 'payroll-local-tax':payroll.localTax,
    'payroll-absence-deduction':payroll.absenceDeduction, 'payroll-other-deduction':payroll.otherDeduction
  };
  Object.entries(values).forEach(([id, value]) => { inp(id).value = value; });
  inp('payroll-pay-date').value = payroll.payDate;
  inp('payroll-note').value = payroll.note;
  inp('payroll-confirmed').checked = payroll.confirmed;
  updatePayrollModalSummary();
  inp('payroll-editor').classList.add('open');
}

function payrollModalTotals() {
  const gross = payrollModalNumber('payroll-base') + payrollModalNumber('payroll-fixed-allowance') +
    payrollModalNumber('payroll-meal-allowance') + payrollModalNumber('payroll-overtime') +
    payrollModalNumber('payroll-bonus') + payrollModalNumber('payroll-allowance');
  const deduction = payrollModalNumber('payroll-pension') + payrollModalNumber('payroll-health') +
    payrollModalNumber('payroll-ltc') + payrollModalNumber('payroll-employ') +
    payrollModalNumber('payroll-income-tax') + payrollModalNumber('payroll-local-tax') +
    payrollModalNumber('payroll-absence-deduction') +
    payrollModalNumber('payroll-other-deduction');
  return { gross, deduction, net:gross-deduction };
}

function updatePayrollModalSummary() {
  const body = inp('payroll-modal-summary'); if (!body) return;
  const total = payrollModalTotals();
  body.innerHTML = `<div style="display:flex;gap:18px;align-items:center;justify-content:flex-end;flex-wrap:wrap;font-size:12px;">
    <span>지급계 <b style="color:var(--tx-i);">${fmtW(total.gross)}</b></span>
    <span>공제계 <b style="color:var(--tx-d);">${fmtW(total.deduction)}</b></span>
    <span>실지급액 <b style="color:var(--tx-ok);font-size:16px;">${fmtW(total.net)}</b></span>
  </div>`;
}

function recalcPayrollDeductions() {
  const gross = payrollModalTotals().gross;
  const taxablePay=Math.max(0,gross-payrollModalNumber('payroll-meal-allowance'));
  const pension = Math.round(taxablePay * PAYROLL_RATES.pension / 10) * 10;
  const health = Math.round(taxablePay * PAYROLL_RATES.health / 10) * 10;
  const incomeTax = estIncomeTax(taxablePay);
  const values = {
    'payroll-pension':pension,
    'payroll-health':health,
    'payroll-ltc':Math.round(health * PAYROLL_RATES.ltcOfHealth / 10) * 10,
    'payroll-employ':Math.round(taxablePay * PAYROLL_RATES.employ / 10) * 10,
    'payroll-income-tax':incomeTax,
    'payroll-local-tax':Math.round(incomeTax * .1 / 10) * 10
  };
  Object.entries(values).forEach(([id, value]) => { inp(id).value = value; });
  updatePayrollModalSummary();
}

function recalcPayrollFromAttendance() {
  const worker=workers.find(w=>w.id===v('payroll-worker-id')); if(!worker)return;
  const settings=payrollSettings(), att=payrollAttendance(worker.id,payrollMonth);
  const base=payrollModalNumber('payroll-base'), fixed=payrollModalNumber('payroll-fixed-allowance');
  const hourly=(base+fixed)/Math.max(1,Number(settings.monthlyHours)||209);
  const overtimePay=hourly*(att.overtimeMinutes/60)*(Number(settings.overtimeMultiplier)||1.5);
  const holidayPay=hourly*(att.holidayMinutes/60)*(Number(settings.holidayMultiplier)||1.5);
  inp('payroll-overtime').value=Math.round((overtimePay+holidayPay)/10)*10;
  inp('payroll-absence-deduction').value=Math.round(hourly*(Number(settings.dailyHours)||8)*att.absentDays/10)*10;
  recalcPayrollDeductions();
  showToast(`근태 ${att.workDays}일 · 연장 ${fmtHm(att.overtimeMinutes)} · 휴일 ${fmtHm(att.holidayMinutes)} · 차감 ${att.absentDays}일을 반영했습니다.`,'success');
}

function savePayrollRecord() {
  const workerId = v('payroll-worker-id');
  const record = {
    workerId, month:payrollMonth,
    base:payrollModalNumber('payroll-base'),
    fixedAllowance:payrollModalNumber('payroll-fixed-allowance'),
    mealAllowance:payrollModalNumber('payroll-meal-allowance'),
    overtime:payrollModalNumber('payroll-overtime'),
    bonus:payrollModalNumber('payroll-bonus'),
    allowance:payrollModalNumber('payroll-allowance'),
    pension:payrollModalNumber('payroll-pension'),
    health:payrollModalNumber('payroll-health'),
    ltc:payrollModalNumber('payroll-ltc'),
    employ:payrollModalNumber('payroll-employ'),
    incomeTax:payrollModalNumber('payroll-income-tax'),
    localTax:payrollModalNumber('payroll-local-tax'),
    absenceDeduction:payrollModalNumber('payroll-absence-deduction'),
    otherDeduction:payrollModalNumber('payroll-other-deduction'),
    payDate:v('payroll-pay-date') || `${payrollMonth}-25`,
    note:v('payroll-note').trim(),
    confirmed:inp('payroll-confirmed').checked,
    updatedAt:new Date().toISOString()
  };
  const index = payrollRecords.findIndex(item => item.workerId === workerId && item.month === payrollMonth);
  if (index >= 0) payrollRecords[index] = record;
  else payrollRecords.unshift(record);
  saveStorage('payrollRecords', payrollRecords);
  finAudit('급여명세서 저장',`${workerId} · ${payrollMonth} · ${record.confirmed?'확정':'작성중'}`);
  saveStorage('financeData',financeData);
  closeModal('payroll-editor');
  renderFinance();
  showToast(`${monthLabel(payrollMonth)} 급여명세서를 저장했습니다.`, 'success');
}

function payrollSheetRows(worker, ym) {
  const p = calcPayroll(worker, ym);
  return [
    ['급여명세서', '', `${monthLabel(ym)} 귀속`],
    ['회사명', getCompanyInfo().name || '', '지급일', p.payDate],
    ['사번', worker.id, '성명', worker.name],
    ['부서', worker.dept || '', '직급', worker.position || ''],
    [],
    ['지급 항목', '금액', '공제 항목', '금액'],
    ['기본급', p.base, '국민연금', p.pension],
    ['고정수당', p.fixedAllowance, '건강보험', p.health],
    ['식대·비과세수당', p.mealAllowance, '장기요양', p.ltc],
    ['연장근로수당', p.overtime, '고용보험', p.employ],
    ['상여금', p.bonus, '소득세', p.incomeTax],
    ['기타수당', p.allowance, '지방소득세', p.localTax],
    ['', '', '결근·무급 차감', p.absenceDeduction],
    ['', '', '기타공제', p.otherDeduction],
    ['지급 합계', p.gross, '공제 합계', p.deduction],
    ['실지급액', p.net, '확정 여부', p.confirmed ? '확정' : '작성중'],
    ['비고', p.note]
  ];
}

function exportPayslipXLS(docKey) {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('급여명세서 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') { showToast('엑셀 생성 라이브러리가 준비되지 않았습니다.', 'error'); return; }
  const { workerId, month } = parsePayrollDocKey(docKey);
  const worker = workers.find(item => item.id === workerId);
  if (!worker) { showToast('직원 정보를 찾을 수 없습니다.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(payrollSheetRows(worker, month));
  ws['!cols'] = [{wch:18},{wch:18},{wch:18},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws, '급여명세서');
  XLSX.writeFile(wb, `급여명세서_${worker.name}_${month}.xlsx`);
}

function exportPayrollXLS() {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('급여대장 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') { showToast('엑셀 생성 라이브러리가 준비되지 않았습니다.', 'error'); return; }
  const exportWorkers = financeTab==='labor' ? financeFilteredRows('labor') : workers;
  const rows = exportWorkers.map(worker => {
    const p = calcPayroll(worker, payrollMonth);
    const att = payrollAttendance(worker.id, payrollMonth);
    return [worker.id, worker.name, worker.dept || '', att.workDays, p.base,p.fixedAllowance,p.mealAllowance,p.overtime,p.bonus,p.allowance,
      p.gross, p.pension, p.health, p.ltc, p.employ, p.incomeTax, p.localTax, p.otherDeduction,
      p.absenceDeduction,p.deduction, p.net, p.payDate, p.confirmed ? '확정' : '작성중', p.note];
  });
  const header = ['사번','성명','부서','근무일','기본급','고정수당','식대·비과세수당','연장근로수당','상여금','기타수당','지급계',
    '국민연금','건강보험','장기요양','고용보험','소득세','지방소득세','기타공제','결근·무급 차감','공제계','실지급액','지급일','상태','비고'];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = header.map((_, index) => ({wch:index < 4 ? 12 : 15}));
  XLSX.utils.book_append_sheet(wb, ws, `${payrollMonth} 급여대장`);
  XLSX.writeFile(wb, `급여대장_${payrollMonth}.xlsx`);
}

/* 직원별 급여명세서 인쇄 */
function printPayslip(docKey){
  if (typeof requirePdfAction === 'function' && !requirePdfAction('급여명세서 인쇄')) return;
  const { workerId, month:ym } = parsePayrollDocKey(docKey);
  const w = workers.find(x=>x.id===workerId); if(!w){ showToast('직원 정보를 찾을 수 없습니다.','error'); return; }
  const p = calcPayroll(w, ym);
  const ci = getCompanyInfo();
  const won = n => Number(n||0).toLocaleString('ko-KR');
  const row = (l,v,cls='') => `<tr><th>${l}</th><td class="num ${cls}">${won(v)} 원</td></tr>`;
  const page = `
    <div style="page-break-after:always;">
      <div class="doc-header">
        <div>
          <div class="co-name">${ci.name}</div>
          <div class="co-detail">${ci.address}${ci.tel?' | TEL. '+ci.tel:''}</div>
          ${ci.bizNo?`<div class="co-detail">사업자등록번호: ${ci.bizNo}${ci.ceo?' | 대표이사: '+ci.ceo:''}</div>`:''}
        </div>
        <div><div class="doc-title">급 여 명 세 서</div><div class="doc-no">${ym} 귀속</div></div>
      </div>
      <table class="info-tbl">
        <tr><th>사 번</th><td>${w.id}</td><th>성 명</th><td>${w.name}</td></tr>
        <tr><th>부 서</th><td>${w.dept||'—'}</td><th>직 급</th><td>${w.position||'—'}</td></tr>
        <tr><th>고용형태</th><td>${w.empType||'정규직'}</td><th>지급일</th><td>${p.payDate||'—'}</td></tr>
      </table>
      <div style="display:flex;gap:18px;margin-top:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <div class="sec-title">■ 지급 내역</div>
          <table class="items-tbl">${row('기본급', p.base)}${row('고정수당',p.fixedAllowance)}${row('식대·비과세수당',p.mealAllowance)}${row('연장근로수당', p.overtime)}${row('상여금', p.bonus)}${row('기타수당', p.allowance)}
            <tr class="total-row"><th>지급 합계</th><td class="num">${won(p.gross)} 원</td></tr></table>
        </div>
        <div style="flex:1;min-width:240px;">
          <div class="sec-title">■ 공제 내역</div>
          <table class="items-tbl">
            ${row('국민연금', p.pension)}${row('건강보험', p.health)}${row('장기요양', p.ltc)}${row('고용보험', p.employ)}${row('소득세', p.incomeTax)}${row('지방소득세', p.localTax)}${row('결근·무급휴가 차감',p.absenceDeduction)}${row('기타공제', p.otherDeduction)}
            <tr class="total-row"><th>공제 합계</th><td class="num">${won(p.deduction)} 원</td></tr>
          </table>
        </div>
      </div>
      <div class="sum-wrap"><div class="sum-box">
        <div class="sum-row sum-final"><div class="sum-lbl">실 지급액</div><div class="sum-val">${won(p.net)} 원</div></div>
      </div></div>
      <div class="remarks"><div class="remarks-title">◆ 비고 및 안내</div>
        ${p.note ? esc(p.note) + '<br>' : ''}자동 계산된 보험료와 세액은 작성 보조용 초깃값입니다. 실제 신고 자료와 원천징수 자료를 확인해 확정한 금액을 사용하세요.</div>
    </div>`;
  const win = window.open('', '_blank', 'width=860,height=960');
  win.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>급여명세서_${w.name}_${ym}</title>${_docPrintStyle()}</head><body>${page}</body></html>`);
  win.document.close(); win.print();
}
