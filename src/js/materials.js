/* ════════ [복구] 자재 수급/발주 (materials) ════════ */
function syncFilterDropdowns() {
  const fc = inp('mat-fc');
  if (fc) {
    const cur = fc.value;
    fc.innerHTML = '<option value="">전체 의뢰 고객사</option>' + clients.map(c=>'<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+c.name+'</option>').join('');
  }
  const fp = inp('mat-fp');
  if (fp) {
    const cur = fp.value;
    fp.innerHTML = '<option value="">전체 제품 목록</option>' + products.map(p=>'<option value="'+p.id+'"'+(p.id===cur?' selected':'')+'>'+p.name+'</option>').join('');
  }
}
function onMatClientChange() {
  const cid = v('mat-fc');
  const fp = inp('mat-fp');
  if (fp) fp.innerHTML = '<option value="">전체 제품 목록</option>' + products.filter(p=>!cid||p.clientId===cid).map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join('');
  renderMaterials();
}
function onAddMatClientChange() {
  const cid = v('ma-client');
  const sel = inp('ma-product');
  if (sel) sel.innerHTML = '<option value="">-- 품목 선택 --</option>' + products.filter(p=>!cid||p.clientId===cid).map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join('');
}
function renderMaterials() {
  const before = materials.filter(m=>m.status==='발주전').length;
  const shipping = materials.filter(m=>m.status==='발주중'||m.status==='지연').length;
  const done = materials.filter(m=>m.status==='입고완료').length;
  const totalAmt = materials.reduce((s,m)=>s+getMatAmt(m),0);
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
  let rows = materials.filter(m => {
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
  const thSort = (key, label, editField, editType) => {
    const ef = editField ? ' data-field="'+editField+'" data-type="'+(editType||'text')+'"' : '';
    return '<th onclick="toggleSort(\'materials\',\''+key+'\')" style="cursor:pointer;user-select:none;"'+ef+'>'+label+' '+sortIcon('materials',key)+'</th>';
  };
  cont.innerHTML = '<table style="min-width:1080px;"><thead><tr>' +
    thSort('id','자재코드','id','text') + thSort('client','구분고객사') + thSort('product','매칭제품') +
    thSort('name','자재품명','name','text') + thSort('supplier','협력공급처','supplier','text') + thSort('unitPrice','구매단가','unitPrice','number') +
    thSort('qty','수량','qty','number') + thSort('totalAmt','매입총액') + thSort('orderDate','주문일자','orderDate','date') +
    thSort('expectedDate','입고예정일','expectedDate','date') + thSort('status','진행상황') + thSort('note','참고사항','note','textarea') +
    '<th>관리작업</th>' +
    '</tr></thead><tbody>' + rows.map(m=>{
      const prod = getProductById(m.productId);
      const cname = prod ? getClientName(prod.clientId) : '—';
      return '<tr>' +
        '<td>'+m.id+'</td>' +
        '<td>'+cname+'</td>' +
        '<td style="font-weight:600;font-size:11px;">'+getProductName(m.productId)+'</td>' +
        '<td style="font-weight:700;">'+m.name+'</td>' +
        '<td>'+(m.supplier||'—')+'</td>' +
        '<td style="font-weight:600;">'+fmtW(m.unitPrice)+'</td>' +
        '<td>'+m.qty+' '+m.unit+'</td>' +
        '<td style="font-weight:700;color:var(--tx-i);">'+fmtW(getMatAmt(m))+'</td>' +
        '<td>'+(m.orderDate||'—')+'</td>' +
        '<td>'+(m.expectedDate||'—')+'</td>' +
        '<td><select class="stat-sel" style="color:'+(sColor[m.status]||'')+'" onchange="changeMatStatus(\''+m.id+'\',this.value)">' +
          ['발주전','발주중','입고완료','지연'].map(s=>'<option'+(s===m.status?' selected':'')+'>'+s+'</option>').join('') +
        '</select></td>' +
        '<td style="font-size:11px;color:var(--tx-t);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+(m.note||'')+'">'+(m.note||'—')+'</td>' +
        '<td style="white-space:nowrap;"><button class="edit-btn" onclick="openMatEdit(\''+m.id+'\')"><i class="ti ti-edit"></i>수정</button>' +
        '<button class="del-btn" style="margin-left:4px;" onclick="deleteMat(\''+m.id+'\')"><i class="ti ti-trash"></i></button></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
  setTimeout(() => { const c = inp('mat-table'); if (c && typeof gridify==='function') gridify(c, { data: () => materials, save: () => saveStorage('materials', materials), rerender: renderMaterials, idField: 'id' }); }, 0);
}
function openMatAdd() {
  editMatId = null;
  inp('mat-modal-ttl').innerHTML = '<i class="ti ti-package-import" style="color:var(--tx-i);"></i>자재 수급/발주 등록';
  sv('ma-id', nextCode('MT', materials));
  fillClientSelect('ma-client', false);
  sv('ma-client', v('mat-fc') || clients[0]?.id || '');
  onAddMatClientChange();
  if (v('mat-fp')) sv('ma-product', v('mat-fp'));
  ['ma-name','ma-supplier','ma-price','ma-qty','ma-note'].forEach(x=>sv(x,''));
  sv('ma-unit','EA'); sv('ma-status','발주전'); sv('ma-odate', today()); sv('ma-edate','');
  inp('mat-modal').classList.add('open');
}
function openMatEdit(id) {
  const m = materials.find(x=>x.id===id); if (!m) return;
  editMatId = id;
  inp('mat-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>자재 발주 수정';
  sv('ma-id', m.id);
  const prod = getProductById(m.productId);
  fillClientSelect('ma-client', false);
  sv('ma-client', prod?prod.clientId:'');
  onAddMatClientChange();
  sv('ma-product', m.productId);
  sv('ma-name', m.name); sv('ma-supplier', m.supplier||'');
  sv('ma-price', m.unitPrice||0); sv('ma-qty', m.qty||0);
  sv('ma-unit', m.unit||'EA'); sv('ma-status', m.status);
  sv('ma-odate', m.orderDate||''); sv('ma-edate', m.expectedDate||''); sv('ma-note', m.note||'');
  inp('mat-modal').classList.add('open');
}
function saveMaterialForm() {
  if (!checkAdminAction()) return;
  const name = v('ma-name').trim();
  if (!name) { showToast('자재명은 필수입니다.', 'error'); return; }
  const obj = {
    id: editMatId || v('ma-id') || nextCode('MT', materials),
    productId: v('ma-product'), name, supplier: v('ma-supplier'),
    unitPrice: parseInt(v('ma-price'))||0, qty: parseInt(v('ma-qty'))||0,
    unit: v('ma-unit')||'EA', orderDate: v('ma-odate'), expectedDate: v('ma-edate'),
    status: v('ma-status'), note: v('ma-note')
  };
  if (editMatId) { const i = materials.findIndex(m=>m.id===editMatId); if (i>=0) materials[i] = obj; }
  else materials.unshift(obj);
  saveStorage('materials', materials);
  closeModal('mat-modal');
  renderMaterials();
  if (typeof scanAndGenerateAlerts === 'function') scanAndGenerateAlerts();
  showToast(editMatId ? '자재 발주가 수정되었습니다.' : '자재 발주가 등록되었습니다.');
}
function changeMatStatus(id, status) {
  const m = materials.find(x=>x.id===id); if (!m) return;
  const prevStatus = m.status;
  m.status = status;
  saveStorage('materials', materials);

  if (status === '입고완료' && prevStatus !== '입고완료') {
    const invItem = inventory.find(function(i) { return i.name === m.name; });
    if (invItem) {
      invItem.qty = (invItem.qty || 0) + (m.qty || 0);
      saveStorage('inventory', inventory);
      logInventoryMove(invItem.id, '입고', m.qty, '자재발주 입고 (' + m.id + ')', m.id);
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
  if (!confirm('이 자재 발주를 삭제하시겠습니까?')) return;
  pushToTrash('material', m);
  materials = materials.filter(x=>x.id!==id);
  saveStorage('materials', materials);
  renderMaterials();
  showToast('자재 발주가 휴지통으로 이동되었습니다.');
}
function exportMatCSV() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['자재코드','제품','자재명','공급처','단가','수량','총액','주문일','입고예정','상태','비고'];
  const rows = materials.map(m=>[m.id, getProductName(m.productId), m.name, m.supplier||'', m.unitPrice||0, m.qty, getMatAmt(m), m.orderDate||'', m.expectedDate||'', m.status, m.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([h, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, '자재발주');
  XLSX.writeFile(wb, '자재발주_' + today() + '.xlsx');
  showToast('엑셀 저장 완료');
}
function importPoXLS(input) {
  showToast('발주서 XLS 가져오기는 현재 비활성화 상태입니다. 수동 등록을 이용해 주세요.', 'info');
  if (input) input.value = '';
}
