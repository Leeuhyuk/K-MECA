/* ════════ 자재 테이블 인라인 편집 / 붙여넣기 ════════
   열 순서 변경(table-reorder)과 공존하기 위해, 편집 대상 판정은 셀 위치가 아니라
   현재 DOM 헤더의 data-field/data-type을 기준으로 한다. */
(function () {
  'use strict';

  // 현재 DOM 상의 col(셀 인덱스)에 해당하는 헤더 메타 정보 조회
  function getColMeta(col) {
    const ths = document.querySelectorAll('#mat-table thead th');
    const th = ths[col];
    if (!th) return { field: null, type: 'text', editable: false };
    const field = th.dataset.field || null;
    return { field: field, type: th.dataset.type || 'text', editable: !!field };
  }
  function colCount() {
    return document.querySelectorAll('#mat-table thead th').length;
  }

  let selMid = null;
  let selCol = -1;
  let editMid = null;
  let editCol = -1;
  let editOrig = '';
  let docBound = false;

  /* ──────────── 초기화 (renderMaterials 끝에서 setTimeout 0으로 호출) ──────────── */
  function initMatInlineEdit() {
    const cont = document.getElementById('mat-table');
    if (!cont) return;

    // 컨테이너 이벤트 위임 — innerHTML 교체 후에도 cont 요소는 유지되므로 한 번만 붙임
    if (!cont.dataset.ileInit) {
      cont.dataset.ileInit = '1';
      cont.addEventListener('click', onContainerClick);
      cont.addEventListener('dblclick', onContainerDblClick);
    }

    // 도큐먼트 이벤트 한 번만
    if (!docBound) {
      docBound = true;
      document.addEventListener('keydown', onDocKey, true); // capture:true
      document.addEventListener('paste', onDocPaste);
    }
  }

  /* ──────────── 셀/행 헬퍼 ──────────── */
  function getTbody() {
    return document.querySelector('#mat-table tbody');
  }

  function getRowIdxByMid(mid) {
    const tbody = getTbody();
    if (!tbody) return -1;
    // cells[1] = 자재코드 (cells[0]은 체크박스)
    return Array.prototype.findIndex.call(tbody.rows, tr => tr.cells[1] && tr.cells[1].textContent.trim() === mid);
  }

  function getTd(mid, col) {
    const ri = getRowIdxByMid(mid);
    if (ri < 0) return null;
    const tbody = getTbody();
    const tr = tbody.rows[ri];
    return tr && tr.cells[col] ? tr.cells[col] : null;
  }

  function getMidFromTr(tr) {
    return tr && tr.cells[1] ? tr.cells[1].textContent.trim() : null;
  }

  function tdFromEvent(e) {
    const td = e.target.closest('td');
    if (!td) return null;
    if (!td.closest('#mat-table tbody')) return null;
    return td;
  }

  /* ──────────── 선택 하이라이트 ──────────── */
  function setSelected(mid, col) {
    clearHighlight();
    selMid = mid;
    selCol = col;
    const td = getTd(mid, col);
    if (td) td.classList.add('cell-sel');
  }

  function clearHighlight() {
    const cont = document.getElementById('mat-table');
    if (cont) cont.querySelectorAll('.cell-sel').forEach(el => el.classList.remove('cell-sel'));
  }

  /* ──────────── 단일 클릭 → 선택 ──────────── */
  function onContainerClick(e) {
    if (e.target.closest('select, button, input, textarea')) return;
    const td = tdFromEvent(e);
    if (!td) return;
    const mid = getMidFromTr(td.closest('tr'));
    const col = td.cellIndex;
    if (editMid && (editMid !== mid || editCol !== col)) commitEdit();
    if (!editMid) setSelected(mid, col);
  }

  /* ──────────── 더블클릭 → 편집 시작 ──────────── */
  function onContainerDblClick(e) {
    if (e.target.closest('select, button')) return;
    const td = tdFromEvent(e);
    if (!td) return;
    const mid = getMidFromTr(td.closest('tr'));
    const col = td.cellIndex;
    startEdit(mid, col, td);
  }

  /* ──────────── 편집 시작 ──────────── */
  function startEdit(mid, col, td) {
    const meta = getColMeta(col);
    if (!meta.editable) return;
    if (editMid) commitEdit();

    const m = materials.find(x => x.id === mid);
    if (!m) return;

    editMid = mid;
    editCol = col;
    editOrig = td.textContent.trim();

    const rawVal = getRawVal(m, col);
    td.classList.add('cell-edit');

    const isNote = (meta.type === 'textarea');
    const el = document.createElement(isNote ? 'textarea' : 'input');
    if (!isNote) {
      el.type = meta.type === 'date' ? 'date' : meta.type === 'number' ? 'number' : 'text';
      if (el.type === 'number') el.min = '0';
    } else {
      el.rows = 2;
    }
    el.value = rawVal;
    el.className = 'cell-inp';

    td.innerHTML = '';
    td.appendChild(el);
    el.focus();
    try { el.select(); } catch(err) {}

    el.addEventListener('blur', () => {
      setTimeout(() => { if (editMid === mid && editCol === col) commitEdit(); }, 80);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); }
      else if (e.key === 'Enter' && !isNote) { e.preventDefault(); commitEdit(); moveFocus(mid, col, 1); }
      else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); moveFocus(mid, col, e.shiftKey ? -1 : 1); }
    });
  }

  function getRawVal(m, col) {
    const meta = getColMeta(col);
    if (!meta.field) return '';
    const val = m[meta.field];
    if (meta.type === 'number') return String(val || 0);
    return val || '';
  }

  function commitEdit() {
    if (!editMid) return;
    const td = getTd(editMid, editCol);
    const el = td && td.querySelector('input, textarea');
    const val = el ? el.value.trim() : '';
    const mid = editMid, col = editCol;
    editMid = null; editCol = -1; editOrig = '';

    const m = materials.find(x => x.id === mid);
    if (m) {
      applyVal(m, col, val);
      saveStorage('materials', materials);
      renderMaterials();
      // renderMaterials → setTimeout(initMatInlineEdit,0) → enhanceBulk 순이므로 50ms 후 선택 복원
      setTimeout(() => setSelected(mid, col), 50);
    }
  }

  function cancelEdit() {
    if (!editMid) return;
    const td = getTd(editMid, editCol);
    if (td) {
      td.classList.remove('cell-edit');
      td.textContent = editOrig;
    }
    editMid = null; editCol = -1; editOrig = '';
  }

  function applyVal(m, col, val) {
    const meta = getColMeta(col);
    if (!meta.field) return;
    if (meta.type === 'number') m[meta.field] = parseInt(val) || 0;
    else m[meta.field] = val;
  }

  /* ──────────── Tab 이동 (다음 편집 가능 열로) ──────────── */
  function moveFocus(mid, col, dcol) {
    const N = colCount();
    let c = col + dcol;
    while (c >= 0 && c < N) {
      if (getColMeta(c).editable) break;
      c += dcol;
    }
    if (c < 0 || c >= N) return;
    setSelected(mid, c);
    setTimeout(() => {
      const td = getTd(mid, c);
      if (td) startEdit(mid, c, td);
    }, 50);
  }

  /* ──────────── 키보드 네비게이션 ──────────── */
  function onDocKey(e) {
    if (editMid) {
      if (e.key !== 'Escape' && e.key !== 'Tab' && e.key !== 'Enter') return;
      return; // input 자체 keydown 리스너가 처리
    }
    if (!selMid) return;

    // mat-table이 속한 페이지가 숨겨져 있으면 키 이벤트를 가로채지 않음
    const matTable = document.getElementById('mat-table');
    if (!matTable) return;
    const pg = matTable.closest('[id^="pg-"]');
    if (pg && (pg.style.display === 'none' || pg.hidden)) return;

    const tbody = getTbody();
    if (!tbody) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const ri = getRowIdxByMid(selMid);
      const nr = e.key === 'ArrowDown' ? Math.min(ri + 1, tbody.rows.length - 1) : Math.max(ri - 1, 0);
      const newMid = getMidFromTr(tbody.rows[nr]);
      if (newMid) setSelected(newMid, selCol);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelected(selMid, Math.min(selCol + 1, colCount() - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelected(selMid, Math.max(selCol - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      const td = getTd(selMid, selCol);
      if (td) startEdit(selMid, selCol, td);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && getColMeta(selCol).editable) {
      const m = materials.find(x => x.id === selMid);
      if (m) {
        applyVal(m, selCol, '');
        saveStorage('materials', materials);
        const savedMid = selMid, savedCol = selCol;
        renderMaterials();
        setTimeout(() => setSelected(savedMid, savedCol), 50);
      }
    }
  }

  /* ──────────── 붙여넣기 (Ctrl+V) ──────────── */
  function onDocPaste(e) {
    if (editMid) return; // 인풋 내 붙여넣기는 브라우저가 처리
    if (!selMid) return;
    if (!document.getElementById('mat-table')) return;

    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    e.preventDefault();

    const tbody = getTbody();
    if (!tbody) return;

    const pasteRows = text.split(/\r?\n/).filter(r => r !== '');
    const startRi = getRowIdxByMid(selMid);
    let changed = false;

    pasteRows.forEach((rowStr, ri) => {
      const trIdx = startRi + ri;
      if (trIdx >= tbody.rows.length) return;
      const mid = getMidFromTr(tbody.rows[trIdx]);
      const m = materials.find(x => x.id === mid);
      if (!m) return;

      const cells = rowStr.split('\t');
      const N = colCount();
      let ci = 0;
      // col과 ci를 함께 전진 — 비편집 열의 클립보드 값도 위치 맞춤을 위해 소비
      for (let col = selCol; col < N && ci < cells.length; col++, ci++) {
        if (getColMeta(col).editable) {
          applyVal(m, col, cells[ci].trim());
          changed = true;
        }
      }
    });

    if (changed) {
      saveStorage('materials', materials);
      const savedMid = selMid, savedCol = selCol;
      renderMaterials();
      setTimeout(() => setSelected(savedMid, savedCol), 50);
    }
  }

  window.initMatInlineEdit = initMatInlineEdit;
})();
