/* ════════ 거래처 관리 ════════ */
function getPartnerPerformance(partnerName) {
  const pos = poList.filter(function(p) { return p.supplier === partnerName; });
  if (!pos.length) return null;
  var completed = pos.filter(function(p) { return p.status === '입고완료'; }).length;
  var pending = pos.filter(function(p) { return p.status !== '입고완료'; });
  var late = 0, totalDelay = 0;
  pending.forEach(function(po) {
    if (po.dueDate) {
      var due = new Date(po.dueDate);
      var now = new Date();
      if (now > due) { late++; totalDelay += Math.ceil((now - due) / 86400000); }
    }
  });
  var total = completed + late;
  var onTimeRate = total > 0 ? Math.round(completed / total * 100) : null;
  var totalAmt = pos.reduce(function(s, p) { return s + (Number(p.unitPrice)||0)*(Number(p.qty)||0); }, 0);
  return {
    total: pos.length,
    completed: completed,
    pending: pending.length,
    onTimeRate: onTimeRate,
    avgDelay: late > 0 ? Math.round(totalDelay / late) : 0,
    totalAmt: totalAmt
  };
}
function filterPartners(type) {
  const sel = inp('bp-ft');
  if (sel) sel.value = (sel.value === type) ? '' : type;   // 같은 유형 재클릭 시 전체 복구(토글)
  renderPartners();
  go('partners', document.querySelector('.ni[onclick*="partners"]'));
}

