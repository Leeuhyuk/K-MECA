/* ════════ 대시보드 탭 제어 ════════ */
let currentDashTab = 'overview';
function dashRecords(list, entityType) {
  return typeof visibleRecords === 'function' ? visibleRecords(list || [], entityType) : (list || []);
}

function switchDashTab(tab, el) {
  const changed = currentDashTab !== tab;
  currentDashTab = tab;
  syncCurrentSubRoute('dashboard', tab); // 하위 탭을 #/dashboard/<탭> 로 라우트 동기화(딥링크)
  document.querySelectorAll('#pg-dashboard .dash-panel').forEach(p => p.classList.remove('active'));
  const panel = inp('dt-' + tab);
  if (panel) panel.classList.add('active');

  // 공정 관리 탭에서는 중복되는 전역 KPI를 숨기고 공정 KPI만 표시
  const gk = inp('dash-kpi');
  if (gk) gk.style.display = (tab === 'process') ? 'none' : '';

  // 탭이 실제로 바뀔 때만 스크롤을 상단으로(데이터 갱신 시 스크롤 유지).
  if (changed) { const content = inp('pg-dashboard'); if (content) content.scrollTop = 0; }

  // 탭별 필요한 렌더 호출
  if (tab === 'process')   renderProcess();
  if (tab === 'resources') renderDashResources();
}

// 모던 셸 사이드바에서 대시보드 하위 탭으로 직접 이동(재무 goFinanceTab 과 대칭).
function goDashTab(tab) {
  currentDashTab = tab || 'overview';
  if (typeof currentPage !== 'undefined' && currentPage !== 'dashboard') {
    go('dashboard');
  } else {
    switchDashTab(currentDashTab);
  }
}

function openProcStagePanel() {
  if (!checkAdminAction()) return;
  closeModal('stage-modal');
}

function toggleProcTable() {
  const el = inp('proc-detail-table');
  const icon = inp('proc-table-icon');
  if (!el) return;
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  if (icon) icon.className = isHidden ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
  if (isHidden) renderProcDetail();
}
function renderDashboard() {
  // 직접 URL(#/dashboard/<탭>) 진입 시에도 현재 탭 패널이 보이도록 활성 상태를 맞춘다.
  document.querySelectorAll('#pg-dashboard .dash-panel').forEach(p => p.classList.remove('active'));
  const panel = inp('dt-' + currentDashTab);
  if (panel) panel.classList.add('active');
  const gk = inp('dash-kpi');
  if (gk) gk.style.display = (currentDashTab === 'process') ? 'none' : '';
  renderDashOverview();
  if (currentDashTab === 'process')   renderProcess();
  if (currentDashTab === 'resources') renderDashResources();
}

