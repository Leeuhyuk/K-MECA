/* ════════ 인쇄 공통 스타일 ════════ */
function _docPrintStyle() {
  return `<style>
    @page{size:A4;margin:0;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;padding:0;color:#111;font-size:12px;}
    .doc-header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid #1a3a6e;padding-bottom:12px;margin-bottom:20px;}
    .co-name{font-size:16px;font-weight:800;color:#1a3a6e;}
    .co-detail{font-size:9.5px;color:#777;margin-top:2px;}
    .doc-title{font-size:24px;font-weight:900;color:#1a3a6e;letter-spacing:.12em;text-align:right;}
    .doc-no{font-size:11px;color:#555;text-align:right;margin-top:4px;font-weight:600;}
    .approval-box{display:flex;border:1px solid #bbb;width:fit-content;margin-left:auto;margin-bottom:16px;}
    .apv-cell{width:60px;border-right:1px solid #bbb;text-align:center;}
    .apv-cell:last-child{border-right:none;}
    .apv-title{font-size:9px;font-weight:700;background:#fff;color:#555;padding:3px 0;border-bottom:1px solid #bbb;}
    .apv-sign{height:40px;}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;}
    th,td{border:1px solid #ccc;padding:6px 9px;vertical-align:middle;}
    .info-tbl th{background:#fff;font-weight:700;color:#333;width:100px;text-align:left;font-size:11px;}
    .info-tbl td{font-size:12px;}
    .info-tbl .hl{font-weight:800;font-size:13px;color:#1a3a6e;}
    .sec-title{font-size:10px;font-weight:800;color:#1a3a6e;letter-spacing:.05em;background:#fff;border-left:4px solid #1a3a6e;padding:5px 9px;margin-bottom:0;}
    .items-tbl th{background:#fff;color:#1a3a6e;font-size:10px;font-weight:700;text-align:center;padding:7px 6px;}
    .items-tbl td{font-size:11px;padding:7px 6px;}
    .items-tbl tbody tr:nth-child(even) td{background:#fff;}
    .num{text-align:right;} .ctr{text-align:center;}
    .total-row td{background:#fff;font-weight:800;border-top:2px solid #1a3a6e;}
    .empty-row td{color:#ccc;font-size:10px;text-align:center;height:24px;}
    .sum-wrap{display:flex;justify-content:flex-end;margin-bottom:16px;}
    .sum-box{border:2px solid #1a3a6e;border-radius:5px;overflow:hidden;min-width:280px;}
    .sum-row{display:flex;border-bottom:1px solid #dde;font-size:11px;}
    .sum-row:last-child{border-bottom:none;}
    .sum-lbl{padding:7px 14px;background:#fff;font-weight:700;color:#555;flex:0 0 110px;}
    .sum-val{padding:7px 14px;font-weight:700;text-align:right;flex:1;}
    .sum-final .sum-lbl{background:#fff;color:#1a3a6e;font-size:12px;}
    .sum-final .sum-val{font-size:14px;font-weight:900;color:#1a3a6e;}
    .remarks{border:1px solid #ccc;border-radius:4px;padding:10px 12px;font-size:10.5px;color:#444;line-height:1.8;margin-bottom:20px;background:#fff;}
    .remarks-title{font-weight:800;color:#1a3a6e;font-size:10px;margin-bottom:5px;letter-spacing:.04em;}
    .sign-area{display:flex;justify-content:space-between;align-items:flex-end;}
    .sign-left{font-size:10px;color:#777;line-height:1.8;}
    .sign-right{display:flex;gap:12px;}
    .sign-box{border:1px solid #bbb;border-radius:3px;text-align:center;padding:6px 0 0;min-width:82px;}
    .sign-title{font-size:9.5px;font-weight:700;color:#555;margin-bottom:3px;}
    .sign-content{height:46px;border-top:1px solid #ddd;display:flex;align-items:center;justify-content:center;font-size:9px;color:#ccc;}
    @media print{body{padding:20px 24px;}}
  </style>`;
}

