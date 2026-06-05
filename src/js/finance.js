/* ════════ 재무 관리 ════════ */
let financeTab = 'dashboard';

/* ── 집계 헬퍼 ── */
function finRevenueTotal()  { return deliveries.reduce((s,d)=>s+(d.price||0)*(d.qty||0),0); }
function finPurchaseTotal() { return poList.reduce((s,p)=>s+(p.unitPrice||0)*(p.qty||0),0); }
function finPayrollMonthly(){ return workers.reduce((s,w)=>s+(Number(w.salary)||0),0); }
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

/* ── 탭 전환 ── */
function switchFinTab(tab) {
  financeTab = tab;
  renderFinance();
}

function renderFinance() {
  const body = inp('finance-body'); if (!body) return;
  document.querySelectorAll('#finance-tabs [data-fintab]').forEach(b =>
    b.classList.toggle('btn-primary', b.dataset.fintab === financeTab));
  const map = {
    dashboard: _finDashboard, revenue: _finRevenue, purchase: _finPurchase,
    cost: _finCost, labor: _finLabor, pnl: _finPnl, ar: _finAR, etc: _finEtc
  };
  body.innerHTML = (map[financeTab] || _finDashboard)();
}

/* ── 재무 현황 대시보드 ── */
function _finDashboard() {
  const rev = finRevenueTotal(), pur = finPurchaseTotal();
  const gross = rev - pur;
  const grossRate = rev > 0 ? Math.round(gross/rev*1000)/10 : 0;
  const payroll = finPayrollMonthly();
  const cm = today().slice(0,7);
  const cmRev = finRevenueMonth(cm), cmPur = finPurchaseMonth(cm);
  const cmInc = finEntryMonth(cm,'수입'), cmExp = finEntryMonth(cm,'비용');
  const cmNet = cmRev - cmPur - payroll - cmExp + cmInc;
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
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-up"></i>누적 매출 (납품 기준)</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(rev)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-trending-down"></i>누적 매입/지출 (발주 기준)</div><div class="mc-val" style="color:#e8590c;">${fmtW(pur)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-report-money"></i>매출총이익</div><div class="mc-val" style="color:${gross>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(gross)}</div><div class="mc-sub">이익률 ${grossRate}%</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash"></i>월 인건비</div><div class="mc-val">${fmtW(payroll)}</div><div class="mc-sub">연 환산 ${fmtW(payroll*12)}</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-calendar-stats"></i>이번 달(${cm}) 손익 요약</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:24px;padding:6px 4px;font-size:13px;">
        <div>매출 <b style="color:var(--tx-i);">${fmtW(cmRev)}</b></div>
        <div>− 매입/지출 <b style="color:#e8590c;">${fmtW(cmPur)}</b></div>
        <div>− 인건비 <b>${fmtW(payroll)}</b></div>
        <div>− 기타비용 <b>${fmtW(cmExp)}</b></div>
        <div>+ 기타수입 <b>${fmtW(cmInc)}</b></div>
        <div style="border-left:2px solid var(--br);padding-left:24px;">순이익 <b style="color:${cmNet>=0?'var(--tx-ok)':'var(--tx-err)'};font-size:15px;">${fmtW(cmNet)}</b></div>
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
    </div>`;
}

/* ── 매출 ── */
function _finRevenue() {
  const list = [...deliveries].sort((a,b)=>(b.deliveredAt||'').localeCompare(a.deliveredAt||''));
  const total = finRevenueTotal();
  const body = list.length ? list.map(d => `
    <tr>
      <td>${d.deliveredAt||'—'}</td>
      <td>${getClientName(d.clientId)}</td>
      <td>${d.productName||getProductName(d.productId)}</td>
      <td>${d.qty}${d.unit||''}</td>
      <td class="amt-blue">${fmtW(d.price||0)}</td>
      <td style="font-weight:700;color:var(--tx-i);">${fmtW((d.price||0)*(d.qty||0))}</td>
    </tr>`).join('') : `<tr><td colspan="6">${empty('납품(매출) 내역이 없습니다.')}</td></tr>`;
  return `
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-trending-up"></i>매출 내역 (납품 기준)</span>
        <span style="font-size:13px;">총 매출 <b style="color:var(--tx-i);">${fmtW(total)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>납품일</th><th>고객사</th><th>제품</th><th>수량</th><th>단가</th><th>매출액</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
}

/* ── 매입/지출 ── */
function _finPurchase() {
  const list = [...poList].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const total = finPurchaseTotal();
  const body = list.length ? list.map(p => `
    <tr>
      <td>${p.date||'—'}</td>
      <td>${p.supplier||'—'}</td>
      <td>${p.itemName||'—'}</td>
      <td>${p.qty}${p.unit||''}</td>
      <td>${fmtW(p.unitPrice||0)}</td>
      <td style="font-weight:700;color:#e8590c;">${fmtW((p.unitPrice||0)*(p.qty||0))}</td>
      <td>${statusBadge(p.status||'작성중')}</td>
    </tr>`).join('') : `<tr><td colspan="7">${empty('구매발주(매입) 내역이 없습니다.')}</td></tr>`;
  return `
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-trending-down"></i>매입/지출 내역 (구매발주 기준)</span>
        <span style="font-size:13px;">총 매입 <b style="color:#e8590c;">${fmtW(total)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>발주일</th><th>공급처</th><th>품목</th><th>수량</th><th>단가</th><th>매입액</th><th>상태</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
}

/* ── 제품별 제조원가 ── */
function _finCost() {
  const list = [...products].sort((a,b)=>(b.price||0)-(a.price||0));
  let tCost=0, tRev=0, tMargin=0;
  const body = list.length ? list.map(p => {
    const unitCost = prodUnitCost(p);
    const price = Number(p.price)||0;
    const qty = Number(p.qty)||0;
    const margin = price - unitCost;
    const rate = price>0 ? Math.round(unitCost/price*1000)/10 : 0;
    tCost += unitCost*qty; tRev += price*qty; tMargin += margin*qty;
    return `
    <tr>
      <td style="font-weight:700;">${p.id}</td>
      <td style="font-weight:700;">${p.name}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${getClientName(p.clientId)}</span></td>
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
      </table></div>
    </div>`;
}

/* ── 급여 명세 (4대보험·원천징수·실지급액) ──
   요율은 2026년 근로자 부담분 기준. 매년 변동되므로 이 상수만 수정하면 됩니다.
   소득세는 간이세액표(공제대상 1인) 근사치이며 실제 원천징수액과 차이가 있을 수 있습니다. */
const PAYROLL_RATES = {
  pension:  0.045,    // 국민연금
  health:   0.03545,  // 건강보험
  ltcOfHealth: 0.1295,// 장기요양 (건강보험료 대비)
  employ:   0.009     // 고용보험
};
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
function calcPayroll(w){
  const gross = Number(w.salary)||0;
  const pension = Math.round(gross*PAYROLL_RATES.pension/10)*10;
  const health  = Math.round(gross*PAYROLL_RATES.health/10)*10;
  const ltc     = Math.round(health*PAYROLL_RATES.ltcOfHealth/10)*10;
  const employ  = Math.round(gross*PAYROLL_RATES.employ/10)*10;
  const incomeTax = estIncomeTax(gross);
  const localTax  = Math.round(incomeTax*0.1/10)*10; // 지방소득세 = 소득세의 10%
  const deduction = pension+health+ltc+employ+incomeTax+localTax;
  const net = gross - deduction;
  return {gross,pension,health,ltc,employ,incomeTax,localTax,deduction,net};
}

function _finLabor() {
  const payroll = finPayrollMonthly();
  let tDed=0, tNet=0;
  const body = workers.length ? workers.map(w => {
    const p = calcPayroll(w); tDed+=p.deduction; tNet+=p.net;
    return `
    <tr>
      <td style="font-weight:700;">${w.id}</td>
      <td style="font-weight:700;">${w.name}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${w.dept||'—'} · ${w.position||'—'}</span></td>
      <td><span class="bd bd-neu">${w.empType||'정규직'}</span></td>
      <td style="text-align:right;font-weight:700;color:var(--tx-i);">${w.salary?fmtW(p.gross):'—'}</td>
      <td style="text-align:right;">${fmtW(p.pension)}</td>
      <td style="text-align:right;">${fmtW(p.health+p.ltc)}</td>
      <td style="text-align:right;">${fmtW(p.employ)}</td>
      <td style="text-align:right;">${fmtW(p.incomeTax+p.localTax)}</td>
      <td style="text-align:right;font-weight:700;color:var(--tx-d);">${fmtW(p.deduction)}</td>
      <td style="text-align:right;font-weight:700;color:var(--tx-ok);">${fmtW(p.net)}</td>
      <td style="text-align:center;"><button class="btn btn-sm" onclick="printPayslip('${w.id}')" title="급여명세서 출력"><i class="ti ti-printer"></i></button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="11">${empty('등록된 직원이 없습니다.')}</td></tr>`;
  return `
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-cash" style="color:var(--tx-i);"></i>월 지급총액</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(payroll)}</div><div class="mc-sub">연 환산 ${fmtW(payroll*12)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-minus" style="color:var(--tx-d);"></i>공제 합계</div><div class="mc-val" style="color:var(--tx-d);">${fmtW(tDed)}</div><div class="mc-sub">4대보험 + 원천징수</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-wallet" style="color:var(--tx-ok);"></i>실지급 합계</div><div class="mc-val" style="color:var(--tx-ok);">${fmtW(tNet)}</div></div>
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-cash"></i>급여 명세 (4대보험·원천징수)</span>
        <span style="font-size:11px;color:var(--tx-t);">소득세는 간이세액표(1인) 추정치 · 요율 2026년 기준</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>사번</th><th>성명/소속</th><th>고용형태</th><th style="text-align:right;">지급총액</th><th style="text-align:right;">국민연금</th><th style="text-align:right;">건강+요양</th><th style="text-align:right;">고용보험</th><th style="text-align:right;">소득세+지방세</th><th style="text-align:right;">공제계</th><th style="text-align:right;">실지급액</th><th style="text-align:center;">명세서</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
}

/* 직원별 급여명세서 인쇄 */
function printPayslip(workerId){
  const w = workers.find(x=>x.id===workerId); if(!w){ showToast('직원 정보를 찾을 수 없습니다.','error'); return; }
  const p = calcPayroll(w);
  const ci = getCompanyInfo();
  const ym = today().slice(0,7);
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
        <tr><th>고용형태</th><td>${w.empType||'정규직'}</td><th>입사일</th><td>${w.hireDate||'—'}</td></tr>
      </table>
      <div style="display:flex;gap:18px;margin-top:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <div class="sec-title">■ 지급 내역</div>
          <table class="items-tbl">${row('기본급(지급총액)', p.gross)}
            <tr class="total-row"><th>지급 합계</th><td class="num">${won(p.gross)} 원</td></tr></table>
        </div>
        <div style="flex:1;min-width:240px;">
          <div class="sec-title">■ 공제 내역</div>
          <table class="items-tbl">
            ${row('국민연금', p.pension)}${row('건강보험', p.health)}${row('장기요양', p.ltc)}${row('고용보험', p.employ)}${row('소득세', p.incomeTax)}${row('지방소득세', p.localTax)}
            <tr class="total-row"><th>공제 합계</th><td class="num">${won(p.deduction)} 원</td></tr>
          </table>
        </div>
      </div>
      <div class="sum-wrap"><div class="sum-box">
        <div class="sum-row sum-final"><div class="sum-lbl">실 지급액</div><div class="sum-val">${won(p.net)} 원</div></div>
      </div></div>
      <div class="remarks"><div class="remarks-title">◆ 안내</div>
        본 명세서의 소득세는 간이세액표(공제대상 1인) 기준 추정치이며, 4대보험 요율은 2026년 근로자 부담분 기준입니다. 실제 원천징수액 및 연말정산 결과에 따라 차이가 발생할 수 있습니다.</div>
    </div>`;
  const win = window.open('', '_blank', 'width=860,height=960');
  win.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>급여명세서_${w.name}_${ym}</title>${_docPrintStyle()}</head><body>${page}</body></html>`);
  win.document.close(); win.print();
}