function renderDashOverview() {
  const dashMaterials = dashRecords(materials, 'material');
  const dashInventory = dashRecords(inventory, 'inventory');
  const dashProducts  = dashRecords(products, 'processProduct');
  const dashDefects   = dashRecords(defects, 'defect');
  const dashClaims    = dashRecords(claims, 'claim');
  const dashDeliveries= dashRecords(deliveries, 'delivery');
  const pending    = dashMaterials.filter(m => m.status === '발주전').length;
  const orderMats  = dashMaterials.filter(m => m.status === '발주중').length;
  const arrived    = dashMaterials.filter(m => m.status === '입고완료').length;
  const totalAmt   = dashMaterials.reduce((s, m) => s + getMatAmt(m), 0);
  const lowStockCount = dashInventory.filter(i => i.qty <= i.minQty).length;
  const activeProds   = dashProducts.filter(p => p.status !== '견적').length;
  const doneProds     = dashProducts.filter(p => ['완료','납품'].includes(p.processStage)).length;
  const openDefects   = dashDefects.filter(d => d.status !== '완료').length;

  /* ── KPI 카드 ── */
  inp('dash-kpi').innerHTML = `
    <div class="mc clickable" onclick="go('clients')">
      <div class="mc-lbl"><i class="ti ti-box" style="color:var(--tx-i);"></i>진행 중 프로젝트</div>
      <div class="mc-val" style="color:var(--tx-i);">${activeProds}건</div>
      <div class="mc-sub">완료 ${doneProds}건 포함 전체 ${dashProducts.length}종</div>
    </div>
    <div class="mc clickable" onclick="go('materials')">
      <div class="mc-lbl"><i class="ti ti-circle-dashed" style="color:var(--tx-t);"></i>발주 대기 자재</div>
      <div class="mc-val" style="color:${pending>0?'var(--tx-d)':'var(--tx-t)'};">${pending}건</div>
      <div class="mc-sub">발주중 ${orderMats}건 · 입고완료 ${arrived}건</div>
    </div>
    <div class="mc clickable" onclick="go('inventory')">
      <div class="mc-lbl"><i class="ti ti-packages" style="color:${lowStockCount>0?'var(--tx-d)':'var(--tx-ok)'}"></i>안전재고 미달</div>
      <div class="mc-val" style="color:${lowStockCount>0?'var(--tx-d)':'var(--tx-ok)'};">${lowStockCount}개 품목</div>
      <div class="mc-sub">전체 재고 ${dashInventory.length}종 관리 중</div>
    </div>
    <div class="mc clickable" onclick="go('quality')">
      <div class="mc-lbl"><i class="ti ti-shield-alert" style="color:${openDefects>0?'var(--tx-w)':'var(--tx-ok)'}"></i>미처리 품질장애</div>
      <div class="mc-val" style="color:${openDefects>0?'var(--tx-w)':'var(--tx-ok)'};">${openDefects}건</div>
      <div class="mc-sub">클레임 ${dashClaims.filter(c=>c.status!=='완료').length}건 처리중</div>
    </div>`;

  /* ── 조치 현황 ── */
  const actions = [];
  dashMaterials.filter(m => m.status === '발주전').slice(0, 3).forEach(m => {
    const pr = getProductById(m.productId);
    actions.push({ cls:'urgent', icon:'ti-alert-circle', txt:`[자재발주 요청] ${esc(m.name)}`, sub:`${esc(pr?.name)||''} 공정자재 · 미발주`, page:'materials' });
  });
  dashMaterials.filter(m => m.status==='발주중' && m.expectedDate && daysUntil(m.expectedDate)<=7).slice(0,2).forEach(m => {
    actions.push({ cls:'warn', icon:'ti-truck-delivery', txt:`[입고임박] ${esc(m.name)}`, sub:`${esc(m.supplier)} · ${esc(m.expectedDate)} 예정`, page:'materials' });
  });
  dashDefects.filter(d => d.status !== '완료').slice(0,2).forEach(d => {
    actions.push({ cls:'urgent', icon:'ti-shield-alert', txt:`[미처리 불량] ${esc(d.type)}`, sub:`${esc(getProductName(d.productId))} · ${esc(d.stage)}`, page:'quality' });
  });
  dashInventory.filter(i => i.qty <= i.minQty).slice(0,2).forEach(i => {
    actions.push({ cls:'warn', icon:'ti-package-off', txt:`[안전재고 미달] ${esc(i.name)}`, sub:`현재고 ${esc(i.qty)}${esc(i.unit)} / 안전 ${esc(i.minQty)}${esc(i.unit)}`, page:'inventory' });
  });
  inp('dash-actions').innerHTML = actions.length ? actions.map(a => `
    <div class="action-item ${a.cls}" style="cursor:pointer;" onclick="go('${a.page}')">
      <i class="ti ${a.icon}"></i>
      <div style="flex:1;">
        <div class="action-txt">${a.txt}</div>
        <div class="action-sub">${a.sub}</div>
      </div>
      <i class="ti ti-chevron-right" style="font-size:14px; opacity:.5;"></i>
    </div>`).join('') : `
    <div class="action-item info">
      <i class="ti ti-circle-check"></i>
      <div><div class="action-txt">현재 처리 대기 중인 긴급 장애 요인이 없습니다.</div></div>
    </div>`;

  /* ── 납기 현황 ── */
  const dl = dashProducts.filter(p => p.deliveryDate && p.status !== '견적' && !['완료','납품'].includes(p.processStage))
    .sort((a,b) => a.deliveryDate.localeCompare(b.deliveryDate));
  inp('dash-deadlines').innerHTML = dl.length ? `
    <table>
      <thead><tr><th>고객사</th><th>제품명</th><th>납기일</th><th>D-Day</th><th>공정단계</th><th>상태</th></tr></thead>
      <tbody>
        ${dl.slice(0,6).map(p => `
          <tr style="cursor:pointer;" onclick="go('process')" title="공정관리로 이동">
            <td style="font-weight:600;">${esc(getClientName(p.clientId))}</td>
            <td style="font-weight:700; color:var(--tx-i);">${esc(p.name)}</td>
            <td style="font-size:11px;">${esc(p.deliveryDate)}</td>
            <td>${dayBadge(p.deliveryDate)}</td>
            <td><span class="bd bd-info" style="font-size:10px;">${esc(p.processStage)}</span></td>
            <td>${statusBadge(p.status)}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : empty('현재 납기 일정이 걸려있는 제품군이 없습니다.');

  /* 납품 요약 (종합현황 탭) */
  const dlvEl = inp('dash-dlv-summary');
  if (dlvEl) {
    const dlvCnt = dashDeliveries.length;
    const dlvAmt = dashDeliveries.reduce((s,d)=>s+d.price*d.qty,0);
    const dlvMonth = dashDeliveries.filter(d=>d.deliveredAt?.slice(0,7)===today().slice(0,7)).length;
    dlvEl.innerHTML = dlvCnt === 0
      ? `<div style="padding:10px 4px;color:var(--tx-t);font-size:11px;"><i class="ti ti-truck-delivery" style="opacity:.3;"></i> 납품 기록 없음</div>`
      : `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:4px 0;">
          <div><div style="font-size:17px;font-weight:700;">${dlvCnt}건</div><div style="font-size:10px;color:var(--tx-t);">전체 납품</div></div>
          <div style="width:1px;height:30px;background:var(--br);"></div>
          <div><div style="font-size:15px;font-weight:700;color:var(--tx-ok);">${fmtW(dlvAmt)}</div><div style="font-size:10px;color:var(--tx-t);">납품 총액</div></div>
          <div style="width:1px;height:30px;background:var(--br);"></div>
          <div><div style="font-size:15px;font-weight:700;color:var(--tx-i);">${dlvMonth}건</div><div style="font-size:10px;color:var(--tx-t);">이번달</div></div>
          <div style="margin-left:auto;">
            ${dashDeliveries.slice(0,2).map(d=>`<div style="font-size:10px;margin-bottom:2px;"><b>${esc(d.productName)}</b> · ${esc(getClientName(d.clientId))} · ${esc(d.deliveredAt)}</div>`).join('')}
          </div>
        </div>`;
  }
  renderDashProjects();
}

