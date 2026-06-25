/* ════════ Google Drive 백업 연동 ════════ */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'MESPro';
const DRIVE_OAUTH_SETTINGS_KEY = 'driveOAuthSettings';
let _driveTokenClient = null;
let _driveAccessToken = '';
let _driveTokenExpiresAt = 0;
let _driveBackups = [];
let _driveAutoBackupTimer = null;
let _driveAutoConnectAttempted = false;

function getDriveConfig() {
  const defaults = {
    clientId: '',
    folderId: '',
    folderUrl: '',
    connectedEmail: '',
    lastBackupAt: '',
    autoConnectEnabled: true,
    autoBackupEnabled: false,
    autoBackupHours: 24
  };
  const localConfig = loadStorage('googleDriveConfig', defaults) || {};
  const sharedOAuth = loadStorage(DRIVE_OAUTH_SETTINGS_KEY, {}) || {};
  return Object.assign({}, defaults, localConfig, {
    clientId: localConfig.clientId || sharedOAuth.clientId || ''
  });
}

function saveDriveConfig(config) {
  const nextConfig = config || {};
  try {
    localStorage.setItem('mes_googleDriveConfig', JSON.stringify(nextConfig));
  } catch(e) {
    if (typeof showToast === 'function') showToast('Google Drive 설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.', 'error');
    console.error('Google Drive 설정 저장 실패:', e);
  }
}

function saveDriveOAuthSettings(config) {
  const clientId = String(config && config.clientId || '').trim();
  if (!clientId) return;
  const shared = Object.assign({}, loadStorage(DRIVE_OAUTH_SETTINGS_KEY, {}) || {}, {
    clientId,
    updatedAt: new Date().toISOString()
  });
  if (typeof saveStorage === 'function') saveStorage(DRIVE_OAUTH_SETTINGS_KEY, shared);
  else localStorage.setItem('mes_' + DRIVE_OAUTH_SETTINGS_KEY, JSON.stringify(shared));
}

function getGoogleDriveConfig() {
  return getDriveConfig();
}

function isDriveTokenActive(bufferMs = 60000) {
  return !!(_driveAccessToken && Date.now() < _driveTokenExpiresAt - bufferMs);
}

function _driveEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _driveHostedOriginAvailable() {
  return location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
}

function getDriveCurrentOrigin() {
  return location.protocol === 'file:' ? '' : location.origin;
}

async function copyDriveCurrentOrigin() {
  const origin = getDriveCurrentOrigin();
  if (!origin) {
    showToast('file:// 실행 주소는 OAuth 원본으로 등록할 수 없습니다.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(origin);
    showToast('현재 JavaScript 원본을 복사했습니다: ' + origin, 'success');
  } catch (error) {
    const field = inp('drive-current-origin');
    if (field) { field.focus(); field.select(); }
    showToast('주소를 선택했습니다. Ctrl+C로 복사하세요.', 'info');
  }
}

function loadGoogleIdentityServices() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mes-google-identity]');
    if (existing) {
      existing.addEventListener('load', resolve, { once:true });
      existing.addEventListener('error', () => reject(new Error('Google 인증 라이브러리를 불러오지 못했습니다.')), { once:true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.mesGoogleIdentity = '1';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google 인증 라이브러리를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
}

async function requestDriveAccessToken(promptMode) {
  const config = getDriveConfig();
  if (!config.clientId) throw new Error('Google OAuth 클라이언트 ID를 먼저 저장하세요.');
  if (!_driveHostedOriginAvailable()) {
    throw new Error('Google Drive 연결은 HTTPS 주소 또는 localhost에서 실행해야 합니다. file://로 연 index.html에서는 OAuth 연결을 사용할 수 없습니다.');
  }
  if (isDriveTokenActive()) return _driveAccessToken;
  await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    _driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response && response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        _driveAccessToken = response.access_token || '';
        _driveTokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
        resolve(_driveAccessToken);
      },
      error_callback: error => reject(new Error((error && error.message) || 'Google 계정 연결이 취소되었습니다.'))
    });
    _driveTokenClient.requestAccessToken({ prompt: promptMode || '' });
  });
}

async function driveApi(path, options) {
  const token = await requestDriveAccessToken('');
  const response = await fetch('https://www.googleapis.com' + path, Object.assign({}, options || {}, {
    headers: Object.assign({}, (options && options.headers) || {}, { Authorization: 'Bearer ' + token })
  }));
  if (response.status === 401) {
    _driveAccessToken = '';
    _driveTokenExpiresAt = 0;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data.error && data.error.message) || ('Google Drive 오류 (' + response.status + ')'));
  }
  if (response.status === 204) return null;
  return response.json();
}

