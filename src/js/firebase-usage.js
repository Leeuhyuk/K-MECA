/* Firebase storage/cost estimate panel */

const FIREBASE_USAGE_PRICING = {
  firestoreFreeBytes: 1024 * 1024 * 1024,
  firestoreStorageUsdPerGiBMonth: 0.18,
  firebaseStorageLegacyFreeBytes: 5 * 1000 * 1000 * 1000,
  firebaseStorageLegacyUsdPerGbMonth: 0.026,
  usdKrw: 1400
};
let firebaseUsageServerSnapshot = null;
let firebaseUsageLoading = false;

function fbUsageEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fbUsageBytes(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value == null ? '' : value);
  try { return new Blob([text]).size; }
  catch(e) { return unescape(encodeURIComponent(text)).length; }
}

function fbUsageBase64Bytes(value) {
  const clean = String(value || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
  if (!clean) return 0;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(clean.length * 3 / 4) - pad);
}

function fbUsageFormatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  const digits = idx <= 1 ? 0 : size < 10 ? 2 : 1;
  return `${size.toFixed(digits)} ${units[idx]}`;
}

function fbUsageFormatMoneyUsd(value) {
  const n = Math.max(0, Number(value) || 0);
  if (n < 0.01) return '$0.00';
  return '$' + n.toFixed(2);
}

function fbUsageFormatMoneyKrw(value) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  return '₩' + n.toLocaleString('ko-KR');
}

function fbUsageReadLocalValue(key) {
  const raw = localStorage.getItem('mes_' + key);
  if (raw == null) return { exists:false, value:null, rawBytes:0 };
  try {
    return { exists:true, value:JSON.parse(raw), rawBytes:fbUsageBytes(raw) };
  } catch(e) {
    return { exists:true, value:null, rawBytes:fbUsageBytes(raw), damaged:true };
  }
}

function fbUsageEstimateFirestoreBytes(payloadBytes, docCount) {
  return Math.round((Number(payloadBytes) || 0) * 1.35 + Math.max(1, Number(docCount) || 1) * 512);
}

function fbUsageLocalKeyStats(key) {
  const item = fbUsageReadLocalValue(key);
  if (!item.exists) return null;
  const value = item.value;
  const isArray = Array.isArray(value);
  const isMap = value && typeof value === 'object' && !isArray;
  const count = isArray ? value.length : isMap ? Object.keys(value).length : 1;
  const docCount = isArray ? value.length + 1 : isMap ? 2 : 1;
  return {
    key,
    source: 'local',
    type: isArray ? 'array' : isMap ? 'map' : typeof value,
    count,
    docCount,
    payloadBytes: item.rawBytes,
    estimatedBytes: fbUsageEstimateFirestoreBytes(item.rawBytes, docCount),
    damaged: !!item.damaged
  };
}

function fbUsageLocalEstimate() {
  const keys = (typeof CLOUD_KEYS !== 'undefined' && Array.isArray(CLOUD_KEYS)) ? CLOUD_KEYS : [];
  const rows = keys.map(fbUsageLocalKeyStats).filter(Boolean);
  const emailHistory = fbUsageReadLocalValue('emailSendHistory');
  const emailRows = Array.isArray(emailHistory.value) ? emailHistory.value : [];
  const mailAttachmentCount = emailRows.filter(row => row && row.attachmentName).length;
  const localPayloadBytes = rows.reduce((sum, row) => sum + row.payloadBytes, 0);
  const firestoreBytes = rows.reduce((sum, row) => sum + row.estimatedBytes, 0);
  const docCount = rows.reduce((sum, row) => sum + row.docCount, 0);
  return {
    source: 'local',
    collectedAt: new Date().toISOString(),
    rows,
    firestoreBytes,
    localPayloadBytes,
    docCount,
    readCount: 0,
    mailDocs: emailRows.length,
    mailAttachmentCount,
    mailAttachmentBytes: 0,
    notes: ['브라우저에 동기화된 데이터 기준 추정치입니다.']
  };
}

function fbUsageCostForFirestore(bytes) {
  const gib = Math.max(0, Number(bytes) || 0) / FIREBASE_USAGE_PRICING.firestoreFreeBytes;
  const billableGiB = Math.max(0, gib - 1);
  const usd = billableGiB * FIREBASE_USAGE_PRICING.firestoreStorageUsdPerGiBMonth;
  return { gib, billableGiB, usd, krw:usd * FIREBASE_USAGE_PRICING.usdKrw };
}

