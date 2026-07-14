import { Fragment, useSyncExternalStore } from 'react';
import { materialsStore } from '../bridge/store.js';
import { useColumnReorder } from '../bridge/columnOrder.js';
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
  // 훅은 조기 반환(EmptyState)보다 먼저 — 0건↔n건 전환 시 훅 개수가 달라지면 안 된다.
  const { order, thProps } = useColumnReorder('mat-table', (selectable ? 1 : 0) + COLS.length + 1, () => materialsStore.emit());
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

  // 열 서술자 — 순서 변경은 이 배열을 재배열해 렌더한다(DOM 직접 이동 없음).
  const cells = [];
  if (selectable) {
    cells.push({
      id: 'select',
      draggable: false,
      col: <col className="modern-col-select" />,
      th: () => (
        <th className="table-row-select-th" data-col="select">
          <SelectAllCheckbox
            ids={rows.map((row) => row.id)}
            selectedIds={selectedIds}
            onToggleAll={onToggleAll}
            ariaLabel="현재 표시 자재 전체 선택"
          />
        </th>
      ),
      td: (material, ctx) => (
        <td className="table-row-select-td" data-col="select">
          <input
            type="checkbox"
            className="table-row-select"
            aria-label={material.name + ' 선택'}
            checked={ctx.selected}
            onChange={() => onToggleRow?.(material.id)}
            onClick={(event) => event.stopPropagation()}
          />
        </td>
      )
    });
  }
  const COL_CLASS = ['modern-col-code', 'modern-col-client', 'modern-col-product', 'modern-col-material', 'modern-col-supplier', 'modern-col-money', 'modern-col-unit-quantity', 'modern-col-total', 'modern-col-date', 'modern-col-date', 'modern-col-status', 'modern-col-note'];
  const CELL = [
    (m) => <td data-table-display-col="materials-0" className="modern-cell-code">{m.id}</td>,
    (m, ctx) => <td data-table-display-col="materials-1">{ctx.client?.name || '—'}</td>,
    (m, ctx) => <td data-table-display-col="materials-2" className="modern-cell-secondary">{ctx.product?.name || '—'}</td>,
    (m) => (
      <td data-table-display-col="materials-3" className="modern-cell-primary">
        {m.name}
        {m.spec && <span className="modern-cell-sub">{m.spec}</span>}
      </td>
    ),
    (m) => <td data-table-display-col="materials-4">{m.supplier || '—'}</td>,
    (m) => <td data-table-display-col="materials-5" className="modern-cell-money">{formatWon(m.unitPrice)}</td>,
    (m) => <td data-table-display-col="materials-6">{m.qty} {m.unit}</td>,
    (m) => <td data-table-display-col="materials-7" className="modern-cell-total">{formatWon(materialAmount(m))}</td>,
    (m) => <td data-table-display-col="materials-8">{m.orderDate || '—'}</td>,
    (m) => <td data-table-display-col="materials-9">{m.expectedDate || '—'}</td>,
    (m, ctx) => (
      <td data-table-display-col="materials-10">
        <StatusPill
          status={m.status || '—'}
          tone={STATUS_TONE[m.status]}
          className={`readonly-status-pill ${ctx.statusClass}`}
        />
        <select
          className="stat-sel readonly-status-source"
          aria-label={m.name + ' 상태'}
          aria-hidden="true"
          tabIndex="-1"
          value={m.status || '발주전'}
          onChange={(event) => g('changeMatStatus', m.id, event.target.value)}
        >
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </td>
    ),
    (m) => <td data-table-display-col="materials-11" className="modern-cell-note" title={m.note || ''}>{m.note || '—'}</td>
  ];
  COLS.forEach((column, index) => {
    cells.push({
      id: column.key,
      draggable: true,
      col: <col className={COL_CLASS[index]} />,
      th: (props) => (
        <SortableTh
          label={displayLabel('materials', index, column.label)}
          sortKey={column.key}
          scope="materials"
          displayCol={'materials-' + index}
          {...props}
        />
      ),
      td: CELL[index]
    });
  });
  cells.push({
    id: 'actions',
    draggable: true,
    col: <col className="modern-col-actions" />,
    th: (props) => <th data-table-display-col="materials-12" {...props}>{displayLabel('materials', 12, '관리')}</th>,
    td: (material) => (
      <td data-table-display-col="materials-12" className="modern-cell-actions">
        <IconButton icon="ti-edit" label={`${material.name} 수정`} className="edit-btn" onClick={() => g('openMatEdit', material.id)} />
        <IconButton icon="ti-trash" label={`${material.name} 삭제`} tone="danger" className="del-btn" onClick={() => g('deleteMat', material.id)} />
      </td>
    )
  });

  const ordered = order.map((index) => cells[index]);
  // 합계 행은 '매입총액' 열 위치에 맞춰야 한다 — 열을 옮기면 그 위치도 따라간다.
  const totalIndex = ordered.findIndex((cell) => cell.id === 'totalAmt');
  const tailSpan = ordered.length - totalIndex - 1;

  return (
    <table
      className="materials-react-table modern-data-table"
      data-no-managed-table="true"
      data-react-domain="materials"
    >
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
        {rows.map((material) => {
          const product = productById.get(material.productId);
          const client = product ? clientById.get(product.clientId) : null;
          const selected = !!selectedIds?.has?.(material.id);
          const statusClass = g('selectionDetailStatusClass', material.status) || STATUS_CLASS[material.status] || '';
          const ctx = { product, client, selected, statusClass };
          return (
            <tr
              key={material.id}
              data-entity-id={material.id}
              className={selected ? 'table-row-selected' : undefined}
              onClick={(event) => {
                if (!isInteractiveTableTarget(event.target)) onToggleRow?.(material.id);
              }}
            >
              {ordered.map((cell) => <Fragment key={cell.id}>{cell.td(material, ctx)}</Fragment>)}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="modern-table-summary-row">
          {totalIndex > 0 && <td colSpan={totalIndex}>조건부 합계 건수: {rows.length}건</td>}
          <td className="modern-cell-total">{formatWon(visibleTotal)}</td>
          {tailSpan > 0 && <td colSpan={tailSpan} />}
        </tr>
      </tfoot>
    </table>
  );
}