async function ensureDriveBackupFolder() {
  const config = getDriveConfig();
  if (config.folderId) {
    try {
      const folder = await driveApi('/drive/v3/files/' + encodeURIComponent(config.folderId) + '?fields=id,name,webViewLink,trashed');
      if (folder && folder.id && !folder.trashed) return folder;
    } catch (error) {
      config.folderId = '';
      config.folderUrl = '';
    }
  }
  const query = encodeURIComponent(
    "name='" + DRIVE_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  );
  const found = await driveApi('/drive/v3/files?q=' + query + '&spaces=drive&fields=files(id,name,webViewLink)&pageSize=1');
  let folder = found.files && found.files[0];
  if (!folder) {
    folder = await driveApi('/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
  }
  config.folderId = folder.id;
  config.folderUrl = folder.webViewLink || ('https://drive.google.com/drive/folders/' + folder.id);
  saveDriveConfig(config);
  return folder;
}

async function ensureDriveSubfolder(name, parentId) {
  const safeName = String(name || '').replace(/'/g, "\\'");
  const query = encodeURIComponent(
    "name='" + safeName + "' and '" + parentId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
  );
  const found = await driveApi('/drive/v3/files?q=' + query + '&spaces=drive&fields=files(id,name,webViewLink)&pageSize=1');
  if (found.files && found.files[0]) return found.files[0];
  return driveApi('/drive/v3/files?fields=id,name,webViewLink', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]})
  });
}

async function uploadBlobToGoogleDrive(blob, fileName, folderName) {
  const root = await ensureDriveBackupFolder();
  const folder = folderName ? await ensureDriveSubfolder(folderName, root.id) : root;
  const metadata = { name:fileName, parents:[folder.id], mimeType:blob.type || 'application/octet-stream' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], {type:'application/json'}));
  form.append('file', blob, fileName);
  return driveApi('/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime,webViewLink,mimeType', {
    method:'POST',
    body:form
  });
}

async function connectGoogleDrive() {
  try {
    const config = getDriveConfig();
    saveDriveOAuthSettings(config);
    const promptMode = (config.connectedEmail || config.folderId) ? 'select_account' : 'consent';
    await requestDriveAccessToken(promptMode);
    await ensureDriveBackupFolder();
    const connectedConfig = getDriveConfig();
    connectedConfig.autoConnectEnabled = true;
    saveDriveConfig(connectedConfig);
    try {
      const about = await driveApi('/drive/v3/about?fields=user(displayName,emailAddress)');
      const config = getDriveConfig();
      config.connectedEmail = about && about.user
        ? (about.user.emailAddress || about.user.displayName || '')
        : '';
      saveDriveConfig(config);
    } catch (error) {}
    showToast('Google Drive 연결이 완료되었습니다.', 'success');
    scheduleGoogleDriveAutoBackup();
    await renderGoogleDriveSettings();
  } catch (error) {
    showToast(error.message || 'Google Drive 연결에 실패했습니다.', 'error');
  }
}

async function autoConnectGoogleDriveAfterLogin() {
  if (_driveAutoConnectAttempted || _driveAccessToken) return;
  const config = getDriveConfig();
  if (!config.autoConnectEnabled || !config.clientId || !_driveHostedOriginAvailable()) return;
  saveDriveOAuthSettings(config);
  _driveAutoConnectAttempted = true;
  try {
    await requestDriveAccessToken('');
    await ensureDriveBackupFolder();
    scheduleGoogleDriveAutoBackup();
    if (currentPage === 'system' && systemTab === 'drive') renderGoogleDriveSettings();
  } catch (error) {
    console.info('Google Drive 자동 연결 대기:', error && error.message ? error.message : error);
  }
}

function disconnectGoogleDrive() {
  if (_driveAccessToken && window.google && google.accounts && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(_driveAccessToken, () => {});
  }
  _driveAccessToken = '';
  _driveTokenExpiresAt = 0;
  _driveBackups = [];
  _driveAutoConnectAttempted = false;
  if (_driveAutoBackupTimer) clearInterval(_driveAutoBackupTimer);
  const config = getDriveConfig();
  config.folderId = '';
  config.folderUrl = '';
  config.connectedEmail = '';
  config.autoConnectEnabled = false;
  saveDriveConfig(config);
  renderGoogleDriveSettings();
  showToast('Google Drive 연결 정보를 해제했습니다.', 'info');
}

function saveGoogleDriveSettings() {
  const config = getDriveConfig();
  config.clientId = v('drive-client-id').trim();
  config.autoConnectEnabled = !!(inp('drive-auto-connect') && inp('drive-auto-connect').checked);
  config.autoBackupEnabled = !!(inp('drive-auto-enabled') && inp('drive-auto-enabled').checked);
  config.autoBackupHours = Math.max(1, Number(v('drive-auto-hours')) || 24);
  saveDriveConfig(config);
  saveDriveOAuthSettings(config);
  _driveAutoConnectAttempted = false;
  scheduleGoogleDriveAutoBackup();
  showToast('Google Drive OAuth 설정을 저장했습니다.', 'success');
  renderGoogleDriveSettings();
  if (config.autoConnectEnabled && !_driveAccessToken) {
    setTimeout(autoConnectGoogleDriveAfterLogin, 200);
  }
}

function _driveBackupName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('') + '-' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return 'mes-data-' + stamp + '.json';
}

