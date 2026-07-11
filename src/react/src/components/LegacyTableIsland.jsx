import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useDomainSelection } from '../hooks/useDomainSelection.js';

const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,label,[contenteditable="true"],[onclick]';

function rowCheckbox(row) {
  return row?.querySelector('input[type="checkbox"][data-bid], input.po-check');
}

function checkboxId(checkbox) {
  return String(checkbox?.dataset?.bid || checkbox?.value || '').trim();
}

export function LegacyTableIsland({ domainKey, entityType, sourceSelector, store }) {
  const rootRef = useRef(null);
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const { selectedIds, toggleRow, toggleAll } = useDomainSelection({
    domainKey,
    entityType,
    store
  });
  const source = typeof document === 'undefined' ? null : document.querySelector(sourceSelector);
  const html = source?.innerHTML || '';

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ids = [];
    root.querySelectorAll('table').forEach((table) => table.setAttribute('data-no-managed-table', 'true'));
    root.querySelectorAll('thead input[type="checkbox"]').forEach((checkbox) => {
      const cell = checkbox.closest('th');
      if (!cell) return;
      cell.classList.add('table-row-select-th');
      Object.assign(cell.style, { width:'24px', minWidth:'24px', maxWidth:'24px', paddingLeft:'3px', paddingRight:'3px' });
    });
    root.querySelectorAll('tbody tr').forEach((row) => {
      const checkbox = rowCheckbox(row);
      const id = checkboxId(checkbox);
      if (!id) return;
      ids.push(id);
      row.dataset.entityId = id;
      const selected = selectedIds.has(id);
      const cell = checkbox.closest('td');
      if (cell) {
        cell.classList.add('table-row-select-td');
        Object.assign(cell.style, { width:'24px', minWidth:'24px', maxWidth:'24px', paddingLeft:'3px', paddingRight:'3px' });
      }
      checkbox.checked = selected;
      row.classList.toggle('table-row-selected', selected);
    });
    root.querySelectorAll('thead input[type="checkbox"]').forEach((checkbox) => {
      const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
      checkbox.checked = ids.length > 0 && selectedCount === ids.length;
      checkbox.indeterminate = selectedCount > 0 && selectedCount < ids.length;
      checkbox.setAttribute('aria-label', '현재 표시 항목 전체 선택');
    });
  }, [html, selectedIds, version]);

  const syncSourceControl = (event) => {
    const target = event.target;
    if (!target?.id || typeof document === 'undefined') return;
    const sourceRoot = document.querySelector(sourceSelector);
    const sourceControl = sourceRoot?.querySelector('#' + CSS.escape(target.id));
    if (!sourceControl || sourceControl === target) return;
    if ('value' in target && 'value' in sourceControl) sourceControl.value = target.value;
    if ('checked' in target && 'checked' in sourceControl) sourceControl.checked = target.checked;
  };

  const visibleIds = () => Array.from(rootRef.current?.querySelectorAll('tbody tr') || [])
    .map((row) => checkboxId(rowCheckbox(row)))
    .filter(Boolean);

  const handleClickCapture = (event) => {
    const checkbox = event.target.closest?.('input[type="checkbox"]');
    if (checkbox && rootRef.current?.contains(checkbox)) {
      const row = checkbox.closest('tbody tr');
      event.preventDefault();
      event.stopPropagation();
      if (row) {
        const id = checkboxId(checkbox);
        if (id) toggleRow(id);
        return;
      }
      if (checkbox.closest('thead')) toggleAll(visibleIds());
      return;
    }
    const row = event.target.closest?.('tbody tr[data-entity-id]');
    const interactive = event.target.closest?.(INTERACTIVE_SELECTOR);
    if (!row || !rootRef.current?.contains(row)) {
      if (interactive && !interactive.matches('input,select,textarea,label')) setTimeout(() => store.emit(), 0);
      return;
    }
    if (interactive && interactive !== row) {
      if (!interactive.matches('input,select,textarea,label')) setTimeout(() => store.emit(), 0);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    toggleRow(row.dataset.entityId);
  };

  return (
    <div
      ref={rootRef}
      className="react-legacy-table-island"
      data-react-domain={domainKey}
      onInputCapture={syncSourceControl}
      onChangeCapture={syncSourceControl}
      onClickCapture={handleClickCapture}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}