/* ════════ AI 업무 보조 ════════ */

/* ════════ AI 업무 보조 (서버 프록시 경유) ════════════════════════
   공통 규칙: AI 는 초안·분류·검색까지만 한다. 금액 확정·승인은 사람이 한다.
   결과는 항상 "제안"으로 표시하고, 반영은 사용자가 명시적으로 눌러야 일어난다.
   프롬프트는 서버(functions 의 AI_TASKS)가 소유하고 여기서는 데이터만 보낸다. */

/* 버튼을 처리 중 상태로 바꾸고 되돌린다.
   원래 라벨은 처음 한 번만 data-ai-label 에 저장해 둔다. 현재 innerHTML 을 복원값으로
   쓰면(예전 방식) 같은 버튼이 두 번 겹쳐 실행될 때 두 번째가 '처리 중' 자체를 원본으로
   잡아 그대로 되돌려 놓아 버튼이 영영 스피너에 멈춘다. */
function _aiBusy(button, on, label) {
  if (!button) return;
  if (!button.dataset.aiLabel) button.dataset.aiLabel = button.innerHTML;
  button.disabled = on;
  button.innerHTML = on
    ? '<i class="ti ti-loader animate-spin"></i>' + (label || '처리 중')
    : button.dataset.aiLabel;
}

/* ── 1순위: 견적 초안 ──
   RFQ 품목에 대해 과거 견적/수주 이력의 단가를 근거로 초안을 제안한다.
   이력에 없는 품목은 AI 가 null 을 주도록 서버 지시문에 못박아 뒀다(추측 단가 방지). */
function _aiQuoteHistory(itemNames) {
  // 같은 품목명이 등장한 과거 견적/수주를 최근순으로 모은다(최대 20건).
  const wanted = itemNames.map(n => String(n||'').trim().toLowerCase()).filter(Boolean);
  const rows = [];
  [['quote', quoteList], ['order', orderList]].forEach(([type, list]) => {
    (list || []).forEach(doc => {
      _docItems(doc).forEach(item => {
        const name = String(item.itemName||'').trim();
        if (!name || !wanted.includes(name.toLowerCase())) return;
        const price = Number(item.price) || 0;
        if (!price) return;
        rows.push({ type, itemName: name, spec: item.spec || '', unitPrice: price, date: doc.date || '' });
      });
    });
  });
  return rows.sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 20);
}

async function aiDraftQuoteFromRfq(rfqId, event) {
  const button = event && event.currentTarget;
  const r = (rfqList || []).find(x => x.id === rfqId);
  if (!r) { showToast('견적요청서를 찾지 못했습니다.', 'error'); return; }
  const items = _docItems(r);
  if (!items.length) { showToast('견적요청서에 품목이 없습니다.', 'error'); return; }

  _aiBusy(button, true, '초안 생성 중');
  try {
    const history = _aiQuoteHistory(items.map(i => i.itemName));
    const result = await callAiTask('quoteDraft', {
      rfq: {
        supplier: r.supplier || '',
        items: items.map(i => ({ itemName: i.itemName, spec: i.spec || '', qty: Number(i.qty)||0, targetPrice: Number(i.price)||null }))
      },
      history
    });
    _aiShowQuoteDraft(r, result, history.length);
  } catch (e) {
    showToast(e.message || '견적 초안 생성에 실패했습니다.', 'error');
  } finally {
    _aiBusy(button, false);
  }
}

