import '@testing-library/jest-dom';

// Node 26의 실험적 localStorage 전역이 `--localstorage-file` 없이 undefined 를 반환하며
// jsdom 이 제공하는 window.localStorage 를 덮어써, `localStorage.clear()` 등이 깨진다.
// 테스트 환경을 Node 버전과 무관하게 만들기 위해 인메모리 폴리필로 보정한다.
if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map();
  const localStorageMock = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
  };
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => localStorageMock
    });
  } catch {
    globalThis.localStorage = localStorageMock;
  }
}
