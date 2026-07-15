/* ════════ 2. 수주 및 제품 등록 관리 (드래그 앤 드롭 지원!) ════════ */
function productCostInfoAllowed() {
  if (typeof canViewCostInfo === 'function') return canViewCostInfo();
  const role = (typeof currentRole !== 'undefined' && currentRole) || localStorage.getItem('mes_myRole') || 'staff';
  return role === 'admin' || role === 'manager';
}
function renderClients() {
  const showCostInfo = productCostInfoAllowed();
  const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const totAmt = visibleProducts.reduce((s, p) => s + (p.price * p.qty), 0);
  const activeClients = visibleClients.filter(c => !c.closed);
  const closedClients = visibleClients.filter(c => c.closed);

  const liveOps = visibleProducts.filter(p => p.status === '생산중' && !visibleClients.find(c => c.id === p.clientId)?.closed).length;
  // 공통 kpiCardHtml(표준 mc 카드)로 통일. (#client-summary 는 .sum-row 4열 그리드)
  inp('client-summary').innerHTML =
    kpiCardHtml({ label: '진행 고객사', value: activeClients.length, tone: 'info', icon: 'ti-building-community' }) +
    kpiCardHtml({ label: '종료 프로젝트', value: closedClients.length, tone: 'neutral', icon: 'ti-archive' }) +
    kpiCardHtml({ label: '실시간 조업', value: liveOps, tone: 'warn', icon: 'ti-loader' }) +
    kpiCardHtml({ label: '전체 수주 총계', value: fmtW(totAmt), tone: 'info', icon: 'ti-coin' });

  // 종료 보기 모드에서는 종료된 고객사만, 아니면 진행 중만
  const _cq = (v('clients-q')||'').toLowerCase();
  const viewList = (showClosedProjects ? closedClients : activeClients)
    .filter(c => {
      if (!_cq) return true;
      if ([c.name, c.manager||'', c.tel||'', c.note||''].join(' ').toLowerCase().includes(_cq)) return true;
      const prods = visibleProducts.filter(p => p.clientId === c.id);
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
    const prods  = visibleProducts.filter(p => p.clientId === c.id);
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
            <div style="font-size:11.5px; color:var(--tx-t); font-weight:500;">거래처코드: ${esc(c.id)} · 담당: ${esc(c.manager)||'미지정'} · 연락처: ${esc(c.tel)||'미지정'} · 제품: ${prods.length}종</div>
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
              <button class="btn btn-sm" onclick="openClientEdit('${c.id}')" title="고객사 정보 수정"><i class="ti ti-edit"></i>수정</button>
              <button class="btn btn-sm btn-danger" onclick="deleteClient('${c.id}')" title="고객사 삭제"><i class="ti ti-trash"></i></button>`}
          </div>
          <i class="ti ${isExp ? 'ti-chevron-up' : 'ti-chevron-down'}" style="color:var(--tx-t); font-size:16px; margin-left:12px;"></i>
        </div>

        <div class="client-body ${isExp ? 'open' : ''}">
          ${!isClosed ? `
          <!-- 업체 수정 패널 -->
          <div class="add-panel edit-mode" id="${editPanelId}">
            <div class="panel-ttl clr-edit"><i class="ti ti-edit"></i>${esc(c.name)} 프로필 수정</div>
            <div class="fg fg4">
              <div class="ff"><label>고객사명 *</label><input id="ce-name-${c.id}" value="${esc(c.name)}"></div>
              <div class="ff"><label>실무자명</label><input id="ce-mgr-${c.id}" value="${esc(c.manager)}"></div>
              <div class="ff"><label>전화번호</label><input id="ce-tel-${c.id}" value="${esc(c.tel)}"></div>
              <div class="ff"><label>이메일</label><input id="ce-email-${c.id}" value="${esc(c.email)}"></div>
              <div class="ff"><label>사업자번호</label><input id="ce-bizno-${c.id}" value="${esc(c.bizNo||'')}"></div>
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
                  const mg = (showCostInfo && typeof getProductMargin === 'function' && typeof bomList !== 'undefined' && bomList.length > 0)
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
                          ${readonlyStatusCellHtml(p.processStage, processStages, `changeProdStage('${p.id}',this.value)`)}
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

/* ════════ [복구] 고객사 (clients) ════════ */
function toggleClient(id) {
  if (expandedClients.has(id)) expandedClients.delete(id);
  else expandedClients.add(id);
  renderClients();
}
function toggleClosedView() { showClosedProjects = !showClosedProjects; renderClients(); }
function _clientRegisterText(c) {
  return [c.name || '', c.id || '', c.manager || '', c.tel || '', c.email || '', c.bizNo || ''].join(' ').toLowerCase();
}
function _clientRegisterMatches(query) {
  if (typeof _clientSearchCandidates === 'function') return _clientSearchCandidates(query, 8, false);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const source = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  return source.filter(c => _clientRegisterText(c).includes(q)).slice(0, 6);
}
function hideClientRegisterMatches() {
  const box = inp('ca-client-results');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}
function renderClientRegisterMatches() {
  const modal = inp('ca-modal');
  const box = inp('ca-client-results');
  if (!box || (modal && modal.dataset.editId)) return;
  const q = v('ca-name').trim();
  const rows = _clientRegisterMatches(q);
  if (!q || !rows.length) { hideClientRegisterMatches(); return; }
  box.innerHTML = rows.map(c => `
    <button type="button" class="inline-search-item" onmousedown="setClientRegisterSelection('${esc(c.id)}')">
      <strong>${esc(c.name || c.id)}</strong>
      <span>${esc(c.id)} · 담당 ${esc(c.manager || '미지정')} · ${esc(c.tel || c.email || '연락처 미지정')}</span>
    </button>
  `).join('');
  box.style.display = 'block';
}
function onClientRegisterNameInput() {
  const modal = inp('ca-modal');
  const selectedId = modal && modal.dataset.existingId;
  if (selectedId) {
    const selected = clients.find(c => c.id === selectedId);
    if (!selected || v('ca-name').trim() !== (selected.name || '').trim()) {
      delete modal.dataset.existingId;
      sv('ca-id', nextCode('BP', partners));
      ['ca-mgr','ca-tel','ca-email','ca-bizno','ca-note'].forEach(x=>sv(x,''));
      sv('ca-date', today());
    }
  }
  renderClientRegisterMatches();
}
function onClientRegisterNameKey(e) {
  if (e.key === 'Escape') { hideClientRegisterMatches(); return; }
  if (e.key !== 'Enter') return;
  const first = _clientRegisterMatches(v('ca-name'))[0];
  if (first) {
    e.preventDefault();
    setClientRegisterSelection(first.id);
  }
}
function openClientRegisterPicker() {
  openClientPicker(function(c){
    setClientRegisterSelection(c.id);
    hideClientRegisterMatches();
  }, { mode:'client-register', initialQuery:v('ca-name') });
}
function setClientRegisterSelection(clientId) {
  const modal = inp('ca-modal');
  if (!clientId) {
    delete modal.dataset.existingId;
    sv('ca-id', nextCode('BP', partners));
    ['ca-name','ca-mgr','ca-tel','ca-email','ca-bizno','ca-note'].forEach(x=>sv(x,''));
    sv('ca-date', today());
    hideClientRegisterMatches();
    return;
  }
  const c = typeof ensureClientFromAnyPartner === 'function'
    ? ensureClientFromAnyPartner(clientId)
    : clients.find(x => x.id === clientId);
  if (!c) return;
  modal.dataset.existingId = c.id;
  sv('ca-id', c.id);
  sv('ca-name', c.name || '');
  sv('ca-mgr', c.manager || '');
  sv('ca-tel', c.tel || '');
  sv('ca-email', c.email || '');
  sv('ca-bizno', c.bizNo || '');
  sv('ca-date', c.date || today());
  sv('ca-note', c.note || '');
  hideClientRegisterMatches();
}
function openClientAdd() {
  if (typeof requireCreateAction === 'function' && !requireCreateAction('clients', '고객사 등록')) return;
  const modal = inp('ca-modal');
  modal.dataset.editId = '';
  delete modal.dataset.existingId;
  inp('ca-modal-ttl').innerHTML = '<i class="ti ti-building-plus" style="color:var(--tx-i);"></i>신규 고객사 등록';
  const searchBtn = inp('ca-client-search-btn'); if (searchBtn) searchBtn.style.display = '';
  setClientRegisterSelection('');
  modal.classList.add('open');
}
function saveClient() {
  if (!checkAdminAction()) return;
  const name = v('ca-name').trim();
  if (!name) { showToast('고객사명은 필수입니다.', 'error'); return; }
  const modal = inp('ca-modal');
  const editId = modal.dataset.editId;
  let existingId = modal.dataset.existingId;
  if (!editId && !existingId) {
    const exact = clients.find(c => String(c.name || '').trim().toLowerCase() === name.toLowerCase());
    if (exact) existingId = exact.id;
  }
  if (!editId && !existingId && typeof requireCreateAction === 'function' && !requireCreateAction('clients', '고객사 등록')) return;
  if (editId) {
    const c = clients.find(x => x.id === editId);
    let syncedCount = 0;
    if (c) {
      const before = _safeJsonClone(c);
      if (!requireRecordPermission('edit', c, 'clients')) return;
      c.name = name; c.manager = v('ca-mgr'); c.tel = v('ca-tel'); c.email = v('ca-email');
      c.bizNo = v('ca-bizno'); c.date = v('ca-date') || today(); c.note = v('ca-note');
      stampRecordUpdate(c, before, 'clients', { visibility:'company' });
      writeAuditLog('clients', c.id, 'update', before, c, { summary:'고객사 정보 수정' });
      if (typeof syncPartnerFromClient === 'function') syncPartnerFromClient(c);
      if (typeof syncCustomerDocumentReferences === 'function') syncedCount = syncCustomerDocumentReferences(before, c);
    }
    saveStorage('clients', clients);
    saveStorage('partners', partners);
    closeModal('ca-modal');
    renderClients(); syncFilterDropdowns();
    showToast(`고객사 정보가 수정되었습니다.${syncedCount ? ` 연결 문서 ${syncedCount}건 반영` : ''}`);
  } else if (existingId) {
    const c = clients.find(x => x.id === existingId);
    if (!c) { showToast('선택한 고객사를 찾을 수 없습니다.', 'error'); return; }
    const before = _safeJsonClone(c);
    let syncedCount = 0;
    if (!requireRecordPermission('edit', c, 'clients')) return;
    c.name = name; c.manager = v('ca-mgr'); c.tel = v('ca-tel'); c.email = v('ca-email');
    c.bizNo = v('ca-bizno'); c.date = v('ca-date') || c.date || today(); c.note = v('ca-note');
    c.closed = false; delete c.closedAt;
    stampRecordUpdate(c, before, 'clients', { visibility:'company' });
    writeAuditLog('clients', c.id, 'update', before, c, { summary:'기존 고객사 연결/재개' });
    if (typeof syncPartnerFromClient === 'function') syncPartnerFromClient(c);
    if (typeof syncCustomerDocumentReferences === 'function') syncedCount = syncCustomerDocumentReferences(before, c);
    saveStorage('clients', clients);
    saveStorage('partners', partners);
    closeModal('ca-modal');
    expandedClients.add(c.id);
    renderClients(); syncFilterDropdowns();
    if (typeof consumeClientPickerCreatedClient === 'function') consumeClientPickerCreatedClient(c);
    showToast(`기존 고객사가 수주 정보에 연결되었습니다.${syncedCount ? ` 연결 문서 ${syncedCount}건 반영` : ''} 제품 추가로 수주 품목을 등록하세요.`);
  } else {
    const createdClient = {
      id: v('ca-id') || nextCode('BP', partners),
      name, manager: v('ca-mgr'), tel: v('ca-tel'), email: v('ca-email'),
      bizNo: v('ca-bizno'), date: v('ca-date') || today(), note: v('ca-note'), closed: false
    };
    stampRecordCreate(createdClient, 'clients', { visibility:'company' });
    clients.push(createdClient);
    writeAuditLog('clients', createdClient.id, 'create', null, createdClient, { summary:'고객사 등록' });
    if (typeof syncPartnerFromClient === 'function') syncPartnerFromClient(createdClient);
    saveStorage('clients', clients);
    saveStorage('partners', partners);
    closeModal('ca-modal');
    expandedClients.add(createdClient.id);
    renderClients(); syncFilterDropdowns();
    if (typeof consumeClientPickerCreatedClient === 'function') consumeClientPickerCreatedClient(createdClient);
    showToast('신규 고객사가 등록되었습니다.');
  }
}
function openClientEdit(id) {
  const c = clients.find(x => x.id === id); if (!c) return;
  if (!requireRecordPermission('edit', c, 'clients')) return;
  const searchBtn = inp('ca-client-search-btn'); if (searchBtn) searchBtn.style.display = 'none';
  hideClientRegisterMatches();
  inp('ca-modal').dataset.editId = id;
  delete inp('ca-modal').dataset.existingId;
  inp('ca-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>고객사 정보 수정';
  sv('ca-id', c.id);
  sv('ca-name', c.name || ''); sv('ca-mgr', c.manager || ''); sv('ca-tel', c.tel || '');
  sv('ca-email', c.email || ''); sv('ca-bizno', c.bizNo || ''); sv('ca-date', c.date || today()); sv('ca-note', c.note || '');
  inp('ca-modal').classList.add('open');
}
function saveClientEdit(id) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  const name = (v('ce-name-'+id)||'').trim();
  if (!name) { showToast('업체명은 비울 수 없습니다.', 'error'); return; }
  if (!requireRecordPermission('edit', c, 'clients')) return;
  const before = _safeJsonClone(c);
  c.name = name;
  c.manager = v('ce-mgr-'+id);
  c.tel = v('ce-tel-'+id);
  c.email = v('ce-email-'+id);
  c.bizNo = v('ce-bizno-'+id);
  c.date = v('ce-date-'+id);
  c.note = v('ce-note-'+id);
  stampRecordUpdate(c, before, 'clients', { visibility:'company' });
  writeAuditLog('clients', c.id, 'update', before, c, { summary:'고객사 인라인 수정' });
  if (typeof syncPartnerFromClient === 'function') syncPartnerFromClient(c);
  const syncedCount = typeof syncCustomerDocumentReferences === 'function' ? syncCustomerDocumentReferences(before, c) : 0;
  saveStorage('clients', clients);
  saveStorage('partners', partners);
  renderClients(); syncFilterDropdowns();
  showToast(`고객사 정보가 수정되었습니다.${syncedCount ? ` 연결 문서 ${syncedCount}건 반영` : ''}`);
}
function closeProject(id, force) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  if (!requireRecordPermission('edit', c, 'clients')) return;
  const before = _safeJsonClone(c);
  if (force && !confirm('진행 중인 제품이 있습니다. 강제로 종료하시겠습니까?')) return;
  c.closed = true; c.closedAt = today();
  stampRecordUpdate(c, before, 'clients', { visibility:'company' });
  writeAuditLog('clients', c.id, 'statusChange', before, c, { summary:'고객사 프로젝트 종료' });
  saveStorage('clients', clients);
  renderClients();
  showToast('프로젝트가 종료 처리되었습니다.');
}
function reopenProject(id) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  if (!requireRecordPermission('edit', c, 'clients')) return;
  const before = _safeJsonClone(c);
  c.closed = false; delete c.closedAt;
  stampRecordUpdate(c, before, 'clients', { visibility:'company' });
  writeAuditLog('clients', c.id, 'restore', before, c, { summary:'고객사 프로젝트 재개' });
  saveStorage('clients', clients);
  renderClients();
  showToast('프로젝트가 재개되었습니다.');
}
function deleteClient(id) {
  if (!checkAdminAction()) return;
  const c = clients.find(x => x.id === id); if (!c) return;
  if (!requireRecordPermission('delete', c, 'clients')) return;
  const linkedProducts = products.filter(p => p.clientId === id);
  const blockedProduct = linkedProducts.find(p => typeof canDeleteRecord === 'function' && !canDeleteRecord(p, 'products'));
  if (blockedProduct) { showToast('연결된 제품 중 삭제 권한이 없는 항목이 있어 고객사를 삭제할 수 없습니다.', 'error'); return; }
  const prodCount = linkedProducts.length;
  if (!confirm("'" + c.name + "' 고객사를 삭제하시겠습니까?" + (prodCount ? ' 연결된 제품 ' + prodCount + '건도 함께 삭제됩니다.' : ''))) return;
  const linkedPartner = Array.isArray(partners)
    ? partners.find(p => p && p.id === id && (typeof _isCustomerPartner !== 'function' || _isCustomerPartner(p)))
    : null;
  pushToTrash('client', c);
  if (linkedPartner) pushToTrash('partner', linkedPartner);
  linkedProducts.forEach(p => pushToTrash('product', p));
  linkedProducts.forEach(p => writeAuditLog('products', p.id, 'delete', p, null, { summary:'고객사 삭제에 따른 제품 이동' }));
  if (linkedPartner) writeAuditLog('partners', id, 'delete', linkedPartner, null, { summary:'고객사 삭제에 따른 거래처 이동' });
  if (typeof cloudRememberDeletedArrayRecord === 'function') {
    cloudRememberDeletedArrayRecord('clients', c);
    if (linkedPartner) cloudRememberDeletedArrayRecord('partners', linkedPartner);
    linkedProducts.forEach(p => cloudRememberDeletedArrayRecord('products', p));
  }
  products = products.filter(p => p.clientId !== id);
  if (linkedPartner) partners = partners.filter(p => p.id !== id);
  clients = clients.filter(x => x.id !== id);
  writeAuditLog('clients', id, 'delete', c, null, { summary:'고객사 삭제', detail:`연결 제품 ${prodCount}건` });
  saveStorage('clients', clients); saveStorage('products', products);
  if (linkedPartner) saveStorage('partners', partners);
  if (typeof cloudDeleteArrayRecordNow === 'function') {
    cloudDeleteArrayRecordNow('clients', c).catch(e => console.warn('client cloud delete failed:', e));
    if (linkedPartner) cloudDeleteArrayRecordNow('partners', linkedPartner).catch(e => console.warn('partner cloud delete failed:', e));
    linkedProducts.forEach(p => cloudDeleteArrayRecordNow('products', p).catch(e => console.warn('product cloud delete failed:', e)));
  }
  if (typeof cloudFlushSoon === 'function') cloudFlushSoon();
  renderClients(); syncFilterDropdowns();
  if (document.getElementById('pg-partners')?.classList.contains('active') && typeof renderPartners === 'function') renderPartners();
  showToast('고객사가 휴지통으로 이동되었습니다.');
}
function exportClientsCSV() {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('고객사 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['거래처코드','고객사명','담당자','연락처','이메일','사업자번호','수주일','상태','비고'];
  const source = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const rows = source.map(c => [c.id, c.name, c.manager||'', c.tel||'', c.email||'', c.bizNo||'', c.date||'', c.closed?'종료':'진행', c.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([h, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, '고객사');
  XLSX.writeFile(wb, '고객사_' + today() + '.xlsx');
  showToast('엑셀 저장 완료');
}

function toggleClosedView() {
  showClosedProjects = !showClosedProjects;
  renderClients();
}

/* ════════ [복구] 고객사 카드 드래그 정렬 ════════ */
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
function syncProductCostVisibility() {
  const show = productCostInfoAllowed();
  ['pra-matcost','pra-laborcost','pra-ovhcost','pra-cost-preview'].forEach(id => {
    const el = inp(id);
    if (!el) return;
    const holder = el.closest ? (el.closest('.ff') || el) : el;
    holder.style.display = show ? '' : 'none';
  });
  if (!show) {
    const preview = inp('pra-cost-preview');
    if (preview) preview.innerHTML = '';
  }
}
function readProductCostFields(base = null) {
  if (!productCostInfoAllowed()) {
    return {
      matCost: Number(base && base.matCost) || 0,
      laborCost: Number(base && base.laborCost) || 0,
      ovhCost: Number(base && base.ovhCost) || 0
    };
  }
  return {
    matCost: parseInt(v('pra-matcost')) || 0,
    laborCost: parseInt(v('pra-laborcost')) || 0,
    ovhCost: parseInt(v('pra-ovhcost')) || 0
  };
}
function openProdAdd(clientId) {
  if (typeof requireCreateAction === 'function' && !requireCreateAction('clients', '제품 등록')) return;
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
  syncProductCostVisibility(); onPraStageChange(); updateProdCostPreview();
  modal.classList.add('open');
}
function openProdEdit(clientId, productId) {
  const p = products.find(x => x.id === productId); if (!p) return;
  if (!requireRecordPermission('edit', p, 'products')) return;
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
  syncProductCostVisibility(); onPraStageChange(); updateProdCostPreview();
  modal.classList.add('open');
}
function cloneProduct(clientId, productId) {
  if (!checkAdminAction()) return;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('clients', '제품 등록')) return;
  const p = products.find(x => x.id === productId); if (!p) return;
  if (typeof canViewRecord === 'function' && !canViewRecord(p, 'products')) return;
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
  syncProductCostVisibility(); onPraStageChange(); updateProdCostPreview();
  modal.classList.add('open');
}
/* 제조원가 = 재료비+노무비+경비, 공헌이익 = 수주단가-제조원가 (단위 기준) */
function prodMaterialCost(p){
  if (!p) return 0;
  if (typeof bomFor === 'function' && typeof bomMaterialCost === 'function' && bomFor(p.id).length) {
    return bomMaterialCost(p.id);
  }
  return Number(p.matCost) || 0;
}
function prodUnitCost(p){ return prodMaterialCost(p)+(Number(p.laborCost)||0)+(Number(p.ovhCost)||0); }
function updateProdCostPreview() {
  const box = inp('pra-cost-preview'); if (!box) return;
  if (!productCostInfoAllowed()) { box.innerHTML = ''; return; }
  const cost = (parseInt(v('pra-matcost'))||0)+(parseInt(v('pra-laborcost'))||0)+(parseInt(v('pra-ovhcost'))||0);
  const price = parseInt(v('pra-price'))||0;
  const margin = price - cost;
  const rate = price>0 ? Math.round(cost/price*1000)/10 : 0;
  box.innerHTML = `
    <span><em>제조원가</em><b>${fmtW(cost)}</b></span>
    <span><em>원가율</em><b style="color:${rate>90?'var(--tx-d)':'var(--tx-s)'};">${rate}%</b></span>
    <span><em>공헌이익</em><b style="color:${margin>=0?'var(--tx-ok)':'var(--tx-d)'};">${fmtW(margin)}</b></span>`;
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
  if (typeof requireCreateAction === 'function' && !requireCreateAction('clients', '제품 등록')) return;
  const name = v('pra-name').trim();
  if (!name) { showToast('제품 품목명은 필수입니다.', 'error'); return; }
  const stage = v('pra-stage');
  if (stage === '납품' && typeof guardFinanceMonth === 'function' && !guardFinanceMonth(today())) return;
  const costFields = readProductCostFields();
  const product = stampRecordCreate({
    id: nextCode('PR', products), clientId, name,
    spec: v('pra-spec'), qty: parseInt(v('pra-qty'))||1, unit: v('pra-unit')||'대',
    price: parseInt(v('pra-price'))||0, deliveryDate: v('pra-due'),
    matCost: costFields.matCost, laborCost: costFields.laborCost, ovhCost: costFields.ovhCost,
    processStage: stage, status: stageToStatus(stage), processMemo: '', note: v('pra-note')
  }, 'products', { visibility:'company' });
  products.push(product);
  if (product.processStage === '납품' && typeof onStageDelivered === 'function' && !onStageDelivered(product)) return;
  writeAuditLog('products', product.id, 'create', null, product, { summary:'제품 등록' });
  saveStorage('products', products);
  closeModal('prod-modal');
  renderClients(); syncFilterDropdowns();
  showToast('신규 제품이 등록되었습니다.');
}
function saveProdEdit(clientId, productId) {
  if (!checkAdminAction()) return;
  const p = products.find(x => x.id === productId); if (!p) return;
  if (!requireRecordPermission('edit', p, 'products')) return;
  const name = v('pra-name').trim();
  if (!name) { showToast('제품 명칭은 비울 수 없습니다.', 'error'); return; }
  const before = _safeJsonClone(p);
  const stage = v('pra-stage');
  if ((before.processStage === '납품' || stage === '납품') && typeof guardFinanceMonth === 'function') {
    const linkedDelivery = typeof deliveryRecordForProduct === 'function' ? deliveryRecordForProduct(productId) : null;
    if (!guardFinanceMonth(linkedDelivery?.deliveredAt || today())) return;
  }
  // 납품 → 다른 단계: 자동 등록됐던 납품 기록도 함께 되돌린다(제품을 바꾸기 전에 확인).
  if (before.processStage === '납품' && stage !== '납품' && typeof onStageUndelivered === 'function' && !onStageUndelivered(p)) return;
  const costFields = readProductCostFields(p);
  p.name = name; p.spec = v('pra-spec');
  p.qty = parseInt(v('pra-qty'))||1; p.unit = v('pra-unit')||'대';
  p.price = parseInt(v('pra-price'))||0; p.deliveryDate = v('pra-due');
  p.matCost = costFields.matCost; p.laborCost = costFields.laborCost; p.ovhCost = costFields.ovhCost;
  p.processStage = stage; p.status = stageToStatus(stage); p.note = v('pra-note');
  if (p.processStage === '완료' && before.processStage !== '완료' && typeof onStageComplete === 'function') onStageComplete(p);
  if (p.processStage === '납품' && typeof onStageDelivered === 'function' && !onStageDelivered(p)) return;
  stampRecordUpdate(p, before, 'products', { visibility:'company' });
  writeAuditLog('products', productId, 'update', before, p, { summary:'제품 정보 수정' });
  saveStorage('products', products);
  closeModal('prod-modal');
  renderClients(); syncFilterDropdowns();
  showToast('제품 정보가 수정되었습니다.');
}
function changeProdStage(productId, stage) {
  const p = products.find(x => x.id === productId); if (!p) return;
  if (!roleFeatureAllowed('status') || !requireRecordPermission('edit', p, 'products')) return;
  if (stage === '납품' && p.processStage !== '납품' && typeof guardFinanceMonth === 'function') {
    const linkedDelivery = typeof deliveryRecordForProduct === 'function' ? deliveryRecordForProduct(productId) : null;
    if (!guardFinanceMonth(linkedDelivery?.deliveredAt || today())) return;
  }
  // 납품 → 다른 단계: 자동 등록됐던 납품 기록도 함께 되돌린다(제품을 바꾸기 전에 확인해 실패 시 단계 유지).
  if (p.processStage === '납품' && stage !== '납품' && typeof onStageUndelivered === 'function' && !onStageUndelivered(p)) return;
  const before = _safeJsonClone(p);
  p.processStage = stage; p.status = stageToStatus(stage);
  if (p.processStage === '완료' && before.processStage !== '완료' && typeof onStageComplete === 'function') onStageComplete(p);
  if (p.processStage === '납품' && before.processStage !== '납품' && typeof onStageDelivered === 'function' && !onStageDelivered(p)) return;
  stampRecordUpdate(p, before, 'products', { visibility:'company' });
  writeAuditLog('products', productId, 'statusChange', before, p, { summary:`제품 공정 단계 변경: ${before.processStage || ''} → ${stage}` });
  saveStorage('products', products);
  renderClients();
}
function deleteProduct(id) {
  if (!checkAdminAction()) return;
  const p = products.find(x => x.id === id); if (!p) return;
  if (!requireRecordPermission('delete', p, 'products')) return;
  const linkedDelivery = typeof deliveryRecordForProduct === 'function' ? deliveryRecordForProduct(id) : null;
  if (linkedDelivery && typeof guardFinanceMonth === 'function' && !guardFinanceMonth(linkedDelivery.deliveredAt || today())) return;
  if (!confirm("'" + p.name + "' 제품을 삭제하시겠습니까?")) return;
  pushToTrash('product', p);
  products = products.filter(x => x.id !== id);
  if (linkedDelivery) {
    deliveries = deliveries.filter(d => d.id !== linkedDelivery.id);
    if (financeData && financeData.paidReceivable) delete financeData.paidReceivable[linkedDelivery.id];
    writeAuditLog('delivery', linkedDelivery.id, 'delete', linkedDelivery, null, { summary:'제품 삭제에 따른 납품 기록 삭제' });
    saveStorage('deliveries', deliveries);
    if (financeData) saveStorage('financeData', financeData);
    if (typeof updateDlvBadge === 'function') updateDlvBadge();
  }
  writeAuditLog('products', id, 'delete', p, null, { summary:'제품 삭제' });
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
  var visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  var visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  var visibleMaterials = typeof visibleRecords === 'function' ? visibleRecords(materials, 'material') : materials;
  var visibleDeliveries = typeof visibleRecords === 'function' ? visibleRecords(deliveries, 'delivery') : deliveries;
  var visibleClaims = typeof visibleRecords === 'function' ? visibleRecords(claims, 'claim') : claims;
  var visibleAs = (typeof asList !== 'undefined') ? (typeof visibleRecords === 'function' ? visibleRecords(asList, 'as') : asList) : [];
  var client = visibleClients.find(function(c) { return c.id === clientId; });
  if (!client) return;
  var prods = visibleProducts.filter(function(p) { return p.clientId === clientId; });
  var prodIds = prods.map(function(p) { return p.id; });
  var mats = visibleMaterials.filter(function(m) { return prodIds.indexOf(m.productId) >= 0; });
  var dlvs = visibleDeliveries.filter(function(d) { return d.clientId === clientId; });
  var clms = visibleClaims.filter(function(c) { return c.clientId === clientId; });
  var ass = visibleAs.filter(function(a) { return a.clientId === clientId; });
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
      var pMats = visibleMaterials.filter(function(m) { return m.productId === p.id; });
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
