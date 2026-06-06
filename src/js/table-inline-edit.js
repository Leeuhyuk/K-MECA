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
