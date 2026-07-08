/* ════════ 로컬 스토리지 연동 및 초기 데이터 정의 ════════ */

const defaultRfqList  = [];
const defaultPoList   = [];
const defaultPartners = [];
let rfqList  = [];
let poList   = [];
let partners = [];
let inventoryLedger = [];  // 재고 입출고 이력
let alimtalkSettings = {}; // 카카오 알림톡 설정
let emailSendHistory = [];

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

const AUDIT_LOG_LIMIT = 1000;
const DEFAULT_ENTITY_VISIBILITY = {
  clients: 'company',
  products: 'company',
  partners: 'company',
  as: 'company',
  bom: 'company',
  delivery: 'company',
  finance: 'company',
  financePayment: 'company',
  order: 'company',
  quote: 'company',
  worker: 'company',
  rfq: 'assignee',
  po: 'assignee',
  material: 'department',
  inventory: 'department',
  inventoryMove: 'department',
  paymentRequest: 'assignee',
  financeEntry: 'department',
  fixedCost: 'department',
  fixedCostPayment: 'department',
  workOrder: 'department',
  defect: 'department',
  checkRecord: 'department',
  claim: 'assignee',
  trash: 'department'
};
const DATA_SCOPE_ENTITY_GROUPS = {
  clients: 'clients',
  products: 'clients',
  process: 'process',
  processClient: 'process',
  workOrder: 'process',
  processProduct: 'process',
  processMaterial: 'process',
  material: 'materials',
  materials: 'materials',
  inventory: 'inventory',
  inventoryMove: 'inventory',
  memo: 'notes',
  todo: 'notes',
  notes: 'notes',
  rfq: 'rfq',
  po: 'po',
  quote: 'salesdoc',
  order: 'salesdoc',
  statement: 'salesdoc',
  tax: 'salesdoc',
  delivery: 'deliveries',
  deliveries: 'deliveries',
  defect: 'quality',
  checkRecord: 'quality',
  claim: 'claims',
  as: 'as',
  partners: 'partners',
  partner: 'partners',
  finance: 'finance',
  financePayment: 'finance',
  paymentRequest: 'finance',
  financeEntry: 'finance',
  fixedCost: 'finance',
  fixedCostPayment: 'finance',
  bom: 'bom',
  worker: 'workers',
  trash: 'trash'
};
const DEFAULT_SHARED_DATA_SCOPE_GROUPS = new Set(['inventory', 'process', 'notes']);
const AUDIT_META_FIELDS = new Set([
  'createdBy','createdByName','createdAt','updatedBy','updatedByName','updatedAt',
  'ownerUserId','ownerUserName','ownerDeptId','ownerDeptName','visibility',
  'sharedWith','approvalUsers','deletedBy','deletedByName','deletedAt',
  'restoredBy','restoredByName','restoredAt','auditTrail','_mes'
]);
const AUDIT_DOC_ITEM_FIELDS = ['itemName','spec','qty','unit','price','note'];
const AUDIT_DOC_ITEM_LABELS = {
  itemName: '품목명',
  spec: '규격',
  qty: '수량',
  unit: '단위',
  price: '단가',
  note: '비고'
};
const AUDIT_DOC_MIRROR_FIELDS = new Set(['itemName','spec','qty','unit','unitPrice','price','note']);

