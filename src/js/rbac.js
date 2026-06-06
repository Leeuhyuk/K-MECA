/* ════════ 권한(RBAC) 설정 ════════ */
/* 첫 로그인 시 자동으로 '관리자'가 되는 소유자 이메일(소문자). 이 계정들은 항상 admin·즉시 활성. */
const BOOTSTRAP_ADMIN_EMAILS = ['lgs7942@naver.com', 'lgs79422@gmail.com'];
/* 접근 제어 대상 페이지 (id는 사이드바 go()/goInventory와 일치) */
const PAGE_LIST = [
  {id:'dashboard',label:'종합 대시보드'},{id:'clients',label:'수주 정보 관리'},{id:'materials',label:'자재 수급/발주'},
  {id:'deliveries',label:'납품 현황'},{id:'calendar',label:'납기 캘린더'},{id:'orders',label:'생산 지시 등록'},{id:'bom',label:'BOM·자재명세'},
  {id:'quality',label:'품질 및 검사'},{id:'claims',label:'고객 클레임'},{id:'inventory',label:'재고 관리'},
  {id:'partners',label:'거래처 관리'},{id:'rfq',label:'견적요청서'},{id:'po',label:'구매발주서'},
  {id:'salesdoc',label:'견적/수주'},{id:'statement',label:'거래명세표'},{id:'taxinvoice',label:'세금계산서'},
  {id:'finance',label:'재무 관리'},{id:'workers',label:'인사 관리'},
  {id:'as',label:'고객 A/S'},{id:'alimtalk',label:'알림톡 설정'},{id:'alerts',label:'알림'},{id:'trash',label:'휴지통'}
];
/* 역할별 기본 접근 페이지(관리자가 화면에서 편집 가능). admin은 항상 전체. */
const DEFAULT_ROLE_PAGES = {
  manager: ['dashboard','clients','materials','deliveries','calendar','orders','bom','quality','claims','inventory','partners','rfq','po','salesdoc','as'],
  staff:   ['dashboard','orders','quality','inventory','deliveries','calendar']
};
const ROLE_LABEL = { admin:'관리자', manager:'중간관리자', staff:'평사원' };

