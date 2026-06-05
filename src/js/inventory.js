/* ════════ [복구] 실시간 재고 관리 (inventory) ════════ */
function renderInventory() {
  // 현재 분류 한정 집합
  const catItems = inventory.filter(i => (i.category || '생산부품') === invCategory);
  const total = catItems.length;
  const below = catItems.filter(i => i.qty < (i.minQty||0)).length;
  const totalQty = catItems.reduce((s,i) => s + (Number(i.qty)||0), 0);
  const okRate = total > 0 ? Math.round((total - below) / total * 100) : 100;
  const catIcon = invCategory==='완제품' ? 'ti-building-factory' : invCategory==='사무비품' ? 'ti-printer' : 'ti-tools';

  const secLbl = inp('inv-sec-lbl');
  if (secLbl) secLbl.innerHTML = `<i class="ti ${catIcon}"></i>${invCategory} 재고 목록`;

  const stCur = v('inv-filter-status') || '';
  const kpi = inp('inv-kpi');
  if (kpi) kpi.innerHTML =
    '<div class="mc"><div class="mc-lbl"><i class="ti '+catIcon+'"></i>'+invCategory+' 품목수</div><div class="mc-val">'+total+'개 종</div></div>' +
    '<div class="mc clickable'+(stCur==='low'?' kpi-active':'')+'" onclick="kpiFilter(\'inv-filter-status\',\'low\',\'renderInventory\')"><div class="mc-lbl"><i class="ti ti-package-off" style="color:var(--tx-d);"></i>안전재고 미달</div><div class="mc-val" style="color:var(--tx-d);">'+below+'개 품목</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-stack-2" style="color:var(--tx-i);"></i>총 보유 수량</div><div class="mc-val" style="color:var(--tx-i);">'+totalQty+'</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-circle-check" style="color:var(--tx-ok);"></i>안전재고 충족률</div><div class="mc-val" style="color:var(--tx-ok);">'+okRate+'%</div></div>';

  // 세부유형 필터 옵션을 현재 분류의 실제 유형으로 재구성
  const typeSel = inp('inv-filter-type');
  let ft = typeSel ? typeSel.value : '';
  if (typeSel) {
    const types = [...new Set(catItems.map(i => i.type).filter(Boolean))];
    if (ft && !types.includes(ft)) ft = '';
    typeSel.innerHTML = '<option value="">전체 세부유형</option>' +
      types.map(t => `<option value="${t}"${t===ft?' selected':''}>${t}</option>`).join('');
  }
  const st = v('inv-filter-status') || '';
  const q = (v('inv-q')||'').toLowerCase();
  let rows = catItems.filter(i=>{
    if (ft && i.type!==ft) return false;
    if (st === 'low'    && !(i.qty < (i.minQty||0))) return false;
    if (st === 'normal' &&  (i.qty < (i.minQty||0))) return false;
    if (q && !i.id.toLowerCase().includes(q) && !(i.name||'').toLowerCase().includes(q) && !(i.location||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.inventory.key) {
    const k = sortState.inventory.key;
    const asc = sortState.inventory.asc ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[k] == null ? '' : a[k];
      const vb = b[k] == null ? '' : b[k];
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * asc;
      }
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const cont = inp('inventory-table');
  if (!cont) return;
  if (!rows.length) { cont.innerHTML = empty(`${invCategory} 분류에 등록된 재고가 없습니다. [신규 재고 품목 등록] 버튼으로 추가하세요.`); }
  const tColor = {자재:'bd-info',완제품:'bd-ok',반제품:'bd-warn',소모품:'bd-neu',비품:'bd-neu'};
  if (rows.length) cont.innerHTML = '<table style="min-width:900px;"><thead><tr>' +
    '<th onclick="toggleSort(\'inventory\', \'id\')" style="cursor:pointer; user-select:none;">재고코드 ' + sortIcon('inventory', 'id') + '</th>' +
    '<th onclick="toggleSort(\'inventory\', \'name\')" style="cursor:pointer; user-select:none;">품목명 ' + sortIcon('inventory', 'name') + '</th>' +
    '<th onclick="toggleSort(\'inventory\', \'type\')" style="cursor:pointer; user-select:none;">분류 ' + sortIcon('inventory', 'type') + '</th>' +
    '<th onclick="toggleSort(\'inventory\', \'qty\')" style="cursor:pointer; user-select:none;">현재고 ' + sortIcon('inventory', 'qty') + '</th>' +
    '<th onclick="toggleSort(\'inventory\', \'minQty\')" style="cursor:pointer; user-select:none;">안전재고 ' + sortIcon('inventory', 'minQty') + '</th>' +
    '<th onclick="toggleSort(\'inventory\', \'location\')" style="cursor:pointer; user-select:none;">보관위치 ' + sortIcon('inventory', 'location') + '</th>' +
    '<th onclick="toggleSort(\'inventory\', \'note\')" style="cursor:pointer; user-select:none;">참고 ' + sortIcon('inventory', 'note') + '</th>' +
    '<th>관리</th>' +
    '</tr></thead><tbody>' + rows.map(i=>{
      const low = i.qty < (i.minQty||0);
      return '<tr>' +
        '<td style="font-size:11px;color:var(--tx-t);">'+i.id+'</td>' +
        '<td style="font-weight:700;">'+i.name+'</td>' +
        '<td><span class="bd '+(tColor[i.type]||'bd-neu')+'">'+i.type+'</span></td>' +
        '<td style="font-weight:700;'+(low?'color:var(--tx-d);':'')+'">' +
          '<button class="btn btn-sm" style="padding:0 7px;" onclick="adjustStock(\''+i.id+'\',-1)">−</button> ' +
          i.qty+' '+i.unit+' ' +
          '<button class="btn btn-sm" style="padding:0 7px;" onclick="adjustStock(\''+i.id+'\',1)">+</button>' +
          (low?' <i class="ti ti-alert-triangle" style="color:var(--tx-d);" title="안전재고 미달"></i>':'') +
        '</td>' +
        '<td>'+(i.minQty||0)+'</td>' +
        '<td style="font-size:11px;">'+(i.location||'—')+'</td>' +
        '<td style="font-size:11px;color:var(--tx-t);">'+(i.note||'—')+'</td>' +
        '<td style="white-space:nowrap;"><button class="edit-btn" onclick="openInvEdit(\''+i.id+'\')"><i class="ti ti-edit"></i>수정</button>' +
        '<button class="del-btn" style="margin-left:4px;" onclick="deleteInventory(\''+i.id+'\')"><i class="ti ti-trash"></i></button></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
  // 이력 품목 필터 드롭다운 동기화
  const invLedgerSel = document.getElementById('inv-ledger-inv');
  if (invLedgerSel) {
    const curVal = invLedgerSel.value;
    invLedgerSel.innerHTML = '<option value="">전체 품목</option>' +
      inventory.map(function(i) {
        return '<option value="' + i.id + '"' + (i.id === curVal ? ' selected' : '') + '>' + i.name + '</option>';
      }).join('');
  }
  renderInventoryLedger();
}
function adjustStock(id, delta) {
  const i = inventory.find(x=>x.id===id); if (!i) return;
  i.qty = Math.max(0, (i.qty||0) + delta);
  logInventoryMove(id, delta > 0 ? '입고' : '출고', Math.abs(delta), '수동 조정');
  saveStorage('inventory', inventory);
  renderInventory();
}
function openInvAdd() {
  editInvId = null;
  inp('inv-modal-ttl').innerHTML = '<i class="ti ti-package" style="color:var(--tx-i);"></i>재고 품목 등록';
  sv('inva-id', nextCode('INV', inventory));
  sv('inva-name','');
  sv('inva-category', invCategory);
  sv('inva-type', invCategory==='완제품' ? '완제품' : invCategory==='사무비품' ? '소모품' : '자재');
  sv('inva-unit','EA');
  sv('inva-qty','0'); sv('inva-minQty','10'); sv('inva-location',''); sv('inva-note','');
  inp('inv-modal').classList.add('open');
}
function openInvEdit(id) {
  const i = inventory.find(x=>x.id===id); if (!i) return;
  editInvId = id;
  inp('inv-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>재고 수정';
  sv('inva-id', i.id); sv('inva-name', i.name);
  sv('inva-category', i.category || '생산부품'); sv('inva-type', i.type);
  sv('inva-unit', i.unit||'EA'); sv('inva-qty', i.qty||0); sv('inva-minQty', i.minQty||0);
  sv('inva-location', i.location||''); sv('inva-note', i.note||'');
  inp('inv-modal').classList.add('open');
}
function saveInventoryForm() {
  if (!checkAdminAction()) return;
  const name = v('inva-name').trim();
  if (!name) { showToast('품목명은 필수입니다.', 'error'); return; }
  const obj = {
    id: editInvId || v('inva-id') || nextCode('INV', inventory),
    name, category: v('inva-category')||'생산부품', type: v('inva-type'), unit: v('inva-unit')||'EA',
    qty: parseInt(v('inva-qty'))||0, minQty: parseInt(v('inva-minQty'))||0,
    location: v('inva-location'), note: v('inva-note')
  };
  if (editInvId) { const i = inventory.findIndex(x=>x.id===editInvId); if (i>=0) inventory[i] = obj; }
  else inventory.unshift(obj);
  saveStorage('inventory', inventory);
  closeModal('inv-modal');
  renderInventory();
  showToast(editInvId ? '재고가 수정되었습니다.' : '재고가 등록되었습니다.');
}
function deleteInventory(id) {
  if (!checkAdminAction()) return;
  const i = inventory.find(x=>x.id===id); if (!i) return;
  if (!confirm('이 재고 품목을 삭제하시겠습니까?')) return;
  pushToTrash('inventory', i);
  inventory = inventory.filter(x=>x.id!==id);
  saveStorage('inventory', inventory);
  renderInventory();
  showToast('재고가 휴지통으로 이동되었습니다.');
}
function exportInvCSV() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['재고코드','품목명','재고구분','세부유형','현재고','단위','안전재고','보관위치','비고'];
  const target = inventory.filter(i => (i.category||'생산부품') === invCategory);
  const rows = target.map(i=>[i.id,i.name,i.category||'',i.type,i.qty,i.unit,i.minQty||0,i.location||'',i.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([h,...rows]);
  XLSX.utils.book_append_sheet(wb, ws, invCategory);
  XLSX.writeFile(wb, invCategory + '_재고_' + today() + '.xlsx');
  showToast('엑셀 저장 완료');
}
function renderInventoryLedger() {
  const cont = document.getElementById('inv-ledger-table');
  if (!cont) return;
  const filter = document.getElementById('inv-ledger-inv') ? document.getElementById('inv-ledger-inv').value : '';
  const rows = inventoryLedger.filter(e => !filter || e.invId === filter);
  if (!rows.length) { cont.innerHTML = empty('입출고 이력이 없습니다.'); return; }
  const typeColor = { '입고': 'var(--tx-ok)', '출고': 'var(--tx-d)', '조정': 'var(--tx-w)' };
  cont.innerHTML = '<table><thead><tr>' +
    '<th>일자</th><th>품목명</th><th>유형</th><th>수량</th><th>사유</th><th>연관 ID</th>' +
    '</tr></thead><tbody>' +
    rows.slice(0, 100).map(function(e) {
      const inv = inventory.find(function(x) { return x.id === e.invId; });
      return '<tr>' +
        '<td style="font-size:11px;">' + e.date + '</td>' +
        '<td style="font-weight:600;">' + (inv ? inv.name : e.invId) + '</td>' +
        '<td style="color:' + (typeColor[e.type]||'var(--tx)') + ';font-weight:700;">' + e.type + '</td>' +
        '<td style="font-weight:700;">' + (e.qty > 0 ? '+' : '') + e.qty + '</td>' +
        '<td style="font-size:11px;color:var(--tx-t);">' + e.reason + '</td>' +
        '<td style="font-size:11px;color:var(--tx-t);">' + (e.refId || '—') + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}
