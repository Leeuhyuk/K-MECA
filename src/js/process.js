/* ════════ 5. 실시간 공정 관리 ════════ */

/* 공정 단계 → 상태 자동 파생 (중복 제거) */
function stageToStatus(stage) {
  if (!stage) return '견적';
  if (stage === '설계/도면') return '설계중';
  if (stage === '자재발주') return '자재준비';
  if (stage === '완료')    return '완료';
  if (stage === '납품')    return '납품';
  return '생산중';
}

/* 상태 → 공정 단계 역방향 매핑 */
function statusToStage(status, currentStage) {
  if (status === '설계중')   return '설계/도면';
  if (status === '자재준비') return '자재발주';
  if (status === '완료')    return '완료';
  if (status === '납품')    return '납품';
  if (status === '견적')    return processStages[0] || '설계/도면';
  if (status === '생산중') {
    const prodStages = processStages.filter(s => !['설계/도면','자재발주','완료','납품'].includes(s));
    return prodStages.includes(currentStage) ? currentStage : (prodStages[0] || '가공/제작');
  }
  return currentStage || processStages[0];
}

let procStageFilter = null; // 파이프라인 클릭 필터

function renderProcess() {
  const fc = v('proc-fc');
  fillClientSelect('proc-fc', true);
  // select 값 복원 (fillClientSelect 가 초기화하므로)
  setTimeout(() => { sv('proc-fc', fc); }, 0);
  inp('stage-input').value = processStages.join(', ');

  const all = products.filter(p => !fc || p.clientId === fc);
  const total    = all.length;
  const inProg   = all.filter(p => !['완료','납품','설계/도면'].includes(p.processStage)).length;
  const done     = all.filter(p => ['완료','납품'].includes(p.processStage)).length;
  const nearDue  = all.filter(p => p.deliveryDate && daysUntil(p.deliveryDate) <= 14 && !['완료','납품'].includes(p.processStage)).length;
  const matWait  = materials.filter(m => m.status === '발주전' && all.some(p => p.id === m.productId)).length;

  inp('proc-kpi').innerHTML = `
    <div class="mc"><div class="mc-lbl"><i class="ti ti-box"></i>전체 제품</div>
      <div class="mc-val">${total}건</div>
      <div style="height:4px; background:var(--bg-t); border-radius:2px; margin-top:6px; overflow:hidden;">
        <div style="height:100%; width:${total?Math.round(done/total*100):0}%; background:#37b24d; border-radius:2px;"></div>
      </div>
      <div class="mc-sub">완료 ${done}건 (${total?Math.round(done/total*100):0}%)</div>
    </div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-loader" style="color:var(--tx-i);"></i>제조 진행 중</div><div class="mc-val" style="color:var(--tx-i);">${inProg}건</div><div class="mc-sub">가공·조립·검사 단계</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-calendar-due" style="color:${nearDue?'var(--tx-d)':'var(--tx-ok)'};"></i>14일 이내 납기</div><div class="mc-val" style="color:${nearDue?'var(--tx-d)':'var(--tx-ok)'};">${nearDue}건</div><div class="mc-sub">${nearDue?'즉시 점검 필요':'여유 있음'}</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-circle-dashed" style="color:${matWait?'var(--tx-w)':'var(--tx-ok)'};"></i>미발주 자재</div><div class="mc-val" style="color:${matWait?'var(--tx-w)':'var(--tx-ok)'};">${matWait}건</div><div class="mc-sub">발주 대기 중</div></div>`;

  renderPipeline(all);
  renderKanban();
  renderProcDetail();
  applyProcView();
}

