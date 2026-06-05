/* ════════ 범용 테이블 열(컬럼) 순서 변경 — 헤더 드래그 + localStorage 저장 ════════
   각 render 함수를 수정하지 않고, 테이블 컨테이너를 MutationObserver로 감시해
   (1) 저장된 열 순서를 매 렌더마다 재적용하고 (2) 헤더에 드래그 핸들러를 부착한다.
   체크박스/빈 헤더 열은 드래그 대상에서 제외한다. 헤더 클릭 정렬과 공존(드래그 시 click 미발생). */
(function () {
  'use strict';

  // 적용 대상 테이블 컨테이너 id
  // (mat-table은 인라인 편집이 고정 열 인덱스에 의존하므로 제외)
  const TARGETS = [
    'inventory-table', 'inv-ledger-table', 'orders-table',
    'bp-table', 'rfq-table', 'po-table', 'workers-table', 'as-body',
    'defect-table', 'claim-table', 'check-table', 'dlv-table',
    'proc-detail-table', 'qt-table', 'st-table', 'tx-table', 'so-table', 'trash-table'
  ];

  let dragSrc = null; // { table, index }

  function lsKey(id) { return 'colorder-' + id; }
  function loadOrder(id) {
    try { return JSON.parse(localStorage.getItem(lsKey(id)) || 'null'); } catch (e) { return null; }
  }
  function saveOrder(id, arr) {
    try { localStorage.setItem(lsKey(id), JSON.stringify(arr)); } catch (e) {}
  }

  /* ── 컨테이너 1개 처리: 원본 인덱스 부여 → 저장 순서 적용 → 핸들러 부착 ── */
  function processTable(container) {
    const table = container.querySelector('table');
    if (!table) return;
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const N = headRow.children.length;
    if (N < 2) return;
    // 동일 열 구성을 이미 처리했으면 skip (체크박스 추가 등으로 N이 바뀌면 재처리)
    if (table.dataset.roCols === String(N)) return;

    // 각 헤더 셀에 원본 인덱스 부여
    Array.prototype.forEach.call(headRow.children, function (th, i) { th.dataset.oidx = i; });

    // 저장된 순서 적용 (열 수가 일치할 때만)
    const order = loadOrder(container.id);
    if (order && order.length === N && isValidOrder(order, N)) {
      applyOrderToTable(table, order, N);
    }

    // 드래그 핸들러 부착
    attachDragHandlers(container, table);

    table.dataset.roCols = String(N);
  }

  function isValidOrder(order, N) {
    if (order.length !== N) return false;
    const seen = new Array(N).fill(false);
    for (let i = 0; i < order.length; i++) {
      const o = order[i];
      if (o < 0 || o >= N || seen[o]) return false;
      seen[o] = true;
    }
    return true;
  }

  function rowsOf(table) {
    const rows = [];
    const ht = table.querySelector('thead tr'); if (ht) rows.push(ht);
    const cg = table.querySelector('colgroup'); if (cg) rows.push(cg);
    table.querySelectorAll('tbody tr').forEach(function (tr) { rows.push(tr); });
    return rows;
  }

  /* 저장 순서대로 모든 행의 셀을 재배치 (적용 전 셀은 원본 순서) */
  function applyOrderToTable(table, order, N) {
    rowsOf(table).forEach(function (row) {
      if (row.children.length !== N) return;
      const cells = Array.prototype.slice.call(row.children);
      order.forEach(function (oi) { row.appendChild(cells[oi]); });
    });
  }

  /* from 위치 셀을 to 위치로 이동 (모든 행 동기) */
  function moveColumn(table, from, to) {
    rowsOf(table).forEach(function (row) {
      const cells = Array.prototype.slice.call(row.children);
      if (from >= cells.length || to >= cells.length) return;
      const moving = cells[from];
      if (from < to) row.insertBefore(moving, cells[to].nextSibling);
      else row.insertBefore(moving, cells[to]);
    });
  }

  function persistOrder(container, table) {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const order = Array.prototype.map.call(headRow.children, function (th) {
      return parseInt(th.dataset.oidx, 10);
    });
    saveOrder(container.id, order);
  }

  /* ── 드래그 핸들러 ── */
  function attachDragHandlers(container, table) {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    Array.prototype.forEach.call(headRow.children, function (th) {
      if (th.dataset.roDrag) return;
      // 체크박스 열·빈 헤더는 제외 (텍스트 라벨이 있는 열만 이동 대상)
      if (th.querySelector('input')) return;
      if (!th.textContent.trim()) return;
      th.dataset.roDrag = '1';
      th.setAttribute('draggable', 'true');
      th.style.cursor = th.style.cursor || 'grab';
      th.addEventListener('dragstart', onDragStart);
      th.addEventListener('dragover', onDragOver);
      th.addEventListener('dragleave', onDragLeave);
      th.addEventListener('drop', onDrop);
      th.addEventListener('dragend', onDragEnd);
    });
    container.setAttribute('data-reorderable', '1');
  }

  function onDragStart(e) {
    const th = e.currentTarget;
    const row = th.parentElement;
    dragSrc = { table: th.closest('table'), index: Array.prototype.indexOf.call(row.children, th) };
    th.classList.add('col-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'col'); } catch (_) {}
    }
  }
  function onDragOver(e) {
    if (!dragSrc) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('col-drop-target');
  }
  function onDragLeave(e) {
    e.currentTarget.classList.remove('col-drop-target');
  }
  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget;
    th.classList.remove('col-drop-target');
    if (!dragSrc) return;
    const table = th.closest('table');
    if (table !== dragSrc.table) return;
    const row = th.parentElement;
    const target = Array.prototype.indexOf.call(row.children, th);
    if (target === dragSrc.index || target < 0) return;
    moveColumn(table, dragSrc.index, target);
    const container = table.closest('[data-reorderable]');
    if (container) persistOrder(container, table);
  }
  function onDragEnd(e) {
    e.currentTarget.classList.remove('col-dragging');
    document.querySelectorAll('.col-drop-target').forEach(function (el) {
      el.classList.remove('col-drop-target');
    });
    dragSrc = null;
  }

  /* ── 초기화 & 감시 ── */
  function initTableReorder() {
    TARGETS.forEach(function (id) {
      const cont = document.getElementById(id);
      if (!cont || cont._roObs) return;
      const obs = new MutationObserver(function () {
        obs.disconnect();
        try { processTable(cont); } catch (e) {}
        obs.observe(cont, { childList: true, subtree: true });
      });
      cont._roObs = obs;
      obs.observe(cont, { childList: true, subtree: true });
      try { processTable(cont); } catch (e) {}
    });
  }

  // 저장된 모든 열 순서 초기화 (디버그/복구용)
  function resetAllColumnOrder() {
    TARGETS.forEach(function (id) {
      try { localStorage.removeItem(lsKey(id)); } catch (e) {}
    });
    showToast && showToast('열 순서가 초기화됐습니다. 새로고침하세요.');
  }

  window.initTableReorder = initTableReorder;
  window.resetAllColumnOrder = resetAllColumnOrder;

  // 부팅 후 실행 + 새 컨테이너(동적 페이지) 대비 주기적 재시도
  if (document.readyState !== 'loading') setTimeout(initTableReorder, 400);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(initTableReorder, 400); });
  setInterval(initTableReorder, 4000);
})();
