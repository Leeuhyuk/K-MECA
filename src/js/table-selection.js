/* Common table row selection and action dropdowns. */
const TABLE_ACTION_HEADER_RE = /(관리|동작|처리|작업)/;
const TABLE_INTERACTIVE_SEL = 'button,a,input,select,textarea,label,[contenteditable="true"]';

function tableActionLabel(button, index) {
  const title = (button.getAttribute('title') || button.getAttribute('aria-label') || '').trim();
  const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  if (title) return title;
  if (text) return text;
  const icon = button.querySelector('i');
  const cls = icon ? icon.className : '';
  if (cls.includes('trash') || button.classList.contains('del-btn')) return '삭제';
  if (cls.includes('edit') || button.classList.contains('edit-btn')) return '수정';
  if (cls.includes('restore') || button.classList.contains('restore-btn')) return '복원';
  if (cls.includes('box')) return '자재';
  return '작업 ' + (index + 1);
}

function tableHasDataRows(table) {
  const rows = Array.from(table.tBodies || []).flatMap(tbody => Array.from(tbody.rows));
  return rows.some(row => row.cells.length > 1 && !row.querySelector('.empty'));
}

function findManagedActionIndex(table) {
  const head = table.tHead && table.tHead.rows[0];
  if (!head) return -1;
  const headers = Array.from(head.cells);
  for (let i = headers.length - 1; i >= 0; i--) {
    if (TABLE_ACTION_HEADER_RE.test((headers[i].textContent || '').trim())) return i;
  }
  const firstBody = Array.from(table.tBodies || []).find(tbody => tbody.rows.length);
  const row = firstBody && Array.from(firstBody.rows).find(r => r.cells.length > 1);
  if (!row) return -1;
  for (let i = row.cells.length - 1; i >= 0; i--) {
    if (row.cells[i].querySelector('.edit-btn,.del-btn,.restore-btn,button[onclick]')) return i;
  }
  return -1;
}

function updateManagedTableCheckAll(table) {
  const all = table.querySelector('thead .table-check-all');
  if (!all) return;
  const checks = Array.from(table.querySelectorAll('tbody .table-row-select'));
  const selected = checks.filter(chk => chk.checked);
  all.checked = checks.length > 0 && selected.length === checks.length;
  all.indeterminate = selected.length > 0 && selected.length < checks.length;
}

function syncManagedTableRow(row) {
  const check = rowSelectionCheckbox(row);
  if (check) row.classList.toggle('table-row-selected', check.checked);
  updateManagedTableCheckAll(row.closest('table'));
}

function syncManagedTableRows(table) {
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(syncManagedTableRow);
  updateManagedTableCheckAll(table);
}

function rowSelectionCheckbox(row) {
  if (!row) return null;
  return row.querySelector('.table-row-select') ||
    row.querySelector('input[type="checkbox"][data-bid]') ||
    (row.cells[0] && row.cells[0].querySelector('input[type="checkbox"]'));
}

function tableHasExistingSelectionColumn(table) {
  const head = table.tHead && table.tHead.rows[0];
  const firstHead = head && head.cells[0];
  if (firstHead && firstHead.querySelector('input[type="checkbox"]')) return true;
  const firstBody = Array.from(table.tBodies || []).find(tbody => tbody.rows.length);
  const row = firstBody && Array.from(firstBody.rows).find(r => r.cells.length > 1);
  return !!(row && row.cells[0] && row.cells[0].querySelector('input[type="checkbox"]'));
}

function tableBulkKey(table) {
  try {
    if (typeof BULK_CFG === 'undefined') return '';
    return Object.keys(BULK_CFG).find(key => {
      const cont = document.querySelector(BULK_CFG[key].sel);
      return cont && (cont === table || cont.contains(table));
    }) || '';
  } catch(e) {
    return '';
  }
}

function removeDuplicateManagedSelectionColumn(table) {
  const head = table.tHead && table.tHead.rows[0];
  if (!head) return false;
  const generated = head.querySelector('.table-row-select-th');
  if (!generated) return false;
  const generatedIndex = Array.prototype.indexOf.call(head.cells, generated);
  const hasOtherSelection = Array.from(head.cells).some((cell, index) => {
    return index !== generatedIndex && cell.querySelector('input[type="checkbox"]');
  });
  const bulkManaged = !!tableBulkKey(table);
  if (!hasOtherSelection && !bulkManaged) return false;
  generated.remove();
  Array.from(table.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      const cell = row.cells[generatedIndex];
      if (cell && cell.classList.contains('table-row-select-td')) cell.remove();
    });
  });
  return true;
}

