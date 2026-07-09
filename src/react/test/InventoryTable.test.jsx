import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InventoryTable } from '../src/components/InventoryTable.jsx';
import { inventoryStore } from '../src/bridge/store.js';

function installGlobals(rows) {
  globalThis.inventory = rows;
  globalThis.invCategory = '생산부품';
  globalThis.sortState = { inventory: { key: '', asc: true } };
  globalThis.esc = (s) => String(s ?? '');
  globalThis.empty = (m) => `<div class="empty">${m}</div>`;
  globalThis.canViewRecord = () => true;
  globalThis.sortIcon = () => '';
  globalThis.toggleSort = vi.fn();
  globalThis.adjustStock = vi.fn();
  globalThis.openInvEdit = vi.fn();
  globalThis.deleteInventory = vi.fn();
  globalThis.v = (id) => (globalThis.__filters?.[id] ?? '');
}

const sample = [
  { id: 'INV-1', name: '레일', type: '자재', category: '생산부품', qty: 3, minQty: 5, unit: 'EA', location: 'A-1', note: '메모' },
  { id: 'INV-2', name: '베어링', type: '반제품', category: '생산부품', qty: 20, minQty: 10, unit: 'EA', location: 'B-2', note: '' }
];

describe('InventoryTable', () => {
  beforeEach(() => { globalThis.__filters = {}; installGlobals(sample); });

  it('현재 분류의 재고 행을 렌더한다', () => {
    render(<InventoryTable />);
    expect(screen.getByText('레일')).toBeInTheDocument();
    expect(screen.getByText('베어링')).toBeInTheDocument();
  });

  it('각 데이터 셀에 data-table-display-col 인덱스(0~7)를 부여한다', () => {
    const { container } = render(<InventoryTable />);
    const firstRow = container.querySelector('tbody tr');
    const idxs = Array.from(firstRow.querySelectorAll('[data-table-display-col]'))
      .map((el) => el.getAttribute('data-table-display-col'));
    expect(idxs).toEqual([
      'inventory-0','inventory-1','inventory-2','inventory-3',
      'inventory-4','inventory-5','inventory-6','inventory-7'
    ]);
  });

  it('안전재고 미달 행에 경고 아이콘을 표시한다 (qty<minQty)', () => {
    const { container } = render(<InventoryTable />);
    expect(container.querySelector('[data-low="true"]')).toBeTruthy();
  });

  it('수정 버튼은 .edit-btn, 삭제 버튼은 .del-btn 클래스를 가진다', () => {
    const { container } = render(<InventoryTable />);
    expect(container.querySelector('.edit-btn')).toBeTruthy();
    expect(container.querySelector('.del-btn')).toBeTruthy();
  });

  it('+ 버튼 클릭 시 window.adjustStock(id, 1) 을 호출한다', () => {
    const { container } = render(<InventoryTable />);
    const incBtn = container.querySelector('[data-act="inc"]');
    incBtn.click();
    expect(globalThis.adjustStock).toHaveBeenCalledWith('INV-1', 1);
  });

  it('빈 목록이면 empty 안내를 렌더한다', () => {
    installGlobals([]);
    render(<InventoryTable />);
    expect(screen.getByText(/등록된 재고가 없습니다/)).toBeInTheDocument();
  });

  it('selectable=false(기본)이면 선택 컬럼을 렌더하지 않는다', () => {
    const { container } = render(<InventoryTable />);
    expect(container.querySelector('[data-col="select"]')).toBeFalsy();
  });
});
