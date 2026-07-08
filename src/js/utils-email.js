/* ════════ 공통 유틸 ════════ */
function nextDocCode(prefix, list) {
  const ymd = today().slice(2).replace(/-/g, '');
  const pat  = `${prefix}-${ymd}-`;
  const nums = list.filter(x => x.id.startsWith(pat)).map(x => parseInt(x.id.split('-').pop()) || 0);
  return `${prefix}-${ymd}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

function getCompanyInfo() {
  return loadStorage('companyInfo', { name:'(주)회사명', address:'주소를 설정해 주세요', tel:'', fax:'', bizNo:'', ceo:'', dept:'구매팀', bizType:'', bizItem:'', email:'' });
}

function openCompanySettings() {
  const ci = getCompanyInfo();
  inp('ci-name').value  = ci.name;  inp('ci-ceo').value   = ci.ceo;
  inp('ci-addr').value  = ci.address; inp('ci-tel').value  = ci.tel;
  inp('ci-fax').value   = ci.fax;   inp('ci-bizno').value = ci.bizNo;
  inp('ci-dept').value  = ci.dept;
  if(inp('ci-biztype')) inp('ci-biztype').value = ci.bizType || '';
  if(inp('ci-bizitem')) inp('ci-bizitem').value = ci.bizItem || '';
  if(inp('ci-email'))   inp('ci-email').value   = ci.email || '';
  inp('company-modal').classList.add('open');
}
function saveCompanySettings() {
  saveStorage('companyInfo', { name:v('ci-name'), address:v('ci-addr'), tel:v('ci-tel'), fax:v('ci-fax'), bizNo:v('ci-bizno'), ceo:v('ci-ceo'), dept:v('ci-dept'), bizType:v('ci-biztype'), bizItem:v('ci-bizitem'), email:v('ci-email') });
  closeModal('company-modal');
  if (typeof renderSystemCompany === 'function' && currentPage === 'system') renderSystemCompany();
  showToast('회사 정보가 저장되었습니다.');
}

function getEmailjsConfig() {
  return loadStorage('emailjsConfig', { serviceId:'', templateId:'', publicKey:'' });
}
function openEmailjsSettings() {
  if (typeof openApiSettings === 'function') {
    openApiSettings('emailjs');
    return;
  }
  inp('emailjs-modal').classList.add('open');
}
function saveEmailjsSettings() {
  const cfg = { serviceId: v('ejs-service'), templateId: v('ejs-template'), publicKey: v('ejs-pubkey') };
  saveStorage('emailjsConfig', cfg);
  if (cfg.publicKey && window.emailjs) emailjs.init({ publicKey: cfg.publicKey });
  closeModal('emailjs-modal');
  showToast('EmailJS 설정이 저장되었습니다.');
}
function initEmailjs() {
  const cfg = getEmailjsConfig();
  if (cfg.publicKey && window.emailjs) emailjs.init({ publicKey: cfg.publicKey });
}

function closeModal(id) { inp(id)?.classList.remove('open'); }

/* 공급처 이메일 자동완성 */
function autoFillSupplierEmail(supplierInputId, emailInputId, type) {
  const name = inp(supplierInputId)?.value?.trim();
  if (!name) return;
  const list = type === 'rfq' ? rfqList : poList;
  const found = list.find(x => x.supplier === name && x.supplierEmail);
  if (found && !inp(emailInputId)?.value) inp(emailInputId).value = found.supplierEmail;
}

/* ════════ 이메일 발송 ════════ */
let _emailDocRef = null;
const DOCUMENT_EMAIL_LABELS = { rfq:'견적요청', po:'구매발주', statement:'거래명세표', tax:'세금계산서', quote:'견적서', order:'수주확인서' };
const EMAIL_SEND_HISTORY_LIMIT = 500;

function documentEmailLabel(docType) {
  return DOCUMENT_EMAIL_LABELS[docType] || '문서';
}
function emailHistorySource() {
  if (!Array.isArray(emailSendHistory)) emailSendHistory = loadStorage('emailSendHistory', []);
  return emailSendHistory;
}
function documentEmailHistoryRows(docType, docId) {
  const type = String(docType || '');
  const id = String(docId || '');
  return emailHistorySource()
    .filter(row => row && String(row.docType || '') === type && String(row.docId || '') === id)
    .sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')));
}
function formatEmailHistoryTime(value, compact) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const opts = compact
    ? { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }
    : { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' };
  return d.toLocaleString('ko-KR', opts);
}
function emailHistoryStatusClass(status) {
  if (status === '메일 앱 열림') return 'bd-neu';
  if (status === '발송 실패') return 'bd-err';
  return 'bd-info';
}
function emailHistoryStatusBadge(status) {
  const s = status || '발송 요청 등록';
  return `<span class="bd ${emailHistoryStatusClass(s)}" style="font-size:10px;">${esc(s)}</span>`;
}
function renderEmailHistoryRows(rows, limit) {
  const visible = rows.slice(0, limit || 20);
  if (!visible.length) {
    return '<div class="empty" style="padding:12px;"><i class="ti ti-history-off"></i>아직 이메일 발송 내역이 없습니다.</div>';
  }
  return visible.map(row => `
    <div style="border:1px solid var(--br);border-radius:8px;padding:8px 10px;margin-bottom:6px;background:var(--bg);">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
        <div style="font-weight:700;font-size:12px;">${esc(formatEmailHistoryTime(row.sentAt))}</div>
        ${emailHistoryStatusBadge(row.status)}
      </div>
      <div style="font-size:11px;color:var(--tx-s);margin-top:4px;">받는 사람: ${esc(row.to || '-')}</div>
      <div style="font-size:11px;color:var(--tx-t);margin-top:2px;">제목: ${esc(row.subject || '-')}</div>
      <div style="font-size:10px;color:var(--tx-t);margin-top:3px;">
        ${esc(row.provider || '-')} · ${row.attachmentCount ? 'PDF 첨부' : '첨부 없음'}${row.actorName ? ' · ' + esc(row.actorName) : ''}
      </div>
      ${row.note ? `<div style="font-size:10px;color:var(--tx-t);margin-top:3px;">${esc(row.note)}</div>` : ''}
    </div>
  `).join('');
}
function emailSendSummaryHtml(docType, docId) {
  const latest = documentEmailHistoryRows(docType, docId)[0];
  if (!latest) return '';
  return `<br><button type="button" class="btn btn-sm" data-email-history-type="${esc(docType)}" data-email-history-id="${esc(docId)}" onclick="openEmailHistoryFromButton(this,event)" title="이메일 발송 내역" style="margin-top:3px;padding:2px 6px;font-size:10px;border-color:var(--br-i);color:var(--tx-i);"><i class="ti ti-history"></i> ${esc(formatEmailHistoryTime(latest.sentAt, true))}</button>`;
}
function openEmailHistoryFromButton(btn, event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  openEmailHistoryModal(btn && btn.dataset ? btn.dataset.emailHistoryType : '', btn && btn.dataset ? btn.dataset.emailHistoryId : '');
}
function renderCurrentEmailHistoryPanel() {
  const box = inp('em-history-list');
  const count = inp('em-history-count');
  if (!box || !_emailDocRef || !_emailDocRef.docObj) return;
  const rows = documentEmailHistoryRows(_emailDocRef.docType, _emailDocRef.docObj.id);
  if (count) count.textContent = rows.length ? `${rows.length}건` : '0건';
  box.innerHTML = renderEmailHistoryRows(rows, 4);
}
function openEmailHistoryModal(docType, docId) {
  const rows = documentEmailHistoryRows(docType, docId);
  const title = inp('email-history-title');
  const summary = inp('email-history-summary');
  const list = inp('email-history-list');
  if (title) title.textContent = `${documentEmailLabel(docType)} ${docId || ''} 이메일 발송 내역`;
  if (summary) {
    const latest = rows[0];
    summary.innerHTML = latest
      ? `총 ${rows.length}건 · 최근 ${esc(formatEmailHistoryTime(latest.sentAt))} · ${esc(latest.to || '')}`
      : '아직 기록된 이메일 발송 내역이 없습니다.';
  }
  if (list) list.innerHTML = renderEmailHistoryRows(rows, 50);
  inp('email-history-modal')?.classList.add('open');
}
function refreshEmailHistoryDocumentView(docType) {
  if (docType === 'rfq' && typeof renderRfq === 'function') renderRfq();
  else if (docType === 'po' && typeof renderPo === 'function') renderPo();
  else if ((docType === 'statement' || docType === 'tax') && typeof renderSalesDoc === 'function') renderSalesDoc(docType);
  else if ((docType === 'quote' || docType === 'order') && typeof renderSODoc === 'function') renderSODoc(docType);
}
function recordDocumentEmailHistory(options) {
  if (!_emailDocRef || !_emailDocRef.docObj) return null;
  const actor = typeof getCurrentActor === 'function' ? getCurrentActor() : {};
  const doc = _emailDocRef.docObj;
  const entry = {
    id: 'EMH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    docType: _emailDocRef.docType || '',
    docLabel: documentEmailLabel(_emailDocRef.docType),
    docId: doc.id || '',
    to: options.to || '',
    subject: options.subject || v('em-subject') || '',
    status: options.status || '발송 요청 등록',
    provider: options.provider || '',
    mailQueueId: options.mailQueueId || '',
    attachmentCount: options.attachmentCount || 0,
    attachmentName: options.attachmentName || '',
    note: options.note || '',
    sentAt: new Date().toISOString(),
    actorName: actor.name || '',
    actorEmail: actor.email || '',
    actorUid: actor.uid || actor.userId || ''
  };
  emailSendHistory = emailHistorySource();
  emailSendHistory.unshift(entry);
  emailSendHistory = emailSendHistory.slice(0, EMAIL_SEND_HISTORY_LIMIT);
  saveStorage('emailSendHistory', emailSendHistory);
  renderCurrentEmailHistoryPanel();
  refreshEmailHistoryDocumentView(entry.docType);
  return entry;
}

function pdfBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function normalizePdfBase64(output) {
  if (output instanceof ArrayBuffer || output instanceof Uint8Array) {
    const base64 = pdfBufferToBase64(output);
    if (base64.length < 1000) throw new Error('PDF 데이터가 비어 있습니다.');
    return base64;
  }
  let text = String(output || '').trim();
  const comma = text.indexOf('base64,');
  if (comma >= 0) text = text.slice(comma + 7);
  text = text.replace(/\s/g, '');
  if (text.length < 1000) throw new Error('PDF 데이터가 비어 있습니다.');
  return text;
}

function pdfBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (!blob || !blob.size) {
      reject(new Error('PDF 파일 데이터가 비어 있습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(normalizePdfBase64(reader.result)); }
      catch (error) { reject(error); }
    };
    reader.onerror = () => reject(reader.error || new Error('PDF 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

async function generateDocumentPdfBase64FromPrint(docObj, docType) {
  if (!docObj || !docObj.id) throw new Error('문서번호가 없어 PDF를 생성할 수 없습니다.');
  if (typeof documentPdfBlob !== 'function') {
    throw new Error('기존 PDF 출력 모듈이 준비되지 않았습니다.');
  }
  const blob = await documentPdfBlob(docType, docObj.id);
  return pdfBlobToBase64(blob);
}

function generatePdfBase64(docObj, docType) {
  return generateDocumentPdfBase64FromPrint(docObj, docType);
}

function openEmailModal(docObj, docType) {
  _emailDocRef = { docObj, docType, pdfBase64: null };
  const ci = getCompanyInfo();
  const label = documentEmailLabel(docType);
  const subject = `[${label}] ${docObj.id} — ${typeof _docItemSummary === 'function' ? _docItemSummary(docObj) : (docObj.itemName||'')}`;
  let body;
  if (docType === 'rfq')      body = buildRfqEmailBody(docObj, ci);
  else if (docType === 'po')  body = buildPoEmailBody(docObj, ci);
  else                        body = buildSalesEmailBody(docObj, ci, label);
  inp('em-to').value      = docObj.supplierEmail || docObj.clientEmail || '';
  inp('em-subject').value = subject;
  inp('em-body').value    = body;
  renderCurrentEmailHistoryPanel();

  // 첨부파일 UI 초기화
  inp('em-attachment-status').textContent = 'PDF 파일 조립 중...';
  inp('em-attachment-status').style.color = '';
  inp('em-attachment-name').textContent = docObj.id + '.pdf';
  inp('em-attachment-spinner').style.display = '';
  inp('email-submit-btn').disabled = true;

  inp('email-send-modal').classList.add('open');

  // 백그라운드 PDF 생성 가동
  generatePdfBase64(docObj, docType).then(base64 => {
    _emailDocRef.pdfBase64 = base64;
    inp('em-attachment-status').textContent = 'PDF 파일 첨부 완료';
    inp('em-attachment-status').style.color = 'var(--tx-ok)';
    inp('em-attachment-spinner').style.display = 'none';
    inp('email-submit-btn').disabled = false;
    showToast(`이메일에 ${label} PDF 파일이 성공적으로 조립되어 첨부되었습니다.`, 'success');
  }).catch(err => {
    console.error('PDF 조립 실패:', err);
    inp('em-attachment-status').textContent = 'PDF 첨부 실패';
    inp('em-attachment-status').style.color = 'var(--tx-d)';
    inp('em-attachment-spinner').style.display = 'none';
    inp('email-submit-btn').disabled = true;
    showToast('PDF 파일 생성 중 오류가 발생했습니다. PDF가 준비되어야 직접 발송할 수 있습니다: ' + err.message, 'error');
  });
}

function buildRfqEmailBody(r, ci) {
  const client = getClientName(r.clientId) || '—';
  const prod   = r.productId ? getProductName(r.productId) : '—';
  const lines = _docLines(r, 'rfq');
  const itemLines = lines.map((line, idx) =>
    `${idx + 1}. ${line.itemName}${line.spec ? ' (' + line.spec + ')' : ''} / ${line.qty} ${line.unit}${line.rowNote ? ' / ' + line.rowNote : ''}`
  ).join('\n');
  return `안녕하세요, ${r.supplier} 담당자님.

${ci.name} ${ci.dept}입니다.

아래 품목에 대한 견적을 요청드립니다.

─────────────────────────────
문서번호: ${r.id}
요청일자: ${r.date}
관련 프로젝트: ${client} — ${prod}
─────────────────────────────
품목:
${itemLines}
희망 단가: ${r.targetPrice ? '₩' + Number(r.targetPrice).toLocaleString('ko-KR') : '미기재'}
─────────────────────────────

회신 기한 내에 견적서를 회신해 주시기 바랍니다.

감사합니다.

${ci.name} ${ci.dept}
TEL: ${ci.tel}`;
}

function buildPoEmailBody(p, ci) {
  const client = getClientName(p.clientId) || '—';
  const prod   = p.productId ? getProductName(p.productId) : '—';
  const amt    = _docAmount(p, 'po') ? '₩' + Number(_docAmount(p, 'po')).toLocaleString('ko-KR') : '미기재';
  const itemLines = _docLines(p, 'po').map((line, idx) =>
    `${idx + 1}. ${line.itemName}${line.spec ? ' (' + line.spec + ')' : ''} / ${line.qty} ${line.unit}${line.rowNote ? ' / ' + line.rowNote : ''}`
  ).join('\n');
  return `안녕하세요, ${p.supplier} 담당자님.

${ci.name} ${ci.dept}입니다.

아래 품목에 대하여 발주하오니 납기일에 맞추어 납품해 주시기 바랍니다.

─────────────────────────────
발주번호: ${p.id}
발행일자: ${p.date}
관련 프로젝트: ${client} — ${prod}
─────────────────────────────
품목:
${itemLines}
단가: ${p.unitPrice ? '₩' + Number(p.unitPrice).toLocaleString('ko-KR') : '미기재'}
금액: ${amt}
결제조건: ${p.payMethod || '현금'}
납품방법: ${p.dlvMethod || '직납'}
─────────────────────────────

납품 시 거래명세표를 동봉해 주시기 바랍니다.

감사합니다.

${ci.name} ${ci.dept}
TEL: ${ci.tel}`;
}

const DOCUMENT_EMAIL_FN_REGION = 'asia-northeast3';
const DOCUMENT_EMAIL_MAX_PDF_BASE64 = 880000;

function isFirestoreEmailReady() {
  return (typeof _cloudActive !== 'undefined' && _cloudActive) &&
         typeof firebase !== 'undefined' &&
         firebase.app &&
         typeof firebase.app().functions === 'function';
}

function documentEmailCallable(name) {
  return firebase.app().functions(DOCUMENT_EMAIL_FN_REGION).httpsCallable(name);
}

function normalizeEmailAddress(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function markDocumentEmailSent() {
  if (!_emailDocRef) return;
  const { docObj, docType } = _emailDocRef;
  if (docType === 'rfq') {
    const r = rfqList.find(x => x.id === docObj.id);
    if (r && r.status === '요청전') {
      r.status = '요청중';
      saveStorage('rfqList', rfqList);
      renderRfq();
    }
  } else if (docType === 'po') {
    const p = poList.find(x => x.id === docObj.id);
    if (p && p.status === '작성중') {
      p.status = '발송완료';
      saveStorage('poList', poList);
      renderPo();
    }
  } else if (docType === 'statement') {
    const list = typeof salesList === 'function' ? salesList('statement') : statementList;
    const d = Array.isArray(list) ? list.find(x => x.id === docObj.id) : null;
    if (d && d.status === '작성') {
      d.status = '발송완료';
      saveStorage('statementList', list);
      if (typeof renderSalesDoc === 'function') renderSalesDoc('statement');
    }
  }
}

function buildFirestoreEmailPayload(to, ci) {
  const doc = (_emailDocRef && _emailDocRef.docObj) || {};
  const docType = (_emailDocRef && _emailDocRef.docType) || '';
  const payload = {
    to,
    subject: v('em-subject'),
    text: v('em-body'),
    docType,
    docId: doc.id || '',
    requireAttachment: true
  };
  const replyTo = normalizeEmailAddress(ci.email);
  if (replyTo) payload.replyTo = replyTo;
  if (_emailDocRef && _emailDocRef.pdfBase64) {
    if (_emailDocRef.pdfBase64.length > DOCUMENT_EMAIL_MAX_PDF_BASE64) {
      throw new Error('PDF 첨부 용량이 너무 큽니다. PDF를 저장 후 별도 첨부해 주세요.');
    }
    payload.attachments = [{
      filename: (doc.id || 'document') + '.pdf',
      content: _emailDocRef.pdfBase64,
      encoding: 'base64',
      contentType: 'application/pdf'
    }];
  }
  return payload;
}

async function queueFirestoreDocumentEmail(to, ci) {
  const fn = documentEmailCallable('queueDocumentEmail');
  return fn(buildFirestoreEmailPayload(to, ci));
}

function getEmailjsReadyConfig() {
  const cfg = getEmailjsConfig();
  return cfg.serviceId && cfg.templateId && cfg.publicKey && window.emailjs ? cfg : null;
}

async function sendEmailjsDocumentEmail(to, ci) {
  const cfg = getEmailjsReadyConfig();
  if (!cfg) return false;
  const templateParams = {
    to_email:  to,
    subject:   v('em-subject'),
    message:   v('em-body'),
    from_name: ci.name + ' ' + ci.dept,
  };

  if (_emailDocRef && _emailDocRef.pdfBase64) {
    templateParams.pdf_attachment = "data:application/pdf;base64," + _emailDocRef.pdfBase64;
    templateParams.pdf_filename = _emailDocRef.docObj.id + ".pdf";
  }

  await emailjs.send(cfg.serviceId, cfg.templateId, templateParams);
  return true;
}

function doMailto() {
  const to = v('em-to');
  if (!to) { showToast('수신 이메일을 입력하세요.', 'error'); return; }
  showToast('안내: 메일 앱 발송 시 브라우저 보안 제약으로 PDF 첨부파일이 누락될 수 있으므로 직접 발송을 권장합니다.', 'info');
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(v('em-subject'))}&body=${encodeURIComponent(v('em-body'))}`;
  window.open(url, '_blank');
  recordDocumentEmailHistory({
    to,
    subject: v('em-subject'),
    status: '메일 앱 열림',
    provider: '메일 앱',
    attachmentCount: 0,
    note: '앱에서 실제 발송 완료 여부와 PDF 첨부 여부는 확인할 수 없습니다.'
  });
}

