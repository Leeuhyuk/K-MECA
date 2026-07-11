// window(전역 스크립트) 상태/함수에 대한 얇은 접근자.
const w = () => globalThis;

function getInventoryState() {
  const getter = w().getInventoryReactState;
  return typeof getter === 'function' ? getter() : null;
}

export function getInventory() {
  const items = getInventoryState()?.inventory;
  return Array.isArray(items) ? items : (Array.isArray(w().inventory) ? w().inventory : []);
}

function getMaterialsState() {
  const getter = w().getMaterialsReactState;
  return typeof getter === 'function' ? getter() : null;
}

export function getMaterials() {
  const items = getMaterialsState()?.materials;
  return Array.isArray(items) ? items : (Array.isArray(w().materials) ? w().materials : []);
}

export function getClients() {
  const items = getMaterialsState()?.clients;
  return Array.isArray(items) ? items : (Array.isArray(w().clients) ? w().clients : []);
}

export function getProducts() {
  const items = getMaterialsState()?.products;
  return Array.isArray(items) ? items : (Array.isArray(w().products) ? w().products : []);
}

export function getMaterialsSortState() {
  return getMaterialsState()?.sortState || (w().sortState && w().sortState.materials) || { key: '', asc: true };
}
export function getInvCategory() { return getInventoryState()?.invCategory || w().invCategory || '생산부품'; }
export function getSortState() { return getInventoryState()?.sortState || (w().sortState && w().sortState.inventory) || { key: '', asc: true }; }
export function esc(s) { return (w().esc ? w().esc(s) : String(s ?? '')); }

// 전역 함수 호출 (없으면 무시). 반환값 전달.
export function g(name, ...args) {
  const fn = w()[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

// 존재 여부.
export function has(name) { return typeof w()[name] === 'function'; }
