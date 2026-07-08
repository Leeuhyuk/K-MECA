/* ════════ 시스템 관리: 백업/내보내기 허브 ════════ */
const BACKUP_EXPORT_SELECTION_KEY = 'backupExportSelectedKeys';
const DOCUMENT_EXPORT_SELECTION_KEY = 'documentExportSelectedTypes';

const BACKUP_EXPORT_ITEMS = [
  { key:'clients', label:'고객사', group:'기초 데이터' },
  { key:'partners', label:'거래처', group:'기초 데이터' },
  { key:'products', label:'제품', group:'기초 데이터' },
  { key:'materials', label:'자재', group:'기초 데이터' },
  { key:'bomList', label:'BOM/자재명세', group:'기초 데이터' },
  { key:'inventory', label:'재고', group:'재고/물류' },
  { key:'inventoryLedger', label:'입출고 이력', group:'재고/물류' },
  { key:'deliveries', label:'납품 현황', group:'재고/물류' },
  { key:'workOrders', label:'생산지시', group:'생산/품질' },
  { key:'stages', label:'공정 단계', group:'생산/품질' },
  { key:'defects', label:'불량 기록', group:'생산/품질' },
  { key:'claims', label:'고객 클레임', group:'생산/품질' },
  { key:'checkRecords', label:'검사 기록', group:'생산/품질' },
  { key:'asList', label:'고객 A/S', group:'생산/품질' },
  { key:'rfqList', label:'견적요청서', group:'문서' },
  { key:'poList', label:'구매발주서', group:'문서' },
  { key:'quoteList', label:'견적서', group:'문서' },
  { key:'orderList', label:'수주서', group:'문서' },
  { key:'statementList', label:'거래명세표', group:'문서' },
  { key:'taxList', label:'세금계산서', group:'문서' },
  { key:'memoList', label:'메모/할 일', group:'업무 기록' },
  { key:'todoList', label:'할 일', group:'업무 기록' },
  { key:'memoAttachmentData', label:'메모 첨부파일', group:'업무 기록', heavy:true },
  { key:'emailSendHistory', label:'이메일 발송 이력', group:'업무 기록' },
  { key:'auditLog', label:'변경 이력', group:'업무 기록', heavy:true },
  { key:'alerts', label:'알림', group:'업무 기록' },
  { key:'trash', label:'휴지통', group:'업무 기록', heavy:true },
  { key:'workers', label:'작업자/직원', group:'인사/재무' },
  { key:'attendance', label:'근태', group:'인사/재무' },
  { key:'leaves', label:'휴가', group:'인사/재무' },
  { key:'payrollRecords', label:'급여 기록', group:'인사/재무' },
  { key:'financeData', label:'재무 데이터', group:'인사/재무' },
  { key:'rolePages', label:'역할별 접근 페이지', group:'권한/보안' },
  { key:'roleColumns', label:'역할별 표시 컬럼', group:'권한/보안' },
  { key:'roleFeatures', label:'역할별 기능 권한', group:'권한/보안' },
  { key:'roleDataScope', label:'역할별 데이터 범위', group:'권한/보안' },
  { key:'cloudUsers_cache', label:'클라우드 사용자 캐시', group:'권한/보안' },
  { key:'companyInfo', label:'회사 정보', group:'설정' },
  { key:'firebaseConfig', label:'Firebase 설정', group:'설정' },
  { key:'geminiConfig', label:'Gemini 설정', group:'설정' },
  { key:'emailjsConfig', label:'이메일 설정', group:'설정' },
  { key:'alertSettings', label:'알림 설정', group:'설정' },
  { key:'dismissedAlerts', label:'닫은 알림 기록', group:'설정' },
  { key:'docXlsxTemplates', label:'문서 양식', group:'설정' },
  { key:'docTemplatePackageBackup', label:'양식 패키지 백업', group:'설정' },
  { key:'docTemplatePackageMeta', label:'양식 패키지 정보', group:'설정' },
  { key:'driveOAuthSettings', label:'Drive OAuth ID', group:'설정' },
  { key:'googleDriveConfig', label:'Google Drive 설정', group:'설정' },
  { key:'alimtalkSettings', label:'알림톡 설정', group:'설정' },
  { key:'tableDisplayConfig', label:'표시 설정', group:'설정' },
  { key:'tableDisplayActive', label:'현재 표시 설정 탭', group:'설정' },
  { key:'uiBrandSettings', label:'로고/명칭', group:'설정' },
  { key:'uiScale', label:'화면 밀도', group:'설정' },
  { key:'uiFontScale', label:'글자 크기', group:'설정' },
  { key:'menuIconSize', label:'메뉴 아이콘', group:'설정' },
  { key:'tableGridLines', label:'테이블 선', group:'설정' },
  { key:'uiColors', label:'화면 색상', group:'설정' },
  { key:'theme', label:'테마', group:'설정' },
  { key:'dateViewState', label:'날짜 조회 상태', group:'사용자 환경' },
  { key:'bomRecentProducts', label:'BOM 최근 제품', group:'사용자 환경' },
  { key:'clientMasterMigrationPending', label:'거래처 이관 대기', group:'사용자 환경' },
  { key:'clientPartnerIdMap', label:'거래처 연결 맵', group:'사용자 환경' },
  { key:'myEmail', label:'내 이메일', group:'사용자 환경' },
  { key:'myName', label:'내 이름', group:'사용자 환경' },
  { key:'myRole', label:'내 역할', group:'사용자 환경' },
  { key:'myActive', label:'내 계정 활성 상태', group:'사용자 환경' },
  { key:'enableCloudOnLocal', label:'로컬 클라우드 사용 여부', group:'사용자 환경' },
  { key:'backupExportSelectedKeys', label:'백업 선택 상태', group:'사용자 환경' },
  { key:'documentExportSelectedTypes', label:'문서 출력 선택 상태', group:'사용자 환경' }
];