function renderPartners() {
  const total = partners.length;
  const sup   = partners.filter(p => p.type === '공급처').length;
  const buy   = partners.filter(p => p.type === '구매처').length;
  const out   = partners.filter(p => p.type === '외주처').length;
  const setEl = (id, v) => { const el = inp(id); if(el) el.textContent = v; };
  setEl('bp-kpi-total', total + '개사');
  setEl('bp-kpi-sup',   sup);
  setEl('bp-kpi-buy',   buy);
  setEl('bp-kpi-out',   out);
  _kpiActive('bp-ft', {'공급처':'bp-kpi-sup','구매처':'bp-kpi-buy','외주처':'bp-kpi-out'});

  const ft = v('bp-ft'), q = v('bp-q').toLowerCase();
  const rows = partners.filter(p => {
    if (ft && p.type !== ft) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.manager||'').toLowerCase().includes(q) && !(p.email||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.partners.key) {
    const k = sortState.partners.key, asc = sortState.partners.asc ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[k] == null ? '' : a[k], vb = b[k] == null ? '' : b[k];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const cont = inp('bp-table');
  if (!rows.length) { cont.innerHTML = '<div class="empty"><i class="ti ti-inbox"></i>해당 조건의 거래처가 없습니다.</div>'; return; }

  const typeColor = { '공급처':'bd-info', '구매처':'bd-ok', '외주처':'bd-warn', '기타':'bd-neu' };
  const _bpth = (k, l, s, t) => `<th data-field="${k}" data-type="${t||'text'}" onclick="toggleSort('partners','${k}')" style="cursor:pointer;user-select:none;${s||''}">${l} ${sortIcon('partners',k)}</th>`;
  cont.innerHTML = `<table style="min-width:900px;">
    <thead><tr>
      ${_bpth('id','코드')}${_bpth('name','거래처명')}${_bpth('type','유형')}${_bpth('manager','담당자')}
      <th data-field="tel" data-type="text">전화번호</th><th data-field="email" data-type="text">이메일</th><th data-field="bizNo" data-type="text">사업자번호</th><th data-field="note" data-type="text">비고</th><th style="text-align:center;">납기이행률</th><th>거래금액</th><th>관리</th>
    </tr></thead>
    <tbody>${rows.map(p => {
      var perf = (p.type === '공급처' || p.type === '외주처') ? getPartnerPerformance(p.name) : null;
      var perfHtml = perf
        ? '<td style="text-align:center;">' +
          (perf.onTimeRate !== null
            ? '<span class="bd ' + (perf.onTimeRate >= 80 ? 'bd-ok' : perf.onTimeRate >= 60 ? 'bd-warn' : 'bd-err') + '">' + perf.onTimeRate + '%</span>' +
              '<div style="font-size:10px;color:var(--tx-t);">' + perf.completed + '/' + perf.total + '건</div>'
            : '<span style="color:var(--tx-t);">—</span>') +
          '</td><td style="font-weight:600;color:var(--tx-i);">' + (perf.totalAmt > 0 ? fmtW(perf.totalAmt) : '—') + '</td>'
        : '<td>—</td><td>—</td>';
      return `
      <tr>
        <td style="font-size:11px;color:var(--tx-t);">${p.id}</td>
        <td style="font-weight:700;">${p.name}</td>
        <td><span class="bd ${typeColor[p.type]||'bd-neu'}">${p.type}</span></td>
        <td>${p.manager||'—'}</td>
        <td>${p.tel||p.mobile||'—'}</td>
        <td style="font-size:11px;">${p.email?`<a href="mailto:${p.email}" style="color:var(--tx-i);">${p.email}</a>`:'—'}</td>
        <td style="font-size:11px;color:var(--tx-t);">${p.bizNo||'—'}</td>
        <td style="font-size:11px;color:var(--tx-t);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.note||''}">${p.note||'—'}</td>
        ${perfHtml}
        <td>
          <button class="edit-btn" onclick="openPartnerModal('${p.id}')"><i class="ti ti-edit"></i>수정</button>
          <button class="del-btn" style="margin-left:4px;" onclick="deletePartner('${p.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  setTimeout(() => { const c = inp('bp-table'); if (c && typeof gridify==='function') gridify(c, { data: () => partners, save: () => saveStorage('partners', partners), rerender: renderPartners, idField: 'id' }); }, 0);
}

function openPartnerModal(id) {
  const modal = inp('partner-modal');
  delete modal.dataset.editId;
  if (id) {
    const p = partners.find(x => x.id === id);
    if (!p) return;
    modal.dataset.editId = id;
    inp('partner-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>거래처 수정';
    inp('bp-name').value   = p.name;     inp('bp-type').value   = p.type;
    inp('bp-mgr').value    = p.manager||''; inp('bp-tel').value  = p.tel||'';
    inp('bp-mobile').value = p.mobile||''; inp('bp-email').value = p.email||'';
    inp('bp-fax').value    = p.fax||'';  inp('bp-bizno').value  = p.bizNo||'';
    inp('bp-addr').value   = p.address||''; inp('bp-note').value = p.note||'';
  } else {
    inp('partner-modal-ttl').innerHTML = '<i class="ti ti-address-book" style="color:var(--tx-i);"></i>거래처 등록';
    ['bp-name','bp-mgr','bp-tel','bp-mobile','bp-email','bp-fax','bp-bizno','bp-addr','bp-note'].forEach(id => { if(inp(id)) inp(id).value=''; });
    inp('bp-type').value = '공급처';
  }
  modal.classList.add('open');
}

function savePartnerForm() {
  if (!checkAdminAction()) return;
  if (!v('bp-name')) { showToast('거래처명을 입력하세요.', 'error'); return; }
  const modal  = inp('partner-modal');
  const editId = modal.dataset.editId;
  const obj = {
    id: editId || nextCode('BP', partners),
    name: v('bp-name'), type: v('bp-type'),
    manager: v('bp-mgr'), tel: v('bp-tel'), mobile: v('bp-mobile'),
    email: v('bp-email'), fax: v('bp-fax'), bizNo: v('bp-bizno'),
    address: v('bp-addr'), note: v('bp-note')
  };
  if (editId) {
    const idx = partners.findIndex(p => p.id === editId);
    if (idx !== -1) partners[idx] = obj;
  } else {
    partners.unshift(obj);
  }
  saveStorage('partners', partners);
  closeModal('partner-modal');
  if (document.getElementById('pg-partners')?.classList.contains('active')) renderPartners();
  showToast(editId ? '거래처가 수정되었습니다.' : '거래처가 등록되었습니다.');
  // picker가 열려 있으면 목록 갱신
  if (inp('partner-picker-modal')?.classList.contains('open')) renderPickerList();
}

function deletePartner(id) {
  if (!checkAdminAction()) return;
  if (!confirm('이 거래처를 삭제하시겠습니까?')) return;
  partners = partners.filter(p => p.id !== id);
  saveStorage('partners', partners);
  renderPartners();
  showToast('거래처가 삭제되었습니다.');
}

function exportPartnersXLS() {
  if (!partners.length) { showToast('내보낼 거래처 데이터가 없습니다.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const hdr = ['코드','거래처명','유형','담당자','전화번호','휴대폰','이메일','팩스','사업자번호','주소','비고'];
  const rows = partners.map(p => [p.id, p.name, p.type, p.manager||'', p.tel||'', p.mobile||'', p.email||'', p.fax||'', p.bizNo||'', p.address||'', p.note||'']);
  const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
  ws['!cols'] = [8,16,8,10,12,12,20,12,12,20,16].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, '거래처');
  XLSX.writeFile(wb, '거래처_' + today() + '.xlsx');
  showToast('엑셀 파일이 저장되었습니다.');
}

/* ── 거래처 피커 ── */
let _pickerCallback = null;

function openPartnerPicker(callback) {
  _pickerCallback = callback;
  if(inp('pp-q'))  inp('pp-q').value  = '';
  if(inp('pp-ft')) inp('pp-ft').value = '';
  renderPickerList();
  inp('partner-picker-modal').classList.add('open');
}

function renderPickerList() {
  const q  = (v('pp-q')||'').toLowerCase();
  const ft = v('pp-ft')||'';
  const list = partners.filter(p => {
    if (ft && p.type !== ft) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.manager||'').toLowerCase().includes(q) && !(p.email||'').toLowerCase().includes(q)) return false;
    return true;
  });
  const cont = inp('pp-list');
  if (!list.length) {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx-t);font-size:12px;">검색 결과가 없습니다.<br>아래 버튼으로 새 거래처를 등록하세요.</div>';
    return;
  }
  const typeColor = { '공급처':'bd-info', '구매처':'bd-ok', '외주처':'bd-warn', '기타':'bd-neu' };
  cont.innerHTML = list.map(p => `
    <div onclick="selectPartner('${p.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--br);transition:background .1s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background=''">
      <span class="bd ${typeColor[p.type]||'bd-neu'}" style="flex-shrink:0;">${p.type}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${p.name}</div>
        <div style="font-size:11px;color:var(--tx-t);">${p.manager?p.manager+' · ':''}${p.tel||p.mobile||''}${p.email?' · '+p.email:''}</div>
      </div>
      <span style="font-size:11px;color:var(--tx-i);flex-shrink:0;">선택 →</span>
    </div>`).join('');
}

function selectPartner(id) {
  const p = partners.find(x => x.id === id);
  if (!p || !_pickerCallback) return;
  _pickerCallback(p);
  closeModal('partner-picker-modal');
}

/* ── 고객사 피커 (거래명세표·세금계산서 등 고객사 선택용) ── */
let _clientPickerCb = null;
function openClientPicker(callback){
  _clientPickerCb = callback;
  if(inp('cp-q')) inp('cp-q').value = '';
  renderClientPickerList();
  inp('client-picker-modal').classList.add('open');
}
function renderClientPickerList(){
  const q = (v('cp-q')||'').toLowerCase();
  const list = clients.filter(c => !q || [c.name, c.manager||'', c.tel||'', c.email||''].join(' ').toLowerCase().includes(q));
  const cont = inp('cp-list');
  if (!list.length){ cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx-t);font-size:12px;">검색 결과가 없습니다.<br>아래 버튼으로 새 고객사를 등록하세요.</div>'; return; }
  cont.innerHTML = list.map(c => `
    <div onclick="selectClientPick('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--br);transition:background .1s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background=''">
      <span class="bd bd-info" style="flex-shrink:0;">고객사</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${c.name}</div>
        <div style="font-size:11px;color:var(--tx-t);">${c.manager?c.manager+' · ':''}${c.tel||''}${c.email?' · '+c.email:''}</div>
      </div>
      <span style="font-size:11px;color:var(--tx-i);flex-shrink:0;">선택 →</span>
    </div>`).join('');
}
function selectClientPick(id){
  const c = clients.find(x => x.id === id);
  if (!c || !_clientPickerCb) return;
  _clientPickerCb(c);
  closeModal('client-picker-modal');
}

function openPartnerModalFromPicker() {
  closeModal('partner-picker-modal');
  openPartnerModal();
  // 저장 후 피커가 다시 열리도록 콜백 유지
  const origSave = window._pickerCallbackAfterSave = _pickerCallback;
  const origSavePartner = window.savePartnerForm;
  inp('bp-save-btn').onclick = function() {
    origSavePartner();
    // 새로 등록된 거래처 자동 선택
    if (origSave && partners.length) {
      const newest = partners[0];
      origSave(newest);
    }
  };
}