async function backupDataToGoogleDrive() {
  const button = inp('drive-backup-btn');
  if (button) { button.disabled = true; button.innerHTML = '<i class="ti ti-loader animate-spin"></i>백업 중'; }
  try {
    const name = _driveBackupName();
    const payload = JSON.stringify(buildDataBackupPayload(), null, 2);
    const file = await uploadBlobToGoogleDrive(
      new Blob([payload], {type:'application/json'}),
      name,
      'Backups'
    );
    const config = getDriveConfig();
    config.lastBackupAt = new Date().toISOString();
    saveDriveConfig(config);
    showToast(file.name + ' Drive 백업 완료', 'success');
    await loadGoogleDriveBackups();
  } catch (error) {
    showToast(error.message || 'Google Drive 백업에 실패했습니다.', 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-cloud-upload"></i>지금 백업'; }
  }
}

function scheduleGoogleDriveAutoBackup() {
  if (_driveAutoBackupTimer) clearInterval(_driveAutoBackupTimer);
  if (!getDriveConfig().autoBackupEnabled) return;
  const check = async () => {
    if (!_driveAccessToken || Date.now() >= _driveTokenExpiresAt - 60000) return;
    const config = getDriveConfig();
    if (!config.autoBackupEnabled) return;
    const last = config.lastBackupAt ? new Date(config.lastBackupAt).getTime() : 0;
    const interval = Math.max(1, Number(config.autoBackupHours) || 24) * 3600000;
    if (!last || Date.now() - last >= interval) await backupDataToGoogleDrive();
  };
  _driveAutoBackupTimer = setInterval(check, 10 * 60000);
  setTimeout(check, 1500);
}

function _driveWithSingleDocument(type, id, callback) {
  if (!id || Array.isArray(id)) return callback();
  let original;
  if (type === 'statement') {
    original = statementList;
    statementList = statementList.filter(item=>item.id === id);
  } else if (type === 'tax') {
    original = taxList;
    taxList = taxList.filter(item=>item.id === id);
  } else if (type === 'quote') {
    original = quoteList;
    quoteList = quoteList.filter(item=>item.id === id);
  } else if (type === 'order') {
    original = orderList;
    orderList = orderList.filter(item=>item.id === id);
  } else {
    return callback();
  }
  try {
    return callback();
  } finally {
    if (type === 'statement') statementList = original;
    else if (type === 'tax') taxList = original;
    else if (type === 'quote') quoteList = original;
    else if (type === 'order') orderList = original;
  }
}

function _driveDocumentConfig(type) {
  const map = {
    rfq:{label:'견적요청서',print:id=>openRfqPrint(id),xlsx:id=>exportRfqXLS(id)},
    po:{label:'구매발주서',print:id=>openPoPrint(id, Array.isArray(id)),xlsx:id=>exportPoXLS(id)},
    statement:{label:'거래명세표',print:id=>openSalesDocPrint('statement',id),xlsx:id=>_driveWithSingleDocument('statement',id,()=>exportSalesDocCSV('statement'))},
    tax:{label:'세금계산서',print:id=>openSalesDocPrint('tax',id),xlsx:id=>_driveWithSingleDocument('tax',id,()=>exportSalesDocCSV('tax'))},
    quote:{label:'견적서',print:id=>openSODocPrint('quote',id),xlsx:id=>_driveWithSingleDocument('quote',id,()=>exportSODocCSV('quote'))},
    order:{label:'수주서',print:id=>openSODocPrint('order',id),xlsx:id=>_driveWithSingleDocument('order',id,()=>exportSODocCSV('order'))},
    payslip:{label:'급여명세서',print:id=>printPayslip(id),xlsx:id=>exportPayslipXLS(id)}
  };
  return map[type];
}

function captureDocumentPrintHtml(callback) {
  let html = '';
  const originalCapture = window._mesDocumentPrintCapture;
  const originalOpen = window.open;
  window._mesDocumentPrintCapture = value => { html += String(value || ''); };
  window.open = function() {
    return {
      document:{
        write:value=>{ html += String(value || ''); },
        close:()=>{}
      },
      print:()=>{}
    };
  };
  try { callback(); }
  finally {
    window._mesDocumentPrintCapture = originalCapture;
    window.open = originalOpen;
  }
  if (!html) throw new Error('문서 인쇄 내용을 생성하지 못했습니다.');
  return html;
}

async function createDocumentPdfBlobFromHtml(html) {
  if (typeof html2pdf === 'undefined') throw new Error('PDF 생성 라이브러리가 준비되지 않았습니다.');
  const pageWidth = 794;
  const pageHeight = 1123;
  const canvasHeight = pageHeight - 12;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:' + pageWidth + 'px;height:' + pageHeight + 'px;border:0;pointer-events:none;opacity:.01;z-index:0;';
  document.body.appendChild(frame);
  try {
    const frameDoc = frame.contentDocument;
    frameDoc.open();
    frameDoc.write(buildDocumentPdfPreviewHtml(html, '', {exportMode:true}));
    frameDoc.close();
    if (frameDoc.fonts && frameDoc.fonts.ready) await frameDoc.fonts.ready;
    const content = frameDoc.querySelector('.mes-print-sheet');
    if (!content) throw new Error('PDF 문서 영역을 생성하지 못했습니다.');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const pageElements = Array.from(content.children);
    const lastPage = pageElements[pageElements.length - 1];
    if (lastPage) {
      lastPage.style.pageBreakAfter = 'auto';
      lastPage.style.breakAfter = 'auto';
    }
    const outputHeight = fitDocumentPdfPages(content, pageWidth, canvasHeight) || canvasHeight;
    inlineDocumentPdfStyles(content);
    const canvasOptions = {
      scale:2,
      useCORS:true,
      logging:false,
      backgroundColor:'#ffffff',
      windowWidth:pageWidth,
      windowHeight:outputHeight,
      width:pageWidth,
      height:outputHeight,
      x:0,
      y:0,
      scrollX:0,
      scrollY:0
    };
    const JsPdf = window.jspdf && window.jspdf.jsPDF;
    if (typeof html2canvas !== 'undefined' && JsPdf) {
      const canvas = await html2canvas(content, canvasOptions);
      const pdf = new JsPdf({unit:'mm',format:'a4',orientation:'portrait'});
      const pdfWidth = 210;
      const pdfHeight = Math.min(297, (canvas.height * pdfWidth) / canvas.width);
      pdf.addImage(canvas.toDataURL('image/jpeg', .98), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    }
    return await createSinglePagePdfWithHtml2Pdf(content, {
      margin:[0,0,0,0],
      image:{type:'jpeg',quality:.98},
      html2canvas:canvasOptions,
      pagebreak:{mode:['css','legacy']},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    });
  } finally {
    frame.remove();
  }
}

async function createSinglePagePdfWithHtml2Pdf(content, options) {
  const worker = html2pdf().from(content).set(options).toPdf();
  const pdf = await worker.get('pdf');
  const pageCount = () => {
    if (typeof pdf.getNumberOfPages === 'function') return pdf.getNumberOfPages();
    if (pdf.internal && typeof pdf.internal.getNumberOfPages === 'function') return pdf.internal.getNumberOfPages();
    return 1;
  };
  while (pageCount() > 1 && typeof pdf.deletePage === 'function') {
    pdf.deletePage(pageCount());
  }
  return pdf.output('blob');
}

function fitDocumentPdfPages(content, pageWidth, pageHeight) {
  const doc = content.ownerDocument;
  const win = doc && doc.defaultView;
  if (!win || !win.getComputedStyle) return 0;
  const contentStyle = win.getComputedStyle(content);
  const paddingX =
    (parseFloat(contentStyle.paddingLeft) || 0) +
    (parseFloat(contentStyle.paddingRight) || 0);
  const paddingY =
    (parseFloat(contentStyle.paddingTop) || 0) +
    (parseFloat(contentStyle.paddingBottom) || 0);
  const availableWidth = pageWidth - paddingX;
  const availableHeight = pageHeight - paddingY;
  const pages = Array.from(content.children).filter(node => node && node.nodeType === 1);
  if (!pages.length) return 0;
  let totalInnerHeight = 0;
  pages.forEach((page, index) => {
    page.style.pageBreakAfter = 'auto';
    page.style.breakAfter = 'auto';
    page.style.marginBottom = '0';
    const rect = page.getBoundingClientRect();
    const naturalWidth = Math.max(1, rect.width || page.scrollWidth || availableWidth);
    const naturalHeight = Math.max(1, rect.height || page.scrollHeight || availableHeight);
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    const fittedHeight = Math.ceil(naturalHeight * scale);
    const wrapper = doc.createElement('div');
    wrapper.className = 'mes-print-page-fit';
    wrapper.style.width = availableWidth + 'px';
    wrapper.style.height = fittedHeight + 'px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.position = 'relative';
    wrapper.style.background = '#fff';
    wrapper.style.pageBreakInside = 'avoid';
    wrapper.style.breakInside = 'avoid';
    wrapper.style.pageBreakAfter = index < pages.length - 1 ? 'always' : 'auto';
    wrapper.style.breakAfter = index < pages.length - 1 ? 'page' : 'auto';
    page.parentNode.insertBefore(wrapper, page);
    wrapper.appendChild(page);
    page.style.width = naturalWidth + 'px';
    page.style.transformOrigin = 'top left';
    page.style.transform = 'scale(' + scale + ')';
    totalInnerHeight += fittedHeight;
  });
  const totalHeight = pages.length === 1
    ? pageHeight
    : Math.max(pageHeight, totalInnerHeight + paddingY);
  content.style.width = pageWidth + 'px';
  content.style.minHeight = totalHeight + 'px';
  content.style.height = totalHeight + 'px';
  content.style.maxHeight = totalHeight + 'px';
  content.style.overflow = 'hidden';
  if (pages.length === 1) {
    content.style.pageBreakAfter = 'auto';
    content.style.breakAfter = 'auto';
  }
  return totalHeight;
}

function inlineDocumentPdfStyles(root) {
  const win = root.ownerDocument && root.ownerDocument.defaultView;
  if (!win || !win.getComputedStyle) return;
  const props = [
    'box-sizing','display','position','float','clear','width','min-width','max-width','height','min-height','max-height',
    'margin','margin-top','margin-right','margin-bottom','margin-left',
    'padding','padding-top','padding-right','padding-bottom','padding-left',
    'border','border-top','border-right','border-bottom','border-left','border-collapse','border-spacing','border-radius',
    'background','background-color','box-shadow','color',
    'font','font-family','font-size','font-weight','font-style','line-height','letter-spacing',
    'text-align','text-decoration','vertical-align','white-space','word-break','overflow','overflow-wrap',
    'gap','column-gap','row-gap','justify-content','align-items','align-content','flex','flex-basis','flex-direction','flex-grow','flex-shrink','flex-wrap',
    'table-layout','object-fit','opacity','transform','transform-origin','page-break-after','page-break-inside','break-after','break-inside'
  ];
  const nodes = [root].concat(Array.from(root.querySelectorAll('*')));
  const styles = nodes.map(node => {
    const computed = win.getComputedStyle(node);
    return {
      node,
      pairs:props.map(prop => [prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop)])
    };
  });
  styles.forEach(({node, pairs}) => {
    pairs.forEach(([prop, value, priority]) => {
      if (value) node.style.setProperty(prop, value, priority || '');
    });
  });
}

function buildDocumentPdfPreviewHtml(html, title, options = {}) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const head = parsed.head.innerHTML;
  const body = parsed.body.innerHTML;
  const exportMode = !!options.exportMode;
  const showToolbar = !exportMode;
  const safeTitle = _driveEsc(title || '인쇄 미리보기');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
    <title>${safeTitle}</title>${head}
    <style>
      html{background:#292b2f;}
      body{margin:0!important;padding:76px 24px 36px!important;background:#292b2f!important;color:#111;}
      body.mes-print-export{width:794px!important;min-width:794px!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important;}
      .mes-print-toolbar{position:fixed;z-index:100;left:0;right:0;top:0;height:56px;padding:0 22px;
        display:flex;align-items:center;justify-content:space-between;background:#202226;color:#fff;
        box-shadow:0 2px 12px rgba(0,0,0,.35);font:13px 'Malgun Gothic',sans-serif;}
      .mes-print-actions{display:flex;gap:8px;}
      .mes-print-actions button{height:34px;padding:0 14px;border:1px solid #59606b;border-radius:6px;
        background:#343941;color:#fff;font:inherit;font-weight:700;cursor:pointer;}
      .mes-print-actions button.primary{background:#2878d0;border-color:#2878d0;}
      .mes-print-sheet{width:794px;min-height:1123px;margin:0 auto;padding:20px 24px;box-sizing:border-box;
        background:#fff;color:#111;box-shadow:0 8px 30px rgba(0,0,0,.45);}
      body.mes-print-export .mes-print-sheet{margin:0!important;box-shadow:none!important;}
      @media(max-width:850px){
        body{padding-left:8px!important;padding-right:8px!important;}
        .mes-print-sheet{transform-origin:top left;}
      }
      @media print{
        html,body{background:#fff!important;}
        body{padding:20px 24px!important;}
        .mes-print-toolbar{display:none!important;}
        .mes-print-sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none;}
      }
    </style></head><body${exportMode ? ' class="mes-print-export"' : ''}>
      ${showToolbar ? `<div class="mes-print-toolbar">
        <strong>${safeTitle} · A4 출력 기준</strong>
        <div class="mes-print-actions">
          <button onclick="window.close()">닫기</button>
          <button class="primary" onclick="window.print()">인쇄 / PDF 저장</button>
        </div>
      </div>` : ''}
      <main class="mes-print-sheet">${body}</main>
    </body></html>`;
}

async function documentPdfBlob(type, id) {
  const config = _driveDocumentConfig(type);
  if (!config) throw new Error('지원하지 않는 문서 형식입니다.');
  const html = captureDocumentPrintHtml(()=>config.print(id));
  return createDocumentPdfBlobFromHtml(html);
}

function openDocumentPdfPreview(html, title) {
  if (typeof window._mesDocumentPrintCapture === 'function') {
    window._mesDocumentPrintCapture(html);
    return;
  }
  const preview = window.open('', '_blank', 'width=900,height=960');
  if (!preview) {
    showToast('PDF 미리보기 창을 열 수 없습니다. 팝업 차단을 해제해 주세요.', 'error');
    return;
  }
  preview.document.write(buildDocumentPdfPreviewHtml(html, title));
  preview.document.close();
}

function captureDocumentXlsxBlob(callback) {
  if (typeof XLSX === 'undefined') throw new Error('엑셀 생성 라이브러리가 준비되지 않았습니다.');
  const original = XLSX.writeFile;
  let result = null;
  XLSX.writeFile = function(workbook, fileName) {
    result = {
      blob:new Blob([XLSX.write(workbook, {bookType:'xlsx',type:'array'})], {
        type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      fileName:fileName
    };
  };
  try { callback(); }
  finally { XLSX.writeFile = original; }
  if (!result) throw new Error('엑셀 문서를 생성하지 못했습니다.');
  return result;
}

async function saveDocumentToGoogleDrive(type, id, format) {
  const config = _driveDocumentConfig(type);
  if (!config) { showToast('지원하지 않는 문서입니다.', 'error'); return; }
  try {
    await requestDriveAccessToken('');
    const base = String(id || config.label + '_' + today()).replace(/[\\/:*?"<>|,]/g, '_');
    let blob, fileName;
    if (format === 'pdf') {
      blob = await documentPdfBlob(type, id);
      fileName = base + '.pdf';
    } else {
      const result = captureDocumentXlsxBlob(()=>config.xlsx(id));
      blob = result.blob;
      fileName = id ? base + '.xlsx' : result.fileName;
    }
    const file = await uploadBlobToGoogleDrive(blob, fileName, 'Documents');
    showToast(file.name + ' Google Drive 저장 완료', 'success');
  } catch (error) {
    showToast(error.message || 'Google Drive 문서 저장에 실패했습니다.', 'error');
  }
}

async function _uploadDocumentBundleToGoogleDrive(type, id) {
  const config = _driveDocumentConfig(type);
  const base = String(id || config.label + '_' + today()).replace(/[\\/:*?"<>|,]/g, '_');
  const pdfBlob = await documentPdfBlob(type, id);
  const xlsxResult = captureDocumentXlsxBlob(()=>config.xlsx(id));
  await uploadBlobToGoogleDrive(pdfBlob, base + '.pdf', 'Documents');
  await uploadBlobToGoogleDrive(xlsxResult.blob, id ? base + '.xlsx' : xlsxResult.fileName, 'Documents');
}

async function saveDocumentBundleToGoogleDrive(type, id) {
  const config = _driveDocumentConfig(type);
  if (!config) { showToast('지원하지 않는 문서입니다.', 'error'); return; }
  try {
    await requestDriveAccessToken('');
    if (Array.isArray(id) && type !== 'po') {
      for (const documentId of id) {
        await _uploadDocumentBundleToGoogleDrive(type, documentId);
      }
      showToast(config.label + ' ' + id.length + '건 PDF/XLSX Drive 저장 완료', 'success');
      if (typeof bulkToggleAll === 'function') bulkToggleAll(type, false);
      return;
    }
    await _uploadDocumentBundleToGoogleDrive(type, id);
    showToast(config.label + (Array.isArray(id) ? ' ' + id.length + '건' : '') + ' PDF/XLSX Drive 저장 완료', 'success');
    if (Array.isArray(id) && type === 'po') poToggleAll(false);
  } catch (error) {
    showToast(error.message || 'Google Drive 문서 저장에 실패했습니다.', 'error');
  }
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) throw new Error('첨부파일 데이터가 올바르지 않습니다.');
  const mime = (parts[0].match(/data:([^;]+)/) || [,'application/octet-stream'])[1];
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type:mime});
}

async function _uploadMemoAttachmentList(attachments) {
  let uploaded = 0;
  for (const attachment of attachments) {
    if (attachment.driveFileId) continue;
    const dataUrl = attachment.dataUrl || memoAttachmentData[attachment.id];
    if (!dataUrl) continue;
    const file = await uploadBlobToGoogleDrive(dataUrlToBlob(dataUrl), attachment.name, 'Attachments');
    attachment.driveFileId = file.id;
    attachment.driveUrl = file.webViewLink || '';
    uploaded++;
  }
  return uploaded;
}

function _persistMemoDriveAttachments(memoId, attachments) {
  const memo = memoList.find(item=>item.id === memoId);
  if (!memo) return;
  memo.attachments = (memo.attachments || []).map(saved => {
    const uploaded = attachments.find(item=>item.id === saved.id);
    return uploaded ? Object.assign({}, saved, {
      driveFileId:uploaded.driveFileId || '',
      driveUrl:uploaded.driveUrl || ''
    }) : saved;
  });
  saveStorage('memoList', memoList);
}

async function autoUploadMemoAttachmentsToGoogleDrive(memoId, attachments) {
  if (!attachments || !attachments.length) return;
  const config = getDriveConfig();
  if (!config.clientId) {
    showToast('첨부파일 자동 저장을 위해 시스템 관리에서 Google Drive를 먼저 설정하세요.', 'info');
    return;
  }
  try {
    await requestDriveAccessToken('');
    const uploaded = await _uploadMemoAttachmentList(attachments);
    _persistMemoDriveAttachments(memoId, attachments);
    attachments.forEach(uploadedAttachment => {
      const current = _memoAttachments.find(item=>item.id === uploadedAttachment.id);
      if (current) Object.assign(current, uploadedAttachment);
    });
    renderMemoAttachments();
    if (uploaded) showToast(uploaded + '개 첨부파일을 Drive에 자동 저장했습니다.', 'success');
  } catch (error) {
    showToast((error.message || '첨부파일 Drive 자동 저장에 실패했습니다.') + ' 메모에서 다시 저장할 수 있습니다.', 'error');
  }
}

async function uploadMemoAttachmentsToGoogleDrive() {
  if (!_memoAttachments.length) { showToast('Drive에 저장할 첨부파일이 없습니다.', 'info'); return; }
  const button = inp('memo-drive-upload-btn');
  if (button) { button.disabled=true; button.innerHTML='<i class="ti ti-loader animate-spin"></i>업로드 중'; }
  try {
    await requestDriveAccessToken('');
    const uploaded = await _uploadMemoAttachmentList(_memoAttachments);
    const memoId = v('memo-id');
    if (memoId) _persistMemoDriveAttachments(memoId, _memoAttachments);
    renderMemoAttachments();
    showToast(uploaded ? uploaded + '개 첨부파일을 Drive에 저장했습니다.' : '이미 Drive에 저장된 첨부파일입니다.', uploaded ? 'success' : 'info');
  } catch (error) {
    showToast(error.message || '첨부파일 Drive 저장에 실패했습니다.', 'error');
  } finally {
    if (button) { button.disabled=false; button.innerHTML='<i class="ti ti-cloud-upload"></i>첨부파일 Drive 저장'; }
  }
}

async function downloadMemoAttachmentFromDrive(attachment) {
  const token = await requestDriveAccessToken('');
  const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(attachment.driveFileId) + '?alt=media', {
    headers:{Authorization:'Bearer ' + token}
  });
  if (!response.ok) throw new Error('Drive 첨부파일 다운로드에 실패했습니다. (' + response.status + ')');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href=url; link.download=attachment.name || 'attachment'; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function loadGoogleDriveBackups() {
  const list = inp('drive-backup-list');
  if (list) list.innerHTML = '<div class="empty"><i class="ti ti-loader animate-spin"></i>Drive 백업 목록을 불러오는 중...</div>';
  try {
    const root = await ensureDriveBackupFolder();
    const folder = await ensureDriveSubfolder('Backups', root.id);
    const query = encodeURIComponent(
      "'" + folder.id + "' in parents and name contains 'mes-data-' and mimeType='application/json' and trashed=false"
    );
    const data = await driveApi('/drive/v3/files?q=' + query +
      '&orderBy=modifiedTime%20desc&pageSize=30&fields=files(id,name,size,modifiedTime,webViewLink)');
    _driveBackups = data.files || [];
    renderDriveBackupList();
  } catch (error) {
    if (list) list.innerHTML = '<div class="empty"><i class="ti ti-alert-circle"></i>' + _driveEsc(error.message) + '</div>';
  }
}

function renderDriveBackupList() {
  const list = inp('drive-backup-list'); if (!list) return;
  if (!_driveBackups.length) {
    list.innerHTML = '<div class="empty"><i class="ti ti-cloud-off"></i>Google Drive 백업 파일이 없습니다.</div>';
    return;
  }
  list.innerHTML = '<div style="overflow-x:auto;"><table><thead><tr><th>파일명</th><th>백업 시간</th><th>크기</th><th style="text-align:center;">관리</th></tr></thead><tbody>' +
    _driveBackups.map((file, index) => '<tr><td style="font-weight:700;">' + _driveEsc(file.name) + '</td>' +
      '<td>' + _driveEsc(new Date(file.modifiedTime).toLocaleString('ko-KR')) + '</td>' +
      '<td>' + (file.size ? Math.max(1, Math.round(Number(file.size) / 1024)).toLocaleString() + ' KB' : '—') + '</td>' +
      '<td style="text-align:center;white-space:nowrap;">' +
        '<button class="btn btn-sm" onclick="restoreGoogleDriveBackupByIndex(' + index + ')"><i class="ti ti-restore"></i>복원</button> ' +
        (file.webViewLink ? '<a class="btn btn-sm" href="' + _driveEsc(file.webViewLink) + '" target="_blank" rel="noopener"><i class="ti ti-external-link"></i></a>' : '') +
      '</td></tr>').join('') + '</tbody></table></div>';
}

function restoreGoogleDriveBackupByIndex(index) {
  const file = _driveBackups[index];
  if (file) restoreGoogleDriveBackup(file.id, file.name);
}

async function restoreGoogleDriveBackup(fileId, fileName) {
  confirm_('Google Drive 백업 복원',
    '<strong>' + _driveEsc(fileName) + '</strong> 파일로 현재 데이터를 교체합니다.<br>' +
    '<span style="color:var(--tx-d);font-size:12px;">복원 전에 현재 데이터를 Drive에 백업하는 것을 권장합니다.</span>',
    async () => {
      try {
        const token = await requestDriveAccessToken('');
        const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', {
          headers: { Authorization:'Bearer ' + token }
        });
        if (!response.ok) throw new Error('백업 파일 다운로드에 실패했습니다. (' + response.status + ')');
        const data = await response.json();
        const applied = applyDataBackupPayload(data);
        if (typeof _goTo === 'function') _goTo(currentPage || 'system', null);
        showToast('Drive 백업 복원 완료 — ' + applied + '개 항목', 'success');
      } catch (error) {
        showToast(error.message || 'Drive 백업 복원에 실패했습니다.', 'error');
      }
    },
    'btn-primary', 'ti-restore'
  );
}

async function renderGoogleDriveSettings() {
  const body = inp('google-drive-settings-body'); if (!body) return;
  const config = getDriveConfig();
  const hosted = _driveHostedOriginAvailable();
  const currentOrigin = getDriveCurrentOrigin();
  const connected = isDriveTokenActive(0);
  const configured = !!(config.clientId && (config.folderId || config.folderUrl || config.connectedEmail));
  const statusText = connected ? '연결됨' : (configured ? '자동 연결 대기' : '연결 필요');
  body.innerHTML =
    '<div class="card" style="margin-bottom:16px;">' +
      '<div class="card-hd"><span class="card-ttl"><i class="ti ti-brand-google-drive"></i>Google Drive 데이터 백업</span>' +
        '<span class="bd ' + (connected ? 'bd-ok' : 'bd-neu') + '">' + statusText + '</span></div>' +
      '<div style="display:grid;gap:12px;max-width:820px;">' +
        (config.connectedEmail ? '<div style="font-size:12px;color:var(--tx-s);"><i class="ti ti-user-check"></i> 연결 계정: <b>' + _driveEsc(config.connectedEmail) + '</b></div>' : '') +
        (!hosted ? '<div class="al al-warn"><i class="ti ti-alert-triangle"></i><div><div class="al-t">웹 주소에서 실행해야 합니다.</div><div class="al-s">현재 file:// 실행 상태에서는 Google OAuth를 사용할 수 없습니다. Firebase Hosting의 HTTPS 주소 또는 localhost를 사용하세요.</div></div></div>' : '') +
        '<div class="form-row"><label class="form-lbl">현재 JavaScript 원본</label><div style="display:flex;gap:6px;">' +
          '<input class="form-inp" id="drive-current-origin" value="' + _driveEsc(currentOrigin || 'file:// 실행 중') + '" readonly>' +
          '<button class="btn" type="button" onclick="copyDriveCurrentOrigin()" ' + (!currentOrigin ? 'disabled' : '') + '><i class="ti ti-copy"></i>복사</button></div></div>' +
        '<div style="font-size:11px;color:var(--tx-w);line-height:1.7;">위 주소를 Google Cloud Console의 해당 OAuth 클라이언트 → 승인된 JavaScript 원본에 글자 하나까지 동일하게 등록하세요. 경로와 마지막 /는 넣지 않습니다.</div>' +
        '<div class="form-row"><label class="form-lbl">OAuth 웹 클라이언트 ID</label>' +
          '<input class="form-inp" id="drive-client-id" value="' + _driveEsc(config.clientId) + '" placeholder="xxxxxxxx.apps.googleusercontent.com"></div>' +
        '<div style="font-size:11px;color:var(--tx-t);line-height:1.7;">Google Cloud Console에서 Drive API를 활성화하고 OAuth 웹 클라이언트를 만든 뒤 현재 HTTPS 주소를 승인된 JavaScript 원본에 등록하세요. 권한은 앱이 만든 파일만 접근하는 drive.file을 사용합니다.</div>' +
        '<label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;">' +
          '<input type="checkbox" id="drive-auto-connect" ' + (config.autoConnectEnabled !== false ? 'checked' : '') + '>시스템 로그인 후 Google Drive 자동 연결</label>' +
        '<div style="font-size:10px;color:var(--tx-t);line-height:1.6;">최초 1회 Drive 연결과 권한 승인이 필요합니다. 이후에는 시스템 로그인 후 자동 연결을 시도하며, Google 로그인 세션 또는 브라우저 정책에 따라 연결 버튼을 다시 눌러야 할 수 있습니다.</div>' +
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px;border:1px solid var(--br);border-radius:var(--rm);">' +
          '<label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;"><input type="checkbox" id="drive-auto-enabled" ' + (config.autoBackupEnabled ? 'checked' : '') + '>자동 백업</label>' +
          '<label style="font-size:11px;color:var(--tx-s);">주기 <input id="drive-auto-hours" type="number" min="1" value="' + (Number(config.autoBackupHours)||24) + '" style="width:70px;height:30px;text-align:right;"> 시간</label>' +
          '<span style="font-size:10px;color:var(--tx-t);">페이지가 열려 있고 Drive가 연결된 동안 실행됩니다.</span></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn" onclick="saveGoogleDriveSettings()"><i class="ti ti-device-floppy"></i>설정 저장</button>' +
          '<button class="btn btn-primary" onclick="connectGoogleDrive()" ' + (!hosted || !config.clientId ? 'disabled' : '') + '><i class="ti ti-plug-connected"></i>Drive 연결</button>' +
          '<button class="btn" onclick="disconnectGoogleDrive()" ' + (!connected && !configured ? 'disabled' : '') + '><i class="ti ti-plug-off"></i>연결 해제</button>' +
          (config.folderUrl ? '<a class="btn" href="' + _driveEsc(config.folderUrl) + '" target="_blank" rel="noopener"><i class="ti ti-folder-open"></i>MESPro 폴더 열기</a>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-database-export"></i>백업 파일</span>' +
      '<span style="font-size:11px;color:var(--tx-t);">마지막 백업: ' + (config.lastBackupAt ? _driveEsc(new Date(config.lastBackupAt).toLocaleString('ko-KR')) : '없음') + '</span></div>' +
      '<div class="toolbar">' +
        '<button class="btn btn-primary" id="drive-backup-btn" onclick="backupDataToGoogleDrive()" ' + (!connected ? 'disabled' : '') + '><i class="ti ti-cloud-upload"></i>지금 백업</button>' +
        '<button class="btn" onclick="loadGoogleDriveBackups()" ' + (!connected ? 'disabled' : '') + '><i class="ti ti-refresh"></i>목록 새로고침</button>' +
      '</div><div id="drive-backup-list"><div class="empty"><i class="ti ti-brand-google-drive"></i>Drive를 연결하면 최근 백업 30개를 확인할 수 있습니다.</div></div></div>';
  if (connected) loadGoogleDriveBackups();
}