/* ╦╦╦╦╦╦╦╦ 견적요청서 (RFQ) ╦╦╦╦╦╦╦╦ */
function renderRfq() {
  ensureDateView('rfq', 'rfq-table', rfqList.map(r=>r.date), renderRfq);
  const total   = rfqList.length;
  const pending = rfqList.filter(r => r.status === '요청중').length;
  const replied = rfqList.filter(r => r.status === '회신완료').length;
  const adopted = rfqList.filter(r => r.status === '채택').length;
  inp('rfq-kpi-total').textContent   = total   + '건';
  inp('rfq-kpi-pending').textContent = pending + '건';
  inp('rfq-kpi-replied').textContent = replied + '건';
  inp('rfq-kpi-adopted').textContent = adopted + '건';
  _kpiActive('rfq-fs', {'요청중':'rfq-kpi-pending','회신완료':'rfq-kpi-replied','채택':'rfq-kpi-adopted'});

  const badge = inp('rfqBadge');
  if (badge) { badge.textContent = pending; badge.style.display = pending ? '' : 'none'; }

  const fcSel = inp('rfq-fc');
  if (fcSel) {
    const cur = fcSel.value;
    fcSel.innerHTML = '<option value="">전체 고객사</option>' +
      clients.map(c => `<option value="${c.id}"${c.id===cur?' selected':''}>${c.name}</option>`).join('');
  }

  const fc = v('rfq-fc'), fs = v('rfq-fs'), q = v('rfq-q').toLowerCase();
  const rows = rfqList.filter(r => {
    if (!dateViewMatch('rfq', r.date)) return false;
    if (fc && r.clientId !== fc) return false;
    if (fs && r.status !== fs)   return false;
    if (q && !r.itemName.toLowerCase().includes(q) && !r.supplier.toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.rfq.key) {
    const k = sortState.rfq.key, asc = sortState.rfq.asc ? 1 : -1;
    rows.sort((a, b) => {
      let va, vb;
      if (k === 'client') { va = getClientName(a.clientId); vb = getClientName(b.clientId); }
      else if (k === 'product') { va = getProductName(a.productId); vb = getProductName(b.productId); }
      else { va = a[k] == null ? '' : a[k]; vb = b[k] == null ? '' : b[k]; }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const cont = inp('rfq-table');
  if (!rows.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-inbox"></i>해당 조건의 견적요청서가 없습니다.</div>';
    return;
  }
  const _rfqth = (k, l) => `<th onclick="toggleSort('rfq','${k}')" style="cursor:pointer;user-select:none;">${l} ${sortIcon('rfq',k)}</th>`;
  cont.innerHTML = `<table style="min-width:980px;">
    <thead><tr>
      ${_rfqth('id','문서번호')}${_rfqth('date','요청일')}${_rfqth('client','고객사')}${_rfqth('product','연결제품')}
      ${_rfqth('supplier','공급처')}${_rfqth('itemName','품목명')}<th>규격</th>${_rfqth('qty','수량')}
      ${_rfqth('targetPrice','희망단가')}${_rfqth('status','상태')}<th>비고</th><th>관리</th>
    </tr></thead>
    <tbody>${rows.map(r => `
      <tr>
        <td style="font-weight:700;color:var(--tx-i);">${r.id}</td>
        <td>${r.date}</td>
        <td>${getClientName(r.clientId)||'—'}</td>
        <td style="font-size:11px;">${r.productId?getProductName(r.productId):'—'}</td>
        <td style="font-weight:600;">${r.supplier}${r.supplierEmail?`<br><span style="font-size:10px;color:var(--tx-t);">${r.supplierEmail}</span>`:''}</td>
        <td style="font-weight:700;">${r.itemName}</td>
        <td style="font-size:11px;color:var(--tx-t);">${r.spec||'—'}</td>
        <td>${r.qty} ${r.unit}</td>
        <td>${r.targetPrice?'₩'+Number(r.targetPrice).toLocaleString('ko-KR'):'—'}</td>
        <td><select class="stat-sel" onchange="changeRfqStatus('${r.id}',this.value)" style="color:${rfqStatusColor(r.status)}">
          ${['요청전','요청중','회신완료','채택','미채택'].map(s=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}
        </select></td>
        <td style="font-size:11px;color:var(--tx-t);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.note||''}">${r.note||'—'}</td>
        <td style="white-space:nowrap;">
          <button class="edit-btn" onclick="openRfqEdit('${r.id}')"><i class="ti ti-edit"></i>수정</button>
          <button class="btn btn-sm" style="margin-left:3px;" onclick="openRfqPrint('${r.id}')" title="PDF 출력"><i class="ti ti-printer"></i></button>
          <button class="btn btn-sm" style="margin-left:3px;border-color:var(--br-ok);color:var(--tx-ok);" onclick="exportRfqXLS('${r.id}')" title="엑셀 다운로드"><i class="ti ti-file-spreadsheet"></i></button>
          <button class="btn btn-sm drive-save-btn" style="margin-left:3px;" onclick="saveDocumentBundleToGoogleDrive('rfq','${r.id}')" title="PDF/XLSX Google Drive 저장"><i class="ti ti-cloud-upload"></i>Drive</button>
          <button class="btn btn-sm" style="margin-left:3px;border-color:var(--br-i);color:var(--tx-i);" onclick="openEmailModal(rfqList.find(x=>x.id==='${r.id}'),'rfq')" title="이메일 발송"><i class="ti ti-mail"></i></button>
          <button class="del-btn" style="margin-left:3px;" onclick="deleteRfq('${r.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function rfqStatusColor(s) {
  const m = { '요청중':'var(--tx-i)', '회신완료':'var(--tx-ok)', '채택':'var(--tx-w)', '미채택':'var(--tx-d)' };
  return m[s] || 'var(--tx-s)';
}

function openRfqAdd() {
  try {
    const modal = inp('rfq-modal');
      delete modal.dataset.editId;
      inp('rfq-modal-ttl').innerHTML = '<i class="ti ti-file-description" style="color:var(--tx-i);"></i>견적요청서 등록';
      inp('rq-id').value     = nextDocCode('Q', rfqList);
      inp('rq-date').value   = today();
      inp('rq-status').value = '요청전';
      _syncRfqClientDropdown('');
      inp('rq-product').innerHTML = '<option value="">-- 선택 --</option>';
      ['rq-supplier','rq-semail','rq-item','rq-spec','rq-note'].forEach(id => { if(inp(id)) inp(id).value = ''; });
      inp('rq-qty').value = '1'; inp('rq-unit').value = 'EA';
      if(inp('rq-target')) inp('rq-target').value = '';
      inp('rfq-save-btn').onclick = saveRfqForm;
      modal.classList.add('open');
  } catch(e) {
    console.error('openRfqAdd 오류:', e);
    showToast('팝업 오류: ' + e.message, 'error');
  }
}

function _syncRfqClientDropdown(selId) {
  inp('rq-client').innerHTML = '<option value="">-- 선택 --</option>' +
    clients.map(c => `<option value="${c.id}"${c.id===selId?' selected':''}>${c.name}</option>`).join('');
  onRfqClientChange();
}

function onRfqClientChange() {
  const cid = v('rq-client');
  inp('rq-product').innerHTML = '<option value="">-- 선택 --</option>' +
    products.filter(p => !cid || p.clientId === cid).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function saveRfqForm() {
  if (!checkAdminAction()) return;
  const modal = inp('rfq-modal');
  const editId = modal.dataset.editId;
  if (!v('rq-supplier')) { showToast('공급처를 입력하세요.', 'error'); return; }
  if (!v('rq-item'))     { showToast('품목명을 입력하세요.', 'error'); return; }
  if (editId) {
    const idx = rfqList.findIndex(r => r.id === editId);
    if (idx !== -1) rfqList[idx] = { ...rfqList[idx], ...buildRfqObj(editId) };
    delete modal.dataset.editId;
  } else {
    rfqList.unshift(buildRfqObj(v('rq-id')));
  }
  saveStorage('rfqList', rfqList);
  closeModal('rfq-modal');
  renderRfq();
  showToast(editId ? '견적요청서가 수정되었습니다.' : '견적요청서가 등록되었습니다.');
}

function buildRfqObj(id) {
  return {
    id, date: v('rq-date')||today(),
    clientId: v('rq-client'), productId: v('rq-product'),
    supplier: v('rq-supplier'), supplierEmail: v('rq-semail')||'',
    itemName: v('rq-item'), spec: v('rq-spec'),
    qty: Number(v('rq-qty'))||1, unit: v('rq-unit')||'EA',
    targetPrice: Number(v('rq-target'))||0,
    status: v('rq-status')||'요청전', note: v('rq-note')
  };
}

function openRfqEdit(id) {
  const r = rfqList.find(x => x.id === id);
  if (!r) return;
  const modal = inp('rfq-modal');
  modal.dataset.editId = id;
  inp('rfq-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>견적요청서 수정';
  inp('rq-id').value = r.id; inp('rq-date').value = r.date;
  inp('rq-status').value = r.status;
  _syncRfqClientDropdown(r.clientId);
  inp('rq-client').value = r.clientId; onRfqClientChange();
  inp('rq-product').value = r.productId||'';
  inp('rq-supplier').value = r.supplier; inp('rq-semail').value = r.supplierEmail||'';
  inp('rq-item').value = r.itemName; inp('rq-spec').value = r.spec||'';
  inp('rq-qty').value = r.qty; inp('rq-unit').value = r.unit;
  if(inp('rq-target')) inp('rq-target').value = r.targetPrice||'';
  inp('rq-note').value = r.note||'';
  modal.classList.add('open');
}

function cloneRfq(id) {
  if (!checkAdminAction()) return;
  const r = rfqList.find(x => x.id === id); if (!r) return;
  const modal = inp('rfq-modal');
  delete modal.dataset.editId;
  inp('rfq-modal-ttl').innerHTML = '<i class="ti ti-copy" style="color:var(--tx-i);"></i>견적요청서 복제 등록';
  inp('rq-id').value = nextDocCode('Q', rfqList);
  inp('rq-date').value = today();
  inp('rq-status').value = '요청전';
  _syncRfqClientDropdown(r.clientId);
  inp('rq-client').value = r.clientId; onRfqClientChange();
  inp('rq-product').value = r.productId||'';
  inp('rq-supplier').value = r.supplier||''; inp('rq-semail').value = r.supplierEmail||'';
  inp('rq-item').value = r.itemName||''; inp('rq-spec').value = r.spec||'';
  inp('rq-qty').value = r.qty||1; inp('rq-unit').value = r.unit||'EA';
  if (inp('rq-target')) inp('rq-target').value = r.targetPrice||'';
  inp('rq-note').value = r.note||'';
  inp('rfq-save-btn').onclick = saveRfqForm;
  modal.classList.add('open');
}

function changeRfqStatus(id, val) {
  const r = rfqList.find(x => x.id === id);
  if (!r) return;
  r.status = val; saveStorage('rfqList', rfqList); renderRfq();
}

function convertRfqToPo(ids) {
  if (!checkAdminAction()) return;
  const idList = Array.isArray(ids) ? ids : [ids];
  const targets = idList.map(id => rfqList.find(r => r.id === id)).filter(Boolean);
  if (!targets.length) {
    showToast('구매발주서로 보낼 견적요청서가 없습니다.', 'info');
    return;
  }

  const existing = new Set(poList.map(p => p.sourceRfqId).filter(Boolean));
  const fresh = targets.filter(r => !existing.has(r.id));
  const skipped = targets.length - fresh.length;
  if (!fresh.length) {
    showToast('이미 구매발주서로 생성된 견적요청서입니다.', 'info');
    return;
  }

  const suffix = skipped ? `\n이미 생성된 ${skipped}건은 제외됩니다.` : '';
  if (!confirm(`${fresh.length}건의 견적요청서를 구매발주서로 생성하시겠습니까?${suffix}`)) return;

  fresh.forEach(r => {
    poList.unshift({
      id: nextDocCode('P', poList),
      date: today(),
      clientId: r.clientId || '',
      productId: r.productId || '',
      supplier: r.supplier || '',
      supplierEmail: r.supplierEmail || '',
      itemName: r.itemName || '',
      spec: r.spec || '',
      qty: Number(r.qty) || 1,
      unit: r.unit || 'EA',
      unitPrice: Number(r.targetPrice) || 0,
      payMethod: '현금',
      dlvMethod: '직납',
      status: '작성중',
      note: `견적요청서 ${r.id}에서 생성${r.note ? ' - ' + r.note : ''}`,
      sourceRfqId: r.id
    });
    if (r.status !== '미채택') r.status = '채택';
  });

  saveStorage('poList', poList);
  saveStorage('rfqList', rfqList);
  renderRfq();
  if (typeof renderPo === 'function') renderPo();
  showToast(`구매발주서 ${fresh.length}건이 생성되었습니다.${skipped ? ` 중복 ${skipped}건 제외` : ''}`);
}

function deleteRfq(id) {
  if (!checkAdminAction()) return;
  if (!confirm('이 견적요청서를 삭제하시겠습니까?')) return;
  rfqList = rfqList.filter(r => r.id !== id);
  saveStorage('rfqList', rfqList); renderRfq();
  showToast('견적요청서가 삭제되었습니다.');
}

function openRfqPrint(id) {
  const targets = id ? [rfqList.find(x=>x.id===id)].filter(Boolean)
                     : rfqList.filter(r => r.status !== '미채택');
  if (!targets.length) { showToast('출력할 견적요청서가 없습니다.', 'error'); return; }
  const ci = getCompanyInfo();
  const pages = targets.map(r => {
    const client = getClientName(r.clientId)||'—';
    const prod   = r.productId ? getProductName(r.productId) : '—';
    const tgt    = r.targetPrice;
    const amt    = tgt ? Number(tgt*r.qty).toLocaleString('ko-KR') : '—';
    const vat    = tgt ? Number(Math.round(tgt*r.qty*0.1)).toLocaleString('ko-KR') : '—';
    const tot    = tgt ? Number(Math.round(tgt*r.qty*1.1)).toLocaleString('ko-KR') : '—';
    return `
    <div style="page-break-after:always;">
      <div class="approval-box">
        <div class="apv-cell"><div class="apv-title">담 당</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">팀 장</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">대 표</div><div class="apv-sign"></div></div>
      </div>
      <div class="doc-header">
        <div>
          <div class="co-name">${ci.name}</div>
          <div class="co-detail">${ci.address}${ci.tel?' | TEL. '+ci.tel:''}${ci.fax?' | FAX. '+ci.fax:''}</div>
          ${ci.bizNo?`<div class="co-detail">사업자등록번호: ${ci.bizNo}${ci.ceo?' | 대표이사: '+ci.ceo:''}</div>`:''}
        </div>
        <div><div class="doc-title">견 적 요 청 서</div><div class="doc-no">문서번호 &nbsp; ${r.id}</div></div>
      </div>
      <table class="info-tbl">
        <tr><th>수 신</th><td class="hl" colspan="3">${r.supplier} 귀중</td></tr>
        <tr><th>발 신</th><td>${ci.name} ${ci.dept}</td><th style="width:90px;">발행일자</th><td>${r.date}</td></tr>
        <tr><th>관련 프로젝트</th><td colspan="3">${client} — ${prod}</td></tr>
        ${ci.tel?`<tr><th>담당 연락처</th><td colspan="3">${ci.dept} ${ci.tel}</td></tr>`:''}
      </table>
      <div class="sec-title">■ 견적 요청 품목</div>
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
      <div class="remarks">
        <div class="remarks-title">◆ 특기사항 및 요청조건</div>
        1. 상기 품목에 대하여 견적을 요청드리오니 회신 기한 내 견적서를 제출해 주시기 바랍니다.<br>
        2. 견적가격은 납품지 기준 공급가(VAT 별도)로 기재 바랍니다.<br>
        3. 납품 가능 수량 및 납기일을 반드시 명시하여 주시기 바랍니다.
      </div>
      <div class="sign-area">
        <div class="sign-left">본 견적요청서는 구매 의사의 표명이 아니며,<br>견적 내용은 최종 발주 시 변경될 수 있습니다.</div>
        <div class="sign-right">
          <div class="sign-box"><div class="sign-title">작 성</div><div class="sign-content">(인)</div></div>
          <div class="sign-box"><div class="sign-title">검 토</div><div class="sign-content">(인)</div></div>
          <div class="sign-box"><div class="sign-title">승 인</div><div class="sign-content">(인)</div></div>
        </div>
      </div>
    </div>`;
  }).join('');
  const docTitle = id ? id : '견적요청서_목록';
  openDocumentPdfPreview(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${docTitle}</title>${_docPrintStyle()}</head><body>${pages}</body></html>`,
    docTitle
  );
}

function exportRfqXLS(id = null) {
  const targets = id ? rfqList.filter(r => r.id === id) : rfqList;
  if (!targets.length) { showToast('내보낼 데이터가 없습니다.', 'error'); return; }
  const ci = getCompanyInfo();
  const wb = XLSX.utils.book_new();
  const hdr = ['문서번호','요청일','고객사','연결제품','공급처','공급처이메일','품목명','규격/사양','수량','단위','희망단가','희망금액','상태','비고'];
  const rows = targets.map(r => [
    r.id, r.date, getClientName(r.clientId)||'', r.productId?getProductName(r.productId):'',
    r.supplier, r.supplierEmail||'', r.itemName, r.spec||'', r.qty, r.unit,
    r.targetPrice||0, (r.targetPrice||0)*r.qty, r.status, r.note||''
  ]);
  const titleText = id ? `${ci.name} — 견적요청서 (${id})` : `${ci.name} — 견적요청서 목록`;
  const ws = XLSX.utils.aoa_to_sheet([
    [titleText],
    ['출력일: ' + today()],
    [],
    hdr,
    ...rows
  ]);
  ws['!cols'] = [10,10,10,12,14,12,18,14,12,6,6,10,10,8,14].map(w=>({wch:w}));
  ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:14} }];
  XLSX.utils.book_append_sheet(wb, ws, id ? id : '견적요청서');
  const fileName = id ? `${id}.xlsx` : `견적요청서_${today()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(id ? `엑셀 견적요청서(${id})가 다운로드되었습니다.` : '엑셀 파일이 저장되었습니다.');
}

/* ╦╦╦╦╦╦╦╦ 구매발주서 (PO) ╦╦╦╦╦╦╦╦ */
function renderPo() {
  ensureDateView('po', 'po-table', poList.map(p=>p.date), renderPo);
  const total  = poList.length;
  const sent   = poList.filter(p => p.status === '발송완료').length;
  const done   = poList.filter(p => p.status === '입고완료').length;
  const amt    = poList.reduce((s, p) => s + (p.unitPrice||0)*p.qty, 0);
  inp('po-kpi-total').textContent = total + '건';
  inp('po-kpi-sent').textContent  = sent  + '건';
  inp('po-kpi-done').textContent  = done  + '건';
  inp('po-kpi-amt').textContent   = '₩' + amt.toLocaleString('ko-KR');
  _kpiActive('po-fs', {'발송완료':'po-kpi-sent','입고완료':'po-kpi-done'});

  const badge = inp('poBadge');
  if (badge) {
    const pending = poList.filter(p => p.status === '작성중').length;
    badge.textContent = pending; badge.style.display = pending ? '' : 'none';
  }

  const fcSel = inp('po-fc');
  if (fcSel) {
    const cur = fcSel.value;
    fcSel.innerHTML = '<option value="">전체 고객사</option>' +
      clients.map(c => `<option value="${c.id}"${c.id===cur?' selected':''}>${c.name}</option>`).join('');
  }

  const fc = v('po-fc'), fs = v('po-fs'), q = v('po-q').toLowerCase();
  const rows = poList.filter(p => {
    if (!dateViewMatch('po', p.date)) return false;
    if (fc && p.clientId !== fc) return false;
    if (fs && p.status !== fs)   return false;
    if (q && !p.itemName.toLowerCase().includes(q) && !p.supplier.toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortState.po.key) {
    const k = sortState.po.key, asc = sortState.po.asc ? 1 : -1;
    rows.sort((a, b) => {
      let va, vb;
      if (k === 'client') { va = getClientName(a.clientId); vb = getClientName(b.clientId); }
      else if (k === 'product') { va = getProductName(a.productId); vb = getProductName(b.productId); }
      else if (k === 'totalAmt') { va = (Number(a.unitPrice)||0)*(Number(a.qty)||0); vb = (Number(b.unitPrice)||0)*(Number(b.qty)||0); }
      else { va = a[k] == null ? '' : a[k]; vb = b[k] == null ? '' : b[k]; }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * asc;
      return String(va).localeCompare(String(vb), 'ko-KR') * asc;
    });
  }

  const cont = inp('po-table');
  if (!rows.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-inbox"></i>해당 조건의 구매발주서가 없습니다.</div>';
    poUpdateBulkBar();
    return;
  }
  const _poth = (k, l) => `<th onclick="toggleSort('po','${k}')" style="cursor:pointer;user-select:none;">${l} ${sortIcon('po',k)}</th>`;
  cont.innerHTML = `<table style="min-width:1130px;">
    <thead><tr>
      <th style="width:24px;padding:6px 3px;text-align:center;"><input type="checkbox" id="po-check-all" onclick="poToggleAll(this.checked)" style="width:12px;height:12px;cursor:pointer;vertical-align:middle;"></th>
      ${_poth('id','발주번호')}${_poth('date','발행일')}${_poth('client','고객사')}${_poth('product','연결제품')}
      ${_poth('supplier','공급처')}${_poth('itemName','품목명')}<th>규격</th>${_poth('qty','수량')}
      ${_poth('unitPrice','단가')}${_poth('totalAmt','금액')}<th>결제조건</th><th>납품방법</th>${_poth('status','상태')}<th>비고</th>
    </tr></thead>
    <tbody>${rows.map(p => `
      <tr onclick="poRowClick(event,'${p.id}')">
        <td style="text-align:center;padding:6px 3px;"><input type="checkbox" class="po-check" value="${p.id}" onclick="event.stopPropagation()" onchange="poUpdateBulkBar()" style="width:12px;height:12px;cursor:pointer;vertical-align:middle;"></td>
        <td style="font-weight:700;color:var(--tx-i);">${p.id}</td>
        <td>${p.date}</td>
        <td>${getClientName(p.clientId)||'—'}</td>
        <td style="font-size:11px;">${p.productId?getProductName(p.productId):'—'}</td>
        <td style="font-weight:600;">${p.supplier}${p.supplierEmail?`<br><span style="font-size:10px;color:var(--tx-t);">${p.supplierEmail}</span>`:''}</td>
        <td style="font-weight:700;">${p.itemName}</td>
        <td style="font-size:11px;color:var(--tx-t);">${p.spec||'—'}</td>
        <td>${p.qty} ${p.unit}</td>
        <td>${p.unitPrice?'₩'+Number(p.unitPrice).toLocaleString('ko-KR'):'—'}</td>
        <td style="font-weight:700;color:var(--tx-i);">${p.unitPrice?'₩'+Number(p.unitPrice*p.qty).toLocaleString('ko-KR'):'—'}</td>
        <td><span class="bd bd-neu">${p.payMethod||'현금'}</span></td>
        <td><span class="bd bd-info">${p.dlvMethod||'직납'}</span></td>
        <td><select class="stat-sel" onclick="event.stopPropagation()" onchange="changePoStatus('${p.id}',this.value)" style="color:${poStatusColor(p.status)}">
          ${['작성중','발송완료','확인완료','입고완료'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
        </select></td>
        <td style="font-size:11px;color:var(--tx-t);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.note||''}">${p.note||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
  poUpdateBulkBar();
}
/* ── 구매발주서 선택 일괄 동작 ── */
function poCheckedIds(){ return [...document.querySelectorAll('#po-table .po-check:checked')].map(c=>c.value); }
function poRowClick(event, id){
  if (event.target.closest('button,input,select,textarea,a')) return;
  const cb = [...document.querySelectorAll('#po-table .po-check')].find(c => c.value === id);
  if (!cb) return;
  cb.checked = !cb.checked;
  poUpdateBulkBar();
}
function poToggleAll(checked){
  document.querySelectorAll('#po-table .po-check').forEach(c=>c.checked=checked);
  poUpdateBulkBar();
}
function poSelectionBarHtml(count){
  return `<span class="date-view-selection-count"><i class="ti ti-checkbox"></i> ${count}건 선택됨</span>
    <button class="btn btn-sm" data-edit onclick="poBulkEdit()"><i class="ti ti-edit"></i>수정</button>
    <button class="btn btn-sm" data-clone onclick="poBulkClone()"><i class="ti ti-copy"></i>복제</button>
    <button class="btn btn-sm" onclick="poBulkPrint()"><i class="ti ti-printer"></i>PDF 출력</button>
    <button class="btn btn-sm" onclick="poBulkExport()"><i class="ti ti-file-spreadsheet"></i>엑셀</button>
    <button class="btn btn-sm drive-save-btn" onclick="poBulkDrive()"><i class="ti ti-cloud-upload"></i>Drive 저장</button>
    <button class="btn btn-sm" onclick="poBulkEmail()"><i class="ti ti-mail"></i>이메일</button>
    <button class="btn btn-sm btn-danger" onclick="poBulkDelete()"><i class="ti ti-trash"></i>삭제</button>
    <button class="btn btn-sm date-view-clear-selection" onclick="poToggleAll(false)"><i class="ti ti-x"></i>해제</button>`;
}
function ensurePoDateSelectionClearer(){
  if (ensurePoDateSelectionClearer.done || typeof registerDateViewSelectionClearer !== 'function') return;
  ensurePoDateSelectionClearer.done = true;
  registerDateViewSelectionClearer('po', function(){ poToggleAll(false); });
}
function poUpdateBulkBar(){
  ensurePoDateSelectionClearer();
  const ids=poCheckedIds(), bar=inp('po-bulkbar');
  const slotted = typeof setDateViewSelectionBar === 'function' && setDateViewSelectionBar('po', poSelectionBarHtml(ids.length), ids.length > 0);
  if(bar){ bar.style.display = (!slotted && ids.length) ? 'flex' : 'none'; const cnt=inp('po-sel-count'); if(cnt) cnt.textContent=ids.length; }
  [bar, inp('date-view-po')].filter(Boolean).forEach(scope => {
    const edit=scope.querySelector('[data-edit],#po-edit-btn'); if(edit) edit.style.display=ids.length===1?'':'none';
    const clone=scope.querySelector('[data-clone],#po-clone-btn'); if(clone) clone.style.display=ids.length===1?'':'none';
  });
  const all=inp('po-check-all');
  if(all){ const total=document.querySelectorAll('#po-table .po-check').length;
    all.checked = total>0 && ids.length===total; all.indeterminate = ids.length>0 && ids.length<total; }
}
function poBulkPrint(){ const ids=poCheckedIds(); if(!ids.length) return; openPoPrint(ids, true); }   // 선택 건은 건별 개별 출력
function poBulkEdit(){ const ids=poCheckedIds(); if(ids.length===1) openPoEdit(ids[0]); }
function poBulkClone(){ const ids=poCheckedIds(); if(ids.length===1) clonePo(ids[0]); }
function poBulkExport(){ const ids=poCheckedIds(); if(!ids.length) return; exportPoXLS(ids); }
function poBulkDrive(){ const ids=poCheckedIds(); if(!ids.length) return; saveDocumentBundleToGoogleDrive('po', ids); }
function poBulkEmail(){ const ids=poCheckedIds(); if(ids.length!==1){ showToast('이메일은 한 건만 선택해 발송하세요.','info'); return; } openEmailModal(poList.find(x=>x.id===ids[0]),'po'); }
function poBulkDelete(){
  const ids=poCheckedIds(); if(!ids.length) return;
  if(!checkAdminAction()) return;
  if(!confirm(ids.length+'건의 구매발주서를 삭제하시겠습니까?')) return;
  poList=poList.filter(p=>!ids.includes(p.id));
  saveStorage('poList', poList); renderPo();
  showToast(ids.length+'건이 삭제되었습니다.');
}

function poStatusColor(s) {
  const m = { '발송완료':'var(--tx-i)', '확인완료':'var(--tx-w)', '입고완료':'var(--tx-ok)' };
  return m[s] || 'var(--tx-s)';
}

function openPoAdd() {
  try {
    const modal = inp('po-modal');
      delete modal.dataset.editId;
      inp('po-modal-ttl').innerHTML = '<i class="ti ti-file-invoice" style="color:var(--tx-i);"></i>구매발주서 등록';
      inp('po-id').value = nextDocCode('P', poList);
      inp('po-date').value = today(); inp('po-status').value = '작성중';
      _syncPoClientDropdown('');
      inp('po-product-sel').innerHTML = '<option value="">-- 선택 --</option>';
      ['po-supplier','po-semail','po-item','po-spec','po-note'].forEach(id => { if(inp(id)) inp(id).value = ''; });
      inp('po-qty').value = '1'; inp('po-unit').value = 'EA';
      if(inp('po-price')) inp('po-price').value = '';
      inp('po-pay').value = '현금'; inp('po-dlv').value = '직납';
      inp('po-save-btn').onclick = savePoForm;
      modal.classList.add('open');
  } catch(e) {
    console.error('openPoAdd 오류:', e);
    showToast('팝업 오류: ' + e.message, 'error');
  }
}

function _syncPoClientDropdown(selId) {
  inp('po-client-sel').innerHTML = '<option value="">-- 선택 --</option>' +
    clients.map(c => `<option value="${c.id}"${c.id===selId?' selected':''}>${c.name}</option>`).join('');
  onPoClientChange();
}

function onPoClientChange() {
  const cid = v('po-client-sel');
  inp('po-product-sel').innerHTML = '<option value="">-- 선택 --</option>' +
    products.filter(p => !cid || p.clientId === cid).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function savePoForm() {
  if (!checkAdminAction()) return;
  const modal = inp('po-modal');
  const editId = modal.dataset.editId;
  if (!v('po-supplier')) { showToast('공급처를 입력하세요.', 'error'); return; }
  if (!v('po-item'))     { showToast('품목명을 입력하세요.', 'error'); return; }
  if (editId) {
    const idx = poList.findIndex(p => p.id === editId);
    if (idx !== -1) poList[idx] = { ...poList[idx], ...buildPoObj(editId) };
    delete modal.dataset.editId;
  } else {
    poList.unshift(buildPoObj(v('po-id')));
  }
  saveStorage('poList', poList); closeModal('po-modal'); renderPo();
  showToast(editId ? '구매발주서가 수정되었습니다.' : '구매발주서가 등록되었습니다.');
}

function buildPoObj(id) {
  return {
    id, date: v('po-date')||today(),
    clientId: v('po-client-sel'), productId: v('po-product-sel'),
    supplier: v('po-supplier'), supplierEmail: v('po-semail')||'',
    itemName: v('po-item'), spec: v('po-spec'),
    qty: Number(v('po-qty'))||1, unit: v('po-unit')||'EA',
    unitPrice: Number(v('po-price'))||0,
    payMethod: v('po-pay')||'현금', dlvMethod: v('po-dlv')||'직납',
    status: v('po-status')||'작성중', note: v('po-note')
  };
}

function openPoEdit(id) {
  const p = poList.find(x => x.id === id);
  if (!p) return;
  const modal = inp('po-modal');
  modal.dataset.editId = id;
  inp('po-modal-ttl').innerHTML = '<i class="ti ti-edit" style="color:var(--tx-w);"></i>구매발주서 수정';
  inp('po-id').value = p.id; inp('po-date').value = p.date;
  inp('po-status').value = p.status;
  _syncPoClientDropdown(p.clientId);
  inp('po-client-sel').value = p.clientId; onPoClientChange();
  inp('po-product-sel').value = p.productId||'';
  inp('po-supplier').value = p.supplier; inp('po-semail').value = p.supplierEmail||'';
  inp('po-item').value = p.itemName; inp('po-spec').value = p.spec||'';
  inp('po-qty').value = p.qty; inp('po-unit').value = p.unit;
  if(inp('po-price')) inp('po-price').value = p.unitPrice||'';
  inp('po-pay').value = p.payMethod||'현금'; inp('po-dlv').value = p.dlvMethod||'직납';
  inp('po-note').value = p.note||'';
  modal.classList.add('open');
}

function clonePo(id) {
  if (!checkAdminAction()) return;
  const p = poList.find(x => x.id === id); if (!p) return;
  const modal = inp('po-modal');
  delete modal.dataset.editId;
  inp('po-modal-ttl').innerHTML = '<i class="ti ti-copy" style="color:var(--tx-i);"></i>구매발주서 복제 등록';
  inp('po-id').value = nextDocCode('P', poList);
  inp('po-date').value = today(); inp('po-status').value = '작성중';
  _syncPoClientDropdown(p.clientId);
  inp('po-client-sel').value = p.clientId; onPoClientChange();
  inp('po-product-sel').value = p.productId||'';
  inp('po-supplier').value = p.supplier||''; inp('po-semail').value = p.supplierEmail||'';
  inp('po-item').value = p.itemName||''; inp('po-spec').value = p.spec||'';
  inp('po-qty').value = p.qty||1; inp('po-unit').value = p.unit||'EA';
  if (inp('po-price')) inp('po-price').value = p.unitPrice||'';
  inp('po-pay').value = p.payMethod||'현금'; inp('po-dlv').value = p.dlvMethod||'직납';
  inp('po-note').value = p.note||'';
  inp('po-save-btn').onclick = savePoForm;
  modal.classList.add('open');
}

function changePoStatus(id, val) {
  const p = poList.find(x => x.id === id);
  if (!p) return;
  p.status = val; saveStorage('poList', poList); renderPo();
}

function deletePo(id) {
  if (!checkAdminAction()) return;
  if (!confirm('이 구매발주서를 삭제하시겠습니까?')) return;
  poList = poList.filter(p => p.id !== id);
  saveStorage('poList', poList); renderPo();
  showToast('구매발주서가 삭제되었습니다.');
}

function openPoPrint(id, individual=false) {
  const ids = Array.isArray(id) ? id : (id ? [id] : null);
  const targetList = ids ? ids.map(i=>poList.find(x=>x.id===i)).filter(Boolean)
                        : poList;   // 전체 출력: 입고완료 포함 모든 발주서
  if (!targetList.length) { showToast('출력할 발주서가 없습니다.', 'error'); return; }
  const ci = getCompanyInfo();
  const grouped = {};
  // individual=true: 건별 개별 페이지 / false: 공급처별로 묶음
  targetList.forEach(p => { const gkey = individual ? p.id : p.supplier; (grouped[gkey] = grouped[gkey] || []).push(p); });
  const pages = Object.entries(grouped).map(([supplier, items]) => {
    const total   = items.reduce((s, p) => s + (p.unitPrice||0)*p.qty, 0);
    const vat     = Math.round(total * 0.1);
    const grandTotal = total + vat;
    const refDate = items[0].date;
    const poNums  = [...new Set(items.map(p => p.id))].join(', ');
    return `
    <div style="page-break-after:always;">
      <div class="approval-box">
        <div class="apv-cell"><div class="apv-title">담 당</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">팀 장</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">이 사</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">대 표</div><div class="apv-sign"></div></div>
      </div>
      <div class="doc-header">
        <div>
          <div class="co-name">${ci.name}</div>
          <div class="co-detail">${ci.address}${ci.tel?' | TEL. '+ci.tel:''}${ci.fax?' | FAX. '+ci.fax:''}</div>
          ${ci.bizNo?`<div class="co-detail">사업자등록번호: ${ci.bizNo}${ci.ceo?' | 대표이사: '+ci.ceo:''}</div>`:''}
        </div>
        <div><div class="doc-title">구 매 발 주 서</div><div class="doc-no">발주번호 &nbsp; ${poNums}</div></div>
      </div>
      <table class="info-tbl">
        <tr><th>공급처(수신)</th><td class="hl" colspan="3">${supplier} 귀중</td></tr>
        <tr><th>발행일자</th><td colspan="3">${refDate}</td></tr>
        <tr><th>결제조건</th><td>${items[0].payMethod||'현금'}</td><th>납품방법</th><td>${items[0].dlvMethod||'직납'}</td></tr>
        <tr><th>납품지 주소</th><td colspan="3">${ci.address}</td></tr>
      </table>
      <div class="sec-title">■ 발주 품목</div>
      <table class="items-tbl">
        <thead><tr><th style="width:30px;">No.</th><th>품 목 명</th><th style="width:140px;">규 격 / 사 양</th>
        <th style="width:46px;">수량</th><th style="width:40px;">단위</th>
        <th style="width:100px;">단 가 (원)</th><th style="width:110px;">금 액 (원)</th><th>비 고</th></tr></thead>
        <tbody>
          ${items.map((p,i) => `<tr>
            <td class="ctr">${i+1}</td><td><strong>${p.itemName}</strong></td><td class="ctr">${p.spec||'—'}</td>
            <td class="ctr">${p.qty}</td><td class="ctr">${p.unit}</td>
            <td class="num">${p.unitPrice?Number(p.unitPrice).toLocaleString('ko-KR'):'—'}</td>
            <td class="num">${p.unitPrice?Number(p.unitPrice*p.qty).toLocaleString('ko-KR'):'—'}</td>
            <td style="font-size:10px;">${p.note||''}</td>
          </tr>`).join('')}
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
      <div class="remarks">
        <div class="remarks-title">◆ 특기사항 및 거래조건</div>
        1. 상기 품목에 대하여 발주하오니 납기일에 맞추어 납품하여 주시기 바랍니다.<br>
        2. 납품 시 반드시 거래명세표를 동봉하여 주시기 바랍니다.<br>
        3. 세금계산서는 납품 완료 후 익일 발행 바랍니다.
      </div>
      <div class="sign-area">
        <div class="sign-left">위와 같이 발주하며, 본 발주서가 계약 효력을 갖습니다.<br>${refDate}<br><strong>${ci.name}</strong></div>
        <div class="sign-right">
          <div class="sign-box"><div class="sign-title">작 성</div><div class="sign-content">(인)</div></div>
          <div class="sign-box"><div class="sign-title">검 토</div><div class="sign-content">(인)</div></div>
          <div class="sign-box"><div class="sign-title">대표이사</div><div class="sign-content">(인)</div></div>
        </div>
      </div>
    </div>`;
  }).join('');
  const docTitle = id ? id : '구매발주서_목록';
  openDocumentPdfPreview(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${docTitle}</title>${_docPrintStyle()}</head><body>${pages}</body></html>`,
    docTitle
  );
}

function exportPoXLS(id = null) {
  const ids = Array.isArray(id) ? id : (id ? [id] : null);
  const targets = ids ? poList.filter(p => ids.includes(p.id)) : poList;
  if (!targets.length) { showToast('내보낼 데이터가 없습니다.', 'error'); return; }
  const ci = getCompanyInfo();
  const wb = XLSX.utils.book_new();
  const hdr = ['발주번호','발행일','고객사','연결제품','공급처','공급처이메일','품목명','규격/사양','수량','단위','단가','금액','결제조건','납품방법','상태','비고'];
  const rows = targets.map(p => [
    p.id, p.date, getClientName(p.clientId)||'', p.productId?getProductName(p.productId):'',
    p.supplier, p.supplierEmail||'', p.itemName, p.spec||'', p.qty, p.unit,
    p.unitPrice||0, (p.unitPrice||0)*p.qty, p.payMethod||'현금', p.dlvMethod||'직납', p.status, p.note||''
  ]);
  const titleText = id ? `${ci.name} — 구매발주서 (${id})` : `${ci.name} — 구매발주서 목록`;
  const ws = XLSX.utils.aoa_to_sheet([
    [titleText],
    ['출력일: ' + today()],
    [],
    hdr,
    ...rows
  ]);
  ws['!cols'] = [12,10,10,12,14,12,18,14,12,6,6,10,10,8,8,8,14].map(w=>({wch:w}));
  ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:16} }];
  XLSX.utils.book_append_sheet(wb, ws, id ? id : '구매발주서');
  const fileName = id ? `${id}.xlsx` : `구매발주서_${today()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(id ? `엑셀 구매발주서(${id})가 다운로드되었습니다.` : '엑셀 파일이 저장되었습니다.');
}

/* ════════ 엑셀 가져오기 (견적요청서 / 구매발주서) ════════
   내보내기(exportRfqXLS/exportPoXLS) 형식의 파일을 그대로 다시 읽어들임.
   헤더명으로 열을 매칭하므로 열 순서가 달라도 동작. 고객사/연결제품은 이름으로 id 역매핑. */
function _pickXlsxFile(onPick) {
  const fi = document.createElement('input');
  fi.type = 'file'; fi.accept = '.xlsx,.xls,.csv'; fi.style.display = 'none';
  fi.onchange = () => { if (fi.files && fi.files[0]) onPick(fi.files[0]); fi.remove(); };
  document.body.appendChild(fi); fi.click();
}

function _readXlsxRows(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      cb(XLSX.utils.sheet_to_json(ws, { header:1, defval:'' }));
    } catch(err) { showToast('엑셀 읽기 실패: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function _numFrom(val) { return Number(String(val).replace(/[,₩\s원]/g, '')) || 0; }

function _importDocsXLS(cfg) {
  if (!checkAdminAction()) return;
  _pickXlsxFile(file => _readXlsxRows(file, aoa => {
    // 헤더 행 탐색: 식별 헤더 + '품목명' 이 함께 있는 행
    let hrow = -1, hdr = null;
    for (let i = 0; i < aoa.length; i++) {
      const row = aoa[i].map(c => String(c).trim());
      if (row.includes(cfg.idHeader) && row.includes('품목명')) { hrow = i; hdr = row; break; }
    }
    if (hrow < 0) { showToast(`헤더 행(${cfg.idHeader}/품목명)을 찾을 수 없습니다.`, 'error'); return; }
    const col = name => hdr.indexOf(name);
    const get = (row, name) => { const i = col(name); return i < 0 ? '' : String(row[i] ?? '').trim(); };
    const list = cfg.getList();
    let added = 0, skipped = 0;
    for (let r = hrow + 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || !row.length) continue;
      const itemName = get(row, '품목명'), supplier = get(row, '공급처');
      if (!itemName && !supplier) continue;                  // 빈 행 무시
      if (!itemName || !supplier) { skipped++; continue; }    // 필수값 누락 행
      const impId = get(row, cfg.idHeader);
      const id = (impId && !list.some(x => x.id === impId)) ? impId : nextDocCode(cfg.prefix, list);
      const clientName = get(row, '고객사'), productName = get(row, '연결제품');
      const obj = {
        id,
        date: get(row, cfg.dateHeader) || today(),
        clientId: clients.find(c => c.name === clientName)?.id || '',
        productId: products.find(p => p.name === productName)?.id || '',
        supplier, supplierEmail: get(row, '공급처이메일'),
        itemName, spec: get(row, '규격/사양'),
        qty: Number(get(row, '수량')) || 1, unit: get(row, '단위') || 'EA',
        status: get(row, '상태') || cfg.defaultStatus, note: get(row, '비고')
      };
      cfg.extra(obj, row, get);
      list.unshift(obj);
      added++;
    }
    if (added) { saveStorage(cfg.key, list); cfg.render(); }
    showToast(`${cfg.title} ${added}건 가져오기 완료${skipped ? ` (${skipped}건 건너뜀)` : ''}`, added ? 'success' : 'error');
  }));
}

function importRfqXLS() {
  _importDocsXLS({
    key:'rfqList', prefix:'Q', title:'견적요청서', idHeader:'문서번호', dateHeader:'요청일',
    defaultStatus:'요청전', getList:() => rfqList, render: renderRfq,
    extra:(obj, row, get) => { obj.targetPrice = _numFrom(get(row, '희망단가')); }
  });
}

function importPoListXLS() {
  _importDocsXLS({
    key:'poList', prefix:'P', title:'구매발주서', idHeader:'발주번호', dateHeader:'발행일',
    defaultStatus:'작성중', getList:() => poList, render: renderPo,
    extra:(obj, row, get) => {
      obj.unitPrice  = _numFrom(get(row, '단가'));
      obj.payMethod  = get(row, '결제조건') || '현금';
      obj.dlvMethod  = get(row, '납품방법') || '직납';
    }
  });
}

/* ════════ 엑셀 편집형 인쇄 양식 (견적요청서 / 구매발주서) ════════ */
const DOC_XLS_TEMPLATE_INFO = {
  rfq: { title:'견적요청서', file:'견적요청서_인쇄양식.xlsx' },
  po:  { title:'구매발주서', file:'구매발주서_인쇄양식.xlsx' },
  quote: { title:'견적서', file:'견적서_인쇄양식.xlsx' },
  statement: { title:'거래명세표', file:'거래명세표_인쇄양식.xlsx' },
  tax: { title:'세금계산서', file:'세금계산서_인쇄양식.xlsx' }
};
const DOC_TEMPLATE_PACKAGE_VERSION = 1;
const DOC_TEMPLATE_PACKAGE_TYPES = ['rfq','po','quote','statement','tax'];

function _requireTemplatePackageModules() {
  if (!_requireExcelJS()) return false;
  if (typeof JSZip === 'undefined') {
    showToast('ZIP 양식 패키지 모듈을 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.', 'error');
    return false;
  }
  return true;
}

function _downloadBlob(blob, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function _docTemplateVariableSchema() {
  return {
    version:1,
    common:['회사명','회사주소','회사전화','회사팩스','회사연락처','회사사업자정보','사업자번호','대표자','부서'],
    document:['문서번호','발행일','공급처','공급처이메일','고객사','고객이메일','연결제품','결제조건','납품방법','납품주소','상태','비고'],
    amounts:['공급가액','부가세','합계금액'],
    repeating:{
      pattern:['번호{n}','품목명{n}','규격{n}','수량{n}','단위{n}','단가{n}','금액{n}','품목비고{n}'],
      supportedItems:20
    }
  };
}

async function _validateDocTemplateBuffer(type, data) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`${DOC_XLS_TEMPLATE_INFO[type].title}: 첫 번째 시트가 없습니다.`);
  let text = '';
  ws.eachRow(row => row.eachCell(cell => { text += ' ' + String(cell.value ?? ''); }));
  if (!text.includes('{{문서번호}}') || !text.includes('{{품목명1}}')) {
    throw new Error(`${DOC_XLS_TEMPLATE_INFO[type].title}: {{문서번호}}와 {{품목명1}} 표시값이 필요합니다.`);
  }
}

function _docTemplatePackageReadme() {
  return `MESPro 공용 문서 양식 패키지

1. templates 폴더의 XLSX 파일은 Excel에서 직접 편집할 수 있습니다.
2. {{문서번호}}, {{품목명1}} 같은 변수는 삭제하지 말고 필요한 셀로 이동하세요.
3. schemas/variables.json은 다른 프로그램에서 데이터를 연결할 때 사용하는 변수 규격입니다.
4. print/print.css는 MESPro의 PDF 인쇄 색상, 표, 결재란과 A4 규격을 재현하기 위한 스타일입니다.
5. 수정한 패키지는 manifest.json과 파일명을 유지해야 MESPro에서 다시 가져올 수 있습니다.
6. MESPro에서 가져올 때 기존 사용자 양식은 자동으로 백업되며 '가져오기 전 양식 복원'으로 되돌릴 수 있습니다.
`;
}

async function exportDocTemplatePackage() {
  if (!_requireTemplatePackageModules()) return;
  const button = document.querySelector('[onclick="exportDocTemplatePackage()"]');
  if (button) { button.disabled = true; button.innerHTML = '<i class="ti ti-loader animate-spin"></i>패키지 생성 중'; }
  try {
    const zip = new JSZip();
    const store = _docTemplateStore();
    const files = [];
    for (const type of DOC_TEMPLATE_PACKAGE_TYPES) {
      const info = DOC_XLS_TEMPLATE_INFO[type];
      const data = await _docTemplateArray(type);
      const path = 'templates/' + info.file;
      zip.file(path, data);
      files.push({
        type,
        title:info.title,
        path,
        source:store[type] ? 'custom' : 'default',
        savedName:store[type]?.name || info.file,
        savedAt:store[type]?.savedAt || ''
      });
    }
    zip.file('print/print.css', _docPrintStyle().replace(/^<style>|<\/style>$/g, '').trim());
    zip.file('schemas/variables.json', JSON.stringify(_docTemplateVariableSchema(), null, 2));
    zip.file('README.txt', _docTemplatePackageReadme());
    const manifest = {
      format:'MESPro-Document-Templates',
      version:DOC_TEMPLATE_PACKAGE_VERSION,
      generatedAt:new Date().toISOString(),
      generator:'MES Pro',
      files,
      print:{ css:'print/print.css', page:'A4', orientation:'portrait' },
      schema:'schemas/variables.json'
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    const stamp = today().replace(/-/g, '');
    _downloadBlob(blob, `MESPro-Templates-${stamp}.zip`);
    showToast('전체 문서 양식 패키지를 내보냈습니다.', 'success');
  } catch (error) {
    showToast('양식 패키지 생성 실패: ' + error.message, 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-package-export"></i>전체 양식 패키지 내보내기'; }
  }
}

function _saveDocTemplatePackageBackup() {
  const backup = {
    savedAt:new Date().toISOString(),
    templates:_docTemplateStore()
  };
  localStorage.setItem('mes_docTemplatePackageBackup', JSON.stringify(backup));
}

function restoreDocTemplatePackageBackup() {
  let backup = null;
  try { backup = JSON.parse(localStorage.getItem('mes_docTemplatePackageBackup') || 'null'); } catch(e) {}
  if (!backup || !backup.templates) {
    showToast('복원할 가져오기 전 양식 백업이 없습니다.', 'info');
    return;
  }
  confirm_('가져오기 전 양식 복원',
    `<strong>${new Date(backup.savedAt).toLocaleString('ko-KR')}</strong> 시점의 양식으로 되돌리시겠습니까?<br><span style="font-size:11px;color:var(--tx-t);">업무 문서 데이터에는 영향을 주지 않습니다.</span>`,
    () => {
      saveStorage('docXlsxTemplates', backup.templates);
      renderDocTemplateManagement();
      showToast('가져오기 전 문서 양식으로 복원했습니다.', 'success');
    },
    'btn-primary', 'ti-history'
  );
}

async function importDocTemplatePackage(input) {
  const file = input && input.files && input.files[0];
  if (input) input.value = '';
  if (!file || !_requireTemplatePackageModules()) return;
  if (file.size > 8 * 1024 * 1024) {
    showToast('양식 패키지는 8MB 이하의 ZIP 파일을 사용해 주세요.', 'error');
    return;
  }
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('manifest.json이 없는 양식 패키지입니다.');
    const manifest = JSON.parse(await manifestFile.async('string'));
    if (manifest.format !== 'MESPro-Document-Templates') throw new Error('MESPro 문서 양식 패키지가 아닙니다.');
    if (Number(manifest.version) !== DOC_TEMPLATE_PACKAGE_VERSION) {
      throw new Error(`지원하지 않는 패키지 버전입니다. 현재 지원 버전: ${DOC_TEMPLATE_PACKAGE_VERSION}`);
    }
    const pending = {};
    const imported = [];
    for (const type of DOC_TEMPLATE_PACKAGE_TYPES) {
      const entry = (manifest.files || []).find(item => item.type === type);
      if (!entry || !entry.path) continue;
      const templateFile = zip.file(entry.path);
      if (!templateFile) throw new Error(`${DOC_XLS_TEMPLATE_INFO[type].title} 파일이 패키지에 없습니다.`);
      const data = await templateFile.async('arraybuffer');
      await _validateDocTemplateBuffer(type, data);
      pending[type] = {
        name:entry.savedName || entry.path.split('/').pop(),
        data:_arrayToBase64(data),
        savedAt:new Date().toISOString(),
        packageVersion:manifest.version
      };
      imported.push(DOC_XLS_TEMPLATE_INFO[type].title);
    }
    if (!imported.length) throw new Error('가져올 수 있는 XLSX 문서 양식이 없습니다.');
    confirm_('공용 양식 패키지 가져오기',
      `<strong>${imported.join(', ')}</strong><br>${imported.length}개 양식을 적용합니다.<br><span style="font-size:11px;color:var(--tx-t);">현재 양식은 자동 백업되며 가져오기 전 상태로 복원할 수 있습니다.</span>`,
      () => {
        _saveDocTemplatePackageBackup();
        const next = Object.assign({}, _docTemplateStore(), pending);
        saveStorage('docXlsxTemplates', next);
        localStorage.setItem('mes_docTemplatePackageMeta', JSON.stringify({
          name:file.name,
          importedAt:new Date().toISOString(),
          version:manifest.version,
          types:Object.keys(pending)
        }));
        renderDocTemplateManagement();
        showToast(`${imported.length}개 문서 양식을 가져왔습니다.`, 'success');
      },
      'btn-primary', 'ti-package-import'
    );
  } catch (error) {
    showToast('양식 패키지 가져오기 실패: ' + error.message, 'error');
  }
}

function _docTemplateStore() {
  return loadStorage('docXlsxTemplates', {});
}

function _arrayToBase64(array) {
  const bytes = new Uint8Array(array);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
}

function _base64ToArray(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function _requireExcelJS() {
  if (typeof ExcelJS === 'undefined') {
    showToast('엑셀 인쇄 모듈을 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.', 'error');
    return false;
  }
  return true;
}

function _excelBorder(color='FFCCCCCC', style='thin') {
  const edge = { style, color:{ argb:color } };
  return { top:edge, left:edge, bottom:edge, right:edge };
}

function _mergeValue(ws, range, value) {
  const parts = range.split(':');
  if (parts.length > 1 && parts[0] !== parts[1]) ws.mergeCells(range);
  ws.getCell(parts[0]).value = value;
  return ws.getCell(parts[0]);
}

function _styleRange(ws, range, style) {
  ws.getCell(range.split(':')[0]);
  ws.getCell(range.split(':')[1] || range);
  ws.getRows(1, ws.rowCount);
  const bounds = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!bounds) { Object.assign(ws.getCell(range), style); return; }
  const c1 = ws.getColumn(bounds[1]).number, r1 = Number(bounds[2]);
  const c2 = ws.getColumn(bounds[3]).number, r2 = Number(bounds[4]);
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) Object.assign(ws.getCell(r, c), style);
  }
}

function _defaultDocTemplateBook(type) {
  if (type === 'tax') return _defaultTaxTemplateBook();
  const isPo = type === 'po';
  const isRfq = type === 'rfq';
  const isQuote = type === 'quote';
  const isStatement = type === 'statement';
  const titleMap = { rfq:'견 적 요 청 서', po:'구 매 발 주 서', quote:'견 적 서', statement:'거 래 명 세 표' };
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MES Pro';
  wb.created = new Date();
  const ws = wb.addWorksheet('인쇄양식', {
    pageSetup: {
      paperSize:9, orientation:'portrait', fitToPage:true, fitToWidth:1, fitToHeight:1,
      margins:{ left:0.25, right:0.25, top:0.3, bottom:0.3, header:0.15, footer:0.15 },
      printArea:'A1:L42', horizontalCentered:true, verticalCentered:false
    },
    views:[{ showGridLines:false }]
  });
  ws.properties.defaultRowHeight = 16;
  [4,10,10,10,7,7,9,9,10,10,10,12].forEach((width, i) => { ws.getColumn(i + 1).width = width; });

  const navy = 'FF1A3A6E', white = 'FFFFFFFF';
  const gray = 'FF666666', border = _excelBorder();
  const font = { name:'맑은 고딕', size:9, color:{argb:'FF222222'} };
  _styleRange(ws, 'A1:L42', { font, alignment:{ vertical:'middle' } });

  const approvals = isPo
    ? [['E1:F1','담 당'],['G1:H1','팀 장'],['I1:J1','이 사'],['K1:L1','대 표']]
    : [['G1:H1','담 당'],['I1:J1','팀 장'],['K1:L1','대 표']];
  approvals.forEach(([head, label]) => {
    const start = head.split(':')[0], end = head.split(':')[1];
    const startCol = start.match(/[A-Z]+/)[0], endCol = end.match(/[A-Z]+/)[0];
    _mergeValue(ws, head, label);
    _mergeValue(ws, `${startCol}2:${endCol}3`, '');
    _styleRange(ws, `${startCol}1:${endCol}3`, {
      border, alignment:{ horizontal:'center', vertical:'middle' }
    });
    ws.getCell(start).fill = { type:'pattern', pattern:'solid', fgColor:{argb:white} };
    ws.getCell(start).font = { name:'맑은 고딕', size:8, bold:true, color:{argb:gray} };
  });
  ws.getRow(1).height = 17; ws.getRow(2).height = 19; ws.getRow(3).height = 19;

  _mergeValue(ws, 'A5:F5', '{{회사명}}');
  _mergeValue(ws, 'A6:F6', '{{회사연락처}}');
  _mergeValue(ws, 'A7:F7', '{{회사사업자정보}}');
  _mergeValue(ws, 'G5:L6', titleMap[type] || DOC_XLS_TEMPLATE_INFO[type].title);
  _mergeValue(ws, 'G7:L7', (isPo ? '발주번호  ' : '문서번호  ') + '{{문서번호}}');
  ws.getCell('A5').font = { name:'맑은 고딕', size:15, bold:true, color:{argb:navy} };
  ws.getCell('A6').font = ws.getCell('A7').font = { name:'맑은 고딕', size:8, color:{argb:'FF777777'} };
  ws.getCell('G5').font = { name:'맑은 고딕', size:21, bold:true, color:{argb:navy} };
  ws.getCell('G5').alignment = { horizontal:'right', vertical:'middle' };
  ws.getCell('G7').font = { name:'맑은 고딕', size:9, bold:true, color:{argb:'FF555555'} };
  ws.getCell('G7').alignment = { horizontal:'right', vertical:'middle' };
  _styleRange(ws, 'A7:L7', { border:{ bottom:{style:'medium',color:{argb:navy}} } });
  ws.getRow(5).height = 24; ws.getRow(6).height = 18; ws.getRow(7).height = 18;

  const infoRows = isPo ? [
    ['A9:B9','공급처(수신)','C9:L9','{{공급처}} 귀중'],
    ['A10:B10','발행일자','C10:L10','{{발행일}}'],
    ['A11:B11','결제조건','C11:F11','{{결제조건}}','G11:H11','납품방법','I11:L11','{{납품방법}}'],
    ['A12:B12','납품지 주소','C12:L12','{{납품주소}}']
  ] : isRfq ? [
    ['A9:B9','수 신','C9:L9','{{공급처}} 귀중'],
    ['A10:B10','발 신','C10:F10','{{회사명}} {{부서}}','G10:H10','발행일자','I10:L10','{{발행일}}'],
    ['A11:B11','관련 프로젝트','C11:L11','{{고객사}} — {{연결제품}}'],
    ['A12:B12','담당 연락처','C12:L12','{{부서}} {{회사전화}}']
  ] : [
    ['A9:B9','공급자','C9:F9','{{회사명}} ({{사업자번호}})','G9:H9','발행일자','I9:L9','{{발행일}}'],
    ['A10:B10','공급받는자','C10:F10','{{고객사}} 귀중','G10:H10','관련 제품','I10:L10','{{연결제품}}'],
    ['A11:B11','고객 이메일','C11:L11','{{고객이메일}}'],
    ['A12:B12',isQuote?'견적 유효기간':'문서 상태','C12:L12',isQuote?'발행일로부터 30일':'{{상태}}']
  ];
  infoRows.forEach(parts => {
    for (let i = 0; i < parts.length; i += 2) {
      const range = parts[i], value = parts[i + 1];
      const cell = _mergeValue(ws, range, value);
      const isLabel = i % 4 === 0;
      _styleRange(ws, range, {
        border,
        fill:isLabel ? {type:'pattern',pattern:'solid',fgColor:{argb:white}} : undefined,
        font:{ name:'맑은 고딕', size:isLabel ? 9 : 10, bold:isLabel || (range === 'C9:L9'), color:{argb:isLabel?'FF333333':navy} },
        alignment:{ horizontal:isLabel?'left':'left', vertical:'middle', wrapText:true }
      });
      if (!isLabel && range !== 'C9:L9') cell.font = { name:'맑은 고딕', size:9, color:{argb:'FF222222'} };
    }
  });
  [9,10,11,12].forEach(r => { ws.getRow(r).height = 21; });

  _mergeValue(ws, 'A14:L14', isPo ? '■ 발주 품목' : isRfq ? '■ 견적 요청 품목' : isQuote ? '■ 견적 품목' : '■ 거래 품목');
  _styleRange(ws, 'A14:L14', {
    fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}},
    border:{left:{style:'medium',color:{argb:navy}}},
    font:{name:'맑은 고딕',size:9,bold:true,color:{argb:navy}},
    alignment:{vertical:'middle'}
  });
  ws.getRow(14).height = 19;

  const headers = ['No.','품 목 명','규 격 / 사 양','수량','단위',isRfq?'희망 단가':'단 가 (원)',isRfq?'희망 금액':'공급가액','비 고'];
  const headerRanges = ['A15:A15','B15:D15','E15:G15','H15:H15','I15:I15','J15:J15','K15:K15','L15:L15'];
  headerRanges.forEach((range, i) => {
    _mergeValue(ws, range, headers[i]);
    _styleRange(ws, range, {
      fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}},
      border,
      font:{name:'맑은 고딕',size:8,bold:true,color:{argb:navy}},
      alignment:{horizontal:'center',vertical:'middle',wrapText:true}
    });
  });
  ws.getRow(15).height = 23;

  for (let i = 1; i <= 12; i++) {
    const row = 15 + i;
    const cells = [
      ['A'+row, `{{번호${i}}}`], [`B${row}:D${row}`, `{{품목명${i}}}`],
      [`E${row}:G${row}`, `{{규격${i}}}`], ['H'+row, `{{수량${i}}}`],
      ['I'+row, `{{단위${i}}}`], ['J'+row, `{{단가${i}}}`],
      ['K'+row, `{{금액${i}}}`], ['L'+row, `{{품목비고${i}}}`]
    ];
    cells.forEach(([range, value], idx) => {
      const cell = _mergeValue(ws, range, value);
      _styleRange(ws, range, {
        border, font:{name:'맑은 고딕',size:8.5,bold:idx===1,color:{argb:'FF222222'}},
        alignment:{horizontal:[0,2,3,4].includes(idx)?'center':([5,6].includes(idx)?'right':'left'),vertical:'middle',wrapText:true}
      });
      if ([5,6].includes(idx)) cell.numFmt = '#,##0;[Red]-#,##0';
    });
    if (i % 2 === 0) _styleRange(ws, `A${row}:L${row}`, { fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}} });
    ws.getRow(row).height = 19;
  }

  _mergeValue(ws, 'A28:J28', isPo ? '공급가액 합계' : '합 계');
  ws.getCell('K28').value = '{{공급가액}}';
  ws.getCell('L28').value = '';
  _styleRange(ws, 'A28:L28', {
    fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}},
    border:{top:{style:'medium',color:{argb:navy}},left:border.left,right:border.right,bottom:border.bottom},
    font:{name:'맑은 고딕',size:9,bold:true,color:{argb:navy}},
    alignment:{horizontal:'right',vertical:'middle'}
  });
  ws.getCell('K28').numFmt = '#,##0;[Red]-#,##0'; ws.getRow(28).height = 21;

  [['H30:I30',isRfq?'희망 공급가액':'공급가액','J30:L30','{{공급가액}}'],
   ['H31:I31','부가세 (10%)','J31:L31','{{부가세}}'],
   ['H32:I32',isPo?'발주 합계금액':isRfq?'희망 합계금액':'합계금액','J32:L32','{{합계금액}}']].forEach((parts, idx) => {
    const label = _mergeValue(ws, parts[0], parts[1]);
    const value = _mergeValue(ws, parts[2], parts[3]);
    _styleRange(ws, `${parts[0].split(':')[0]}:${parts[2].split(':')[1]}`, {
      border:_excelBorder(idx===2?navy:'FFDDE0E8',idx===2?'medium':'thin'),
      fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}},
      font:{name:'맑은 고딕',size:idx===2?11:9,bold:true,color:{argb:idx===2?navy:'FF555555'}},
      alignment:{horizontal:'right',vertical:'middle'}
    });
    value.numFmt = '#,##0" 원";[Red]-#,##0" 원"';
    value.font = {name:'맑은 고딕',size:idx===2?12:9,bold:true,color:{argb:navy}};
    label.alignment = {horizontal:'left',vertical:'middle'};
    ws.getRow(30 + idx).height = idx===2 ? 23 : 20;
  });

  _mergeValue(ws, 'A34:L34', isPo ? '◆ 특기사항 및 거래조건' : isRfq ? '◆ 특기사항 및 요청조건' : '◆ 비고');
  _mergeValue(ws, 'A35:L35', isPo
    ? '1. 상기 품목에 대하여 발주하오니 납기일에 맞추어 납품하여 주시기 바랍니다.'
    : isRfq ? '1. 상기 품목에 대하여 견적을 요청드리오니 회신 기한 내 견적서를 제출해 주시기 바랍니다.'
    : isQuote ? '위와 같이 견적서를 제출하오니 검토 후 발주 부탁드립니다.' : '위와 같이 거래 내역을 통보하오니 확인하여 주시기 바랍니다.');
  _mergeValue(ws, 'A36:L36', isPo
    ? '2. 납품 시 반드시 거래명세표를 동봉하여 주시기 바랍니다.'
    : isRfq ? '2. 견적가격은 납품지 기준 공급가(VAT 별도)로 기재 바랍니다.' : '{{비고}}');
  _mergeValue(ws, 'A37:L37', isPo
    ? '3. 세금계산서는 납품 완료 후 익일 발행 바랍니다.'
    : isRfq ? '3. 납품 가능 수량 및 납기일을 반드시 명시하여 주시기 바랍니다.' : '');
  _styleRange(ws, 'A34:L37', {
    border, fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}},
    font:{name:'맑은 고딕',size:8,color:{argb:'FF444444'}},
    alignment:{vertical:'middle',wrapText:true}
  });
  ws.getCell('A34').font = {name:'맑은 고딕',size:8.5,bold:true,color:{argb:navy}};
  [34,35,36,37].forEach(r => { ws.getRow(r).height = 18; });

  _mergeValue(ws, 'A39:G42', isPo
    ? '위와 같이 발주하며, 본 발주서가 계약 효력을 갖습니다.\n{{발행일}}\n{{회사명}}'
    : isRfq ? '본 견적요청서는 구매 의사의 표명이 아니며,\n견적 내용은 최종 발주 시 변경될 수 있습니다.'
    : '{{발행일}}\n{{회사명}}');
  ws.getCell('A39').alignment = {horizontal:'left',vertical:'bottom',wrapText:true};
  ws.getCell('A39').font = {name:'맑은 고딕',size:8,color:{argb:'FF777777'}};
  [['H39:I39','작 성','H40:I42'],['J39:K39','검 토','J40:K42'],['L39:L39',isPo?'대표이사':'승 인','L40:L42']].forEach(parts => {
    _mergeValue(ws, parts[0], parts[1]);
    _mergeValue(ws, parts[2], '(인)');
    const area = `${parts[0].split(':')[0]}:${parts[2].split(':')[1]}`;
    _styleRange(ws, area, {border,alignment:{horizontal:'center',vertical:'middle'}});
    ws.getCell(parts[0].split(':')[0]).font = {name:'맑은 고딕',size:8,bold:true,color:{argb:'FF555555'}};
    ws.getCell(parts[2].split(':')[0]).font = {name:'맑은 고딕',size:8,color:{argb:'FFBBBBBB'}};
  });
  [39,40,41,42].forEach(r => { ws.getRow(r).height = 18; });

  const guide = wb.addWorksheet('사용방법', { views:[{showGridLines:false}] });
  guide.columns = [{width:16},{width:105}];
  [
    ['엑셀 인쇄 양식 사용 방법',''],
    ['1','인쇄양식 시트의 셀 위치, 문구, 색상, 열 너비, 행 높이를 Excel에서 수정합니다.'],
    ['2','{{회사명}} 같은 표시값은 삭제하지 않고 원하는 셀로 이동할 수 있습니다.'],
    ['3','기본 양식은 A4 한 페이지이며 품목은 12개까지 표시됩니다. 필요하면 {{품목명13}}부터 추가할 수 있습니다.'],
    ['4','수정한 파일을 화면의 "수정한 엑셀 인쇄 양식 등록" 버튼으로 등록합니다.'],
    ['공통 표시값','{{회사명}}, {{회사주소}}, {{회사전화}}, {{회사팩스}}, {{회사연락처}}, {{회사사업자정보}}, {{사업자번호}}, {{대표자}}, {{부서}}'],
    ['문서 표시값','{{문서번호}}, {{발행일}}, {{공급처}}, {{공급처이메일}}, {{고객사}}, {{연결제품}}, {{결제조건}}, {{납품방법}}, {{납품주소}}, {{비고}}'],
    ['금액 표시값','{{공급가액}}, {{부가세}}, {{합계금액}}'],
    ['품목 표시값','{{번호1}}, {{품목명1}}, {{규격1}}, {{수량1}}, {{단위1}}, {{단가1}}, {{금액1}}, {{품목비고1}} ... 20']
  ].forEach(row => guide.addRow(row));
  _styleRange(guide, 'A1:B9', {font:{name:'맑은 고딕',size:10},alignment:{vertical:'middle',wrapText:true},border});
  _mergeValue(guide, 'A1:B1', '엑셀 인쇄 양식 사용 방법');
  guide.getCell('A1').font = {name:'맑은 고딕',size:16,bold:true,color:{argb:navy}};
  guide.getCell('A1').fill = {type:'pattern',pattern:'solid',fgColor:{argb:white}};
  return wb;
}

function _defaultTaxTemplateBook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('인쇄양식', {
    pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,printArea:'A1:L38',margins:{left:0.2,right:0.2,top:0.25,bottom:0.25,header:0.1,footer:0.1}},
    views:[{showGridLines:false}]
  });
  [4,8,11,11,11,11,11,11,11,11,11,13].forEach((w,i)=>ws.getColumn(i+1).width=w);
  const red='FFC0392B', blue='FF1C5AA8', white='FFFFFFFF', border=_excelBorder('FFB9B9B9');
  _mergeValue(ws,'A1:H2','전 자 세 금 계 산 서');
  _mergeValue(ws,'I1:J2','승인번호');
  _mergeValue(ws,'K1:L2','{{승인번호}}');
  _styleRange(ws,'A1:L2',{border,alignment:{horizontal:'center',vertical:'middle'},font:{name:'맑은 고딕',size:10,bold:true}});
  ws.getCell('A1').font={name:'맑은 고딕',size:18,bold:true,color:{argb:'FF222222'}};
  ws.getCell('I1').fill={type:'pattern',pattern:'solid',fgColor:{argb:white}};
  const party = (startRow, title, color, prefix) => {
    _mergeValue(ws,`A${startRow}:A${startRow+4}`,title);
    ws.getCell(`A${startRow}`).alignment={horizontal:'center',vertical:'middle',textRotation:90};
    [['B','등록번호','C:F',`{{${prefix}사업자번호}}`,'G','종사업장','H:L',''],
     ['B','상호(법인명)','C:F',`{{${prefix}회사명}}`,'G','성명','H:L',`{{${prefix}대표자}}`],
     ['B','사업장','C:L',`{{${prefix}주소}}`],
     ['B','업태','C:F',`{{${prefix}업태}}`,'G','종목','H:L',`{{${prefix}종목}}`],
     ['B','이메일','C:L',`{{${prefix}이메일}}`]].forEach((parts,idx)=>{
      for(let i=0;i<parts.length;i+=2){
        const range=parts[i]+(startRow+idx)+(parts[i].includes(':')?'':'');
        const actual=parts[i].includes(':') ? parts[i].replace(/(\D+):(\D+)/,`$1${startRow+idx}:$2${startRow+idx}`) : range;
        _mergeValue(ws,actual,parts[i+1]);
        _styleRange(ws,actual,{border,alignment:{vertical:'middle',wrapText:true},font:{name:'맑은 고딕',size:8,bold:i%4===0}});
        if(i%4===0) ws.getCell(actual.split(':')[0]).fill={type:'pattern',pattern:'solid',fgColor:{argb:white}};
      }
    });
    _styleRange(ws,`A${startRow}:L${startRow+4}`,{border});
    ws.getCell(`A${startRow}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:white}};
    ws.getCell(`A${startRow}`).font={name:'맑은 고딕',size:9,bold:true,color:{argb:prefix==='공급자' ? red : blue}};
  };
  party(4,'공급자','FFFDECEC','공급자');
  party(9,'공급받는자','FFEAF1FB','공급받는자');
  const rows=[
    [15,['작성일자','{{발행일}}','공급가액','{{공급가액}}','세액','{{부가세}}']],
    [16,['비고','{{비고}}']]
  ];
  rows.forEach(([r,vals])=>{
    const ranges=r===15?['A:B','C:D','E:F','G:H','I:J','K:L']:['A:B','C:L'];
    ranges.forEach((cols,i)=>{const rg=cols.replace(':',r+':')+r;_mergeValue(ws,rg,vals[i]);_styleRange(ws,rg,{border,alignment:{vertical:'middle'},font:{name:'맑은 고딕',size:8,bold:i%2===0},fill:i%2===0?{type:'pattern',pattern:'solid',fgColor:{argb:white}}:undefined});});
  });
  const heads=['월','일','품목','규격','수량','단가','공급가액','세액','비고'];
  const ranges=['A','B','C:E','F:G','H','I','J','K','L'];
  heads.forEach((h,i)=>{const rg=ranges[i].includes(':')?ranges[i].replace(':','17:')+'17':ranges[i]+'17';_mergeValue(ws,rg,h);_styleRange(ws,rg,{border,fill:{type:'pattern',pattern:'solid',fgColor:{argb:white}},font:{name:'맑은 고딕',size:8,bold:true},alignment:{horizontal:'center'}});});
  for(let i=1;i<=12;i++){
    const r=17+i;
    const vals=[`{{월${i}}}`,`{{일${i}}}`,`{{품목명${i}}}`,`{{규격${i}}}`,`{{수량${i}}}`,`{{단가${i}}}`,`{{금액${i}}}`,`{{세액${i}}}`,`{{품목비고${i}}}`];
    ranges.forEach((col,j)=>{const rg=col.includes(':')?col.replace(':',r+':')+r:col+r;_mergeValue(ws,rg,vals[j]);_styleRange(ws,rg,{border,font:{name:'맑은 고딕',size:8},alignment:{horizontal:[0,1,3,4].includes(j)?'center':([5,6,7].includes(j)?'right':'left'),vertical:'middle'}});});
  }
  _mergeValue(ws,'A31:B32','합계금액'); _mergeValue(ws,'C31:D32','{{합계금액}}');
  _mergeValue(ws,'E31:F32','현금'); _mergeValue(ws,'G31:H32','수표 / 어음');
  _mergeValue(ws,'I31:J32','외상미수금'); _mergeValue(ws,'K31:L32','이 금액을 ( 청구 ) 함');
  _styleRange(ws,'A31:L32',{border,font:{name:'맑은 고딕',size:9,bold:true},alignment:{horizontal:'center',vertical:'middle'}});
  ws.getCell('C31').numFmt='#,##0" 원"';
  _mergeValue(ws,'A33:F33','문서번호  {{문서번호}}');
  _styleRange(ws,'A33:F33',{font:{name:'맑은 고딕',size:8,bold:true,color:{argb:'FF555555'}},alignment:{vertical:'middle'}});
  _mergeValue(ws,'A34:L38','세금계산서 양식은 Excel에서 셀 위치·색상·문구를 수정한 뒤 시스템 관리에서 다시 등록할 수 있습니다.');
  ws.getCell('A34').alignment={wrapText:true,vertical:'top'}; ws.getCell('A34').font={name:'맑은 고딕',size:8,color:{argb:'FF777777'}};
  return wb;
}

function _downloadExcelBuffer(buffer, fileName) {
  const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function downloadDocXlsxTemplate(type) {
  const info = DOC_XLS_TEMPLATE_INFO[type];
  if (!info || !_requireExcelJS()) return;
  try {
    const buffer = await _defaultDocTemplateBook(type).xlsx.writeBuffer();
    _downloadExcelBuffer(buffer, info.file);
    showToast(`${info.title} PDF형 인쇄 양식을 다운로드했습니다.`);
  } catch(err) {
    showToast('엑셀 인쇄 양식 생성 실패: ' + err.message, 'error');
  }
}

async function registerDocXlsxTemplate(type) {
  const info = DOC_XLS_TEMPLATE_INFO[type];
  if (!info || !_requireExcelJS()) return;
  _pickXlsxFile(async file => {
    if (file.size > 600 * 1024) {
      showToast('인쇄 양식은 600KB 이하의 파일을 사용해 주세요.', 'error');
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data);
      const ws = wb.worksheets[0];
      let text = '';
      ws.eachRow(row => row.eachCell(cell => { text += ' ' + String(cell.value ?? ''); }));
      if (!text.includes('{{문서번호}}') || !text.includes('{{품목명1}}')) {
        showToast('양식에 {{문서번호}}와 {{품목명1}} 표시값이 필요합니다.', 'error');
        return;
      }
      const store = _docTemplateStore();
      store[type] = { name:file.name, data:_arrayToBase64(data), savedAt:new Date().toISOString() };
      saveStorage('docXlsxTemplates', store);
      if (typeof renderDocTemplateManagement === 'function') renderDocTemplateManagement();
      showToast(`${info.title} 인쇄 양식을 등록했습니다.`);
    } catch(err) {
      showToast('엑셀 인쇄 양식 등록 실패: ' + err.message, 'error');
    }
  });
}

function resetDocXlsxTemplate(type) {
  const info = DOC_XLS_TEMPLATE_INFO[type];
  if (!info) return;
  const store = _docTemplateStore();
  if (!store[type]) {
    showToast(`${info.title}는 이미 기본 양식을 사용 중입니다.`, 'info');
    return;
  }
  confirm_('기본 양식 복원',
    `<strong>${info.title}</strong>의 등록된 사용자 양식을 삭제하고 기본 양식으로 되돌리시겠습니까?<br><span style="color:var(--tx-t);font-size:11px;">문서 데이터에는 영향을 주지 않습니다.</span>`,
    () => {
      const next = _docTemplateStore();
      delete next[type];
      saveStorage('docXlsxTemplates', next);
      if (typeof renderDocTemplateManagement === 'function') renderDocTemplateManagement();
      showToast(`${info.title}가 기본 양식으로 복원되었습니다.`);
    },
    'btn-primary',
    'ti-restore'
  );
}

function resetAllDocXlsxTemplates() {
  const store = _docTemplateStore();
  if (!Object.keys(store).length) {
    showToast('모든 문서가 이미 기본 양식을 사용 중입니다.', 'info');
    return;
  }
  confirm_('모든 양식 기본값 복원',
    '등록된 모든 사용자 엑셀 양식을 삭제하고 내장 기본 양식으로 되돌리시겠습니까?<br><span style="color:var(--tx-t);font-size:11px;">실제 문서와 업무 데이터는 삭제되지 않습니다.</span>',
    () => {
      saveStorage('docXlsxTemplates', {});
      if (typeof renderDocTemplateManagement === 'function') renderDocTemplateManagement();
      showToast('모든 문서 양식이 기본값으로 복원되었습니다.');
    },
    'btn-danger',
    'ti-restore'
  );
}

async function _docTemplateArray(type) {
  const saved = _docTemplateStore()[type];
  if (saved && saved.data) return _base64ToArray(saved.data);
  return await _defaultDocTemplateBook(type).xlsx.writeBuffer();
}

function _docTemplateGroups(type, id) {
  const ids = Array.isArray(id) ? id : (id ? [id] : null);
  if (type === 'rfq') {
    const list = ids ? rfqList.filter(r => ids.includes(r.id)) : rfqList;
    return list.map(r => ({ key:r.id, items:[r] }));
  }
  if (type === 'quote') {
    const list = ids ? quoteList.filter(d => ids.includes(d.id)) : quoteList;
    return list.map(d => ({key:d.id,items:[d]}));
  }
  if (type === 'statement' || type === 'tax') {
    const list = salesList(type);
    const targets = ids ? list.filter(d => ids.includes(d.id)) : list;
    return targets.map(d => ({key:d.id,items:[d]}));
  }
  const list = ids ? poList.filter(p => ids.includes(p.id)) : poList;
  const grouped = {};
  list.forEach(p => {
    const key = ids && ids.length === 1 ? p.id : (p.supplier || p.id);
    (grouped[key] = grouped[key] || []).push(p);
  });
  return Object.entries(grouped).map(([key, items]) => ({ key, items }));
}

function _docTemplateValues(type, items) {
  const ci = getCompanyInfo();
  const first = items[0];
  const amount = items.reduce((sum, item) => {
    const price = type === 'rfq' ? item.targetPrice : item.unitPrice;
    return sum + (Number(price) || 0) * (Number(item.qty) || 0);
  }, 0);
  const vat = Math.round(amount * 0.1);
  const values = {
    회사명:ci.name || '', 회사주소:ci.address || '', 회사전화:ci.tel || '',
    회사팩스:ci.fax || '', 사업자번호:ci.bizNo || '', 대표자:ci.ceo || '',
    회사연락처:[ci.address, ci.tel ? 'TEL. ' + ci.tel : '', ci.fax ? 'FAX. ' + ci.fax : ''].filter(Boolean).join(' | '),
    회사사업자정보:[ci.bizNo ? '사업자등록번호: ' + ci.bizNo : '', ci.ceo ? '대표이사: ' + ci.ceo : ''].filter(Boolean).join(' | '),
    부서:ci.dept || '', 문서종류:DOC_XLS_TEMPLATE_INFO[type].title,
    문서번호:[...new Set(items.map(x => x.id))].join(', '),
    발행일:first.date || '', 공급처:first.supplier || '',
    공급처이메일:first.supplierEmail || '',
    고객사:first.clientName || getClientName(first.clientId) || '',
    고객이메일:first.clientEmail || '',
    연결제품:first.productId ? getProductName(first.productId) : '',
    결제조건:first.payMethod || '', 납품방법:first.dlvMethod || '', 상태:first.status || '',
    납품주소:ci.address || '', 공급가액:amount, 부가세:vat,
    합계금액:amount + vat, 비고:items.map(x => x.note || '').filter(Boolean).join(' / '),
    승인번호:first.approvalNo || '',
    공급자회사명:ci.name || '', 공급자사업자번호:ci.bizNo || '', 공급자대표자:ci.ceo || '',
    공급자주소:ci.address || '', 공급자업태:ci.bizType || '', 공급자종목:ci.bizItem || '', 공급자이메일:ci.email || ''
  };
  const clientName = first.clientName || getClientName(first.clientId) || '';
  const bp = partners.find(p => p.name === clientName) || {};
  Object.assign(values, {
    공급받는자회사명:clientName, 공급받는자사업자번호:bp.bizNo || '', 공급받는자대표자:bp.ceo || '',
    공급받는자주소:bp.address || '', 공급받는자업태:bp.bizType || '', 공급받는자종목:bp.bizItem || '',
    공급받는자이메일:first.clientEmail || bp.email || ''
  });
  for (let i = 1; i <= 20; i++) {
    const item = items[i - 1];
    const price = item ? Number(type === 'rfq' ? item.targetPrice : item.unitPrice) || 0 : '';
    values['번호' + i] = item ? i : '';
    values['품목명' + i] = item ? item.itemName || '' : '';
    values['규격' + i] = item ? item.spec || '' : '';
    values['수량' + i] = item ? Number(item.qty) || 0 : '';
    values['단위' + i] = item ? item.unit || '' : '';
    values['단가' + i] = item ? price : '';
    values['금액' + i] = item ? price * (Number(item.qty) || 0) : '';
    values['품목비고' + i] = item ? item.note || '' : '';
    const dateParts = item && item.date ? item.date.split('-') : [];
    values['월' + i] = item ? (dateParts[1] || '') : '';
    values['일' + i] = item ? (dateParts[2] || '') : '';
    values['세액' + i] = item ? Math.round(price * (Number(item.qty) || 0) * 0.1) : '';
  }
  return values;
}

function _fillDocTemplateSheet(ws, values) {
  ws.eachRow(row => row.eachCell(cell => {
    if (typeof cell.value !== 'string' || !cell.value.includes('{{')) return;
    const exact = cell.value.match(/^\{\{([^{}]+)\}\}$/);
    if (exact && Object.prototype.hasOwnProperty.call(values, exact[1])) {
      cell.value = values[exact[1]];
      return;
    }
    cell.value = cell.value.replace(/\{\{([^{}]+)\}\}/g, (all, key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : all
    );
  }));
}

function _safeSheetName(name, used) {
  const base = String(name || '문서').replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || '문서';
  let out = base, n = 2;
  while (used.has(out)) out = (base.slice(0, 27) + '_' + n++).slice(0, 31);
  used.add(out);
  return out;
}

async function exportDocTemplateXLS(type, id = null) {
  const info = DOC_XLS_TEMPLATE_INFO[type];
  if (!info || !_requireExcelJS()) return;
  const groups = _docTemplateGroups(type, id);
  if (!groups.length) { showToast('양식으로 출력할 문서가 없습니다.', 'error'); return; }
  try {
    const templateData = await _docTemplateArray(type);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(templateData);
    const templateWs = out.worksheets[0];
    const templateModel = JSON.parse(JSON.stringify(templateWs.model));
    out.worksheets.slice(1).forEach(sheet => out.removeWorksheet(sheet.id));
    const used = new Set();
    groups.forEach((group, index) => {
      let ws;
      if (index === 0) {
        ws = templateWs;
      } else {
        const sheetName = _safeSheetName(group.key, used);
        ws = out.addWorksheet(sheetName);
        const cloneModel = JSON.parse(JSON.stringify(templateModel));
        cloneModel.id = ws.id;
        cloneModel.name = sheetName;
        ws.model = cloneModel;
        _fillDocTemplateSheet(ws, _docTemplateValues(type, group.items));
        return;
      }
      ws.name = _safeSheetName(group.key, used);
      _fillDocTemplateSheet(ws, _docTemplateValues(type, group.items));
    });
    const suffix = groups.length === 1 ? groups[0].key : today();
    const buffer = await out.xlsx.writeBuffer();
    _downloadExcelBuffer(buffer, `${info.title}_${suffix}.xlsx`);
    showToast(`${info.title} ${groups.length}건을 등록 양식으로 출력했습니다.`);
  } catch(err) {
    showToast('엑셀 양식 출력 실패: ' + err.message, 'error');
  }
}

/* ════════ 거래명세표 / 세금계산서 (판매문서 공용 엔진) ════════ */
const SALES = {
  statement: { key:'statementList', prefix:'TS', title:'거래명세표', idp:'st', page:'statement', statuses:['작성','발송완료','수령확인'], titleIcon:'ti-receipt' },
  tax:       { key:'taxList',       prefix:'TX', title:'세금계산서', idp:'tx', page:'taxinvoice', statuses:['작성','발행완료','전송완료'], titleIcon:'ti-file-dollar' }
};
function salesList(type) { return type === 'statement' ? statementList : taxList; }
function setSalesList(type, arr) { if (type === 'statement') statementList = arr; else taxList = arr; }
function salesStatusColor(type, s) {
  const st = SALES[type].statuses;
  if (s === st[1]) return 'var(--tx-i)';
  if (s === st[2]) return 'var(--tx-ok)';
  return 'var(--tx-s)';
}

function renderSalesDoc(type) {
  const cfg = SALES[type], idp = cfg.idp, list = salesList(type);
  ensureDateView(type, idp+'-table', list.map(d=>d.date), ()=>renderSalesDoc(type));
  const amtOf = d => (d.unitPrice||0) * (d.qty||0);
  const total = list.length;
  const sent  = list.filter(d => d.status === cfg.statuses[1]).length;
  const done  = list.filter(d => d.status === cfg.statuses[2]).length;
  const sumAmt = list.reduce((s,d) => s + Math.round(amtOf(d) * 1.1), 0);
  if (inp(idp+'-k-total')) inp(idp+'-k-total').textContent = total + '건';
  if (inp(idp+'-k-sent'))  inp(idp+'-k-sent').textContent  = sent + '건';
  if (inp(idp+'-k-done'))  inp(idp+'-k-done').textContent  = done + '건';
  if (inp(idp+'-k-amt'))   inp(idp+'-k-amt').textContent   = '₩' + sumAmt.toLocaleString('ko-KR');
  _kpiActive(idp+'-fs', {[cfg.statuses[1]]: idp+'-k-sent', [cfg.statuses[2]]: idp+'-k-done'});

  const fcSel = inp(idp+'-fc');
  if (fcSel) {
    const cur = fcSel.value;
    fcSel.innerHTML = '<option value="">전체 고객사</option>' +
      clients.map(c => `<option value="${c.id}"${c.id===cur?' selected':''}>${c.name}</option>`).join('');
  }
  const fc = v(idp+'-fc'), fs = v(idp+'-fs'), q = (v(idp+'-q')||'').toLowerCase();
  const rows = list.filter(d => {
    if (!dateViewMatch(type, d.date)) return false;
    if (fc && d.clientId !== fc) return false;
    if (fs && d.status !== fs)   return false;
    if (q && !(d.itemName||'').toLowerCase().includes(q) && !getClientName(d.clientId).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const cont = inp(idp+'-table'); if (!cont) return;
  if (!rows.length) {
    cont.innerHTML = empty(`등록된 ${cfg.title}가 없습니다. [${cfg.title} 등록] 버튼으로 추가하세요.`);
    return;
  }

  cont.innerHTML = `<table style="min-width:1080px;">
    <thead><tr>
      <th>문서번호</th><th>발행일</th><th>공급받는 고객사</th><th>연결제품</th>
      <th>품목명</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계</th><th>상태</th><th>관리</th>
    </tr></thead>
    <tbody>${rows.map(d => {
      const sup = (d.unitPrice||0)*(d.qty||0), vat = Math.round(sup*0.1), grand = sup+vat;
      return `
      <tr>
        <td style="font-weight:700;color:var(--tx-i);">${d.id}</td>
        <td>${d.date}</td>
        <td>${getClientName(d.clientId)||'—'}${d.clientEmail?`<br><span style="font-size:10px;color:var(--tx-t);">${d.clientEmail}</span>`:''}</td>
        <td style="font-size:11px;">${d.productId?getProductName(d.productId):'—'}</td>
        <td style="font-weight:700;">${d.itemName}</td>
        <td style="font-size:11px;color:var(--tx-t);">${d.spec||'—'}</td>
        <td>${d.qty} ${d.unit}</td>
        <td>${d.unitPrice?'₩'+Number(d.unitPrice).toLocaleString('ko-KR'):'—'}</td>
        <td>₩${sup.toLocaleString('ko-KR')}</td>
        <td style="color:var(--tx-t);">₩${vat.toLocaleString('ko-KR')}</td>
        <td style="font-weight:700;color:var(--tx-i);">₩${grand.toLocaleString('ko-KR')}</td>
        <td><select class="stat-sel" onchange="changeSalesDocStatus('${type}','${d.id}',this.value)" style="color:${salesStatusColor(type,d.status)}">
          ${cfg.statuses.map(s=>`<option${s===d.status?' selected':''}>${s}</option>`).join('')}
        </select></td>
        <td style="white-space:nowrap;">
          <button class="edit-btn" onclick="openSalesDocEdit('${type}','${d.id}')"><i class="ti ti-edit"></i>수정</button>
          <button class="btn btn-sm" style="margin-left:3px;" onclick="openSalesDocPrint('${type}','${d.id}')" title="PDF 출력"><i class="ti ti-printer"></i></button>
          <button class="btn btn-sm drive-save-btn" style="margin-left:3px;" onclick="saveDocumentBundleToGoogleDrive('${type}','${d.id}')" title="PDF/XLSX Google Drive 저장"><i class="ti ti-cloud-upload"></i>Drive</button>
          <button class="btn btn-sm" style="margin-left:3px;border-color:var(--br-i);color:var(--tx-i);" onclick="openEmailModal(salesList('${type}').find(x=>x.id==='${d.id}'),'${type}')" title="이메일 발송"><i class="ti ti-mail"></i></button>
          <button class="del-btn" style="margin-left:3px;" onclick="deleteSalesDoc('${type}','${d.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function onSalesDocClientChange() {
  const cid = v('sd-client');
  fillProductSelect('sd-product', cid);
  const c = clients.find(x => x.id === cid);
  if (c && c.email && !v('sd-email')) sv('sd-email', c.email);
}

function openSalesDocAdd(type) {
  const cfg = SALES[type];
  const modal = inp('salesdoc-modal');
  modal.dataset.type = type;
  delete modal.dataset.editId;
  inp('sd-modal-ttl').innerHTML = `<i class="ti ${cfg.titleIcon}" style="color:var(--tx-i);"></i>${cfg.title} 등록`;
  inp('sd-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('sd-status').innerHTML = cfg.statuses.map(s=>`<option>${s}</option>`).join('');
  sv('sd-id', nextDocCode(cfg.prefix, salesList(type)));
  sv('sd-date', today());
  sv('sd-status', cfg.statuses[0]);
  inp('sd-client').innerHTML = '<option value="">-- 선택 --</option>' + clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  inp('sd-product').innerHTML = '<option value="">-- 선택 --</option>';
  ['sd-email','sd-item','sd-spec','sd-note'].forEach(id=>sv(id,''));
  sv('sd-qty','1'); sv('sd-unit','EA'); sv('sd-price','');
  modal.classList.add('open');
}

function openSalesDocEdit(type, id) {
  if (!checkAdminAction()) return;
  const cfg = SALES[type];
  const d = salesList(type).find(x => x.id === id); if (!d) return;
  const modal = inp('salesdoc-modal');
  modal.dataset.type = type;
  modal.dataset.editId = id;
  inp('sd-modal-ttl').innerHTML = `<i class="ti ti-edit" style="color:var(--tx-w);"></i>${cfg.title} 수정`;
  inp('sd-save-btn').innerHTML = '<i class="ti ti-check"></i>저장';
  inp('sd-status').innerHTML = cfg.statuses.map(s=>`<option>${s}</option>`).join('');
  sv('sd-id', d.id);
  sv('sd-date', d.date);
  inp('sd-client').innerHTML = '<option value="">-- 선택 --</option>' + clients.map(c=>`<option value="${c.id}"${c.id===d.clientId?' selected':''}>${c.name}</option>`).join('');
  fillProductSelect('sd-product', d.clientId, d.productId);
  sv('sd-email', d.clientEmail||'');
  sv('sd-item', d.itemName||'');
  sv('sd-spec', d.spec||'');
  sv('sd-qty', d.qty||1);
  sv('sd-unit', d.unit||'EA');
  sv('sd-price', d.unitPrice||'');
  sv('sd-note', d.note||'');
  sv('sd-status', d.status || cfg.statuses[0]);
  modal.classList.add('open');
}

function cloneSalesDoc(type, id) {
  if (!checkAdminAction()) return;
  const cfg = SALES[type];
  const d = salesList(type).find(x => x.id === id); if (!d) return;
  const modal = inp('salesdoc-modal');
  modal.dataset.type = type;
  delete modal.dataset.editId;
  inp('sd-modal-ttl').innerHTML = `<i class="ti ti-copy" style="color:var(--tx-i);"></i>${cfg.title} 복제 등록`;
  inp('sd-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('sd-status').innerHTML = cfg.statuses.map(s=>`<option>${s}</option>`).join('');
  sv('sd-id', nextDocCode(cfg.prefix, salesList(type)));
  sv('sd-date', today());
  inp('sd-client').innerHTML = '<option value="">-- 선택 --</option>' + clients.map(c=>`<option value="${c.id}"${c.id===d.clientId?' selected':''}>${c.name}</option>`).join('');
  fillProductSelect('sd-product', d.clientId, d.productId);
  sv('sd-email', d.clientEmail||''); sv('sd-item', d.itemName||''); sv('sd-spec', d.spec||'');
  sv('sd-qty', d.qty||1); sv('sd-unit', d.unit||'EA'); sv('sd-price', d.unitPrice||'');
  sv('sd-note', d.note||''); sv('sd-status', cfg.statuses[0]);
  modal.classList.add('open');
}

function saveSalesDoc() {
  if (!checkAdminAction()) return;
  const modal = inp('salesdoc-modal');
  const type = modal.dataset.type || 'statement';
  const cfg = SALES[type];
  if (!v('sd-client')) { showToast('공급받는 고객사를 선택하세요.', 'error'); return; }
  if (!v('sd-item').trim()) { showToast('품목명을 입력하세요.', 'error'); return; }
  const data = {
    date: v('sd-date') || today(),
    clientId: v('sd-client'),
    productId: v('sd-product'),
    clientEmail: v('sd-email') || '',
    itemName: v('sd-item').trim(),
    spec: v('sd-spec'),
    qty: Number(v('sd-qty')) || 1,
    unit: v('sd-unit') || 'EA',
    unitPrice: Number(v('sd-price')) || 0,
    note: v('sd-note'),
    status: v('sd-status') || cfg.statuses[0]
  };
  const list = salesList(type);
  const editId = modal.dataset.editId;
  if (editId) {
    const d = list.find(x => x.id === editId);
    if (d) Object.assign(d, data);
    delete modal.dataset.editId;
    showToast(`${cfg.title}가 수정되었습니다.`);
  } else {
    list.unshift({ id: v('sd-id') || nextDocCode(cfg.prefix, list), ...data });
    showToast(`${cfg.title}가 등록되었습니다.`);
  }
  saveStorage(cfg.key, list);
  closeModal('salesdoc-modal');
  renderSalesDoc(type);
}

function changeSalesDocStatus(type, id, val) {
  if (!checkAdminAction()) return;
  const d = salesList(type).find(x => x.id === id);
  if (d) { d.status = val; saveStorage(SALES[type].key, salesList(type)); renderSalesDoc(type); }
}

function deleteSalesDoc(type, id) {
  if (!checkAdminAction()) return;
  const cfg = SALES[type];
  const d = salesList(type).find(x => x.id === id); if (!d) return;
  confirm_(`${cfg.title} 삭제`, `<strong>${d.id}</strong> (${d.itemName}) 문서를 삭제하시겠습니까?`, () => {
    setSalesList(type, salesList(type).filter(x => x.id !== id));
    saveStorage(cfg.key, salesList(type));
    renderSalesDoc(type);
    showToast(`${cfg.title}가 삭제되었습니다.`);
  });
}

function exportSalesDocCSV(type) {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const cfg = SALES[type], list = salesList(type);
  if (!list.length) { showToast('내보낼 데이터가 없습니다.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const hdr = ['문서번호','발행일','고객사','고객이메일','연결제품','품목명','규격','수량','단위','단가','공급가액','부가세','합계','상태','비고'];
  const rows = list.map(d => {
    const sup = (d.unitPrice||0)*(d.qty||0), vat = Math.round(sup*0.1);
    return [d.id, d.date, getClientName(d.clientId)||'', d.clientEmail||'', d.productId?getProductName(d.productId):'',
      d.itemName, d.spec||'', d.qty, d.unit, d.unitPrice||0, sup, vat, sup+vat, d.status, d.note||''];
  });
  const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
  ws['!cols'] = hdr.map(h => ({ wch: Math.max(h.length+2, 12) }));
  XLSX.utils.book_append_sheet(wb, ws, cfg.title);
  XLSX.writeFile(wb, `${cfg.title}_${today()}.xlsx`);
  showToast('엑셀 파일이 저장되었습니다.');
}

/* 표준 전자세금계산서 1부 (공급자/공급받는자 좌우 배치) */
function _taxInvoiceHtml(d, ci, copyLabel) {
  const total = (d.unitPrice||0)*(d.qty||0), vat = Math.round(total*0.1), grand = total+vat;
  const cn = getClientName(d.clientId) || '';
  const bp = partners.find(p => p.name === cn) || {};
  const num = n => Number(n||0).toLocaleString('ko-KR');
  const dt = (d.date || today()).split('-');
  const b = '1px solid #b9b9b9';
  const supLbl = 'background:#fdecec;color:#c0392b;';
  const buyLbl = 'background:#eaf1fb;color:#1c5aa8;';
  const party = (title, lblCss, p) => `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;margin:0;">
      <colgroup><col style="width:26px;"><col style="width:48px;"><col><col style="width:38px;"><col style="width:42px;"></colgroup>
      <tr>
        <td rowspan="5" style="border:${b};${lblCss}font-weight:800;text-align:center;padding:0;"><div style="writing-mode:vertical-rl;text-orientation:upright;letter-spacing:1px;line-height:1;white-space:nowrap;margin:0 auto;">${title}</div></td>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">등록번호</td>
        <td style="border:${b};padding:2px 4px;text-align:center;font-weight:700;letter-spacing:1px;">${p.reg||''}</td>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;font-size:8px;">종사업장<br>번호</td>
        <td style="border:${b};padding:2px 4px;">${p.sub||''}</td>
      </tr>
      <tr>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">상호<br>(법인명)</td>
        <td style="border:${b};padding:2px 4px;">${p.company||''}</td>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">성명</td>
        <td style="border:${b};padding:2px 4px;">${p.ceo||''}</td>
      </tr>
      <tr>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">사업장</td>
        <td colspan="3" style="border:${b};padding:2px 4px;">${p.address||''}</td>
      </tr>
      <tr>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">업태</td>
        <td style="border:${b};padding:2px 4px;">${p.bizType||''}</td>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">종목</td>
        <td style="border:${b};padding:2px 4px;">${p.bizItem||''}</td>
      </tr>
      <tr>
        <td style="border:${b};${lblCss}text-align:center;font-weight:700;">이메일</td>
        <td colspan="3" style="border:${b};padding:2px 4px;">${p.email||''}</td>
      </tr>
    </table>`;
  const supplier = { reg:ci.bizNo, company:ci.name, ceo:ci.ceo, address:ci.address, bizType:ci.bizType, bizItem:ci.bizItem, email:ci.email };
  const buyer = { reg:bp.bizNo||'', company:cn, ceo:'', address:bp.address||'', bizType:'', bizItem:'', email:d.clientEmail||bp.email||'' };
  const empties = [0,1].map(()=>`<tr style="height:17px;">${('<td style="border:'+b+';"></td>').repeat(9)}</tr>`).join('');
  return `
  <div style="border:2px solid #555;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin:0;">
      <tr>
        <td style="border-right:${b};border-bottom:${b};text-align:center;font-size:17px;font-weight:800;letter-spacing:5px;padding:6px;width:60%;">전자세금계산서<span style="font-size:10px;letter-spacing:0;font-weight:600;"> (${copyLabel})</span></td>
        <td style="border-bottom:${b};${buyLbl}text-align:center;font-weight:700;width:66px;">승인번호</td>
        <td style="border-bottom:${b};border-left:${b};padding:2px 6px;">${d.approvalNo||''}</td>
      </tr>
    </table>
    <div style="display:flex;border-bottom:2px solid #555;">
      <div style="flex:1;border-right:1px solid #555;">${party('공급자', supLbl, supplier)}</div>
      <div style="flex:1;">${party('공급받는자', buyLbl, buyer)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin:0;">
      <tr style="background:#f3f3f3;text-align:center;font-weight:700;">
        <td style="border:${b};width:90px;">작성일자</td><td style="border:${b};">공급가액</td><td style="border:${b};">세액</td><td style="border:${b};width:140px;">수정사유</td>
      </tr>
      <tr style="text-align:center;height:22px;">
        <td style="border:${b};">${d.date||today()}</td>
        <td style="border:${b};text-align:right;padding:2px 8px;font-weight:700;">${num(total)}</td>
        <td style="border:${b};text-align:right;padding:2px 8px;font-weight:700;">${num(vat)}</td>
        <td style="border:${b};"></td>
      </tr>
      <tr>
        <td style="border:${b};background:#f3f3f3;text-align:center;font-weight:700;">비고</td>
        <td colspan="3" style="border:${b};padding:2px 8px;">${d.note||''}</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin:0;">
      <thead><tr style="background:#f3f3f3;text-align:center;font-weight:700;">
        <td style="border:${b};width:24px;">월</td><td style="border:${b};width:24px;">일</td>
        <td style="border:${b};">품목</td><td style="border:${b};width:64px;">규격</td>
        <td style="border:${b};width:40px;">수량</td><td style="border:${b};width:74px;">단가</td>
        <td style="border:${b};width:88px;">공급가액</td><td style="border:${b};width:78px;">세액</td><td style="border:${b};width:54px;">비고</td>
      </tr></thead>
      <tbody>
        <tr style="height:22px;">
          <td style="border:${b};text-align:center;">${dt[1]||''}</td><td style="border:${b};text-align:center;">${dt[2]||''}</td>
          <td style="border:${b};padding:2px 6px;">${d.itemName||''}</td><td style="border:${b};text-align:center;">${d.spec||''}</td>
          <td style="border:${b};text-align:center;">${d.qty||''}</td><td style="border:${b};text-align:right;padding:2px 6px;">${d.unitPrice?num(d.unitPrice):''}</td>
          <td style="border:${b};text-align:right;padding:2px 6px;">${num(total)}</td><td style="border:${b};text-align:right;padding:2px 6px;">${num(vat)}</td><td style="border:${b};"></td>
        </tr>
        ${empties}
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin:0;">
      <tr style="text-align:center;background:#f3f3f3;font-weight:700;">
        <td style="border:${b};width:90px;">합계금액</td><td style="border:${b};">현금</td><td style="border:${b};">수표</td><td style="border:${b};">어음</td><td style="border:${b};">외상미수금</td><td style="border:${b};width:130px;">이 금액을</td>
      </tr>
      <tr style="text-align:center;height:24px;">
        <td style="border:${b};text-align:right;padding:2px 8px;font-weight:800;">${num(grand)}</td>
        <td style="border:${b};"></td><td style="border:${b};"></td><td style="border:${b};"></td>
        <td style="border:${b};text-align:right;padding:2px 8px;">${num(grand)}</td>
        <td style="border:${b};font-weight:700;">( 청구 ) 함</td>
      </tr>
    </table>
  </div>`;
}

/* 세금계산서 A4 1장 = 공급자 보관용(상) + 공급받는자 보관용(하) */
function _taxInvoiceA4(d, ci) {
  return `<div style="width:100%;box-sizing:border-box;background:#fff;color:#111;font-family:'Malgun Gothic','맑은 고딕',sans-serif;">
    ${_taxInvoiceHtml(d, ci, '공급자 보관용')}
    <div style="text-align:center;color:#bbb;font-size:10px;margin:5px 0;">━━━━━━━━━━━━━━━━━━━━  ✂ 절취선  ━━━━━━━━━━━━━━━━━━━━</div>
    ${_taxInvoiceHtml(d, ci, '공급받는자 보관용')}
  </div>`;
}

/* 판매문서 인쇄/PDF 본문 (거래명세표·세금계산서 공용) */
function _salesDocBodyHtml(d, type, ci) {
  if (type === 'tax') return _taxInvoiceA4(d, ci);
  const isTax = type === 'tax';
  const total = (d.unitPrice||0) * (d.qty||0);
  const vat = Math.round(total * 0.1);
  const grand = total + vat;
  const client = (d.clientName || getClientName(d.clientId)) || '—';
  const prod = d.productId ? getProductName(d.productId) : '—';
  const DOCMETA = {
    statement: { title:'거 래 명 세 표', sec:'거래 품목', remark:'위와 같이 거래 내역을 통보하오니 확인하여 주시기 바랍니다.' },
    quote:     { title:'견 적 서',        sec:'견적 품목', remark:'위와 같이 견적서를 제출하오니 검토 후 발주 부탁드립니다. (견적 유효기간: 발행일로부터 30일)' },
    order:     { title:'수 주 확 인 서',  sec:'수주 품목', remark:'위와 같이 수주를 확인하오니 납기 일정에 맞추어 진행하겠습니다.' }
  };
  const meta = DOCMETA[type] || DOCMETA.statement;
  return `
    <div style="color:#111; font-size:12px; background:#fff; width:100%; box-sizing:border-box;">
      <div class="approval-box">
        <div class="apv-cell"><div class="apv-title">담 당</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">검 토</div><div class="apv-sign"></div></div>
        <div class="apv-cell"><div class="apv-title">대 표</div><div class="apv-sign"></div></div>
      </div>
      <div class="doc-header" style="margin-top:20px;">
        <div>
          <div class="co-name">${ci.name}</div>
          <div class="co-detail">${ci.address}${ci.tel?' | TEL. '+ci.tel:''}${ci.fax?' | FAX. '+ci.fax:''}</div>
          ${ci.bizNo?`<div class="co-detail">사업자등록번호: ${ci.bizNo}${ci.ceo?' | 대표이사: '+ci.ceo:''}</div>`:''}
        </div>
        <div><div class="doc-title" style="font-size:24px;">${meta.title}</div><div class="doc-no">문서번호 &nbsp; ${d.id}</div></div>
      </div>
      <table class="info-tbl" style="margin-top:15px;">
        <tr><th>공급자</th><td>${ci.name}${ci.bizNo?' ('+ci.bizNo+')':''}</td><th style="width:90px;">발행일자</th><td>${d.date}</td></tr>
        <tr><th>공급받는자</th><td class="hl">${client} 귀중</td><th>관련 제품</th><td>${prod}</td></tr>
      </table>
      <div class="sec-title" style="margin-top:20px;">■ ${isTax?'공급 내역':'거래 품목'}</div>
      <table class="items-tbl">
        <thead><tr><th style="width:30px;">No.</th><th>품 목 명</th><th style="width:130px;">규 격</th>
        <th style="width:46px;">수량</th><th style="width:40px;">단위</th>
        <th style="width:100px;">단 가</th><th style="width:100px;">공급가액</th><th style="width:90px;">세 액</th></tr></thead>
        <tbody>
          <tr><td class="ctr">1</td><td><strong>${d.itemName}</strong></td><td class="ctr">${d.spec||'—'}</td>
          <td class="ctr">${d.qty}</td><td class="ctr">${d.unit}</td>
          <td class="num">${d.unitPrice?Number(d.unitPrice).toLocaleString('ko-KR'):'—'}</td>
          <td class="num">${total.toLocaleString('ko-KR')}</td>
          <td class="num">${vat.toLocaleString('ko-KR')}</td></tr>
          <tr class="empty-row"><td colspan="8">—</td></tr>
          <tr class="total-row"><td colspan="6" style="text-align:right;">합 계</td>
          <td class="num">${total.toLocaleString('ko-KR')}</td><td class="num">${vat.toLocaleString('ko-KR')}</td></tr>
        </tbody>
      </table>
      <div class="sum-wrap"><div class="sum-box">
        <div class="sum-row"><div class="sum-lbl">공급가액</div><div class="sum-val">${total.toLocaleString('ko-KR')} 원</div></div>
        <div class="sum-row"><div class="sum-lbl">부가세 (10%)</div><div class="sum-val">${vat.toLocaleString('ko-KR')} 원</div></div>
        <div class="sum-row sum-final"><div class="sum-lbl">합계금액</div><div class="sum-val">${grand.toLocaleString('ko-KR')} 원</div></div>
      </div></div>
      <div class="remarks" style="margin-top:15px;">
        <div class="remarks-title">◆ 비고</div>
        ${d.note ? d.note + '<br>' : ''}${isTax?'위 금액을 정히 영수(청구)합니다.':'위와 같이 거래 내역을 통보하오니 확인하여 주시기 바랍니다.'}
      </div>
      <div class="sign-area" style="margin-top:20px;">
        <div class="sign-left">${d.date}<br><strong>${ci.name}</strong></div>
        <div class="sign-right">
          <div class="sign-box"><div class="sign-title">작 성</div><div class="sign-content">(인)</div></div>
          <div class="sign-box"><div class="sign-title">확 인</div><div class="sign-content">(인)</div></div>
          <div class="sign-box"><div class="sign-title">대표이사</div><div class="sign-content">(인)</div></div>
        </div>
      </div>
    </div>`;
}

function openSalesDocPrint(type, id) {
  const cfg = SALES[type], list = salesList(type);
  const targets = Array.isArray(id) ? list.filter(x=>id.includes(x.id)) : (id ? list.filter(x => x.id === id) : list);
  if (!targets.length) { showToast('출력할 문서가 없습니다.', 'error'); return; }
  const ci = getCompanyInfo();
  const pages = targets.map((d,i) => `<div style="${i<targets.length-1?'page-break-after:always;':''}">${_salesDocBodyHtml(d, type, ci)}</div>`).join('');
  const docTitle = id || cfg.title;
  openDocumentPdfPreview(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${docTitle}</title>${_docPrintStyle()}</head><body>${pages}</body></html>`,
    docTitle
  );
}

function buildSalesEmailBody(d, ci, label) {
  const client = getClientName(d.clientId) || '—';
  const total = (d.unitPrice||0)*(d.qty||0), vat = Math.round(total*0.1), grand = total+vat;
  return `안녕하세요, ${client} 담당자님.

${ci.name} ${ci.dept}입니다.

${label}를 첨부와 같이 송부드립니다.

─────────────────────────────
문서번호: ${d.id}
발행일자: ${d.date}
품목: ${d.itemName}${d.spec?' ('+d.spec+')':''}
수량: ${d.qty} ${d.unit}
공급가액: ₩${total.toLocaleString('ko-KR')}
부가세(10%): ₩${vat.toLocaleString('ko-KR')}
합계금액: ₩${grand.toLocaleString('ko-KR')}
─────────────────────────────

확인 부탁드립니다.

감사합니다.

${ci.name} ${ci.dept}
TEL: ${ci.tel}`;
}

/* ════════ 견적서 / 수주 (판매 영업문서 엔진) ════════ */
const SODOCS = {
  quote: { key:'quoteList', prefix:'QT', title:'견적서', docType:'quote', idp:'qt', statuses:['작성','발송','협의중','보류','수주전환'] },
  order: { key:'orderList', prefix:'SO', title:'수주', docType:'order', idp:'so', statuses:['수주확정','진행중','완료'] }
};
let salesTab = 'quote';
function switchSalesTab(tab) {
  salesTab = tab;
  syncCurrentSubRoute('salesdoc', salesTab);
  document.querySelectorAll('#sd-tabs [data-sdtab]').forEach(b => b.classList.toggle('btn-primary', b.dataset.sdtab === tab));
  const q = inp('sd-tab-quote'), o = inp('sd-tab-order');
  if (q) q.style.display = tab === 'quote' ? '' : 'none';
  if (o) o.style.display = tab === 'order' ? '' : 'none';
  renderSODoc(tab === 'order' ? 'order' : 'quote');
}
function soDocList(type) { return type === 'quote' ? quoteList : orderList; }
function setSoDocList(type, arr) { if (type === 'quote') quoteList = arr; else orderList = arr; }
function soDocStatusColor(type, s) {
  if (type === 'quote') return s==='수주전환' ? 'var(--tx-ok)' : s==='발송' ? 'var(--tx-i)' : s==='보류' ? 'var(--tx-d)' : 'var(--tx-s)';
  return s==='완료' ? 'var(--tx-ok)' : s==='진행중' ? 'var(--tx-i)' : 'var(--tx-s)';
}
function soDocLabel(d) { return d.clientName || getClientName(d.clientId) || '—'; }

function updateOrderBadge() {
  const b = inp('orderBadge'); if (!b) return;
  const n = orderList.filter(o => o.status !== '완료').length;
  b.textContent = n; b.style.display = n ? '' : 'none';
}

function renderSODoc(type) {
  const cfg = SODOCS[type], idp = cfg.idp, list = soDocList(type);
  ensureDateView(type, idp+'-table', list.map(d=>d.date), ()=>renderSODoc(type));
  const amtOf = d => (d.unitPrice||0)*(d.qty||0);
  const total = list.length;
  const sumAmt = list.reduce((s,d)=>s+Math.round(amtOf(d)*1.1),0);
  let kSent, kDone;
  if (type === 'quote') { kSent = list.filter(d=>d.status==='발송').length; kDone = list.filter(d=>d.status==='수주전환').length; }
  else { kSent = list.filter(d=>d.status==='진행중').length; kDone = list.filter(d=>d.status==='완료').length; }
  if (inp(idp+'-k-total')) inp(idp+'-k-total').textContent = total + '건';
  if (inp(idp+'-k-sent'))  inp(idp+'-k-sent').textContent  = kSent + '건';
  if (inp(idp+'-k-done'))  inp(idp+'-k-done').textContent  = kDone + '건';
  if (inp(idp+'-k-amt'))   inp(idp+'-k-amt').textContent   = '₩' + sumAmt.toLocaleString('ko-KR');
  _kpiActive(idp+'-fs', type==='quote' ? {'발송':idp+'-k-sent','수주전환':idp+'-k-done'} : {'진행중':idp+'-k-sent','완료':idp+'-k-done'});
  updateOrderBadge();

  const fcSel = inp(idp+'-fc');
  if (fcSel) { const cur = fcSel.value; fcSel.innerHTML = '<option value="">전체 고객사</option>' + clients.map(c=>`<option value="${c.id}"${c.id===cur?' selected':''}>${c.name}</option>`).join(''); }
  const fc = v(idp+'-fc'), fs = v(idp+'-fs'), q = (v(idp+'-q')||'').toLowerCase();
  const rows = list.filter(d => {
    if (!dateViewMatch(type, d.date)) return false;
    if (fc && d.clientId !== fc) return false;
    if (fs && d.status !== fs) return false;
    if (q && !(d.itemName||'').toLowerCase().includes(q) && !soDocLabel(d).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const cont = inp(idp+'-table'); if (!cont) return;
  if (!rows.length) {
    cont.innerHTML = empty(`등록된 ${cfg.title}가 없습니다.${type==='order'?' 견적서에서 [수주 전환] 시 자동 생성됩니다.':' [견적서 등록] 버튼으로 추가하세요.'}`);
    return;
  }

  const headExtra = type === 'quote' ? '<th>납기</th>' : '<th>연결 제품(공정)</th>';
  cont.innerHTML = `<table style="min-width:1080px;">
    <thead><tr>
      <th>${type==='quote'?'견적번호':'수주번호'}</th><th>일자</th><th>고객사</th>
      <th>품목명</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th>${headExtra}<th>상태</th><th>관리</th>
    </tr></thead>
    <tbody>${rows.map(d => {
      const sup = (d.unitPrice||0)*(d.qty||0);
      let extraCell;
      if (type === 'quote') extraCell = `<td>${d.deliveryDate||'—'}</td>`;
      else {
        const p = d.productId ? products.find(x=>x.id===d.productId) : null;
        extraCell = `<td style="font-size:11px;">${p?`${p.name}<br><span style="color:var(--tx-i);">${p.processStage}</span>`:'—'}</td>`;
      }
      return `
      <tr>
        <td style="font-weight:700;color:var(--tx-i);">${d.id}</td>
        <td>${d.date}</td>
        <td>${soDocLabel(d)}${d.clientName && !d.clientId?'<br><span style="font-size:9px;color:var(--tx-t);">미등록</span>':''}</td>
        <td style="font-weight:700;">${d.itemName}</td>
        <td style="font-size:11px;color:var(--tx-t);">${d.spec||'—'}</td>
        <td>${d.qty} ${d.unit}</td>
        <td>${d.unitPrice?'₩'+Number(d.unitPrice).toLocaleString('ko-KR'):'—'}</td>
        <td style="font-weight:700;color:var(--tx-i);">₩${sup.toLocaleString('ko-KR')}</td>
        ${extraCell}
        <td><select class="stat-sel" onchange="changeSODocStatus('${type}','${d.id}',this.value)" style="color:${soDocStatusColor(type,d.status)}">
          ${cfg.statuses.map(s=>`<option${s===d.status?' selected':''}>${s}</option>`).join('')}
        </select></td>
        <td style="white-space:nowrap;">
          <button class="edit-btn" onclick="openSODocEdit('${type}','${d.id}')"><i class="ti ti-edit"></i>수정</button>
          <button class="btn btn-sm" style="margin-left:3px;" onclick="openSODocPrint('${type}','${d.id}')" title="PDF 출력"><i class="ti ti-printer"></i></button>
          <button class="btn btn-sm drive-save-btn" style="margin-left:3px;" onclick="saveDocumentBundleToGoogleDrive('${type}','${d.id}')" title="PDF/XLSX Google Drive 저장"><i class="ti ti-cloud-upload"></i>Drive</button>
          <button class="btn btn-sm" style="margin-left:3px;border-color:var(--br-i);color:var(--tx-i);" onclick="openEmailModal(soDocList('${type}').find(x=>x.id==='${d.id}'),'${type}')" title="이메일 발송"><i class="ti ti-mail"></i></button>
          ${type==='quote'
            ? `<button class="btn btn-sm" style="margin-left:3px;border-color:var(--br-ok);color:var(--tx-ok);" onclick="convertQuoteToOrder('${d.id}')" title="수주 전환"${d.status==='수주전환'?' disabled':''}><i class="ti ti-arrow-right-bar"></i>수주전환</button>`
            : `<button class="btn btn-sm" style="margin-left:3px;border-color:var(--br-i);color:var(--tx-i);" onclick="gotoOrderProcess('${d.id}')" title="공정 보기"><i class="ti ti-layout-kanban"></i>공정</button>`}
          <button class="del-btn" style="margin-left:3px;" onclick="deleteSODoc('${type}','${d.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function onSODocClientChange() {
  const cid = v('so2-client');
  const c = clients.find(x => x.id === cid);
  if (c && c.email && !v('so2-email')) sv('so2-email', c.email);
}

function openSODocAdd(type) {
  const cfg = SODOCS[type];
  const modal = inp('sodoc-modal');
  modal.dataset.type = type;
  delete modal.dataset.editId;
  inp('so2-modal-ttl').innerHTML = `<i class="ti ti-file-text" style="color:var(--tx-i);"></i>${cfg.title} 등록`;
  inp('so2-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('so2-status').innerHTML = cfg.statuses.map(s=>`<option>${s}</option>`).join('');
  sv('so2-id', nextDocCode(cfg.prefix, soDocList(type)));
  sv('so2-date', today());
  sv('so2-status', cfg.statuses[0]);
  inp('so2-client').innerHTML = '<option value="">-- 선택 (미등록 시 비움) --</option>' + clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  ['so2-client-text','so2-email','so2-item','so2-spec','so2-note','so2-due'].forEach(id=>sv(id,''));
  sv('so2-qty','1'); sv('so2-unit','대'); sv('so2-price','');
  modal.classList.add('open');
}

function openSODocEdit(type, id) {
  if (!checkAdminAction()) return;
  const cfg = SODOCS[type];
  const d = soDocList(type).find(x=>x.id===id); if (!d) return;
  const modal = inp('sodoc-modal');
  modal.dataset.type = type;
  modal.dataset.editId = id;
  inp('so2-modal-ttl').innerHTML = `<i class="ti ti-edit" style="color:var(--tx-w);"></i>${cfg.title} 수정`;
  inp('so2-save-btn').innerHTML = '<i class="ti ti-check"></i>저장';
  inp('so2-status').innerHTML = cfg.statuses.map(s=>`<option>${s}</option>`).join('');
  sv('so2-id', d.id);
  sv('so2-date', d.date);
  inp('so2-client').innerHTML = '<option value="">-- 선택 (미등록 시 비움) --</option>' + clients.map(c=>`<option value="${c.id}"${c.id===d.clientId?' selected':''}>${c.name}</option>`).join('');
  sv('so2-client-text', d.clientName||'');
  sv('so2-email', d.clientEmail||'');
  sv('so2-item', d.itemName||'');
  sv('so2-spec', d.spec||'');
  sv('so2-qty', d.qty||1);
  sv('so2-unit', d.unit||'대');
  sv('so2-price', d.unitPrice||'');
  sv('so2-due', d.deliveryDate||'');
  sv('so2-note', d.note||'');
  sv('so2-status', d.status || cfg.statuses[0]);
  modal.classList.add('open');
}

function cloneSODoc(type, id) {
  if (!checkAdminAction()) return;
  const cfg = SODOCS[type];
  const d = soDocList(type).find(x=>x.id===id); if (!d) return;
  const modal = inp('sodoc-modal');
  modal.dataset.type = type;
  delete modal.dataset.editId;
  inp('so2-modal-ttl').innerHTML = `<i class="ti ti-copy" style="color:var(--tx-i);"></i>${cfg.title} 복제 등록`;
  inp('so2-save-btn').innerHTML = '<i class="ti ti-check"></i>등록';
  inp('so2-status').innerHTML = cfg.statuses.map(s=>`<option>${s}</option>`).join('');
  sv('so2-id', nextDocCode(cfg.prefix, soDocList(type)));
  sv('so2-date', today());
  inp('so2-client').innerHTML = '<option value="">-- 선택 (미등록 시 비움) --</option>' + clients.map(c=>`<option value="${c.id}"${c.id===d.clientId?' selected':''}>${c.name}</option>`).join('');
  sv('so2-client-text', d.clientName||''); sv('so2-email', d.clientEmail||'');
  sv('so2-item', d.itemName||''); sv('so2-spec', d.spec||'');
  sv('so2-qty', d.qty||1); sv('so2-unit', d.unit||'대'); sv('so2-price', d.unitPrice||'');
  sv('so2-due', d.deliveryDate||''); sv('so2-note', d.note||''); sv('so2-status', cfg.statuses[0]);
  modal.classList.add('open');
}

function saveSODoc() {
  if (!checkAdminAction()) return;
  const modal = inp('sodoc-modal');
  const type = modal.dataset.type || 'quote';
  const cfg = SODOCS[type];
  if (!v('so2-client') && !v('so2-client-text').trim()) { showToast('고객사를 선택하거나 직접 입력하세요.', 'error'); return; }
  if (!v('so2-item').trim()) { showToast('품목명을 입력하세요.', 'error'); return; }
  const data = {
    date: v('so2-date') || today(),
    clientId: v('so2-client'),
    clientName: v('so2-client-text').trim(),
    clientEmail: v('so2-email') || '',
    itemName: v('so2-item').trim(),
    spec: v('so2-spec'),
    qty: Number(v('so2-qty')) || 1,
    unit: v('so2-unit') || '대',
    unitPrice: Number(v('so2-price')) || 0,
    deliveryDate: v('so2-due') || '',
    note: v('so2-note'),
    status: v('so2-status') || cfg.statuses[0]
  };
  const list = soDocList(type);
  const editId = modal.dataset.editId;
  if (editId) {
    const d = list.find(x=>x.id===editId);
    if (d) Object.assign(d, data);
    delete modal.dataset.editId;
    showToast(`${cfg.title}가 수정되었습니다.`);
  } else {
    list.unshift({ id: v('so2-id') || nextDocCode(cfg.prefix, list), orderId:'', productId:'', quoteId:'', ...data });
    showToast(`${cfg.title}가 등록되었습니다.`);
  }
  saveStorage(cfg.key, list);
  closeModal('sodoc-modal');
  renderSODoc(type);
}

function changeSODocStatus(type, id, val) {
  if (!checkAdminAction()) return;
  const d = soDocList(type).find(x=>x.id===id);
  if (d) { d.status = val; saveStorage(SODOCS[type].key, soDocList(type)); renderSODoc(type); }
}

function deleteSODoc(type, id) {
  if (!checkAdminAction()) return;
  const cfg = SODOCS[type];
  const d = soDocList(type).find(x=>x.id===id); if (!d) return;
  confirm_(`${cfg.title} 삭제`, `<strong>${d.id}</strong> (${d.itemName}) 문서를 삭제하시겠습니까?`, () => {
    setSoDocList(type, soDocList(type).filter(x=>x.id!==id));
    saveStorage(cfg.key, soDocList(type));
    renderSODoc(type);
    showToast(`${cfg.title}가 삭제되었습니다.`);
  });
}

function exportSODocCSV(type) {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...', 'error'); return; }
  const cfg = SODOCS[type], list = soDocList(type);
  if (!list.length) { showToast('내보낼 데이터가 없습니다.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const hdr = ['문서번호','일자','고객사','고객이메일','품목명','규격','수량','단위','단가','공급가액','부가세','합계','납기','상태','비고'];
  const rows = list.map(d => {
    const sup = (d.unitPrice||0)*(d.qty||0), vat = Math.round(sup*0.1);
    return [d.id, d.date, soDocLabel(d), d.clientEmail||'', d.itemName, d.spec||'', d.qty, d.unit, d.unitPrice||0, sup, vat, sup+vat, d.deliveryDate||'', d.status, d.note||''];
  });
  const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
  ws['!cols'] = hdr.map(h=>({wch:Math.max(h.length+2,12)}));
  XLSX.utils.book_append_sheet(wb, ws, cfg.title);
  XLSX.writeFile(wb, `${cfg.title}_${today()}.xlsx`);
  showToast('엑셀 파일이 저장되었습니다.');
}

function openSODocPrint(type, id) {
  const cfg = SODOCS[type], list = soDocList(type);
  const targets = Array.isArray(id) ? list.filter(x=>id.includes(x.id)) : (id ? list.filter(x=>x.id===id) : list);
  if (!targets.length) { showToast('출력할 문서가 없습니다.', 'error'); return; }
  const ci = getCompanyInfo();
  const pages = targets.map((d, index) =>
    `<div style="${index < targets.length - 1 ? 'page-break-after:always;' : ''}">${_salesDocBodyHtml(d, cfg.docType, ci)}</div>`
  ).join('');
  const docTitle = id || cfg.title;
  openDocumentPdfPreview(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${docTitle}</title>${_docPrintStyle()}</head><body>${pages}</body></html>`,
    docTitle
  );
}

/* 견적 → 수주 전환: 고객사 자동등록 + 제품(공정 '설계/도면') 자동생성 + 수주 레코드 생성 */
function convertQuoteToOrder(id) {
  if (!checkAdminAction()) return;
  const q = quoteList.find(x=>x.id===id); if (!q) return;
  if (q.status === '수주전환') { showToast('이미 수주 전환된 견적입니다.', 'info'); return; }
  confirm_('수주 전환', `<strong>${q.id}</strong> (${q.itemName}) 견적을 수주로 전환합니다.<br>제품이 자동 생성되어 공정 관리 '설계/도면' 단계로 투입됩니다. 진행할까요?`, () => {
    // 1) 고객사 확보 (미등록·존재하지 않는 clientId면 이름으로 찾거나 자동 등록)
    let clientId = q.clientId;
    const valid = clientId && clients.some(c => c.id === clientId);
    if (!valid) {
      const name = (q.clientName || (clientId ? getClientName(clientId) : '') || '신규 고객사').trim();
      const existing = clients.find(c => c.name === name);
      if (existing) clientId = existing.id;
      else {
        clientId = nextCode('CL', clients);
        clients.push({ id: clientId, name, manager:'', tel:'', email: q.clientEmail||'', date: today(), note: '견적 수주 전환 자동 등록' });
        saveStorage('clients', clients);
      }
    }
    // 2) 제품 자동 생성 (공정 첫 단계)
    const firstStage = processStages[0] || '설계/도면';
    const productId = nextCode('PR', products);
    products.push({
      id: productId, clientId, name: q.itemName, spec: q.spec||'',
      qty: q.qty||1, unit: q.unit||'대', price: q.unitPrice||0,
      deliveryDate: q.deliveryDate||'', processStage: firstStage,
      status: stageToStatus(firstStage), processMemo: `견적 ${q.id} 수주 전환 자동 생성`, note: q.note||''
    });
    saveStorage('products', products);
    // 3) 수주 레코드 생성
    const orderId = nextDocCode('SO', orderList);
    orderList.unshift({
      id: orderId, date: today(), clientId, clientName: q.clientName||'', clientEmail: q.clientEmail||'',
      itemName: q.itemName, spec: q.spec||'', qty: q.qty||1, unit: q.unit||'대', unitPrice: q.unitPrice||0,
      deliveryDate: q.deliveryDate||'', note: q.note||'', status: '수주확정', productId, quoteId: q.id
    });
    saveStorage('orderList', orderList);
    // 4) 견적 상태 갱신
    q.status = '수주전환'; q.orderId = orderId;
    saveStorage('quoteList', quoteList);
    // 화면 갱신
    syncFilterDropdowns && syncFilterDropdowns();
    if (typeof renderClients === 'function') renderClients();
    renderSODoc('quote');
    showToast('수주로 전환되었습니다. 제품이 수주정보관리·공정 관리에 등록되었습니다.', 'success');
  }, 'btn-primary', 'ti-arrow-right-bar');
}

function gotoOrderProcess(id) {
  const o = orderList.find(x=>x.id===id); if (!o) return;
  go('dashboard');
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  setTimeout(()=>{ switchDashTab('process'); setProcView && setProcView('list'); showToast(`수주 ${o.id} 연결 제품: ${o.itemName} — 공정 관리에서 확인`, 'info'); }, 60);
}
