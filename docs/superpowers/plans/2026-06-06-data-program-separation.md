# 프로그램 ↔ 데이터 파일 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포되는 `MESPro.html`에서 실데이터를 코드 차원에서 완전히 제거하고, 데이터는 Firebase(실시간) + `mes-data.json`(백업/이동) 파일로 분리한다.

**Architecture:** ① 빌드 소스(`src/index.template.html`)의 embedded-data를 빈 `{}`로 만들고, ② 재오염 경로(`_buildHTML()`)가 데이터를 굽지 않게 막고, ③ 전체 데이터를 `mes-data.json`으로 내보내기/가져오기하는 기능을 추가한 뒤, ④ 빌드해 깨끗한 배포물을 만든다. 실데이터는 그대로 Firebase가 담당하므로 사용감은 동일하다.

**Tech Stack:** Vanilla JS(전역 스코프), `build.py`(`<!--#include-->` 병합), localStorage(`mes_*`), Firebase Firestore, File System Access. 자동 테스트 프레임워크 없음 → 검증은 `grep`/빌드/브라우저 수동 확인으로 수행.

**참고:** 이 프로젝트는 빌드 산출물(`MESPro.html`)을 직접 편집하지 않는다. 항상 `src/`를 수정하고 `python build.py`로 생성한다 (MEMORY: MESPro build structure).

---

## File Structure

- `src/index.template.html` — 수정: embedded-data 씨앗을 빈 `{}`로
- `src/js/data-storage.js` — 수정: `_buildHTML()` payload 비우기 / 추가: `exportDataJSON()`, `importDataJSON()`
- `src/html/layout-top.html` — 수정: JSON 내보내기/가져오기 버튼 + 파일 input 추가
- `MESPro.html` — 재생성: `python build.py`

데이터 엔티티 정식 키 목록 (DATA_KEYS, 25종, `initFromEmbedded` keyMap 기준):
`clients, products, materials, workOrders, workers, defects, claims, checkRecords, alerts, inventory, deliveries, stages, trash, rfqList, poList, partners, financeData, attendance, leaves, statementList, taxList, quoteList, orderList, inventoryLedger, alimtalkSettings`

주의: 일부 JS 변수명은 localStorage 키와 다름 — `alerts`↔변수 `alertsList`, `stages`↔변수 `processStages`. 내보내기/가져오기는 **localStorage 키 기준**으로 처리해 이 불일치를 피한다.

---

### Task 1: 빌드 소스의 embedded-data 비우기 (변경 ①)

**Files:**
- Modify: `src/index.template.html:20`

- [ ] **Step 1: 현재 박힌 데이터 확인 (실패=데이터 있음 상태 확인)**

Run: `grep -c "현대리바트" src/index.template.html`
Expected: `1` (실데이터가 박혀 있음 — 제거 대상 확인)

- [ ] **Step 2: embedded-data를 빈 객체로 교체**

`src/index.template.html` 20번째 줄 전체(긴 `<script id="embedded-data">...</script>` 한 줄)를 아래로 교체. `_savedAt`을 넣지 않는 것이 핵심(기존 사용자 로컬 캐시 보존):

```html
<script id="embedded-data" type="application/json">{}</script>
```

- [ ] **Step 3: 데이터 제거 검증**

Run: `grep -c "현대리바트\|한컴라이프케어\|예주산업" src/index.template.html`
Expected: `0`

Run: `grep -o 'id="embedded-data"[^<]*' src/index.template.html`
Expected: `id="embedded-data" type="application/json">{}`

- [ ] **Step 4: 커밋**

```bash
git add src/index.template.html
git commit -m "fix: 빌드 소스 embedded-data를 빈 객체로 — 배포물 데이터 오염 차단"
```

---

### Task 2: `_buildHTML()`이 데이터를 굽지 않게 (변경 ②)

**Files:**
- Modify: `src/js/data-storage.js:282-300` (`_buildHTML` 함수)

- [ ] **Step 1: 현재 payload 확인**

Run: `grep -n "rfqList, poList, partners, financeData" src/js/data-storage.js`
Expected: `_buildHTML` 내부 payload 줄이 매치됨 (데이터를 굽고 있음 확인)

- [ ] **Step 2: payload를 빈 객체로 변경**

`src/js/data-storage.js`의 `_buildHTML()` 안에서 아래 블록을 찾는다:

```javascript
function _buildHTML() {
  const now = new Date().toISOString();
  localStorage.setItem('mes__savedAt', now);
  const payload = JSON.stringify({
    _savedAt: now,
    clients, products, materials, workOrders, workers,
    defects, claims, checkRecords, alerts: alertsList,
    inventory, deliveries, stages: processStages, trash,
    rfqList, poList, partners, financeData, attendance, leaves,
    statementList, taxList, quoteList, orderList
  });
```

