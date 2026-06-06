# 전 표 엑셀형 편집(스프레드시트 그리드) 설계

- 작성일: 2026-06-06
- 상태: 설계 확정(사용자 승인). 구현은 Phase 1→2→3 단계 진행.
- 목표: 프로그램의 모든 주요 데이터 표를 엑셀 같은 편집 환경으로 만들되, **편집 권한이 있는 역할만** 편집 가능하게 한다.

## 1. 배경 / 현재 상태

- 인라인 편집 엔진 `src/js/table-inline-edit.js`(303줄)가 이미 존재: 셀 선택·더블클릭 편집·방향키/Tab/Enter/Esc·복사붙여넣기. 단 **자재 표(`#mat-table`, 전역 `materials`)에 하드코딩**.
- 열 드래그 재배치 `table-reorder.js`, 헤더 클릭 정렬 존재.
- RBAC: 역할(admin/manager/staff). 페이지 권한(`rolePages`), 열 권한(column gating), **기능 권한(`roleFeatures`: csv/pdf)** = `FEATURE_DEFS` + `applyFeatureGating()`(CSS 주입). admin은 항상 전체, 로컬 모드=admin.
- 폰트/표는 px 기반, 데이터는 Firebase+localStorage.

## 2. 목표 / 비목표

목표
- 자재 전용 인라인 엔진을 **범용 그리드 엔진**으로 일반화(다중 표).
- RBAC에 **편집 권한(`edit`)** 추가 — 역할별 전역 on/off, admin 항상 가능.
- 주요 엔티티 표 ~13개를 편집 활성화.
- L2 스프레드시트 UX: 범위 선택, 범위 복사/붙여넣기, 채우기(fill), 실행취소/복구(undo/redo), 행 추가/삭제 단축키, 격자선.

비목표
- 수식(`=A1+B1`)·시트 탭·셀 서식 등 L3 기능 (단일 HTML 앱 범위 밖).
- 집계/파생 뷰(공정 상세·클레임 요약·알림·칸반) 편집.
- 실시간 동시편집 충돌 해결(기존 last-write-wins 유지).
- undo의 영구 저장(세션 한정).

## 3. 아키텍처

### 3.1 범용 그리드 엔진 (`table-inline-edit.js` 개편)
- `#mat-table` 하드코딩 제거 → **활성 표** = 사용자가 마지막으로 상호작용한 `[data-grid]` 컨테이너.
- 선택/편집 위치를 셀 인덱스가 아니라 **`{containerId, id, field}`** 로 추적 → 열 순서 변경·재렌더 후에도 정확 복원.
- 컨테이너 `data-*`로 표 설정 선언(선언형):
  - `data-grid="<키>"` — 편집 활성 표 표시(필수)
  - `data-idfield="id"` — 행 식별 필드(기본 `id`)
  - `data-save="<localStorage 키>"` — 저장 키이자 전역 배열명(예: `materials`)
  - `data-rerender="<함수명>"` — 편집 후 재렌더 함수(예: `renderMaterials`)
  - `data-newrow="<함수명>"` — 새 빈 행 생성 팩토리(선택; 없으면 행추가 비활성)
- 헤더 `<th>`의 `data-field`/`data-type`(text|number|date)로 편집 대상·자료형 판정(기존 패턴 유지).
- 데이터 접근: `window[data-save 키]` 배열에서 `idfield`로 행 찾기 → 값 적용 → `saveStorage(키, 배열)` → `data-rerender` 호출 → 선택 복원.
- 행 id 셀 탐색: `th[data-field===idfield]`의 열 인덱스를 찾아 해당 셀 텍스트를 행 id로 사용(셀 위치 하드코딩 제거).
- 공통 진입점 `enableGrid(container)`: 컨테이너/도큐먼트 이벤트 위임 1회 바인딩. 각 render 끝에서 호출.

### 3.2 편집 권한 (RBAC 확장)
- `FEATURE_DEFS`에 `{key:'edit', label:'셀 직접 편집'}` 추가 → 권한 관리 화면에 토글 자동 노출.
- `canEdit()` = `currentRole==='admin' || (roleFeaturesConfig()[currentRole]?.edit !== false)`.
  - 기본값: 미설정 시 허용(true), admin이 역할별로 끌 수 있음(csv/pdf와 동일 정책).
- 권한 없으면: 셀 **선택**은 허용하되 편집 시작·붙여넣기·fill·행추가/삭제·undo 적용 등 **모든 쓰기 동작 차단**.
- 열 권한과 결합: 역할에게 숨겨진 열은 DOM에 없으므로 편집 대상에서 자동 제외.
- 역할 변경/권한 토글 시 즉시 반영(엔진이 매 동작에서 `canEdit()` 확인 — 별도 재바인딩 불필요).

## 4. 전 표 확장 (대상)

편집 활성(주요 엔티티 표):
| 표 | 컨테이너 | 저장키/배열 | render |
|---|---|---|---|
| 자재 | mat-table | materials | renderMaterials |
| 고객사 | client-list | clients | (clients-products) |
| 제품 | (clients-products 내) | products | (clients-products) |
| 협력사 | bp-table | partners | renderPartners |
| 재고 | inventory-table | inventory | renderInventory |
| 수주 | orders-table | orderList | renderOrders |
| 견적의뢰 | rfq-table | rfqList | (print-docs) |
| 발주 | po-table | poList | (print-docs) |
| 납품 | dlv-table | deliveries | renderDeliveries |
| 불량 | defect-table | defects | (quality-claims) |
| 클레임 | claim-table | claims | (quality-claims) |
| 검사 | check-table | checkRecords | (quality-claims) |
| 작업원 | workers-table | workers | (workers-attendance) |

