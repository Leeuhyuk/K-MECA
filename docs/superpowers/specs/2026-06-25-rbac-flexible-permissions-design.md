# 유연한 RBAC 권한 편집 — 설계 문서

- 작성일: 2026-06-25
- 대상: MESPro (단일 페이지 바닐라 JS, Firebase 동기화)
- 관련 파일: `src/js/rbac.js`, `src/js/cloud-sync.js`, `src/js/helpers-auth.js`, `src/js/navigation.js`

## 1. 배경 / 목표

현재 권한(RBAC) 편집은 시스템 관리자가 **역할별 접근 페이지 / 표시 컬럼 / 기능(CSV·PDF) / 사용자 역할 배정**을 설정할 수 있으나, 다음이 고정되어 있어 자유도가 낮다.

- 역할이 `admin` / `manager` / `staff` **3개로 하드코딩** (추가·이름변경·삭제 불가)
- **페이지 접근 = 편집 권한** — "보기만 가능" 구분 없음
- 기능 권한이 **CSV·PDF 2종**뿐

본 작업의 목표는 관리자가 다음을 자유롭게 편집하도록 확장하는 것이다. (사용자가 선택한 3개 방향)

1. **커스텀 역할** 추가/이름변경/삭제
2. **보기/편집(읽기전용) 구분** — 페이지별 3단계
3. **세분화된 기능 권한** — 고위험 동작 단위 토글

> 사용자별 개별 권한 예외는 이번 범위에서 **제외**한다.

## 2. 핵심 설계 아이디어

`checkAdminAction()`([helpers-auth.js](../../../src/js/helpers-auth.js))은 이미 **모든 쓰기 동작(약 85곳)이 거쳐가는 단일 관문**이다(현재는 무조건 `true`). 이 관문에 "현재 페이지가 편집 허용인가" 판정을 넣으면 **호출부 85곳을 수정하지 않고** 읽기전용 모드를 전역 적용할 수 있다. 이것이 설계의 중심이며, 보기/편집 구분을 최소 변경으로 구현하는 열쇠다.

## 3. 현재 구조 (변경 전)

| 구성 | 위치 | 저장소 |
|------|------|--------|
| 역할 라벨 | `ROLE_LABEL` (rbac.js:20) | 하드코딩 |
| 기본 페이지 | `DEFAULT_ROLE_PAGES` (rbac.js:16) | 하드코딩 + `roles/config` |
| 페이지 권한 | `rolePagesConfig` / `roleAllowedSet` / `pageAllowed` | `roles/config` (배열) |
| 컬럼 권한 | `roleColumnsConfig` / `applyColumnGating` | `roles/columns` |
| 기능 권한 | `roleFeaturesConfig` / `applyFeatureGating` (csv,pdf) | `roles/features` |
| 사용자 역할 | `permSetRole` / `permToggleActive` | `users/{uid}.role/.active` |
| 네비 차단 | `go()` / 라우트적용 / 상단메뉴가 `pageAllowed` 강제 | navigation.js |

## 4. 데이터 모델 (변경 후)

Firestore `roles/*` 문서 + localStorage 미러(기존 방식 유지).

```
roles/registry  →  { roleId: { label, order, system? } }
   - 역할 목록. 커스텀 추가/이름변경/삭제.
   - admin: 항상 존재, 전체 권한, 삭제·비활성 불가(system:true).
   - manager/staff: 시드 엔트리(편집·삭제 가능, system 아님).

roles/config    →  { roleId: { pageId: 'none' | 'view' | 'edit' } }
   - 기존 "허용 페이지 배열"을 3단계 맵으로 확장.

roles/caps      →  { roleId: { delete, bulk, monthClose, payrollConfirm, dataRestore, csv, pdf : bool } }
   - 고위험 동작 + 기존 기능(csv/pdf)을 통합한 능력(capability) 맵. 기본 true(허용).

roles/columns   →  (기존 그대로)

users/{uid}.role →  커스텀 roleId 허용(문자열 그대로)
```

### 마이그레이션 (기존 권한 무손실)

- `roles/config`가 **배열 형태**(구버전)이면 읽을 때 변환: 배열에 있는 pageId → `'edit'`, 없는 pageId → `'none'`.
- `roles/registry` 부재 시 `{ admin:{label:'관리자',system:true,order:0}, manager:{label:'중간관리자',order:1}, staff:{label:'평사원',order:2} }`를 시드.
- `roles/features` → `roles/caps`로 흡수(csv/pdf 키 그대로, 나머지 동작 키는 기본 true).
- 변환은 읽기 시점(`rolePagesConfig` 등 접근자)에서 정규화하고, 관리자가 한 번 저장하면 신형으로 영구 기록.

## 5. Enforcement (클라이언트)

신규/변경 함수 (rbac.js):

- `roleRegistry()` — 역할 목록 반환(정규화·시드 포함)
- `pageAccessLevel(role, pageId)` → `'none'|'view'|'edit'` (admin·로컬모드는 항상 `'edit'`)
- `pageAllowed(id)` = `pageAccessLevel(currentRole, id) !== 'none'` (네비 차단은 기존과 동일하게 동작)
- `canEditPage(id)` = `pageAccessLevel(currentRole, id) === 'edit'`
- `canEditCurrentPage()` = `canEditPage(currentPage)`
- `capAllowed(cap)` — `roles/caps`에서 현재 역할의 능력 허용 여부(admin·로컬 항상 true)

