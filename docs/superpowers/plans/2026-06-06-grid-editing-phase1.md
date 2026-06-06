# 스프레드시트 그리드 편집 — Phase 1 (토대) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자재 전용 인라인 편집 엔진을 다중 표 지원 범용 엔진(`gridify`)으로 일반화하고, RBAC에 "편집(edit)" 권한을 추가하며, 자재 + 파일럿 표 2개(협력사·재고)에 적용한다.

**Architecture:** 헤더 `<th>`의 `data-field`/`data-type`는 DOM 선언형으로 편집 메타를 제공하고, 라이브 데이터 배열 접근·저장·재렌더는 JS 등록(`gridify(cont,{data,save,rerender,idField,newRow})`)으로 제공한다(전역이 `let` 스코프라 `window[]` 접근 불가하기 때문). 선택/편집 위치는 `{contId,id,field}`로 추적해 열 순서·재렌더에 무관하게 복원한다. 모든 쓰기는 `canEdit()` 게이팅.

**Tech Stack:** Vanilla JS(전역 스코프, IIFE 모듈), `build.py` 병합, localStorage(`mes_*`) + `saveStorage`, RBAC(`roleFeaturesConfig`, `currentRole`). 자동 테스트 없음 → 검증은 `node --check` + `grep` + 빌드 + 브라우저 수동.

**참고:** `src/`만 수정하고 `python build.py`로 `MESPro.html` 생성. 빌드물 직접 편집 금지.

---

## File Structure

- `src/js/rbac.js` — `FEATURE_DEFS`에 `edit` 추가, `canEditFeature()` 추가 (Task 1)
- `src/js/table-inline-edit.js` — 범용 엔진으로 전면 개편: `gridify(cont,cfg)` + `window.initMatInlineEdit` 하위호환 (Task 2)
- `src/js/materials.js` — render 끝의 `initMatInlineEdit()` 호출을 `gridify(...)`로 교체 (Task 3). 헤더엔 이미 `data-field` 있음.
- `src/js/partners.js` — bp-table 헤더에 `data-field`/`data-type` 추가 + render 끝 `gridify` (Task 4)
- `src/js/inventory.js` — inventory-table 헤더에 `data-field`/`data-type` + `gridify` (Task 5)
- `MESPro.html` — 빌드 재생성 (Task 6)

엔진 공개 API:
```
gridify(containerEl, {
  data:     () => <라이브 배열>,     // 필수. 예: () => materials
  save:     () => <저장>,            // 필수. 예: () => saveStorage('materials', materials)
  rerender: <함수>,                  // 필수. 예: renderMaterials
  idField:  'id',                    // 선택, 기본 'id'
  newRow:   () => <새 레코드>         // 선택(Phase 3 행추가용; Phase 1 미사용)
})
```
헤더 `<th data-field="name" data-type="text|number|date|textarea">` 가 편집 대상·자료형을 정의.

---

### Task 1: RBAC에 "편집" 권한 추가

**Files:**
- Modify: `src/js/rbac.js:87` (`FEATURE_DEFS`)
- Modify: `src/js/rbac.js` (`canEditFeature()` 추가)

- [ ] **Step 1: 현재 FEATURE_DEFS 확인**

Run: `grep -n "const FEATURE_DEFS" src/js/rbac.js`
Expected: 87행 `const FEATURE_DEFS = [ {key:'csv',...}, {key:'pdf',...} ];`

- [ ] **Step 2: FEATURE_DEFS에 edit 항목 추가**

`src/js/rbac.js`의 아래 줄을:
```javascript
const FEATURE_DEFS = [ {key:'csv', label:'엑셀 CSV 내보내기', icon:'ti-file-spreadsheet'}, {key:'pdf', label:'PDF·인쇄 출력', icon:'ti-printer'} ];
```
다음으로 교체:
```javascript
const FEATURE_DEFS = [ {key:'csv', label:'엑셀 CSV 내보내기', icon:'ti-file-spreadsheet'}, {key:'pdf', label:'PDF·인쇄 출력', icon:'ti-printer'}, {key:'edit', label:'셀 직접 편집', icon:'ti-edit'} ];
```

- [ ] **Step 3: canEditFeature() 추가**

