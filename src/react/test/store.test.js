import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/bridge/store.js';

describe('createStore', () => {
  it('구독자에게 emit 시 알림을 보내고 version이 증가한다', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    const v0 = store.getVersion();
    store.emit();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getVersion()).toBe(v0 + 1);
    unsub();
    store.emit();
    expect(listener).toHaveBeenCalledTimes(1); // 구독 해제 후 미호출
  });

  it('modalStore는 open payload를 보관하고 close 시 비운다', () => {
    const store = createStore();
    store.setState({ mode: 'edit', id: 'INV-1' });
    expect(store.getState()).toEqual({ mode: 'edit', id: 'INV-1' });
    store.setState(null);
    expect(store.getState()).toBeNull();
  });
});