let procView = 'list'; // 'list' | 'kanban'
function setProcView(v) { procView = v; applyProcView(); }
function applyProcView() {
  const kanban = inp('kanban-board');
  const listCard = inp('proc-list-card');
  const listTable = inp('proc-detail-table');
  const icon = inp('proc-table-icon');
  if (kanban)   kanban.style.display   = (procView === 'kanban') ? '' : 'none';
  if (listCard) listCard.style.display = (procView === 'list')   ? '' : 'none';
  // 목록 보기에서는 표를 항상 펼친 상태로
  if (procView === 'list' && listTable) { listTable.style.display = 'block'; if (icon) icon.style.transform = 'rotate(180deg)'; }
  const lb = inp('proc-view-list'), kb = inp('proc-view-kanban');
  if (lb) lb.classList.toggle('btn-primary', procView === 'list');
  if (kb) kb.classList.toggle('btn-primary', procView === 'kanban');
}

function renderPipeline(all) {
  // 납품 완료는 파이프라인 흐름에서 제외 (별도 카운트)
  const activeAll = all.filter(p => p.processStage !== '납품');
  const deliveredCnt = all.filter(p => p.processStage === '납품').length;
  const total = activeAll.length || 1;
  const stages = processStages.filter(s => s !== '납품');

  inp('pipeline-view').innerHTML = stages.map(stage => {
    const cnt       = activeAll.filter(p => p.processStage === stage).length;
    const hasUrgent = activeAll.some(p => p.processStage === stage && p.deliveryDate && daysUntil(p.deliveryDate) < 0);
    const hasWarn   = activeAll.some(p => p.processStage === stage && p.deliveryDate && daysUntil(p.deliveryDate) <= 14);
    const c   = stageColor(stage);
    const pct = Math.round(cnt / total * 100);
    const isActive = procStageFilter === stage;
    return `
      <div class="pipe-step${isActive?' active':''}" onclick="togglePipeFilter('${stage}')" title="${stage}: ${cnt}건">
        <div class="pipe-step-inner" style="${isActive?`border-color:${c}; background:${c}18;`:''}">
          <div class="pipe-step-name" style="color:${isActive?c:'var(--tx-s)'};">${stage}</div>
          <div class="pipe-step-count" style="color:${cnt?(hasUrgent?'#e03131':hasWarn?'#f76707':c):'var(--tx-t)'};">${cnt}</div>
          <div class="pipe-step-bar">
            <div class="pipe-step-fill" style="width:${pct}%; background:${hasUrgent?'#f03e3e':hasWarn?'#f76707':c};"></div>
          </div>
        </div>
      </div>`;
  }).join('') + (deliveredCnt > 0 ? `
    <div class="pipe-step" onclick="go('dashboard')" title="납품 완료: ${deliveredCnt}건 — 대시보드에서 확인">
      <div class="pipe-step-inner" style="background:#2b8a3e18; border-color:#2b8a3e44;">
        <div class="pipe-step-name" style="color:#2b8a3e;"><i class="ti ti-truck-delivery"></i> 납품완료</div>
        <div class="pipe-step-count" style="color:#2b8a3e;">${deliveredCnt}</div>
        <div class="pipe-step-bar"><div class="pipe-step-fill" style="width:100%; background:#2b8a3e;"></div></div>
      </div>
    </div>` : '');
}

function togglePipeFilter(stage) {
  procStageFilter = (procStageFilter === stage) ? null : stage;
  renderProcess();
}