`src/js/rbac.js`에서 `function roleFeaturesConfig(){ ... }` 줄(88행 부근)을 찾아, 그 **바로 다음 줄**에 추가:
```javascript
/* 현재 역할이 셀 직접 편집 권한을 가지는지 (admin 항상 허용, 기본 허용) */
function canEditFeature(){
  if (typeof currentRole === 'undefined') return true;
  if (currentRole === 'admin') return true;
  const f = roleFeaturesConfig()[currentRole] || {};
  return f.edit !== false;
}
```

- [ ] **Step 4: 검증**

Run: `grep -c "key:'edit'" src/js/rbac.js`
Expected: `1`
Run: `grep -c "function canEditFeature" src/js/rbac.js`
Expected: `1`
Run: `node --check src/js/rbac.js && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add src/js/rbac.js
git commit -m "feat(rbac): '셀 직접 편집' 기능 권한 추가 + canEditFeature()"
```

---

### Task 2: 범용 그리드 엔진으로 개편

**Files:**
- Modify(전면 교체): `src/js/table-inline-edit.js`

- [ ] **Step 1: 파일 전체를 아래 내용으로 교체**

`src/js/table-inline-edit.js` 전체를 다음으로 교체:

```javascript
/* ════════ 범용 표 인라인 편집 엔진 (그리드) ════════
   다중 표 지원. 헤더 <th data-field/data-type> 로 편집 메타, gridify(cont,cfg)로 데이터 접근 등록.
   선택/편집 위치는 {contId,id,field} 로 추적 → 열 순서·재렌더 무관 복원. 쓰기는 canEditFeature() 게이팅. */
(function () {
  'use strict';

  const CFG = {};          // contId -> { data, save, rerender, idField, newRow }
  let docBound = false;
  let sel = null;          // { contId, id, field }
  let edit = null;         // { contId, id, field, orig }

  function canWrite(){ return (typeof canEditFeature === 'function') ? canEditFeature() : true; }

  /* ── 등록/초기화 ── */
  function gridify(cont, cfg) {
    if (!cont || !cfg) return;
    CFG[cont.id] = { data: cfg.data, save: cfg.save, rerender: cfg.rerender,
                     idField: cfg.idField || 'id', newRow: cfg.newRow || null };
    cont.setAttribute('data-grid', '1');
    cont.classList.add('grid-editable');
    if (!cont.dataset.gridInit) {
      cont.dataset.gridInit = '1';
      cont.addEventListener('click', onClick);
      cont.addEventListener('dblclick', onDbl);
    }
    if (!docBound) {
      docBound = true;
      document.addEventListener('keydown', onDocKey, true);
      document.addEventListener('paste', onDocPaste);
    }
  }

  /* ── 헬퍼 ── */
  function contById(id){ return document.getElementById(id); }
  function cfgOf(cont){ return cont ? CFG[cont.id] : null; }
  function arrOf(c){ return c && typeof c.data === 'function' ? c.data() : null; }
  function ths(cont){ return cont ? cont.querySelectorAll('thead th') : []; }
  function colCount(cont){ return ths(cont).length; }
  function tbodyOf(cont){ return cont ? cont.querySelector('tbody') : null; }
  function metaAt(cont, col){
    const th = ths(cont)[col];
    if (!th) return { field:null, type:'text', editable:false };
    const field = th.dataset.field || null;
    return { field:field, type: th.dataset.type || 'text', editable: !!field };
  }
  function colOfField(cont, field){
    const list = ths(cont);
    for (let i=0;i<list.length;i++) if (list[i].dataset.field === field) return i;
    return -1;
  }
  function fieldAtCol(cont, col){ const th = ths(cont)[col]; return th ? (th.dataset.field || null) : null; }
  function idColOf(cont, c){ return colOfField(cont, c.idField); }
  function idOfTr(cont, c, tr){ const ic = idColOf(cont, c); return (ic>=0 && tr.cells[ic]) ? tr.cells[ic].textContent.trim() : null; }
  function rowTr(cont, c, id){
    const tb = tbodyOf(cont); if (!tb) return null;
    const ic = idColOf(cont, c); if (ic<0) return null;
    return Array.prototype.find.call(tb.rows, tr => tr.cells[ic] && tr.cells[ic].textContent.trim() === id) || null;
  }
  function tdOf(cont, c, id, field){
    const tr = rowTr(cont, c, id); if (!tr) return null;
    const col = colOfField(cont, field); if (col<0) return null;
    return tr.cells[col] || null;
  }
  function recOf(c, id){ const a = arrOf(c); return a ? a.find(x => String(x[c.idField]) === String(id)) || null : null; }
  function rawVal(rec, type, field){ const v = rec[field]; return type==='number' ? String(v==null?0:v) : (v==null?'':v); }
  function applyVal(rec, type, field, val){ rec[field] = (type==='number') ? (parseInt(val,10)||0) : val; }

  /* ── 선택 하이라이트 ── */
  function clearHL(){ document.querySelectorAll('.cell-sel').forEach(el=>el.classList.remove('cell-sel')); }
  function setSel(contId, id, field){
    clearHL(); sel = { contId, id, field };
    const cont = contById(contId), c = CFG[contId];
    const td = (cont && c) ? tdOf(cont, c, id, field) : null;
    if (td) td.classList.add('cell-sel');
  }
  function restoreSel(){ const s = sel; if (s) setTimeout(()=>{ if (sel===s || (sel && sel.id===s.id)) setSel(s.contId, s.id, s.field); }, 50); }
  function persist(cont, c){ if (c.save) c.save(); if (typeof c.rerender==='function') c.rerender(); restoreSel(); }

  /* ── 이벤트 ── */
  function gridContOf(el){ return el ? el.closest('[data-grid]') : null; }
  function onClick(e){
    if (e.target.closest('select, button, input, textarea')) return;
    const td = e.target.closest('td'); if (!td || !td.closest('tbody')) return;
    const cont = gridContOf(td); if (!cont) return;
    const c = cfgOf(cont); if (!c) return;
    const id = idOfTr(cont, c, td.closest('tr'));
    const field = fieldAtCol(cont, td.cellIndex);
    if (id == null) return;
    if (edit) commitEdit();
    setSel(cont.id, id, field);
  }
  function onDbl(e){
    if (e.target.closest('select, button')) return;
    const td = e.target.closest('td'); if (!td) return;
    const cont = gridContOf(td); if (!cont) return;
    const c = cfgOf(cont); if (!c) return;
    const id = idOfTr(cont, c, td.closest('tr'));
    const field = fieldAtCol(cont, td.cellIndex);
    if (id != null && field) startEdit(cont.id, id, field);
  }

  /* ── 편집 ── */
  function startEdit(contId, id, field){
    if (!canWrite()) return;
    const cont = contById(contId), c = CFG[contId]; if (!c) return;
    const col = colOfField(cont, field), meta = metaAt(cont, col);
    if (!meta.editable) return;
    if (edit) commitEdit();
    const rec = recOf(c, id); if (!rec) return;
    const td = tdOf(cont, c, id, field); if (!td) return;
    edit = { contId, id, field, orig: td.textContent.trim() };
    const isNote = (meta.type === 'textarea');
    const el = document.createElement(isNote ? 'textarea' : 'input');
    if (!isNote){ el.type = meta.type==='date'?'date':meta.type==='number'?'number':'text'; if (el.type==='number') el.min='0'; }
    else el.rows = 2;
    el.value = rawVal(rec, meta.type, field); el.className = 'cell-inp';
    td.classList.add('cell-edit'); td.innerHTML=''; td.appendChild(el); el.focus(); try{ el.select(); }catch(err){}
    el.addEventListener('blur', ()=> setTimeout(()=>{ if (edit && edit.id===id && edit.field===field) commitEdit(); }, 80));
    el.addEventListener('keydown', ev=>{
      if (ev.key==='Escape'){ ev.stopPropagation(); cancelEdit(); }
      else if (ev.key==='Enter' && !isNote){ ev.preventDefault(); commitEdit(); moveFocus(contId, id, field, 'down'); }
      else if (ev.key==='Tab'){ ev.preventDefault(); commitEdit(); moveFocus(contId, id, field, ev.shiftKey?'left':'right'); }
    });
  }
  function commitEdit(){
    if (!edit) return;
    const { contId, id, field } = edit; edit = null;
    const cont = contById(contId), c = CFG[contId];
    const td = tdOf(cont, c, id, field);
    const inp = td && td.querySelector('input, textarea');
    const val = inp ? inp.value.trim() : '';
    const rec = recOf(c, id), col = colOfField(cont, field), meta = metaAt(cont, col);
    if (rec){ applyVal(rec, meta.type, field, val); persist(cont, c); }
  }
  function cancelEdit(){
    if (!edit) return;
    const { contId, id, field, orig } = edit; edit = null;
    const cont = contById(contId), c = CFG[contId];
    const td = tdOf(cont, c, id, field);
    if (td){ td.classList.remove('cell-edit'); td.textContent = orig; }
  }

  /* ── Tab/Enter 이동 ── */
  function moveFocus(contId, id, field, dir){
    const cont = contById(contId), c = CFG[contId];
    if (dir==='down'){
      const tb = tbodyOf(cont), tr = rowTr(cont, c, id); if (!tb || !tr) return;
      const rows = Array.prototype.slice.call(tb.rows), ri = rows.indexOf(tr);
      const nr = Math.min(ri+1, rows.length-1), nid = idOfTr(cont, c, rows[nr]);
      if (nid) setSel(contId, nid, field);
      return;
    }
    let col = colOfField(cont, field); const N = colCount(cont), step = dir==='right'?1:-1;
    col += step;
    while (col>=0 && col<N){ if (metaAt(cont, col).editable) break; col += step; }
    if (col<0 || col>=N) return;
    const nf = fieldAtCol(cont, col); if (nf) setSel(contId, id, nf);
  }

  /* ── 문서 키보드 ── */
  function activeCont(){ return sel ? contById(sel.contId) : null; }
  function onDocKey(e){
    if (edit) return;
    if (!sel) return;
    const cont = activeCont(); if (!cont) return;
    const c = cfgOf(cont); if (!c) return;
    const pg = cont.closest('[id^="pg-"]');
    if (pg && (pg.style.display==='none' || pg.hidden)) return;
    const tb = tbodyOf(cont); if (!tb) return;
    const k = e.key;
    if (k==='ArrowDown' || k==='ArrowUp'){
      e.preventDefault();
      const tr = rowTr(cont, c, sel.id); if (!tr) return;
      const rows = Array.prototype.slice.call(tb.rows), ri = rows.indexOf(tr);
      const nr = k==='ArrowDown'?Math.min(ri+1,rows.length-1):Math.max(ri-1,0);
      const nid = idOfTr(cont, c, rows[nr]); if (nid) setSel(cont.id, nid, sel.field);
    } else if (k==='ArrowRight' || k==='ArrowLeft'){
      e.preventDefault();
      let col = colOfField(cont, sel.field); col += (k==='ArrowRight'?1:-1);
      col = Math.max(0, Math.min(col, colCount(cont)-1));
      const nf = fieldAtCol(cont, col); if (nf) setSel(cont.id, sel.id, nf);
    } else if (k==='Enter' || k==='F2'){
      e.preventDefault(); startEdit(cont.id, sel.id, sel.field);
    } else if (k==='Delete' || k==='Backspace'){
      const col = colOfField(cont, sel.field), meta = metaAt(cont, col);
      if (!meta.editable || !canWrite()) return;
      const rec = recOf(c, sel.id);
      if (rec){ applyVal(rec, meta.type, sel.field, ''); persist(cont, c); }
    }
  }

  /* ── 붙여넣기 (단일/다중) ── */
  function onDocPaste(e){
    if (edit) return;
    if (!sel || !canWrite()) return;
    const cont = activeCont(); if (!cont) return;
    const c = cfgOf(cont); if (!c) return;
    const tb = tbodyOf(cont); if (!tb) return;
    const text = (e.clipboardData || window.clipboardData).getData('text'); if (!text) return;
    e.preventDefault();
    const rows = Array.prototype.slice.call(tb.rows);
    const startTr = rowTr(cont, c, sel.id), startRi = rows.indexOf(startTr), startCol = colOfField(cont, sel.field);
    const pasteRows = text.split(/\r?\n/).filter(r => r !== '');
    let changed = false;
    pasteRows.forEach((rowStr, r)=>{
      const tr = rows[startRi+r]; if (!tr) return;
      const id = idOfTr(cont, c, tr), rec = recOf(c, id); if (!rec) return;
      const cells = rowStr.split('\t'), N = colCount(cont); let ci = 0;
      for (let col=startCol; col<N && ci<cells.length; col++, ci++){
        const meta = metaAt(cont, col);
        if (meta.editable){ applyVal(rec, meta.type, meta.field, cells[ci].trim()); changed = true; }
      }
    });
    if (changed) persist(cont, c);
  }

  /* ── 공개 API ── */
  window.gridify = gridify;
  window.gridCanWrite = canWrite;
  // 하위호환: 기존 materials 호출부가 남아 있어도 안전 (실제 등록은 Task 3에서 gridify로 대체)
  window.initMatInlineEdit = function(){};
})();
```