let _aiQuoteDraft = null;
function _aiShowQuoteDraft(rfq, result, historyCount) {
  const list = Array.isArray(result && result.items) ? result.items : [];
  if (!list.length) { showToast('AI 가 제안할 단가를 찾지 못했습니다.', 'info'); return; }
  _aiQuoteDraft = { rfqId: rfq.id, items: list };
  const rows = list.map(x => {
    const known = x.unitPrice != null && Number(x.unitPrice) > 0;
    return '<tr>' +
      '<td>' + esc(x.itemName || '') + '</td>' +
      '<td style="text-align:right;font-weight:700;color:' + (known ? 'var(--tx-i)' : 'var(--tx-t)') + ';">'
        + (known ? fmtW(Number(x.unitPrice)) : '근거 없음') + '</td>' +
      '<td style="font-size:11px;color:var(--tx-t);">' + esc(x.reason || '') + '</td>' +
    '</tr>';
  }).join('');
  confirm_('AI 견적 초안',
    '<div style="font-size:11.5px;color:var(--tx-t);margin-bottom:8px;">과거 견적·수주 ' + historyCount + '건을 참고한 <b>초안</b>입니다. 반드시 검토 후 사용하세요.</div>' +
    '<div style="max-height:260px;overflow:auto;"><table style="width:100%;font-size:12px;">' +
      '<thead><tr><th style="text-align:left;">품목</th><th style="text-align:right;">제안 단가</th><th style="text-align:left;">근거</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
    (result.note ? '<div style="margin-top:8px;font-size:11.5px;">' + esc(result.note) + '</div>' : '') +
    '<div style="margin-top:8px;font-size:11.5px;color:var(--tx-w);">실행하면 이 단가로 <b>견적서를 새로 만듭니다.</b> 금액은 등록 후에도 수정할 수 있습니다.</div>',
    _aiApplyQuoteDraft, 'btn-primary', 'ti-sparkles');
}

/* 초안을 견적서로 만든다 — 등록까지만 하고 발행/확정은 하지 않는다.
   saveSODoc 의 규약을 그대로 따른다: SODOCS 설정 사용, 첫 품목을 최상위 필드에도 동기화
   (목록·인쇄가 최상위 itemName/unitPrice 를 읽는다), 상태는 statuses[0]. */
function _aiApplyQuoteDraft() {
  if (!_aiQuoteDraft) return;
  const cfg = SODOCS.quote;
  if (typeof requireCreateAction === 'function' && !requireCreateAction('quote', cfg.title + ' 등록')) return;
  const r = (rfqList || []).find(x => x.id === _aiQuoteDraft.rfqId);
  if (!r) { showToast('견적요청서를 찾지 못했습니다.', 'error'); return; }
  const priceOf = name => {
    const hit = _aiQuoteDraft.items.find(x => String(x.itemName||'').trim() === String(name||'').trim());
    return hit && hit.unitPrice != null ? Number(hit.unitPrice) || 0 : 0;
  };
  const items = _docItems(r).map(i => ({
    itemName: i.itemName, spec: i.spec || '', qty: Number(i.qty) || 1,
    unit: i.unit || '대', price: priceOf(i.itemName), note: ''
  }));
  const first = items[0];
  const list = soDocList('quote');
  const doc = stampRecordCreate({
    id: nextDocCode(cfg.prefix, list),
    orderId: '', productId: '', quoteId: '',
    date: today(),
    clientId: r.clientId || '',
    clientName: '',
    clientEmail: '',
    clientBizNo: _docClientBizNo({ clientId: r.clientId || '' }),
    itemName: first.itemName, spec: first.spec, qty: first.qty, unit: first.unit,
    unitPrice: first.price,
    deliveryDate: '',
    note: 'AI 초안 (견적요청 ' + r.id + ' 기준) — 단가 검토 필요',
    commonNote: 'AI 초안 (견적요청 ' + r.id + ' 기준) — 단가 검토 필요',
    items,
    status: cfg.statuses[0]
  }, 'quote');
  list.unshift(doc);
  writeAuditLog('quote', doc.id, 'create', null, doc, { summary:'AI 견적 초안 생성', detail:'견적요청 ' + r.id + ' 기준' });
  saveStorage(cfg.key, list);
  _aiQuoteDraft = null;
  if (typeof renderSODoc === 'function') renderSODoc('quote');
  showToast('AI 초안으로 견적서 ' + doc.id + ' 를 만들었습니다. 단가를 검토해 주세요.', 'success');
}

/* ── 2순위: 클레임 분류·조치 초안 ──
   자유 텍스트인 요청 내용에서 유형을 추천하고, 과거 유사 사례의 조치를 근거로 초안을 낸다.
   유형은 등록 폼과 같은 선택지(클레임/AS/기타)로 제한한다 — 서버가 없는 유형을 못 만들게 지시한다. */
