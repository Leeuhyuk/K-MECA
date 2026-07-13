import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionDetailPanel } from '../src/components/SelectionDetailPanel.jsx';

describe('SelectionDetailPanel', () => {
  beforeEach(() => {
    globalThis.__selectionDetailReactState = { open: false, html: '<section>대기 상세</section>' };
    globalThis.bindSelectionDetailStatusMenu = vi.fn();
  });

  it('레거시 상세 내용을 React 패널 상태로 표시하고 갱신한다', async () => {
    const { container } = render(<SelectionDetailPanel />);
    const panel = container.querySelector('.selection-detail-panel-react');
    expect(panel).not.toHaveClass('open');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText('대기 상세')).not.toBeInTheDocument();

    act(() => {
      globalThis.__selectionDetailReactState = { open: true, html: '<section><strong>MT-100</strong><button type="button">수정</button></section>' };
      globalThis.dispatchEvent(new Event('selection-detail-react-change'));
    });

    expect(panel).toHaveClass('open');
    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('MT-100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
    await waitFor(() => expect(globalThis.bindSelectionDetailStatusMenu).toHaveBeenCalledWith(panel));
  });

  it('구조화된 상세 내용을 개요·품목·이력 탭으로 분리한다', () => {
    globalThis.__selectionDetailReactState = {
      open: true,
      html: `
        <div class="selection-detail-resizer"></div>
        <div class="selection-detail-hd"><h3>상세 정보</h3></div>
        <div class="selection-detail-body">
          <div data-selection-detail-static><strong>MT-100</strong></div>
          <div data-selection-detail-tab="overview"><span>기본 정보</span></div>
          <div data-selection-detail-tab="items"><span>선택 품목</span></div>
          <div data-selection-detail-tab="history"><span>최근 이력</span></div>
        </div>
        <div class="selection-detail-actions"><button type="button">닫기</button></div>`
    };

    render(<SelectionDetailPanel />);
    expect(screen.getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('기본 정보')).toBeVisible();
    expect(screen.getByText('선택 품목').closest('[role="tabpanel"]')).toHaveAttribute('hidden');

    fireEvent.click(screen.getByRole('tab', { name: '이력' }));
    expect(screen.getByRole('tab', { name: '이력' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('최근 이력')).toBeVisible();
  });
});