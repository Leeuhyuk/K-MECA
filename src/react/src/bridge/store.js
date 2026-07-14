// 전역 vanilla 상태 변경을 React로 전파하는 최소 pub/sub 스토어.
export function createStore(initialState = null) {
  let version = 0;
  let state = initialState;
  const listeners = new Set();

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function emit() {
    version += 1;
    listeners.forEach((l) => l());
  }
  function getVersion() { return version; }
  function getState() { return state; }
  function setState(next) { state = next; emit(); }

  return { subscribe, emit, getVersion, getState, setState };
}

// 도메인별 단일 인스턴스. 화면이 늘어나도 같은 React 런타임과 저장소 레지스트리를 공유한다.
const domainStores = new Map();

export function getDomainStore(key) {
  if (!domainStores.has(key)) domainStores.set(key, createStore());
  return domainStores.get(key);
}

export const inventoryStore = getDomainStore('inventory');
export const materialsStore = getDomainStore('materials');
export const modalStore = createStore(null);  // { mode:'add'|'edit', id? } | null
export const materialModalStore = createStore(null); // { mode:'add'|'edit'|'clone', id? } | null