function fbUsageProjectId() {
  return (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) || 'k-meca';
}

function fbUsageConsoleUrl(kind) {
  const project = encodeURIComponent(fbUsageProjectId());
  if (kind === 'billing') return `https://console.cloud.google.com/billing?project=${project}`;
  if (kind === 'firestore') return `https://console.firebase.google.com/project/${project}/firestore`;
  if (kind === 'storage') return `https://console.cloud.google.com/storage/browser?project=${project}`;
  return `https://console.firebase.google.com/project/${project}/usage`;
}

function openFirebaseUsageConsole(kind) {
  window.open(fbUsageConsoleUrl(kind), '_blank', 'noopener');
}

function fbUsageMetric(title, value, sub, icon, tone) {
  return `<div class="mc">
    <div class="mc-lbl"><i class="ti ${icon || 'ti-database'}"></i>${fbUsageEsc(title)}</div>
    <div class="mc-val ${tone || ''}">${value}</div>
    ${sub ? `<div class="mc-sub">${sub}</div>` : ''}
  </div>`;
}

function fbUsageProgress(label, value, max, help) {
  const pct = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return `<div style="margin-top:10px;">
    <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--tx-s);">
      <strong>${fbUsageEsc(label)}</strong><span>${pct.toFixed(3)}%</span>
    </div>
    <div style="height:8px;background:var(--bg-s);border:1px solid var(--br);border-radius:999px;overflow:hidden;margin-top:5px;">
      <div style="height:100%;width:${pct}%;background:var(--tx-i);"></div>
    </div>
    ${help ? `<div style="font-size:11px;color:var(--tx-t);margin-top:5px;">${help}</div>` : ''}
  </div>`;
}

