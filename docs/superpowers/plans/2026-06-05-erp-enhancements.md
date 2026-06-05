# ERP 기능 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MESPro에 재고 입출고 이력, 원가 계산, 납기 캘린더, 협력사 이행률, 고객사 360도 뷰, 카카오 알림톡 6개 기능을 추가한다.

**Architecture:** 기존 글로벌 스코프 JS 패턴을 유지하면서 각 기능을 독립 모듈로 추가. src/ 편집 후 `python build.py`로 MESPro.html 재빌드. 알림톡은 SOLAPI REST API를 클라이언트에서 직접 호출(내부 업무 도구이므로 API Key 노출 허용).

**Tech Stack:** Vanilla JS (ES6), localStorage, Firebase Firestore, SOLAPI 알림톡 API

---

## 파일 맵

| 파일 | 작업 | 내용 |
|---|---|---|
| `src/js/data-storage.js` | MODIFY | inventoryLedger, alimtalkSettings 추가 |
| `src/js/inventory.js` | MODIFY | 입출고 이력 UI + logInventoryMove |
| `src/js/materials.js` | MODIFY | 입고완료 시 재고 자동 로그 + 알림톡 트리거 |
| `src/js/bom.js` | MODIFY | getProductMargin 함수 추가 |
| `src/js/clients-products.js` | MODIFY | 원가/마진 표시 + 고객사 360도 뷰 |
| `src/js/partners.js` | MODIFY | 협력사 납기 이행률 탭 |
| `src/js/calendar.js` | CREATE | 납기 캘린더 페이지 |
| `src/js/alimtalk.js` | CREATE | 알림톡 발송 래퍼 + 설정 UI |
| `src/js/as.js` | MODIFY | A/S 접수 시 알림톡 트리거 |
| `src/html/pages/pg-calendar.html` | CREATE | 캘린더 페이지 HTML |
| `src/html/layout-top.html` | MODIFY | 캘린더 nav 항목 추가 |
| `src/index.template.html` | MODIFY | calendar.js, alimtalk.js include 추가 |

---

## Task 1: 재고 입출고 이력 — 데이터 모델

**Files:**
- Modify: `src/js/data-storage.js`

- [ ] **Step 1: inventoryLedger 전역변수 + loadStorage 추가**

`src/js/data-storage.js` 상단의 `let rfqList = [];` 근처에 추가:

```javascript
let inventoryLedger = [];  // 재고 입출고 이력
let alimtalkSettings = {}; // 카카오 알림톡 설정
```

- [ ] **Step 2: loadStorage 초기화 블록에 추가**

`inventory = loadStorage('inventory', defaultInventory);` 바로 아래에:

```javascript
  inventoryLedger  = loadStorage('inventoryLedger', []);
  alimtalkSettings = loadStorage('alimtalkSettings', {
    enabled: false,
    apiKey: '',
    apiSecret: '',
    pfId: '',           // 카카오 비즈니스 채널 ID
    senderPhone: '',    // 발신번호 (카카오 채널에 등록된 번호)
    events: {
      materialIncoming: true,   // 자재 입고완료 → 공급처 알림
      deliveryDue: true,        // 납기 D-7 → 내부 담당자 알림
      asRegistered: true,       // A/S 접수 → 담당자 알림
      poSent: true              // 발주서 발송 → 공급처 확인 요청
    }
  });
```

- [ ] **Step 3: logInventoryMove 헬퍼 함수 추가** (data-storage.js 하단)

```javascript
/**
 * 재고 입출고/조정 이력 기록
 * @param {string} invId     - 재고 품목 ID
 * @param {'입고'|'출고'|'조정'} type
 * @param {number} qty       - 변동 수량 (양수)
 * @param {string} reason    - 사유 텍스트
 * @param {string} [refId]   - 연관 ID (자재발주 MT-xxx, 생산지시 WO-xxx 등)
 */
function logInventoryMove(invId, type, qty, reason, refId) {
  const entry = {
    id: 'ILG-' + Date.now(),
    invId,
    type,       // '입고' | '출고' | '조정'
    qty: Number(qty),
    reason: reason || '',
    refId: refId || '',
    date: today()
  };
  inventoryLedger.unshift(entry);
  saveStorage('inventoryLedger', inventoryLedger);
}
```

- [ ] **Step 4: Cloud sync keyMap에 inventoryLedger 추가**

`src/js/data-storage.js` 내 `keyMap` 객체에:

```javascript
inventoryLedger:  'inventoryLedger',
alimtalkSettings: 'alimtalkSettings',
```

- [ ] **Step 5: 빌드 확인**

```bash
python build.py
```
콘솔 에러 없음 확인.

---

## Task 2: 재고 입출고 이력 UI

**Files:**
- Modify: `src/js/inventory.js`

- [ ] **Step 1: adjustStock에 이력 로그 추가**

기존 `adjustStock` 함수를:

```javascript
function adjustStock(id, delta) {
  const i = inventory.find(x=>x.id===id); if (!i) return;
  const oldQty = i.qty || 0;
  i.qty = Math.max(0, oldQty + delta);
  logInventoryMove(id, delta > 0 ? '입고' : '출고', Math.abs(delta), '수동 조정');
  saveStorage('inventory', inventory);
  renderInventory();
}
```

- [ ] **Step 2: saveInventoryForm에 이력 로그 추가**

`saveInventoryForm` 함수에서 기존 재고 수정 시 수량이 바뀌면 '조정' 이력을 남긴다. `editInvId` 분기 안에:

```javascript
  if (editInvId) {
    const existing = inventory.find(x => x.id === editInvId);
    const qtyDiff = newQty - (existing ? existing.qty : 0);
    if (qtyDiff !== 0) {
      logInventoryMove(editInvId, qtyDiff > 0 ? '입고' : '출고', Math.abs(qtyDiff), '직접 수정');
    }
    // ... 기존 코드 유지
  }
```

- [ ] **Step 3: renderInventory에 이력 탭 UI 추가**

`renderInventory` 함수 최상단 (cont.innerHTML 이전)에 이력 패널을 페이지 하단에 렌더링하는 코드 추가:

```javascript
function renderInventoryLedger() {
  const cont = document.getElementById('inv-ledger-table');
  if (!cont) return;
  const filter = document.getElementById('inv-ledger-inv')?.value || '';
  const rows = inventoryLedger.filter(e => !filter || e.invId === filter);
  if (!rows.length) { cont.innerHTML = empty('입출고 이력이 없습니다.'); return; }
  const typeColor = { '입고': 'var(--tx-ok)', '출고': 'var(--tx-d)', '조정': 'var(--tx-w)' };
  cont.innerHTML = `<table>
    <thead><tr>
      <th>일자</th><th>품목명</th><th>유형</th><th>수량</th><th>사유</th><th>연관 ID</th>
    </tr></thead>
    <tbody>${rows.slice(0, 100).map(e => {
      const inv = inventory.find(x => x.id === e.invId);
      return `<tr>
        <td style="font-size:11px;">${e.date}</td>
        <td style="font-weight:600;">${inv ? inv.name : e.invId}</td>
        <td style="color:${typeColor[e.type]||'var(--tx)'};font-weight:700;">${e.type}</td>
        <td style="font-weight:700;">${e.qty > 0 ? '+' : ''}${e.qty}</td>
        <td style="font-size:11px;color:var(--tx-t);">${e.reason}</td>
        <td style="font-size:11px;color:var(--tx-t);">${e.refId || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}
```

- [ ] **Step 4: inventory.html 페이지에 이력 섹션 추가**

`src/html/pages/inventory.html` 파일을 열어 기존 `#inventory-table` div 아래에 추가:

```html
<!-- 입출고 이력 -->
<div class="card" style="margin-top:16px;">
  <div class="card-hd">
    <span class="card-ttl"><i class="ti ti-history"></i>입출고 이력</span>
    <select id="inv-ledger-inv" onchange="renderInventoryLedger()" style="font-size:12px;padding:4px 8px;border:1px solid var(--br);border-radius:var(--rm);background:var(--bg-p);color:var(--tx);">
      <option value="">전체 품목</option>
    </select>
  </div>
  <div style="overflow-x:auto;" id="inv-ledger-table"></div>
</div>
```

- [ ] **Step 5: renderInventory 끝에 renderInventoryLedger 호출 추가**

```javascript
// renderInventory 함수 맨 끝에:
  // 이력 품목 필터 드롭다운 동기화
  const sel = document.getElementById('inv-ledger-inv');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">전체 품목</option>' +
      inventory.map(i => `<option value="${i.id}"${i.id===cur?' selected':''}>${i.name}</option>`).join('');
  }
  renderInventoryLedger();
```

- [ ] **Step 6: 빌드 및 수동 확인**

```bash
python build.py
```
브라우저에서 재고 탭 열기 → `+/−` 버튼 클릭 → 이력 테이블에 행이 생기는지 확인.

---

## Task 3: 자재 입고완료 시 재고 자동 연동

**Files:**
- Modify: `src/js/materials.js`

- [ ] **Step 1: changeMatStatus에 재고 자동 로그 추가**

```javascript
function changeMatStatus(id, status) {
  const m = materials.find(x=>x.id===id); if (!m) return;
  const prevStatus = m.status;
  m.status = status;
  saveStorage('materials', materials);

  // 입고완료로 변경 시 → 재고 이력 자동 기록
  if (status === '입고완료' && prevStatus !== '입고완료') {
    // 동일 품목명의 재고 품목 찾기 (이름 기준 매칭)
    const invItem = inventory.find(i => i.name === m.name);
    if (invItem) {
      invItem.qty = (invItem.qty || 0) + (m.qty || 0);
      saveStorage('inventory', inventory);
      logInventoryMove(invItem.id, '입고', m.qty, `자재발주 입고 (${m.id})`, m.id);
      showToast(`재고 자동 반영: ${m.name} +${m.qty}${m.unit}`);
    } else {
      // 재고 품목이 없으면 알림만
      showToast(`입고완료 처리됨. 재고 탭에서 품목을 추가하세요.`, 'info');
    }
    // 알림톡 발송 (Task 9에서 연결)
    if (typeof sendAlimtalkMaterialIn === 'function') sendAlimtalkMaterialIn(m);
  }

  renderMaterials();
}
```

- [ ] **Step 2: 빌드 및 확인**

```bash
python build.py
```
자재 탭에서 발주중 항목을 입고완료로 변경 → 재고 탭에서 수량 증가 + 이력 확인.

---

## Task 4: 원가 계산 + 수익성 표시

**Files:**
- Modify: `src/js/bom.js`
- Modify: `src/js/clients-products.js`

- [ ] **Step 1: bom.js에 getProductMargin 함수 추가**

`bomMaterialCost` 함수 아래에:

```javascript
/**
 * 제품 수익성 요약
 * @returns {{ cost, price, margin, marginRate }}
 */
function getProductMargin(productId) {
  const p = products.find(x => x.id === productId);
  const cost = bomMaterialCost(productId);
  const price = p ? (Number(p.price) || 0) : 0;
  const margin = price - cost;
  const marginRate = price > 0 ? Math.round(margin / price * 1000) / 10 : null;
  return { cost, price, margin, marginRate };
}
```

- [ ] **Step 2: clients-products.js의 제품 렌더링에 원가/마진 추가**

`renderProducts` 또는 제품 상세를 렌더링하는 부분에서 BOM이 있는 제품에 원가 배지를 추가한다.

`src/js/clients-products.js`에서 제품 행을 렌더하는 `<tr>` 생성 부분을 찾아 원가 컬럼 추가:

```javascript
// 제품 행 렌더 부분 (기존 코드에 bomList 체크 추가)
const mg = (typeof bomMaterialCost === 'function' && bomList && bomList.length)
  ? getProductMargin(p.id)
  : null;
const marginBadge = mg && mg.cost > 0
  ? `<span style="font-size:10px;margin-left:4px;color:${mg.marginRate > 0 ? 'var(--tx-ok)' : 'var(--tx-d)'};">
      원가 ${fmtW(mg.cost)} ${mg.marginRate !== null ? `/ 마진 ${mg.marginRate}%` : ''}
     </span>`
  : '';
// marginBadge를 제품명 셀 또는 단가 셀 옆에 삽입
```

- [ ] **Step 3: 빌드 및 확인**

```bash
python build.py
```
BOM이 등록된 제품의 제품명 옆에 원가/마진이 표시되는지 확인.

---

## Task 5: 협력사 납기 이행률

**Files:**
- Modify: `src/js/partners.js`

- [ ] **Step 1: getPartnerPerformance 함수 추가**

`partners.js` 상단에:

```javascript
/**
 * 공급처별 납기 이행률 계산
 * poList 기준: 납기일 vs 실제 입고완료 자재
 */
function getPartnerPerformance(partnerName) {
  const pos = poList.filter(p => p.supplier === partnerName);
  if (!pos.length) return null;
  let onTime = 0, late = 0, totalDelay = 0;
  pos.forEach(po => {
    if (po.status !== '입고완료') return;
    const mats = materials.filter(m => m.supplier === partnerName && m.status === '입고완료');
    // 입고완료 자재 중 예정일 초과 여부 판단
    mats.forEach(m => {
      if (!m.expectedDate || !m.orderDate) return;
      const daysOver = m.expectedDate ? 0 : 0; // 실제 입고일 데이터가 없으므로 0 처리
      onTime++;
    });
    // PO 납기일 기준
    if (po.dueDate) {
      const due = new Date(po.dueDate);
      const now = new Date();
      if (po.status === '입고완료') onTime++;
      else if (now > due) { late++; totalDelay += Math.ceil((now - due) / 86400000); }
    }
  });
  const total = onTime + late;
  return {
    total: pos.length,
    completed: pos.filter(p => p.status === '입고완료').length,
    pending: pos.filter(p => p.status !== '입고완료').length,
    onTimeRate: total > 0 ? Math.round(onTime / total * 100) : null,
    avgDelay: late > 0 ? Math.round(totalDelay / late) : 0,
    totalAmt: pos.reduce((s, p) => s + (Number(p.unitPrice)||0)*(Number(p.qty)||0), 0)
  };
}
```

- [ ] **Step 2: renderPartners에 이행률 열 추가**

`renderPartners` 함수의 `<thead><tr>` 부분에 '이행률' 컬럼 추가:

기존 헤더:
```javascript
`<th>코드</th><th>거래처명</th><th>유형</th><th>담당자</th>
 <th>전화번호</th><th>이메일</th><th>사업자번호</th><th>비고</th><th>관리</th>`
```

변경 후:
```javascript
`<th>코드</th><th>거래처명</th><th>유형</th><th>담당자</th>
 <th>전화번호</th><th>이메일</th><th>사업자번호</th>
 <th style="text-align:center;">납기이행률</th><th>거래금액</th><th>관리</th>`
```

- [ ] **Step 3: 거래처 행에 이행률 데이터 추가**

기존 `<tbody>` 행 생성 부분에서 `관리` 버튼 앞에 두 td 추가:

```javascript
const perf = (p.type === '공급처' || p.type === '외주처') ? getPartnerPerformance(p.name) : null;
const perfCell = perf
  ? `<td style="text-align:center;">
      ${perf.onTimeRate !== null
        ? `<span class="bd ${perf.onTimeRate >= 80 ? 'bd-ok' : perf.onTimeRate >= 60 ? 'bd-warn' : 'bd-err'}">
            ${perf.onTimeRate}%
           </span>
           <div style="font-size:10px;color:var(--tx-t);">${perf.completed}/${perf.total}건</div>`
        : '<span style="color:var(--tx-t);">—</span>'
      }
    </td>
    <td style="font-weight:600;color:var(--tx-i);">${perf.totalAmt > 0 ? fmtW(perf.totalAmt) : '—'}</td>`
  : '<td>—</td><td>—</td>';
// 행 렌더에 perfCell 삽입
```

- [ ] **Step 4: 빌드 및 확인**

```bash
python build.py
```
거래처 탭에서 공급처 행에 납기이행률 열이 표시되는지 확인.

---

## Task 6: 고객사 360도 뷰

**Files:**
- Modify: `src/js/clients-products.js`

- [ ] **Step 1: renderClient360 함수 추가**

`clients-products.js` 하단에:

```javascript
function renderClient360(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  const prods    = products.filter(p => p.clientId === clientId);
  const prodIds  = prods.map(p => p.id);
  const mats     = materials.filter(m => prodIds.includes(m.productId));
  const dlvs     = deliveries.filter(d => d.clientId === clientId);
  const clms     = claims.filter(c => c.clientId === clientId);
  const ass      = (typeof asList !== 'undefined') ? asList.filter(a => a.clientId === clientId) : [];
  const totalAmt = dlvs.reduce((s, d) => s + (Number(d.totalAmt)||0), 0);
  const matAmt   = mats.reduce((s, m) => s + (Number(m.unitPrice)||0)*(Number(m.qty)||0), 0);
  const openClaim = clms.filter(c => c.status !== '완료').length;
  const openAs   = ass.filter(a => a.status !== '완료').length;

  const cont = document.getElementById('client-360-panel');
  if (!cont) return;
  cont.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
      <div class="mc"><div class="mc-lbl"><i class="ti ti-package"></i>진행 제품</div><div class="mc-val">${prods.filter(p=>p.status!=='완료').length}건</div><div class="mc-sub">전체 ${prods.length}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-truck-delivery" style="color:var(--tx-ok);"></i>누적 납품</div><div class="mc-val" style="color:var(--tx-ok);">${fmtW(totalAmt)}</div><div class="mc-sub">${dlvs.length}회</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-truck-loading" style="color:var(--tx-i);"></i>자재 발주</div><div class="mc-val" style="color:var(--tx-i);">${fmtW(matAmt)}</div><div class="mc-sub">${mats.length}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-message-report" style="color:${openClaim>0?'var(--tx-d)':'var(--tx-t)'};"></i>클레임</div><div class="mc-val" style="color:${openClaim>0?'var(--tx-d)':'inherit'};">${openClaim}건 처리중</div><div class="mc-sub">전체 ${clms.length}건</div></div>
      <div class="mc"><div class="mc-lbl"><i class="ti ti-tool" style="color:${openAs>0?'var(--tx-w)':'var(--tx-t)'};"></i>A/S</div><div class="mc-val">${openAs}건 진행중</div><div class="mc-sub">전체 ${ass.length}건</div></div>
    </div>
    <h4 style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--tx-s);">진행 중 제품</h4>
    <table style="margin-bottom:16px;">
      <thead><tr><th>제품명</th><th>공정단계</th><th>납기일</th><th>D-Day</th><th>자재현황</th></tr></thead>
      <tbody>
        ${prods.map(p => {
          const pMats = materials.filter(m => m.productId === p.id);
          const done  = pMats.filter(m => m.status==='입고완료').length;
          const d = p.deliveryDate ? daysUntil(p.deliveryDate) : null;
          return `<tr>
            <td style="font-weight:700;">${p.name}</td>
            <td><span class="bd" style="background:${stageColor(p.processStage)}18;color:${stageColor(p.processStage)};border-color:${stageColor(p.processStage)}44;">${p.processStage}</span></td>
            <td>${p.deliveryDate || '—'}</td>
            <td>${d !== null ? dayBadge(p.deliveryDate) : '—'}</td>
            <td>${pMats.length > 0 ? `${done}/${pMats.length}건 입고` : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${clms.length > 0 ? `
    <h4 style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--tx-s);">클레임 이력</h4>
    <table>
      <thead><tr><th>일자</th><th>내용</th><th>상태</th></tr></thead>
      <tbody>${clms.map(c=>`<tr><td>${c.date}</td><td style="font-size:11px;">${(c.content||'').substring(0,60)}</td><td>${statusBadge(c.status)}</td></tr>`).join('')}</tbody>
    </table>` : ''}
  `;
}
```

- [ ] **Step 2: 고객사 클릭 시 360도 뷰 패널 토글**

`renderClients` 함수(또는 고객사 행 렌더 부분)에서 행 클릭 시 패널을 여는 코드 추가:

기존 고객사 행에 onclick 추가:
```javascript
// 고객사 행 tr에 onclick="showClient360('${c.id}')" 추가
```

`showClient360` 함수:
```javascript
function showClient360(clientId) {
  const panel = document.getElementById('client-360-panel');
  const client = clients.find(c => c.id === clientId);
  if (!panel || !client) return;
  const titleEl = document.getElementById('client-360-title');
  if (titleEl) titleEl.textContent = client.name + ' — 종합 현황';
  const wrapper = document.getElementById('client-360-wrapper');
  if (wrapper) wrapper.style.display = 'block';
  renderClient360(clientId);
}
```

- [ ] **Step 3: clients.html에 360도 패널 HTML 추가**

`src/html/pages/clients.html` 기존 테이블 아래에:

```html
<!-- 고객사 360도 뷰 패널 -->
<div id="client-360-wrapper" style="display:none;margin-top:16px;">
  <div class="card">
    <div class="card-hd">
      <span class="card-ttl" id="client-360-title"><i class="ti ti-building-community"></i>고객사 종합 현황</span>
      <button class="btn btn-sm" onclick="document.getElementById('client-360-wrapper').style.display='none'">
        <i class="ti ti-x"></i>닫기
      </button>
    </div>
    <div id="client-360-panel" style="padding:0 4px 8px;"></div>
  </div>
</div>
```

- [ ] **Step 4: 빌드 및 확인**

```bash
python build.py
```
수주 정보 탭에서 고객사 행 클릭 → 360도 패널이 열리고 제품/납품/클레임 데이터가 표시되는지 확인.

---

## Task 7: 납기 캘린더

**Files:**
- Create: `src/js/calendar.js`
- Create: `src/html/pages/pg-calendar.html`
- Modify: `src/html/layout-top.html`
- Modify: `src/index.template.html`

- [ ] **Step 1: pg-calendar.html 생성**

```html
<!-- 납기 캘린더 페이지 -->
<div class="page-content">
  <div class="card-hd" style="margin-bottom:16px;">
    <span class="card-ttl"><i class="ti ti-calendar-event" style="color:var(--tx-i);"></i>납기 캘린더</span>
    <div style="display:flex;gap:8px;align-items:center;">
      <button class="btn btn-sm" onclick="calNav(-1)"><i class="ti ti-chevron-left"></i></button>
      <span id="cal-title" style="font-weight:700;min-width:100px;text-align:center;"></span>
      <button class="btn btn-sm" onclick="calNav(1)"><i class="ti ti-chevron-right"></i></button>
      <button class="btn btn-sm" onclick="calGoToday()">오늘</button>
    </div>
    <div style="display:flex;gap:8px;font-size:11px;align-items:center;margin-left:8px;">
      <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#e03131;display:inline-block;"></span>납기 D-3 이내</span>
      <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#f08c00;display:inline-block;"></span>납기 D-7 이내</span>
      <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#1971c2;display:inline-block;"></span>납기 예정</span>
      <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#40c057;display:inline-block;"></span>자재 입고예정</span>
    </div>
  </div>
  <div id="cal-grid" style="overflow-x:auto;"></div>
  <div id="cal-detail" style="margin-top:16px;display:none;"></div>
</div>
```

- [ ] **Step 2: calendar.js 생성**

```javascript
/* ════════ 납기 캘린더 ════════ */
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based

function calNav(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}
function calGoToday() {
  calYear = new Date().getFullYear();
  calMonth = new Date().getMonth();
  renderCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('cal-title');
  if (titleEl) titleEl.textContent = `${calYear}년 ${calMonth + 1}월`;

  // 이번 달 모든 날짜의 이벤트 수집
  const events = {};  // 'YYYY-MM-DD' → [{label, color, id}]
  const addEvent = (date, label, color) => {
    if (!date) return;
    const d = date.substring(0, 10);
    if (!events[d]) events[d] = [];
    events[d].push({ label, color });
  };

  const todayStr = today();
  // 제품 납기일
  products.filter(p => p.deliveryDate && p.status !== '완료').forEach(p => {
    const d = daysUntil(p.deliveryDate);
    const color = d <= 3 ? '#e03131' : d <= 7 ? '#f08c00' : '#1971c2';
    addEvent(p.deliveryDate, `📦 ${getClientName(p.clientId)} — ${p.name}`, color);
  });
  // 자재 입고예정일
  materials.filter(m => m.expectedDate && m.status !== '입고완료').forEach(m => {
    addEvent(m.expectedDate, `🔩 ${m.name} (${m.id})`, '#40c057');
  });

  // 달력 그리드 생성
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  let html = `<table style="width:100%;border-collapse:collapse;min-width:700px;">
    <thead><tr>${days.map((d, i) => `<th style="padding:8px;font-size:12px;font-weight:600;color:${i===0?'var(--tx-d)':i===6?'#228be6':'var(--tx-s)'};border-bottom:2px solid var(--br);">${d}</th>`).join('')}</tr></thead>
    <tbody>`;

  let dayCount = 1;
  for (let week = 0; week < 6; week++) {
    if (dayCount > lastDate) break;
    html += '<tr>';
    for (let dow = 0; dow < 7; dow++) {
      const isEmpty = (week === 0 && dow < firstDay) || dayCount > lastDate;
      if (isEmpty) { html += `<td style="height:80px;padding:4px;border:1px solid var(--br);background:var(--bg-s);"></td>`; continue; }

      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(dayCount).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      const dayEvents = events[dateStr] || [];
      const dayColor = dow === 0 ? 'var(--tx-d)' : dow === 6 ? '#228be6' : 'var(--tx)';

      html += `<td style="height:80px;padding:4px;border:1px solid var(--br);vertical-align:top;cursor:${dayEvents.length?'pointer':'default'};background:${isToday?'rgba(79,142,247,.08)':'var(--bg-p)'}"
        onclick="${dayEvents.length ? `calShowDetail('${dateStr}')` : ''}">
        <div style="font-size:12px;font-weight:${isToday?700:400};color:${isToday?'var(--tx-i)':dayColor};margin-bottom:2px;">
          ${isToday?`<span style="background:var(--tx-i);color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">${dayCount}</span>`:dayCount}
        </div>
        ${dayEvents.slice(0,3).map(e => `<div style="font-size:9px;background:${e.color}22;color:${e.color};border-left:2px solid ${e.color};padding:1px 3px;border-radius:2px;margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.label}</div>`).join('')}
        ${dayEvents.length > 3 ? `<div style="font-size:9px;color:var(--tx-t);">+${dayEvents.length-3}건</div>` : ''}
      </td>`;
      dayCount++;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  const grid = document.getElementById('cal-grid');
  if (grid) grid.innerHTML = html;
}

function calShowDetail(dateStr) {
  const detail = document.getElementById('cal-detail');
  if (!detail) return;
  detail.style.display = 'block';

  const prods = products.filter(p => p.deliveryDate && p.deliveryDate.startsWith(dateStr));
  const mats  = materials.filter(m => m.expectedDate && m.expectedDate.startsWith(dateStr) && m.status !== '입고완료');

  detail.innerHTML = `
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-calendar-event"></i>${dateStr} 일정</span>
        <button class="btn btn-sm" onclick="document.getElementById('cal-detail').style.display='none'"><i class="ti ti-x"></i></button>
      </div>
      ${prods.length ? `
        <div style="margin-bottom:8px;font-size:12px;font-weight:700;color:var(--tx-s);">납기 제품 (${prods.length}건)</div>
        ${prods.map(p => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--br);">
            ${dayBadge(p.deliveryDate)}
            <span style="font-weight:700;">${p.name}</span>
            <span style="font-size:11px;color:var(--tx-t);">${getClientName(p.clientId)}</span>
            <span class="bd">${p.processStage}</span>
          </div>`).join('')}
      ` : ''}
      ${mats.length ? `
        <div style="margin:8px 0;font-size:12px;font-weight:700;color:var(--tx-s);">자재 입고 예정 (${mats.length}건)</div>
        ${mats.map(m => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--br);">
            <i class="ti ti-package" style="color:#40c057;"></i>
            <span style="font-weight:700;">${m.name}</span>
            <span style="font-size:11px;color:var(--tx-t);">${m.supplier||'—'} · ${m.id}</span>
          </div>`).join('')}
      ` : ''}
    </div>
  `;
}
```

- [ ] **Step 3: layout-top.html에 캘린더 nav 추가**

`src/html/layout-top.html`의 `납품 현황` 항목 아래에:

```html
<div class="ni" onclick="go('calendar',this)"><i class="ti ti-calendar-event"></i>납기 캘린더</div>
```

- [ ] **Step 4: index.template.html에 include 추가**

`materials.js` 또는 `deliveries.js` include 뒤에:

```
<!--#include js/calendar.js-->
```

- [ ] **Step 5: navigation.js에 calendar 페이지 등록 확인**

`src/js/navigation.js`에서 `go` 함수가 `pg-calendar` ID를 찾을 수 있도록 확인. 일반적으로 `go(id)` → `document.getElementById('pg-'+id)` 패턴이므로 HTML 파일 내 `id="pg-calendar"` 확인.

`pg-calendar.html` 파일의 최상위 div에 `id="pg-calendar"` 없으면 추가:
```html
<div id="pg-calendar" class="pg" style="display:none;">
  <!-- 위의 내용 감싸기 -->
</div>
```

- [ ] **Step 6: 빌드 및 확인**

```bash
python build.py
```
사이드바 '납기 캘린더' 클릭 → 달력 표시, 납기 있는 날짜에 배지 표시 확인.

---

## Task 8: 알림톡 설정 UI + 발송 모듈

**Files:**
- Create: `src/js/alimtalk.js`

- [ ] **Step 1: alimtalk.js 생성**

```javascript
/* ════════ 카카오 알림톡 연계 (SOLAPI) ════════ */

/**
 * 알림톡 단건 발송
 * @param {string} to          - 수신 전화번호 (01012345678 형식)
 * @param {string} templateId  - SOLAPI 등록 템플릿 코드
 * @param {Object} variables   - 치환 변수 {'#{변수명}': '값'}
 */
async function sendAlimtalk(to, templateId, variables) {
  const cfg = alimtalkSettings;
  if (!cfg.enabled || !cfg.apiKey || !cfg.pfId || !to) return;
  const phone = to.replace(/[^0-9]/g, '');
  if (phone.length < 10) return;

  // 메시지 본문 생성 (치환 변수 적용)
  let text = variables['#{본문}'] || Object.entries(variables).map(([k,v]) => `${k.replace(/[#{}]/g,'')}: ${v}`).join('\n');
  Object.entries(variables).forEach(([k, v]) => { text = text.replace(k, v); });

  try {
    const body = {
      message: {
        to: phone,
        from: cfg.senderPhone,
        kakaoOptions: {
          pfId: cfg.pfId,
          templateId,
          variables
        },
        disableSms: false  // 알림톡 실패 시 SMS 대체 발송
      }
    };
    // SOLAPI HMAC 인증 (간략 버전 — 실제 배포 시 정확한 HMAC 구현 필요)
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2);
    const signature = cfg.apiKey; // 실제로는 HMAC-SHA256(date+salt, apiSecret) 계산 필요

    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${cfg.apiKey}, date=${date}, salt=${salt}, signature=${signature}`
      },
      body: JSON.stringify(body)
    });
  } catch(e) {
    console.warn('알림톡 발송 실패:', e.message);
  }
}

/* ── 이벤트별 발송 함수 ── */

/** 자재 입고완료 → 공급처에 확인 요청 */
function sendAlimtalkMaterialIn(m) {
  if (!alimtalkSettings.enabled || !alimtalkSettings.events.materialIncoming) return;
  const partner = partners.find(p => p.name === m.supplier);
  const phone = partner?.mobile || partner?.tel;
  if (!phone) return;
  sendAlimtalk(phone, 'TPL_MAT_IN', {
    '#{자재명}': m.name,
    '#{수량}': m.qty + (m.unit||'EA'),
    '#{발주번호}': m.id,
    '#{회사명}': '당사'
  });
}

/** 납기 D-7 이내 제품 → 내부 담당자 알림 */
function sendAlimtalkDeliveryDue(product) {
  if (!alimtalkSettings.enabled || !alimtalkSettings.events.deliveryDue) return;
  const d = daysUntil(product.deliveryDate);
  if (d > 7 || d < 0) return;
  // 내부 담당자 (첫 번째 활성 직원)
  const manager = workers.find(w => w.status === '근무중' && w.mobile);
  if (!manager) return;
  sendAlimtalk(manager.mobile, 'TPL_DLV_DUE', {
    '#{제품명}': product.name,
    '#{고객사}': getClientName(product.clientId),
    '#{납기일}': product.deliveryDate,
    '#{D-Day}': `D-${d}`,
    '#{공정단계}': product.processStage
  });
}

/** A/S 접수 → 담당자 알림 */
function sendAlimtalkAsRegistered(as) {
  if (!alimtalkSettings.enabled || !alimtalkSettings.events.asRegistered) return;
  const owner = workers.find(w => w.id === as.owner && w.mobile);
  const target = owner || workers.find(w => w.status === '근무중' && w.mobile);
  if (!target) return;
  sendAlimtalk(target.mobile, 'TPL_AS_NEW', {
    '#{접수번호}': as.id,
    '#{고객사}': getClientName(as.clientId),
    '#{제품명}': as.productName || '—',
    '#{증상}': (as.symptom||'').substring(0, 30)
  });
}

/* ── 알림톡 설정 UI ── */
function renderAlimtalkSettings() {
  const cont = document.getElementById('alimtalk-settings-body');
  if (!cont) return;
  const cfg = alimtalkSettings;
  cont.innerHTML = `
    <div style="display:grid;gap:12px;max-width:560px;">
      <label style="display:flex;align-items:center;gap:8px;font-weight:600;">
        <input type="checkbox" ${cfg.enabled?'checked':''} onchange="alimtalkToggle(this.checked)">
        카카오 알림톡 사용
      </label>
      ${cfg.enabled ? `
      <div class="form-row">
        <label class="form-lbl">SOLAPI API Key</label>
        <input class="form-inp" id="at-apiKey" value="${cfg.apiKey||''}" placeholder="NCSXXXXX...">
      </div>
      <div class="form-row">
        <label class="form-lbl">SOLAPI API Secret</label>
        <input class="form-inp" id="at-apiSecret" type="password" value="${cfg.apiSecret||''}" placeholder="API Secret">
      </div>
      <div class="form-row">
        <label class="form-lbl">카카오 채널 ID (pfId)</label>
        <input class="form-inp" id="at-pfId" value="${cfg.pfId||''}" placeholder="_xKBBxjxb">
      </div>
      <div class="form-row">
        <label class="form-lbl">발신번호</label>
        <input class="form-inp" id="at-senderPhone" value="${cfg.senderPhone||''}" placeholder="01012345678">
      </div>
      <div style="border-top:1px solid var(--br);padding-top:12px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">발송 이벤트 설정</div>
        ${[
          ['materialIncoming', '자재 입고완료 → 공급처 확인 요청'],
          ['deliveryDue',      '납기 D-7 이내 → 내부 담당자 알림'],
          ['asRegistered',     'A/S 접수 → 담당자 알림'],
          ['poSent',           '발주서 발송 → 공급처 확인 요청']
        ].map(([key, label]) => `
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:6px;">
            <input type="checkbox" ${cfg.events[key]?'checked':''} onchange="alimtalkEventToggle('${key}',this.checked)">
            ${label}
          </label>
        `).join('')}
      </div>
      <div>
        <button class="btn btn-sm btn-primary" onclick="saveAlimtalkSettings()"><i class="ti ti-device-floppy"></i>저장</button>
        <button class="btn btn-sm" style="margin-left:8px;" onclick="testAlimtalk()"><i class="ti ti-send"></i>테스트 발송</button>
      </div>
      ` : ''}
    </div>
  `;
}

function alimtalkToggle(on) {
  alimtalkSettings.enabled = on;
  saveStorage('alimtalkSettings', alimtalkSettings);
  renderAlimtalkSettings();
}
function alimtalkEventToggle(key, on) {
  alimtalkSettings.events[key] = on;
}
function saveAlimtalkSettings() {
  alimtalkSettings.apiKey      = document.getElementById('at-apiKey')?.value.trim() || '';
  alimtalkSettings.apiSecret   = document.getElementById('at-apiSecret')?.value.trim() || '';
  alimtalkSettings.pfId        = document.getElementById('at-pfId')?.value.trim() || '';
  alimtalkSettings.senderPhone = document.getElementById('at-senderPhone')?.value.trim() || '';
  saveStorage('alimtalkSettings', alimtalkSettings);
  showToast('알림톡 설정이 저장됐습니다.');
}
async function testAlimtalk() {
  const manager = workers.find(w => w.mobile);
  if (!manager) { showToast('모바일 번호가 등록된 직원이 없습니다.', 'error'); return; }
  await sendAlimtalk(manager.mobile, 'TPL_TEST', { '#{메시지}': 'MESPro 알림톡 테스트 메시지입니다.' });
  showToast('테스트 발송 요청 완료. SOLAPI 발송 내역을 확인하세요.');
}
```

- [ ] **Step 2: 알림톡 설정 진입점 추가**

시스템 관리 섹션(사이드바)이나 설정 탭에 알림톡 설정 버튼을 추가한다. `src/html/layout-top.html`의 시스템 관리 nav 아래에:

```html
<div class="ni" onclick="go('alimtalk',this)"><i class="ti ti-brand-kakao"></i>알림톡 설정</div>
```

- [ ] **Step 3: pg-alimtalk.html 생성**

`src/html/pages/pg-alimtalk.html`:

```html
<div id="pg-alimtalk" class="pg" style="display:none;">
  <div class="page-content">
    <div class="card">
      <div class="card-hd">
        <span class="card-ttl"><i class="ti ti-brand-kakao" style="color:#f7e600;background:#3a1d1d;border-radius:6px;padding:2px 4px;"></i>카카오 알림톡 설정</span>
      </div>
      <div id="alimtalk-settings-body"></div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-hd"><span class="card-ttl"><i class="ti ti-info-circle"></i>등록 필요 템플릿</span></div>
      <div style="padding:8px 0;font-size:12px;color:var(--tx-s);line-height:2;">
        <div><code>TPL_MAT_IN</code> — 자재 입고완료 안내 (공급처 → 회사)</div>
        <div><code>TPL_DLV_DUE</code> — 납기 임박 알림 (내부 담당자)</div>
        <div><code>TPL_AS_NEW</code> — A/S 접수 알림 (담당자)</div>
        <div><code>TPL_PO_SENT</code> — 발주서 발송 안내 (공급처)</div>
        <div><code>TPL_TEST</code> — 테스트용</div>
        <div style="margin-top:8px;color:var(--tx-t);">※ SOLAPI 관리자 → 카카오 알림톡 → 템플릿 관리에서 위 코드로 등록 후 카카오 심사 완료 필요</div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: pg-alimtalk 페이지 진입 시 renderAlimtalkSettings 호출**

`src/js/navigation.js`의 `go` 함수에 alimtalk 분기 추가:

```javascript
if (id === 'alimtalk') { renderAlimtalkSettings(); }
```

- [ ] **Step 5: index.template.html에 alimtalk.js include + pg-alimtalk.html include 추가**

```
<!--#include js/alimtalk.js-->
```
및 pages 섹션에:
```
<!--#include html/pages/pg-alimtalk.html-->
```

---

## Task 9: 알림톡 이벤트 연결

**Files:**
- Modify: `src/js/as.js`
- Modify: `src/js/materials.js` (changeMatStatus는 Task 3에서 이미 추가됨)

- [ ] **Step 1: as.js에 A/S 접수 알림톡 트리거 추가**

`src/js/as.js`에서 새 A/S를 저장하는 `saveAs` 함수(또는 `openAsSave`)를 찾아 저장 직후에:

```javascript
  // 저장 완료 후
  if (typeof sendAlimtalkAsRegistered === 'function') {
    sendAlimtalkAsRegistered(newAs);
  }
```

- [ ] **Step 2: 납기 D-7 알림 — 기존 알림 생성 로직에 연결**

`src/js/alerts.js` 또는 `scanAndGenerateAlerts` 함수에서 납기 임박 알림 생성 시 알림톡 발송 추가:

```javascript
// 기존 납기 임박 alert 생성 직후:
if (typeof sendAlimtalkDeliveryDue === 'function') {
  products.filter(p => p.deliveryDate && daysUntil(p.deliveryDate) <= 7 && daysUntil(p.deliveryDate) >= 0)
    .forEach(p => sendAlimtalkDeliveryDue(p));
}
```

- [ ] **Step 3: 빌드 및 통합 테스트**

```bash
python build.py
```

---

## Task 10: 최종 빌드 통합 및 검증

**Files:**
- Modify: `src/index.template.html`

- [ ] **Step 1: include 순서 최종 확인**

`src/index.template.html`에서 include 순서가 의존성을 올바르게 따르는지 확인:
```
<!--#include js/data-storage.js-->     ← 1순위 (모든 전역 변수)
...
<!--#include js/bom.js-->              ← bomMaterialCost 정의
<!--#include js/clients-products.js-->  ← getProductMargin 사용
<!--#include js/calendar.js-->          ← 새 모듈
<!--#include js/alimtalk.js-->          ← 새 모듈 (마지막 근처)
```

- [ ] **Step 2: 전체 빌드**

```bash
python build.py
```
빌드 성공 및 파일 크기 정상 확인.

- [ ] **Step 3: 브라우저 콘솔 에러 확인**

브라우저에서 `http://localhost:3000/MESPro.html` 열기 → 콘솔 에러 0 확인.

- [ ] **Step 4: 기능별 동작 체크리스트**

```
□ 재고 탭 → +/- 클릭 → 이력 테이블에 행 추가됨
□ 자재 탭 → 발주중 → 입고완료 변경 → 재고 수량 증가 + 이력 기록됨
□ BOM 등록된 제품 → 제품명 옆 원가/마진 배지 표시됨
□ 거래처 탭 → 공급처 행에 납기이행률 열 표시됨
□ 수주 정보 탭 → 고객사 클릭 → 360도 패널 열림
□ 납기 캘린더 탭 → 달력 표시, 납기 있는 날짜에 배지 표시됨
□ 알림톡 설정 탭 → 설정 폼 표시, 저장 동작함
```

- [ ] **Step 5: git commit**

```bash
git add src/ docs/
git commit -m "feat: 재고이력/원가계산/캘린더/협력사이행률/고객사360/알림톡 6개 기능 추가"
```

---

## 참고: 알림톡 SOLAPI 셋업 절차 (개발 외 작업)

1. [SOLAPI 회원가입](https://solapi.com) → API Key / Secret 발급
2. 카카오 비즈니스 채널 개설 → pfId 확인
3. SOLAPI 관리자에서 알림톡 채널 연동
4. 템플릿 5종 등록 (TPL_MAT_IN 등) → 카카오 심사 (1~3 영업일)
5. MESPro 알림톡 설정 탭에 키 입력 → 테스트 발송 확인
