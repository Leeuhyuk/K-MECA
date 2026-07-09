# 재고(Inventory) 모듈 React 파일럿 — 설계

작성일: 2026-07-09
브랜치: `feat/inventory-react-pilot`

## 목적

현재 앱은 프레임워크 없는 vanilla JS + Firebase 구조다. `src/js/*.js`(39개 모듈, ~2.8만 줄)를 `build.py`가 단순 문자열 include로 합쳐 단일 자가완결 `index.html`(~3.6만 줄)로 굽는다.

`open*Add`/`open*Edit` 계열 함수가 47개, 약 20개 도메인에 걸쳐 **"테이블 렌더 + 등록/수정 팝업 + 폼 저장"** 3종 세트를 반복한다. 이 반복 패턴을 React 컴포넌트로 뽑아낼 가치가 있는지, 이 코드베이스에서 React가 실제로 잘 얹히는지를 **재고(inventory) 모듈 하나만 파일럿으로 전환**하여 검증한다.

전면 재작성이 아니라, 재사용 *가능한 구조*(reusable-ready)로 inventory를 구체적으로 잘 짜는 것이 목표다. 진짜 공통 API는 두 번째 모듈을 이식할 때 근거를 갖고 일반화한다(YAGNI).

## 범위

### 포함 (React로 전환)
- 재고 **테이블 본체**: 정렬, 필터 반영, 행 렌더, `+/-` 수량 조정, 수정/삭제 버튼
- 재고 **등록/수정 모달**: 단건 입력 폼 + **일괄입력 그리드**(붙여넣기, Tab/Enter 이동, 컬럼 복제/삭제까지 React로 직접 재구현)

### 비범위 (vanilla 유지)
- KPI 카드(`#inv-kpi`), 분류 라벨(`#inv-sec-lbl`)
- 분류 탭 / 입출고 이력 탭(`renderInventoryLedger`)
- 필터 툴바(`#inv-filter-type`, `#inv-filter-status`, `#inv-q`)와 **"+" 등록 버튼** — 아래 "공존 계약" 참조
- CSV 내보내기(`exportInvCSV`)
- 나머지 19개 도메인 모듈, 빌드/배포 방식

## 배경: 재고 테이블의 전역 결합(coupling)

재고 테이블은 독립적이지 않고 앱 전역의 3개 DOM 스캐닝 시스템과 얽혀 있다. React 도입의 진짜 관건이며, React 테이블은 이 계약들을 **그대로 재현**해야 한다.

1. **RBAC 컬럼 게이팅** (`rbac.js`): `#inventory-table [data-table-display-col="inventory-{idx}"]{display:none}` CSS로 역할별 컬럼 숨김. → 테이블 셀에 `data-table-display-col` 속성 필요. 인덱스는 `rbac.js`의 `cols` 배열 순서와 정확히 일치해야 한다:
   `['재고코드','품목명','분류','현재고','안전재고','보관위치','참고','관리']` → 0~7.
2. **기능 게이팅** (`rbac.js`): 삭제 버튼을 `.del-btn` 클래스 셀렉터로 숨김. 등록 버튼은 `[onclick^="openInvAdd"]` **인라인 onclick 속성**으로 숨김.
3. **행 선택 시스템** (`table-selection.js`, ~2530줄): 체크박스 주입 + 일괄선택. `['openInvEdit','inventory',0]`로 등록. React가 tbody를 소유하면 이 DOM 주입과 충돌.

## 아키텍처

### 경계 (최소 결합 원칙)
React가 소유하는 것은 **① `#inventory-table` 안의 테이블 본체 + ② 등록/수정 모달** 둘뿐이다. **필터 툴바와 "+" 등록 버튼은 기존 vanilla HTML 그대로 둔다.**
- 등록 버튼을 vanilla로 두면 `[onclick^="openInvAdd"]` 게이팅이 손대지 않고 그대로 작동한다.
- 필터 `<select>`/`<input>`의 `onchange="renderInventory()"`가 이미 있으므로, React 테이블은 그 poke를 받아 리렌더한다.

React 테이블이 재현하는 DOM 계약:
- 각 셀에 `data-table-display-col="inventory-{idx}"` → 컬럼 게이팅 CSS 그대로 작동.
- 수정/삭제 버튼에 `.edit-btn`/`.del-btn` 클래스 유지 → 삭제 게이팅 작동.
- **행 선택 시스템은 재고 테이블에서 opt-out**(파일럿 비범위). 단, **나중에 React 자체 구현으로 복구**할 수 있게 seam을 남긴다: `InventoryTable`에 `selectable`(기본 off) prop과 맨 앞 선택 컬럼 슬롯을 비워두고, 훗날 `useRowSelection` 훅으로 채우도록 명시.

### 상태 브리지 (핵심)
`inventory`는 앱 전역(`data-storage.js:886`)에서 in-place로 변형되는 전역 배열이라 React가 변경을 모른다.
- 작은 pub/sub 스토어 `inventoryStore` 도입. React는 `useSyncExternalStore`로 구독.
- `window.renderInventory()`를 **`renderInventoryKpi()`(vanilla: KPI·라벨·이력 드롭다운 갱신) + `inventoryStore.emit()`(React 테이블 갱신)** 으로 분리. → 외부 호출자(navigation.js, state-search.js, cloud-sync.js)는 `renderInventory()`를 그대로 호출하면 KPI도 테이블도 갱신된다. **외부 계약 무손상.**
- `window.openInvAdd()`/`openInvEdit(id)`는 기존 권한 게이트(그대로) 통과 후 `modalStore.open(...)` 호출.
- `window.deleteInventory(id)`/`adjustStock(id, delta)`는 기존 데이터·감사 로직을 그대로 유지(actions 모듈로 이관)하고 끝에서 store emit.

