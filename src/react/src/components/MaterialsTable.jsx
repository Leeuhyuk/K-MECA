import { useSyncExternalStore } from 'react';
import { materialsStore } from '../bridge/store.js';
import { getClients, getMaterials, getMaterialsSortState, getProducts, displayLabel, g } from '../bridge/globals.js';
import { SelectAllCheckbox, isInteractiveTableTarget } from './TableSelection.jsx';
import { SortableTh } from './SortableTh.jsx';
import { EmptyState } from './ui/EmptyState.jsx';
import { IconButton } from './ui/IconButton.jsx';
import { StatusPill } from './ui/StatusPill.jsx';

const COLS = [
  { key: 'id', label: '자재코드' },
  { key: 'client', label: '구분고객사' },
  { key: 'product', label: '매칭제품' },
  { key: 'name', label: '자재품명' },
  { key: 'supplier', label: '협력공급처' },
  { key: 'unitPrice', label: '구매단가' },
  { key: 'qty', label: '수량' },
  { key: 'totalAmt', label: '매입총액' },
  { key: 'orderDate', label: '주문일자' },
  { key: 'expectedDate', label: '입고예정일' },
  { key: 'status', label: '진행상황' },
  { key: 'note', label: '참고사항' }
];
const STATUSES = ['발주전', '발주중', '입고완료', '지연'];
const STATUS_CLASS = { 입고완료: 'is-ok', 지연: 'is-danger', 발주중: 'is-warn', 발주전: 'is-muted' };
const STATUS_TONE = { 입고완료: 'success', 지연: 'danger', 발주중: 'info', 발주전: 'neutral' };

function useMaterialsSnapshot() {
  useSyncExternalStore(materialsStore.subscribe, materialsStore.getVersion, materialsStore.getVersion);
}

function materialAmount(material) {
  return (Number(material.unitPrice) || 0) * (Number(material.qty) || 0);
}

function formatWon(value) {
  return g('fmtW', value) || ('₩' + Math.round(Number(value) || 0).toLocaleString('ko-KR'));
}

function materialViewState() {
  const clients = getClients();
  const products = getProducts();
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const clientFilter = g('v', 'mat-fc') || '';
  const productFilter = g('v', 'mat-fp') || '';
  const statusFilter = g('v', 'mat-fs') || '';
  const query = String(g('v', 'mat-q') || '').toLowerCase();
  const workFilter = globalThis.__modernMaterialsWorkFilter || '';
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let rows = getMaterials().filter((material) => {
    if (g('canViewRecord', material, 'material') === false) return false;
    if (g('dateViewMatch', 'materials', material.orderDate) === false) return false;
    const product = productById.get(material.productId);
    const client = product ? clientById.get(product.clientId) : null;
    if (clientFilter && product?.clientId !== clientFilter) return false;
    if (productFilter && material.productId !== productFilter) return false;
    if (statusFilter && material.status !== statusFilter) return false;
    if (workFilter === 'dueToday' && (material.status === '입고완료' || material.expectedDate !== todayKey)) return false;
    if (workFilter === 'overdue' && (material.status === '입고완료' || !(material.status === '지연' || (material.expectedDate && material.expectedDate < todayKey)))) return false;
    if (query) {
      const haystack = [
        material.id, material.name, material.supplier, product?.name, client?.name
      ].map((value) => String(value || '').toLowerCase());
      if (!haystack.some((value) => value.includes(query))) return false;
    }
    return true;
  });

  const sort = getMaterialsSortState();
  if (sort.key) {
    const asc = sort.asc ? 1 : -1;
    const valueFor = (material) => {
      const product = productById.get(material.productId);
      if (sort.key === 'client') return clientById.get(product?.clientId)?.name || '';
      if (sort.key === 'product') return product?.name || '';
      if (sort.key === 'totalAmt') return materialAmount(material);
      return material[sort.key] == null ? '' : material[sort.key];
    };
    rows = rows.slice().sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * asc;
      return String(av).localeCompare(String(bv), 'ko-KR') * asc;
    });
  }

  return { rows, clientById, productById };
}