function addManagedSelectionColumn(table) {
  const head = table.tHead && table.tHead.rows[0];
  if (!head) return false;
  if (head.querySelector('.table-check-all') || tableHasExistingSelectionColumn(table) || tableBulkKey(table)) return false;
  const th = document.createElement('th');
  th.className = 'table-row-select-th';
  th.style.cssText = 'width:34px;text-align:center;';
  th.innerHTML = '<input type="checkbox" class="table-check-all" title="현재 표 전체 선택">';
  head.insertBefore(th, head.firstChild);
  Array.from(table.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      if (row.cells.length <= 1 || row.querySelector('.empty')) return;
      const td = document.createElement('td');
      td.className = 'table-row-select-td';
      td.style.cssText = 'width:34px;text-align:center;';
      td.innerHTML = '<input type="checkbox" class="table-row-select" title="행 선택">';
      row.insertBefore(td, row.firstChild);
    });
  });
  return true;
}

function convertActionCellToSelect(cell) {
  if (!cell || cell.querySelector('.table-action-select')) return;
  const actions = Array.from(cell.querySelectorAll('button,a')).filter(el => {
    if (el.closest('.table-action-source')) return false;
    if (el.classList.contains('table-action-select')) return false;
    return el.matches('button,a') && (el.getAttribute('onclick') || el.href || el.className);
  });
  if (actions.length <= 1) return;
  const source = document.createElement('div');
  source.className = 'table-action-source';
  source.hidden = true;
  actions.forEach(action => source.appendChild(action));

  const select = document.createElement('select');
  select.className = 'table-action-select';
  select.setAttribute('aria-label', '관리 작업 선택');
  select.innerHTML = '<option value="">관리 선택</option>' +
    actions.map((action, index) => '<option value="' + index + '">' + tableActionLabel(action, index) + '</option>').join('');
  select.addEventListener('change', function() {
    const index = Number(this.value);
    const target = actions[index];
    this.value = '';
    if (target) target.click();
  });

  cell.classList.add('table-action-cell');
  cell.textContent = '';
  cell.appendChild(select);
  cell.appendChild(source);
}

function bindManagedTableRows(table) {
  if (table.dataset.rowSelectBound === '1') return;
  table.dataset.rowSelectBound = '1';
  table.addEventListener('change', event => {
    const target = event.target;
    if (target.classList && target.classList.contains('table-check-all')) {
      table.querySelectorAll('tbody .table-row-select').forEach(chk => {
        chk.checked = target.checked;
        syncManagedTableRow(chk.closest('tr'));
      });
    } else if (target.matches && target.matches('tbody input[type="checkbox"]')) {
      syncManagedTableRow(target.closest('tr'));
    }
    setTimeout(() => syncManagedTableRows(table), 0);
  });
  table.addEventListener('click', event => {
    const row = event.target.closest('tbody tr');
    if (!row || !table.contains(row)) return;
    if (event.target.closest(TABLE_INTERACTIVE_SEL)) return;
    const check = rowSelectionCheckbox(row);
    if (!check) return;
    check.click();
    setTimeout(() => syncManagedTableRows(table), 0);
  });
}

function enhanceManagedTable(table) {
  if (!table) return;
  if (table.closest('.overlay')) return;
  if (table.dataset.managedTable === 'false' || table.hasAttribute('data-no-managed-table')) return;
  if (!table.tHead || !table.tBodies.length || !tableHasDataRows(table)) return;
  if (table.dataset.managedEnhanced === '1') {
    removeDuplicateManagedSelectionColumn(table);
    bindManagedTableRows(table);
    syncManagedTableRows(table);
    return;
  }
  const actionIndex = findManagedActionIndex(table);
  if (actionIndex < 0) return;
  table.dataset.managedEnhanced = '1';
  removeDuplicateManagedSelectionColumn(table);
  if (tableBulkKey(table)) {
    bindManagedTableRows(table);
    syncManagedTableRows(table);
    return;
  }
  const inserted = addManagedSelectionColumn(table);
  const adjustedActionIndex = actionIndex + (inserted ? 1 : 0);
  Array.from(table.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      const cell = row.cells[adjustedActionIndex];
      convertActionCellToSelect(cell);
      syncManagedTableRow(row);
    });
  });
  bindManagedTableRows(table);
  syncManagedTableRows(table);
}

function enhanceManagedTables(root) {
  (root || document).querySelectorAll('table').forEach(enhanceManagedTable);
  if (typeof applyTableDisplaySettings === 'function') applyTableDisplaySettings();
}

function initManagedTableEnhancer() {
  enhanceManagedTables(document);
  const main = document.querySelector('.main') || document.body;
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.addedNodes.length)) {
      requestAnimationFrame(() => enhanceManagedTables(main));
    }
  });
  observer.observe(main, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initManagedTableEnhancer);
} else {
  initManagedTableEnhancer();
}
