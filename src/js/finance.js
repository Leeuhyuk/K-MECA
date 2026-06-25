/* ════════ 재무 관리 ════════ */
let financeTab = 'dashboard';
const financeView = {};
const payrollSelected = new Set();
let finPnlMonths = 6;
let finClosingMonth = today().slice(0,7);
let finInputTimer = null;
let finDashboardRange = 'month';

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
  renderFinance();
}
function finInput(tab,key,value){
  const state=finState(tab);state[key]=value;state.page=1;
  if (tab === 'labor') payrollSelected.clear();
  clearTimeout(finInputTimer);finInputTimer=setTimeout(renderFinance,250);
}
function finQuickRange(tab, preset) {
  const state = finState(tab), now = new Date();
  if (tab === 'labor') payrollSelected.clear();
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
const FIN_DATE_VIEW_TABS = new Set(['ar','revenue','purchase']);
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
  return `<div class="date-view-bar finance-date-view-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px;padding:6px 10px;background:var(--bg-s);border:1px solid var(--br);border-radius:var(--rm);">
    <select onchange="finDateViewModeChange('${tab}',this.value)" style="height:28px;min-width:140px;font-size:11px;">
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
    <button class="btn btn-sm" style="height:28px;padding:0 9px;" onclick="finDateViewReset('${tab}')" title="전체 보기"><i class="ti ti-x"></i></button>
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
  return `${useDateView ? finDateViewBar(tab) : ''}
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
function financeFilteredRows(tab) {
  const s=finState(tab), q=s.query.trim().toLowerCase();
  if(tab==='revenue')return deliveries.filter(d=>finMatchDate(d.deliveredAt,s)&&finMatchAmount((d.price||0)*(d.qty||0),s)&&(!q||[d.id,getClientName(d.clientId),d.productName,getProductName(d.productId)].join(' ').toLowerCase().includes(q)));
  if(tab==='purchase')return poList.filter(p=>finMatchDate(p.date,s)&&finMatchAmount((p.unitPrice||0)*(p.qty||0),s)&&(!s.status||(p.status||'작성중')===s.status)&&(!q||[p.id,p.supplier,p.itemName].join(' ').toLowerCase().includes(q)));
  if(tab==='cost')return products.filter(p=>finMatchAmount(prodUnitCost(p),s)&&(!q||[p.id,p.name,getClientName(p.clientId)].join(' ').toLowerCase().includes(q)));
  if(tab==='labor')return workers.filter(w=>finMatchAmount(calcPayroll(w,payrollMonth).net,s)&&(!s.status||(calcPayroll(w,payrollMonth).confirmed?'확정':'작성중')===s.status)&&(!q||[w.id,w.name,w.dept,w.position].join(' ').toLowerCase().includes(q)));
  if(tab==='etc')return financeData.entries.filter(e=>finMatchDate(e.date,s)&&finMatchAmount(e.amount,s)&&(!s.status||e.type===s.status)&&(!q||[e.id,e.category,e.title,e.note].join(' ').toLowerCase().includes(q)));
  return [];
}
function exportFinanceViewXLS(tab){
  if(typeof XLSX==='undefined'){showToast('엑셀 생성 라이브러리가 준비되지 않았습니다.','error');return;}
  if(tab==='ar'){
    const s=finState('ar'),q=s.query.trim().toLowerCase(),rows=[];
    deliveries.filter(d=>{
      const total=(d.price||0)*(d.qty||0), pay=finPaymentRecord('ar',d.id,total);
      return finMatchDate(d.deliveredAt,s)&&finMatchAmount(total,s)&&(!s.status||pay.status===s.status)&&(!q||[d.id,getClientName(d.clientId),d.productName].join(' ').toLowerCase().includes(q));
    }).forEach(d=>{
      const total=(d.price||0)*(d.qty||0), pay=finPaymentRecord('ar',d.id,total);
      rows.push(['미수금',d.deliveredAt,getClientName(d.clientId),d.productName||getProductName(d.productId),total,pay.amount,pay.remaining,pay.status,pay.date,pay.method,pay.note]);
    });
    poList.filter(p=>{
      const total=(p.unitPrice||0)*(p.qty||0), pay=finPaymentRecord('ap',p.id,total);
      return finMatchDate(p.date,s)&&finMatchAmount(total,s)&&(!s.status||pay.status===s.status)&&(!q||[p.id,p.supplier,p.itemName].join(' ').toLowerCase().includes(q));
    }).forEach(p=>{
      const total=(p.unitPrice||0)*(p.qty||0), pay=finPaymentRecord('ap',p.id,total);
      rows.push(['미지급금',p.date,p.supplier,p.itemName,total,pay.amount,pay.remaining,pay.status,pay.date,pay.method,pay.note]);
    });
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['구분','일자','거래처','품목','총액','처리액','잔액','상태','처리일','방법','메모'],...rows]);XLSX.utils.book_append_sheet(wb,ws,'채권채무');XLSX.writeFile(wb,`미수금_미지급금_${today()}.xlsx`);return;
  }
  const list=financeFilteredRows(tab); let header=[],rows=[];
  if(tab==='revenue'){header=['납품일','고객사','제품','수량','단가','매출액'];rows=list.map(d=>[d.deliveredAt,getClientName(d.clientId),d.productName||getProductName(d.productId),d.qty,d.price,(d.price||0)*(d.qty||0)]);}
  else if(tab==='purchase'){header=['발주일','공급처','품목','수량','단가','매입액','상태'];rows=list.map(p=>[p.date,p.supplier,p.itemName,p.qty,p.unitPrice,(p.unitPrice||0)*(p.qty||0),p.status]);}
  else if(tab==='cost'){header=['코드','제품','고객사','재료비','노무비','경비','제조원가','수주단가'];rows=list.map(p=>[p.id,p.name,getClientName(p.clientId),p.matCost,p.laborCost,p.ovhCost,prodUnitCost(p),p.price]);}
  else if(tab==='labor'){exportPayrollXLS();return;}
  else if(tab==='etc'){header=['일자','구분','분류','내용','금액','비고'];rows=list.map(e=>[e.date,e.type,e.category,e.title,e.amount,e.note]);}
  else {showToast('이 탭은 전용 내보내기를 사용하세요.','info');return;}
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([header,...rows]);XLSX.utils.book_append_sheet(wb,ws,'재무조회');XLSX.writeFile(wb,`재무_${tab}_${today()}.xlsx`);
}
function exportPnlXLS(){
  if(typeof XLSX==='undefined'){showToast('엑셀 생성 라이브러리가 준비되지 않았습니다.','error');return;}
  const rows=finMonthList(finPnlMonths).map(m=>{const r=finRevenueMonth(m.ym),p=finPurchaseMonth(m.ym),l=finPayrollMonthly(m.ym),i=finEntryMonth(m.ym,'수입'),e=finEntryMonth(m.ym,'비용');return[m.ym,r,p,l,i,e,r-p-l-e+i];});
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['월','매출','매입/지출','인건비','기타수입','기타비용','순이익'],...rows]);XLSX.utils.book_append_sheet(wb,ws,'손익');XLSX.writeFile(wb,`손익계산_${finPnlMonths}개월_${today()}.xlsx`);
}
function finAudit(action, detail='') {
  financeData.auditLog.unshift({id:'FA-'+Date.now(),at:new Date().toISOString(),action,detail});
  financeData.auditLog=financeData.auditLog.slice(0,300);
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
function finRevenueTotal()  { return deliveries.reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseTotal() { return poList.reduce((s,p)=>s+(p.unitPrice||0)*(p.qty||0),0); }
function finPayrollMonthly(ym=today().slice(0,7)){
  // 입사일 이후의 달만 인건비에 반영(입사 전 달을 현재 급여로 과대 계상하지 않도록).
  // 단, 해당 달에 저장된 급여기록이 있으면 입사일과 무관하게 그대로 반영.
  return workers.reduce((s,w)=>{
    const hired = !w.hireDate || String(w.hireDate).slice(0,7) <= ym;
    if (!hired && !payrollRecord(w.id, ym)) return s;
    return s + calcPayroll(w,ym).gross;
  },0);
}
function finEntriesSum(type){ return financeData.entries.filter(e=>e.type===type).reduce((s,e)=>s+(Number(e.amount)||0),0); }

function finMonthList(n) {
  const arr = [], base = new Date(today());
  for (let i=n-1; i>=0; i--) {
    const dd = new Date(base.getFullYear(), base.getMonth()-i, 1);
    const ym = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    arr.push({ ym, label: (dd.getMonth()+1)+'월' });
  }
  return arr;
}
function finRevenueMonth(ym)  { return deliveries.filter(d=>(d.deliveredAt||'').slice(0,7)===ym).reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseMonth(ym) { return poList.filter(p=>(p.date||'').slice(0,7)===ym).reduce((s,p)=>s+(p.unitPrice||0)*(p.qty||0),0); }
function finEntryMonth(ym,type){ return financeData.entries.filter(e=>e.type===type && (e.date||'').slice(0,7)===ym).reduce((s,e)=>s+(Number(e.amount)||0),0); }
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
  deliveries.forEach(d => { if (d.deliveredAt) set.add(String(d.deliveredAt).slice(0,7)); });
  poList.forEach(p => { if (p.date) set.add(String(p.date).slice(0,7)); });
  financeData.entries.forEach(e => { if (e.date) set.add(String(e.date).slice(0,7)); });
  payrollRecords.forEach(p => { if (p.month) set.add(p.month); });
  if (!set.size) set.add(today().slice(0,7));
  return [...set].sort();
}
function finRevenueRange(rangeInfo) { return deliveries.filter(d=>finDateInRange(d.deliveredAt, rangeInfo)).reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseRange(rangeInfo) { return poList.filter(p=>finDateInRange(p.date, rangeInfo)).reduce((s,p)=>s+(p.unitPrice||0)*(p.qty||0),0); }
function finEntryRange(rangeInfo,type) { return financeData.entries.filter(e=>e.type===type && finDateInRange(e.date, rangeInfo)).reduce((s,e)=>s+(Number(e.amount)||0),0); }
function finPayrollRange(rangeInfo) { return finRangeMonths(rangeInfo).reduce((sum, ym)=>sum+finPayrollMonthly(ym),0); }

/* ── 탭 전환 ── */
function switchFinTab(tab) {
  financeTab = tab;
  syncCurrentSubRoute('finance', financeTab);
  renderFinance();
}

function updateFinancePrimaryAction() {
  const button = inp('finance-primary-action');
  if (!button) return;
  if (financeTab === 'etc') {
    button.style.display = 'inline-flex';
    button.title = '기타 수입/비용 등록';
    button.innerHTML = '<i class="ti ti-plus"></i>기타 등록';
  } else {
    button.style.display = 'none';
  }
}

function openFinancePrimaryAction() {
  if (financeTab === 'etc') openFinanceAdd();
}

function renderFinance() {
  const body = inp('finance-body'); if (!body) return;
  document.querySelectorAll('#finance-tabs [data-fintab]').forEach(b =>
    b.classList.toggle('btn-primary', b.dataset.fintab === financeTab));
  updateFinancePrimaryAction();
  const map = {
    dashboard: _finDashboard, revenue: _finRevenue, purchase: _finPurchase,
    cost: _finCost, labor: _finLabor, pnl: _finPnl, ar: _finAR, etc: _finEtc
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
  const net = rev - pur - payroll - exp + inc;
  const months = finMonthList(6);
  const maxV = Math.max(1, ...months.map(m => Math.max(finRevenueMonth(m.ym), finPurchaseMonth(m.ym))));

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
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-down"></i>${rangeInfo.label} 매입/지출</div><div class="mc-val" style="color:#e8590c;">${fmtW(pur)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-report-money"></i>매출총이익</div><div class="mc-val" style="color:${gross>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(gross)}</div><div class="mc-sub">이익률 ${grossRate}%</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash"></i>${rangeInfo.label} 인건비</div><div class="mc-val">${fmtW(payroll)}</div><div class="mc-sub">${finRangeMonths(rangeInfo).length}개월 반영</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-calendar-stats"></i>${rangeInfo.label} 손익 요약</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:24px;padding:6px 4px;font-size:13px;">
        <div>매출 <b style="color:var(--tx-i);">${fmtW(rev)}</b></div>
        <div>− 매입/지출 <b style="color:#e8590c;">${fmtW(pur)}</b></div>
        <div>− 인건비 <b>${fmtW(payroll)}</b></div>
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
    <div class="card" style="margin-top:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-history"></i>최근 재무 변경 이력</span><span style="font-size:10px;color:var(--tx-t);">최대 300건 보관</span></div>
      ${(financeData.auditLog||[]).length?`<div style="overflow-x:auto;"><table><thead><tr><th>일시</th><th>작업</th><th>상세</th></tr></thead><tbody>${financeData.auditLog.slice(0,10).map(log=>`<tr><td>${new Date(log.at).toLocaleString('ko-KR')}</td><td style="font-weight:700;">${esc(log.action)}</td><td>${esc(log.detail)}</td></tr>`).join('')}</tbody></table></div>`:empty('아직 재무 변경 이력이 없습니다.')}
    </div>`;
}

/* ── 매출 ── */
function _finRevenue() {
  const state=finState('revenue'), query=state.query.trim().toLowerCase();
  let list=deliveries.filter(d=>finMatchDate(d.deliveredAt,state) && finMatchAmount((d.price||0)*(d.qty||0),state) &&
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
  let list=poList.filter(p=>finMatchDate(p.date,state) && finMatchAmount((p.unitPrice||0)*(p.qty||0),state) && (!state.status || (p.status||'작성중')===state.status) &&
    (!query || [p.id,p.supplier,p.itemName].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,p=>p.date,p=>(p.unitPrice||0)*(p.qty||0));
  const total=list.reduce((sum,p)=>sum+(p.unitPrice||0)*(p.qty||0),0), page=finPaged(list,state);
  const body = page.rows.length ? page.rows.map(p => `
    <tr>
      <td>${esc(p.date)||'—'}</td>
      <td>${esc(p.supplier)||'—'}</td>
      <td>${esc(p.itemName)||'—'}</td>
      <td>${esc(p.qty)}${esc(p.unit)||''}</td>
      <td>${fmtW(p.unitPrice||0)}</td>
      <td style="font-weight:700;color:#e8590c;">${fmtW((p.unitPrice||0)*(p.qty||0))}</td>
      <td>${statusBadge(p.status||'작성중')}</td>
    </tr>`).join('') : `<tr><td colspan="7">${empty('구매발주(매입) 내역이 없습니다.')}</td></tr>`;
  return `
    ${finFilterBar('purchase',{placeholder:'공급처·품목·발주번호 검색',statuses:['작성중','발주완료','입고완료','취소']})}
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-trending-down"></i>매입/지출 내역 (구매발주 기준)</span>
        <span style="font-size:13px;">총 매입 <b style="color:#e8590c;">${fmtW(total)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>발주일</th><th>공급처</th><th>품목</th><th>수량</th><th>단가</th><th>매입액</th><th>상태</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('purchase',page)}
    </div>`;
}

/* ── 제품별 제조원가 ── */
function toggleFinCostDetail(productId) {
  finCostDetailProductId = finCostDetailProductId === productId ? '' : productId;
  renderFinance();
}

function finCostDetailHtml(productId) {
  if (!productId) return '';
  const product = products.find(item => item.id === productId);
  if (!product) return '';
  const lines = typeof bomFor === 'function' ? bomFor(productId) : [];
  const unitCost = prodUnitCost(product);
  const price = Number(product.price) || 0;
  const margin = price - unitCost;
  const marginRate = price > 0 ? Math.round(margin / price * 1000) / 10 : 0;
  const rows = lines.length ? lines.map(line => {
    const qty = Number(line.qtyPer) || 0;
    const unitPrice = Number(line.unitPrice) || 0;
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
  let list=products.filter(p=>finMatchAmount(prodUnitCost(p),state) && (!query || [p.id,p.name,getClientName(p.clientId)].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,()=>'',p=>prodUnitCost(p));
  const allList=list, page=finPaged(list,state);
  let tCost=0, tRev=0, tMargin=0;
  allList.forEach(p=>{ const unitCost=prodUnitCost(p), price=Number(p.price)||0, qty=Number(p.qty)||0; tCost+=unitCost*qty; tRev+=price*qty; tMargin+=(price-unitCost)*qty; });
  const body = page.rows.length ? page.rows.map(p => {
    const unitCost = prodUnitCost(p);
    const price = Number(p.price)||0;
    const qty = Number(p.qty)||0;
    const margin = price - unitCost;
    const rate = price>0 ? Math.round(unitCost/price*1000)/10 : 0;
    return `
    <tr data-product-id="${esc(p.id)}" onclick="toggleFinCostDetail(this.dataset.productId)" style="cursor:pointer;${finCostDetailProductId===p.id?'outline:2px solid var(--br-i);':''}">
      <td style="font-weight:700;">${esc(p.id)}</td>
      <td style="font-weight:700;">${esc(p.name)}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${esc(getClientName(p.clientId))}</span></td>
      <td style="text-align:right;">${fmtW(p.matCost||0)}</td>
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
  let list=workers.filter(w=>finMatchAmount(calcPayroll(w,payrollMonth).net,state) && (!query || [w.id,w.name,w.dept,w.position].join(' ').toLowerCase().includes(query)));
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
