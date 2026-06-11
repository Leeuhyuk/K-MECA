/* ════════ 메모·할 일 통합 관리 ════════ */
let memoTab = 'memos';
let _memoAiResult = null;
let _memoAttachments = [];
let _todoChecklist = [];
let _weeklyReportDraft = null;
let _todoSelected = new Set();

function _memoEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _memoNow() { return new Date().toISOString(); }
function _memoAuthor() {
  return (_cloudUser && (_cloudUser.displayName || _cloudUser.email)) || '사용자';
}
function _memoTags(value) {
  return String(value || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
}

function switchMemoTab(tab) {
  memoTab = tab || 'memos';
  document.querySelectorAll('[data-memotab]').forEach(function(btn) {
    btn.classList.toggle('btn-primary', btn.dataset.memotab === memoTab);
  });
  renderNotes();
}

function updateTodoBadge() {
  var badge = inp('todoBadge');
  if (!badge || typeof todoList === 'undefined') return;
  var count = todoList.filter(function(item) { return item.status !== '완료'; }).length;
  badge.textContent = count;
  badge.style.display = count ? '' : 'none';
}

function renderNotes() {
  var content = inp('memo-content');
  if (!content) return;
  updateTodoBadge();
  scanTodoReminders();
  renderMemoKpi();
  document.querySelectorAll('[data-memotab]').forEach(function(btn) {
    btn.classList.toggle('btn-primary', btn.dataset.memotab === memoTab);
  });
  if (memoTab === 'todos') renderTodoList();
  else if (memoTab === 'board') renderTodoBoard();
  else if (memoTab === 'report') renderWeeklyReportPanel();
  else renderMemoCards();
}

function renderMemoKpi() {
  var box = inp('memo-kpi');
  if (!box) return;
  var open = todoList.filter(function(t) { return t.status !== '완료'; }).length;
  var overdue = todoList.filter(function(t) { return t.status !== '완료' && t.dueDate && t.dueDate < today(); }).length;
  var important = memoList.filter(function(m) { return m.important; }).length;
  box.innerHTML =
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-notes"></i>전체 메모</div><div class="mc-val">' + memoList.length + '</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-list-check"></i>미완료 할 일</div><div class="mc-val" style="color:var(--tx-i);">' + open + '</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-alert-triangle"></i>기한 초과</div><div class="mc-val" style="color:var(--tx-d);">' + overdue + '</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-pin"></i>중요 메모</div><div class="mc-val" style="color:var(--tx-w);">' + important + '</div></div>';
}

function _memoQueryMatch(item, q) {
  return !q || [item.title, item.content, item.owner, (item.tags || []).join(' '), item.summary]
    .join(' ').toLowerCase().includes(q);
}

function renderMemoCards() {
  var q = v('memo-search').trim().toLowerCase();
  var filter = v('memo-filter');
  var list = memoList.filter(function(m) {
    if (!_memoQueryMatch(m, q)) return false;
    return filter !== 'important' || m.important;
  }).sort(function(a, b) {
    return Number(!!b.important) - Number(!!a.important) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  var content = inp('memo-content');
  if (!list.length) {
    content.innerHTML = '<div class="card"><div class="empty"><i class="ti ti-notes"></i>등록된 메모가 없습니다.</div></div>';
    return;
  }
  content.innerHTML = '<div class="memo-grid">' + list.map(function(m) {
    var tags = (m.tags || []).map(function(tag) { return '<span class="memo-tag">#' + _memoEsc(tag) + '</span>'; }).join('');
    var linked = m.entityType ? '<span><i class="ti ti-link"></i>' + _memoEsc(m.entityType + ' ' + (m.entityId || '')) + '</span>' : '';
    var attachmentCount = (m.attachments || []).length;
    return '<div class="memo-card">' +
      '<div style="display:flex;align-items:center;gap:8px;"><div class="memo-card-title" style="flex:1;">' +
      (m.important ? '<i class="ti ti-pin" style="color:var(--tx-w);"></i> ' : '') + _memoEsc(m.title) + '</div>' +
      '<button class="btn btn-sm btn-icon" onclick="openMemoEditor(\'' + m.id + '\')" title="수정"><i class="ti ti-edit"></i></button>' +
      '<button class="btn btn-sm btn-icon" onclick="deleteMemo(\'' + m.id + '\')" title="삭제"><i class="ti ti-trash"></i></button></div>' +
      '<div class="memo-card-body">' + _memoEsc(m.content) + '</div>' +
      (m.summary ? '<div style="font-size:11px;padding:8px;border-left:3px solid var(--tx-i);background:var(--bg-i);margin-bottom:9px;"><b>AI 요약</b><br>' + _memoEsc(m.summary) + '</div>' : '') +
      '<div class="memo-meta">' + tags + linked +
      (attachmentCount ? '<span><i class="ti ti-paperclip"></i>' + attachmentCount + '</span>' : '') +
      '<span style="margin-left:auto;">' + _memoEsc(m.author || '') + ' · ' + _memoEsc(String(m.updatedAt || '').slice(0, 10)) + '</span></div>' +
    '</div>';
  }).join('') + '</div>';
}

function _filteredTodos() {
  var q = v('memo-search').trim().toLowerCase();
  var filter = v('memo-filter');
  return todoList.filter(function(t) {
    if (!_memoQueryMatch(t, q)) return false;
    if (filter === 'important') return t.priority === '긴급' || t.priority === '높음';
    if (filter === 'overdue') return t.status !== '완료' && t.dueDate && t.dueDate < today();
    if (filter === 'today') return t.status !== '완료' && t.dueDate === today();
    return true;
  });
}

function renderTodoList() {
  var list = _filteredTodos().sort(function(a, b) {
    return (a.status === '완료') - (b.status === '완료') || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
  });
  var validIds = new Set(todoList.map(function(t) { return t.id; }));
  _todoSelected.forEach(function(id) { if (!validIds.has(id)) _todoSelected.delete(id); });
  var content = inp('memo-content');
  if (!list.length) {
    content.innerHTML = '<div class="card"><div class="empty"><i class="ti ti-list-check"></i>등록된 할 일이 없습니다.</div></div>';
    return;
  }
  var visibleSelected = list.filter(function(t) { return _todoSelected.has(t.id); }).length;
  var allVisibleSelected = list.length > 0 && visibleSelected === list.length;
  var bulkBar = '<div id="todo-bulkbar" style="display:' + (_todoSelected.size ? 'flex' : 'none') +
    ';align-items:center;gap:14px;margin:0 0 12px;padding:12px 18px;border-radius:9px;flex-wrap:wrap;">' +
    '<span style="font-weight:700;font-size:13px;color:#85bceb;"><i class="ti ti-checkbox"></i> ' +
    _todoSelected.size + '건 선택됨</span>' +
    '<button class="btn btn-sm btn-danger" onclick="deleteSelectedTodos()"><i class="ti ti-trash"></i>선택 삭제</button></div>';
  content.innerHTML = bulkBar + '<div class="card" style="overflow-x:auto;"><table style="min-width:900px;"><thead><tr>' +
    '<th style="width:34px;text-align:center;"><input type="checkbox" id="todo-check-all" title="현재 목록 전체 선택" ' +
    (allVisibleSelected ? 'checked ' : '') + (visibleSelected && !allVisibleSelected ? 'data-indeterminate="1" ' : '') +
    'onchange="toggleAllVisibleTodos(this.checked)"></th>' +
    '<th>할 일</th><th>담당자</th><th>마감일</th><th>우선순위</th><th>상태</th><th style="width:82px;text-align:center;">관리</th></tr></thead><tbody>' +
    list.map(function(t) {
      var late = t.status !== '완료' && t.dueDate && t.dueDate < today();
      var selected = _todoSelected.has(t.id);
      return '<tr class="' + (selected ? 'todo-row-selected' : '') + '">' +
        '<td style="text-align:center;"><input type="checkbox" class="todo-select" ' + (selected ? 'checked ' : '') +
        'onchange="toggleTodoSelection(\'' + t.id + '\',this.checked)"></td>' +
        '<td><b style="' + (t.status === '완료' ? 'text-decoration:line-through;color:var(--tx-t);' : '') + '">' + _memoEsc(t.title) + '</b>' +
        (t.content ? '<div style="font-size:10.5px;color:var(--tx-t);margin-top:3px;">' + _memoEsc(t.content) + '</div>' : '') + '</td>' +
        '<td>' + _memoEsc(t.owner || '미지정') + '</td><td style="color:' + (late ? 'var(--tx-d)' : 'inherit') + ';">' + _memoEsc(t.dueDate || '미설정') + '</td>' +
        '<td>' + _memoEsc(t.priority || '보통') + '</td><td><select onchange="setTodoStatus(\'' + t.id + '\',this.value)" style="height:27px;">' +
        ['대기','진행중','완료'].map(function(s) { return '<option' + (s === t.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
        '<td style="text-align:center;"><button class="btn btn-sm" onclick="openTodoEditor(\'' + t.id + '\')" title="수정"><i class="ti ti-edit"></i>수정</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  var selectAll = content.querySelector('thead input[type=checkbox]');
  if (selectAll) selectAll.indeterminate = visibleSelected > 0 && !allVisibleSelected;
}

function toggleTodoSelection(id, checked) {
  if (checked) _todoSelected.add(id);
  else _todoSelected.delete(id);
  renderTodoList();
}

function toggleAllVisibleTodos(checked) {
  _filteredTodos().forEach(function(todo) {
    if (checked) _todoSelected.add(todo.id);
    else _todoSelected.delete(todo.id);
  });
  renderTodoList();
}

function clearTodoSelection() {
  _todoSelected.clear();
  renderTodoList();
}

function deleteSelectedTodos() {
  var ids = Array.from(_todoSelected);
  if (!ids.length) return;
  confirm_('할 일 일괄 삭제', ids.length + '개의 할 일을 삭제하시겠습니까?', function() {
    todoList = todoList.filter(function(todo) { return !_todoSelected.has(todo.id); });
    _todoSelected.clear();
    saveStorage('todoList', todoList);
    renderNotes();
    showToast(ids.length + '개의 할 일을 삭제했습니다.', 'success');
  });
}

function renderTodoBoard() {
  var list = _filteredTodos();
  var content = inp('memo-content');
  content.innerHTML = '<div class="todo-board">' + ['대기','진행중','완료'].map(function(status) {
    var rows = list.filter(function(t) { return t.status === status; });
    return '<div class="todo-col"><div style="font-weight:800;font-size:12px;">' + status + ' <span class="memo-tag">' + rows.length + '</span></div>' +
      rows.map(function(t) {
        return '<div class="todo-item" onclick="openTodoEditor(\'' + t.id + '\')" style="cursor:pointer;">' +
          '<div style="font-size:12px;font-weight:750;">' + _memoEsc(t.title) + '</div>' +
          '<div class="memo-meta" style="margin-top:8px;"><span>' + _memoEsc(t.owner || '미지정') + '</span><span style="margin-left:auto;">' + _memoEsc(t.dueDate || '') + '</span></div></div>';
      }).join('') + '</div>';
  }).join('') + '</div>';
}

function openMemoEditor(id) {
  var memo = memoList.find(function(m) { return m.id === id; });
  sv('memo-id', memo ? memo.id : '');
  sv('memo-title', memo ? memo.title : '');
  sv('memo-content-input', memo ? memo.content : '');
  sv('memo-tags', memo ? (memo.tags || []).join(', ') : '');
  sv('memo-entity', memo ? memo.entityType : '');
  sv('memo-entity-id', memo ? memo.entityId : '');
  fillMemoEntityOptions();
  inp('memo-important').checked = !!(memo && memo.important);
  inp('memo-editor-title').textContent = memo ? '메모 수정' : '메모 작성';
  _memoAiResult = memo && memo.aiResult ? memo.aiResult : null;
  _memoAttachments = memo ? (memo.attachments || []).map(function(a) { return Object.assign({}, a); }) : [];
  renderMemoAttachments();
  renderMemoHistory(memo);
  renderMemoAiResult();
  inp('memo-editor').classList.add('open');
}

function saveMemo(closeAfter) {
  if (closeAfter === undefined) closeAfter = true;
  var title = v('memo-title').trim();
  var content = v('memo-content-input').trim();
  if (!title || !content) { showToast('제목과 내용을 입력하세요.', 'error'); return ''; }
  var id = v('memo-id');
  var memo = memoList.find(function(m) { return m.id === id; });
  if (!memo) {
    memo = { id: nextCode('MEM', memoList), createdAt: _memoNow(), author: _memoAuthor(), history: [] };
    memoList.unshift(memo);
    sv('memo-id', memo.id);
  } else {
    memo.history = memo.history || [];
    memo.history.unshift({
      changedAt: _memoNow(), changedBy: _memoAuthor(),
      title: memo.title || '', content: String(memo.content || '').slice(0, 5000), tags: (memo.tags || []).slice()
    });
    memo.history = memo.history.slice(0, 20);
  }
  memo.title = title;
  memo.content = content;
  memo.tags = _memoTags(v('memo-tags'));
  memo.entityType = v('memo-entity');
  memo.entityId = v('memo-entity-id').trim();
  memo.important = inp('memo-important').checked;
  memo.attachments = _memoAttachments.map(function(a) {
    if (a.dataUrl) memoAttachmentData[a.id] = a.dataUrl;
    return { id:a.id, name:a.name, type:a.type, size:a.size };
  });
  saveStorage('memoAttachmentData', memoAttachmentData);
  memo.updatedAt = _memoNow();
  if (_memoAiResult) {
    memo.aiResult = _memoAiResult;
    memo.summary = _memoAiResult.summary || '';
  }
  saveStorage('memoList', memoList);
  if (closeAfter) {
    closeModal('memo-editor');
    renderNotes();
    showToast('메모가 저장되었습니다.', 'success');
  }
  return memo.id;
}

function deleteMemo(id) {
  confirm_('메모 삭제', '이 메모를 삭제하시겠습니까? 연결된 할 일은 유지됩니다.', function() {
    var memo = memoList.find(function(m) { return m.id === id; });
    (memo && memo.attachments || []).forEach(function(a) { delete memoAttachmentData[a.id]; });
    saveStorage('memoAttachmentData', memoAttachmentData);
    memoList = memoList.filter(function(m) { return m.id !== id; });
    saveStorage('memoList', memoList);
    renderNotes();
  });
}

function _fillTodoMemoOptions(selected) {
  var select = inp('todo-memo-id');
  select.innerHTML = '<option value="">연결 안 함</option>' + memoList.map(function(m) {
    return '<option value="' + m.id + '"' + (m.id === selected ? ' selected' : '') + '>' + _memoEsc(m.id + ' · ' + m.title) + '</option>';
  }).join('');
}

function openTodoEditor(id, preset) {
  var todo = todoList.find(function(t) { return t.id === id; }) || preset || null;
  sv('todo-id', todo && todo.id ? todo.id : '');
  sv('todo-title', todo ? todo.title : '');
  sv('todo-content', todo ? todo.content : '');
  sv('todo-owner', todo ? todo.owner : '');
  sv('todo-due', todo ? todo.dueDate : '');
  sv('todo-start', todo ? todo.startDate : '');
  sv('todo-reminder', todo ? todo.reminderDate : '');
  sv('todo-status', todo ? todo.status : '대기');
  sv('todo-priority', todo ? todo.priority : '보통');
  sv('todo-repeat', todo ? todo.repeat : '');
  _todoChecklist = todo ? (todo.checklist || []).map(function(x) { return Object.assign({}, x); }) : [];
  renderTodoChecklist();
  _fillTodoMemoOptions(todo ? todo.memoId : '');
  inp('todo-editor-title').textContent = todo && todo.id ? '할 일 수정' : '할 일 등록';
  inp('todo-editor').classList.add('open');
}

function saveTodo() {
  var title = v('todo-title').trim();
  if (!title) { showToast('할 일 내용을 입력하세요.', 'error'); return; }
  var id = v('todo-id');
  var todo = todoList.find(function(t) { return t.id === id; });
  if (!todo) {
    todo = { id: nextCode('TODO', todoList), createdAt: _memoNow(), author: _memoAuthor() };
    todoList.unshift(todo);
  }
  todo.title = title;
  todo.content = v('todo-content').trim();
  todo.owner = v('todo-owner').trim();
  todo.dueDate = v('todo-due');
  todo.startDate = v('todo-start');
  todo.reminderDate = v('todo-reminder');
  todo.status = v('todo-status') || '대기';
  todo.priority = v('todo-priority') || '보통';
  todo.repeat = v('todo-repeat');
  todo.checklist = _todoChecklist.slice();
  todo.memoId = v('todo-memo-id');
  todo.updatedAt = _memoNow();
  saveStorage('todoList', todoList);
  closeModal('todo-editor');
  renderNotes();
  showToast('할 일이 저장되었습니다.', 'success');
}

function setTodoStatus(id, status) {
  var todo = todoList.find(function(t) { return t.id === id; });
  if (!todo) return;
  todo.status = status;
  if (status === '완료' && todo.repeat) createNextRepeatedTodo(todo);
  todo.updatedAt = _memoNow();
  saveStorage('todoList', todoList);
  renderNotes();
}
function toggleTodoDone(id, done) { setTodoStatus(id, done ? '완료' : '대기'); }
function deleteTodo(id) {
  confirm_('할 일 삭제', '선택한 할 일을 삭제하시겠습니까?', function() {
    todoList = todoList.filter(function(t) { return t.id !== id; });
    _todoSelected.delete(id);
    saveStorage('todoList', todoList);
    renderNotes();
  });
}

function renderMemoAiResult() {
  var box = inp('memo-ai-result');
  var button = inp('memo-ai-todo-btn');
  if (!box || !button) return;
  if (!_memoAiResult) { box.style.display = 'none'; button.style.display = 'none'; return; }
  var points = Array.isArray(_memoAiResult.keyPoints) ? _memoAiResult.keyPoints : [];
  var actionList = normalizeAiActionItems(_memoAiResult.actionItems);
  var actions = actionList.map(function(x) { return '<li>' + _memoEsc(x.text) + '</li>'; }).join('');
  box.innerHTML = '<b><i class="ti ti-sparkles"></i> Gemini 요약</b><div style="margin-top:7px;">' +
    _memoEsc(_memoAiResult.summary || '') + '</div>' +
    (points ? '<div style="margin-top:8px;"><b>핵심 내용</b><ul style="margin:4px 0 0 18px;">' + points + '</ul></div>' : '') +
    (actions ? '<div style="margin-top:8px;"><b>실행 항목</b><ul style="margin:4px 0 0 18px;">' + actions + '</ul></div>' : '');
  box.style.display = '';
  button.style.display = actions ? '' : 'none';
}

function normalizeAiActionItems(items) {
  if (!items) return [];
  if (!Array.isArray(items)) items = [items];
  return items.map(function(item) {
    if (typeof item === 'string') return { text:item, owner:'', dueDate:'' };
    return {
      text:String(item.text || item.task || item.title || '').trim(),
      owner:String(item.owner || item.assignee || '').trim(),
      dueDate:normalizeAiDueDate(item.dueDate || item.due || '')
    };
  }).filter(function(item) { return !!item.text; });
}

function normalizeAiDueDate(value) {
  var text = String(value || '').trim();
  if (!text) return '';

  var match = text.match(/(\d{4})\s*[-/.년]\s*(\d{1,2})\s*[-/.월]\s*(\d{1,2})/);
  var hasYear = !!match;
  if (!match) {
    match = text.match(/(\d{1,2})\s*[-/.월]\s*(\d{1,2})/);
  }
  if (!match) return '';

  var now = new Date();
  var year = hasYear ? Number(match[1]) : now.getFullYear();
  var month = Number(match[hasYear ? 2 : 1]);
  var day = Number(match[hasYear ? 3 : 2]);
  var candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return '';

  var todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < todayLocal) {
    year = now.getFullYear();
    candidate = new Date(year, month - 1, day);
    if (candidate < todayLocal) {
      year++;
      candidate = new Date(year, month - 1, day);
    }
  }

  return [
    candidate.getFullYear(),
    String(candidate.getMonth() + 1).padStart(2, '0'),
    String(candidate.getDate()).padStart(2, '0')
  ].join('-');
}

async function runMemoAiSummary(ev) {
  var text = v('memo-content-input').trim();
  if (!text) { showToast('요약할 메모 내용을 입력하세요.', 'error'); return; }
  var button = ev && ev.currentTarget;
  if (button) { button.disabled = true; button.innerHTML = '<i class="ti ti-loader animate-spin"></i>요약 중'; }
  try {
    _memoAiResult = await summarizeMemoWithGemini(text);
    renderMemoAiResult();
    showToast('Gemini 요약이 완료되었습니다.', 'success');
  } catch (error) {
    showToast(error.message || 'AI 요약에 실패했습니다.', 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-sparkles"></i>Gemini 요약'; }
  }
}

function addAiTodos() {
  var actions = normalizeAiActionItems(_memoAiResult && _memoAiResult.actionItems);
  if (!actions.length) {
    showToast('등록할 실행 항목이 없습니다.', 'error');
    return;
  }
  var memoId = saveMemo(false);
  if (!memoId) return;
  var created = 0;
  actions.forEach(function(item) {
    var duplicate = todoList.some(function(todo) {
      return todo.memoId === memoId && todo.title === item.text && todo.status !== '완료';
    });
    if (duplicate) return;
    todoList.unshift({
      id: nextCode('TODO', todoList), title: item.text, content: 'Gemini 메모 요약에서 생성',
      owner: item.owner || '', dueDate: item.dueDate || '', status: '대기',
      priority: '보통', memoId: memoId, checklist: [], createdAt: _memoNow(), updatedAt: _memoNow(), author: _memoAuthor()
    });
    created++;
  });
  saveStorage('todoList', todoList);
  updateTodoBadge();
  inp('memo-ai-todo-btn').style.display = 'none';
  closeModal('memo-editor');
  memoTab = 'todos';
  sv('memo-search', '');
  sv('memo-filter', '');
  renderNotes();
  showToast(created ? created + '개의 할 일이 등록되었습니다.' : '이미 등록된 할 일입니다.', created ? 'success' : 'info');
}

function addMemoApiSamples() {
  var existing = new Set(memoList.filter(function(m) { return m.sampleKey; }).map(function(m) { return m.sampleKey; }));
  var samples = [
    {
      sampleKey:'api-meeting',
      title:'[API 테스트] 신제품 제작 회의록',
      content:'오늘 신제품 내구성 시험기 제작 회의를 진행했다. 프레임 도면은 김대리가 6월 12일까지 수정하고, 구매팀은 감속기와 LM가이드 견적을 6월 13일까지 받아야 한다. 전장 부품 수급이 늦어질 가능성이 있어 납기 위험을 확인해야 한다. 조립 시작 목표일은 6월 17일이며 고객사 중간 점검은 6월 20일로 예정되어 있다.',
      tags:['API 테스트','회의록','신제품'],
      important:true
    },
    {
      sampleKey:'api-purchase',
      title:'[API 테스트] 자재 구매 및 납기 확인',
      content:'프로파일은 예주산업에 발주 완료했고 6월 14일 입고 예정이다. 감속기는 기존 견적보다 단가가 8% 상승하여 대체 공급처 검토가 필요하다. 베어링은 재고 2개를 우선 사용하고 부족한 4개를 추가 발주한다. 모든 자재의 확정 납기를 금요일 오전까지 생산팀에 공유한다.',
      tags:['API 테스트','구매','납기'],
      important:false
    },
    {
      sampleKey:'api-as',
      title:'[API 테스트] 고객 A/S 접수 내용',
      content:'고객사에서 장비 작동 중 반복 소음과 위치 오차가 발생한다고 연락했다. 우선 원격으로 센서 영점과 체결 상태를 확인하고 해결되지 않으면 6월 15일 현장 방문한다. 담당자는 박지호이며 보증 기간 내 접수 건이다. 방문 전 교체용 베어링과 센서를 준비해야 한다.',
      tags:['API 테스트','A/S','고객'],
      important:true
    },
    {
      sampleKey:'api-risk',
      title:'[API 테스트] 생산 지연 위험 보고',
      content:'현재 제작 진행률은 65%이다. 레이저 가공품 입고가 이틀 지연되었고 배선 작업 담당자가 다른 긴급 프로젝트를 지원 중이다. 계획 납기일을 맞추려면 조립 인원을 한 명 추가 배치하고 검사 일정을 하루 앞당겨야 한다. 고객에게는 현재 상황과 회복 계획을 내일까지 안내한다.',
      tags:['API 테스트','생산','위험'],
      important:true
    }
  ];
  var added = 0;
  samples.forEach(function(sample) {
    if (existing.has(sample.sampleKey)) return;
    memoList.unshift({
      id:nextCode('MEM', memoList), sampleKey:sample.sampleKey,
      title:sample.title, content:sample.content, tags:sample.tags,
      important:sample.important, entityType:'', entityId:'',
      attachments:[], history:[], author:'API 테스트',
      createdAt:_memoNow(), updatedAt:_memoNow()
    });
    added++;
  });
  saveStorage('memoList', memoList);
  memoTab = 'memos';
  sv('memo-search', 'API 테스트');
  renderNotes();
  showToast(added ? added + '개의 API 테스트 예문을 추가했습니다.' : '테스트 예문이 이미 등록되어 있습니다.', added ? 'success' : 'info');
}

function removeMemoApiSamples() {
  var count = memoList.filter(function(m) { return !!m.sampleKey; }).length;
  if (!count) { showToast('정리할 API 테스트 예문이 없습니다.', 'info'); return; }
  confirm_('API 테스트 예문 정리', count + '개의 테스트 메모와 연결된 테스트 할 일을 삭제하시겠습니까?', function() {
    var ids = new Set(memoList.filter(function(m) { return !!m.sampleKey; }).map(function(m) { return m.id; }));
    memoList = memoList.filter(function(m) { return !m.sampleKey; });
    todoList = todoList.filter(function(t) {
      return !ids.has(t.memoId) && t.author !== 'API 테스트';
    });
    saveStorage('memoList', memoList);
    saveStorage('todoList', todoList);
    sv('memo-search', '');
    renderNotes();
    showToast('API 테스트 예문을 정리했습니다.', 'success');
  }, 'btn-danger', 'ti-eraser');
}

function fillMemoEntityOptions() {
  var type = v('memo-entity');
  var list = [];
  if (type === 'product') list = products.map(function(x) { return { id:x.id, label:x.name }; });
  else if (type === 'material') list = materials.map(function(x) { return { id:x.id, label:x.name }; });
  else if (type === 'order') list = workOrders.map(function(x) { return { id:x.id, label:getProductName(x.productId) }; });
  else if (type === 'claim') list = claims.map(function(x) { return { id:x.id, label:x.content }; });
  else if (type === 'as') list = asList.map(function(x) { return { id:x.id, label:x.productName || x.symptom }; });
  var options = inp('memo-entity-options');
  if (options) options.innerHTML = list.map(function(x) {
    return '<option value="' + _memoEsc(x.id) + '">' + _memoEsc(x.label || '') + '</option>';
  }).join('');
}

function addMemoAttachments(input) {
  var files = Array.from(input.files || []);
  if (_memoAttachments.length + files.length > 5) {
    showToast('첨부파일은 최대 5개까지 등록할 수 있습니다.', 'error');
    input.value = '';
    return;
  }
  files.forEach(function(file) {
    if (file.size > 1024 * 1024) {
      showToast(file.name + ': 1MB를 초과하여 제외했습니다.', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      _memoAttachments.push({
        id: 'ATT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: file.name, type: file.type || 'application/octet-stream',
        size: file.size, dataUrl: e.target.result
      });
      renderMemoAttachments();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderMemoAttachments() {
  var box = inp('memo-attachment-list');
  if (!box) return;
  box.innerHTML = _memoAttachments.map(function(a) {
    return '<span class="memo-tag"><button type="button" onclick="downloadMemoAttachment(\'' + a.id +
      '\')" style="border:0;background:none;color:inherit;cursor:pointer;padding:0;"><i class="ti ti-paperclip"></i>' +
      _memoEsc(a.name) + '</button> <button type="button" onclick="removeMemoAttachment(\'' + a.id +
      '\')" style="border:0;background:none;color:var(--tx-d);cursor:pointer;">×</button></span>';
  }).join('');
}

function removeMemoAttachment(id) {
  _memoAttachments = _memoAttachments.filter(function(a) { return a.id !== id; });
  delete memoAttachmentData[id];
  saveStorage('memoAttachmentData', memoAttachmentData);
  renderMemoAttachments();
}

function downloadMemoAttachment(id) {
  var pending = _memoAttachments.find(function(a) { return a.id === id; });
  var saved = null;
  memoList.some(function(m) {
    saved = (m.attachments || []).find(function(a) { return a.id === id; });
    return !!saved;
  });
  var dataUrl = memoAttachmentData[id] || (pending && pending.dataUrl);
  if (!dataUrl) { showToast('이 첨부파일은 현재 기기에 저장되어 있지 않습니다.', 'error'); return; }
  var link = document.createElement('a');
  link.href = dataUrl;
  link.download = (pending && pending.name) || (saved && saved.name) || 'attachment';
  link.click();
}

function renderMemoHistory(memo) {
  var wrap = inp('memo-history-wrap');
  var box = inp('memo-history-list');
  if (!wrap || !box) return;
  var history = memo && memo.history ? memo.history : [];
  wrap.style.display = history.length ? '' : 'none';
  box.innerHTML = history.map(function(h) {
    return '<div style="padding:8px 0;border-top:1px solid var(--br);font-size:11px;">' +
      '<b>' + _memoEsc(h.changedBy || '사용자') + '</b> · ' + _memoEsc(String(h.changedAt || '').replace('T', ' ').slice(0, 16)) +
      '<div style="color:var(--tx-t);margin-top:4px;">' + _memoEsc(h.title || '') + ' · ' +
      _memoEsc(String(h.content || '').slice(0, 100)) + '</div></div>';
  }).join('');
}

function addTodoChecklistItem() {
  var text = v('todo-check-new').trim();
  if (!text) return;
  _todoChecklist.push({ id:'CHK-' + Date.now(), text:text, done:false });
  sv('todo-check-new', '');
  renderTodoChecklist();
}

function renderTodoChecklist() {
  var box = inp('todo-checklist');
  if (!box) return;
  box.innerHTML = _todoChecklist.map(function(item) {
    return '<label style="display:flex;align-items:center;gap:7px;font-size:12px;">' +
      '<input type="checkbox" ' + (item.done ? 'checked' : '') + ' onchange="toggleTodoChecklistItem(\'' + item.id + '\',this.checked)">' +
      '<span style="flex:1;' + (item.done ? 'text-decoration:line-through;color:var(--tx-t);' : '') + '">' + _memoEsc(item.text) + '</span>' +
      '<button type="button" class="btn btn-sm btn-icon" onclick="removeTodoChecklistItem(\'' + item.id + '\')"><i class="ti ti-x"></i></button></label>';
  }).join('');
}

function toggleTodoChecklistItem(id, done) {
  var item = _todoChecklist.find(function(x) { return x.id === id; });
  if (item) item.done = done;
  renderTodoChecklist();
}

function removeTodoChecklistItem(id) {
  _todoChecklist = _todoChecklist.filter(function(x) { return x.id !== id; });
  renderTodoChecklist();
}

function createNextRepeatedTodo(todo) {
  if (todo.repeatGeneratedAt === today()) return;
  var base = todo.dueDate ? new Date(todo.dueDate + 'T00:00:00') : new Date();
  if (todo.repeat === 'daily') base.setDate(base.getDate() + 1);
  else if (todo.repeat === 'weekly') base.setDate(base.getDate() + 7);
  else if (todo.repeat === 'monthly') base.setMonth(base.getMonth() + 1);
  var next = Object.assign({}, todo, {
    id: nextCode('TODO', todoList), status:'대기',
    dueDate: base.toISOString().slice(0, 10),
    checklist: (todo.checklist || []).map(function(x) { return { id:'CHK-' + Date.now() + Math.random(), text:x.text, done:false }; }),
    createdAt:_memoNow(), updatedAt:_memoNow(), repeatGeneratedAt:''
  });
  todo.repeatGeneratedAt = today();
  todoList.unshift(next);
}

function scanTodoReminders() {
  if (typeof generateAlert !== 'function') return;
  todoList.filter(function(t) {
    return t.status !== '완료' && t.reminderDate && t.reminderDate <= today();
  }).forEach(function(t) {
    generateAlert(t.dueDate && t.dueDate < today() ? 'err' : 'warn',
      '[할 일 알림] ' + t.title,
      '담당: ' + (t.owner || '미지정') + ' · 마감: ' + (t.dueDate || '미설정'),
      'todo_reminder');
  });
}

function renderWeeklyReportPanel() {
  var content = inp('memo-content');
  var recent = memoList.filter(function(m) {
    return new Date(m.updatedAt || m.createdAt || 0).getTime() >= Date.now() - 7 * 86400000;
  }).length;
  var open = todoList.filter(function(t) { return t.status !== '완료'; }).length;
  content.innerHTML = '<div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-report-analytics"></i>최근 7일 업무 보고</span></div>' +
    '<div style="font-size:12px;color:var(--tx-s);line-height:1.8;">최근 메모 <b>' + recent +
    '건</b>과 미완료 할 일 <b>' + open + '건</b>을 Gemini가 진행 현황, 완료 업무, 지연 위험, 다음 주 계획으로 정리합니다.</div>' +
    '<div style="margin-top:14px;"><button class="btn btn-primary" onclick="generateWeeklyMemoReport(event)"><i class="ti ti-sparkles"></i>주간 보고서 생성</button></div></div>';
}

async function generateWeeklyMemoReport(ev) {
  var recentMemos = memoList.filter(function(m) {
    return new Date(m.updatedAt || m.createdAt || 0).getTime() >= Date.now() - 7 * 86400000;
  }).slice(0, 50);
  var recentTodos = todoList.slice(0, 100);
  if (!recentMemos.length && !recentTodos.length) {
    showToast('보고서로 정리할 메모와 할 일이 없습니다.', 'error'); return;
  }
  var button = ev && ev.currentTarget;
  if (button) { button.disabled = true; button.innerHTML = '<i class="ti ti-loader animate-spin"></i>생성 중'; }
  try {
    var reportData = {
      memos: recentMemos.map(function(m) {
        return { title:m.title, content:m.content, summary:m.summary, tags:m.tags, updatedAt:m.updatedAt };
      }),
      todos: recentTodos.map(function(t) {
        return { title:t.title, content:t.content, owner:t.owner, dueDate:t.dueDate, status:t.status, priority:t.priority };
      })
    };
    var result = await callGeminiForMemo(
      '다음 업무 메모와 할 일로 한국어 주간 업무 보고서를 작성하세요. 반드시 JSON 객체만 반환하세요. ' +
      '형식: {"summary":"전체 요약","completed":["완료"],"inProgress":["진행"],"risks":["지연 및 위험"],"nextWeek":["다음 계획"]}\n' +
      JSON.stringify(reportData).substring(0, 30000)
    );
    var lines = ['[전체 요약]', result.summary || ''];
    [['완료 업무',result.completed],['진행 업무',result.inProgress],['위험 및 지연',result.risks],['다음 주 계획',result.nextWeek]].forEach(function(row) {
      if (row[1] && row[1].length) lines.push('\n[' + row[0] + ']\n- ' + row[1].join('\n- '));
    });
    var reportText = lines.join('\n');
    var periodEnd = today();
    var periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - 6);
    var periodStart = periodStartDate.toISOString().slice(0, 10);
    _weeklyReportDraft = {
      key: periodStart + '_' + periodEnd + '_' + Date.now(),
      title: '[AI 주간보고] ' + periodStart + ' ~ ' + periodEnd,
      content: reportText,
      periodStart: periodStart,
      periodEnd: periodEnd,
      result: result
    };
    inp('memo-report-result').textContent = reportText;
    var saveButton = inp('memo-report-save-btn');
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.innerHTML = '<i class="ti ti-notes"></i>전체 메모에 저장';
    }
    inp('memo-report-modal').classList.add('open');
  } catch (error) {
    showToast(error.message || '주간 보고서 생성에 실패했습니다.', 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-sparkles"></i>주간 보고서 생성'; }
  }
}

function saveWeeklyReportAsMemo() {
  if (!_weeklyReportDraft || !_weeklyReportDraft.content) {
    showToast('먼저 주간 보고서를 생성하세요.', 'error');
    return;
  }
  var existing = memoList.find(function(m) {
    return m.reportKey === _weeklyReportDraft.key;
  });
  if (existing) {
    showToast('이미 전체 메모에 저장된 보고서입니다.', 'info');
    return;
  }
  memoList.unshift({
    id: nextCode('MEM', memoList),
    reportKey: _weeklyReportDraft.key,
    title: _weeklyReportDraft.title,
    content: _weeklyReportDraft.content,
    summary: _weeklyReportDraft.result.summary || '',
    aiResult: _weeklyReportDraft.result,
    tags: ['AI 주간보고', '업무보고'],
    important: true,
    entityType: '',
    entityId: '',
    attachments: [],
    history: [],
    author: _memoAuthor(),
    createdAt: _memoNow(),
    updatedAt: _memoNow()
  });
  saveStorage('memoList', memoList);
  var saveButton = inp('memo-report-save-btn');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="ti ti-circle-check"></i>저장됨';
  }
  closeModal('memo-report-modal');
  memoTab = 'memos';
  sv('memo-search', 'AI 주간보고');
  sv('memo-filter', '');
  renderNotes();
  showToast('AI 주간 보고서를 전체 메모에 저장했습니다.', 'success');
}
