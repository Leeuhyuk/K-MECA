/* ════════ 거래처 관리 ════════ */
function normalizePartnerType(type) {
  return type === '구매처' ? '고객사' : (type || '기타');
}
function migratePartnerCustomerType() {
  let changed = false;
  partners.forEach(p => {
    const normalized = normalizePartnerType(p.type);
    if (p.type !== normalized) { p.type = normalized; changed = true; }
  });
  if (changed) saveStorage('partners', partners);
}
migratePartnerCustomerType();

function getPartnerPerformance(partnerName) {
  const visiblePo = typeof visiblePurchaseOrderList === 'function' ? visiblePurchaseOrderList() : (typeof visibleRecords === 'function' ? visibleRecords(poList, 'po') : poList);
  const pos = visiblePo.filter(function(p) { return p.supplier === partnerName; });
  if (!pos.length) return null;
  var completed = pos.filter(function(p) { return p.status === '입고완료'; }).length;
  var pending = pos.filter(function(p) { return p.status !== '입고완료'; });
  var late = 0, totalDelay = 0;
  pending.forEach(function(po) {
    if (po.dueDate) {
      var due = new Date(po.dueDate);
      var now = new Date();
      if (now > due) { late++; totalDelay += Math.ceil((now - due) / 86400000); }
    }
  });
  var total = completed + late;
  var onTimeRate = total > 0 ? Math.round(completed / total * 100) : null;
  var totalAmt = pos.reduce(function(s, p) { return s + (Number(p.unitPrice)||0)*(Number(p.qty)||0); }, 0);
  return {
    total: pos.length,
    completed: completed,
    pending: pending.length,
    onTimeRate: onTimeRate,
    avgDelay: late > 0 ? Math.round(totalDelay / late) : 0,
    totalAmt: totalAmt
  };
}
function filterPartners(type) {
  const sel = inp('bp-ft');
  if (sel) sel.value = (sel.value === type) ? '' : type;   // 같은 유형 재클릭 시 전체 복구(토글)
  renderPartners();
  go('partners', document.querySelector('.ni[onclick*="partners"]'));
}

