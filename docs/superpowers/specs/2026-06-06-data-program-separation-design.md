# 프로그램 ↔ 데이터 파일 분리 설계

- 작성일: 2026-06-06
- 상태: 설계 확정 대기(사용자 검토용)
- 방식: B (프로그램과 데이터를 별도로 — 데이터는 HTML에서 제거)

## 1. 배경 / 문제

`MESPro.html`은 GitHub Pages로 배포되어 사용자가 URL로 접속한다. 실데이터는
Firebase Firestore에 저장되며, 로그인 시 자동 로드된다(`cloudConfigured() === true`).

그런데 배포물에는 **과거에 구워진 실데이터 스냅샷**이 박혀 있다.

- `src/index.template.html` 20번째 줄의 `<script id="embedded-data">`에 약 30KB의
  실데이터(거래처명·매출·협력사 연락처 등)가 들어 있음 (`_savedAt:2026-05-30`).
- `build.py`가 이 템플릿을 그대로 합치므로 **빌드할 때마다 데이터가 배포물에 포함**됨.
- 따라서 GitHub에 올라가는 `MESPro.html`에 실데이터가 매번 노출됨.

### 근본 원인 (둘)

1. **빌드 소스 오염**: `src/index.template.html`의 embedded-data에 실데이터가 박혀 있음.
2. **재오염 경로**: `_buildHTML()`(파일 저장/다운로드 시 호출)이 현재 모든 데이터를
   다시 embedded-data로 굽는다. → 사용자가 "파일 저장"을 누르면 데이터가 또 박힘.

### 현재 데이터 흐름 (확인됨)

- 실데이터 저장소: **Firebase Firestore** (로그인 시 로드) — 살아있는 단일 소스.
- localStorage(`mes_*`): 브라우저 로컬 캐시/미러.
- embedded-data: 첫 로드용 "초기 씨앗"일 뿐 (지금은 실데이터가 들어가 오염됨).
- File System Access 로컬 자동저장: `initAutoSave()`가 `cloudConfigured()`면
  즉시 return → **클라우드 모드에서는 작동하지 않음**(현재 사용자 = 클라우드 모드).

## 2. 목표 / 비목표

목표
- 배포되는 `MESPro.html`에 실데이터가 **코드 차원에서** 절대 포함되지 않게 한다
  (사람의 규율·기억에 의존하지 않음).
- 프로그램(HTML)과 데이터(파일)를 명확히 분리한다.
- 실데이터는 계속 Firebase가 담당한다(사용감 동일).
- 데이터 백업/이동용 **단일 데이터 파일**(`mes-data.json`)을 내보내기/가져오기로 제공.

비목표
- Firebase 구조 변경 없음.
- 연도/프로젝트별 분리(C안)는 이번 범위에서 제외(추후 별도 spec).
- 로컬 파일 자동저장(File System Access) 신규 도입/복원 안 함(클라우드 모드에서 불필요).

## 3. 설계

### 변경 ① 빌드 소스 청소 (핵심)
`src/index.template.html`의 embedded-data를 **빈 객체**로 교체한다.

```html
<script id="embedded-data" type="application/json">{}</script>
```

- `_savedAt`을 **넣지 않는다**. 이유: `initFromEmbedded()`는 embedded `_savedAt`이
  로컬보다 최신일 때만 localStorage를 덮어쓴다. 빈 데이터에 새 `_savedAt`을 주면
  기존 사용자의 로컬 캐시를 "빈 데이터가 최신"으로 오인해 지울 수 있다.
- 빈 `{}`이고 `_savedAt`이 없으면: `initFromEmbedded()`에서 `data._savedAt`이 없어
  `embeddedTime`은 빈 문자열 → 기존 사용자(localTime 있음)는 덮어쓰기 안 됨(안전),
  신규 사용자는 빈 상태로 시작 후 Firebase 로그인으로 데이터 로드(현재와 동일).