function _safeJsonClone(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); }
  catch(e) { return value; }
}
function _auditString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(_auditString).join(', ');
  try { return JSON.stringify(value); } catch(e) { return String(value); }
}
function _auditSame(a, b) {
  return _auditString(a) === _auditString(b);
}
function _auditLooksLikeDocItems(items) {
  return Array.isArray(items) && items.some(row =>
    row && typeof row === 'object' && !Array.isArray(row) && AUDIT_DOC_ITEM_FIELDS.some(field => field in row)
  );
}
function _auditDocItemRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const out = {};
  AUDIT_DOC_ITEM_FIELDS.forEach(field => { out[field] = row[field] ?? ''; });
  return out;
}
function _auditDocRowHasValue(row) {
  return AUDIT_DOC_ITEM_FIELDS.some(field => _auditString(row && row[field]).trim() !== '');
}
function _auditDocRowSummary(row) {
  const clean = _auditDocItemRow(row);
  return Object.assign({}, clean);
}
function _auditDocItemDiff(beforeItems, afterItems) {
  const beforeRows = Array.isArray(beforeItems) ? beforeItems : [];
  const afterRows = Array.isArray(afterItems) ? afterItems : [];
  const max = Math.max(beforeRows.length, afterRows.length);
  const changes = [];
  for (let i = 0; i < max; i++) {
    const beforeRow = _auditDocItemRow(beforeRows[i]);
    const afterRow = _auditDocItemRow(afterRows[i]);
    const beforeHas = _auditDocRowHasValue(beforeRow);
    const afterHas = _auditDocRowHasValue(afterRow);
    if (!beforeHas && !afterHas) continue;
    const rowLabel = `품목 ${i + 1}`;
    if (!beforeHas && afterHas) {
      changes.push({ field: `items.${i}.row`, label: `${rowLabel} 추가`, before: '', after: _auditDocRowSummary(afterRow) });
      continue;
    }
    if (beforeHas && !afterHas) {
      changes.push({ field: `items.${i}.row`, label: `${rowLabel} 삭제`, before: _auditDocRowSummary(beforeRow), after: '' });
      continue;
    }
    AUDIT_DOC_ITEM_FIELDS.forEach(field => {
      if (_auditSame(beforeRow[field], afterRow[field])) return;
      changes.push({
        field: `items.${i}.${field}`,
        label: `${rowLabel} ${AUDIT_DOC_ITEM_LABELS[field] || field}`,
        before: beforeRow[field] ?? '',
        after: afterRow[field] ?? ''
      });
    });
  }
  if (!changes.length && !_auditSame(beforeItems, afterItems)) {
    changes.push({ field: 'items', label: '품목 목록', before: beforeItems || [], after: afterItems || [] });
  }
  return changes;
}
function getCurrentActor() {
  const cloudUser = (typeof _cloudUser !== 'undefined' && _cloudUser) ? _cloudUser : null;
  const email = (cloudUser && cloudUser.email) || localStorage.getItem('mes_myEmail') || '';
  const uid = (cloudUser && cloudUser.uid) || (email ? 'email:' + email : 'local-admin');
  const role = (typeof currentRole !== 'undefined' && currentRole) || localStorage.getItem('mes_myRole') || 'admin';
  const cachedUsers = loadStorage('cloudUsers_cache', []);
  const account = Array.isArray(cachedUsers) ? cachedUsers.find(u => u.uid === uid || (email && u.email === email)) : null;
  const worker = Array.isArray(workers) ? workers.find(w => email && (w.email || '').toLowerCase() === String(email).toLowerCase()) : null;
  const name = (account && account.name) || (worker && worker.name) || localStorage.getItem('mes_myName') || (cloudUser && cloudUser.displayName) || email || '로컬 관리자';
  return {
    userId: uid,
    uid,
    name,
    email,
    role,
    deptId: (account && (account.deptId || account.dept)) || (worker && (worker.deptId || worker.dept)) || '',
    deptName: (account && (account.deptName || account.dept)) || (worker && (worker.deptName || worker.dept)) || '',
    position: (account && account.position) || (worker && worker.position) || ''
  };
}
function canViewCostInfo(actor = null) {
  const role = (actor && actor.role) || (typeof currentRole !== 'undefined' && currentRole) || localStorage.getItem('mes_myRole') || 'staff';
  return role === 'admin' || role === 'manager';
}
function _actorMatchesName(actor, value) {
  if (!actor || !value) return false;
  const target = String(value).trim();
  return !!target && [actor.name, actor.email, actor.userId].some(v => String(v || '').trim() === target);
}
function _recordAssigneeNames(record) {
  if (!record || typeof record !== 'object') return [];
  return [
    record.assignee, record.manager, record.owner, record.requester, record.inspector,
    record.handler, record.pic, record.workerName, record.createdByName, record.updatedByName
  ].filter(Boolean);
}
function defaultVisibilityForEntity(entityType) {
  return DEFAULT_ENTITY_VISIBILITY[entityType] || 'company';
}
function dataScopeGroupForEntity(entityType) {
  return DATA_SCOPE_ENTITY_GROUPS[entityType] || entityType || 'general';
}
function defaultDataScopeForGroup(group) {
  return DEFAULT_SHARED_DATA_SCOPE_GROUPS.has(group) ? 'shared' : 'own';
}
function dataScopeForEntity(entityType, actor = getCurrentActor()) {
  const role = ((actor && actor.role) || '').trim();
  if (!role || role === 'admin') return 'shared';
  const group = dataScopeGroupForEntity(entityType);
  const cfg = (typeof roleDataScopeConfig === 'function')
    ? roleDataScopeConfig()
    : (loadStorage('roleDataScope', {}) || {});
  const roleCfg = (cfg && cfg[role]) || {};
  const scope = roleCfg[group] || defaultDataScopeForGroup(group);
  return scope === 'shared' ? 'shared' : 'own';
}
function dataScopeSharedForEntity(entityType, actor = getCurrentActor()) {
  return dataScopeForEntity(entityType, actor) === 'shared';
}
function enrichRecordAccess(record, entityType, options = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const actor = options.actor || getCurrentActor();
  const now = options.now || new Date().toISOString();
  if (!record.createdBy) record.createdBy = actor.userId;
  if (!record.createdByName) record.createdByName = actor.name;
  if (!record.createdAt) record.createdAt = now;
  if (options.migration) {
    if (!record.updatedBy) record.updatedBy = record.createdBy;
    if (!record.updatedByName) record.updatedByName = record.createdByName;
    if (!record.updatedAt) record.updatedAt = record.createdAt;
  } else {
    record.updatedBy = actor.userId;
    record.updatedByName = actor.name;
    record.updatedAt = now;
  }
  if (!record.ownerUserId) record.ownerUserId = options.ownerUserId || actor.userId;
  if (!record.ownerUserName) record.ownerUserName = options.ownerUserName || actor.name;
  if (!record.ownerDeptId) record.ownerDeptId = options.ownerDeptId || actor.deptId || actor.deptName || '';
  if (!record.ownerDeptName) record.ownerDeptName = options.ownerDeptName || actor.deptName || actor.deptId || '';
  if (!record.visibility) record.visibility = options.visibility || defaultVisibilityForEntity(entityType);
  if (!Array.isArray(record.sharedWith)) record.sharedWith = record.sharedWith ? [record.sharedWith] : [];
  if (!Array.isArray(record.approvalUsers)) record.approvalUsers = record.approvalUsers ? [record.approvalUsers] : [];
  return record;
}
function stampRecordCreate(record, entityType, options = {}) {
  return enrichRecordAccess(record, entityType, options);
}
function stampRecordUpdate(record, before, entityType, options = {}) {
  if (before && typeof before === 'object') {
    ['createdBy','createdByName','createdAt','ownerUserId','ownerUserName','ownerDeptId','ownerDeptName','visibility','sharedWith','approvalUsers'].forEach(k => {
      if (record[k] == null || record[k] === '') record[k] = _safeJsonClone(before[k]);
    });
  }
  return enrichRecordAccess(record, entityType, options);
}
function migrateRecordAccessFields(list, entityType, options = {}) {
  if (!Array.isArray(list)) return false;
  let changed = false;
  list.forEach(record => {
    if (!record || typeof record !== 'object') return;
    const before = JSON.stringify({
      createdBy: record.createdBy,
      ownerUserId: record.ownerUserId,
      visibility: record.visibility,
      sharedWith: record.sharedWith
    });
    enrichRecordAccess(record, entityType, Object.assign({ now: record.createdAt || record.updatedAt || new Date().toISOString(), migration:true }, options));
    const after = JSON.stringify({
      createdBy: record.createdBy,
      ownerUserId: record.ownerUserId,
      visibility: record.visibility,
      sharedWith: record.sharedWith
    });
    if (before !== after) changed = true;
  });
  return changed;
}
function auditDiff(before, after) {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const keys = new Set(Object.keys(b).concat(Object.keys(a)));
  const changes = [];
  const docItemsChanged = (_auditLooksLikeDocItems(b.items) || _auditLooksLikeDocItems(a.items)) && !_auditSame(b.items, a.items);
  if (docItemsChanged) changes.push(..._auditDocItemDiff(b.items, a.items));
  keys.forEach(key => {
    if (AUDIT_META_FIELDS.has(key)) return;
    if (key === 'items' && docItemsChanged) return;
    if (docItemsChanged && AUDIT_DOC_MIRROR_FIELDS.has(key)) return;
    if (!_auditSame(b[key], a[key])) changes.push({ field: key, before: b[key] ?? '', after: a[key] ?? '' });
  });
  return changes;
}
function auditLabelForAction(action) {
  const map = {
    create: '등록',
    update: '수정',
    statusChange: '상태 변경',
    delete: '삭제',
    restore: '복구',
    approve: '승인',
    reject: '반려',
    bulkUpdate: '일괄 처리',
    export: '내보내기'
  };
  return map[action] || action || '작업';
}
function auditTargetMeta(before, after) {
  const target = after && typeof after === 'object' ? after : (before && typeof before === 'object' ? before : {});
  return {
    targetCreatedBy: target.createdBy || '',
    targetCreatedByName: target.createdByName || '',
    targetCreatedAt: target.createdAt || '',
    targetOwnerUserId: target.ownerUserId || '',
    targetOwnerUserName: target.ownerUserName || ''
  };
}
function auditCreatedByName(log) {
  return (log && (log.targetCreatedByName || log.createdByName || log.ownerUserName || log.targetOwnerUserName)) || '';
}
function auditActorDisplayName(log) {
  if (!log) return '-';
  return log.actorName || auditCreatedByName(log) || log.actorUserId || log.targetCreatedBy || '-';
}
function auditActorDisplaySub(log) {
  if (!log) return '';
  if (log.actorRole) return log.actorRole;
  if (!log.actorName && auditCreatedByName(log)) return '등록자';
  return '';
}
const FINANCE_AUDIT_ENTITY_TYPES = new Set([
  'finance',
  'financePayment',
  'fixedCost',
  'fixedCostPayment',
  'paymentRequest',
  'financeEntry'
]);
function isFinanceAuditLogEntry(log) {
  if (!log) return false;
  if (typeof log === 'string') return FINANCE_AUDIT_ENTITY_TYPES.has(log);
  if (typeof log === 'object' && !Object.prototype.hasOwnProperty.call(log, 'entityType')) return true;
  const type = String(log.entityType || '').trim();
  if (!type) return false;
  return FINANCE_AUDIT_ENTITY_TYPES.has(type);
}
function writeAuditLog(entityType, entityId, action, before, after, options = {}) {
  const actor = options.actor || getCurrentActor();
  const at = options.at || new Date().toISOString();
  const changes = options.changes || auditDiff(before, after);
  const summary = options.summary || `${auditLabelForAction(action)}${changes.length ? ' · ' + changes.map(c => c.label || c.field).slice(0, 4).join(', ') : ''}`;
  const entry = {
    id: options.id || ('AUD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
    entityType: entityType || '',
    entityId: entityId || '',
    action: action || '',
    actorUserId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    actorDeptId: actor.deptId || '',
    actorDeptName: actor.deptName || '',
    at,
    summary,
    changes,
    reason: options.reason || '',
    source: options.source || 'ui',
    detail: options.detail || summary
  };
  Object.assign(entry, auditTargetMeta(before, after));
  if (!Array.isArray(auditLog)) auditLog = loadStorage('auditLog', []);
  auditLog.unshift(entry);
  auditLog = auditLog.slice(0, AUDIT_LOG_LIMIT);
  saveStorage('auditLog', auditLog);
  if (typeof financeData === 'object' && financeData && isFinanceAuditLogEntry(entry)) {
    if (!Array.isArray(financeData.auditLog)) financeData.auditLog = [];
    financeData.auditLog.unshift(entry);
    financeData.auditLog = financeData.auditLog.slice(0, AUDIT_LOG_LIMIT);
    saveStorage('financeData', financeData);
  }
  try {
    if (typeof _fbDb !== 'undefined' && _fbDb && typeof _cloudActive !== 'undefined' && _cloudActive) {
      _fbDb.collection('audit_logs').doc(entry.id).set(entry).catch(e => console.warn('감사 로그 서버 기록 실패:', e && e.code));
    }
  } catch(e) {}
  return entry;
}
function userRefMatches(record, refs, actor) {
  const set = new Set((refs || []).map(v => String(v || '').trim()).filter(Boolean));
  if (!set.size) return false;
  return [actor.userId, actor.uid, actor.email, actor.name].some(v => set.has(String(v || '').trim()));
}
function personalDataOnlyRole(actor, entityType) {
  const role = ((actor && actor.role) || '').trim();
  return !!role && role !== 'admin' && !dataScopeSharedForEntity(entityType, actor);
}
function recordOwnedByActor(record, actor) {
  if (!record || !actor) return false;
  const nested = record && record.data && typeof record.data === 'object' ? record.data : null;
  return userRefMatches(record, [
    record.createdBy,
    record.ownerUserId,
    record.createdByName,
    record.ownerUserName,
    record.deletedBy,
    record.deletedByName,
    record.actorUserId,
    record.actorName,
    nested && nested.createdBy,
    nested && nested.ownerUserId,
    nested && nested.createdByName,
    nested && nested.ownerUserName,
    nested && nested.deletedBy,
    nested && nested.deletedByName
  ], actor);
}
function roleFeatureAllowed(key) {
  if ((typeof currentRole !== 'undefined' && currentRole === 'admin') || !key) return true;
  if (typeof canUseFeature === 'function') return canUseFeature(key);
  const role = (typeof currentRole !== 'undefined' && currentRole) || 'staff';
  const features = (typeof roleFeaturesConfig === 'function' ? roleFeaturesConfig() : {}) || {};
  const f = features[role] || {};
  return f[key] !== false;
}
function canViewRecord(record, entityType, actor = getCurrentActor()) {
  if (!record || typeof record !== 'object') return true;
  if (actor.role === 'admin') return true;
  if (dataScopeSharedForEntity(entityType, actor)) return true;
  if (personalDataOnlyRole(actor, entityType)) return recordOwnedByActor(record, actor);
  const visibility = record.visibility || defaultVisibilityForEntity(entityType);
  if (visibility === 'company') return true;
  if (record.createdBy && userRefMatches(record, [record.createdBy], actor)) return true;
  if (record.ownerUserId && userRefMatches(record, [record.ownerUserId], actor)) return true;
  if (userRefMatches(record, record.sharedWith, actor)) return true;
  if (userRefMatches(record, record.approvalUsers, actor)) return true;
  if ((visibility === 'assignee' || visibility === 'department' || visibility === 'shared') && _recordAssigneeNames(record).some(v => _actorMatchesName(actor, v))) return true;
  if (visibility === 'department') {
    const actorDept = String(actor.deptId || actor.deptName || '').trim();
    const recordDept = String(record.ownerDeptId || record.ownerDeptName || record.dept || '').trim();
    return !!actorDept && !!recordDept && actorDept === recordDept;
  }
  return false;
}
function canEditRecord(record, entityType, actor = getCurrentActor()) {
  if (!canViewRecord(record, entityType, actor)) return false;
  if (actor.role === 'admin') return true;
  if (!roleFeatureAllowed('edit')) return false;
  const locked = ['입고완료','지급완료','완료','수주전환','발행완료','전송완료'];
  if (locked.includes(record && record.status)) return false;
  if (!record || record.visibility === 'company') return actor.role === 'manager' || recordOwnedByActor(record, actor);
  return userRefMatches(record, [record.createdBy, record.ownerUserId], actor) ||
    userRefMatches(record, record.sharedWith, actor) ||
    _recordAssigneeNames(record).some(v => _actorMatchesName(actor, v));
}
function canDeleteRecord(record, entityType, actor = getCurrentActor()) {
  if (actor.role === 'admin') return true;
  if (!roleFeatureAllowed('delete')) return false;
  return canEditRecord(record, entityType, actor);
}
function canApproveRecord(record, entityType, actor = getCurrentActor()) {
  if (actor.role === 'admin') return true;
  if (!roleFeatureAllowed('approve')) return false;
  return userRefMatches(record, record && record.approvalUsers, actor);
}
function requireRecordPermission(action, record, entityType) {
  const fn = action === 'delete' ? canDeleteRecord : (action === 'approve' ? canApproveRecord : canEditRecord);
  if (fn(record, entityType)) return true;
  if (typeof showToast === 'function') showToast('이 데이터에 대한 권한이 없습니다.', 'error');
  return false;
}
function visibleRecords(list, entityType) {
  if (!Array.isArray(list)) return [];
  return list.filter(record => canViewRecord(record, entityType));
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
      memoList: 'memoList', todoList: 'todoList',
      auditLog: 'auditLog',
      emailSendHistory: 'emailSendHistory'
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
  financeData  = loadStorage('financeData',  { entries: [], paidReceivable: {}, paidPayable: {} });
  if (!financeData.entries) financeData.entries = [];
  if (!financeData.paidReceivable) financeData.paidReceivable = {};
  if (!financeData.paidPayable) financeData.paidPayable = {};
  if (!financeData.closedMonths) financeData.closedMonths = [];
  if (!financeData.auditLog) financeData.auditLog = [];
  if (!financeData.payrollSettings) financeData.payrollSettings = {};
  if (!financeData.paymentRequests) financeData.paymentRequests = [];
  if (!financeData.fixedCosts) financeData.fixedCosts = [];
  if (!financeData.fixedCostPayments) financeData.fixedCostPayments = [];
  if (!financeData.hometaxInvoices) financeData.hometaxInvoices = [];
  attendance   = loadStorage('attendance',   []);
  leaves       = loadStorage('leaves',       []);
  payrollRecords = loadStorage('payrollRecords', []);
  memoList     = loadStorage('memoList',      []);
  todoList     = loadStorage('todoList',      []);
  memoAttachmentData = loadStorage('memoAttachmentData', {});
  auditLog      = loadStorage('auditLog',      []);
  emailSendHistory = loadStorage('emailSendHistory', []);

  // 자동 마이그레이션: 구형 예시 데이터만 존재하거나 비어있을 시 5개 추가 데이터 자동 삽입
  // (제거됨) 데모 시드 자동삽입 — 데이터는 Firebase가 담당
  processStages = processStages.filter(s => s !== '출하완료');
  if (!processStages.includes('완료')) processStages.splice(Math.max(0,processStages.indexOf('납품')),0,'완료');
  if (!processStages.includes('납품')) processStages.push('납품');
  products.forEach(p => { if (p.processStage==='출하완료') { p.processStage='완료'; p.status='완료'; } });
  if (typeof migrateClientMasterToPartners === 'function') migrateClientMasterToPartners();
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
  'taxList','quoteList','orderList','inventoryLedger','alimtalkSettings','memoList','todoList','memoAttachmentData','auditLog','emailSendHistory',
  'asList','bomList','companyInfo','docXlsxTemplates','driveOAuthSettings','googleDriveConfig',
  'tableDisplayConfig','uiBrandSettings','uiScale','uiFontScale','menuIconSize','tableGridLines','uiColors','theme'
];
const LOCAL_ONLY_DATA_KEYS = ['alimtalkSettings','memoAttachmentData','auditLog'];

function cloudDataKeysFromBackupKeys() {
  const localOnly = new Set(LOCAL_ONLY_DATA_KEYS);
  return DATA_KEYS.filter(k => !localOnly.has(k));
}

function allDataBackupKeys() {
  const keys = new Set(DATA_KEYS);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (!fullKey || !fullKey.startsWith('mes_')) continue;
      const key = fullKey.slice(4);
      if (!key || key === '_savedAt') continue;
      keys.add(key);
    }
  } catch(e) {}
  return Array.from(keys);
}

