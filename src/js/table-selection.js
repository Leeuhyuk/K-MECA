/* Common table row selection and action dropdowns. */
const TABLE_ACTION_HEADER_RE = /(관리|동작|처리|작업)/;
const TABLE_INTERACTIVE_SEL = 'button,a,input,select,textarea,label,[contenteditable="true"]';
const MANAGED_TABLES = new Map();
let managedTableSeq = 0;
let managedEnhanceFrame = 0;
let selectionDetailContext = null;
let selectionDetailLastSignature = '';
let selectionDetailManuallyClosed = false;
const SELECTION_DETAIL_WIDTH_STORAGE_KEY = 'mes_selectionDetailPanelWidth';
const SELECTION_DETAIL_DEFAULT_WIDTH = 402;
const SELECTION_DETAIL_MIN_WIDTH = 320;
const SELECTION_DETAIL_MAX_WIDTH = 760;

function publishSelectionDetailReactState(panel, open) {
  if (typeof document === 'undefined' || !document.getElementById('selection-detail-react-root')) return;
  if (panel) panel.style.display = 'none';
  window.__selectionDetailReactState = { open: !!open, html: panel ? panel.innerHTML : '' };
  window.dispatchEvent(new Event('selection-detail-react-change'));
}

const BULK_AUDIT_TYPES = {
  rfq:'rfq', materials:'material', inventory:'inventory', orders:'workOrder',
  defects:'defect', checks:'checkRecord', claims:'claim', deliveries:'delivery',
  workers:'worker', as:'as', partners:'partners', statement:'statement',
  tax:'tax', quote:'quote', order:'order', products:'products', bom:'bom',
  memo:'memo', todo:'todo'
};
const TABLE_AUDIT_TYPES = {
  'rfq-table':'rfq', 'po-table':'po', 'mat-table':'material',
  'inventory-table':'inventory', 'orders-table':'workOrder',
  'defect-table':'defect', 'check-table':'checkRecord',
  'claims-table-full':'claim', 'bp-table':'partners',
  'workers-table':'worker', 'dlv-table':'delivery'
};
const AUDIT_ENTITY_ALIASES = {
  clients:['client','clients'],
  products:['product','products'],
  partners:['partner','partners'],
  material:['material','materials'],
  inventory:['inventory'],
  workOrder:['workOrder','orders','orderWork'],
  defect:['defect','defects'],
  claim:['claim','claims'],
  checkRecord:['checkRecord','checks'],
  rfq:['rfq','rfqList'],
  po:['po','poList'],
  statement:['statement','statementList'],
  tax:['tax','taxList'],
  quote:['quote','quoteList'],
  order:['order','orderList'],
  delivery:['delivery','deliveries'],
  worker:['worker','workers'],
  as:['as','asList'],
  bom:['bom','bomList'],
  paymentRequest:['paymentRequest','payreq'],
  fixedCost:['fixedCost'],
  fixedCostPayment:['fixedCostPayment'],
  financePayment:['financePayment'],
  financeEntry:['financeEntry','finance'],
  memo:['memo','memos','memoList'],
  todo:['todo','todos','todoList'],
  trash:['trash']
};
const ROW_AUDIT_PATTERNS = [
  ['openClientEdit','clients',0], ['deleteClient','clients',0], ['closeProject','clients',0], ['reopenProject','clients',0],
  ['openProdEdit','products',1], ['deleteProduct','products',0], ['changeProdStage','products',0], ['navToProduct','products',1],
  ['openPartnerModal','partners',0], ['deletePartner','partners',0],
  ['openMatEdit','material',0], ['deleteMat','material',0], ['changeMatStatus','material',0],
  ['openInvEdit','inventory',0], ['deleteInventory','inventory',0],
  ['openOrderEdit','workOrder',0], ['deleteOrder','workOrder',0], ['qStatus','workOrder',0], ['qDone','workOrder',0], ['qDefect','workOrder',0],
  ['openDefectEdit','defect',0], ['deleteDefect','defect',0], ['changeDefectStatus','defect',0],
  ['openClaimEdit','claim',0], ['deleteClaim','claim',0], ['openClaimDetail','claim',0], ['changeClaimStatus','claim',0],
  ['openCheckEdit','checkRecord',0], ['deleteCheck','checkRecord',0],
  ['openRfqEdit','rfq',0], ['deleteRfq','rfq',0], ['changeRfqStatus','rfq',0], ['openRfqPrint','rfq',0],
  ['openPoEdit','po',0], ['deletePo','po',0], ['changePoStatus','po',0], ['openPoPrint','po',0],
  ['openPaymentRequestEdit','paymentRequest',0], ['deletePaymentRequest','paymentRequest',0],
  ['openFinanceEdit','financeEntry',0], ['deleteFinanceEntry','financeEntry',0],
  ['openFixedCostItemEdit','fixedCost',0], ['deleteFixedCostItem','fixedCost',0],
  ['deleteSalesDoc',null,1], ['openSalesDocEdit',null,1], ['changeSalesDocStatus',null,1],
  ['deleteSODoc',null,1], ['openSODocEdit',null,1], ['changeSODocStatus',null,1]
];

function auditEntityTypeForBulkKey(key) {
  return BULK_AUDIT_TYPES[key] || key || '';
}

function auditEntityAliases(type) {
  const t = String(type || '').trim();
  if (!t) return [];
  return AUDIT_ENTITY_ALIASES[t] || [t];
}

