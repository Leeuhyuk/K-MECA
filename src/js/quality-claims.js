/* ════════ 6. 품질 및 검사 관리 ════════ */
function renderQuality() {
  const totDefect = defects.reduce((s, d) => s + d.qty, 0);
  const openDefect = defects.filter(d => d.status !== '완료').length;
  const claimOpen = claims.filter(c => c.status !== '완료').length;

  inp('qc-kpi').innerHTML = `
    <div class="mc"><div class="mc-lbl"><i class="ti ti-alert-triangle" style="color:var(--tx-w);"></i>공정 내 불량 유실수</div><div class="mc-val">${totDefect}개</div><div class="mc-sub">${defects.length}회 검출</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-loader" style="color:var(--tx-i);"></i>개선/조치중 품질장애</div><div class="mc-val" style="color:var(--tx-i);">${openDefect}건</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-message-report" style="color:var(--tx-d);"></i>해외/고객사 제기 클레임</div><div class="mc-val">${claims.length}건</div><div class="mc-sub">처리중 ${claimOpen}건</div></div>
    <div class="mc"><div class="mc-lbl"><i class="ti ti-clipboard-check" style="color:var(--tx-ok);"></i>납품전수검사</div><div class="mc-val" style="color:var(--tx-ok);">${checkRecords.filter(c=>c.result==='합격').length}/${checkRecords.length}건</div><div class="mc-sub">통과/검사기록</div></div>`;

  fillClientSelect('df-client', false);
  fillStageSelect('df-stage');
  fillClientSelect('cl-client', false);
  fillClientSelect('ck-client', false);

  const _dfq = (v('df-q')||'').toLowerCase();
  const _dffs = v('df-fs');
  let filteredDefects = defects.filter(d => {
    const cname = getClientName(getProductById(d.productId)?.clientId);
    if (_dfq && ![d.id, getProductName(d.productId), cname, d.type, d.stage, d.cause||''].join(' ').toLowerCase().includes(_dfq)) return false;
    if (_dffs && d.status !== _dffs) return false;
    return true;
  });

  if (sortState.defects.key) {
    const k = sortState.defects.key;
    const asc = sortState.defects.asc ? 1 : -1;
    filteredDefects.sort((a, b) => {
      let va, vb;
      if (k === 'product') {
        va = getProductName(a.productId);
        vb = getProductName(b.productId);
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

  inp('defect-table').innerHTML = filteredDefects.length ? `
    <table>
      <thead>
        <tr>
          <th onclick="toggleSort('defects', 'id')" style="cursor:pointer; user-select:none;">코드 ${sortIcon('defects', 'id')}</th>
          <th onclick="toggleSort('defects', 'date')" style="cursor:pointer; user-select:none;">일자 ${sortIcon('defects', 'date')}</th>
          <th onclick="toggleSort('defects', 'product')" style="cursor:pointer; user-select:none;">제품 ${sortIcon('defects', 'product')}</th>
          <th onclick="toggleSort('defects', 'stage')" style="cursor:pointer; user-select:none;">발생공정 ${sortIcon('defects', 'stage')}</th>
          <th onclick="toggleSort('defects', 'type')" style="cursor:pointer; user-select:none;">하자유형 ${sortIcon('defects', 'type')}</th>
          <th onclick="toggleSort('defects', 'qty')" style="cursor:pointer; user-select:none;">수량 ${sortIcon('defects', 'qty')}</th>
          <th onclick="toggleSort('defects', 'status')" style="cursor:pointer; user-select:none;">상태 ${sortIcon('defects', 'status')}</th>
          <th onclick="toggleSort('defects', 'note')" style="cursor:pointer; user-select:none;">비고 ${sortIcon('defects', 'note')}</th>
          <th>관리 작업</th>
        </tr>
      </thead>
      <tbody>
        ${filteredDefects.map(d => `
          <tr>
            <td>${d.id}</td>
            <td>${d.date}</td>
            <td style="font-weight:600;">${getProductName(d.productId)}</td>
            <td>${d.stage}</td>
            <td style="font-weight:700; color:var(--tx-d);">${d.type}</td>
            <td style="font-weight:700;">${d.qty}</td>
            <td>
              <select class="stat-sel" onchange="changeDefectStatus('${d.id}', this.value)">
                <option${d.status==='조치중'?' selected':''}>조치중</option>
                <option${d.status==='완료'?' selected':''}>완료</option>
                <option${d.status==='보류'?' selected':''}>보류</option>
              </select>
            </td>
            <td><span style="font-size:11px; color:var(--tx-t);">${d.note || '—'}</span></td>
            <td>
              <button class="edit-btn" onclick="openDefectEdit('${d.id}')"><i class="ti ti-edit"></i></button>
              <button class="del-btn" onclick="deleteDefect('${d.id}')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>` : empty('검색 조건에 맞는 불량 이력이 없습니다.');

  const _clq = (v('cl-q')||'').toLowerCase();
  const _clfs = v('cl-fs');
  let filteredClaims = claims.filter(c => {
    if (_clq && ![c.id, getClientName(c.clientId), getProductName(c.productId), c.content||''].join(' ').toLowerCase().includes(_clq)) return false;
    if (_clfs && c.status !== _clfs) return false;
    return true;
  });

  if (sortState.claims.key) {
    const k = sortState.claims.key;
    const asc = sortState.claims.asc ? 1 : -1;
    filteredClaims.sort((a, b) => {
      let va, vb;
      if (k === 'client') {
        va = getClientName(a.clientId);
        vb = getClientName(b.clientId);
      } else if (k === 'product') {
        va = getProductName(a.productId);
        vb = getProductName(b.productId);
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

  inp('claim-table').innerHTML = filteredClaims.length ? `
    <table>
      <thead>
        <tr>
          <th onclick="toggleSort('claims', 'date')" style="cursor:pointer; user-select:none;">인입일 ${sortIcon('claims', 'date')}</th>
          <th onclick="toggleSort('claims', 'client')" style="cursor:pointer; user-select:none;">의뢰 고객사 ${sortIcon('claims', 'client')}</th>
          <th onclick="toggleSort('claims', 'product')" style="cursor:pointer; user-select:none;">해당 제품 / 메모 ${sortIcon('claims', 'product')}</th>
          <th onclick="toggleSort('claims', 'spec')" style="cursor:pointer; user-select:none;">사양 ${sortIcon('claims', 'spec')}</th>
          <th onclick="toggleSort('claims', 'response')" style="cursor:pointer; user-select:none;">조치 방안 ${sortIcon('claims', 'response')}</th>
          <th onclick="toggleSort('claims', 'status')" style="cursor:pointer; user-select:none;">상태 ${sortIcon('claims', 'status')}</th>
          <th>관리 작업</th>
        </tr>
      </thead>
      <tbody>
        ${filteredClaims.map(c => `
          <tr>
            <td style="vertical-align:top;">${c.date}</td>
            <td style="font-weight:600; vertical-align:top;">${getClientName(c.clientId)}</td>
            <td style="white-space:normal; min-width:160px; max-width:280px; vertical-align:top;">
              <div style="font-weight:700;">${getProductName(c.productId)}</div>
              <div style="font-size:11px; color:var(--tx-d); margin-top:4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.4; cursor:pointer; white-space:normal; word-break:break-all;" onclick="openClaimDetail('${c.id}')" title="클릭하여 상세 조회">${_escHtml(c.content)}</div>
            </td>
            <td style="white-space:normal; word-break:break-all; max-width:110px; vertical-align:top;">${_escHtml(c.spec||'—')}</td>
            <td style="font-size:11px; white-space:normal; word-break:break-all; max-width:180px; vertical-align:top;">${_escHtml(c.response || '—')}</td>
            <td style="vertical-align:top;">
              <select class="stat-sel" onchange="changeClaimStatus('${c.id}', this.value)">
                <option${c.status==='접수'?' selected':''}>접수</option>
                <option${c.status==='처리중'?' selected':''}>처리중</option>
                <option${c.status==='완료'?' selected':''}>완료</option>
              </select>
            </td>
            <td style="vertical-align:top; white-space:nowrap;">
              <button class="edit-btn" onclick="openClaimEdit('${c.id}')"><i class="ti ti-edit"></i></button>
              <button class="del-btn" onclick="deleteClaim('${c.id}')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>` : empty('검색 조건에 맞는 클레임 기록이 없습니다.');

  const _ckq = (v('ck-q')||'').toLowerCase();
  const _ckfs = v('ck-fs');
  let filteredChecks = checkRecords.filter(r => {
    if (_ckq && ![getProductName(r.productId), getClientName(r.clientId), r.inspector||''].join(' ').toLowerCase().includes(_ckq)) return false;
    if (_ckfs && r.result !== _ckfs) return false;
    return true;
  });

  if (sortState.checks.key) {
    const k = sortState.checks.key;
    const asc = sortState.checks.asc ? 1 : -1;
    filteredChecks.sort((a, b) => {
      let va, vb;
      if (k === 'client') {
        va = getClientName(a.clientId);
        vb = getClientName(b.clientId);
      } else if (k === 'product') {
        va = getProductName(a.productId);
        vb = getProductName(b.productId);
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

  inp('check-table').innerHTML = filteredChecks.length ? `
    <table>
      <thead>
        <tr>
          <th onclick="toggleSort('checks', 'date')" style="cursor:pointer; user-select:none;">검사일 ${sortIcon('checks', 'date')}</th>
          <th onclick="toggleSort('checks', 'client')" style="cursor:pointer; user-select:none;">의뢰처 ${sortIcon('checks', 'client')}</th>
          <th onclick="toggleSort('checks', 'product')" style="cursor:pointer; user-select:none;">완료제품 ${sortIcon('checks', 'product')}</th>
          <th onclick="toggleSort('checks', 'inspector')" style="cursor:pointer; user-select:none;">검사원 ${sortIcon('checks', 'inspector')}</th>
          <th onclick="toggleSort('checks', 'visual')" style="cursor:pointer; user-select:none;">외관 ${sortIcon('checks', 'visual')}</th>
          <th onclick="toggleSort('checks', 'dim')" style="cursor:pointer; user-select:none;">치수 ${sortIcon('checks', 'dim')}</th>
          <th onclick="toggleSort('checks', 'func')" style="cursor:pointer; user-select:none;">테스트 ${sortIcon('checks', 'func')}</th>
          <th onclick="toggleSort('checks', 'result')" style="cursor:pointer; user-select:none;">종합판정 ${sortIcon('checks', 'result')}</th>
          <th>관리 작업</th>
        </tr>
      </thead>
      <tbody>
        ${filteredChecks.map(r => `
          <tr>
            <td>${r.date}</td>
            <td style="font-weight:600;">${getClientName(r.clientId)}</td>
            <td>${getProductName(r.productId)}</td>
            <td>${r.inspector}</td>
            <td>${statusBadge(r.visual)}</td>
            <td>${statusBadge(r.dim)}</td>
            <td>${statusBadge(r.func)}</td>
            <td style="font-weight:700;">${statusBadge(r.result)}</td>
            <td>
              <button class="edit-btn" onclick="openCheckEdit('${r.id}')"><i class="ti ti-edit"></i></button>
              <button class="del-btn" onclick="deleteCheck('${r.id}')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>` : empty('검색 조건에 맞는 검사 기록이 없습니다.');

  // 클레임 전용 페이지도 함께 동기화
  if (typeof renderClaims === 'function') renderClaims();
}

/* ── 고객 클레임 전용 페이지 ── */
function _escHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderClaims() {
  const kpi = inp('claims-kpi');
  if (kpi) {
    const ing  = claims.filter(c => c.status === '처리중').length;
    const done = claims.filter(c => c.status === '완료').length;
    const fsCur = v('claims-fs') || '';
    // 클릭 시 claims-fs 필터 토글(같은 값 재클릭 시 전체 복구). 카운트=정확 상태라 필터 결과와 일치.
    const cl = (status, label, cnt, color, icon) =>
      '<div class="mc clickable'+(fsCur===status?' kpi-active':'')+'" onclick="kpiFilter(\'claims-fs\',\''+status+'\',\'renderClaims\')">' +
      '<div class="mc-lbl"><i class="ti '+icon+'" style="color:'+color+';"></i>'+label+'</div>' +
      '<div class="mc-val" style="color:'+color+';">'+cnt+'건</div></div>';
    kpi.innerHTML =
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-message-report" style="color:var(--tx-d);"></i>전체 클레임</div><div class="mc-val">'+claims.length+'건</div></div>' +
      cl('처리중', '처리중', ing, 'var(--tx-i)', 'ti-loader') +
      cl('완료', '처리 완료', done, 'var(--tx-ok)', 'ti-circle-check') +
      '<div class="mc"><div class="mc-lbl"><i class="ti ti-building-community" style="color:var(--tx-w);"></i>관련 고객사</div><div class="mc-val" style="color:var(--tx-w);">'+new Set(claims.map(c=>c.clientId)).size+'곳</div></div>';
  }

  // 클레임 등록 모달용 고객사 옵션 동기화
  fillClientSelect('cl-client', false);

  const cont = inp('claims-table-full'); if (!cont) return;
  const q = (v('claims-q')||'').toLowerCase();
  const fs = v('claims-fs');
  let list = claims.filter(c => {
    if (q && ![c.id, c.kind||'', claimClientLabel(c), claimProductLabel(c), c.content||'', c.response||''].join(' ').toLowerCase().includes(q)) return false;
    if (fs && c.status !== fs) return false;
    return true;
  });

  if (sortState.claims.key) {
    const k = sortState.claims.key, asc = sortState.claims.asc ? 1 : -1;
    list.sort((a, b) => {
      let va, vb;
      if (k === 'client') { va = claimClientLabel(a); vb = claimClientLabel(b); }
      else if (k === 'product') { va = claimProductLabel(a); vb = claimProductLabel(b); }
      else { va = a[k] == null ? '' : a[k]; vb = b[k] == null ? '' : b[k]; }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const trunc = (t, n) => { t = String(t||'').replace(/\s+/g,' ').trim(); return t ? (t.length > n ? _escHtml(t.slice(0,n))+'…' : _escHtml(t)) : '—'; };

  cont.innerHTML = list.length ? `
    <table style="min-width:780px;">
      <thead><tr>
        <th onclick="toggleSort('claims','date')" style="cursor:pointer;user-select:none;">인입일 ${sortIcon('claims','date')}</th>
        <th onclick="toggleSort('claims','kind')" style="cursor:pointer;user-select:none;">유형 ${sortIcon('claims','kind')}</th>
        <th onclick="toggleSort('claims','client')" style="cursor:pointer;user-select:none;">의뢰 고객사 ${sortIcon('claims','client')}</th>
        <th onclick="toggleSort('claims','product')" style="cursor:pointer;user-select:none;">해당 제품 ${sortIcon('claims','product')}</th>
        <th onclick="toggleSort('claims','spec')" style="cursor:pointer;user-select:none;">클레임 사양 ${sortIcon('claims','spec')}</th>
        <th>내용</th>
        <th>조치 방안</th>
        <th onclick="toggleSort('claims','status')" style="cursor:pointer;user-select:none;">상태 ${sortIcon('claims','status')}</th>
        <th>관리</th>
      </tr></thead>
      <tbody>
        ${list.map(c => `
          <tr>
            <td>${c.date||'—'}</td>
            <td><span class="bd ${c.kind==='AS'?'bd-info':c.kind==='기타'?'bd-neu':'bd-warn'}">${c.kind||'클레임'}</span></td>
            <td style="font-weight:600;">${claimClientLabel(c)}${c.clientName && !c.clientId?'<br><span style="font-size:9px;color:var(--tx-t);">미등록</span>':''}</td>
            <td>${claimProductLabel(c)}</td>
            <td>${_escHtml(c.spec||'—')}</td>
            <td style="max-width:340px; color:var(--tx-d); cursor:pointer;" onclick="openClaimDetail('${c.id}')" title="클릭하여 전체 보기">${trunc(c.content, 60)}</td>
            <td style="max-width:240px; font-size:11px; cursor:pointer;" onclick="openClaimDetail('${c.id}')" title="클릭하여 전체 보기">${trunc(c.response, 40)}</td>
            <td>
              <select class="stat-sel" onchange="changeClaimStatus('${c.id}', this.value)">
                <option${c.status==='접수'?' selected':''}>접수</option>
                <option${c.status==='처리중'?' selected':''}>처리중</option>
                <option${c.status==='완료'?' selected':''}>완료</option>
              </select>
            </td>
            <td style="white-space:nowrap;">
              <button class="btn btn-sm" onclick="openClaimDetail('${c.id}')" title="상세 보기"><i class="ti ti-eye"></i></button>
              <button class="edit-btn" onclick="openClaimEdit('${c.id}')"><i class="ti ti-edit"></i></button>
              <button class="del-btn" onclick="deleteClaim('${c.id}')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>` : empty('검색 조건에 맞는 클레임 기록이 없습니다. [클레임 등록] 버튼으로 추가하세요.');
}

function openClaimDetail(id) {
  const c = claims.find(x => x.id === id); if (!c) return;
  const stCls = { '접수':'bd-warn', '처리중':'bd-info', '완료':'bd-ok' }[c.status] || 'bd-neu';
  const memoBox = txt => `<div style="white-space:pre-wrap; word-break:break-word; line-height:1.6; font-size:13px; background:var(--bg-s); border:1px solid var(--br); border-radius:var(--rm); padding:10px 12px; max-height:240px; overflow-y:auto;" class="thin-scroll">${_escHtml(txt) || '<span style="color:var(--tx-t);">내용 없음</span>'}</div>`;
  inp('claim-detail-body').innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:18px; margin-bottom:14px; font-size:13px;">
      <div><span style="color:var(--tx-t); font-size:11px;">문서번호</span><br><b>${c.id}</b></div>
      <div><span style="color:var(--tx-t); font-size:11px;">유형</span><br><span class="bd ${c.kind==='AS'?'bd-info':c.kind==='기타'?'bd-neu':'bd-warn'}">${c.kind||'클레임'}</span></div>
      <div><span style="color:var(--tx-t); font-size:11px;">인입일</span><br><b>${c.date||'—'}</b></div>
      <div><span style="color:var(--tx-t); font-size:11px;">의뢰 고객사</span><br><b>${_escHtml(claimClientLabel(c))}</b>${c.clientName && !c.clientId?' <span style="font-size:10px;color:var(--tx-t);">(미등록)</span>':''}</div>
      <div><span style="color:var(--tx-t); font-size:11px;">해당 제품</span><br><b>${_escHtml(claimProductLabel(c))}</b></div>
      <div><span style="color:var(--tx-t); font-size:11px;">클레임 사양</span><br><b>${_escHtml(c.spec||'—')}</b></div>
      <div><span style="color:var(--tx-t); font-size:11px;">상태</span><br><span class="bd ${stCls}">${c.status}</span></div>
    </div>
    <div style="margin-bottom:12px;"><div style="font-size:12px; font-weight:700; color:var(--tx-s); margin-bottom:5px;"><i class="ti ti-message-report" style="color:var(--tx-d);"></i> 내용</div>${memoBox(c.content)}</div>
    <div><div style="font-size:12px; font-weight:700; color:var(--tx-s); margin-bottom:5px;"><i class="ti ti-tool"></i> 조치 방안</div>${memoBox(c.response)}</div>`;
  const editBtn = inp('claim-detail-edit-btn');
  if (editBtn) editBtn.onclick = () => { closeModal('claim-detail-modal'); openClaimEdit(id); };
  inp('claim-detail-modal').classList.add('open');
}

function openDefectAdd() {
  editDefectId = null;
  inp('defect-modal-ttl').innerHTML = '<i class="ti ti-plus"></i>제조 과정 불량 상세 리포트';
  inp('df-save-btn').innerHTML = '<i class="ti ti-check"></i>저장 완료';
  sv('df-id', nextCode('DF', defects));
  sv('df-date', today());
  sv('df-client', clients[0]?.id || '');
  fillProductSelect('df-product', clients[0]?.id || '');
  sv('df-stage', processStages[0]);
  sv('df-type', '');
  sv('df-qty', '1');
  sv('df-cause', '');
  sv('df-action', '');
  sv('df-status', '조치중');
  sv('df-note', '');
  inp('defect-modal').classList.add('open');
}

function openDefectEdit(id) {
  if (!checkAdminAction()) return;
  const d = defects.find(x => x.id === id); if (!d) return;
  editDefectId = id;
  inp('defect-modal-ttl').innerHTML = `<i class="ti ti-edit" style="color:var(--tx-w);"></i>불량 검출 분석서 수정 (${d.id})`;
  inp('df-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>수정 반영';
  
  const pr = getProductById(d.productId);
  sv('df-id', d.id);
  sv('df-date', d.date);
  sv('df-client', pr?.clientId || clients[0]?.id);
  fillProductSelect('df-product', pr?.clientId || clients[0]?.id, d.productId);
  sv('df-stage', d.stage);
  sv('df-type', d.type);
  sv('df-qty', d.qty);
  sv('df-cause', d.cause || '');
  sv('df-action', d.action || '');
  sv('df-status', d.status);
  sv('df-note', d.note || '');
  
  inp('defect-modal').classList.add('open');
}

function addDefect() {
  if (!checkAdminAction()) return;
  const type = v('df-type').trim();
  const qty = parseInt(v('df-qty'));
  if (!type || isNaN(qty) || qty <= 0) { showToast('불량 원인 유형 및 정확한 불량 수량을 명시해주세요.', 'error'); return; }
  
  if (editDefectId) {
    const d = defects.find(x => x.id === editDefectId); if (!d) return;
    d.productId = v('df-product');
    d.date = v('df-date');
    d.stage = v('df-stage');
    d.type = type;
    d.qty = qty;
    d.cause = v('df-cause');
    d.action = v('df-action');
    d.status = v('df-status');
    d.note = v('df-note');
  } else {
    defects.unshift({
      id: nextCode('DF', defects),
      productId: v('df-product'),
      date: v('df-date'),
      stage: v('df-stage'),
      type,
      qty,
      cause: v('df-cause'),
      action: v('df-action'),
      status: v('df-status'),
      note: v('df-note')
    });
  }
  saveStorage('defects', defects);
  editDefectId = null;
  closeModal('defect-modal');
  // 연관 생산지시 defect 카운트 동기화
  const productId = defects[0]?.productId || v('df-product');
  const relOrder = workOrders.find(o => o.productId === productId && o.status !== '완료');
  if (relOrder) {
    relOrder.defect = defects.filter(d => d.productId === productId).reduce((s, d) => s + d.qty, 0);
    saveStorage('workOrders', workOrders);
  }
  // 미처리 불량 알림 생성
  generateAlert('warn', `[불량 발생] ${v('df-type')||type} — ${getProductName(v('df-product')||productId)}`, `발생 공정: ${v('df-stage')} · 수량: ${qty}개`);
  renderQuality();
  showToast('불량 및 부적합 조치 내역이 보존 처리되었습니다.');
}

function changeDefectStatus(id, status) {
  if (!isAdmin) {
    promptAdmin(() => {
      const d = defects.find(x => x.id === id);
      if (d) { d.status = status; saveStorage('defects', defects); renderQuality(); }
    });
    refreshPage(currentPage);
    return;
  }
  const d = defects.find(x => x.id === id);
  if (d) { d.status = status; saveStorage('defects', defects); renderQuality(); }
}

/* 품질기록 - 고객 클레임 등록 / 수정 */
/* 클레임 고객사 select 옵션 (미등록 허용 위해 공란 포함) */
function _fillClaimClientSelect(selId) {
  inp('cl-client').innerHTML = '<option value="">-- 선택 (미등록 시 비움) --</option>' +
    clients.map(c => `<option value="${c.id}"${c.id===selId?' selected':''}>${c.name}</option>`).join('');
}

function openClaimAdd() {
  editClaimId = null;
  inp('claim-modal-ttl').innerHTML = '<i class="ti ti-plus"></i>신규 고객 클레임 / AS 접수';
  inp('cl-save-btn').innerHTML = '<i class="ti ti-check"></i>기록 접수';
  sv('cl-id', nextCode('CLM', claims));
  sv('cl-date', today());
  sv('cl-kind', '클레임');
  _fillClaimClientSelect('');
  fillProductSelect('cl-product', '');
  sv('cl-client-text', '');
  sv('cl-product-text', '');
  sv('cl-spec', '');
  sv('cl-content', '');
  sv('cl-status', '접수');
  sv('cl-response', '');
  inp('claim-modal').classList.add('open');
}

function openClaimEdit(id) {
  if (!checkAdminAction()) return;
  const c = claims.find(x => x.id === id); if (!c) return;
  editClaimId = id;
  inp('claim-modal-ttl').innerHTML = `<i class="ti ti-edit" style="color:var(--tx-w);"></i>클레임 / AS 내역 수정 (${c.id})`;
  inp('cl-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>수정 반영';
  sv('cl-id', c.id);
  sv('cl-date', c.date);
  sv('cl-kind', c.kind || '클레임');
  _fillClaimClientSelect(c.clientId);
  fillProductSelect('cl-product', c.clientId, c.productId);
  sv('cl-client-text', c.clientName || '');
  sv('cl-product-text', c.productName || '');
  sv('cl-spec', c.spec || '');
  sv('cl-content', c.content);
  sv('cl-status', c.status);
  sv('cl-response', c.response || '');
  inp('claim-modal').classList.add('open');
}

function addClaim() {
  if (!checkAdminAction()) return;
  const content = v('cl-content').trim();
  if (!content) { showToast('접수 내용을 구체적으로 기록해야 합니다.', 'error'); return; }
  const clientId = v('cl-client');
  const clientName = v('cl-client-text').trim();
  const productId = v('cl-product');
  const productName = v('cl-product-text').trim();
  if (!clientId && !clientName) { showToast('고객사를 선택하거나 직접 입력하세요.', 'error'); return; }
  const fields = {
    date: v('cl-date'),
    kind: v('cl-kind') || '클레임',
    clientId, clientName,
    productId, productName,
    spec: v('cl-spec').trim(),
    content,
    status: v('cl-status'),
    response: v('cl-response')
  };
  if (editClaimId) {
    const c = claims.find(x => x.id === editClaimId); if (!c) return;
    Object.assign(c, fields);
  } else {
    claims.unshift({ id: nextCode('CLM', claims), ...fields });
  }
  saveStorage('claims', claims);
  editClaimId = null;
  closeModal('claim-modal');
  renderQuality();
  showToast('클레임 / AS 내역이 저장되었습니다.');
}

/* 클레임 표시용 고객사·제품명 (미등록 직접입력 우선) */
function claimClientLabel(c) { return c.clientName || getClientName(c.clientId) || '—'; }
function claimProductLabel(c) { return c.productName || (c.productId ? getProductName(c.productId) : '') || '—'; }

function changeClaimStatus(id, status) {
  if (!isAdmin) {
    promptAdmin(() => {
      const c = claims.find(x => x.id === id);
      if (c) { c.status = status; saveStorage('claims', claims); renderQuality(); }
    });
    refreshPage(currentPage);
    return;
  }
  const c = claims.find(x => x.id === id);
  if (c) { c.status = status; saveStorage('claims', claims); renderQuality(); }
}

/* 품질기록 - 최종 출하 검증 체크리스트 추가 / 수정 */
function openCheckAdd() {
  editCheckId = null;
  inp('check-modal-ttl').innerHTML = '<i class="ti ti-clipboard-check"></i>납품 검사 성적 기록';
  inp('ck-save-btn').innerHTML = '<i class="ti ti-check"></i>저장 완료';
  sv('ck-id', nextCode('CHK', checkRecords));
  sv('ck-date', today());
  sv('ck-client', clients[0]?.id || '');
  fillProductSelect('ck-product', clients[0]?.id || '');
  sv('ck-inspector', '');
  sv('ck-visual', '합격');
  sv('ck-dim', '합격');
  sv('ck-func', '합격');
  sv('ck-result', '합격');
  sv('ck-note', '');
  inp('check-modal').classList.add('open');
}

function openCheckEdit(id) {
  if (!checkAdminAction()) return;
  const r = checkRecords.find(x => x.id === id); if (!r) return;
  editCheckId = id;
  inp('check-modal-ttl').innerHTML = `<i class="ti ti-edit" style="color:var(--tx-w);"></i>출하 품질 성적 검사서 수정 (${r.id})`;
  inp('ck-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>수정 반영';
  sv('ck-id', r.id);
  sv('ck-date', r.date);
  sv('ck-client', r.clientId);
  fillProductSelect('ck-product', r.clientId, r.productId);
  sv('ck-inspector', r.inspector || '');
  sv('ck-visual', r.visual);
  sv('ck-dim', r.dim);
  sv('ck-func', r.func);
  sv('ck-result', r.result);
  sv('ck-note', r.note || '');
  
  inp('check-modal').classList.add('open');
}

function addCheckRecord() {
  if (!checkAdminAction()) return;
  const inspector = v('ck-inspector').trim();
  if (!inspector) { showToast('검사 실무자의 성함(사인)이 필요합니다.', 'error'); return; }
  
  if (editCheckId) {
    const r = checkRecords.find(x => x.id === editCheckId); if (!r) return;
    r.date = v('ck-date');
    r.clientId = v('ck-client');
    r.productId = v('ck-product');
    r.inspector = inspector;
    r.visual = v('ck-visual');
    r.dim = v('ck-dim');
    r.func = v('ck-func');
    r.result = v('ck-result');
    r.note = v('ck-note');
  } else {
    checkRecords.unshift({
      id: nextCode('CHK', checkRecords),
      date: v('ck-date'),
      clientId: v('ck-client'),
      productId: v('ck-product'),
      inspector,
      visual: v('ck-visual'),
      dim: v('ck-dim'),
      func: v('ck-func'),
      result: v('ck-result'),
      note: v('ck-note')
    });
  }
  saveStorage('checkRecords', checkRecords);
  editCheckId = null;
  closeModal('check-modal');

  // 검사 합격 시 → 제품 공정단계 '완료' + 생산지시 완료 자동 연동
  const ckProductId = v('ck-product');
  const ckResult    = v('ck-result');
  const p = products.find(x => x.id === ckProductId);
  if (p) {
    if (ckResult === '합격') {
      p.processStage = '완료';
      p.status       = '완료';
      syncWorkOrdersOnProductComplete(ckProductId);
      showToast(`[${p.name}] 검사 합격 → 완료 단계 자동 처리`, 'success');
      generateAlert('info', `[출하준비 완료] ${p.name} 최종 검사 합격`, `검사원: ${inspector} · ${v('ck-date')}`);
    } else if (ckResult === '불합격') {
      generateAlert('err', `[검사 불합격] ${p.name} — 재작업 필요`, `검사원: ${inspector} · 외관:${v('ck-visual')} 치수:${v('ck-dim')} 기능:${v('ck-func')}`);
      showToast(`[${p.name}] 검사 불합격 → 알림 등록됨`, 'error');
    }
    saveStorage('products', products);
  }

  renderQuality();
  showToast('최종 완제품 품질검사 합격성적 대장이 반영되었습니다.');
}

function deleteDefect(id) {
  if (!checkAdminAction()) return;
  confirm_('불량 레포트 기록 삭제', '해당 품질 부적합 분석 파일을 데이터베이스에서 폐기하시겠습니까?', () => {
    const d = defects.find(x => x.id === id);
    if (d) {
      pushToTrash('defect', `${d.type} (불량기록)`, id, d);
      defects = defects.filter(x => x.id !== id);
      saveStorage('defects', defects);
      renderQuality();
      showToast('불량 분석 기록이 휴지통으로 이동했습니다.', 'info');
    }
  });
}
function deleteClaim(id) {
  if (!checkAdminAction()) return;
  confirm_('고객 클레임 소멸 확인', '해당 고객사의 소송/조치 클레임 파일을 완전히 파기하시겠습니까?', () => {
    const c = claims.find(x => x.id === id);
    if (c) {
      pushToTrash('claim', `${c.content} (고객클레임)`, id, c);
      claims = claims.filter(x => x.id !== id);
      saveStorage('claims', claims);
      renderQuality();
      showToast('클레임 기록이 휴지통으로 이동했습니다.', 'info');
    }
  });
}
function deleteCheck(id) {
  if (!checkAdminAction()) return;
  confirm_('검사 성적 삭제 확인', '완제품 출하 품질 성적 체크 대장에서 지우시겠습니까?', () => {
    const r = checkRecords.find(x => x.id === id);
    if (r) {
      pushToTrash('check', `${getProductName(r.productId)} - ${r.inspector} (검사기록)`, id, r);
      checkRecords = checkRecords.filter(x => x.id !== id);
      saveStorage('checkRecords', checkRecords);
      renderQuality();
      showToast('검사 성적 대장이 휴지통으로 이동했습니다.', 'info');
    }
  });
}

function exportDefectsCSV() {
  const h = ['코드','발생일자','완제품모델','공정단계','하자유형','수량','원인파악','조치사항','상태','비고'];
  const rows = defects.map(d => [
    d.id, d.date, getProductName(d.productId), d.stage, d.type, d.qty, d.cause || '', d.action || '', d.status, d.note || ''
  ]);
  const csv = '\uFEFF' + [h, ...rows].map(r => r.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `MESPro_공정불량기록_${today()}.csv`;
  a.click();
  showToast('공정 내 불량 리포트 로그가 엑셀로 출력되었습니다.');
}

function exportClaimsCSV() {
  const h = ['클레임코드','접수일자','의뢰고객사','완제품모델','클레임사양','불만및피드백사항','조치방안','처리상태'];
  const rows = claims.map(c => [
    c.id, c.date, claimClientLabel(c), claimProductLabel(c), c.spec || '', c.content, c.response || '', c.status
  ]);
  const csv = '\uFEFF' + [h, ...rows].map(r => r.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `MESPro_고객클레임기록_${today()}.csv`;
  a.click();
  showToast('고객사 품질 제기 클레임 내역서가 엑셀로 출력되었습니다.');
}

function exportChecksCSV() {
  const h = ['검사코드','출하검사일','고객사명','완성품명','인스펙터','외관테스트','치수계측','기능검사','종합판정','비고'];
  const rows = checkRecords.map(r => [
    r.id, r.date, getClientName(r.clientId), getProductName(r.productId), r.inspector, r.visual, r.dim, r.func, r.result, r.note || ''
  ]);
  const csv = '\uFEFF' + [h, ...rows].map(r => r.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `MESPro_출하검사성적표_${today()}.csv`;
  a.click();
  showToast('완제품 출하 검사 체크리스트 전체 데이터 성적표가 엑셀로 출력되었습니다.');
}
