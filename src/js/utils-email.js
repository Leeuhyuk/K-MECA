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
  showToast('회사 정보가 저장되었습니다.');
}

function getEmailjsConfig() {
  return loadStorage('emailjsConfig', { serviceId:'', templateId:'', publicKey:'' });
}
function openEmailjsSettings() {
  const cfg = getEmailjsConfig();
  inp('ejs-service').value  = cfg.serviceId;
  inp('ejs-template').value = cfg.templateId;
  inp('ejs-pubkey').value   = cfg.publicKey;
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

function generatePdfBase64(docObj, docType) {
  return new Promise((resolve, reject) => {
    try {
      const ci = getCompanyInfo();
      const style = _docPrintStyle();
      let bodyHtml = '';

      if (docType === 'rfq') {
        const r = docObj;
        const client = getClientName(r.clientId) || '—';
        const prod = r.productId ? getProductName(r.productId) : '—';
        const tgt = r.targetPrice;
        const amt = tgt ? Number(tgt * r.qty).toLocaleString('ko-KR') : '—';
        const vat = tgt ? Number(Math.round(tgt * r.qty * 0.1)).toLocaleString('ko-KR') : '—';
        const tot = tgt ? Number(Math.round(tgt * r.qty * 1.1)).toLocaleString('ko-KR') : '—';
        
        bodyHtml = `
          <div style="padding: 20px 24px; color:#111; font-size:12px; background:#fff; width:794px; min-height:1123px; box-sizing:border-box;">
            <div class="approval-box">
              <div class="apv-cell"><div class="apv-title">담 당</div><div class="apv-sign"></div></div>
              <div class="apv-cell"><div class="apv-title">팀 장</div><div class="apv-sign"></div></div>
              <div class="apv-cell"><div class="apv-title">승 인</div><div class="apv-sign"></div></div>
            </div>
            <div class="doc-header" style="margin-top:20px;">
              <div>
                <div class="co-name">${ci.name}</div>
                <div class="co-detail">${ci.address}${ci.tel?' | TEL. '+ci.tel:''}${ci.fax?' | FAX. '+ci.fax:''}</div>
                ${ci.bizNo?`<div class="co-detail">사업자등록번호: ${ci.bizNo}${ci.ceo?' | 대표이사: '+ci.ceo:''}</div>`:''}
              </div>
              <div><div class="doc-title" style="font-size:24px;">견 적 요 청 서</div><div class="doc-no">문서번호 &nbsp; ${r.id}</div></div>
            </div>
            <table class="info-tbl" style="margin-top:15px;">
              <tr><th>수 신</th><td class="hl" colspan="3">${r.supplier} 귀중</td></tr>
              <tr><th>발 신</th><td>${ci.name} ${ci.dept}</td><th style="width:90px;">발행일자</th><td>${r.date}</td></tr>
              <tr><th>관련 프로젝트</th><td colspan="3">${client} — ${prod}</td></tr>
              ${ci.tel?`<tr><th>담당 연락처</th><td colspan="3">${ci.dept} ${ci.tel}</td></tr>`:''}
            </table>
            <div class="sec-title" style="margin-top:20px;">■ 견적 요청 품목</div>
            <table class="items-tbl">
              <thead><tr><th style="width:30px;">No.</th><th>품 목 명</th><th style="width:140px;">규 격 / 사 양</th>
              <th style="width:46px;">수량</th><th style="width:40px;">단위</th>
              <th style="width:100px;">희망 단가</th><th style="width:110px;">희망 금액</th><th>비 고</th></tr></thead>
              <tbody>
                <tr><td class="ctr">1</td><td><strong>${r.itemName}</strong></td><td class="ctr">${r.spec||'—'}</td>
                <td class="ctr">${r.qty}</td><td class="ctr">${r.unit}</td>
                <td class="num">${tgt?Number(tgt).toLocaleString('ko-KR'):'—'}</td>
                <td class="num">${amt}</td><td style="font-size:10px;">${r.note||''}</td></tr>
                <tr class="empty-row"><td colspan="8">—</td></tr>
                <tr class="empty-row"><td colspan="8">—</td></tr>
                <tr class="total-row"><td colspan="6" style="text-align:right;">합 계</td>
                <td class="num">${amt}</td><td></td></tr>
              </tbody>
            </table>
            <div class="sum-wrap"><div class="sum-box">
              <div class="sum-row"><div class="sum-lbl">희망 공급가액</div><div class="sum-val">${amt} 원</div></div>
              <div class="sum-row"><div class="sum-lbl">부가세 (10%)</div><div class="sum-val">${vat} 원</div></div>
              <div class="sum-row sum-final"><div class="sum-lbl">희망 합계금액</div><div class="sum-val">${tot} 원</div></div>
            </div></div>
            <div class="remarks" style="margin-top:15px;">
              <div class="remarks-title">◆ 특기사항 및 요청조건</div>
              1. 상기 품목에 대하여 견적을 요청드리오니 회신 기한 내 견적서를 제출해 주시기 바랍니다.<br>
              2. 견적가격은 납품지 기준 공급가(VAT 별도)로 기재 바랍니다.<br>
              3. 납품 가능 수량 및 납기일을 반드시 명시하여 주시기 바랍니다.
            </div>
            <div class="sign-area" style="margin-top:20px;">
              <div class="sign-left">본 견적요청서는 구매 의사의 표명이 아니며,<br>견적 내용은 최종 발주 시 변경될 수 있습니다.</div>
              <div class="sign-right">
                <div class="sign-box"><div class="sign-title">작 성</div><div class="sign-content">(인)</div></div>
                <div class="sign-box"><div class="sign-title">검 토</div><div class="sign-content">(인)</div></div>
                <div class="sign-box"><div class="sign-title">승 인</div><div class="sign-content">(인)</div></div>
              </div>
            </div>
          </div>`;
      } else if (docType === 'statement' || docType === 'tax') {
        bodyHtml = _salesDocBodyHtml(docObj, docType, ci);
      } else {
        const p = docObj;
        const total = (p.unitPrice || 0) * p.qty;
        const vat = Math.round(total * 0.1);
        const grandTotal = total + vat;
        const client = getClientName(p.clientId) || '—';
        const prod = p.productId ? getProductName(p.productId) : '—';
        
        bodyHtml = `
          <div style="padding: 20px 24px; color:#111; font-size:12px; background:#fff; width:794px; min-height:1123px; box-sizing:border-box;">
            <div class="approval-box">
              <div class="apv-cell"><div class="apv-title">담 당</div><div class="apv-sign"></div></div>
              <div class="apv-cell"><div class="apv-title">팀 장</div><div class="apv-sign"></div></div>
              <div class="apv-cell"><div class="apv-title">이 사</div><div class="apv-sign"></div></div>
              <div class="apv-cell"><div class="apv-title">대 표</div><div class="apv-sign"></div></div>
            </div>
            <div class="doc-header" style="margin-top:20px;">
              <div>
                <div class="co-name">${ci.name}</div>
                <div class="co-detail">${ci.address}${ci.tel?' | TEL. '+ci.tel:''}${ci.fax?' | FAX. '+ci.fax:''}</div>
                ${ci.bizNo?`<div class="co-detail">사업자등록번호: ${ci.bizNo}${ci.ceo?' | 대표이사: '+ci.ceo:''}</div>`:''}
              </div>
              <div><div class="doc-title" style="font-size:24px;">구 매 발 주 서</div><div class="doc-no">발주번호 &nbsp; ${p.id}</div></div>
            </div>
            <table class="info-tbl" style="margin-top:15px;">
              <tr><th>공급처(수신)</th><td class="hl" colspan="3">${p.supplier} 귀중</td></tr>
              <tr><th>발행일자</th><td colspan="3">${p.date}</td></tr>
              <tr><th>결제조건</th><td>${p.payMethod||'현금'}</td><th>납품방법</th><td>${p.dlvMethod||'직납'}</td></tr>
              <tr><th>납품지 주소</th><td colspan="3">${ci.address}</td></tr>
            </table>
            <div class="sec-title" style="margin-top:20px;">■ 발주 품목</div>
            <table class="items-tbl">
              <thead><tr><th style="width:30px;">No.</th><th>품 목 명</th><th style="width:140px;">규 격 / 사 양</th>
              <th style="width:46px;">수량</th><th style="width:40px;">단위</th>
              <th style="width:100px;">단 가 (원)</th><th style="width:110px;">금 액 (원)</th><th>비 고</th></tr></thead>
              <tbody>
                <tr>
                  <td class="ctr">1</td><td><strong>${p.itemName}</strong></td><td class="ctr">${p.spec||'—'}</td>
                  <td class="ctr">${p.qty}</td><td class="ctr">${p.unit}</td>
                  <td class="num">${p.unitPrice?Number(p.unitPrice).toLocaleString('ko-KR'):'—'}</td>
                  <td class="num">${p.unitPrice?Number(p.unitPrice*p.qty).toLocaleString('ko-KR'):'—'}</td>
                  <td style="font-size:10px;">${p.note||''}</td>
                </tr>
                <tr class="empty-row"><td colspan="8">—</td></tr>
                <tr class="total-row"><td colspan="5" style="text-align:right;">공급가액 합계</td>
                <td></td><td class="num">${total.toLocaleString('ko-KR')}</td><td></td></tr>
              </tbody>
            </table>
            <div class="sum-wrap"><div class="sum-box">
              <div class="sum-row"><div class="sum-lbl">공급가액</div><div class="sum-val">${total.toLocaleString('ko-KR')} 원</div></div>
              <div class="sum-row"><div class="sum-lbl">부가세 (10%)</div><div class="sum-val">${vat.toLocaleString('ko-KR')} 원</div></div>
              <div class="sum-row sum-final"><div class="sum-lbl">발주 합계금액</div><div class="sum-val">${grandTotal.toLocaleString('ko-KR')} 원</div></div>
            </div></div>
            <div class="remarks" style="margin-top:15px;">
              <div class="remarks-title">◆ 특기사항 및 거래조건</div>
              1. 상기 품목에 대하여 발주하오니 납기일에 맞추어 납품하여 주시기 바랍니다.<br>
              2. 납품 시 반드시 거래명세표를 동봉하여 주시기 바랍니다.<br>
              3. 세금계산서는 납품 완료 후 익일 발행 바랍니다.
            </div>
            <div class="sign-area" style="margin-top:20px;">
              <div class="sign-left">위와 같이 발주하며, 본 발주서가 계약 효력을 갖습니다.<br>${p.date}<br><strong>${ci.name}</strong></div>
              <div class="sign-right">
                <div class="sign-box"><div class="sign-title">작 성</div><div class="sign-content">(인)</div></div>
                <div class="sign-box"><div class="sign-title">검 토</div><div class="sign-content">(인)</div></div>
                <div class="sign-box"><div class="sign-title">대표이사</div><div class="sign-content">(인)</div></div>
              </div>
            </div>
          </div>`;
      }

      const tempEl = document.createElement('div');
      tempEl.style.position = 'absolute';
      tempEl.style.left = '-9999px';
      tempEl.style.top = '-9999px';
      tempEl.style.width = '794px';
      tempEl.style.background = '#fff';
      tempEl.innerHTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>${style.replace(/<style>|<\/style>/g, '')}</style></head><body>${bodyHtml}</body></html>`;
      document.body.appendChild(tempEl);

      const opt = {
        margin: [0, 0, 0, 0],
        filename: `${docObj.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().from(tempEl).set(opt).outputPdf('base64').then(base64 => {
        document.body.removeChild(tempEl);
        resolve(base64);
      }).catch(err => {
        if (tempEl.parentNode) document.body.removeChild(tempEl);
        reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function openEmailModal(docObj, docType) {
  _emailDocRef = { docObj, docType, pdfBase64: null };
  const ci = getCompanyInfo();
  const LABELS = { rfq:'견적요청', po:'구매발주', statement:'거래명세표', tax:'세금계산서', quote:'견적서', order:'수주확인서' };
  const subject = `[${LABELS[docType]||'문서'}] ${docObj.id} — ${docObj.itemName||''}`;
  let body;
  if (docType === 'rfq')      body = buildRfqEmailBody(docObj, ci);
  else if (docType === 'po')  body = buildPoEmailBody(docObj, ci);
  else                        body = buildSalesEmailBody(docObj, ci, LABELS[docType] || '문서');
  inp('em-to').value      = docObj.supplierEmail || docObj.clientEmail || '';
  inp('em-subject').value = subject;
  inp('em-body').value    = body;

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
    showToast('이메일에 발주서 PDF 파일이 성공적으로 조립되어 첨부되었습니다.', 'success');
  }).catch(err => {
    console.error('PDF 조립 실패:', err);
    inp('em-attachment-status').textContent = 'PDF 첨부 실패 (메일본문 전송)';
    inp('em-attachment-status').style.color = 'var(--tx-d)';
    inp('em-attachment-spinner').style.display = 'none';
    inp('email-submit-btn').disabled = false;
    showToast('PDF 파일 생성 중 오류가 발생했으나, 메일 본문은 발송이 가능합니다: ' + err.message, 'error');
  });
}

function buildRfqEmailBody(r, ci) {
  const client = getClientName(r.clientId) || '—';
  const prod   = r.productId ? getProductName(r.productId) : '—';
  return `안녕하세요, ${r.supplier} 담당자님.

${ci.name} ${ci.dept}입니다.

아래 품목에 대한 견적을 요청드립니다.

─────────────────────────────
문서번호: ${r.id}
요청일자: ${r.date}
관련 프로젝트: ${client} — ${prod}
─────────────────────────────
품목명: ${r.itemName}
규격/사양: ${r.spec || '—'}
수량: ${r.qty} ${r.unit}
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
  const amt    = p.unitPrice ? '₩' + Number(p.unitPrice * p.qty).toLocaleString('ko-KR') : '미기재';
  return `안녕하세요, ${p.supplier} 담당자님.

${ci.name} ${ci.dept}입니다.

아래 품목에 대하여 발주하오니 납기일에 맞추어 납품해 주시기 바랍니다.

─────────────────────────────
발주번호: ${p.id}
발행일자: ${p.date}
관련 프로젝트: ${client} — ${prod}
─────────────────────────────
품목명: ${p.itemName}
규격/사양: ${p.spec || '—'}
수량: ${p.qty} ${p.unit}
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

function doMailto() {
  const to = v('em-to');
  if (!to) { showToast('수신 이메일을 입력하세요.', 'error'); return; }
  showToast('안내: 메일 앱 발송 시 브라우저 보안 제약으로 PDF 첨부파일이 누락될 수 있으므로 EmailJS 직접 발송을 권장합니다.', 'info');
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(v('em-subject'))}&body=${encodeURIComponent(v('em-body'))}`;
  window.open(url, '_blank');
}

async function doEmailJS() {
  const cfg = getEmailjsConfig();
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    showToast('EmailJS 설정이 필요합니다.', 'error');
    closeModal('email-send-modal');
    openEmailjsSettings();
    return;
  }
  const to = v('em-to');
  if (!to) { showToast('수신 이메일을 입력하세요.', 'error'); return; }
  const ci = getCompanyInfo();
  try {
    showToast('이메일 및 PDF 전송 중...', 'info');
    
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
    closeModal('email-send-modal');
    showToast('이메일이 PDF 파일과 함께 발송되었습니다.', 'success');
    
    if (_emailDocRef) {
      const { docObj, docType } = _emailDocRef;
      if (docType === 'rfq') {
        const r = rfqList.find(x => x.id === docObj.id);
        if (r && r.status === '요청전') { r.status = '요청중'; saveStorage('rfqList', rfqList); renderRfq(); }
      } else {
        const p = poList.find(x => x.id === docObj.id);
        if (p && p.status === '작성중') { p.status = '발송완료'; saveStorage('poList', poList); renderPo(); }
      }
    }
  } catch(e) {
    showToast('발송 실패: ' + (e.text || e.message || '알 수 없는 오류'), 'error');
  }
}
