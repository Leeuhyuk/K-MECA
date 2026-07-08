/* ════════ 납품 현황 탭 제어 ════════ */
let currentDlvTab = 'list';

function switchDlvTab(tab, el) {
  currentDlvTab = tab;
  syncCurrentSubRoute('deliveries', currentDlvTab);
  document.querySelectorAll('#pg-deliveries .dash-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#pg-deliveries .dash-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = inp('dlv-panel-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'closed') renderClosedProjects();
}

function renderClosedProjects() {
  const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const visibleDeliveries = typeof visibleRecords === 'function' ? visibleRecords(deliveries, 'delivery') : deliveries;
  const closedC = visibleClients.filter(c => c.closed);
  const badge = inp('dlv-closed-badge');
  if (badge) badge.textContent = closedC.length;
  const el = inp('dlv-closed-projects'); if (!el) return;
  if (!closedC.length) {
    el.innerHTML = `<div style="color:var(--tx-t); font-size:12px; padding:16px 4px; text-align:center;">
      <i class="ti ti-circle-check" style="font-size:24px; display:block; margin-bottom:8px; color:var(--tx-ok);"></i>
      종료된 프로젝트가 없습니다.
    </div>`;
    return;
  }
  el.innerHTML = closedC.map(c => {
    const prods = visibleProducts.filter(p => p.clientId === c.id);
    const cDlvs = visibleDeliveries.filter(d => d.clientId === c.id);
    const cAmt  = cDlvs.reduce((s, d) => s + d.price * d.qty, 0);
    return `
      <div style="border:1px solid var(--br); border-radius:var(--rl); margin-bottom:12px; overflow:hidden;">
        <div style="display:flex; align-items:center; gap:12px; padding:13px 16px; background:var(--bg-s); border-bottom:1px solid var(--br);">
          <div class="c-avatar" style="background:#868e96; opacity:.7; width:34px; height:34px; font-size:13px;">${esc(c.name.slice(0,2))}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:700; color:var(--tx-s);">${esc(c.name)}
              <span class="bd" style="font-size:10px; background:#86868618; color:#868686; border-color:#86868644; margin-left:6px;">종료 ${esc(c.closedAt)||''}</span>
            </div>
            <div style="font-size:11px; color:var(--tx-t); margin-top:2px;">담당: ${esc(c.manager)||'—'} · 제품 ${prods.length}종 · 납품 ${cDlvs.length}건</div>
          </div>
          <div style="text-align:right; margin-right:8px;">
            <div style="font-size:16px; font-weight:700; color:var(--tx-ok);">${fmtW(cAmt)}</div>
            <div style="font-size:10px; color:var(--tx-t);">납품 총액</div>
          </div>
          <button class="btn btn-sm" onclick="reopenProject('${c.id}')">
            <i class="ti ti-refresh"></i>프로젝트 재개
          </button>
        </div>
        <div style="overflow-x:auto;">
          ${cDlvs.length ? `
          <table style="font-size:11px;">
            <thead><tr>
              <th>납품번호</th><th>납품일자</th><th>제품명</th><th>규격</th><th>수량</th><th>단가</th><th>납품금액</th>
            </tr></thead>
            <tbody>
              ${cDlvs.map(d => `
                <tr>
                  <td style="font-family:monospace; color:var(--tx-i); font-weight:700;">${esc(d.id)}</td>
                  <td>${esc(d.deliveredAt)}</td>
                  <td style="font-weight:600;">${esc(d.productName)}</td>
                  <td style="color:var(--tx-t);">${esc(d.spec)||'—'}</td>
                  <td>${esc(d.qty)} ${esc(d.unit)}</td>
                  <td>${fmtW(d.price)}</td>
                  <td style="font-weight:700; color:var(--tx-ok);">${fmtW(d.price*d.qty)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr style="background:var(--bg-s);">
              <td colspan="6" style="font-size:11px; font-weight:700;">합계 ${cDlvs.length}건</td>
              <td style="font-weight:700; color:var(--tx-ok);">${fmtW(cAmt)}</td>
            </tr></tfoot>
          </table>` : `<div style="padding:14px 16px; font-size:11px; color:var(--tx-t); font-style:italic;">납품 기록 없음</div>`}
        </div>
      </div>`;
  }).join('');
}

function renderDeliveries() {
  ensureDateView('deliveries', 'dlv-table', deliveries.map(d=>d.deliveredAt), renderDeliveries);
  const visibleDeliveries = typeof visibleRecords === 'function' ? visibleRecords(deliveries, 'delivery') : deliveries;
  const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
  const fc = inp('dlv-filter-client');
  if (fc) {
    const cur = fc.value;
    fc.innerHTML = '<option value="">전체 고객사</option>' +
      visibleClients.map(c=>`<option value="${esc(c.id)}"${c.id===cur?' selected':''}>${esc(c.name)}</option>`).join('');
  }
  const fcVal = v('dlv-filter-client');
  const q = (v('dlv-q')||'').toLowerCase();
  let fil = visibleDeliveries.filter(d=>
    dateViewMatch('deliveries', d.deliveredAt) &&
    (!fcVal || d.clientId===fcVal) &&
    (!q || [d.productName,getClientName(d.clientId),d.id].join(' ').toLowerCase().includes(q))
  );

  if (sortState.deliveries.key) {
    const k = sortState.deliveries.key;
    const asc = sortState.deliveries.asc ? 1 : -1;
    fil.sort((a, b) => {
      let va, vb;
      if (k === 'client') {
        va = getClientName(a.clientId);
        vb = getClientName(b.clientId);
      } else if (k === 'totalAmt') {
        va = a.price * a.qty;
        vb = b.price * b.qty;
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

  const totalCnt = visibleDeliveries.length;
  const totalAmt = visibleDeliveries.reduce((s,d)=>s+d.price*d.qty,0);
  const thisMonth = visibleDeliveries.filter(d=>d.deliveredAt?.slice(0,7)===today().slice(0,7)).length;
  const clientCnt = new Set(visibleDeliveries.map(d=>d.clientId)).size;
  const kpi = inp('dlv-kpi');
  if (kpi) kpi.innerHTML = `
    <div class="mc"><div class="mc-lbl"><i class="ti ti-package-export"></i>전체 납품</div><div class="mc-val">${totalCnt}건</div><div class="mc-sub">전체 납품 기록</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-coin" style="color:var(--tx-ok);"></i>납품 총액</div><div class="mc-val" style="color:var(--tx-ok);">${fmtW(totalAmt)}</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-calendar" style="color:var(--tx-i);"></i>이번달</div><div class="mc-val" style="color:var(--tx-i);">${thisMonth}건</div><div class="mc-sub">${today().slice(0,7)}</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-building-community"></i>납품 고객사</div><div class="mc-val">${clientCnt}개사</div></div>`;

  // 종료 프로젝트 뱃지 업데이트
  const closedBadge = inp('dlv-closed-badge');
  if (closedBadge) {
    const visibleClients = typeof visibleRecords === 'function' ? visibleRecords(clients, 'clients') : clients;
    closedBadge.textContent = visibleClients.filter(c=>c.closed).length;
  }
  const el = inp('dlv-table'); if (!el) return;
  if (!fil.length) { el.innerHTML = empty('납품 기록이 없습니다. 공정관리에서 [납품] 단계로 변경하면 자동 등록됩니다.'); return; }
  el.innerHTML = `
    <table style="min-width:860px;">
      <thead><tr>
        <th onclick="toggleSort('deliveries', 'id')" style="cursor:pointer; user-select:none;">납품번호 ${sortIcon('deliveries', 'id')}</th>
        <th onclick="toggleSort('deliveries', 'deliveredAt')" style="cursor:pointer; user-select:none;">납품일자 ${sortIcon('deliveries', 'deliveredAt')}</th>
        <th onclick="toggleSort('deliveries', 'client')" style="cursor:pointer; user-select:none;">고객사 ${sortIcon('deliveries', 'client')}</th>
        <th onclick="toggleSort('deliveries', 'productName')" style="cursor:pointer; user-select:none;">제품명 ${sortIcon('deliveries', 'productName')}</th>
        <th onclick="toggleSort('deliveries', 'spec')" style="cursor:pointer; user-select:none;">규격 ${sortIcon('deliveries', 'spec')}</th>
        <th onclick="toggleSort('deliveries', 'qty')" style="cursor:pointer; user-select:none;">수량 ${sortIcon('deliveries', 'qty')}</th>
        <th onclick="toggleSort('deliveries', 'price')" style="cursor:pointer; user-select:none;">단가 ${sortIcon('deliveries', 'price')}</th>
        <th onclick="toggleSort('deliveries', 'totalAmt')" style="cursor:pointer; user-select:none;">납품금액 ${sortIcon('deliveries', 'totalAmt')}</th>
        <th onclick="toggleSort('deliveries', 'note')" style="cursor:pointer; user-select:none;">비고 ${sortIcon('deliveries', 'note')}</th>
        <th>삭제</th>
      </tr></thead>
      <tbody>
        ${fil.map(d=>`
          <tr>
            <td style="font-family:monospace;font-weight:700;font-size:11px;color:var(--tx-i);">${esc(d.id)}</td>
            <td style="font-size:11px;">${esc(d.deliveredAt)}</td>
            <td style="font-weight:600;">${esc(getClientName(d.clientId))}</td>
            <td style="font-weight:700;">${esc(d.productName)}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${esc(d.spec)||''}</span></td>
            <td style="font-size:11px;color:var(--tx-t);">${esc(d.spec)||'—'}</td>
            <td style="font-weight:700;">${esc(d.qty)} <span style="font-weight:400;">${esc(d.unit)}</span></td>
            <td class="amt-blue">${fmtW(d.price)}</td>
            <td style="font-weight:700;color:var(--tx-ok);">${fmtW(d.price*d.qty)}</td>
            <td style="font-size:11px;color:var(--tx-t);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(d.note)||'—'}</td>
            <td><button class="del-btn" onclick="deleteDelivery('${d.id}')"><i class="ti ti-trash"></i></button></td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr style="background:var(--bg-s);">
        <td colspan="7" style="font-size:11px;font-weight:700;">합계 ${fil.length}건</td>
        <td style="font-weight:700;color:var(--tx-ok);">${fmtW(fil.reduce((s,d)=>s+d.price*d.qty,0))}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>`;
}

function updateDlvBadge() {
  const el = inp('dlvBadge');
  if (el) el.textContent = deliveries.length;
}

function deleteDelivery(id) {
  if (!checkAdminAction()) return;
  const target = deliveries.find(x=>x.id===id);
  if (!target || (typeof requireRecordPermission === 'function' && !requireRecordPermission('delete', target, 'delivery'))) return;
  if (typeof guardFinanceMonth === 'function' && !guardFinanceMonth(target.deliveredAt || today())) return;
  confirm_('납품 기록 삭제', '이 납품 기록을 삭제하시겠습니까?<br><span style="font-size:11px;color:var(--tx-t);">제품 공정 정보는 유지됩니다.</span>', () => {
    deliveries = deliveries.filter(x=>x.id!==id);
    if (financeData && financeData.paidReceivable) delete financeData.paidReceivable[id];
    if (target) writeAuditLog('delivery', id, 'delete', target, null, { summary:'납품 기록 삭제' });
    saveStorage('deliveries', deliveries);
    if (financeData) saveStorage('financeData', financeData);
    updateDlvBadge();
    if (currentPage === 'deliveries') renderDeliveries();
    else renderDashboard();
    showToast('납품 기록이 삭제되었습니다.', 'info');
  });
}

function exportDeliveriesCSV() {
  if (typeof requireCsvAction === 'function' && !requireCsvAction('납품 현황 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['납품번호','납품일자','고객사','제품명','규격','수량','단위','단가','납품금액','비고'];
  const source = typeof visibleRecords === 'function' ? visibleRecords(deliveries, 'delivery') : deliveries;
  const rows = source.map(d => [d.id, d.deliveredAt, getClientName(d.clientId), d.productName, d.spec||'', d.qty, d.unit, d.price, d.price*d.qty, d.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([h, ...rows]);
  ws['!cols'] = h.map(c => ({ wch: Math.max(c.length+2, 12) }));
  XLSX.utils.book_append_sheet(wb, ws, '납품현황');
  XLSX.writeFile(wb, `MESPro_납품현황_${today().replace(/-/g,'')}.xlsx`);
  showToast('납품 현황 XLS 저장 완료');
}

function navToProduct(clientId, productId) {
  go('clients');
  setTimeout(() => {
    expandedClients.add(clientId);
    renderClients();
    const card = document.getElementById(`card-${clientId}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}