function rolePagesConfig(){ return loadStorage('rolePages', DEFAULT_ROLE_PAGES); }
function roleAllowedSet(role){
  if (role==='admin') return null;                       // 전체 허용
  const cfg = rolePagesConfig();
  return new Set((cfg && cfg[role]) || DEFAULT_ROLE_PAGES[role] || []);
}
function pageAllowed(id){
  if (id==='permissions') return currentRole==='admin';  // 권한관리는 관리자 전용
  if (!allowedPages) return true;                        // null = 전체(admin/로컬)
  return allowedPages.has(id);
}
/* 사이드바 항목을 현재 역할에 맞게 숨김 */
function applyRoleGating(){
  document.querySelectorAll('.ni').forEach(ni=>{
    const oc = ni.getAttribute('onclick')||'';
    let id=null;
    let m = oc.match(/go\('([a-zA-Z]+)'/); if(m) id=m[1];
    else if(/goInventory/.test(oc)) id='inventory';
    else if(/openCompanySettings/.test(oc)){ ni.style.display = (currentRole==='admin') ? '' : 'none'; return; }  // 회사정보 설정: 관리자 전용
    if(!id) return;
    ni.style.display = pageAllowed(id) ? '' : 'none';
  });
  // 모든 항목이 숨겨진 그룹은 그룹(라벨 포함)째 숨김 — 모바일에서 빈 라벨 방지
  document.querySelectorAll('.nav-g').forEach(g=>{
    const items=[...g.querySelectorAll('.ni')];
    const anyVisible=items.some(n=>n.style.display!=='none');
    g.style.display = (items.length && !anyVisible) ? 'none' : '';
  });
}
/* ════════ 열(컬럼) 단위 권한 ════════
   각 표의 컬럼을 역할별로 숨길 수 있음. nth-child CSS 주입 방식이라 재렌더에도 자동 적용. */
const ADD_KEY='＋등록버튼';   // 컬럼 외 '등록 버튼' 토글용 특수 키
const COLUMN_TABLES = {
  clients:    { sel:'#client-list',       label:'수주 정보 관리(제품표)', addBtn:'openProdAdd,openClientAdd', cols:['코드','제품/규격명','납기기한','수량','수주 단가','수주 합계','공정 단계 → 상태','관리 작업'] },
  orders:     { sel:'#orders-table',      label:'생산 지시',        addBtn:'openOrderAdd', cols:['지시번호','고객사','생산제품','라인','목표량','실적량','불량','개시일','납기일','진행률','상태','담당자','메모','조작'] },
  defects:    { sel:'#defect-table',      label:'불량 기록(품질)',   addBtn:'openDefectAdd', cols:['코드','일자','제품','발생공정','하자유형','수량','상태','비고','관리 작업'] },
  checks:     { sel:'#check-table',       label:'출하 검사(품질)',   addBtn:'openCheckAdd',  cols:['검사일','의뢰처','완료제품','검사원','외관','치수','테스트','종합판정','관리 작업'] },
  claims:     { sel:'#claims-table-full', label:'고객 클레임',       addBtn:'openClaimAdd',  cols:['인입일','유형','의뢰 고객사','해당 제품','클레임 사양','내용','조치 방안','상태','관리'] },
  as:         { sel:'#as-body',           label:'고객 A/S',         addBtn:'openAsAdd',     cols:['접수번호','접수일','고객사','제품','증상','보증','상태','담당자','수리비','관리'] },
  materials:  { sel:'#mat-table',         label:'자재 수급/발주',    addBtn:'openMatAdd',    cols:['자재코드','고객사','매칭제품','자재명','공급처','구매단가','수량','매입총액','주문일자','입고예정일','진행상황','참고','관리'] },
  deliveries: { sel:'#dlv-table',         label:'납품 현황',        cols:['납품번호','납품일자','고객사','제품명','규격','수량','단가','납품금액','비고','삭제'] },
  inventory:  { sel:'#inventory-table',   label:'재고',             addBtn:'openInvAdd',    cols:['재고코드','품목명','분류','현재고','안전재고','보관위치','참고','관리'] }
};
function roleColumnsConfig(){ return loadStorage('roleColumns', {}); }   // { 역할:{ 테이블:[숨길컬럼...] } }
/* 현재 역할의 숨김 컬럼을 nth-child CSS로 주입 (admin은 전체 표시) */
function applyColumnGating(){
  let css='';
  if (currentRole!=='admin'){
    const cfg = roleColumnsConfig()[currentRole] || {};
    Object.keys(COLUMN_TABLES).forEach(tk=>{
      const t=COLUMN_TABLES[tk]; const hidden=cfg[tk]||[];
      hidden.forEach(col=>{
        if (col===ADD_KEY){ if(t.addBtn) t.addBtn.split(',').forEach(fn=>{ css += `[onclick^="${fn.trim()}"]{display:none!important;}\n`; }); return; }  // 등록 버튼 숨김(콤마로 여러 개 지원)
        const idx=t.cols.indexOf(col); if(idx<0) return;
        const n=idx+1;
        css += `${t.sel} th:nth-child(${n}),${t.sel} td:nth-child(${n}){display:none!important;}\n`;
      });
    });
  }
  let st=document.getElementById('col-gating');
  if(!st){ st=document.createElement('style'); st.id='col-gating'; document.head.appendChild(st); }
  st.textContent=css;
}

/* ════════ 기능 권한 (엑셀 CSV 내보내기 / PDF·인쇄 출력) ════════ */
const PDF_BTN_SEL = '[onclick^="openRfqPrint"],[onclick^="openPoPrint"],[onclick^="openSalesDocPrint"],[onclick^="openSODocPrint"],[onclick^="printPayslip"],[onclick^="poBulkPrint"]';
const FEATURE_DEFS = [ {key:'csv', label:'엑셀 CSV 내보내기', icon:'ti-file-spreadsheet'}, {key:'pdf', label:'PDF·인쇄 출력', icon:'ti-printer'}, {key:'edit', label:'셀 직접 편집', icon:'ti-edit'} ];
function roleFeaturesConfig(){ return loadStorage('roleFeatures', {}); }   // { 역할:{ csv:bool, pdf:bool } } (true=허용, 기본 허용)
/* 현재 역할이 셀 직접 편집 권한을 가지는지 (admin 항상 허용, 기본 허용) */
function canEditFeature(){
  if (typeof currentRole === 'undefined') return true;
  if (currentRole === 'admin') return true;
  const f = roleFeaturesConfig()[currentRole] || {};
  return f.edit !== false;
}
function applyFeatureGating(){
  let css='';
  if (currentRole!=='admin'){
    const f = roleFeaturesConfig()[currentRole] || {};
    if (f.csv===false) css += `[onclick^="export"],[onclick^="poBulkExport"]{display:none!important;}\n`;   // 모든 내보내기 버튼
    if (f.pdf===false) css += `${PDF_BTN_SEL}{display:none!important;}\n`;            // 모든 PDF/인쇄 버튼
  }
  let st=document.getElementById('feat-gating');
  if(!st){ st=document.createElement('style'); st.id='feat-gating'; document.head.appendChild(st); }
  st.textContent=css;
}

/* 부팅 시 localStorage의 역할로 권한 상태 초기화 */
function initRole(){
  if (!cloudConfigured()){ currentRole='admin'; allowedPages=null; applyRoleGating(); applyColumnGating(); applyFeatureGating(); return; }  // 로컬 = 전체
  currentRole = localStorage.getItem('mes_myRole') || 'staff';
  allowedPages = roleAllowedSet(currentRole);
  applyRoleGating();
  applyColumnGating();
  applyFeatureGating();
}
/* 로그인 사용자의 역할/활성/권한맵을 Firestore에서 로드(없으면 생성) */
async function cloudLoadRole(){
  const uid=_cloudUser.uid, email=(_cloudUser.email||'').toLowerCase();
  const isBoot = BOOTSTRAP_ADMIN_EMAILS.includes(email);
  const signupName = (_cloudUser.displayName||'').trim() || sessionStorage.getItem('mes_signupName') || '';
  // 소유자(부트스트랩) 이메일은 Firestore 상태와 무관하게 항상 관리자·활성
  let role = isBoot ? 'admin' : 'staff';
  let active = isBoot ? true : false;
  let name = signupName;
  try {
    const uref=_fbDb.collection('users').doc(uid);
    const usnap=await uref.get();
    if (usnap.exists){
      const d=usnap.data();
      role = isBoot ? 'admin' : (d.role||'staff');         // 부트스트랩은 항상 admin
      active = isBoot ? true : (d.active!==false);
      name = d.name || signupName;
      if (signupName && !d.name) { try { await uref.update({ name:signupName }); } catch(e){} }  // 이름 보강
    } else {
      await uref.set({ email:_cloudUser.email, name:signupName, role, active, createdAt:Date.now() });
    }
  } catch(e){ console.warn('역할 로드/생성 실패 — 기본값 적용(소유자는 관리자). 권한 규칙 확인 필요:', e&&e.code); }
  sessionStorage.removeItem('mes_signupName');
  localStorage.setItem('mes_myName', name||'');
  let rolePages = DEFAULT_ROLE_PAGES;
  try { const rsnap=await _fbDb.collection('roles').doc('config').get(); if(rsnap.exists) rolePages=rsnap.data(); } catch(e){}
  let roleColumns = {};
  try { const csnap=await _fbDb.collection('roles').doc('columns').get(); if(csnap.exists) roleColumns=csnap.data(); } catch(e){}
  let roleFeatures = {};
  try { const fsnap=await _fbDb.collection('roles').doc('features').get(); if(fsnap.exists) roleFeatures=fsnap.data(); } catch(e){}
  localStorage.setItem('mes_myRole', role);
  localStorage.setItem('mes_myActive', active ? 'true':'false');
  saveStorageLocalOnly('rolePages', rolePages);
  saveStorageLocalOnly('roleColumns', roleColumns);
  saveStorageLocalOnly('roleFeatures', roleFeatures);
}
/* 클라우드 동기화 없이 localStorage에만 저장(권한맵 캐시용) */
function saveStorageLocalOnly(key,data){ localStorage.setItem('mes_'+key, JSON.stringify(data)); }

function cloudConfigured(){ return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId); }

