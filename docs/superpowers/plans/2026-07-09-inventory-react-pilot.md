# 재고 모듈 React 파일럿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재고(inventory) 테이블 본체와 등록/수정 모달(단건+일괄입력)을 React 18로 전환하되, 기존 vanilla JS 앱·RBAC 게이팅·전역 상태와 무손상으로 공존시킨다.

**Architecture:** React가 소유하는 것은 `#inventory-table` 안의 테이블과 `#inv-modal` 자리의 모달뿐. 전역 배열 `inventory` 변경은 pub/sub 스토어 `inventoryStore`로 React에 전파한다. `window.renderInventory()`를 `renderInventoryKpi()`(vanilla) + `inventoryStore.emit()`(React)로 오버라이드하여 외부 호출자 계약을 유지한다. 정렬·수량조정·삭제는 기존 vanilla 함수(`toggleSort`/`adjustStock`/`deleteInventory`)를 그대로 재사용하고 React는 `window.*`만 호출한다. 새로 포팅하는 로직은 모달 저장(단건/일괄)뿐이다.

**Tech Stack:** React 18, Vite(라이브러리 모드, IIFE 번들), Vitest + @testing-library/react, 기존 `build.py`(문자열 include).

---

## 사전 지식: 기존 코드 계약

React 코드가 호출/재현해야 하는 기존 전역들(모두 `window.*`로 접근 가능, 브라우저 전역 스크립트):

- 상태: `inventory`(배열, `data-storage.js:886`), `inventoryLedger`, `invCategory`(현재 분류), `editInvId`, `sortState.inventory`(`{key, asc}`)
- DOM 헬퍼: `inp(id)`→element, `v(id)`→value, `sv(id,val)`, `esc(s)`, `empty(msg)`→빈상태 HTML
- 데이터: `saveStorage(key,data)`, `loadStorage(key,def)`, `_safeJsonClone(v)`, `nextCode('INV',inventory)`, `stampRecordCreate(rec,'inventory')`, `stampRecordUpdate(rec,before,'inventory')`, `writeAuditLog('inventory',id,action,before,after,opts)`, `logInventoryMove(id,type,qty,reason,refId,opts)`, `pushToTrash('inventory',item)`
- 권한: `canViewRecord(rec,'inventory')`, `requireRecordPermission(action,rec,'inventory')`, `requireCreateAction('inventory',label)`, `checkAdminAction()`
- UI: `showToast(msg,type)`, `toggleSort('inventory',key)`, `sortIcon('inventory',key)`, `kpiFilter(...)`, `visibleRecords(list,'inventory')`
- 그대로 재사용하는 vanilla 액션: `adjustStock(id,delta)`, `deleteInventory(id)` — 둘 다 내부에서 `renderInventory()`를 호출한다.

RBAC 게이팅 계약(`rbac.js`): 재고 컬럼 순서 `['재고코드','품목명','분류','현재고','안전재고','보관위치','참고','관리']`(인덱스 0~7). 각 셀에 `data-table-display-col="inventory-{idx}"` 필요. 삭제 버튼은 `.del-btn`, 수정 버튼은 `.edit-btn` 클래스. 등록 버튼(`[onclick^="openInvAdd"]`)은 vanilla 유지라 무관.

재고 필드 스키마: `{ id, name, category('완제품'|'생산부품'|'사무비품'), type, unit, qty:number, minQty:number, location, note }`.

---

## File Structure

```
src/react/
  package.json          # deps: react, react-dom / dev: vite, @vitejs/plugin-react, vitest, jsdom, @testing-library/react, @testing-library/jest-dom
  vite.config.js        # build.lib → ../js-dist/inventory-react.js (IIFE)
  vitest.config.js      # jsdom 환경, setup 파일
  test/setup.js         # jest-dom matchers + 전역 목 헬퍼 주입
  src/
    bridge/store.js     # inventoryStore, modalStore (useSyncExternalStore 호환)
    bridge/globals.js   # window.* 전역 얇은 접근자
    actions/inventoryActions.js  # saveInventorySingle, saveInventoryBulk
    components/SortableTh.jsx
    components/InventoryTable.jsx
    components/BulkGrid.jsx
    components/InventoryModal.jsx
    hooks/useBulkGrid.js
    entry.jsx           # 루트 마운트 + window.* 재바인딩
src/js-dist/inventory-react.js   # Vite 산출물 (git 커밋)
src/js/inventory.js     # 수정: renderInventoryKpi() 추출
src/index.template.html # 수정: 번들 include 마커 + inv-modal 자리 처리
build.py                # 변경 없음 (마커 자동 처리) — 단 js-dist 경로 include 확인
```

---

## Task 0: Vite 스캐폴드 + 빌드 파이프라인 증명

React 로직을 건드리기 전에 "Vite 번들 → build.py include → index.html에서 React가 마운트된다"를 최소 예제로 먼저 증명한다.

**Files:**
- Create: `src/react/package.json`
- Create: `src/react/vite.config.js`
- Create: `src/react/src/entry.jsx` (임시 hello mount)
- Modify: `src/index.template.html` (include 마커 1줄)

- [ ] **Step 1: package.json 작성**

Create `src/react/package.json`:

```json
{
  "name": "inventory-react",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.1",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: vite.config.js 작성 (IIFE 라이브러리 번들, React 인라인 포함)**

Create `src/react/vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/entry.jsx'),
      name: 'InventoryReact',
      formats: ['iife'],
      fileName: () => 'inventory-react.js'
    },
    outDir: resolve(__dirname, '../js-dist'),
    emptyOutDir: false,
    minify: 'esbuild'
    // React/ReactDOM 은 external 하지 않는다 → 번들에 인라인 포함 (자가완결 index.html)
  }
});
```

- [ ] **Step 3: 임시 entry.jsx 작성**

Create `src/react/src/entry.jsx`:

```jsx
import { createRoot } from 'react-dom/client';

