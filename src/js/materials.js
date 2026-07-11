/* ════════ [복구] 자재 수급/발주 (materials) ════════ */
function syncFilterDropdowns() {
  const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const fc = inp('mat-fc');
  if (fc) {
    const cur = fc.value;
    fc.innerHTML = '<option value="">전체 의뢰 고객사</option>' + visibleClients.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===cur?' selected':'')+'>'+esc(c.name)+'</option>').join('');
  }
  const fp = inp('mat-fp');
  if (fp) {
    const cur = fp.value;
    fp.innerHTML = '<option value="">전체 제품 목록</option>' + visibleProducts.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===cur?' selected':'')+'>'+esc(p.name)+'</option>').join('');
  }
}
function getMaterialsReactState() {
  return {
    materials,
    clients,
    products,
    sortState: sortState.materials
  };
}

function onMatClientChange() {
  const cid = v('mat-fc');
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const fp = inp('mat-fp');
  if (fp) fp.innerHTML = '<option value="">전체 제품 목록</option>' + visibleProducts.filter(p=>!cid||p.clientId===cid).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  renderMaterials();
}
function onAddMatClientChange() {
  const cid = v('ma-client');
  const sel = inp('ma-product');
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  if (sel) sel.innerHTML = '<option value="">-- 품목 선택 --</option>' + visibleProducts.filter(p=>!cid||p.clientId===cid).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  if (typeof syncClientFieldDisplay === 'function') syncClientFieldDisplay('ma-client', 'ma-client-search');
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('ma-product', 'ma-product-search');
}
registerBulkEntryTable('mat', {
  layout: 'sharedLabels',
  head: 'mat-bulk-head',
  body: 'mat-bulk-body',
  minRows: 1,
  fields: [
    { name: 'name', label: '자재명', type: 'text', placeholder: '자재명', required: true },
    { name: 'spec', label: '규격', type: 'text', placeholder: '규격/사양' },
    { name: 'supplier', label: '공급처', type: 'text', placeholder: '공급처' },
    { name: 'qty', label: '수량', type: 'number', min: 0, step: '0.01', default: '1', required: true },
    { name: 'unit', label: '단위', type: 'select', default: 'EA', options: ['EA','대','SET','kg','M','L','BOX','ton'] },
    { name: 'unitPrice', label: '단가', type: 'number', min: 0, step: 1, placeholder: '0' },
    { name: 'expectedDate', label: '입고예정일', type: 'date' },
    { name: 'status', label: '상태', type: 'select', default: '발주전', options: ['발주전','발주중','입고완료','지연'] },
    { name: 'note', label: '참고', type: 'text', placeholder: '비고' }
  ]
});
function materialCodeRefs() {
  const refs = [];
  const add = value => {
    const id = String(value || '').trim();
    if (id) refs.push({ id });
  };
  if (typeof materials !== 'undefined' && Array.isArray(materials)) materials.forEach(m => add(m && m.id));
  if (typeof trash !== 'undefined' && Array.isArray(trash)) {
    trash.forEach(item => {
      if (!item || item.type !== 'material') return;
      add(item.originalId);
      if (item.data && typeof item.data === 'object') add(item.data.id);
    });
  }
  const auditSources = [];
  if (typeof auditLog !== 'undefined' && Array.isArray(auditLog)) auditSources.push(auditLog);
  if (typeof financeData === 'object' && financeData && Array.isArray(financeData.auditLog)) auditSources.push(financeData.auditLog);
  if (typeof serverAuditLogCache !== 'undefined' && Array.isArray(serverAuditLogCache)) auditSources.push(serverAuditLogCache);
  auditSources.forEach(source => {
    source.forEach(log => {
      const type = String(log && log.entityType || '').trim();
      if (type === 'material' || type === 'materials') add(log.entityId);
    });
  });
  return refs;
}
function nextMaterialCode() {
  return nextCode('MT', materialCodeRefs());
}
function materialCodeExistsAnywhere(id) {
  const code = String(id || '').trim();
  return !!code && materialCodeRefs().some(ref => ref.id === code);
}
function setMaterialEntryMode(mode) {
  const bulk = mode === 'bulk';
  setBulkEntryMode('mat', bulk);
  const saveBtn = inp('mat-save-btn');
  if (saveBtn && !editMatId) saveBtn.innerHTML = bulk ? '<i class="ti ti-check"></i>일괄 등록' : '<i class="ti ti-check"></i>등록';
}
function renderMaterials() {
  ensureDateView('materials', 'mat-table', materials.map(m=>m.orderDate), renderMaterials);
  const visibleMaterials = materials.filter(m => canViewRecord(m, 'material'));
  const before = visibleMaterials.filter(m=>m.status==='발주전').length;
  const shipping = visibleMaterials.filter(m=>m.status==='발주중'||m.status==='지연').length;
  const done = visibleMaterials.filter(m=>m.status==='입고완료').length;
  const totalAmt = visibleMaterials.reduce((s,m)=>s+getMatAmt(m),0);
  const kpi = inp('mat-kpi');
  if (kpi) {
    const fsCur = v('mat-fs') || '';
    // 클릭 가능한 상태 카드: 클릭 시 mat-fs 필터를 토글(다시 클릭 시 전체 복구)
    const card = (status, label, iconHtml, cnt, valColor) =>
      '<div class="mc clickable'+(fsCur===status?' kpi-active':'')+'" onclick="kpiFilter(\'mat-fs\',\''+status+'\',\'renderMaterials\')">' +
      '<div class="mc-lbl">'+iconHtml+label+'</div>' +
      '<div class="mc-val"'+(valColor?' style="color:'+valColor+'"':'')+'>'+cnt+'건</div></div>';
    kpi.innerHTML =
      card('발주전', '발주 전 대기', '<i class="ti ti-circle-dashed"></i>', before, '') +
      card('발주중', '외주 배송중', '<i class="ti ti-truck-delivery" style="color:var(--tx-i);"></i>', shipping, 'var(--tx-i)') +
      card('입고완료', '창고 입고 완료', '<i class="ti ti-circle-check" style="color:var(--tx-ok);"></i>', done, 'var(--tx-ok)') +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-coin"></i>예산 소요 규모</div><div class="mc-val">'+fmtW(totalAmt)+'</div></div>';
  }

  const fc=v('mat-fc'), fp=v('mat-fp'), fs=v('mat-fs'), q=(v('mat-q')||'').toLowerCase();
  let rows = visibleMaterials.filter(m => {
    if (!dateViewMatch('materials', m.orderDate)) return false;
    const prod = getProductById(m.productId);
    if (fc && (!prod || prod.clientId !== fc)) return false;
    if (fp && m.productId !== fp) return false;
    if (fs && m.status !== fs) return false;
    const cname = getClientName(prod?.clientId);
    if (q && !m.id.toLowerCase().includes(q) && !(m.name||'').toLowerCase().includes(q) && !(m.supplier||'').toLowerCase().includes(q) && !getProductName(m.productId).toLowerCase().includes(q) && !cname.toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.materials.key) {
    const k = sortState.materials.key;
    const asc = sortState.materials.asc ? 1 : -1;
    rows.sort((a, b) => {
      let va, vb;
      if (k === 'client') {
        va = getClientName(getProductById(a.productId)?.clientId);
        vb = getClientName(getProductById(b.productId)?.clientId);
      } else if (k === 'product') {
        va = getProductName(a.productId);
        vb = getProductName(b.productId);
      } else if (k === 'totalAmt') {
        va = getMatAmt(a);
        vb = getMatAmt(b);
      } else {
        va = a[k] == null ? '' : a[k];
        vb = b[k] == null ? '' : b[k];
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * asc;
      }
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const cont = inp('mat-table');
  if (!cont) return;
  if (!rows.length) { cont.innerHTML = empty('자재 발주 내역이 없습니다.'); return; }
  const sColor = {발주전:'var(--tx-t)',발주중:'var(--tx-i)',입고완료:'var(--tx-ok)',지연:'var(--tx-d)'};
  // editField/editType: 인라인 편집 대상 헤더에 부여 (열 순서가 바뀌어도 필드 기준으로 편집)
  const thSort = (key, label) => {
    const ef = '';
    return '<th onclick="toggleSort(\'materials\',\''+key+'\')" style="cursor:pointer;user-select:none;"'+ef+'>'+label+' '+sortIcon('materials',key)+'</th>';
  };
  cont.innerHTML = '<table style="min-width:1080px;"><thead><tr>' +
    thSort('id','자재코드') + thSort('client','구분고객사') + thSort('product','매칭제품') +
    thSort('name','자재품명','name','text') + thSort('supplier','협력공급처','supplier','text') + thSort('unitPrice','구매단가','unitPrice','number') +
    thSort('qty','수량','qty','number') + thSort('totalAmt','매입총액') + thSort('orderDate','주문일자','orderDate','date') +
    thSort('expectedDate','입고예정일','expectedDate','date') + thSort('status','진행상황') + thSort('note','참고사항','note','textarea') +
    '<th>관리작업</th>' +
    '</tr></thead><tbody>' + rows.map(m=>{
      const prod = getProductById(m.productId);
      const cname = prod ? getClientName(prod.clientId) : '—';
      const statusClass = typeof selectionDetailStatusClass === 'function' ? selectionDetailStatusClass(m.status) : '';
      return '<tr>' +
        '<td>'+esc(m.id)+'</td>' +
        '<td>'+esc(cname)+'</td>' +
        '<td style="font-weight:600;font-size:11px;">'+esc(getProductName(m.productId))+'</td>' +
        '<td style="font-weight:700;">'+esc(m.name)+(m.spec?'<div style="font-size:10.5px;color:var(--tx-t);font-weight:500;">'+esc(m.spec)+'</div>':'')+'</td>' +
        '<td>'+(esc(m.supplier)||'—')+'</td>' +
        '<td style="font-weight:600;">'+fmtW(m.unitPrice)+'</td>' +
        '<td>'+esc(m.qty)+' '+esc(m.unit)+'</td>' +
        '<td style="font-weight:700;color:var(--tx-i);">'+fmtW(getMatAmt(m))+'</td>' +
        '<td>'+(esc(m.orderDate)||'—')+'</td>' +
        '<td>'+(esc(m.expectedDate)||'—')+'</td>' +
        '<td><span class="readonly-status-pill '+statusClass+'">'+esc(m.status||'—')+'</span><select class="stat-sel readonly-status-source" aria-hidden="true" tabindex="-1" style="color:'+(sColor[m.status]||'')+'" onchange="changeMatStatus(\''+esc(m.id)+'\',this.value)">' +
          ['발주전','발주중','입고완료','지연'].map(s=>'<option'+(s===m.status?' selected':'')+'>'+s+'</option>').join('') +
        '</select></td>' +
        '<td style="font-size:11px;color:var(--tx-t);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(m.note||'')+'">'+(esc(m.note)||'—')+'</td>' +
        '<td style="white-space:nowrap;"><button class="edit-btn" onclick="openMatEdit(\''+m.id+'\')"><i class="ti ti-edit"></i>수정</button>' +
        '<button class="del-btn" style="margin-left:4px;" onclick="deleteMat(\''+m.id+'\')"><i class="ti ti-trash"></i></button></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
  if (typeof initMatInlineEdit === 'function') setTimeout(initMatInlineEdit, 0);
}
function openMatAdd() {
  if (typeof requireCreateAction === 'function' && !requireCreateAction('materials', '자재 발주 등록')) return;
  editMatId = null;
  inp('mat-modal-ttl').innerHTML = '<i class="ti ti-package-import" style="color:var(--tx-i);"></i>자재 수급/발주 등록';
  sv('ma-id', nextMaterialCode());
  fillClientSelect('ma-client', false);
  sv('ma-client', v('mat-fc') || clients[0]?.id || '');
  onAddMatClientChange();
  if (v('mat-fp')) sv('ma-product', v('mat-fp'));
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('ma-product', 'ma-product-search');
  ['ma-name','ma-spec','ma-supplier','ma-price','ma-qty','ma-note'].forEach(x=>sv(x,''));
  sv('ma-unit','EA'); sv('ma-status','발주전'); sv('ma-odate', today()); sv('ma-edate','');
  initBulkEntryTable('mat');
  setMaterialEntryMode('bulk');
  const mode = inp('mat-mode-switch'); if (mode) mode.style.display = '';
  inp('mat-modal').classList.add('open');
}
function openMatEdit(id) {
  const m = materials.find(x=>x.id===id); if (!m) return;
  if (!requireRecordPermission('edit', m, 'material')) return;
  editMatId = id;
  inp('mat-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>자재 발주 수정';
  const saveBtn = inp('mat-save-btn'); if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i>수정';
  sv('ma-id', m.id);
  const prod = getProductById(m.productId);
  fillClientSelect('ma-client', false);
  sv('ma-client', prod?prod.clientId:'');
  onAddMatClientChange();
  sv('ma-product', m.productId);
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('ma-product', 'ma-product-search');
  sv('ma-name', m.name); sv('ma-spec', m.spec||''); sv('ma-supplier', m.supplier||'');
  sv('ma-price', m.unitPrice||0); sv('ma-qty', m.qty||0);
  sv('ma-unit', m.unit||'EA'); sv('ma-status', m.status);
  sv('ma-odate', m.orderDate||''); sv('ma-edate', m.expectedDate||''); sv('ma-note', m.note||'');
  setMaterialEntryMode('single');
  const mode = inp('mat-mode-switch'); if (mode) mode.style.display = 'none';
  inp('mat-modal').classList.add('open');
}
function cloneMat(id) {
  if (!checkAdminAction()) return;
  const m = materials.find(x=>x.id===id); if (!m) return;
  editMatId = null;
  inp('mat-modal-ttl').innerHTML = '<i class="ti ti-copy" style="color:var(--tx-i);"></i>자재 발주 복제 등록';
  sv('ma-id', nextMaterialCode());
  const prod = getProductById(m.productId);
  fillClientSelect('ma-client', false);
  sv('ma-client', prod?prod.clientId:'');
  onAddMatClientChange();
  sv('ma-product', m.productId);
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('ma-product', 'ma-product-search');
  sv('ma-name', m.name); sv('ma-spec', m.spec||''); sv('ma-supplier', m.supplier||'');
  sv('ma-price', m.unitPrice||0); sv('ma-qty', m.qty||0);
  sv('ma-unit', m.unit||'EA'); sv('ma-status', '발주전');
  sv('ma-odate', today()); sv('ma-edate', m.expectedDate||''); sv('ma-note', m.note||'');
  setMaterialEntryMode('single');
  const mode = inp('mat-mode-switch'); if (mode) mode.style.display = '';
  inp('mat-modal').classList.add('open');
}
function saveMaterialForm() {
  if (!checkAdminAction()) return;
  if (!editMatId && isBulkEntryMode('mat')) {
    if (typeof requireCreateAction === 'function' && !requireCreateAction('materials', '자재 발주 등록')) return;
    const productId = v('ma-product');
    if (!productId) { showToast('해당 품목 제품을 선택해주세요.', 'error'); return; }
    const rows = readBulkEntryTable('mat');
    if (!rows.length) { showToast('등록할 자재 행을 입력해주세요.', 'error'); return; }
    const invalid = rows.find(r => !r.name.trim() || (parseFloat(r.qty) || 0) <= 0);
    if (invalid) { showToast('자재명과 수량은 각 행에 필요합니다.', 'error'); return; }
    rows.slice().reverse().forEach(r => {
      const item = stampRecordCreate({
        id: nextMaterialCode(),
        productId,
        name: r.name.trim(),
        spec: r.spec.trim(),
        supplier: r.supplier.trim(),
        unitPrice: parseInt(r.unitPrice) || 0,
        qty: parseFloat(r.qty) || 0,
        unit: r.unit || 'EA',
        orderDate: v('ma-odate'),
        expectedDate: r.expectedDate,
        status: r.status || '발주전',
        note: r.note.trim()
      }, 'material');
      materials.unshift(item);
      writeAuditLog('material', item.id, 'create', null, item, { summary:'자재 발주 일괄 등록', source:'bulkAction' });
    });
    saveStorage('materials', materials);
    closeModal('mat-modal');
    renderMaterials();
    if (typeof scanAndGenerateAlerts === 'function') scanAndGenerateAlerts();
    showToast(`자재 발주 ${rows.length}건이 등록되었습니다.`);
    return;
  }
  const name = v('ma-name').trim();
  if (!name) { showToast('자재명은 필수입니다.', 'error'); return; }
  const requestedId = String(v('ma-id') || '').trim();
  if (!editMatId && requestedId && materialCodeExistsAnywhere(requestedId)) {
    showToast('이미 사용된 자재코드입니다. 삭제/휴지통 이력에 있는 번호도 다시 사용할 수 없습니다.', 'error');
    sv('ma-id', nextMaterialCode());
    return;
  }
  const obj = {
    id: editMatId || requestedId || nextMaterialCode(),
    productId: v('ma-product'), name, spec: v('ma-spec').trim(), supplier: v('ma-supplier'),
    unitPrice: parseInt(v('ma-price'))||0, qty: parseInt(v('ma-qty'))||0,
    unit: v('ma-unit')||'EA', orderDate: v('ma-odate'), expectedDate: v('ma-edate'),
    status: v('ma-status'), note: v('ma-note')
  };
  if (editMatId) {
    const i = materials.findIndex(m=>m.id===editMatId);
    if (i>=0) {
      const before = _safeJsonClone(materials[i]);
      if (!requireRecordPermission('edit', before, 'material')) return;
      materials[i] = stampRecordUpdate(Object.assign({}, materials[i], obj), before, 'material');
      writeAuditLog('material', editMatId, 'update', before, materials[i], { summary:'자재 발주 수정' });
    }
  }
  else {
    if (typeof requireCreateAction === 'function' && !requireCreateAction('materials', '자재 발주 등록')) return;
    const item = stampRecordCreate(obj, 'material');
    materials.unshift(item);
    writeAuditLog('material', item.id, 'create', null, item, { summary:'자재 발주 등록' });
  }
  saveStorage('materials', materials);
  closeModal('mat-modal');
  renderMaterials();
  if (typeof scanAndGenerateAlerts === 'function') scanAndGenerateAlerts();
  showToast(editMatId ? '자재 발주가 수정되었습니다.' : '자재 발주가 등록되었습니다.');
}
function saveMaterialFromReact(payload) {
  payload = payload || {};
  const form = payload.form || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const editingId = payload.mode === 'edit' ? String(payload.editId || '') : '';
  const beforeCount = materials.length;
  const beforeRecord = editingId ? JSON.stringify(materials.find(m => m.id === editingId) || null) : '';
  editMatId = editingId || null;
  sv('ma-id', form.id || (editingId || nextMaterialCode()));
  if (typeof fillClientSelect === 'function') fillClientSelect('ma-client', false);
  sv('ma-client', form.clientId || '');
  if (typeof onAddMatClientChange === 'function') onAddMatClientChange();
  sv('ma-product', form.productId || '');
  sv('ma-odate', form.orderDate || today());
  sv('ma-name', form.name || '');
  sv('ma-spec', form.spec || '');
  sv('ma-supplier', form.supplier || '');
  sv('ma-price', form.unitPrice == null ? '' : form.unitPrice);
  sv('ma-qty', form.qty == null ? '' : form.qty);
  sv('ma-unit', form.unit || 'EA');
  sv('ma-status', form.status || '발주전');
  sv('ma-edate', form.expectedDate || '');
  sv('ma-note', form.note || '');
  if (!editingId && payload.bulk) {
    initBulkEntryTable('mat', rows);
    setMaterialEntryMode('bulk');
  } else {
    setMaterialEntryMode('single');
  }
  saveMaterialForm();
  if (editingId) return beforeRecord !== JSON.stringify(materials.find(m => m.id === editingId) || null);
  return materials.length > beforeCount;
}
function changeMatStatus(id, status) {
  const m = materials.find(x=>x.id===id); if (!m) return;
  if (!roleFeatureAllowed('status') || !requireRecordPermission('edit', m, 'material')) return;
  const before = _safeJsonClone(m);
  const prevStatus = m.status;
  m.status = status;
  stampRecordUpdate(m, before, 'material');
  saveStorage('materials', materials);
  writeAuditLog('material', id, 'statusChange', before, m, { summary:`자재 발주 상태 변경: ${prevStatus || ''} → ${status}` });

  if (status === '입고완료' && prevStatus !== '입고완료') {
    const invItem = inventory.find(function(i) { return i.name === m.name; });
    if (invItem) {
      const invBefore = _safeJsonClone(invItem);
      const beforeQty = Number(invItem.qty) || 0;
      invItem.qty = (invItem.qty || 0) + (m.qty || 0);
      stampRecordUpdate(invItem, invBefore, 'inventory');
      saveStorage('inventory', inventory);
      logInventoryMove(invItem.id, '입고', m.qty, '자재발주 입고 (' + m.id + ')', m.id, { beforeQty, afterQty:invItem.qty });
      writeAuditLog('inventory', invItem.id, 'update', invBefore, invItem, { summary:'자재발주 입고 재고 반영', reason:m.id });
      showToast('재고 자동 반영: ' + m.name + ' +' + m.qty + (m.unit||''));
    } else {
      showToast('입고완료 처리됨. 재고 탭에서 품목을 추가하세요.', 'info');
    }
    if (typeof sendAlimtalkMaterialIn === 'function') sendAlimtalkMaterialIn(m);
  }

  renderMaterials();
}
function deleteMat(id) {
  if (!checkAdminAction()) return;
  const m = materials.find(x=>x.id===id); if (!m) return;
  if (!requireRecordPermission('delete', m, 'material')) return;
  if (!confirm('이 자재 발주를 삭제하시겠습니까?')) return;
  pushToTrash('material', m);
  materials = materials.filter(x=>x.id!==id);
  writeAuditLog('material', id, 'delete', m, null, { summary:'자재 발주 삭제' });
  saveStorage('materials', materials);
  renderMaterials();
  showToast('자재 발주가 휴지통으로 이동되었습니다.');
}
function exportMatCSV() {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('자재 발주 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['자재코드','제품','자재명','규격','공급처','단가','수량','총액','주문일','입고예정','상태','비고'];
  const source = typeof visibleRecords === 'function' ? visibleRecords(materials, 'material') : materials;
  const rows = source.map(m=>[m.id, getProductName(m.productId), m.name, m.spec||'', m.supplier||'', m.unitPrice||0, m.qty, getMatAmt(m), m.orderDate||'', m.expectedDate||'', m.status, m.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([h, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, '자재발주');
  XLSX.writeFile(wb, '자재발주_' + today() + '.xlsx');
  showToast('엑셀 저장 완료');
}
function importPoXLS(input) {
  showToast('발주서 XLS 가져오기는 현재 비활성화 상태입니다. 수동 등록을 이용해 주세요.', 'info');
  if (input) input.value = '';
}