function cloudBootstrap(){
  if (!cloudConfigured()){ _cloudChip('local'); return; }              // 미설정 → 로컬 전용
  if (typeof firebase === 'undefined'){ console.warn('Firebase SDK 미로드(오프라인?) — 로컬 전용'); _cloudChip('local'); return; }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _fbAuth = firebase.auth(); _fbDb = firebase.firestore();
    _fbAuth.onAuthStateChanged(async (user)=>{
      if (user){
        _cloudUser = user;
        if (!sessionStorage.getItem('mes_cloud_synced')){
          _cloudMsg('데이터 불러오는 중…','#8a93ad');
          try { await cloudLoadAll(); } catch(e){ console.error(e); }
          sessionStorage.setItem('mes_cloud_synced','1');
          location.reload(); return;                                    // 클라우드 데이터로 재부팅
        }
        if (localStorage.getItem('mes_myActive')==='false'){    // 관리자 승인 대기 계정 차단
          _cloudActive=false; sessionStorage.removeItem('mes_cloud_synced');
          _showLogin(); _cloudMsg('관리자 승인 대기 중입니다. 승인 후 다시 로그인하세요.','#f59f00');
          _fbAuth.signOut(); return;
        }
        _cloudActive = true; _hideLogin(); _cloudChip('online');
        updateAdminUI(); applyRoleGating(); applyColumnGating(); applyFeatureGating(); cloudSubscribe();   // 역할 UI/컬럼/기능 반영 + 실시간 동기화 시작
      } else {
        _cloudUser=null; _cloudActive=false;
        sessionStorage.removeItem('mes_cloud_synced');
        _showLogin();
      }
    });
  } catch(e){ console.error('Firebase 초기화 오류', e); _cloudChip('error'); }
}

