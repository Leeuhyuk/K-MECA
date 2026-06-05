/* ════════ BOM · 자재명세 ════════ */
let editBomId = null;
function bomFor(pid){ return bomList.filter(b=>b.productId===pid); }
/* 라인 단위원가: 반제품(subProductId)이면 하위 BOM 재료비를 롤업, 아니면 단가 */
function bomLineUnitCost(b, seen){ return b.subProductId ? bomMaterialCost(b.subProductId, seen) : (Number(b.unitPrice)||0); }
/* 제품 재료비 — 다단계 BOM 롤업(순환 차단) */
function bomMaterialCost(pid, seen){
  seen = seen || new Set();
  if (seen.has(pid)) return 0;        // 순환 참조 방지
  seen.add(pid);
  const cost = bomFor(pid).reduce((s,b)=> s + (Number(b.qtyPer)||0)*bomLineUnitCost(b, seen), 0);
  seen.delete(pid);
  return cost;
}
function getProductMargin(productId) {
  const p = products.find(function(x) { return x.id === productId; });
  const cost = bomMaterialCost(productId);
  const price = p ? (Number(p.price) || 0) : 0;
  const margin = price - cost;
  const marginRate = price > 0 ? Math.round(margin / price * 1000) / 10 : null;
  return { cost: cost, price: price, margin: margin, marginRate: marginRate };
}
/* 원자재(구매 leaf) 전개 — 반제품은 하위로 펼쳐 구매 품목 수량을 자재명 기준 합산 */
function explodeBomLeaves(pid, mult, seen, acc){
  seen = seen || new Set(); acc = acc || {};
  if (seen.has(pid)) return acc;
  seen.add(pid);
  bomFor(pid).forEach(b=>{
    const q = (Number(b.qtyPer)||0)*mult;
    if (b.subProductId){
      explodeBomLeaves(b.subProductId, q, seen, acc);
    } else {
      const key = (b.name||'').trim().toLowerCase();
      if (!acc[key]) acc[key] = {name:b.name, spec:b.spec||'', unit:b.unit||'EA', unitPrice:Number(b.unitPrice)||0, supplier:b.supplier||'', qty:0};
      acc[key].qty += q;
    }
  });
  seen.delete(pid);
  return acc;
}
function bomProductName(pid){ return products.find(p=>p.id===pid)?.name || pid; }
/* 재고에서 동일 자재명의 현재고 조회(이름 매칭, 없으면 0) */
function invStockByName(name){
  const it = inventory.find(i=>(i.name||'').trim().toLowerCase()===(name||'').trim().toLowerCase());
  return it ? (Number(it.qty)||0) : null;
}
function _bomProductOptions(sel){
  return products.map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${p.name} (${p.id})</option>`).join('');
}
function onBomProductChange(){ bomProductId = v('bom-product'); renderBom(); }
function renderBom(){
  const body = inp('bom-body'); if(!body) return;
  // 제품 셀렉트 채우기 + 기본 선택
  if (!bomProductId || !products.find(p=>p.id===bomProductId)) bomProductId = products[0]?.id || '';
  const sel = inp('bom-product'); if (sel) sel.innerHTML = _bomProductOptions(bomProductId);
  const p = products.find(x=>x.id===bomProductId);
  if (!p) { body.innerHTML = empty('등록된 제품이 없습니다. 먼저 제품을 등록하세요.'); return; }
  const lines = bomFor(p.id);
  const matCost = bomMaterialCost(p.id);
  const savedCost = Number(p.matCost)||0;
  const diff = matCost - savedCost;
  const rows = lines.length ? lines.map(b=>{
    const isSub = !!b.subProductId;
    const unitCost = bomLineUnitCost(b);
    const amt = (Number(b.qtyPer)||0)*unitCost;
    return `
    <tr>
      <td style="font-weight:700;">${b.name}${isSub?` <span class="bd bd-info" style="font-size:9px;">반제품</span>`:''}</td>
      <td>${b.spec||'—'}</td>
      <td>${isSub?`<span style="color:var(--tx-i);">↳ ${bomProductName(b.subProductId)}</span>`:(b.supplier||'<span style="color:var(--tx-t);">미지정</span>')}</td>
      <td style="text-align:right;">${b.qtyPer}${b.unit||''}</td>
      <td style="text-align:right;">${fmtW(unitCost)}${isSub?'<span style="font-size:9px;color:var(--tx-t);"> (롤업)</span>':''}</td>
      <td style="text-align:right;font-weight:700;">${fmtW(amt)}</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="btn btn-sm" onclick="openBomEdit('${b.id}')" title="수정"><i class="ti ti-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteBom('${b.id}')" title="삭제"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7">${empty('이 제품의 BOM이 비어 있습니다. [자재 추가]로 구성하세요.')}</td></tr>`;

  const mrpQty = p.qty || 1;
  body.innerHTML = `
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-list-numbers"></i>BOM 자재 항목</div><div class="mc-val">${lines.length}종</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calculator" style="color:#e8590c;"></i>BOM 재료비 / 대</div><div class="mc-val" style="color:#e8590c;">${fmtW(matCost)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-box"></i>제품 등록 재료비</div><div class="mc-val">${fmtW(savedCost)}</div><div class="mc-sub" style="color:${diff===0?'var(--tx-ok)':'var(--tx-w)'};">${diff===0?'원가 일치':'차이 '+fmtW(diff)+' · 반영 필요'}</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-sitemap"></i>${p.name} — 자재 구성 (1대 기준)</span>
        <span style="font-size:11px;color:var(--tx-t);">재료비 합계 <b style="color:#e8590c;">${fmtW(matCost)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>자재명</th><th>규격</th><th>공급처</th><th style="text-align:right;">소요량/대</th><th style="text-align:right;">단가</th><th style="text-align:right;">금액</th><th style="text-align:center;">관리</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-package-import"></i>소요량 · 발주 필요량 (MRP)</span>
        <span style="font-size:12px;display:flex;align-items:center;gap:10px;">생산수량 <input id="bom-mrp-qty" type="number" min="1" value="${mrpQty}" oninput="renderBomMrp()" style="width:70px;height:26px;text-align:right;"> ${p.unit||'대'}
          <button class="btn btn-sm btn-primary" onclick="genPoFromMrp()" title="발주 필요 자재를 구매발주서로 생성"><i class="ti ti-file-invoice"></i>발주서 생성</button></span></div>
      <div id="bom-mrp" style="overflow-x:auto;"></div>
    </div>`;
  renderBomMrp();
}
function renderBomMrp(){
  const wrap = inp('bom-mrp'); if(!wrap) return;
  const p = products.find(x=>x.id===bomProductId); if(!p) return;
  const qty = parseInt(v('bom-mrp-qty'))||0;
  const leaves = Object.values(explodeBomLeaves(p.id, qty));   // 반제품까지 전개한 구매 원자재
  const hasSub = bomFor(p.id).some(b=>b.subProductId);
  let totalOrder = 0;
  const rows = leaves.length ? leaves.map(L=>{
    const need = L.qty;
    const perUnit = qty>0 ? Math.round(need/qty*100)/100 : 0;
    const stock = invStockByName(L.name);
    const shortage = stock===null ? need : Math.max(0, need-stock);
    totalOrder += shortage*(Number(L.unitPrice)||0);
    return `
    <tr>
      <td style="font-weight:700;">${L.name}</td>
      <td style="text-align:right;">${perUnit}${L.unit||''}</td>
      <td style="text-align:right;font-weight:700;">${need}${L.unit||''}</td>
      <td style="text-align:right;color:${stock===null?'var(--tx-t)':''};">${stock===null?'재고 미등록':stock+(L.unit||'')}</td>
      <td style="text-align:right;font-weight:700;color:${shortage>0?'var(--tx-d)':'var(--tx-ok)'};">${shortage>0?shortage+(L.unit||''):'충족'}</td>
      <td style="text-align:right;">${fmtW(shortage*(Number(L.unitPrice)||0))}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6">${empty('BOM이 비어 있어 소요량을 계산할 수 없습니다.')}</td></tr>`;
  wrap.innerHTML = `
    ${hasSub?`<div style="font-size:11px;color:var(--tx-i);padding:2px 2px 8px;"><i class="ti ti-info-circle"></i> 반제품을 하위 원자재까지 전개한 실제 구매 소요량입니다.</div>`:''}
    <table>
    <thead><tr><th>원자재</th><th style="text-align:right;">소요량/대</th><th style="text-align:right;">총 소요량</th><th style="text-align:right;">현재고</th><th style="text-align:right;">발주 필요</th><th style="text-align:right;">발주 예상액</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;">발주 예상액 합계</td><td style="text-align:right;font-weight:800;color:#e8590c;">${fmtW(totalOrder)}</td></tr></tfoot>
  </table>`;
}
/* MRP 발주 필요량 → 구매발주서(PO) 자동생성. 발주필요>0 인 자재마다 PO 1건 생성 */
function genPoFromMrp(){
  if (!checkAdminAction()) return;
  const p = products.find(x=>x.id===bomProductId); if(!p){ showToast('제품을 선택하세요.','error'); return; }
  const qty = parseInt(v('bom-mrp-qty'))||0;
  const leaves = Object.values(explodeBomLeaves(p.id, qty));   // 반제품 전개 후 구매 원자재
  const targets = leaves.map(L=>{
    const st=invStockByName(L.name);
    const shortage = st===null ? L.qty : Math.max(0, L.qty-st);
    return {L, shortage};
  }).filter(x=>x.shortage>0);
  if (!targets.length){ showToast('발주가 필요한 자재가 없습니다 (재고 충족).', 'info'); return; }
  const noSup = targets.filter(t=>!t.L.supplier).length;
  if (!confirm(`${targets.length}개 자재에 대해 구매발주서를 생성합니다.${noSup?`\n(공급처 미지정 ${noSup}건은 발주서에서 직접 입력 필요)`:''}\n진행하시겠습니까?`)) return;
  let created = 0;
  targets.forEach(({L, shortage})=>{
    const po = {
      id: nextDocCode('P', poList), date: today(), dueDate: '',
      clientId: p.clientId||'', productId: p.id,
      supplier: L.supplier||'', supplierEmail: '',
      itemName: L.name, spec: L.spec||'',
      qty: shortage, unit: L.unit||'EA', unitPrice: Number(L.unitPrice)||0,
      payMethod: '현금', dlvMethod: '직납', status: '작성중',
      note: `BOM 자동생성 · ${p.name} ${qty}${p.unit||'대'} 기준`
    };
    poList.unshift(po); created++;
  });
  saveStorage('poList', poList);
  showToast(`구매발주서 ${created}건이 생성되었습니다. (구매발주서 메뉴에서 확인)`);
  if (confirm('생성된 발주서를 지금 확인하시겠습니까?')) go('po');
}
function applyBomCost(){
  if (!checkAdminAction()) return;
  const p = products.find(x=>x.id===bomProductId); if(!p){ showToast('제품을 선택하세요.','error'); return; }
  const cost = bomMaterialCost(p.id);
  p.matCost = cost;
  saveStorage('products', products);
  renderBom();
  if (typeof renderClients==='function' && currentPage==='clients') renderClients();
  showToast(`재료비 ${fmtW(cost)}를 [${p.name}] 원가에 반영했습니다.`);
}
/* 반제품 연결 옵션 — 현재 제품 자신은 제외(직접 순환 방지) */
function _bomSubOptions(sel){
  return '<option value="">— 구매 자재 (단가 직접 입력) —</option>' +
    products.filter(p=>p.id!==bomProductId).map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${p.name} (${p.id})</option>`).join('');
}
function onBmaSubChange(){
  const isSub = !!v('bma-sub');
  ['bma-price','bma-supplier'].forEach(id=>{ const el=inp(id); if(el){ el.disabled=isSub; el.style.opacity=isSub?0.5:1; } });
}
function openBomAdd(){
  if (!bomProductId){ showToast('제품을 먼저 선택하세요.','error'); return; }
  editBomId = null;
  inp('bom-modal-ttl').innerHTML = '<i class="ti ti-plus" style="color:var(--tx-i);"></i>자재 추가 — '+(products.find(p=>p.id===bomProductId)?.name||'');
  sv('bma-name',''); sv('bma-spec',''); sv('bma-qty','1'); sv('bma-unit','EA'); sv('bma-price','0'); sv('bma-supplier','');
  inp('bma-sub').innerHTML = _bomSubOptions(''); onBmaSubChange();
  inp('bom-modal').classList.add('open');
}
function openBomEdit(id){
  const b = bomList.find(x=>x.id===id); if(!b) return;
  editBomId = id;
  inp('bom-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>BOM 자재 수정';
  sv('bma-name',b.name); sv('bma-spec',b.spec||''); sv('bma-qty',b.qtyPer); sv('bma-unit',b.unit||'EA'); sv('bma-price',b.unitPrice||'0'); sv('bma-supplier',b.supplier||'');
  inp('bma-sub').innerHTML = _bomSubOptions(b.subProductId||''); onBmaSubChange();
  inp('bom-modal').classList.add('open');
}
function saveBomModal(){
  if (!checkAdminAction()) return;
  const name = v('bma-name').trim();
  if (!name){ showToast('자재명은 필수입니다.','error'); return; }
  const subId = v('bma-sub');
  const rec = { productId: bomProductId, name, spec: v('bma-spec'), qtyPer: parseFloat(v('bma-qty'))||0, unit: v('bma-unit')||'EA',
    unitPrice: subId ? 0 : (parseInt(v('bma-price'))||0), supplier: subId ? '' : v('bma-supplier').trim(), subProductId: subId };
  if (editBomId){
    const b = bomList.find(x=>x.id===editBomId); if(b) Object.assign(b, rec);
    showToast('BOM 자재가 수정되었습니다.');
  } else {
    bomList.push(Object.assign({ id: nextCode('BM', bomList) }, rec));
    showToast('BOM에 자재가 추가되었습니다.');
  }
  saveStorage('bomList', bomList);
  closeModal('bom-modal');
  renderBom();
}
function deleteBom(id){
  if (!checkAdminAction()) return;
  if (!confirm('이 자재를 BOM에서 삭제하시겠습니까?')) return;
  bomList = bomList.filter(x=>x.id!==id);
  saveStorage('bomList', bomList);
  renderBom();
  showToast('BOM 자재가 삭제되었습니다.');
}

/* ── 손익(P&L) ── */
function _finPnl() {
  const months = finMonthList(6);
  const payroll = finPayrollMonthly();
  let tRev=0, tPur=0, tLab=0, tInc=0, tExp=0, tNet=0;
  const rows = months.map(m => {
    const rev = finRevenueMonth(m.ym), pur = finPurchaseMonth(m.ym);
    const inc = finEntryMonth(m.ym,'수입'), exp = finEntryMonth(m.ym,'비용');
    const net = rev - pur - payroll - exp + inc;
    tRev+=rev; tPur+=pur; tLab+=payroll; tInc+=inc; tExp+=exp; tNet+=net;
    return `
      <tr>
        <td style="font-weight:700;">${m.ym}</td>
        <td class="amt-blue">${fmtW(rev)}</td>
        <td style="color:#e8590c;">${fmtW(pur)}</td>
        <td>${fmtW(payroll)}</td>
        <td>${fmtW(inc)}</td>
        <td>${fmtW(exp)}</td>
        <td style="font-weight:700;color:${net>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(net)}</td>
      </tr>`;
  }).join('');
  return `
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-report-money"></i>월별 손익계산 (최근 6개월)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>월</th><th>매출</th><th>매입/지출</th><th>인건비</th><th>기타수입</th><th>기타비용</th><th>순이익</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid var(--br);font-weight:700;">
          <td>합계</td><td class="amt-blue">${fmtW(tRev)}</td><td style="color:#e8590c;">${fmtW(tPur)}</td>
          <td>${fmtW(tLab)}</td><td>${fmtW(tInc)}</td><td>${fmtW(tExp)}</td>
          <td style="color:${tNet>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(tNet)}</td>
        </tr></tfoot>
      </table></div>
      <div style="font-size:11px;color:var(--tx-t);margin-top:8px;">※ 인건비는 현재 등록된 직원 월 급여 합계를 매월 동일하게 반영한 추정치입니다.</div>
    </div>`;
}

/* ── 미수금 / 미지급 ── */
function _finAR() {
  const arList = [...deliveries].sort((a,b)=>(b.deliveredAt||'').localeCompare(a.deliveredAt||''));
  let arUnpaid = 0;
  const arBody = arList.length ? arList.map(d => {
    const amt = (d.price||0)*(d.qty||0);
    const paid = !!financeData.paidReceivable[d.id];
    if (!paid) arUnpaid += amt;
    return `
      <tr style="${paid?'opacity:.55;':''}">
        <td>${d.deliveredAt||'—'}</td>
        <td>${getClientName(d.clientId)}</td>
        <td>${d.productName||getProductName(d.productId)}</td>
        <td style="font-weight:700;">${fmtW(amt)}</td>
        <td>${paid?'<span class="bd bd-ok">수금완료</span>':'<span class="bd bd-warn">미수금</span>'}</td>
        <td><button class="btn btn-sm" onclick="toggleReceivable('${d.id}')">${paid?'미수금 처리':'수금 처리'}</button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="6">${empty('매출(납품) 내역이 없습니다.')}</td></tr>`;

  const apList = [...poList].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  let apUnpaid = 0;
  const apBody = apList.length ? apList.map(p => {
    const amt = (p.unitPrice||0)*(p.qty||0);
    const paid = !!financeData.paidPayable[p.id];
    if (!paid) apUnpaid += amt;
    return `
      <tr style="${paid?'opacity:.55;':''}">
        <td>${p.date||'—'}</td>
        <td>${p.supplier||'—'}</td>
        <td>${p.itemName||'—'}</td>
        <td style="font-weight:700;">${fmtW(amt)}</td>
        <td>${paid?'<span class="bd bd-ok">지급완료</span>':'<span class="bd bd-warn">미지급</span>'}</td>
        <td><button class="btn btn-sm" onclick="togglePayable('${p.id}')">${paid?'미지급 처리':'지급 처리'}</button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="6">${empty('매입(발주) 내역이 없습니다.')}</td></tr>`;

  return `
    <div class="metrics" style="grid-template-columns:repeat(2,1fr);">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-receipt"></i>미수금 합계 (받을 돈)</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(arUnpaid)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-receipt-off"></i>미지급금 합계 (줄 돈)</div><div class="mc-val" style="color:#e8590c;">${fmtW(apUnpaid)}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-receipt"></i>미수금 관리 (매출 채권)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>납품일</th><th>고객사</th><th>제품</th><th>금액</th><th>수금상태</th><th>처리</th></tr></thead>
        <tbody>${arBody}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-receipt-off"></i>미지급금 관리 (매입 채무)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>발주일</th><th>공급처</th><th>품목</th><th>금액</th><th>지급상태</th><th>처리</th></tr></thead>
        <tbody>${apBody}</tbody>
      </table></div>
    </div>`;
}

function toggleReceivable(id) {
  if (!checkAdminAction()) return;
  financeData.paidReceivable[id] = !financeData.paidReceivable[id];
  if (!financeData.paidReceivable[id]) delete financeData.paidReceivable[id];
  saveStorage('financeData', financeData);
  renderFinance();
}
function togglePayable(id) {
  if (!checkAdminAction()) return;
  financeData.paidPayable[id] = !financeData.paidPayable[id];
  if (!financeData.paidPayable[id]) delete financeData.paidPayable[id];
  saveStorage('financeData', financeData);
  renderFinance();
}

/* ── 기타 수입/비용 ── */
function _finEtc() {
  const list = [...financeData.entries].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const inc = finEntriesSum('수입'), exp = finEntriesSum('비용');
  const body = list.length ? list.map(e => `
    <tr>
      <td>${e.date||'—'}</td>
      <td>${e.type==='수입'?'<span class="bd bd-ok">수입</span>':'<span class="bd bd-err">비용</span>'}</td>
      <td>${e.category||'기타'}</td>
      <td>${e.title||''}</td>
      <td style="font-weight:700;color:${e.type==='수입'?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(Number(e.amount)||0)}</td>
      <td>${e.note||''}</td>
      <td><button class="del-btn" onclick="deleteFinanceEntry('${e.id}')"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('') : `<tr><td colspan="7">${empty('등록된 기타 수입/비용 항목이 없습니다. 우측 상단 [기타 항목 등록] 버튼으로 추가하세요.')}</td></tr>`;
  return `
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-list-details"></i>기타 수입/비용 (직접 입력)</span>
        <span style="font-size:13px;">수입 <b style="color:var(--tx-ok);">${fmtW(inc)}</b> · 비용 <b style="color:var(--tx-err);">${fmtW(exp)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>일자</th><th>구분</th><th>분류</th><th>내용</th><th>금액</th><th>비고</th><th>삭제</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
}

function openFinanceAdd() {
  sv('fin-type', '비용');
  sv('fin-date', today());
  sv('fin-cat', '임대료');
  sv('fin-amount', '');
  sv('fin-title', '');
  sv('fin-note', '');
  inp('finance-modal').classList.add('open');
}

function saveFinanceEntry() {
  if (!checkAdminAction()) return;
  const title = v('fin-title').trim();
  const amount = Number(v('fin-amount')) || 0;
  if (!title)    { showToast('내용을 입력하세요.', 'error'); return; }
  if (amount <= 0) { showToast('금액을 입력하세요.', 'error'); return; }
  financeData.entries.push({
    id: nextCode('FIN', financeData.entries),
    type: v('fin-type') || '비용',
    date: v('fin-date') || today(),
    category: v('fin-cat') || '기타',
    title, amount,
    note: v('fin-note') || ''
  });
  saveStorage('financeData', financeData);
  closeModal('finance-modal');
  if (currentPage === 'finance') { financeTab = 'etc'; renderFinance(); }
  showToast('기타 항목이 등록되었습니다.');
}

function deleteFinanceEntry(id) {
  if (!checkAdminAction()) return;
  const e = financeData.entries.find(x => x.id === id);
  if (!e) return;
  confirm_('기타 항목 삭제', `<strong>[${e.title}]</strong> 항목을 삭제하시겠습니까?`, () => {
    financeData.entries = financeData.entries.filter(x => x.id !== id);
    saveStorage('financeData', financeData);
    renderFinance();
    showToast('항목이 삭제되었습니다.');
  });
}

/* 현재 페이지에 알맞는 신규 등록 팝업 창 호출 컨트롤러 */
function openCurrentPageRegistration() {
  // 각 탭별 등록 창 매핑. 자체 등록 폼이 없는 화면(대시보드/공정/납품/휴지통)은
  // 대표 등록인 '생산지시 등록'으로 연결하여 어떤 탭에서든 N키가 동작하도록 함.
  const REG = {
    clients:   openClientAdd,
    materials: openMatAdd,
    orders:    openOrderAdd,
    inventory: openInvAdd,
    quality:   openDefectAdd, // 품질 탭은 대표로 공정 불량 등록 창 호출
    claims:    openClaimAdd,
    workers:   openEmployeeAdd,
    rfq:       openRfqAdd,
    po:        openPoAdd,
    statement: () => openSalesDocAdd('statement'),
    taxinvoice:() => openSalesDocAdd('tax'),
    salesdoc:  () => openSODocAdd(salesTab),
    partners:  openPartnerModal,
    alerts:    openAlertAdd,
    finance:   openFinanceAdd,
    dashboard:   openOrderAdd,
    process:     openOrderAdd,
    deliveries:  openOrderAdd,
    trash:       openOrderAdd
  };
  const fn = REG[currentPage] || openOrderAdd; // 미정의 탭도 기본 등록창 호출
  fn();
  focusFirstModalField(); // 등록창의 첫 입력칸에 자동 포커스
}

/* 방금 열린 오버레이 모달의 첫 입력칸에 포커스 (readonly/hidden 제외) */
function focusFirstModalField() {
  setTimeout(() => {
    const modal = document.querySelector('.overlay.open');
    if (!modal) return;
    const field = modal.querySelector('input:not([readonly]):not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
    if (field) { field.focus(); if (field.select) try { field.select(); } catch(_) {} }
  }, 60);
}

/* 글로벌 keydown 리스너 - N 키로 등록창 즉시 팝업 */
document.addEventListener('keydown', function(e) {
  // 사용자가 입력 요소 안에서 타이핑 중일 때는 단축키 차단
  const activeEl = document.activeElement;
  if (activeEl && (
    activeEl.tagName === 'INPUT' ||
    activeEl.tagName === 'TEXTAREA' ||
    activeEl.tagName === 'SELECT' ||
    activeEl.isContentEditable
  )) {
    return;
  }

  // 한영 전환 상태와 무관하게 동작하도록 e.code 및 e.key 복합 판정
  if (e.code === 'KeyN' || e.key.toLowerCase() === 'n' || e.key === 'ㅜ') {
    e.preventDefault();
    openCurrentPageRegistration();
  }
});