function boot() {
  const host = document.getElementById('inventory-table');
  if (host) {
    host.innerHTML = '';
    createRoot(host).render(<div data-react-probe="ok">React mounted</div>);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
```

- [ ] **Step 4: 의존성 설치 + 빌드**

Run:
```bash
cd src/react && npm install && npm run build
```
Expected: `src/js-dist/inventory-react.js` 생성됨. (`ls -la ../js-dist/inventory-react.js` 로 확인)

- [ ] **Step 5: build.py include 마커 추가**

Modify `src/index.template.html`: 마지막 `<!--#include js/...-->` 마커 그룹의 끝(예: `trash.js` include 다음 줄)에 추가:

```
<!--#include js-dist/inventory-react.js-->
```

- [ ] **Step 6: 전체 빌드 후 마운트 증명**

Run:
```bash
cd ../.. && python build.py && grep -c "data-react-probe" index.html
```
Expected: `index.html` 안에 번들 문자열 포함(grep 결과 ≥1). 브라우저로 index.html 열면 재고 페이지 테이블 자리에 "React mounted" 표시.

- [ ] **Step 7: .gitignore 확인 및 커밋**

`src/react/node_modules`가 무시되는지 확인(없으면 `src/react/.gitignore`에 `node_modules/` 추가). 산출물 `src/js-dist/inventory-react.js`는 **커밋 대상**.

```bash
echo "node_modules/" > src/react/.gitignore
git add src/react/package.json src/react/vite.config.js src/react/src/entry.jsx src/react/.gitignore src/js-dist/inventory-react.js src/index.template.html
git commit -m "chore: React 파일럿 Vite 스캐폴드 + 빌드 파이프라인 연결"
```

---

## Task 1: 상태 브리지 스토어

**Files:**
- Create: `src/react/src/bridge/store.js`
- Create: `src/react/vitest.config.js`, `src/react/test/setup.js`
- Test: `src/react/test/store.test.js`

- [ ] **Step 1: vitest 설정 + setup**

Create `src/react/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js']
  }
});
```

Create `src/react/test/setup.js`:

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 2: 실패 테스트 작성**

Create `src/react/test/store.test.js`:

```js
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
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/store.test.js`
Expected: FAIL — `createStore` 미정의.

- [ ] **Step 4: store.js 구현**

Create `src/react/src/bridge/store.js`:

```js
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/store.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: 커밋**

```bash
cd ../.. && git add src/react/src/bridge/store.js src/react/vitest.config.js src/react/test/setup.js src/react/test/store.test.js src/react/package.json
git commit -m "feat: React 브리지 스토어(inventoryStore, modalStore)"
```

---

## Task 2: 전역 접근자 브리지

React 코드가 `window.*` 전역을 안전하게 참조하는 얇은 계층. 테스트에서 목 주입이 쉬워진다.

**Files:**
- Create: `src/react/src/bridge/globals.js`
- Test: `src/react/test/globals.test.js`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/react/test/globals.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { g, getInventory, getInvCategory } from '../src/bridge/globals.js';

describe('globals bridge', () => {
  beforeEach(() => {
    globalThis.inventory = [{ id: 'INV-1', name: '레일', category: '생산부품' }];
    globalThis.invCategory = '생산부품';
    globalThis.esc = (s) => String(s ?? '');
  });

  it('getInventory는 전역 inventory 배열을 반환한다', () => {
    expect(getInventory()).toHaveLength(1);
    expect(getInventory()[0].id).toBe('INV-1');
  });

  it('getInvCategory는 전역 invCategory를 반환한다', () => {
    expect(getInvCategory()).toBe('생산부품');
  });

  it('g()는 존재하는 전역 함수를 호출하고, 없으면 안전하게 무시한다', () => {
    globalThis.showToast = vi.fn();
    g('showToast', '완료');
    expect(globalThis.showToast).toHaveBeenCalledWith('완료');
    expect(() => g('nonexistentFn', 1)).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/globals.test.js`
Expected: FAIL — 모듈 미존재.

- [ ] **Step 3: globals.js 구현**

Create `src/react/src/bridge/globals.js`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/globals.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
cd ../.. && git add src/react/src/bridge/globals.js src/react/test/globals.test.js
git commit -m "feat: window 전역 접근자 브리지"
```

---

## Task 3: 모달 저장 액션 (단건/일괄)

`saveInventoryForm`의 저장 로직을 React가 호출 가능한 순수 함수로 이관. 기존 감사/권한/스토리지 전역을 그대로 재사용한다. (수정/삭제/수량조정은 vanilla 재사용이므로 포팅 불필요.)

**Files:**
- Create: `src/react/src/actions/inventoryActions.js`
- Test: `src/react/test/inventoryActions.test.js`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/react/test/inventoryActions.test.js`:

```js
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

  it('유효한 행이 없으면 0 을 반환하고 저장하지 않는다', () => {
    const n = saveInventoryBulk({ rows: [{ name: '', qty: '0', minQty: '0' }] });
    expect(n).toBe(0);
    expect(globalThis.saveStorage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/inventoryActions.test.js`
Expected: FAIL — 모듈 미존재.

- [ ] **Step 3: inventoryActions.js 구현**

Create `src/react/src/actions/inventoryActions.js`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/inventoryActions.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
cd ../.. && git add src/react/src/actions/inventoryActions.js src/react/test/inventoryActions.test.js
git commit -m "feat: 재고 모달 저장 액션(단건/일괄) 이관"
```

---

## Task 4: SortableTh + InventoryTable

**Files:**
- Create: `src/react/src/components/SortableTh.jsx`
- Create: `src/react/src/components/InventoryTable.jsx`
- Test: `src/react/test/InventoryTable.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/react/test/InventoryTable.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InventoryTable } from '../src/components/InventoryTable.jsx';
import { inventoryStore } from '../src/bridge/store.js';

function installGlobals(rows) {
  globalThis.inventory = rows;
  globalThis.invCategory = '생산부품';
  globalThis.sortState = { inventory: { key: '', asc: true } };
  globalThis.esc = (s) => String(s ?? '');
  globalThis.empty = (m) => `<div class="empty">${m}</div>`;
  globalThis.canViewRecord = () => true;
  globalThis.sortIcon = () => '';
  globalThis.toggleSort = vi.fn();
  globalThis.adjustStock = vi.fn();
  globalThis.openInvEdit = vi.fn();
  globalThis.deleteInventory = vi.fn();
  globalThis.v = (id) => (globalThis.__filters?.[id] ?? '');
}

const sample = [
  { id: 'INV-1', name: '레일', type: '자재', category: '생산부품', qty: 3, minQty: 5, unit: 'EA', location: 'A-1', note: '메모' },
  { id: 'INV-2', name: '베어링', type: '반제품', category: '생산부품', qty: 20, minQty: 10, unit: 'EA', location: 'B-2', note: '' }
];

describe('InventoryTable', () => {
  beforeEach(() => { globalThis.__filters = {}; installGlobals(sample); });

  it('현재 분류의 재고 행을 렌더한다', () => {
    render(<InventoryTable />);
    expect(screen.getByText('레일')).toBeInTheDocument();
    expect(screen.getByText('베어링')).toBeInTheDocument();
  });

  it('각 데이터 셀에 data-table-display-col 인덱스(0~7)를 부여한다', () => {
    const { container } = render(<InventoryTable />);
    const firstRow = container.querySelector('tbody tr');
    const cols = within(firstRow).getAllByText((_, el) => el?.hasAttribute?.('data-table-display-col'));
    const idxs = Array.from(firstRow.querySelectorAll('[data-table-display-col]'))
      .map((el) => el.getAttribute('data-table-display-col'));
    expect(idxs).toEqual([
      'inventory-0','inventory-1','inventory-2','inventory-3',
      'inventory-4','inventory-5','inventory-6','inventory-7'
    ]);
  });

  it('안전재고 미달 행에 경고 아이콘을 표시한다 (qty<minQty)', () => {
    const { container } = render(<InventoryTable />);
    // INV-1: qty 3 < minQty 5 → 경고
    expect(container.querySelector('[data-low="true"]')).toBeTruthy();
  });

  it('수정 버튼은 .edit-btn, 삭제 버튼은 .del-btn 클래스를 가진다', () => {
    const { container } = render(<InventoryTable />);
    expect(container.querySelector('.edit-btn')).toBeTruthy();
    expect(container.querySelector('.del-btn')).toBeTruthy();
  });

  it('+ 버튼 클릭 시 window.adjustStock(id, 1) 을 호출한다', async () => {
    const { container } = render(<InventoryTable />);
    const incBtn = container.querySelector('[data-act="inc"]');
    incBtn.click();
    expect(globalThis.adjustStock).toHaveBeenCalledWith('INV-1', 1);
  });

  it('빈 목록이면 empty 안내를 렌더한다', () => {
    installGlobals([]);
    render(<InventoryTable />);
    expect(screen.getByText(/등록된 재고가 없습니다/)).toBeInTheDocument();
  });

  it('selectable=false(기본)이면 선택 컬럼을 렌더하지 않는다', () => {
    const { container } = render(<InventoryTable />);
    expect(container.querySelector('[data-col="select"]')).toBeFalsy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/InventoryTable.test.jsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: SortableTh 구현**

Create `src/react/src/components/SortableTh.jsx`:

```jsx
import { g, esc } from '../bridge/globals.js';

// 기존 vanilla 정렬 계약 재사용: 클릭 → window.toggleSort('inventory', key) → renderInventory() → emit.
export function SortableTh({ label, sortKey }) {
  const iconHtml = g('sortIcon', 'inventory', sortKey) || '';
  return (
    <th
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => g('toggleSort', 'inventory', sortKey)}
    >
      <span dangerouslySetInnerHTML={{ __html: esc(label) + ' ' + iconHtml }} />
    </th>
  );
}
```

- [ ] **Step 4: InventoryTable 구현**

Create `src/react/src/components/InventoryTable.jsx`:

```jsx
import { useSyncExternalStore } from 'react';
import { inventoryStore } from '../bridge/store.js';
import { getInventory, getInvCategory, getSortState, g } from '../bridge/globals.js';
import { SortableTh } from './SortableTh.jsx';

const TYPE_BORDER = { 자재: 'bd-info', 완제품: 'bd-ok', 반제품: 'bd-warn', 소모품: 'bd-neu', 비품: 'bd-neu' };
const COLS = [
  { key: 'id', label: '재고코드' },
  { key: 'name', label: '품목명' },
  { key: 'type', label: '분류' },
  { key: 'qty', label: '현재고' },
  { key: 'minQty', label: '안전재고' },
  { key: 'location', label: '보관위치' },
  { key: 'note', label: '참고' }
];

function useInventorySnapshot() {
  useSyncExternalStore(inventoryStore.subscribe, inventoryStore.getVersion, inventoryStore.getVersion);
}

function filterRows() {
  const cat = getInvCategory();
  let rows = getInventory().filter((i) => g('canViewRecord', i, 'inventory') !== false && (i.category || '생산부품') === cat);
  const ft = g('v', 'inv-filter-type') || '';
  const st = g('v', 'inv-filter-status') || '';
  const q = (g('v', 'inv-q') || '').toLowerCase();
  rows = rows.filter((i) => {
    if (ft && i.type !== ft) return false;
    if (st === 'low' && !(i.qty < (i.minQty || 0))) return false;
    if (st === 'normal' && (i.qty < (i.minQty || 0))) return false;
    if (q && !String(i.id).toLowerCase().includes(q) && !String(i.name || '').toLowerCase().includes(q) && !String(i.location || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const s = getSortState();
  if (s.key) {
    const asc = s.asc ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const va = a[s.key] == null ? '' : a[s.key];
      const vb = b[s.key] == null ? '' : b[s.key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }
  return rows;
}

// selectable, onToggleRow, selectedIds: 후속 행 선택 복구용 seam (기본 미사용).
export function InventoryTable({ selectable = false, selectedIds = null, onToggleRow = null }) {
  useInventorySnapshot();
  const rows = filterRows();
  const cat = getInvCategory();

  if (!rows.length) {
    return <div className="empty-wrap">{`${cat} 분류에 등록된 재고가 없습니다. [신규 재고 품목 등록] 버튼으로 추가하세요.`}</div>;
  }

  return (
    <table className="inventory-compact-table" style={{ minWidth: 860 }}>
      <thead>
        <tr>
          {selectable && <th data-col="select" />}
          {COLS.map((c) => <SortableTh key={c.key} label={c.label} sortKey={c.key} />)}
          <th>관리</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((i) => {
          const low = i.qty < (i.minQty || 0);
          return (
            <tr key={i.id} data-low={low ? 'true' : undefined}>
              {selectable && (
                <td data-col="select">
                  <input
                    type="checkbox"
                    checked={!!selectedIds?.has?.(i.id)}
                    onChange={() => onToggleRow?.(i.id)}
                  />
                </td>
              )}
              <td data-table-display-col="inventory-0" style={{ fontSize: 11, color: 'var(--tx-t)' }}>{i.id}</td>
              <td data-table-display-col="inventory-1" style={{ fontWeight: 700 }}>{i.name}</td>
              <td data-table-display-col="inventory-2">
                <span className={'bd ' + (TYPE_BORDER[i.type] || 'bd-neu')}>{i.type}</span>
              </td>
              <td data-table-display-col="inventory-3" style={{ fontWeight: 700, color: low ? 'var(--tx-d)' : undefined }}>
                <button className="btn btn-sm" data-act="dec" style={{ padding: '0 7px' }} onClick={() => g('adjustStock', i.id, -1)}>−</button>{' '}
                {i.qty} {i.unit}{' '}
                <button className="btn btn-sm" data-act="inc" style={{ padding: '0 7px' }} onClick={() => g('adjustStock', i.id, 1)}>+</button>
                {low && <i className="ti ti-alert-triangle" style={{ color: 'var(--tx-d)' }} title="안전재고 미달" />}
              </td>
              <td data-table-display-col="inventory-4">{i.minQty || 0}</td>
              <td data-table-display-col="inventory-5" style={{ fontSize: 11 }}>{i.location || '—'}</td>
              <td data-table-display-col="inventory-6" style={{ fontSize: 11, color: 'var(--tx-t)' }}>{i.note || '—'}</td>
              <td data-table-display-col="inventory-7" style={{ whiteSpace: 'nowrap' }}>
                <button className="edit-btn" onClick={() => g('openInvEdit', i.id)}><i className="ti ti-edit" />수정</button>
                <button className="del-btn" style={{ marginLeft: 4 }} onClick={() => g('deleteInventory', i.id)}><i className="ti ti-trash" /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/InventoryTable.test.jsx`
Expected: PASS (7 tests). 실패 시 목 전역 이름을 점검.

- [ ] **Step 6: 커밋**

```bash
cd ../.. && git add src/react/src/components/SortableTh.jsx src/react/src/components/InventoryTable.jsx src/react/test/InventoryTable.test.jsx
git commit -m "feat: InventoryTable + SortableTh (게이팅 계약·행선택 seam 포함)"
```

---

## Task 5: useBulkGrid + BulkGrid

일괄입력 그리드를 React로 재구현. 필드 스키마는 `inventory.js`의 `registerBulkEntryTable('inv', ...)`와 동일하게 컴포넌트에 정의한다.

**Files:**
- Create: `src/react/src/hooks/useBulkGrid.js`
- Create: `src/react/src/components/BulkGrid.jsx`
- Test: `src/react/test/BulkGrid.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/react/test/BulkGrid.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { BulkGrid, INV_BULK_FIELDS } from '../src/components/BulkGrid.jsx';

function Harness({ initial }) {
  const [rows, setRows] = useState(initial);
  return <BulkGrid fields={INV_BULK_FIELDS} rows={rows} onChange={setRows} />;
}

describe('BulkGrid', () => {
  beforeEach(() => { globalThis.esc = (s) => String(s ?? ''); });

  it('필드 스키마(품목명/현재고 등)를 헤더로 렌더한다', () => {
    render(<Harness initial={[{}]} />);
    expect(screen.getByText('품목명')).toBeInTheDocument();
    expect(screen.getByText('현재고')).toBeInTheDocument();
  });

  it('행 추가 버튼으로 행이 늘어난다', () => {
    render(<Harness initial={[{}]} />);
    fireEvent.click(screen.getByTitle('행 추가'));
    // name 입력칸이 2개
    const nameInputs = document.querySelectorAll('input[data-field="name"]');
    expect(nameInputs.length).toBe(2);
  });

  it('셀 입력이 rows 상태에 반영된다', () => {
    render(<Harness initial={[{}]} />);
    const nameInput = document.querySelector('input[data-field="name"]');
    fireEvent.change(nameInput, { target: { value: '레일' } });
    expect(nameInput.value).toBe('레일');
  });

  it('행 삭제 버튼으로 해당 행이 제거된다', () => {
    render(<Harness initial={[{ name: 'A' }, { name: 'B' }]} />);
    const delButtons = screen.getAllByTitle('행 삭제');
    fireEvent.click(delButtons[0]);
    const nameInputs = document.querySelectorAll('input[data-field="name"]');
    expect(nameInputs.length).toBe(1);
    expect(nameInputs[0].value).toBe('B');
  });

  it('탭 구분 텍스트 붙여넣기가 여러 셀로 분해된다', () => {
    render(<Harness initial={[{}]} />);
    const nameInput = document.querySelector('input[data-field="name"]');
    const dt = { getData: () => '레일\t생산부품\t자재' };
    fireEvent.paste(nameInput, { clipboardData: dt });
    expect(document.querySelector('input[data-field="name"]').value).toBe('레일');
    expect(document.querySelector('select[data-field="category"]').value).toBe('생산부품');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/BulkGrid.test.jsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: useBulkGrid 훅 구현**

Create `src/react/src/hooks/useBulkGrid.js`:

```js
// 일괄입력 그리드 상태 변형 헬퍼(순수 함수). 컴포넌트는 rows/onChange 로 제어된다.
export function setCell(rows, rowIndex, field, value) {
  return rows.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r));
}

export function addRow(rows, defaults = {}) {
  return rows.concat([{ ...defaults }]);
}

export function removeRow(rows, rowIndex) {
  if (rows.length <= 1) return [{}];
  return rows.filter((_, i) => i !== rowIndex);
}

// 붙여넣기: 시작 셀(rowIndex, colIndex) 기준으로 탭/개행 텍스트를 격자에 채운다.
export function applyPaste(rows, fields, startRow, startCol, text) {
  const matrix = text.replace(/\r/g, '').split('\n').filter((l) => l.length).map((l) => l.split('\t'));
  let next = rows.map((r) => ({ ...r }));
  matrix.forEach((cells, r) => {
    const ri = startRow + r;
    while (next.length <= ri) next.push({});
    cells.forEach((cell, c) => {
      const field = fields[startCol + c];
      if (field) next[ri][field.name] = String(cell || '').trim();
    });
  });
  return next;
}
```

- [ ] **Step 4: BulkGrid 컴포넌트 구현**

Create `src/react/src/components/BulkGrid.jsx`:

```jsx
import { setCell, addRow, removeRow, applyPaste } from '../hooks/useBulkGrid.js';

// inventory.js 의 registerBulkEntryTable('inv', ...) 필드 스키마와 동일.
export const INV_BULK_FIELDS = [
  { name: 'name', label: '품목명', type: 'text', placeholder: '품목명', required: true },
  { name: 'category', label: '재고 구분', type: 'select', options: ['완제품', '생산부품', '사무비품'], default: '생산부품' },
  { name: 'type', label: '세부 유형', type: 'select', options: ['자재', '반제품', '완제품', '비품', '소모품', '기타'], default: '자재' },
  { name: 'qty', label: '현재고', type: 'number', min: 0, step: 1, default: '0', required: true },
  { name: 'unit', label: '단위', type: 'select', options: ['EA', '대', 'SET', 'kg', 'M', 'L', 'BOX', 'ton'], default: 'EA' },
  { name: 'minQty', label: '안전재고', type: 'number', min: 0, step: 1, default: '10' },
  { name: 'location', label: '보관 위치', type: 'text', placeholder: '예: A-4 선반' },
  { name: 'note', label: '참고', type: 'text', placeholder: '비고' }
];

function cellValue(row, field) {
  const v = row[field.name];
  return v == null ? (typeof field.default === 'function' ? field.default() : (field.default ?? '')) : v;
}

export function BulkGrid({ fields, rows, onChange }) {
  const handlePaste = (e, rowIndex, colIndex) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    onChange(applyPaste(rows, fields, rowIndex, colIndex, text));
  };

  return (
    <div className="batch-entry-grid">
      <div className="batch-entry-label"><i className="ti ti-table" />재고 품목 일괄 입력</div>
      <table className="batch-entry-sized-table">
        <thead>
          <tr>
            {fields.map((f) => <th key={f.name}>{f.label}{f.required ? ' *' : ''}</th>)}
            <th />
          </tr>
        </thead>
        <tbody data-bulk-key="inv-react">
          {rows.map((row, ri) => (
            <tr key={ri}>
              {fields.map((f, ci) => (
                <td key={f.name}>
                  {f.type === 'select' ? (
                    <select
                      data-field={f.name}
                      value={String(cellValue(row, f))}
                      onChange={(e) => onChange(setCell(rows, ri, f.name, e.target.value))}
                    >
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      data-field={f.name}
                      placeholder={f.placeholder || ''}
                      min={f.min}
                      step={f.step}
                      value={String(cellValue(row, f))}
                      onChange={(e) => onChange(setCell(rows, ri, f.name, e.target.value))}
                      onPaste={(e) => handlePaste(e, ri, ci)}
                    />
                  )}
                </td>
              ))}
              <td>
                <button type="button" className="doc-add-row" title="행 삭제" onClick={() => onChange(removeRow(rows, ri))}>
                  <i className="ti ti-trash" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="doc-add-row" title="행 추가" onClick={() => onChange(addRow(rows))}>
        <i className="ti ti-plus" /> 행 추가
      </button>
    </div>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/BulkGrid.test.jsx`
Expected: PASS (5 tests).

- [ ] **Step 6: 커밋**

```bash
cd ../.. && git add src/react/src/hooks/useBulkGrid.js src/react/src/components/BulkGrid.jsx src/react/test/BulkGrid.test.jsx
git commit -m "feat: BulkGrid 일괄입력 그리드(붙여넣기·행 추가/삭제) React 재구현"
```

---

## Task 6: InventoryModal (단건/일괄 탭 + 저장)

**Files:**
- Create: `src/react/src/components/InventoryModal.jsx`
- Test: `src/react/test/InventoryModal.test.jsx`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/react/test/InventoryModal.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryModal } from '../src/components/InventoryModal.jsx';
import { modalStore, inventoryStore } from '../src/bridge/store.js';

function installGlobals() {
  globalThis.inventory = [{ id: 'INV-1', name: '레일', category: '생산부품', type: '자재', unit: 'EA', qty: 3, minQty: 5, location: 'A-1', note: '' }];
  globalThis.invCategory = '생산부품';
  globalThis.nextCode = () => 'INV-NEW';
  globalThis.stampRecordCreate = (r) => r;
  globalThis.stampRecordUpdate = (r) => r;
  globalThis.writeAuditLog = vi.fn();
  globalThis.saveStorage = vi.fn();
  globalThis.showToast = vi.fn();
  globalThis.requireRecordPermission = () => true;
  globalThis.requireCreateAction = () => true;
  globalThis._safeJsonClone = (v) => JSON.parse(JSON.stringify(v));
  globalThis.esc = (s) => String(s ?? '');
  globalThis.renderInventory = vi.fn();
}

describe('InventoryModal', () => {
  beforeEach(() => { installGlobals(); modalStore.setState(null); });

  it('modalStore 가 null 이면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<InventoryModal />);
    expect(container.querySelector('.dlg')).toBeFalsy();
  });

  it('add 모드에서 제목 "재고 품목 등록" 과 단건 폼을 연다', () => {
    render(<InventoryModal />);
    modalStore.setState({ mode: 'add' });
    expect(screen.getByText(/재고 품목 등록/)).toBeInTheDocument();
    expect(screen.getByLabelText(/품목명/)).toBeInTheDocument();
  });

  it('edit 모드에서 기존 값을 채우고 저장 시 renderInventory 를 호출한다', () => {
    render(<InventoryModal />);
    modalStore.setState({ mode: 'edit', id: 'INV-1' });
    const nameInput = screen.getByLabelText(/품목명/);
    expect(nameInput.value).toBe('레일');
    fireEvent.change(nameInput, { target: { value: '레일2' } });
    fireEvent.click(screen.getByRole('button', { name: /수정|저장/ }));
    expect(globalThis.inventory[0].name).toBe('레일2');
    expect(globalThis.renderInventory).toHaveBeenCalled();
    expect(modalStore.getState()).toBeNull(); // 저장 후 닫힘
  });

  it('취소 버튼은 저장 없이 모달을 닫는다', () => {
    render(<InventoryModal />);
    modalStore.setState({ mode: 'add' });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(modalStore.getState()).toBeNull();
    expect(globalThis.saveStorage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/InventoryModal.test.jsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: InventoryModal 구현**

Create `src/react/src/components/InventoryModal.jsx`:

```jsx
import { useSyncExternalStore, useState, useEffect } from 'react';
import { modalStore } from '../bridge/store.js';
import { getInventory, getInvCategory, g } from '../bridge/globals.js';
import { saveInventorySingle, saveInventoryBulk } from '../actions/inventoryActions.js';
import { BulkGrid, INV_BULK_FIELDS } from './BulkGrid.jsx';

const CATEGORIES = ['완제품', '생산부품', '사무비품'];
const TYPES = ['자재', '반제품', '완제품', '비품', '소모품', '기타'];
const UNITS = ['EA', '대', 'SET', 'kg', 'M', 'L', 'BOX', 'ton'];

function defaultType(cat) {
  return cat === '완제품' ? '완제품' : cat === '사무비품' ? '소모품' : '자재';
}
function blankForm(cat) {
  return { id: g('nextCode', 'INV', getInventory()), name: '', category: cat, type: defaultType(cat), unit: 'EA', qty: '0', minQty: '10', location: '', note: '' };
}
function formFromItem(i) {
  return { id: i.id, name: i.name, category: i.category || '생산부품', type: i.type, unit: i.unit || 'EA', qty: String(i.qty ?? 0), minQty: String(i.minQty ?? 0), location: i.location || '', note: i.note || '' };
}

export function InventoryModal() {
  const modal = useSyncExternalStore(modalStore.subscribe, modalStore.getState, modalStore.getState);
  const isEdit = modal?.mode === 'edit';
  const [form, setForm] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState([{}]);

  useEffect(() => {
    if (!modal) return;
    const cat = getInvCategory();
    if (modal.mode === 'edit') {
      const item = getInventory().find((x) => x.id === modal.id);
      setForm(item ? formFromItem(item) : blankForm(cat));
      setBulk(false);
    } else {
      setForm(blankForm(cat));
      setBulk(true);          // 신규는 일괄 입력 기본
      setBulkRows([{}]);
    }
  }, [modal]);

  if (!modal || !form) return null;

  const close = () => modalStore.setState(null);
  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));

  const onSave = () => {
    if (!g('checkAdminAction')) { /* checkAdminAction 없으면 통과 취급 */ }
    if (typeof globalThis.checkAdminAction === 'function' && !globalThis.checkAdminAction()) return;
    if (!isEdit && bulk) {
      const n = saveInventoryBulk({ rows: bulkRows });
      if (!n) return;
      close();
      g('renderInventory');
      g('showToast', `재고 품목 ${n}건이 등록되었습니다.`);
      return;
    }
    const ok = saveInventorySingle({ editId: isEdit ? modal.id : null, form });
    if (!ok) return;
    close();
    g('renderInventory');
    g('showToast', isEdit ? '재고가 수정되었습니다.' : '재고가 등록되었습니다.');
  };

  return (
    <div className="overlay open" id="inv-modal">
      <div className="dlg bulk-entry-dialog" style={{ maxWidth: 1040, width: '96%' }}>
        <div className="dlg-title">
          <i className={'ti ' + (isEdit ? 'ti-edit' : 'ti-package')} />
          {isEdit ? '재고 수정' : '재고 품목 등록'}
        </div>

        {!isEdit && (
          <div className="entry-mode-switch">
            <button type="button" className={!bulk ? 'active' : ''} onClick={() => setBulk(false)}>단건 입력</button>
            <button type="button" className={bulk ? 'active' : ''} onClick={() => setBulk(true)}>일괄 입력</button>
          </div>
        )}

        {(isEdit || !bulk) && (
          <div className="fg fg4" style={{ gap: 10, marginBottom: 14 }}>
            <div className="ff"><label htmlFor="inva-id">재고 코드</label><input id="inva-id" value={form.id} readOnly /></div>
            <div className="ff" style={{ gridColumn: 'span 3' }}><label htmlFor="inva-name">품목명 *</label><input id="inva-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="예: LM 가이드 레일" /></div>
            <div className="ff"><label htmlFor="inva-category">재고 구분 *</label>
              <select id="inva-category" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="ff"><label htmlFor="inva-type">세부 유형</label>
              <select id="inva-type" value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="ff"><label htmlFor="inva-unit">단위 *</label>
              <select id="inva-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div className="ff"><label htmlFor="inva-qty">현재고 수량 *</label><input id="inva-qty" type="number" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} /></div>
            <div className="ff"><label htmlFor="inva-minQty">최소 안전 재고 *</label><input id="inva-minQty" type="number" min="0" value={form.minQty} onChange={(e) => set('minQty', e.target.value)} /></div>
            <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="inva-location">보관 위치</label><input id="inva-location" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="예: A-4 선반" /></div>
            <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="inva-note">참고사항</label><input id="inva-note" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="기타 메모" /></div>
          </div>
        )}

        {!isEdit && bulk && <BulkGrid fields={INV_BULK_FIELDS} rows={bulkRows} onChange={setBulkRows} />}

        <div className="dlg-actions">
          <button className="btn" onClick={close}>취소</button>
          <button className="btn btn-primary" onClick={onSave}>
            <i className="ti ti-check" />{isEdit ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/InventoryModal.test.jsx`
Expected: PASS (4 tests). `getByLabelText`가 통과하려면 `<label htmlFor>` + `id` 연결이 유지돼야 함.

- [ ] **Step 5: 커밋**

```bash
cd ../.. && git add src/react/src/components/InventoryModal.jsx src/react/test/InventoryModal.test.jsx
git commit -m "feat: InventoryModal 단건/일괄 등록·수정 모달"
```

---

## Task 7: 통합 배선 + inventory.js 분리 + 최종 검증

**Files:**
- Rewrite: `src/react/src/entry.jsx`
- Modify: `src/js/inventory.js` (`renderInventoryKpi()` 추출)
- Modify: `src/index.template.html` (기존 `#inv-modal` 정적 마크업 제거 — React가 대체)
- Test: `src/react/test/bridge-render.test.js`

- [ ] **Step 1: renderInventory 분리 — 실패 테스트 작성**

Create `src/react/test/bridge-render.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { wireGlobals } from '../src/entry.jsx';
import { inventoryStore, modalStore } from '../src/bridge/store.js';

describe('wireGlobals', () => {
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd src/react && npx vitest run test/bridge-render.test.js`
Expected: FAIL — `wireGlobals` 미export.

- [ ] **Step 3: entry.jsx 재작성 (배선 + 마운트)**

Rewrite `src/react/src/entry.jsx`:

```jsx
import { createRoot } from 'react-dom/client';
import { inventoryStore, modalStore } from './bridge/store.js';
import { InventoryTable } from './components/InventoryTable.jsx';
import { InventoryModal } from './components/InventoryModal.jsx';

// window.* 전역 재바인딩. inventory.js include 이후 실행되어 승리한다.
export function wireGlobals() {
  const w = globalThis;

  w.renderInventory = function () {
    if (typeof w.renderInventoryKpi === 'function') w.renderInventoryKpi();
    inventoryStore.emit();
  };

  w.openInvAdd = function () {
    if (typeof w.requireCreateAction === 'function' && !w.requireCreateAction('inventory', '재고 등록')) return;
    if (typeof w.editInvId !== 'undefined') w.editInvId = null;
    modalStore.setState({ mode: 'add' });
  };

  w.openInvEdit = function (id) {
    const item = (w.inventory || []).find((x) => x.id === id);
    if (!item) return;
    if (typeof w.requireRecordPermission === 'function' && !w.requireRecordPermission('edit', item, 'inventory')) return;
    modalStore.setState({ mode: 'edit', id });
  };
  // adjustStock, deleteInventory 는 vanilla 유지(내부에서 renderInventory 호출 → emit).
}

function mount() {
  const host = document.getElementById('inventory-table');
  if (host) {
    host.innerHTML = '';
    createRoot(host).render(<InventoryTable />);
  }
  // 모달 마운트 지점: body 끝에 컨테이너 생성.
  let modalHost = document.getElementById('inv-modal-react-root');
  if (!modalHost) {
    modalHost = document.createElement('div');
    modalHost.id = 'inv-modal-react-root';
    document.body.appendChild(modalHost);
  }
  createRoot(modalHost).render(<InventoryModal />);
}

function boot() {
  wireGlobals();
  mount();
  inventoryStore.emit();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd src/react && npx vitest run test/bridge-render.test.js`
Expected: PASS (2 tests). (jsdom에 document 존재하나 `#inventory-table` 없으면 mount는 건너뜀 — 테스트는 wireGlobals만 검증)

- [ ] **Step 5: inventory.js 에서 renderInventoryKpi 추출**

Modify `src/js/inventory.js`: `renderInventory()` 함수에서 KPI/라벨/필터옵션/이력드롭다운을 갱신하는 앞부분(라인 31~59 및 116~125 영역, 즉 `cont`(=`#inventory-table`) innerHTML 조립을 제외한 전부)을 새 함수 `renderInventoryKpi()`로 이동한다. 기존 `renderInventory()`는 그대로 남겨두되(롤백 경로), 내부에서 `renderInventoryKpi()`를 먼저 호출하도록 정리한다.

구체 편집: 파일 상단 근처에 새 함수 추가.

```js
function renderInventoryKpi() {
  const catItems = inventory.filter(i => canViewRecord(i, 'inventory') && (i.category || '생산부품') === invCategory);
  const total = catItems.length;
  const below = catItems.filter(i => i.qty < (i.minQty||0)).length;
  const totalQty = catItems.reduce((s,i) => s + (Number(i.qty)||0), 0);
  const okRate = total > 0 ? Math.round((total - below) / total * 100) : 100;
  const catIcon = invCategory==='완제품' ? 'ti-building-factory' : invCategory==='사무비품' ? 'ti-printer' : 'ti-tools';
  const secLbl = inp('inv-sec-lbl');
  if (secLbl) secLbl.innerHTML = `<i class="ti ${catIcon}"></i>${invCategory} 재고 목록`;
  const stCur = v('inv-filter-status') || '';
  const kpi = inp('inv-kpi');
  if (kpi) kpi.innerHTML =
    '<div class="mc"><div class="mc-lbl"><i class="ti '+catIcon+'"></i>'+invCategory+' 품목수</div><div class="mc-val">'+total+'개 종</div></div>' +
    '<div class="mc clickable'+(stCur==='low'?' kpi-active':'')+'" onclick="kpiFilter(\'inv-filter-status\',\'low\',\'renderInventory\')"><div class="mc-lbl"><i class="ti ti-package-off" style="color:var(--tx-d);"></i>안전재고 미달</div><div class="mc-val" style="color:var(--tx-d);">'+below+'개 품목</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-stack-2" style="color:var(--tx-i);"></i>총 보유 수량</div><div class="mc-val" style="color:var(--tx-i);">'+totalQty+'</div></div>' +
    '<div class="mc"><div class="mc-lbl"><i class="ti ti-circle-check" style="color:var(--tx-ok);"></i>안전재고 충족률</div><div class="mc-val" style="color:var(--tx-ok);">'+okRate+'%</div></div>';
  const typeSel = inp('inv-filter-type');
  let ft = typeSel ? typeSel.value : '';
  if (typeSel) {
    const types = [...new Set(catItems.map(i => i.type).filter(Boolean))];
    if (ft && !types.includes(ft)) ft = '';
    typeSel.innerHTML = '<option value="">전체 세부유형</option>' +
      types.map(t => `<option value="${esc(t)}"${t===ft?' selected':''}>${esc(t)}</option>`).join('');
  }
  const invLedgerSel = document.getElementById('inv-ledger-inv');
  if (invLedgerSel) {
    const curVal = invLedgerSel.value;
    invLedgerSel.innerHTML = '<option value="">전체 품목</option>' +
      (typeof visibleRecords === 'function' ? visibleRecords(inventory, 'inventory') : inventory).map(function(i) {
        return '<option value="' + esc(i.id) + '"' + (i.id === curVal ? ' selected' : '') + '>' + esc(i.name) + '</option>';
      }).join('');
  }
  const ledgerPanel = document.getElementById('inv-tab-ledger');
  if (ledgerPanel && ledgerPanel.style.display !== 'none') renderInventoryLedger();
}
```

그리고 기존 `renderInventory()` 첫 줄에 `renderInventoryKpi();` 호출을 추가하고, 그 함수 안의 중복 KPI 계산부는 남겨둬도 무방(롤백 경로에서만 사용). React 번들의 `wireGlobals()`가 로드 후 `window.renderInventory`를 덮어쓰므로 실제 런타임에서는 KPI만 재사용된다.

- [ ] **Step 6: 정적 inv-modal 마크업 제거**

Modify `src/index.template.html`: 라인 556~592의 `<div class="overlay" id="inv-modal"> ... </div>` 블록 전체를 삭제한다(React가 `#inv-modal-react-root`에 렌더). 필터 툴바와 "+" 버튼이 있는 `src/html/pages/inventory.html`은 **변경하지 않는다**.

- [ ] **Step 7: 재빌드 + 유닛 테스트 전체 통과**

Run:
```bash
cd src/react && npm run build && npx vitest run
```
Expected: 번들 재생성 + 모든 테스트 PASS.

- [ ] **Step 8: 전체 앱 빌드 + 브라우저 수동 검증**

Run:
```bash
cd ../.. && python build.py
```
그다음 `index.html`을 브라우저로 열고 재고 페이지에서 확인:
1. 테이블이 렌더되고 기존과 동일하게 보인다(분류/필터/검색 반영).
2. 정렬 헤더 클릭 → 정렬됨.
3. `+/-` 버튼 → 수량 변경 + 이력 반영.
4. "+" 등록 버튼 → 모달 열림, 일괄 입력 기본, 저장 시 목록 갱신.
5. 수정 버튼 → 값 채워진 단건 모달, 저장 시 갱신.
6. 삭제 버튼 → 휴지통 이동.
7. 비관리자 역할 전환 시 RBAC 컬럼 숨김이 여전히 작동(개발자도구로 `data-table-display-col` 확인).

- [ ] **Step 9: 최종 커밋**

```bash
git add src/react/src/entry.jsx src/react/test/bridge-render.test.js src/js/inventory.js src/index.template.html src/js-dist/inventory-react.js index.html
git commit -m "feat: 재고 테이블·모달 React 마운트 배선 + renderInventoryKpi 분리"
```

---

## Self-Review 결과

**Spec 커버리지:**
- 테이블(정렬/필터/±/수정·삭제) → Task 4 ✓
- 등록/수정 모달 + 일괄입력 그리드 → Task 5, 6 ✓
- 상태 브리지(renderInventory 분리, useSyncExternalStore) → Task 1, 7 ✓
- RBAC 컬럼 게이팅 `data-table-display-col` 0~7 → Task 4 테스트로 고정 ✓
- `.edit-btn`/`.del-btn` 유지 → Task 4 ✓
- 등록 버튼 vanilla 유지(게이팅 무손상) → Task 6/7에서 툴바 미변경 명시 ✓
- 행 선택 seam(`selectable` prop·선택 컬럼·안정적 key) → Task 4 InventoryTable ✓
- Vite 라이브러리 IIFE 번들 + build.py include → Task 0 ✓
- 외부 전역 계약(renderInventory/openInvAdd/openInvEdit/adjustStock/deleteInventory) → Task 7 ✓
- 롤백(번들 include 토글, vanilla 함수 보존) → Task 7 Step 5/6 명시 ✓
- 테스트(actions/table/bulk/bridge) → Task 1~7 ✓

**Placeholder 스캔:** 모든 코드 스텝에 실제 코드 포함. TODO/TBD 없음.

**타입 일관성:** `saveInventorySingle({editId, form})`, `saveInventoryBulk({rows})`, `modalStore.setState({mode, id})`, `INV_BULK_FIELDS` 스키마가 Task 3·5·6·7에서 일관되게 사용됨. `data-table-display-col` 인덱스 0~7이 rbac.js `cols`와 정렬됨.

**주의(실행 시 확인 필요):**
- `checkAdminAction` 유무: InventoryModal onSave에서 존재 시에만 호출하도록 방어함.
- jsdom `useSyncExternalStore`의 getServerSnapshot 인자로 `getVersion`/`getState`를 넘겨 SSR 경고 회피.
- `src/js-dist/` 디렉터리는 Task 0 빌드가 생성. 없으면 `mkdir -p src/js-dist`.
