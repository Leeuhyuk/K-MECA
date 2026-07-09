/* ════════ 실시간 자동 동기화 (Firestore onSnapshot) ════════ */
/* localStorage(클라우드에서 갱신됨)의 값을 메모리 전역 변수로 다시 반영 */
function cloudResyncGlobals(changedKeys){
  const changedSet = Array.isArray(changedKeys) && changedKeys.length ? new Set(changedKeys) : null;
  const shouldLoad = k => !changedSet || changedSet.has(k);
  const L=(k,cur)=>loadStorage(k,cur);
  if(shouldLoad('clients')) clients=L('clients',clients);
  if(shouldLoad('products')) products=L('products',products);
  if(shouldLoad('materials')) materials=L('materials',materials);
  if(shouldLoad('workOrders')) workOrders=L('workOrders',workOrders);
  if(shouldLoad('workers')) workers=L('workers',workers);
  if(shouldLoad('defects')) defects=L('defects',defects);
  if(shouldLoad('claims')) claims=L('claims',claims);
  if(shouldLoad('checkRecords')) checkRecords=L('checkRecords',checkRecords);
  if(shouldLoad('inventory')) inventory=L('inventory',inventory);
  if(shouldLoad('inventoryLedger')) inventoryLedger=L('inventoryLedger',inventoryLedger);
  if(shouldLoad('deliveries')) deliveries=L('deliveries',deliveries);
  if(shouldLoad('trash')) trash=L('trash',trash);
  if(shouldLoad('rfqList')) rfqList=L('rfqList',rfqList);
  if(shouldLoad('poList')) poList=L('poList',poList);
  if(shouldLoad('partners')) partners=L('partners',partners);
  if(shouldLoad('statementList')) statementList=L('statementList',statementList);
  if(shouldLoad('taxList')) taxList=L('taxList',taxList);
  if(shouldLoad('quoteList')) quoteList=L('quoteList',quoteList);
  if(shouldLoad('orderList')) orderList=L('orderList',orderList);
  if(shouldLoad('financeData')) financeData=L('financeData',financeData);
  if(shouldLoad('attendance')) attendance=L('attendance',attendance);
  if(shouldLoad('leaves')) leaves=L('leaves',leaves);
  if(shouldLoad('payrollRecords')) payrollRecords=L('payrollRecords',payrollRecords);
  if(shouldLoad('workers') && typeof repairWorkerTimeValues === 'function') repairWorkerTimeValues();
  if(!changedSet || shouldLoad('financeData')){
  if(!financeData || typeof financeData!=='object' || Array.isArray(financeData)) financeData={};   // null/배열 방어
  if(!financeData.entries) financeData.entries=[]; if(!financeData.paidReceivable) financeData.paidReceivable={};
  if(!financeData.paidPayable) financeData.paidPayable={}; if(!financeData.closedMonths) financeData.closedMonths=[];
  if(!financeData.auditLog) financeData.auditLog=[]; if(!financeData.payrollSettings) financeData.payrollSettings={};
  if(!financeData.paymentRequests) financeData.paymentRequests=[];
  if(!financeData.fixedCosts) financeData.fixedCosts=[];
  if(!financeData.fixedCostPayments) financeData.fixedCostPayments=[];
  if(!financeData.hometaxInvoices) financeData.hometaxInvoices=[];
  }
  if(shouldLoad('asList')) asList=L('asList',asList);
  if(shouldLoad('bomList')) bomList=L('bomList',bomList);
  if(shouldLoad('memoList')) memoList=L('memoList',memoList);
  if(shouldLoad('todoList')) todoList=L('todoList',todoList);
  if(shouldLoad('auditLog')) auditLog=L('auditLog',auditLog);
  if(shouldLoad('emailSendHistory')) emailSendHistory=L('emailSendHistory',emailSendHistory);
  const screenSettingKeys = ['uiBrandSettings','uiScale','uiFontScale','menuIconSize','tableGridLines','uiColors','theme'];
  if (screenSettingKeys.some(key => shouldLoad(key)) && typeof applyScreenSettingsFromStorage === 'function') {
    applyScreenSettingsFromStorage();
  }
  if (shouldLoad('tableDisplayConfig') && typeof applyTableDisplaySettings === 'function') {
    applyTableDisplaySettings();
    if (typeof currentPage !== 'undefined' && currentPage === 'system' && typeof systemTab !== 'undefined' && systemTab === 'columns' && typeof renderTableDisplaySettings === 'function') {
      renderTableDisplaySettings();
    }
  }
  if ((!changedSet || shouldLoad('clients') || shouldLoad('partners')) && typeof migrateClientMasterToPartners === 'function') migrateClientMasterToPartners();
}
let _cloudRemoteRefreshTimer = null;
let _cloudRemoteRefreshKeys = new Set();
const CLOUD_PAGE_KEYS = {
  dashboard:['clients','products','materials','inventory','workOrders','defects','claims','deliveries','todoList','alerts'],
  clients:['clients','products','materials','workOrders','deliveries','asList'],
  materials:['materials','products','clients','partners'],
  orders:['workOrders','products','clients','workers'],
  process:['products','materials','workOrders','clients'],
  quality:['defects','claims','checkRecords','products','clients','workers','workOrders'],
  claims:['claims','products','clients'],
  inventory:['inventory','inventoryLedger'],
  deliveries:['deliveries','clients','products'],
  calendar:['products','deliveries','workOrders','materials'],
  rfq:['rfqList','clients','products','partners','companyInfo','emailSendHistory'],
  po:['poList','rfqList','clients','products','partners','financeData','companyInfo','emailSendHistory'],
  partners:['partners','poList','clients'],
  salesdoc:['quoteList','orderList','clients','products','companyInfo','emailSendHistory'],
  statement:['statementList','clients','companyInfo','emailSendHistory'],
  taxinvoice:['taxList','clients','companyInfo','emailSendHistory'],
  finance:['financeData','deliveries','poList','payrollRecords','workers','products','clients'],
  workers:['workers','attendance','leaves','payrollRecords'],
  as:['asList','clients','products','workers'],
  bom:['bomList','products','materials'],
  notes:['memoList','todoList'],
  popbill:['companyInfo']
};
function cloudKeysAffectCurrentPage(keys){
  if (!keys || !keys.length) return true;
  const page = (typeof currentPage !== 'undefined' && currentPage) || 'dashboard';
  if (page === 'system') return true;
  const relevant = CLOUD_PAGE_KEYS[page];
  if (!relevant) return true;
  return keys.some(k => relevant.includes(k));
}
function cloudScheduleRemoteRefresh(keys){
  (Array.isArray(keys) ? keys : [keys]).filter(Boolean).forEach(k => _cloudRemoteRefreshKeys.add(k));
  clearTimeout(_cloudRemoteRefreshTimer);
  _cloudRemoteRefreshTimer = setTimeout(() => {
    // 입력 중 모달이 열려 있으면 데이터 덮어쓰기/새로고침을 모두 보류하고 잠시 후 재시도.
    // (메모리 전역까지 교체하면 편집 중인 내용이 유실되므로 cloudResyncGlobals 자체를 미룬다)
    if (document.querySelector('.overlay.open')) {
      _cloudRemoteRefreshTimer = setTimeout(cloudScheduleRemoteRefresh, 1000);
      return;
    }
    const changedKeys = Array.from(_cloudRemoteRefreshKeys);
    _cloudRemoteRefreshKeys.clear();
    cloudResyncGlobals(changedKeys);
    if (cloudKeysAffectCurrentPage(changedKeys)) {
      try { refreshPage(currentPage); } catch(e){}
    }
    try { updateDlvBadge(); updateAsBadge(); updateTrashBadge(); updateTodoBadge(); } catch(e){}
    _cloudChip('synced'); setTimeout(()=>_cloudChip('online'), 1500);
  }, 250);
}
/* 다른 사용자의 변경을 실시간 수신 → localStorage 갱신 → 전역 반영 → 현재 화면 새로고침 */
function cloudSnapshotVersionMillis(doc){
  const data = doc && doc.data ? (doc.data() || {}) : {};
  const ts = data.sourceUpdatedAt;
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
}
function cloudStoredVersion(key){
  return Number(localStorage.getItem('mes_cloudVer_' + key) || 0) || 0;
}
function cloudRememberVersion(key, ver){
  if (ver) localStorage.setItem('mes_cloudVer_' + key, String(ver));
}
function cloudSubscribe(){
  if (!_cloudActive || _cloudUnsub || !_fbDb) return;
  const unsubs = [];
  const v2SnapshotReady = {};
  const v2Unsubs = CLOUD_KEYS.map(key => _fbDb.collection('mes_v2').doc(key).onSnapshot(doc=>{
    const ver = cloudSnapshotVersionMillis(doc);
    if (!v2SnapshotReady[key]) {
      v2SnapshotReady[key] = true;
      if (!ver || cloudStoredVersion(key) >= ver) return;
    }
    if (doc.metadata.hasPendingWrites) return;     // 내가 쓴 변경(로컬 에코)은 무시
    // 아직 서버로 보내지 않은 로컬 편집이 대기 중인 키는 원격값으로 덮어쓰지 않음
    // (비순차 원격 읽기가 최신 로컬 데이터를 되돌리는 것을 방지 — 편집 중 키는 로컬 우선)
    if (typeof _cloudQueue !== 'undefined' && _cloudQueue && _cloudQueue.has(key)) return;
    if (typeof _cloudSavingKeys !== 'undefined' && _cloudSavingKeys && _cloudSavingKeys.has(key)) return;
    if (typeof cloudLoadV2Key !== 'function') return;
    cloudLoadV2Key(key)
      .then(loaded => { if (loaded) cloudScheduleRemoteRefresh(key); })
      .catch(err => { console.warn('MES v2 실시간 동기화 오류:', key, err); });
  }, err=>{ console.warn('MES v2 문서 실시간 동기화 오류:', key, err); }));
  unsubs.push(...v2Unsubs);

  // 권한 설정(roles: 페이지/컬럼/버튼) 실시간 반영 — 관리자가 바꾸면 모든 기기에 즉시 적용
  let rolesSnapshotReady = false;
  _fbDb.collection('roles').onSnapshot(snap=>{
    const initial = !rolesSnapshotReady;
    rolesSnapshotReady = true;
    let changed=false;
    snap.docChanges().forEach(ch=>{
      if (ch.type==='removed') return;
      const id=ch.doc.id, d=ch.doc.data();
      if (id==='config'){ saveStorageLocalOnly('rolePages', d); changed=true; }
      else if (id==='columns'){ saveStorageLocalOnly('roleColumns', d); changed=true; }
      else if (id==='features'){ saveStorageLocalOnly('roleFeatures', d); changed=true; }
      else if (id==='dataScope'){ saveStorageLocalOnly('roleDataScope', d); changed=true; }
    });
    if (!changed) return;
    allowedPages = roleAllowedSet(currentRole);   // 페이지 권한 재계산 후 재적용
    applyRoleGating(); applyColumnGating(); applyFeatureGating();
    applyRoleGating(); applyColumnGating(); applyFeatureGating();
    if (!initial && !document.querySelector('.overlay.open')) { try{ refreshPage(currentPage); }catch(e){} }
    if (!initial && currentPage==='system' && systemTab==='permissions' && !document.querySelector('.overlay.open')) { try{ renderPermissions(); }catch(e){} }
    _cloudChip('synced'); setTimeout(()=>_cloudChip('online'), 1500);
  }, err=>{ console.warn('권한 실시간 동기화 오류', err); });

  // 로그인 계정 목록(users) 실시간 캐시 — 인사 명부와 조인
  let usersSnapshotReady = false;
  _fbDb.collection('users').onSnapshot(snap=>{
    const initial = !usersSnapshotReady;
    usersSnapshotReady = true;
    cloudUsers = snap.docs.map(d=>Object.assign({uid:d.id}, d.data()));
    saveStorageLocalOnly('cloudUsers_cache', cloudUsers);
    if (!initial && !document.querySelector('.overlay.open')){
      if (currentPage==='workers') { try{ renderWorkers(); }catch(e){} }
      if (currentPage==='system' && systemTab==='permissions') { try{ renderPermissions(); }catch(e){} }
    }
  }, err=>{ console.warn('계정 목록 동기화 오류', err); });
  _cloudUnsub = () => {
    unsubs.forEach(unsub => { try { unsub(); } catch(e){} });
    _cloudUnsub = null;
  };
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
  _cloudActive = false;
  _cloudUser = null;
  sessionStorage.removeItem('mes_cloud_synced');
  try { if (_cloudUnsub) _cloudUnsub(); } catch(e){}
  try { closeMegaMenu(); closeTopbarAlerts(); closeTopbarMoreMenu(); closeSbOverlay(); } catch(e){}
  document.querySelectorAll('.overlay.open').forEach(el => el.classList.remove('open'));
  _showLogin();
  _cloudMsg('로그아웃 중…','#8a93ad');
  _fbAuth.signOut()
    .then(()=>_cloudMsg('', '#8a93ad'))
    .catch(e=>_cloudMsg(_cloudErr(e)));
}
function _cloudErr(e){
  const m={'auth/invalid-credential':'이메일 또는 비밀번호가 올바르지 않습니다.','auth/user-not-found':'등록되지 않은 계정입니다.','auth/wrong-password':'비밀번호가 올바르지 않습니다.','auth/email-already-in-use':'이미 가입된 이메일입니다.','auth/invalid-email':'이메일 형식이 올바르지 않습니다.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.'};
  return m[e.code]||('오류: '+(e.message||e.code));
}
function _showLogin(){
  if (typeof setAuthShellLocked === 'function') setAuthShellLocked(true);
  const el=inp('cloud-login'); if(el) el.style.display='flex';
  const pw=inp('cl-pw'); if(pw) pw.value='';
  const c=inp('cloud-chip'); if(c) c.style.display='none';
}
function _hideLogin(){
  const el=inp('cloud-login'); if(el) el.style.display='none';
  if (typeof setAuthShellLocked === 'function') setAuthShellLocked(false);
}
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
  else if (systemTab === 'backup') renderBackupExportSettings();
  else if (systemTab === 'api') renderApiSettings();
  else if (systemTab === 'storage') renderFirebaseUsageSettings();
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
function applyTableDisplaySettings(root){
  const cfg = tableDisplayConfig();
  const tables = _tableDisplayTables();
  let css = '';
  Object.keys(tables).forEach(tableKey => {
    const table = tables[tableKey];
    const tableCfg = cfg[tableKey] || {};
    const hidden = tableCfg.hidden || {};
    _markTableDisplayCells(tableKey, table, root);
    (table.cols || []).forEach((col, index) => {
      if (!hidden[col]) return;
      css += `${table.sel} [data-table-display-col="${tableKey}-${index}"]{display:none!important;visibility:collapse!important;}\n`;
    });
  });
  let st = document.getElementById('table-display-style');
  if (!st) { st = document.createElement('style'); st.id = 'table-display-style'; document.head.appendChild(st); }
  st.textContent = css;
  applyTableDisplayLabels(root);
}
function _tableDisplayWrap(table, root){
  const scope = root && root.querySelector ? root : document;
  if (scope.matches && scope.matches(table.sel)) return scope;
  return scope.querySelector(table.sel) || (!root ? document.querySelector(table.sel) : null);
}
function _normalizeTableDisplayText(value){
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[↕↔▲▼△▽▴▾]/g, '')
    .trim();
}
function _tableDisplayHeaderText(th){
  if (!th) return '';
  const clone = th.cloneNode(true);
  clone.querySelectorAll('i,svg,input,button,select').forEach(node => node.remove());
  return _normalizeTableDisplayText(clone.textContent);
}
function _tableDisplayColumnLookup(tableKey, table){
  const cfg = tableDisplayConfig();
  const labels = (cfg[tableKey] && cfg[tableKey].labels) || {};
  const lookup = new Map();
  (table.cols || []).forEach((col, index) => {
    const candidates = [col, labels[col]];
    if (col === '생산제품') candidates.push('생산 제품');
    if (col === '제품/규격명') candidates.push('제품명', '제품규격명');
    if (col === '공정 단계 → 상태') candidates.push('공정 단계', '공정단계상태');
    if (col === '고객사') candidates.push('구분고객사');
    if (col === '자재명') candidates.push('자재품명');
    if (col === '공급처') candidates.push('협력공급처');
    if (col === '관리 작업') candidates.push('관리');
    if (col === '관리') candidates.push('관리 작업', '관리작업');
    if (col === '참고') candidates.push('비고', '참고사항');
    candidates.forEach(candidate => {
      const key = _normalizeTableDisplayText(candidate);
      if (!key) return;
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push(index);
    });
  });
  return lookup;
}
function _tableDisplayIndexFromHeader(th, lookup, used){
  const text = _tableDisplayHeaderText(th);
  if (!text) return -1;
  const direct = lookup.get(text) || [];
  const found = direct.find(index => !used.has(index));
  if (found !== undefined) return found;
  let fallback = -1;
  lookup.forEach((indexes, key) => {
    if (fallback >= 0 || !key) return;
    if (text.includes(key) || key.includes(text)) {
      const next = indexes.find(index => !used.has(index));
      if (next !== undefined) fallback = next;
    }
  });
  return fallback;
}
function _tableDisplayIndexFromPosition(head, th, visualIndex, colsLength, used){
  if (!th || th.querySelector('input[type="checkbox"]')) return -1;
  const leadingSelection = head.cells[0] && head.cells[0].querySelector('input[type="checkbox"]') ? 1 : 0;
  const originalIndex = Number(th.dataset.oidx);
  if (Number.isFinite(originalIndex)) {
    if (originalIndex >= 0 && originalIndex < colsLength && !used.has(originalIndex)) return originalIndex;
    const shifted = originalIndex - leadingSelection;
    if (shifted >= 0 && shifted < colsLength && !used.has(shifted)) return shifted;
  }
  const visual = visualIndex - leadingSelection;
  if (visual >= 0 && visual < colsLength && !used.has(visual)) return visual;
  return -1;
}
function _markTableDisplayCells(tableKey, table, root){
  const wrap = _tableDisplayWrap(table, root);
  if (!wrap) return null;
  const tableEl = wrap.matches && wrap.matches('table') ? wrap : wrap.querySelector('table');
  if (!tableEl || !tableEl.tHead || !tableEl.tHead.rows.length) return null;
  // React 소유 테이블 등 opt-out 대상은 셀 재마킹을 건너뛴다(React 가 렌더한
  // data-table-display-col 을 보존 → rbac.js CSS 게이팅은 그대로 작동).
  if (tableEl.dataset.managedTable === 'false' || tableEl.hasAttribute('data-no-managed-table')) return null;
  tableEl.classList.add('table-display-fluid');
  const head = tableEl.tHead.rows[0];
  const cols = table.cols || [];
  const lookup = _tableDisplayColumnLookup(tableKey, table);
  const used = new Set();
  Array.from(head.cells).forEach(th => th.removeAttribute('data-table-display-col'));
  const colgroup = tableEl.querySelector('colgroup');
  if (colgroup) Array.from(colgroup.children).forEach(col => col.removeAttribute('data-table-display-col'));
  Array.from(tableEl.tBodies || []).forEach(tbody => {
    Array.from(tbody.rows).forEach(row => {
      Array.from(row.cells).forEach(cell => cell.removeAttribute('data-table-display-col'));
    });
  });
  Array.from(head.cells).forEach((th, visualIndex) => {
    let colIndex = _tableDisplayIndexFromHeader(th, lookup, used);
    if (colIndex < 0) colIndex = _tableDisplayIndexFromPosition(head, th, visualIndex, cols.length, used);
    if (colIndex < 0 || colIndex >= cols.length) {
      th.removeAttribute('data-table-display-col');
      return;
    }
    used.add(colIndex);
    th.dataset.tableDisplayCol = `${tableKey}-${colIndex}`;
    if (colgroup && colgroup.children[visualIndex]) {
      colgroup.children[visualIndex].dataset.tableDisplayCol = `${tableKey}-${colIndex}`;
    }
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
  return { tableEl, head };
}
function applyTableDisplayLabels(root){
  const cfg = tableDisplayConfig();
  const tables = _tableDisplayTables();
  Object.keys(tables).forEach(tableKey => {
    const table = tables[tableKey];
    const labels = (cfg[tableKey] && cfg[tableKey].labels) || {};
    const marked = _markTableDisplayCells(tableKey, table, root);
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
let auditLogFilterText = '';
let serverAuditLogCache = [];
let serverAuditLogLoaded = false;
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
    {key:'data', icon:'ti-eye-cog', title:'데이터 노출 권한', desc:'공통/본인 데이터 기준'},
    {key:'audit', icon:'ti-history', title:'감사 로그', desc:'등록·수정·삭제 이력 조회'},
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
          <div class="permission-section" style="${permSection==='data'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-eye-cog"></i>역할별 데이터 노출 권한</span>
              <span style="font-size:11px;color:var(--tx-t);">공통 공개 업무는 모두 보이고, 본인 전용 업무는 작성/소유한 데이터만 보입니다. 관리자는 항상 전체입니다.</span></div>
            <div id="perm-data-scope"></div>
          </div>
          <div class="permission-section" style="${permSection==='audit'?'':'display:none;'}">
            <div class="card-hd"><span class="card-ttl"><i class="ti ti-history"></i>감사 로그</span>
              <span style="font-size:11px;color:var(--tx-t);">최근 등록·수정·삭제·복구·상태 변경 이력</span></div>
            <div id="perm-audit-log"></div>
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
  renderPermDataScope();
  renderPermAuditLog();
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
function setPermRole(r){ permColRole = r; renderPermMatrix(); renderPermColumns(); renderPermFeatures(); renderPermDataScope(); }
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
function renderPermDataScope(){
  const el=inp('perm-data-scope'); if(!el) return;
  const role=permColRole;
  const cfg=roleDataScopeConfig();
  const scopes=cfg[role]||{};
  const RB='1px solid var(--br)';
  const RL={manager:'중간관리자',staff:'평사원'};
  const tab=(r,label)=>`<button onclick="setPermRole('${r}')" style="border:none;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;background:${role===r?'#1971c2':'transparent'};color:${role===r?'#fff':'var(--tx-s)'};">${label}</button>`;
  const rows=DATA_SCOPE_DEFS.map(def=>{
    const scope=scopes[def.id] || def.defaultScope || 'own';
    const shared=scope==='shared';
    return `<div style="display:grid;grid-template-columns:minmax(130px,180px) minmax(220px,1fr) 150px;gap:10px;align-items:center;padding:10px 12px;border-top:${RB};">
      <div style="font-weight:800;font-size:12.5px;">${def.label}</div>
      <div style="font-size:11px;color:var(--tx-s);line-height:1.45;">${def.desc || ''}</div>
      <button class="btn btn-sm ${shared?'btn-primary':''}" type="button" onclick="permToggleDataScope('${role}','${def.id}','${shared?'own':'shared'}')" title="${shared?'모든 사용자가 볼 수 있음':'작성/소유한 데이터만 볼 수 있음'}">
        <i class="ti ${shared?'ti-users':'ti-user'}"></i>${shared?'공통 공개':'본인 전용'}
      </button>
    </div>`;
  }).join('');
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--tx-s);font-weight:700;">역할 선택</span>
      <div style="display:inline-flex;border:${RB};border-radius:8px;overflow:hidden;">${tab('manager','중간관리자')}${tab('staff','평사원')}</div>
      <span style="font-size:11px;color:var(--tx-t);"><b style="color:#1971c2;">공통 공개</b> = 같은 역할 사용자에게 모두 표시 · <b>본인 전용</b> = 작성/소유 데이터만 표시</span>
      <span style="margin-left:auto;font-size:10.5px;white-space:nowrap;">
        <a onclick="permSetAllDataScopes('${role}','shared')" style="color:var(--tx-i);cursor:pointer;">전체 공통</a>
        <span style="color:var(--tx-t);"> · </span>
        <a onclick="permSetAllDataScopes('${role}','own')" style="color:var(--tx-d);cursor:pointer;">전체 본인 전용</a>
      </span>
    </div>
    <div style="font-size:11.5px;color:var(--tx-s);margin-bottom:10px;"><b>${RL[role]}</b> 에게 데이터가 노출되는 범위를 설정합니다. 기본값은 재고·공정·메모만 공통 공개입니다.</div>
    <div style="border:${RB};border-radius:10px;background:var(--bg-p);overflow:hidden;">${rows}</div>`;
}
function allAuditLogRows(){
  const rows = [];
  if (Array.isArray(auditLog)) rows.push(...auditLog);
  if (financeData && Array.isArray(financeData.auditLog)) rows.push(...financeData.auditLog);
  if (Array.isArray(serverAuditLogCache)) rows.push(...serverAuditLogCache);
  const seen = new Set();
  return rows.filter(log => {
    if (!log) return false;
    const key = log.id || [log.at, log.entityType, log.entityId, log.action, log.summary || log.detail].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(log => typeof enrichAuditLogFromCurrentRecord === 'function' ? enrichAuditLogFromCurrentRecord(log) : log)
    .sort((a,b) => String(b.at || '').localeCompare(String(a.at || '')));
}
function loadServerAuditLogsForAdmin(){
  if (serverAuditLogLoaded || currentRole !== 'admin' || !_fbDb) return;
  serverAuditLogLoaded = true;
  _fbDb.collection('audit_logs').orderBy('at', 'desc').limit(500).get()
    .then(snap => {
      serverAuditLogCache = snap.docs.map(doc => Object.assign({ id:doc.id }, doc.data()));
      if (permSection === 'audit') renderPermAuditLog();
    })
    .catch(e => {
      console.warn('서버 감사 로그 조회 실패:', e && e.code);
      serverAuditLogLoaded = false;
    });
}
const AUDIT_CHANGE_ITEM_FIELDS = ['itemName','spec','qty','unit','price','note'];
const AUDIT_CHANGE_ITEM_FIELD_LABELS = {
  itemName: '품목명',
  spec: '규격',
  qty: '수량',
  unit: '단위',
  price: '단가',
  note: '비고'
};
const AUDIT_CHANGE_FIELD_LABELS = Object.assign({
  itemName: '품목명',
  spec: '규격',
  qty: '수량',
  unit: '단위',
  unitPrice: '단가',
  price: '단가',
  note: '비고',
  status: '상태',
  date: '일자',
  deliveryDate: '납기일',
  clientId: '거래처',
  clientName: '거래처명',
  totalAmt: '합계금액'
}, AUDIT_CHANGE_ITEM_FIELD_LABELS);
const AUDIT_CHANGE_DOC_MIRROR_FIELDS = new Set(['itemName','spec','qty','unit','unitPrice','price','note']);
function auditChangeRawText(value){
  if (typeof _auditString === 'function') return _auditString(value);
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch(e) { return String(value); }
}
function auditChangeFieldLabel(field, label){
  if (label) return label;
  const text = String(field || '');
  const itemMatch = text.match(/^items\.(\d+)\.([A-Za-z0-9_]+)$/);
  if (itemMatch) return `품목 ${Number(itemMatch[1]) + 1} ${AUDIT_CHANGE_ITEM_FIELD_LABELS[itemMatch[2]] || itemMatch[2]}`;
  return AUDIT_CHANGE_FIELD_LABELS[text] || text || '변경';
}
function auditChangeValueText(value){
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('ko-KR') : String(value);
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return `${value.length}건`;
  if (typeof value === 'object') return auditChangeObjectSummary(value);
  return auditChangeRawText(value);
}
function auditChangeObjectSummary(value){
  if (!value || typeof value !== 'object') return auditChangeValueText(value);
  const parts = AUDIT_CHANGE_ITEM_FIELDS
    .filter(field => value[field] != null && value[field] !== '')
    .map(field => `${AUDIT_CHANGE_ITEM_FIELD_LABELS[field] || field}: ${auditChangeValueText(value[field])}`);
  if (parts.length) return parts.join(' · ');
  return Object.keys(value).slice(0, 6).map(key => `${key}: ${auditChangeValueText(value[key])}`).join(' · ');
}
function auditChangeItemRow(row){
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const out = {};
  AUDIT_CHANGE_ITEM_FIELDS.forEach(field => { out[field] = row[field] ?? ''; });
  return out;
}
function auditChangeRowHasValue(row){
  return AUDIT_CHANGE_ITEM_FIELDS.some(field => String(auditChangeRawText((row && row[field]) ?? '')).trim() !== '');
}
function auditChangeItemsTable(change){
  const beforeRows = Array.isArray(change.before) ? change.before : [];
  const afterRows = Array.isArray(change.after) ? change.after : [];
  const max = Math.max(beforeRows.length, afterRows.length);
  const rows = [];
  for (let i = 0; i < max; i++) {
    const beforeRow = auditChangeItemRow(beforeRows[i]);
    const afterRow = auditChangeItemRow(afterRows[i]);
    const beforeHas = auditChangeRowHasValue(beforeRow);
    const afterHas = auditChangeRowHasValue(afterRow);
    if (!beforeHas && !afterHas) continue;
    const rowName = `품목 ${i + 1}`;
    if (!beforeHas && afterHas) {
      rows.push(`<tr><td>${esc(rowName)}</td><td>추가</td><td>-</td><td>${esc(auditChangeObjectSummary(afterRow))}</td></tr>`);
      continue;
    }
    if (beforeHas && !afterHas) {
      rows.push(`<tr><td>${esc(rowName)}</td><td>삭제</td><td>${esc(auditChangeObjectSummary(beforeRow))}</td><td>-</td></tr>`);
      continue;
    }
    AUDIT_CHANGE_ITEM_FIELDS.forEach(field => {
      if (auditChangeRawText(beforeRow[field]) === auditChangeRawText(afterRow[field])) return;
      rows.push(`<tr><td>${esc(rowName)}</td><td>${esc(AUDIT_CHANGE_ITEM_FIELD_LABELS[field] || field)}</td><td>${esc(auditChangeValueText(beforeRow[field]))}</td><td>${esc(auditChangeValueText(afterRow[field]))}</td></tr>`);
    });
  }
  if (!rows.length) return '';
  return `<div class="audit-change-items"><table class="audit-change-mini" data-no-managed-table><thead><tr><th>행</th><th>항목</th><th>변경 전</th><th>변경 후</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function auditChangeItemFieldTable(changes){
  const rows = [];
  (changes || []).forEach(c => {
    const match = String(c.field || '').match(/^items\.(\d+)\.([A-Za-z0-9_]+)$/);
    if (!match) return;
    const rowName = `품목 ${Number(match[1]) + 1}`;
    const label = AUDIT_CHANGE_ITEM_FIELD_LABELS[match[2]] || auditChangeFieldLabel(c.field, c.label).replace(/^품목\s+\d+\s*/, '') || match[2];
    rows.push(`<tr><td>${esc(rowName)}</td><td>${esc(label)}</td><td>${esc(auditChangeValueText(c.before))}</td><td>${esc(auditChangeValueText(c.after))}</td></tr>`);
  });
  if (!rows.length) return '';
  return `<div class="audit-change-items"><table class="audit-change-mini" data-no-managed-table><thead><tr><th>행</th><th>항목</th><th>변경 전</th><th>변경 후</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function auditChangeRowsForDisplay(log){
  const changes = Array.isArray(log.changes) ? log.changes.filter(Boolean) : [];
  const hasItemChange = changes.some(c => c && (c.field === 'items' || /^items\.\d+\./.test(String(c.field || ''))));
  return hasItemChange ? changes.filter(c => !AUDIT_CHANGE_DOC_MIRROR_FIELDS.has(String(c.field || ''))) : changes;
}
function auditCreateDateText(log) {
  const raw = (log && (log.targetCreatedAt || log.createdAt || log.at)) || '';
  if (!raw) return '-';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString('ko-KR');
}
function auditChangeText(log){
  log = log || {};
  if (String(log.action || '') === 'create') {
    return `<div class="audit-change-line"><b>등록일자</b>: <span class="audit-after">${esc(auditCreateDateText(log))}</span></div>`;
  }
  const changes = auditChangeRowsForDisplay(log || {});
  if (!changes.length) return esc(log.detail || log.summary || '');
  const itemFieldTable = auditChangeItemFieldTable(changes);
  let itemFieldTableUsed = false;
  const blocks = changes.map(c => {
    if (/^items\.\d+\./.test(String(c.field || ''))) {
      if (itemFieldTableUsed) return '';
      itemFieldTableUsed = true;
      return itemFieldTable;
    }
    if (c.field === 'items') return auditChangeItemsTable(c) || `<div><b>${esc(auditChangeFieldLabel(c.field, c.label))}</b>: ${esc(auditChangeValueText(c.before))} &rarr; ${esc(auditChangeValueText(c.after))}</div>`;
    return `<div class="audit-change-line"><b>${esc(auditChangeFieldLabel(c.field, c.label))}</b>: <span class="audit-before">${esc(auditChangeValueText(c.before))}</span> &rarr; <span class="audit-after">${esc(auditChangeValueText(c.after))}</span></div>`;
  }).filter(Boolean);
  const limit = changes.some(c => String(c.field || '').indexOf('items') === 0) ? 12 : 6;
  const hidden = blocks.length > limit ? `<div class="audit-change-more">외 ${blocks.length - limit}건</div>` : '';
  return blocks.slice(0, limit).join('') + hidden;
}
function renderPermAuditLog(){
  const el=inp('perm-audit-log'); if(!el) return;
  if (currentRole !== 'admin' && !roleFeatureAllowed('audit')) {
    el.innerHTML = `<div class="empty"><i class="ti ti-lock"></i>감사 로그 조회 권한이 없습니다.</div>`;
    return;
  }
  loadServerAuditLogsForAdmin();
  const q = String(auditLogFilterText || '').trim().toLowerCase();
  const logs = allAuditLogRows().filter(log => {
    if (!q) return true;
    return [log.entityType, log.entityId, log.action, log.actorName, log.summary, log.detail, log.reason]
      .some(v => String(v || '').toLowerCase().includes(q));
  });
  const rows = logs.slice(0, 200).map(log => `
    <tr>
      <td style="white-space:nowrap;">${log.at ? new Date(log.at).toLocaleString('ko-KR') : '-'}</td>
      <td><span class="bd bd-info">${esc(log.entityType || '-')}</span><div style="font-size:11px;color:var(--tx-t);">${esc(log.entityId || '')}</div></td>
      <td style="font-weight:800;">${esc(auditLabelForAction(log.action))}</td>
      <td>${esc(typeof auditActorDisplayName === 'function' ? auditActorDisplayName(log) : (log.actorName || '-'))}<div style="font-size:11px;color:var(--tx-t);">${esc(typeof auditActorDisplaySub === 'function' ? auditActorDisplaySub(log) : (log.actorRole || ''))}</div></td>
      <td>${esc(log.summary || log.detail || '')}${log.reason ? `<div style="font-size:11px;color:var(--tx-t);">사유: ${esc(log.reason)}</div>` : ''}</td>
      <td style="min-width:220px;">${auditChangeText(log)}</td>
    </tr>`).join('');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <span class="bd bd-info">전체 ${allAuditLogRows().length}건</span>
      <span class="bd">표시 ${logs.length}건</span>
      <input value="${esc(auditLogFilterText)}" placeholder="작업자, 항목, 문서번호 검색" oninput="auditLogFilterText=this.value;renderPermAuditLog()" style="max-width:280px;">
      <button class="btn btn-sm" onclick="auditLogFilterText='';renderPermAuditLog()"><i class="ti ti-x"></i>검색 해제</button>
    </div>
    ${rows ? `<div style="overflow-x:auto;"><table><thead><tr><th>일시</th><th>항목</th><th>작업</th><th>작업자</th><th>요약</th><th>변경 전/후</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('감사 로그가 없습니다.')}`;
}
async function permToggleFeature(role, key, allowed){
  const cfg=roleFeaturesConfig(); cfg[role]=cfg[role]||{};
  cfg[role][key]=allowed;
  saveStorageLocalOnly('roleFeatures', cfg);
  if(role===currentRole) applyFeatureGating();
  renderPermFeatures();
  try{ await _fbDb.collection('roles').doc('features').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
async function permToggleDataScope(role, key, scope){
  const cfg=roleDataScopeConfig(); cfg[role]=cfg[role]||{};
  cfg[role][key]=scope === 'shared' ? 'shared' : 'own';
  saveStorageLocalOnly('roleDataScope', cfg);
  renderPermDataScope();
  if(role===currentRole && !document.querySelector('.overlay.open')) { try{ refreshPage(currentPage); }catch(e){} }
  try{ await _fbDb.collection('roles').doc('dataScope').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
}
async function permSetAllDataScopes(role, scope){
  const cfg=roleDataScopeConfig(); cfg[role]=cfg[role]||{};
  DATA_SCOPE_DEFS.forEach(def => { cfg[role][def.id] = scope === 'shared' ? 'shared' : 'own'; });
  saveStorageLocalOnly('roleDataScope', cfg);
  renderPermDataScope();
  if(role===currentRole && !document.querySelector('.overlay.open')) { try{ refreshPage(currentPage); }catch(e){} }
  try{ await _fbDb.collection('roles').doc('dataScope').set(cfg); }catch(e){ showToast('저장 실패: '+e.message,'error'); }
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
  materials:  {sel:'#mat-table',        del:'deleteMat',       edit:'openMatEdit',    clone:'cloneMat', complete:'입고완료'},
  inventory:  {sel:'#inventory-table',  del:'deleteInventory', edit:'openInvEdit'},
  orders:     {sel:'#orders-table',     del:'deleteOrder',     edit:'openOrderEdit',  clone:'cloneOrder', complete:'완료'},
  defects:    {sel:'#defect-table',     del:'deleteDefect',    edit:'openDefectEdit', complete:'완료'},
  checks:     {sel:'#check-table',      del:'deleteCheck',     edit:'openCheckEdit'},
  claims:     {sel:'#claims-table-full',del:'deleteClaim',     edit:'openClaimEdit', complete:'완료'},
  deliveries: {sel:'#dlv-table',        del:'deleteDelivery',  edit:null},
  workers:    {sel:'#workers-table',    del:'deleteWorker',    edit:'openWorkerEdit'},
  as:         {sel:'#as-body',          del:'deleteAS',        edit:'openAsEdit'},
  partners:   {sel:'#bp-table',         del:'deletePartner',   edit:'openPartnerModal'},
  statement:  {sel:'#st-table', type:'statement', del:'deleteSalesDoc', edit:'openSalesDocEdit', clone:'cloneSalesDoc', pdf:'openSalesDocPrint', email:'openEmailModal', drive:true},
  tax:        {sel:'#tx-table', type:'tax',       del:'deleteSalesDoc', edit:'openSalesDocEdit', clone:'cloneSalesDoc', pdf:'openSalesDocPrint', email:'openEmailModal', drive:true},
  quote:      {sel:'#qt-table', type:'quote',     del:'deleteSODoc',    edit:'openSODocEdit',    clone:'cloneSODoc', pdf:'openSODocPrint', email:'openEmailModal', drive:true},
  order:      {sel:'#so-table', type:'order',     del:'deleteSODoc',    edit:'openSODocEdit',    clone:'cloneSODoc', pdf:'openSODocPrint', email:'openEmailModal', drive:true, complete:'완료'},
  products:   {sel:'#client-list',       del:'deleteProduct',   edit:'openProdEdit',   clone:'cloneProduct'},
  bom:        {sel:'#bom-body',          del:'deleteBom',       edit:'openBomEdit',    clone:'cloneBom'}
};
const bulkSel = {};
let _bulkDateViewClearersRegistered = false;
function bulkEntityType(key) {
  const map = {
    rfq:'rfq', materials:'material', inventory:'inventory', orders:'workOrder',
    defects:'defect', checks:'checkRecord', claims:'claim', deliveries:'delivery',
    workers:'worker', as:'as', partners:'partners', statement:'statement',
    tax:'tax', quote:'quote', order:'order', products:'products', bom:'bom'
  };
  return map[key] || key;
}
function bulkAllRecords(key) {
  const map = {
    rfq: typeof rfqList !== 'undefined' ? rfqList : [],
    materials: typeof materials !== 'undefined' ? materials : [],
    inventory: typeof inventory !== 'undefined' ? inventory : [],
    orders: typeof workOrders !== 'undefined' ? workOrders : [],
    defects: typeof defects !== 'undefined' ? defects : [],
    checks: typeof checkRecords !== 'undefined' ? checkRecords : [],
    claims: typeof claims !== 'undefined' ? claims : [],
    deliveries: typeof deliveries !== 'undefined' ? deliveries : [],
    workers: typeof workers !== 'undefined' ? workers : [],
    as: typeof asList !== 'undefined' ? asList : [],
    partners: typeof partners !== 'undefined' ? partners : [],
    statement: typeof statementList !== 'undefined' ? statementList : [],
    tax: typeof taxList !== 'undefined' ? taxList : [],
    quote: typeof quoteList !== 'undefined' ? quoteList : [],
    order: typeof orderList !== 'undefined' ? orderList : [],
    products: typeof products !== 'undefined' ? products : [],
    bom: typeof bomList !== 'undefined' ? bomList : []
  };
  return Array.isArray(map[key]) ? map[key] : [];
}
function bulkVisibleRecords(key) {
  const list = bulkAllRecords(key);
  const type = bulkEntityType(key);
  return typeof visibleRecords === 'function' ? visibleRecords(list, type) : list;
}
function bulkRecordById(key, id) {
  return bulkVisibleRecords(key).find(x => x && x.id === id);
}
function bulkIdsForAction(key, ids, action) {
  const type = bulkEntityType(key);
  const allowed = [];
  (ids || []).forEach(id => {
    const record = bulkRecordById(key, id);
    if (!record) return;
    if (action === 'delete' && typeof requireRecordPermission === 'function') {
      if (!requireRecordPermission('delete', record, type)) return;
    } else if (action === 'edit' && typeof requireRecordPermission === 'function') {
      if (!requireRecordPermission('edit', record, type)) return;
    } else if ((action === 'clone' || action === 'toPo') && typeof roleFeatureAllowed === 'function' && !roleFeatureAllowed('create')) {
      return;
    }
    allowed.push(id);
  });
  if (allowed.length !== (ids || []).length && typeof showToast === 'function') {
    showToast('권한이 없는 항목은 일괄 작업에서 제외되었습니다.', 'error');
  }
  return allowed;
}
function bulkDateViewKey(key) {
  const map = {
    claims: 'claims',
    workers: 'workersHire',
    as: 'asRecords'
  };
  return map[key] || key;
}
let _bulkDocMenuListenersRegistered = false;
function registerBulkDocMenuListeners() {
  if (_bulkDocMenuListenersRegistered) return;
  _bulkDocMenuListenersRegistered = true;
  document.addEventListener('click', e => {
    if (!e.target.closest('.bulk-doc-menu-wrap')) bulkCloseDocMenus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') bulkCloseDocMenus();
  });
}
function bulkCloseDocMenus(except) {
  document.querySelectorAll('.bulk-doc-menu-wrap.open').forEach(wrap => {
    if (wrap !== except) wrap.classList.remove('open');
  });
}
function bulkToggleDocMenu(event, trigger) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const wrap = trigger && trigger.closest('.bulk-doc-menu-wrap');
  if (!wrap) return;
  const willOpen = !wrap.classList.contains('open');
  bulkCloseDocMenus(wrap);
  wrap.classList.toggle('open', willOpen);
}
function bulkRunFromDocMenu(event, key, action) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  bulkCloseDocMenus();
  bulkRun(key, action);
}
function bulkDocumentMenuHtml(key, c, canPdf, canCsv) {
  const actions = [];
  if (c.pdf && canPdf) actions.push({ action: 'pdf', icon: 'ti ti-printer', label: 'PDF 출력' });
  if (c.csv && canCsv) actions.push({ action: 'csv', icon: 'ti ti-file-spreadsheet', label: '엑셀' });
  if (c.drive && canPdf && canCsv) actions.push({ action: 'drive', icon: 'ti ti-cloud-upload', label: 'Drive 저장', cls: 'drive-save-btn' });
  if (c.email) actions.push({ action: 'email', icon: 'ti ti-mail', label: '이메일', email: true });
  if (!actions.length) return '';
  const items = actions.map(item =>
    `<button class="btn btn-sm ${item.cls || ''}" type="button" data-doc-action="${item.action}" ${item.email ? 'data-email' : ''} role="menuitem" onclick="bulkRunFromDocMenu(event,'${key}','${item.action}')"><i class="${item.icon}"></i>${item.label}</button>`
  ).join('');
  return `<span class="bulk-doc-menu-wrap" data-bulk-doc-wrap><button class="btn btn-sm bulk-doc-menu-trigger" type="button" data-bulk-doc-trigger onclick="bulkToggleDocMenu(event,this)"><i class="ti ti-folder-cog"></i>문서 처리<i class="ti ti-chevron-down bulk-doc-menu-caret"></i></button><span class="bulk-doc-menu" data-bulk-doc-menu role="menu">${items}</span></span>`;
}
function bulkActionButtons(key, options = {}) {
  registerBulkDocMenuListeners();
  const c = BULK_CFG[key];
  if (!c) return '';
  const canEdit = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('edit');
  const canCreate = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('create');
  const canDelete = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('delete');
  const canPdf = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('pdf');
  const canCsv = typeof roleFeatureAllowed !== 'function' || roleFeatureAllowed('csv');
  let btns = '';
  if(c.edit && canEdit) btns+=`<button class="btn btn-sm" data-edit onclick="bulkRun('${key}','edit')"><i class="ti ti-edit"></i>수정</button>`;
  if(c.clone && canCreate) btns+=`<button class="btn btn-sm" data-clone onclick="bulkRun('${key}','clone')"><i class="ti ti-copy"></i>복제</button>`;
  if(c.toPo && canCreate) btns+=`<button class="btn btn-sm" data-act onclick="bulkRun('${key}','toPo')"><i class="ti ti-file-invoice"></i>발주서 생성</button>`;
  if(c.complete && canEdit && !options.hideComplete) btns+=`<button class="btn btn-sm btn-primary" data-act onclick="bulkRun('${key}','complete')"><i class="ti ti-circle-check"></i>${bulkCompleteButtonLabel(key)}</button>`;
  btns += bulkDocumentMenuHtml(key, c, canPdf, canCsv);
  if(canDelete) btns+=`<button class="btn btn-sm btn-danger" data-act onclick="bulkRun('${key}','delete')"><i class="ti ti-trash"></i>삭제</button>`;
  return btns;
}

function bulkCompleteButtonLabel(key) {
  const c = BULK_CFG[key];
  return c && c.complete === '입고완료' ? '입고완료' : '완료처리';
}

function bulkApplyComplete(key, id) {
  const c = BULK_CFG[key];
  const target = c && c.complete;
  if (!target) return false;
  if (key === 'materials' && typeof changeMatStatus === 'function') { changeMatStatus(id, target); return true; }
  if (key === 'orders' && typeof qStatus === 'function') { qStatus(id, target); return true; }
  if (key === 'defects' && typeof changeDefectStatus === 'function') { changeDefectStatus(id, target); return true; }
  if (key === 'claims' && typeof changeClaimStatus === 'function') { changeClaimStatus(id, target); return true; }
  if (key === 'order' && typeof changeSODocStatus === 'function') { changeSODocStatus('order', id, target); return true; }
  return false;
}

function bulkCompleteSelected(key, ids) {
  const c = BULK_CFG[key];
  const target = c && c.complete;
  if (!target) return;
  const allowed = bulkIdsForAction(key, ids, 'edit');
  const targets = allowed.filter(id => {
    const record = bulkRecordById(key, id);
    return record && record.status !== target;
  });
  if (!targets.length) {
    if (typeof showToast === 'function') showToast(`선택 항목은 이미 ${target} 상태입니다.`, 'info');
    return;
  }
  if (!confirm(`선택한 ${targets.length}건을 ${target} 처리하시겠습니까?`)) return;
  let done = 0;
  targets.forEach(id => {
    try { if (bulkApplyComplete(key, id)) done++; }
    catch(e) { console.warn('일괄 완료 처리 실패:', key, id, e); }
  });
  bulkSel[key] = new Set();
  updateBulkBar(key);
  if (typeof syncBulkSelectionDetailPanel === 'function') syncBulkSelectionDetailPanel(key);
  if (typeof closeSelectionDetailPanel === 'function') closeSelectionDetailPanel(false);
  if (typeof showToast === 'function') showToast(`${done}건 ${target} 처리되었습니다.`, done ? 'success' : 'error');
}
function bulkSelectionBarHtml(key, count) {
  const auditBtn = (typeof managedAuditButtonHtml === 'function')
    ? managedAuditButtonHtml(typeof auditEntityTypeForBulkKey === 'function' ? auditEntityTypeForBulkKey(key) : key, [...(bulkSel[key] || [])])
    : '';
  return `<span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span><span data-bulk-audit-slot>${auditBtn}</span>${bulkActionButtons(key)}<button class="btn btn-sm date-view-clear-selection" onclick="bulkToggleAll('${key}',false)"><i class="ti ti-x"></i>해제</button>`;
}
function bulkSelectionBarsMobileVisible() {
  return typeof selectionActionBarsMobileVisible === 'function' ? selectionActionBarsMobileVisible() : false;
}
function removeBulkBar(key) {
  const bar = document.getElementById('bulkbar-' + key);
  if (bar) bar.remove();
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
  // React 소유 테이블 등 opt-out 대상은 일괄선택 체크박스 컬럼 주입에서 제외한다.
  const tables=[...cont.querySelectorAll('table')].filter(t=>!(t.dataset.managedTable==='false'||t.hasAttribute('data-no-managed-table')));
  if(!tables.length) return;
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
  if(!bulkSelectionBarsMobileVisible() || !(bulkSel[key] && bulkSel[key].size)) {
    removeBulkBar(key);
    return;
  }
  const c=BULK_CFG[key]; const wrap=table.parentElement; if(!wrap||!wrap.parentNode) return;
  const bar=document.createElement('div'); bar.id='bulkbar-'+key;
  bar.className='selection-action-bar';
  bar.style.cssText='display:none;align-items:center;gap:5px;margin:0 0 5px;padding:4px 8px;background:var(--bg-i);border:1px solid var(--br-i);border-radius:8px;flex-wrap:wrap;';
  const auditBtn = (typeof managedAuditButtonHtml === 'function')
    ? managedAuditButtonHtml(typeof auditEntityTypeForBulkKey === 'function' ? auditEntityTypeForBulkKey(key) : key, [...(bulkSel[key] || [])])
    : '';
  bar.innerHTML=`<span style="font-weight:700;font-size:12.5px;color:var(--tx-i);"><i class="ti ti-checkbox"></i> <span id="bulkcnt-${key}">0</span>건 선택됨</span><span data-bulk-audit-slot>${auditBtn}</span>${bulkActionButtons(key)}<button class="btn btn-sm" style="margin-left:auto;" onclick="bulkToggleAll('${key}',false)"><i class="ti ti-x"></i>해제</button>`;
  if(key==='products' || key==='bom') cont.parentNode.insertBefore(bar, cont);
  else wrap.parentNode.insertBefore(bar, wrap);
}
function bulkSelectionDetailReady() {
  return window.__selectionDetailReady === true && typeof updateSelectionDetailPanelFromBulk === 'function';
}

function syncBulkSelectionDetailPanel(key) {
  if (!bulkSelectionDetailReady()) return;
  updateSelectionDetailPanelFromBulk(key);
}

function scheduleBulkSelectionDetailVisibilitySync() {
  if (window.__selectionDetailReady !== true || typeof syncSelectionDetailPanelVisibility !== 'function') return;
  setTimeout(syncSelectionDetailPanelVisibility, 0);
  setTimeout(syncSelectionDetailPanelVisibility, 80);
}

function updateBulkBar(key){
  const n=(bulkSel[key]||new Set()).size;
  const cnt=document.getElementById('bulkcnt-'+key); if(cnt) cnt.textContent=n;
  let bar=document.getElementById('bulkbar-'+key);
  const viewKey=bulkDateViewKey(key);
  const slotted = typeof setDateViewSelectionBar === 'function' && setDateViewSelectionBar(viewKey, bulkSelectionBarHtml(key,n), n>0);
  if (!bulkSelectionBarsMobileVisible() || slotted || !n) {
    removeBulkBar(key);
    bar = null;
  } else if (!bar) {
    const c = BULK_CFG[key];
    const cont = c && document.querySelector(c.sel);
    const table = cont && cont.querySelector('table');
    if (table) ensureBulkBar(key, table, cont);
    bar = document.getElementById('bulkbar-'+key);
  }
  if (bar && typeof managedAuditButtonHtml === 'function') {
    const old = bar.querySelector('[data-bulk-audit-slot]');
    if (old) old.outerHTML = `<span data-bulk-audit-slot>${managedAuditButtonHtml(typeof auditEntityTypeForBulkKey === 'function' ? auditEntityTypeForBulkKey(key) : key, [...(bulkSel[key] || [])])}</span>`;
  }
  if(bar) bar.style.display = 'flex';   // 모바일 보조 선택바는 선택 시에만 생성
  [bar, document.getElementById('date-view-'+viewKey)].filter(Boolean).forEach(scope => {
    scope.querySelectorAll('[data-edit]').forEach(el => { el.style.display = n===1 ? '' : 'none'; });
    scope.querySelectorAll('[data-clone]').forEach(el => { el.style.display = n===1 ? '' : 'none'; });
    scope.querySelectorAll('[data-email]').forEach(el => { el.style.display = n===1 ? '' : 'none'; });
    scope.querySelectorAll('[data-bulk-doc-menu]').forEach(menu => {
      const visibleActions = [...menu.querySelectorAll('[data-doc-action]')].some(btn => btn.style.display !== 'none');
      const wrap = menu.closest('[data-bulk-doc-wrap]');
      if (wrap) wrap.style.display = visibleActions ? '' : 'none';
    });
  });
  if (!n) bulkCloseDocMenus();
  syncBulkSelectionDetailPanel(key);
}
function bulkSyncSelectionVisual(key) {
  const c = BULK_CFG[key];
  const cont = c && document.querySelector(c.sel);
  if (!cont) return;
  const checks = [...cont.querySelectorAll('tbody input[type=checkbox][data-bid]')];
  checks.forEach(cb => {
    const row = cb.closest('tr');
    if (row) row.classList.toggle('table-row-selected', cb.checked);
  });
  const all = cont.querySelector('thead .table-check-all') || cont.querySelector('thead input[type=checkbox]');
  if (all) {
    const selected = checks.filter(cb => cb.checked);
    all.checked = checks.length > 0 && selected.length === checks.length;
    all.indeterminate = selected.length > 0 && selected.length < checks.length;
  }
}
function bulkToggle(key,id,on){
  const s=bulkSel[key]=bulkSel[key]||new Set();
  if(on){
    if(!bulkRecordById(key,id)) return;
    s.add(id);
  }else s.delete(id);
  bulkSyncSelectionVisual(key);
  updateBulkBar(key);
  scheduleBulkSelectionDetailVisibilitySync();
}
function bulkToggleAll(key,on){
  const s=bulkSel[key]=new Set();
  const cont=document.querySelector(BULK_CFG[key].sel);
  if(cont) cont.querySelectorAll('tbody input[type=checkbox][data-bid]').forEach(cb=>{ cb.checked=on; if(on) s.add(cb.getAttribute('data-bid')); });
  bulkSyncSelectionVisual(key);
  updateBulkBar(key);
  scheduleBulkSelectionDetailVisibilitySync();
}
function bulkRun(key, action){
  const c=BULK_CFG[key]; let ids=[...(bulkSel[key]||[])]; if(!ids.length) return;
  bulkCloseDocMenus();
  if(action==='edit' && c.edit){
    ids = bulkIdsForAction(key, ids, 'edit');
    if(!ids.length) return;
    if(ids.length!==1) return;
    const id=ids[0];
    if(key==='products'){
      const p=bulkRecordById(key,id); if(p) window[c.edit](p.clientId,id);
    } else if(c.type) window[c.edit](c.type,id);
    else window[c.edit](id);
  } else if(action==='clone' && c.clone){
    ids = bulkIdsForAction(key, ids, 'clone');
    if(!ids.length) return;
    if(ids.length!==1) return;
    const id=ids[0];
    if(key==='products'){
      const p=bulkRecordById(key,id); if(p) window[c.clone](p.clientId,id);
    } else if(c.type) window[c.clone](c.type,id);
    else window[c.clone](id);
  } else if(action==='delete'){
    ids = bulkIdsForAction(key, ids, 'delete');
    if(!ids.length) return;
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
  } else if(action==='complete' && c.complete){
    bulkCompleteSelected(key, ids);
  } else if(action==='pdf' && c.pdf){
    if (typeof requirePdfAction === 'function' && !requirePdfAction('일괄 PDF 출력')) return;
    ids = bulkIdsForAction(key, ids, 'view');
    if(!ids.length) return;
    if(c.type){ try{ window[c.pdf](c.type, ids); }catch(e){} }    // 선택 건 한 창에 개별 페이지
    else ids.forEach(id=>{ try{ window[c.pdf](id); }catch(e){} });
  }
  else if(action==='csv' && c.csv){
    if (typeof requireCsvAction === 'function' && !requireCsvAction('일괄 엑셀 내보내기')) return;
    ids = bulkIdsForAction(key, ids, 'view');
    if(!ids.length) return;
    ids.forEach(id=>{ try{ window[c.csv](id); }catch(e){} });
  }
  else if(action==='drive' && c.drive){
    if (typeof requirePdfAction === 'function' && !requirePdfAction('Google Drive PDF 저장')) return;
    if (typeof requireCsvAction === 'function' && !requireCsvAction('Google Drive 엑셀 저장')) return;
    ids = bulkIdsForAction(key, ids, 'view');
    if(!ids.length) return;
    saveDocumentBundleToGoogleDrive(c.type || key, ids);
  }
  else if(action==='toPo' && key==='rfq' && typeof convertRfqToPo === 'function'){
    ids = bulkIdsForAction(key, ids, 'toPo');
    if(!ids.length) return;
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
  return bulkRecordById(key, id);
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
window.addEventListener('resize', () => {
  Object.keys(BULK_CFG).forEach(key => {
    try { updateBulkBar(key); } catch(e) {}
  });
}, { passive:true });

/* 탑바 시계 제거됨 (tick/setInterval 삭제) */