function auditLogRowsLocal() {
  if (typeof allAuditLogRows === 'function') return allAuditLogRows();
  const rows = [];
  if (typeof auditLog !== 'undefined' && Array.isArray(auditLog)) rows.push(...auditLog);
  if (typeof financeData === 'object' && financeData && Array.isArray(financeData.auditLog)) rows.push(...financeData.auditLog);
  const seen = new Set();
  return rows.filter(row => {
    const key = row.id || [row.at, row.entityType, row.entityId, row.action, row.summary || row.detail].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function isTrashWrapperAuditLog(log) {
  if (!log || !Array.isArray(log.changes)) return false;
  if (String(log.entityType || '').trim() === 'trash') return false;
  const summary = String(log.summary || log.detail || '');
  if (summary.includes('휴지통 영구 삭제') || summary.includes('휴지통 전체 비우기')) return true;
  const fields = new Set(log.changes.map(c => String(c && c.field || '')));
  return fields.has('originalId') && fields.has('data') && (fields.has('trashStatus') || fields.has('cascadeData') || summary.includes('휴지통'));
}

function auditLogMatchesRef(log, ref) {
  if (isTrashWrapperAuditLog(log)) return false;
  const entityId = String(ref && ref.entityId || '').trim();
  if (!entityId || String(log.entityId || '').trim() !== entityId) return false;
  const type = String(ref && ref.entityType || '').trim();
  if (!type) return true;
  return auditEntityAliases(type).includes(String(log.entityType || '').trim());
}

function addAuditRecordList(lists, list) {
  if (Array.isArray(list)) lists.push(list);
}

function auditRecordListsForType(type) {
  const aliases = auditEntityAliases(type);
  const has = value => aliases.includes(value);
  const lists = [];
  if (has('clients') || has('client')) { if (typeof clients !== 'undefined') addAuditRecordList(lists, clients); }
  if (has('products') || has('product')) { if (typeof products !== 'undefined') addAuditRecordList(lists, products); }
  if (has('partners') || has('partner')) { if (typeof partners !== 'undefined') addAuditRecordList(lists, partners); }
  if (has('material') || has('materials')) { if (typeof materials !== 'undefined') addAuditRecordList(lists, materials); }
  if (has('inventory')) { if (typeof inventory !== 'undefined') addAuditRecordList(lists, inventory); }
  if (has('workOrder') || has('orders') || has('orderWork')) { if (typeof workOrders !== 'undefined') addAuditRecordList(lists, workOrders); }
  if (has('defect') || has('defects')) { if (typeof defects !== 'undefined') addAuditRecordList(lists, defects); }
  if (has('claim') || has('claims')) { if (typeof claims !== 'undefined') addAuditRecordList(lists, claims); }
  if (has('checkRecord') || has('checks')) { if (typeof checkRecords !== 'undefined') addAuditRecordList(lists, checkRecords); }
  if (has('rfq') || has('rfqList')) { if (typeof rfqList !== 'undefined') addAuditRecordList(lists, rfqList); }
  if (has('po') || has('poList')) { if (typeof poList !== 'undefined') addAuditRecordList(lists, poList); }
  if (has('statement') || has('statementList')) { if (typeof statementList !== 'undefined') addAuditRecordList(lists, statementList); }
  if (has('tax') || has('taxList')) { if (typeof taxList !== 'undefined') addAuditRecordList(lists, taxList); }
  if (has('quote') || has('quoteList')) { if (typeof quoteList !== 'undefined') addAuditRecordList(lists, quoteList); }
  if (has('order') || has('orderList')) { if (typeof orderList !== 'undefined') addAuditRecordList(lists, orderList); }
  if (has('delivery') || has('deliveries')) { if (typeof deliveries !== 'undefined') addAuditRecordList(lists, deliveries); }
  if (has('worker') || has('workers')) { if (typeof workers !== 'undefined') addAuditRecordList(lists, workers); }
  if (has('as')) { if (typeof asList !== 'undefined') addAuditRecordList(lists, asList); }
  if (has('bom') || has('bomList')) { if (typeof bomList !== 'undefined') addAuditRecordList(lists, bomList); }
  if (has('paymentRequest') || has('payreq')) {
    if (typeof financeData !== 'undefined' && financeData) addAuditRecordList(lists, financeData.paymentRequests);
  }
  if (has('fixedCost')) {
    if (typeof financeData !== 'undefined' && financeData) addAuditRecordList(lists, financeData.fixedCosts);
  }
  if (has('fixedCostPayment')) {
    if (typeof financeData !== 'undefined' && financeData) addAuditRecordList(lists, financeData.fixedCostPayments);
  }
  if (has('financeEntry') || has('finance')) {
    if (typeof financeData !== 'undefined' && financeData) addAuditRecordList(lists, financeData.entries);
  }
  if (has('memo') || has('memos') || has('memoList')) {
    if (typeof memoList !== 'undefined') addAuditRecordList(lists, memoList);
  }
  if (has('todo') || has('todos') || has('todoList')) {
    if (typeof todoList !== 'undefined') addAuditRecordList(lists, todoList);
  }
  return lists;
}

function auditRecordId(record) {
  if (!record || typeof record !== 'object') return '';
  return String(record.id || record.code || record.no || record.docId || '').trim();
}

function currentAuditRecordForLog(log) {
  const entityId = String(log && log.entityId || '').trim();
  if (!entityId) return null;
  for (const list of auditRecordListsForType(log.entityType)) {
    const found = (list || []).find(record => auditRecordId(record) === entityId);
    if (found) return found;
  }
  if (typeof financeData !== 'undefined' && financeData && log.entityType === 'financePayment') {
    return (financeData.paidReceivable && financeData.paidReceivable[entityId]) ||
      (financeData.paidPayable && financeData.paidPayable[entityId]) || null;
  }
  return null;
}

function enrichAuditLogFromCurrentRecord(log) {
  if (!log || (log.actorName && log.targetCreatedByName)) return log;
  const record = currentAuditRecordForLog(log);
  if (!record) return log;
  const next = Object.assign({}, log);
  if (!next.targetCreatedBy) next.targetCreatedBy = record.createdBy || record.ownerUserId || '';
  if (!next.targetCreatedByName) next.targetCreatedByName = record.createdByName || record.ownerUserName || '';
  if (!next.targetCreatedAt) next.targetCreatedAt = record.createdAt || '';
  if (!next.actorName && String(next.action || '') === 'create' && next.targetCreatedByName) next.actorName = next.targetCreatedByName;
  return next;
}

function fallbackAuditLogForRef(ref) {
  const record = currentAuditRecordForLog(ref);
  if (!record) return null;
  const at = record.createdAt || record.updatedAt || '';
  const actorName = record.createdByName || record.ownerUserName || record.updatedByName || '';
  const action = record.createdAt ? 'create' : 'update';
  return {
    id: `FALLBACK-${ref.entityType || 'record'}-${ref.entityId}`,
    entityType: ref.entityType || '',
    entityId: ref.entityId || '',
    action,
    actorName,
    actorRole: actorName ? '등록자' : '',
    at,
    summary: record.createdAt ? '등록 정보' : '현재 항목 정보',
    detail: record.createdAt ? '등록 이력 로그가 없어 항목의 등록 정보를 표시합니다.' : '저장된 이력 로그가 없어 현재 항목 정보를 표시합니다.',
    changes: [],
    targetCreatedBy: record.createdBy || record.ownerUserId || '',
    targetCreatedByName: record.createdByName || record.ownerUserName || '',
    targetCreatedAt: record.createdAt || ''
  };
}

async function auditRowsForRefs(refs) {
  const normalized = (refs || []).filter(ref => ref && ref.entityId);
  const rows = auditLogRowsLocal().filter(log => normalized.some(ref => auditLogMatchesRef(log, ref)));
  const serverRows = [];
  try {
    if (typeof _fbDb !== 'undefined' && _fbDb && typeof _cloudActive !== 'undefined' && _cloudActive) {
      for (const ref of normalized.slice(0, 10)) {
        const snap = await _fbDb.collection('audit_logs').where('entityId', '==', ref.entityId).limit(80).get();
        snap.forEach(doc => {
          const data = doc.data() || {};
          if (auditLogMatchesRef(data, ref)) serverRows.push(Object.assign({ id:doc.id }, data));
        });
      }
    }
  } catch(e) {}
  const seen = new Set();
  const result = rows.concat(serverRows).filter(row => {
    const key = row.id || [row.at, row.entityType, row.entityId, row.action, row.summary || row.detail].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(enrichAuditLogFromCurrentRecord);
  normalized.forEach(ref => {
    if (!result.some(log => auditLogMatchesRef(log, ref))) {
      const fallback = fallbackAuditLogForRef(ref);
      if (fallback) result.push(fallback);
    }
  });
  return result.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function auditButtonHtml(entityType, ids, label = '세부사항') {
  const list = (Array.isArray(ids) ? ids : [ids]).map(v => String(v || '').trim()).filter(Boolean);
  const disabled = list.length ? '' : ' disabled';
  const typeArg = encodeURIComponent(String(entityType || ''));
  const idsArg = encodeURIComponent(JSON.stringify(list));
  return `<button class="btn btn-sm" data-audit-detail-btn onclick="openAuditDetailsForIds('${typeArg}','${idsArg}')"${disabled}><i class="ti ti-history"></i>${label}</button>`;
}

function managedAuditButtonHtml(entityType, ids, label) {
  return auditButtonHtml(entityType, ids, label);
}

function parseOnclickArgs(onclick, fn) {
  const re = new RegExp(fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(([^)]*)\\)');
  const m = String(onclick || '').match(re);
  if (!m) return null;
  return Array.from(m[1].matchAll(/['"]([^'"]*)['"]/g)).map(x => x[1]);
}

function tableAuditType(table) {
  const bulkKey = tableBulkKey(table);
  if (bulkKey) return auditEntityTypeForBulkKey(bulkKey);
  if (table && table.id && TABLE_AUDIT_TYPES[table.id]) return TABLE_AUDIT_TYPES[table.id];
  return '';
}

function rowFallbackId(row) {
  if (!row) return '';
  const cells = Array.from(row.cells || []).filter(cell => {
    if (cell.classList.contains('table-row-select-td')) return false;
    if (cell.querySelector('.table-action-select,.table-action-source')) return false;
    return true;
  });
  return String((cells[0] && cells[0].textContent) || '').trim();
}

function inferRowAuditRef(row, table) {
  const check = rowSelectionCheckbox(row);
  const bulkKey = tableBulkKey(table);
  if (check && check.dataset && check.dataset.bid) {
    return { entityType:auditEntityTypeForBulkKey(bulkKey), entityId:check.dataset.bid };
  }
  const onclicks = Array.from(row.querySelectorAll('[onclick]')).map(el => el.getAttribute('onclick') || '');
  for (const onclick of onclicks) {
    for (const [fn, fixedType, argIndex] of ROW_AUDIT_PATTERNS) {
      const args = parseOnclickArgs(onclick, fn);
      if (!args) continue;
      const entityType = fixedType || args[0] || tableAuditType(table);
      const entityId = args[argIndex];
      if (entityId) return { entityType, entityId };
    }
  }
  const fallbackId = rowFallbackId(row);
  return fallbackId ? { entityType:tableAuditType(table), entityId:fallbackId } : null;
}

function selectedManagedRows(table) {
  return Array.from(table.querySelectorAll('tbody tr'))
    .filter(row => {
      const chk = rowSelectionCheckbox(row);
      return chk && chk.checked;
    })
    .filter(Boolean);
}

function selectedManagedAuditRefs(table) {
  const seen = new Set();
  return selectedManagedRows(table).map(row => inferRowAuditRef(row, table)).filter(ref => {
    if (!ref || !ref.entityId) return false;
    const key = `${ref.entityType || ''}|${ref.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureAuditDetailModal() {
  let modal = document.getElementById('audit-detail-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'overlay';
  modal.id = 'audit-detail-modal';
  modal.innerHTML = `
    <div class="dlg audit-detail-dialog" style="max-width:980px;width:96%;">
      <div class="dlg-title"><i class="ti ti-history" style="color:var(--tx-i);"></i><span id="audit-detail-title">이력 세부사항</span></div>
      <div id="audit-detail-sub" style="font-size:12px;color:var(--tx-t);margin:-4px 0 12px;"></div>
      <div id="audit-detail-body" class="fixed-scroll-area" style="max-height:60vh;overflow:auto;"></div>
      <div class="dlg-actions" style="margin-top:14px;">
        <button class="btn" onclick="closeModal('audit-detail-modal')">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function auditChangeHtml(log) {
  if (typeof auditChangeText === 'function') return auditChangeText(log);
  if (String(log && log.action || '') === 'create') {
    const raw = (log && (log.targetCreatedAt || log.createdAt || log.at)) || '';
    const date = raw ? new Date(raw) : null;
    const text = date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : (raw || '-');
    return `<div class="audit-change-line"><b>등록일자</b>: <span class="audit-after">${esc(text)}</span></div>`;
  }
  const changes = Array.isArray(log.changes) ? log.changes : [];
  if (!changes.length) return esc(log.detail || log.summary || '');
  return changes.map(c => `<div><b>${esc(c.field)}</b>: <span style="color:var(--tx-d);">${esc(c.before)}</span> → <span style="color:var(--tx-ok);">${esc(c.after)}</span></div>`).join('');
}

function renderAuditDetailRows(refs, rows) {
  const body = document.getElementById('audit-detail-body');
  if (!body) return;
  if (!rows.length) {
    const refsText = refs.map(ref => `${ref.entityType || '항목'} ${ref.entityId}`).join(', ');
    body.innerHTML = `<div class="empty"><i class="ti ti-history-off"></i>아직 기록된 이력이 없습니다.<br><span style="font-size:11px;color:var(--tx-t);">${esc(refsText)}</span></div>`;
    return;
  }
  body.innerHTML = `
    <table>
      <thead><tr><th>일시</th><th>항목</th><th>작업자</th><th>작업</th><th>변경 내용</th></tr></thead>
      <tbody>
        ${rows.map(log => `
          <tr>
            <td style="white-space:nowrap;">${log.at ? new Date(log.at).toLocaleString('ko-KR') : '-'}</td>
            <td><span class="bd bd-info">${esc(log.entityType || '-')}</span><div style="font-size:11px;color:var(--tx-t);">${esc(log.entityId || '')}</div></td>
            <td>${esc(typeof auditActorDisplayName === 'function' ? auditActorDisplayName(log) : (log.actorName || '-'))}<div style="font-size:11px;color:var(--tx-t);">${esc(typeof auditActorDisplaySub === 'function' ? auditActorDisplaySub(log) : (log.actorRole || ''))}</div></td>
            <td>${esc(auditLabelForAction(log.action || ''))}</td>
            <td style="min-width:240px;">${auditChangeHtml(log)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function openAuditDetailsForRefs(refs) {
  const list = (refs || []).filter(ref => ref && ref.entityId);
  if (!list.length) { showToast('이력을 확인할 항목을 찾지 못했습니다.', 'info'); return; }
  const modal = ensureAuditDetailModal();
  document.getElementById('audit-detail-title').textContent = '이력 세부사항';
  document.getElementById('audit-detail-sub').textContent = (list.length > 1 ? `선택 ${list.length}건 · ` : '') + list.map(ref => `${ref.entityType || '항목'} ${ref.entityId}`).join(' · ');
  document.getElementById('audit-detail-body').innerHTML = `<div class="empty"><i class="ti ti-loader animate-spin"></i>이력을 불러오는 중입니다.</div>`;
  modal.classList.add('open');
  const rows = await auditRowsForRefs(list);
  document.getElementById('audit-detail-title').textContent = `이력 세부사항 (${rows.length}건)`;
  renderAuditDetailRows(list, rows);
}

function openAuditDetailsForIds(encodedType, encodedIds) {
  let ids = [];
  try { ids = JSON.parse(decodeURIComponent(encodedIds || '%5B%5D')); } catch(e) {}
  const entityType = decodeURIComponent(encodedType || '');
  openAuditDetailsForRefs(ids.map(id => ({ entityType, entityId:String(id || '') })));
}

function managedTableToken(table) {
  if (!table.dataset.managedToken) table.dataset.managedToken = 'mt' + (++managedTableSeq);
  MANAGED_TABLES.set(table.dataset.managedToken, table);
  return table.dataset.managedToken;
}

function ensureManagedSelectionBar(table) {
  const token = managedTableToken(table);
  let bar = document.getElementById('managed-selection-bar-' + token);
  if (bar) return bar;
  if (typeof selectionActionBarsMobileVisible === 'function' && !selectionActionBarsMobileVisible()) return null;
  bar = document.createElement('div');
  bar.id = 'managed-selection-bar-' + token;
  bar.className = 'selection-action-bar managed-selection-bar';
  bar.style.display = 'none';
  bar.innerHTML = `
    <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> <span data-managed-count>0</span>건 선택됨</span>
    <button class="btn btn-sm" data-managed-audit-btn data-audit-detail-btn onclick="openManagedAuditDetails('${token}')"><i class="ti ti-history"></i>세부사항</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="clearManagedTableSelection('${token}')"><i class="ti ti-x"></i>해제</button>`;
  const wrap = table.parentElement;
  if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(bar, wrap);
  return bar;
}

function removeManagedSelectionBar(table) {
  const token = table && table.dataset && table.dataset.managedToken;
  if (!token) return;
  const bar = document.getElementById('managed-selection-bar-' + token);
  if (bar) bar.remove();
}

function updateManagedSelectionBar(table) {
  if (!table || table.closest('.overlay')) return;
  if (tableBulkKey(table)) {
    removeManagedSelectionBar(table);
    return;
  }
  const rows = selectedManagedRows(table);
  const showSelectionBar = typeof selectionActionBarsMobileVisible === 'function' ? selectionActionBarsMobileVisible() : true;
  if (!showSelectionBar || !rows.length) {
    removeManagedSelectionBar(table);
    return;
  }
  const bar = ensureManagedSelectionBar(table);
  if (!bar) return;
  const countEl = bar.querySelector('[data-managed-count]');
  const auditBtn = bar.querySelector('[data-managed-audit-btn]');
  if (countEl) countEl.textContent = rows.length;
  if (auditBtn) auditBtn.disabled = rows.length < 1;
  bar.style.display = 'flex';
}

function clearManagedTableSelection(token) {
  const table = MANAGED_TABLES.get(token);
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(row => {
    const chk = rowSelectionCheckbox(row);
    if (chk) chk.checked = false;
  });
  syncManagedTableRows(table);
}

function openManagedAuditDetails(token) {
  const table = MANAGED_TABLES.get(token);
  if (!table) return;
  openAuditDetailsForRefs(selectedManagedAuditRefs(table));
}

function selectionDetailEsc(value) {
  if (typeof esc === 'function') return esc(value);
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function selectionDetailRecordForRef(ref) {
  if (!ref || !ref.entityId) return null;
  const id = String(ref.entityId || '').trim();
  const type = ref.entityType || '';
  for (const list of auditRecordListsForType(type)) {
    const found = (list || []).find(record => auditRecordId(record) === id);
    if (found) return found;
  }
  if (typeof financeData !== 'undefined' && financeData && type === 'financePayment') {
    return (financeData.paidReceivable && financeData.paidReceivable[id]) ||
      (financeData.paidPayable && financeData.paidPayable[id]) || null;
  }
  return null;
}

function selectionDetailFieldLabel(field) {
  const labels = {
    id:'번호', code:'코드', no:'번호', docId:'문서번호', title:'제목', date:'일자', issueDate:'발행일', requestDate:'요청일',
    dueDate:'납기일', due:'납기일', startDate:'시작일', reminderDate:'알림일', createdAt:'등록일', updatedAt:'수정일', author:'작성자', customer:'고객사', client:'고객사', clientId:'고객사', clientName:'고객사',
    company:'거래처', project:'연계제품', product:'제품', productId:'제품', productName:'제품명', item:'품목',
    itemName:'품목명', name:'품목명', material:'자재명', materialName:'자재명', spec:'규격', supplier:'공급처',
    supplierEmail:'공급처 이메일', email:'이메일', phone:'연락처', manager:'담당자', owner:'담당자', assignee:'담당자',
    qty:'수량', quantity:'수량', targetQty:'목표량', goodQty:'실적량', done:'실적량', defect:'불량', defectQty:'불량', stock:'현재고',
    safeStock:'안전재고', minQty:'안전재고', unit:'단위', unitPrice:'단가', price:'단가', cost:'비용', amount:'금액', total:'합계',
    status:'상태', paymentStatus:'결제', payStatus:'결제', deliveryMethod:'납품방법', dlvMethod:'납품방법', payMethod:'결제조건', line:'라인',
    category:'재고 구분', type:'유형', kind:'유형', priority:'우선순위', repeat:'반복', entityType:'연결 유형', entityId:'연결 번호', important:'중요', tags:'태그', summary:'AI 요약', attachments:'첨부파일', checklist:'체크리스트', memoId:'연결 메모', location:'보관위치', warehouse:'창고', memo:'메모', note:'비고', remark:'비고',
    recvDate:'접수일', doneDate:'완료일', symptom:'증상', warranty:'보증', action:'처리내용', stage:'발생공정',
    cause:'원인', inspector:'검사원', visual:'외관', dim:'치수', func:'기능', result:'판정', content:'내용',
    response:'조치 방안', orderDate:'주문일자', expectedDate:'입고예정일', start:'개시일'
  };
  return labels[field] || field;
}

function selectionDetailResolveValue(ref, record, field) {
  const value = record ? record[field] : undefined;
  if (!record || value == null || value === '') return value;
  if ((field === 'clientId' || field === 'client') && typeof getClientName === 'function') {
    return getClientName(value) || value;
  }
  if (field === 'productId' && typeof getProductName === 'function') {
    return getProductName(value) || value;
  }
  if (field === 'owner' && ref && ref.entityType === 'as' && typeof asWorkerName === 'function') {
    return asWorkerName(value) || value;
  }
  return value;
}

function selectionDetailFormatValue(field, value) {
  if (value == null || value === '') return '-';
  if (value && typeof value.toDate === 'function') value = value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '-' : value.toLocaleString('ko-KR');
  if (typeof value === 'number') {
    if (/(price|amount|total|cost|unitPrice)/i.test(field)) return '₩' + value.toLocaleString('ko-KR');
    return value.toLocaleString('ko-KR');
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return value.length ? `${value.length}건` : '-';
  if (typeof value === 'object') return '';
  const text = String(value).trim();
  if (!text) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/(date|at|time)/i.test(field)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(text)) return d.toLocaleString('ko-KR');
  }
  return text;
}

function selectionDetailPriorityFields(type) {
  const common = ['id','code','docId','date','issueDate','customer','clientName','productName','itemName','name','spec','qty','quantity','unit','unitPrice','price','amount','total','status','memo','note'];
  const map = {
    rfq:['id','requestDate','date','customer','clientName','project','productName','supplier','supplierEmail','qty','quantity','unit','unitPrice','amount','status','memo','note'],
    po:['id','issueDate','date','customer','clientName','productName','supplier','supplierEmail','qty','quantity','unit','unitPrice','amount','paymentStatus','status','memo','note'],
    material:['id','productId','name','spec','supplier','qty','unit','unitPrice','price','amount','status','orderDate','expectedDate','note','createdAt'],
    inventory:['id','code','name','category','type','stock','qty','unit','safeStock','minQty','location','warehouse','note','createdAt'],
    workOrder:['id','clientId','customer','clientName','productId','productName','line','qty','targetQty','done','goodQty','defect','defectQty','start','due','dueDate','status','manager','memo','note','createdAt'],
    defect:['id','date','productId','productName','itemName','stage','type','qty','quantity','cause','action','status','line','manager','memo','note','createdAt'],
    checkRecord:['id','date','clientId','productId','productName','itemName','inspector','visual','dim','func','result','status','manager','memo','note','createdAt'],
    claim:['id','date','kind','clientId','customer','clientName','productId','productName','spec','content','response','status','manager','memo','note','createdAt'],
    partners:['id','code','name','manager','phone','email','type','createdAt'],
    worker:['id','name','role','phone','email','status','createdAt'],
    statement:['id','date','customer','clientName','amount','total','status','memo'],
    tax:['id','date','customer','clientName','amount','total','status','memo'],
    quote:['id','date','customer','clientName','productName','amount','total','status','memo'],
    order:['id','date','customer','clientName','productName','amount','total','status','memo'],
    products:['id','productId','name','spec','customer','clientId','clientName','qty','unit','price','deliveryDate','processStage','status','memo','note','createdAt'],
    bom:['id','productId','productName','materialName','qty','quantity','unit','createdAt'],
    delivery:['id','customer','clientName','productName','qty','quantity','status','dueDate','createdAt'],
    as:['id','recvDate','clientId','customer','clientName','productName','symptom','warranty','status','owner','manager','action','doneDate','cost','memo','note','createdAt'],
    memo:['id','title','content','tags','important','author','entityType','entityId','summary','attachments','createdAt','updatedAt'],
    todo:['id','title','content','owner','dueDate','startDate','reminderDate','priority','status','repeat','memoId','checklist','createdAt','updatedAt']
  };
  return map[type] || common;
}

function selectionDetailRecordFields(ref, record, row) {
  if (!record || typeof record !== 'object') return selectionDetailRowFields(row);
  const fields = [];
  const used = new Set();
  const add = key => {
    if (!key || used.has(key) || !(key in record)) return;
    const formatted = selectionDetailFormatValue(key, selectionDetailResolveValue(ref, record, key));
    if (!formatted) return;
    used.add(key);
    fields.push({ label:selectionDetailFieldLabel(key), value:formatted });
  };
  selectionDetailPriorityFields(ref && ref.entityType).forEach(add);
  Object.keys(record).forEach(key => {
    if (fields.length >= 12) return;
    if (/^(items|lines|files|attachments|history|changes|data)$/i.test(key)) return;
    add(key);
  });
  return fields.length ? fields : selectionDetailRowFields(row);
}

function selectionDetailRowFields(row) {
  const table = row && row.closest('table');
  const headers = table && table.tHead ? Array.from(table.tHead.rows[0].cells).map(th => (th.textContent || '').replace(/\s+/g, ' ').trim()) : [];
  return Array.from(row && row.cells || [])
    .filter(cell => !cell.querySelector('input[type="checkbox"],.table-action-select,.table-action-source'))
    .map((cell, index) => ({ label:headers[Array.prototype.indexOf.call(row.cells, cell)] || `항목 ${index + 1}`, value:(cell.textContent || '').replace(/\s+/g, ' ').trim() || '-' }))
    .filter(field => field.label && !/^(관리|동작|처리|작업)$/.test(field.label))
    .slice(0, 10);
}

function selectionDetailTitle(ref, record, row) {
  if (record) {
    return record.title || record.name || record.productName || record.itemName || record.company || record.customer || record.clientName || record.id || ref.entityId || '선택 항목';
  }
  const rowFields = selectionDetailRowFields(row);
  const firstValue = rowFields.find(field => field.value && field.value !== '-')?.value;
  return firstValue || (ref && ref.entityId) || '선택 항목';
}

function selectionDetailSub(ref, record) {
  const parts = [];
  if (ref && ref.entityType) parts.push(ref.entityType);
  if (ref && ref.entityId) parts.push(ref.entityId);
  if (record && (record.email || record.supplierEmail)) parts.push(record.email || record.supplierEmail);
  return parts.join(' · ');
}

function selectionDetailItem(ref, row, record) {
  return { ref, row, record, title:selectionDetailTitle(ref, record, row), sub:selectionDetailSub(ref, record) };
}

function selectionDetailEntityLabel(type) {
  const labels = {
    material:'자재 발주', inventory:'재고', workOrder:'생산 지시', defect:'품질 불량',
    checkRecord:'납품 검사', claim:'고객 클레임', rfq:'견적요청서', po:'구매발주서',
    statement:'거래명세표', tax:'세금계산서', quote:'견적서', order:'수주',
    products:'제품', partners:'거래처', worker:'인사', delivery:'납품', as:'고객 A/S', bom:'BOM',
    memo:'메모', todo:'할 일'
  };
  return labels[type] || '선택';
}

function selectionDetailMoney(value) {
  const n = Number(value) || 0;
  if (typeof fmtW === 'function') return fmtW(n);
  return '₩' + n.toLocaleString('ko-KR');
}

function selectionDetailStatusClass(status) {
  const s = String(status || '');
  if (/(완료|승인|정상|입고완료|지급완료)/.test(s)) return 'is-ok';
  if (/(지연|오류|불량|실패|삭제)/.test(s)) return 'is-danger';
  if (/(대기|작성|미요청|보류|발주전)/.test(s)) return 'is-muted';
  return 'is-info';
}

function selectionDetailIsStatusControlEntry(entry) {
  if (!entry || !entry.control) return false;
  const label = String(entry.label || '');
  const onchange = String(entry.control.getAttribute('onchange') || '');
  return entry.control.classList.contains('stat-sel') ||
    /Status|status/i.test(onchange) ||
    /(상태|진행상황|판정|결재|지급상태|수금상태)/.test(label);
}

function selectionDetailStatusControlEntry(context) {
  return selectionDetailEditableControls(context).find(selectionDetailIsStatusControlEntry) || null;
}

function selectionDetailStatusBadge(status, context) {
  const text = status || '진행중';
  const entry = context && context.count === 1 ? selectionDetailStatusControlEntry(context) : null;
  if (entry && entry.tag === 'select') {
    const selectedValue = entry.control.value || entry.value || text;
    const options = Array.from(entry.control.options || []).map(option => {
      const value = option.value || option.textContent || '';
      const label = option.textContent || value;
      const selected = option.selected || value === selectedValue || label === selectedValue || label === text;
      return `<button class="selection-detail-status-option${selected ? ' is-selected' : ''}" type="button" data-selection-status-option data-value="${selectionDetailEsc(value)}"${option.disabled ? ' disabled' : ''}>${selectionDetailEsc(label)}</button>`;
    }).join('');
    return `<span class="selection-detail-status-menu-wrap">
      <button class="selection-detail-status selection-detail-status-control ${selectionDetailStatusClass(text)}" type="button" data-selection-status-toggle title="상태 변경">
        <span>${selectionDetailEsc(text)}</span><i class="ti ti-chevron-down"></i>
      </button>
      <span class="selection-detail-status-menu" data-selection-status-menu>${options}</span>
    </span>`;
  }
  return `<span class="selection-detail-status ${selectionDetailStatusClass(text)}">${selectionDetailEsc(text)}</span>`;
}

function selectionDetailMaterialContext(record) {
  const product = record && typeof getProductById === 'function' ? getProductById(record.productId) : null;
  const clientName = product && typeof getClientName === 'function' ? getClientName(product.clientId) : '';
  const productName = typeof getProductName === 'function' ? getProductName(record && record.productId) : '';
  const amount = typeof getMatAmt === 'function' ? getMatAmt(record) : ((Number(record && record.unitPrice) || 0) * (Number(record && record.qty) || 0));
  return {
    clientName: clientName || record.clientName || record.customer || '-',
    productName: productName || record.productName || record.productId || '-',
    amount
  };
}

function selectionDetailPoContext(record) {
  const data = record || {};
  const clientName = typeof getClientName === 'function' ? getClientName(data.clientId) : '';
  const productName = typeof getProductName === 'function' ? getProductName(data.productId) : '';
  const amount = typeof _docAmount === 'function' ? _docAmount(data, 'po') : (Number(data.amount || data.totalAmt || data.total) || 0);
  return {
    clientName: clientName || data.clientName || data.customer || '-',
    productName: productName || data.productName || data.productId || '-',
    itemName: typeof _docItemSummary === 'function' ? _docItemSummary(data) : (data.itemName || data.name || '-'),
    qty: typeof _docQtySummary === 'function' ? _docQtySummary(data) : `${data.qty || data.quantity || 0} ${data.unit || ''}`.trim(),
    amount
  };
}

function selectionDetailDocumentContext(record, type) {
  const data = record || {};
  const lines = typeof _docLines === 'function' ? _docLines(data, type) : [];
  const firstLine = lines[0] || {};
  const amount = lines.length
    ? lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    : (Number(data.amount || data.totalAmt || data.total || 0) || 0);
  const itemSummary = typeof _docItemSummary === 'function' ? _docItemSummary(data) : (data.itemName || data.productName || data.name || '-');
  const qtySummary = typeof _docQtySummary === 'function' ? _docQtySummary(data) : `${data.qty || data.quantity || 0} ${data.unit || ''}`.trim();
  const clientName = data.clientName || data.customer || (typeof getClientName === 'function' ? getClientName(data.clientId) : '') || '-';
  const bizNo = typeof _docClientBizNo === 'function' ? _docClientBizNo(data) : (data.clientBizNo || data.bizNo || '');
  const vat = Math.round(amount * 0.1);
  return {
    clientName,
    bizNo,
    itemSummary,
    qtySummary: qtySummary || '-',
    spec: data.spec || firstLine.spec || '-',
    unitPrice: Number(data.unitPrice || data.targetPrice || data.price || firstLine.price || 0) || 0,
    amount,
    vat,
    grandTotal: amount + vat
  };
}

function selectionDetailNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').replace(/[,\s₩원]/g, '').trim();
  if (!text) return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function selectionDetailItemQtyInfo(item) {
  const record = item && item.record || {};
  const ref = item && item.ref || {};
  if (record && ['rfq','po','statement','tax','quote','order'].includes(ref.entityType) && typeof _docItems === 'function') {
    const rows = _docItems(record);
    const byUnit = new Map();
    rows.forEach(row => {
      const unit = row.unit || record.unit || '';
      const qty = selectionDetailNumber(row.qty);
      if (!qty) return;
      byUnit.set(unit, (byUnit.get(unit) || 0) + qty);
    });
    return { byUnit };
  }
  const qty = selectionDetailNumber(record.qty ?? record.quantity ?? record.stock ?? record.targetQty ?? 0);
  const unit = record.unit || '';
  const byUnit = new Map();
  if (qty) byUnit.set(unit, qty);
  return { byUnit };
}

function selectionDetailQtyMapLabel(byUnit) {
  const rows = Array.from((byUnit || new Map()).entries()).filter(([, qty]) => Number(qty) !== 0);
  if (!rows.length) return '-';
  return rows.slice(0, 3).map(([unit, qty]) => `${selectionDetailFormatValue('qty', qty)}${unit ? ' ' + unit : ''}`).join(' / ') +
    (rows.length > 3 ? ` 외 ${rows.length - 3}` : '');
}

function selectionDetailItemAmount(item) {
  const record = item && item.record || {};
  const ref = item && item.ref || {};
  if (!record) return 0;
  if (ref.entityType === 'material') return selectionDetailMaterialContext(record).amount;
  if (ref.entityType === 'po') return selectionDetailPoContext(record).amount;
  if (['rfq','statement','tax','quote','order'].includes(ref.entityType)) return selectionDetailDocumentContext(record, ref.entityType).amount;
  const direct = record.amount ?? record.total ?? record.totalAmt ?? record.grandTotal ?? record.cost;
  if (direct != null && direct !== '') return selectionDetailNumber(direct);
  return selectionDetailNumber(record.unitPrice ?? record.price) * selectionDetailNumber(record.qty ?? record.quantity);
}

function selectionDetailItemStatus(item) {
  const record = item && item.record || {};
  return record.status || record.paymentStatus || record.payStatus || record.result || '';
}

function selectionDetailItemCounterparty(item) {
  const record = item && item.record || {};
  const ref = item && item.ref || {};
  if (record.supplier || record.vendor) return record.supplier || record.vendor;
  if (['material','workOrder','claim','checkRecord','as','po','rfq','statement','tax','quote','order'].includes(ref.entityType)) {
    const name = selectionDetailClientName(record);
    if (name && name !== '-') return name;
  }
  return record.company || record.customer || record.clientName || '';
}

function selectionDetailItemMiniMeta(item) {
  const record = item && item.record || {};
  const ref = item && item.ref || {};
  if (ref.entityType === 'material') {
    return {
      qty: selectionDetailQtyUnit(record.qty || 0, record.unit),
      amount: selectionDetailMoney(selectionDetailItemAmount(item)),
      counterparty: record.supplier || '-',
      status: selectionDetailItemStatus(item) || '발주중'
    };
  }
  if (ref.entityType === 'po') {
    const po = selectionDetailPoContext(record);
    return { qty: po.qty, amount: selectionDetailMoney(po.amount), counterparty: record.supplier || '-', status: selectionDetailItemStatus(item) || '작성중' };
  }
  if (['rfq','statement','tax','quote','order'].includes(ref.entityType)) {
    const doc = selectionDetailDocumentContext(record, ref.entityType);
    return { qty: doc.qtySummary, amount: selectionDetailMoney(doc.amount), counterparty: doc.clientName, status: selectionDetailItemStatus(item) || '작성중' };
  }
  return {
    qty: selectionDetailQtyMapLabel(selectionDetailItemQtyInfo(item).byUnit),
    amount: selectionDetailItemAmount(item) ? selectionDetailMoney(selectionDetailItemAmount(item)) : '-',
    counterparty: selectionDetailItemCounterparty(item) || '-',
    status: selectionDetailItemStatus(item) || '-'
  };
}

function selectionDetailMultiStats(context) {
  const items = context && context.items || [];
  const statusCounts = new Map();
  const types = new Set();
  const counterparties = new Set();
  const qtyByUnit = new Map();
  let amount = 0;
  let amountCount = 0;
  let missingPrice = 0;
  let completed = 0;
  items.forEach(item => {
    const ref = item.ref || {};
    const record = item.record || {};
    if (ref.entityType) types.add(ref.entityType);
    const status = selectionDetailItemStatus(item) || '미지정';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    if (/(완료|입고완료|지급완료)/.test(status)) completed += 1;
    const counterparty = selectionDetailItemCounterparty(item);
    if (counterparty && counterparty !== '-') counterparties.add(counterparty);
    selectionDetailItemQtyInfo(item).byUnit.forEach((qty, unit) => {
      qtyByUnit.set(unit, (qtyByUnit.get(unit) || 0) + qty);
    });
    const itemAmount = selectionDetailItemAmount(item);
    if (itemAmount) {
      amount += itemAmount;
      amountCount += 1;
    }
    if (['material','po','rfq','statement','tax','quote','order'].includes(ref.entityType)) {
      const price = selectionDetailNumber(record.unitPrice ?? record.targetPrice ?? record.price);
      if (!price && !itemAmount) missingPrice += 1;
    }
  });
  const typeLabels = Array.from(types).map(selectionDetailEntityLabel);
  const statuses = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]);
  return {
    count: items.length,
    typeLabel: typeLabels.length ? typeLabels.slice(0, 2).join(' · ') + (typeLabels.length > 2 ? ` 외 ${typeLabels.length - 2}` : '') : '선택 항목',
    counterpartyCount: counterparties.size,
    qtyLabel: selectionDetailQtyMapLabel(qtyByUnit),
    amount,
    amountCount,
    statuses,
    completed,
    missingPrice
  };
}

function selectionDetailMultiHeaderSub(stats) {
  const parts = [stats.typeLabel];
  if (stats.counterpartyCount) parts.push(`거래처/공급처 ${stats.counterpartyCount}곳`);
  if (stats.statuses.length) parts.push(`상태 ${stats.statuses.length}종`);
  return parts.join(' · ');
}

function selectionDetailMultiSummaryHtml(context) {
  const stats = selectionDetailMultiStats(context);
  const counterpartyLabel = stats.counterpartyCount ? `${stats.counterpartyCount}곳` : '-';
  const statusChips = stats.statuses.length ? `<div class="selection-detail-status-chips">
    ${stats.statuses.slice(0, 5).map(([status, count]) => `<span class="selection-detail-mini-chip ${selectionDetailStatusClass(status)}">${selectionDetailEsc(status)} ${count}</span>`).join('')}
    ${stats.statuses.length > 5 ? `<span class="selection-detail-mini-chip is-muted">외 ${stats.statuses.length - 5}</span>` : ''}
  </div>` : '<div class="selection-detail-empty">상태 정보가 없습니다.</div>';
  const notices = [];
  if (stats.completed) notices.push(`완료 상태 ${stats.completed}건은 일부 일괄 처리에서 제외될 수 있습니다.`);
  if (stats.counterpartyCount > 1) notices.push(`거래처/공급처가 ${stats.counterpartyCount}곳이라 문서 생성 시 분리 처리될 수 있습니다.`);
  if (stats.missingPrice) notices.push(`단가 또는 금액이 없는 항목 ${stats.missingPrice}건이 있습니다.`);
  return `
    <section class="selection-detail-section selection-detail-multi-summary">
      <div class="selection-detail-section-title">선택 요약</div>
      <div class="selection-detail-metric-grid">
        <div class="selection-detail-metric-card">
          <span>선택</span>
          <b>${selectionDetailEsc(stats.count)}건</b>
        </div>
        <div class="selection-detail-metric-card">
          <span>총 수량</span>
          <b>${selectionDetailEsc(stats.qtyLabel)}</b>
        </div>
        <div class="selection-detail-metric-card">
          <span>총 금액</span>
          <b>${stats.amountCount ? selectionDetailEsc(selectionDetailMoney(stats.amount)) : '-'}</b>
        </div>
        <div class="selection-detail-metric-card">
          <span>거래처/공급처</span>
          <b>${selectionDetailEsc(counterpartyLabel)}</b>
        </div>
      </div>
      <div class="selection-detail-section-subtitle">상태 분포</div>
      ${statusChips}
      ${notices.length ? `<div class="selection-detail-notice-list">${notices.map(text => `<div><i class="ti ti-alert-circle"></i><span>${selectionDetailEsc(text)}</span></div>`).join('')}</div>` : ''}
    </section>`;
}

function selectionDetailMultiSelectedListHtml(context) {
  if (!context || !context.items || context.items.length <= 1) return '';
  return `
    <section class="selection-detail-section">
      <div class="selection-detail-section-title"><i class="ti ti-list-check"></i>선택 항목</div>
      <div class="selection-detail-selected-list selection-detail-selected-list-rich">
        ${context.items.slice(0, 10).map(item => {
          const meta = selectionDetailItemMiniMeta(item);
          return `<div class="selection-detail-selected-item selection-detail-selected-item-rich">
            <div>
              <b>${selectionDetailEsc(item.title)}</b>
              <span>${selectionDetailEsc(meta.counterparty || item.sub || '-')}</span>
            </div>
            <div class="selection-detail-selected-meta">
              <span>${selectionDetailEsc(meta.qty || '-')}</span>
              <span>${selectionDetailEsc(meta.amount || '-')}</span>
              <em class="${selectionDetailStatusClass(meta.status)}">${selectionDetailEsc(meta.status || '-')}</em>
            </div>
          </div>`;
        }).join('')}
        ${context.items.length > 10 ? `<div class="selection-detail-more">외 ${context.items.length - 10}건</div>` : ''}
      </div>
    </section>`;
}

function selectionDetailHeaderHtml(context, primary) {
  if (context && context.count > 1) {
    const stats = selectionDetailMultiStats(context);
    return `
      <div class="selection-detail-summary-card">
        <div>
          <strong>${selectionDetailEsc(`${context.count}건 선택됨`)}</strong>
          <span>${selectionDetailEsc(selectionDetailMultiHeaderSub(stats))}</span>
        </div>
        ${selectionDetailStatusBadge('다중')}
      </div>`;
  }
  const ref = primary && primary.ref ? primary.ref : {};
  const record = primary && primary.record ? primary.record : {};
  const type = ref.entityType || '';
  let title = record.id || ref.entityId || (primary && primary.title) || '선택 항목';
  let sub = primary && primary.sub ? primary.sub : '';
  let status = record.status || record.paymentStatus || record.payStatus || '';
  if (type === 'material' && record) {
    const mat = selectionDetailMaterialContext(record);
    title = record.id || ref.entityId || title;
    sub = `${mat.clientName} · ${mat.productName}`;
    status = record.status || status || '발주중';
  }
  if (type === 'po' && record) {
    const po = selectionDetailPoContext(record);
    title = record.id || ref.entityId || title;
    sub = `${po.clientName} · ${po.productName}`;
    status = record.status || status || '작성중';
  }
  if (['rfq','statement','tax','quote','order'].includes(type) && record) {
    const doc = selectionDetailDocumentContext(record, type);
    title = record.id || ref.entityId || title;
    sub = `${doc.clientName} · ${doc.itemSummary}`;
    status = record.status || status || '작성중';
  }
  if (type === 'as' && record) {
    title = record.id || ref.entityId || title;
    sub = `${selectionDetailClientName(record)} · ${record.productName || '제품 미지정'}`;
    status = record.status || status || '접수';
  }
  if (type === 'defect' && record) {
    title = record.id || ref.entityId || title;
    sub = `${selectionDetailProductName(record)} · ${record.stage || '공정 미지정'}`;
    status = record.status || status || '조치중';
  }
  if (type === 'checkRecord' && record) {
    title = record.id || ref.entityId || title;
    sub = `${selectionDetailClientName(record)} · ${selectionDetailProductName(record)}`;
    status = record.result || record.status || status || '검사';
  }
  if (type === 'claim' && record) {
    title = record.id || ref.entityId || title;
    sub = `${typeof claimClientLabel === 'function' ? claimClientLabel(record) : selectionDetailClientName(record)} · ${typeof claimProductLabel === 'function' ? claimProductLabel(record) : selectionDetailProductName(record)}`;
    status = record.status || status || '접수';
  }
  if (type === 'memo' && record) {
    title = record.title || ref.entityId || title;
    const tags = Array.isArray(record.tags) && record.tags.length ? record.tags.slice(0, 2).map(tag => '#' + tag).join(' ') : '태그 없음';
    sub = `${record.author || '작성자 미지정'} · ${tags}`;
    status = record.important ? '중요' : '일반';
  }
  if (type === 'todo' && record) {
    title = record.title || ref.entityId || title;
    sub = `${record.owner || '담당자 미지정'} · ${record.dueDate || '마감일 미설정'}`;
    status = record.status || status || '대기';
  }
  if (type === 'inventory' && record) {
    title = record.id || record.code || ref.entityId || title;
    sub = `${record.name || '품목명 없음'} · ${record.type || record.category || '분류 없음'}`;
    status = (Number(record.qty) < Number(record.minQty || record.safeStock || 0)) ? '안전재고 미달' : (record.status || status || '정상');
  }
  if (type === 'workOrder' && record) {
    title = record.id || ref.entityId || title;
    sub = `${selectionDetailClientName(record)} · ${selectionDetailProductName(record)}`;
    status = record.status || status || '대기';
  }
  return `
    <div class="selection-detail-summary-card">
      <div>
        <strong>${selectionDetailEsc(title)}</strong>
        <span>${selectionDetailEsc(sub || selectionDetailEntityLabel(type))}</span>
      </div>
      ${selectionDetailStatusBadge(status, context)}
    </div>`;
}

function selectionDetailKeyValueRows(rows) {
  const filtered = rows.filter(row => row && row.value != null && row.value !== '');
  if (!filtered.length) return '<div class="selection-detail-empty">표시할 정보가 없습니다.</div>';
  return `<div class="selection-detail-kv">${filtered.map(row => `
    <div class="selection-detail-kv-row">
      <span>${selectionDetailEsc(row.label)}</span>
      <b>${selectionDetailEsc(row.value)}</b>
    </div>`).join('')}</div>`;
}

function selectionDetailCleanHeaderLabel(text) {
  return String(text || '')
    .replace(/[↕▲▼△▽⇅]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectionDetailHeaderLabelForControl(row, control) {
  const cell = control && control.closest ? control.closest('td') : null;
  const table = row && row.closest ? row.closest('table') : null;
  const head = table && table.tHead && table.tHead.rows[0];
  const header = cell && head && head.cells[cell.cellIndex] ? head.cells[cell.cellIndex] : null;
  const headerText = selectionDetailCleanHeaderLabel(header ? header.textContent : '');
  if (headerText) return headerText;
  const aria = control && (control.getAttribute('aria-label') || control.getAttribute('title'));
  if (aria) return selectionDetailCleanHeaderLabel(aria);
  const onchange = String(control && control.getAttribute('onchange') || '');
  if (/Status|status/i.test(onchange) || (control && control.classList && control.classList.contains('stat-sel'))) return '상태';
  if (/Done|done/i.test(onchange)) return '실적량';
  if (/Defect|defect/i.test(onchange)) return '불량';
  return '값';
}

function selectionDetailEditableControls(context) {
  if (!context || context.count !== 1) return [];
  const item = context.items && context.items[0];
  const row = (item && item.row) || (context.rows && context.rows[0]);
  if (!row || !row.querySelectorAll) return [];
  const table = row.closest ? row.closest('table') : null;
  const actionIndex = table ? findManagedActionIndex(table) : -1;
  const controls = [];
  row.querySelectorAll('select,input').forEach(control => {
    const type = String(control.type || '').toLowerCase();
    if (['checkbox','radio','hidden','button','submit','reset','file'].includes(type)) return;
    if (control.closest('.table-row-select-td')) return;
    const cell = control.closest('td');
    if (cell && actionIndex >= 0 && cell.cellIndex === actionIndex) return;
    const canChange = control.matches('select,.stat-sel') || control.getAttribute('onchange') || control.onchange;
    if (!canChange) return;
    controls.push({
      control,
      label: selectionDetailHeaderLabelForControl(row, control),
      tag: control.tagName.toLowerCase(),
      type: type || (control.tagName.toLowerCase() === 'select' ? 'select' : 'text'),
      value: control.value || '',
      min: control.getAttribute('min') || '',
      max: control.getAttribute('max') || '',
      step: control.getAttribute('step') || '',
      placeholder: control.getAttribute('placeholder') || ''
    });
  });
  return controls;
}

function selectionDetailEditableControlHtml(entry, index) {
  const label = selectionDetailEsc(entry.label || '값');
  if (entry.tag === 'select') {
    const options = Array.from(entry.control.options || []).map(option => {
      const value = option.value || option.textContent || '';
      const text = option.textContent || value;
      return `<option value="${selectionDetailEsc(value)}"${option.selected ? ' selected' : ''}${option.disabled ? ' disabled' : ''}>${selectionDetailEsc(text)}</option>`;
    }).join('');
    return `<label class="selection-detail-edit-row">
      <span>${label}</span>
      <select class="selection-detail-edit-control" onchange="runSelectionDetailInlineControl(${index}, this.value)">${options}</select>
    </label>`;
  }
  const inputType = ['number','date','text'].includes(entry.type) ? entry.type : 'text';
  const attr = (name, value) => value != null && value !== '' ? ` ${name}="${selectionDetailEsc(value)}"` : '';
  return `<label class="selection-detail-edit-row">
    <span>${label}</span>
    <input class="selection-detail-edit-control" type="${selectionDetailEsc(inputType)}" value="${selectionDetailEsc(entry.value)}"${attr('min', entry.min)}${attr('max', entry.max)}${attr('step', entry.step)}${attr('placeholder', entry.placeholder)} onchange="runSelectionDetailInlineControl(${index}, this.value)">
  </label>`;
}

function selectionDetailInlineEditHtml(context) {
  const controls = selectionDetailEditableControls(context).filter(entry => !selectionDetailIsStatusControlEntry(entry));
  if (!controls.length) return '';
  return `
    <section class="selection-detail-section selection-detail-edit-section">
      <div class="selection-detail-section-title">빠른 변경</div>
      <div class="selection-detail-edit-grid">
        ${controls.map((entry, index) => selectionDetailEditableControlHtml(entry, index)).join('')}
      </div>
    </section>`;
}

function selectionDetailClientName(record) {
  if (!record) return '-';
  return record.clientName || record.customer ||
    (record.clientId && typeof getClientName === 'function' ? getClientName(record.clientId) : '') || '-';
}

function selectionDetailProductName(record) {
  if (!record) return '-';
  return record.productName || record.itemName ||
    (record.productId && typeof getProductName === 'function' ? getProductName(record.productId) : '') || '-';
}

function selectionDetailQtyUnit(qty, unit) {
  if (qty == null || qty === '') return '-';
  return `${selectionDetailFormatValue('qty', qty)} ${unit || ''}`.trim();
}

function selectionDetailProgressValue(record) {
  const qty = Number(record && record.qty) || 0;
  const done = Number(record && record.done) || 0;
  return qty > 0 ? `${Math.round(done / qty * 100)}%` : '0%';
}

function selectionDetailBasicRows(primary) {
  const record = primary && primary.record;
  const ref = primary && primary.ref;
  if (record && ref && ref.entityType === 'material') {
    const mat = selectionDetailMaterialContext(record);
    return [
      { label:'고객사', value:mat.clientName },
      { label:'매칭제품', value:mat.productName },
      { label:'자재명', value:record.name || '-' },
      { label:'규격', value:record.spec || '-' },
      { label:'공급처', value:record.supplier || '-' },
      { label:'수량', value:selectionDetailQtyUnit(record.qty || 0, record.unit) },
      { label:'진행상황', value:record.status || '-' },
      { label:'참고사항', value:record.note || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'po') {
    const po = selectionDetailPoContext(record);
    return [
      { label:'고객사', value:po.clientName },
      { label:'연결제품', value:po.productName },
      { label:'공급처', value:record.supplier || '-' },
      { label:'공급처 이메일', value:record.supplierEmail || '-' },
      { label:'품목명', value:po.itemName },
      { label:'수량', value:po.qty },
      { label:'결제', value:record.paymentStatus || record.payStatus || '-' },
      { label:'상태', value:record.status || '-' },
      { label:'비고', value:record.memo || record.note || '-' }
    ];
  }
  if (record && ref && ['rfq','statement','tax','quote','order'].includes(ref.entityType)) {
    const doc = selectionDetailDocumentContext(record, ref.entityType);
    const rows = [
      { label:'고객사', value:doc.clientName }
    ];
    if (doc.bizNo && ['statement','tax','order'].includes(ref.entityType)) rows.push({ label:'사업자번호', value:doc.bizNo });
    rows.push(
      { label:'품목명', value:doc.itemSummary },
      { label:'규격', value:doc.spec },
      { label:'수량', value:doc.qtySummary }
    );
    if (record.status) rows.push({ label:'상태', value:record.status });
    if (record.memo || record.note) rows.push({ label:'메모', value:record.memo || record.note });
    return rows;
  }
  if (record && ref && ref.entityType === 'as') {
    return [
      { label:'접수번호', value:record.id || '-' },
      { label:'접수일', value:selectionDetailFormatValue('recvDate', record.recvDate) },
      { label:'고객사', value:selectionDetailClientName(record) },
      { label:'제품명', value:record.productName || '-' },
      { label:'증상', value:record.symptom || '-' },
      { label:'보증', value:record.warranty || '-' },
      { label:'상태', value:record.status || '-' },
      { label:'담당자', value:record.owner && typeof asWorkerName === 'function' ? asWorkerName(record.owner) : (record.manager || record.owner || '-') },
      { label:'수리비', value:selectionDetailMoney(record.cost) },
      { label:'완료일', value:selectionDetailFormatValue('doneDate', record.doneDate) },
      { label:'처리내용', value:record.action || '-' },
      { label:'메모', value:record.note || record.memo || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'defect') {
    return [
      { label:'코드', value:record.id || '-' },
      { label:'일자', value:selectionDetailFormatValue('date', record.date) },
      { label:'제품', value:selectionDetailProductName(record) },
      { label:'발생공정', value:record.stage || '-' },
      { label:'하자유형', value:record.type || '-' },
      { label:'수량', value:selectionDetailFormatValue('qty', record.qty) },
      { label:'원인', value:record.cause || '-' },
      { label:'처리내용', value:record.action || '-' },
      { label:'상태', value:record.status || '-' },
      { label:'비고', value:record.note || record.memo || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'checkRecord') {
    return [
      { label:'검사일', value:selectionDetailFormatValue('date', record.date) },
      { label:'의뢰처', value:selectionDetailClientName(record) },
      { label:'완료제품', value:selectionDetailProductName(record) },
      { label:'검사원', value:record.inspector || '-' },
      { label:'외관', value:record.visual || '-' },
      { label:'치수', value:record.dim || '-' },
      { label:'기능', value:record.func || '-' },
      { label:'종합판정', value:record.result || record.status || '-' },
      { label:'참고', value:record.note || record.memo || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'claim') {
    return [
      { label:'문서번호', value:record.id || '-' },
      { label:'인입일', value:selectionDetailFormatValue('date', record.date) },
      { label:'유형', value:record.kind || '-' },
      { label:'의뢰 고객사', value:typeof claimClientLabel === 'function' ? claimClientLabel(record) : selectionDetailClientName(record) },
      { label:'해당 제품', value:typeof claimProductLabel === 'function' ? claimProductLabel(record) : selectionDetailProductName(record) },
      { label:'사양', value:record.spec || '-' },
      { label:'내용', value:record.content || record.memo || '-' },
      { label:'조치 방안', value:record.response || '-' },
      { label:'상태', value:record.status || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'memo') {
    const tags = Array.isArray(record.tags) && record.tags.length ? record.tags.map(tag => '#' + tag).join(' ') : '-';
    const linked = record.entityType ? `${record.entityType} ${record.entityId || ''}`.trim() : '일반 메모';
    const content = String(record.content || '-');
    const summary = String(record.summary || '').trim();
    return [
      { label:'제목', value:record.title || '-' },
      { label:'내용', value:content.length > 500 ? content.slice(0, 500) + '...' : content },
      { label:'태그', value:tags },
      { label:'중요', value:record.important ? '예' : '아니오' },
      { label:'작성자', value:record.author || '-' },
      { label:'연결 항목', value:linked },
      { label:'첨부파일', value:Array.isArray(record.attachments) && record.attachments.length ? `${record.attachments.length}건` : '-' },
      { label:'AI 요약', value:summary ? (summary.length > 300 ? summary.slice(0, 300) + '...' : summary) : '-' }
    ];
  }
  if (record && ref && ref.entityType === 'todo') {
    const checklist = Array.isArray(record.checklist) ? record.checklist : [];
    const done = checklist.filter(item => item && typeof item === 'object' && item.done).length;
    const linkedMemo = record.memoId && typeof memoList !== 'undefined' ? memoList.find(m => m.id === record.memoId) : null;
    return [
      { label:'할 일', value:record.title || '-' },
      { label:'상세 내용', value:record.content || '-' },
      { label:'담당자', value:record.owner || '-' },
      { label:'우선순위', value:record.priority || '-' },
      { label:'상태', value:record.status || '-' },
      { label:'마감일', value:record.dueDate || '-' },
      { label:'체크리스트', value:checklist.length ? `${done}/${checklist.length} 완료` : '-' },
      { label:'연결 메모', value:linkedMemo ? linkedMemo.title || linkedMemo.id : (record.memoId || '-') }
    ];
  }
  if (record && ref && ref.entityType === 'inventory') {
    return [
      { label:'재고코드', value:record.id || record.code || '-' },
      { label:'품목명', value:record.name || '-' },
      { label:'재고 구분', value:record.category || '-' },
      { label:'분류', value:record.type || '-' },
      { label:'현재고', value:selectionDetailQtyUnit(record.qty || record.stock || 0, record.unit) },
      { label:'안전재고', value:selectionDetailFormatValue('minQty', record.minQty != null ? record.minQty : record.safeStock) },
      { label:'보관위치', value:record.location || '-' },
      { label:'참고', value:record.note || record.memo || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'workOrder') {
    return [
      { label:'지시번호', value:record.id || '-' },
      { label:'고객사', value:selectionDetailClientName(record) },
      { label:'생산 제품', value:selectionDetailProductName(record) },
      { label:'라인', value:record.line || '-' },
      { label:'목표량', value:selectionDetailFormatValue('qty', record.qty) },
      { label:'실적량', value:selectionDetailFormatValue('done', record.done) },
      { label:'불량', value:selectionDetailFormatValue('defect', record.defect) },
      { label:'진행률', value:selectionDetailProgressValue(record) },
      { label:'개시일', value:selectionDetailFormatValue('start', record.start) },
      { label:'납기일', value:selectionDetailFormatValue('due', record.due) },
      { label:'상태', value:record.status || '-' },
      { label:'담당자', value:record.manager || '-' },
      { label:'메모', value:record.note || record.memo || '-' }
    ];
  }
  const fields = primary ? selectionDetailRecordFields(primary.ref, primary.record, primary.row) : [];
  return fields.slice(0, 6);
}

function selectionDetailScheduleRows(primary) {
  const record = primary && primary.record;
  const ref = primary && primary.ref;
  if (record && ref && ref.entityType === 'material') {
    const mat = selectionDetailMaterialContext(record);
    return [
      { label:'구매단가', value:selectionDetailMoney(record.unitPrice) },
      { label:'매입총액', value:selectionDetailMoney(mat.amount) },
      { label:'주문일자', value:record.orderDate || '-' },
      { label:'입고예정', value:record.expectedDate || '-' }
    ];
  }
  if (record && ref && ref.entityType === 'po') {
    const po = selectionDetailPoContext(record);
    return [
      { label:'단가', value:selectionDetailMoney(record.unitPrice) },
      { label:'금액', value:selectionDetailMoney(po.amount) },
      { label:'발행일', value:record.date || '-' },
      { label:'납품방법', value:record.dlvMethod || '-' },
      { label:'결제조건', value:record.payMethod || '-' }
    ];
  }
  if (record && ref && ['rfq','statement','tax','quote','order'].includes(ref.entityType)) {
    const doc = selectionDetailDocumentContext(record, ref.entityType);
    const rows = [
      { label:ref.entityType === 'rfq' ? '희망단가' : '단가', value:selectionDetailMoney(doc.unitPrice) },
      { label:'공급가액', value:selectionDetailMoney(doc.amount) }
    ];
    if (['statement','tax','quote','order'].includes(ref.entityType)) {
      rows.push(
        { label:'부가세', value:selectionDetailMoney(doc.vat) },
        { label:'합계', value:selectionDetailMoney(doc.grandTotal) }
      );
    }
    rows.push({ label:['statement','tax'].includes(ref.entityType) ? '발행일' : '일자', value:record.date || record.requestDate || '-' });
    if (record.deliveryDate) rows.push({ label:'납기', value:record.deliveryDate });
    return rows;
  }
  if (record && ref && ref.entityType === 'memo') {
    return [
      { label:'등록일', value:selectionDetailFormatValue('createdAt', record.createdAt) },
      { label:'수정일', value:selectionDetailFormatValue('updatedAt', record.updatedAt) }
    ];
  }
  if (record && ref && ref.entityType === 'todo') {
    return [
      { label:'시작일', value:record.startDate || '-' },
      { label:'알림일', value:record.reminderDate || '-' },
      { label:'등록일', value:selectionDetailFormatValue('createdAt', record.createdAt) },
      { label:'수정일', value:selectionDetailFormatValue('updatedAt', record.updatedAt) }
    ];
  }
  if (record && ref && ['as','defect','checkRecord','claim','inventory','workOrder'].includes(ref.entityType)) return [];
  const fields = primary ? selectionDetailRecordFields(primary.ref, primary.record, primary.row) : [];
  return fields.filter(field => /(금액|단가|합계|총액|일자|납기|예정|등록일|수정일)/.test(field.label)).slice(0, 5);
}

function selectionDetailWorkActionsHtml(context) {
  if (!context) return '';
  if (context.source === 'react-domain') {
    if (context.key === 'po') {
      const docMenu = selectionDetailPoDocumentMenuHtml();
      return `<button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('edit')">수정</button>
        <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('clone')">복제</button>
        ${docMenu}
        <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('payment')">결제요청</button>
        <button class="selection-detail-work-btn is-danger" onclick="runSelectionDetailPanelAction('delete')">삭제</button>`;
    }
    const actions = typeof bulkActionButtons === 'function' ? bulkActionButtons(context.key, { hideComplete:true }) : '';
    return actions || '<button class="selection-detail-work-btn" onclick="openSelectionDetailAudit()">세부 이력</button>';
  }
  if (context.source === 'react-inventory' && context.count !== 1) {
    return '<button class="selection-detail-work-btn" onclick="clearSelectionDetailSelection()">해제</button>';
  }
  if (context.count !== 1) {
    return `<button class="selection-detail-work-btn" onclick="clearSelectionDetailSelection()">해제</button>
      <button class="selection-detail-work-btn is-danger" onclick="runSelectionDetailDeleteAction()">삭제</button>`;
  }
  const isBulk = context.source === 'bulk';
  const key = context.key || '';
  if (context.source === 'notes') {
    const item = context.items && context.items[0];
    const type = item && item.ref && item.ref.entityType;
    if (type === 'memo') {
      return `<button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('edit')">수정</button>
        <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('aiSummary', event)">AI 요약</button>
        <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('toTodo')">할 일로 이동</button>
        <button class="selection-detail-work-btn is-danger" onclick="runSelectionDetailPanelAction('delete')">삭제</button>`;
    }
    if (type === 'todo') {
      return `<button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('edit')">수정</button>
        <button class="selection-detail-work-btn is-danger" onclick="runSelectionDetailPanelAction('delete')">삭제</button>`;
    }
  }
  if (context.source === 'react-inventory') {
    return '<button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction(&quot;edit&quot;)">수정</button><button class="selection-detail-work-btn is-danger" onclick="runSelectionDetailPanelAction(&quot;delete&quot;)">삭제</button>';
  }
  if (context.source === 'po') {
    const docMenu = selectionDetailPoDocumentMenuHtml();
    return `
      <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('edit')">수정</button>
      <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('clone')">복제</button>
      ${docMenu}
      <button class="selection-detail-work-btn" onclick="runSelectionDetailPanelAction('payment')">결제요청</button>
      <button class="selection-detail-work-btn is-danger" onclick="runSelectionDetailPanelAction('delete')">삭제</button>`;
  }
  if (isBulk) {
    const actions = typeof bulkActionButtons === 'function' ? bulkActionButtons(key, { hideComplete:true }) : '';
    return actions || `<button class="selection-detail-work-btn" onclick="openSelectionDetailAudit()">세부 이력</button>`;
  }
  return selectionDetailManagedActionHtml(context) || `<button class="selection-detail-work-btn" onclick="openSelectionDetailAudit()">세부 이력</button>`;
}

function selectionDetailPoDocumentMenuHtml() {
  if (typeof registerBulkDocMenuListeners === 'function') registerBulkDocMenuListeners();
  const canPdf = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('pdf');
  const canCsv = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('csv');
  const actions = [];
  if (canPdf) actions.push({ action:'print', icon:'ti ti-printer', label:'PDF 출력' });
  if (canCsv) actions.push({ action:'export', icon:'ti ti-file-spreadsheet', label:'엑셀' });
  if (canPdf && canCsv) actions.push({ action:'drive', icon:'ti ti-cloud-upload', label:'Drive 저장', cls:'drive-save-btn' });
  actions.push({ action:'email', icon:'ti ti-mail', label:'이메일' });
  if (!actions.length) return '';
  const items = actions.map(item =>
    `<button class="btn btn-sm ${item.cls || ''}" type="button" data-doc-action="${item.action}" ${item.action === 'email' ? 'data-email' : ''} role="menuitem" onclick="runSelectionDetailDocMenuAction(event,'${item.action}')"><i class="${item.icon}"></i>${item.label}</button>`
  ).join('');
  return `<span class="bulk-doc-menu-wrap" data-bulk-doc-wrap>
    <button class="btn btn-sm bulk-doc-menu-trigger" type="button" data-bulk-doc-trigger onclick="bulkToggleDocMenu(event,this)"><i class="ti ti-folder-cog"></i>문서 처리<i class="ti ti-chevron-down bulk-doc-menu-caret"></i></button>
    <span class="bulk-doc-menu" data-bulk-doc-menu role="menu">${items}</span>
  </span>`;
}

function selectionDetailCompletionSpec(ref) {
  const type = ref && ref.entityType;
  if (type === 'material' || type === 'po') return { status:'입고완료', label:'입고 완료 처리' };
  if (['workOrder','defect','claim','order','todo'].includes(type)) return { status:'완료', label:'완료 처리' };
  return null;
}

function selectionDetailCompletionTargets(context) {
  const items = context && Array.isArray(context.items) ? context.items : [];
  return items.map(item => {
    const spec = selectionDetailCompletionSpec(item.ref);
    if (!spec || !item.ref || !item.ref.entityId) return null;
    const currentStatus = item.record && item.record.status;
    if (currentStatus === spec.status) return null;
    return { item, spec };
  }).filter(Boolean);
}

function selectionDetailCompletionLabel(context) {
  const targets = selectionDetailCompletionTargets(context);
  if (!targets.length) return '';
  const labels = [...new Set(targets.map(target => target.spec.label))];
  const label = labels.length === 1 ? labels[0] : '완료 처리';
  return (context && context.count > 1 ? '일괄 ' : '') + label;
}

function selectionDetailTimelineHtml(refs) {
  const rows = auditLogRowsLocal()
    .filter(log => (refs || []).some(ref => auditLogMatchesRef(log, ref)))
    .map(enrichAuditLogFromCurrentRecord)
    .slice(0, 3);
  if (!rows.length) return '<div class="selection-detail-empty">표시할 이력이 없습니다.</div>';
  return `<div class="selection-detail-timeline">${rows.map(log => `
    <div class="selection-detail-timeline-row">
      <span class="selection-detail-dot ${String(log.action || '').includes('status') ? 'is-ok' : ''}"></span>
      <div>
        <b>${selectionDetailEsc(log.summary || auditLabelForAction(log.action || '') || '변경')}</b>
        <span>${selectionDetailEsc(log.at ? new Date(log.at).toLocaleString('ko-KR') : '-')} · ${selectionDetailEsc(typeof auditActorDisplayName === 'function' ? auditActorDisplayName(log) : (log.actorName || '-'))}</span>
      </div>
    </div>`).join('')}</div>`;
}

function selectionDetailBottomActionsHtml(context) {
  const primary = context && context.items && context.items[0];
  const ref = primary && primary.ref;
  const record = primary && primary.record;
  if (context && context.count > 1) {
    const completeLabel = selectionDetailCompletionLabel(context);
    if (completeLabel) {
      return `
      <button class="selection-detail-primary-action" type="button" onclick="runSelectionDetailPrimaryAction()">${selectionDetailEsc(completeLabel)}</button>
      <div class="selection-detail-bottom-row">
        <button class="selection-detail-secondary-action" type="button" onclick="clearSelectionDetailSelection()">선택 해제</button>
        <button class="selection-detail-secondary-action" type="button" onclick="closeSelectionDetailPanel(true)">닫기</button>
      </div>`;
    }
    return `<div class="selection-detail-bottom-row">
      <button class="selection-detail-secondary-action" type="button" onclick="clearSelectionDetailSelection()">선택 해제</button>
      <button class="selection-detail-secondary-action" type="button" onclick="closeSelectionDetailPanel(true)">닫기</button>
    </div>`;
  }
  if (context && context.count === 1 && ref && ref.entityType === 'material') {
    const done = record && record.status === '입고완료';
    return `
      <button class="selection-detail-primary-action" type="button" ${done ? 'disabled' : ''} onclick="runSelectionDetailPrimaryAction()">${done ? '입고 완료됨' : '입고 완료 처리'}</button>
      <div class="selection-detail-bottom-row">
        <button class="selection-detail-secondary-action" type="button" onclick="runSelectionDetailHoldAction()">보류</button>
        <button class="selection-detail-secondary-action" type="button" onclick="closeSelectionDetailPanel(true)">닫기</button>
      </div>`;
  }
  if (context && context.count === 1 && ref && ref.entityType === 'po') {
    const done = record && record.status === '입고완료';
    return `
      <button class="selection-detail-primary-action" type="button" ${done ? 'disabled' : ''} onclick="runSelectionDetailPrimaryAction()">${done ? '입고 완료됨' : '입고 완료 처리'}</button>
      <div class="selection-detail-bottom-row">
        <button class="selection-detail-secondary-action" type="button" onclick="clearSelectionDetailSelection()">선택 해제</button>
        <button class="selection-detail-secondary-action" type="button" onclick="closeSelectionDetailPanel(true)">닫기</button>
      </div>`;
  }
  return `
    <button class="selection-detail-primary-action" type="button" onclick="openSelectionDetailAudit()">이력 전체 보기</button>
    <div class="selection-detail-bottom-row">
      <button class="selection-detail-secondary-action" type="button" onclick="clearSelectionDetailSelection()">선택 해제</button>
      <button class="selection-detail-secondary-action" type="button" onclick="closeSelectionDetailPanel(true)">닫기</button>
    </div>`;
}

function selectionDetailAuditPreviewHtml(refs) {
  const rows = auditLogRowsLocal()
    .filter(log => (refs || []).some(ref => auditLogMatchesRef(log, ref)))
    .map(enrichAuditLogFromCurrentRecord)
    .slice(0, 4);
  if (!rows.length) return '<div class="selection-detail-empty">표시할 이력이 없습니다.</div>';
  return rows.map(log => `
    <div class="selection-detail-history-row">
      <div class="selection-detail-history-main">${selectionDetailEsc(auditLabelForAction(log.action || '') || log.action || '변경')}</div>
      <div class="selection-detail-history-sub">${selectionDetailEsc(log.at ? new Date(log.at).toLocaleString('ko-KR') : '-')} · ${selectionDetailEsc(typeof auditActorDisplayName === 'function' ? auditActorDisplayName(log) : (log.actorName || '-'))}</div>
    </div>`).join('');
}

function selectionDetailEmailPreviewHtml(refs) {
  if (typeof documentEmailHistoryRows !== 'function') return '';
  const docTypes = new Set(['rfq','po','statement','tax','quote','order']);
  const rows = [];
  (refs || []).forEach(ref => {
    const type = String(ref && ref.entityType || '');
    if (!docTypes.has(type)) return;
    documentEmailHistoryRows(type, ref.entityId).slice(0, 3).forEach(row => rows.push(Object.assign({ _docType:type, _docId:ref.entityId }, row)));
  });
  rows.sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')));
  if (!rows.length) return '';
  return `
    <section class="selection-detail-section">
      <div class="selection-detail-section-title"><i class="ti ti-mail"></i>이메일 내역</div>
      ${rows.slice(0, 3).map(row => `
        <button type="button" class="selection-detail-history-row selection-detail-email-row" onclick="openEmailHistoryModal('${selectionDetailEsc(row._docType)}','${selectionDetailEsc(row._docId)}')">
          <span class="selection-detail-history-main">${selectionDetailEsc(row.to || '-')}</span>
          <span class="selection-detail-history-sub">${selectionDetailEsc(typeof formatEmailHistoryTime === 'function' ? formatEmailHistoryTime(row.sentAt, true) : (row.sentAt || '-'))} · ${selectionDetailEsc(row.status || '발송 요청')}</span>
        </button>`).join('')}
    </section>`;
}

function selectionDetailSignature(context) {
  const ids = (context.items || []).map(item => `${item.ref && item.ref.entityType || ''}:${item.ref && item.ref.entityId || ''}`).join('|');
  return `${context.source || ''}:${context.key || context.token || ''}:${ids}`;
}

function selectionDetailRowActions(table, row) {
  if (!table || !row) return [];
  const actionIndex = findManagedActionIndex(table);
  const scope = actionIndex >= 0 && row.cells[actionIndex] ? row.cells[actionIndex] : row;
  return Array.from(scope.querySelectorAll('button,a')).filter(el => {
    if (el.matches('input,select,textarea')) return false;
    if (el.closest('[data-audit-detail-btn]')) return false;
    if (el.classList.contains('table-action-select')) return false;
    return el.matches('button,a');
  });
}

function selectionDetailManagedActionHtml(context) {
  if (!context || context.count !== 1) return '';
  const row = context.rows && context.rows[0];
  const table = context.table;
  const actions = selectionDetailRowActions(table, row);
  if (!actions.length) return '';
  const rowIndex = Array.from(table.querySelectorAll('tbody tr')).indexOf(row);
  return actions.slice(0, 8).map((action, index) =>
    `<button class="btn btn-sm" type="button" onclick="runManagedDetailAction('${context.token}',${rowIndex},${index})"><i class="ti ti-click"></i>${selectionDetailEsc(tableActionLabel(action, index))}</button>`
  ).join('');
}

function selectionDetailFindRowForRef(ref) {
  if (!ref || !ref.entityId) return null;
  const entityType = String(ref.entityType || '');
  const entityId = String(ref.entityId || '');
  const scopes = Array.from(document.querySelectorAll('.content.active table, #po-table table, #mat-table table'));
  for (const table of scopes) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    for (const row of rows) {
      const rowRef = inferRowAuditRef(row, table);
      if (!rowRef) continue;
      if (String(rowRef.entityId || '') !== entityId) continue;
      if (entityType && String(rowRef.entityType || '') !== entityType) continue;
      return row;
    }
  }
  return null;
}

function refreshSelectionDetailAfterInlineChange(ref) {
  const current = selectionDetailContext;
  if (!current || !ref) return;
  window.setTimeout(() => {
    if (!selectionDetailContext) return;
    const freshRecord = selectionDetailRecordForRef(ref) || (selectionDetailContext.items && selectionDetailContext.items[0] && selectionDetailContext.items[0].record) || null;
    const freshRow = selectionDetailFindRowForRef(ref) || (selectionDetailContext.items && selectionDetailContext.items[0] && selectionDetailContext.items[0].row) || null;
    if (freshRow) {
      const check = rowSelectionCheckbox(freshRow);
      if (check) {
        check.checked = true;
        syncManagedTableRow(freshRow);
      }
    }
    const next = Object.assign({}, selectionDetailContext, {
      rows: freshRow ? [freshRow] : (selectionDetailContext.rows || []),
      items: [selectionDetailItem(ref, freshRow, freshRecord)],
      count: 1
    });
    selectionDetailContext = next;
    renderSelectionDetailPanel(next);
    requestAnimationFrame(() => {
      const sourcePanel = ensureSelectionDetailPanel();
      sourcePanel.classList.add('open');
      publishSelectionDetailReactState(sourcePanel, true);
    });
  }, 60);
}

function runSelectionDetailInlineControl(index, value) {
  const context = selectionDetailContext;
  if (!context || context.count !== 1) return;
  const primary = context.items && context.items[0];
  const ref = primary && primary.ref;
  const controls = selectionDetailEditableControls(context).filter(entry => !selectionDetailIsStatusControlEntry(entry));
  const entry = controls[index];
  const control = entry && entry.control;
  if (!control) {
    if (typeof showToast === 'function') showToast('변경할 항목을 찾지 못했습니다.', 'error');
    return;
  }
  try {
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles:true }));
    refreshSelectionDetailAfterInlineChange(ref);
  } catch(e) {
    if (typeof showToast === 'function') showToast('상태 변경 중 오류가 발생했습니다.', 'error');
  }
}

function closeSelectionDetailStatusMenus(except) {
  document.querySelectorAll('.selection-detail-status-menu-wrap.open').forEach(wrap => {
    if (wrap !== except) wrap.classList.remove('open');
  });
}

function toggleSelectionDetailStatusMenu(button, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }
  const wrap = button && button.closest ? button.closest('.selection-detail-status-menu-wrap') : null;
  if (!wrap) return;
  const nextOpen = !wrap.classList.contains('open');
  closeSelectionDetailStatusMenus(wrap);
  wrap.classList.toggle('open', nextOpen);
}

function handleSelectionDetailStatusMenuClick(target, event) {
  if (!target || !target.closest) return false;
  const option = target.closest('[data-selection-status-option]');
  if (option) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (!option.disabled) runSelectionDetailStatusControl(option.dataset.value || '');
    return true;
  }
  const toggle = target.closest('[data-selection-status-toggle]');
  if (toggle) {
    toggleSelectionDetailStatusMenu(toggle, event);
    return true;
  }
  if (target.closest('[data-selection-status-menu]')) {
    if (event) {
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    return true;
  }
  return false;
}

function bindSelectionDetailStatusMenu(panel) {
  if (!panel || !panel.querySelectorAll) return;
  panel.querySelectorAll('[data-selection-status-toggle]').forEach(button => {
    button.addEventListener('click', event => {
      toggleSelectionDetailStatusMenu(button, event);
    });
  });
  panel.querySelectorAll('[data-selection-status-option]').forEach(option => {
    option.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (!option.disabled) runSelectionDetailStatusControl(option.dataset.value || '');
    });
  });
  panel.querySelectorAll('[data-selection-status-menu]').forEach(menu => {
    menu.addEventListener('click', event => {
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    });
  });
}

function runSelectionDetailStatusControl(value) {
  closeSelectionDetailStatusMenus();
  const context = selectionDetailContext;
  if (!context || context.count !== 1) return;
  const primary = context.items && context.items[0];
  const ref = primary && primary.ref;
  const entry = selectionDetailStatusControlEntry(context);
  const control = entry && entry.control;
  if (!control) {
    if (typeof showToast === 'function') showToast('상태를 변경할 항목을 찾지 못했습니다.', 'error');
    return;
  }
  try {
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles:true }));
    refreshSelectionDetailAfterInlineChange(ref);
  } catch(e) {
    if (typeof showToast === 'function') showToast('상태 변경 중 오류가 발생했습니다.', 'error');
  }
}

function selectionDetailActionsHtml(context) {
  const auditBtn = `<button class="btn btn-sm" type="button" onclick="openSelectionDetailAudit()"><i class="ti ti-history"></i>세부 이력</button>`;
  const clearBtn = `<button class="btn btn-sm" type="button" onclick="clearSelectionDetailSelection()"><i class="ti ti-x"></i>선택 해제</button>`;
  if (context.source === 'bulk' && typeof bulkActionButtons === 'function') {
    return `${auditBtn}${bulkActionButtons(context.key)}${clearBtn}`;
  }
  if (context.source === 'react-inventory') {
    const itemActions = context.count === 1
      ? '<button class="btn btn-sm" type="button" onclick="runSelectionDetailPanelAction(&quot;edit&quot;)"><i class="ti ti-edit"></i>수정</button><button class="btn btn-sm btn-danger" type="button" onclick="runSelectionDetailPanelAction(&quot;delete&quot;)"><i class="ti ti-trash"></i>삭제</button>'
      : '';
    return auditBtn + itemActions + clearBtn;
  }
  return `${auditBtn}${selectionDetailManagedActionHtml(context)}${clearBtn}`;
}

function updateSelectionDetailPanelTop() {
  const topbar = document.querySelector('.main > .topbar') || document.querySelector('.topbar');
  const rect = topbar && topbar.getBoundingClientRect ? topbar.getBoundingClientRect() : null;
  const top = rect && rect.height > 0 ? Math.round(rect.bottom) : 52;
  document.documentElement.style.setProperty('--selection-detail-top', `${Math.max(0, top)}px`);
}

function selectionDetailWidthBounds() {
  const viewport = Math.max(0, window.innerWidth || document.documentElement.clientWidth || SELECTION_DETAIL_DEFAULT_WIDTH);
  const max = Math.max(SELECTION_DETAIL_MIN_WIDTH, Math.min(SELECTION_DETAIL_MAX_WIDTH, viewport - 24));
  const min = Math.min(SELECTION_DETAIL_MIN_WIDTH, max);
  return { min, max };
}

function storedSelectionDetailPanelWidth() {
  let raw = '';
  try { raw = localStorage.getItem(SELECTION_DETAIL_WIDTH_STORAGE_KEY) || ''; } catch (e) { raw = ''; }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : SELECTION_DETAIL_DEFAULT_WIDTH;
}

function applySelectionDetailPanelWidth(width) {
  const bounds = selectionDetailWidthBounds();
  const next = Math.round(Math.min(bounds.max, Math.max(bounds.min, Number(width) || SELECTION_DETAIL_DEFAULT_WIDTH)));
  document.documentElement.style.setProperty('--selection-detail-width', `${next}px`);
  return next;
}

function saveSelectionDetailPanelWidth(width) {
  const next = applySelectionDetailPanelWidth(width);
  try { localStorage.setItem(SELECTION_DETAIL_WIDTH_STORAGE_KEY, String(next)); } catch (e) {}
  return next;
}

function initSelectionDetailPanelWidth() {
  return applySelectionDetailPanelWidth(storedSelectionDetailPanelWidth());
}

function startSelectionDetailResize(event) {
  if (!event || selectionDetailDisabledOnMobile()) return;
  const handle = event.currentTarget;
  const panel = handle && handle.closest ? handle.closest('.selection-detail-panel, .mat-entry-dialog') : null;
  const startX = event.clientX;
  const startWidth = applySelectionDetailPanelWidth(storedSelectionDetailPanelWidth());
  if (!Number.isFinite(startX)) return;
  event.preventDefault();
  event.stopPropagation();
  document.body.classList.add('selection-detail-resizing');
  if (panel) panel.classList.add('is-resizing');
  if (handle && handle.setPointerCapture && event.pointerId != null) {
    try { handle.setPointerCapture(event.pointerId); } catch (e) {}
  }
  const onMove = moveEvent => {
    const clientX = moveEvent.clientX;
    if (!Number.isFinite(clientX)) return;
    applySelectionDetailPanelWidth(startWidth + (startX - clientX));
  };
  const onUp = upEvent => {
    const clientX = Number.isFinite(upEvent.clientX) ? upEvent.clientX : startX;
    saveSelectionDetailPanelWidth(startWidth + (startX - clientX));
    document.body.classList.remove('selection-detail-resizing');
    if (panel) panel.classList.remove('is-resizing');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function selectionDetailDisabledOnMobile() {
  return window.matchMedia ? window.matchMedia('(max-width: 760px)').matches : window.innerWidth <= 760;
}

function ensureSelectionDetailPanel() {
  updateSelectionDetailPanelTop();
  initSelectionDetailPanelWidth();
  let panel = document.getElementById('selection-detail-panel');
  if (panel) {
    if (document.getElementById('selection-detail-react-root')) panel.style.display = 'none';
    return panel;
  }
  panel = document.createElement('aside');
  panel.id = 'selection-detail-panel';
  panel.className = 'selection-detail-panel';
  panel.setAttribute('aria-live', 'polite');
  if (document.getElementById('selection-detail-react-root')) panel.style.display = 'none';
  document.body.appendChild(panel);
  return panel;
}

function closeSelectionDetailPanel(manual) {
  const panel = document.getElementById('selection-detail-panel');
  if (panel) panel.classList.remove('open');
  publishSelectionDetailReactState(panel, false);
  if (manual) selectionDetailManuallyClosed = true;
  if (!manual) {
    selectionDetailContext = null;
    selectionDetailLastSignature = '';
    selectionDetailManuallyClosed = false;
  }
}

function renderSelectionDetailPanel(context) {
  updateSelectionDetailPanelTop();
  const panel = ensureSelectionDetailPanel();
  const primary = context.items[0];
  const refs = context.items.map(item => item.ref).filter(Boolean);
  const isMulti = context.items.length > 1;
  const listHtml = isMulti ? selectionDetailMultiSelectedListHtml(context) : '';
  const infoRows = isMulti ? [] : selectionDetailBasicRows(primary).concat(selectionDetailScheduleRows(primary));
  const infoHtml = isMulti ? selectionDetailMultiSummaryHtml(context) : `
      <section class="selection-detail-section">
        <div class="selection-detail-section-title">기본 정보 / 금액</div>
        ${selectionDetailKeyValueRows(infoRows)}
      </section>`;
  const editHtml = selectionDetailInlineEditHtml(context);
  panel.innerHTML = `
    <div class="selection-detail-resizer" onpointerdown="startSelectionDetailResize(event)" title="폭 조절"></div>
    <div class="selection-detail-hd">
      <div>
        <h3>상세 정보</h3>
        <p>${selectionDetailEsc(context.count > 1 ? `선택한 항목 ${context.count}건` : `선택한 ${selectionDetailEntityLabel(primary && primary.ref && primary.ref.entityType)} 항목`)}</p>
      </div>
      <button class="icon-btn" type="button" onclick="closeSelectionDetailPanel(true)" title="닫기"><i class="ti ti-x"></i></button>
    </div>
    <div class="selection-detail-body">
      <div data-selection-detail-static>
        ${selectionDetailHeaderHtml(context, primary)}
        <section class="selection-detail-section selection-detail-work-section">
          <div class="selection-detail-section-title">선택 작업</div>
          <div class="selection-detail-work-actions">${selectionDetailWorkActionsHtml(context)}</div>
        </section>
      </div>
      <div data-selection-detail-tab="overview">
        ${editHtml}
        ${infoHtml}
      </div>
      <div data-selection-detail-tab="items">${listHtml}</div>
      <div data-selection-detail-tab="history">
        <section class="selection-detail-section">
          <div class="selection-detail-section-title">최근 이력</div>
          ${selectionDetailTimelineHtml(refs)}
        </section>
        ${selectionDetailEmailPreviewHtml(refs)}
      </div>
    </div>
    <div class="selection-detail-actions">${selectionDetailBottomActionsHtml(context)}</div>`;
  if (context.source === 'bulk' || context.source === 'react-domain') {
    panel.querySelectorAll('[data-edit]').forEach(el => { el.style.display = context.count === 1 ? '' : 'none'; });
    panel.querySelectorAll('[data-clone]').forEach(el => { el.style.display = context.count === 1 ? '' : 'none'; });
    panel.querySelectorAll('[data-email]').forEach(el => { el.style.display = context.count === 1 ? '' : 'none'; });
    panel.querySelectorAll('[data-bulk-doc-menu]').forEach(menu => {
      const visibleActions = [...menu.querySelectorAll('[data-doc-action]')].some(btn => btn.style.display !== 'none');
      const wrap = menu.closest('[data-bulk-doc-wrap]');
      if (wrap) wrap.style.display = visibleActions ? '' : 'none';
    });
  }
  bindSelectionDetailStatusMenu(panel);
  publishSelectionDetailReactState(panel, panel.classList.contains('open'));
}

function selectionDetailHasActiveSelection(context) {
  if (!context) return false;
  if (context.source === 'bulk') {
    return typeof bulkSel !== 'undefined' && bulkSel[context.key] && bulkSel[context.key].size > 0;
  }
  if (context.source === 'react-domain') {
    return typeof getReactDomainSelectedIds === 'function' && getReactDomainSelectedIds(context.key).length > 0;
  }
  if (context.source === 'po') {
    return typeof poCheckedIds === 'function' && poCheckedIds().length > 0;
  }
  if (context.source === 'managed') {
    const table = context.table || MANAGED_TABLES.get(context.token);
    return !!(table && selectedManagedRows(table).length);
  }
  if (context.source === 'notes') {
    if (context.key === 'memo') return typeof _memoSelected !== 'undefined' && _memoSelected.size > 0;
    if (context.key === 'todo') return typeof _todoSelected !== 'undefined' && _todoSelected.size > 0;
  }
  return true;
}

function syncSelectionDetailPanelVisibility() {
  if (selectionDetailContext && !selectionDetailHasActiveSelection(selectionDetailContext)) {
    closeSelectionDetailPanel(false);
  }
}

function showSelectionDetailPanel(context) {
  if (!context || !context.count) {
    closeSelectionDetailPanel(false);
    return;
  }
  if (selectionDetailDisabledOnMobile()) {
    closeSelectionDetailPanel(false);
    return;
  }
  if (window.__selectionDetailSuppressAutoOpen === true) {
    closeSelectionDetailPanel(true);
    return;
  }
  const signature = selectionDetailSignature(context);
  if (selectionDetailManuallyClosed && selectionDetailLastSignature === signature) return;
  const panel = document.getElementById('selection-detail-panel');
  if (!selectionDetailManuallyClosed && selectionDetailLastSignature === signature && panel && panel.classList.contains('open')) {
    selectionDetailContext = context;
    return;
  }
  selectionDetailContext = context;
  selectionDetailLastSignature = signature;
  selectionDetailManuallyClosed = false;
  renderSelectionDetailPanel(context);
  requestAnimationFrame(() => {
      const sourcePanel = ensureSelectionDetailPanel();
      sourcePanel.classList.add('open');
      publishSelectionDetailReactState(sourcePanel, true);
    });
}

function updateSelectionDetailPanelFromManagedTable(table) {
  if (!table || table.closest('.overlay') || tableBulkKey(table)) return;
  const rows = selectedManagedRows(table);
  if (!rows.length) {
    if (selectionDetailContext && selectionDetailContext.source === 'managed') closeSelectionDetailPanel(false);
    return;
  }
  const token = managedTableToken(table);
  const items = rows.map(row => {
    const ref = inferRowAuditRef(row, table) || { entityType:tableAuditType(table), entityId:rowFallbackId(row) };
    return selectionDetailItem(ref, row, selectionDetailRecordForRef(ref));
  });
  showSelectionDetailPanel({ source:'managed', token, table, rows, items, count:items.length });
}

function updateSelectionDetailPanelFromReactInventory(ids) {
  const cleanIds = Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map(id => String(id || '').trim())
    .filter(Boolean)));
  if (!cleanIds.length) {
    if (selectionDetailContext && selectionDetailContext.source === 'react-inventory') closeSelectionDetailPanel(false);
    return;
  }
  const items = cleanIds.map(id => {
    const ref = { entityType:'inventory', entityId:id };
    return selectionDetailItem(ref, null, selectionDetailRecordForRef(ref));
  }).filter(item => item.record);
  if (!items.length) {
    closeSelectionDetailPanel(false);
    return;
  }
  showSelectionDetailPanel({
    source:'react-inventory',
    key:'inventory',
    ids:items.map(item => item.ref.entityId),
    items,
    count:items.length
  });
}

function updateSelectionDetailPanelFromReactDomain(key, entityType, ids) {
  const cleanIds = Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map(id => String(id || '').trim())
    .filter(Boolean)));
  if (!cleanIds.length) {
    if (selectionDetailContext && selectionDetailContext.source === 'react-domain' && selectionDetailContext.key === key) {
      closeSelectionDetailPanel(false);
    }
    return;
  }
  const table = Array.from(document.querySelectorAll('[data-react-domain]'))
    .find(candidate => candidate.dataset.reactDomain === key);
  const rowsById = new Map();
  if (table) {
    table.querySelectorAll('tbody tr[data-entity-id]').forEach(row => {
      rowsById.set(String(row.dataset.entityId || ''), row);
    });
  }
  const items = cleanIds.map(id => {
    const ref = { entityType, entityId:id };
    const record = typeof bulkRecordById === 'function'
      ? (bulkRecordById(key, id) || selectionDetailRecordForRef(ref))
      : selectionDetailRecordForRef(ref);
    return selectionDetailItem(ref, rowsById.get(id) || null, record);
  }).filter(item => item.record);
  if (!items.length) {
    closeSelectionDetailPanel(false);
    return;
  }
  showSelectionDetailPanel({
    source:'react-domain',
    key,
    entityType,
    ids:items.map(item => item.ref.entityId),
    items,
    count:items.length
  });
}

function updateSelectionDetailPanelFromBulk(key) {
  if (typeof bulkSel === 'undefined' || typeof bulkRecordById !== 'function') return;
  const ids = [...(bulkSel[key] || [])];
  if (!ids.length) {
    if (selectionDetailContext && selectionDetailContext.source === 'bulk') closeSelectionDetailPanel(false);
    return;
  }
  const c = typeof BULK_CFG !== 'undefined' ? BULK_CFG[key] : null;
  const cont = c && document.querySelector(c.sel);
  const rowsById = new Map();
  if (cont) cont.querySelectorAll('tbody input[type=checkbox][data-bid]').forEach(chk => rowsById.set(chk.getAttribute('data-bid'), chk.closest('tr')));
  const entityType = typeof auditEntityTypeForBulkKey === 'function' ? auditEntityTypeForBulkKey(key) : key;
  const items = ids.map(id => {
    const ref = { entityType, entityId:id };
    const record = bulkRecordById(key, id) || selectionDetailRecordForRef(ref);
    return selectionDetailItem(ref, rowsById.get(id) || null, record);
  });
  showSelectionDetailPanel({ source:'bulk', key, ids, items, count:items.length });
}

function updateSelectionDetailPanelFromPo() {
  if (typeof poCheckedIds !== 'function') return;
  const ids = poCheckedIds();
  if (!ids.length) {
    if (selectionDetailContext && selectionDetailContext.source === 'po') closeSelectionDetailPanel(false);
    return;
  }
  const rowsById = new Map();
  document.querySelectorAll('#po-table tbody tr[data-po-id]').forEach(row => rowsById.set(row.getAttribute('data-po-id'), row));
  const rows = typeof visiblePurchaseOrderList === 'function'
    ? visiblePurchaseOrderList()
    : (typeof poList !== 'undefined' && Array.isArray(poList) ? poList : []);
  const recordsById = new Map(rows.map(row => [String(row.id || ''), row]));
  const items = ids.map(id => {
    const ref = { entityType:'po', entityId:id };
    const record = recordsById.get(String(id)) || selectionDetailRecordForRef(ref);
    return selectionDetailItem(ref, rowsById.get(String(id)) || null, record);
  });
  showSelectionDetailPanel({ source:'po', key:'po', ids, items, count:items.length });
}

function releaseSelectionDetailNavigationSuppress() {
  if (window.__selectionDetailSuppressAutoOpen === true) {
    window.__selectionDetailSuppressAutoOpen = false;
    selectionDetailManuallyClosed = false;
  }
}

function runManagedDetailAction(token, rowIndex, actionIndex) {
  const table = MANAGED_TABLES.get(token);
  const row = table && Array.from(table.querySelectorAll('tbody tr'))[rowIndex];
  const action = selectionDetailRowActions(table, row)[actionIndex];
  if (action) action.click();
}

function openSelectionDetailAudit() {
  const refs = selectionDetailContext && selectionDetailContext.items ? selectionDetailContext.items.map(item => item.ref).filter(Boolean) : [];
  openAuditDetailsForRefs(refs);
}

function clearSelectionDetailSelection() {
  const context = selectionDetailContext;
  if (!context) return;
  if (context.source === 'bulk' && typeof bulkToggleAll === 'function') bulkToggleAll(context.key, false);
  else if (context.source === 'po' && typeof poToggleAll === 'function') poToggleAll(false);
  else if (context.source === 'managed') clearManagedTableSelection(context.token);
  else if (context.source === 'react-inventory' && typeof clearReactInventorySelection === 'function') clearReactInventorySelection();
  else if (context.source === 'react-domain') {
    if (typeof clearReactDomainSelection === 'function') clearReactDomainSelection(context.key);
    if (typeof setBulkSelectionFromReact === 'function') setBulkSelectionFromReact(context.key, []);
  }
  else if (context.source === 'notes') {
    if (context.key === 'memo' && typeof clearMemoSelection === 'function') clearMemoSelection();
    else if (context.key === 'todo' && typeof clearTodoSelection === 'function') clearTodoSelection();
  }
  closeSelectionDetailPanel(false);
}

function runSelectionDetailDocMenuAction(event, action) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (typeof bulkCloseDocMenus === 'function') bulkCloseDocMenus();
  runSelectionDetailPanelAction(action);
}

function runSelectionDetailPanelAction(action, event) {
  const context = selectionDetailContext;
  if (!context || context.count !== 1) return;
  if (context.source === 'react-inventory') {
    const primary = context.items && context.items[0];
    const id = primary && primary.ref && primary.ref.entityId;
    if (!id) return;
    if (action === 'edit' && typeof openInvEdit === 'function') {
      closeSelectionDetailPanel(false);
      openInvEdit(id);
    } else if (action === 'delete' && typeof deleteInventory === 'function') {
      deleteInventory(id);
    }
    return;
  }
  if (context.source === 'react-domain' && context.key === 'po') {
    const primary = context.items && context.items[0];
    const id = primary && primary.ref && primary.ref.entityId;
    if (!id) return;
    if (action === 'payment' && typeof openPaymentRequestFromPo === 'function') {
      openPaymentRequestFromPo(id);
      return;
    }
    const actionMap = { print:'pdf', export:'csv' };
    if (typeof bulkRun === 'function') bulkRun('po', actionMap[action] || action);
    return;
  }
  if (context.source === 'po') {
    if (action === 'edit' && typeof poBulkEdit === 'function') poBulkEdit();
    else if (action === 'clone' && typeof poBulkClone === 'function') poBulkClone();
    else if (action === 'delete' && typeof poBulkDelete === 'function') poBulkDelete();
    else if (action === 'email' && typeof poBulkEmail === 'function') poBulkEmail();
    else if (action === 'drive' && typeof poBulkDrive === 'function') poBulkDrive();
    else if (action === 'print' && typeof poBulkPrint === 'function') poBulkPrint();
    else if (action === 'export' && typeof poBulkExport === 'function') poBulkExport();
    else if (action === 'payment' && typeof poBulkPaymentRequest === 'function') poBulkPaymentRequest();
    return;
  }
  if (context.source === 'notes') {
    const primary = context.items && context.items[0];
    const ref = primary && primary.ref;
    const id = ref && ref.entityId;
    if (!id) return;
    if (action === 'edit') {
      if (ref.entityType === 'memo' && typeof openMemoEditor === 'function') openMemoEditor(id);
      else if (ref.entityType === 'todo' && typeof openTodoEditor === 'function') openTodoEditor(id);
      return;
    }
    if (action === 'aiSummary' && ref.entityType === 'memo' && typeof summarizeMemoFromDetailPanel === 'function') {
      summarizeMemoFromDetailPanel(id, event);
      return;
    }
    if (action === 'toTodo' && ref.entityType === 'memo' && typeof moveSelectedMemosToTodos === 'function') {
      moveSelectedMemosToTodos();
      return;
    }
    if (action === 'delete') {
      runSelectionDetailDeleteAction();
      return;
    }
  }
  if (context.source === 'bulk' && typeof bulkRun === 'function') {
    if (action === 'po') {
      if (context.key === 'rfq') bulkRun(context.key, 'toPo');
      else if (typeof showToast === 'function') showToast('발주서 처리는 구매발주서 화면에서 진행하세요.', 'info');
      return;
    }
    bulkRun(context.key, action);
    return;
  }
  if (action === 'edit' || action === 'clone' || action === 'delete') {
    const labelMap = { edit:'수정', clone:'복제', delete:'삭제' };
    const row = context.rows && context.rows[0];
    const table = context.table;
    const actions = selectionDetailRowActions(table, row);
    const target = actions.find((button, index) => tableActionLabel(button, index).includes(labelMap[action]));
    if (target) target.click();
  }
}

function runSelectionDetailDeleteAction() {
  const context = selectionDetailContext;
  if (!context || !context.count) return;
  if (context.source === 'notes') {
    if (context.key === 'memo' && typeof deleteSelectedMemos === 'function') deleteSelectedMemos();
    else if (context.key === 'todo' && typeof deleteSelectedTodos === 'function') deleteSelectedTodos();
    return;
  }
  if (context.source === 'bulk' && typeof bulkRun === 'function') {
    bulkRun(context.key, 'delete');
    return;
  }
  if (context.source === 'po' && typeof poBulkDelete === 'function') {
    poBulkDelete();
    return;
  }
  const rows = context.rows || [];
  const table = context.table;
  const targets = rows.map(row => {
    const actions = selectionDetailRowActions(table, row);
    return actions.find((button, index) => tableActionLabel(button, index).includes('삭제') || button.classList.contains('del-btn'));
  }).filter(Boolean);
  if (!targets.length) {
    if (typeof showToast === 'function') showToast('삭제할 수 있는 선택 항목을 찾지 못했습니다.', 'info');
    return;
  }
  if (!confirm(`선택한 ${targets.length}건을 삭제하시겠습니까?`)) return;
  const oldConfirm = window.confirm;
  const oldConfirmFn = window.confirm_;
  window.confirm = () => true;
  window.confirm_ = (title, msg, fn) => { if (fn) fn(); };
  try {
    targets.forEach(target => { try { target.click(); } catch(e) {} });
  } finally {
    window.confirm = oldConfirm;
    window.confirm_ = oldConfirmFn;
  }
  closeSelectionDetailPanel(false);
}

function runSelectionDetailPrimaryAction() {
  const context = selectionDetailContext;
  const targets = selectionDetailCompletionTargets(context);
  if (!targets.length) {
    if (typeof showToast === 'function') showToast('완료 처리할 선택 항목이 없습니다.', 'info');
    return;
  }
  if (targets.length > 1 && !confirm(`선택한 ${targets.length}건을 완료 처리하시겠습니까?`)) return;
  let done = 0;
  targets.forEach(target => {
    const ref = target.item.ref;
    const id = ref.entityId;
    try {
      if (ref.entityType === 'material' && typeof changeMatStatus === 'function') { changeMatStatus(id, '입고완료'); done++; }
      else if (ref.entityType === 'po' && typeof changePoStatus === 'function') { changePoStatus(id, '입고완료'); done++; }
      else if (ref.entityType === 'workOrder' && typeof qStatus === 'function') { qStatus(id, '완료'); done++; }
      else if (ref.entityType === 'defect' && typeof changeDefectStatus === 'function') { changeDefectStatus(id, '완료'); done++; }
      else if (ref.entityType === 'claim' && typeof changeClaimStatus === 'function') { changeClaimStatus(id, '완료'); done++; }
      else if (ref.entityType === 'order' && typeof changeSODocStatus === 'function') { changeSODocStatus('order', id, '완료'); done++; }
      else if (ref.entityType === 'todo' && typeof setTodoStatus === 'function') { setTodoStatus(id, '완료'); done++; }
    } catch(e) {
      console.warn('선택 상세 완료 처리 실패:', ref.entityType, id, e);
    }
  });
  if (context && context.count > 1) clearSelectionDetailSelection();
  if (typeof showToast === 'function') showToast(`${done}건 완료 처리되었습니다.`, done ? 'success' : 'error');
}

function runSelectionDetailHoldAction() {
  const primary = selectionDetailContext && selectionDetailContext.items && selectionDetailContext.items[0];
  if (!primary || !primary.ref) return;
  if (primary.ref.entityType === 'material' && typeof changeMatStatus === 'function') {
    changeMatStatus(primary.ref.entityId, '지연');
  }
}

Object.assign(window, {
  closeSelectionDetailPanel,
  startSelectionDetailResize,
  updateSelectionDetailPanelFromManagedTable,
  updateSelectionDetailPanelFromReactDomain,
  updateSelectionDetailPanelFromBulk,
  updateSelectionDetailPanelFromPo,
  showSelectionDetailPanel,
  syncSelectionDetailPanelVisibility,
  runManagedDetailAction,
  openSelectionDetailAudit,
  clearSelectionDetailSelection,
  runSelectionDetailPanelAction,
  runSelectionDetailDeleteAction,
  runSelectionDetailInlineControl,
  bindSelectionDetailStatusMenu,
  toggleSelectionDetailStatusMenu,
  runSelectionDetailStatusControl,
  runSelectionDetailPrimaryAction,
  runSelectionDetailHoldAction
});

function tableActionLabel(button, index) {
  const title = (button.getAttribute('title') || button.getAttribute('aria-label') || '').trim();
  const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  if (title) return title;
  if (text) return text;
  const icon = button.querySelector('i');
  const cls = icon ? icon.className : '';
  if (cls.includes('trash') || button.classList.contains('del-btn')) return '삭제';
  if (cls.includes('edit') || button.classList.contains('edit-btn')) return '수정';
  if (cls.includes('restore') || button.classList.contains('restore-btn')) return '복원';
  if (cls.includes('box')) return '자재';
  return '작업 ' + (index + 1);
}

function tableHasDataRows(table) {
  const rows = Array.from(table.tBodies || []).flatMap(tbody => Array.from(tbody.rows));
  return rows.some(row => row.cells.length > 1 && !row.querySelector('.empty'));
}

function findManagedActionIndex(table) {
  const head = table.tHead && table.tHead.rows[0];
  if (!head) return -1;
  const headers = Array.from(head.cells);
  for (let i = headers.length - 1; i >= 0; i--) {
    if (TABLE_ACTION_HEADER_RE.test((headers[i].textContent || '').trim())) return i;
  }
  const firstBody = Array.from(table.tBodies || []).find(tbody => tbody.rows.length);
  const row = firstBody && Array.from(firstBody.rows).find(r => r.cells.length > 1);
  if (!row) return -1;
  for (let i = row.cells.length - 1; i >= 0; i--) {
    if (row.cells[i].querySelector('.edit-btn,.del-btn,.restore-btn,button[onclick]')) return i;
  }
  return -1;
}

function updateManagedTableCheckAll(table) {
  const all = table.querySelector('thead .table-check-all');
  if (!all) return;
  const checks = Array.from(table.querySelectorAll('tbody .table-row-select'));
  const selected = checks.filter(chk => chk.checked);
  all.checked = checks.length > 0 && selected.length === checks.length;
  all.indeterminate = selected.length > 0 && selected.length < checks.length;
}

function syncManagedTableRow(row) {
  const check = rowSelectionCheckbox(row);
  if (check) row.classList.toggle('table-row-selected', check.checked);
  updateManagedTableCheckAll(row.closest('table'));
}

function syncManagedTableRows(table) {
  if (!table) return;
  syncReadonlyStatusDisplays(table);
  table.querySelectorAll('tbody tr').forEach(syncManagedTableRow);
  updateManagedTableCheckAll(table);
  updateManagedSelectionBar(table);
  updateSelectionDetailPanelFromManagedTable(table);
}

function syncManagedTableRowsAndDetail(table) {
  syncManagedTableRows(table);
  if (!selectedManagedRows(table).length) closeSelectionDetailPanel(false);
  else syncSelectionDetailPanelVisibility();
}

function syncReadonlyStatusDisplays(table) {
  if (!table || table.closest('.overlay')) return;
  table.querySelectorAll('tbody select.stat-sel').forEach(select => {
    const cell = select.closest('td');
    if (!cell) return;
    select.classList.add('readonly-status-source');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    let pill = Array.from(cell.children).find(child => child.classList && child.classList.contains('readonly-status-pill'));
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'readonly-status-pill';
      cell.insertBefore(pill, select);
    }
    const text = (select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '') || select.value || '-';
    const cls = `readonly-status-pill ${selectionDetailStatusClass(text)}`;
    if (pill.textContent !== text) pill.textContent = text;
    if (pill.className !== cls) pill.className = cls;
    if (pill.title !== '상태') pill.title = '상태';
  });
}

function rowSelectionCheckbox(row) {
  if (!row) return null;
  return row.querySelector('.table-row-select') ||
    row.querySelector('input[type="checkbox"][data-bid]') ||
    (row.cells[0] && row.cells[0].querySelector('input[type="checkbox"]'));
}

function tableHasExistingSelectionColumn(table) {
  const head = table.tHead && table.tHead.rows[0];
  const firstHead = head && head.cells[0];
  if (firstHead && firstHead.querySelector('input[type="checkbox"]')) return true;
  const firstBody = Array.from(table.tBodies || []).find(tbody => tbody.rows.length);
  const row = firstBody && Array.from(firstBody.rows).find(r => r.cells.length > 1);
  return !!(row && row.cells[0] && row.cells[0].querySelector('input[type="checkbox"]'));
}

function tableBulkKey(table) {
  try {
    if (typeof BULK_CFG === 'undefined') return '';
    return Object.keys(BULK_CFG).find(key => {
      const cont = document.querySelector(BULK_CFG[key].sel);
      return cont && (cont === table || cont.contains(table));
    }) || '';
  } catch(e) {
    return '';
  }
}

function removeDuplicateManagedSelectionColumn(table) {
  const head = table.tHead && table.tHead.rows[0];
  if (!head) return false;
  const generated = head.querySelector('.table-row-select-th');
  if (!generated) return false;
  const generatedIndex = Array.prototype.indexOf.call(head.cells, generated);
  const hasOtherSelection = Array.from(head.cells).some((cell, index) => {
    return index !== generatedIndex && cell.querySelector('input[type="checkbox"]');
  });
  const bulkManaged = !!tableBulkKey(table);
  if (!hasOtherSelection && !bulkManaged) return false;
  generated.remove();
  Array.from(table.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      const cell = row.cells[generatedIndex];
      if (cell && cell.classList.contains('table-row-select-td')) cell.remove();
    });
  });
  return true;
}

function addManagedSelectionColumn(table) {
  const head = table.tHead && table.tHead.rows[0];
  if (!head) return false;
  if (head.querySelector('.table-check-all') || tableHasExistingSelectionColumn(table) || tableBulkKey(table)) return false;
  const th = document.createElement('th');
  th.className = 'table-row-select-th';
  th.style.cssText = 'width:34px;text-align:center;';
  th.innerHTML = '<input type="checkbox" class="table-check-all" title="현재 표 전체 선택">';
  head.insertBefore(th, head.firstChild);
  Array.from(table.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      if (row.cells.length <= 1 || row.querySelector('.empty')) return;
      const td = document.createElement('td');
      td.className = 'table-row-select-td';
      td.style.cssText = 'width:34px;text-align:center;';
      td.innerHTML = '<input type="checkbox" class="table-row-select" title="행 선택">';
      row.insertBefore(td, row.firstChild);
    });
  });
  return true;
}

function convertActionCellToSelect(cell) {
  if (!cell || cell.querySelector('.table-action-select')) return;
  const actions = Array.from(cell.querySelectorAll('button,a')).filter(el => {
    if (el.closest('.table-action-source')) return false;
    if (el.classList.contains('table-action-select')) return false;
    return el.matches('button,a') && (el.getAttribute('onclick') || el.href || el.className);
  });
  if (actions.length <= 1) return;
  const source = document.createElement('div');
  source.className = 'table-action-source';
  source.hidden = true;
  actions.forEach(action => source.appendChild(action));

  const select = document.createElement('select');
  select.className = 'table-action-select';
  select.setAttribute('aria-label', '관리 작업 선택');
  select.innerHTML = '<option value="">관리 선택</option>' +
    actions.map((action, index) => '<option value="' + index + '">' + tableActionLabel(action, index) + '</option>').join('');
  select.addEventListener('change', function() {
    const index = Number(this.value);
    const target = actions[index];
    this.value = '';
    if (target) target.click();
  });

  cell.classList.add('table-action-cell');
  cell.textContent = '';
  cell.appendChild(select);
  cell.appendChild(source);
}

function bindManagedTableRows(table) {
  if (table.dataset.rowSelectBound === '1') return;
  table.dataset.rowSelectBound = '1';
  table.addEventListener('change', event => {
    releaseSelectionDetailNavigationSuppress();
    const target = event.target;
    if (target.classList && target.classList.contains('table-check-all')) {
      table.querySelectorAll('tbody .table-row-select').forEach(chk => {
        chk.checked = target.checked;
        syncManagedTableRow(chk.closest('tr'));
      });
    } else if (target.matches && target.matches('tbody input[type="checkbox"]')) {
      syncManagedTableRow(target.closest('tr'));
    }
    setTimeout(() => syncManagedTableRowsAndDetail(table), 0);
    setTimeout(() => syncManagedTableRowsAndDetail(table), 80);
  });
  table.addEventListener('click', event => {
    const row = event.target.closest('tbody tr');
    if (!row || !table.contains(row)) return;
    if (event.target.closest(TABLE_INTERACTIVE_SEL)) return;
    releaseSelectionDetailNavigationSuppress();
    const check = rowSelectionCheckbox(row);
    if (!check) return;
    check.click();
    setTimeout(() => syncManagedTableRowsAndDetail(table), 0);
    setTimeout(() => syncManagedTableRowsAndDetail(table), 80);
  });
}

function enhanceManagedTable(table) {
  if (!table) return;
  if (table.closest('.overlay')) return;
  if (table.dataset.managedTable === 'false' || table.hasAttribute('data-no-managed-table')) return;
  if (!table.tHead || !table.tBodies.length || !tableHasDataRows(table)) return;
  if (table.dataset.managedEnhanced === '1') {
    removeDuplicateManagedSelectionColumn(table);
    bindManagedTableRows(table);
    syncManagedTableRows(table);
    return;
  }
  const actionIndex = findManagedActionIndex(table);
  if (actionIndex < 0) return;
  table.dataset.managedEnhanced = '1';
  removeDuplicateManagedSelectionColumn(table);
  if (tableBulkKey(table)) {
    bindManagedTableRows(table);
    syncManagedTableRows(table);
    return;
  }
  const inserted = addManagedSelectionColumn(table);
  const adjustedActionIndex = actionIndex + (inserted ? 1 : 0);
  Array.from(table.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      const cell = row.cells[adjustedActionIndex];
      convertActionCellToSelect(cell);
      syncManagedTableRow(row);
    });
  });
  bindManagedTableRows(table);
  syncManagedTableRows(table);
}