function renderKanban() {
  const fc = v('proc-fc');
  const closedClientIds = new Set(clients.filter(c => c.closed).map(c => c.id));
  let allProd = products.filter(p => p.processStage !== '납품' && !closedClientIds.has(p.clientId) && (!fc || p.clientId === fc));
  if (procStageFilter) allProd = allProd.filter(p => p.processStage === procStageFilter);

  const unmatched = allProd.filter(p => !processStages.includes(p.processStage));

  const stageNeons = {
    '설계/도면': { color: '#00f0ff', class: 'neon-cyan', badgeBg: 'rgba(0, 240, 255, 0.12)', badgeColor: '#00f0ff' },
    '자재발주': { color: '#ffcc00', class: 'neon-yellow', badgeBg: 'rgba(255, 204, 0, 0.12)', badgeColor: '#ffcc00' },
    '가공/제작': { color: '#ff7b00', class: 'neon-orange', badgeBg: 'rgba(255, 123, 0, 0.12)', badgeColor: '#ff7b00' },
    '조립': { color: '#6366f1', class: 'neon-indigo', badgeBg: 'rgba(99, 102, 241, 0.12)', badgeColor: '#6366f1' },
    '배선/전기': { color: '#a855f7', class: 'neon-purple', badgeBg: 'rgba(168, 85, 247, 0.12)', badgeColor: '#a855f7' },
    '검사/시험': { color: '#ec4899', class: 'neon-magenta', badgeBg: 'rgba(236, 72, 153, 0.12)', badgeColor: '#ec4899' },
    '완료': { color: '#10b981', class: 'neon-green', badgeBg: 'rgba(16, 185, 129, 0.12)', badgeColor: '#10b981' },
    '납품': { color: '#059669', class: 'neon-emerald', badgeBg: 'rgba(5, 150, 105, 0.12)', badgeColor: '#059669' }
  };
  const defaultNeon = { color: '#868e96', class: 'neon-cyan', badgeBg: 'rgba(134, 142, 150, 0.12)', badgeColor: '#868e96' };

  const makeCard = p => {
    const d = daysUntil(p.deliveryDate);
    const neon = stageNeons[p.processStage] || defaultNeon;
    
    const prioText = d < 0 ? 'High' : d <= 14 ? 'Med' : 'Low';
    const prioColor = d < 0 ? '#f03e3e' : d <= 14 ? '#ff7b00' : '#10b981';
    
    const pMats = materials.filter(m => m.productId === p.id);
    const matDone = pMats.filter(m => m.status === '입고완료').length;
    const matPct  = pMats.length ? Math.round(matDone / pMats.length * 100) : 100;
    
    const wo = workOrders.find(o => o.productId === p.id && o.status !== '완료');
    const workerName = wo?.manager || '미배정';
    const progressPercent = wo && wo.qty > 0 ? Math.round(wo.done / wo.qty * 100) : (['완료','납품'].includes(p.processStage) ? 100 : 0);
    const progressColor = progressPercent === 100 ? '#10b981' : neon.color;
    
    const timestampStr = p.deliveryDate ? p.deliveryDate.slice(5) : '납기미정';
    const statusLabel = stageToStatus(p.processStage);
    
    return `
      <div class="kb-card ${neon.class}" style="cursor:default;" onclick="openKanbanEditModal('${p.id}')" title="클릭하여 공정 상태 편집">
        <div class="kb-card-badge" style="background:${neon.badgeBg}; color:${neon.badgeColor}; border-color:${neon.color}33;">
          ${statusLabel}
        </div>
        
        <div class="kb-card-title-row">
          <div class="kb-card-name">Job #${p.id}: ${p.name}</div>
          <button onclick="event.stopPropagation(); navToProduct('${p.clientId}','${p.id}')" title="수주관리에서 편집"
            style="background:none;border:none;color:var(--tx-t);cursor:pointer;padding:0;font-size:11px;flex-shrink:0;line-height:1;">
            <i class="ti ti-external-link"></i>
          </button>
        </div>
        
        <div class="kb-card-client-row">
          <i class="ti ti-building"></i>
          <span>${getClientName(p.clientId)}</span>
        </div>
        
        <div class="kb-card-meta-grid">
          <div class="kb-card-meta-item">
            <span class="kb-card-meta-lbl">Prio</span>
            <span class="kb-card-meta-val" style="color:${prioColor}; font-weight:800;">${prioText}</span>
          </div>
          <div class="kb-card-meta-item">
            <span class="kb-card-meta-lbl">D-Day</span>
            <span class="kb-card-meta-val">${p.deliveryDate ? (d < 0 ? `D+${-d}` : `D-${d}`) : '미정'}</span>
          </div>
        </div>
        
        <div class="kb-card-prog-wrap">
          <div class="kb-card-prog-lbl-row">
            <span>Progress</span>
            <span style="color:${progressColor}; font-weight:700;">${progressPercent}%</span>
          </div>
          <div class="kb-card-prog-bar">
            <div class="kb-card-prog-fill" style="width:${progressPercent}%; background:${progressColor}; box-shadow: 0 0 6px ${progressColor}88;"></div>
          </div>
        </div>
        
        ${pMats.length ? `
        <div class="kb-card-prog-wrap" style="margin-top: -2px;">
          <div class="kb-card-prog-lbl-row">
            <span>자재 입고률</span>
            <span style="color:#1c7ed6; font-weight:700;">${matPct}%</span>
          </div>
          <div class="kb-card-prog-bar">
            <div class="kb-card-prog-fill" style="width:${matPct}%; background:#1c7ed6;"></div>
          </div>
        </div>` : ''}
        
        <div class="kb-card-footer">
          <span>Worker: <strong>${workerName}</strong></span>
          <span style="font-size: 8.5px; opacity: 0.75;"><i class="ti ti-clock"></i> ${timestampStr}</span>
        </div>
        
        ${p.processMemo ? `<div style="font-size:9.5px; color:var(--tx-t); border-top:1px dashed rgba(255,255,255,0.06); padding-top:6px; margin-top:2px; line-height:1.4;">${p.processMemo}</div>` : ''}
      </div>`;
  };

  // 빈 단계 컬럼은 숨겨 한눈에 보기 쉽게 (필터 시에는 해당 단계만)
  const shownStages = procStageFilter
    ? [procStageFilter]
    : processStages.filter(stage => allProd.some(p => p.processStage === stage));
  const stageCols = shownStages.map(stage => {
    const stageProds = allProd.filter(p => p.processStage === stage);
    const neon = stageNeons[stage] || defaultNeon;
    const hasUrgent = stageProds.some(p => p.deliveryDate && daysUntil(p.deliveryDate) < 0);
    const stripColor = hasUrgent ? '#f03e3e' : neon.color;
    return `
      <div class="kb-col${procStageFilter===stage?' kb-filtered':''}">
        <div class="kb-col-hd" style="--stage-neon:${stripColor};">
          <span style="font-weight:700; color:var(--tx);">${stage}</span>
          <span style="background:${stripColor}; color:#fff; border-radius:10px; padding:2px 8px; font-size:10px; font-weight:800; box-shadow:0 0 6px ${stripColor}88;">${stageProds.length}</span>
        </div>
        <div class="kb-cards-container">
          ${stageProds.length ? stageProds.map(makeCard).join('') : `<div class="kb-empty"><i class="ti ti-inbox" style="font-size:18px; display:block; margin-bottom:4px; opacity:.3;"></i>비어있음</div>`}
        </div>
      </div>`;
  });

  const unmatchedCol = (!procStageFilter && unmatched.length) ? `
    <div class="kb-col">
      <div class="kb-col-hd" style="--stage-neon:#868e96;">
        <span style="font-weight:700; color:var(--tx);">미분류</span>
        <span style="background:#868e96; color:#fff; border-radius:10px; padding:2px 8px; font-size:10px; font-weight:800; box-shadow:0 0 6px #868e9688;">${unmatched.length}</span>
      </div>
      <div class="kb-cards-container">
        ${unmatched.map(p => `
          <div class="kb-card neon-cyan" style="cursor:default;" onclick="openKanbanEditModal('${p.id}')">
            <div class="kb-card-badge" style="background:rgba(134,142,150,0.12); color:#868e96; border-color:#868e9633;">
              미분류
            </div>
            <div class="kb-card-title-row">
              <div class="kb-card-name">Job #${p.id}: ${p.name}</div>
              <button onclick="event.stopPropagation(); navToProduct('${p.clientId}','${p.id}')" title="수주관리에서 편집"
                style="background:none;border:none;color:var(--tx-t);cursor:pointer;padding:0;font-size:11px;">
                <i class="ti ti-external-link"></i>
              </button>
            </div>
            <div class="kb-card-client-row"><i class="ti ti-building"></i><span>${getClientName(p.clientId)}</span></div>
            <div style="font-size:10px; color:var(--tx-t); margin-top:4px;">단계 미지정: ${p.processStage||'없음'}</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  const boardHtml = stageCols.join('') + unmatchedCol;
  inp('kanban-board').innerHTML = boardHtml.trim()
    ? boardHtml
    : `<div style="flex:1;padding:40px;text-align:center;color:var(--tx-t);font-size:13px;">${procStageFilter ? `'${procStageFilter}' 단계에 ` : ''}진행 중인 공정 카드가 없습니다.</div>`;
}