function buildDataBackupPayload(keys = null) {
  const selectedKeys = Array.isArray(keys) && keys.length ? keys : allDataBackupKeys();
  const out = {
    _savedAt: new Date().toISOString(),
    _selectedKeys: selectedKeys.slice(),
    _rawStringKeys: []
  };
  selectedKeys.forEach(k => {
    const raw = localStorage.getItem('mes_' + k);
    if (raw != null) {
      try { out[k] = JSON.parse(raw); }
      catch(e) {
        out[k] = raw;
        out._rawStringKeys.push(k);
      }
    }
  });
  return out;
}

function applyDataBackupPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('올바른 데이터 백업 형식이 아닙니다.');
  }
  let applied = 0;
  const metaKeys = new Set(['_savedAt','_selectedKeys','_keys','_rawStringKeys']);
  const rawStringKeys = new Set(Array.isArray(data._rawStringKeys) ? data._rawStringKeys : []);
  const restoreKeys = new Set(DATA_KEYS);
  if (Array.isArray(data._selectedKeys)) data._selectedKeys.forEach(k => restoreKeys.add(k));
  Object.keys(data).forEach(k => { if (!metaKeys.has(k)) restoreKeys.add(k); });
  restoreKeys.forEach(k => {
    if (data[k] != null) {
      localStorage.setItem('mes_' + k, rawStringKeys.has(k) ? String(data[k]) : JSON.stringify(data[k]));
      applied++;
      if (DATA_KEYS.includes(k) && typeof cloudQueueSave === 'function') cloudQueueSave(k);
    }
  });
  if (!applied) throw new Error('복원할 MES 데이터 항목이 없습니다.');
  localStorage.setItem('mes__savedAt', new Date().toISOString());
  reloadAllData();
  return applied;
}