function managedEnhanceScope(root) {
  if (root && root !== document && root !== document.body && !root.classList?.contains('main')) return root;
  return document.querySelector('.content.active') || root || document;
}

function managedTablesInScope(root) {
  const scope = managedEnhanceScope(root);
  if (!scope) return [];
  const tables = [];
  if (scope.matches && scope.matches('table')) tables.push(scope);
  if (scope.querySelectorAll) tables.push(...scope.querySelectorAll('table'));
  return Array.from(new Set(tables));
}

function enhanceManagedTables(root) {
  const scope = managedEnhanceScope(root);
  managedTablesInScope(scope).forEach(enhanceManagedTable);
  if (typeof applyTableDisplaySettings === 'function') applyTableDisplaySettings(scope);
}

function scheduleManagedTableEnhance(root) {
  if (managedEnhanceFrame) return;
  managedEnhanceFrame = requestAnimationFrame(() => {
    managedEnhanceFrame = 0;
    enhanceManagedTables(root);
  });
}

function initManagedTableEnhancer() {
  updateSelectionDetailPanelTop();
  initSelectionDetailPanelWidth();
  enhanceManagedTables(document);
  window.__selectionDetailReady = true;
  if (typeof BULK_CFG !== 'undefined') {
    Object.keys(BULK_CFG).forEach(key => {
      if (typeof bulkSel !== 'undefined' && bulkSel[key] && bulkSel[key].size) updateSelectionDetailPanelFromBulk(key);
    });
  }
  document.addEventListener('change', event => {
    const target = event.target;
    if (target && target.matches && target.matches('input[type="checkbox"]')) {
      releaseSelectionDetailNavigationSuppress();
      setTimeout(() => {
        const table = target.closest && target.closest('table');
        if (table && table.dataset && table.dataset.managedToken) syncManagedTableRowsAndDetail(table);
        syncSelectionDetailPanelVisibility();
      }, 0);
      setTimeout(syncSelectionDetailPanelVisibility, 80);
    }
  }, true);
  document.addEventListener('click', event => {
    const target = event.target;
    if (target && target.closest && !target.closest('.selection-detail-status-menu-wrap')) {
      closeSelectionDetailStatusMenus();
    }
    if (target && target.closest && target.closest('.content.active tbody tr')) {
      releaseSelectionDetailNavigationSuppress();
      setTimeout(syncSelectionDetailPanelVisibility, 0);
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSelectionDetailStatusMenus();
  });
  const main = document.querySelector('.main') || document.body;
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.addedNodes.length)) {
      scheduleManagedTableEnhance(main);
    }
  });
  observer.observe(main, { childList: true, subtree: true });
  window.addEventListener('resize', () => {
    updateSelectionDetailPanelTop();
    initSelectionDetailPanelWidth();
    document.querySelectorAll('table[data-managed-token]').forEach(table => updateManagedSelectionBar(table));
    if (selectionDetailDisabledOnMobile()) closeSelectionDetailPanel(false);
  }, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initManagedTableEnhancer);
} else {
  initManagedTableEnhancer();
}
