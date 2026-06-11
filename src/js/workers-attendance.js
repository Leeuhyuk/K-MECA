/* ════════ 7. 작업 인력 및 출석 관리 ════════ */
function renderWorkers() {
  const att = workers.filter(w => w.status !== '결근' && w.status !== '휴가').length;
  inp('w-total').textContent = workers.length + '명';
  inp('w-att').textContent = att + '명';
  const absEl = inp('w-abs');
  if (absEl) absEl.textContent = `휴직/오프: ${workers.length - att}명 (휴가 포함)`;
  const regCnt = workers.filter(w => (w.empType||'정규직') === '정규직').length;
  const conCnt = workers.length - regCnt;
  if (inp('w-emptype')) inp('w-emptype').textContent = `${regCnt} / ${conCnt}명`;
  const payroll = workers.reduce((s, w) => s + (Number(w.salary)||0), 0);
  if (inp('w-payroll'))   inp('w-payroll').textContent   = fmtW(payroll);
  if (inp('w-payroll-y')) inp('w-payroll-y').textContent = fmtW(payroll * 12);

  const _wq = (v('workers-q')||'').toLowerCase();
  const _wfs = v('workers-fs');
  const filteredWorkers = workers.filter(w => {
    if (_wq && ![w.id, w.name, w.dept||'', w.position||'', w.line, w.role||''].join(' ').toLowerCase().includes(_wq)) return false;
    if (_wfs && w.status !== _wfs) return false;
    return true;
  });
  if (sortState.workers.key) {
    const k = sortState.workers.key, asc = sortState.workers.asc ? 1 : -1;
    filteredWorkers.sort((a, b) => {
      const va = a[k] == null ? '' : a[k], vb = b[k] == null ? '' : b[k];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }
  const el = inp('workers-table'); if (!el) return;
  const canManage = (currentRole==='admin');
  const ROLE_OPT = (sel)=>['admin','manager','staff'].map(r=>`<option value="${r}"${(sel||'staff')===r?' selected':''}>${ROLE_LABEL[r]}</option>`).join('');
  // 직원 행의 계정/역할/승인 셀 (이메일로 로그인 계정 조인)
  function acctCells(w){
    if (!_cloudActive) return `<td style="color:var(--tx-t);">—</td><td style="color:var(--tx-t);">—</td>`;
    const u = userByEmail(w.email);
    if (!w.email) return `<td style="color:var(--tx-t);">이메일 미입력</td><td>—</td>`;
    if (!u) return `<td style="color:var(--tx-d);">계정 없음</td><td>—</td>`;
    const isOwner = BOOTSTRAP_ADMIN_EMAILS.includes((u.email||'').toLowerCase());
    const act = u.active!==false;
    const roleCell = (canManage && !isOwner)
      ? `<select class="stat-sel" onchange="permSetRole('${u.uid}',this.value)">${ROLE_OPT(u.role)}</select>`
      : `<span class="bd bd-info">${ROLE_LABEL[u.role||'staff']}</span>${isOwner?' <span style="font-size:9px;color:var(--tx-t);">소유자</span>':''}`;
    const apprCell = (canManage && !isOwner)
      ? `<button class="btn btn-sm" onclick="permToggleActive('${u.uid}',${act})">${act?'비활성화':'승인'}</button>`
      : `<span class="bd ${act?'bd-ok':'bd-err'}">${act?'활성':'대기'}</span>`;
    return `<td>${roleCell}</td><td style="text-align:center;">${apprCell}</td>`;
  }
  const tableHTML = (!workers.length)
    ? empty('등록된 직원이 아직 없습니다.')
    : (!filteredWorkers.length)
      ? empty('검색 조건에 맞는 직원이 없습니다.')
      : `<table>
      <thead>
        <tr>
          ${['id:사번','name:이름','dept:부서','position:직급','empType:고용형태','hireDate:입사일'].map(s=>{const[k,l]=s.split(':');return`<th onclick="toggleSort('workers','${k}')" style="cursor:pointer;user-select:none;">${l} ${sortIcon('workers',k)}</th>`;}).join('')}
          <th>연락처</th>
          <th onclick="toggleSort('workers','salary')" style="cursor:pointer;user-select:none;">월 급여 ${sortIcon('workers','salary')}</th>
          <th onclick="toggleSort('workers','status')" style="cursor:pointer;user-select:none;">상태 ${sortIcon('workers','status')}</th>
          <th>계정 역할</th><th>승인</th><th>관리</th>
        </tr>
      </thead>
      <tbody>
        ${filteredWorkers.map(w => `
          <tr>
            <td style="font-weight:700;">${esc(w.id)}</td>
            <td style="font-weight:700;">${esc(w.name)}<span style="font-size:10px;color:var(--tx-t);font-weight:400;display:block;">${esc(w.email)||''}</span></td>
            <td>${esc(w.dept) || '—'}</td>
            <td>${esc(w.position) || '—'}</td>
            <td><span class="bd bd-neu">${esc(w.empType) || '정규직'}</span></td>
            <td>${esc(w.hireDate) || '—'}</td>
            <td>${esc(w.phone) || '—'}</td>
            <td style="font-weight:700;color:var(--tx-i);">${w.salary ? fmtW(w.salary) : '—'}</td>
            <td>
              <select class="stat-sel" onchange="changeWorkerStatus('${w.id}', this.value)">
                <option${w.status==='근무중'?' selected':''}>근무중</option>
                <option${w.status==='정비지원'?' selected':''}>정비지원</option>
                <option${w.status==='결근'?' selected':''}>결근</option>
                <option${w.status==='휴가'?' selected':''}>휴가</option>
              </select>
            </td>
            ${acctCells(w)}
            <td style="white-space:nowrap;">
              <button class="btn btn-sm" onclick="openWorkerEdit('${w.id}')" title="편집"><i class="ti ti-edit"></i></button>
              <button class="del-btn" onclick="deleteWorker('${w.id}')" title="삭제"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  // 미등록 로그인 계정(명부에 이메일 매칭 안 됨) — 관리자만
  let orphanHTML = '';
  if (_cloudActive && canManage){
    const matched = new Set(workers.map(w=>(w.email||'').toLowerCase()).filter(Boolean));
    const orphans = cloudUsers.filter(u=> !matched.has((u.email||'').toLowerCase()));
    if (orphans.length){
      orphanHTML = `
      <div class="card" style="margin-top:16px;">
        <div class="card-hd"><span class="card-ttl"><i class="ti ti-user-question" style="color:var(--tx-w);"></i>미등록 로그인 계정 (직원 명부에 없음)</span>
          <span style="font-size:11px;color:var(--tx-t);">이메일이 명부와 매칭되지 않은 가입 계정 · 직원으로 등록하면 연결됩니다</span></div>
        <div style="overflow-x:auto;"><table>
          <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th style="text-align:center;">승인</th><th style="text-align:center;">명부 등록</th></tr></thead>
          <tbody>${orphans.map(u=>{
            const isOwner=BOOTSTRAP_ADMIN_EMAILS.includes((u.email||'').toLowerCase()); const act=u.active!==false;
            return `<tr>
              <td style="font-weight:700;">${u.name||'—'}${isOwner?' <span class="bd bd-info" style="font-size:9px;">소유자</span>':''}</td>
              <td>${u.email||u.uid}</td>
              <td>${isOwner?`<span class="bd bd-info">${ROLE_LABEL[u.role||'admin']}</span>`:`<select class="stat-sel" onchange="permSetRole('${u.uid}',this.value)">${ROLE_OPT(u.role)}</select>`}</td>
              <td style="text-align:center;">${isOwner?'<span class="bd bd-ok">활성</span>':`<button class="btn btn-sm" onclick="permToggleActive('${u.uid}',${act})">${act?'비활성화':'승인'}</button>`}</td>
              <td style="text-align:center;"><button class="btn btn-sm" onclick="enrollWorkerFromUser('${u.uid}')"><i class="ti ti-user-plus"></i>직원 등록</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;
    }
  }
  el.innerHTML = tableHTML + orphanHTML;
}
/* 미등록 로그인 계정을 직원 명부에 등록(이메일·이름 프리필) */
function enrollWorkerFromUser(uid){
  const u=cloudUsers.find(x=>x.uid===uid); if(!u){ showToast('계정을 찾을 수 없습니다.','error'); return; }
  openWorkerAdd();
  sv('wa-email', u.email||'');
  sv('wa-name', u.name||'');
}

function changeWorkerStatus(id, val) {
  if (!isAdmin) {
    promptAdmin(() => {
      const w = workers.find(x => x.id === id);
      if (w) {
        w.status = val;
        saveStorage('workers', workers);
        renderWorkers();
      }
    });
    refreshPage(currentPage);
    return;
  }
  const w = workers.find(x => x.id === id);
  if (w) {
    w.status = val;
    saveStorage('workers', workers);
    renderWorkers();
  }
}

function openWorkerAdd() {
  const modal = inp('worker-modal');
  delete modal.dataset.editId;
  inp('worker-modal-ttl').innerHTML = '<i class="ti ti-user-plus" style="color:var(--tx-i);"></i>직원 등록';
  inp('wa-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  sv('wa-id', nextCode('E', workers));
  ['wa-name', 'wa-position', 'wa-phone', 'wa-salary', 'wa-role', 'wa-in', 'wa-ot', 'wa-email'].forEach(id => sv(id, ''));
  sv('wa-dept', '생산부');
  sv('wa-emptype', '정규직');
  sv('wa-hire', today());
  sv('wa-annual', '15');
  sv('wa-line', 'A');
  sv('wa-status', '근무중');
  modal.classList.add('open');
}

function openWorkerEdit(id) {
  if (!checkAdminAction()) return;
  const w = workers.find(x => x.id === id);
  if (!w) return;
  const modal = inp('worker-modal');
  modal.dataset.editId = id;
  inp('worker-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>직원 정보 수정';
  inp('wa-save-btn').innerHTML = '<i class="ti ti-check"></i>저장';
  sv('wa-id', w.id);
  sv('wa-name', w.name || '');
  sv('wa-dept', w.dept || '생산부');
  sv('wa-position', w.position || '');
  sv('wa-emptype', w.empType || '정규직');
  sv('wa-hire', w.hireDate || '');
  sv('wa-phone', w.phone || '');
  sv('wa-salary', w.salary || '');
  sv('wa-annual', w.annualLeave != null ? w.annualLeave : 15);
  sv('wa-line', w.line || 'A');
  sv('wa-role', w.role || '');
  sv('wa-status', w.status || '근무중');
  sv('wa-in', w.tin || '');
  sv('wa-ot', w.ot || '');
  sv('wa-email', w.email || '');
  modal.classList.add('open');
}

function saveWorkerForm() {
  if (!checkAdminAction()) return;
  const name = v('wa-name').trim();
  if (!name) { showToast('직원의 실명은 필수 기입입니다.', 'error'); return; }
  const modal = inp('worker-modal');
  const editId = modal.dataset.editId;
  const data = {
    name,
    dept: v('wa-dept') || '생산부',
    position: v('wa-position') || '사원',
    empType: v('wa-emptype') || '정규직',
    hireDate: v('wa-hire') || today(),
    phone: v('wa-phone') || '',
    salary: Number(v('wa-salary')) || 0,
    annualLeave: v('wa-annual') !== '' ? Number(v('wa-annual')) : 15,
    line: v('wa-line'),
    role: v('wa-role') || '조립',
    tin: v('wa-in') || '08:00',
    ot: v('wa-ot') || '0h',
    email: v('wa-email').trim(),
    status: v('wa-status')
  };
  if (editId) {
    const w = workers.find(x => x.id === editId);
    if (w) Object.assign(w, data);
    delete modal.dataset.editId;
    showToast('직원 정보가 수정되었습니다.');
  } else {
    workers.push({ id: nextCode('E', workers), ...data });
    showToast('신규 직원 정보가 등록되었습니다.');
  }
  saveStorage('workers', workers);
  closeModal('worker-modal');
  renderWorkers();
}

// 하위 호환: 기존 호출부 유지
function addWorker() { saveWorkerForm(); }

function deleteWorker(id) {
  if (!checkAdminAction()) return;
  const w = workers.find(x => x.id === id);
  if (!w) return;
  confirm_('현장 임직원 퇴사/방출', `현장 소속 <strong>[${w.name}]</strong> 사원의 인사정보 프로필을 시스템에서 파기하시겠습니까?`, () => {
    pushToTrash('worker', `${w.name} (작업원)`, id, w);

    workers = workers.filter(x => x.id !== id);
    saveStorage('workers', workers);
    renderWorkers();
    showToast('사원 정보가 휴지통으로 이동했습니다.', 'info');
  });
}

function exportWorkersCSV() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const h = ['사번','성명','부서','직급','고용형태','입사일','연락처','담당','배정라인','월급여','출근시간','연장근무','상태'];
  const rows = workers.map(w => [w.id, w.name, w.dept||'', w.position||'', w.empType||'정규직', w.hireDate||'', w.phone||'', w.role||'', w.line?`라인 ${w.line}`:'', Number(w.salary)||0, w.tin||'', w.ot||'0h', w.status]);
  const ws = XLSX.utils.aoa_to_sheet([h,...rows]);
  ws['!cols'] = h.map(c => ({ wch: Math.max(c.length+2, 12) }));
  XLSX.utils.book_append_sheet(wb, ws, '직원현황');
  XLSX.writeFile(wb, `MESPro_직원현황_${today().replace(/-/g,'')}.xlsx`);
  showToast('직원 현황 XLS 저장 완료');
}
