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

// 시스템 > 표시 설정의 사용자 지정 라벨을 읽는다.
// React 소유 표는 data-no-managed-table 로 vanilla 재마킹에서 빠지므로,
// applyTableDisplayLabels 가 헤더를 고쳐주지 못한다. 컬럼 라벨은 여기서 직접 반영한다.
// COLUMN_TABLES 는 const 전역이라 window 에 없다 → 전역 함수 tableDisplayLabel 로 조회한다.
export function displayLabel(tableKey, index, fallback) {
  const fn = w().tableDisplayLabel;
  return (typeof fn === 'function' ? fn(tableKey, index, fallback) : fallback) || fallback;
}

// 전역 함수 호출 (없으면 무시). 반환값 전달.
export function g(name, ...args) {
  const fn = w()[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

// 존재 여부.
export function has(name) { return typeof w()[name] === 'function'; }