const AI_CLAIM_KINDS = ['클레임','AS','기타'];

/* 한국어는 조사가 붙어(베어링 → "베어링에서") 어절을 그대로 포함검사하면 거의 안 맞는다.
   형태소 분석기는 없으므로, 어절에서 앞 2글자 이상을 잘라 서로 겹치는지 양방향으로 본다.
   과하게 맞추려 하지 않는다 — 근거 후보를 추리는 용도이고 최종 판단은 AI 와 사람이 한다. */
function _aiTokens(text) {
  const stop = ['그리고','하지만','에서','으로','합니다','했습니다','있습니다','같습니다'];
  return Array.from(new Set(
    String(text || '').toLowerCase()
      .split(/[^0-9a-z가-힣]+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !stop.includes(w))
  ));
}
function _aiTokenHit(token, hay) {
  if (hay.includes(token)) return true;
  // 조사 제거 근사: 앞에서부터 2글자까지 줄여가며 겹치는지 확인
  for (let len = token.length - 1; len >= 2; len--) {
    if (hay.includes(token.slice(0, len))) return true;
  }
  return false;
}
function _aiClaimHistory(text) {
  // 과거 클레임 중 조치 방안이 채워진 것만 근거로 준다(최대 15건).
  const tokens = _aiTokens(text);
  return (claims || [])
    .filter(c => String(c.response||'').trim())
    .map(c => {
      const hay = (String(c.content||'') + ' ' + String(c.spec||'')).toLowerCase();
      const score = tokens.reduce((s,t) => s + (_aiTokenHit(t, hay) ? 1 : 0), 0);
      return { score, row: { id:c.id, kind:c.kind||'', content:String(c.content||'').slice(0,200), response:String(c.response||'').slice(0,200) } };
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 15)
    .map(x => x.row);
}

async function aiTriageClaim(claimId, event) {
  const button = event && event.currentTarget;
  const c = (claims || []).find(x => x.id === claimId);
  if (!c) { showToast('클레임을 찾지 못했습니다.', 'error'); return; }
  const text = String(c.content || '').trim();
  if (!text) { showToast('분석할 요청 내용이 없습니다.', 'error'); return; }

  _aiBusy(button, true, '분석 중');
  try {
    const result = await callAiTask('claimTriage', {
      text: text.slice(0, 4000),
      types: AI_CLAIM_KINDS,
      history: _aiClaimHistory(text)
    });
    _aiShowClaimTriage(c, result);
  } catch (e) {
    showToast(e.message || 'AI 분석에 실패했습니다.', 'error');
  } finally {
    _aiBusy(button, false);
  }
}

let _aiClaimResult = null;
function _aiShowClaimTriage(claim, result) {
  const type = AI_CLAIM_KINDS.includes(result && result.type) ? result.type : '';
  const conf = Math.round((Number(result && result.confidence) || 0) * 100);
  _aiClaimResult = { id: claim.id, type, action: String(result && result.action || '') };
  const similar = Array.isArray(result && result.similar) && result.similar.length
    ? '<div style="margin-top:8px;font-size:11.5px;color:var(--tx-t);">참고한 유사 사례: ' + esc(result.similar.join(', ')) + '</div>' : '';
  confirm_('AI 클레임 분석',
    '<div style="font-size:11.5px;color:var(--tx-t);margin-bottom:8px;">과거 유사 사례를 근거로 한 <b>제안</b>입니다. 검토 후 반영하세요.</div>' +
    '<div><b>유형</b> ' + (type ? esc(type) : '판단 불가') +
      ' <span style="font-size:11px;color:' + (conf >= 70 ? 'var(--tx-ok)' : 'var(--tx-w)') + ';">확신도 ' + conf + '%</span></div>' +
    '<div style="margin-top:8px;"><b>조치 방안 초안</b><div style="margin-top:4px;">' + esc(_aiClaimResult.action || '제안 없음') + '</div></div>' +
    (result && result.reason ? '<div style="margin-top:8px;font-size:11.5px;color:var(--tx-t);">근거: ' + esc(result.reason) + '</div>' : '') +
    similar +
    '<div style="margin-top:8px;font-size:11.5px;color:var(--tx-w);">실행하면 이 클레임의 유형·조치 방안에 <b>덮어씁니다.</b></div>',
    _aiApplyClaimTriage, 'btn-primary', 'ti-sparkles');
}

function _aiApplyClaimTriage() {
  if (!_aiClaimResult) return;
  const c = (claims || []).find(x => x.id === _aiClaimResult.id);
  if (!c) return;
  if (typeof requireRecordPermission === 'function' && !requireRecordPermission('edit', c, 'claims')) return;
  const before = _safeJsonClone(c);
  if (_aiClaimResult.type) c.kind = _aiClaimResult.type;
  if (_aiClaimResult.action) c.response = _aiClaimResult.action;
  stampRecordUpdate(c, before, 'claims', { visibility:'company' });
  writeAuditLog('claims', c.id, 'update', before, c, { summary:'AI 분류·조치 초안 반영' });
  saveStorage('claims', claims);
  _aiClaimResult = null;
  if (typeof renderClaims === 'function') renderClaims();
  showToast('AI 제안을 반영했습니다. 내용을 검토해 주세요.', 'success');
}

/* ── 3순위: 자연어 검색 ──
   질문을 필터 조건으로 바꾼다. 실행(데이터 조회)은 클라이언트가 한다 —
   AI 에 전체 데이터를 보내지 않으므로 개인정보·원가가 새어나가지 않고 토큰도 아낀다. */
const AI_SEARCH_ENTITIES = {
  deliveries: { label:'납품 현황', fields:['deliveredAt','clientName','productName','qty','price'] },
  poList:     { label:'구매발주서', fields:['date','supplier','itemName','status','unitPrice'] },
  claims:     { label:'고객 클레임', fields:['date','kind','content','status'] },
  inventory:  { label:'재고',      fields:['name','type','qty','minQty','location'] }
};

async function aiNaturalSearch(query, event) {
  const q = String(query || '').trim();
  if (!q) { showToast('검색할 내용을 입력하세요.', 'error'); return null; }
  const button = event && event.currentTarget;
  _aiBusy(button, true, '해석 중');
  try {
    const result = await callAiTask('searchFilter', {
      query: q,
      today: today(),
      entities: Object.keys(AI_SEARCH_ENTITIES).map(k => ({ entity:k, label:AI_SEARCH_ENTITIES[k].label, fields:AI_SEARCH_ENTITIES[k].fields }))
    });
    return result;
  } catch (e) {
    showToast(e.message || '검색 해석에 실패했습니다.', 'error');
    return null;
  } finally {
    _aiBusy(button, false);
  }
}

/* ── AI 검색 UI ──
   AI 는 질문을 필터 조건으로 바꾸기만 하고, 실제 조회는 여기서 한다.
   데이터를 AI 에 보내지 않으므로 개인정보·원가가 새지 않는다.
   통합 검색(타이핑마다 즉시 키워드 검색)과 분리한 이유는 AI 호출이 과금이라
   Enter/버튼으로만 실행해야 하기 때문. */

function _aiEsc(v) {
  if (typeof esc === 'function') return esc(v);
  return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function openAiSearch() {
  if (typeof getGeminiConfig === 'function' && !getGeminiConfig().enabled) {
    showToast('AI 기능이 꺼져 있습니다. 시스템 관리 → API 관리에서 켜세요.', 'error');
    return;
  }
  const dlg = inp('ai-search-dlg'); if (!dlg) return;
  const box = inp('ai-search-result'); if (box) box.innerHTML = '';
  dlg.classList.add('open');
  setTimeout(function() { const i = inp('ai-search-input'); if (i) i.focus(); }, 50);
}
function closeAiSearch() { const d = inp('ai-search-dlg'); if (d) d.classList.remove('open'); }

/* 검색 대상별 행 목록·값 접근·표시. AI 에는 fields 이름만 알려주고(AI_SEARCH_ENTITIES)
   실제 값은 여기서 푼다 — 예: 납품의 거래처는 clientId 라 이름을 따로 조회해야 한다.
   rows() 는 visibleRecords 를 거쳐 권한 밖 데이터가 결과에 섞이지 않게 한다. */
const AI_SEARCH_SOURCES = {
  deliveries: {
    label: '납품 현황', page: 'deliveries',
    rows: function() { return typeof visibleRecords === 'function' ? visibleRecords(deliveries || [], 'delivery') : (deliveries || []); },
    value: function(d, f) {
      return ({
        deliveredAt: d.deliveredAt || '',
        clientName: typeof getClientName === 'function' ? getClientName(d.clientId) : '',
        productName: d.productName || '',
        qty: Number(d.qty) || 0,
        price: Number(d.price) || 0
      })[f];
    },
    line: function(d) {
      const name = typeof getClientName === 'function' ? getClientName(d.clientId) : '';
      return (d.deliveredAt || '-') + ' · ' + name + ' · ' + (d.productName || '') + ' · ' + fmtW((Number(d.price)||0)*(Number(d.qty)||0));
    }
  },
  poList: {
    label: '구매발주서', page: 'po',
    rows: function() { return typeof visiblePurchaseOrderList === 'function' ? visiblePurchaseOrderList() : (poList || []); },
    value: function(p, f) {
      return ({ date: p.date || '', supplier: p.supplier || '', itemName: p.itemName || '', status: p.status || '', unitPrice: Number(p.unitPrice) || 0 })[f];
    },
    line: function(p) { return (p.date || '-') + ' · ' + (p.supplier || '') + ' · ' + (p.itemName || '') + ' · ' + (p.status || ''); }
  },
  claims: {
    label: '고객 클레임', page: 'claims',
    rows: function() { return typeof visibleRecords === 'function' ? visibleRecords(claims || [], 'claims') : (claims || []); },
    value: function(c, f) {
      return ({ date: c.date || '', kind: c.kind || '', content: c.content || '', status: c.status || '' })[f];
    },
    line: function(c) { return (c.date || '-') + ' · ' + (c.kind || '') + ' · ' + String(c.content || '').slice(0, 40) + ' · ' + (c.status || ''); }
  },
  inventory: {
    label: '재고', page: 'inventory',
    rows: function() { return typeof visibleRecords === 'function' ? visibleRecords(inventory || [], 'inventory') : (inventory || []); },
    value: function(i, f) {
      return ({ name: i.name || '', type: i.type || '', qty: Number(i.qty) || 0, minQty: Number(i.minQty) || 0, location: i.location || '' })[f];
    },
    line: function(i) { return (i.id || '') + ' · ' + (i.name || '') + ' · ' + (i.type || '') + ' · 재고 ' + (i.qty != null ? i.qty : 0); }
  }
};

/* AI 가 주는 연산자 표기를 우리가 아는 것으로 맞춘다.
   서버 스키마가 enum 으로 막고 있지만, 함수 배포가 늦거나 모델이 흔들리면 from/to·gte 같은
   표기가 올 수 있다. 그때 미지의 연산자로 떨어지면 날짜 비교가 전부 불일치가 되어
   "결과 0건"이 된다(실제로 그렇게 터졌다). 여기서 흡수해 클라이언트만으로도 동작하게 한다. */
const _AI_OP_ALIASES = {
  from: '>=', since: '>=', after: '>=', gte: '>=', ge: '>=', '≥': '>=',
  to: '<=', until: '<=', before: '<=', lte: '<=', le: '<=', '≤': '<=',
  gt: '>', lt: '<', eq: '=', '==': '=', ne: '!=', neq: '!=',
  like: 'contains', includes: 'contains', has: 'contains'
};
function _aiNormalizeOp(op) {
  const raw = String(op == null ? '' : op).trim();
  return _AI_OP_ALIASES[raw.toLowerCase()] || raw;
}
function _aiFilterMatch(actual, op, expected) {
  const a = actual == null ? '' : actual;
  const isNum = typeof a === 'number';
  const e = isNum ? Number(String(expected).replace(/[^0-9.-]/g, '')) : String(expected == null ? '' : expected).toLowerCase();
  switch (_aiNormalizeOp(op)) {
    case '>=': return isNum ? a >= e : String(a) >= String(expected);
    case '<=': return isNum ? a <= e : String(a) <= String(expected);
    case '>':  return isNum ? a > e  : String(a) > String(expected);
    case '<':  return isNum ? a < e  : String(a) < String(expected);
    case '!=': return isNum ? a !== e : String(a).toLowerCase() !== e;
    case 'contains': return String(a).toLowerCase().includes(e);
    default:   // '=' 및 미지의 연산자 — 문자열은 부분일치로 관대하게 본다(AI 표기가 흔들려도 결과가 나오게)
      return isNum ? a === e : String(a).toLowerCase().includes(e);
  }
}

/* 검색이 진행 중인지. Enter 를 눌렀는데 응답이 늦으면 한 번 더 누르거나 버튼을 클릭하기
   쉬운데, 그렇게 겹쳐 실행되면 버튼 상태가 꼬이고 AI 도 두 번 호출돼(과금) 낭비다. */
let _aiSearchRunning = false;
async function runAiSearch(event) {
  if (_aiSearchRunning) return;
  const field = inp('ai-search-input');
  const q = field ? String(field.value || '').trim() : '';
  if (!q) { showToast('찾을 내용을 입력하세요.', 'error'); return; }
  const box = inp('ai-search-result');
  const button = inp('ai-search-run');
  _aiSearchRunning = true;
  _aiBusy(button, true, '해석 중');
  if (box) box.innerHTML = '';
  try {
    const parsed = await aiNaturalSearch(q, null);
    if (!parsed) return;                       // 실패 시 aiNaturalSearch 가 토스트를 띄운다
    const src = AI_SEARCH_SOURCES[parsed.entity];
    if (!src) {
      box.innerHTML = '<div class="empty" style="font-size:12px;">해석하지 못했습니다. ' + _aiEsc(parsed.reason || '') + '</div>';
      return;
    }
    const filters = Array.isArray(parsed.filters) ? parsed.filters : [];
    const rows = src.rows().filter(function(r) {
      return filters.every(function(f) { return _aiFilterMatch(src.value(r, f.field), f.op, f.value); });
    });
    const cond = filters.length
      // 실제 적용한 연산자(정규화 후)를 보여준다 — AI 표기 그대로 보이면 화면과 동작이 어긋난다
      ? filters.map(function(f) { return _aiEsc(f.field) + ' ' + _aiEsc(_aiNormalizeOp(f.op)) + ' ' + _aiEsc(f.value); }).join(', ')
      : '조건 없음(전체)';
    let html = '<div style="font-size:11.5px;color:var(--tx-t);margin-bottom:6px;"><b>' + _aiEsc(src.label) +
      '</b> 에서 ' + rows.length + '건 · 해석: ' + cond + '</div>';
    if (rows.length) {
      html += '<div style="max-height:240px;overflow:auto;border:1px solid var(--br);border-radius:6px;">' +
        rows.slice(0, 50).map(function(r) {
          return '<div style="padding:6px 9px;border-bottom:1px solid var(--br);font-size:12px;">' + _aiEsc(src.line(r)) + '</div>';
        }).join('') +
        (rows.length > 50 ? '<div style="padding:6px 9px;font-size:11px;color:var(--tx-t);">외 ' + (rows.length - 50) + '건</div>' : '') +
        '</div>' +
        '<div style="margin-top:8px;"><button class="btn btn-sm" onclick="closeAiSearch(); _goTo(\'' + src.page + '\', null);">' +
        '<i class="ti ti-arrow-right"></i>' + _aiEsc(src.label) + ' 화면에서 보기</button></div>';
    } else {
      html += '<div class="empty" style="font-size:12px;">조건에 맞는 항목이 없습니다.</div>';
    }
    box.innerHTML = html;
  } finally {
    _aiSearchRunning = false;
    _aiBusy(button, false);
  }
}