function openKanbanEditModal(productId) {
  if (!checkAdminAction()) return;
  const p = getProductById(productId); if (!p) return;
  currentSelectedKanbanProductId = productId;
  inp('km-prod-name').value = `${p.name}  ·  ${getClientName(p.clientId)}`;

  const stageSel = inp('km-stage');
  stageSel.innerHTML = processStages.map(s => `<option value="${s}"${s===p.processStage?' selected':''}>${s}</option>`).join('');
  onKmStageChange();
  inp('km-memo').value = p.processMemo || '';

  // 연관 정보 컨텍스트
  const pMats = materials.filter(m => m.productId === p.id);
  const wo    = workOrders.find(o => o.productId === p.id);
  const d     = daysUntil(p.deliveryDate);
  inp('km-context-row').innerHTML = `
    <div style="background:var(--bg-s); border:1px solid var(--br); border-radius:var(--rm); padding:8px 10px;">
      <div style="font-size:9px; color:var(--tx-t); font-weight:600; margin-bottom:2px;">납기</div>
      <div style="font-weight:700; font-size:12px; color:${d<0?'#e03131':d<=14?'#f76707':'var(--tx)'}">${p.deliveryDate||'미설정'}${p.deliveryDate?` (D${d>=0?'-':'+'}${Math.abs(d)})`:''}</div>
    </div>
    <div style="background:var(--bg-s); border:1px solid var(--br); border-radius:var(--rm); padding:8px 10px;">
      <div style="font-size:9px; color:var(--tx-t); font-weight:600; margin-bottom:2px;">자재 / 생산지시</div>
      <div style="font-weight:600; font-size:11px;">자재 ${pMats.filter(m=>m.status==='입고완료').length}/${pMats.length}건 완료 · ${wo?`생산 ${wo.done}/${wo.qty}`:'지시 없음'}</div>
    </div>`;

  inp('kmSaveBtn').onclick = saveKanbanChanges;
  inp('kanbanEditModal').classList.add('open');
}

