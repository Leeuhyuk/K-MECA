/* ════════ 직원 관리 탭 (명부 / 근태 / 휴가) ════════ */
let empTab = 'roster';
let attView = 'list',   attMonth   = today().slice(0,7);
let leaveView = 'list', leaveMonth = today().slice(0,7);
let attDateFilter = today();
let attShowAll = false;
let attQuickDate = today();
let attQuickQuery = '';
let attQuickDept = '';
const attQuickSelected = new Set();

function hrVisibleWorkers() {
  if (typeof visibleWorkersList === 'function') return visibleWorkersList();
  return typeof visibleRecords === 'function' ? visibleRecords(workers, 'worker') : workers;
}
function hrVisibleWorkerIds() {
  return new Set(hrVisibleWorkers().map(w => w.id));
}
function visibleWorkerById(id) {
  return hrVisibleWorkers().find(w => w.id === id);
}
function getWorkerName(id) { return visibleWorkerById(id)?.name || id; }

/* 근무시간 계산 (분 단위) */
function workMinutes(ci, co) {
  ci = normalizeTimeValue(ci);
  co = normalizeTimeValue(co);
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
  return hrVisibleWorkers().map(w => `<option value="${esc(w.id)}"${w.id===sel?' selected':''}>${esc(w.name)}${w.dept?' · '+esc(w.dept):''}${w.position?' '+esc(w.position):''}</option>`).join('');
}