- [ ] **Step 2: 구문 검증**

Run: `node --check src/js/table-inline-edit.js && echo OK`
Expected: `OK`
Run: `grep -c "function gridify" src/js/table-inline-edit.js`
Expected: `1`
Run: `grep -c "#mat-table" src/js/table-inline-edit.js`
Expected: `0`  (자재 하드코딩 제거 확인)

- [ ] **Step 3: 커밋**

```bash
git add src/js/table-inline-edit.js
git commit -m "refactor(grid): 인라인 편집 엔진을 다중 표 지원 gridify()로 일반화"
```

---

### Task 3: 자재 표를 새 엔진으로 이관

**Files:**
- Modify: `src/js/materials.js` (renderMaterials 끝의 초기화 호출)

- [ ] **Step 1: 현재 초기화 호출 위치 확인**

Run: `grep -n "initMatInlineEdit" src/js/materials.js`
Expected: renderMaterials 끝에서 `setTimeout(initMatInlineEdit, 0)` 형태 호출 1곳(또는 직접 호출).

- [ ] **Step 2: gridify 호출로 교체**

`src/js/materials.js` 118행의 정확히 이 줄을 찾는다:
```javascript
  if (typeof initMatInlineEdit === 'function') setTimeout(initMatInlineEdit, 0);
```
이를 아래로 교체(컨테이너 id는 `mat-table`):
```javascript
  setTimeout(() => { const c = inp('mat-table'); if (c && typeof gridify==='function') gridify(c, { data: () => materials, save: () => saveStorage('materials', materials), rerender: renderMaterials, idField: 'id' }); }, 0);
```

