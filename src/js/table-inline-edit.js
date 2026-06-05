/* ════════ 자재 테이블 인라인 편집 / 붙여넣기 / 열 폭 조절 ════════ */
(function () {
  'use strict';

  // 열 설정 (0-based, materials 테이블 기준 — 0번은 체크박스)
  const COLS = [
    { field: null,           type: 'text',   editable: false }, // 0  체크박스
    { field: null,           type: 'text',   editable: false }, // 1  자재코드
    { field: null,           type: 'text',   editable: false }, // 2  구분고객사
    { field: null,           type: 'text',   editable: false }, // 3  매칭제품
    { field: 'name',         type: 'text',   editable: true  }, // 4  자재품명
    { field: 'supplier',     type: 'text',   editable: true  }, // 5  협력공급처
    { field: 'unitPrice',    type: 'number', editable: true  }, // 6  구매단가
    { field: 'qty',          type: 'number', editable: true  }, // 7  수량
    { field: null,           type: 'text',   editable: false }, // 8  매입총액
    { field: 'orderDate',    type: 'date',   editable: true  }, // 9  주문일자
    { field: 'expectedDate', type: 'date',   editable: true  }, // 10 입고예정일
    { field: null,           type: 'select', editable: false }, // 11 진행상황
    { field: 'note',         type: 'text',   editable: true  }, // 12 참고사항
    { field: null,           type: 'text',   editable: false }, // 13 관리작업
  ];

  const LS_WIDTHS = 'mat-col-widths-v1';

  let selMid = null;
  let selCol = -1;
  let editMid = null;
  let editCol = -1;
  let editOrig = '';
  let rsIdx = -1, rsStartX = 0, rsStartW = 0, rsCg = null;
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

    // 매 렌더마다 새 table 에 colgroup + resize 핸들 부착
    attachColgroup();
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
    if (e.target.closest('select, button, input, textarea, .col-rz')) return;
    const td = tdFromEvent(e);
    if (!td) return;
    const mid = getMidFromTr(td.closest('tr'));
    const col = td.cellIndex;
    if (editMid && (editMid !== mid || editCol !== col)) commitEdit();
    if (!editMid) setSelected(mid, col);
  }

  /* ──────────── 더블클릭 → 편집 시작 ──────────── */
  function onContainerDblClick(e) {
    if (e.target.closest('select, button, .col-rz')) return;
    const td = tdFromEvent(e);
    if (!td) return;
    const mid = getMidFromTr(td.closest('tr'));
    const col = td.cellIndex;
    startEdit(mid, col, td);
  }

  /* ──────────── 편집 시작 ──────────── */
  function startEdit(mid, col, td) {
    const cfg = COLS[col];
    if (!cfg || !cfg.editable) return;
    if (editMid) commitEdit();

    const m = materials.find(x => x.id === mid);
    if (!m) return;

    editMid = mid;
    editCol = col;
    editOrig = td.textContent.trim();

    const rawVal = getRawVal(m, col);
    td.classList.add('cell-edit');

    const isNote = (col === 12);
    const el = document.createElement(isNote ? 'textarea' : 'input');
    if (!isNote) {
      el.type = cfg.type === 'date' ? 'date' : cfg.type === 'number' ? 'number' : 'text';
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
    switch (col) {
      case 4: return m.name || '';
      case 5: return m.supplier || '';
      case 6: return String(m.unitPrice || 0);
      case 7: return String(m.qty || 0);
      case 9: return m.orderDate || '';
      case 10: return m.expectedDate || '';
      case 12: return m.note || '';
      default: return '';
    }
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
    switch (col) {
      case 4: m.name = val; break;
      case 5: m.supplier = val; break;
      case 6: m.unitPrice = parseInt(val) || 0; break;
      case 7: m.qty = parseInt(val) || 0; break;
      case 9: m.orderDate = val; break;
      case 10: m.expectedDate = val; break;
      case 12: m.note = val; break;
    }
  }

  /* ──────────── Tab 이동 ──────────── */
  function moveFocus(mid, col, dcol) {
    let c = col + dcol;
    while (c >= 0 && c < COLS.length) {
      if (COLS[c] && COLS[c].editable) break;
      c += dcol;
    }
    if (c < 0 || c >= COLS.length) return;
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
      setSelected(selMid, Math.min(selCol + 1, COLS.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelected(selMid, Math.max(selCol - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      const td = getTd(selMid, selCol);
      if (td) startEdit(selMid, selCol, td);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && COLS[selCol] && COLS[selCol].editable) {
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
      let ci = 0;
      // col과 ci를 함께 전진 — 비편집 열의 클립보드 값도 위치 맞춤을 위해 소비
      for (let col = selCol; col < COLS.length && ci < cells.length; col++, ci++) {
        if (COLS[col] && COLS[col].editable) {
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

  /* ──────────── 열 폭 조절 ──────────── */
  function loadWidths() {
    try { return JSON.parse(localStorage.getItem(LS_WIDTHS) || '{}'); } catch(err) { return {}; }
  }
  function saveWidths(w) { localStorage.setItem(LS_WIDTHS, JSON.stringify(w)); }

  function attachColgroup() {
    const table = document.querySelector('#mat-table table');
    if (!table) return;

    const widths = loadWidths();
    // enhanceBulk 이후 실제 th 수 기준으로 colgroup 생성
    const thList = table.querySelectorAll('thead th');
    const colCount = thList.length;

    let cg = table.querySelector('colgroup');
    if (!cg) {
      cg = document.createElement('colgroup');
      for (let i = 0; i < colCount; i++) {
        const col = document.createElement('col');
        if (widths[i]) col.style.width = widths[i] + 'px';
        cg.appendChild(col);
      }
      table.insertBefore(cg, table.firstChild);
    }

    // 헤더 각 <th>에 리사이즈 핸들 추가
    thList.forEach((th, i) => {
      if (th.querySelector('.col-rz')) return;
      th.style.position = 'relative';
      const rz = document.createElement('div');
      rz.className = 'col-rz';
      rz.addEventListener('mousedown', e => startResize(e, i, cg));
      th.appendChild(rz);
    });
  }

  function startResize(e, colIdx, cg) {
    e.preventDefault(); e.stopPropagation();
    rsIdx = colIdx; rsCg = cg;
    rsStartX = e.clientX;
    rsStartW = cg.children[colIdx] ? (cg.children[colIdx].offsetWidth || 100) : 100;
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', endResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function doResize(e) {
    if (rsIdx < 0 || !rsCg) return;
    const w = Math.max(40, rsStartW + (e.clientX - rsStartX));
    if (rsCg.children[rsIdx]) rsCg.children[rsIdx].style.width = w + 'px';
  }

  function endResize() {
    if (rsIdx < 0) return;
    const widths = loadWidths();
    Array.from(rsCg.children).forEach((col, i) => {
      const w = parseInt(col.style.width);
      if (w) widths[i] = w;
    });
    saveWidths(widths);
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', endResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    rsIdx = -1; rsCg = null;
  }

  window.initMatInlineEdit = initMatInlineEdit;
})();
