/* ════════ 로컬 스토리지 연동 및 초기 데이터 정의 ════════ */

const defaultRfqList  = [];
const defaultPoList   = [];
const defaultPartners = [];
let rfqList  = [];
let poList   = [];
let partners = [];
let inventoryLedger = [];  // 재고 입출고 이력
let alimtalkSettings = {}; // 카카오 알림톡 설정

const defaultClients = [];

const defaultStatementList = [];
const defaultTaxList = [];
const defaultQuoteList = [];
const defaultOrderList = [];

const defaultProducts = [];

const defaultMaterials = [];

const defaultWorkOrders = [];

const defaultWorkers = [];

const defaultDefects = [];

const defaultClaims = [];

const defaultCheckRecords = [];

const defaultAlerts = [];

const defaultInventory = [];

// 로컬 스토리지 키 관리 및 복구
/* ════════ 저장소 ════════ */
function loadStorage(key, defaultVal) {
  const raw = localStorage.getItem('mes_' + key);
  if (raw == null) return defaultVal;
  try { return JSON.parse(raw); }
  catch(e) {
    // 손상된 키 하나 때문에 앱 전체가 멈추지 않도록 기본값으로 대체
    console.warn('저장 데이터 손상 — 기본값으로 대체:', key, e);
    return defaultVal;
  }
}

function saveStorage(key, data) {
  try { localStorage.setItem('mes_' + key, JSON.stringify(data)); }
  catch(e) {
    if (typeof showToast === 'function') showToast('저장 공간이 가득 찼습니다. 첨부파일·휴지통을 정리해주세요.', 'error');
    console.error('localStorage 저장 실패:', key, e);
    return;
  }
  if (typeof cloudQueueSave === 'function') cloudQueueSave(key);   // 클라우드 동기화(활성 시)
}

/* 파일에 내장된 데이터를 localStorage로 로드 (파일 열 때 한 번만 실행) */
function initFromEmbedded() {
  const el = document.getElementById('embedded-data');
  if (!el) return;
  try {
    const data = JSON.parse(el.textContent);
    if (!data || typeof data !== 'object') return;
    const keyMap = {
      clients:'clients', products:'products', materials:'materials',
      workOrders:'workOrders', workers:'workers', defects:'defects',
      claims:'claims', checkRecords:'checkRecords', alerts:'alerts',
      inventory:'inventory', deliveries:'deliveries', stages:'stages', trash:'trash',
      rfqList:'rfqList', poList:'poList', partners:'partners',
      financeData:'financeData', attendance:'attendance', leaves:'leaves',
      statementList:'statementList', taxList:'taxList',
      quoteList:'quoteList', orderList:'orderList',
      inventoryLedger:  'inventoryLedger',
      alimtalkSettings: 'alimtalkSettings',
      memoList: 'memoList', todoList: 'todoList'
    };
    // 내장 데이터 타임스탬프가 localStorage보다 최신이면 덮어쓰기
    const embeddedTime = data._savedAt || '';
    const localTime    = localStorage.getItem('mes__savedAt') || '';
    if (embeddedTime > localTime || !localTime) {
      Object.entries(keyMap).forEach(([embKey, lsKey]) => {
        if (data[embKey] != null) localStorage.setItem('mes_' + lsKey, JSON.stringify(data[embKey]));
      });
      if (embeddedTime) localStorage.setItem('mes__savedAt', embeddedTime);
    }
  } catch(e) {
    console.warn('내장 데이터 로드 실패:', e);
  }
}

// 앱 시작 전 내장 데이터 우선 로드
initFromEmbedded();

