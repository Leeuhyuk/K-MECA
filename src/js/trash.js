/* ════════ 9. 휴지통 백업 및 복구 로직 ════════ */
function nextTrashId(actor = getCurrentActor()) {
  const who = String((actor && (actor.uid || actor.userId || actor.email)) || 'local').replace(/[^a-zA-Z0-9]+/g, '').slice(-6) || 'local';
  return 'TRSH-' + Date.now().toString(36).toUpperCase() + '-' + who + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function isTrashActive(item) {
  return !!item && !item.trashStatus && !item.trashRemovedAt;
}

function activeTrashItems() {
  return Array.isArray(trash) ? trash.filter(isTrashActive) : [];
}

function visibleTrashItems() {
  const items = activeTrashItems();
  return typeof canViewRecord === 'function' ? items.filter(item => canViewRecord(item, 'trash')) : items;
}

function markTrashInactive(item, status) {
  if (!item) return;
  const actor = getCurrentActor();
  item.trashStatus = status || 'removed';
  item.trashRemovedAt = new Date().toISOString();
  item.trashRemovedBy = actor.userId;
  item.trashRemovedByName = actor.name;
}

function trashAuditDetail(item) {
  if (!item) return '';
  return [item.type || 'trash', item.originalId || item.id || '', item.name || ''].filter(Boolean).join(' · ');
}

function pushToTrash(type, name, originalId, data, cascadeData = null) {
  if (data == null && name && typeof name === 'object') {
    data = name;
    originalId = name.id || name.code || '';
    name = name.name || name.title || name.id || type;
  }
  const actor = getCurrentActor();
  if (data && typeof data === 'object') {
    data.deletedBy = actor.userId;
    data.deletedByName = actor.name;
    data.deletedAt = new Date().toISOString();
  }
  const newItem = {
    id: nextTrashId(actor),
    type,
    name,
    originalId,
    trashStatus: '',
    deletedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    deletedBy: actor.userId,
    deletedByName: actor.name,
    data,
    cascadeData
  };
  trash.unshift(newItem);
  saveStorage('trash', trash);
  updateTrashBadge();
}

function updateTrashBadge() {
  const el = inp('trashBadge');
  if (el) {
    const count = visibleTrashItems().length;
    el.textContent = count;
    el.style.display = count ? '' : 'none';
  }
}

function restoreTrash(id) {
  const item = trash.find(x => x.id === id && isTrashActive(x));
  if (!item) return;
  if (typeof canViewRecord === 'function' && !canViewRecord(item, 'trash')) { showToast('이 휴지통 항목에 접근할 권한이 없습니다.', 'error'); return; }
  if (!roleFeatureAllowed('restore')) { showToast('복구 권한이 없습니다.', 'error'); return; }
  const actor = getCurrentActor();
  const restoredData = item.data && typeof item.data === 'object' ? item.data : null;
  if (restoredData) {
    restoredData.restoredBy = actor.userId;
    restoredData.restoredByName = actor.name;
    restoredData.restoredAt = new Date().toISOString();
  }

  if (item.type === 'client') {
    if (!clients.some(c => c.id === item.originalId)) {
      clients.push(item.data);
      saveStorage('clients', clients);
    }
    if (typeof syncPartnerFromClient === 'function') {
      syncPartnerFromClient(item.data);
      saveStorage('partners', partners);
    }
    if (item.cascadeData) {
      if (item.cascadeData.products) {
        item.cascadeData.products.forEach(p => {
          if (!products.some(x => x.id === p.id)) products.push(p);
        });
        saveStorage('products', products);
      }
      if (item.cascadeData.materials) {
        item.cascadeData.materials.forEach(m => {
          if (!materials.some(x => x.id === m.id)) materials.push(m);
        });
        saveStorage('materials', materials);
      }
      if (item.cascadeData.workOrders) {
        item.cascadeData.workOrders.forEach(w => {
          if (!workOrders.some(x => x.id === w.id)) workOrders.push(w);
        });
        saveStorage('workOrders', workOrders);
      }
    }
    showToast(`고객사 [${item.data.name}] 및 연동 하위 완제품/자재가 완벽히 역복구되었습니다.`);
  } 
  else if (item.type === 'partner') {
    if (!partners.some(p => p.id === item.originalId)) {
      partners.push(item.data);
      saveStorage('partners', partners);
    }
    if (typeof syncClientFromPartner === 'function' && typeof _isCustomerPartner === 'function' && _isCustomerPartner(item.data)) {
      syncClientFromPartner(item.data);
      saveStorage('clients', clients);
    }
    showToast('거래처가 복구되었습니다.');
  }
  else if (item.type === 'product') {
    if (!products.some(p => p.id === item.originalId)) {
      products.push(item.data);
      saveStorage('products', products);
    }
    if (item.cascadeData) {
      if (item.cascadeData.materials) {
        item.cascadeData.materials.forEach(m => {
          if (!materials.some(x => x.id === m.id)) materials.push(m);
        });
        saveStorage('materials', materials);
      }
      if (item.cascadeData.workOrders) {
        item.cascadeData.workOrders.forEach(w => {
          if (!workOrders.some(x => x.id === w.id)) workOrders.push(w);
        });
        saveStorage('workOrders', workOrders);
      }
    }
    showToast(`완제품 [${item.data.name}] 및 종속 작업지시가 복원되었습니다.`);
  } 
  else if (item.type === 'material') {
    if (!materials.some(m => m.id === item.originalId)) {
      materials.push(item.data);
      saveStorage('materials', materials);
    }
    showToast(`자재 가공 발주건 [${item.data.name}]이 복구되었습니다.`);
  } 
  else if (item.type === 'inventory') {
    if (!inventory.some(i => i.id === item.originalId)) {
      inventory.push(item.data);
      saveStorage('inventory', inventory);
    }
    showToast(`창고 재고 보관 품목 [${item.data.name}]이 복원되었습니다.`);
  } 
  else if (item.type === 'order') {
    if (!workOrders.some(o => o.id === item.originalId)) {
      workOrders.push(item.data);
      saveStorage('workOrders', workOrders);
    }
    showToast(`현장 생산지시 [${item.data.id}] 지시서가 복구되었습니다.`);
  } 
  else if (item.type === 'defect') {
    if (!defects.some(d => d.id === item.originalId)) {
      defects.push(item.data);
      saveStorage('defects', defects);
    }
    showToast(`품질 부적합 분석 리포트가 성공적으로 복구되었습니다.`);
  } 
  else if (item.type === 'claim') {
    if (!claims.some(c => c.id === item.originalId)) {
      claims.push(item.data);
      saveStorage('claims', claims);
    }
    showToast(`고객 클레임 상세 내역이 복구되었습니다.`);
  } 
  else if (item.type === 'check') {
    if (!checkRecords.some(r => r.id === item.originalId)) {
      checkRecords.push(item.data);
      saveStorage('checkRecords', checkRecords);
    }
    showToast(`최종 승인 출하 성적 대장이 복원되었습니다.`);
  } 
  else if (item.type === 'worker') {
    if (!workers.some(w => w.id === item.originalId)) {
      workers.push(item.data);
      saveStorage('workers', workers);
    }
    showToast(`[${item.data.name}] 사원의 조업 임직원 프로필이 복구되었습니다.`);
  }

  markTrashInactive(item, 'restored');
  saveStorage('trash', trash);
  writeAuditLog(item.type || 'trash', item.originalId || id, 'restore', null, item.data, { summary:'휴지통 복구', detail:trashAuditDetail(item), changes:[] });
  
  syncFilterDropdowns();
  updateTrashBadge();
  renderTrash();
}

function deleteTrashPermanently(id) {
  const item = trash.find(x => x.id === id && isTrashActive(x));
  if (!item) return;
  if (typeof canViewRecord === 'function' && !canViewRecord(item, 'trash')) { showToast('이 휴지통 항목에 접근할 권한이 없습니다.', 'error'); return; }
  if (typeof roleFeatureAllowed === 'function' && !roleFeatureAllowed('delete')) { showToast('삭제 권한이 없습니다.', 'error'); return; }

  confirm_('데이터 영구 삭제 경고', `<strong>[${item.name}]</strong> 데이터를 휴지통에서 완전히 삭제하시겠습니까?<br><span style="color:var(--tx-d); font-weight:700;">이 작업은 복구가 절대 불가능하며 데이터가 완전히 유실됩니다.</span>`, () => {
    markTrashInactive(item, 'deleted');
    writeAuditLog('trash', item.id || id, 'delete', item, null, { summary:'휴지통 영구 삭제', detail:trashAuditDetail(item), changes:[] });
    saveStorage('trash', trash);
    updateTrashBadge();
    renderTrash();
    showToast('데이터가 시스템에서 영구 파기되었습니다.', 'info');
  });
}

function emptyTrash() {
  const active = visibleTrashItems();
  if (active.length === 0) {
    showToast('비워둘 수 있는 휴지통 항목이 없습니다.', 'info');
    return;
  }
  if (typeof roleFeatureAllowed === 'function' && !roleFeatureAllowed('delete')) { showToast('삭제 권한이 없습니다.', 'error'); return; }
  confirm_('휴지통 전체 비우기', `휴지통 내부 <strong>총 ${active.length}건</strong>의 모든 백업 데이터를 영구 파기하시겠습니까?<br><span style="color:var(--tx-d); font-weight:700;">비워진 메모리 데이터는 복구 조작을 진행할 수 없습니다.</span>`, () => {
    active.forEach(item => {
      writeAuditLog('trash', item.id || item.originalId || '', 'delete', item, null, { summary:'휴지통 전체 비우기', source:'bulkAction', detail:trashAuditDetail(item), changes:[] });
      markTrashInactive(item, 'deleted');
    });
    saveStorage('trash', trash);
    updateTrashBadge();
    renderTrash();
    showToast('휴지통을 깨끗하게 비웠습니다.', 'info');
  });
}

function trashRowChecks() {
  return Array.from(document.querySelectorAll('#trash-table .trash-row-check'));
}

function trashSelectedIds() {
  return trashRowChecks().filter(chk => chk.checked).map(chk => chk.value);
}

function trashUpdateSelection() {
  const checks = trashRowChecks();
  const selected = checks.filter(chk => chk.checked);
  const all = inp('trash-check-all');
  if (all) {
    all.checked = checks.length > 0 && selected.length === checks.length;
    all.indeterminate = selected.length > 0 && selected.length < checks.length;
  }
  checks.forEach(chk => {
    const row = chk.closest('tr');
    if (row) row.classList.toggle('table-row-selected', chk.checked);
  });
  document.querySelectorAll('.trash-selection-bar').forEach(bar => {
    bar.style.display = selected.length ? 'flex' : 'none';
  });
  document.querySelectorAll('.trash-selected-count').forEach(el => {
    el.textContent = selected.length;
  });
}

function trashToggleAll(checked) {
  trashRowChecks().forEach(chk => { chk.checked = checked; });
  trashUpdateSelection();
}

function trashToggleRowFromClick(event) {
  const target = event.target;
  if (target && target.closest && target.closest('input, button, select, a, label')) return;
  const row = target && target.closest ? target.closest('tr') : null;
  const chk = row ? row.querySelector('.trash-row-check') : null;
  if (!chk) return;
  chk.checked = !chk.checked;
  trashUpdateSelection();
}

function trashClearSelection() {
  trashRowChecks().forEach(chk => { chk.checked = false; });
  trashUpdateSelection();
}

function trashRestoreSelected() {
  const ids = trashSelectedIds();
  if (!ids.length) return;
  ids.slice().forEach(id => restoreTrash(id));
}

function trashDeleteSelected() {
  const ids = trashSelectedIds();
  if (!ids.length) return;
  if (typeof roleFeatureAllowed === 'function' && !roleFeatureAllowed('delete')) { showToast('삭제 권한이 없습니다.', 'error'); return; }
  confirm_('선택 항목 영구 삭제', `선택한 <strong>${ids.length}건</strong>을 휴지통에서 완전히 삭제하시겠습니까?<br><span style="color:var(--tx-d);font-weight:700;">이 작업은 복구할 수 없습니다.</span>`, () => {
    visibleTrashItems().filter(x => ids.includes(x.id)).forEach(item => markTrashInactive(item, 'deleted'));
    saveStorage('trash', trash);
    updateTrashBadge();
    renderTrash();
    showToast(`선택한 휴지통 항목 ${ids.length}건을 영구 삭제했습니다.`, 'info');
  });
}

function renderTrash() {
  const filterType = v('trash-filter-type');
  const searchQ = v('trash-q').toLowerCase();

  const active = visibleTrashItems();
  const filtered = active.filter(i => {
    if (filterType && i.type !== filterType) return false;
    if (searchQ && ![i.name, i.originalId, i.id].join(' ').toLowerCase().includes(searchQ)) return false;
    return true;
  });

  inp('trash-total').textContent = active.length + '건';

  const tableContainer = inp('trash-table');
  if (!tableContainer) return;
  if (!filtered.length) {
    tableContainer.innerHTML = empty('휴지통에 삭제 및 대기 상태인 데이터가 존재하지 않습니다.');
    trashUpdateSelection();
    return;
  }

  const typeLabels = {
    client: '고객사',
    product: '완제품',
    material: '발주자재',
    inventory: '재고품목',
    order: '생산지시',
    defect: '불량기록',
    claim: '고객클레임',
    check: '검사기록',
    worker: '작업원'
  };

  tableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center;"><input type="checkbox" id="trash-check-all" class="table-check-all" title="현재 휴지통 목록 전체 선택" onchange="trashToggleAll(this.checked)"></th>
          <th>휴지통 코드</th>
          <th>원래 데이터 분류</th>
          <th>원래 고유 코드</th>
          <th>기존 데이터 개요</th>
          <th>삭제 일시</th>
          <th>연쇄 복구 유무</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(i => {
          let sizeLabel = '단일 항목';
          if (i.cascadeData) {
            let parts = [];
            if (i.cascadeData.products && i.cascadeData.products.length) parts.push(`제품 ${i.cascadeData.products.length}종`);
            if (i.cascadeData.materials && i.cascadeData.materials.length) parts.push(`자재 ${i.cascadeData.materials.length}종`);
            if (i.cascadeData.workOrders && i.cascadeData.workOrders.length) parts.push(`생산지시 ${i.cascadeData.workOrders.length}건`);
            sizeLabel = parts.length > 0 ? `하위 데이터 동시복구 (${parts.join(', ')})` : '단일 항목';
          }
          return `
            <tr class="trash-data-row" onclick="trashToggleRowFromClick(event)">
              <td style="text-align:center;"><input type="checkbox" class="trash-row-check table-row-select" value="${esc(i.id)}" title="행 선택" onchange="trashUpdateSelection()"></td>
              <td>${esc(i.id)}</td>
              <td><span class="bd bd-neu">${esc(typeLabels[i.type] || i.type)}</span></td>
              <td style="font-family: monospace; font-weight:700;">${esc(i.originalId)}</td>
              <td style="font-weight:700; color:var(--tx-s);">${esc(i.name)}</td>
              <td>${esc(i.deletedAt)}</td>
              <td><span style="font-size:11px; font-weight:600; color:var(--tx-i);">${sizeLabel}</span></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  setTimeout(trashUpdateSelection, 0);
}
