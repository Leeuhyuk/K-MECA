import { describe, it, expect, beforeEach } from 'vitest';
import { loadColumnOrder, saveColumnOrder, moveColumn, defaultOrder } from '../src/bridge/columnOrder.js';

describe('columnOrder — vanilla table-reorder.js 와 공유하는 localStorage 규약', () => {
  beforeEach(() => localStorage.clear());

  it('저장한 순서를 같은 키로 다시 읽는다', () => {
    saveColumnOrder('inventory-table', [0, 2, 1, 3]);
    expect(localStorage.getItem('colorder-inventory-table')).toBe('[0,2,1,3]');
    expect(loadColumnOrder('inventory-table', 4)).toEqual([0, 2, 1, 3]);
  });

  it('저장된 값이 없으면 null 을 준다(호출부가 기본 순서로 폴백)', () => {
    expect(loadColumnOrder('inventory-table', 4)).toBeNull();
  });

  // 선택 체크박스 열이 켜지고 꺼지면 열 개수가 달라진다 → 예전 순서를 쓰면 열이 어긋난다.
  it('열 개수가 달라진 옛 순서는 버린다', () => {
    saveColumnOrder('inventory-table', [0, 2, 1, 3]);
    expect(loadColumnOrder('inventory-table', 5)).toBeNull();
  });

  it('중복·범위 밖·깨진 값은 버린다', () => {
    saveColumnOrder('t', [0, 1, 1, 2]);           // 중복
    expect(loadColumnOrder('t', 4)).toBeNull();
    saveColumnOrder('t', [0, 1, 2, 9]);           // 범위 밖
    expect(loadColumnOrder('t', 4)).toBeNull();
    localStorage.setItem('colorder-t', '{oops');  // JSON 아님
    expect(loadColumnOrder('t', 4)).toBeNull();
  });

  it('moveColumn 은 열을 목표 위치로 옮긴다', () => {
    expect(moveColumn([0, 1, 2, 3], 1, 3)).toEqual([0, 2, 3, 1]);
    expect(moveColumn([0, 1, 2, 3], 3, 0)).toEqual([3, 0, 1, 2]);
    expect(moveColumn([0, 1, 2, 3], 2, 2)).toEqual([0, 1, 2, 3]);
  });

  it('defaultOrder 는 0..n-1 을 준다', () => {
    expect(defaultOrder(3)).toEqual([0, 1, 2]);
  });
});
