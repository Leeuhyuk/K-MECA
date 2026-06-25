/* ════════ 실시간 자동 동기화 (Firestore onSnapshot) ════════ */
/* localStorage(클라우드에서 갱신됨)의 값을 메모리 전역 변수로 다시 반영 */
function cloudResyncGlobals(){
  const L=(k,cur)=>loadStorage(k,cur);
  clients=L('clients',clients); products=L('products',products); materials=L('materials',materials);
  workOrders=L('workOrders',workOrders); workers=L('workers',workers); defects=L('defects',defects);
  claims=L('claims',claims); checkRecords=L('checkRecords',checkRecords); inventory=L('inventory',inventory);
  deliveries=L('deliveries',deliveries); trash=L('trash',trash); rfqList=L('rfqList',rfqList);
  poList=L('poList',poList); partners=L('partners',partners); statementList=L('statementList',statementList);
  taxList=L('taxList',taxList); quoteList=L('quoteList',quoteList); orderList=L('orderList',orderList);
  financeData=L('financeData',financeData); attendance=L('attendance',attendance); leaves=L('leaves',leaves); payrollRecords=L('payrollRecords',payrollRecords);
  if (typeof repairWorkerTimeValues === 'function') repairWorkerTimeValues();
  if(!financeData || typeof financeData!=='object' || Array.isArray(financeData)) financeData={};   // null/배열 방어
  if(!financeData.entries) financeData.entries=[]; if(!financeData.paidReceivable) financeData.paidReceivable={};
  if(!financeData.paidPayable) financeData.paidPayable={}; if(!financeData.closedMonths) financeData.closedMonths=[];
  if(!financeData.auditLog) financeData.auditLog=[]; if(!financeData.payrollSettings) financeData.payrollSettings={};
  asList=L('asList',asList); bomList=L('bomList',bomList);
  memoList=L('memoList',memoList); todoList=L('todoList',todoList);
}
let _cloudRemoteRefreshTimer = null;
function cloudScheduleRemoteRefresh(){
  clearTimeout(_cloudRemoteRefreshTimer);
  _cloudRemoteRefreshTimer = setTimeout(() => {
    // 입력 중 모달이 열려 있으면 데이터 덮어쓰기/새로고침을 모두 보류하고 잠시 후 재시도.
    // (메모리 전역까지 교체하면 편집 중인 내용이 유실되므로 cloudResyncGlobals 자체를 미룬다)
    if (document.querySelector('.overlay.open')) {
      _cloudRemoteRefreshTimer = setTimeout(cloudScheduleRemoteRefresh, 1000);
      return;
    }
    cloudResyncGlobals();
    try { refreshPage(currentPage); } catch(e){}
    try { updateDlvBadge(); updateAsBadge(); updateTrashBadge(); updateTodoBadge(); } catch(e){}
    _cloudChip('synced'); setTimeout(()=>_cloudChip('online'), 1500);
  }, 80);
}
/* 다른 사용자의 변경을 실시간 수신 → localStorage 갱신 → 전역 반영 → 현재 화면 새로고침 */
function cloudSubscribe(){
  if (!_cloudActive || _cloudUnsub || !_fbDb) return;
  const v2Unsubs = CLOUD_KEYS.map(key => _fbDb.collection('mes_v2').doc(key).onSnapshot(doc=>{
    if (doc.metadata.hasPendingWrites) return;     // 내가 쓴 변경(로컬 에코)은 무시
    // 아직 서버로 보내지 않은 로컬 편집이 대기 중인 키는 원격값으로 덮어쓰지 않음
    // (비순차 원격 읽기가 최신 로컬 데이터를 되돌리는 것을 방지 — 편집 중 키는 로컬 우선)
    if (typeof _cloudQueue !== 'undefined' && _cloudQueue && _cloudQueue.has(key)) return;
    if (typeof cloudLoadV2Key !== 'function') return;
    cloudLoadV2Key(key)
      .then(loaded => { if (loaded) cloudScheduleRemoteRefresh(); })
      .catch(err => { console.warn('MES v2 실시간 동기화 오류:', key, err); });
  }, err=>{ console.warn('MES v2 문서 실시간 동기화 오류:', key, err); }));
  _cloudUnsub = () => {
    v2Unsubs.forEach(unsub => { try { unsub(); } catch(e){} });
    _cloudUnsub = null;
  };

  // 권한 설정(roles: 페이지/컬럼/버튼) 실시간 반영 — 관리자가 바꾸면 모든 기기에 즉시 적용
  _fbDb.collection('roles').onSnapshot(snap=>{
    let changed=false;
    snap.docChanges().forEach(ch=>{
      if (ch.type==='removed') return;
      const id=ch.doc.id, d=ch.doc.data();
      if (id==='config'){ saveStorageLocalOnly('rolePages', d); changed=true; }
      else if (id==='columns'){ saveStorageLocalOnly('roleColumns', d); changed=true; }
      else if (id==='features'){ saveStorageLocalOnly('roleFeatures', d); changed=true; }
    });
    if (!changed) return;
    allowedPages = roleAllowedSet(currentRole);   // 페이지 권한 재계산 후 재적용
    applyRoleGating(); applyColumnGating(); applyFeatureGating();
    if (currentPage==='system' && systemTab==='permissions' && !document.querySelector('.overlay.open')) { try{ renderPermissions(); }catch(e){} }
    _cloudChip('synced'); setTimeout(()=>_cloudChip('online'), 1500);
  }, err=>{ console.warn('권한 실시간 동기화 오류', err); });

  // 로그인 계정 목록(users) 실시간 캐시 — 인사 명부와 조인
  _fbDb.collection('users').onSnapshot(snap=>{
    cloudUsers = snap.docs.map(d=>Object.assign({uid:d.id}, d.data()));
    saveStorageLocalOnly('cloudUsers_cache', cloudUsers);
    if (!document.querySelector('.overlay.open')){
      if (currentPage==='workers') { try{ renderWorkers(); }catch(e){} }
      if (currentPage==='system' && systemTab==='permissions') { try{ renderPermissions(); }catch(e){} }
    }
  }, err=>{ console.warn('계정 목록 동기화 오류', err); });
}

