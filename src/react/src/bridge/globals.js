// window(전역 스크립트) 상태/함수에 대한 얇은 접근자.
const w = () => globalThis;

export function getInventory() { return w().inventory || []; }
export function getInvCategory() { return w().invCategory || '생산부품'; }
export function getSortState() { return (w().sortState && w().sortState.inventory) || { key: '', asc: true }; }
export function esc(s) { return (w().esc ? w().esc(s) : String(s ?? '')); }

// 전역 함수 호출 (없으면 무시). 반환값 전달.
export function g(name, ...args) {
  const fn = w()[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

// 존재 여부.
export function has(name) { return typeof w()[name] === 'function'; }