const DOCUMENT_EXPORT_ITEMS = [
  { type:'rfq', label:'견적요청서', excel:()=>exportRfqXLS(), pdf:()=>openRfqPrint(null), drive:()=>saveDocumentBundleToGoogleDrive('rfq', null) },
  { type:'po', label:'구매발주서', excel:()=>exportPoXLS(), pdf:()=>openPoPrint(null), drive:()=>saveDocumentBundleToGoogleDrive('po', null) },
  { type:'statement', label:'거래명세표', excel:()=>exportSalesDocCSV('statement'), pdf:()=>openSalesDocPrint('statement', null), drive:()=>saveDocumentBundleToGoogleDrive('statement', null) },
  { type:'tax', label:'세금계산서', excel:()=>exportSalesDocCSV('tax'), pdf:()=>openSalesDocPrint('tax', null), drive:()=>saveDocumentBundleToGoogleDrive('tax', null) },
  { type:'quote', label:'견적서', excel:()=>exportSODocCSV('quote'), pdf:()=>openSODocPrint('quote', null), drive:()=>saveDocumentBundleToGoogleDrive('quote', null) },
  { type:'order', label:'수주서', excel:()=>exportSODocCSV('order'), pdf:()=>openSODocPrint('order', null), drive:()=>saveDocumentBundleToGoogleDrive('order', null) }
];

function backupExportEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function backupExportKnownKeys() {
  const fromDataKeys = typeof allDataBackupKeys === 'function'
    ? allDataBackupKeys()
    : (Array.isArray(window.DATA_KEYS) ? window.DATA_KEYS : (typeof DATA_KEYS !== 'undefined' ? DATA_KEYS : []));
  const ordered = new Map();
  BACKUP_EXPORT_ITEMS.forEach(item => ordered.set(item.key, item));
  fromDataKeys.forEach(key => {
    if (!ordered.has(key)) ordered.set(key, { key, label:key, group:'기타' });
  });
  backupExportLocalStorageKeys().forEach(key => {
    if (!ordered.has(key)) ordered.set(key, {
      key,
      label:backupExportAutoLabel(key),
      group:backupExportAutoGroup(key)
    });
  });
  return Array.from(ordered.values());
}

function backupExportLocalStorageKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (!fullKey || !fullKey.startsWith('mes_')) continue;
      const key = fullKey.slice(4);
      if (!key || key === '_savedAt') continue;
      keys.push(key);
    }
  } catch(e) {}
  return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
}

function backupExportAutoGroup(key) {
  if (/^(role|cloudUsers|my)/.test(key)) return '권한/보안';
  if (/finance|payroll|attendance|leave|worker/i.test(key)) return '인사/재무';
  if (/partner|client/i.test(key)) return '기초 데이터';
  if (/config|settings|theme|ui|table|template|drive|firebase|gemini|emailjs|alimtalk|alert/i.test(key)) return '설정';
  if (/cloud|tombstone|Ver/i.test(key)) return '클라우드/동기화';
  return '추가 저장 항목';
}

function backupExportAutoLabel(key) {
  const spaced = String(key || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced || key;
}

function backupExportDefaultKeys() {
  return backupExportKnownKeys().map(item => item.key);
}

function backupExportLoadKeys() {
  return backupExportDefaultKeys();
}

function backupExportSaveKeys(keys) {
  saveStorage(BACKUP_EXPORT_SELECTION_KEY, backupExportDefaultKeys());
  renderBackupExportSettings();
}

function documentExportLoadTypes() {
  const defaults = DOCUMENT_EXPORT_ITEMS.map(item => item.type);
  const saved = loadStorage(DOCUMENT_EXPORT_SELECTION_KEY, null);
  if (!Array.isArray(saved) || !saved.length) return defaults;
  const valid = new Set(defaults);
  const filtered = saved.filter(type => valid.has(type));
  return filtered.length ? filtered : defaults;
}

function documentExportSaveTypes(types) {
  const valid = new Set(DOCUMENT_EXPORT_ITEMS.map(item => item.type));
  const next = Array.from(new Set((types || []).filter(type => valid.has(type))));
  saveStorage(DOCUMENT_EXPORT_SELECTION_KEY, next);
  renderBackupExportSettings();
}

function backupExportCountValue(key) {
  const raw = localStorage.getItem('mes_' + key);
  if (raw == null) return '없음';
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.length + '건';
    if (data && typeof data === 'object') return Object.keys(data).length + '개';
    return '1개';
  } catch (e) {
    return '손상';
  }
}

function backupExportPayload(keys) {
  const out = {
    _savedAt: new Date().toISOString(),
    _selectedKeys: keys.slice(),
    _rawStringKeys: []
  };
  keys.forEach(key => {
    const raw = localStorage.getItem('mes_' + key);
    if (raw != null) {
      try { out[key] = JSON.parse(raw); }
      catch(e) {
        out[key] = raw;
        out._rawStringKeys.push(key);
      }
    }
  });
  return out;
}

function backupExportFileStamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('') + '-' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
}

function backupExportDownloadBlob(blob, fileName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function backupExportSelectedJson() {
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 JSON 내보내기')) return;
  const keys = backupExportLoadKeys();
  if (!keys.length) { showToast('선택된 데이터 항목이 없습니다.', 'error'); return; }
  const payload = backupExportPayload(keys);
  backupExportDownloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }),
    'mes-selected-data-' + backupExportFileStamp() + '.json'
  );
  showToast('전체 데이터 JSON 저장 완료', 'success');
}

function backupExportRowsForSheet(value) {
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return value.map(row => row && typeof row === 'object' && !Array.isArray(row) ? row : { value: row });
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).map(key => {
      const item = value[key];
      if (item && typeof item === 'object' && !Array.isArray(item)) return Object.assign({ key }, item);
      return { key, value: item };
    });
  }
  return [{ value }];
}

