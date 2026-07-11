import { useSyncExternalStore } from 'react';
import { materialsStore } from '../bridge/store.js';
import { getClients, getMaterials, getMaterialsSortState, getProducts, g } from '../bridge/globals.js';
import { SelectAllCheckbox, isInteractiveTableTarget } from './TableSelection.jsx';
import { SortableTh } from './SortableTh.jsx';

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

  let rows = getMaterials().filter((material) => {
    if (g('canViewRecord', material, 'material') === false) return false;
    if (g('dateViewMatch', 'materials', material.orderDate) === false) return false;
    const product = productById.get(material.productId);
    const client = product ? clientById.get(product.clientId) : null;
    if (clientFilter && product?.clientId !== clientFilter) return false;
    if (productFilter && material.productId !== productFilter) return false;
    if (statusFilter && material.status !== statusFilter) return false;
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
    const message = '자재 발주 내역이 없습니다.';
    const html = g('empty', message);
    if (html) return <div dangerouslySetInnerHTML={{ __html: html }} />;
    return <div className="empty-wrap">{message}</div>;
  }

  const visibleTotal = rows.reduce((sum, material) => sum + materialAmount(material), 0);

  return (
    <table
      className="materials-react-table"
      style={{ minWidth: 1080 }}
      data-no-managed-table="true"
      data-react-domain="materials"
    >
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
              label={column.label}
              sortKey={column.key}
              scope="materials"
              displayCol={'materials-' + index}
            />
          ))}
          <th data-table-display-col="materials-12">관리작업</th>
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
              <td data-table-display-col="materials-0">{material.id}</td>
              <td data-table-display-col="materials-1">{client?.name || '—'}</td>
              <td data-table-display-col="materials-2" style={{ fontWeight: 600, fontSize: 11 }}>{product?.name || '—'}</td>
              <td data-table-display-col="materials-3" style={{ fontWeight: 700 }}>
                {material.name}
                {material.spec && <div style={{ fontSize: 10.5, color: 'var(--tx-t)', fontWeight: 500 }}>{material.spec}</div>}
              </td>
              <td data-table-display-col="materials-4">{material.supplier || '—'}</td>
              <td data-table-display-col="materials-5" style={{ fontWeight: 600 }}>{formatWon(material.unitPrice)}</td>
              <td data-table-display-col="materials-6">{material.qty} {material.unit}</td>
              <td data-table-display-col="materials-7" style={{ fontWeight: 700, color: 'var(--tx-i)' }}>{formatWon(materialAmount(material))}</td>
              <td data-table-display-col="materials-8">{material.orderDate || '—'}</td>
              <td data-table-display-col="materials-9">{material.expectedDate || '—'}</td>
              <td data-table-display-col="materials-10">
                <span className={'readonly-status-pill ' + statusClass}>{material.status || '—'}</span>
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
              <td
                data-table-display-col="materials-11"
                style={{ fontSize: 11, color: 'var(--tx-t)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}
                title={material.note || ''}
              >
                {material.note || '—'}
              </td>
              <td data-table-display-col="materials-12" style={{ whiteSpace: 'nowrap' }}>
                <button className="edit-btn" onClick={() => g('openMatEdit', material.id)}><i className="ti ti-edit" />수정</button>
                <button className="del-btn" style={{ marginLeft: 4 }} onClick={() => g('deleteMat', material.id)} aria-label={material.name + ' 삭제'}><i className="ti ti-trash" /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ background: 'var(--bg-s)' }}>
          <td colSpan={selectable ? 8 : 7} style={{ fontSize: 11, fontWeight: 700 }}>조건부 합계 건수: {rows.length}건</td>
          <td style={{ fontWeight: 700, color: 'var(--tx-i)' }}>{formatWon(visibleTotal)}</td>
          <td colSpan="5" />
        </tr>
      </tfoot>
    </table>
  );
}