/* 전체 변수 재로드 */
function reloadAllData() {
  clients      = loadStorage('clients',      defaultClients);
  products     = loadStorage('products',     defaultProducts);
  materials    = loadStorage('materials',    defaultMaterials);
  materials.forEach(m => { if (m.status === '발주') m.status = '발주중'; });
  workOrders   = loadStorage('workOrders',   defaultWorkOrders);
  workers      = loadStorage('workers',      defaultWorkers);
  defects      = loadStorage('defects',      defaultDefects);
  claims       = loadStorage('claims',       defaultClaims);
  checkRecords = loadStorage('checkRecords', defaultCheckRecords);
  alertsList   = loadStorage('alerts',       defaultAlerts);
  inventory    = loadStorage('inventory',    defaultInventory);
  inventoryLedger  = loadStorage('inventoryLedger', []);
  alimtalkSettings = loadStorage('alimtalkSettings', {
    enabled: false,
    apiKey: '',
    apiSecret: '',
    pfId: '',
    senderPhone: '',
    events: {
      materialIncoming: true,
      deliveryDue: true,
      asRegistered: true,
      poSent: true
    }
  });
  migrateInvCategory();
  deliveries   = loadStorage('deliveries',   []);
  processStages= loadStorage('stages',       ['설계/도면','자재발주','가공/제작','조립','배선/전기','검사/시험','완료','납품']);
  trash        = loadStorage('trash',        []);
  rfqList      = loadStorage('rfqList',      defaultRfqList);
  poList       = loadStorage('poList',       defaultPoList);
  partners     = loadStorage('partners',     defaultPartners);
  statementList= loadStorage('statementList', defaultStatementList);
  taxList      = loadStorage('taxList',       defaultTaxList);
  quoteList    = loadStorage('quoteList',     defaultQuoteList);
  orderList    = loadStorage('orderList',     defaultOrderList);
  if (typeof repairSalesOrderClients === 'function') repairSalesOrderClients();
  financeData  = loadStorage('financeData',  { entries: [], paidReceivable: {}, paidPayable: {} });
  if (!financeData.entries) financeData.entries = [];
  if (!financeData.paidReceivable) financeData.paidReceivable = {};
  if (!financeData.paidPayable) financeData.paidPayable = {};
  if (!financeData.closedMonths) financeData.closedMonths = [];
  if (!financeData.auditLog) financeData.auditLog = [];
  if (!financeData.payrollSettings) financeData.payrollSettings = {};
  attendance   = loadStorage('attendance',   []);
  leaves       = loadStorage('leaves',       []);
  payrollRecords = loadStorage('payrollRecords', []);
  memoList     = loadStorage('memoList',      []);
  todoList     = loadStorage('todoList',      []);
  memoAttachmentData = loadStorage('memoAttachmentData', {});

  // 자동 마이그레이션: 구형 예시 데이터만 존재하거나 비어있을 시 5개 추가 데이터 자동 삽입
  // (제거됨) 데모 시드 자동삽입 — 데이터는 Firebase가 담당
  processStages = processStages.filter(s => s !== '출하완료');
  if (!processStages.includes('완료')) processStages.splice(Math.max(0,processStages.indexOf('납품')),0,'완료');
  if (!processStages.includes('납품')) processStages.push('납품');
  products.forEach(p => { if (p.processStage==='출하완료') { p.processStage='완료'; p.status='완료'; } });
}

/* ════════ (제거됨) HTML 파일 자동 저장 ════════
   살아있는 DOM(outerHTML)을 직렬화해 파일에 쓰던 방식은 런타임 주입물(체크박스 열,
   권한 CSS, 배지 등)이 파일에 박제되는 문제가 있어 제거됨.
   데이터 보존은 Firebase 동기화 + JSON/XLS 내보내기(exportDataJSON/exportAllXLS)가 담당. */

/* ════════ 전체 데이터 JSON 파일 내보내기/가져오기 (프로그램 ↔ 데이터 분리) ════════ */
const DATA_KEYS = [
  'clients','products','materials','workOrders','workers','defects','claims',
  'checkRecords','alerts','inventory','deliveries','stages','trash','rfqList',
  'poList','partners','financeData','attendance','leaves','payrollRecords','statementList',
  'taxList','quoteList','orderList','inventoryLedger','alimtalkSettings','memoList','todoList','memoAttachmentData',
  'asList','bomList','companyInfo','docXlsxTemplates','driveOAuthSettings'
];

function buildDataBackupPayload() {
  const out = { _savedAt: new Date().toISOString() };
  DATA_KEYS.forEach(k => {
    const raw = localStorage.getItem('mes_' + k);
    if (raw != null) {
      try { out[k] = JSON.parse(raw); } catch(e) { /* 손상 키는 건너뜀 */ }
    }
  });
  return out;
}

function applyDataBackupPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('올바른 데이터 백업 형식이 아닙니다.');
  }
  let applied = 0;
  DATA_KEYS.forEach(k => {
    if (data[k] != null) {
      localStorage.setItem('mes_' + k, JSON.stringify(data[k]));
      applied++;
      if (typeof cloudQueueSave === 'function') cloudQueueSave(k);
    }
  });
  if (!applied) throw new Error('복원할 MES 데이터 항목이 없습니다.');
  localStorage.setItem('mes__savedAt', new Date().toISOString());
  reloadAllData();
  return applied;
}

function exportDataJSON() {
  const out = buildDataBackupPayload();
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
        let applied = 0;
        try { applied = applyDataBackupPayload(data); }
        catch(err) { showToast(err.message || '데이터 복원에 실패했습니다.', 'error'); return; }
        if (typeof _goTo === 'function') _goTo(currentPage || 'dashboard', null);
        showToast(`데이터 가져오기 완료 — ${applied}개 항목 복원`, 'success');
      };
      reader.readAsText(file);
    });
  input.value = '';
}

/* ════════ XLS 전체 데이터 내보내기 ════════ */
function exportAllXLS() {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 각 데이터셋 → 시트 정의
  const sheets = [
    { name: '고객사', data: clients, cols: ['id','name','manager','tel','email','date','note','closed','closedAt'] },
    { name: '제품', data: products, cols: ['id','clientId','name','spec','qty','unit','price','deliveryDate','processStage','status','processMemo','note'] },
    { name: '자재', data: materials, cols: ['id','productId','name','supplier','unitPrice','qty','unit','orderDate','expectedDate','status','note'] },
    { name: '생산지시', data: workOrders, cols: ['id','clientId','productId','line','qty','done','defect','start','due','status','manager','note'] },
    { name: '작업원', data: workers, cols: ['id','name','line','role','tin','tout','ot','status'] },
    { name: '불량현황', data: defects, cols: ['id','productId','type','stage','qty','date','status','cause','action','note'] },
    { name: '클레임', data: claims, cols: ['id','clientId','productId','date','content','status','action','note'] },
    { name: '검사기록', data: checkRecords, cols: ['id','clientId','productId','date','inspector','visual','dim','func','result','note'] },
    { name: '재고', data: inventory, cols: ['id','name','type','unit','qty','minQty','location','note'] },
    { name: '납품현황', data: deliveries, cols: ['id','deliveredAt','clientId','productId','productName','spec','qty','unit','price','note'] },
    { name: '알림', data: alertsList, cols: ['type','title','sub','createdAt'] },
    { name: '공정단계설정', data: processStages.map((s,i) => ({ 순서: i+1, 단계명: s })), cols: ['순서','단계명'] },
  ];

  sheets.forEach(({ name, data, cols }) => {
    if (!data || !data.length) {
      // 빈 시트도 헤더는 유지
      const ws = XLSX.utils.aoa_to_sheet([cols]);
      XLSX.utils.book_append_sheet(wb, ws, name);
      return;
    }
    // 컬럼 순서를 정의대로 맞춰 배열로 변환
    const rows = data.map(row => cols.map(c => row[c] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);

    // 컬럼 너비 자동 조정
    ws['!cols'] = cols.map(c => ({ wch: Math.max(c.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const fileName = `MESPro_데이터_${today().replace(/-/g,'')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`${fileName} 저장 완료 — ${sheets.length}개 시트`, 'success');
}

/* ════════ XLS 전체 데이터 가져오기 ════════ */
function importAllXLS(input) {
  const file = input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS 라이브러리가 로드되지 않았습니다.', 'error');
    return;
  }

  confirm_('XLS 데이터 가져오기',
    `<strong>${file.name}</strong> 파일을 불러옵니다.<br>
    <span style="color:var(--tx-d); font-size:12px;">⚠ 현재 저장된 모든 데이터가 파일의 내용으로 교체됩니다.</span>`,
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });

          const readSheet = (name, keyMap) => {
            const ws = wb.Sheets[name];
            if (!ws) return null;
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            return rows;
          };

          // 각 시트 → 데이터 배열로 복원
          const imported = {
            clients:      readSheet('고객사'),
            products:     readSheet('제품'),
            materials:    readSheet('자재'),
            workOrders:   readSheet('생산지시'),
            workers:      readSheet('작업원'),
            defects:      readSheet('불량현황'),
            claims:       readSheet('클레임'),
            checkRecords: readSheet('검사기록'),
            inventory:    readSheet('재고'),
            deliveries:   readSheet('납품현황'),
            alerts:       readSheet('알림'),
            stages:       readSheet('공정단계설정'),
          };

          let loaded = 0;

          if (imported.clients)      { clients      = imported.clients;                                        saveStorage('clients', clients);           loaded++; }
          if (imported.products)     { products     = imported.products;                                       saveStorage('products', products);         loaded++; }
          if (imported.materials)    { materials    = imported.materials;                                      saveStorage('materials', materials);       loaded++; }
          if (imported.workOrders)   { workOrders   = imported.workOrders;                                     saveStorage('workOrders', workOrders);     loaded++; }
          if (imported.workers)      { workers      = imported.workers;                                        saveStorage('workers', workers);           loaded++; }
          if (imported.defects)      { defects      = imported.defects;                                        saveStorage('defects', defects);           loaded++; }
          if (imported.claims)       { claims       = imported.claims;                                         saveStorage('claims', claims);             loaded++; }
          if (imported.checkRecords) { checkRecords = imported.checkRecords;                                   saveStorage('checkRecords', checkRecords); loaded++; }
          if (imported.inventory)    { inventory    = imported.inventory;                                      saveStorage('inventory', inventory);       loaded++; }
          if (imported.deliveries)   { deliveries   = imported.deliveries;                                     saveStorage('deliveries', deliveries);     loaded++; }
          if (imported.alerts)       { alertsList   = imported.alerts;                                         saveStorage('alerts', alertsList);         loaded++; }
          if (imported.stages && imported.stages.length) {
            processStages = imported.stages.map(r => r['단계명'] || r['단계'] || '').filter(Boolean);
            if (!processStages.includes('완료')) processStages.push('완료');
            if (!processStages.includes('납품')) processStages.push('납품');
            saveStorage('stages', processStages);
            loaded++;
          }

          // 화면 전체 갱신
          syncFilterDropdowns();
          renderDashboard();
          refreshPage(currentPage);
          updateDlvBadge();
          updateTrashBadge();
          showToast(`가져오기 완료 — ${loaded}개 시트, 총 ${imported.clients?.length||0}개 고객사`, 'success');
        } catch (err) {
          showToast(`파일 오류: ${err.message}`, 'error');
          console.error('XLS import error:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  );

  // 파일 input 초기화 (같은 파일 재선택 가능하게)
  input.value = '';
}

let clients = loadStorage('clients', defaultClients);
let products = loadStorage('products', defaultProducts);
let materials = loadStorage('materials', defaultMaterials);
let workOrders = loadStorage('workOrders', defaultWorkOrders);
let workers = loadStorage('workers', defaultWorkers);
let defects = loadStorage('defects', defaultDefects);
let claims = loadStorage('claims', defaultClaims);
let checkRecords = loadStorage('checkRecords', defaultCheckRecords);
let alertsList = loadStorage('alerts', defaultAlerts);
let inventory = loadStorage('inventory', defaultInventory);
/* 재고 구분(category) 자동 이관: 구버전 데이터 보정 */
function migrateInvCategory() {
  let changed = false;
  inventory.forEach(i => {
    if (!i.category) { i.category = (i.type === '완제품') ? '완제품' : '생산부품'; changed = true; }
  });
  if (changed) saveStorage('inventory', inventory);
}
migrateInvCategory();
let processStages = loadStorage('stages', ['설계/도면','자재발주','가공/제작','조립','배선/전기','검사/시험','완료','납품']);
// 마이그레이션: '출하완료' → '완료' 통일 및 새 단계 추가
// '출하완료' 단계 제거 (완료로 통일)
processStages = processStages.filter(s => s !== '출하완료');
if (!processStages.includes('완료')) processStages.splice(Math.max(0, processStages.indexOf('납품')), 0, '완료');
if (!processStages.includes('납품')) processStages.push('납품');
saveStorage('stages', processStages);
// 기존 제품 데이터 마이그레이션
const needsMigration = products.some(p => ['완료','납품'].includes(p.processStage));
if (needsMigration) {
  products.forEach(p => { if (p.processStage === '출하완료') { p.processStage = '완료'; p.status = '완료'; } });
  saveStorage('products', products);
}

let trash = loadStorage('trash', []);
let deliveries = loadStorage('deliveries', []);
/* 고객 A/S · 사후관리 대장 */
const defaultAS = [];
let asList = loadStorage('asList', defaultAS);
/* BOM · 자재명세 — 제품 1대당 소요 자재/수량(레시피). 구매(materials)와 분리된 설계 기준. */
const defaultBom = [];
let bomList = loadStorage('bomList', defaultBom);
let bomProductId = '';   // BOM 화면에서 선택된 제품
let memoList = loadStorage('memoList', []);
let todoList = loadStorage('todoList', []);
let memoAttachmentData = loadStorage('memoAttachmentData', {});
let financeData = loadStorage('financeData', { entries: [], paidReceivable: {}, paidPayable: {} });
// 구조 보정 (구버전 호환)
if (!financeData.entries) financeData.entries = [];
if (!financeData.paidReceivable) financeData.paidReceivable = {};
if (!financeData.paidPayable) financeData.paidPayable = {};
if (!financeData.closedMonths) financeData.closedMonths = [];
if (!financeData.auditLog) financeData.auditLog = [];
if (!financeData.payrollSettings) financeData.payrollSettings = {};
let attendance = loadStorage('attendance', []);
let leaves = loadStorage('leaves', []);
let payrollRecords = loadStorage('payrollRecords', []);

rfqList = loadStorage('rfqList', defaultRfqList);
poList = loadStorage('poList', defaultPoList);
partners = loadStorage('partners', defaultPartners);
let statementList = loadStorage('statementList', defaultStatementList);
let taxList = loadStorage('taxList', defaultTaxList);
let quoteList = loadStorage('quoteList', defaultQuoteList);
let orderList = loadStorage('orderList', defaultOrderList);
/* 수주 전환 고아 제품 복구: 제품의 clientId가 실제 고객사에 없으면 수주 정보로 고객사 자동 생성·연결 */
function repairSalesOrderClients() {
  let cChanged = false, pChanged = false, oChanged = false;
  orderList.forEach(o => {
    const p = o.productId ? products.find(x => x.id === o.productId) : null;
    if (!p) return;
    if (clients.some(c => c.id === p.clientId)) return; // 이미 유효
    const name = (o.clientName || (o.clientId && getClientName(o.clientId)) || p.clientId || '미지정 고객사').trim();
    let ex = clients.find(c => c.name === name);
    let cid;
    if (ex) cid = ex.id;
    else {
      cid = nextCode('CL', clients);
      clients.push({ id: cid, name, manager:'', tel:'', email: o.clientEmail||'', date: today(), note: '수주 전환 고객사 복구' });
      cChanged = true;
    }
    p.clientId = cid; o.clientId = cid; pChanged = true; oChanged = true;
  });
  if (cChanged) saveStorage('clients', clients);
  if (pChanged) saveStorage('products', products);
  if (oChanged) saveStorage('orderList', orderList);
}
repairSalesOrderClients();

// 마이그레이션: 구형 예시 데이터만 존재하거나 비어있을 시 5개 추가 데이터 자동 삽입
// (제거됨) 데모 시드 자동삽입 — 데이터는 Firebase가 담당

/**
 * 재고 입출고/조정 이력 기록
 * @param {string} invId - 재고 품목 ID
 * @param {'입고'|'출고'|'조정'} type
 * @param {number} qty - 변동 수량 (양수)
 * @param {string} reason - 사유 텍스트
 * @param {string} [refId] - 연관 ID (자재발주 MT-xxx 등)
 */
function logInventoryMove(invId, type, qty, reason, refId) {
  const entry = {
    id: 'ILG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    invId,
    type,
    qty: Number(qty),
    reason: reason || '',
    refId: refId || '',
    date: today()
  };
  inventoryLedger.unshift(entry);
  saveStorage('inventoryLedger', inventoryLedger);
}