function renderPartners() {
  const visiblePartners = typeof visibleRecords === 'function' ? visibleRecords(partners, 'partners') : partners;
  const total = visiblePartners.length;
  const sup   = visiblePartners.filter(p => p.type === '공급처').length;
  const buy   = visiblePartners.filter(p => normalizePartnerType(p.type) === '고객사').length;
  const out   = visiblePartners.filter(p => p.type === '외주처').length;
  const setEl = (id, v) => { const el = inp(id); if(el) el.textContent = v; };
  setEl('bp-kpi-total', total + '개사');
  setEl('bp-kpi-sup',   sup);
  setEl('bp-kpi-buy',   buy);
  setEl('bp-kpi-out',   out);
  _kpiActive('bp-ft', {'공급처':'bp-kpi-sup','고객사':'bp-kpi-buy','외주처':'bp-kpi-out'});

  const ft = v('bp-ft'), q = v('bp-q').toLowerCase();
  const rows = visiblePartners.filter(p => {
    const type = normalizePartnerType(p.type);
    if (ft && type !== ft) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.manager||'').toLowerCase().includes(q) && !(p.email||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.partners.key) {
    const k = sortState.partners.key, asc = sortState.partners.asc ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[k] == null ? '' : a[k], vb = b[k] == null ? '' : b[k];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const cont = inp('bp-table');
  if (!rows.length) { cont.innerHTML = '<div class="empty"><i class="ti ti-inbox"></i>해당 조건의 거래처가 없습니다.</div>'; return; }

  const typeColor = { '공급처':'bd-info', '고객사':'bd-ok', '외주처':'bd-warn', '기타':'bd-neu' };
  const _bpth = (k, l, s) => `<th onclick="toggleSort('partners','${k}')" style="cursor:pointer;user-select:none;${s||''}">${l} ${sortIcon('partners',k)}</th>`;
  cont.innerHTML = `<table style="min-width:900px;">
    <thead><tr>
      ${_bpth('id','코드')}${_bpth('name','거래처명')}${_bpth('type','유형')}${_bpth('manager','담당자')}
      <th>전화번호</th><th>이메일</th><th>사업자번호</th><th>비고</th><th style="text-align:center;">납기이행률</th><th>거래금액</th><th>관리</th>
    </tr></thead>
    <tbody>${rows.map(p => {
      const type = normalizePartnerType(p.type);
      var perf = (type === '공급처' || type === '외주처') ? getPartnerPerformance(p.name) : null;
      var perfHtml = perf
        ? '<td style="text-align:center;">' +
          (perf.onTimeRate !== null
            ? '<span class="bd ' + (perf.onTimeRate >= 80 ? 'bd-ok' : perf.onTimeRate >= 60 ? 'bd-warn' : 'bd-err') + '">' + perf.onTimeRate + '%</span>' +
              '<div style="font-size:10px;color:var(--tx-t);">' + perf.completed + '/' + perf.total + '건</div>'
            : '<span style="color:var(--tx-t);">—</span>') +
          '</td><td style="font-weight:600;color:var(--tx-i);">' + (perf.totalAmt > 0 ? fmtW(perf.totalAmt) : '—') + '</td>'
        : '<td>—</td><td>—</td>';
      return `
      <tr>
        <td style="font-size:11px;color:var(--tx-t);">${esc(p.id)}</td>
        <td style="font-weight:700;">${esc(p.name)}</td>
        <td><span class="bd ${typeColor[type]||'bd-neu'}">${esc(type)}</span></td>
        <td>${esc(p.manager)||'—'}</td>
        <td>${esc(p.tel||p.mobile)||'—'}</td>
        <td style="font-size:11px;">${p.email?`<a href="mailto:${esc(p.email)}" style="color:var(--tx-i);">${esc(p.email)}</a>`:'—'}</td>
        <td style="font-size:11px;color:var(--tx-t);">${esc(p.bizNo)||'—'}</td>
        <td style="font-size:11px;color:var(--tx-t);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(p.note||'')}">${esc(p.note)||'—'}</td>
        ${perfHtml}
        <td>
          <button class="edit-btn" onclick="openPartnerModal('${p.id}')"><i class="ti ti-edit"></i>수정</button>
          <button class="del-btn" style="margin-left:4px;" onclick="deletePartner('${p.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function openPartnerModal(id) {
  if (!id && typeof requireCreateAction === 'function' && !requireCreateAction('partners', '거래처 등록')) return;
  const modal = inp('partner-modal');
  delete modal.dataset.editId;
  if (id) {
    const p = partners.find(x => x.id === id);
    if (!p) return;
    if (typeof requireRecordPermission === 'function' && !requireRecordPermission('edit', p, 'partners')) return;
    modal.dataset.editId = id;
    inp('partner-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>거래처 수정';
    inp('bp-name').value   = p.name;     inp('bp-type').value   = normalizePartnerType(p.type);
    inp('bp-mgr').value    = p.manager||''; inp('bp-tel').value  = p.tel||'';
    inp('bp-mobile').value = p.mobile||''; inp('bp-email').value = p.email||'';
    inp('bp-fax').value    = p.fax||'';  inp('bp-bizno').value  = p.bizNo||'';
    inp('bp-addr').value   = p.address||''; inp('bp-note').value = p.note||'';
  } else {
    inp('partner-modal-ttl').innerHTML = '<i class="ti ti-address-book" style="color:var(--tx-i);"></i>거래처 등록';
    ['bp-name','bp-mgr','bp-tel','bp-mobile','bp-email','bp-fax','bp-bizno','bp-addr','bp-note'].forEach(id => { if(inp(id)) inp(id).value=''; });
    inp('bp-type').value = '공급처';
  }
  modal.classList.add('open');
}

function _masterRefValue(value) {
  return String(value == null ? '' : value).trim();
}
function _masterRefKey(value) {
  return _masterRefValue(value).toLowerCase();
}
function _masterRefMatchesName(value, before, after) {
  const current = _masterRefKey(value);
  if (!current) return false;
  return current === _masterRefKey(before && before.name) || current === _masterRefKey(after && after.name);
}
function _masterRefIds(before, after) {
  const ids = [];
  [before && before.id, after && after.id].forEach(id => {
    const key = _masterRefValue(id);
    if (key && !ids.includes(key)) ids.push(key);
  });
  return ids;
}
function _syncPartnerPurchaseDocs(before, after) {
  if (!after) return 0;
  const nextName = _masterRefValue(after.name);
  const nextEmail = _masterRefValue(after.email);
  const syncList = (storageKey, list, renderFn) => {
    if (!Array.isArray(list)) return 0;
    let changed = 0;
    list.forEach(doc => {
      if (!doc || !_masterRefMatchesName(doc.supplier, before, after)) return;
      let touched = false;
      if (nextName && doc.supplier !== nextName) {
        doc.supplier = nextName;
        touched = true;
      }
      if (_masterRefValue(doc.supplierEmail) !== nextEmail) {
        doc.supplierEmail = nextEmail;
        touched = true;
      }
      if (touched) changed += 1;
    });
    if (changed) {
      saveStorage(storageKey, list);
      if (typeof renderFn === 'function') renderFn();
    }
    return changed;
  };

  let total = 0;
  if (typeof rfqList !== 'undefined') total += syncList('rfqList', rfqList, typeof renderRfq === 'function' ? renderRfq : null);
  if (typeof poList !== 'undefined') total += syncList('poList', poList, typeof renderPo === 'function' ? renderPo : null);
  return total;
}
function syncCustomerDocumentReferences(before, after) {
  if (!after) return 0;
  const ids = _masterRefIds(before, after);
  const nextName = _masterRefValue(after.name);
  const nextEmail = _masterRefValue(after.email);
  const nextBizNo = _masterRefValue(after.bizNo);
  const matchesClient = doc => {
    if (!doc) return false;
    const clientId = _masterRefValue(doc.clientId);
    if (clientId && ids.includes(clientId)) return true;
    return _masterRefMatchesName(doc.clientName, before, after);
  };
  const syncList = (storageKey, list, renderFn) => {
    if (!Array.isArray(list)) return 0;
    let changed = 0;
    list.forEach(doc => {
      if (!matchesClient(doc)) return;
      let touched = false;
      if (doc.clientName && nextName && doc.clientName !== nextName) {
        doc.clientName = nextName;
        touched = true;
      }
      if (_masterRefValue(doc.clientEmail) !== nextEmail) {
        doc.clientEmail = nextEmail;
        touched = true;
      }
      if (_masterRefValue(doc.clientBizNo) !== nextBizNo) {
        doc.clientBizNo = nextBizNo;
        touched = true;
      }
      if (touched) changed += 1;
    });
    if (changed) {
      saveStorage(storageKey, list);
      if (typeof renderFn === 'function') renderFn();
    }
    return changed;
  };

  let total = 0;
  if (typeof quoteList !== 'undefined') total += syncList('quoteList', quoteList, typeof renderSODoc === 'function' ? () => renderSODoc('quote') : null);
  if (typeof orderList !== 'undefined') total += syncList('orderList', orderList, typeof renderSODoc === 'function' ? () => renderSODoc('order') : null);
  if (typeof statementList !== 'undefined') total += syncList('statementList', statementList, typeof renderSalesDoc === 'function' ? () => renderSalesDoc('statement') : null);
  if (typeof taxList !== 'undefined') total += syncList('taxList', taxList, typeof renderSalesDoc === 'function' ? () => renderSalesDoc('tax') : null);
  return total;
}
function syncPartnerDocumentReferences(before, after) {
  const purchaseCount = _syncPartnerPurchaseDocs(before, after);
  const customerCount = (typeof _isCustomerPartner === 'function' && _isCustomerPartner(after))
    ? syncCustomerDocumentReferences(before, after)
    : 0;
  return { purchaseCount, customerCount, total: purchaseCount + customerCount };
}

function savePartnerForm() {
  if (!checkAdminAction()) return;
  if (!v('bp-name')) { showToast('거래처명을 입력하세요.', 'error'); return; }
  const modal  = inp('partner-modal');
  const editId = modal.dataset.editId;
  let beforePartner = null;
  let syncedDocs = { total: 0 };
  const obj = {
    id: editId || nextCode('BP', partners),
    name: v('bp-name'), type: normalizePartnerType(v('bp-type')),
    manager: v('bp-mgr'), tel: v('bp-tel'), mobile: v('bp-mobile'),
    email: v('bp-email'), fax: v('bp-fax'), bizNo: v('bp-bizno'),
    address: v('bp-addr'), note: v('bp-note')
  };
  if (editId) {
    const idx = partners.findIndex(p => p.id === editId);
    if (idx !== -1) {
      const before = _safeJsonClone(partners[idx]);
      beforePartner = before;
      if (!requireRecordPermission('edit', before, 'partners')) return;
      partners[idx] = stampRecordUpdate(Object.assign({}, partners[idx], obj), before, 'partners', { visibility:'company' });
      writeAuditLog('partners', editId, 'update', before, partners[idx], { summary:'거래처 수정' });
      syncedDocs = syncPartnerDocumentReferences(beforePartner, partners[idx]);
    }
  } else {
    if (typeof requireCreateAction === 'function' && !requireCreateAction('partners', '거래처 등록')) return;
    stampRecordCreate(obj, 'partners', { visibility:'company' });
    partners.unshift(obj);
    writeAuditLog('partners', obj.id, 'create', null, obj, { summary:'거래처 등록' });
  }
  if (obj.type === '고객사' && typeof syncClientFromPartner === 'function') {
    const beforeClient = beforePartner ? _safeJsonClone(clients.find(c => c.id === obj.id) || beforePartner) : null;
    syncClientFromPartner(obj);
    saveStorage('clients', clients);
    const syncedClient = clients.find(c => c.id === obj.id);
    if (syncedClient) {
      const clientSyncedCount = syncCustomerDocumentReferences(beforeClient, syncedClient);
      syncedDocs.total = (syncedDocs.total || 0) + clientSyncedCount;
    }
  }
  saveStorage('partners', partners);
  closeModal('partner-modal');
  if (document.getElementById('pg-partners')?.classList.contains('active')) renderPartners();
  if (document.getElementById('pg-clients')?.classList.contains('active')) renderClients();
  const syncMsg = editId && syncedDocs.total ? ` 연결 문서 ${syncedDocs.total}건 반영` : '';
  showToast(editId ? `거래처가 수정되었습니다.${syncMsg}` : '거래처가 등록되었습니다.');
  // picker가 열려 있으면 목록 갱신
  if (inp('partner-picker-modal')?.classList.contains('open')) renderPickerList();
}

function deletePartner(id) {
  if (!checkAdminAction()) return;
  const target = partners.find(p => p.id === id);
  if (!target || !requireRecordPermission('delete', target, 'partners')) return;
  if (!confirm('이 거래처를 삭제하시겠습니까?')) return;
  const customerPartner = partnerCanProvideClient(target);
  const linkedClient = customerPartner ? clients.find(c => c.id === id) : null;
  const linkedProducts = linkedClient ? products.filter(p => p.clientId === id) : [];
  if (linkedClient) pushToTrash('client', linkedClient);
  linkedProducts.forEach(p => pushToTrash('product', p));
  partners = partners.filter(p => p.id !== id);
  if (linkedClient) clients = clients.filter(c => c.id !== id);
  if (linkedProducts.length) products = products.filter(p => p.clientId !== id);
  writeAuditLog('partners', id, 'delete', target, null, { summary:'거래처 삭제' });
  if (linkedClient) writeAuditLog('clients', id, 'delete', linkedClient, null, { summary:'거래처 삭제에 따른 고객사 이동', detail:`연결 제품 ${linkedProducts.length}건` });
  linkedProducts.forEach(p => writeAuditLog('products', p.id, 'delete', p, null, { summary:'거래처 삭제에 따른 제품 이동' }));
  if (typeof cloudRememberDeletedArrayRecord === 'function') {
    cloudRememberDeletedArrayRecord('partners', target);
    if (linkedClient) cloudRememberDeletedArrayRecord('clients', linkedClient);
    linkedProducts.forEach(p => cloudRememberDeletedArrayRecord('products', p));
  }
  saveStorage('partners', partners);
  if (linkedClient) saveStorage('clients', clients);
  if (linkedProducts.length) saveStorage('products', products);
  if (typeof cloudDeleteArrayRecordNow === 'function') {
    cloudDeleteArrayRecordNow('partners', target).catch(e => console.warn('partner cloud delete failed:', e));
    if (linkedClient) cloudDeleteArrayRecordNow('clients', linkedClient).catch(e => console.warn('client cloud delete failed:', e));
    linkedProducts.forEach(p => cloudDeleteArrayRecordNow('products', p).catch(e => console.warn('product cloud delete failed:', e)));
  }
  if (typeof cloudFlushSoon === 'function') cloudFlushSoon();
  renderPartners();
  if (document.getElementById('pg-clients')?.classList.contains('active') && typeof renderClients === 'function') renderClients();
  syncFilterDropdowns();
  showToast('거래처가 삭제되었습니다.');
}

function exportPartnersXLS() {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('거래처 엑셀 내보내기')) return;
  if (!partners.length) { showToast('내보낼 거래처 데이터가 없습니다.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const hdr = ['코드','거래처명','유형','담당자','전화번호','휴대폰','이메일','팩스','사업자번호','주소','비고'];
  const source = typeof visibleRecords === 'function' ? visibleRecords(partners, 'partners') : partners;
  const rows = source.map(p => [p.id, p.name, normalizePartnerType(p.type), p.manager||'', p.tel||'', p.mobile||'', p.email||'', p.fax||'', p.bizNo||'', p.address||'', p.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
  ws['!cols'] = [8,16,8,10,12,12,20,12,12,20,16].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, '거래처');
  XLSX.writeFile(wb, '거래처_' + today() + '.xlsx');
  showToast('엑셀 파일이 저장되었습니다.');
}

/* ── 거래처 피커 ── */
let _pickerCallback = null;

function openPartnerPicker(callback) {
  _pickerCallback = callback;
  if(inp('pp-q'))  inp('pp-q').value  = '';
  if(inp('pp-ft')) inp('pp-ft').value = '';
  renderPickerList();
  inp('partner-picker-modal').classList.add('open');
}

function renderPickerList() {
  const q  = (v('pp-q')||'').toLowerCase();
  const ft = v('pp-ft')||'';
  const visiblePartners = typeof visibleRecords === 'function' ? visibleRecords(partners, 'partners') : partners;
  const list = visiblePartners.filter(p => {
    const type = normalizePartnerType(p.type);
    if (ft && type !== ft) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.manager||'').toLowerCase().includes(q) && !(p.email||'').toLowerCase().includes(q)) return false;
    return true;
  });
  const cont = inp('pp-list');
  if (!list.length) {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx-t);font-size:12px;">검색 결과가 없습니다.<br>아래 버튼으로 새 거래처를 등록하세요.</div>';
    return;
  }
  const typeColor = { '공급처':'bd-info', '고객사':'bd-ok', '외주처':'bd-warn', '기타':'bd-neu' };
  cont.innerHTML = list.map(p => `
    <div onclick="selectPartner('${p.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--br);transition:background .1s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background=''">
      <span class="bd ${typeColor[normalizePartnerType(p.type)]||'bd-neu'}" style="flex-shrink:0;">${esc(normalizePartnerType(p.type))}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${esc(p.name)}</div>
        <div style="font-size:11px;color:var(--tx-t);">${p.manager?esc(p.manager)+' · ':''}${esc(p.tel||p.mobile)||''}${p.email?' · '+esc(p.email):''}</div>
      </div>
      <span style="font-size:11px;color:var(--tx-i);flex-shrink:0;">선택 →</span>
    </div>`).join('');
}

function selectPartner(id) {
  const p = partners.find(x => x.id === id);
  if (!p || !_pickerCallback) return;
  _pickerCallback(p);
  closeModal('partner-picker-modal');
}

function _partnerFieldText(p) {
  return [
    p.name || '',
    p.id || '',
    normalizePartnerType(p.type) || '',
    p.manager || '',
    p.tel || '',
    p.mobile || '',
    p.email || '',
    p.bizNo || ''
  ].join(' ').toLowerCase();
}
function _partnerFieldMatches(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return partners
    .filter(p => _partnerFieldText(p).includes(q))
    .sort((a, b) => {
      const an = String(a.name || '').toLowerCase();
      const bn = String(b.name || '').toLowerCase();
      const ap = an.startsWith(q) ? 0 : 1;
      const bp = bn.startsWith(q) ? 0 : 1;
      return (ap - bp) || an.localeCompare(bn, 'ko');
    })
    .slice(0, 8);
}
function hidePartnerFieldMatches(resultsId) {
  const box = inp(resultsId);
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}
function selectPartnerField(inputId, resultsId, partnerId, emailId) {
  const p = partners.find(x => x.id === partnerId);
  if (!p) return;
  sv(inputId, p.name || '');
  if (emailId) sv(emailId, p.email || '');
  hidePartnerFieldMatches(resultsId);
}
function renderPartnerFieldMatches(inputId, resultsId, emailId) {
  const box = inp(resultsId);
  if (!box) return;
  const q = v(inputId).trim();
  const rows = _partnerFieldMatches(q);
  if (!q || !rows.length) { hidePartnerFieldMatches(resultsId); return; }
  box.innerHTML = rows.map(p => `
    <button type="button" class="inline-search-item" onmousedown="selectPartnerField('${esc(inputId)}','${esc(resultsId)}','${esc(p.id)}','${esc(emailId || '')}')">
      <strong>${esc(p.name || p.id)}</strong>
      <span>${esc(normalizePartnerType(p.type))} · ${esc(p.manager || '담당 미지정')} · ${esc(p.tel || p.mobile || p.email || '연락처 미지정')}</span>
    </button>
  `).join('');
  box.style.display = 'block';
}
function onPartnerFieldSearchInput(inputId, resultsId, emailId) {
  renderPartnerFieldMatches(inputId, resultsId, emailId);
}
function onPartnerFieldSearchKey(e, inputId, resultsId, emailId) {
  if (e.key === 'Escape') { hidePartnerFieldMatches(resultsId); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();
  const first = _partnerFieldMatches(v(inputId))[0];
  if (first) selectPartnerField(inputId, resultsId, first.id, emailId);
}
function openPartnerFieldPicker(inputId, resultsId, emailId) {
  openPartnerPicker(function(p){
    sv(inputId, p.name || '');
    if (emailId) sv(emailId, p.email || '');
    hidePartnerFieldMatches(resultsId);
  });
}

/* ── 고객사 피커 (거래명세표·세금계산서 등 고객사 선택용) ── */
let _clientPickerCb = null;
let _clientPickerCreatePending = false;
let _clientPickerContext = null;
function setClientSelectValue(selectId, c) {
  const sel = inp(selectId);
  if (!sel || !c) return;
  if (![...sel.options].some(opt => opt.value === c.id)) {
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(c.id)}">${esc(c.name)}</option>`);
  }
  sel.value = c.id;
}
function openClientPicker(callback, context){
  _clientPickerCb = callback;
  _clientPickerCreatePending = false;
  _clientPickerContext = context || null;
  if(inp('cp-q')) inp('cp-q').value = (_clientPickerContext && _clientPickerContext.initialQuery) || '';
  renderClientPickerList();
  inp('client-picker-modal').classList.add('open');
}
function openClientAddFromPicker() {
  const ctx = _clientPickerContext || {};
  const caModal = inp('ca-modal');
  if (ctx.mode === 'client-register' && caModal && caModal.classList.contains('open')) {
    const selectedId = caModal.dataset.existingId;
    const draftName = String(v('cp-q') || (!selectedId ? v('ca-name') : '') || '').trim();
    _clientPickerCreatePending = false;
    closeModal('client-picker-modal');
    if (typeof setClientRegisterSelection === 'function') setClientRegisterSelection('');
    if (draftName) sv('ca-name', draftName);
    if (typeof hideClientRegisterMatches === 'function') hideClientRegisterMatches();
    setTimeout(function(){
      const nameInput = inp('ca-name');
      if (nameInput) nameInput.focus();
    }, 0);
    if (typeof showToast === 'function') showToast('신규 고객사 정보를 입력한 뒤 저장하세요.');
    return;
  }
  _clientPickerCreatePending = true;
  closeModal('client-picker-modal');
  openClientAdd();
}
function consumeClientPickerCreatedClient(c) {
  if (!_clientPickerCreatePending || typeof _clientPickerCb !== 'function') return false;
  const callback = _clientPickerCb;
  _clientPickerCreatePending = false;
  _clientPickerContext = null;
  callback(c);
  return true;
}
function renderClientPickerList(){
  const q = (v('cp-q')||'').toLowerCase();
  const list = _clientSearchCandidates(q, 80, true);
  const cont = inp('cp-list');
  if (!list.length){ cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx-t);font-size:12px;">검색 결과가 없습니다.<br>아래 버튼으로 새 고객사를 등록하세요.</div>'; return; }
  cont.innerHTML = list.map(c => `
    <div onclick="selectClientPick('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--br);transition:background .1s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background=''">
      <span class="bd bd-info" style="flex-shrink:0;">고객사</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${esc(c.name)}</div>
        <div style="font-size:11px;color:var(--tx-t);">${c.manager?esc(c.manager)+' · ':''}${esc(c.tel)||''}${c.email?' · '+esc(c.email):''}</div>
      </div>
      <span style="font-size:11px;color:var(--tx-i);flex-shrink:0;">선택 →</span>
    </div>`).join('');
}
function selectClientPick(id){
  const c = ensureClientFromAnyPartner(id);
  if (!c || !_clientPickerCb) return;
  const callback = _clientPickerCb;
  _clientPickerCreatePending = false;
  _clientPickerContext = null;
  callback(c);
  closeModal('client-picker-modal');
}

function _clientFieldText(c) {
  return [c.name || '', c.id || '', c.manager || '', c.tel || '', c.email || '', c.bizNo || ''].join(' ').toLowerCase();
}
function _partnerAsClientCandidate(p) {
  return {
    id: p.id,
    name: p.name || p.id,
    manager: p.manager || '',
    tel: p.tel || p.mobile || '',
    mobile: p.mobile || '',
    email: p.email || '',
    bizNo: p.bizNo || '',
    note: p.note || '',
    _source: 'partner',
    _typeLabel: normalizePartnerType(p.type) || '거래처'
  };
}
function partnerCanProvideClient(p) {
  if (!p) return false;
  if (typeof _isCustomerPartner === 'function') return _isCustomerPartner(p);
  return normalizePartnerType(p.type) === '고객사';
}
function ensureClientFromAnyPartner(id) {
  let c = clients.find(x => x.id === id);
  if (c) return c;
  const p = partners.find(x => x.id === id);
  if (!partnerCanProvideClient(p)) return null;
  c = {
    id: p.id,
    name: p.name || p.id,
    manager: p.manager || '',
    tel: p.tel || p.mobile || '',
    email: p.email || '',
    bizNo: p.bizNo || '',
    date: today(),
    note: p.note || '',
    closed: false
  };
  clients.push(c);
  saveStorage('clients', clients);
  return c;
}
function _clientSearchCandidates(query, limit, includeEmpty) {
  const q = String(query || '').trim().toLowerCase();
  if (!q && !includeEmpty) return [];
  const usedIds = new Set();
  const usedNames = new Set();
  const rows = [];
  const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const visiblePartners = typeof visibleRecords === 'function' ? visibleRecords(partners, 'partners') : partners;
  visibleClients.forEach(c => {
    if (q && !_clientFieldText(c).includes(q)) return;
    rows.push(Object.assign({_source:'client', _typeLabel:'고객사'}, c));
    usedIds.add(c.id);
    usedNames.add(String(c.name || '').trim().toLowerCase());
  });
  visiblePartners.forEach(p => {
    if (!partnerCanProvideClient(p)) return;
    if (!p || usedIds.has(p.id)) return;
    const nameKey = String(p.name || '').trim().toLowerCase();
    if (nameKey && usedNames.has(nameKey)) return;
    const row = _partnerAsClientCandidate(p);
    if (q && !_clientFieldText(row).includes(q)) return;
    rows.push(row);
  });
  return rows.sort((a, b) => {
    const an = String(a.name || '').toLowerCase();
    const bn = String(b.name || '').toLowerCase();
    const ap = q && an.startsWith(q) ? 0 : 1;
    const bp = q && bn.startsWith(q) ? 0 : 1;
    const as = a._source === 'client' ? 0 : 1;
    const bs = b._source === 'client' ? 0 : 1;
    return (ap - bp) || (as - bs) || an.localeCompare(bn, 'ko');
  }).slice(0, limit || 8);
}
function _clientFieldMatches(query) {
  return _clientSearchCandidates(query, 8, false);
}
function _runClientFieldChange(changeFnName) {
  if (changeFnName && typeof window[changeFnName] === 'function') window[changeFnName]();
}
function syncClientFieldDisplay(selectId, inputId) {
  const sel = inp(selectId);
  const input = inp(inputId);
  if (!sel || !input) return;
  const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const c = visibleClients.find(x => x.id === sel.value);
  input.value = c ? (c.name || '') : '';
}
function hideClientFieldMatches(resultsId) {
  const box = inp(resultsId);
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}
function selectClientField(selectId, inputId, resultsId, clientId, changeFnName, emailId) {
  const c = ensureClientFromAnyPartner(clientId);
  if (!c) return;
  setClientSelectValue(selectId, c);
  sv(inputId, c.name || '');
  hideClientFieldMatches(resultsId);
  _runClientFieldChange(changeFnName);
  if (emailId && c.email && !v(emailId)) sv(emailId, c.email);
}
function renderClientFieldMatches(selectId, inputId, resultsId, changeFnName, emailId) {
  const box = inp(resultsId);
  if (!box) return;
  const q = v(inputId).trim();
  const rows = _clientFieldMatches(q);
  if (!q || !rows.length) { hideClientFieldMatches(resultsId); return; }
  box.innerHTML = rows.map(c => `
    <button type="button" class="inline-search-item" onmousedown="selectClientField('${esc(selectId)}','${esc(inputId)}','${esc(resultsId)}','${esc(c.id)}','${esc(changeFnName || '')}','${esc(emailId || '')}')">
      <strong>${esc(c.name || c.id)}</strong>
      <span>${esc(c.id)} · 담당 ${esc(c.manager || '미지정')} · ${esc(c.tel || c.email || '연락처 미지정')}</span>
    </button>
  `).join('');
  box.style.display = 'block';
}
function onClientFieldSearchInput(selectId, inputId, resultsId, changeFnName) {
  const sel = inp(selectId);
  if (sel) {
    const c = clients.find(x => x.id === sel.value);
    if (c && String(v(inputId)).trim() !== String(c.name || '').trim()) {
      sel.value = '';
      _runClientFieldChange(changeFnName);
    }
  }
  renderClientFieldMatches(selectId, inputId, resultsId, changeFnName);
}
function onClientFieldSearchKey(e, selectId, inputId, resultsId, changeFnName, emailId) {
  if (e.key === 'Escape') { hideClientFieldMatches(resultsId); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();
  const first = _clientFieldMatches(v(inputId))[0];
  if (first) {
    selectClientField(selectId, inputId, resultsId, first.id, changeFnName, emailId);
  }
}
function openClientFieldPicker(selectId, inputId, resultsId, changeFnName, emailId) {
  openClientPicker(function(c){
    selectClientField(selectId, inputId, resultsId, c.id, changeFnName, emailId);
  }, { mode:'client-field', selectId, inputId, resultsId, changeFnName, emailId, initialQuery:v(inputId) });
}

function _productFieldText(p) {
  return [p.name || '', p.id || '', p.spec || '', getClientName(p.clientId) || ''].join(' ').toLowerCase();
}
function _productFieldMatches(query, clientId) {
  const q = String(query || '').trim().toLowerCase();
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const list = clientId ? visibleProducts.filter(p => p.clientId === clientId) : visibleProducts;
  return list
    .filter(p => !q || _productFieldText(p).includes(q))
    .sort((a, b) => {
      const an = String(a.name || '').toLowerCase();
      const bn = String(b.name || '').toLowerCase();
      const ap = q && an.startsWith(q) ? 0 : 1;
      const bp = q && bn.startsWith(q) ? 0 : 1;
      return (ap - bp) || an.localeCompare(bn, 'ko');
    })
    .slice(0, 8);
}
function syncProductFieldDisplay(selectId, inputId) {
  const sel = inp(selectId);
  const input = inp(inputId);
  if (!sel || !input) return;
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const p = visibleProducts.find(x => x.id === sel.value);
  input.value = p ? (p.name || '') : '';
}
function hideProductFieldMatches(resultsId) {
  const box = inp(resultsId);
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}
function selectProductField(selectId, inputId, resultsId, productId, changeFnName) {
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const p = visibleProducts.find(x => x.id === productId);
  const sel = inp(selectId);
  if (!p || !sel) return;
  if (![...sel.options].some(opt => opt.value === p.id)) {
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(p.id)}">${esc(p.name)}</option>`);
  }
  sel.value = p.id;
  sv(inputId, p.name || '');
  hideProductFieldMatches(resultsId);
  if (changeFnName && typeof window[changeFnName] === 'function') window[changeFnName]();
}
function renderProductFieldMatches(selectId, inputId, resultsId, clientSelectId, changeFnName) {
  const box = inp(resultsId);
  if (!box) return;
  const rows = _productFieldMatches(v(inputId), clientSelectId ? v(clientSelectId) : '');
  if (!rows.length) { hideProductFieldMatches(resultsId); return; }
  box.innerHTML = rows.map(p => `
    <button type="button" class="inline-search-item" onmousedown="selectProductField('${esc(selectId)}','${esc(inputId)}','${esc(resultsId)}','${esc(p.id)}','${esc(changeFnName || '')}')">
      <strong>${esc(p.name || p.id)}</strong>
      <span>${esc(p.id)} · ${esc(getClientName(p.clientId) || '고객사 미지정')}${p.spec ? ' · ' + esc(p.spec) : ''}</span>
    </button>
  `).join('');
  box.style.display = 'block';
}
function onProductFieldSearchInput(selectId, inputId, resultsId, clientSelectId, changeFnName) {
  const sel = inp(selectId);
  if (sel) {
    const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
    const p = visibleProducts.find(x => x.id === sel.value);
    if (p && String(v(inputId)).trim() !== String(p.name || '').trim()) sel.value = '';
  }
  renderProductFieldMatches(selectId, inputId, resultsId, clientSelectId, changeFnName);
}
function onProductFieldSearchKey(e, selectId, inputId, resultsId, clientSelectId, changeFnName) {
  if (e.key === 'Escape') { hideProductFieldMatches(resultsId); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();
  const first = _productFieldMatches(v(inputId), clientSelectId ? v(clientSelectId) : '')[0];
  if (first) {
    selectProductField(selectId, inputId, resultsId, first.id, changeFnName);
  }
}
function openProductFieldSearch(selectId, inputId, resultsId, clientSelectId, changeFnName) {
  const input = inp(inputId);
  if (input) input.focus();
  renderProductFieldMatches(selectId, inputId, resultsId, clientSelectId, changeFnName);
}

function getClientSearchCandidatesReact(query) {
  return _clientSearchCandidates(query, 8, false).map(c => ({
    id: c.id,
    name: c.name || c.id,
    meta: `${c.id} · 담당 ${c.manager || '미지정'} · ${c.tel || c.email || '연락처 미지정'}`
  }));
}
function ensureClientForReact(id) {
  return ensureClientFromAnyPartner(id);
}
function getProductSearchCandidatesReact(query, clientId) {
  return _productFieldMatches(query, clientId).map(p => ({
    id: p.id,
    name: p.name || p.id,
    meta: `${p.id} · ${getClientName(p.clientId) || '고객사 미지정'}${p.spec ? ' · ' + p.spec : ''}`
  }));
}
function openPartnerModalFromPicker() {
  closeModal('partner-picker-modal');
  openPartnerModal();
  // 저장 후 피커가 다시 열리도록 콜백 유지
  const origSave = window._pickerCallbackAfterSave = _pickerCallback;
  const origSavePartner = window.savePartnerForm;
  inp('bp-save-btn').onclick = function() {
    origSavePartner();
    // 새로 등록된 거래처 자동 선택
    if (origSave && partners.length) {
      const newest = partners[0];
      origSave(newest);
    }
  };
}
Object.assign(window, {
  openClientPicker,
  getClientSearchCandidatesReact,
  ensureClientForReact,
  getProductSearchCandidatesReact
});