async function cloudLoadAll(){
  await cloudLoadRole();   // 내 역할/권한 먼저 로드(승인 대기 판정 포함)
  const snap = await _fbDb.collection('mes_state').get();
  let n=0;
  snap.forEach(doc=>{ const d=doc.data(); if (d && d.value!==undefined){ localStorage.setItem('mes_'+doc.id, JSON.stringify(d.value)); n++; } });
  localStorage.setItem('mes__savedAt', new Date().toISOString());       // 임베드 데이터가 덮어쓰지 않도록 최신화
  return n;
}

function cloudQueueSave(key){
  try {
    if (!_cloudActive || !CLOUD_KEYS.includes(key)) return;   // 클라우드 모듈 초기화 전 호출 시 TDZ → catch에서 무시
    _cloudQueue.add(key);
    clearTimeout(_cloudTimer);
    _cloudTimer = setTimeout(cloudFlush, 800);
  } catch(e){ /* 클라우드 모듈 초기화 이전 saveStorage 호출 — 무시 */ }
}
async function cloudFlush(){
  if (!_cloudActive || !_cloudQueue.size) return;
  const keys=[..._cloudQueue]; _cloudQueue.clear();
  _cloudChip('saving');
  try {
    const batch=_fbDb.batch();
    keys.forEach(k=>{ const raw=localStorage.getItem('mes_'+k); const value=raw?JSON.parse(raw):null;
      batch.set(_fbDb.collection('mes_state').doc(k), { value, updatedAt:Date.now(), by:(_cloudUser&&_cloudUser.email)||'' }); });
    await batch.commit(); _cloudChip('online');
  } catch(e){ console.warn('클라우드 저장 실패', e); _cloudChip('error'); }
}

/* 클라우드에서 수동으로 최신 데이터 다시 불러오기 */
async function cloudRefresh(){
  if (!_cloudActive){ showToast('클라우드 연결 상태가 아닙니다.','error'); return; }
  await cloudLoadAll(); location.reload();
}