function renderDashProjects() {
  const stageColors = STAGE_COLORS;
  const canView = (typeof canViewRecord === 'function') ? canViewRecord : function(){ return true; };
  const visibleClients = clients.filter(c => canView(c, 'processClient'));
  const visibleProducts = products.filter(p => canView(p, 'processProduct'));
  const activeClients = visibleClients.filter(c => !c.closed);
  const knownClientIds = new Set(visibleClients.map(c => c.id));
  const projectGroups = activeClients.map(c => ({
    client: c,
    products: visibleProducts.filter(p => p.clientId === c.id)
  }));
  const unlinkedProducts = visibleProducts.filter(p => !p.clientId || !knownClientIds.has(p.clientId));
  if (unlinkedProducts.length) {
    projectGroups.push({ client: { id:'__unlinked__', name:'고객사 미연결', manager:'' }, products: unlinkedProducts });
  }
  inp('dash-project-summary').innerHTML = projectGroups.length ? `
    <table data-managed-table="false" style="min-width:860px;">
      <thead>
        <tr>
          <th>고객사</th><th>담당자</th><th>제품명</th><th>납기일</th><th>D-Day</th>
          <th>공정 단계</th><th>자재 현황</th><th>생산지시</th><th>상태</th><th>바로가기</th>
        </tr>
      </thead>
      <tbody>
        ${projectGroups.flatMap(group => {
          const c = group.client;
          const prods = group.products;
          if (!prods.length) return [`<tr><td style="font-weight:700;">${esc(c.name)}</td><td style="font-size:11px;color:var(--tx-t);">${esc(c.manager)||'—'}</td><td colspan="8" style="color:var(--tx-t);font-size:11px;font-style:italic;">등록된 제품 없음</td></tr>`];
          return prods.map((p, i) => {
            const pMats  = dashRecords(materials, 'processMaterial').filter(m => m.productId === p.id);
            const matPre = pMats.filter(m => m.status==='발주전').length;
            const matOrd = pMats.filter(m => m.status==='발주중').length;
            const matDone= pMats.filter(m => m.status==='입고완료').length;
            const relOrder = dashRecords(workOrders, 'workOrder').find(o => o.productId === p.id);
            const sc = stageColors[p.processStage] || '#495057';
            return `
              <tr style="cursor:pointer;" onclick="navToProduct('${p.clientId || c.id}','${p.id}')">
                ${i===0 ? `<td rowspan="${prods.length}" style="font-weight:700;border-right:2px solid var(--br-i);vertical-align:middle;">${esc(c.name)}</td>
                            <td rowspan="${prods.length}" style="font-size:11px;color:var(--tx-s);border-right:1px solid var(--br);vertical-align:middle;">${esc(c.manager)||'—'}</td>` : ''}
                <td style="font-weight:700;">${esc(p.name)} <span style="font-size:10px;color:var(--tx-t);font-weight:400;">${esc(p.spec)||''}</span></td>
                <td style="font-size:11px;">${esc(p.deliveryDate)||'—'}</td>
                <td>${p.deliveryDate ? dayBadge(p.deliveryDate) : '—'}</td>
                <td><span class="bd" style="background:${sc}18;color:${sc};border-color:${sc}44;font-size:10px;">${esc(p.processStage)}</span></td>
                <td style="font-size:11px;">
                  ${pMats.length===0 ? '<span style="color:var(--tx-t);">자재없음</span>' :
                    `<span style="color:${matPre>0?'var(--tx-d)':'var(--tx-t)'};font-weight:600;">대기 ${matPre}</span> /
                     <span style="color:var(--tx-i);">발주중 ${matOrd}</span> /
                     <span style="color:var(--tx-ok);">완료 ${matDone}</span>`}
                </td>
                <td style="font-size:11px;">${relOrder ? pctBar(relOrder.done, relOrder.qty, 50) : '<span style="color:var(--tx-t);">미발행</span>'}</td>
                <td>${statusBadge(p.status)}</td>
                <td><button class="btn btn-sm" style="height:22px;padding:0 6px;font-size:10px;" onclick="event.stopPropagation();navToProduct('${p.clientId || c.id}','${p.id}')"><i class="ti ti-external-link"></i>이동</button></td>
              </tr>`;
          });
        }).join('')}
      </tbody>
    </table>` : empty('진행 중인 프로젝트가 없습니다.');
}

