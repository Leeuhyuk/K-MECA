import { describe, it, expect, beforeEach, vi } from 'vitest';
import { g, getInventory, getInvCategory, getSortState, displayLabel } from '../src/bridge/globals.js';

describe('globals bridge', () => {
  beforeEach(() => {
    globalThis.inventory = [{ id: 'INV-1', name: '레일', category: '생산부품' }];
    globalThis.invCategory = '생산부품';
    globalThis.getInventoryReactState = () => ({
      inventory: globalThis.inventory,
      invCategory: globalThis.invCategory,
      sortState: { key: '', asc: true }
    });
    globalThis.esc = (s) => String(s ?? '');
  });

  it('getInventory는 전역 inventory 배열을 반환한다', () => {
    expect(getInventory()).toHaveLength(1);
    expect(getInventory()[0].id).toBe('INV-1');
  });

  it('getInvCategory는 전역 invCategory를 반환한다', () => {
    expect(getInvCategory()).toBe('생산부품');
  });

  it('classic script 상태 접근자의 최신 값을 우선 사용한다', () => {
    globalThis.getInventoryReactState = () => ({
      inventory: [{ id: 'INV-LIVE' }],
      invCategory: '완제품',
      sortState: { key: 'qty', asc: false }
    });
    expect(getInventory()[0].id).toBe('INV-LIVE');
    expect(getInvCategory()).toBe('완제품');
    expect(getSortState()).toEqual({ key: 'qty', asc: false });
  });

  it('g()는 존재하는 전역 함수를 호출하고, 없으면 안전하게 무시한다', () => {
    globalThis.showToast = vi.fn();
    g('showToast', '완료');
    expect(globalThis.showToast).toHaveBeenCalledWith('완료');
    expect(() => g('nonexistentFn', 1)).not.toThrow();
  });

  // React 소유 표는 data-no-managed-table 로 vanilla 재마킹에서 빠져
  // applyTableDisplayLabels 가 헤더를 못 고친다 → 라벨은 렌더 시 직접 조회해야 한다.
  describe('displayLabel', () => {
    it('표시 설정의 사용자 지정 라벨을 반환한다', () => {
      globalThis.tableDisplayLabel = (key, index, fallback) =>
        (key === 'inventory' && index === 1 ? '제품이름' : fallback);
      expect(displayLabel('inventory', 1, '품목명')).toBe('제품이름');
    });

    it('지정 라벨이 없으면 기본 라벨로 되돌아간다', () => {
      globalThis.tableDisplayLabel = (key, index, fallback) => fallback;
      expect(displayLabel('inventory', 2, '분류')).toBe('분류');
    });

    it('전역 조회 함수가 없어도 기본 라벨을 쓴다(부팅 순서 무관)', () => {
      delete globalThis.tableDisplayLabel;
      expect(displayLabel('materials', 1, '구분고객사')).toBe('구분고객사');
    });
  });
});