아래로 교체한다 (`mes__savedAt` 갱신 줄은 유지, embedded payload만 빈 객체로):

```javascript
function _buildHTML() {
  const now = new Date().toISOString();
  localStorage.setItem('mes__savedAt', now);
  // 데이터는 더 이상 HTML에 굽지 않는다. 실데이터는 Firebase + mes-data.json이 담당.
  // 배포물(HTML)에 데이터가 들어가지 않도록 embedded-data는 항상 빈 객체.
  const payload = '{}';
```

주의: 기존 `payload`는 `JSON.stringify(...)`의 결과(문자열)였고, 이후 `O + payload + C`로
문자열 연결에 쓰인다. `'{}'`도 문자열이므로 이후 코드는 그대로 동작한다. `_savedAt` 변수
정의가 사라지지만 payload 외에는 참조되지 않으므로 문제 없음(`now`는 `mes__savedAt` 갱신에만 사용).

- [ ] **Step 3: 변경 검증**

Run: `grep -n "const payload = '{}'" src/js/data-storage.js`
Expected: 1줄 매치

Run: `grep -n "alerts: alertsList" src/js/data-storage.js`
Expected: 매치 0 (payload에서 데이터 키 제거됨)

- [ ] **Step 4: 커밋**

```bash
git add src/js/data-storage.js
git commit -m "fix: _buildHTML이 데이터를 HTML에 굽지 않도록 — 파일 저장 재오염 차단"
```

---

### Task 3: `mes-data.json` 내보내기/가져오기 함수 추가 (변경 ③)

**Files:**
- Modify: `src/js/data-storage.js` (`saveAsFile` 함수 끝 다음, 약 365행 뒤에 추가)

- [ ] **Step 1: 삽입 위치 확인**

Run: `grep -n "XLS 전체 데이터 내보내기" src/js/data-storage.js`
Expected: `exportAllXLS` 주석 줄 번호 확인 (이 주석 바로 위에 새 함수들을 삽입)

- [ ] **Step 2: export/import 함수 추가**

`src/js/data-storage.js`에서 `/* ════════ XLS 전체 데이터 내보내기 ════════ */` 주석 줄을 찾아,
그 **바로 앞**에 아래 코드를 삽입한다:

```javascript
/* ════════ 전체 데이터 JSON 파일 내보내기/가져오기 (프로그램 ↔ 데이터 분리) ════════ */
const DATA_KEYS = [
  'clients','products','materials','workOrders','workers','defects','claims',
  'checkRecords','alerts','inventory','deliveries','stages','trash','rfqList',
  'poList','partners','financeData','attendance','leaves','statementList',
  'taxList','quoteList','orderList','inventoryLedger','alimtalkSettings'
];

function exportDataJSON() {
  const out = { _savedAt: new Date().toISOString() };
  DATA_KEYS.forEach(k => {
    const raw = localStorage.getItem('mes_' + k);
    if (raw != null) {
      try { out[k] = JSON.parse(raw); } catch(e) { /* 손상 키는 건너뜀 */ }
    }
  });
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mes-data-${today().replace(/-/g,'')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('데이터 파일(mes-data.json) 내보내기 완료', 'success');
}

function importDataJSON(input) {
  const file = input.files[0];
  if (!file) return;
  confirm_('데이터 파일 가져오기',
    `<strong>${file.name}</strong> 파일을 불러옵니다.<br>
    <span style="color:var(--tx-d); font-size:12px;">⚠ 현재 저장된 모든 데이터가 파일의 내용으로 교체됩니다.</span>`,
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        let data;
        try { data = JSON.parse(e.target.result); }
        catch(err) { showToast('JSON 파싱 실패: ' + err.message, 'error'); return; }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          showToast('올바른 데이터 파일이 아닙니다.', 'error'); return;
        }
        let applied = 0;
        DATA_KEYS.forEach(k => {
          if (data[k] != null) {
            localStorage.setItem('mes_' + k, JSON.stringify(data[k]));
            applied++;
            if (typeof cloudQueueSave === 'function') cloudQueueSave(k);   // 클라우드 반영
          }
        });
        localStorage.setItem('mes__savedAt', new Date().toISOString());
        reloadAllData();
        if (typeof _goTo === 'function') _goTo(currentPage || 'dashboard', null);
        showToast(`데이터 가져오기 완료 — ${applied}개 항목 복원`, 'success');
      };
      reader.readAsText(file);
    });
  input.value = '';   // 같은 파일 재선택 가능하도록 초기화
}
```

- [ ] **Step 3: 함수 추가 검증**

Run: `grep -n "function exportDataJSON\|function importDataJSON\|const DATA_KEYS" src/js/data-storage.js`
Expected: 3줄 매치

- [ ] **Step 4: 커밋**

```bash
git add src/js/data-storage.js
git commit -m "feat: 전체 데이터 mes-data.json 내보내기/가져오기 함수 추가"
```

