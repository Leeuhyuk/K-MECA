/* ════════ 앱 내부 글로벌 상태 및 권한 제어 변수 ════════ */
const charts = {};

const sortState = {
  inventory: { key: null, asc: true },
  materials: { key: null, asc: true },
  orders: { key: null, asc: true },
  defects: { key: null, asc: true },
  claims: { key: null, asc: true },
  deliveries: { key: null, asc: true },
  checks: { key: null, asc: true },
  process: { key: null, asc: true },
  as:       { key: null, asc: true },
  partners: { key: null, asc: true },
  workers:  { key: null, asc: true },
  bom:      { key: null, asc: true },
  clients:  { key: null, asc: true },
  rfq:      { key: null, asc: true },
  po:       { key: null, asc: true },
};

/* ════════ 공통 날짜 보기 전환 (전체 · 연도 · 월 · 일 · 기간) ════════ */
const dateViewState = (() => {
  try { return JSON.parse(localStorage.getItem('mes_dateViewState') || '{}'); }
  catch(e) { return {}; }
})();
const dateViewRenderers = {};
const dateViewSelectionState = {};
const dateViewSelectionClearers = {};
function _dateViewSave() {
  try { localStorage.setItem('mes_dateViewState', JSON.stringify(dateViewState)); } catch(e) {}
}
function _dateViewDefault(mode) {
  const t = today();
  if (mode === 'year') return t.slice(0,4);
  if (mode === 'month') return t.slice(0,7);
  if (mode === 'day') return t;
  return '';
}
function _dateViewRangeDefault() {
  const end = today();
  return { from:end.slice(0,7) + '-01', to:end };
}
function _dateViewNormalize(value) {
  const raw = String(value || '').trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return compact[1] + '-' + compact[2] + '-' + compact[3];
  const dashed = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dashed) return dashed[1] + '-' + dashed[2].padStart(2,'0') + '-' + dashed[3].padStart(2,'0');
  const dotted = raw.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (dotted) return dotted[1] + '-' + dotted[2].padStart(2,'0') + '-' + dotted[3].padStart(2,'0');
  return '';
}
function _dateViewLabel(mode, value) {
  if (mode === 'all') return '전체 기간';
  if (mode === 'range') return '기간 선택';
  value = value || _dateViewDefault(mode);
  const p = value.split('-');
  if (mode === 'year') return p[0] + '년';
  if (mode === 'month') return p[0] + '년 ' + Number(p[1]) + '월';
  return p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일';
}
function registerDateViewSelectionClearer(key, handler) {
  if (!key || typeof handler !== 'function') return;
  const list = dateViewSelectionClearers[key] || (dateViewSelectionClearers[key] = []);
  if (!list.includes(handler)) list.push(handler);
}
function _dateViewSelectionActive(key) {
  return !!(dateViewSelectionState[key] && dateViewSelectionState[key].html);
}
function setDateViewSelectionBar(key, html, active) {
  if (!key) return false;
  if (active && html) dateViewSelectionState[key] = { html };
  else delete dateViewSelectionState[key];
  const bar = inp('date-view-' + key);
  if (bar) {
    _renderDateViewBar(key, bar);
    return true;
  }
  return false;
}
function clearDateViewSelection(key) {
  if (!key) return;
  const clearers = dateViewSelectionClearers[key] || [];
  clearers.forEach(fn => { try { fn(); } catch(e) {} });
  delete dateViewSelectionState[key];
  const bar = inp('date-view-' + key);
  if (bar) _renderDateViewBar(key, bar);
}
function _dateViewBeforeChange(key) {
  if (_dateViewSelectionActive(key)) clearDateViewSelection(key);
}
function _renderDateViewBar(key, bar) {
  if (!bar) return;
  const selected = dateViewSelectionState[key];
  if (selected && selected.html) {
    bar.classList.add('date-view-selected-mode');
    bar.innerHTML = selected.html;
    return;
  }
  bar.classList.remove('date-view-selected-mode');
  const state = dateViewState[key] || (dateViewState[key] = { mode:'all', value:'', from:'', to:'' });
  if (state.mode === 'range' && (!state.from || !state.to)) Object.assign(state, _dateViewRangeDefault());
  const disabled = state.mode === 'all' || state.mode === 'range';
  const range = state.mode === 'range';
  bar.innerHTML = `
    <select onchange="dateViewModeChange('${key}',this.value)" style="height:28px;min-width:96px;font-size:11px;">
      <option value="all"${state.mode==='all'?' selected':''}>전체</option>
      <option value="year"${state.mode==='year'?' selected':''}>연</option>
      <option value="month"${state.mode==='month'?' selected':''}>월</option>
      <option value="day"${state.mode==='day'?' selected':''}>일</option>
      <option value="range"${state.mode==='range'?' selected':''}>기간</option>
    </select>
    <div class="date-view-period"${range?'':' style="display:none;"'}>
      <input type="date" value="${state.from||''}" onchange="dateViewRangeChange('${key}','from',this.value)" title="시작일">
      <span>~</span>
      <input type="date" value="${state.to||''}" onchange="dateViewRangeChange('${key}','to',this.value)" title="종료일">
    </div>
    <button class="btn btn-sm date-view-nav" onclick="dateViewMove('${key}',-1)" title="이전" ${disabled?'disabled':''}><i class="ti ti-chevron-left"></i></button>
    <span class="date-view-label"${range?' style="display:none;"':''}>${_dateViewLabel(state.mode,state.value)}</span>
    <button class="btn btn-sm date-view-nav" onclick="dateViewMove('${key}',1)" title="다음" ${disabled?'disabled':''}><i class="ti ti-chevron-right"></i></button>
    <button class="btn btn-sm date-view-today" onclick="dateViewToday('${key}')" title="오늘" ${disabled?'disabled':''}>오늘</button>
    <div class="date-view-quick"${range?'':' style="display:none;"'}>
      <button class="btn btn-sm" onclick="dateViewQuickRange('${key}','7d')">최근 7일</button>
      <button class="btn btn-sm" onclick="dateViewQuickRange('${key}','month')">이번 달</button>
      <button class="btn btn-sm" onclick="dateViewQuickRange('${key}','prevMonth')">지난달</button>
    </div>
    <button class="btn btn-sm" style="height:28px;padding:0 9px;" onclick="dateViewReset('${key}')" title="전체 보기"><i class="ti ti-x"></i></button>`;
}
function ensureDateView(key, containerId, dates, renderer) {
  const container = inp(containerId); if (!container || !container.parentNode) return;
  dateViewRenderers[key] = renderer;
  let bar = inp('date-view-' + key);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'date-view-' + key;
    bar.className = 'date-view-bar';
    bar.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:0 0 8px;padding:4px 8px;background:var(--bg-s);border:1px solid var(--br);border-radius:var(--rm);';
    container.parentNode.insertBefore(bar, container);
  }
  _renderDateViewBar(key, bar);
}
function dateViewModeChange(key, mode) {
  _dateViewBeforeChange(key);
  const range = _dateViewRangeDefault();
  dateViewState[key] = { mode, value:_dateViewDefault(mode), from:range.from, to:range.to };
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewValueChange(key, value) {
  _dateViewBeforeChange(key);
  const state = dateViewState[key] || { mode:'all', value:'' };
  state.value = value; dateViewState[key] = state;
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewRangeChange(key, field, value) {
  _dateViewBeforeChange(key);
  const state = dateViewState[key] || { mode:'range', value:'', from:'', to:'' };
  state.mode = 'range';
  state[field] = _dateViewNormalize(value);
  if (state.from && state.to && state.from > state.to) {
    const swap = state.from; state.from = state.to; state.to = swap;
  }
  dateViewState[key] = state;
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewQuickRange(key, preset) {
  _dateViewBeforeChange(key);
  const now = new Date();
  let from, to;
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  if (preset === '7d') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    from = fmt(start); to = fmt(now);
  } else if (preset === 'prevMonth') {
    from = fmt(new Date(now.getFullYear(), now.getMonth()-1, 1));
    to = fmt(new Date(now.getFullYear(), now.getMonth(), 0));
  } else {
    from = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    to = fmt(now);
  }
  dateViewState[key] = { mode:'range', value:'', from, to };
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewReset(key) {
  _dateViewBeforeChange(key);
  dateViewState[key] = { mode:'all', value:'', from:'', to:'' };
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewMove(key, amount) {
  _dateViewBeforeChange(key);
  const state = dateViewState[key]; if (!state || state.mode === 'all') return;
  let value = state.value || _dateViewDefault(state.mode);
  if (state.mode === 'year') {
    value = String((parseInt(value,10) || new Date().getFullYear()) + amount);
  } else if (state.mode === 'month') {
    const parts = value.split('-');
    const d = new Date(Number(parts[0]), (Number(parts[1])||1)-1 + amount, 1);
    value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  } else if (state.mode === 'day') {
    const parts = value.split('-');
    const d = new Date(Number(parts[0]), (Number(parts[1])||1)-1, Number(parts[2])||1);
    d.setDate(d.getDate() + amount);
    value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  state.value = value;
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewToday(key) {
  _dateViewBeforeChange(key);
  const state = dateViewState[key]; if (!state || state.mode === 'all') return;
  state.value = _dateViewDefault(state.mode);
  _dateViewSave();
  if (dateViewRenderers[key]) dateViewRenderers[key]();
}
function dateViewMatch(key, dateValue) {
  const state = dateViewState[key] || { mode:'all', value:'' };
  if (state.mode === 'all') return true;
  const d = _dateViewNormalize(dateValue);
  if (!d) return false;
  if (state.mode === 'range') {
    const from = _dateViewNormalize(state.from);
    const to = _dateViewNormalize(state.to);
    return (!from || d >= from) && (!to || d <= to);
  }
  if (!state.value) return true;
  if (state.mode === 'year') return d.slice(0,4) === state.value;
  if (state.mode === 'month') return d.slice(0,7) === state.value;
  if (state.mode === 'day') return d.slice(0,10) === state.value;
  return true;
}

function toggleSort(table, key) {
  const state = sortState[table];
  if (!state) return;
  if (state.key === key) {
    state.asc = !state.asc;
  } else {
    state.key = key;
    state.asc = true;
  }
  
  if (table === 'inventory') renderInventory();
  else if (table === 'materials') renderMaterials();
  else if (table === 'orders') renderOrders();
  else if (table === 'deliveries') renderDeliveries();
  else if (table === 'defects' || table === 'claims' || table === 'checks') renderQuality();
  else if (table === 'process') renderProcDetail();
  else if (table === 'as') renderAS();
  else if (table === 'partners') renderPartners();
  else if (table === 'workers') renderWorkers();
  else if (table === 'bom') renderBom();
  else if (table === 'clients') renderClients();
  else if (table === 'rfq') renderRfq();
  else if (table === 'po') renderPo();
}

function sortIcon(table, key) {
  const state = sortState[table];
  if (state && state.key === key) {
    return state.asc 
      ? '<i class="ti ti-chevron-up" style="margin-left:4px; font-size:10px; color:var(--tx-i);"></i>' 
      : '<i class="ti ti-chevron-down" style="margin-left:4px; font-size:10px; color:var(--tx-i);"></i>';
  }
  return '<i class="ti ti-selector" style="margin-left:4px; font-size:10px; opacity:0.35;"></i>';
}

// ════════ 통합 글로벌 검색창 기능 ════════
let globalSearchSelectedIndex = -1;

/* 검색 결과 드롭다운 위치 계산 — 검색창이 사이드바 안에 있어 absolute 로는
   사이드바 overflow/210px 폭에 잘리므로, 입력창 위치 기준 fixed 로 띄운다.
   화면 밀도 조절은 좌표계를 바꾸지 않으므로 rect 값을 그대로 사용한다. */
function positionGlobalSearchResults() {
  const input = document.getElementById('global-search-input');
  const resultsDiv = document.getElementById('global-search-results');
  if (!input || !resultsDiv) return;
  const r = input.getBoundingClientRect();
  if (r.width === 0) return; // 검색창이 숨겨진 상태(닫힌 드로어·미니 레일·모바일 홈 검색 등)면 위치 갱신 안 함
  if (window.matchMedia('(max-width: 680px)').matches) {
    // 모바일: responsive.css 의 fixed 규칙(!important)이 좌우 폭을 잡고, 상단만 변수로 전달
    document.documentElement.style.setProperty('--mh-results-top', (r.bottom + 6) + 'px');
    return;
  }
  resultsDiv.style.position = 'fixed';
  resultsDiv.style.top = (r.bottom + 6) + 'px';
  resultsDiv.style.left = r.left + 'px';
  resultsDiv.style.width = Math.min(440, window.innerWidth - r.left - 12) + 'px';
}

function onGlobalSearch(q) {
  globalSearchSelectedIndex = -1;
  const resultsDiv = document.getElementById('global-search-results');
  const clearBtn = document.getElementById('global-search-clear');
  if (!resultsDiv || !clearBtn) return;

  q = q.trim().toLowerCase();
  if (!q) {
    resultsDiv.style.display = 'none';
    clearBtn.style.display = 'none';
    return;
  }

  clearBtn.style.display = 'flex';
  positionGlobalSearchResults();
  resultsDiv.style.display = 'block';
  
  let html = '';
  let matchCount = 0;
  
  // 1. 고객사
  const matchingClients = clients.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.manager || '').toLowerCase().includes(q) ||
    (c.tel || '').toLowerCase().includes(q)
  );
  if (matchingClients.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-i); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-building-community"></i> 고객사 (' + matchingClients.length + ')</div>';
    matchingClients.forEach(c => {
      matchCount++;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('client', '${c.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;">${esc(c.name)}</div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">담당: ${esc(c.manager) || '미지정'} · ${esc(c.tel) || '연락처 없음'}</div>
      </div>`;
    });
  }
  
  // 2. 수주 제품
  const matchingProducts = products.filter(p => 
    p.name.toLowerCase().includes(q) || 
    (p.spec || '').toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q)
  );
  if (matchingProducts.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-ok); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-box"></i> 수주 제품 (' + matchingProducts.length + ')</div>';
    matchingProducts.forEach(p => {
      matchCount++;
      const cname = getClientName(p.clientId);
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('product', '${p.id}', '${p.clientId}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;">${esc(p.name)} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${esc(p.id)}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">고객사: ${esc(cname)} · 규격: ${esc(p.spec) || '없음'} · 단계: ${esc(p.processStage)}</div>
      </div>`;
    });
  }
  
  // 3. 자재 발주
  const matchingMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(q) || 
    (m.supplier || '').toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q)
  );
  if (matchingMaterials.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-w); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-truck-loading"></i> 자재 발주 (' + matchingMaterials.length + ')</div>';
    matchingMaterials.forEach(m => {
      matchCount++;
      const pname = getProductName(m.productId);
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('material', '${m.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;">${esc(m.name)} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${esc(m.id)}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">공급처: ${esc(m.supplier) || '미정'} · 제품: ${esc(pname)} · 상태: ${esc(m.status)}</div>
      </div>`;
    });
  }
  
  // 4. 생산 지시
  const matchingOrders = workOrders.filter(o => 
    o.id.toLowerCase().includes(q) || 
    (o.manager || '').toLowerCase().includes(q) ||
    getProductName(o.productId).toLowerCase().includes(q)
  );
  if (matchingOrders.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:#185FA5; background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-clipboard-list"></i> 생산 지시 (' + matchingOrders.length + ')</div>';
    matchingOrders.forEach(o => {
      matchCount++;
      const pname = getProductName(o.productId);
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('order', '${o.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;">${esc(pname)} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${esc(o.id)}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">라인: ${esc(o.line)} · 담당: ${esc(o.manager) || '미지정'} · 실적: ${esc(o.done)}/${esc(o.qty)} · 상태: ${esc(o.status)}</div>
      </div>`;
    });
  }
  
  // 5. 실시간 재고
  const matchingInv = inventory.filter(i => 
    i.name.toLowerCase().includes(q) || 
    (i.location || '').toLowerCase().includes(q) ||
    i.id.toLowerCase().includes(q)
  );
  if (matchingInv.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-ok); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-packages"></i> 실시간 재고 (' + matchingInv.length + ')</div>';
    matchingInv.forEach(i => {
      matchCount++;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('inventory', '${i.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;">${esc(i.name)} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${esc(i.id)}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">분류: ${esc(i.type)} · 위치: ${esc(i.location) || '미설정'} · 재고량: ${esc(i.qty)} ${esc(i.unit)}</div>
      </div>`;
    });
  }
  
  // 6. 품질 및 클레임
  const matchingDefects = defects.filter(d => 
    d.type.toLowerCase().includes(q) || 
    (d.cause || '').toLowerCase().includes(q) ||
    d.id.toLowerCase().includes(q)
  );
  const matchingClaims = claims.filter(c => 
    c.content.toLowerCase().includes(q) || 
    (c.response || '').toLowerCase().includes(q) ||
    c.id.toLowerCase().includes(q)
  );
  if (matchingDefects.length > 0 || matchingClaims.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-d); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-shield-alert"></i> 품질 및 클레임 (' + (matchingDefects.length + matchingClaims.length) + ')</div>';
    matchingDefects.forEach(d => {
      matchCount++;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('quality', 'defect', '${d.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;"><span class="bd bd-err" style="font-size:9px; padding:1px 4px; margin-right:4px; border-radius:3px;">불량</span>${esc(d.type)} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${esc(d.id)}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">공정: ${esc(d.stage)} · 원인: ${esc(d.cause) || '미작성'} · 상태: ${esc(d.status)}</div>
      </div>`;
    });
    matchingClaims.forEach(c => {
      matchCount++;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('quality', 'claim', '${c.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;"><span class="bd bd-warn" style="font-size:9px; padding:1px 4px; margin-right:4px; border-radius:3px;">클레임</span>${esc(c.content.slice(0, 30))}...</div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">고객사: ${esc(getClientName(c.clientId))} · 상태: ${esc(c.status)}</div>
      </div>`;
    });
  }
  
  // 7. 직원
  const matchingWorkers = workers.filter(w =>
    (w.name || '').toLowerCase().includes(q) ||
    (w.id || '').toLowerCase().includes(q) ||
    (w.dept || '').toLowerCase().includes(q) ||
    (w.position || '').toLowerCase().includes(q) ||
    (w.role || '').toLowerCase().includes(q) ||
    (w.phone || '').toLowerCase().includes(q)
  );
  if (matchingWorkers.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-i); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-id-badge-2"></i> 직원 (' + matchingWorkers.length + ')</div>';
    matchingWorkers.forEach(w => {
      matchCount++;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('worker', '${w.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;">${esc(w.name)} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${esc(w.id)}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">${esc(w.dept) || '부서 미지정'}${w.position ? ' · '+esc(w.position) : ''} · ${esc(w.empType) || '정규직'} · ${esc(w.status) || ''}</div>
      </div>`;
    });
  }

  // 8. 메모
  const matchingMemos = (typeof memoList !== 'undefined' ? memoList : []).filter(m => {
    const attachments = (m.attachments || []).map(file => file.name || '').join(' ');
    return [m.title, m.content, m.summary, m.author, m.owner, (m.tags || []).join(' '), attachments]
      .join(' ').toLowerCase().includes(q);
  });
  if (matchingMemos.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-i); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-notes"></i> 메모 (' + matchingMemos.length + ')</div>';
    matchingMemos.forEach(m => {
      matchCount++;
      const title = m.title || '제목 없는 메모';
      const preview = String(m.summary || m.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      const tags = (m.tags || []).slice(0, 3).map(tag => '#' + tag).join(' ');
      const attachmentCount = (m.attachments || []).length;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('memo', '${m.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;"><i class="ti ti-notes" style="color:var(--tx-i);margin-right:4px;"></i>${esc(title)}</div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">${esc(preview) || '내용 없음'}</div>
        <div style="font-size:9.5px; color:var(--tx-t); margin-top:3px;">${esc(tags)}${attachmentCount ? ' · 첨부 '+attachmentCount+'개' : ''}${m.author ? ' · '+esc(m.author) : ''}</div>
      </div>`;
    });
  }

  // 9. 할 일
  const matchingTodos = (typeof todoList !== 'undefined' ? todoList : []).filter(t => {
    const checklist = (t.checklist || []).map(entry =>
      typeof entry === 'string' ? entry : (entry.text || entry.title || '')
    ).join(' ');
    return [t.title, t.content, t.owner, t.status, t.priority, checklist]
      .join(' ').toLowerCase().includes(q);
  });
  if (matchingTodos.length > 0) {
    html += '<div style="padding:8px 12px; font-size:11px; font-weight:700; color:var(--tx-ok); background:rgba(255,255,255,0.02); border-bottom:1px solid var(--br);"><i class="ti ti-list-check"></i> 할 일 (' + matchingTodos.length + ')</div>';
    matchingTodos.forEach(t => {
      matchCount++;
      const preview = String(t.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('todo', '${t.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;"><i class="ti ti-list-check" style="color:var(--tx-ok);margin-right:4px;"></i>${esc(t.title || '할 일')}</div>
        ${preview ? `<div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">${esc(preview)}</div>` : ''}
        <div style="font-size:9.5px; color:var(--tx-t); margin-top:3px;">${esc(t.status || '대기')} · ${esc(t.owner || '담당자 미지정')}${t.dueDate ? ' · 마감 '+esc(t.dueDate) : ''}</div>
      </div>`;
    });
  }

  if (matchCount === 0) {
    html = `<div style="padding:24px 16px; text-align:center; color:var(--tx-t); font-size:12px;">
      <i class="ti ti-search-off" style="font-size:24px; display:block; margin-bottom:8px; opacity:0.4;"></i>
      입력하신 키워드에 매칭되는 데이터가 없습니다.
    </div>`;
  }
  
  resultsDiv.innerHTML = html;
}

function onGlobalSearchFocus() {
  const resultsDiv = document.getElementById('global-search-results');
  const input = document.getElementById('global-search-input');
  if (resultsDiv && input && input.value.trim()) {
    positionGlobalSearchResults();
    resultsDiv.style.display = 'block';
  }
}

function clearGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const resultsDiv = document.getElementById('global-search-results');
  const clearBtn = document.getElementById('global-search-clear');
  if (input && resultsDiv && clearBtn) {
    input.value = '';
    resultsDiv.style.display = 'none';
    clearBtn.style.display = 'none';
    input.focus();
  }
}

function toggleGlobalSearchBox() {
  const wrapper = document.querySelector('.global-search-wrapper');
  const input = document.getElementById('global-search-input');
  if (!wrapper || !input) return;
  if (!wrapper.classList.contains('search-open')) {
    wrapper.classList.add('search-open');
    setTimeout(() => input.focus(), 0);
    return;
  }
  input.focus();
  onGlobalSearch(input.value);
}

function navToGlobalSearchResult(category, id, parentId) {
  const resultsDiv = document.getElementById('global-search-results');
  const wrapper = document.querySelector('.global-search-wrapper');
  if (resultsDiv) resultsDiv.style.display = 'none';
  if (wrapper) wrapper.classList.remove('search-open');
  
  if (category === 'client') {
    go('clients');
    expandedClients.add(id);
    renderClients();
    setTimeout(() => {
      const card = document.getElementById('card-' + id);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.style.borderColor = 'var(--tx-i)';
        card.style.boxShadow = '0 0 15px rgba(24, 95, 165, 0.4)';
        setTimeout(() => {
          card.style.boxShadow = '';
        }, 1500);
      }
    }, 150);
  } else if (category === 'product') {
    go('clients');
    expandedClients.add(parentId);
    renderClients();
    setTimeout(() => {
      const card = document.getElementById('card-' + parentId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      showToast('제품 ' + id + '이(가) 포함된 고객사를 조회합니다.', 'info');
    }, 150);
  } else if (category === 'material') {
    go('materials');
    sv('mat-q', id);
    renderMaterials();
  } else if (category === 'order') {
    go('orders');
    sv('orders-q', id);
    renderOrders();
  } else if (category === 'inventory') {
    const item = inventory.find(x => x.id === id);
    const key = item ? (item.category === '완제품' ? 'finished' : item.category === '사무비품' ? 'office' : 'parts') : 'parts';
    goInventory(key, null);
    sv('inv-q', id);
    renderInventory();
  } else if (category === 'quality') {
    if (id === 'defect') {
      go('quality');
      sv('df-q', parentId || '');
      renderQuality();
    } else {
      go('claims');
      sv('claims-q', parentId || '');
      renderClaims();
    }
  } else if (category === 'worker') {
    empTab = 'roster';
    go('workers');
    const w = workers.find(x => x.id === id);
    sv('workers-q', w ? w.name : id);
    renderWorkers();
  } else if (category === 'memo') {
    go('notes');
    switchMemoTab('memos');
    openMemoEditor(id);
  } else if (category === 'todo') {
    go('notes');
    switchMemoTab('todos');
    openTodoEditor(id);
  }
}

function onGlobalSearchKeyDown(e) {
  const resultsDiv = document.getElementById('global-search-results');
  if (!resultsDiv || resultsDiv.style.display === 'none') return;
  
  const items = document.querySelectorAll('.search-result-item');
  if (items.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    globalSearchSelectedIndex++;
    if (globalSearchSelectedIndex >= items.length) {
      globalSearchSelectedIndex = 0;
    }
    highlightGlobalSearchResult(globalSearchSelectedIndex);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    globalSearchSelectedIndex--;
    if (globalSearchSelectedIndex < 0) {
      globalSearchSelectedIndex = items.length - 1;
    }
    highlightGlobalSearchResult(globalSearchSelectedIndex);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (globalSearchSelectedIndex >= 0 && globalSearchSelectedIndex < items.length) {
      items[globalSearchSelectedIndex].click();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    clearGlobalSearch();
  }
}

function highlightGlobalSearchResult(index) {
  const items = document.querySelectorAll('.search-result-item');
  items.forEach((item, i) => {
    if (i === index) {
      item.style.background = 'var(--bg-s)';
      item.style.borderLeft = '3px solid var(--tx-i)';
      item.style.paddingLeft = '9px';
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.style.background = 'transparent';
      item.style.borderLeft = 'none';
      item.style.paddingLeft = '12px';
    }
  });
}

// 클릭 외부 시 결과 드롭다운 닫기 이벤트 리스너 등록
document.addEventListener('click', function(e) {
  const wrapper = document.querySelector('.global-search-wrapper');
  const results = document.getElementById('global-search-results');
  const mhSearchBox = document.querySelector('.mh-search'); // 모바일 홈 검색창
  const inSearchUi = (wrapper && wrapper.contains(e.target))
    || (results && results.contains(e.target))
    || (mhSearchBox && mhSearchBox.contains(e.target));
  if (!inSearchUi) {
    if (results) results.style.display = 'none';
    if (wrapper) wrapper.classList.remove('search-open');
  }
});

let editClientId = null, editProductId = null, editMatId = null, editOrderId = null, editInvId = null;
let editDefectId = null, editClaimId = null, editCheckId = null;
let currentSelectedKanbanProductId = null;
let expandedClients = new Set(['CL-001']);
let showClosedProjects = false;
let currentPage = 'dashboard';
let currentRole = 'admin';      // 권한 역할 (로컬/미인증 시 전체 권한). 클라우드 로그인 시 실제 역할로 설정됨
let allowedPages = null;        // null = 전체 허용. Set이면 해당 페이지만 허용
let _cloudActive = false;       // 클라우드(Firebase) 로그인 활성 여부 (부팅 초기 참조 대비 조기 선언)
let cloudUsers = loadStorage('cloudUsers_cache', []);   // Firestore users 캐시(인사 명부 ↔ 로그인 계정 조인용)
function userByEmail(email){ if(!email) return null; const e=email.trim().toLowerCase(); return cloudUsers.find(u=>(u.email||'').toLowerCase()===e)||null; }
let currentAlertFilter = 'all';
let alertSettings = loadStorage('alertSettings', {
  mat_pending: true,
  mat_delay: true,
  prod_delivery: true,
  inv_low: true,
  defect_open: true,
  wo_delayed: true
});
let dismissedAlerts = loadStorage('dismissedAlerts', []);
let _currentScannedTitles = [];

// 관리자 비밀번호 인증 제거됨 — 클라우드 로그인(추후 구글 로그인 연동)이 인증 담당. 항상 허용.
let isAdmin = true;

// 드래그 앤 드롭 글로벌 변수
let draggedClientId = null;