`checkAdminAction()` 수정 (helpers-auth.js):

```
function checkAdminAction(fn = null) {
  if (!canEditCurrentPage()) {           // 보기전용 페이지 → 차단
    showToast('보기 전용 권한입니다. 편집할 수 없습니다.', 'error');
    return false;
  }
  if (fn) fn();
  return true;
}
```

- admin / 로컬(미인증) 모드는 `canEditCurrentPage()`가 항상 true → 기존과 동일.
- 보기(view) 모드에선 등록/편집/삭제/저장이 자동 차단됨(85곳 무수정).
- 추가로 보기 모드에선 편집 버튼을 CSS로 숨겨 UX 명확화(`applyEditGating()` — `applyColumnGating`/`applyFeatureGating`와 동일한 `<style>` 주입 패턴).

고위험 동작 게이팅:

- 능력 토글이 꺼진 동작은 해당 호출부에 `if (!capAllowed('monthClose')) { showToast(...); return; }` 형태로 점검 추가.
- 대상(고위험 동작 카탈로그): `delete`(행 삭제/일괄삭제), `bulk`(일괄 작업), `monthClose`(재무 월마감), `payrollConfirm`(급여 확정), `dataRestore`(데이터 복원/가져오기), `csv`(내보내기), `pdf`(인쇄/PDF).
- 버튼 숨김은 `applyFeatureGating`을 `applyCapGating`으로 일반화하여 처리.

## 6. UI (시스템 관리 → 권한 관리)

- **역할 관리 섹션 신설**: 역할 추가(라벨 입력) / 이름변경 / 삭제. admin·시스템 역할은 잠금. 삭제 시 해당 역할 사용자 처리 안내(기본 `staff`로 강등 제안).
- **접근 페이지 매트릭스**: 기존 on/off 칩을 **3단계 순환 칩**(없음 → 보기 → 편집, 색상 구분)으로 변경. "전체/해제" 단축은 전체=`edit`, 해제=`none`.
- **능력(기능·동작) 권한 섹션**: 기존 CSV/PDF에 고위험 동작 토글 추가.
- 역할 탭은 하드코딩(`manager`/`staff`) 대신 `roleRegistry()` 기반 **동적 생성**. (renderPermMatrix/renderPermColumns/renderPermFeatures의 `RL={...}`·`tab('manager')`·`tab('staff')` 전부 동적화)

## 7. 범위 / 비범위

**범위**
- 커스텀 역할 CRUD, 페이지 3단계 권한, 능력 토글, 관련 UI, 마이그레이션.
- 기존 동작 무손실(배열→맵, features→caps 자동 변환).

**비범위 (별도 작업)**
- 사용자별 개별 권한 예외(이번 제외).
- **Firestore 보안 규칙(서버측 enforcement)** — 클라이언트 게이팅은 본 앱의 기존 방식과 동일하게 *권고 수준*이다. 악의적 사용자가 콘솔/SDK로 직접 쓰는 것을 막는 진짜 경계는 서버 규칙이며, 이는 백엔드 과제로 분리한다.

## 8. 엣지 케이스 / 주의

- **관문 기준이 "현재 페이지"**: 한 화면에서 다른 페이지 데이터를 수정하는 드문 동작은 별도 점검 필요(대부분은 현재 페이지 기준이라 안전). 식별된 교차-페이지 동작은 개별 `capAllowed`/`canEditPage(targetPage)`로 보강.
- **system 페이지**는 계속 admin 전용(`pageAllowed`의 기존 분기 유지). 비관리자에게는 권한 편집 UI 자체가 노출되지 않음.
- **역할 삭제 후 잔존 사용자**: `users/{uid}.role`이 사라진 역할을 가리키면 `roleAllowedSet`가 빈 집합 → 안전(접근 없음). UI에서 강등 안내.
- **로컬/미인증 모드**: `cloudConfigured()===false`면 기존처럼 전체 권한(admin) 유지.

## 9. 성공 기준

- 관리자가 새 역할(예: "영업팀장")을 만들고, 페이지별로 없음/보기/편집을 지정하고, 고위험 동작을 개별 토글할 수 있다.
- 보기 권한 사용자는 해당 페이지를 열람하되 등록/수정/삭제 시 차단(토스트)되고 편집 버튼이 숨겨진다.
- 능력 토글이 꺼진 사용자는 해당 동작(예: 월마감)을 실행할 수 없다.
- 업그레이드 시 기존 manager/staff의 권한이 그대로 유지된다(배열→edit 변환).
- 빌드(`build.py`) 성공 및 기존 기능 회귀 없음.

## 10. 영향 파일 (예상)

- `src/js/rbac.js` — 모델/접근자/게이팅 함수
- `src/js/helpers-auth.js` — `checkAdminAction`
- `src/js/cloud-sync.js` — 권한 편집 UI(renderPermissions 및 하위), 저장 함수
- (참고) `src/js/navigation.js` — `pageAllowed` 시그니처 유지로 변경 최소
