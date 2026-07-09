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

// 앱 전역 단일 인스턴스.
export const inventoryStore = createStore();  // 데이터 변경 신호 (state 미사용)
export const modalStore = createStore(null);  // { mode:'add'|'edit', id? } | null