- [ ] **Step 3: 자재 헤더에 data-field가 이미 있는지 확인 (변경 불필요 확인)**

Run: `grep -c "data-field" src/js/materials.js`
Expected: ≥ 1 (헤더 헬퍼가 이미 `data-field`/`data-type` 출력 — 변경 없음).

- [ ] **Step 4: 검증**

Run: `grep -c "gridify(c, { data: () => materials" src/js/materials.js`
Expected: `1`
Run: `node --check src/js/materials.js && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add src/js/materials.js
git commit -m "refactor(materials): 인라인 편집을 범용 gridify 엔진으로 이관(동작 동일)"
```

---

### Task 4: 협력사(bp-table) 편집 활성화 (파일럿)

**Files:**
- Modify: `src/js/partners.js` (renderPartners 헤더 + 끝)

- [ ] **Step 1: bp-table 헤더 헬퍼와 끝 위치 확인**

Run: `grep -n "_bpth\|bp-table\|renderPartners" src/js/partners.js`
Expected: `_bpth(k,l,s)` 헤더 헬퍼, `const cont = inp('bp-table')`, 함수 끝.

- [ ] **Step 2: 편집 가능한 헤더에 data-field/data-type 부여**

`src/js/partners.js`의 헤더 헬퍼를 찾는다:
```javascript
  const _bpth = (k, l, s) => `<th onclick="toggleSort('partners','${k}')" style="cursor:pointer;user-select:none;${s||''}">${l} ${sortIcon('partners',k)}</th>`;
```
이를 아래로 교체(정렬키 `k`를 편집 필드로도 사용; 4번째 인자 `t`=자료형, 기본 text):
```javascript
  const _bpth = (k, l, s, t) => `<th data-field="${k}" data-type="${t||'text'}" onclick="toggleSort('partners','${k}')" style="cursor:pointer;user-select:none;${s||''}">${l} ${sortIcon('partners',k)}</th>`;
```
그리고 헤더 출력 줄에서 **id는 편집 대상에서 제외**(식별자)해야 하므로, `id` 컬럼은 `data-field`를 주지 않는다. 현재:
```javascript
      ${_bpth('id','코드')}${_bpth('name','거래처명')}${_bpth('type','유형')}${_bpth('manager','담당자')}
      <th>전화번호</th><th>이메일</th><th>사업자번호</th><th>비고</th><th style="text-align:center;">납기이행률</th><th>거래금액</th><th>관리</th>
```
다음으로 교체(코드 열은 식별자라 data-field 없이 일반 th로, 편집 가능한 열에 data-field 부여):
```javascript
      <th onclick="toggleSort('partners','id')" style="cursor:pointer;user-select:none;">코드 ${sortIcon('partners','id')}</th>${_bpth('name','거래처명')}${_bpth('type','유형')}${_bpth('manager','담당자')}
      <th data-field="tel" data-type="text">전화번호</th><th data-field="email" data-type="text">이메일</th><th data-field="bizNo" data-type="text">사업자번호</th><th data-field="note" data-type="text">비고</th><th style="text-align:center;">납기이행률</th><th>거래금액</th><th>관리</th>
```
주의: `id` 열은 행 식별자이므로 반드시 첫 열에 유지되고 텍스트로 표시되어야 한다(엔진이 idField='id' 셀에서 행 id를 읽음). 위 교체에서 코드 열을 일반 th(정렬 가능)로 두어 식별자 표시는 유지된다.

