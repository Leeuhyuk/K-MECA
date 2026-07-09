import { g } from '../bridge/globals.js';

const w = () => globalThis;

function toObj(form, id) {
  return {
    id,
    name: String(form.name || '').trim(),
    category: form.category || '생산부품',
    type: form.type,
    unit: form.unit || 'EA',
    qty: parseInt(form.qty, 10) || 0,
    minQty: parseInt(form.minQty, 10) || 0,
    location: form.location,
    note: form.note
  };
}

// 반환: 성공 여부(boolean). 성공 시 renderInventory 는 호출자가 부른다.
export function saveInventorySingle({ editId, form }) {
  const name = String(form.name || '').trim();
  if (!name) { g('showToast', '품목명은 필수입니다.', 'error'); return false; }

  const inventory = w().inventory;
  const id = editId || form.id || g('nextCode', 'INV', inventory);
  const obj = toObj(form, id);

  if (editId) {
    const i = inventory.findIndex((x) => x.id === editId);
    if (i >= 0) {
      const before = g('_safeJsonClone', inventory[i]);
      if (!g('requireRecordPermission', 'edit', before, 'inventory')) return false;
      inventory[i] = g('stampRecordUpdate', Object.assign({}, inventory[i], obj), before, 'inventory');
      g('writeAuditLog', 'inventory', editId, 'update', before, inventory[i], { summary: '재고 품목 수정' });
    }
  } else {
    if (!g('requireCreateAction', 'inventory', '재고 등록')) return false;
    const item = g('stampRecordCreate', obj, 'inventory');
    inventory.unshift(item);
    g('writeAuditLog', 'inventory', item.id, 'create', null, item, { summary: '재고 품목 등록' });
  }
  g('saveStorage', 'inventory', inventory);
  return true;
}

// 반환: 저장한 건수(number). 0 이면 저장 안 함.
export function saveInventoryBulk({ rows }) {
  const clean = (rows || []).filter((r) => String(r.name || '').trim());
  const invalid = clean.find((r) => (parseInt(r.qty, 10) || 0) < 0 || (parseInt(r.minQty, 10) || 0) < 0);
  if (!clean.length) { g('showToast', '등록할 재고 행을 입력해주세요.', 'error'); return 0; }
  if (invalid) { g('showToast', '품목명과 수량을 확인해주세요.', 'error'); return 0; }
  if (!g('requireCreateAction', 'inventory', '재고 등록')) return 0;

  const inventory = w().inventory;
  clean.slice().reverse().forEach((r) => {
    const item = g('stampRecordCreate', toObj(r, g('nextCode', 'INV', inventory)), 'inventory');
    inventory.unshift(item);
    g('writeAuditLog', 'inventory', item.id, 'create', null, item, { summary: '재고 품목 일괄 등록', source: 'bulkAction' });
  });
  g('saveStorage', 'inventory', inventory);
  return clean.length;
}
