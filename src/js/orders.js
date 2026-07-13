/* ════════ [복구] 생산 지시 (renderOrders) ════════ */
function renderOrders() {
  ensureDateView('orders', 'orders-table', workOrders.map(o=>o.start), renderOrders);
  const visibleOrders = workOrders.filter(o => canViewRecord(o, 'workOrder'));
  const totalQty = visibleOrders.reduce((s,o)=>s+(o.qty||0),0);
  const totalDone = visibleOrders.reduce((s,o)=>s+(o.done||0),0);
  const inProg = visibleOrders.filter(o=>o.status==='진행중').length;
  const doneCnt = visibleOrders.filter(o=>o.status==='완료').length;
  const delayCnt = visibleOrders.filter(o=>o.status==='지연').length;
  const summ = inp('orders-summary');
  if (summ) {
    const fsCur = v('orders-fs') || '';
    // 클릭 시 orders-fs 필터 토글(같은 값 재클릭 시 전체 복구) + 활성 박스 강조
    // 0값 색 규칙: 카운트가 0이면 상태색 대신 중립색을 쓴다(색은 값>0일 때만 상태 의미).
    // 중립색은 --tx-s(대비 6.7:1)를 써서 저대비 --tx-t(2.97:1, AA 미달)를 피한다.
    const sbox = (status, label, cnt, color, icon) => {
      const c = cnt > 0 ? color : 'var(--tx-s)';
      return '<div class="sum-box clickable'+(fsCur===status?' kpi-active':'')+'" onclick="kpiFilter(\'orders-fs\',\''+status+'\',\'renderOrders\')">' +
      '<i class="ti '+icon+' si" style="color:'+c+';"></i><div><div class="sn" style="color:'+c+';">'+cnt+'건</div><div class="sl">'+label+'</div></div></div>';
    };
    summ.innerHTML =
      sbox('진행중', '진행중', inProg, '#185FA5', 'ti-loader') +
      sbox('완료', '완료', doneCnt, 'var(--tx-ok)', 'ti-circle-check') +
      sbox('지연', '지연', delayCnt, 'var(--tx-d)', 'ti-alert-triangle') +
      '<div class="sum-box"><i class="ti ti-chart-bar si" style="color:var(--tx-i);"></i><div><div class="sn">'+(totalQty?Math.round(totalDone/totalQty*100):0)+'%</div><div class="sl">전체 진행률</div></div></div>';
  }

  const q=(v('orders-q')||'').toLowerCase(), fs=v('orders-fs')||'';
  let fil = visibleOrders.filter(o=>{
    if (!dateViewMatch('orders', o.start)) return false;
    if (fs && o.status!==fs) return false;
    if (q && ![o.id, o.manager||'', getProductName(o.productId), getClientName(o.clientId)].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.orders.key) {
    const k = sortState.orders.key;
    const asc = sortState.orders.asc ? 1 : -1;
    fil.sort((a, b) => {
      let va, vb;
      if (k === 'client') {
        va = getClientName(a.clientId);
        vb = getClientName(b.clientId);
      } else if (k === 'product') {
        va = getProductName(a.productId);
        vb = getProductName(b.productId);
      } else if (k === 'progress') {
        va = a.qty > 0 ? a.done / a.qty : 0;
        vb = b.qty > 0 ? b.done / b.qty : 0;
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

  const el = inp('orders-table'); if (!el) return;
  if (!fil.length) { el.innerHTML = empty('발행된 생산 지시서가 없습니다.'); return; }

  el.innerHTML = `
    <table data-bulk="1" class="narrow-compact-table orders-compact-table">
      <colgroup>
        <col style="width:34px;">
        <col style="width:88px;">
        <col style="width:130px;">
        <col style="width:260px;">
        <col style="width:70px;">
        <col style="width:64px;">
        <col style="width:76px;">
        <col style="width:58px;">
        <col style="width:84px;">
        <col style="width:96px;">
        <col style="width:110px;">
        <col style="width:88px;">
        <col style="width:84px;">
        <col style="width:58px;">
      </colgroup>
      <thead>
        <tr>
          <th class="orders-row-select-th" style="width:34px;text-align:center;"><input type="checkbox" class="table-check-all" title="현재 표 전체 선택" onclick="bulkToggleAll('orders',this.checked)"></th>
          <th data-oidx="0" onclick="toggleSort('orders', 'id')" style="cursor:pointer; user-select:none; width:88px;">지시번호 ${sortIcon('orders', 'id')}</th>
          <th data-oidx="1" onclick="toggleSort('orders', 'client')" style="cursor:pointer; user-select:none;">고객사 ${sortIcon('orders', 'client')}</th>
          <th data-oidx="2" onclick="toggleSort('orders', 'product')" style="cursor:pointer; user-select:none;">생산 제품 ${sortIcon('orders', 'product')}</th>
          <th data-oidx="3" onclick="toggleSort('orders', 'line')" style="cursor:pointer; user-select:none; width:70px;">라인 ${sortIcon('orders', 'line')}</th>
          <th data-oidx="4" onclick="toggleSort('orders', 'qty')" style="cursor:pointer; user-select:none; width:64px;">목표량 ${sortIcon('orders', 'qty')}</th>
          <th data-oidx="5" onclick="toggleSort('orders', 'done')" style="cursor:pointer; user-select:none; width:76px;">실적량 ${sortIcon('orders', 'done')}</th>
          <th data-oidx="6" onclick="toggleSort('orders', 'defect')" style="cursor:pointer; user-select:none; width:58px;">불량 ${sortIcon('orders', 'defect')}</th>
          <th data-oidx="7" onclick="toggleSort('orders', 'start')" style="cursor:pointer; user-select:none; width:84px;">개시일 ${sortIcon('orders', 'start')}</th>
          <th data-oidx="8" onclick="toggleSort('orders', 'due')" style="cursor:pointer; user-select:none; width:96px;">납기일 ${sortIcon('orders', 'due')}</th>
          <th data-oidx="9" onclick="toggleSort('orders', 'progress')" style="cursor:pointer; user-select:none; width:110px;" title="실적량 ÷ 목표량으로 자동 계산됩니다.">진행률 ${sortIcon('orders', 'progress')}</th>
          <th data-oidx="10" onclick="toggleSort('orders', 'status')" style="cursor:pointer; user-select:none; width:88px;">상태 ${sortIcon('orders', 'status')}</th>
          <th data-oidx="11" onclick="toggleSort('orders', 'manager')" style="cursor:pointer; user-select:none; width:84px;">담당자 ${sortIcon('orders', 'manager')}</th>
          <th data-oidx="12" style="width:58px;">메모</th>
        </tr>
      </thead>
      <tbody>
        ${fil.map(o => {
          const pct = o.qty > 0 ? Math.round(o.done/o.qty*100) : 0;
          const statusColor = {진행중:'var(--tx-i)',완료:'var(--tx-ok)',지연:'var(--tx-d)',대기:'var(--tx-t)'}[o.status]||'var(--tx-t)';
          const rowBg = o.status==='지연' ? 'background:rgba(240,62,62,.03);' : o.status==='완료' ? 'background:rgba(55,178,77,.03);' : '';
          const hasNote = !!(o.note||'').trim();
          return `
            <tr style="${rowBg}">
              <td class="orders-row-select-td" style="width:34px;text-align:center;"><input type="checkbox" class="table-row-select" data-bid="${esc(o.id)}" title="행 선택" onclick="bulkToggle('orders','${o.id}',this.checked)"></td>
              <td style="font-family:monospace; font-size:11px; font-weight:700;">
                <button type="button" class="order-id-link" onclick="openOrderEdit('${o.id}')" title="생산 지시 수정">${esc(o.id)}</button>
              </td>
              <td style="font-weight:600;">${esc(getClientName(o.clientId))}</td>
              <td style="font-weight:700;">${esc(getProductName(o.productId))}</td>
              <td style="text-align:center;"><span class="bd" style="font-size:10px;">${esc(o.line)}</span></td>
              <td style="text-align:center; font-weight:700;">${esc(o.qty)}</td>
              <td>
                <input type="number" value="${o.done}" min="0" max="${o.qty}"
                  style="width:60px; height:26px; text-align:center; font-weight:700; border:1px solid var(--br); border-radius:var(--rm); background:var(--bg-p); color:var(--tx);"
                  onchange="qDone('${o.id}',this.value)">
              </td>
              <td>
                <input type="number" value="${o.defect||0}" min="0"
                  style="width:50px; height:26px; text-align:center; font-weight:700; border:1px solid var(--br); border-radius:var(--rm); background:var(--bg-p); color:${o.defect>0?'#e03131':'var(--tx)'};"
                  onchange="qDefect('${o.id}',this.value)">
              </td>
              <td style="font-size:11px;">${esc(o.start)||'—'}</td>
              <td>${dayBadge(o.due)}<div style="font-size:10px; color:var(--tx-t); margin-top:1px;">${esc(o.due)||''}</div></td>
              <td title="실적량 ${Number(o.done)||0} / 목표량 ${Number(o.qty)||0} 기준">${pctBar(o.done, o.qty, 82)}</td>
              <td>
                <select class="stat-sel" style="font-weight:700; color:${statusColor}; border-color:${statusColor};" onchange="qStatus('${o.id}',this.value)">
                  ${['대기','진행중','완료','지연'].map(s=>`<option${s===o.status?' selected':''}>${s}</option>`).join('')}
                </select>
              </td>
              <td style="font-size:11px; font-weight:600;">${esc(o.manager)||'—'}</td>
              <td style="text-align:center;">
                ${hasNote
                  ? `<button onclick="showOrderNote('${esc(o.id)}')" title="${esc((o.note||'').slice(0,60))}"
                      style="background:var(--bg-i); border:1px solid var(--br-i); border-radius:var(--rm); width:28px; height:28px; cursor:pointer; color:var(--tx-i); position:relative;">
                      <i class="ti ti-notes" style="font-size:14px;"></i>
                    </button>`
                  : `<span style="color:var(--tx-t); font-size:16px;">—</span>`}
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

/* 생산지시 메모 팝오버 */
function showOrderNote(orderId) {
  const o = workOrders.find(x => x.id === orderId); if (!o) return;
  const lines = (o.note||'').split('\n').filter(Boolean);

  // 기존 팝오버 제거
  document.getElementById('order-note-popup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'order-note-popup';
  popup.style.cssText = `
    position:fixed; inset:0; z-index:1000;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.4);
  `;
  popup.innerHTML = `
    <div style="background:var(--bg-p); border:1px solid var(--br); border-radius:var(--rl);
                width:100%; max-width:480px; box-shadow:0 10px 40px rgba(0,0,0,.25); margin:20px;">
      <div style="display:flex; align-items:center; justify-content:space-between;
                  padding:12px 16px; border-bottom:1px solid var(--br); background:var(--bg-s);
                  border-radius:var(--rl) var(--rl) 0 0;">
        <div>
          <span style="font-size:13px; font-weight:700;">
            <i class="ti ti-notes" style="color:var(--tx-i);"></i> 작업 지시 메모
          </span>
          <span style="font-size:11px; color:var(--tx-t); margin-left:8px;">${o.id} · ${getProductName(o.productId)}</span>
        </div>
        <button onclick="document.getElementById('order-note-popup').remove()"
          style="background:none; border:none; cursor:pointer; font-size:18px; color:var(--tx-t); line-height:1;">×</button>
      </div>
      <div style="padding:16px; max-height:360px; overflow-y:auto;">
        ${lines.length
          ? `<div style="font-size:13px; line-height:2; color:var(--tx); white-space:pre-wrap;">${(o.note||'').replace(/</g,'&lt;')}</div>`
          : `<div style="color:var(--tx-t); font-size:12px; text-align:center; padding:20px;">등록된 메모가 없습니다.</div>`}
      </div>
      <div style="padding:10px 16px; border-top:1px solid var(--br); display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn btn-sm" onclick="openOrderEdit('${o.id}'); document.getElementById('order-note-popup').remove()">
          <i class="ti ti-edit"></i>수정
        </button>
        <button class="btn btn-sm btn-primary" onclick="document.getElementById('order-note-popup').remove()">닫기</button>
      </div>
    </div>`;
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
  document.body.appendChild(popup);
}

function updateNoteCount() {
  const el = inp('oa-note');
  const cnt = inp('oa-note-count');
  if (el && cnt) cnt.textContent = `${el.value.length}자`;
}

function appendOrderNote(text) {
  const el = inp('oa-note'); if (!el) return;
  el.value = el.value ? el.value + '\n· ' + text : '· ' + text;
  el.focus();
  updateNoteCount();
}

registerBulkEntryTable('order', {
  layout: 'sharedLabels',
  body: 'order-bulk-body',
  minRows: 1,
  fields: [
    { name: 'productId', label: '생산 제품', type: 'productSearch', clientId: () => v('oa-client'), listId: 'order-product-bulk-list', placeholder: '제품명 입력/검색', required: true },
    { name: 'line', label: '생산 라인', type: 'select', default: '라인 A', options: ['라인 A','라인 B','라인 C'] },
    { name: 'qty', label: '목표량', type: 'number', min: 1, step: 1, default: '1', required: true },
    { name: 'start', label: '개시일', type: 'date', default: today },
    { name: 'due', label: '납기일', type: 'date' },
    { name: 'status', label: '상태', type: 'select', default: '대기', options: ['대기','진행중','완료','지연'] },
    { name: 'manager', label: '담당자', type: 'select', options: bulkWorkerOptions },
    { name: 'note', label: '메모', type: 'text', placeholder: '작업 지시 사항' }
  ]
});

function setOrderEntryMode(mode) {
  const bulk = mode === 'bulk';
  setBulkEntryMode('order', bulk);
  const saveBtn = inp('order-save-btn');
  if (saveBtn && !editOrderId) saveBtn.innerHTML = bulk ? '<i class="ti ti-check"></i>일괄 발행' : '<i class="ti ti-check"></i>발행 완료';
}

function setOrderDeleteButton(visible) {
  const btn = inp('order-delete-btn');
  if (btn) btn.style.display = visible ? '' : 'none';
}

function deleteCurrentOrder() {
  if (!editOrderId) return;
  deleteOrder(editOrderId);
}

function openOrderAdd() {
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('orders', '생산 지시 등록')) return;
  editOrderId = null;
  setOrderDeleteButton(false);
  inp('order-modal-ttl').innerHTML = '<i class="ti ti-clipboard-plus"></i>현장 생산 지시서 신규 발행';
  const saveBtn = inp('order-save-btn');
  if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-check"></i>발행 완료';
  sv('oa-id', nextCode('WO', workOrders));
  fillClientSelect('oa-client', false);
  sv('oa-client', clients[0]?.id || '');
  fillProductSelect('oa-product', clients[0]?.id || '');
  if (typeof syncClientFieldDisplay === 'function') syncClientFieldDisplay('oa-client', 'oa-client-search');
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('oa-product', 'oa-product-search');
  fillWorkerSelect('oa-mgr');
  sv('oa-start', today());
  ['oa-due','oa-qty','oa-done','oa-note'].forEach(id => sv(id, ''));
  sv('oa-mgr', ''); sv('oa-status', '대기');
  initBulkEntryTable('order');
  setOrderEntryMode('bulk');
  const mode = inp('order-mode-switch'); if (mode) mode.style.display = '';
  inp('order-modal').classList.add('open');
}

function openOrderEdit(id) {
  if (!checkAdminAction()) return;
  const o = workOrders.find(x => x.id === id); if (!o) return;
  if (!requireRecordPermission('edit', o, 'workOrder')) return;
  editOrderId = id;
  setOrderDeleteButton(true);
  inp('order-modal-ttl').innerHTML = `<i class="ti ti-edit" style="color:var(--tx-w);"></i>생산 지시서 수정 — ${o.id}`;
  const saveBtn = inp('order-save-btn');
  if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i>저장';
  sv('oa-id', o.id);
  fillClientSelect('oa-client', false);
  sv('oa-client', o.clientId);
  fillProductSelect('oa-product', o.clientId, o.productId);
  if (typeof syncClientFieldDisplay === 'function') syncClientFieldDisplay('oa-client', 'oa-client-search');
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('oa-product', 'oa-product-search');
  sv('oa-line', o.line);
  sv('oa-qty', o.qty); sv('oa-done', o.done);
  sv('oa-start', o.start); sv('oa-due', o.due);
  sv('oa-status', o.status);
  fillWorkerSelect('oa-mgr', o.manager);
  sv('oa-note', o.note || '');
  setOrderEntryMode('single');
  const mode = inp('order-mode-switch'); if (mode) mode.style.display = 'none';
  inp('order-modal').classList.add('open');
}

function cloneOrder(id) {
  if (!checkAdminAction()) return;
  const o = workOrders.find(x => x.id === id); if (!o) return;
  editOrderId = null;
  setOrderDeleteButton(false);
  inp('order-modal-ttl').innerHTML = `<i class="ti ti-copy" style="color:var(--tx-i);"></i>생산 지시서 복제 발행 — ${o.id}`;
  const saveBtn = inp('order-save-btn');
  if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-check"></i>신규 발행';
  sv('oa-id', nextCode('WO', workOrders));
  fillClientSelect('oa-client', false); sv('oa-client', o.clientId);
  fillProductSelect('oa-product', o.clientId, o.productId);
  if (typeof syncClientFieldDisplay === 'function') syncClientFieldDisplay('oa-client', 'oa-client-search');
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('oa-product', 'oa-product-search');
  sv('oa-line', o.line); sv('oa-qty', o.qty); sv('oa-done', 0);
  sv('oa-start', today()); sv('oa-due', o.due||''); sv('oa-status', '대기');
  fillWorkerSelect('oa-mgr', o.manager); sv('oa-note', o.note||'');
  setOrderEntryMode('single');
  const mode = inp('order-mode-switch'); if (mode) mode.style.display = '';
  inp('order-modal').classList.add('open');
}

function onAddOrderClientChange() {
  fillProductSelect('oa-product', v('oa-client'));
  if (typeof syncClientFieldDisplay === 'function') syncClientFieldDisplay('oa-client', 'oa-client-search');
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('oa-product', 'oa-product-search');
  if (isBulkEntryMode('order')) refreshBulkEntryTable('order');
}
function onQcClientChange() {
  fillProductSelect('df-product', v('df-client'));
  if (typeof syncClientFieldDisplay === 'function') syncClientFieldDisplay('df-client', 'df-client-search');
  if (typeof syncProductFieldDisplay === 'function') syncProductFieldDisplay('df-product', 'df-product-search');
  if (isBulkEntryMode('df')) refreshBulkEntryTable('df');
}

function openOrderModal() {
  if (!checkAdminAction()) return;
  editOrderId = null;
  setOrderDeleteButton(false);
  inp('order-modal-ttl').innerHTML = '<i class="ti ti-clipboard-plus"></i>현장 생산 지시서 신규 발행';
  const saveBtn = inp('order-save-btn');
  if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-check"></i>발행 완료';
  inp('oa-id').value = nextCode('WO', workOrders);
  fillClientSelect('oa-client', false);
  sv('oa-client', clients[0]?.id || '');
  onAddOrderClientChange();
  sv('oa-line', '라인 A');
  sv('oa-qty', '1');
  sv('oa-done', '0');
  sv('oa-start', today());
  sv('oa-due', '');
  sv('oa-status', '대기');
  sv('oa-note', '');
  fillWorkerSelect('oa-mgr');
  initBulkEntryTable('order');
  setOrderEntryMode('bulk');
  const mode = inp('order-mode-switch'); if (mode) mode.style.display = '';
  inp('order-modal').classList.add('open');
}

function _orderProductKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function _findOrderProduct(value, clientId) {
  const key = _orderProductKey(value);
  if (!key) return null;
  const productSource = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const scoped = productSource.filter(p => !clientId || p.clientId === clientId);
  return scoped.find(p => _orderProductKey(p.id) === key)
    || scoped.find(p => _orderProductKey(p.name) === key)
    || (!clientId ? productSource.find(p => _orderProductKey(p.id) === key) : null)
    || null;
}

function ensureOrderProduct(value, clientId) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const found = _findOrderProduct(name, clientId);
  if (found) return { id: found.id, product: found, created: false };
  if (typeof requireCreateAction === 'function' && !requireCreateAction('clients', '제품 등록')) return null;
  const stage = processStages[0] || '';
  const product = stampRecordCreate({
    id: nextCode('PR', products),
    clientId,
    name,
    spec: '',
    qty: 1,
    unit: 'EA',
    price: 0,
    deliveryDate: '',
    matCost: 0,
    laborCost: 0,
    ovhCost: 0,
    processStage: stage,
    status: stageToStatus(stage),
    processMemo: '',
    note: '생산 지시 입력에서 자동 등록'
  }, 'products', { visibility:'company' });
  products.push(product);
  writeAuditLog('products', product.id, 'create', null, product, { summary:'생산 지시 제품 자동 등록', source:'orderProductInput' });
  return { id: product.id, product, created: true };
}

function saveOrderForm() {
  if (!checkAdminAction()) return;
  if (!editOrderId && isBulkEntryMode('order')) {
    const clientId = v('oa-client');
    if (!clientId) { showToast('연결 고객사를 먼저 선택해주십시오.', 'error'); return; }
    if (typeof requireCreateAction === 'function' && !requireCreateAction('orders', '생산 지시 등록')) return;
    const rows = readBulkEntryTable('order');
    if (!rows.length) { showToast('발행할 생산 지시 행을 입력해주세요.', 'error'); return; }
    const invalid = rows.find(r => !r.productId || (parseInt(r.qty) || 0) <= 0);
    if (invalid) { showToast('제품과 목표량은 각 행에 필요합니다.', 'error'); return; }
    let createdProductCount = 0;
    const orderRows = rows.map(r => {
      const productInfo = ensureOrderProduct(r.productId, clientId);
      if (productInfo?.created) createdProductCount++;
      return { ...r, productId: productInfo?.id || '' };
    });
    const touchedProducts = new Set();
    orderRows.slice().reverse().forEach(r => {
      const order = stampRecordCreate({
        id: nextCode('WO', workOrders),
        clientId,
        productId: r.productId,
        line: r.line || '라인 A',
        qty: parseInt(r.qty) || 0,
        done: 0,
        defect: 0,
        start: r.start || today(),
        due: r.due,
        status: r.status || '대기',
        manager: r.manager,
        note: r.note
      }, 'workOrder');
      workOrders.unshift(order);
      writeAuditLog('workOrder', order.id, 'create', null, order, { summary:'생산 지시 일괄 발행', source:'bulkAction' });
      if (r.status === '진행중') touchedProducts.add(r.productId);
    });
    touchedProducts.forEach(productId => {
      const p = products.find(x => x.id === productId);
      if (p && p.status !== '완료' && p.status !== '납품') p.status = '생산중';
    });
    if (createdProductCount || touchedProducts.size) saveStorage('products', products);
    saveStorage('workOrders', workOrders);
    editOrderId = null;
    closeModal('order-modal');
    renderOrders();
    showToast(`생산 지시 ${rows.length}건이 발행되었습니다.`);
    return;
  }
  const singleClientId = v('oa-client');
  if (!singleClientId) { showToast('연결 고객사를 먼저 선택해주십시오.', 'error'); return; }
  const productInfo = ensureOrderProduct(v('oa-product') || v('oa-product-search'), singleClientId);
  const productId = productInfo?.id || '';
  if (!productId) { showToast('제조 가동할 품목 모델을 선택해주십시오.', 'error'); return; }
  const qty = parseInt(v('oa-qty')) || 0;
  if (qty <= 0) { showToast('목표 지시 수량은 최소 1개 이상이어야 합니다.', 'error'); return; }
  if (editOrderId) {
    const o = workOrders.find(x => x.id === editOrderId); if (!o) return;
    if (!requireRecordPermission('edit', o, 'workOrder')) return;
    const before = _safeJsonClone(o);
    o.clientId = singleClientId; o.productId = productId; o.line = v('oa-line');
    o.qty = qty; o.done = parseInt(v('oa-done')) || 0;
    o.start = v('oa-start'); o.due = v('oa-due'); o.status = v('oa-status');
    o.manager = v('oa-mgr'); o.note = v('oa-note');
    stampRecordUpdate(o, before, 'workOrder');
    writeAuditLog('workOrder', o.id, 'update', before, o, { summary:'생산 지시 수정' });
    syncProductOnOrderChange(productId);
  } else {
    if (typeof requireCreateAction === 'function' && !requireCreateAction('orders', '생산 지시 등록')) return;
    const order = stampRecordCreate({
      id: nextCode('WO', workOrders),
      clientId: singleClientId, productId, line: v('oa-line'),
      qty: qty, done: 0, defect: 0,
      start: v('oa-start'), due: v('oa-due'), status: v('oa-status'),
      manager: v('oa-mgr'), note: v('oa-note')
    }, 'workOrder');
    workOrders.unshift(order);
    writeAuditLog('workOrder', order.id, 'create', null, order, { summary:'생산 지시 발행' });
    // 신규 생산지시 발행 시 제품 상태 자동 업데이트
    const p = products.find(x => x.id === productId);
    if (p && p.status !== '완료' && p.status !== '납품') {
      if (v('oa-status') === '진행중') { p.status = '생산중'; }
      saveStorage('products', products);
      showToast(`[${p.name}] 생산지시 발행 → 제품 상태 연동`, 'info');
    }
    if (productInfo.created) saveStorage('products', products);
  }
  saveStorage('workOrders', workOrders);
  editOrderId = null;
  closeModal('order-modal');
  renderOrders();
}

/* 생산지시 완료 시 연결 제품 상태 자동 동기화 헬퍼 */
function syncWorkOrdersOnProductComplete(productId) {
  const id = typeof productId === 'object' && productId ? productId.id : productId;
  workOrders.filter(o => o.productId === id && o.status !== '완료').forEach(o => {
    o.status = '완료';
    if (o.done < o.qty) o.done = o.qty;
  });
  saveStorage('workOrders', workOrders);
}

function syncProductOnOrderChange(productId) {
  const relOrders = workOrders.filter(o => o.productId === productId);
  if (!relOrders.length) return;
  const p = products.find(x => x.id === productId); if (!p) return;
  const allDone   = relOrders.every(o => o.status === '완료');
  const anyDelay  = relOrders.some(o => o.status === '지연');
  if (allDone)      { p.processStage = '완료'; }
  else if (anyDelay){ /* 단계 유지, 상태만 반영 */ }
  p.status = stageToStatus(p.processStage);
  if (anyDelay && p.status !== '완료') p.status = '지연';
  saveStorage('products', products);
}

function qDone(id, val) {
  const applyFn = () => {
    const o = workOrders.find(x => x.id === id); if (!o) return;
    if (!requireRecordPermission('edit', o, 'workOrder')) return;
    const before = _safeJsonClone(o);
    o.done = Math.max(0, Math.min(o.qty, parseInt(val) || 0));
    if (o.done >= o.qty) { o.status = '완료'; }
    stampRecordUpdate(o, before, 'workOrder');
    writeAuditLog('workOrder', id, 'update', before, o, { summary:'생산 실적 변경' });
    saveStorage('workOrders', workOrders);
    syncProductOnOrderChange(o.productId);    // ← 제품 상태 동기화
    renderOrders();
  };
  applyFn();
}

function qDefect(id, val) {
  const applyFn = () => {
    const o = workOrders.find(x => x.id === id); if (!o) return;
    if (!requireRecordPermission('edit', o, 'workOrder')) return;
    const before = _safeJsonClone(o);
    o.defect = Math.max(0, parseInt(val) || 0);
    stampRecordUpdate(o, before, 'workOrder');
    writeAuditLog('workOrder', id, 'update', before, o, { summary:'생산 불량 수량 변경' });
    saveStorage('workOrders', workOrders);
    renderOrders();
  };
  applyFn();
}

function qStatus(id, val) {
  const applyFn = () => {
    const o = workOrders.find(x => x.id === id); if (!o) return;
    if (!roleFeatureAllowed('status') || !requireRecordPermission('edit', o, 'workOrder')) return;
    const before = _safeJsonClone(o);
    o.status = val;
    stampRecordUpdate(o, before, 'workOrder');
    writeAuditLog('workOrder', id, 'statusChange', before, o, { summary:`생산 지시 상태 변경: ${before.status || ''} → ${val}` });
    saveStorage('workOrders', workOrders);
    syncProductOnOrderChange(o.productId);    // ← 제품 상태 동기화
    renderOrders();
  };
  applyFn();
}

function deleteOrder(id) {
  if (!checkAdminAction()) return;
  const o = workOrders.find(x => x.id === id);
  if (!o) return;
  if (!requireRecordPermission('delete', o, 'workOrder')) return;
  confirm_('생산 지시서 폐기 확인', `정말로 지시 번호 <strong>[${id}]</strong> 생산 계획 지시를 삭제 및 파기 처리하시겠습니까?`, () => {
    pushToTrash('order', `지시번호 ${o.id} - ${getProductName(o.productId)}`, id, o);

    workOrders = workOrders.filter(x => x.id !== id);
    writeAuditLog('workOrder', id, 'delete', o, null, { summary:'생산 지시 삭제' });
    saveStorage('workOrders', workOrders);
    if (editOrderId === id) {
      editOrderId = null;
      closeModal('order-modal');
    }
    renderOrders();
    showToast('작업 지시서가 휴지통으로 이동했습니다.', 'info');
  });
}

function exportOrdersCSV() {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('생산 지시 엑셀 내보내기')) return;
  const h = ['지시번호','고객사명','생산제품','배정라인','목표계획량','실적달성량','불량검출량','작업개시일','납기마감일','달성률','상태','감독담당자','메모'];
  const source = typeof visibleRecords === 'function' ? visibleRecords(workOrders, 'workOrder') : workOrders;
  const rows = source.map(o => [
    o.id, getClientName(o.clientId), getProductName(o.productId), o.line, o.qty, o.done, o.defect,
    o.start, o.due, (o.qty > 0 ? (o.done / o.qty * 100).toFixed(1) + '%' : '0%'), o.status, o.manager, o.note || ''
  ]);
  const csv = '\uFEFF' + [h, ...rows].map(r => r.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `MESPro_생산지시서_${today()}.csv`;
  a.click();
  showToast('현장 작업 오더 및 실시간 지시 목록이 엑셀로 출력되었습니다.');
}
