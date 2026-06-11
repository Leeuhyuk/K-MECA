/* ════════ 고객 A/S · 사후관리 ════════ */
let editAsId = null;
function asWorkerName(id){ const w = workers.find(x=>x.id===id); return w ? w.name : (id||'미배정'); }
function updateAsBadge(){
  const open = asList.filter(a => a.status==='접수' || a.status==='처리중').length;
  const b = inp('asBadge'); if(!b) return;
  b.textContent = open; b.style.display = open>0 ? '' : 'none';
}
function renderAS(){
  const body = inp('as-body'); if(!body) return;
  const kpi = inp('as-kpi');
  updateAsBadge();
  const fil = (inp('as-filter')?.value)||'';
  const q = ((inp('as-search')?.value)||'').toLowerCase();
  const total = asList.length;
  const open = asList.filter(a=>a.status==='접수'||a.status==='처리중').length;
  const done = asList.filter(a=>a.status==='완료').length;
  const paidCost = asList.reduce((s,a)=>s+(a.warranty==='유상'?(Number(a.cost)||0):0),0);
  const list = asList.filter(a=>{
    if (fil === 'open') { if (!(a.status==='접수'||a.status==='처리중')) return false; }
    else if (fil && a.status!==fil) return false;
    if (q && ![getClientName(a.clientId),a.productName,a.symptom,a.id].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
  if (sortState.as.key) {
    const k = sortState.as.key, asc = sortState.as.asc ? 1 : -1;
    list.sort((a, b) => {
      let va, vb;
      if (k === 'client') { va = getClientName(a.clientId); vb = getClientName(b.clientId); }
      else { va = a[k] == null ? '' : a[k]; vb = b[k] == null ? '' : b[k]; }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  } else {
    list.sort((a,b)=>(b.recvDate||'').localeCompare(a.recvDate||''));
  }
  const _asth = (k, l, s) => `<th onclick="toggleSort('as','${k}')" style="cursor:pointer;user-select:none;${s||''}">${l} ${sortIcon('as',k)}</th>`;
  const rows = list.length ? list.map(a=>`
    <tr>
      <td style="font-weight:700;">${esc(a.id)}</td>
      <td>${esc(a.recvDate)||'—'}</td>
      <td style="font-weight:700;">${esc(getClientName(a.clientId))}</td>
      <td>${esc(a.productName)||'—'}</td>
      <td style="max-width:220px;">${esc(a.symptom)||'—'}</td>
      <td style="text-align:center;"><span class="bd ${a.warranty==='유상'?'bd-warn':'bd-ok'}">${esc(a.warranty)||'보증'}</span></td>
      <td style="text-align:center;">${statusBadge(a.status||'접수')}</td>
      <td>${esc(asWorkerName(a.owner))}</td>
      <td style="text-align:right;">${a.warranty==='유상'?fmtW(a.cost||0):'—'}</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="btn btn-sm" onclick="openAsEdit('${a.id}')" title="수정"><i class="ti ti-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteAS('${a.id}')" title="삭제"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="10">${empty('등록된 A/S 건이 없습니다.')}</td></tr>`;
  if (kpi) kpi.innerHTML = `
      <div class="mc"><div class="mc-lbl"><i class="ti ti-tool"></i>전체 A/S</div><div class="mc-val">${total}건</div></div>
      <div class="mc clickable${fil==='open'?' kpi-active':''}" onclick="kpiFilter('as-filter','open','renderAS')"><div class="mc-lbl"><i class="ti ti-loader" style="color:var(--tx-w);"></i>미완료(접수·처리중)</div><div class="mc-val" style="color:var(--tx-w);">${open}건</div></div>
      <div class="mc clickable${fil==='완료'?' kpi-active':''}" onclick="kpiFilter('as-filter','완료','renderAS')"><div class="mc-lbl"><i class="ti ti-checks" style="color:var(--tx-ok);"></i>처리 완료</div><div class="mc-val" style="color:var(--tx-ok);">${done}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-coin" style="color:var(--tx-i);"></i>유상 수리 합계</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(paidCost)}</div></div>`;
  body.innerHTML = `
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-tool"></i>A/S 접수 대장</span><span style="font-size:11px;color:var(--tx-t);">${list.length}건 표시</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr>
          ${_asth('id','접수번호')}${_asth('recvDate','접수일')}${_asth('client','고객사')}${_asth('productName','제품')}
          <th>증상</th>${_asth('warranty','보증','text-align:center;')}${_asth('status','상태','text-align:center;')}
          ${_asth('owner','담당자')}${_asth('cost','수리비','text-align:right;')}<th style="text-align:center;">관리</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}
function _asClientOptions(sel){ return clients.map(c=>`<option value="${esc(c.id)}"${c.id===sel?' selected':''}>${esc(c.name)}</option>`).join(''); }
function _asWorkerOptions(sel){ return '<option value="">미배정</option>'+workers.map(w=>`<option value="${esc(w.id)}"${w.id===sel?' selected':''}>${esc(w.name)}${w.dept?' · '+esc(w.dept):''}</option>`).join(''); }
function openAsAdd(){
  editAsId = null;
  inp('as-modal-ttl').innerHTML = '<i class="ti ti-tool" style="color:var(--tx-i);"></i>A/S 접수 등록';
  sv('asa-id', nextCode('AS', asList));
  inp('asa-client').innerHTML = _asClientOptions();
  inp('asa-owner').innerHTML = _asWorkerOptions();
  sv('asa-product',''); sv('asa-recv', today()); sv('asa-symptom','');
  sv('asa-warranty','보증'); sv('asa-status','접수'); sv('asa-action','');
  sv('asa-done',''); sv('asa-cost','0'); sv('asa-note','');
  inp('as-modal').classList.add('open');
}
function openAsEdit(id){
  const a = asList.find(x=>x.id===id); if(!a) return;
  editAsId = id;
  inp('as-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>A/S 정보 수정';
  sv('asa-id', a.id);
  inp('asa-client').innerHTML = _asClientOptions(a.clientId);
  inp('asa-owner').innerHTML = _asWorkerOptions(a.owner);
  sv('asa-product', a.productName||''); sv('asa-recv', a.recvDate||''); sv('asa-symptom', a.symptom||'');
  sv('asa-warranty', a.warranty||'보증'); sv('asa-status', a.status||'접수'); sv('asa-action', a.action||'');
  sv('asa-done', a.doneDate||''); sv('asa-cost', a.cost||'0'); sv('asa-note', a.note||'');
  inp('as-modal').classList.add('open');
}
function saveAsModal(){
  if (!checkAdminAction()) return;
  const clientId = v('asa-client');
  const symptom = v('asa-symptom').trim();
  if (!symptom) { showToast('증상/접수 내용은 필수입니다.', 'error'); return; }
  const rec = {
    clientId, productName: v('asa-product').trim(), recvDate: v('asa-recv')||today(),
    symptom, warranty: v('asa-warranty'), status: v('asa-status'), owner: v('asa-owner'),
    action: v('asa-action'), doneDate: v('asa-done'), cost: parseInt(v('asa-cost'))||0, note: v('asa-note')
  };
  if (editAsId) {
    const a = asList.find(x=>x.id===editAsId); if(a) Object.assign(a, rec);
    showToast('A/S 정보가 수정되었습니다.');
  } else {
    const newAs = Object.assign({ id: nextCode('AS', asList) }, rec);
    asList.push(newAs);
    showToast('A/S 접수가 등록되었습니다.');
    if (typeof sendAlimtalkAsRegistered === 'function') sendAlimtalkAsRegistered(newAs);
  }
  saveStorage('asList', asList);
  closeModal('as-modal');
  renderAS();
}
function deleteAS(id){
  if (!checkAdminAction()) return;
  if (!confirm('이 A/S 기록을 삭제하시겠습니까?')) return;
  asList = asList.filter(x=>x.id!==id);
  saveStorage('asList', asList);
  renderAS();
  showToast('A/S 기록이 삭제되었습니다.');
}