- [ ] **Step 3: renderPartners 끝에 gridify 등록**

`src/js/partners.js`의 `renderPartners()` 함수에서 `cont.innerHTML = ...` 로 표를 그린 직후(함수 끝 `}` 직전)에 추가:
```javascript
  setTimeout(() => { const c = inp('bp-table'); if (c && typeof gridify==='function') gridify(c, { data: () => partners, save: () => saveStorage('partners', partners), rerender: renderPartners, idField: 'id' }); }, 0);
```

- [ ] **Step 4: 검증**

Run: `grep -c "data-field=\"name\"\|data-field=\"tel\"" src/js/partners.js`
Expected: ≥ 1
Run: `grep -c "gridify(c, { data: () => partners" src/js/partners.js`
Expected: `1`
Run: `node --check src/js/partners.js && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add src/js/partners.js
git commit -m "feat(partners): 협력사 표 셀 편집 활성화(gridify 파일럿)"
```

---

### Task 5: 재고(inventory-table) 편집 활성화 (파일럿)

**Files:**
- Modify: `src/js/inventory.js` (renderInventory 헤더 + 끝)

- [ ] **Step 1: inventory-table 헤더와 끝 위치 확인**

Run: `grep -n "inventory-table\|<th\|function renderInventory" src/js/inventory.js`
Expected: 헤더 `<th>`들, `const cont = inp('inventory-table')`, 함수 끝.

