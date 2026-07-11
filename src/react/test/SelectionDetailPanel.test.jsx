import { act, render, screen, waitFor } from '@testing-library/react';
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
});