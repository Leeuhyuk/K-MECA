/* ════════ 직원 관리 탭 (명부 / 근태 / 휴가) ════════ */
let empTab = 'roster';
let attView = 'list',   attMonth   = today().slice(0,7);
let leaveView = 'list', leaveMonth = today().slice(0,7);

function getWorkerName(id) { return workers.find(w => w.id === id)?.name || id; }

/* 근무시간 계산 (분 단위) */
function workMinutes(ci, co) {
  if (!ci || !co) return 0;
  const [h1,m1] = ci.split(':').map(Number), [h2,m2] = co.split(':').map(Number);
  const d = (h2*60+m2) - (h1*60+m1);
  return d > 0 ? d : 0;
}
function fmtHm(mins) {
  if (!mins) return '0h';
  const h = Math.floor(mins/60), m = mins % 60;
  return `${h}h${m ? ' '+m+'m' : ''}`;
}
function calcWorkHours(ci, co) { const m = workMinutes(ci, co); return m ? fmtHm(m) : ''; }

/* 월 이동/표기 */
function shiftMonth(ym, delta) {
  const [y,m] = ym.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function monthLabel(ym) { const [y,m] = ym.split('-'); return `${y}년 ${Number(m)}월`; }
function monthNavBar(ym, prevFn, nextFn) {
  return `<div style="display:flex;align-items:center;gap:8px;">
    <button class="btn btn-sm" onclick="${prevFn}"><i class="ti ti-chevron-left"></i></button>
    <span style="font-weight:700;font-size:13px;min-width:96px;text-align:center;">${monthLabel(ym)}</span>
    <button class="btn btn-sm" onclick="${nextFn}"><i class="ti ti-chevron-right"></i></button>
  </div>`;
}

/* 월간 달력 그리드 (cellFn(dateStr) → 셀 내부 HTML) */
function calendarGrid(ym, cellFn) {
  const [y,m] = ym.split('-').map(Number);
  const startDow = new Date(y, m-1, 1).getDay();
  const daysIn = new Date(y, m, 0).getDate();
  const dow = ['일','월','화','수','목','금','토'];
  const head = dow.map((w,i) => `<div style="text-align:center;font-size:11px;font-weight:700;padding:4px 0;color:${i===0?'var(--tx-err)':i===6?'var(--tx-i)':'var(--tx-s)'};">${w}</div>`).join('');
  let cells = '';
  for (let i=0; i<startDow; i++)
    cells += `<div style="min-height:90px;border:1px solid var(--br);border-radius:var(--rm);background:var(--bg-s);opacity:.35;"></div>`;
  for (let d=1; d<=daysIn; d++) {
    const ds = `${ym}-${String(d).padStart(2,'0')}`;
    const dowIdx = (startDow + d - 1) % 7;
    const dColor = dowIdx===0 ? 'var(--tx-err)' : dowIdx===6 ? 'var(--tx-i)' : 'var(--tx)';
    const isToday = ds === today();
    cells += `<div style="min-height:90px;border:1px solid ${isToday?'var(--tx-i)':'var(--br)'};border-radius:var(--rm);padding:4px 6px;background:${isToday?'var(--bg-i)':'var(--bg-p)'};overflow:hidden;">
      <div style="font-size:11px;font-weight:700;color:${dColor};margin-bottom:3px;">${d}</div>
      <div style="font-size:10px;line-height:1.45;">${cellFn(ds)}</div>
    </div>`;
  }
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;">${head}</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">${cells}</div>`;
}
function workerSelectOptions(sel) {
  return workers.map(w => `<option value="${esc(w.id)}"${w.id===sel?' selected':''}>${esc(w.name)}${w.dept?' · '+esc(w.dept):''}${w.position?' '+esc(w.position):''}</option>`).join('');
}

function switchEmpTab(tab) {
  empTab = tab;
  document.querySelectorAll('#emp-tabs [data-emptab]').forEach(b =>
    b.classList.toggle('btn-primary', b.dataset.emptab === tab));
  const r = inp('emp-tab-roster'), a = inp('emp-tab-att'), l = inp('emp-tab-leave');
  if (r) r.style.display = tab === 'roster' ? '' : 'none';
  if (a) a.style.display = tab === 'att'    ? '' : 'none';
  if (l) l.style.display = tab === 'leave'  ? '' : 'none';
  if (tab === 'roster') renderWorkers();
  else if (tab === 'att') renderAttendance();
  else if (tab === 'leave') renderLeaves();
}

/* N키/등록 버튼 → 현재 직원 탭에 맞는 등록창 */
function openEmployeeAdd() {
  if (empTab === 'att') openAttendanceAdd();
  else if (empTab === 'leave') openLeaveAdd();
  else openWorkerAdd();
}

/* ── 근태 관리 ── */
let attDateFilter = today();

function setAttDate(d) { attDateFilter = d || today(); renderAttendance(); }

function setAttView(view) { attView = view; renderAttendance(); }
function attPrevMonth() { attMonth = shiftMonth(attMonth, -1); renderAttendance(); }
function attNextMonth() { attMonth = shiftMonth(attMonth, 1); renderAttendance(); }

function attViewToggle() {
  return `<div style="display:flex;gap:4px;">
    <button class="btn btn-sm ${attView==='list'?'btn-primary':''}" onclick="setAttView('list')"><i class="ti ti-list"></i>목록</button>
    <button class="btn btn-sm ${attView==='calendar'?'btn-primary':''}" onclick="setAttView('calendar')"><i class="ti ti-calendar-month"></i>달력</button>
  </div>`;
}

function renderAttendance() {
  const cont = inp('emp-tab-att'); if (!cont) return;
  cont.innerHTML = attView === 'calendar' ? _attCalendar() : _attList();
}

function _attList() {
  const d = attDateFilter || today();
  const recs = attendance.filter(a => a.date === d)
    .sort((a,b) => getWorkerName(a.workerId).localeCompare(getWorkerName(b.workerId)));
  const cnt = s => recs.filter(r => r.status === s).length;
  const normal = cnt('정상'), late = cnt('지각'), early = cnt('조퇴'), ot = cnt('연장근무'), absent = cnt('결근');
  const dayMins = recs.reduce((s,r) => s + workMinutes(r.checkIn, r.checkOut), 0);

  const rows = recs.length ? recs.map(r => `
    <tr>
      <td style="font-weight:700;">${esc(getWorkerName(r.workerId))}</td>
      <td>${esc((workers.find(w=>w.id===r.workerId)||{}).dept) || '—'}</td>
      <td>${esc(r.checkIn) || '—'}</td>
      <td>${esc(r.checkOut) || '—'}</td>
      <td>${calcWorkHours(r.checkIn, r.checkOut) || '—'}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${esc(r.note) || ''}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm" onclick="openAttendanceEdit('${r.id}')" title="편집"><i class="ti ti-edit"></i></button>
        <button class="del-btn" onclick="deleteAttendance('${r.id}')" title="삭제"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="8">${empty('해당 일자의 근태 기록이 없습니다. [근태 기록 추가] 버튼으로 등록하세요.')}</td></tr>`;

  return `
    <div class="metrics" style="grid-template-columns:repeat(6,1fr);">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-user-check"></i>정상 출근</div><div class="mc-val" style="color:var(--tx-ok);">${normal}명</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-exclamation"></i>지각</div><div class="mc-val" style="color:var(--tx-w);">${late}명</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-door-exit"></i>조퇴</div><div class="mc-val" style="color:var(--tx-w);">${early}명</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-plus"></i>연장근무</div><div class="mc-val">${ot}명</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-user-x"></i>결근</div><div class="mc-val" style="color:var(--tx-err);">${absent}명</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-hour-9"></i>당일 총 근무시간</div><div class="mc-val" style="color:var(--tx-i);">${fmtHm(dayMins)}</div></div>
    </div>
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-clock-check"></i>일자별 근태 기록</span>
        <div style="display:flex;gap:6px;align-items:center;">
          ${attViewToggle()}
          <input type="date" value="${d}" onchange="setAttDate(this.value)" style="height:28px;font-size:11px;padding:0 8px;border:1px solid var(--br);border-radius:var(--rm);background:var(--bg-p);color:var(--tx);">
          <button class="btn btn-sm btn-primary" onclick="openAttendanceAdd()"><i class="ti ti-plus"></i>근태 기록 추가</button>
        </div>
      </div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>직원</th><th>부서</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>상태</th><th>비고</th><th>관리</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

function _attCalendar() {
  const cal = calendarGrid(attMonth, ds => {
    const day = attendance.filter(a => a.date === ds);
    if (!day.length) return '';
    const cnt = s => day.filter(r => r.status === s).length;
    const parts = [];
    const present = day.filter(r => r.status !== '결근' && r.status !== '휴가').length;
    if (present) parts.push(`<span style="color:var(--tx-ok);">출근 ${present}</span>`);
    if (cnt('지각')) parts.push(`<span style="color:var(--tx-w);">지각 ${cnt('지각')}</span>`);
    if (cnt('결근')) parts.push(`<span style="color:var(--tx-err);">결근 ${cnt('결근')}</span>`);
    if (cnt('휴가')) parts.push(`<span style="color:var(--tx-s);">휴가 ${cnt('휴가')}</span>`);
    return parts.join('<br>');
  });

  // 직원별 월 근무시간 요약
  const summary = workers.map(w => {
    const recs = attendance.filter(a => a.workerId === w.id && a.date.slice(0,7) === attMonth);
    const days = recs.filter(r => r.checkIn).length;
    const mins = recs.reduce((s,r) => s + workMinutes(r.checkIn, r.checkOut), 0);
    const late = recs.filter(r => r.status === '지각').length;
    const absent = recs.filter(r => r.status === '결근').length;
    return { w, days, mins, late, absent };
  }).filter(s => s.days || s.mins || s.late || s.absent);
  const totalMins = summary.reduce((s,x) => s + x.mins, 0);

  const sumRows = summary.length ? summary.map(s => `
    <tr>
      <td style="font-weight:700;">${s.w.name}</td>
      <td>${s.w.dept || '—'}</td>
      <td>${s.days}일</td>
      <td style="font-weight:700;color:var(--tx-i);">${fmtHm(s.mins)}</td>
      <td>${s.late}회</td>
      <td>${s.absent}일</td>
    </tr>`).join('') : `<tr><td colspan="6">${empty('이번 달 근태 기록이 없습니다.')}</td></tr>`;

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-calendar-month"></i>근태 달력</span>
        <div style="display:flex;gap:8px;align-items:center;">
          ${attViewToggle()}
          ${monthNavBar(attMonth, 'attPrevMonth()', 'attNextMonth()')}
          <button class="btn btn-sm btn-primary" onclick="openAttendanceAdd()"><i class="ti ti-plus"></i>근태 기록 추가</button>
        </div>
      </div>
      ${cal}
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-clock-hour-9"></i>${monthLabel(attMonth)} 직원별 근무시간 요약</span>
        <span style="font-size:13px;">총 근무시간 <b style="color:var(--tx-i);">${fmtHm(totalMins)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>직원</th><th>부서</th><th>출근일수</th><th>총 근무시간</th><th>지각</th><th>결근</th></tr></thead>
        <tbody>${sumRows}</tbody>
      </table></div>
    </div>`;
}

function openAttendanceAdd() {
  if (!workers.length) { showToast('먼저 직원을 등록하세요.', 'error'); return; }
  const modal = inp('att-modal');
  delete modal.dataset.editId;
  inp('att-modal-ttl').innerHTML = '<i class="ti ti-clock-check" style="color:var(--tx-i);"></i>근태 기록 등록';
  inp('at-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('at-worker').innerHTML = workerSelectOptions();
  sv('at-date', attDateFilter || today());
  sv('at-status', '정상');
  sv('at-in', '08:00');
  sv('at-out', '17:00');
  sv('at-note', '');
  modal.classList.add('open');
}

function openAttendanceEdit(id) {
  if (!checkAdminAction()) return;
  const r = attendance.find(x => x.id === id); if (!r) return;
  const modal = inp('att-modal');
  modal.dataset.editId = id;
  inp('att-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>근태 기록 수정';
  inp('at-save-btn').innerHTML = '<i class="ti ti-check"></i>저장';
  inp('at-worker').innerHTML = workerSelectOptions(r.workerId);
  sv('at-date', r.date);
  sv('at-status', r.status);
  sv('at-in', r.checkIn || '');
  sv('at-out', r.checkOut || '');
  sv('at-note', r.note || '');
  modal.classList.add('open');
}

function saveAttendance() {
  if (!checkAdminAction()) return;
  const workerId = v('at-worker');
  const date = v('at-date');
  if (!workerId || !date) { showToast('직원과 일자는 필수입니다.', 'error'); return; }
  const modal = inp('att-modal');
  const editId = modal.dataset.editId;
  const data = {
    workerId, date,
    checkIn: v('at-in') || '',
    checkOut: v('at-out') || '',
    status: v('at-status') || '정상',
    note: v('at-note') || ''
  };
  if (editId) {
    const r = attendance.find(x => x.id === editId);
    if (r) Object.assign(r, data);
    delete modal.dataset.editId;
    showToast('근태 기록이 수정되었습니다.');
  } else {
    attendance.push({ id: nextCode('ATT', attendance), ...data });
    showToast('근태 기록이 등록되었습니다.');
  }
  saveStorage('attendance', attendance);
  attDateFilter = date;
  closeModal('att-modal');
  renderAttendance();
}

function deleteAttendance(id) {
  if (!checkAdminAction()) return;
  const r = attendance.find(x => x.id === id); if (!r) return;
  confirm_('근태 기록 삭제', `<strong>${getWorkerName(r.workerId)}</strong>님의 ${r.date} 근태 기록을 삭제하시겠습니까?`, () => {
    attendance = attendance.filter(x => x.id !== id);
    saveStorage('attendance', attendance);
    renderAttendance();
    showToast('근태 기록이 삭제되었습니다.');
  });
}

/* ── 휴가 관리 ── */
const HALF_DAY_TYPES = ['오전반차', '오후반차'];

function recalcLeaveDays() {
  const type = v('lv-type');
  if (HALF_DAY_TYPES.includes(type)) { sv('lv-days', '0.5'); return; }
  const s = v('lv-start'), e = v('lv-end');
  if (s && e) {
    const diff = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
    if (diff > 0) sv('lv-days', String(diff));
  }
}

function leaveStatusBadge(s) {
  if (s === '승인') return '<span class="bd bd-ok">승인</span>';
  if (s === '반려') return '<span class="bd bd-err">반려</span>';
  return '<span class="bd bd-warn">신청</span>';
}

const ANNUAL_TYPES = ['연차', '오전반차', '오후반차'];
function annualUsed(workerId, year) {
  return leaves.filter(l => l.workerId === workerId && l.status === '승인'
      && ANNUAL_TYPES.includes(l.type) && (l.startDate||'').slice(0,4) === String(year))
    .reduce((s,l) => s + (Number(l.days)||0), 0);
}
function setLeaveView(view) { leaveView = view; renderLeaves(); }
function leavePrevMonth() { leaveMonth = shiftMonth(leaveMonth, -1); renderLeaves(); }
function leaveNextMonth() { leaveMonth = shiftMonth(leaveMonth, 1); renderLeaves(); }
function leaveViewToggle() {
  return `<div style="display:flex;gap:4px;">
    <button class="btn btn-sm ${leaveView==='list'?'btn-primary':''}" onclick="setLeaveView('list')"><i class="ti ti-list"></i>목록</button>
    <button class="btn btn-sm ${leaveView==='calendar'?'btn-primary':''}" onclick="setLeaveView('calendar')"><i class="ti ti-calendar-month"></i>달력</button>
  </div>`;
}

/* 연차 현황 카드 (부여/사용/잔여) */
function _annualStatusCard() {
  const year = new Date(today()).getFullYear();
  const rows = workers.length ? workers.map(w => {
    const grant = w.annualLeave != null ? Number(w.annualLeave) : 15;
    const used = annualUsed(w.id, year);
    const remain = grant - used;
    const pct = grant > 0 ? Math.min(100, Math.round(used/grant*100)) : 0;
    const barColor = remain <= 0 ? '#c92a2a' : remain <= 3 ? '#f76707' : '#2b8a3e';
    return `
      <tr>
        <td style="font-weight:700;">${esc(w.name)}</td>
        <td>${esc(w.dept) || '—'}</td>
        <td>${grant}일</td>
        <td>${used}일</td>
        <td style="font-weight:700;color:${remain<=0?'var(--tx-err)':remain<=3?'var(--tx-w)':'var(--tx-ok)'};">${remain}일</td>
        <td style="min-width:120px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="pb" style="width:90px;"><div class="pf" style="width:${pct}%;background:${barColor};"></div></div>
            <span style="font-size:11px;font-weight:600;">${pct}%</span>
          </div>
        </td>
      </tr>`;
  }).join('') : `<tr><td colspan="6">${empty('등록된 직원이 없습니다.')}</td></tr>`;
  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-calendar-stats"></i>${year}년 연차 현황 (부여 / 사용 / 잔여)</span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>직원</th><th>부서</th><th>부여</th><th>사용</th><th>잔여</th><th>소진율</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

function renderLeaves() {
  const cont = inp('emp-tab-leave'); if (!cont) return;
  const pending = leaves.filter(l => l.status === '신청').length;
  const approved = leaves.filter(l => l.status === '승인').length;
  const cm = today().slice(0,7);
  const monthDays = leaves.filter(l => l.status === '승인' && (l.startDate||'').slice(0,7) === cm)
    .reduce((s,l) => s + (Number(l.days)||0), 0);

  const metrics = `
    <div class="metrics" style="grid-template-columns:repeat(3,1fr);">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-hour-4"></i>승인 대기</div><div class="mc-val" style="color:var(--tx-w);">${pending}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calendar-check"></i>승인 완료</div><div class="mc-val" style="color:var(--tx-ok);">${approved}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-beach"></i>이번 달 사용(승인)</div><div class="mc-val">${monthDays}일</div></div>
    </div>`;

  if (leaveView === 'calendar') {
    const cal = calendarGrid(leaveMonth, ds => {
      const day = leaves.filter(l => l.status !== '반려' && (l.startDate||'') <= ds && (l.endDate||l.startDate||'') >= ds);
      if (!day.length) return '';
      return day.map(l => {
        const color = l.status === '승인' ? 'var(--tx-ok)' : 'var(--tx-w)';
        return `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${color};">• ${getWorkerName(l.workerId)} <span style="color:var(--tx-t);">${l.type}</span></div>`;
      }).join('');
    });
    cont.innerHTML = `
      ${metrics}
      <div class="card" style="margin-bottom:16px;">
        <div class="card-hd">
          <span class="card-ttl"><i class="ti ti-calendar-month"></i>휴가 달력</span>
          <div style="display:flex;gap:8px;align-items:center;">
            ${leaveViewToggle()}
            ${monthNavBar(leaveMonth, 'leavePrevMonth()', 'leaveNextMonth()')}
            <button class="btn btn-sm btn-primary" onclick="openLeaveAdd()"><i class="ti ti-plus"></i>휴가 신청 등록</button>
          </div>
        </div>
        ${cal}
      </div>
      ${_annualStatusCard()}`;
    return;
  }

  const list = [...leaves].sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''));
  const rows = list.length ? list.map(l => `
    <tr>
      <td style="font-weight:700;">${esc(getWorkerName(l.workerId))}</td>
      <td><span class="bd bd-neu">${esc(l.type)}</span></td>
      <td>${esc(l.startDate) || '—'}</td>
      <td>${esc(l.endDate || l.startDate) || '—'}</td>
      <td style="font-weight:700;">${l.days || 0}일</td>
      <td>${esc(l.reason) || ''}</td>
      <td>${leaveStatusBadge(l.status)}</td>
      <td style="white-space:nowrap;">
        ${l.status !== '승인' ? `<button class="btn btn-sm" style="border-color:var(--br-ok);color:var(--tx-ok);" onclick="setLeaveStatus('${l.id}','승인')" title="승인"><i class="ti ti-check"></i></button>` : ''}
        ${l.status !== '반려' ? `<button class="btn btn-sm" style="border-color:var(--br-err);color:var(--tx-err);" onclick="setLeaveStatus('${l.id}','반려')" title="반려"><i class="ti ti-x"></i></button>` : ''}
        <button class="btn btn-sm" onclick="openLeaveEdit('${l.id}')" title="편집"><i class="ti ti-edit"></i></button>
        <button class="del-btn" onclick="deleteLeave('${l.id}')" title="삭제"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="8">${empty('등록된 휴가 신청이 없습니다. [휴가 신청 등록] 버튼으로 추가하세요.')}</td></tr>`;

  cont.innerHTML = `
    ${metrics}
    ${_annualStatusCard()}
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-beach"></i>휴가 신청 현황</span>
        <div style="display:flex;gap:6px;align-items:center;">
          ${leaveViewToggle()}
          <button class="btn btn-sm btn-primary" onclick="openLeaveAdd()"><i class="ti ti-plus"></i>휴가 신청 등록</button>
        </div>
      </div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>직원</th><th>유형</th><th>시작일</th><th>종료일</th><th>일수</th><th>사유</th><th>상태</th><th>관리</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

function openLeaveAdd() {
  if (!workers.length) { showToast('먼저 직원을 등록하세요.', 'error'); return; }
  const modal = inp('leave-modal');
  delete modal.dataset.editId;
  inp('leave-modal-ttl').innerHTML = '<i class="ti ti-beach" style="color:var(--tx-i);"></i>휴가 신청 등록';
  inp('lv-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('lv-worker').innerHTML = workerSelectOptions();
  sv('lv-type', '연차');
  sv('lv-days', '1');
  sv('lv-start', today());
  sv('lv-end', today());
  sv('lv-reason', '');
  sv('lv-status', '신청');
  modal.classList.add('open');
}

function openLeaveEdit(id) {
  if (!checkAdminAction()) return;
  const l = leaves.find(x => x.id === id); if (!l) return;
  const modal = inp('leave-modal');
  modal.dataset.editId = id;
  inp('leave-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>휴가 신청 수정';
  inp('lv-save-btn').innerHTML = '<i class="ti ti-check"></i>저장';
  inp('lv-worker').innerHTML = workerSelectOptions(l.workerId);
  sv('lv-type', l.type);
  sv('lv-days', l.days);
  sv('lv-start', l.startDate || '');
  sv('lv-end', l.endDate || '');
  sv('lv-reason', l.reason || '');
  sv('lv-status', l.status || '신청');
  modal.classList.add('open');
}

function saveLeave() {
  if (!checkAdminAction()) return;
  const workerId = v('lv-worker');
  const start = v('lv-start');
  if (!workerId || !start) { showToast('직원과 시작일은 필수입니다.', 'error'); return; }
  const modal = inp('leave-modal');
  const editId = modal.dataset.editId;
  const data = {
    workerId,
    type: v('lv-type') || '연차',
    startDate: start,
    endDate: v('lv-end') || start,
    days: Number(v('lv-days')) || 1,
    reason: v('lv-reason') || '',
    status: v('lv-status') || '신청'
  };
  if (editId) {
    const l = leaves.find(x => x.id === editId);
    if (l) Object.assign(l, data);
    delete modal.dataset.editId;
    showToast('휴가 신청이 수정되었습니다.');
  } else {
    leaves.push({ id: nextCode('LV', leaves), ...data });
    showToast('휴가 신청이 등록되었습니다.');
  }
  saveStorage('leaves', leaves);
  closeModal('leave-modal');
  renderLeaves();
}

function setLeaveStatus(id, status) {
  if (!checkAdminAction()) return;
  const l = leaves.find(x => x.id === id); if (!l) return;
  l.status = status;
  saveStorage('leaves', leaves);
  renderLeaves();
  showToast(`휴가 신청이 ${status} 처리되었습니다.`);
}

function deleteLeave(id) {
  if (!checkAdminAction()) return;
  const l = leaves.find(x => x.id === id); if (!l) return;
  confirm_('휴가 신청 삭제', `<strong>${getWorkerName(l.workerId)}</strong>님의 ${l.type} 신청을 삭제하시겠습니까?`, () => {
    leaves = leaves.filter(x => x.id !== id);
    saveStorage('leaves', leaves);
    renderLeaves();
    showToast('휴가 신청이 삭제되었습니다.');
  });
}
