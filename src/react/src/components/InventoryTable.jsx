import { Fragment, useSyncExternalStore } from 'react';
import { inventoryStore } from '../bridge/store.js';
import { getInventory, getInvCategory, getSortState, displayLabel, g } from '../bridge/globals.js';
import { useColumnReorder } from '../bridge/columnOrder.js';
import { SortableTh } from './SortableTh.jsx';
import { SelectAllCheckbox, isInteractiveTableTarget } from './TableSelection.jsx';
import { EmptyState } from './ui/EmptyState.jsx';
import { IconButton } from './ui/IconButton.jsx';
import { QuantityStepper } from './ui/QuantityStepper.jsx';

const TYPE_BORDER = { 자재: 'bd-info', 완제품: 'bd-ok', 반제품: 'bd-warn', 소모품: 'bd-neu', 비품: 'bd-neu' };
const COLS = [
  { key: 'id', label: '재고코드' },
  { key: 'name', label: '품목명' },
  { key: 'type', label: '분류' },
  { key: 'qty', label: '현재고' },
  { key: 'minQty', label: '안전재고' },
  { key: 'location', label: '보관위치' },
  { key: 'note', label: '참고' }
];

function useInventorySnapshot() {
  useSyncExternalStore(inventoryStore.subscribe, inventoryStore.getVersion, inventoryStore.getVersion);
}

function filterRows() {
  const cat = getInvCategory();
  let rows = getInventory().filter((i) => g('canViewRecord', i, 'inventory') !== false && (i.category || '생산부품') === cat);
  const ft = g('v', 'inv-filter-type') || '';
  const st = g('v', 'inv-filter-status') || '';
  const q = (g('v', 'inv-q') || '').toLowerCase();
  const workFilter = globalThis.__modernInventoryWorkFilter || '';
  rows = rows.filter((i) => {
    if (ft && i.type !== ft) return false;
    if (st === 'low' && !(i.qty < (i.minQty || 0))) return false;
    if (st === 'normal' && (i.qty < (i.minQty || 0))) return false;
    if (workFilter === 'emptyStock' && Number(i.qty) !== 0) return false;
    if (q && !String(i.id).toLowerCase().includes(q) && !String(i.name || '').toLowerCase().includes(q) && !String(i.location || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const s = getSortState();
  if (s.key) {
    const asc = s.asc ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const va = a[s.key] == null ? '' : a[s.key];
      const vb = b[s.key] == null ? '' : b[s.key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }
  return rows;
}

export function InventoryTable({ selectable = false, selectedIds = null, onToggleRow = null, onToggleAll = null }) {
  useInventorySnapshot();
  // 훅은 조기 반환(EmptyState)보다 먼저 — 재고 0건↔n건 전환 시 훅 개수가 달라지면 안 된다.
  // 열 개수는 rows 와 무관하게 selectable 로만 결정된다.
  const { order, thProps } = useColumnReorder('inventory-table', (selectable ? 1 : 0) + COLS.length + 1, () => inventoryStore.emit());
  const rows = filterRows();
  const cat = getInvCategory();

  if (!rows.length) {
    return (
      <EmptyState
        icon="ti-package-off"
        title={`${cat} 분류에 등록된 재고가 없습니다.`}
        description="상단의 신규 재고 품목 등록 버튼으로 추가할 수 있습니다."
      />
    );
  }

  // 열 서술자 — 순서 변경은 이 배열을 재배열해 렌더한다(DOM 직접 이동 없음).
  const cells = [];
  if (selectable) {
    cells.push({
      id: 'select',
      draggable: false,
      col: <col className="modern-col-select" />,
      th: () => (
        <th className="table-row-select-th" data-col="select">
          <SelectAllCheckbox ids={rows.map((row) => row.id)} selectedIds={selectedIds} onToggleAll={onToggleAll} ariaLabel="현재 표시 재고 전체 선택" />
        </th>
      ),
      td: (item, selected) => (
        <td className="table-row-select-td" data-col="select">
          <input
            type="checkbox"
            className="table-row-select"
            aria-label={item.name + ' 선택'}
            checked={selected}
            onChange={() => onToggleRow?.(item.id)}
            onClick={(event) => event.stopPropagation()}
          />
        </td>
      )
    });
  }
  const COL_CLASS = ['modern-col-code', 'modern-col-name', 'modern-col-type', 'modern-col-quantity', 'modern-col-safe-stock', 'modern-col-location', 'modern-col-note'];
  const CELL = [
    (item) => <td data-table-display-col="inventory-0" className="modern-cell-code">{item.id}</td>,
    (item) => <td data-table-display-col="inventory-1" className="modern-cell-primary">{item.name}</td>,
    (item) => <td data-table-display-col="inventory-2"><span className={'bd ' + (TYPE_BORDER[item.type] || 'bd-neu')}>{item.type}</span></td>,
    (item, _s, low) => (
      <td data-table-display-col="inventory-3">
        <QuantityStepper
          value={item.qty}
          unit={item.unit}
          low={low}
          label={item.name}
          onDecrease={() => g('adjustStock', item.id, -1)}
          onIncrease={() => g('adjustStock', item.id, 1)}
        />
      </td>
    ),
    (item) => <td data-table-display-col="inventory-4">{item.minQty || 0}</td>,
    (item) => <td data-table-display-col="inventory-5" className="modern-cell-secondary">{item.location || '—'}</td>,
    (item) => <td data-table-display-col="inventory-6" className="modern-cell-note" title={item.note || ''}>{item.note || '—'}</td>
  ];
  COLS.forEach((column, index) => {
    cells.push({
      id: column.key,
      draggable: true,
      col: <col className={COL_CLASS[index]} />,
      th: (props) => (
        <SortableTh label={displayLabel('inventory', index, column.label)} sortKey={column.key} displayCol={`inventory-${index}`} {...props} />
      ),
      td: CELL[index]
    });
  });
  cells.push({
    id: 'actions',
    draggable: true,
    col: <col className="modern-col-actions" />,
    th: (props) => <th data-table-display-col="inventory-7" {...props}>{displayLabel('inventory', 7, '관리')}</th>,
    td: (item) => (
      <td data-table-display-col="inventory-7" className="modern-cell-actions">
        <IconButton icon="ti-edit" label={`${item.name} 수정`} className="edit-btn" onClick={() => g('openInvEdit', item.id)} />
        <IconButton icon="ti-trash" label={`${item.name} 삭제`} tone="danger" className="del-btn" onClick={() => g('deleteInventory', item.id)} />
      </td>
    )
  });

  const ordered = order.map((index) => cells[index]);

  return (
    <table className="inventory-compact-table modern-data-table" data-no-managed-table="true">
      <colgroup>
        {ordered.map((cell) => <Fragment key={cell.id}>{cell.col}</Fragment>)}
      </colgroup>
      <thead>
        <tr>
          {ordered.map((cell, visualIndex) => (
            <Fragment key={cell.id}>{cell.th(thProps(visualIndex, cell.draggable))}</Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => {
          const low = item.qty < (item.minQty || 0);
          const selected = !!selectedIds?.has?.(item.id);
          return (
            <tr
              key={item.id}
              data-low={low ? 'true' : undefined}
              className={selected ? 'table-row-selected' : undefined}
              onClick={(event) => {
                if (!isInteractiveTableTarget(event.target)) onToggleRow?.(item.id);
              }}
            >
              {ordered.map((cell) => <Fragment key={cell.id}>{cell.td(item, selected, low)}</Fragment>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}