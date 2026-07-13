import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { InventoryTable } from '../src/components/InventoryTable.jsx';
import { MaterialsTable } from '../src/components/MaterialsTable.jsx';
import { TodayWorkStrip } from '../src/components/TodayWorkStrip.jsx';

const materials = [
  { id: 'MT-DUE', productId: 'P-1', name: '오늘 자재', expectedDate: '2026-07-13', status: '발주중', qty: 1, unit: 'EA' },
  { id: 'MT-LATE', productId: 'P-1', name: '지연 자재', expectedDate: '2026-07-10', status: '발주중', qty: 1, unit: 'EA' },
  { id: 'MT-WAIT', productId: 'P-1', name: '대기 자재', expectedDate: '', status: '발주전', qty: 1, unit: 'EA' },
  { id: 'MT-DONE', productId: 'P-1', name: '완료 자재', expectedDate: '2026-07-13', status: '입고완료', qty: 1, unit: 'EA' }
];

const inventory = [
  { id: 'INV-0', name: '빈 재고', category: '생산부품', type: '자재', qty: 0, minQty: 3, unit: 'EA' },
  { id: 'INV-1', name: '정상 재고', category: '생산부품', type: '자재', qty: 10, minQty: 3, unit: 'EA' }
];

function installGlobals() {
  document.body.innerHTML = `
    <select id="mat-fs"><option value="">전체</option><option>발주전</option></select>
    <select id="inv-filter-status"><option value="">전체</option><option value="low">미달</option></select>`;
  globalThis.__modernMaterialsWorkFilter = '';
  globalThis.__modernInventoryWorkFilter = '';
  globalThis.getMaterialsReactState = () => ({
    materials,
    clients: [{ id: 'C-1', name: '고객사' }],
    products: [{ id: 'P-1', clientId: 'C-1', name: '제품' }],
    sortState: { key: '', asc: true }
  });
  globalThis.getInventoryReactState = () => ({ inventory, invCategory: '생산부품', sortState: { key: '', asc: true } });
  globalThis.canViewRecord = () => true;
  globalThis.dateViewMatch = () => true;
  globalThis.v = (id) => document.getElementById(id)?.value || '';
  globalThis.fmtW = (value) => `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  globalThis.sortIcon = () => '';
  globalThis.go = vi.fn();
  globalThis.goInventory = vi.fn();
}

describe('TodayWorkStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T09:00:00+09:00'));
    installGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('오늘 입고·지연·발주 전·안전재고 미달을 실제 데이터로 계산한다', () => {
    render(<TodayWorkStrip domain="materials" todayKey="2026-07-13" />);
    const queue = screen.getByLabelText('오늘 처리 업무');
    expect(within(queue).getByRole('button', { name: /오늘 입고 예정 1건/ })).toBeInTheDocument();
    expect(within(queue).getByRole('button', { name: /입고 지연 1건/ })).toBeInTheDocument();
    expect(within(queue).getByRole('button', { name: /발주 전 1건/ })).toBeInTheDocument();
    expect(within(queue).getByRole('button', { name: /안전재고 미달 1건/ })).toBeInTheDocument();
  });

  it('오늘 입고 항목을 누르면 자재 목록을 해당 건으로 필터링한다', () => {
    render(<><TodayWorkStrip domain="materials" todayKey="2026-07-13" /><MaterialsTable /></>);
    fireEvent.click(screen.getByRole('button', { name: /오늘 입고 예정 1건/ }));
    expect(globalThis.__modernMaterialsWorkFilter).toBe('dueToday');
    expect(screen.getByText('오늘 자재')).toBeInTheDocument();
    expect(screen.queryByText('지연 자재')).not.toBeInTheDocument();
  });

  it('현재고 0 항목을 누르면 현재 재고 분류에서 빈 품목만 표시한다', () => {
    render(<><TodayWorkStrip domain="inventory" todayKey="2026-07-13" /><InventoryTable /></>);
    fireEvent.click(screen.getByRole('button', { name: /현재고 0 1건/ }));
    expect(globalThis.__modernInventoryWorkFilter).toBe('emptyStock');
    expect(screen.getByText('빈 재고')).toBeInTheDocument();
    expect(screen.queryByText('정상 재고')).not.toBeInTheDocument();
  });
});
