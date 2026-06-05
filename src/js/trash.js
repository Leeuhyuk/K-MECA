/* ════════ 9. 휴지통 백업 및 복구 로직 ════════ */
function pushToTrash(type, name, originalId, data, cascadeData = null) {
  const newItem = {
    id: nextCode('TRSH', trash, 'id'),
    type,
    name,
    originalId,
    deletedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    data,
    cascadeData
  };
  trash.unshift(newItem);
  saveStorage('trash', trash);
  updateTrashBadge();
}

function updateTrashBadge() {
  const el = inp('trashBadge');
  if (el) el.textContent = trash.length;
}

function restoreTrash(id) {
  const item = trash.find(x => x.id === id);
  if (!item) return;

  if (item.type === 'client') {
    if (!clients.some(c => c.id === item.originalId)) {
      clients.push(item.data);
      saveStorage('clients', clients);
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

  trash = trash.filter(x => x.id !== id);
  saveStorage('trash', trash);
  
  syncFilterDropdowns();
  updateTrashBadge();
  renderTrash();
}

function deleteTrashPermanently(id) {
  const item = trash.find(x => x.id === id);
  if (!item) return;

  confirm_('데이터 영구 삭제 경고', `<strong>[${item.name}]</strong> 데이터를 휴지통에서 완전히 삭제하시겠습니까?<br><span style="color:var(--tx-d); font-weight:700;">이 작업은 복구가 절대 불가능하며 데이터가 완전히 유실됩니다.</span>`, () => {
    trash = trash.filter(x => x.id !== id);
    saveStorage('trash', trash);
    updateTrashBadge();
    renderTrash();
    showToast('데이터가 시스템에서 영구 파기되었습니다.', 'info');
  });
}

function emptyTrash() {
  if (trash.length === 0) {
    showToast('비워둘 수 있는 휴지통 항목이 없습니다.', 'info');
    return;
  }
  confirm_('휴지통 전체 비우기', `휴지통 내부 <strong>총 ${trash.length}건</strong>의 모든 백업 데이터를 영구 파기하시겠습니까?<br><span style="color:var(--tx-d); font-weight:700;">비워진 메모리 데이터는 복구 조작을 진행할 수 없습니다.</span>`, () => {
    trash = [];
    saveStorage('trash', trash);
    updateTrashBadge();
    renderTrash();
    showToast('휴지통을 깨끗하게 비웠습니다.', 'info');
  });
}

function renderTrash() {
  const filterType = v('trash-filter-type');
  const searchQ = v('trash-q').toLowerCase();

  const filtered = trash.filter(i => {
    if (filterType && i.type !== filterType) return false;
    if (searchQ && ![i.name, i.originalId, i.id].join(' ').toLowerCase().includes(searchQ)) return false;
    return true;
  });

  inp('trash-total').textContent = trash.length + '건';

  const tableContainer = inp('trash-table');
  if (!tableContainer) return;
  if (!filtered.length) { tableContainer.innerHTML = empty('휴지통에 삭제 및 대기 상태인 데이터가 존재하지 않습니다.'); return; }

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
          <th>휴지통 코드</th>
          <th>원래 데이터 분류</th>
          <th>원래 고유 코드</th>
          <th>기존 데이터 개요</th>
          <th>삭제 일시</th>
          <th>연쇄 복구 유무</th>
          <th>동작</th>
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
            <tr>
              <td>${i.id}</td>
              <td><span class="bd bd-neu">${typeLabels[i.type] || i.type}</span></td>
              <td style="font-family: monospace; font-weight:700;">${i.originalId}</td>
              <td style="font-weight:700; color:var(--tx-s);">${i.name}</td>
              <td>${i.deletedAt}</td>
              <td><span style="font-size:11px; font-weight:600; color:var(--tx-i);">${sizeLabel}</span></td>
              <td>
                <button class="restore-btn" onclick="restoreTrash('${i.id}')"><i class="ti ti-rotate-clockwise"></i>복구</button>
                <button class="del-btn" onclick="deleteTrashPermanently('${i.id}')" style="margin-left:4px;"><i class="ti ti-trash"></i>영구 삭제</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}