function cloudLogin(){
  const email=(inp('cl-email').value||'').trim(), pw=inp('cl-pw').value||'';
  if(!email||!pw){ _cloudMsg('이메일과 비밀번호를 입력하세요.'); return; }
  _cloudMsg('로그인 중…','#8a93ad');
  _fbAuth.signInWithEmailAndPassword(email,pw).catch(e=>_cloudMsg(_cloudErr(e)));
}
function cloudSignup(){
  const name=(inp('cl-name').value||'').trim(), email=(inp('cl-email').value||'').trim(), pw=inp('cl-pw').value||'';
  if(!name){ _cloudMsg('이름을 입력하세요.'); return; }
  if(!email||pw.length<6){ _cloudMsg('이메일과 6자 이상 비밀번호를 입력하세요.'); return; }
  _cloudMsg('계정 생성 중…','#8a93ad');
  sessionStorage.setItem('mes_signupName', name);   // 계정 문서 생성 시 사용
  _fbAuth.createUserWithEmailAndPassword(email,pw)
    .then(cred=>{ if(cred.user) return cred.user.updateProfile({ displayName:name }); })
    .catch(e=>{ sessionStorage.removeItem('mes_signupName'); _cloudMsg(_cloudErr(e)); });
}
function cloudLogout(){
  if(!_fbAuth) return;
  if(!confirm('로그아웃 하시겠습니까?')) return;
  sessionStorage.removeItem('mes_cloud_synced');
  _fbAuth.signOut().then(()=>location.reload());
}
function _cloudErr(e){
  const m={'auth/invalid-credential':'이메일 또는 비밀번호가 올바르지 않습니다.','auth/user-not-found':'등록되지 않은 계정입니다.','auth/wrong-password':'비밀번호가 올바르지 않습니다.','auth/email-already-in-use':'이미 가입된 이메일입니다.','auth/invalid-email':'이메일 형식이 올바르지 않습니다.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.'};
  return m[e.code]||('오류: '+(e.message||e.code));
}
function _showLogin(){ const el=inp('cloud-login'); if(el) el.style.display='flex'; const c=inp('cloud-chip'); if(c) c.style.display='none'; }
function _hideLogin(){ const el=inp('cloud-login'); if(el) el.style.display='none'; }
function _cloudMsg(t,color){ const el=inp('cl-msg'); if(el){ el.textContent=t||''; el.style.color=color||'#ff8787'; } }
function _cloudChip(state){
  const chip=inp('cloud-chip'), ic=inp('cloud-chip-icon'), tx=inp('cloud-chip-txt');
  if(!chip) return;
  if(state==='local'){ chip.style.display='none'; return; }
  chip.style.display='flex';
  const map={ online:['ti-cloud-check','#37b24d','클라우드 연결됨'],
              saving:['ti-cloud-up','#f59f00','동기화 중…'], synced:['ti-cloud-download','#4dabf7','업데이트 반영됨'], error:['ti-cloud-x','#fa5252','동기화 오류'] };
  const [icon,col,txt]=map[state]||map.online;
  if(ic){ ic.className='ti '+icon; ic.style.color=col; } if(tx) tx.textContent=txt;
}