async function doEmailJS() {
  const to = v('em-to');
  if (!to) { showToast('수신 이메일을 입력하세요.', 'error'); return; }
  if (!_emailDocRef || !_emailDocRef.pdfBase64) {
    showToast('PDF 첨부가 완료된 뒤 발송할 수 있습니다.', 'error');
    return;
  }
  const ci = getCompanyInfo();
  try {
    showToast('이메일 발송 요청 등록 중...', 'info');
    let provider = 'Firebase 이메일 확장';
    let mailQueueId = '';
    if (isFirestoreEmailReady()) {
      const result = await queueFirestoreDocumentEmail(to, ci);
      mailQueueId = (result && result.data && result.data.id) || (result && result.id) || '';
    } else if (!(await sendEmailjsDocumentEmail(to, ci))) {
      showToast('Firebase 로그인 또는 이메일 함수 배포가 필요합니다.', 'error');
      return;
    } else {
      provider = 'EmailJS';
    }
    recordDocumentEmailHistory({
      to,
      subject: v('em-subject'),
      status: '발송 요청 등록',
      provider,
      mailQueueId,
      attachmentCount: 1,
      attachmentName: _emailDocRef.docObj.id + '.pdf'
    });
    closeModal('email-send-modal');
    showToast('이메일 발송 요청이 등록되었습니다.', 'success');
    markDocumentEmailSent();
  } catch(e) {
    const msg = e && e.code === 'functions/not-found'
      ? 'Firebase 이메일 함수 배포가 필요합니다.'
      : (e.text || e.message || '알 수 없는 오류');
    showToast('발송 실패: ' + msg, 'error');
  }
}