function backupExportSelectedXls() {
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 엑셀 내보내기')) return;
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.', 'error');
    return;
  }
  const keys = backupExportLoadKeys();
  if (!keys.length) { showToast('선택된 데이터 항목이 없습니다.', 'error'); return; }
  const labels = new Map(backupExportKnownKeys().map(item => [item.key, item.label]));
  const wb = XLSX.utils.book_new();
  keys.forEach((key, index) => {
    const raw = localStorage.getItem('mes_' + key);
    let value = null;
    if (raw != null) {
      try { value = JSON.parse(raw); } catch(e) { value = { error:'JSON 파싱 실패' }; }
    }
    const rows = backupExportRowsForSheet(value);
    const sheet = rows.length
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([['데이터 없음']]);
    const base = String(labels.get(key) || key).replace(/[\\/?*[\]:]/g, ' ').slice(0, 26) || ('sheet' + index);
    XLSX.utils.book_append_sheet(wb, sheet, (index + 1 + '-' + base).slice(0, 31));
  });
  XLSX.writeFile(wb, 'mes-selected-data-' + backupExportFileStamp() + '.xlsx');
  showToast('전체 데이터 엑셀 저장 완료', 'success');
}

async function backupExportSelectedDrive() {
  if (typeof requireAdminAction === 'function' && !requireAdminAction('전체 데이터 Google Drive 백업')) return;
  if (typeof uploadBlobToGoogleDrive !== 'function') {
    showToast('Google Drive 모듈이 준비되지 않았습니다.', 'error');
    return;
  }
  const keys = backupExportLoadKeys();
  if (!keys.length) { showToast('선택된 데이터 항목이 없습니다.', 'error'); return; }
  const button = inp('backup-export-drive-btn');
  if (button) { button.disabled = true; button.innerHTML = '<i class="ti ti-loader animate-spin"></i>Drive 저장 중'; }
  try {
    await requestDriveAccessToken('');
    const fileName = 'mes-selected-data-' + backupExportFileStamp() + '.json';
    const payload = JSON.stringify(backupExportPayload(keys), null, 2);
    const file = await uploadBlobToGoogleDrive(new Blob([payload], { type:'application/json' }), fileName, 'Backups');
    const config = typeof getDriveConfig === 'function' ? getDriveConfig() : null;
    if (config) {
      config.lastBackupAt = new Date().toISOString();
      saveDriveConfig(config);
    }
    showToast(file.name + ' Drive 백업 완료', 'success');
    if (typeof loadGoogleDriveBackups === 'function') await loadGoogleDriveBackups();
  } catch (error) {
    showToast(error.message || 'Google Drive 백업에 실패했습니다.', 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-brand-google-drive"></i>Drive 저장'; }
  }
}

function backupExportApplyPreset(preset) {
  backupExportSaveKeys(backupExportDefaultKeys());
}

function backupExportToggleAll(checked) {
  backupExportSaveKeys(backupExportDefaultKeys());
}

function backupExportToggleKey(key, checked) {
  backupExportSaveKeys(backupExportDefaultKeys());
}

function documentExportToggleAll(checked) {
  documentExportSaveTypes(checked ? DOCUMENT_EXPORT_ITEMS.map(item => item.type) : []);
}

function documentExportToggleType(type, checked) {
  const current = new Set(documentExportLoadTypes());
  if (checked) current.add(type);
  else current.delete(type);
  documentExportSaveTypes([...current]);
}

function documentExportSelectedItems() {
  const selected = new Set(documentExportLoadTypes());
  return DOCUMENT_EXPORT_ITEMS.filter(item => selected.has(item.type));
}

async function documentExportRun(kind) {
  const items = documentExportSelectedItems();
  if (!items.length) { showToast('선택된 문서 종류가 없습니다.', 'error'); return; }
  if (kind === 'pdf' && items.length > 1) {
    showToast('PDF 출력은 브라우저 팝업 제한을 피하기 위해 문서 종류를 하나씩 선택해 실행해주세요.', 'info');
    return;
  }
  const actionName = kind === 'excel' ? '문서 엑셀 저장' : (kind === 'pdf' ? '문서 PDF 출력' : '문서 Drive 저장');
  if (kind === 'excel' && typeof requireCsvAction === 'function' && !requireCsvAction(actionName)) return;
  if (kind === 'pdf' && typeof requirePdfAction === 'function' && !requirePdfAction(actionName)) return;
  for (const item of items) {
    const fn = item[kind];
    if (typeof fn === 'function') await fn();
  }
}

function renderBackupExportSettings() {
  const body = inp('backup-export-body');
  if (!body) return;
  const selected = new Set(backupExportLoadKeys());
  const selectedDocs = new Set(documentExportLoadTypes());
  const items = backupExportKnownKeys();
  const grouped = items.reduce((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {});
  const groupHtml = Object.entries(grouped).map(([group, groupItems]) => `
    <div class="backup-export-group">
      <div class="backup-export-group-title">${backupExportEsc(group)}</div>
      <div class="backup-export-grid">
        ${groupItems.map(item => `
          <label class="backup-export-check backup-export-check-locked">
            <input type="checkbox" checked disabled>
            <span>
              <strong>${backupExportEsc(item.label)}</strong>
              <small>${backupExportEsc(item.key)} · ${backupExportEsc(backupExportCountValue(item.key))}</small>
            </span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  body.innerHTML = `
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-database-export"></i>데이터 백업/내보내기</span>
        <span style="font-size:11px;color:var(--tx-t);">모든 MES 저장 항목을 JSON, 엑셀, Google Drive로 저장</span>
      </div>
      <div class="backup-export-actions">
        <span class="backup-export-fixed-note"><i class="ti ti-lock-check"></i> 데이터 백업은 전체 항목 고정</span>
        <span class="backup-export-count">${items.length} / ${items.length}개 포함</span>
      </div>
      <div class="backup-export-actions">
        <button class="btn btn-primary" onclick="backupExportSelectedJson()"><i class="ti ti-file-type-json"></i>JSON 저장</button>
        <button class="btn" onclick="backupExportSelectedXls()"><i class="ti ti-file-spreadsheet"></i>엑셀 저장</button>
        <button class="btn drive-save-btn" id="backup-export-drive-btn" onclick="backupExportSelectedDrive()"><i class="ti ti-brand-google-drive"></i>Drive 저장</button>
      </div>
      ${groupHtml}
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-file-export"></i>문서 출력/Drive</span>
        <span style="font-size:11px;color:var(--tx-t);">업무 문서의 전체 엑셀, PDF, PDF/XLSX Drive 저장을 한 곳에서 실행</span>
      </div>
      <div class="backup-export-docs">
        ${DOCUMENT_EXPORT_ITEMS.map(item => `
          <label class="backup-export-doc">
            <input type="checkbox" ${selectedDocs.has(item.type) ? 'checked' : ''} onchange="documentExportToggleType('${item.type}',this.checked)">
            <span>${backupExportEsc(item.label)}</span>
          </label>
        `).join('')}
      </div>
      <div class="backup-export-actions">
        <button class="btn btn-primary" onclick="documentExportRun('excel')"><i class="ti ti-file-spreadsheet"></i>선택 문서 엑셀</button>
        <button class="btn" onclick="documentExportRun('pdf')"><i class="ti ti-printer"></i>선택 문서 PDF</button>
        <button class="btn drive-save-btn" onclick="documentExportRun('drive')"><i class="ti ti-brand-google-drive"></i>선택 문서 Drive 저장</button>
        <button class="btn btn-sm" onclick="documentExportToggleAll(true)"><i class="ti ti-square-check"></i>모두 선택</button>
        <button class="btn btn-sm" onclick="documentExportToggleAll(false)"><i class="ti ti-square"></i>전체 해제</button>
      </div>
      <div style="font-size:11.5px;color:var(--tx-t);line-height:1.7;margin-top:8px;">
        PDF 출력은 브라우저 팝업 제한 때문에 한 종류씩 실행하는 방식이 안정적입니다. Drive 저장은 기존 PDF/XLSX 묶음 저장 양식을 그대로 사용합니다.
      </div>
    </div>
  `;
}