function renderDashResources() {
  /* 제품별 자재 발주율 */
  const visibleProducts = dashRecords(products, 'processProduct');
  const visibleMaterials = dashRecords(materials, 'material');
  const visibleDefects = dashRecords(defects, 'defect');
  const visibleClaims = dashRecords(claims, 'claim');
  const visibleInventory = dashRecords(inventory, 'inventory');
  const prodList = visibleProducts.filter(p => visibleMaterials.some(m => m.productId === p.id));
  inp('dash-mat-by-product').innerHTML = prodList.length ? `
    <div class="thin-scroll" style="display:flex;flex-direction:column;gap:10px;max-height:280px;overflow-y:auto;padding-right:6px;">
      ${prodList.map(p => {
        const pMats = visibleMaterials.filter(m => m.productId === p.id);
        const pre=pMats.filter(m=>m.status==='발주전').length;
        const ord=pMats.filter(m=>m.status==='발주').length;
        const done=pMats.filter(m=>m.status==='입고완료').length;
        const delay=pMats.filter(m=>m.status==='지연').length;
        const total=pMats.length;
        const pctDone=total>0?Math.round(done/total*100):0;
        const barColor=pctDone===100?'#37b24d':pre>0?'#f03e3e':'#185FA5';
        return `
          <div style="cursor:pointer;" onclick="navToMatForProduct('${p.id}')">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:11px;font-weight:700;">${esc(p.name)}</span>
              <span style="font-size:10px;color:var(--tx-t);">${esc(getClientName(p.clientId))}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <div style="flex:1;height:6px;background:var(--bg-t);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${pctDone}%;background:${barColor};border-radius:3px;"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${barColor};min-width:28px;text-align:right;">${pctDone}%</span>
            </div>
            <div style="display:flex;gap:5px;font-size:10px;font-weight:600;">
              <span style="color:var(--tx-t);">대기 ${pre}</span>
              <span style="color:var(--tx-i);">발주중 ${ord}</span>
              <span style="color:var(--tx-ok);">완료 ${done}</span>
              ${delay>0?`<span style="color:var(--tx-d);">지연 ${delay}</span>`:''}
              <span style="color:var(--tx-t);margin-left:auto;">총 ${total}건</span>
            </div>
          </div>
          <div style="border-bottom:1px solid var(--br);margin-top:5px;"></div>`;
      }).join('')}
    </div>` : empty('자재가 등록된 제품이 없습니다.');

  /* 품질 요약 */
  const openDefects = visibleDefects.filter(d => d.status !== '완료').length;
  const openClaims  = visibleClaims.filter(c => c.status !== '완료');
  inp('dash-quality-summary').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;">
        <div style="background:var(--bg-w);border:1px solid var(--br-w);border-radius:var(--rm);padding:9px 12px;cursor:pointer;" onclick="go('quality')">
          <div style="font-size:9px;color:var(--tx-w);font-weight:600;margin-bottom:2px;"><i class="ti ti-alert-triangle"></i> 미처리 불량</div>
          <div style="font-size:18px;font-weight:700;color:var(--tx-w);">${openDefects}건</div>
        </div>
        <div style="background:var(--bg-d);border:1px solid var(--br-d);border-radius:var(--rm);padding:9px 12px;cursor:pointer;" onclick="go('quality')">
          <div style="font-size:9px;color:var(--tx-d);font-weight:600;margin-bottom:2px;"><i class="ti ti-message-report"></i> 처리중 클레임</div>
          <div style="font-size:18px;font-weight:700;color:var(--tx-d);">${openClaims.length}건</div>
        </div>
      </div>
      ${visibleDefects.filter(d=>d.status!=='완료').slice(0,2).map(d=>`
        <div class="action-item warn" style="cursor:pointer;padding:7px 10px;" onclick="go('quality')">
          <i class="ti ti-alert-triangle" style="font-size:12px;"></i>
          <div style="flex:1;"><div style="font-size:10px;font-weight:700;">${esc(d.type)}</div>
          <div style="font-size:9px;color:var(--tx-t);">${esc(getProductName(d.productId))} · ${esc(d.stage)}</div></div>
          <span class="bd bd-warn" style="font-size:9px;">${esc(d.status)}</span>
        </div>`).join('')}
      ${openDefects===0&&openClaims.length===0?`<div class="action-item info"><i class="ti ti-circle-check"></i><div><div class="action-txt" style="font-size:11px;">품질 이슈 없음</div></div></div>`:''}
    </div>`;

  /* 재고 현황 */
  const lowItems = visibleInventory.filter(i => i.qty <= i.minQty);
  inp('dash-inventory-summary').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;">
        <div style="background:var(--bg-s);border:1px solid var(--br);border-radius:var(--rm);padding:9px 12px;">
          <div style="font-size:9px;color:var(--tx-s);font-weight:600;margin-bottom:2px;"><i class="ti ti-box"></i> 전체 재고</div>
          <div style="font-size:18px;font-weight:700;">${visibleInventory.length}종</div>
        </div>
        <div style="background:${lowItems.length>0?'var(--bg-d)':'var(--bg-ok)'};border:1px solid ${lowItems.length>0?'var(--br-d)':'var(--br-ok)'};border-radius:var(--rm);padding:9px 12px;cursor:pointer;" onclick="go('inventory')">
          <div style="font-size:9px;color:${lowItems.length>0?'var(--tx-d)':'var(--tx-ok)'};font-weight:600;margin-bottom:2px;"><i class="ti ti-package-off"></i> 안전재고 미달</div>
          <div style="font-size:18px;font-weight:700;color:${lowItems.length>0?'var(--tx-d)':'var(--tx-ok)'};">${lowItems.length}종</div>
        </div>
      </div>
      ${lowItems.slice(0,3).map(i => {
        const pct = i.minQty > 0 ? Math.round(i.qty/i.minQty*100) : 0;
        return `<div style="cursor:pointer;padding:7px 10px;background:var(--bg-s);border:1px solid var(--br-d);border-radius:var(--rm);" onclick="go('inventory')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:700;">${esc(i.name)}</span>
            <span class="bd bd-err" style="font-size:9px;">미달</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;height:5px;background:var(--bg-t);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100,pct)}%;background:#f03e3e;border-radius:3px;"></div>
            </div>
            <span style="font-size:10px;font-weight:700;color:var(--tx-d);">${i.qty}/${i.minQty}${i.unit}</span>
          </div>
        </div>`;
      }).join('')}
      ${lowItems.length===0?`<div class="action-item info"><i class="ti ti-circle-check"></i><div><div class="action-txt" style="font-size:11px;">전 품목 안전재고 이상</div></div></div>`:''}
    </div>`;
}

/* 납품 현황 페이지 */
