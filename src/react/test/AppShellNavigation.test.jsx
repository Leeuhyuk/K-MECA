import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppShellNavigation } from '../src/components/AppShellNavigation.jsx';

function installGlobals(hash = '#/dashboard') {
  history.replaceState({}, '', hash);
  globalThis.go = vi.fn((page) => history.replaceState({}, '', '#/' + page));
  globalThis.goInventory = vi.fn((segment) => history.replaceState({}, '', '#/inventory/' + segment));
  globalThis.pageAllowed = vi.fn(() => true);
  localStorage.clear();
}

describe('AppShellNavigation', () => {
  beforeEach(() => installGlobals());

  it('전역 모듈과 현재 업무별 메뉴를 렌더한다', () => {
    render(<AppShellNavigation />);
    expect(screen.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page');
    const dashboardItems = screen.getAllByRole('button', { name: '종합 현황' });
    expect(dashboardItems.some((item) => item.classList.contains('modern-context-item') && item.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('구매 모듈을 누르면 자재 수급/발주로 이동한다', () => {
    render(<AppShellNavigation />);
    fireEvent.click(screen.getByRole('button', { name: '구매' }));
    expect(globalThis.go).toHaveBeenCalledWith('materials', null);
  });

  it('재고 하위 메뉴는 기존 분류 이동 함수를 사용한다', () => {
    installGlobals('#/inventory/parts');
    render(<AppShellNavigation />);
    fireEvent.click(screen.getByRole('button', { name: '사무비품 재고' }));
    expect(globalThis.goInventory).toHaveBeenCalledWith('office', null);
  });

  it('페이지 권한이 없는 모듈과 하위 메뉴를 숨긴다', () => {
    globalThis.pageAllowed = vi.fn((page) => page !== 'finance');
    render(<AppShellNavigation />);
    expect(screen.queryByRole('button', { name: '재무' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재무 관리' })).not.toBeInTheDocument();
  });

  it('업무 메뉴 접기 상태를 저장하고 다시 펼친다', () => {
    const { container } = render(<AppShellNavigation />);
    // 상단 ☰(togglePrimaryMenu)이 쏘는 mes:toggle-context-nav 이벤트로 접힘/펼침을 제어한다
    act(() => { globalThis.dispatchEvent(new CustomEvent('mes:toggle-context-nav')); });
    expect(localStorage.getItem('mes_modernContextCollapsed')).toBe('true');
    expect(container.querySelector('.modern-context-nav')).toBeNull();
    act(() => { globalThis.dispatchEvent(new CustomEvent('mes:toggle-context-nav')); });
    expect(localStorage.getItem('mes_modernContextCollapsed')).toBe('false');
    expect(container.querySelectorAll('.modern-context-item')).toHaveLength(3);
  });
});