function fbUsageRowsTable(rows) {
  const list = (rows || []).slice().sort((a, b) => b.estimatedBytes - a.estimatedBytes).slice(0, 12);
  if (!list.length) return '<div class="empty"><i class="ti ti-database-off"></i>계산할 동기화 데이터가 없습니다.</div>';
  return `<div style="overflow:auto;max-height:360px;">
    <table>
      <thead><tr><th>항목</th><th>유형</th><th>레코드</th><th>문서 추정</th><th>Payload</th><th>Firestore 추정</th></tr></thead>
      <tbody>
        ${list.map(row => `<tr>
          <td style="font-weight:800;">${fbUsageEsc(row.key)}${row.damaged ? '<div style="font-size:10px;color:var(--tx-d);">JSON 손상</div>' : ''}</td>
          <td>${fbUsageEsc(row.type || '-')}</td>
          <td>${Number(row.count || 0).toLocaleString('ko-KR')}</td>
          <td>${Number(row.docCount || 0).toLocaleString('ko-KR')}</td>
          <td>${fbUsageFormatBytes(row.payloadBytes)}</td>
          <td style="font-weight:800;color:var(--tx-i);">${fbUsageFormatBytes(row.estimatedBytes)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function fbUsageAssumptionCard() {
  const bucket = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.storageBucket) || '';
  return `<div class="card">
    <div class="card-hd">
      <span class="card-ttl"><i class="ti ti-info-circle"></i>계산 기준</span>
    </div>
    <div style="font-size:12px;color:var(--tx-s);line-height:1.8;">
      <div>· Firestore 저장 용량은 JSON payload에 문서/필드/index 오버헤드를 더한 추정치입니다.</div>
      <div>· 실제 청구 금액은 Google Cloud Billing 기준이 최종입니다. 이 화면은 과금 위험을 빠르게 보기 위한 운영용 추정 화면입니다.</div>
      <div>· Firebase Storage 버킷 <b>${fbUsageEsc(bucket || '미설정')}</b>의 실제 사용량은 브라우저 권한만으로 조회할 수 없어 콘솔 링크를 제공합니다.</div>
      <div>· 현재 단가 가정: Firestore 저장 ${FIREBASE_USAGE_PRICING.firestoreStorageUsdPerGiBMonth}$/GiB-month, 환율 ${FIREBASE_USAGE_PRICING.usdKrw.toLocaleString('ko-KR')}원/USD.</div>
    </div>
  </div>`;
}

function renderFirebaseUsageSettings() {
  const body = inp('firebase-storage-usage-body');
  if (!body) return;
  const local = fbUsageLocalEstimate();
  const basis = firebaseUsageServerSnapshot || local;
  const cost = fbUsageCostForFirestore(basis.firestoreBytes);
  const sourceText = basis.source === 'server' ? '서버 스캔 기준' : '로컬 동기화 데이터 기준';
  const serverTime = basis.collectedAt ? new Date(basis.collectedAt).toLocaleString('ko-KR') : '-';
  body.innerHTML = `
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-database-dollar"></i>스토리지/요금 요약</span>
        <span style="font-size:11px;color:var(--tx-t);">${sourceText} · ${fbUsageEsc(serverTime)}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn btn-primary" type="button" onclick="refreshFirebaseUsageServerEstimate()" ${firebaseUsageLoading ? 'disabled' : ''}>
          <i class="ti ${firebaseUsageLoading ? 'ti-loader-2 animate-spin' : 'ti-refresh'}"></i>${firebaseUsageLoading ? '계산 중' : '서버 용량 다시 계산'}
        </button>
        <button class="btn" type="button" onclick="openFirebaseUsageConsole('usage')"><i class="ti ti-external-link"></i>Firebase 사용량</button>
        <button class="btn" type="button" onclick="openFirebaseUsageConsole('billing')"><i class="ti ti-receipt-2"></i>Billing 콘솔</button>
        <button class="btn" type="button" onclick="openFirebaseUsageConsole('storage')"><i class="ti ti-folder-dollar"></i>Storage 콘솔</button>
      </div>
      <div class="metrics" style="grid-template-columns:repeat(4,minmax(0,1fr));">
        ${fbUsageMetric('Firestore 추정 저장량', fbUsageFormatBytes(basis.firestoreBytes), `무료 1GiB 중 ${(cost.gib * 100).toFixed(3)}%`, 'ti-database')}
        ${fbUsageMetric('예상 월 저장비', `${fbUsageFormatMoneyUsd(cost.usd)} / ${fbUsageFormatMoneyKrw(cost.krw)}`, '무료 구간 초과분만 계산', 'ti-cash', cost.usd > 0 ? 'dn' : 'up')}
        ${fbUsageMetric('Firestore 문서 추정', Number(basis.docCount || 0).toLocaleString('ko-KR') + '개', `서버 계산 읽기 ${Number(basis.readCount || 0).toLocaleString('ko-KR')}회`, 'ti-files')}
        ${fbUsageMetric('메일 첨부 누적', fbUsageFormatBytes(basis.mailAttachmentBytes || 0), `${Number(basis.mailAttachmentCount || 0).toLocaleString('ko-KR')}건`, 'ti-paperclip')}
      </div>
      ${fbUsageProgress('Firestore 무료 저장 용량 1GiB 대비', basis.firestoreBytes, FIREBASE_USAGE_PRICING.firestoreFreeBytes, `${fbUsageFormatBytes(basis.firestoreBytes)} / 1 GiB`)}
      ${basis.source !== 'server' ? '<div class="al al-warn" style="margin-top:12px;"><i class="ti ti-alert-triangle"></i><div><div class="al-t">서버 기준이 아닙니다.</div><div class="al-s">정확도를 높이려면 서버 용량 다시 계산을 누르세요. 이 작업은 Firestore 문서를 읽으므로 소량의 읽기 사용량이 발생합니다.</div></div></div>' : ''}
    </div>
    <div class="row2">
      <div class="card">
        <div class="card-hd"><span class="card-ttl"><i class="ti ti-list-details"></i>용량 상위 항목</span></div>
        ${fbUsageRowsTable(basis.rows)}
      </div>
      ${fbUsageAssumptionCard()}
    </div>
  `;
}

async function fbUsageReadDoc(ref, label, rows, counters) {
  const snap = await ref.get();
  counters.readCount++;
  if (!snap.exists) return 0;
  const data = snap.data() || {};
  const bytes = fbUsageBytes(data);
  rows.push({
    key: label,
    source: 'server',
    type: 'doc',
    count: 1,
    docCount: 1,
    payloadBytes: bytes,
    estimatedBytes: fbUsageEstimateFirestoreBytes(bytes, 1)
  });
  return bytes;
}

async function refreshFirebaseUsageServerEstimate() {
  if (firebaseUsageLoading) return;
  if (typeof _cloudActive === 'undefined' || !_cloudActive || typeof _fbDb === 'undefined' || !_fbDb) {
    showToast('Firebase 로그인 후 서버 용량을 계산할 수 있습니다.', 'error');
    return;
  }
  firebaseUsageLoading = true;
  renderFirebaseUsageSettings();
  const rows = [];
  const counters = { readCount:0, mailDocs:0, mailAttachmentCount:0, mailAttachmentBytes:0 };
  try {
    const keys = (typeof CLOUD_KEYS !== 'undefined' && Array.isArray(CLOUD_KEYS)) ? CLOUD_KEYS : [];
    for (const key of keys) {
      const base = _fbDb.collection('mes_v2').doc(key);
      let payloadBytes = 0;
      let docCount = 0;
      try {
        const meta = await base.get();
        counters.readCount++;
        if (meta.exists) {
          payloadBytes += fbUsageBytes(meta.data() || {});
          docCount++;
        }
        const state = await base.collection('state').doc('current').get();
        counters.readCount++;
        if (state.exists) {
          payloadBytes += fbUsageBytes(state.data() || {});
          docCount++;
        }
        const items = await base.collection('items').get();
        counters.readCount += items.size;
        items.forEach(doc => {
          payloadBytes += fbUsageBytes(doc.data() || {});
          docCount++;
        });
        if (docCount) {
          rows.push({
            key,
            source: 'server',
            type: items.size ? 'array' : 'map',
            count: items.size || (state.exists ? 1 : 0),
            docCount,
            payloadBytes,
            estimatedBytes: fbUsageEstimateFirestoreBytes(payloadBytes, docCount)
          });
        }
      } catch(e) {
        rows.push({ key, source:'server', type:'권한 오류', count:0, docCount:0, payloadBytes:0, estimatedBytes:0, damaged:true });
      }
    }
    try {
      const mailSnap = await _fbDb.collection('mail').get();
      counters.readCount += mailSnap.size;
      counters.mailDocs = mailSnap.size;
      let mailBytes = 0;
      mailSnap.forEach(doc => {
        const data = doc.data() || {};
        mailBytes += fbUsageBytes(data);
        const atts = data.message && Array.isArray(data.message.attachments) ? data.message.attachments : [];
        atts.forEach(att => {
          counters.mailAttachmentCount++;
          counters.mailAttachmentBytes += fbUsageBase64Bytes(att && att.content);
        });
      });
      rows.push({
        key: 'mail',
        source: 'server',
        type: 'collection',
        count: mailSnap.size,
        docCount: mailSnap.size,
        payloadBytes: mailBytes,
        estimatedBytes: fbUsageEstimateFirestoreBytes(mailBytes, mailSnap.size)
      });
    } catch(e) {
      rows.push({ key:'mail', source:'server', type:'권한 오류', count:0, docCount:0, payloadBytes:0, estimatedBytes:0, damaged:true });
    }
    for (const col of ['users', 'roles']) {
      try {
        const snap = await _fbDb.collection(col).get();
        counters.readCount += snap.size;
        let bytes = 0;
        snap.forEach(doc => { bytes += fbUsageBytes(doc.data() || {}); });
        rows.push({
          key: col,
          source: 'server',
          type: 'collection',
          count: snap.size,
          docCount: snap.size,
          payloadBytes: bytes,
          estimatedBytes: fbUsageEstimateFirestoreBytes(bytes, snap.size)
        });
      } catch(e) {
        rows.push({ key:col, source:'server', type:'권한 오류', count:0, docCount:0, payloadBytes:0, estimatedBytes:0, damaged:true });
      }
    }
    firebaseUsageServerSnapshot = {
      source: 'server',
      collectedAt: new Date().toISOString(),
      rows,
      firestoreBytes: rows.reduce((sum, row) => sum + row.estimatedBytes, 0),
      localPayloadBytes: rows.reduce((sum, row) => sum + row.payloadBytes, 0),
      docCount: rows.reduce((sum, row) => sum + row.docCount, 0),
      readCount: counters.readCount,
      mailDocs: counters.mailDocs,
      mailAttachmentCount: counters.mailAttachmentCount,
      mailAttachmentBytes: counters.mailAttachmentBytes,
      notes: ['Firestore 서버 문서를 읽어 계산한 추정치입니다.']
    };
    showToast('서버 스토리지 용량 계산을 완료했습니다.', 'success');
  } catch(e) {
    showToast('스토리지 용량 계산 실패: ' + (e && e.message ? e.message : e), 'error');
  } finally {
    firebaseUsageLoading = false;
    renderFirebaseUsageSettings();
  }
}