function switchEmpTab(tab) {
  empTab = tab;
  syncCurrentSubRoute('workers', empTab);
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
function setAttView(view) { attView = view; renderAttendance(); }
function attPrevMonth() { attMonth = shiftMonth(attMonth, -1); renderAttendance(); }
function attNextMonth() { attMonth = shiftMonth(attMonth, 1); renderAttendance(); }
function toggleAttendanceAll() { attShowAll = !attShowAll; renderAttendance(); }
function setAttQuickDate(value) {
  attQuickDate = value || today();
  attDateFilter = attQuickDate;
  attQuickSelected.clear();
  renderAttendance();
}
function moveAttQuickDate(amount) {
  const date = new Date((attQuickDate || today()) + 'T00:00:00');
  date.setDate(date.getDate() + amount);
  setAttQuickDate(dateText(date));
}
function setAttQuickFilter(type, value) {
  if (type === 'query') attQuickQuery = value || '';
  else attQuickDept = value || '';
  renderAttendance();
}
// 선택 액션바(선택바 ↔ 필터바)만 만들어 반환 — 체크박스 토글 시 테이블 전체를 다시 그리지 않기 위함
function attQuickControlsHtml() {
  const depts = [...new Set(hrVisibleWorkers().map(worker => worker.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko-KR'));
  return attQuickSelected.size ? `
      <div class="selection-action-bar att-quick-selectionbar" style="display:flex;">
        <span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${attQuickSelected.size}명 선택</span>
        <select id="att-quick-bulk-status">
          <option value="">상태 선택</option><option>지각</option><option>조퇴</option><option>외근</option><option>결근</option><option>연장근무</option><option>휴일근무</option><option value="정상복구">정상·휴무 복구</option>
        </select>
        <button class="btn btn-sm btn-primary" onclick="applyQuickAttendanceBulk()">일괄 적용</button>
        <button class="btn btn-sm date-view-clear-selection" onclick="clearAttQuickSelection()"><i class="ti ti-x"></i>해제</button>
      </div>` : `
      <div class="att-quick-filters">
        <button class="btn btn-sm btn-icon" onclick="moveAttQuickDate(-1)" title="이전 날짜"><i class="ti ti-chevron-left"></i></button>
        <input type="date" value="${attQuickDate}" onchange="setAttQuickDate(this.value)">
        <button class="btn btn-sm btn-icon" onclick="moveAttQuickDate(1)" title="다음 날짜"><i class="ti ti-chevron-right"></i></button>
        <button class="btn btn-sm" onclick="setAttQuickDate(today())">오늘</button>
        <select onchange="setAttQuickFilter('dept',this.value)"><option value="">전체 부서</option>${depts.map(dept=>`<option${dept===attQuickDept?' selected':''}>${esc(dept)}</option>`).join('')}</select>
        <input type="search" value="${esc(attQuickQuery)}" placeholder="직원 검색" onchange="setAttQuickFilter('query',this.value)">
      </div>`;
}
// 선택 상태만 부분 갱신(테이블 재구성 없음). 컨테이너가 없으면(다른 화면) 전체 재렌더로 폴백.
function refreshAttQuickSelectionUi() {
  const box = inp('att-quick-controls');
  if (!box) { renderAttendance(); return; }   // 근태 화면이 아니면 전체 재렌더로 폴백
  box.innerHTML = attQuickControlsHtml();
  // 테이블을 다시 그리지 않으므로 체크박스 표시를 선택 집합과 동기화(전체 해제 시 체크 해제 등)
  document.querySelectorAll('.att-quick-check').forEach(cb => {
    cb.checked = attQuickSelected.has(cb.dataset.workerId);
  });
}
function toggleAttQuickSelect(workerId, checked) {
  if (checked) attQuickSelected.add(workerId);
  else attQuickSelected.delete(workerId);
  refreshAttQuickSelectionUi();
}
function toggleAttQuickAll(checked) {
  document.querySelectorAll('.att-quick-check').forEach(box => {
    box.checked = checked;
    if (checked) attQuickSelected.add(box.dataset.workerId);
    else attQuickSelected.delete(box.dataset.workerId);
  });
  refreshAttQuickSelectionUi();
}
function clearAttQuickSelection() {
  attQuickSelected.clear();
  refreshAttQuickSelectionUi();
}

function dateText(date) {
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}
function attendanceDateRange(key='attendance', month='') {
  if (month) {
    const [year, mon] = month.split('-').map(Number);
    return [`${month}-01`, dateText(new Date(year, mon, 0))];
  }
  const state = dateViewState[key] || { mode:'all' };
  if (state.mode === 'day') return [state.value || today(), state.value || today()];
  if (state.mode === 'month') {
    const ym = state.value || today().slice(0,7), [year, mon] = ym.split('-').map(Number);
    return [`${ym}-01`, dateText(new Date(year, mon, 0))];
  }
  if (state.mode === 'year') return [`${state.value || today().slice(0,4)}-01-01`, `${state.value || today().slice(0,4)}-12-31`];
  if (state.mode === 'range') return [state.from || today(), state.to || today()];
  const ym = today().slice(0,7);
  return [`${ym}-01`, today()];
}
function eachAttendanceDate(from, to, callback) {
  if (from && to && from > to) { const t = from; from = to; to = t; }   // 시작일이 종료일보다 늦으면 교정(0일 처리 방지)
  const cursor = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00');
  let guard = 0;
  while (!isNaN(cursor) && cursor <= end && guard++ < 370) {
    callback(dateText(cursor), cursor.getDay());
    cursor.setDate(cursor.getDate() + 1);
  }
}
function workerActiveOn(worker, date) {
  if (!worker || ['퇴사','퇴직','비활성'].includes(worker.status)) return false;
  return !worker.hireDate || worker.hireDate <= date;
}
function approvedLeaveOn(workerId, date) {
  return leaves.find(item => item.workerId === workerId && item.status === '승인'
    && (item.startDate || '') <= date && (item.endDate || item.startDate || '') >= date) || null;
}
function attendanceExtraMinutes(row) {
  if (!row) return 0;
  if (Number(row.extraMinutes) >= 0 && row.extraMinutes !== '') return Number(row.extraMinutes) || 0;
  const minutes = workMinutes(row.checkIn, row.checkOut);
  if (row.status === '휴일근무') return minutes;
  if (row.status === '연장근무') {
    const dh = (typeof payrollSettings === 'function' && Number(payrollSettings().dailyHours)) || 8;
    return Math.max(0, minutes - dh * 60);
  }
  return 0;
}
function attendanceDefaultFor(worker, date) {
  const day = new Date(date + 'T00:00:00').getDay();
  const leave = approvedLeaveOn(worker.id, date);
  if (leave) {
    const half = HALF_DAY_TYPES.includes(leave.type);
    return {
      workerId:worker.id, date,
      checkIn:half ? (leave.type === '오전반차' ? '13:00' : normalizeTimeValue(worker.tin, '08:00')) : '',
      checkOut:half ? (leave.type === '오전반차' ? '17:00' : '12:00') : '',
      status:half ? '반차' : '휴가', note:leave.type, source:'leave', extraMinutes:0
    };
  }
  if (day === 0 || day === 6) {
    return { workerId:worker.id, date, checkIn:'', checkOut:'', status:'휴무', note:'', source:'auto', extraMinutes:0 };
  }
  return {
    workerId:worker.id, date, checkIn:normalizeTimeValue(worker.tin, '08:00'), checkOut:'17:00',
    status:'정상', note:'자동 만근', source:'auto', extraMinutes:0
  };
}
function quickAttendanceRow(workerId, date=attQuickDate) {
  const worker = visibleWorkerById(workerId);
  if (!worker) return null;
  const saved = attendance.find(row => row.workerId === workerId && row.date === date);
  return saved ? { ...saved, source:'exception', extraMinutes:attendanceExtraMinutes(saved) } : attendanceDefaultFor(worker, date);
}
function quickAttendanceData(workerId, status) {
  const worker = visibleWorkerById(workerId);
  if (!worker) return null;
  const current = quickAttendanceRow(workerId);
  const baseIn = normalizeTimeValue(worker?.tin, '08:00');
  const data = {
    workerId, date:attQuickDate, status,
    checkIn:current?.checkIn || baseIn,
    checkOut:current?.checkOut || '17:00',
    extraMinutes:attendanceExtraMinutes(current),
    note:current?.source === 'exception' ? current.note || '' : ''
  };
  if (status === '결근' || status === '휴가') {
    data.checkIn = ''; data.checkOut = ''; data.extraMinutes = 0;
  } else if (status === '연장근무') {
    data.checkIn = data.checkIn || baseIn; data.checkOut = data.checkOut || '19:00';
    data.extraMinutes = data.extraMinutes || 120;
  } else if (status === '휴일근무') {
    data.checkIn = data.checkIn || '09:00'; data.checkOut = data.checkOut || '18:00';
    data.extraMinutes = data.extraMinutes || 480;
  } else if (status === '정상') {
    data.checkIn = baseIn; data.checkOut = '17:00'; data.extraMinutes = 0; data.note = '';
  }
  return data;
}
function upsertQuickAttendance(workerId, data) {
  if (!data || !visibleWorkerById(workerId)) return false;
  const index = attendance.findIndex(row => row.workerId === workerId && row.date === attQuickDate);
  if (index >= 0) Object.assign(attendance[index], data);
  else attendance.push({ id:nextCode('ATT', attendance), ...data });
  return true;
}
function restoreQuickAttendance(workerId, quiet=false) {
  if (!visibleWorkerById(workerId)) return;
  attendance = attendance.filter(row => !(row.workerId === workerId && row.date === attQuickDate));
  saveStorage('attendance', attendance);
  if (!quiet) {
    showToast('자동 근태 상태로 복구했습니다.', 'success');
    renderAttendance();
  }
}
function changeQuickAttendanceStatus(workerId, status) {
  if (!checkAdminAction()) return;
  const current = quickAttendanceRow(workerId);
  if (current?.source === 'leave') {
    showToast('승인 휴가는 휴가 관리에서 수정하세요.', 'info');
    renderAttendance();
    return;
  }
  const day = new Date(attQuickDate + 'T00:00:00').getDay();
  if ((status === '정상' && day !== 0 && day !== 6) || (status === '휴무' && (day === 0 || day === 6))) {
    restoreQuickAttendance(workerId);
    return;
  }
  upsertQuickAttendance(workerId, quickAttendanceData(workerId, status));
  saveStorage('attendance', attendance);
  renderAttendance();
}
function changeQuickAttendanceField(workerId, field, value) {
  if (!checkAdminAction()) return;
  const current = quickAttendanceRow(workerId);
  if (!current || current.source === 'leave') {
    showToast('승인 휴가는 휴가 관리에서 수정하세요.', 'info');
    renderAttendance();
    return;
  }
  const status = ['휴무'].includes(current.status) ? '정상' : current.status;
  const data = quickAttendanceData(workerId, status);
  if (!data) return;
  if (field === 'extraMinutes') data.extraMinutes = Math.max(0, Math.round((Number(value) || 0) * 60));
  else if (field === 'checkIn' || field === 'checkOut') data[field] = normalizeTimeValue(value, '');
  else data[field] = value || '';
  upsertQuickAttendance(workerId, data);
  saveStorage('attendance', attendance);
  renderAttendance();
}
function applyQuickAttendanceBulk() {
  if (!checkAdminAction()) return;
  const status = v('att-quick-bulk-status');
  if (!status || !attQuickSelected.size) return;
  let changed = 0;
  attQuickSelected.forEach(workerId => {
    const current = quickAttendanceRow(workerId);
    if (current?.source === 'leave') return;
    if (status === '정상복구') {
      attendance = attendance.filter(row => !(row.workerId === workerId && row.date === attQuickDate));
    } else {
      upsertQuickAttendance(workerId, quickAttendanceData(workerId, status));
    }
    changed++;
  });
  saveStorage('attendance', attendance);
  attQuickSelected.clear();
  showToast(`${changed}명의 근태를 일괄 적용했습니다.`, 'success');
  renderAttendance();
}
function attendanceVirtualRows(from, to) {
  const explicit = new Map();
  attendance.forEach(row => {
    if (row.date >= from && row.date <= to) explicit.set(`${row.workerId}|${row.date}`, row);
  });
  const rows = [];
  eachAttendanceDate(from, to, (date, day) => {
    workers.forEach(worker => {
      if (!workerActiveOn(worker, date)) return;
      const saved = explicit.get(`${worker.id}|${date}`);
      if (saved) {
        rows.push({ ...saved, source:'exception', extraMinutes:attendanceExtraMinutes(saved) });
        explicit.delete(`${worker.id}|${date}`);
        return;
      }
      if (day === 0 || day === 6) return;
      const leave = approvedLeaveOn(worker.id, date);
      if (leave) {
        const half = HALF_DAY_TYPES.includes(leave.type);
        rows.push({
          id:`AUTO-LEAVE-${worker.id}-${date}`, workerId:worker.id, date,
          checkIn:half ? (leave.type === '오전반차' ? '13:00' : '08:00') : '',
          checkOut:half ? (leave.type === '오전반차' ? '17:00' : '12:00') : '',
          status:half ? '반차' : '휴가', note:leave.type, source:'leave', extraMinutes:0
        });
      } else {
        rows.push({
          id:`AUTO-NORMAL-${worker.id}-${date}`, workerId:worker.id, date,
          checkIn:normalizeTimeValue(worker.tin, '08:00'), checkOut:'17:00',
          status:'정상', note:'자동 만근', source:'auto', extraMinutes:0
        });
      }
    });
  });
  explicit.forEach(row => rows.push({ ...row, source:'exception', extraMinutes:attendanceExtraMinutes(row) }));
  return rows;
}
function attendanceSummary(workerId, month, dailyHours=8) {
  const [from, to] = attendanceDateRange('attendance', month);
  const rows = attendanceVirtualRows(from, to).filter(row => row.workerId === workerId);
  const absentDays = rows.reduce((sum,row) => sum + (row.status === '결근' ? 1 : 0), 0);
  const unpaidDays = leaves.filter(row => row.workerId === workerId && row.status === '승인' && row.type === '무급휴가')
    .reduce((sum,leave) => {
      let days = 0;
      eachAttendanceDate(leave.startDate, leave.endDate || leave.startDate, (date, day) => {
        if (date >= from && date <= to && day !== 0 && day !== 6) days++;
      });
      return sum + days;
    }, 0);
  const overtimeMinutes = rows.filter(row => row.status === '연장근무').reduce((sum,row) => sum + attendanceExtraMinutes(row), 0);
  const holidayMinutes = rows.filter(row => row.status === '휴일근무').reduce((sum,row) => sum + attendanceExtraMinutes(row), 0);
  const workDays = rows.filter(row => {
    const day = new Date(row.date + 'T00:00:00').getDay();
    if (day === 0 || day === 6 || row.status === '결근') return false;
    return row.status !== '휴가' || row.note !== '무급휴가';
  }).length;
  return { rows, workDays, absentDays:absentDays + unpaidDays, overtimeMinutes, holidayMinutes, dailyHours };
}

function attViewToggle() {
  return `<div class="hr-view-toggle">
    <button class="btn btn-sm ${attView==='list'?'btn-primary':''}" onclick="setAttView('list')"><i class="ti ti-list"></i>목록</button>
    <button class="btn btn-sm ${attView==='calendar'?'btn-primary':''}" onclick="setAttView('calendar')"><i class="ti ti-calendar-month"></i>달력</button>
  </div>`;
}

function renderAttendance() {
  const cont = inp('emp-tab-att'); if (!cont) return;
  cont.innerHTML = `<div class="hr-view-toolbar">${attViewToggle()}</div><div id="attendance-view-body"></div>`;
  const body = inp('attendance-view-body');
  ensureDateView('attendance', 'attendance-view-body', attendance.map(a => a.date), renderAttendance);
  const dateBar = inp('date-view-attendance');
  if (dateBar) dateBar.style.display = attView === 'list' ? 'flex' : 'none';
  if (body) body.innerHTML = attView === 'calendar' ? _attCalendar() : _attList();
}

function attendanceQuickStatusOptions(selected, weekend=false) {
  const statuses = weekend
    ? ['휴무','휴일근무','외근','결근']
    : ['정상','지각','조퇴','외근','결근','연장근무','휴가'];
  if (selected && !statuses.includes(selected)) statuses.push(selected);
  return statuses.map(status => `<option value="${status}"${status===selected?' selected':''}>${status}</option>`).join('');
}
function openAttendanceQuickDetail(workerId) {
  const saved = attendance.find(row => row.workerId === workerId && row.date === attQuickDate);
  if (saved) {
    openAttendanceEdit(saved.id);
    return;
  }
  openAttendanceAdd();
  sv('at-worker', workerId);
  sv('at-date', attQuickDate);
  const row = quickAttendanceRow(workerId);
  sv('at-status', row?.status === '휴무' ? '휴일근무' : row?.status || '지각');
  sv('at-in', row?.checkIn || '');
  sv('at-out', row?.checkOut || '');
  sv('at-extra-hours', row?.status === '휴일근무' ? '8' : '');
  sv('at-note', '');
  onAttendanceStatusChange();
}
function openAttendanceLeaveDetail(workerId) {
  const leave = approvedLeaveOn(workerId, attQuickDate);
  if (!leave) return;
  switchEmpTab('leave');
  openLeaveEdit(leave.id);
}
function _attQuickEditor() {
  const query = attQuickQuery.trim().toLowerCase();
  const list = hrVisibleWorkers().filter(worker => workerActiveOn(worker, attQuickDate)
    && (!attQuickDept || worker.dept === attQuickDept)
    && (!query || [worker.name,worker.id,worker.dept,worker.position].join(' ').toLowerCase().includes(query)));
  const weekend = [0,6].includes(new Date(attQuickDate + 'T00:00:00').getDay());
  const rows = list.length ? list.map(worker => {
    const row = quickAttendanceRow(worker.id);
    const linkedLeave = row?.source === 'leave';
    const extraEnabled = ['연장근무','휴일근무'].includes(row?.status);
    const checked = attQuickSelected.has(worker.id);
    return `<tr class="${row?.source === 'exception' ? 'att-quick-exception' : ''}">
      <td><input class="att-quick-check" data-worker-id="${esc(worker.id)}" type="checkbox" ${checked?'checked':''} onchange="toggleAttQuickSelect('${worker.id}',this.checked)"></td>
      <td class="att-quick-worker"><strong>${esc(worker.name)}</strong><span>${esc(worker.dept)||'—'} · ${esc(worker.position)||'—'}</span></td>
      <td>
        <select class="stat-sel att-quick-status" onchange="changeQuickAttendanceStatus('${worker.id}',this.value)" ${linkedLeave?'disabled':''}>
          ${attendanceQuickStatusOptions(row?.status || (weekend?'휴무':'정상'), weekend)}
        </select>
      </td>
      <td><input class="att-quick-time" type="time" value="${esc(normalizeTimeValue(row?.checkIn,''))}" onchange="changeQuickAttendanceField('${worker.id}','checkIn',this.value)" ${linkedLeave||['결근','휴가','휴무'].includes(row?.status)?'disabled':''}></td>
      <td><input class="att-quick-time" type="time" value="${esc(normalizeTimeValue(row?.checkOut,''))}" onchange="changeQuickAttendanceField('${worker.id}','checkOut',this.value)" ${linkedLeave||['결근','휴가','휴무'].includes(row?.status)?'disabled':''}></td>
      <td><input class="att-quick-extra" type="number" min="0" step=".5" value="${extraEnabled ? attendanceExtraMinutes(row)/60 : ''}" placeholder="시간" onchange="changeQuickAttendanceField('${worker.id}','extraMinutes',this.value)" ${linkedLeave||!extraEnabled?'disabled':''}></td>
      <td><input class="att-quick-note" value="${esc(row?.source==='auto'?'':row?.note||'')}" placeholder="${linkedLeave?'휴가 연동':'특이사항'}" onchange="changeQuickAttendanceField('${worker.id}','note',this.value)" ${linkedLeave?'disabled':''}></td>
      <td class="att-quick-actions">
        <span class="bd ${row?.source==='exception'?'bd-warn':linkedLeave?'bd-info':'bd-ok'}">${row?.source==='exception'?'예외':linkedLeave?'휴가':'자동'}</span>
        <button class="btn btn-sm btn-icon" onclick="${linkedLeave?`openAttendanceLeaveDetail('${worker.id}')`:`openAttendanceQuickDetail('${worker.id}')`}" title="${linkedLeave?'휴가 편집':'상세 편집'}"><i class="ti ti-edit"></i></button>
        ${row?.source==='exception'?`<button class="btn btn-sm btn-icon" onclick="restoreQuickAttendance('${worker.id}')" title="자동 상태로 복구"><i class="ti ti-restore"></i></button>`:''}
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="8">${empty('조건에 맞는 직원이 없습니다.')}</td></tr>`;
  return `<div class="card att-quick-card">
    <div class="card-hd att-quick-head">
      <div>
        <span class="card-ttl"><i class="ti ti-bolt"></i>하루 근태 간편 편집</span>
        <div class="att-quick-help">${weekend?'휴일 기본값은 휴무입니다. 근무자만 휴일근무로 변경하세요.':'별도 입력이 없으면 전 직원 정상근무로 자동 처리됩니다.'}</div>
      </div>
      <div id="att-quick-controls">${attQuickControlsHtml()}</div>
    </div>
    <div class="att-quick-table-wrap"><table class="att-quick-table">
      <thead><tr><th><input type="checkbox" onchange="toggleAttQuickAll(this.checked)"></th><th>직원</th><th>상태</th><th>출근</th><th>퇴근</th><th>추가시간</th><th>비고</th><th>관리</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function _attList() {
  const [from, to] = attendanceDateRange();
  const visibleIds = hrVisibleWorkerIds();
  const allRows = attendanceVirtualRows(from, to).filter(row => visibleIds.has(row.workerId));
  const recs = (attShowAll ? allRows : allRows.filter(row => row.source !== 'auto'))
    .sort((a,b) => b.date.localeCompare(a.date) || getWorkerName(a.workerId).localeCompare(getWorkerName(b.workerId)));
  const cnt = s => recs.filter(r => r.status === s).length;
  const normal = allRows.filter(r => r.status === '정상').length, late = cnt('지각'), early = cnt('조퇴');
  const ot = cnt('연장근무'), holiday = cnt('휴일근무'), absent = cnt('결근');
  const dhStats = (typeof payrollSettings === 'function' && Number(payrollSettings().dailyHours)) || 8;
  const dayMins = allRows.reduce((sum,row) => {
    if (['결근','휴가'].includes(row.status)) return sum;
    if (row.status === '휴일근무') return sum + attendanceExtraMinutes(row);
    if (row.status === '반차') return sum + (dhStats / 2) * 60;
    return sum + dhStats * 60 + (row.status === '연장근무' ? attendanceExtraMinutes(row) : 0);
  }, 0);

  const rows = recs.length ? recs.map(r => `
    <tr>
      <td>${esc(r.date)}</td>
      <td style="font-weight:700;">${esc(getWorkerName(r.workerId))}</td>
      <td>${esc((visibleWorkerById(r.workerId)||{}).dept) || '—'}</td>
      <td>${esc(r.checkIn) || '—'}</td>
      <td>${esc(r.checkOut) || '—'}</td>
      <td>${r.status === '연장근무' || r.status === '휴일근무' ? fmtHm(attendanceExtraMinutes(r)) : (calcWorkHours(r.checkIn, r.checkOut) || '—')}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${esc(r.note) || ''}${r.source === 'auto' ? ' <span class="bd bd-neu">자동</span>' : r.source === 'leave' ? ' <span class="bd bd-info">휴가 연동</span>' : ''}</td>
      <td style="white-space:nowrap;">
        ${r.source === 'exception' ? `<button class="btn btn-sm" onclick="openAttendanceEdit('${r.id}')" title="편집"><i class="ti ti-edit"></i></button>
        <button class="del-btn" onclick="deleteAttendance('${r.id}')" title="삭제"><i class="ti ti-trash"></i></button>` : '—'}
      </td>
    </tr>`).join('') : `<tr><td colspan="9">${empty('선택 기간에 등록된 예외 근태가 없습니다. 전 직원 정상근무로 자동 처리됩니다.')}</td></tr>`;

  return `
    <div class="metrics attendance-metrics">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-user-check"></i>자동 정상근무</div><div class="mc-val" style="color:var(--tx-ok);">${normal}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-exclamation"></i>지각·조퇴</div><div class="mc-val" style="color:${(late+early)>0?'var(--tx-w)':'var(--tx-s)'};">${late+early}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-plus"></i>연장근무</div><div class="mc-val">${ot}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calendar-event"></i>휴일근무</div><div class="mc-val">${holiday}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-user-x"></i>결근</div><div class="mc-val" style="color:${absent>0?'var(--tx-err)':'var(--tx-s)'};">${absent}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-hour-9"></i>선택 기간 근무시간</div><div class="mc-val" style="color:var(--tx-i);">${fmtHm(dayMins)}</div></div>
    </div>
    ${_attQuickEditor()}
    <div class="al al-info" style="margin-bottom:10px;"><i class="ti ti-wand"></i><div><div class="al-t">기본 근태 자동 처리</div><div class="al-s">재직 직원의 평일은 정상근무로 자동 계산됩니다. 휴가는 승인 기록을 연동하고, 지각·조퇴·결근·연장·휴일근무만 추가하세요.</div></div></div>
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-clock-check"></i>${attShowAll ? '전체 근태' : '예외 근태'}</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-sm" onclick="toggleAttendanceAll()"><i class="ti ti-${attShowAll?'filter':'list-check'}"></i>${attShowAll?'예외만 보기':'전체 근태 보기'}</button>
          <button class="btn btn-sm btn-primary" onclick="openAttendanceAdd()"><i class="ti ti-plus"></i>예외 근태 등록</button>
        </div>
      </div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>일자</th><th>직원</th><th>부서</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>상태</th><th>비고</th><th>관리</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

function _attCalendar() {
  const visibleIds = hrVisibleWorkerIds();
  const cal = calendarGrid(attMonth, ds => {
    const day = attendanceVirtualRows(ds, ds).filter(row => visibleIds.has(row.workerId));
    if (!day.length) return '';
    const cnt = s => day.filter(r => r.status === s).length;
    const parts = [];
    if (cnt('정상')) parts.push(`<span style="color:var(--tx-ok);">정상 ${cnt('정상')}</span>`);
    if (cnt('지각')) parts.push(`<span style="color:var(--tx-w);">지각 ${cnt('지각')}</span>`);
    if (cnt('결근')) parts.push(`<span style="color:var(--tx-err);">결근 ${cnt('결근')}</span>`);
    if (cnt('휴가')) parts.push(`<span style="color:var(--tx-s);">휴가 ${cnt('휴가')}</span>`);
    if (cnt('연장근무')) parts.push(`<span style="color:var(--tx-i);">연장 ${cnt('연장근무')}</span>`);
    if (cnt('휴일근무')) parts.push(`<span style="color:var(--tx-i);">휴일 ${cnt('휴일근무')}</span>`);
    return parts.join('<br>');
  });

  // 직원별 월 근무시간 요약
  const dhSummary = (typeof payrollSettings === 'function' && Number(payrollSettings().dailyHours)) || 8;
  const summary = hrVisibleWorkers().map(w => {
    const data = attendanceSummary(w.id, attMonth, dhSummary);
    const recs = data.rows;
    const days = data.workDays;
    const mins = days * data.dailyHours * 60 + data.overtimeMinutes + data.holidayMinutes;
    const late = recs.filter(r => r.status === '지각').length;
    return { w, days, mins, late, absent:data.absentDays, overtime:data.overtimeMinutes, holiday:data.holidayMinutes };
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
      <td>${fmtHm(s.overtime)}</td>
      <td>${fmtHm(s.holiday)}</td>
    </tr>`).join('') : `<tr><td colspan="8">${empty('이번 달 근태 기록이 없습니다.')}</td></tr>`;

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-calendar-month"></i>근태 달력</span>
        <div style="display:flex;gap:8px;align-items:center;">
          ${monthNavBar(attMonth, 'attPrevMonth()', 'attNextMonth()')}
          <button class="btn btn-sm btn-primary" onclick="openAttendanceAdd()"><i class="ti ti-plus"></i>예외 근태 등록</button>
        </div>
      </div>
      ${cal}
    </div>
    <div class="card">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-clock-hour-9"></i>${monthLabel(attMonth)} 직원별 근무시간 요약</span>
        <span style="font-size:13px;">총 근무시간 <b style="color:var(--tx-i);">${fmtHm(totalMins)}</b></span></div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>직원</th><th>부서</th><th>근무일수</th><th>총 근무시간</th><th>지각</th><th>결근</th><th>연장</th><th>휴일</th></tr></thead>
        <tbody>${sumRows}</tbody>
      </table></div>
    </div>`;
}

function openAttendanceAdd() {
  if (typeof requireCreateAction === 'function' && !requireCreateAction('workers', '근태 등록')) return;
  if (!hrVisibleWorkers().length) { showToast('먼저 직원을 등록하세요.', 'error'); return; }
  const modal = inp('att-modal');
  delete modal.dataset.editId;
  inp('att-modal-ttl').innerHTML = '<i class="ti ti-clock-check" style="color:var(--tx-i);"></i>예외 근태 등록';
  inp('at-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('at-worker').innerHTML = workerSelectOptions();
  sv('at-date', attDateFilter || today());
  sv('at-status', '지각');
  sv('at-in', '08:00');
  sv('at-out', '17:00');
  sv('at-extra-hours', '');
  sv('at-note', '');
  onAttendanceStatusChange();
  modal.classList.add('open');
}

function onAttendanceStatusChange() {
  const status = v('at-status');
  const extra = inp('at-extra-hours');
  if (extra) {
    extra.disabled = !['연장근무','휴일근무'].includes(status);
    extra.placeholder = status === '휴일근무' ? '예: 8' : '예: 2';
    if (extra.disabled) extra.value = '';
  }
  if (status === '결근') {
    sv('at-in', '');
    sv('at-out', '');
  } else if (status === '휴일근무') {
    if (!v('at-in')) sv('at-in', '09:00');
    if (!v('at-out')) sv('at-out', '18:00');
    if (!v('at-extra-hours')) sv('at-extra-hours', '8');
  } else if (status === '연장근무') {
    if (!v('at-in')) sv('at-in', '08:00');
    if (!v('at-out')) sv('at-out', '19:00');
    if (!v('at-extra-hours')) sv('at-extra-hours', '2');
  }
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
  sv('at-extra-hours', attendanceExtraMinutes(r) ? attendanceExtraMinutes(r) / 60 : '');
  sv('at-note', r.note || '');
  onAttendanceStatusChange();
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
    status: v('at-status') || '지각',
    extraMinutes: Math.round((Number(v('at-extra-hours')) || 0) * 60),
    note: v('at-note') || ''
  };
  if (editId) {
    const r = attendance.find(x => x.id === editId);
    if (r) Object.assign(r, data);
    delete modal.dataset.editId;
    showToast('근태 기록이 수정되었습니다.');
  } else {
    const existing = attendance.find(row => row.workerId === workerId && row.date === date);
    if (existing) {
      Object.assign(existing, data);
      showToast('같은 날짜의 기존 근태 기록을 갱신했습니다.');
    } else {
      attendance.push({ id: nextCode('ATT', attendance), ...data });
      showToast('예외 근태가 등록되었습니다.');
    }
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
  return `<div class="hr-view-toggle">
    <button class="btn btn-sm ${leaveView==='list'?'btn-primary':''}" onclick="setLeaveView('list')"><i class="ti ti-list"></i>목록</button>
    <button class="btn btn-sm ${leaveView==='calendar'?'btn-primary':''}" onclick="setLeaveView('calendar')"><i class="ti ti-calendar-month"></i>달력</button>
  </div>`;
}

/* 연차 현황 카드 (부여/사용/잔여) */
function _annualStatusCard() {
  const year = new Date(today()).getFullYear();
  const workerRows = hrVisibleWorkers();
  const rows = workerRows.length ? workerRows.map(w => {
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
  cont.innerHTML = `<div class="hr-view-toolbar">${leaveViewToggle()}</div><div id="leave-view-body"></div>`;
  const body = inp('leave-view-body');
  const visibleIds = hrVisibleWorkerIds();
  const visibleLeaves = leaves.filter(l => visibleIds.has(l.workerId));
  ensureDateView('employeeLeaves', 'leave-view-body', visibleLeaves.map(l => l.startDate), renderLeaves);
  const dateBar = inp('date-view-employeeLeaves');
  if (dateBar) dateBar.style.display = leaveView === 'list' ? 'flex' : 'none';

  const filteredLeaves = visibleLeaves.filter(l => dateViewMatch('employeeLeaves', l.startDate));
  const metricLeaves = leaveView === 'list'
    ? filteredLeaves
    : visibleLeaves.filter(l => (l.startDate||'').slice(0,7) === leaveMonth);
  const pending = metricLeaves.filter(l => l.status === '신청').length;
  const approved = metricLeaves.filter(l => l.status === '승인').length;
  const usedDays = metricLeaves.filter(l => l.status === '승인')
    .reduce((s,l) => s + (Number(l.days)||0), 0);
  const usedLabel = leaveView === 'list' ? '조회 기간 사용(승인)' : `${monthLabel(leaveMonth)} 사용(승인)`;

  const metrics = `
    <div class="metrics" style="grid-template-columns:repeat(3,1fr);">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-clock-hour-4"></i>승인 대기</div><div class="mc-val" style="color:${pending>0?'var(--tx-w)':'var(--tx-s)'};">${pending}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-calendar-check"></i>승인 완료</div><div class="mc-val" style="color:var(--tx-ok);">${approved}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-beach"></i>${usedLabel}</div><div class="mc-val">${usedDays}일</div></div>
    </div>`;

  if (leaveView === 'calendar') {
    const cal = calendarGrid(leaveMonth, ds => {
      const day = visibleLeaves.filter(l => l.status !== '반려' && (l.startDate||'') <= ds && (l.endDate||l.startDate||'') >= ds);
      if (!day.length) return '';
      return day.map(l => {
        const color = l.status === '승인' ? 'var(--tx-ok)' : 'var(--tx-w)';
        return `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${color};">• ${getWorkerName(l.workerId)} <span style="color:var(--tx-t);">${l.type}</span></div>`;
      }).join('');
    });
    body.innerHTML = `
      ${metrics}
      <div class="card" style="margin-bottom:16px;">
        <div class="card-hd">
          <span class="card-ttl"><i class="ti ti-calendar-month"></i>휴가 달력</span>
          <div style="display:flex;gap:8px;align-items:center;">
            ${monthNavBar(leaveMonth, 'leavePrevMonth()', 'leaveNextMonth()')}
            <button class="btn btn-sm btn-primary" onclick="openLeaveAdd()"><i class="ti ti-plus"></i>휴가 신청 등록</button>
          </div>
        </div>
        ${cal}
      </div>
      ${_annualStatusCard()}`;
    return;
  }

  const list = [...filteredLeaves].sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''));
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

  body.innerHTML = `
    ${metrics}
    ${_annualStatusCard()}
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-beach"></i>휴가 신청 현황</span>
        <div style="display:flex;gap:6px;align-items:center;">
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
  if (typeof requireCreateAction === 'function' && !requireCreateAction('workers', '휴가 등록')) return;
  if (!hrVisibleWorkers().length) { showToast('먼저 직원을 등록하세요.', 'error'); return; }
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
