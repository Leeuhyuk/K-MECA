import { describe, it, expect, beforeEach, vi } from 'vitest';
import { g, getInventory, getInvCategory } from '../src/bridge/globals.js';

describe('globals bridge', () => {
  beforeEach(() => {
    globalThis.inventory = [{ id: 'INV-1', name: '레일', category: '생산부품' }];
    globalThis.invCategory = '생산부품';
    globalThis.esc = (s) => String(s ?? '');
  });

  it('getInventory는 전역 inventory 배열을 반환한다', () => {
    expect(getInventory()).toHaveLength(1);
    expect(getInventory()[0].id).toBe('INV-1');
  });

  it('getInvCategory는 전역 invCategory를 반환한다', () => {
    expect(getInvCategory()).toBe('생산부품');
  });

  it('g()는 존재하는 전역 함수를 호출하고, 없으면 안전하게 무시한다', () => {
    globalThis.showToast = vi.fn();
    g('showToast', '완료');
    expect(globalThis.showToast).toHaveBeenCalledWith('완료');
    expect(() => g('nonexistentFn', 1)).not.toThrow();
  });
});
