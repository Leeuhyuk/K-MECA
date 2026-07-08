/* ════════ BOM · 자재명세 ════════ */
let editBomId = null;
let bomMaterialImportRows = [];
let bomViewTab = 'bom';
let bomMaterialQuery = '';
let finPnlDetailMonth = '';
let finCostDetailProductId = '';
function visibleBomList(){ return typeof visibleRecords === 'function' ? visibleRecords(bomList, 'bom') : bomList; }
function visibleBomProducts(){ return typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products; }
function visibleBomClients(){ return typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients; }
function bomFor(pid){ return visibleBomList().filter(b=>b.productId===pid); }
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
  const p = visibleBomProducts().find(function(x) { return x.id === productId; });
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
function bomProductName(pid){ return visibleBomProducts().find(p=>p.id===pid)?.name || pid; }
function bomCostInfoAllowed() {
  if (typeof canViewCostInfo === 'function') return canViewCostInfo();
  const role = (typeof currentRole !== 'undefined' && currentRole) || localStorage.getItem('mes_myRole') || 'staff';
  return role === 'admin' || role === 'manager';
}
function requireBomCostInfo() {
  if (bomCostInfoAllowed()) return true;
  if (typeof showToast === 'function') showToast('BOM/원가 조회 권한이 없습니다.', 'error');
  return false;
}
/* 재고에서 동일 자재명의 현재고 조회(이름 매칭, 없으면 0) */
function invStockByName(name){
  const it = inventory.find(i=>(i.name||'').trim().toLowerCase()===(name||'').trim().toLowerCase());
  return it ? (Number(it.qty)||0) : null;
}
function _bomRecentIds(){
  try { return JSON.parse(localStorage.getItem('mes_bomRecentProducts') || '[]'); }
  catch (e) { return []; }
}
function _rememberBomProduct(pid){
  if (!pid) return;
  const ids = [pid].concat(_bomRecentIds().filter(id=>id!==pid)).slice(0, 5);
  localStorage.setItem('mes_bomRecentProducts', JSON.stringify(ids));
}
function _bomVisibleProducts(){
  const clientId = v('bom-client-filter');
  const q = v('bom-product-search').trim().toLowerCase();
  return visibleBomProducts().filter(p=>{
    if (clientId && p.clientId !== clientId) return false;
    return !q || [p.name,p.id,getClientName(p.clientId)].join(' ').toLowerCase().includes(q);
  });
}
function renderBomProductOptions(){
  const clientFilter = inp('bom-client-filter');
  if (clientFilter) {
    const current = clientFilter.value;
    clientFilter.innerHTML = '<option value="">전체 고객사</option>' +
      visibleBomClients().filter(c=>!c.closed).map(c=>`<option value="${c.id}"${c.id===current?' selected':''}>${_bomImportEsc(c.name)}</option>`).join('');
  }
  const visible = _bomVisibleProducts();
  const count = inp('bom-product-count');
  if (count) count.textContent = visible.length;
  const sel = inp('bom-product');
  if (sel) {
    sel.innerHTML = visible.length
      ? visible.map(p=>`<option value="${p.id}"${p.id===bomProductId?' selected':''}>${_bomImportEsc(p.name)} (${_bomImportEsc(p.id)}) · ${_bomImportEsc(getClientName(p.clientId))}</option>`).join('')
      : '<option value="">검색 결과 없음</option>';
    if (!visible.some(p=>p.id===bomProductId)) sel.value = '';
  }
  const list = inp('bom-product-list');
  if (list) {
    list.innerHTML = visible.length ? visible.map(p=>{
      const lineCount = bomFor(p.id).length;
      return `<button class="bom-product-item${p.id===bomProductId?' active':''}" onclick="selectBomProduct('${p.id}')">
        <span class="bom-product-item-main"><b>${_bomImportEsc(p.name)}</b><small>${_bomImportEsc(getClientName(p.clientId))} · ${_bomImportEsc(p.id)}</small></span>
        <span class="bd ${lineCount?'bd-info':'bd-neu'}">${lineCount}종</span>
      </button>`;
    }).join('') : '<div class="empty" style="padding:18px 8px;">검색 결과가 없습니다.</div>';
  }
  renderBomRecentProducts();
}
function renderBomRecentProducts(){
  const box = inp('bom-recent-products'); if (!box) return;
  const recent = _bomRecentIds().map(id=>visibleBomProducts().find(p=>p.id===id)).filter(Boolean);
  box.innerHTML = recent.length
    ? '<div class="bom-recent-title"><i class="ti ti-history"></i> 최근 제품</div>' +
      recent.map(p=>`<button class="bom-recent-item${p.id===bomProductId?' active':''}" onclick="selectBomProduct('${p.id}')">${_bomImportEsc(p.name)}</button>`).join('')
    : '<span style="font-size:11px;color:var(--tx-t);">제품을 선택하면 최근 사용 제품이 여기에 표시됩니다.</span>';
}
function selectBomProduct(pid){
  const p = visibleBomProducts().find(x=>x.id===pid); if (!p) return;
  bomProductId = pid;
  _rememberBomProduct(pid);
  renderBom();
}
function onBomProductChange(){
  const pid = v('bom-product');
  if (!pid) return;
  bomProductId = pid;
  _rememberBomProduct(pid);
  renderBom();
}
function switchBomView(tab){
  bomViewTab = tab === 'mrp' ? 'mrp' : 'bom';
  document.querySelectorAll('#bom-view-tabs [data-bomtab]').forEach(btn=>{
    btn.classList.toggle('btn-primary', btn.dataset.bomtab===bomViewTab);
  });
  const bomPanel = inp('bom-panel-list'), mrpPanel = inp('bom-panel-mrp');
  if (bomPanel) bomPanel.style.display = bomViewTab==='bom' ? '' : 'none';
  if (mrpPanel) mrpPanel.style.display = bomViewTab==='mrp' ? '' : 'none';
}
function filterBomMaterials(field){
  bomMaterialQuery = String(field ? field.value : v('bom-material-search')).trim().toLowerCase();
  const caret = field && typeof field.selectionStart === 'number' ? field.selectionStart : bomMaterialQuery.length;
  renderBom();
  setTimeout(()=>{
    const next = inp('bom-material-search');
    if (next) { next.focus(); next.setSelectionRange(caret, caret); }
  }, 0);
}
function renderBom(){
  const body = inp('bom-body'); if(!body) return;
  const productSource = visibleBomProducts();
  if (!bomCostInfoAllowed()) {
    body.innerHTML = `<div class="card"><div class="empty"><i class="ti ti-lock"></i>BOM/원가 조회 권한이 없습니다.</div></div>`;
    return;
  }
  // 제품 셀렉트 채우기 + 기본 선택
  if (!bomProductId || !productSource.find(p=>p.id===bomProductId)) bomProductId = productSource[0]?.id || '';
  if (bomProductId) _rememberBomProduct(bomProductId);
  renderBomProductOptions();
  const p = productSource.find(x=>x.id===bomProductId);
  if (!p) { body.innerHTML = empty('등록된 제품이 없습니다. 먼저 제품을 등록하세요.'); return; }
  const selectedLabel = inp('bom-selected-product');
  if (selectedLabel) selectedLabel.innerHTML = `${_bomImportEsc(p.name)} <span style="font-size:10px;color:var(--tx-t);font-weight:500;">${_bomImportEsc(p.id)} · ${_bomImportEsc(getClientName(p.clientId))}</span>`;
  const lines = bomFor(p.id);
  const visibleLines = lines.filter(b=>!bomMaterialQuery || [b.name,b.spec,b.supplier,bomProductName(b.subProductId)].join(' ').toLowerCase().includes(bomMaterialQuery));
  const matCost = bomMaterialCost(p.id);
  const savedCost = Number(p.matCost)||0;
  const diff = matCost - savedCost;
  const rows = visibleLines.length ? visibleLines.map(b=>{
    const isSub = !!b.subProductId;
    const unitCost = bomLineUnitCost(b);
    const amt = (Number(b.qtyPer)||0)*unitCost;
    return `
    <tr>
      <td style="font-weight:700;">${esc(b.name)}${isSub?` <span class="bd bd-info" style="font-size:9px;">반제품</span>`:''}</td>
      <td>${esc(b.spec)||'—'}</td>
      <td>${isSub?`<span style="color:var(--tx-i);">↳ ${esc(bomProductName(b.subProductId))}</span>`:(esc(b.supplier)||'<span style="color:var(--tx-t);">미지정</span>')}</td>
      <td style="text-align:right;">${esc(b.qtyPer)}${esc(b.unit)||''}</td>
      <td style="text-align:right;">${fmtW(unitCost)}${isSub?'<span style="font-size:9px;color:var(--tx-t);"> (롤업)</span>':''}</td>
      <td style="text-align:right;font-weight:700;">${fmtW(amt)}</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="btn btn-sm" onclick="openBomEdit('${b.id}')" title="수정"><i class="ti ti-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteBom('${b.id}')" title="삭제"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7">${empty(lines.length?'검색 조건에 맞는 자재가 없습니다.':'이 제품의 BOM이 비어 있습니다. [자재 추가]로 구성하세요.')}</td></tr>`;

  const mrpQty = p.qty || 1;
  body.innerHTML = `
    <div class="metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-list-numbers"></i>BOM 자재 항목</div><div class="mc-val">${lines.length}종</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calculator" style="color:#e8590c;"></i>BOM 재료비 / 대</div><div class="mc-val" style="color:#e8590c;">${fmtW(matCost)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-box"></i>제품 등록 재료비</div><div class="mc-val">${fmtW(savedCost)}</div><div class="mc-sub" style="color:${diff===0?'var(--tx-ok)':'var(--tx-w)'};">${diff===0?'원가 일치':'차이 '+fmtW(diff)+' · 반영 필요'}</div></div>
    </div>

    <div class="toolbar" id="bom-view-tabs" style="margin-bottom:10px;">
      <button class="btn ${bomViewTab==='bom'?'btn-primary':''}" data-bomtab="bom" onclick="switchBomView('bom')"><i class="ti ti-list-details"></i>BOM 구성 <span class="bd bd-neu">${lines.length}</span></button>
      <button class="btn ${bomViewTab==='mrp'?'btn-primary':''}" data-bomtab="mrp" onclick="switchBomView('mrp')"><i class="ti ti-package-import"></i>MRP · 발주</button>
      <input id="bom-material-search" value="${_bomImportEsc(bomMaterialQuery)}" oninput="filterBomMaterials(this)" placeholder="자재명 · 규격 · 공급처 검색..." style="min-width:230px;margin-left:auto;">
    </div>

    <div class="card" id="bom-panel-list" style="margin-bottom:16px;display:${bomViewTab==='bom'?'':'none'};">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-sitemap"></i>${esc(p.name)} — 자재 구성 (1대 기준)</span>
        <span style="font-size:11px;color:var(--tx-t);">${visibleLines.length}/${lines.length}개 표시 · 재료비 합계 <b style="color:#e8590c;">${fmtW(matCost)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>자재명</th><th>규격</th><th>공급처</th><th style="text-align:right;">소요량/대</th><th style="text-align:right;">단가</th><th style="text-align:right;">금액</th><th style="text-align:center;">관리</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>

    <div class="card" id="bom-panel-mrp" style="display:${bomViewTab==='mrp'?'':'none'};">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-package-import"></i>소요량 · 발주 필요량 (MRP)</span>
        <span style="font-size:12px;display:flex;align-items:center;gap:10px;">생산수량 <input id="bom-mrp-qty" type="number" min="1" value="${mrpQty}" oninput="renderBomMrp()" style="width:70px;height:26px;text-align:right;"> ${p.unit||'대'}
          <button class="btn btn-sm btn-primary" onclick="genPoFromMrp()" title="발주 필요 자재를 구매발주서로 생성"><i class="ti ti-file-invoice"></i>발주서 생성</button></span></div>
      <div id="bom-mrp" style="overflow-x:auto;"></div>
    </div>`;
  renderBomMrp();
}
function renderBomMrp(){
  const wrap = inp('bom-mrp'); if(!wrap) return;
  if (!bomCostInfoAllowed()) { wrap.innerHTML = ''; return; }
  const p = visibleBomProducts().find(x=>x.id===bomProductId); if(!p) return;
  const qty = parseInt(v('bom-mrp-qty'))||0;
  const leaves = Object.values(explodeBomLeaves(p.id, qty)).filter(L=>
    !bomMaterialQuery || [L.name,L.spec,L.supplier].join(' ').toLowerCase().includes(bomMaterialQuery)
  );   // 반제품까지 전개한 구매 원자재
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
  if (!requireBomCostInfo()) return;
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('po', '구매발주서 생성')) return;
  const p = visibleBomProducts().find(x=>x.id===bomProductId); if(!p){ showToast('제품을 선택하세요.','error'); return; }
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
    const nextPo = stampRecordCreate(po, 'po');
    poList.unshift(nextPo);
    writeAuditLog('po', nextPo.id, 'create', null, nextPo, { summary:'BOM 발주 필요량에서 구매발주서 생성' });
    created++;
  });
  saveStorage('poList', poList);
  showToast(`구매발주서 ${created}건이 생성되었습니다. (구매발주서 메뉴에서 확인)`);
  if (confirm('생성된 발주서를 지금 확인하시겠습니까?')) go('po');
}
function applyBomCost(){
  if (!requireBomCostInfo()) return;
  if (!checkAdminAction()) return;
  const p = visibleBomProducts().find(x=>x.id===bomProductId); if(!p){ showToast('제품을 선택하세요.','error'); return; }
  if (typeof requireRecordPermission === 'function' && !requireRecordPermission('edit', p, 'products')) return;
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
    visibleBomProducts().filter(p=>p.id!==bomProductId).map(p=>`<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.name)} (${esc(p.id)})</option>`).join('');
}
function onBmaSubChange(){
  const isSub = !!v('bma-sub');
  ['bma-price','bma-supplier'].forEach(id=>{ const el=inp(id); if(el){ el.disabled=isSub; el.style.opacity=isSub?0.5:1; } });
}
function _bomImportKey(name, unit){
  return (name||'').trim().toLowerCase() + '|' + (unit||'EA').trim().toLowerCase();
}
function _bomImportEsc(value){
  return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function openBomMaterialImport(){
  if (!requireBomCostInfo()) return;
  const p = visibleBomProducts().find(x=>x.id===bomProductId);
  if (!p){ showToast('제품을 먼저 선택하세요.','error'); return; }
  const grouped = {};
  const materialSource = typeof visibleRecords === 'function' ? visibleRecords(materials, 'material') : materials;
  materialSource.filter(m=>m.productId===p.id && (m.name||'').trim()).forEach(m=>{
    const key = _bomImportKey(m.name, m.unit);
    if (!grouped[key]) grouped[key] = { key, name:m.name.trim(), unit:m.unit||'EA', totalQty:0, count:0, sourceIds:[], latest:null };
    const row = grouped[key];
    row.totalQty += Number(m.qty)||0;
    row.count++;
    row.sourceIds.push(m.id);
    const stamp = (m.orderDate||'') + '|' + (m.id||'');
    const latestStamp = row.latest ? ((row.latest.orderDate||'') + '|' + (row.latest.id||'')) : '';
    if (!row.latest || stamp >= latestStamp) row.latest = m;
  });
  bomMaterialImportRows = Object.values(grouped).map(row=>{
    const existing = visibleBomList().find(b=>b.productId===p.id && !b.subProductId && _bomImportKey(b.name,b.unit)===row.key);
    const productQty = Number(p.qty)||1;
    const latestOrderQty = Number(row.latest?.qty)||0;
    const suggestedQty = latestOrderQty > 0 ? Math.round((latestOrderQty / productQty) * 10000) / 10000 : 0;
    row.existingId = existing ? existing.id : '';
    row.currentQtyPer = existing ? (Number(existing.qtyPer)||0) : null;
    row.productQty = productQty;
    row.latestOrderQty = latestOrderQty;
    row.qtyPer = suggestedQty || row.currentQtyPer || '';
    return row;
  }).sort((a,b)=>a.name.localeCompare(b.name,'ko-KR'));

  inp('bom-material-import-info').innerHTML =
    `<b>${_bomImportEsc(p.name)}</b>에 연결된 발주 내역 ${materialSource.filter(m=>m.productId===p.id).length}건을 ` +
    `${bomMaterialImportRows.length}개 자재로 묶었습니다. 소요량은 최근 발주 수량 ÷ 제품 수량 ${Number(p.qty)||1}${_bomImportEsc(p.unit||'대')}로 계산했습니다.`;
  inp('bom-material-import-body').innerHTML = bomMaterialImportRows.length ? bomMaterialImportRows.map((row,i)=>{
    const latest = row.latest || {};
    return `<tr>
      <td style="text-align:center;"><input class="bom-import-check" type="checkbox" data-index="${i}" checked></td>
      <td><b>${_bomImportEsc(row.name)}</b><div style="font-size:10px;color:var(--tx-t);">${row.count}건 · ${_bomImportEsc(row.unit)}</div></td>
      <td>${_bomImportEsc(latest.supplier||'미지정')}</td>
      <td style="text-align:right;">${row.totalQty}${_bomImportEsc(row.unit)}</td>
      <td style="text-align:right;">${fmtW(Number(latest.unitPrice)||0)}</td>
      <td style="text-align:right;">
        <input class="bom-import-qty" data-index="${i}" type="number" min="0.0001" step="0.0001" value="${row.qtyPer}" placeholder="필수 입력" style="width:110px;text-align:right;"> ${_bomImportEsc(row.unit)}
        <div style="font-size:10px;color:var(--tx-t);margin-top:3px;">${row.latestOrderQty}${_bomImportEsc(row.unit)} ÷ ${row.productQty}${_bomImportEsc(p.unit||'대')}</div>
      </td>
      <td>${row.existingId?`<span class="bd bd-info">기존 항목 갱신</span><div style="font-size:10px;color:var(--tx-t);margin-top:3px;">현재 ${row.currentQtyPer}${_bomImportEsc(row.unit)}</div>`:'<span class="bd bd-ok">신규 추가</span>'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="7">${empty('선택한 제품에 연결된 자재 수급/발주 내역이 없습니다.')}</td></tr>`;
  const all = inp('bom-material-import-all');
  if (all) all.checked = bomMaterialImportRows.length > 0;
  inp('bom-material-import-modal').classList.add('open');
}
function toggleBomMaterialImportAll(checked){
  document.querySelectorAll('.bom-import-check').forEach(el=>{ el.checked = checked; });
}
function applyBomMaterialImport(){
  if (!requireBomCostInfo()) return;
  if (!checkAdminAction()) return;
  const selected = Array.from(document.querySelectorAll('.bom-import-check:checked'));
  if (!selected.length){ showToast('반영할 자재를 선택하세요.','error'); return; }
  let added = 0, updated = 0, skipped = 0;
  selected.forEach(check=>{
    const i = Number(check.dataset.index);
    const row = bomMaterialImportRows[i];
    const qtyEl = document.querySelector(`.bom-import-qty[data-index="${i}"]`);
    const qtyPer = qtyEl ? parseFloat(qtyEl.value) : 0;
    if (!row || !(qtyPer > 0)){ skipped++; return; }
    const latest = row.latest || {};
    const rec = {
      productId: bomProductId, name: row.name, spec: '', qtyPer, unit: row.unit||'EA',
      unitPrice: Number(latest.unitPrice)||0, supplier: (latest.supplier||'').trim(), subProductId: '',
      sourceMaterialIds: row.sourceIds.slice(), lastSyncedAt: new Date().toISOString()
    };
    const existing = row.existingId ? visibleBomList().find(b=>b.id===row.existingId) : null;
    if (existing){
      rec.spec = existing.spec||'';
      const before = _safeJsonClone(existing);
      Object.assign(existing, rec);
      stampRecordUpdate(existing, before, 'bom');
      writeAuditLog('bom', existing.id, 'update', before, existing, { summary:'BOM 항목 일괄 반영' });
      updated++;
    } else {
      const item = stampRecordCreate(Object.assign({ id: nextCode('BM', bomList) }, rec), 'bom');
      bomList.push(item);
      writeAuditLog('bom', item.id, 'create', null, item, { summary:'BOM 항목 일괄 등록' });
      added++;
    }
  });
  if (!added && !updated){ showToast('소요량이 입력된 항목이 없습니다.','error'); return; }
  saveStorage('bomList', bomList);
  closeModal('bom-material-import-modal');
  renderBom();
  showToast(`자재 발주 내역을 BOM에 반영했습니다. 신규 ${added}건 · 갱신 ${updated}건${skipped?` · 제외 ${skipped}건`:''}`);
}
function openBomAdd(){
  if (!requireBomCostInfo()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('bom', 'BOM 등록')) return;
  if (!visibleBomProducts().find(p=>p.id===bomProductId)){ showToast('제품을 선택하세요.','error'); return; }
  if (!bomProductId){ showToast('제품을 먼저 선택하세요.','error'); return; }
  editBomId = null;
  inp('bom-modal-ttl').innerHTML = '<i class="ti ti-plus" style="color:var(--tx-i);"></i>자재 추가 — '+(visibleBomProducts().find(p=>p.id===bomProductId)?.name||'');
  sv('bma-name',''); sv('bma-spec',''); sv('bma-qty','1'); sv('bma-unit','EA'); sv('bma-price','0'); sv('bma-supplier','');
  inp('bma-sub').innerHTML = _bomSubOptions(''); onBmaSubChange();
  inp('bom-modal').classList.add('open');
}
function openBomEdit(id){
  if (!requireBomCostInfo()) return;
  const b = visibleBomList().find(x=>x.id===id); if(!b) return;
  if (typeof requireRecordPermission === 'function' && !requireRecordPermission('edit', b, 'bom')) return;
  editBomId = id;
  inp('bom-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>BOM 자재 수정';
  sv('bma-name',b.name); sv('bma-spec',b.spec||''); sv('bma-qty',b.qtyPer); sv('bma-unit',b.unit||'EA'); sv('bma-price',b.unitPrice||'0'); sv('bma-supplier',b.supplier||'');
  inp('bma-sub').innerHTML = _bomSubOptions(b.subProductId||''); onBmaSubChange();
  inp('bom-modal').classList.add('open');
}
function cloneBom(id){
  if (!requireBomCostInfo()) return;
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('bom', 'BOM 등록')) return;
  const b = visibleBomList().find(x=>x.id===id); if(!b) return;
  editBomId = null;
  inp('bom-modal-ttl').innerHTML = '<i class="ti ti-copy" style="color:var(--tx-i);"></i>BOM 자재 복제 추가';
  sv('bma-name',b.name); sv('bma-spec',b.spec||''); sv('bma-qty',b.qtyPer);
  sv('bma-unit',b.unit||'EA'); sv('bma-price',b.unitPrice||'0'); sv('bma-supplier',b.supplier||'');
  inp('bma-sub').innerHTML = _bomSubOptions(b.subProductId||''); onBmaSubChange();
  inp('bom-modal').classList.add('open');
}
function saveBomModal(){
  if (!requireBomCostInfo()) return;
  if (!checkAdminAction()) return;
  const name = v('bma-name').trim();
  if (!name){ showToast('자재명은 필수입니다.','error'); return; }
  const subId = v('bma-sub');
  const rec = { productId: bomProductId, name, spec: v('bma-spec'), qtyPer: parseFloat(v('bma-qty'))||0, unit: v('bma-unit')||'EA',
    unitPrice: subId ? 0 : (parseInt(v('bma-price'))||0), supplier: subId ? '' : v('bma-supplier').trim(), subProductId: subId };
  if (editBomId){
    const b = visibleBomList().find(x=>x.id===editBomId);
    if (!b) return;
    if (b && typeof requireRecordPermission === 'function' && !requireRecordPermission('edit', b, 'bom')) return;
    if(b) {
      const before = _safeJsonClone(b);
      Object.assign(b, rec);
      stampRecordUpdate(b, before, 'bom');
      writeAuditLog('bom', editBomId, 'update', before, b, { summary:'BOM 항목 수정' });
    }
    showToast('BOM 자재가 수정되었습니다.');
  } else {
    if (typeof requireCreateAction === 'function' && !requireCreateAction('bom', 'BOM 등록')) return;
    const item = stampRecordCreate(Object.assign({ id: nextCode('BM', bomList) }, rec), 'bom');
    bomList.push(item);
    writeAuditLog('bom', item.id, 'create', null, item, { summary:'BOM 항목 등록' });
    showToast('BOM에 자재가 추가되었습니다.');
  }
  saveStorage('bomList', bomList);
  closeModal('bom-modal');
  renderBom();
  if (currentPage === 'finance' && typeof financeTab !== 'undefined' && financeTab === 'cost' && typeof renderFinance === 'function') renderFinance();
}
function deleteBom(id){
  if (!checkAdminAction()) return;
  const target = visibleBomList().find(x=>x.id===id);
  if (!target || (typeof requireRecordPermission === 'function' && !requireRecordPermission('delete', target, 'bom'))) return;
  if (!confirm('이 자재를 BOM에서 삭제하시겠습니까?')) return;
  bomList = bomList.filter(x=>x.id!==id);
  if (target) writeAuditLog('bom', id, 'delete', target, null, { summary:'BOM 항목 삭제' });
  saveStorage('bomList', bomList);
  renderBom();
  if (currentPage === 'finance' && typeof financeTab !== 'undefined' && financeTab === 'cost' && typeof renderFinance === 'function') renderFinance();
  showToast('BOM 자재가 삭제되었습니다.');
}

/* ── 손익(P&L) ── */
function toggleFinPnlDetail(ym) {
  finPnlDetailMonth = finPnlDetailMonth === ym ? '' : ym;
  renderFinance();
}
function finPnlDetailHtml(ym) {
  if (!ym) return '';
  const revRows = deliveries.filter(d=>(d.deliveredAt||'').slice(0,7)===ym);
  const purRows = poList.filter(p=>(p.date||'').slice(0,7)===ym);
  const etcRows = financeData.entries.filter(e=>(e.date||'').slice(0,7)===ym);
  const smallRows = (rows, emptyText) => rows.length ? rows.slice(0,8).map(row => row).join('') : `<tr><td colspan="4">${empty(emptyText)}</td></tr>`;
  return `
    <div class="card" style="margin-top:16px;border-color:var(--br-i);">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-list-search"></i>${ym} 상세 내역</span>
        <span style="font-size:11px;color:var(--tx-t);">각 표는 최대 8건 미리보기</span></div>
      <div class="row2" style="margin-bottom:12px;">
        <div style="overflow-x:auto;">
          <div style="font-size:12px;font-weight:800;margin-bottom:8px;color:var(--tx-i);">매출</div>
          <table><thead><tr><th>일자</th><th>거래처</th><th>품목</th><th style="text-align:right;">금액</th></tr></thead>
            <tbody>${smallRows(revRows.map(d=>`<tr><td>${d.deliveredAt||'—'}</td><td>${getClientName(d.clientId)}</td><td>${d.productName||getProductName(d.productId)}</td><td style="text-align:right;">${fmtW((d.price||0)*(d.qty||0))}</td></tr>`),'매출 내역이 없습니다.')}</tbody></table>
        </div>
        <div style="overflow-x:auto;">
          <div style="font-size:12px;font-weight:800;margin-bottom:8px;color:#e8590c;">매입/지출</div>
          <table><thead><tr><th>일자</th><th>공급처</th><th>품목</th><th style="text-align:right;">금액</th></tr></thead>
            <tbody>${smallRows(purRows.map(p=>`<tr><td>${p.date||'—'}</td><td>${esc(p.supplier)||'—'}</td><td>${esc(p.itemName)||'—'}</td><td style="text-align:right;">${fmtW((p.unitPrice||0)*(p.qty||0))}</td></tr>`),'매입 내역이 없습니다.')}</tbody></table>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <div style="font-size:12px;font-weight:800;margin-bottom:8px;">기타 수입/비용</div>
        <table><thead><tr><th>일자</th><th>구분</th><th>내용</th><th style="text-align:right;">금액</th></tr></thead>
          <tbody>${smallRows(etcRows.map(e=>`<tr><td>${e.date||'—'}</td><td>${esc(e.type)}</td><td>${esc(e.title)}</td><td style="text-align:right;">${fmtW(e.amount)}</td></tr>`),'기타 수입/비용이 없습니다.')}</tbody></table>
      </div>
    </div>`;
}
function _finPnl() {
  const months = finMonthList(finPnlMonths);
  let tRev=0, tPur=0, tLab=0, tInc=0, tExp=0, tNet=0;
  const rows = months.map(m => {
    const rev = finRevenueMonth(m.ym), pur = finPurchaseMonth(m.ym);
    const payroll = finPayrollMonthly(m.ym);
    const inc = finEntryMonth(m.ym,'수입'), exp = finEntryMonth(m.ym,'비용');
    const net = rev - pur - payroll - exp + inc;
    tRev+=rev; tPur+=pur; tLab+=payroll; tInc+=inc; tExp+=exp; tNet+=net;
    return `
      <tr onclick="toggleFinPnlDetail('${m.ym}')" style="cursor:pointer;${finPnlDetailMonth===m.ym?'outline:2px solid var(--br-i);':''}">
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
    <div class="toolbar" style="margin-bottom:10px;">
      <span style="font-size:11px;font-weight:700;color:var(--tx-s);">조회 범위</span>
      ${[6,12,24,36].map(n=>`<button class="btn btn-sm ${finPnlMonths===n?'btn-primary':''}" onclick="finPnlMonths=${n};renderFinance()">${n}개월</button>`).join('')}
      <button class="btn btn-sm" onclick="exportPnlXLS()" title="손익 엑셀 내보내기"><i class="ti ti-file-spreadsheet"></i></button>
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-report-money"></i>월별 손익계산 (최근 ${finPnlMonths}개월)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>월</th><th>매출</th><th>매입/지출</th><th>인건비</th><th>기타수입</th><th>기타비용</th><th>순이익</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid var(--br);font-weight:700;">
          <td>합계</td><td class="amt-blue">${fmtW(tRev)}</td><td style="color:#e8590c;">${fmtW(tPur)}</td>
          <td>${fmtW(tLab)}</td><td>${fmtW(tInc)}</td><td>${fmtW(tExp)}</td>
          <td style="color:${tNet>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(tNet)}</td>
        </tr></tfoot>
      </table></div>
      <div style="font-size:11px;color:var(--tx-t);margin-top:8px;">※ 인건비는 각 월의 저장된 급여명세서와 자동 계산 결과를 반영합니다.</div>
    </div>
    ${finPnlDetailHtml(finPnlDetailMonth)}`;
}

/* ── 미수금 / 미지급 ── */
function _finAR() {
  const state=finState('ar'), query=state.query.trim().toLowerCase();
  let arList=deliveries.filter(d=>{
    const total=(d.price||0)*(d.qty||0), payment=finPaymentRecord('ar',d.id,total);
    return finMatchDate(d.deliveredAt,state) && finMatchAmount(total,state) &&
      (!state.status || payment.status===state.status) &&
      (!query || [d.id,getClientName(d.clientId),d.productName,getProductName(d.productId)].join(' ').toLowerCase().includes(query));
  });
  arList=finSort(arList,state,d=>d.deliveredAt,d=>(d.price||0)*(d.qty||0));
  let arUnpaid = 0;
  arList.forEach(d=>{const total=(d.price||0)*(d.qty||0); arUnpaid+=finPaymentRecord('ar',d.id,total).remaining;});
  const arPage=finPaged(arList,state);
  const arBody = arPage.rows.length ? arPage.rows.map(d => {
    const amt = (d.price||0)*(d.qty||0);
    const payment = finPaymentRecord('ar', d.id, amt);
    return `
      <tr style="${payment.done?'opacity:.65;':''}">
        <td>${d.deliveredAt||'—'}</td>
        <td>${getClientName(d.clientId)}</td>
        <td>${d.productName||getProductName(d.productId)}</td>
        <td style="font-weight:700;text-align:right;">${fmtW(amt)}</td>
        <td style="text-align:right;color:var(--tx-ok);">${fmtW(payment.amount)}</td>
        <td style="text-align:right;color:${payment.remaining?'var(--tx-d)':'var(--tx-s)'};">${fmtW(payment.remaining)}</td>
        <td>${finPaymentStatusBadge('ar',payment)}</td>
        <td style="white-space:nowrap;">${payment.date ? esc(payment.date) : '—'}</td>
        <td>${payment.method ? esc(payment.method) : '—'}</td>
        <td><button class="btn btn-sm" onclick="openFinancePaymentModal('ar','${d.id}')"><i class="ti ti-cash-banknote"></i>${payment.amount?'수정':'수금 처리'}</button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="10">${empty('매출(납품) 내역이 없습니다.')}</td></tr>`;

  let apList=poList.filter(p=>{
    const total=(p.unitPrice||0)*(p.qty||0), payment=finPaymentRecord('ap',p.id,total);
    return finMatchDate(p.date,state) && finMatchAmount(total,state) &&
      (!state.status || payment.status===state.status) &&
      (!query || [p.id,p.supplier,p.itemName].join(' ').toLowerCase().includes(query));
  });
  apList=finSort(apList,state,p=>p.date,p=>(p.unitPrice||0)*(p.qty||0));
  let apUnpaid = 0;
  apList.forEach(p=>{const total=(p.unitPrice||0)*(p.qty||0); apUnpaid+=finPaymentRecord('ap',p.id,total).remaining;});
  const apPage=finPaged(apList,Object.assign({},state));
  const apBody = apPage.rows.length ? apPage.rows.map(p => {
    const amt = (p.unitPrice||0)*(p.qty||0);
    const payment = finPaymentRecord('ap', p.id, amt);
    return `
      <tr style="${payment.done?'opacity:.65;':''}">
        <td>${esc(p.date)||'—'}</td>
        <td>${esc(p.supplier)||'—'}</td>
        <td>${esc(p.itemName)||'—'}</td>
        <td style="font-weight:700;text-align:right;">${fmtW(amt)}</td>
        <td style="text-align:right;color:var(--tx-ok);">${fmtW(payment.amount)}</td>
        <td style="text-align:right;color:${payment.remaining?'var(--tx-d)':'var(--tx-s)'};">${fmtW(payment.remaining)}</td>
        <td>${finPaymentStatusBadge('ap',payment)}</td>
        <td style="white-space:nowrap;">${payment.date ? esc(payment.date) : '—'}</td>
        <td>${payment.method ? esc(payment.method) : '—'}</td>
        <td><button class="btn btn-sm" onclick="openFinancePaymentModal('ap','${p.id}')"><i class="ti ti-cash-banknote"></i>${payment.amount?'수정':'지급 처리'}</button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="10">${empty('매입(발주) 내역이 없습니다.')}</td></tr>`;

  return `
    ${finFilterBar('ar',{placeholder:'거래처·제품·품목·번호 검색',statuses:['미처리','부분','완료']})}
    <div class="metrics" style="grid-template-columns:repeat(2,1fr);">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-receipt"></i>미수 잔액 (받을 돈)</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(arUnpaid)}</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-receipt-off"></i>미지급 잔액 (줄 돈)</div><div class="mc-val" style="color:#e8590c;">${fmtW(apUnpaid)}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-receipt"></i>미수금 관리 (매출 채권)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>납품일</th><th>고객사</th><th>제품</th><th style="text-align:right;">총액</th><th style="text-align:right;">수금액</th><th style="text-align:right;">잔액</th><th>수금상태</th><th>수금일</th><th>방법</th><th>처리</th></tr></thead>
        <tbody>${arBody}</tbody>
      </table></div>${finPager('ar',arPage)}
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-receipt-off"></i>미지급금 관리 (매입 채무)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>발주일</th><th>공급처</th><th>품목</th><th style="text-align:right;">총액</th><th style="text-align:right;">지급액</th><th style="text-align:right;">잔액</th><th>지급상태</th><th>지급일</th><th>방법</th><th>처리</th></tr></thead>
        <tbody>${apBody}</tbody>
      </table></div>
    </div>`;
}

function openFinancePaymentModal(kind, id) {
  if (!checkAdminAction()) return;
  const isPayable = kind === 'ap';
  const item = isPayable ? poList.find(x=>x.id===id) : deliveries.find(x=>x.id===id);
  if (!item) return;
  const sourceDate = isPayable ? item.date : item.deliveredAt;
  if (!guardFinanceMonth(sourceDate)) return;
  const total = isPayable ? (item.unitPrice||0)*(item.qty||0) : (item.price||0)*(item.qty||0);
  const payment = finPaymentRecord(kind, id, total);
  const targetName = isPayable ? `${item.supplier || '공급처'} · ${item.itemName || ''}` : `${getClientName(item.clientId)} · ${item.productName || getProductName(item.productId)}`;
  inp('payment-kind').value = kind;
  inp('payment-id').value = id;
  inp('payment-modal-ttl').innerHTML = `<i class="ti ti-cash-banknote" style="color:var(--tx-i);"></i>${isPayable?'지급 처리':'수금 처리'}`;
  inp('payment-source-summary').innerHTML = `
    <div style="font-size:12px;font-weight:800;">${esc(targetName)}</div>
    <div style="margin-top:5px;color:var(--tx-s);font-size:11px;">총액 ${fmtW(total)} · 처리액 ${fmtW(payment.amount)} · 잔액 <b style="color:${payment.remaining?'var(--tx-d)':'var(--tx-ok)'};">${fmtW(payment.remaining)}</b></div>`;
  sv('payment-date', payment.date || today());
  sv('payment-amount', payment.remaining ? payment.remaining : payment.amount || total);
  sv('payment-method', payment.method || '계좌이체');
  sv('payment-note', payment.note || '');
  inp('payment-clear-btn').style.display = payment.amount ? '' : 'none';
  inp('payment-modal').classList.add('open');
}

function saveFinancePayment() {
  if (!checkAdminAction()) return;
  const kind = v('payment-kind'), id = v('payment-id');
  const isPayable = kind === 'ap';
  const item = isPayable ? poList.find(x=>x.id===id) : deliveries.find(x=>x.id===id);
  if (!item) return;
  const sourceDate = isPayable ? item.date : item.deliveredAt;
  if (!guardFinanceMonth(sourceDate)) return;
  const total = isPayable ? (item.unitPrice||0)*(item.qty||0) : (item.price||0)*(item.qty||0);
  const amount = Math.min(total, Math.max(0, Number(v('payment-amount')) || 0));
  if (amount <= 0) { showToast('처리 금액을 입력하세요.', 'error'); return; }
  finPaymentMap(kind)[id] = {
    amount,
    date:v('payment-date') || today(),
    method:v('payment-method') || '계좌이체',
    note:v('payment-note') || '',
    updatedAt:new Date().toISOString()
  };
  finAudit((isPayable?'지급':'수금') + (amount >= total ? ' 완료' : ' 부분 처리'), `${id} · ${amount.toLocaleString()}원`);
  saveStorage('financeData', financeData);
  closeModal('payment-modal');
  renderFinance();
}

function clearFinancePayment() {
  if (!checkAdminAction()) return;
  const kind = v('payment-kind'), id = v('payment-id');
  const isPayable = kind === 'ap';
  delete finPaymentMap(kind)[id];
  finAudit(isPayable?'지급 취소':'수금 취소', id);
  saveStorage('financeData', financeData);
  closeModal('payment-modal');
  renderFinance();
}

function toggleReceivable(id) { openFinancePaymentModal('ar', id); }
function togglePayable(id) { openFinancePaymentModal('ap', id); }

/* ── 기타 수입/비용 ── */
function _finEtc() {
  const state=finState('etc'), query=state.query.trim().toLowerCase();
  let list=financeData.entries.filter(e=>finMatchDate(e.date,state) && finMatchAmount(e.amount,state) && (!state.status || e.type===state.status) &&
    (!query || [e.id,e.category,e.title,e.note].join(' ').toLowerCase().includes(query)));
  list=finSort(list,state,e=>e.date,e=>Number(e.amount)||0);
  const inc=list.filter(e=>e.type==='수입').reduce((s,e)=>s+(Number(e.amount)||0),0);
  const exp=list.filter(e=>e.type==='비용').reduce((s,e)=>s+(Number(e.amount)||0),0);
  const page=finPaged(list,state);
  const body = page.rows.length ? page.rows.map(e => `
    <tr>
      <td>${esc(e.date)||'—'}</td>
      <td>${e.type==='수입'?'<span class="bd bd-ok">수입</span>':'<span class="bd bd-err">비용</span>'}</td>
      <td>${esc(e.category)||'기타'}</td>
      <td>${esc(e.title)||''}</td>
      <td style="font-weight:700;color:${e.type==='수입'?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(Number(e.amount)||0)}</td>
      <td>${esc(e.note)||''}</td>
      <td style="white-space:nowrap;"><button class="btn btn-sm" onclick="openFinanceEdit('${e.id}')" title="수정"><i class="ti ti-edit"></i></button> <button class="del-btn" onclick="deleteFinanceEntry('${e.id}')" title="삭제"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('') : `<tr><td colspan="7">${empty('등록된 기타 수입/비용 항목이 없습니다. 우측 상단 [기타 항목 등록] 버튼으로 추가하세요.')}</td></tr>`;
  return `
    ${finFilterBar('etc',{placeholder:'분류·내용·비고 검색',statuses:['수입','비용']})}
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-list-details"></i>기타 수입/비용 (직접 입력)</span>
        <span style="font-size:13px;">수입 <b style="color:var(--tx-ok);">${fmtW(inc)}</b> · 비용 <b style="color:var(--tx-err);">${fmtW(exp)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>일자</th><th>구분</th><th>분류</th><th>내용</th><th>금액</th><th>비고</th><th>관리</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>${finPager('etc',page)}
    </div>`;
}

function openFinanceAdd() {
  delete inp('finance-modal').dataset.editId;
  sv('fin-type', '비용');
  sv('fin-date', today());
  sv('fin-cat', '임대료');
  sv('fin-amount', '');
  sv('fin-title', '');
  sv('fin-note', '');
  inp('finance-modal').classList.add('open');
}
function openFinanceEdit(id){
  const item=financeData.entries.find(x=>x.id===id);if(!item)return;
  if(!guardFinanceMonth(item.date))return;
  inp('finance-modal').dataset.editId=id;
  sv('fin-type',item.type);sv('fin-date',item.date);sv('fin-cat',item.category);sv('fin-amount',item.amount);sv('fin-title',item.title);sv('fin-note',item.note||'');
  inp('finance-modal').classList.add('open');
}

function saveFinanceEntry() {
  if (!checkAdminAction()) return;
  const title = v('fin-title').trim();
  const amount = Number(v('fin-amount')) || 0;
  if (!title)    { showToast('내용을 입력하세요.', 'error'); return; }
  if (amount <= 0) { showToast('금액을 입력하세요.', 'error'); return; }
  if (!guardFinanceMonth(v('fin-date') || today())) return;
  const editId=inp('finance-modal').dataset.editId;
  const duplicate=financeData.entries.find(e=>e.id!==editId&&e.date===(v('fin-date')||today())&&e.title===title&&Number(e.amount)===amount);
  if(duplicate&&!confirm('같은 날짜·내용·금액의 항목이 이미 있습니다. 그래도 저장하시겠습니까?'))return;
  const data={
    type: v('fin-type') || '비용',
    date: v('fin-date') || today(),
    category: v('fin-cat') || '기타',
    title, amount,
    note: v('fin-note') || ''
  };
  if(editId){const item=financeData.entries.find(x=>x.id===editId);if(item)Object.assign(item,data);delete inp('finance-modal').dataset.editId;}
  else financeData.entries.push(Object.assign({id:nextCode('FIN',financeData.entries)},data));
  finAudit('기타 '+(v('fin-type')||'비용')+(editId?' 수정':' 등록'),`${title} · ${amount.toLocaleString()}원`);
  saveStorage('financeData', financeData);
  closeModal('finance-modal');
  if (currentPage === 'finance') { financeTab = 'etc'; renderFinance(); }
  showToast('기타 항목이 등록되었습니다.');
}

function deleteFinanceEntry(id) {
  if (!checkAdminAction()) return;
  const e = financeData.entries.find(x => x.id === id);
  if (!e) return;
  if (!guardFinanceMonth(e.date)) return;
  confirm_('기타 항목 삭제', `<strong>[${e.title}]</strong> 항목을 삭제하시겠습니까?`, () => {
    financeData.entries = financeData.entries.filter(x => x.id !== id);
    finAudit('기타 항목 삭제',`${e.title} · ${e.amount}`);
    saveStorage('financeData', financeData);
    renderFinance();
    showToast('항목이 삭제되었습니다.');
  });
}

/* 현재 페이지에 알맞는 신규 등록 팝업 창 호출 컨트롤러 */
function registrationFn(name, args = []) {
  return function() {
    const fn = (typeof window !== 'undefined' ? window[name] : globalThis[name]);
    if (typeof fn !== 'function') {
      if (typeof showToast === 'function') showToast('등록 기능을 찾을 수 없습니다.', 'error');
      return;
    }
    return fn.apply(null, args);
  };
}
function currentPageRegistrationConfig() {
  const statementType = currentPage === 'taxinvoice' ? 'tax' : 'statement';
  const salesType = typeof salesTab !== 'undefined' ? salesTab : 'quote';
  const configs = {
    clients:   { fnName: 'openClientAdd', tableKeys: ['clients'] },
    materials: { fnName: 'openMatAdd', tableKeys: ['materials'] },
    orders:    { fnName: 'openOrderAdd', tableKeys: ['orders'] },
    inventory: { fnName: 'openInvAdd', tableKeys: ['inventory'] },
    quality:   { fnName: 'openDefectAdd', tableKeys: ['defects'] },
    claims:    { fnName: 'openClaimAdd', tableKeys: ['claims'] },
    as:        { fnName: 'openAsAdd', tableKeys: ['as'] },
    workers:   { fnName: 'openEmployeeAdd', tableKeys: ['workers'] },
    rfq:       { fnName: 'openRfqAdd', tableKeys: ['rfq'] },
    po:        { fnName: 'openPoAdd', tableKeys: ['po'] },
    statement: { fnName: 'openSalesDocAdd', args: [statementType], tableKeys: ['statement'] },
    taxinvoice:{ fnName: 'openSalesDocAdd', args: [statementType], tableKeys: ['tax'] },
    salesdoc:  { fnName: 'openSODocAdd', args: [salesType], tableKeys: [salesType === 'order' ? 'order' : 'quote'] },
    partners:  { fnName: 'openPartnerModal', tableKeys: ['partners'] },
    alerts:    { fnName: 'openAlertAdd', tableKeys: [] },
    finance:   { fnName: 'openFinancePrimaryAction', tableKeys: [] }
  };
  if (currentPage === 'finance') {
    const activeFinanceTab = typeof financeTab !== 'undefined' ? financeTab : '';
    if (!['etc','fixed'].includes(activeFinanceTab)) return null;
  }
  const cfg = configs[currentPage];
  return cfg ? Object.assign({}, cfg, { fn: registrationFn(cfg.fnName, cfg.args || []) }) : null;
}
function canOpenCurrentPageRegistration(config) {
  if (typeof pageAllowed === 'function' && !pageAllowed(currentPage)) {
    showToast('현재 화면 접근 권한이 없습니다.', 'error');
    return false;
  }
  if (!config || typeof config.fn !== 'function') {
    showToast('현재 화면에는 등록 단축키가 없습니다.', 'info');
    return false;
  }
  if (typeof registrationActionAllowed === 'function' && !registrationActionAllowed(config.tableKeys)) {
    showToast('등록 권한이 없습니다.', 'error');
    return false;
  }
  if (typeof registrationActionAllowed !== 'function' && typeof roleFeatureAllowed === 'function' && !roleFeatureAllowed('create')) {
    showToast('등록 권한이 없습니다.', 'error');
    return false;
  }
  return true;
}
function openCurrentPageRegistration() {
  const registration = currentPageRegistrationConfig();
  if (!canOpenCurrentPageRegistration(registration)) return;
  registration.fn();
  focusFirstModalField();
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
