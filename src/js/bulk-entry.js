/* Excel-like batch entry tables for operational records. */
const BULK_ENTRY_TABLES = {};
const BULK_ENTRY_WIDE_FIELDS = { name: '280px', itemName: '280px', materialName: '280px', productName: '280px', productId: '260px' };
const BULK_ENTRY_COMPACT_FIELDS = { qty: '48px', unit: '48px' };

function registerBulkEntryTable(key, config) {
  BULK_ENTRY_TABLES[key] = config;
}

function _bulkFieldClass(name) {
  return 'batch-entry-field-' + String(name || '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function _bulkFieldWidth(field) {
  return BULK_ENTRY_COMPACT_FIELDS[field.name] || BULK_ENTRY_WIDE_FIELDS[field.name] || field.width || '';
}

function _bulkWidthPx(width) {
  const match = String(width || '').trim().match(/^(\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : 0;
}

function syncBulkEntryColumnWidths(key) {
  const config = BULK_ENTRY_TABLES[key];
  const body = config && inp(config.body);
  const table = body && body.closest('table');
  if (!config || !table) return;
  if (config.layout === 'sharedLabels') {
    const grid = table.closest('.batch-entry-grid');
    if (grid) {
      grid.classList.add('batch-entry-shared-grid');
      const label = grid.querySelector(':scope > .batch-entry-label');
      if (label && !label.querySelector('small')) {
        const current = label.innerHTML.trim();
        label.innerHTML = `<span>${current}</span><small>좌측 라벨 고정 · 항목은 우측으로 추가</small>`;
      }
    }
    table.classList.add('batch-entry-shared-label-table');
    table.style.minWidth = '';
    table.querySelector('colgroup[data-bulk-colgroup]')?.remove();
    return;
  }
  table.classList.add('batch-entry-sized-table');
  table.querySelector('colgroup[data-bulk-colgroup]')?.remove();
  const colgroup = document.createElement('colgroup');
  colgroup.dataset.bulkColgroup = key;
  let minWidth = 0;
  config.fields.forEach(field => {
    const col = document.createElement('col');
    const width = _bulkFieldWidth(field);
    if (width) col.style.width = width;
    minWidth += _bulkWidthPx(width) || 120;
    colgroup.appendChild(col);
  });
  const actionCol = document.createElement('col');
  actionCol.style.width = '28px';
  minWidth += 28;
  colgroup.appendChild(actionCol);
  table.style.minWidth = minWidth + 'px';
  table.insertBefore(colgroup, table.firstChild);
}

function _bulkFieldDefault(field) {
  return typeof field.default === 'function' ? field.default() : (field.default ?? '');
}

function _bulkInitialRowCount(config) {
  const raw = Number(config?.initialRows == null ? 1 : config.initialRows);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

function _bulkNormalizedValue(value) {
  return String(value ?? '').trim();
}

function _bulkRowHasUserInput(config, row) {
  if (!config || !row) return false;
  return (config.fields || []).some(field => {
    const value = _bulkNormalizedValue(row[field.name]);
    if (!value) return false;
    const defaultValue = _bulkNormalizedValue(_bulkFieldDefault(field));
    return value !== defaultValue;
  });
}

function _bulkOptions(field) {
  const opts = typeof field.options === 'function' ? field.options() : (field.options || []);
  return opts.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt);
}

function _bulkOptionsHtml(field, selected) {
  const value = String(selected ?? '');
  return _bulkOptions(field).map(opt => {
    const optValue = String(opt.value ?? '');
    const optLabel = String(opt.label ?? optValue);
    return `<option value="${esc(optValue)}"${optValue === value ? ' selected' : ''}>${esc(optLabel)}</option>`;
  }).join('');
}

function bulkProductOptions(clientId) {
  const source = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const list = clientId ? source.filter(p => p.clientId === clientId) : source;
  return [{ value: '', label: '-- 품목 선택 --' }].concat(list.map(p => ({ value: p.id, label: p.name })));
}

function _bulkFieldValueLabel(field, value) {
  const raw = String(value ?? '').trim();
  if (field.type === 'productSearch') {
    const source = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
    const product = source.find(p => p.id === raw);
    return product ? (product.name || product.id) : raw;
  }
  return value ?? '';
}

function _bulkProductSearchListId(field) {
  return field.listId || `bulk-product-list-${field.name || 'product'}`;
}

function _bulkProductSearchClientId(field) {
  return typeof field.clientId === 'function' ? field.clientId() : (field.clientId || '');
}

function syncBulkProductSearchList(field) {
  const listId = _bulkProductSearchListId(field);
  let listEl = document.getElementById(listId);
  if (!listEl) {
    listEl = document.createElement('datalist');
    listEl.id = listId;
    document.body.appendChild(listEl);
  }
  const clientId = _bulkProductSearchClientId(field);
  const source = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const rows = clientId ? source.filter(p => p.clientId === clientId) : source;
  listEl.innerHTML = rows.map(p => {
    const label = [p.id, getClientName(p.clientId), p.spec || ''].filter(Boolean).join(' / ');
    return `<option value="${esc(p.name || p.id)}" label="${esc(label)}"></option>`;
  }).join('');
}

function bulkWorkerOptions() {
  const source = typeof visibleWorkersList === 'function' ? visibleWorkersList() : (typeof visibleRecords === 'function' ? visibleRecords(workers, 'worker') : workers);
  return [{ value: '', label: '— 작업원 선택 —' }].concat(
    source.map(w => ({ value: w.name, label: `${w.name} (라인${w.line}·${w.role})` }))
  );
}

function _bulkInputHtml(field, value, extraAttrs = '') {
  const type = field.type || 'text';
  const attrs = [
    `data-name="${esc(field.name)}"`,
    extraAttrs,
    field.placeholder ? `placeholder="${esc(field.placeholder)}"` : '',
    field.min != null ? `min="${esc(field.min)}"` : '',
    field.step != null ? `step="${esc(field.step)}"` : ''
  ].filter(Boolean).join(' ');
  if (type === 'select') {
    return `<select ${attrs}>${_bulkOptionsHtml(field, value)}</select>`;
  }
  if (type === 'productSearch') {
    syncBulkProductSearchList(field);
    return `<div class="field-search bulk-product-search"><input type="text" value="${esc(_bulkFieldValueLabel(field, value))}" list="${esc(_bulkProductSearchListId(field))}" autocomplete="off" ${attrs}><button type="button" class="field-search-btn" onclick="var el=this.parentElement.querySelector('input'); if(el){ el.focus(); if(el.showPicker) el.showPicker(); }" title="제품 찾기"><i class="ti ti-search"></i></button></div>`;
  }
  return `<input type="${esc(type)}" value="${esc(_bulkFieldValueLabel(field, value))}" ${attrs}>`;
}

function _bulkFieldLabel(field) {
  return field.label || field.title || field.placeholder || field.name || '';
}

function _bulkSharedItemCount(config, body) {
  if (!config || !body) return 0;
  const indexes = Array.from(body.querySelectorAll('[data-item-index]'))
    .map(el => parseInt(el.dataset.itemIndex, 10))
    .filter(n => Number.isFinite(n));
  return indexes.length ? Math.max(...indexes) + 1 : 0;
}

function _bulkSharedHeaderHtml(key, index) {
  const label = `항목 ${index + 1}`;
  return `<th class="batch-entry-shared-item-head" data-bulk-item-index="${index}">
    <div class="batch-entry-shared-item-head-inner">
      <span>${esc(label)}</span>
      <span class="batch-entry-shared-item-actions">
        <button type="button" title="항목 복제" onclick="duplicateBulkEntryColumn('${esc(key)}',${index})"><i class="ti ti-copy"></i></button>
        <button type="button" title="항목 삭제" onclick="removeBulkEntryColumn('${esc(key)}',${index})"><i class="ti ti-trash"></i></button>
      </span>
    </div>
  </th>`;
}

function renderSharedBulkEntryTable(key, rows) {
  const config = BULK_ENTRY_TABLES[key];
  const body = config && inp(config.body);
  const table = body && body.closest('table');
  const head = config && (inp(config.head) || table?.querySelector('thead'));
  if (!config || !body || !head) return;
  const seed = Array.isArray(rows) && rows.length
    ? rows
    : Array.from({ length: _bulkInitialRowCount(config) }, () => ({}));
  syncBulkEntryColumnWidths(key);
  head.innerHTML = `<tr>
    <th class="batch-entry-shared-label-col">항목</th>
    ${seed.map((_, index) => _bulkSharedHeaderHtml(key, index)).join('')}
    <th class="batch-entry-shared-add-col"><button type="button" class="doc-add-row" title="항목 추가" onclick="addBulkEntryRow('${esc(key)}')"><i class="ti ti-plus"></i></button></th>
  </tr>`;
  body.innerHTML = config.fields.map(field => {
    const label = _bulkFieldLabel(field);
    return `<tr data-field="${esc(field.name)}">
      <th class="batch-entry-shared-label-cell">${esc(label)}${field.required ? ' <span>*</span>' : ''}</th>
      ${seed.map((row, index) => {
        const value = row[field.name] ?? _bulkFieldDefault(field);
        const cls = `${esc(_bulkFieldClass(field.name))} batch-entry-shared-value`;
        return `<td class="${cls}" data-item-index="${index}">${_bulkInputHtml(field, value, `data-item-index="${index}"`)}</td>`;
      }).join('')}
      <td class="batch-entry-shared-add-spacer"></td>
    </tr>`;
  }).join('');
}

function duplicateBulkEntryColumn(key, index) {
  const config = BULK_ENTRY_TABLES[key];
  if (!config || config.layout !== 'sharedLabels') return;
  const rows = readBulkEntryTable(key, { keepEmpty: true });
  const copy = Object.assign({}, rows[index] || {});
  rows.splice(index + 1, 0, copy);
  renderSharedBulkEntryTable(key, rows);
}

function removeBulkEntryColumn(key, index) {
  const config = BULK_ENTRY_TABLES[key];
  if (!config || config.layout !== 'sharedLabels') return;
  const rows = readBulkEntryTable(key, { keepEmpty: true });
  if (rows.length <= 1) rows[0] = {};
  else rows.splice(index, 1);
  renderSharedBulkEntryTable(key, rows);
}

function addBulkEntryRow(key, values = {}) {
  const config = BULK_ENTRY_TABLES[key];
  const body = config && inp(config.body);
  if (!body) return;
  if (config.layout === 'sharedLabels') {
    const rows = readBulkEntryTable(key, { keepEmpty: true });
    rows.push(values || {});
    renderSharedBulkEntryTable(key, rows);
    const index = rows.length - 1;
    setTimeout(() => body.querySelector(`[data-item-index="${index}"] input, [data-item-index="${index}"] select`)?.focus(), 0);
    return;
  }
  const tr = document.createElement('tr');
  tr.innerHTML = config.fields.map(field => {
    const value = values[field.name] ?? _bulkFieldDefault(field);
    const width = _bulkFieldWidth(field);
    const style = width ? ` style="width:${esc(width)}"` : '';
    return `<td class="${esc(_bulkFieldClass(field.name))}"${style}>${_bulkInputHtml(field, value)}</td>`;
  }).join('') +
    `<td class="batch-entry-actions"><button type="button" class="doc-add-row" title="행 추가" onclick="addBulkEntryRow('${esc(key)}')"><i class="ti ti-plus"></i></button></td>`;
  body.appendChild(tr);
}

function initBulkEntryTable(key, rows) {
  const config = BULK_ENTRY_TABLES[key];
  const body = config && inp(config.body);
  if (!body) return;
  syncBulkEntryColumnWidths(key);
  if (config.layout === 'sharedLabels') {
    const seed = Array.isArray(rows) && rows.length ? rows : Array.from({ length: _bulkInitialRowCount(config) }, () => ({}));
    renderSharedBulkEntryTable(key, seed);
    return;
  }
  body.innerHTML = '';
  const seed = Array.isArray(rows) && rows.length ? rows : Array.from({ length: _bulkInitialRowCount(config) }, () => ({}));
  seed.forEach(row => addBulkEntryRow(key, row));
}

function readBulkEntryTable(key, options = {}) {
  const config = BULK_ENTRY_TABLES[key];
  const body = config && inp(config.body);
  if (!body) return [];
  if (config.layout === 'sharedLabels') {
    const count = _bulkSharedItemCount(config, body);
    const rows = Array.from({ length: count }, (_, index) => {
      const row = {};
      config.fields.forEach(field => {
        const el = body.querySelector(`[data-name="${field.name}"][data-item-index="${index}"]`);
        row[field.name] = el ? el.value.trim() : '';
      });
      return row;
    });
    if (options.keepEmpty) return rows;
    return rows.filter(row => _bulkRowHasUserInput(config, row));
  }
  const rows = Array.from(body.querySelectorAll('tr')).map(tr => {
    const row = {};
    config.fields.forEach(field => {
      const el = tr.querySelector(`[data-name="${field.name}"]`);
      row[field.name] = el ? el.value.trim() : '';
    });
    return row;
  });
  if (options.keepEmpty) return rows;
  return rows.filter(row => _bulkRowHasUserInput(config, row));
}

function refreshBulkEntryTable(key) {
  initBulkEntryTable(key, readBulkEntryTable(key, { keepEmpty: true }));
}

function setBulkEntryMode(prefix, bulk) {
  const single = inp(`${prefix}-single-fields`);
  const panel = inp(`${prefix}-bulk-panel`);
  const singleBtn = inp(`${prefix}-mode-single`);
  const bulkBtn = inp(`${prefix}-mode-bulk`);
  if (single) single.style.display = bulk ? 'none' : '';
  if (panel) panel.style.display = bulk ? '' : 'none';
  if (singleBtn) singleBtn.classList.toggle('active', !bulk);
  if (bulkBtn) bulkBtn.classList.toggle('active', bulk);
}

function isBulkEntryMode(prefix) {
  const panel = inp(`${prefix}-bulk-panel`);
  return !!panel && panel.style.display !== 'none';
}

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  const body = e.target.closest && e.target.closest('[data-bulk-key]');
  if (!body || !e.target.matches('input, select')) return;
  const key = body.dataset.bulkKey;
  const config = BULK_ENTRY_TABLES[key];
  if (config && config.layout === 'sharedLabels') {
    const row = e.target.closest('tr[data-field]');
    const fieldRows = Array.from(body.querySelectorAll('tr[data-field]'));
    const rowIndex = fieldRows.indexOf(row);
    const itemIndex = parseInt(e.target.dataset.itemIndex || '0', 10) || 0;
    if (rowIndex < 0) return;
    e.preventDefault();
    if (rowIndex < fieldRows.length - 1) {
      fieldRows[rowIndex + 1].querySelector(`input[data-item-index="${itemIndex}"], select[data-item-index="${itemIndex}"]`)?.focus();
      return;
    }
    const count = _bulkSharedItemCount(config, body);
    if (itemIndex >= count - 1) addBulkEntryRow(key);
    setTimeout(() => {
      const nextIndex = itemIndex + 1;
      body.querySelector(`tr[data-field] input[data-item-index="${nextIndex}"], tr[data-field] select[data-item-index="${nextIndex}"]`)?.focus();
    }, 0);
    return;
  }
  const row = e.target.closest('tr');
  if (!row) return;
  const controls = Array.from(row.querySelectorAll('input, select'));
  const idx = controls.indexOf(e.target);
  if (idx < 0) return;
  e.preventDefault();
  if (idx < controls.length - 1) {
    controls[idx + 1].focus();
    return;
  }
  const rows = Array.from(body.querySelectorAll('tr'));
  const next = row.nextElementSibling;
  if (row === rows[rows.length - 1]) addBulkEntryRow(key);
  (next || row.nextElementSibling)?.querySelector('input, select')?.focus();
});

document.addEventListener('paste', function(e) {
  const body = e.target.closest && e.target.closest('[data-bulk-key]');
  if (!body || !e.target.matches('input')) return;
  const text = e.clipboardData?.getData('text');
  if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
  const key = body.dataset.bulkKey;
  const row = e.target.closest('tr');
  const config = BULK_ENTRY_TABLES[key];
  if (!row || !config) return;
  if (config.layout === 'sharedLabels') {
    e.preventDefault();
    const fieldRows = Array.from(body.querySelectorAll('tr[data-field]'));
    const startField = fieldRows.indexOf(row);
    const startItem = parseInt(e.target.dataset.itemIndex || '0', 10) || 0;
    if (startField < 0) return;
    const rows = readBulkEntryTable(key, { keepEmpty: true });
    const pasted = text.replace(/\r/g, '').split('\n').filter(line => line.length).map(line => line.split('\t'));
    pasted.forEach((cells, rIdx) => {
      const field = config.fields[startField + rIdx];
      if (!field) return;
      const expectedLabel = String(_bulkFieldLabel(field) || '').replace(/\s*\*$/, '').trim();
      let values = cells.map(cell => String(cell || '').trim());
      if (values.length > 1 && values[0].replace(/\s*\*$/, '').trim() === expectedLabel) values = values.slice(1);
      values.forEach((cell, cIdx) => {
        const itemIndex = startItem + cIdx;
        while (rows.length <= itemIndex) rows.push({});
        rows[itemIndex][field.name] = cell;
      });
    });
    renderSharedBulkEntryTable(key, rows);
    setTimeout(() => {
      body.querySelector(`[data-name="${config.fields[startField]?.name}"][data-item-index="${startItem}"]`)?.focus();
    }, 0);
    return;
  }
  e.preventDefault();
  const startRows = Array.from(body.querySelectorAll('tr'));
  const startRow = startRows.indexOf(row);
  const startControls = Array.from(row.querySelectorAll('input, select'));
  const startCol = startControls.indexOf(e.target);
  const pasted = text.replace(/\r/g, '').split('\n').filter(line => line.length).map(line => line.split('\t'));
  while (body.querySelectorAll('tr').length < startRow + pasted.length) addBulkEntryRow(key);
  pasted.forEach((cells, rIdx) => {
    const tr = body.querySelectorAll('tr')[startRow + rIdx];
    const controls = Array.from(tr.querySelectorAll('input, select'));
    cells.forEach((cell, cIdx) => {
      const el = controls[startCol + cIdx];
      if (el) el.value = cell.trim();
    });
  });
});
