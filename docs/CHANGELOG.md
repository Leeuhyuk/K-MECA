# MESPro 수정 이력

---

## 2026-06-05 ~ 06-06 — ERP 기능 강화 + UI 개선

### 신규 파일

| 파일 | 설명 |
|---|---|
| `src/js/table-inline-edit.js` | 자재 테이블 인라인 편집 / 엑셀 붙여넣기 / 열 폭 조절 |
| `src/js/calendar.js` | 납기 캘린더 (월간 뷰, D-Day 색상, 날짜 클릭 상세) |
| `src/js/alimtalk.js` | 카카오 알림톡 연계 (SOLAPI) — 발송 모듈 + 설정 UI |
| `src/html/pages/pg-calendar.html` | 납기 캘린더 페이지 |
| `src/html/pages/pg-alimtalk.html` | 알림톡 설정 페이지 |
| `docs/superpowers/plans/2026-06-05-erp-enhancements.md` | 구현 계획서 |

---

### 수정 파일

#### `src/js/data-storage.js`
- `inventoryLedger` 전역 변수 추가 (재고 입출고 이력 배열)
- `alimtalkSettings` 전역 변수 추가 (알림톡 설정 객체)
- `reloadAllData` 초기화 블록에 두 항목 loadStorage 추가
- `keyMap` (Firebase 동기화)에 두 키 추가
- `logInventoryMove(invId, type, qty, reason, refId)` 헬퍼 함수 추가

```
logInventoryMove 스키마:
  id      : 'ILG-{timestamp}-{random}'
  invId   : 재고 품목 ID
  type    : '입고' | '출고' | '조정'
  qty     : 변동 수량 (양수)
  reason  : 사유 텍스트
  refId   : 연관 ID (자재발주 MT-xxx 등)
  date    : 'YYYY-MM-DD'
```

#### `src/js/inventory.js`
- `adjustStock`: +/- 클릭 시 `logInventoryMove` 자동 호출
- `saveInventoryForm`: 수량 직접 수정 시 이력 기록
- `renderInventoryLedger()` 함수 추가 (최근 100건 테이블)
- `renderInventory` 끝에 이력 드롭다운 동기화 + `renderInventoryLedger()` 호출

#### `src/html/pages/inventory.html`
- 페이지 하단에 **입출고 이력 카드** 추가
  - `#inv-ledger-table` — 이력 테이블 컨테이너
  - `#inv-ledger-inv` — 품목 필터 드롭다운

#### `src/js/materials.js`
- `changeMatStatus`: 상태 변경 훅 추가
  - `발주중 → 입고완료` 전환 시 동일 품목명 재고 수량 자동 증가
  - `logInventoryMove` 자동 호출
  - `sendAlimtalkMaterialIn(m)` 트리거 (알림톡 설정 시)
- `renderMaterials`: `table-layout:fixed` 적용, `thSort` 헬퍼로 헤더 리팩터
- `renderMaterials` 끝에 `setTimeout(initMatInlineEdit, 0)` 호출 추가
- 테이블 헤더 구조 변경 (체크박스 열 포함 14열 기준 대응)

#### `src/js/bom.js`
- `getProductMargin(productId)` 함수 추가
  - BOM 재료비(`bomMaterialCost`) vs 수주 단가 → 마진율 반환
  - 반환: `{ cost, price, margin, marginRate }`

#### `src/js/clients-products.js`
- 제품 행에 원가/마진 배지 표시 (BOM 데이터 있는 경우)
- `showClient360(clientId)` 함수 추가
- `renderClient360(clientId)` 함수 추가
  - KPI 5종: 진행 제품 / 누적 납품 / 자재 발주 / 클레임 / A/S
  - 진행 중 제품 테이블 + 클레임 이력 테이블
- 고객사 행에 `onclick="showClient360(...)"` 추가

#### `src/html/pages/clients.html`
- 페이지 하단에 **고객사 360도 뷰 패널** 추가
  - `#client-360-wrapper` — 패널 래퍼 (숨김 상태로 시작)
  - `#client-360-title` — 고객사명 제목
  - `#client-360-panel` — 360도 뷰 콘텐츠

#### `src/js/partners.js`
- `getPartnerPerformance(partnerName)` 함수 추가
  - poList 기반 완료율, 지연 건수, 거래 총액 계산