- [ ] **Step 2: 편집 가능한 헤더에 data-field/data-type 부여**

`src/js/inventory.js`의 inventory 표 헤더 `<th>`들을 찾아, 편집 가능한 열에 `data-field`/`data-type`를 추가한다. inventory 레코드 필드: `id,name,type,unit,qty,minQty,location,note`. id 열은 식별자(편집 제외). 예를 들어 헤더가:
```html
<th>품목명</th><th>구분</th><th>단위</th><th>수량</th><th>최소수량</th><th>위치</th><th>비고</th>
```
형태라면 다음처럼 data-field 부여:
```html
<th data-field="name" data-type="text">품목명</th><th data-field="type" data-type="text">구분</th><th data-field="unit" data-type="text">단위</th><th data-field="qty" data-type="number">수량</th><th data-field="minQty" data-type="number">최소수량</th><th data-field="location" data-type="text">위치</th><th data-field="note" data-type="text">비고</th>
```
주의: 실제 헤더 문자열은 파일을 읽어 정확히 매칭해 교체할 것(컬럼 라벨/순서는 코드 기준). id(품목코드) 열은 식별자로 첫 열에 텍스트 표시 유지, data-field 주지 않음. 관리/작업 버튼 열도 data-field 없음.

- [ ] **Step 3: renderInventory 끝에 gridify 등록**

