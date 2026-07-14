import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState } from '../src/components/ui/EmptyState.jsx';
import { IconButton } from '../src/components/ui/IconButton.jsx';
import { QuantityStepper } from '../src/components/ui/QuantityStepper.jsx';
import { StatusPill } from '../src/components/ui/StatusPill.jsx';

describe('React common UI', () => {
  it('아이콘 버튼에 접근 가능한 이름과 툴팁을 제공한다', () => {
    render(<IconButton icon="ti-edit" label="프로파일 수정" />);
    const button = screen.getByRole('button', { name: '프로파일 수정' });
    expect(button).toHaveAttribute('title', '프로파일 수정');
    expect(button.querySelector('.ti-edit')).toBeTruthy();
  });

  it('업무 상태를 일관된 tone으로 표시한다', () => {
    render(<StatusPill status="입고완료" />);
    expect(screen.getByText('입고완료')).toHaveClass('is-success');
  });

  it('수량 스테퍼의 증가와 감소 작업을 분리한다', () => {
    const onDecrease = vi.fn();
    const onIncrease = vi.fn();
    render(<QuantityStepper value={3} unit="EA" label="레일" low onDecrease={onDecrease} onIncrease={onIncrease} />);
    fireEvent.click(screen.getByRole('button', { name: '레일 1 감소' }));
    fireEvent.click(screen.getByRole('button', { name: '레일 1 증가' }));
    expect(onDecrease).toHaveBeenCalledTimes(1);
    expect(onIncrease).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('안전재고 미달')).toBeInTheDocument();
  });

  it('빈 상태의 제목과 후속 설명을 제공한다', () => {
    render(<EmptyState title="등록된 항목이 없습니다." description="신규 등록을 사용해 주세요." />);
    expect(screen.getByRole('status')).toHaveTextContent('등록된 항목이 없습니다.');
    expect(screen.getByRole('status')).toHaveTextContent('신규 등록을 사용해 주세요.');
  });
});