function exportDataJSON() {
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 백업')) return;
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
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 복원')) return;
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
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 각 데이터셋 → 시트 정의
  const sheets = [
    { name: '고객사', data: clients, cols: ['id','name','manager','tel','email','bizNo','date','note','closed','closedAt'] },
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
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 엑셀 가져오기')) return;
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
let auditLog = loadStorage('auditLog', []);
emailSendHistory = loadStorage('emailSendHistory', []);
let financeData = loadStorage('financeData', { entries: [], paidReceivable: {}, paidPayable: {} });
// 구조 보정 (구버전 호환)
if (!financeData.entries) financeData.entries = [];
if (!financeData.paidReceivable) financeData.paidReceivable = {};
if (!financeData.paidPayable) financeData.paidPayable = {};
if (!financeData.closedMonths) financeData.closedMonths = [];
if (!financeData.auditLog) financeData.auditLog = [];
if (!financeData.payrollSettings) financeData.payrollSettings = {};
if (!financeData.paymentRequests) financeData.paymentRequests = [];
if (!financeData.fixedCosts) financeData.fixedCosts = [];
if (!financeData.fixedCostPayments) financeData.fixedCostPayments = [];
if (!financeData.hometaxInvoices) financeData.hometaxInvoices = [];
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
/* 고객사 기준키 통합: 기존 CL 고객사를 거래처 관리의 고객사(BP) 코드로 이관 */
function _customerType(type) {
  return type === '구매처' ? '고객사' : (type || '고객사');
}
function _isCustomerPartner(p) {
  return p && _customerType(p.type) === '고객사';
}
function _normName(name) {
  return String(name || '').trim().toLowerCase();
}
function _findCustomerPartnerByName(name) {
  const key = _normName(name);
  return key ? partners.find(p => _isCustomerPartner(p) && _normName(p.name) === key) : null;
}
function _mergeMissing(target, source, fields) {
  let changed = false;
  fields.forEach(([to, from]) => {
    const value = source && source[from || to];
    if ((target[to] == null || target[to] === '') && value != null && value !== '') {
      target[to] = value;
      changed = true;
    }
  });
  return changed;
}
function ensureCustomerClient(source = {}) {
  const sourceId = String(source.id || source.clientId || '').trim();
  let partner = sourceId.startsWith('BP-') ? partners.find(p => p.id === sourceId) : null;
  if (!partner) partner = _findCustomerPartnerByName(source.name || source.clientName);
  if (!partner) {
    partner = {
      id: sourceId.startsWith('BP-') ? sourceId : nextCode('BP', partners),
      name: source.name || source.clientName || sourceId || '미지정 고객사',
      type: '고객사',
      manager: source.manager || '',
      tel: source.tel || '',
      mobile: source.mobile || '',
      email: source.email || source.clientEmail || '',
      bizNo: source.bizNo || source.clientBizNo || '',
      address: source.address || '',
      note: source.note || ''
    };
    partners.unshift(partner);
  } else {
    partner.type = '고객사';
    _mergeMissing(partner, source, [['manager'], ['tel'], ['mobile'], ['email'], ['bizNo'], ['address'], ['note']]);
  }
  if (sourceId && sourceId !== partner.id) {
    const legacy = Array.isArray(partner.legacyClientIds) ? partner.legacyClientIds : [];
    if (!legacy.includes(sourceId)) partner.legacyClientIds = legacy.concat(sourceId);
  }
  let client = clients.find(c => c.id === partner.id);
  if (!client) {
    client = {
      id: partner.id,
      name: partner.name,
      manager: partner.manager || source.manager || '',
      tel: partner.tel || source.tel || '',
      email: partner.email || source.email || source.clientEmail || '',
      bizNo: partner.bizNo || source.bizNo || source.clientBizNo || '',
      date: source.date || today(),
      note: source.note || partner.note || '',
      closed: !!source.closed
    };
    if (source.closedAt) client.closedAt = source.closedAt;
    clients.push(client);
  } else {
    client.name = partner.name || client.name;
    _mergeMissing(client, partner, [['manager'], ['tel'], ['email'], ['bizNo'], ['note']]);
    if (source.closed) client.closed = true;
    if (source.closedAt && !client.closedAt) client.closedAt = source.closedAt;
  }
  return client;
}
function syncPartnerFromClient(c) {
  if (!c || !c.id) return null;
  let partner = partners.find(p => p.id === c.id);
  if (!partner) {
    partner = { id:c.id, type:'고객사' };
    partners.unshift(partner);
  }
  partner.name = c.name || partner.name || '미지정 고객사';
  partner.type = '고객사';
  partner.manager = c.manager || '';
  partner.tel = c.tel || '';
  partner.email = c.email || '';
  partner.bizNo = c.bizNo || '';
  partner.note = c.note || '';
  return partner;
}
function syncClientFromPartner(p) {
  if (!p || !_isCustomerPartner(p)) return null;
  let client = clients.find(c => c.id === p.id);
  if (!client) {
    client = { id:p.id, date:today(), closed:false };
    clients.push(client);
  }
  client.name = p.name || client.name || '미지정 고객사';
  client.manager = p.manager || '';
  client.tel = p.tel || p.mobile || '';
  client.email = p.email || '';
  client.bizNo = p.bizNo || '';
  client.note = p.note || '';
  return client;
}
function _applyClientIdMap(list, map) {
  if (!Array.isArray(list)) return false;
  let changed = false;
  list.forEach(item => {
    if (!item) return;
    if (item.clientId && map[item.clientId]) { item.clientId = map[item.clientId]; changed = true; }
    if (!item.clientId && item.clientName) {
      const c = ensureCustomerClient({ name:item.clientName, email:item.clientEmail, bizNo:item.clientBizNo, note:'미등록 고객사 자동 이관' });
      item.clientId = c.id;
      changed = true;
    }
    if (item.clientName) { item.clientName = ''; changed = true; }
  });
  return changed;
}
function _markClientMasterMigrationPending(keys) {
  const clean = Array.from(new Set((keys || []).filter(Boolean)));
  if (!clean.length) return;
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem('mes_clientMasterMigrationPending') || '[]'); } catch(e) {}
  localStorage.setItem('mes_clientMasterMigrationPending', JSON.stringify(Array.from(new Set(pending.concat(clean)))));
}
function flushClientMasterMigrationSync() {
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem('mes_clientMasterMigrationPending') || '[]'); } catch(e) {}
  pending = Array.from(new Set((pending || []).filter(Boolean)));
  if (!pending.length || typeof cloudQueueSave !== 'function') return;
  pending.forEach(key => cloudQueueSave(key));
  localStorage.removeItem('mes_clientMasterMigrationPending');
}
function migrateClientMasterToPartners() {
  const beforePartnersJson = JSON.stringify(partners);
  let partnersChanged = false, clientsChanged = false;
  const idMap = {};
  const originalClients = clients.slice();
  originalClients.forEach(c => {
    const ensured = ensureCustomerClient(c);
    if (c.id && c.id !== ensured.id) idMap[c.id] = ensured.id;
  });
  partners.filter(_isCustomerPartner).forEach(p => ensureCustomerClient(p));

  const merged = new Map();
  clients.forEach(c => {
    if (!c || !c.id || !String(c.id).startsWith('BP-')) return;
    const existing = merged.get(c.id);
    if (!existing) { merged.set(c.id, Object.assign({}, c)); return; }
    _mergeMissing(existing, c, [['name'], ['manager'], ['tel'], ['email'], ['bizNo'], ['date'], ['note']]);
    existing.closed = !!(existing.closed && c.closed);
    if (!existing.closedAt && c.closedAt) existing.closedAt = c.closedAt;
  });
  const nextClients = Array.from(merged.values());
  if (JSON.stringify(clients) !== JSON.stringify(nextClients)) {
    clients = nextClients;
    clientsChanged = true;
  }

  const mappings = [
    ['products', products],
    ['workOrders', workOrders],
    ['claims', claims],
    ['checkRecords', checkRecords],
    ['deliveries', deliveries],
    ['rfqList', rfqList],
    ['poList', poList],
    ['statementList', statementList],
    ['taxList', taxList],
    ['quoteList', quoteList],
    ['orderList', orderList],
    ['asList', asList]
  ];
  const changedKeys = [];
  mappings.forEach(([key, list]) => { if (_applyClientIdMap(list, idMap)) changedKeys.push(key); });
  partners.forEach(p => { if (p && p.type === '구매처') { p.type = '고객사'; partnersChanged = true; } });
  if (!partnersChanged && beforePartnersJson !== JSON.stringify(partners)) partnersChanged = true;
  if (Object.keys(idMap).length) localStorage.setItem('mes_clientPartnerIdMap', JSON.stringify(idMap));
  const migrationKeys = [];
  if (partnersChanged || Object.keys(idMap).length) { saveStorage('partners', partners); migrationKeys.push('partners'); }
  if (clientsChanged || Object.keys(idMap).length) { saveStorage('clients', clients); migrationKeys.push('clients'); }
  changedKeys.forEach(key => saveStorage(key, ({
    products, workOrders, claims, checkRecords, deliveries, rfqList, poList,
    statementList, taxList, quoteList, orderList, asList
  })[key]));
  _markClientMasterMigrationPending(migrationKeys.concat(changedKeys));
}
migrateClientMasterToPartners();

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
function logInventoryMove(invId, type, qty, reason, refId, options = {}) {
  const actor = getCurrentActor();
  const entry = {
    id: 'ILG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    invId,
    type,
    qty: Number(qty),
    reason: reason || '',
    refId: refId || '',
    date: today(),
    beforeQty: options.beforeQty ?? '',
    afterQty: options.afterQty ?? '',
    actorUserId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    createdAt: new Date().toISOString()
  };
  inventoryLedger.unshift(entry);
  saveStorage('inventoryLedger', inventoryLedger);
  writeAuditLog('inventoryMove', entry.id, 'update', null, entry, {
    summary: `재고 ${type}`,
    changes: [
      { field:'invId', before:'', after:invId },
      { field:'qty', before:options.beforeQty ?? '', after:options.afterQty ?? entry.qty }
    ],
    reason: reason || '',
    detail: `${invId} · ${type} · ${entry.qty}`
  });
}