- `renderPartners` 테이블 헤더에 **납기이행률**, **거래금액** 열 추가
- 각 공급처·외주처 행에 이행률 배지 (bd-ok ≥80% / bd-warn ≥60% / bd-err <60%)

#### `src/js/as.js`
- 신규 A/S 저장 후 `sendAlimtalkAsRegistered(newAs)` 트리거 추가

#### `src/js/alerts.js`
- `scanAndGenerateAlerts` 내 납기 D-7 이하 제품에 `sendAlimtalkDeliveryDue(p)` 트리거 추가

#### `src/js/navigation.js`
- `calendar` 페이지 진입 시 `renderCalendar()` 호출
- `alimtalk` 페이지 진입 시 `renderAlimtalkSettings()` 호출
- 페이지 타이틀 맵에 두 항목 추가

#### `src/html/layout-top.html`
- 납품 현황 아래: **납기 캘린더** nav 항목 추가
- 시스템 관리 섹션: **알림톡 설정** nav 항목 추가

#### `src/styles/components.css`
- 인라인 편집 스타일 추가: `cell-sel`, `cell-edit`, `cell-inp`, `col-rz`

#### `src/index.template.html`
- `materials.js` 뒤에 `table-inline-edit.js` include 추가
- `calendar.js`, `alimtalk.js` include 추가
- `pg-calendar.html`, `pg-alimtalk.html` include 추가
- `bom.js`를 `clients-products.js` 직전으로 이동 (의존성 순서 수정)

#### `index.html` (구버전 레거시 파일)
- `sortState`에 rfq / po / partners / as / workers 5개 항목 추가
- `toggleSort` dispatch에 5개 분기 추가
- `renderRfq`, `renderPo`, `renderPartners`, `renderAS`, `renderWorkers`에 정렬 로직 + sortable 헤더 추가

---

### 기능 요약

| 기능 | 진입 방법 | 비고 |
|---|---|---|
| **재고 입출고 이력** | 재고 탭 하단 | +/- 또는 수정 시 자동 기록 |
| **원가·마진 표시** | 수주 정보 → 제품명 옆 | BOM 등록 후 자동 계산 |
| **협력사 이행률** | 거래처 탭 | 납기이행률 / 거래금액 열 |
| **고객사 360도 뷰** | 수주 정보 → 고객사 클릭 | 수주/납품/클레임/A/S 종합 |
| **납기 캘린더** | 사이드바 → 납기 캘린더 | 제품 납기 + 자재 입고예정 |
| **알림톡 설정** | 사이드바 → 알림톡 설정 | SOLAPI API Key 입력 후 활성화 |
| **자재 인라인 편집** | 자재 탭 → 셀 더블클릭 | Tab/Enter 이동, Ctrl+V 붙여넣기 |
| **테이블 정렬 (index.html)** | 헤더 클릭 | rfq/po/거래처/A/S/직원 |

---

### 알림톡 사용 전 준비 사항 (개발 외)

1. [SOLAPI 가입](https://solapi.com) → API Key / Secret 발급
2. 카카오 비즈니스 채널 개설 → pfId 확인
3. SOLAPI에서 알림톡 채널 연동
4. 템플릿 5종 등록 후 카카오 심사 대기 (1~3 영업일)

| 템플릿 코드 | 용도 |
|---|---|
| `TPL_MAT_IN` | 자재 입고완료 → 공급처 확인 요청 |
| `TPL_DLV_DUE` | 납기 D-7 이내 → 내부 담당자 알림 |
| `TPL_AS_NEW` | A/S 접수 → 담당자 알림 |
| `TPL_PO_SENT` | 발주서 발송 → 공급처 확인 요청 |
| `TPL_TEST` | 테스트 발송용 |

5. 앱 내 **알림톡 설정** 탭에서 키 입력 → 저장 → 테스트 발송 확인

---

### 빌드 방법

```bash
# src/ 수정 후 항상 빌드 실행
python build.py

# 로컬 서버 실행 (포트 3000)
python -m http.server 3000
# → http://localhost:3000/index.html
```

> **주의:** `index.html`은 빌드 결과물입니다. 직접 편집하지 말고 항상 `src/` 파일을 수정한 후 `build.py`를 실행하세요.