function onKmStageChange() {
  const stage = v('km-stage');
  const derived = stageToStatus(stage);
  const c = stageColor(stage);
  const preview = inp('km-status-preview');
  if (preview) {
    preview.innerHTML = `<span class="bd" style="background:${c}18; color:${c}; border-color:${c}44;">${derived}</span>`;
    preview.title = `공정 단계 "${stage}" → 상태 "${derived}" 자동 적용`;
  }
}

function closeKanbanModal() {
  inp('kanbanEditModal').classList.remove('open');
  currentSelectedKanbanProductId = null;
}

function saveKanbanChanges() {
  if (!currentSelectedKanbanProductId) return;
  const p = getProductById(currentSelectedKanbanProductId);
  if (p) {
    const prevStage = p.processStage;
    p.processStage  = v('km-stage');
    p.status        = stageToStatus(p.processStage);
    p.processMemo   = inp('km-memo').value.trim();
    if (p.processStage === '완료' && prevStage !== '완료') onStageComplete(p);
    if (p.processStage === '납품' && prevStage !== '납품') onStageDelivered(p);
    
    saveStorage('products', products);
    renderProcess();
    showToast(`${p.name} — ${p.processStage} 단계로 변경`);
  }
  closeKanbanModal();
}

function renderProcDetail() {
  const fc = v('proc-fc');
  const q  = (inp('proc-q')?.value || '').toLowerCase();
  // 납품 완료 제품은 공정 현황표에서 제외
  const closedIds = new Set(clients.filter(c => c.closed).map(c => c.id));
  let allProd = products.filter(p =>
    p.processStage !== '납품' &&
    !closedIds.has(p.clientId) &&
    (!fc || p.clientId === fc) &&
    (!procStageFilter || p.processStage === procStageFilter) &&
    (!q || p.name.toLowerCase().includes(q) || getClientName(p.clientId).toLowerCase().includes(q))
  );

  if (sortState.process.key) {
    const k = sortState.process.key;
    const asc = sortState.process.asc ? 1 : -1;
    allProd.sort((a, b) => {
      let va, vb;
      if (k === 'client') {
        va = getClientName(a.clientId);
        vb = getClientName(b.clientId);
      } else if (k === 'dday') {
        va = a.deliveryDate ? daysUntil(a.deliveryDate) : 999999;
        vb = b.deliveryDate ? daysUntil(b.deliveryDate) : 999999;
      } else if (k === 'matPct') {
        const aMats = materials.filter(m => m.productId === a.id);
        const aDone = aMats.filter(m => m.status==='입고완료').length;
        va = aMats.length ? aDone/aMats.length : 1;
        const bMats = materials.filter(m => m.productId === b.id);
        const bDone = bMats.filter(m => m.status==='입고완료').length;
        vb = bMats.length ? bDone/bMats.length : 1;
      } else if (k === 'woPct') {
        const aWo = workOrders.find(o => o.productId === a.id);
        va = aWo && aWo.qty > 0 ? aWo.done/aWo.qty : (['완료','납품'].includes(a.processStage)?1:0);
        const bWo = workOrders.find(o => o.productId === b.id);
        vb = bWo && bWo.qty > 0 ? bWo.done/bWo.qty : (['완료','납품'].includes(b.processStage)?1:0);
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

  const filterBanner = procStageFilter ? `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:12px;">
      <i class="ti ti-filter" style="color:var(--tx-i);"></i>
      <span>상단 공정 흐름 필터:</span>
      <span class="bd" style="background:${stageColor(procStageFilter)}18; color:${stageColor(procStageFilter)}; border-color:${stageColor(procStageFilter)}44;">${procStageFilter}</span>
      <button class="btn btn-sm" onclick="togglePipeFilter('${procStageFilter}')"><i class="ti ti-x"></i>필터 해제</button>
    </div>` : '';
  inp('proc-detail-table').innerHTML = filterBanner + (allProd.length ? `
    <table style="min-width:860px;">
      <thead>
        <tr>
          <th onclick="toggleSort('process', 'client')" style="cursor:pointer; user-select:none;">고객사 ${sortIcon('process', 'client')}</th>
          <th onclick="toggleSort('process', 'name')" style="cursor:pointer; user-select:none;">제품명 ${sortIcon('process', 'name')}</th>
          <th onclick="toggleSort('process', 'processStage')" style="cursor:pointer; user-select:none;">공정 단계 ${sortIcon('process', 'processStage')}</th>
          <th onclick="toggleSort('process', 'deliveryDate')" style="cursor:pointer; user-select:none;">납기 ${sortIcon('process', 'deliveryDate')}</th>
          <th onclick="toggleSort('process', 'dday')" style="cursor:pointer; user-select:none;">D-Day ${sortIcon('process', 'dday')}</th>
          <th onclick="toggleSort('process', 'matPct')" style="cursor:pointer; user-select:none;">자재 현황 ${sortIcon('process', 'matPct')}</th>
          <th onclick="toggleSort('process', 'woPct')" style="cursor:pointer; user-select:none;">생산 진행률 ${sortIcon('process', 'woPct')}</th>
          <th onclick="toggleSort('process', 'processMemo')" style="cursor:pointer; user-select:none;">공정 메모 ${sortIcon('process', 'processMemo')}</th>
          <th>수주관리</th>
        </tr>
      </thead>
      <tbody>
        ${allProd.map(p => {
          const pMats   = materials.filter(m => m.productId === p.id);
          const matDone = pMats.filter(m => m.status==='입고완료').length;
          const matPct  = pMats.length ? Math.round(matDone/pMats.length*100) : 100;
          const wo      = workOrders.find(o => o.productId === p.id);
          const woPct   = wo && wo.qty > 0 ? Math.round(wo.done/wo.qty*100) : (['완료','납품'].includes(p.processStage)?100:0);
          const d       = daysUntil(p.deliveryDate);
          const rowBg   = p.deliveryDate && d < 0 ? 'background:rgba(240,62,62,.04);' : '';
          const c       = stageColor(p.processStage);
          return `
            <tr style="${rowBg}">
              <td style="font-weight:600;">${getClientName(p.clientId)}</td>
              <td style="font-weight:700;">${p.name}</td>
              <td>
                <span class="bd" style="background:${c}18; color:${c}; border-color:${c}44; font-size:11px;">${p.processStage}</span>
                <span style="font-size:10px; color:var(--tx-t); display:block; margin-top:2px;">→ ${stageToStatus(p.processStage)}</span>
              </td>
              <td style="font-size:11px;">${p.deliveryDate||'—'}</td>
              <td>${p.deliveryDate?dayBadge(p.deliveryDate):'—'}</td>
              <td style="min-width:90px;">
                ${pMats.length ? `<div style="font-size:10px; color:var(--tx-t); margin-bottom:2px;">${matDone}/${pMats.length} 입고</div>
                <div style="height:5px; background:var(--bg-t); border-radius:3px; overflow:hidden;">
                  <div style="height:100%; width:${matPct}%; background:${matPct===100?'#37b24d':'#1c7ed6'}; border-radius:3px;"></div>
                </div>` : '<span style="font-size:10px;color:var(--tx-t);">자재없음</span>'}
              </td>
              <td style="min-width:90px;">
                ${wo ? `<div style="font-size:10px; color:var(--tx-t); margin-bottom:2px;">${wo.done}/${wo.qty} · ${woPct}%</div>
                <div style="height:5px; background:var(--bg-t); border-radius:3px; overflow:hidden;">
                  <div style="height:100%; width:${woPct}%; background:#e8590c; border-radius:3px;"></div>
                </div>` : '<span style="font-size:10px;color:var(--tx-t);">지시없음</span>'}
              </td>
              <td style="font-size:11px; color:var(--tx-t); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.processMemo||''}">${p.processMemo||'—'}</td>
              <td>
                <button class="btn btn-sm" onclick="navToProduct('${p.clientId}','${p.id}')" title="수주관리에서 단계 편집">
                  <i class="ti ti-external-link"></i>편집
                </button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>` : empty('조건에 맞는 제품이 없습니다.'));
}

function openProcStagePanel() {
  if (!checkAdminAction()) return;
  inp('stage-input').value = processStages.join(', ');
  inp('stage-modal').classList.add('open');
}

function openStageModal() {
  inp('stage-input').value = processStages.join(', ');
  inp('stage-modal').classList.add('open');
}

function saveStages() {
  if (!checkAdminAction()) return;
  const raw = v('stage-input');
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!arr.length) { showToast('최소 1개 이상의 공정 체인이 필요합니다.', 'error'); return; }
  processStages = arr;
  saveStorage('stages', processStages);
  closeModal('stage-modal');
  renderKanban();
  renderProcDetail();
  showToast('현장 맞춤형 공정 노선 설계가 완료되었습니다.');
}

function exportProcessCSV() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['고객사','제품명','납기','D-Day','공정단계','상태','메모'];
  const fc = v('proc-fc');
  const rows = products.filter(p => !clients.find(c=>c.id===p.clientId)?.closed && p.processStage !== '납품' && (!fc || p.clientId === fc))
    .map(p => [getClientName(p.clientId), p.name, p.deliveryDate||'—', p.deliveryDate?`D-${daysUntil(p.deliveryDate)}`:'—', p.processStage, p.status, p.processMemo||'']);
  const ws = XLSX.utils.aoa_to_sheet([h,...rows]);
  ws['!cols'] = h.map(c => ({ wch: Math.max(c.length+2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, '공정현황');
  XLSX.writeFile(wb, `MESPro_공정현황_${today().replace(/-/g,'')}.xlsx`);
  showToast('공정 현황 XLS 저장 완료');
}
