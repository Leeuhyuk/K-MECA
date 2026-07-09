import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { BulkGrid, INV_BULK_FIELDS } from '../src/components/BulkGrid.jsx';

function Harness({ initial }) {
  const [rows, setRows] = useState(initial);
  return <BulkGrid fields={INV_BULK_FIELDS} rows={rows} onChange={setRows} />;
}

describe('BulkGrid', () => {
  beforeEach(() => { globalThis.esc = (s) => String(s ?? ''); });

  it('필드 스키마(품목명/현재고 등)를 헤더로 렌더한다', () => {
    render(<Harness initial={[{}]} />);
    expect(screen.getByText('품목명')).toBeInTheDocument();
    expect(screen.getByText('현재고')).toBeInTheDocument();
  });

  it('행 추가 버튼으로 행이 늘어난다', () => {
    render(<Harness initial={[{}]} />);
    fireEvent.click(screen.getByTitle('행 추가'));
    const nameInputs = document.querySelectorAll('input[data-field="name"]');
    expect(nameInputs.length).toBe(2);
  });

  it('셀 입력이 rows 상태에 반영된다', () => {
    render(<Harness initial={[{}]} />);
    const nameInput = document.querySelector('input[data-field="name"]');
    fireEvent.change(nameInput, { target: { value: '레일' } });
    expect(nameInput.value).toBe('레일');
  });

  it('행 삭제 버튼으로 해당 행이 제거된다', () => {
    render(<Harness initial={[{ name: 'A' }, { name: 'B' }]} />);
    const delButtons = screen.getAllByTitle('행 삭제');
    fireEvent.click(delButtons[0]);
    const nameInputs = document.querySelectorAll('input[data-field="name"]');
    expect(nameInputs.length).toBe(1);
    expect(nameInputs[0].value).toBe('B');
  });

  it('빈 행의 재고구분/세부유형 기본값이 현재 invCategory 를 따른다', () => {
    globalThis.invCategory = '완제품';
    render(<Harness initial={[{}]} />);
    expect(document.querySelector('select[data-field="category"]').value).toBe('완제품');
    expect(document.querySelector('select[data-field="type"]').value).toBe('완제품');
    delete globalThis.invCategory;
  });

  it('탭 구분 텍스트 붙여넣기가 여러 셀로 분해된다', () => {
    render(<Harness initial={[{}]} />);
    const nameInput = document.querySelector('input[data-field="name"]');
    const dt = { getData: () => '레일\t생산부품\t자재' };
    fireEvent.paste(nameInput, { clipboardData: dt });
    expect(document.querySelector('input[data-field="name"]').value).toBe('레일');
    expect(document.querySelector('select[data-field="category"]').value).toBe('생산부품');
  });
});
