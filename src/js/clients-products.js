/* ════════ 2. 수주 및 제품 등록 관리 (드래그 앤 드롭 지원!) ════════ */
function renderClients() {
  const totAmt = products.reduce((s, p) => s + (p.price * p.qty), 0);
  const activeClients = clients.filter(c => !c.closed);
  const closedClients = clients.filter(c => c.closed);

  inp('client-summary').innerHTML = `
    <div class="sum-box"><i class="ti ti-building-community si" style="color:var(--tx-i);"></i><div><div class="sn">${activeClients.length}</div><div class="sl">진행 고객사</div></div></div>
    <div class="sum-box"><i class="ti ti-archive si" style="color:#868e96;"></i><div><div class="sn">${closedClients.length}</div><div class="sl">종료 프로젝트</div></div></div>
    <div class="sum-box"><i class="ti ti-loader si" style="color:#e8590c;"></i><div><div class="sn">${products.filter(p=>p.status==='생산중'&&!clients.find(c=>c.id===p.clientId)?.closed).length}</div><div class="sl">실시간 조업</div></div></div>
    <div class="sum-box"><i class="ti ti-coin si" style="color:var(--tx-i);"></i><div><div class="sn">${fmtW(totAmt)}</div><div class="sl">전체 수주 총계</div></div></div>`;

  // 종료 보기 모드에서는 종료된 고객사만, 아니면 진행 중만
  const _cq = (v('clients-q')||'').toLowerCase();
  const viewList = (showClosedProjects ? closedClients : activeClients)
    .filter(c => {
      if (!_cq) return true;
      if ([c.name, c.manager||'', c.tel||'', c.note||''].join(' ').toLowerCase().includes(_cq)) return true;
      const prods = products.filter(p => p.clientId === c.id);
      return prods.some(p => p.name.toLowerCase().includes(_cq) || (p.spec||'').toLowerCase().includes(_cq) || p.id.toLowerCase().includes(_cq));
    });

  // 종료 보기 버튼 상태 업데이트
  const btn = inp('btn-show-closed');
  if (btn) {
    btn.innerHTML = showClosedProjects
      ? '<i class="ti ti-list"></i>진행 프로젝트 보기'
      : `<i class="ti ti-archive"></i>종료 프로젝트 (${closedClients.length})`;
    btn.style.borderColor = showClosedProjects ? 'var(--tx-i)' : 'var(--br)';
    btn.style.color       = showClosedProjects ? 'var(--tx-i)' : '';
  }

  if (!viewList.length) {
    inp('client-list').innerHTML = `<div class="empty"><i class="ti ti-inbox"></i>${showClosedProjects ? '종료된 프로젝트가 없습니다.' : '등록된 고객사가 없습니다.'}</div>`;
    return;
  }

  inp('client-list').innerHTML = viewList.map(c => {
    const prods  = products.filter(p => p.clientId === c.id);
    const isExp  = expandedClients.has(c.id);
    const editPanelId = `cedit-${c.id}`;
    const isClosed = !!c.closed;

    // 종료 버튼 표시 조건: 진행 중 프로젝트이고, 모든 제품이 완료/납품 단계
    const allDone = prods.length > 0 && prods.every(p => ['완료','납품'].includes(p.processStage));
    const canClose = !isClosed && allDone;
    // 진행 중이어도 강제 종료 허용 (경고와 함께)
    const forceClose = !isClosed && !allDone && prods.length > 0;

    return `
      <div class="client-card ${isExp ? 'expanded' : ''} ${isClosed ? 'client-closed' : ''}"
           id="card-${c.id}"
           draggable="${!isClosed}"
           ondragstart="onClientDragStart(event, '${c.id}')"
           ondragover="onClientDragOver(event)"
           ondragleave="onClientDragLeave(event)"
           ondrop="onClientDrop(event, '${c.id}')"
           ondragend="onClientDragEnd(event)">
        <div class="client-hd" onclick="toggleClient('${c.id}')" style="cursor:pointer;">
          <div class="c-avatar" style="${isClosed ? 'background:#868e96; opacity:.6;' : ''}">${esc(c.name.slice(0, 2))}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:700; ${isClosed ? 'color:var(--tx-t); text-decoration:line-through;' : ''}">${esc(c.name)}
              ${isClosed ? `<span class="bd" style="font-size:10px; background:#86868618; color:#868686; border-color:#86868644; margin-left:6px; text-decoration:none;">종료 ${esc(c.closedAt)||''}</span>` : ''}
            </div>
            <div style="font-size:11.5px; color:var(--tx-t); font-weight:500;">담당: ${esc(c.manager)||'미지정'} · 연락처: ${esc(c.tel)||'미지정'} · 제품: ${prods.length}종</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation();">
            <button class="btn btn-sm" onclick="showClient360('${c.id}')" title="고객사 360도 종합 현황"><i class="ti ti-building-community"></i>360°</button>
            ${isClosed ? `
              <button class="btn btn-sm" onclick="reopenProject('${c.id}')" title="프로젝트 재개">
                <i class="ti ti-refresh"></i>프로젝트 재개
              </button>` : `
              ${canClose ? `
                <button class="btn btn-sm" style="background:#2b8a3e18; color:#2b8a3e; border-color:#2b8a3e44;" onclick="closeProject('${c.id}', false)" title="모든 제품 완료 — 프로젝트 종료 가능">
                  <i class="ti ti-circle-check"></i>프로젝트 종료
                </button>` : ''}
              ${forceClose ? `
                <button class="btn btn-sm" style="background:var(--bg-t); color:var(--tx-t); border-color:var(--br);" onclick="closeProject('${c.id}', true)" title="진행 중인 제품이 있습니다 — 강제 종료">
                  <i class="ti ti-lock"></i>강제 종료
                </button>` : ''}
              <button class="btn btn-sm" onclick="openClientEdit('${c.id}')" title="수주처 정보 수정"><i class="ti ti-edit"></i>수정</button>
              <button class="btn btn-sm btn-danger" onclick="deleteClient('${c.id}')" title="수주처 삭제"><i class="ti ti-trash"></i></button>`}
          </div>
          <i class="ti ${isExp ? 'ti-chevron-up' : 'ti-chevron-down'}" style="color:var(--tx-t); font-size:16px; margin-left:12px;"></i>
        </div>

        <div class="client-body ${isExp ? 'open' : ''}">
          ${!isClosed ? `
          <!-- 업체 수정 패널 -->
          <div class="add-panel edit-mode" id="${editPanelId}">
            <div class="panel-ttl clr-edit"><i class="ti ti-edit"></i>${esc(c.name)} 프로필 수정</div>
            <div class="fg fg4">
              <div class="ff"><label>업체명 *</label><input id="ce-name-${c.id}" value="${esc(c.name)}"></div>
              <div class="ff"><label>실무자명</label><input id="ce-mgr-${c.id}" value="${esc(c.manager)}"></div>
              <div class="ff"><label>전화번호</label><input id="ce-tel-${c.id}" value="${esc(c.tel)}"></div>
              <div class="ff"><label>이메일</label><input id="ce-email-${c.id}" value="${esc(c.email)}"></div>
              <div class="ff"><label>계약 수주일</label><input id="ce-date-${c.id}" type="date" value="${esc(c.date)}"></div>
              <div class="ff" style="grid-column:span 3;"><label>특이사항</label><input id="ce-note-${c.id}" value="${esc(c.note)}"></div>
            </div>
            <div class="form-actions">
              <button class="btn" onclick="closePanel('${editPanelId}')">취소</button>
              <button class="btn btn-primary" onclick="saveClientEdit('${c.id}')"><i class="ti ti-device-floppy"></i>저장</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <span style="font-size:12.5px; font-weight:700; color:var(--tx-s);">품목 및 모델 리스트</span>
            <button class="btn btn-sm btn-primary" onclick="openProdAdd('${c.id}')"><i class="ti ti-plus"></i>제품 추가</button>
          </div>` : `
          <div style="margin-bottom:12px;">
            <span style="font-size:12px; font-weight:700; color:var(--tx-s);">납품 완료 품목 내역</span>
          </div>`}

          ${prods.length ? `
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>코드</th><th>제품/규격명</th><th>납기기한</th><th>수량</th><th>수주 단가</th><th>수주 합계</th>
                  <th>공정 단계 → 상태</th>
                  ${!isClosed ? '<th>관리 작업</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${prods.map(p => {
                  const sc = stageColor(p.processStage);
                  const mg = (typeof getProductMargin === 'function' && typeof bomList !== 'undefined' && bomList.length > 0)
                    ? getProductMargin(p.id) : null;
                  const marginBadge = mg && mg.cost > 0
                    ? '<span style="font-size:10px;margin-left:6px;color:' + (mg.marginRate > 0 ? 'var(--tx-ok)' : 'var(--tx-d)') + ';">원가 ' + fmtW(mg.cost) + (mg.marginRate !== null ? ' / 마진 ' + mg.marginRate + '%' : '') + '</span>'
                    : '';
                  return `
                    <tr${isClosed ? ' style="opacity:.75;"' : ''}>
                      <td>${esc(p.id)}</td>
                      <td style="font-weight:700;">${esc(p.name)}${marginBadge}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${esc(p.spec)||'규격 없음'}</span></td>
                      <td>${dayBadge(p.deliveryDate)}<span style="font-size:10.5px;display:block;color:var(--tx-t);">${esc(p.deliveryDate)}</span></td>
                      <td>${esc(p.qty)}${esc(p.unit)}</td>
                      <td class="amt-blue">${fmtW(p.price)}</td>
                      <td style="font-weight:700;color:var(--tx-i);">${fmtW(p.price*p.qty)}</td>
                      <td style="min-width:180px;">
                        ${isClosed ? `
                          <span class="bd" style="background:${sc}18;color:${sc};border-color:${sc}44;font-size:11px;">${esc(p.processStage)}</span>
                          <span style="font-size:10px;color:var(--tx-t);display:block;margin-top:2px;">→ ${esc(stageToStatus(p.processStage))}</span>
                        ` : `
                          <select class="stat-sel" style="border-color:${sc};color:${sc};" onchange="changeProdStage('${p.id}',this.value)">
                            ${processStages.map(s=>`<option${s===p.processStage?' selected':''}>${esc(s)}</option>`).join('')}
                          </select>
                          <div style="margin-top:3px;display:flex;align-items:center;gap:4px;">
                            <i class="ti ti-arrow-right" style="font-size:10px;color:var(--tx-t);"></i>
                            ${statusBadge(p.status)}
                          </div>
                        `}
                      </td>
                      ${!isClosed ? `
                      <td style="white-space:nowrap;">
                        <button class="edit-btn view-btn" onclick="navToMatForProduct('${p.id}')"><i class="ti ti-box"></i>자재</button>
                        <button class="edit-btn" onclick="openProdEdit('${c.id}','${p.id}')"><i class="ti ti-edit"></i>수정</button>
                        <button class="edit-btn" onclick="deleteProduct('${p.id}')" style="color:var(--tx-d);"><i class="ti ti-trash"></i>삭제</button>
                      </td>` : ''}
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : `<div class="empty" style="padding:16px;"><i class="ti ti-box"></i>등록된 제품이 없습니다.</div>`}
        </div>
      </div>
    `;
  }).join('');
}

/* ════════ [복구] 수주처 (clients) ════════ */
function toggleClient(id) {
  if (expandedClients.has(id)) expandedClients.delete(id);
  else expandedClients.add(id);
  renderClients();
}
function toggleClosedView() { showClosedProjects = !showClosedProjects; renderClients(); }
function openClientAdd() {
  inp('ca-modal').dataset.editId = '';
  inp('ca-modal-ttl').innerHTML = '<i class="ti ti-building-plus" style="color:var(--tx-i);"></i>신규 수주처 등록';
  inp('ca-id').value = nextCode('CL', clients);
  ['ca-name','ca-mgr','ca-tel','ca-email','ca-note'].forEach(x=>sv(x,''));
  sv('ca-date', today());
  inp('ca-modal').classList.add('open');
}
function saveClient() {
  if (!checkAdminAction()) return;
  const name = v('ca-name').trim();
  if (!name) { showToast('업체명은 필수입니다.', 'error'); return; }
  const editId = inp('ca-modal').dataset.editId;
  if (editId) {
    const c = clients.find(x => x.id === editId);
    if (c) { c.name = name; c.manager = v('ca-mgr'); c.tel = v('ca-tel'); c.email = v('ca-email'); c.date = v('ca-date') || today(); c.note = v('ca-note'); }
    saveStorage('clients', clients);
    closeModal('ca-modal');
    renderClients(); syncFilterDropdowns();
    showToast('수주처 정보가 수정되었습니다.');
  } else {
    clients.push({
      id: v('ca-id') || nextCode('CL', clients),
      name, manager: v('ca-mgr'), tel: v('ca-tel'), email: v('ca-email'),
      date: v('ca-date') || today(), note: v('ca-note'), closed: false
    });
    saveStorage('clients', clients);
    closeModal('ca-modal');
    renderClients(); syncFilterDropdowns();
    showToast('신규 수주처가 등록되었습니다.');
  }
}
function openClientEdit(id) {
  const c = clients.find(x => x.id === id); if (!c) return;
  inp('ca-modal').dataset.editId = id;
  inp('ca-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>수주처 정보 수정';
  sv('ca-id', c.id);
  sv('ca-name', c.name || ''); sv('ca-mgr', c.manager || ''); sv('ca-tel', c.tel || '');
  sv('ca-email', c.email || ''); sv('ca-date', c.date || today()); sv('ca-note', c.note || '');
  inp('ca-modal').classList.add('open');
}
function saveClientEdit(id) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  const name = (v('ce-name-'+id)||'').trim();
  if (!name) { showToast('업체명은 비울 수 없습니다.', 'error'); return; }
  c.name = name;
  c.manager = v('ce-mgr-'+id);
  c.tel = v('ce-tel-'+id);
  c.email = v('ce-email-'+id);
  c.date = v('ce-date-'+id);
  c.note = v('ce-note-'+id);
  saveStorage('clients', clients);
  renderClients(); syncFilterDropdowns();
  showToast('수주처 정보가 수정되었습니다.');
}
function closeProject(id, force) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  if (force && !confirm('진행 중인 제품이 있습니다. 강제로 종료하시겠습니까?')) return;
  c.closed = true; c.closedAt = today();
  saveStorage('clients', clients);
  renderClients();
  showToast('프로젝트가 종료 처리되었습니다.');
}
function reopenProject(id) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  c.closed = false; delete c.closedAt;
  saveStorage('clients', clients);
  renderClients();
  showToast('프로젝트가 재개되었습니다.');
}
function deleteClient(id) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  const prodCount = products.filter(p => p.clientId === id).length;
  if (!confirm("'" + c.name + "' 고객사를 삭제하시겠습니까?" + (prodCount ? ' 연결된 제품 ' + prodCount + '건도 함께 삭제됩니다.' : ''))) return;
  pushToTrash('client', c);
  products.filter(p => p.clientId === id).forEach(p => pushToTrash('product', p));
  products = products.filter(p => p.clientId !== id);
  clients = clients.filter(x => x.id !== id);
  saveStorage('clients', clients); saveStorage('products', products);
  renderClients(); syncFilterDropdowns();
  showToast('고객사가 휴지통으로 이동되었습니다.');
}
function exportClientsCSV() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['코드','업체명','담당자','연락처','이메일','수주일','상태','비고'];
  const rows = clients.map(c => [c.id, c.name, c.manager||'', c.tel||'', c.email||'', c.date||'', c.closed?'종료':'진행', c.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([h, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, '수주처');
  XLSX.writeFile(wb, '수주처_' + today() + '.xlsx');
  showToast('엑셀 저장 완료');
}

function toggleClosedView() {
  showClosedProjects = !showClosedProjects;
  renderClients();
}

/* ════════ [복구] 수주처 카드 드래그 정렬 ════════ */
function onClientDragStart(e, id) { draggedClientId = id; e.dataTransfer.effectAllowed = 'move'; }
function onClientDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onClientDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onClientDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedClientId || draggedClientId === targetId) return;
  const from = clients.findIndex(c => c.id === draggedClientId);
  const to = clients.findIndex(c => c.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = clients.splice(from, 1);
  clients.splice(to, 0, moved);
  saveStorage('clients', clients);
  renderClients();
}
function onClientDragEnd() {
  draggedClientId = null;
  document.querySelectorAll('.client-card.drag-over').forEach(c => c.classList.remove('drag-over'));
}

/* ════════ [복구] 제품 (products) ════════ */
function openProdAdd(clientId) {
  editProductId = null;
  const modal = inp('prod-modal');
  modal.dataset.clientId = clientId;
  inp('prod-modal-ttl').innerHTML = '<i class="ti ti-box" style="color:var(--tx-i);"></i>제품 등록 — ' + getClientName(clientId);
  inp('pra-save-txt').textContent = '등록';
  sv('pra-id', nextCode('PR', products));
  ['pra-name','pra-spec','pra-due','pra-note'].forEach(x=>sv(x,''));
  sv('pra-qty','1'); sv('pra-unit','대'); sv('pra-price','0');
  sv('pra-matcost','0'); sv('pra-laborcost','0'); sv('pra-ovhcost','0');
  inp('pra-stage').innerHTML = processStages.map(s=>'<option>'+s+'</option>').join('');
  onPraStageChange(); updateProdCostPreview();
  modal.classList.add('open');
}
function openProdEdit(clientId, productId) {
  const p = products.find(x => x.id === productId); if (!p) return;
  editProductId = productId;
  const modal = inp('prod-modal');
  modal.dataset.clientId = clientId;
  inp('prod-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>제품 수정 — ' + getClientName(clientId);
  inp('pra-save-txt').textContent = '수정 저장';
  inp('pra-stage').innerHTML = processStages.map(s=>'<option>'+s+'</option>').join('');
  sv('pra-id', p.id); sv('pra-name', p.name); sv('pra-spec', p.spec||'');
  sv('pra-due', p.deliveryDate||''); sv('pra-qty', p.qty); sv('pra-unit', p.unit||'대');
  sv('pra-price', p.price||'0'); sv('pra-stage', p.processStage); sv('pra-note', p.note||'');
  sv('pra-matcost', p.matCost||'0'); sv('pra-laborcost', p.laborCost||'0'); sv('pra-ovhcost', p.ovhCost||'0');
  onPraStageChange(); updateProdCostPreview();
  modal.classList.add('open');
}
function cloneProduct(clientId, productId) {
  if (!checkAdminAction()) return;
  const p = products.find(x => x.id === productId); if (!p) return;
  editProductId = null;
  const modal = inp('prod-modal');
  modal.dataset.clientId = clientId;
  inp('prod-modal-ttl').innerHTML = '<i class="ti ti-copy" style="color:var(--tx-i);"></i>제품 복제 등록 — ' + getClientName(clientId);
  inp('pra-save-txt').textContent = '신규 등록';
  inp('pra-stage').innerHTML = processStages.map(s=>'<option>'+s+'</option>').join('');
  sv('pra-id', nextCode('PR', products)); sv('pra-name', p.name); sv('pra-spec', p.spec||'');
  sv('pra-due', p.deliveryDate||''); sv('pra-qty', p.qty||1); sv('pra-unit', p.unit||'대');
  sv('pra-price', p.price||0); sv('pra-stage', processStages[0]||p.processStage); sv('pra-note', p.note||'');
  sv('pra-matcost', p.matCost||0); sv('pra-laborcost', p.laborCost||0); sv('pra-ovhcost', p.ovhCost||0);
  onPraStageChange(); updateProdCostPreview();
  modal.classList.add('open');
}
/* 제조원가 = 재료비+노무비+경비, 공헌이익 = 수주단가-제조원가 (단위 기준) */
function prodUnitCost(p){ return (Number(p.matCost)||0)+(Number(p.laborCost)||0)+(Number(p.ovhCost)||0); }
function updateProdCostPreview() {
  const box = inp('pra-cost-preview'); if (!box) return;
  const cost = (parseInt(v('pra-matcost'))||0)+(parseInt(v('pra-laborcost'))||0)+(parseInt(v('pra-ovhcost'))||0);
  const price = parseInt(v('pra-price'))||0;
  const margin = price - cost;
  const rate = price>0 ? Math.round(cost/price*1000)/10 : 0;
  box.innerHTML = `제조원가 <b>${fmtW(cost)}</b> · 원가율 <b style="color:${rate>90?'var(--tx-err)':'var(--tx-s)'};">${rate}%</b> · 공헌이익 <b style="color:${margin>=0?'var(--tx-ok)':'var(--tx-err)'};">${fmtW(margin)}</b>`;
}
function saveProdModal() {
  const clientId = inp('prod-modal').dataset.clientId;
  if (!clientId) { showToast('고객사 정보가 없습니다.', 'error'); return; }
  saveProdForm(clientId);
}
function saveProdForm(clientId) {
  if (editProductId) saveProdEdit(clientId, editProductId);
  else saveProd(clientId);
}
function saveProd(clientId) {
  if (!checkAdminAction()) return;
  const name = v('pra-name').trim();
  if (!name) { showToast('제품 품목명은 필수입니다.', 'error'); return; }
  const stage = v('pra-stage');
  products.push({
    id: nextCode('PR', products), clientId, name,
    spec: v('pra-spec'), qty: parseInt(v('pra-qty'))||1, unit: v('pra-unit')||'대',
    price: parseInt(v('pra-price'))||0, deliveryDate: v('pra-due'),
    matCost: parseInt(v('pra-matcost'))||0, laborCost: parseInt(v('pra-laborcost'))||0, ovhCost: parseInt(v('pra-ovhcost'))||0,
    processStage: stage, status: stageToStatus(stage), processMemo: '', note: v('pra-note')
  });
  saveStorage('products', products);
  closeModal('prod-modal');
  renderClients(); syncFilterDropdowns();
  showToast('신규 제품이 등록되었습니다.');
}
function saveProdEdit(clientId, productId) {
  if (!checkAdminAction()) return;
  const p = products.find(x => x.id === productId); if (!p) return;
  const name = v('pra-name').trim();
  if (!name) { showToast('제품 명칭은 비울 수 없습니다.', 'error'); return; }
  const stage = v('pra-stage');
  p.name = name; p.spec = v('pra-spec');
  p.qty = parseInt(v('pra-qty'))||1; p.unit = v('pra-unit')||'대';
  p.price = parseInt(v('pra-price'))||0; p.deliveryDate = v('pra-due');
  p.matCost = parseInt(v('pra-matcost'))||0; p.laborCost = parseInt(v('pra-laborcost'))||0; p.ovhCost = parseInt(v('pra-ovhcost'))||0;
  p.processStage = stage; p.status = stageToStatus(stage); p.note = v('pra-note');
  saveStorage('products', products);
  closeModal('prod-modal');
  renderClients(); syncFilterDropdowns();
  showToast('제품 정보가 수정되었습니다.');
}
function changeProdStage(productId, stage) {
  const p = products.find(x => x.id === productId); if (!p) return;
  p.processStage = stage; p.status = stageToStatus(stage);
  saveStorage('products', products);
  renderClients();
  if (typeof syncWorkOrdersOnProductComplete === 'function') syncWorkOrdersOnProductComplete(p);
}
function deleteProduct(id) {
  if (!checkAdminAction()) return;
  const p = products.find(x => x.id === id); if (!p) return;
  if (!confirm("'" + p.name + "' 제품을 삭제하시겠습니까?")) return;
  pushToTrash('product', p);
  products = products.filter(x => x.id !== id);
  saveStorage('products', products);
  renderClients(); syncFilterDropdowns();
  showToast('제품이 휴지통으로 이동되었습니다.');
}
function navToMatForProduct(productId) {
  const p = products.find(x => x.id === productId);
  go('materials');
  setTimeout(() => {
    if (p && inp('mat-fc')) { inp('mat-fc').value = p.clientId; onMatClientChange(); }
    if (inp('mat-fp')) inp('mat-fp').value = productId;
    renderMaterials();
  }, 120);
}

function showClient360(clientId) {
  var panel = document.getElementById('client-360-panel');
  var client = clients.find(function(c) { return c.id === clientId; });
  if (!panel || !client) return;
  var titleEl = document.getElementById('client-360-title');
  if (titleEl) titleEl.textContent = client.name + ' — 종합 현황';
  var wrapper = document.getElementById('client-360-wrapper');
  if (wrapper) wrapper.style.display = 'block';
  renderClient360(clientId);
}

function renderClient360(clientId) {
  var client = clients.find(function(c) { return c.id === clientId; });
  if (!client) return;
  var prods = products.filter(function(p) { return p.clientId === clientId; });
  var prodIds = prods.map(function(p) { return p.id; });
  var mats = materials.filter(function(m) { return prodIds.indexOf(m.productId) >= 0; });
  var dlvs = deliveries.filter(function(d) { return d.clientId === clientId; });
  var clms = claims.filter(function(c) { return c.clientId === clientId; });
  var ass = (typeof asList !== 'undefined') ? asList.filter(function(a) { return a.clientId === clientId; }) : [];
  var totalAmt = dlvs.reduce(function(s, d) { return s + (Number(d.totalAmt)||0); }, 0);
  var matAmt = mats.reduce(function(s, m) { return s + (Number(m.unitPrice)||0)*(Number(m.qty)||0); }, 0);
  var openClaim = clms.filter(function(c) { return c.status !== '완료'; }).length;
  var openAs = ass.filter(function(a) { return a.status !== '완료'; }).length;
  var activeProds = prods.filter(function(p) { return p.status !== '완료'; }).length;

  var cont = document.getElementById('client-360-panel');
  if (!cont) return;
  cont.innerHTML =
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-package"></i>진행 제품</div><div class="mc-val">' + activeProds + '건</div><div class="mc-sub">전체 ' + prods.length + '건</div></div>' +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-truck-delivery" style="color:var(--tx-ok);"></i>누적 납품</div><div class="mc-val" style="color:var(--tx-ok);">' + fmtW(totalAmt) + '</div><div class="mc-sub">' + dlvs.length + '회</div></div>' +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-truck-loading" style="color:var(--tx-i);"></i>자재 발주</div><div class="mc-val" style="color:var(--tx-i);">' + fmtW(matAmt) + '</div><div class="mc-sub">' + mats.length + '건</div></div>' +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-message-report" style="color:' + (openClaim>0?'var(--tx-d)':'var(--tx-t)') + ';"></i>클레임</div><div class="mc-val" style="color:' + (openClaim>0?'var(--tx-d)':'inherit') + ';">' + openClaim + '건 처리중</div><div class="mc-sub">전체 ' + clms.length + '건</div></div>' +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-tool" style="color:' + (openAs>0?'var(--tx-w)':'var(--tx-t)') + ';"></i>A/S</div><div class="mc-val">' + openAs + '건 진행중</div><div class="mc-sub">전체 ' + ass.length + '건</div></div>' +
    '</div>' +
    '<h4 style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--tx-s);">진행 중 제품</h4>' +
    '<table style="margin-bottom:16px;"><thead><tr><th>제품명</th><th>공정단계</th><th>납기일</th><th>D-Day</th><th>자재현황</th></tr></thead><tbody>' +
    prods.map(function(p) {
      var pMats = materials.filter(function(m) { return m.productId === p.id; });
      var done = pMats.filter(function(m) { return m.status === '입고완료'; }).length;
      var d = p.deliveryDate ? daysUntil(p.deliveryDate) : null;
      var sc = stageColor(p.processStage);
      return '<tr>' +
        '<td style="font-weight:700;">' + esc(p.name) + '</td>' +
        '<td><span class="bd" style="background:' + sc + '18;color:' + sc + ';border-color:' + sc + '44;">' + esc(p.processStage) + '</span></td>' +
        '<td>' + (esc(p.deliveryDate)||'—') + '</td>' +
        '<td>' + (d !== null ? dayBadge(p.deliveryDate) : '—') + '</td>' +
        '<td>' + (pMats.length > 0 ? done + '/' + pMats.length + '건 입고' : '—') + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>' +
    (clms.length > 0
      ? '<h4 style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--tx-s);">클레임 이력</h4>' +
        '<table><thead><tr><th>일자</th><th>내용</th><th>상태</th></tr></thead><tbody>' +
        clms.map(function(c) {
          return '<tr><td>' + esc(c.date) + '</td><td style="font-size:11px;">' + esc((c.content||'').substring(0,60)) + '</td><td>' + statusBadge(c.status) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '');
}