`renderInventory()`에서 표를 그린 직후(함수 끝 직전) 추가:
```javascript
  setTimeout(() => { const c = inp('inventory-table'); if (c && typeof gridify==='function') gridify(c, { data: () => inventory, save: () => saveStorage('inventory', inventory), rerender: renderInventory, idField: 'id' }); }, 0);
```

- [ ] **Step 4: 검증**

Run: `grep -c "gridify(c, { data: () => inventory" src/js/inventory.js`
Expected: `1`
Run: `grep -c "data-field=\"qty\" data-type=\"number\"" src/js/inventory.js`
Expected: ≥ 1
Run: `node --check src/js/inventory.js && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add src/js/inventory.js
git commit -m "feat(inventory): 재고 표 셀 편집 활성화(gridify 파일럿)"
```

---

### Task 6: 빌드 및 검증

**Files:**
- Regenerate: `MESPro.html`

- [ ] **Step 1: 빌드**

Run: `python build.py`
Expected: 빌드 성공.

- [ ] **Step 2: 엔진/등록 빌드 포함 검증**

Run: `grep -c "function gridify" MESPro.html`
Expected: ≥ 1
Run: `grep -c "gridify(c, { data: () => materials\|gridify(c, { data: () => partners\|gridify(c, { data: () => inventory" MESPro.html`
Expected: `3`
Run: `grep -c "key:'edit'" MESPro.html`
Expected: ≥ 1

- [ ] **Step 3: 데이터 청결 유지 확인**

Run: `grep -o 'id="embedded-data"[^<]*' MESPro.html | head -1`
Expected: `id="embedded-data" type="application/json">{}`

- [ ] **Step 4: 브라우저 수동 검증 (사용자 안내)**

다음을 사용자에게 안내해 확인받는다:
1. 자재 페이지: 셀 더블클릭 편집·방향키 이동·붙여넣기가 **기존과 동일하게** 동작.
2. 협력사·재고 페이지: 셀 더블클릭 편집·방향키·Enter 편집·붙여넣기 동작.
3. 권한 관리에서 특정 역할의 "셀 직접 편집" 토글을 끄고 그 역할로 로그인 → 편집 차단(선택만 가능)·붙여넣기 차단.

- [ ] **Step 5: 커밋**

```bash
git add MESPro.html
git commit -m "build: 그리드 편집 Phase 1 (엔진 일반화+편집권한+파일럿 3표)"
```

---

## Self-Review (작성자 점검)

- **Spec 커버리지(Phase 1 범위)**: 엔진 일반화(Task2)·편집권한(Task1)·자재 이관(Task3)·파일럿 협력사/재고(Task4,5)·빌드(Task6). Phase 1 매핑 완료. (전 표 확장=Phase 2, L2=Phase 3은 별도 계획)
- **Placeholder 스캔**: Task5 헤더는 실제 파일을 읽어 정확 매칭 필요함을 명시(구체 필드·자료형 제공). 그 외 완성 코드.
- **이름 일관성**: 엔진 공개 API `gridify`/`gridCanWrite`(Task2)와 호출부(Task3,4,5) 일치. 권한 함수 `canEditFeature`(Task1)를 엔진 `canWrite()`가 `typeof` 가드로 호출 — 정의/사용 일치.
- **위험**: `materials`/`partners`/`inventory`가 `let` 전역이라 `window[]` 불가 → `data:()=>arr` getter로 해결(설계 반영). idField 셀에서 행 id를 읽으므로 각 표 첫 열에 식별자 텍스트 유지 필요(각 Task에 명시).
- **의존 함수**: `inp`, `saveStorage`, `toggleSort`, `sortIcon`, `currentRole`, `roleFeaturesConfig` 모두 기존 존재.