### 빌드 통합
- 새 폴더 `src/react/`(자체 `package.json`, `vite.config.js`). Vite **라이브러리 모드**로 단일 IIFE 번들 → `src/js-dist/inventory-react.js`(React 18 인라인 포함, ~140KB).
- `build.py`는 마커 한 줄 추가(`<!--#include js-dist/inventory-react.js-->`)로 번들 흡수. 단일 index.html 자가완결 특성 유지. 다른 모듈·배포 방식 무손상.
- 산출물 `src/js-dist/inventory-react.js`는 git에 커밋한다(build.py가 include하므로).

## 파일 구조

```
src/react/
  package.json          # react, react-dom, vite, @vitejs/plugin-react, vitest, @testing-library/react
  vite.config.js        # lib mode → ../js-dist/inventory-react.js (IIFE, format:'iife')
  src/
    bridge/
      store.js          # inventoryStore, modalStore (useSyncExternalStore 호환)
      globals.js        # 전역 헬퍼 얇은 래퍼 (esc, saveStorage, stampRecordCreate/Update,
                        #   writeAuditLog, logInventoryMove, pushToTrash, nextCode,
                        #   requireRecordPermission, requireCreateAction, checkAdminAction,
                        #   canViewRecord, visibleRecords, showToast, invCategory ...)
    actions/
      inventoryActions.js  # saveInventory / adjustStock / deleteInventory (기존 로직 이관)
    components/
      InventoryTable.jsx   # 정렬·행·+-조정·수정/삭제 (data-table-display-col, .edit-btn/.del-btn)
      InventoryModal.jsx   # 단건/일괄 탭 전환 + 저장
      BulkGrid.jsx         # 일괄입력 그리드 (붙여넣기/Tab·Enter/컬럼 복제 — React 재구현)
      SortableTh.jsx       # 재사용 정렬 헤더
    hooks/
      useBulkGrid.js       # 그리드 키보드/붙여넣기 네비게이션 로직
    entry.jsx              # 루트 마운트 + window.* 전역 재바인딩
  test/                    # vitest + @testing-library/react
src/js-dist/inventory-react.js   # 빌드 산출물 (git 커밋)
```

## 데이터 흐름

```
외부 모듈 ──renderInventory()──► [renderInventoryKpi() + inventoryStore.emit()]
                                              │
필터/카테고리 변경 (vanilla onchange) ─────────┤
                                              ▼
                                   InventoryTable (useSyncExternalStore)
                                     └ 전역 inventory 스냅샷 읽어 필터·정렬·렌더
행 +/- 버튼 ─► adjustStock() ─► 데이터변형+감사+saveStorage ─► renderInventory() ─► 리렌더
"+"/수정 버튼 ─► openInvAdd/openInvEdit ─► 권한게이트 ─► modalStore.open
모달 저장 ─► saveInventory() ─► stampRecord*+writeAuditLog+saveStorage ─► close+renderInventory
```

## 보존해야 할 외부 계약 (전역 함수)

다른 모듈이 호출하므로 `window.*`로 계속 노출:
- `renderInventory()` — navigation.js, state-search.js, cloud-sync.js, inventory.html 필터
- `openInvAdd()` — bom.js, rbac.js, inventory.html
- `openInvEdit(id)` — cloud-sync.js, table-selection.js
- `deleteInventory(id)` — cloud-sync.js, table-selection.js
- `adjustStock(id, delta)` — 테이블 내부

`#inventory-table` 컨테이너 id는 유지(rbac.js, cloud-sync.js가 셀렉터로 참조).

## 테스트 (Vitest + Testing Library)

- **actions**: 저장/수정/삭제/재고조정 시 감사로그·권한·스토리지 호출을 목으로 검증(기존 로직 동등성).
- **InventoryTable**: 정렬 토글, 필터 반영, `data-table-display-col` 인덱스 정합성(0~7), 안전재고 미달 표시.
- **BulkGrid**: 붙여넣기(탭/개행 분해), Enter 이동, 컬럼 복제/삭제.
- **bridge**: `renderInventory()` 호출 시 KPI 함수 + emit 둘 다 발생.

## 롤백 안전장치

- 기존 vanilla `inventory.js`의 테이블/모달 렌더 함수는 **삭제하지 않고**, template 마커 토글(React 번들 include 한 줄)로 on/off. 문제 시 즉시 vanilla로 복귀.
- 파일럿은 `feat/inventory-react-pilot` 브랜치에서 진행.

## 리스크

- **번들 크기**: React 18 인라인 ~140KB 증가. 내부 도구라 허용. 필요 시 preact/compat로 축소 가능(별도 결정).
- **컬럼 인덱스 표류**: `data-table-display-col` 인덱스가 rbac.js `cols` 순서와 어긋나면 잘못된 컬럼이 숨겨짐 → 테스트로 고정.
- **행 선택 회귀**: 재고에서 체크박스 일괄선택을 쓰고 있었다면 파일럿 중 일시 사라짐 → seam을 남겨 이후 복구.
- **이중 빌드**: `npm run build`(Vite) → `python build.py` 2단계. README/빌드 문서에 순서 명시 필요.