function migrateAccessControlFields() {
  const batches = [
    ['clients', clients, 'clients'],
    ['products', products, 'products'],
    ['partners', partners, 'partners'],
    ['materials', materials, 'material'],
    ['workOrders', workOrders, 'workOrder'],
    ['defects', defects, 'defect'],
    ['claims', claims, 'claim'],
    ['checkRecords', checkRecords, 'checkRecord'],
    ['inventory', inventory, 'inventory'],
    ['workers', workers, 'worker'],
    ['deliveries', deliveries, 'delivery'],
    ['rfqList', rfqList, 'rfq'],
    ['poList', poList, 'po'],
    ['statementList', statementList, 'statement'],
    ['taxList', taxList, 'tax'],
    ['quoteList', quoteList, 'quote'],
    ['orderList', orderList, 'order'],
    ['asList', asList, 'as'],
    ['bomList', bomList, 'bom']
  ];
  batches.forEach(([key, list, entityType]) => {
    if (migrateRecordAccessFields(list, entityType, { visibility:'company' })) saveStorage(key, list);
  });
  let financeChanged = false;
  if (financeData && typeof financeData === 'object') {
    financeChanged = migrateRecordAccessFields(financeData.entries || [], 'financeEntry', { visibility:'company' }) || financeChanged;
    financeChanged = migrateRecordAccessFields(financeData.paymentRequests || [], 'paymentRequest', { visibility:'company' }) || financeChanged;
    financeChanged = migrateRecordAccessFields(financeData.fixedCosts || [], 'fixedCost', { visibility:'company' }) || financeChanged;
    financeChanged = migrateRecordAccessFields(financeData.fixedCostPayments || [], 'fixedCostPayment', { visibility:'company' }) || financeChanged;
    if (financeChanged) saveStorage('financeData', financeData);
  }
}

migrateAccessControlFields();
