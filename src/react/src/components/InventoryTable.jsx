import { useSyncExternalStore } from 'react';
import { inventoryStore } from '../bridge/store.js';
import { getInventory, getInvCategory, getSortState, g } from '../bridge/globals.js';
import { SortableTh } from './SortableTh.jsx';
import { SelectAllCheckbox, isInteractiveTableTarget } from './TableSelection.jsx';

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
  rows = rows.filter((i) => {
    if (ft && i.type !== ft) return false;
    if (st === 'low' && !(i.qty < (i.minQty || 0))) return false;
    if (st === 'normal' && (i.qty < (i.minQty || 0))) return false;
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
  const rows = filterRows();
  const cat = getInvCategory();

  if (!rows.length) {
    const msg = `${cat} 분류에 등록된 재고가 없습니다. [신규 재고 품목 등록] 버튼으로 추가하세요.`;
    const html = g('empty', msg);
    if (html) return <div dangerouslySetInnerHTML={{ __html: html }} />;
    return <div className="empty-wrap">{msg}</div>;
  }

  return (
    // data-no-managed-table: vanilla 테이블 데코레이터(table-selection·table-reorder·
    // applyTableDisplaySettings)가 React 소유 DOM 을 변형하지 않도록 opt-out.
    // (행 선택·컬럼 재정렬/표시설정은 파일럿 비범위 — 후속 React 구현으로 복구)
    // RBAC 컬럼 게이팅은 rbac.js 의 CSS 가 React 가 렌더한 data-table-display-col 로 계속 작동.
    <table className="inventory-compact-table" style={{ minWidth: 860 }} data-no-managed-table="true">
      <thead>
        <tr>
          {selectable && (
            <th className="table-row-select-th" data-col="select">
              <SelectAllCheckbox ids={rows.map((row) => row.id)} selectedIds={selectedIds} onToggleAll={onToggleAll} ariaLabel="현재 표시 재고 전체 선택" />
            </th>
          )}
          {COLS.map((c, idx) => <SortableTh key={c.key} label={c.label} sortKey={c.key} displayCol={`inventory-${idx}`} />)}
          <th data-table-display-col="inventory-7">관리</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((i) => {
          const low = i.qty < (i.minQty || 0);
          const selected = !!selectedIds?.has?.(i.id);
          return (
            <tr
              key={i.id}
              data-low={low ? 'true' : undefined}
              className={selected ? 'table-row-selected' : undefined}
              onClick={(event) => {
                if (!isInteractiveTableTarget(event.target)) onToggleRow?.(i.id);
              }}
            >
              {selectable && (
                <td className="table-row-select-td" data-col="select">
                  <input
                    type="checkbox"
                    className="table-row-select"
                    aria-label={i.name + ' 선택'}
                    checked={selected}
                    onChange={() => onToggleRow?.(i.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </td>
              )}
              <td data-table-display-col="inventory-0" style={{ fontSize: 11, color: 'var(--tx-t)' }}>{i.id}</td>
              <td data-table-display-col="inventory-1" style={{ fontWeight: 700 }}>{i.name}</td>
              <td data-table-display-col="inventory-2">
                <span className={'bd ' + (TYPE_BORDER[i.type] || 'bd-neu')}>{i.type}</span>
              </td>
              <td data-table-display-col="inventory-3" style={{ fontWeight: 700, color: low ? 'var(--tx-d)' : undefined }}>
                <button className="btn btn-sm" data-act="dec" style={{ padding: '0 7px' }} onClick={() => g('adjustStock', i.id, -1)}>−</button>{' '}
                {i.qty} {i.unit}{' '}
                <button className="btn btn-sm" data-act="inc" style={{ padding: '0 7px' }} onClick={() => g('adjustStock', i.id, 1)}>+</button>
                {low && <i className="ti ti-alert-triangle" style={{ color: 'var(--tx-d)' }} title="안전재고 미달" />}
              </td>
              <td data-table-display-col="inventory-4">{i.minQty || 0}</td>
              <td data-table-display-col="inventory-5" style={{ fontSize: 11 }}>{i.location || '—'}</td>
              <td data-table-display-col="inventory-6" style={{ fontSize: 11, color: 'var(--tx-t)' }}>{i.note || '—'}</td>
              <td data-table-display-col="inventory-7" style={{ whiteSpace: 'nowrap' }}>
                <button className="edit-btn" onClick={() => g('openInvEdit', i.id)}><i className="ti ti-edit" />수정</button>
                <button className="del-btn" style={{ marginLeft: 4 }} onClick={() => g('deleteInventory', i.id)}><i className="ti ti-trash" /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
