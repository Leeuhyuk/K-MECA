import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { BulkGrid, INV_BULK_FIELDS } from '../src/components/BulkGrid.jsx';

function Harness({ initial }) {
  const [rows, setRows] = useState(initial);
  return <BulkGrid fields={INV_BULK_FIELDS} rows={rows} onChange={setRows} />;
}

describe('BulkGrid', () => {
  beforeEach(() => { globalThis.esc = (s) => String(s ?? ''); });

  it('필드를 세로 라벨로, 품목을 항목 열로 렌더한다', () => {
    render(<Harness initial={[{}]} />);
    expect(document.querySelector('tbody th')).toHaveTextContent('품목명');
    expect(screen.getByText('현재고')).toBeInTheDocument();
    expect(screen.getByText('항목 1')).toBeInTheDocument();
  });

  it('항목 추가 버튼으로 품목 열이 늘어난다', () => {
    render(<Harness initial={[{}]} />);
    fireEvent.click(screen.getByTitle('항목 추가'));
    expect(document.querySelectorAll('input[data-field="name"]')).toHaveLength(2);
    expect(screen.getByText('항목 2')).toBeInTheDocument();
  });

  it('셀 입력이 rows 상태에 반영된다', () => {
    render(<Harness initial={[{}]} />);
    const nameInput = document.querySelector('input[data-field="name"]');
    fireEvent.change(nameInput, { target: { value: '레일' } });
    expect(nameInput).toHaveValue('레일');
  });

  it('항목 삭제 버튼으로 해당 품목 열이 제거된다', () => {
    render(<Harness initial={[{ name: 'A' }, { name: 'B' }]} />);
    fireEvent.click(screen.getAllByTitle('항목 삭제')[0]);
    const nameInputs = document.querySelectorAll('input[data-field="name"]');
    expect(nameInputs).toHaveLength(1);
    expect(nameInputs[0]).toHaveValue('B');
  });

  it('항목 복제 버튼으로 입력값을 복사한다', () => {
    render(<Harness initial={[{ name: 'A', qty: '3' }]} />);
    fireEvent.click(screen.getByTitle('항목 복제'));
    const nameInputs = document.querySelectorAll('input[data-field="name"]');
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs[1]).toHaveValue('A');
  });

  it('빈 항목의 재고구분/세부유형 기본값이 현재 invCategory 를 따른다', () => {
    globalThis.invCategory = '완제품';
    render(<Harness initial={[{}]} />);
    expect(document.querySelector('select[data-field="category"]')).toHaveValue('완제품');
    expect(document.querySelector('select[data-field="type"]')).toHaveValue('완제품');
    delete globalThis.invCategory;
  });

  it('붙여넣기에서 줄바꿈은 필드, 탭은 항목 방향으로 채운다', () => {
    render(<Harness initial={[{}]} />);
    const nameInput = document.querySelector('input[data-field="name"]');
    const clipboardData = { getData: () => '레일\t모터\n생산부품\t완제품' };
    fireEvent.paste(nameInput, { clipboardData });
    const names = document.querySelectorAll('input[data-field="name"]');
    const categories = document.querySelectorAll('select[data-field="category"]');
    expect(names).toHaveLength(2);
    expect(names[0]).toHaveValue('레일');
    expect(names[1]).toHaveValue('모터');
    expect(categories[0]).toHaveValue('생산부품');
    expect(categories[1]).toHaveValue('완제품');
  });
});