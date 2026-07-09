import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wireGlobals } from '../src/entry.jsx';
import { inventoryStore, modalStore } from '../src/bridge/store.js';

describe('wireGlobals', () => {
  beforeEach(() => { modalStore.setState(null); });

  it('renderInventory 는 renderInventoryKpi 와 inventoryStore.emit 을 모두 호출한다', () => {
    globalThis.renderInventoryKpi = vi.fn();
    globalThis.requireCreateAction = () => true;
    const emitSpy = vi.spyOn(inventoryStore, 'emit');
    wireGlobals();
    globalThis.renderInventory();
    expect(globalThis.renderInventoryKpi).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('openInvAdd/openInvEdit 는 modalStore 를 연다', () => {
    globalThis.requireCreateAction = () => true;
    globalThis.requireRecordPermission = () => true;
    globalThis.inventory = [{ id: 'INV-1', name: 'x' }];
    wireGlobals();
    globalThis.openInvAdd();
    expect(modalStore.getState()).toEqual({ mode: 'add' });
    globalThis.openInvEdit('INV-1');
    expect(modalStore.getState()).toEqual({ mode: 'edit', id: 'INV-1' });
  });
});