/* ════════ 권한 관리 화면 ════════ */
let systemTab = 'initial';
function switchSystemTab(tab) {
  systemTab = tab || 'initial';
  syncCurrentSubRoute('system', systemTab);
  document.querySelectorAll('#system-tabs [data-systab]').forEach(btn => {
    const active = btn.dataset.systab === systemTab;
    btn.classList.toggle('btn-primary', active);
    btn.classList.toggle('active', active);
  });
  document.querySelectorAll('#pg-system .system-panel').forEach(panel => {
    panel.style.display = panel.id === 'system-panel-' + systemTab ? '' : 'none';
  });
  if (systemTab === 'initial') renderSystemInitial();
  else if (systemTab === 'permissions') renderPermissions();
  else if (systemTab === 'company') renderSystemCompany();
  else if (systemTab === 'columns') renderTableDisplaySettings();
  else if (systemTab === 'display') renderUiScaleSettings();
  else if (systemTab === 'templates') renderDocTemplateManagement();
  else if (systemTab === 'api') renderApiSettings();
  else if (systemTab === 'drive') renderGoogleDriveSettings();
  else if (systemTab === 'alimtalk') renderAlimtalkSettings();
  else if (systemTab === 'alerts') renderAlerts();
  else if (systemTab === 'trash') renderTrash();
}
function renderSystem() {
  switchSystemTab(systemTab);
}
function renderSystemInitial() {
  const body = inp('system-initial-body');
  if (!body) return;
  const ci = typeof getCompanyInfo === 'function' ? getCompanyInfo() : {};
  const companyReady = !!(ci.name && ci.bizNo);
  const workerCount = Array.isArray(workers) ? workers.length : 0;
  const workerReady = workerCount > 0;
  const standardReady = Array.isArray(products) && products.length > 0;
  const materialReady = Array.isArray(materials) && materials.length > 0;
  const templateStore = typeof _docTemplateStore === 'function' ? _docTemplateStore() : {};
  const templateReady = ['rfq','po','quote','statement','tax'].some(type => templateStore[type]);
  const driveConfig = typeof getGoogleDriveConfig === 'function' ? getGoogleDriveConfig() : {};
  const driveReady = !!(driveConfig.enabled || driveConfig.folderId || driveConfig.accessToken);
  const apiReady = !!(_cloudActive || localStorage.getItem('mes_apiSettings') || localStorage.getItem('mes_geminiApiKey'));
  const required = [
    {key:'company', label:'회사 정보', status:companyReady?'done':'need', current:companyReady ? `${ci.name}${ci.bizNo ? ' · ' + ci.bizNo : ''}` : '회사명과 사업자등록번호를 등록하세요.', tab:'company'},
    {key:'workers', label:'인력·기술책임자', status:workerReady?'done':'need', current:workerReady ? `${workerCount}명 등록` : '사원 또는 담당자를 등록하세요.', tab:'permissions'},
    {key:'standards', label:'제품·표준 기준', status:standardReady?'done':'need', current:standardReady ? `제품 ${products.length}건 등록` : '제품과 표준 기준 데이터를 등록하세요.', tab:'company'},
    {key:'materials', label:'자재·공급 기준', status:materialReady?'done':'need', current:materialReady ? `자재 ${materials.length}건 등록` : '자재와 공급처 기준을 등록하세요.', tab:'company'},
    {key:'drive', label:'Google Drive 백업', status:driveReady?'done':'check', current:driveReady ? '외부 저장 연결 확인됨' : '외부 문서와 백업을 쓰려면 연결하세요.', tab:'drive'},
    {key:'api', label:'API·클라우드', status:apiReady?'done':'check', current:apiReady ? '연결 또는 설정 확인됨' : 'API 관리에서 필요한 키와 클라우드 연결을 확인하세요.', tab:'api'},
    {key:'templates', label:'문서 양식', status:templateReady?'done':'check', current:templateReady ? '사용자 양식 등록됨' : '기본 양식 사용 중입니다. 필요 시 회사 양식을 등록하세요.', tab:'templates'}
  ];
  const done = required.filter(x => x.status === 'done').length;
  const need = required.filter(x => x.status === 'need').length;
  const check = required.filter(x => x.status === 'check').length;
  const rate = Math.round((done / required.length) * 100);
  const badge = item => {
    const text = item.status === 'done' ? '완료' : (item.status === 'need' ? '필요' : '확인');
    return `<span class="setup-badge ${item.status}">${text}</span>`;
  };
  body.innerHTML = `
    <div class="system-hero card">
      <div class="system-section-title"><i class="ti ti-list-check"></i><span>초기 설정 체크리스트</span></div>
      <div class="system-kpi-row">
        <div class="system-kpi"><div class="system-kpi-label"><i class="ti ti-progress-check"></i>준비율</div><strong>${rate}%</strong><span>${done}/${required.length} 완료</span></div>
        <div class="system-kpi warn"><div class="system-kpi-label"><i class="ti ti-alert-circle"></i>확인 필요</div><strong>${check}건</strong><span>선택 설정</span></div>
        <div class="system-kpi danger"><div class="system-kpi-label"><i class="ti ti-circle-x"></i>필수 미완료</div><strong>${need}건</strong><span>운영 전 점검</span></div>
      </div>
      <div class="system-progress"><span style="width:${rate}%;"></span></div>
    </div>
    <div class="system-action-card card">
      <div class="system-section-title"><i class="ti ti-database-plus"></i><span>예제 생성·제거</span></div>
      <div class="system-action-line">
        <span class="setup-pill">현재 예제 ${typeof countSampleRecords === 'function' ? countSampleRecords() : 0}건</span>
        <button class="btn btn-primary" onclick="runSystemSampleAction('create')"><i class="ti ti-plus"></i>예제 생성</button>
        <button class="btn btn-danger" onclick="runSystemSampleAction('remove')"><i class="ti ti-trash"></i>예제 제거</button>
      </div>
      <div class="system-help-text">샘플 데이터가 필요할 때만 예제 생성을 누르고, 실제 운영 전에는 예제 제거를 실행하세요.</div>
    </div>
    <div class="system-check-card card">
      <div class="system-section-title"><i class="ti ti-clipboard-check"></i><span>설정 항목</span></div>
      <div class="system-check-table">
        <div class="system-check-head"><span>상태</span><span>항목</span><span>현재 상태</span></div>
        ${required.map(item => `
          <button type="button" class="system-check-row" onclick="switchSystemTab('${item.tab}')">
            <span>${badge(item)}</span>
            <strong>${item.label}</strong>
            <span>${item.current}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
}
function runSystemSampleAction(action) {
  const fn = action === 'create' ? window.createSampleData : window.removeSampleData;
  if (typeof fn === 'function') {
    fn();
    renderSystemInitial();
    return;
  }
  showToast('현재 버전에는 예제 데이터 자동 생성 기능이 연결되어 있지 않습니다.', 'info');
}
function tableDisplayConfig(){ return loadStorage('tableDisplayConfig', {}); }
function saveTableDisplayConfig(cfg){
  saveStorage('tableDisplayConfig', cfg || {});
  applyTableDisplaySettings();
}
function _tableDisplayTables(){
  return (typeof COLUMN_TABLES !== 'undefined') ? COLUMN_TABLES : {};
}
function renderTableDisplaySettings(){
  const body = inp('table-display-settings-body');
  if (!body) return;
  const tables = _tableDisplayTables();
  const keys = Object.keys(tables);
  if (!keys.length) {
    body.innerHTML = `<div class="card"><div class="empty"><i class="ti ti-table-off"></i>설정 가능한 테이블이 없습니다.</div></div>`;
    return;
  }
  const active = localStorage.getItem('mes_tableDisplayActive') || keys[0];
  const tableKey = tables[active] ? active : keys[0];
  localStorage.setItem('mes_tableDisplayActive', tableKey);
  const cfg = tableDisplayConfig();
  const tableCfg = cfg[tableKey] || {};
  const hidden = tableCfg.hidden || {};
  const labels = tableCfg.labels || {};
  const cols = tables[tableKey].cols || [];
  const baseMaxCh = Math.max(4, ...cols.map(col => String(col || '').length));
  body.innerHTML = `
    <div class="table-display-card card">
      <div class="table-display-title">
        <div><i class="ti ti-table-options"></i><strong>표시 설정</strong><span>테이블별 컬럼 표시/숨김 · 라벨 변경</span></div>
        <button class="btn btn-sm" type="button" onclick="resetTableDisplaySettings('${tableKey}')"><i class="ti ti-restore"></i>현재 테이블 초기화</button>
      </div>
      <div class="table-display-layout">
        <div class="table-display-tabs">
          ${keys.map(key => `<button type="button" class="${key===tableKey?'active':''}" onclick="selectTableDisplaySettings('${key}')">${tables[key].label}</button>`).join('')}
        </div>
        <div class="table-display-main">
          <div class="table-display-grid" style="--base-max-ch:${baseMaxCh}">
        <div class="table-display-head"><span>표시</span><span>기본 컬럼</span><span>표시 라벨(비우면 기본값)</span></div>
        ${cols.map((col, index) => `
          <div class="table-display-row">
            <label><input type="checkbox" ${hidden[col] ? '' : 'checked'} onchange="setTableColumnVisible('${tableKey}', ${index}, this.checked)"></label>
            <strong class="table-display-base-col">${col}</strong>
            <input class="table-display-label-input" style="--label-ch:${Math.max(6, String(labels[col] || col || '').length)}" value="${esc(labels[col] || col)}" placeholder="${esc(col)}" oninput="this.style.setProperty('--label-ch', Math.max(6, this.value.length)); setTableColumnLabel('${tableKey}', ${index}, this.value)">
          </div>
        `).join('')}
          </div>
      <div class="table-display-help">
        <div>· 표시 해제 시 모든 사용자 화면에서 해당 컬럼이 숨겨집니다. 데이터는 유지됩니다.</div>
        <div>· 라벨은 화면에 보이는 텍스트만 바꾸며 데이터와 정렬 기능에는 영향이 없습니다.</div>
        <div>· 역할별 컬럼 숨김은 권한 관리 탭에서 별도로 설정합니다.</div>
      </div>
        </div>
      </div>
    </div>`;
}
function selectTableDisplaySettings(key){
  localStorage.setItem('mes_tableDisplayActive', key);
  renderTableDisplaySettings();
}
function _tableDisplayColumn(tableKey, index){
  const table = _tableDisplayTables()[tableKey];
  return table && table.cols ? table.cols[index] : '';
}
function setTableColumnVisible(tableKey, index, visible){
  const col = _tableDisplayColumn(tableKey, index);
  if (!col) return;
  const cfg = tableDisplayConfig();
  const tableCfg = cfg[tableKey] || { hidden:{}, labels:{} };
  tableCfg.hidden = tableCfg.hidden || {};
  if (visible) delete tableCfg.hidden[col];
  else tableCfg.hidden[col] = true;
  cfg[tableKey] = tableCfg;
  saveTableDisplayConfig(cfg);
}
function setTableColumnLabel(tableKey, index, label){
  const col = _tableDisplayColumn(tableKey, index);
  if (!col) return;
  const cfg = tableDisplayConfig();
  const tableCfg = cfg[tableKey] || { hidden:{}, labels:{} };
  tableCfg.labels = tableCfg.labels || {};
  const next = String(label || '').trim();
  if (!next || next === col) delete tableCfg.labels[col];
  else tableCfg.labels[col] = next;
  cfg[tableKey] = tableCfg;
  saveTableDisplayConfig(cfg);
}
function resetTableDisplaySettings(tableKey){
  const cfg = tableDisplayConfig();
  delete cfg[tableKey];
  saveTableDisplayConfig(cfg);
  renderTableDisplaySettings();
  showToast('표시 설정을 초기화했습니다.', 'success');
}
function applyTableDisplaySettings(){
  const cfg = tableDisplayConfig();
  const tables = _tableDisplayTables();
  let css = '';
  Object.keys(tables).forEach(tableKey => {
    const table = tables[tableKey];
    const tableCfg = cfg[tableKey] || {};
    const hidden = tableCfg.hidden || {};
    _markTableDisplayCells(tableKey, table);
    (table.cols || []).forEach((col, index) => {
      if (!hidden[col]) return;
      css += `${table.sel} [data-table-display-col="${tableKey}-${index}"]{display:none!important;}\n`;
    });
  });
  let st = document.getElementById('table-display-style');
  if (!st) { st = document.createElement('style'); st.id = 'table-display-style'; document.head.appendChild(st); }
  st.textContent = css;
  applyTableDisplayLabels();
}
function _tableDisplayColumnOffset(table, tableEl){
  tableEl = tableEl || null;
  const wrap = document.querySelector(table.sel);
  if (!tableEl && wrap) tableEl = wrap.matches && wrap.matches('table') ? wrap : wrap.querySelector('table');
  if (!tableEl || !tableEl.tHead || !tableEl.tHead.rows.length) return 0;
  const first = tableEl.tHead.rows[0].cells[0];
  if (!first) return 0;
  const firstLabel = ((table.cols || [])[0] || '').replace(/\s+/g, '');
  const isSelectionConfig = /선택|체크/.test(firstLabel);
  return !isSelectionConfig && first.querySelector('input[type="checkbox"]') ? 1 : 0;
}
function _markTableDisplayCells(tableKey, table){
  const wrap = document.querySelector(table.sel);
  if (!wrap) return null;
  const tableEl = wrap.matches && wrap.matches('table') ? wrap : wrap.querySelector('table');
  if (!tableEl || !tableEl.tHead || !tableEl.tHead.rows.length) return null;
  const head = tableEl.tHead.rows[0];
  const offset = _tableDisplayColumnOffset(table, tableEl);
  const cols = table.cols || [];
  Array.from(head.cells).forEach((th, visualIndex) => {
    let originalIndex = Number(th.dataset.oidx);
    if (!Number.isFinite(originalIndex)) {
      originalIndex = visualIndex;
      th.dataset.oidx = String(originalIndex);
    }
    const colIndex = originalIndex - offset;
    if (colIndex < 0 || colIndex >= cols.length) {
      th.removeAttribute('data-table-display-col');
      return;
    }
    th.dataset.tableDisplayCol = `${tableKey}-${colIndex}`;
  });
  Array.from(tableEl.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      Array.from(row.cells).forEach((cell, visualIndex) => {
        const th = head.cells[visualIndex];
        const key = th && th.dataset.tableDisplayCol;
        if (key) cell.dataset.tableDisplayCol = key;
        else cell.removeAttribute('data-table-display-col');
      });
    });
  });
  return { tableEl, head, offset };
}
function applyTableDisplayLabels(){
  const cfg = tableDisplayConfig();
  const tables = _tableDisplayTables();
  Object.keys(tables).forEach(tableKey => {
    const table = tables[tableKey];
    const labels = (cfg[tableKey] && cfg[tableKey].labels) || {};
    const marked = _markTableDisplayCells(tableKey, table);
    if (!marked) return;
    const head = marked.head;
    (table.cols || []).forEach((col, index) => {
      const th = head.querySelector(`[data-table-display-col="${tableKey}-${index}"]`);
      if (!th) return;
      const label = labels[col] || col;
      if (th.dataset.tableDisplayLabel === label) return;
      const icons = Array.from(th.querySelectorAll('i')).map(icon => icon.cloneNode(true));
      th.textContent = label + (icons.length ? ' ' : '');
      icons.forEach(icon => th.appendChild(icon));
      th.dataset.tableDisplayLabel = label;
    });
  });
}
function renderSystemCompany() {
  const el = inp('system-company-summary');
  if (!el) return;
  const ci = getCompanyInfo();
  const row = (label, value) => `<div style="display:grid;grid-template-columns:130px 1fr;gap:12px;padding:9px 4px;border-bottom:1px solid var(--br);font-size:12px;"><strong style="color:var(--tx-s);">${label}</strong><span>${value || '미설정'}</span></div>`;
  el.innerHTML =
    row('회사명', ci.name) +
    row('대표자', ci.ceo) +
    row('사업자등록번호', ci.bizNo) +
    row('주소', ci.address) +
    row('연락처', [ci.tel, ci.fax].filter(Boolean).join(' / ')) +
    row('이메일', ci.email) +
    row('담당부서', ci.dept) +
    row('업태 / 종목', [ci.bizType, ci.bizItem].filter(Boolean).join(' / '));
}
function renderDocTemplateManagement() {
  const store = typeof _docTemplateStore === 'function' ? _docTemplateStore() : {};
  ['rfq','po','quote','statement','tax'].forEach(type => {
    const el = inp(type + '-template-status');
    if (!el) return;
    const saved = store[type];
    el.textContent = saved ? `등록됨: ${saved.name}` : '기본 양식 사용 중';
    el.style.color = saved ? 'var(--tx-ok)' : 'var(--tx-t)';
  });
  const packageStatus = inp('template-package-status');
  if (packageStatus) {
    let meta = null;
    try { meta = JSON.parse(localStorage.getItem('mes_docTemplatePackageMeta') || 'null'); } catch(e) {}
    packageStatus.textContent = meta
      ? `최근 가져오기: ${meta.name} · ${new Date(meta.importedAt).toLocaleString('ko-KR')}`
      : '다른 MESPro 또는 외부 프로그램에서 사용할 수 있는 ZIP 패키지';
    packageStatus.style.color = meta ? 'var(--tx-ok)' : 'var(--tx-t)';
  }
}
let permSection = 'pages';
function setPermSection(section){
  permSection = section || 'pages';
  renderPermissions();
}
async function renderPermissions(){
  const body=inp('perm-body'); if(!body) return;
  if (!_cloudActive){ body.innerHTML=`<div class="card"><div class="empty"><i class="ti ti-cloud-off"></i>클라우드 로그인 후 사용할 수 있는 기능입니다. (Firebase 미설정 시 로컬 전용)</div></div>`; return; }
  if (currentRole!=='admin'){ body.innerHTML=`<div class="card"><div class="empty"><i class="ti ti-lock"></i>권한 관리는 관리자만 접근할 수 있습니다.</div></div>`; return; }
  const sections = [
    {key:'account', icon:'ti-users', title:'계정 승인/역할', desc:'직원 계정 연결과 역할 지정'},
    {key:'pages', icon:'ti-table-options', title:'페이지 접근 권한', desc:'역할별 메뉴 접근'},
    {key:'columns', icon:'ti-columns-3', title:'테이블 컬럼 권한', desc:'역할별 열 표시/숨김'},
    {key:'features', icon:'ti-tool', title:'기능 권한', desc:'내보내기와 출력 허용'},
    {key:'backup', icon:'ti-database-cog', title:'데이터 백업/복구', desc:'파일 내보내기와 복구'}
  ];
  if (!sections.some(s => s.key === permSection)) permSection = 'pages';
  const sectionButton = (s) => `<button type="button" class="${permSection===s.key?'active':''}" onclick="setPermSection('${s.key}')"><i class="ti ${s.icon}"></i><span>${s.title}</span></button>`;
  body.innerHTML = `
    <div class="table-display-card card permission-card">
      <div class="table-display-title">
        <div><i class="ti ti-user-shield"></i><strong>권한 관리</strong><span>데이터 구조는 유지하고 항목별 배치만 분리</span></div>
      </div>
      <div class="table-display-layout permission-layout">
        <div class="table-display-tabs permission-tabs">
          ${sections.map(sectionButton).join('')}
        </div>
        <div class="table-display-main permission-main">
          <div class="permission-section" style="${permSection==='account'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-users"></i>계정 승인/역할</span>
              <span style="font-size:11px;color:var(--tx-t);">직원 계정 연결과 역할 지정은 인사 관리에서 처리</span></div>
            <div class="permission-info-row">
              <i class="ti ti-users"></i>
              <div><strong>직원 계정·역할·승인은 「인사 관리」에서 관리합니다</strong>
                <p>직원 명부에서 이메일로 로그인 계정을 연결해 역할 지정·승인을 함께 처리하세요.</p></div>
              <button class="btn btn-sm btn-primary" onclick="go('workers')"><i class="ti ti-external-link"></i>인사 관리로 이동</button>
            </div>
          </div>
          <div class="permission-section" style="${permSection==='pages'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-table-options"></i>역할별 접근 페이지</span>
              <span style="font-size:11px;color:var(--tx-t);">관리자는 항상 전체 · 변경 즉시 저장</span></div>
            <div id="perm-matrix"></div>
          </div>
          <div class="permission-section" style="${permSection==='columns'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-columns-3"></i>역할별 표시 컬럼 (열 권한)</span>
              <span style="font-size:11px;color:var(--tx-t);">체크 해제 시 해당 역할에게 그 열이 숨겨짐 · 관리자는 항상 전체</span></div>
            <div id="perm-columns"></div>
          </div>
          <div class="permission-section" style="${permSection==='features'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-tool"></i>역할별 기능 권한 (내보내기 · 출력)</span>
              <span style="font-size:11px;color:var(--tx-t);">엑셀 CSV 내보내기 / PDF·인쇄 출력 허용 여부 · 관리자는 항상 전체</span></div>
            <div id="perm-features"></div>
          </div>
          <div class="permission-section" style="${permSection==='backup'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-database-cog"></i>데이터 백업 · 복구</span>
              <span style="font-size:11px;color:var(--tx-t);">전체 데이터를 파일로 내보내거나 파일에서 복구 · 관리자 전용</span></div>
            <div class="permission-actions">
              <button class="btn btn-sm" onclick="exportAllXLS()"><i class="ti ti-file-spreadsheet"></i>엑셀(XLS) 내보내기</button>
              <button class="btn btn-sm" onclick="inp('xls-import-input').click()"><i class="ti ti-upload"></i>엑셀(XLS) 불러오기</button>
              <button class="btn btn-sm" onclick="exportDataJSON()"><i class="ti ti-file-code-2"></i>JSON 내보내기</button>
              <button class="btn btn-sm" onclick="inp('json-import-input').click()"><i class="ti ti-database-import"></i>JSON 불러오기</button>
              <input type="file" id="xls-import-input" accept=".xlsx,.xls" style="display:none;" onchange="importAllXLS(this)">
              <input type="file" id="json-import-input" accept=".json,application/json" style="display:none;" onchange="importDataJSON(this)">
            </div>
          </div>
        </div>
      </div>
    </div>`;
  renderPermMatrix();
  renderPermColumns();
  renderPermFeatures();
}
function renderPermUsers(users){
  const el=inp('perm-users'); if(!el) return;
  const rows = users.length ? users.map(u=>{
    const isOwner = BOOTSTRAP_ADMIN_EMAILS.includes((u.email||'').toLowerCase());
    const act = u.active!==false;
    return `<tr>
      <td style="font-weight:700;">${u.name?u.name+' ':''}<span style="font-weight:400;color:var(--tx-t);font-size:11px;">${u.email||u.uid}</span>${isOwner?' <span class="bd bd-info" style="font-size:9px;">소유자</span>':''}</td>
      <td><select onchange="permSetRole('${u.uid}',this.value)" ${isOwner?'disabled':''}>
        ${['admin','manager','staff'].map(r=>`<option value="${r}"${(u.role||'staff')===r?' selected':''}>${ROLE_LABEL[r]}</option>`).join('')}</select></td>
      <td style="text-align:center;"><span class="bd ${act?'bd-ok':'bd-err'}">${act?'활성':'대기/비활성'}</span></td>
      <td style="text-align:center;">${isOwner?'—':`<button class="btn btn-sm" onclick="permToggleActive('${u.uid}',${act})">${act?'비활성화':'승인'}</button>`}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="4">${empty('등록된 사용자가 없습니다.')}</td></tr>`;
  el.innerHTML = `<div style="overflow-x:auto;"><table><thead><tr><th>이메일</th><th>역할</th><th style="text-align:center;">상태</th><th style="text-align:center;">관리</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderPermMatrix(){
  const el=inp('perm-matrix'); if(!el) return;
  const cfg = rolePagesConfig();
  const role = permColRole;
  const allowed = new Set(cfg[role]||[]);
  const RB='1px solid var(--br)';
  const tab=(r,label)=>`<button onclick="setPermRole('${r}')" style="border:none;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;background:${role===r?'#1971c2':'transparent'};color:${role===r?'#fff':'var(--tx-s)'};">${label}</button>`;
  const chips = PAGE_LIST.map(p=>{
    const on=allowed.has(p.id);
    return `<span onclick="permToggleRolePage('${role}','${p.id}',${!on})" style="display:inline-flex;align-items:center;padding:4px 8px;margin:2px;border-radius:11px;font-size:10px;cursor:pointer;user-select:none;transition:all .12s;border:1px solid ${on?'#1971c2':'var(--br)'};background:${on?'#1971c2':'transparent'};color:${on?'#fff':'var(--tx-t)'};font-weight:${on?'600':'400'};">${p.label}</span>`;
  }).join('');
  const RL={manager:'중간관리자',staff:'평사원'};
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--tx-s);font-weight:700;">역할 선택</span>
      <div style="display:inline-flex;border:${RB};border-radius:8px;overflow:hidden;">${tab('manager','중간관리자')}${tab('staff','평사원')}</div>
      <span style="font-size:11px;color:var(--tx-t);"><b style="color:#1971c2;">파란 칩</b> = 접근 허용 · 흐린 칩 = 차단 · 관리자는 항상 전체</span>
      <span style="margin-left:auto;font-size:10.5px;white-space:nowrap;">
        <a onclick="permSetAllPages('${role}',true)" style="color:var(--tx-i);cursor:pointer;">전체</a>
        <span style="color:var(--tx-t);"> · </span>
        <a onclick="permSetAllPages('${role}',false)" style="color:var(--tx-d);cursor:pointer;">해제</a>
      </span>
    </div>
    <div style="font-size:11.5px;color:var(--tx-s);margin-bottom:8px;"><b>${RL[role]}</b> 가 접근할 수 있는 페이지를 선택합니다.</div>
    <div>${chips}</div>`;
}
async function permSetAllPages(role, all){
  const cfg = rolePagesConfig();
  cfg[role] = all ? PAGE_LIST.map(p=>p.id) : [];
  saveStorageLocalOnly('rolePages', cfg);
  if (role===currentRole){ allowedPages=roleAllowedSet(currentRole); applyRoleGating(); }
  renderPermMatrix();
  try{ await _fbDb.collection('roles').doc('config').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
let permColRole = 'manager';   // 권한 화면에서 현재 편집 중인 역할(페이지·컬럼 공유)
function setPermRole(r){ permColRole = r; renderPermMatrix(); renderPermColumns(); renderPermFeatures(); }
function setPermColRole(r){ setPermRole(r); }
function renderPermColumns(){
  const el=inp('perm-columns'); if(!el) return;
  const cfg=roleColumnsConfig();
  const role=permColRole;
  const hiddenOf=(tk)=> new Set(((cfg[role]||{})[tk])||[]);
  const RB='1px solid var(--br)';
  const tab=(r,label)=>`<button onclick="setPermColRole('${r}')" style="border:none;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;background:${permColRole===r?'#1971c2':'transparent'};color:${permColRole===r?'#fff':'var(--tx-s)'};">${label}</button>`;
  const chip=(label, shown, onclick)=>`<span onclick="${onclick}" style="display:inline-flex;align-items:center;padding:4px 8px;margin:2px;border-radius:11px;font-size:10px;cursor:pointer;user-select:none;transition:all .12s;border:1px solid ${shown?'#1971c2':'var(--br)'};background:${shown?'#1971c2':'transparent'};color:${shown?'#fff':'var(--tx-t)'};font-weight:${shown?'600':'400'};">${label}</span>`;
  const cards = Object.keys(COLUMN_TABLES).map(tk=>{
    const t=COLUMN_TABLES[tk]; const hidden=hiddenOf(tk);
    const chips=t.cols.map(c=>{
      const shown=!hidden.has(c);
      return chip(c, shown, `permToggleRoleColumn('${role}','${tk}','${c.replace(/'/g,"\\'")}',${!shown})`);
    }).join('');
    let addChip='';
    if (t.addBtn){
      const shown=!hidden.has(ADD_KEY);
      addChip = `<span style="display:inline-block;width:1px;height:20px;background:var(--br);margin:0 6px;vertical-align:middle;"></span>` + chip('＋ 등록 버튼', shown, `permToggleRoleColumn('${role}','${tk}','${ADD_KEY}',${!shown})`);
    }
    return `<div style="border:${RB};border-radius:10px;margin-bottom:12px;background:var(--bg-p);overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--bg-s);border-bottom:${RB};">
        <i class="ti ti-table" style="color:var(--tx-i);font-size:15px;"></i>
        <span style="font-weight:700;font-size:13px;">${t.label}</span>
        <span style="margin-left:auto;font-size:10.5px;white-space:nowrap;">
          <a onclick="permSetAllColumns('${role}','${tk}',true)" style="color:var(--tx-i);cursor:pointer;">전체</a>
          <span style="color:var(--tx-t);"> · </span>
          <a onclick="permSetAllColumns('${role}','${tk}',false)" style="color:var(--tx-d);cursor:pointer;">해제</a>
        </span>
      </div>
      <div style="padding:8px 10px;">${chips}${addChip}</div>
    </div>`;
  }).join('');
  const RL={manager:'중간관리자',staff:'평사원'};
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--tx-s);font-weight:700;">역할 선택</span>
      <div style="display:inline-flex;border:${RB};border-radius:8px;overflow:hidden;">${tab('manager','중간관리자')}${tab('staff','평사원')}</div>
      <span style="font-size:11px;color:var(--tx-t);"><b style="color:#1971c2;">파란 칩</b> = 표시 · 흐린 칩 = 숨김 · 클릭하여 전환 · 관리자는 항상 전체</span>
    </div>
    <div style="font-size:11.5px;color:var(--tx-s);margin-bottom:10px;"><b>${RL[role]}</b> 에게 보일 컬럼/등록버튼을 설정합니다.</div>
    ${cards}`;
}
/* 기능 권한(내보내기·PDF) 칩 렌더 */
function renderPermFeatures(){
  const el=inp('perm-features'); if(!el) return;
  const role=permColRole;
  const f=roleFeaturesConfig()[role]||{};
  const RL={manager:'중간관리자',staff:'평사원'};
  const chip=(def)=>{ const on=(f[def.key]!==false); return `<span onclick="permToggleFeature('${role}','${def.key}',${!on})" style="display:inline-flex;align-items:center;padding:5px 10px;margin:2px;border-radius:12px;font-size:10.5px;cursor:pointer;user-select:none;border:1px solid ${on?'#1971c2':'var(--br)'};background:${on?'#1971c2':'transparent'};color:${on?'#fff':'var(--tx-t)'};font-weight:${on?'600':'400'};">${def.label}</span>`; };
  el.innerHTML = `<div style="font-size:11.5px;color:var(--tx-s);margin-bottom:8px;"><b>${RL[role]}</b> 에게 허용할 기능을 선택합니다. (앱 전체 공통 적용)</div>
    <div>${FEATURE_DEFS.map(chip).join('')}</div>`;
}
async function permToggleFeature(role, key, allowed){
  const cfg=roleFeaturesConfig(); cfg[role]=cfg[role]||{};
  cfg[role][key]=allowed;
  saveStorageLocalOnly('roleFeatures', cfg);
  if(role===currentRole) applyFeatureGating();
  renderPermFeatures();
  try{ await _fbDb.collection('roles').doc('features').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
/* 한 역할의 표 전체 컬럼/등록버튼 일괄 표시·해제 */
async function permSetAllColumns(role, tk, visible){
  const cfg=roleColumnsConfig(); cfg[role]=cfg[role]||{};
  const t=COLUMN_TABLES[tk];
  const all=t.cols.slice(); if(t.addBtn) all.push(ADD_KEY);
  cfg[role][tk] = visible ? [] : all;   // 표시=숨김없음 / 해제=전부 숨김
  saveStorageLocalOnly('roleColumns', cfg);
  try{ await _fbDb.collection('roles').doc('columns').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
  if(role===currentRole) applyColumnGating();
  renderPermColumns();
}
async function permToggleRoleColumn(role, tk, col, visible){
  const cfg=roleColumnsConfig();
  cfg[role]=cfg[role]||{};
  const set=new Set(cfg[role][tk]||[]);   // 숨김 컬럼 집합
  if(visible) set.delete(col); else set.add(col);
  cfg[role][tk]=[...set];
  saveStorageLocalOnly('roleColumns', cfg);
  if(role===currentRole) applyColumnGating();
  renderPermColumns();   // 칩 상태 즉시 갱신
  try{ await _fbDb.collection('roles').doc('columns').set(cfg); }
  catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
async function permSetRole(uid, role){
  try{ await _fbDb.collection('users').doc(uid).update({role}); showToast('역할이 변경되었습니다. (해당 사용자 새로고침 시 반영)'); }
  catch(e){ showToast('변경 실패: '+e.message,'error'); }
}
async function permToggleActive(uid, currentlyActive){
  try{ await _fbDb.collection('users').doc(uid).update({active:!currentlyActive}); showToast(currentlyActive?'비활성화했습니다.':'승인(활성화)했습니다.'); renderPermissions(); }
  catch(e){ showToast('변경 실패: '+e.message,'error'); }
}
async function permToggleRolePage(role, pageId, on){
  const cfg = rolePagesConfig();
  const set = new Set(cfg[role]||[]);
  if(on) set.add(pageId); else set.delete(pageId);
  cfg[role] = [...set];
  saveStorageLocalOnly('rolePages', cfg);
  if (role===currentRole){ allowedPages=roleAllowedSet(currentRole); applyRoleGating(); }
  renderPermMatrix();   // 칩 즉시 갱신
  try{ await _fbDb.collection('roles').doc('config').set(cfg); }
  catch(e){ showToast('저장 실패: '+e.message,'error'); }
}

/* ════════ 일괄 선택/동작 (테이블 비종속) — 체크박스 + 전체 선택 + 0건 시 비활성 ════════
   각 표의 행 삭제 버튼 onclick에서 id를 추출하므로 렌더 함수 수정 불필요. */
const BULK_CFG = {
  rfq:        {sel:'#rfq-table',        del:'deleteRfq',       edit:'openRfqEdit',    clone:'cloneRfq', pdf:'openRfqPrint', csv:'exportRfqXLS', email:'openEmailModal', drive:true, toPo:true},
  materials:  {sel:'#mat-table',        del:'deleteMat',       edit:'openMatEdit',    clone:'cloneMat'},
  inventory:  {sel:'#inventory-table',  del:'deleteInventory', edit:'openInvEdit'},
  orders:     {sel:'#orders-table',     del:'deleteOrder',     edit:'openOrderEdit',  clone:'cloneOrder'},
  defects:    {sel:'#defect-table',     del:'deleteDefect',    edit:'openDefectEdit'},
  checks:     {sel:'#check-table',      del:'deleteCheck',     edit:'openCheckEdit'},
  claims:     {sel:'#claims-table-full',del:'deleteClaim',     edit:'openClaimEdit'},
  deliveries: {sel:'#dlv-table',        del:'deleteDelivery',  edit:null},
  workers:    {sel:'#workers-table',    del:'deleteWorker',    edit:'openWorkerEdit'},
  as:         {sel:'#as-body',          del:'deleteAS',        edit:'openAsEdit'},
  partners:   {sel:'#bp-table',         del:'deletePartner',   edit:'openPartnerModal'},
  statement:  {sel:'#st-table', type:'statement', del:'deleteSalesDoc', edit:'openSalesDocEdit', clone:'cloneSalesDoc', pdf:'openSalesDocPrint', email:'openEmailModal', drive:true},
  tax:        {sel:'#tx-table', type:'tax',       del:'deleteSalesDoc', edit:'openSalesDocEdit', clone:'cloneSalesDoc', pdf:'openSalesDocPrint', email:'openEmailModal', drive:true},
  quote:      {sel:'#qt-table', type:'quote',     del:'deleteSODoc',    edit:'openSODocEdit',    clone:'cloneSODoc', pdf:'openSODocPrint', email:'openEmailModal', drive:true},
  order:      {sel:'#so-table', type:'order',     del:'deleteSODoc',    edit:'openSODocEdit',    clone:'cloneSODoc', pdf:'openSODocPrint', email:'openEmailModal', drive:true},
  products:   {sel:'#client-list',       del:'deleteProduct',   edit:'openProdEdit',   clone:'cloneProduct'},
  bom:        {sel:'#bom-body',          del:'deleteBom',       edit:'openBomEdit',    clone:'cloneBom'}
};
const bulkSel = {};
let _bulkDateViewClearersRegistered = false;
function bulkDateViewKey(key) {
  const map = {
    claims: 'claims',
    workers: 'workersHire',
    as: 'asRecords'
  };
  return map[key] || key;
}
function bulkActionButtons(key) {
  const c = BULK_CFG[key];
  if (!c) return '';
  let btns = '';
  if(c.edit) btns+=`<button class="btn btn-sm" data-edit onclick="bulkRun('${key}','edit')"><i class="ti ti-edit"></i>수정</button>`;
  if(c.clone) btns+=`<button class="btn btn-sm" data-clone onclick="bulkRun('${key}','clone')"><i class="ti ti-copy"></i>복제</button>`;
  if(c.toPo) btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','toPo')"><i class="ti ti-file-invoice"></i>발주서 생성</button>`;
  if(c.pdf)   btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','pdf')"><i class="ti ti-printer"></i>PDF 출력</button>`;
  if(c.csv)   btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','csv')"><i class="ti ti-file-spreadsheet"></i>엑셀</button>`;
  if(c.drive) btns+=`<button class="btn btn-sm drive-save-btn" data-act onclick="bulkRun('${key}','drive')"><i class="ti ti-cloud-upload"></i>Google Drive 저장</button>`;
  if(c.email) btns+=`<button class="btn btn-sm" data-email data-act onclick="bulkRun('${key}','email')"><i class="ti ti-mail"></i>이메일</button>`;
  btns+=`<button class="btn btn-sm btn-danger" data-act onclick="bulkRun('${key}','delete')"><i class="ti ti-trash"></i>삭제</button>`;
  return btns;
}
function bulkSelectionBarHtml(key, count) {
  return `<span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span>${bulkActionButtons(key)}<button class="btn btn-sm date-view-clear-selection" onclick="bulkToggleAll('${key}',false)"><i class="ti ti-x"></i>해제</button>`;
}
function registerBulkDateViewClearers() {
  if (_bulkDateViewClearersRegistered || typeof registerDateViewSelectionClearer !== 'function') return;
  _bulkDateViewClearersRegistered = true;
  Object.keys(BULK_CFG).forEach(key => {
    registerDateViewSelectionClearer(bulkDateViewKey(key), () => {
      const c = BULK_CFG[key];
      const cont = c && document.querySelector(c.sel);
      bulkSel[key] = new Set();
      if (cont) cont.querySelectorAll('tbody input[type=checkbox][data-bid]').forEach(cb => { cb.checked = false; });
      updateBulkBar(key);
    });
  });
}
function _escRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function enhanceBulk(key){
  const c=BULK_CFG[key]; if(!c) return;
  const cont=document.querySelector(c.sel); if(!cont) return;
  const tables=[...cont.querySelectorAll('table')]; if(!tables.length) return;
  if(!bulkSel[key] || tables.some(table=>!table.dataset.bulk)) bulkSel[key]=new Set();
  // (type,id) 시그니처 함수는 두 번째 인자가 id
  const delRe = c.type
    ? new RegExp(_escRe(c.del)+"\\(\\s*['\"][^'\"]*['\"]\\s*,\\s*['\"]([^'\"]+)['\"]")
    : new RegExp(_escRe(c.del)+"\\(\\s*['\"]([^'\"]+)['\"]");
  const hideFns=[c.del,c.edit,c.clone,c.pdf,c.csv,c.email, c.drive ? 'saveDocumentBundleToGoogleDrive' : null].filter(Boolean);
  tables.forEach(table=>{
    if(table.dataset.bulk) return;
    const headRow=table.querySelector('thead tr'); if(!headRow) return;
    table.dataset.bulk='1';
    const th=document.createElement('th'); th.style.cssText='width:24px;padding:6px 3px;text-align:center;';
    th.innerHTML=`<input type="checkbox" title="전체 선택" onclick="bulkToggleAll('${key}',this.checked)" style="width:12px;height:12px;accent-color:#1971c2;cursor:pointer;vertical-align:middle;">`;
    headRow.insertBefore(th, headRow.firstChild);
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{
      let id=null;
      tr.querySelectorAll('[onclick]').forEach(b=>{ const m=(b.getAttribute('onclick')||'').match(delRe); if(m && id==null) id=m[1]; });
      const td=document.createElement('td'); td.style.cssText='text-align:center;padding:6px 3px;';
      if(id!=null){
        td.innerHTML=`<input type="checkbox" data-bid="${id}" onclick="bulkToggle('${key}','${id.replace(/'/g,"\\'")}',this.checked)" style="width:12px;height:12px;accent-color:#1971c2;cursor:pointer;vertical-align:middle;">`;
        tr.querySelectorAll('[onclick]').forEach(b=>{ const oc=b.getAttribute('onclick')||''; if(c.edit && oc.includes(c.edit+'(')) return; if(hideFns.some(fn=>oc.includes(fn+'('))) b.style.display='none'; });
      }
      tr.insertBefore(td, tr.firstChild);
    });
    hideBulkActionColumn(table);
  });
  ensureBulkBar(key, tables[0], cont);
  updateBulkBar(key);
}
function bulkActionColumnIndex(table) {
  const headRow=table&&table.querySelector('thead tr'); if(!headRow) return -1;
  const cells=[...headRow.children];
  for(let i=cells.length-1;i>=0;i--){
    if(/(관리|동작|처리|작업)/.test((cells[i].textContent||'').trim())) return i;
  }
  return -1;
}
function hideBulkActionColumn(table) {
  const idx=bulkActionColumnIndex(table);
  if(idx<0) return;
  table.querySelectorAll('tr').forEach(row=>{
    const cell=row.children[idx];
    if(cell) cell.style.display='none';
  });
}
function ensureBulkBar(key, table, cont){
  if(document.getElementById('bulkbar-'+key)) return;
  const c=BULK_CFG[key]; const wrap=table.parentElement; if(!wrap||!wrap.parentNode) return;
  const bar=document.createElement('div'); bar.id='bulkbar-'+key;
  bar.className='selection-action-bar';
  bar.style.cssText='display:none;align-items:center;gap:8px;margin:0 0 12px;padding:9px 14px;background:var(--bg-i);border:1px solid var(--br-i);border-radius:8px;flex-wrap:wrap;';
  bar.innerHTML=`<span style="font-weight:700;font-size:12.5px;color:var(--tx-i);"><i class="ti ti-checkbox"></i> <span id="bulkcnt-${key}">0</span>건 선택됨</span>${bulkActionButtons(key)}<button class="btn btn-sm" style="margin-left:auto;" onclick="bulkToggleAll('${key}',false)"><i class="ti ti-x"></i>해제</button>`;
  if(key==='products' || key==='bom') cont.parentNode.insertBefore(bar, cont);
  else wrap.parentNode.insertBefore(bar, wrap);
}
function updateBulkBar(key){
  const n=(bulkSel[key]||new Set()).size;
  const cnt=document.getElementById('bulkcnt-'+key); if(cnt) cnt.textContent=n;
  const bar=document.getElementById('bulkbar-'+key);
  const viewKey=bulkDateViewKey(key);
  const slotted = typeof setDateViewSelectionBar === 'function' && setDateViewSelectionBar(viewKey, bulkSelectionBarHtml(key,n), n>0);
  if(bar) bar.style.display = (!slotted && n>0) ? 'flex' : 'none';   // 선택 시에만 표시
  [bar, document.getElementById('date-view-'+viewKey)].filter(Boolean).forEach(scope => {
    const edit=scope.querySelector('[data-edit]'); if(edit) edit.style.display = n===1 ? '' : 'none';
    const clone=scope.querySelector('[data-clone]'); if(clone) clone.style.display = n===1 ? '' : 'none';
    const email=scope.querySelector('[data-email]'); if(email) email.style.display = n===1 ? '' : 'none';
  });
}
function bulkToggle(key,id,on){ const s=bulkSel[key]=bulkSel[key]||new Set(); if(on)s.add(id);else s.delete(id); updateBulkBar(key); }
function bulkToggleAll(key,on){ const s=bulkSel[key]=new Set(); const cont=document.querySelector(BULK_CFG[key].sel); if(cont) cont.querySelectorAll('tbody input[type=checkbox][data-bid]').forEach(cb=>{ cb.checked=on; if(on) s.add(cb.getAttribute('data-bid')); }); updateBulkBar(key); }
function bulkRun(key, action){
  const c=BULK_CFG[key]; const ids=[...(bulkSel[key]||[])]; if(!ids.length) return;
  if(action==='edit' && c.edit){
    if(ids.length!==1) return;
    const id=ids[0];
    if(key==='products'){
      const p=products.find(x=>x.id===id); if(p) window[c.edit](p.clientId,id);
    } else if(c.type) window[c.edit](c.type,id);
    else window[c.edit](id);
  } else if(action==='clone' && c.clone){
    if(ids.length!==1) return;
    const id=ids[0];
    if(key==='products'){
      const p=products.find(x=>x.id===id); if(p) window[c.clone](p.clientId,id);
    } else if(c.type) window[c.clone](c.type,id);
    else window[c.clone](id);
  } else if(action==='delete'){
    if(!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    const oc=window.confirm; window.confirm=()=>true;
    const ocf=window.confirm_; window.confirm_=(t,m,fn)=>{ fn&&fn(); };   // 커스텀 확인창도 자동 승인
    let failed=0;
    try{ ids.forEach(id=>{ try{ c.type ? window[c.del](c.type,id) : window[c.del](id); }catch(e){ failed++; console.warn('일괄 삭제 실패:', key, id, e); } }); }
    finally { window.confirm=oc; window.confirm_=ocf; }
    bulkSel[key]=new Set();
    updateBulkBar(key);
    if(failed) showToast(`${ids.length-failed}건 삭제 완료, ${failed}건 실패 (콘솔 확인)`, 'error');
    else showToast(`${ids.length}건이 삭제되었습니다.`);
  } else if(action==='pdf' && c.pdf){
    if(c.type){ try{ window[c.pdf](c.type, ids); }catch(e){} }    // 선택 건 한 창에 개별 페이지
    else ids.forEach(id=>{ try{ window[c.pdf](id); }catch(e){} });
  }
  else if(action==='csv' && c.csv){ ids.forEach(id=>{ try{ window[c.csv](id); }catch(e){} }); }
  else if(action==='drive' && c.drive){
    saveDocumentBundleToGoogleDrive(c.type || key, ids);
  }
  else if(action==='toPo' && key==='rfq' && typeof convertRfqToPo === 'function'){
    convertRfqToPo(ids);
    bulkSel[key]=new Set();
    bulkToggleAll(key,false);
  }
  else if(action==='email' && c.email){
    if(ids.length!==1){ showToast('이메일은 한 건만 선택해 발송하세요.','info'); return; }
    const obj=_bulkFindObj(key, ids[0]); if(obj){ try{ window[c.email](obj, c.type||key); }catch(e){} }
  }
}
function _bulkFindObj(key, id){
  const map={ po:poList, rfq:rfqList, statement:statementList, tax:taxList, quote:quoteList, order:orderList };
  const list=map[key]; return list ? list.find(x=>x.id===id) : null;
}
function watchBulk(){
  try {
    Object.keys(BULK_CFG).forEach(key=>{
      const c=BULK_CFG[key]; const cont=document.querySelector(c.sel); if(!cont) return;
      if(!cont._bulkObs){
        const obs=new MutationObserver(()=>{ obs.disconnect(); try{ enhanceBulk(key); }catch(e){} obs.observe(cont,{childList:true,subtree:true}); });
        cont._bulkObs=obs; obs.observe(cont,{childList:true,subtree:true});
      }
      try{ enhanceBulk(key); }catch(e){}
    });
  } catch(e){ /* BULK_CFG 초기화 이전(부팅 중) 호출 — 무시 */ }
}

cloudBootstrap();   // 클라우드(Firebase) 연동 시작 — 설정 시 로그인 게이트 활성화
initRole();         // 역할 기반 접근제어(RBAC) 적용 — 사이드바/페이지 권한
registerBulkDateViewClearers();
watchBulk();        // 일괄 선택/동작 활성화

/* 탑바 시계 제거됨 (tick/setInterval 삭제) */