export function MaterialsTable({ selectable = false, selectedIds = null, onToggleRow = null, onToggleAll = null }) {
  useMaterialsSnapshot();
  const { rows, clientById, productById } = materialViewState();

  if (!rows.length) {
    return (
      <EmptyState
        icon="ti-truck-loading"
        title="자재 발주 내역이 없습니다."
        description="필터를 초기화하거나 신규 자재 발주를 등록해 주세요."
      />
    );
  }

  const visibleTotal = rows.reduce((sum, material) => sum + materialAmount(material), 0);

  return (
    <table
      className="materials-react-table modern-data-table"
      data-no-managed-table="true"
      data-react-domain="materials"
    >
      <colgroup>
        {selectable && <col className="modern-col-select" />}
        <col className="modern-col-code" />
        <col className="modern-col-client" />
        <col className="modern-col-product" />
        <col className="modern-col-material" />
        <col className="modern-col-supplier" />
        <col className="modern-col-money" />
        <col className="modern-col-unit-quantity" />
        <col className="modern-col-total" />
        <col className="modern-col-date" />
        <col className="modern-col-date" />
        <col className="modern-col-status" />
        <col className="modern-col-note" />
        <col className="modern-col-actions" />
      </colgroup>
      <thead>
        <tr>
          {selectable && (
            <th className="table-row-select-th" data-col="select">
              <SelectAllCheckbox
                ids={rows.map((row) => row.id)}
                selectedIds={selectedIds}
                onToggleAll={onToggleAll}
                ariaLabel="현재 표시 자재 전체 선택"
              />
            </th>
          )}
          {COLS.map((column, index) => (
            <SortableTh
              key={column.key}
              label={displayLabel('materials', index, column.label)}
              sortKey={column.key}
              scope="materials"
              displayCol={'materials-' + index}
            />
          ))}
          <th data-table-display-col="materials-12">{displayLabel('materials', 12, '관리')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((material) => {
          const product = productById.get(material.productId);
          const client = product ? clientById.get(product.clientId) : null;
          const selected = !!selectedIds?.has?.(material.id);
          const statusClass = g('selectionDetailStatusClass', material.status) || STATUS_CLASS[material.status] || '';
          return (
            <tr
              key={material.id}
              data-entity-id={material.id}
              className={selected ? 'table-row-selected' : undefined}
              onClick={(event) => {
                if (!isInteractiveTableTarget(event.target)) onToggleRow?.(material.id);
              }}
            >
              {selectable && (
                <td className="table-row-select-td" data-col="select">
                  <input
                    type="checkbox"
                    className="table-row-select"
                    aria-label={material.name + ' 선택'}
                    checked={selected}
                    onChange={() => onToggleRow?.(material.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </td>
              )}
              <td data-table-display-col="materials-0" className="modern-cell-code">{material.id}</td>
              <td data-table-display-col="materials-1">{client?.name || '—'}</td>
              <td data-table-display-col="materials-2" className="modern-cell-secondary">{product?.name || '—'}</td>
              <td data-table-display-col="materials-3" className="modern-cell-primary">
                {material.name}
                {material.spec && <span className="modern-cell-sub">{material.spec}</span>}
              </td>
              <td data-table-display-col="materials-4">{material.supplier || '—'}</td>
              <td data-table-display-col="materials-5" className="modern-cell-money">{formatWon(material.unitPrice)}</td>
              <td data-table-display-col="materials-6">{material.qty} {material.unit}</td>
              <td data-table-display-col="materials-7" className="modern-cell-total">{formatWon(materialAmount(material))}</td>
              <td data-table-display-col="materials-8">{material.orderDate || '—'}</td>
              <td data-table-display-col="materials-9">{material.expectedDate || '—'}</td>
              <td data-table-display-col="materials-10">
                <StatusPill
                  status={material.status || '—'}
                  tone={STATUS_TONE[material.status]}
                  className={`readonly-status-pill ${statusClass}`}
                />
                <select
                  className="stat-sel readonly-status-source"
                  aria-label={material.name + ' 상태'}
                  aria-hidden="true"
                  tabIndex="-1"
                  value={material.status || '발주전'}
                  onChange={(event) => g('changeMatStatus', material.id, event.target.value)}
                >
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td data-table-display-col="materials-11" className="modern-cell-note" title={material.note || ''}>
                {material.note || '—'}
              </td>
              <td data-table-display-col="materials-12" className="modern-cell-actions">
                <IconButton icon="ti-edit" label={`${material.name} 수정`} className="edit-btn" onClick={() => g('openMatEdit', material.id)} />
                <IconButton icon="ti-trash" label={`${material.name} 삭제`} tone="danger" className="del-btn" onClick={() => g('deleteMat', material.id)} />
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="modern-table-summary-row">
          <td colSpan={selectable ? 8 : 7}>조건부 합계 건수: {rows.length}건</td>
          <td className="modern-cell-total">{formatWon(visibleTotal)}</td>
          <td colSpan="5" />
        </tr>
      </tfoot>
    </table>
  );
}