---

### Task 4: JSON 내보내기/가져오기 UI 버튼 추가 (변경 ③ UI)

**Files:**
- Modify: `src/html/layout-top.html:215-222` (XLS 버튼 영역)

- [ ] **Step 1: 삽입 위치 확인**

Run: `grep -n "xls-import-input" src/html/layout-top.html`
Expected: 222행 부근 매치 (이 input 다음 줄에 JSON 버튼 삽입)

- [ ] **Step 2: JSON 버튼 추가**

`src/html/layout-top.html`에서 아래 줄을 찾는다:

```html
      <input type="file" id="xls-import-input" accept=".xlsx,.xls" style="display:none;" onchange="importAllXLS(this)">
```

이 줄 **바로 다음**에 아래를 삽입한다:

```html

      <!-- JSON 데이터 파일 백업/복구 (프로그램 ↔ 데이터 분리) -->
      <button class="theme-btn xls-btn" onclick="exportDataJSON()" title="전체 데이터 JSON 백업(mes-data.json)" style="font-size:13px; padding:4px 9px; display:flex; align-items:center;">
        <i class="ti ti-file-code-2" style="font-size:15px;"></i>
      </button>
      <button class="theme-btn xls-btn" onclick="inp('json-import-input').click()" title="JSON에서 데이터 복구" style="font-size:13px; padding:4px 9px; display:flex; align-items:center;">
        <i class="ti ti-database-import" style="font-size:15px;"></i>
      </button>
      <input type="file" id="json-import-input" accept=".json,application/json" style="display:none;" onchange="importDataJSON(this)">
```

- [ ] **Step 3: 버튼 추가 검증**

Run: `grep -n "json-import-input\|exportDataJSON()" src/html/layout-top.html`
Expected: 2줄 이상 매치

- [ ] **Step 4: 커밋**

```bash
git add src/html/layout-top.html
git commit -m "feat: 상단바에 JSON 데이터 내보내기/가져오기 버튼 추가"
```

---

### Task 5: 빌드 및 최종 검증 (변경 ④)

**Files:**
- Regenerate: `MESPro.html`

- [ ] **Step 1: 빌드 실행**

Run: `python build.py`
Expected: 빌드 성공 메시지 (오류 없음)

- [ ] **Step 2: 배포물에 데이터가 없는지 검증**

Run: `grep -c "현대리바트\|한컴라이프케어\|예주산업\|제이씨인터내쇼날" MESPro.html`
Expected: `0`

Run: `grep -o 'id="embedded-data"[^<]*' MESPro.html`
Expected: `id="embedded-data" type="application/json">{}` (한 번만, 빈 객체)

- [ ] **Step 3: 새 함수/버튼이 빌드에 포함됐는지 검증**

Run: `grep -c "function exportDataJSON\|function importDataJSON" MESPro.html`
Expected: `2`

Run: `grep -c "json-import-input" MESPro.html`
Expected: `2` (버튼 onclick + input id)

- [ ] **Step 4: 브라우저 수동 검증 (사용자 확인)**

다음을 사용자에게 안내해 확인받는다:
1. `MESPro.html`을 브라우저에서 열고 로그인 → 기존 데이터가 정상 표시되는지(Firebase 로드, 사용감 동일).
2. 상단바 JSON 백업 버튼 클릭 → `mes-data-YYYYMMDD.json` 다운로드되고 내용에 데이터가 들어있는지.
3. (선택) 다른 브라우저/시크릿 창에서 열고 JSON 가져오기 → 데이터 복원되는지(라운드트립).

- [ ] **Step 5: 커밋**

```bash
git add MESPro.html
git commit -m "build: 데이터 분리 적용된 깨끗한 MESPro.html 재생성"
```

---

## Self-Review (작성자 점검 완료)

- **Spec 커버리지:** 변경 ①→Task1, ②→Task2, ③→Task3+4, ④→Task5. 모두 매핑됨.
- **Placeholder:** 없음. 모든 코드 블록은 실제 삽입 가능한 완성 코드.
- **타입/이름 일관성:** `DATA_KEYS`(Task3 정의)를 `exportDataJSON`/`importDataJSON`에서 동일 사용.
  버튼 id `json-import-input`(Task4)과 `importDataJSON(this)` 호출 일치. `exportDataJSON`/
  `importDataJSON` 함수명이 Task3 정의와 Task4 onclick에서 일치.
- **위험 반영:** Task1에서 `_savedAt` 미포함(기존 캐시 보존), Task2에서 `mes__savedAt` 갱신 유지.
- **의존 함수 확인:** `today()`, `showToast()`, `confirm_()`, `reloadAllData()`, `_goTo()`,
  `cloudQueueSave()`, `inp()`, `currentPage` 모두 기존 코드에 존재(데이터/네비/유틸 계층).
