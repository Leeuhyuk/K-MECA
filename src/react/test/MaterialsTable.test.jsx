import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MaterialsTable } from '../src/components/MaterialsTable.jsx';

const clients = [
  { id: 'C-1', name: '현대리바트' },
  { id: 'C-2', name: '테스트고객' }
];
const products = [
  { id: 'P-1', clientId: 'C-1', name: '캐스터 시험기' },
  { id: 'P-2', clientId: 'C-2', name: '검증 제품' }
];
const materials = [
  { id: 'MT-1', productId: 'P-1', name: '프로파일', spec: '20x20', supplier: '예주산업', unitPrice: 1000, qty: 2, unit: 'EA', orderDate: '2026-07-01', expectedDate: '2026-07-15', status: '발주중', note: '우선 발주' },
  { id: 'MT-2', productId: 'P-2', name: '베어링', spec: '', supplier: '미래산업', unitPrice: 500, qty: 4, unit: 'EA', orderDate: '2026-07-02', expectedDate: '', status: '입고완료', note: '' }
];

function installGlobals() {
  globalThis.getMaterialsReactState = () => ({
    materials,
    clients,
    products,
    sortState: { key: '', asc: true }
  });
  globalThis.__filters = {};
  globalThis.v = (id) => globalThis.__filters[id] || '';
  globalThis.canViewRecord = () => true;
  globalThis.dateViewMatch = () => true;
  globalThis.fmtW = (value) => '₩' + Number(value || 0).toLocaleString('ko-KR');
  globalThis.empty = (message) => '<div class="empty">' + message + '</div>';
  globalThis.sortIcon = () => '';
  globalThis.toggleSort = vi.fn();
  globalThis.selectionDetailStatusClass = (status) => status === '입고완료' ? 'is-ok' : 'is-warn';
  globalThis.changeMatStatus = vi.fn();
  globalThis.openMatEdit = vi.fn();
  globalThis.deleteMat = vi.fn();
}

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
  return <MaterialsTable selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />;
}

describe('MaterialsTable', () => {
  beforeEach(installGlobals);

  it('자재와 연결 고객사·제품·금액을 렌더한다', () => {
    render(<MaterialsTable />);
    expect(screen.getByText('프로파일')).toBeInTheDocument();
    expect(screen.getByText('현대리바트')).toBeInTheDocument();
    expect(screen.getByText('캐스터 시험기')).toBeInTheDocument();
    expect(screen.getAllByText('₩2,000')).toHaveLength(2);
  });

  it('기존 상태 필터 값을 사용한다', () => {
    globalThis.__filters['mat-fs'] = '입고완료';
    render(<MaterialsTable />);
    expect(screen.queryByText('프로파일')).not.toBeInTheDocument();
    expect(screen.getByText('베어링')).toBeInTheDocument();
  });

  it('행 클릭과 전체 체크박스로 선택 상태를 전환한다', () => {
    render(<SelectionHarness />);
    fireEvent.click(screen.getByText('프로파일'));
    expect(screen.getByLabelText('프로파일 선택')).toBeChecked();
    expect(screen.getByText('프로파일').closest('tr')).toHaveClass('table-row-selected');

    fireEvent.click(screen.getByLabelText('현재 표시 자재 전체 선택'));
    expect(screen.getByLabelText('프로파일 선택')).toBeChecked();
    expect(screen.getByLabelText('베어링 선택')).toBeChecked();
  });

  it('상태 소스와 수정·삭제 작업을 기존 함수에 연결한다', () => {
    const { container } = render(<MaterialsTable />);
    const row = screen.getByText('프로파일').closest('tr');
    fireEvent.change(row.querySelector('.readonly-status-source'), { target: { value: '입고완료' } });
    expect(globalThis.changeMatStatus).toHaveBeenCalledWith('MT-1', '입고완료');

    fireEvent.click(row.querySelector('.edit-btn'));
    fireEvent.click(row.querySelector('.del-btn'));
    expect(globalThis.openMatEdit).toHaveBeenCalledWith('MT-1');
    expect(globalThis.deleteMat).toHaveBeenCalledWith('MT-1');
    expect(container.querySelector('[data-react-domain="materials"]')).toBeTruthy();
  });

  it('정렬 헤더는 materials 정렬 범위를 사용한다', () => {
    render(<MaterialsTable />);
    fireEvent.click(screen.getByText('자재코드'));
    expect(globalThis.toggleSort).toHaveBeenCalledWith('materials', 'id');
  });
});