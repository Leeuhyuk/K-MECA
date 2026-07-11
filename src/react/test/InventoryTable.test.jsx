import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

function SelectionHarness() {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleRow = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = (ids) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };
  return (
    <InventoryTable
      selectable
      selectedIds={selectedIds}
      onToggleRow={toggleRow}
      onToggleAll={toggleAll}
    />
  );
}

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

  it('헤더 셀도 data-table-display-col 인덱스(0~7)를 가진다 (RBAC 게이팅이 헤더+본문 함께 숨김)', () => {
    const { container } = render(<InventoryTable />);
    const headIdxs = Array.from(container.querySelectorAll('thead th[data-table-display-col]'))
      .map((el) => el.getAttribute('data-table-display-col'));
    expect(headIdxs).toEqual([
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

  it('행을 클릭하면 선택되고 같은 행을 다시 클릭하면 해제된다', () => {
    render(<SelectionHarness />);
    const row = screen.getByText('레일').closest('tr');
    const checkbox = screen.getByLabelText('레일 선택');
    expect(checkbox.closest('td')).toHaveClass('table-row-select-td');
    expect(screen.getByLabelText('현재 표시 재고 전체 선택').closest('th')).toHaveClass('table-row-select-th');

    fireEvent.click(screen.getByText('레일'));
    expect(checkbox).toBeChecked();
    expect(row).toHaveClass('table-row-selected');

    fireEvent.click(screen.getByText('레일'));
    expect(checkbox).not.toBeChecked();
    expect(row).not.toHaveClass('table-row-selected');
  });

  it('헤더 체크박스로 현재 표시 행을 전체 선택하고 해제한다', () => {
    render(<SelectionHarness />);
    const checkAll = screen.getByLabelText('현재 표시 재고 전체 선택');

    fireEvent.click(checkAll);
    expect(screen.getByLabelText('레일 선택')).toBeChecked();
    expect(screen.getByLabelText('베어링 선택')).toBeChecked();

    fireEvent.click(checkAll);
    expect(screen.getByLabelText('레일 선택')).not.toBeChecked();
    expect(screen.getByLabelText('베어링 선택')).not.toBeChecked();
  });

  it('수량 조정 버튼 클릭은 행 선택을 바꾸지 않는다', () => {
    const { container } = render(<SelectionHarness />);
    fireEvent.click(container.querySelector('[data-act="inc"]'));
    expect(screen.getByLabelText('레일 선택')).not.toBeChecked();
    expect(globalThis.adjustStock).toHaveBeenCalledWith('INV-1', 1);
  });

  it('selectable=false(기본)이면 선택 컬럼을 렌더하지 않는다', () => {
    const { container } = render(<InventoryTable />);
    expect(container.querySelector('[data-col="select"]')).toBeFalsy();
  });
});