### 변경 ② `_buildHTML()`이 데이터를 굽지 않게 함 (재오염 차단)
`src/js/data-storage.js`의 `_buildHTML()`을 수정한다.

- payload에서 실데이터 키들을 제거하고 embedded-data를 항상 `{}`로 출력.
- `localStorage.setItem('mes__savedAt', now)` 줄은 **유지**한다(로컬 저장 시각 추적은
  embedded-data와 무관하며 기존 동작에 영향 없음). embedded payload만 비운다.
- 결과: "파일 저장/다운로드"를 눌러도 데이터가 HTML에 박히지 않음.

### 변경 ③ 데이터 파일 내보내기/가져오기 (`mes-data.json`)
프로그램과 분리된 **완전한 데이터 파일**을 제공한다(XLS 백업은 일부 엔티티만 포함하므로
JSON이 정식 백업/이동 포맷).

- `exportDataJSON()`: 전체 엔티티(25종)를 `_buildHTML`의 payload와 동일한 키 구성으로
  묶어 `mes-data-YYYYMMDD.json` 다운로드.
- `importDataJSON(input)`: 선택한 JSON을 검증 후 localStorage 전체 교체 →
  `reloadAllData()` → 화면 갱신 → (클라우드 모드면) Firebase에 반영.
  교체 전 확인 다이얼로그(`confirm_`)로 사고 방지.
- UI: `src/html/layout-top.html`의 XLS 백업/복구 버튼(216~222행) 옆에
  JSON 내보내기/가져오기 버튼 2개 + 숨김 `<input type=file accept=".json">` 추가.

### 변경 ④ 배포물 재생성 및 저장소 청소
- `python build.py` 실행 → 깨끗한(데이터 0) `MESPro.html` 생성.
- 기존 커밋된 `MESPro.html`의 박힌 30KB 데이터가 제거됨을 확인(grep으로 검증).

## 4. 위험 / 엣지 케이스

- **기존 사용자 로컬 캐시 보존**: 변경 ①에서 `_savedAt` 미포함이 핵심. 포함 시 캐시 삭제 위험.
- **`mes__savedAt` 정합성**: embedded-data가 항상 비므로 `initFromEmbedded`의 시각
  비교에는 영향 없음(빈 데이터는 덮어쓰기 후보가 아님). `mes__savedAt` 갱신은 유지하고
  embedded payload만 비운다(변경 ② 확정).
- **importDataJSON 검증**: 잘못된/구버전 JSON 입력 시 부분 키 누락 처리(없는 키는 기존
  default 유지). 최소한 최상위가 객체인지, 알려진 키만 적용.
- **공개 저장소였던 경우**: 이미 노출된 과거 커밋의 데이터는 git 이력에 남는다. 이번 작업은
  "앞으로 안 새게" 만든다. 과거 이력 제거(필요 시)는 별도 작업(저장소 public/private 확인 후 결정).

## 5. 영향 파일

- `src/index.template.html` — embedded-data를 `{}`로 (변경 ①)
- `src/js/data-storage.js` — `_buildHTML()` 수정(변경 ②), `exportDataJSON`/`importDataJSON` 추가(변경 ③)
- `src/html/layout-top.html` — JSON 내보내기/가져오기 버튼 추가(변경 ③)
- `MESPro.html` — `build.py` 재실행으로 재생성(변경 ④)

## 6. 검증

- `grep "현대리바트\|한컴라이프케어" MESPro.html` → 매치 0 (데이터 제거 확인).
- `grep -o 'id="embedded-data"[^<]*' MESPro.html` → `{}` 만 남음.
- 브라우저에서 로그인 → Firebase 데이터 정상 표시(사용감 동일).
- 데이터 내보내기 → `mes-data.json` 다운로드 → (다른 브라우저/초기화 후) 가져오기 →
  데이터 복원 확인(라운드트립).
- "파일 저장/다운로드" 후 결과 HTML에 데이터 미포함 확인(재오염 차단 확인).
