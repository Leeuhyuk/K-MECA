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
  
  clearBtn.style.display = 'block';
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
        <div style="font-weight:700; font-size:12px;">${c.name}</div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">담당: ${c.manager || '미지정'} · ${c.tel || '연락처 없음'}</div>
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
        <div style="font-weight:700; font-size:12px;">${p.name} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${p.id}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">고객사: ${cname} · 규격: ${p.spec || '없음'} · 단계: ${p.processStage}</div>
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
        <div style="font-weight:700; font-size:12px;">${m.name} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${m.id}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">공급처: ${m.supplier || '미정'} · 제품: ${pname} · 상태: ${m.status}</div>
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
        <div style="font-weight:700; font-size:12px;">${pname} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${o.id}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">라인: ${o.line} · 담당: ${o.manager || '미지정'} · 실적: ${o.done}/${o.qty} · 상태: ${o.status}</div>
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
        <div style="font-weight:700; font-size:12px;">${i.name} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${i.id}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">분류: ${i.type} · 위치: ${i.location || '미설정'} · 재고량: ${i.qty} ${i.unit}</div>
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
        <div style="font-weight:700; font-size:12px;"><span class="bd bd-err" style="font-size:9px; padding:1px 4px; margin-right:4px; border-radius:3px;">불량</span>${d.type} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${d.id}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">공정: ${d.stage} · 원인: ${d.cause || '미작성'} · 상태: ${d.status}</div>
      </div>`;
    });
    matchingClaims.forEach(c => {
      matchCount++;
      html += `<div class="search-result-item" onclick="navToGlobalSearchResult('quality', 'claim', '${c.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--br); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-s)'" onmouseout="this.style.background='transparent'">
        <div style="font-weight:700; font-size:12px;"><span class="bd bd-warn" style="font-size:9px; padding:1px 4px; margin-right:4px; border-radius:3px;">클레임</span>${c.content.slice(0, 30)}...</div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">고객사: ${getClientName(c.clientId)} · 상태: ${c.status}</div>
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
        <div style="font-weight:700; font-size:12px;">${w.name} <span style="font-size:9.5px; color:var(--tx-t); font-weight:normal;">${w.id}</span></div>
        <div style="font-size:10.5px; color:var(--tx-t); margin-top:2px;">${w.dept || '부서 미지정'}${w.position ? ' · '+w.position : ''} · ${w.empType || '정규직'} · ${w.status || ''}</div>
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
  }
}

function navToGlobalSearchResult(category, id, parentId) {
  const resultsDiv = document.getElementById('global-search-results');
  if (resultsDiv) resultsDiv.style.display = 'none';
  
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
  if (wrapper && !wrapper.contains(e.target)) {
    const results = document.getElementById('global-search-results');
    if (results) results.style.display = 'none';
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

// 관리자 자격 증명 전역 상태 변수 및 동적 비밀번호 로드
let isAdmin = loadStorage('isAdmin', false);
let adminPassword = loadStorage('adminPassword', '1234');
let pendingAdminCallback = null;

// 드래그 앤 드롭 글로벌 변수
let draggedClientId = null;