읽기전용 유지: proc-detail-table, claims-table-full, alerts-list, kanban.

적용 패턴(표당): ① `<th>`에 `data-field`/`data-type` ② 컨테이너에 `data-grid` 등 선언 ③ render 끝 `enableGrid(cont)`.
- 일부 표는 컨테이너가 `<div>`(예: client-list가 카드형)일 수 있음 — 표가 아닌 카드형 뷰는 본 범위에서 제외하거나 표 뷰에 한해 적용(구현 시 표 구조 확인 후 결정).

## 5. L2 스프레드시트 UX

- **범위 선택**: 마우스 드래그(anchor셀→focus셀) 사각 범위, Shift+방향키 확장. 선택 범위 음영, 활성 셀 외곽선.
- **복사**: Ctrl+C → 선택 범위를 TSV(탭/개행)로 클립보드 복사.
- **붙여넣기**: Ctrl+V → 클립보드 TSV를 활성 셀 기준 다중 행/열에 채움. 범위 밖/행 부족 시 가능한 만큼만. `canEdit()` 필요. 1회 배치 저장+재렌더.
- **채우기**: Ctrl+D(범위 첫 행 값을 아래로), Ctrl+R(첫 열 값을 오른쪽으로).
- **실행취소/복구**: Ctrl+Z/Ctrl+Y. 표별 인메모리 op 스택(값 변경·행추가·행삭제), 깊이 50, 페이지 이동/새로고침 시 소멸.
- **행 추가/삭제**: Insert=빈 행 추가(`data-newrow` 팩토리로 id·기본값 생성 → 배열 push → 저장/재렌더). Ctrl+Delete=선택 행 삭제(확인 다이얼로그 필수). **행 추가**는 `data-newrow` 팩토리가 있는 표에서만 활성. **행 삭제**는 편집 활성 표 전체에서 허용(기존 행 대상, 확인 다이얼로그 필수, `canEdit()` 필요).
- **격자선**: 편집 활성 표에 `.grid-editable` 클래스 → 셀 테두리·활성셀 외곽선·선택 음영. components.css에 스타일 추가.
- **권한**: 위 모든 쓰기 동작은 `canEdit()` 통과 시에만. 미통과 시 선택/복사(읽기)만 허용.

## 6. 구현 단계

- **Phase 1 — 토대**: 엔진 일반화 + `edit` 권한 + 자재를 새 엔진으로 이관(기존 동작 동일 검증) + 파일럿 표 2개(협력사 bp-table, 재고 inventory-table). 산출: 권한 게이팅된 다중 표 셀 편집.
- **Phase 2 — 전 표**: 나머지 표(고객사/제품/수주/rfq/po/납품/불량/클레임/검사/작업원)에 `data-field` 주석 + 등록.
- **Phase 3 — L2**: 범위선택·복사/붙여넣기·fill·undo/redo·행추가/삭제·격자선.

각 Phase는 `python build.py` 후 브라우저 수동 검증(로그인 필요는 권한 부분만).

## 7. 위험 / 엣지 케이스

- **재렌더 후 선택 복원**: `{id, field}` 기준(열 순서·정렬 무관). 행 삭제 시 인접 행으로 이동.
- **행 추가 id 생성**: 표별 팩토리 필수(예: `MT-###`). 팩토리 없는 표는 추가 비활성.
- **자료형/검증**: `data-type=number`는 `parseInt`(또는 숫자 파싱), date는 텍스트(자유입력). 과한 검증은 비목표.
- **undo 비영구**: 세션 한정. 명시적으로 사용자에게 안내.
- **대량 붙여넣기/fill 성능**: 셀별 저장 금지 → 전체 배열 1회 수정 후 단일 `saveStorage`+재렌더.
- **클라우드 동시편집**: last-write-wins(기존). 본 설계 범위 밖.
- **카드형 뷰(client-list 등)**: 표가 아니면 그리드 비적용 — 구현 시 DOM 확인.
- **모바일**: 기존 모바일에서 편집 버튼 숨김 정책과 충돌 없게. 그리드 편집은 데스크톱 우선(모바일 동작은 최소 보장).

## 8. 영향 파일(개략)

- `src/js/table-inline-edit.js` — 범용 엔진으로 개편(+L2 기능). 파일이 커지면 `src/js/grid-engine.js`로 분리 검토.
- `src/js/rbac.js` / `src/js/cloud-sync.js` — `FEATURE_DEFS`에 `edit` 추가, `canEdit()` 노출.
- 각 render 모듈(materials/partners/inventory/orders/clients-products/print-docs/deliveries/quality-claims/workers-attendance) — 헤더 `data-field` 주석 + 컨테이너 `data-*` + `enableGrid` 호출.
- `src/styles/components.css` — `.grid-editable` 격자/선택/활성셀 스타일.
- `MESPro.html` — 빌드 재생성.

## 9. 검증

- Phase 1: 자재 편집이 기존과 동일 + 협력사/재고에서 셀 편집·방향키·붙여넣기 동작. `edit` 권한 off 역할로 로그인 시 편집 차단·선택만 가능.
- Phase 2: 각 표에서 편집 후 값이 저장·재렌더되는지(샘플 점검).
- Phase 3: 범위 드래그→Ctrl+C/V, Ctrl+D/R, Ctrl+Z/Y, Insert/Ctrl+Delete, 격자선 표시.
- 빌드물 데이터 청결 유지: `grep -o 'id="embedded-data"[^<]*' MESPro.html` → `{}`.
