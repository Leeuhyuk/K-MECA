import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveInventorySingle, saveInventoryBulk } from '../src/actions/inventoryActions.js';

function installGlobals() {
  globalThis.inventory = [];
  globalThis.invCategory = '생산부품';
  globalThis.nextCode = vi.fn(() => 'INV-NEW');
  globalThis.stampRecordCreate = vi.fn((rec) => ({ ...rec, _c: 1 }));
  globalThis.stampRecordUpdate = vi.fn((rec) => ({ ...rec, _u: 1 }));
  globalThis.writeAuditLog = vi.fn();
  globalThis.saveStorage = vi.fn();
  globalThis.showToast = vi.fn();
  globalThis.requireRecordPermission = vi.fn(() => true);
  globalThis.requireCreateAction = vi.fn(() => true);
  globalThis._safeJsonClone = (v) => JSON.parse(JSON.stringify(v));
}

describe('saveInventorySingle', () => {
  beforeEach(installGlobals);

  it('신규 저장 시 stampRecordCreate + unshift + audit + saveStorage 를 호출한다', () => {
    const ok = saveInventorySingle({
      editId: null,
      form: { id: 'INV-NEW', name: '레일', category: '생산부품', type: '자재', unit: 'EA', qty: '5', minQty: '10', location: 'A-1', note: '' }
    });
    expect(ok).toBe(true);
    expect(globalThis.stampRecordCreate).toHaveBeenCalled();
    expect(globalThis.inventory[0].name).toBe('레일');
    expect(globalThis.inventory[0].qty).toBe(5);
    expect(globalThis.writeAuditLog).toHaveBeenCalledWith('inventory', 'INV-NEW', 'create', null, expect.any(Object), expect.any(Object));
    expect(globalThis.saveStorage).toHaveBeenCalledWith('inventory', globalThis.inventory);
  });

  it('품목명이 비면 저장하지 않고 false 를 반환한다', () => {
    const ok = saveInventorySingle({ editId: null, form: { name: '   ' } });
    expect(ok).toBe(false);
    expect(globalThis.showToast).toHaveBeenCalledWith('품목명은 필수입니다.', 'error');
    expect(globalThis.saveStorage).not.toHaveBeenCalled();
  });

  it('수정 저장 시 기존 항목을 stampRecordUpdate 로 갱신한다', () => {
    globalThis.inventory = [{ id: 'INV-1', name: '구', qty: 1, minQty: 0 }];
    const ok = saveInventorySingle({
      editId: 'INV-1',
      form: { id: 'INV-1', name: '신', category: '생산부품', type: '자재', unit: 'EA', qty: '9', minQty: '3', location: '', note: '' }
    });
    expect(ok).toBe(true);
    expect(globalThis.stampRecordUpdate).toHaveBeenCalled();
    expect(globalThis.inventory[0].name).toBe('신');
    expect(globalThis.inventory[0].qty).toBe(9);
    expect(globalThis.writeAuditLog).toHaveBeenCalledWith('inventory', 'INV-1', 'update', expect.any(Object), expect.any(Object), expect.any(Object));
  });
});

describe('saveInventoryBulk', () => {
  beforeEach(installGlobals);

  it('여러 행을 역순 unshift 로 저장하고 건수를 반환한다', () => {
    const n = saveInventoryBulk({
      rows: [
        { name: 'A', category: '생산부품', type: '자재', unit: 'EA', qty: '1', minQty: '0', location: '', note: '' },
        { name: 'B', category: '생산부품', type: '자재', unit: 'EA', qty: '2', minQty: '0', location: '', note: '' }
      ]
    });
    expect(n).toBe(2);
    expect(globalThis.inventory).toHaveLength(2);
    expect(globalThis.saveStorage).toHaveBeenCalledTimes(1);
    expect(globalThis.writeAuditLog).toHaveBeenCalledTimes(2);
  });

  it('행에 type 이 없으면 기본값 "자재" 로 저장한다', () => {
    saveInventoryBulk({ rows: [{ name: 'A', qty: '1', minQty: '0' }] });
    expect(globalThis.inventory[0].type).toBe('자재');
  });

  it('유효한 행이 없으면 0 을 반환하고 저장하지 않는다', () => {
    const n = saveInventoryBulk({ rows: [{ name: '', qty: '0', minQty: '0' }] });
    expect(n).toBe(0);
    expect(globalThis.saveStorage).not.toHaveBeenCalled();
  });
});
