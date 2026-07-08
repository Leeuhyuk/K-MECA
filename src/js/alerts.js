/* ════════ 8. 알림 로그 — 자동 감지 + 수동 기록 통합 ════════ */

/* 알림 설정 상태 동기화 헬퍼 */
function syncAlertSettingsUI() {
  Object.keys(alertSettings).forEach(key => {
    const chk = inp(`chk-${key}`);
    if (chk) chk.checked = alertSettings[key];
  });
}

/* 알림 설정 체크박스 온체인지 제어 */
function toggleAlertSetting(key) {
  const chk = inp(`chk-${key}`);
  if (chk) {
    alertSettings[key] = chk.checked;
    saveStorage('alertSettings', alertSettings);
    renderAlerts();
  }
}

/* 수동 알림 입력창 활성화 */
function openAlertAdd() {
  sv('ala-type', 'info');
  sv('ala-title', '');
  sv('ala-sub', '');
  inp('alert-modal').classList.add('open');
}

/* 사용자 지정 수동 알림 추가 */
function addCustomAlert() {
  const type = v('ala-type');
  const title = v('ala-title').trim();
  const sub = v('ala-sub').trim();

  if (!title) {
    showToast('알림 제목을 기입해주세요.', 'error');
    return;
  }
  if (!sub) {
    showToast('알림 세부 설명을 기입해주세요.', 'error');
    return;
  }

  const exists = alertsList.some(a => a.title === title && a.sub === sub);
  if (exists) {
    showToast('이미 동일한 알림 정보가 등록되어 있습니다.', 'error');
    return;
  }

  alertsList.unshift({
    type,
    title,
    sub,
    auto: false,
    category: 'manual',
    createdAt: today()
  });

  saveStorage('alerts', alertsList);
  closeModal('alert-modal');
  renderAlerts();
  showToast('사용자 지정 알림이 신규 등록되었습니다.');
}

/* 알림 중복없이 생성하는 헬퍼 (카테고리별 ON/OFF 차단 제어 탑재) */
function generateAlert(type, title, sub, category = 'auto') {
  // 꺼져있는 자동 알림 유형은 생성을 아예 원천 차단
  if (category !== 'manual' && alertSettings[category] === false) {
    return;
  }
  // 사용자가 이미 '확인(삭제)'을 눌러 소멸시킨 자동 알림이면 재생성 차단
  if (category !== 'manual' && dismissedAlerts.includes(title)) {
    _currentScannedTitles.push(title); // 이미 확인되었지만 여전히 감지 상태이므로 수집 목록엔 추가
    return;
  }
  
  if (category !== 'manual') {
    _currentScannedTitles.push(title); // 실시간 감지 알림 제목 수집
  }

  const exists = alertsList.some(a => a.title === title);
  if (!exists) {
    alertsList.unshift({ type, title, sub, auto: category !== 'manual', category, createdAt: today() });
    saveStorage('alerts', alertsList);
  }
}

/* 전체 데이터를 스캔하여 자동 알림 생성/갱신 */
function scanAndGenerateAlerts() {
  _currentScannedTitles = []; // 스캔 시작 시 비움
  const visibleMaterials = typeof visibleRecords === 'function' ? visibleRecords(materials, 'material') : materials;
  const visibleProducts = typeof visibleRecords === 'function' ? visibleRecords(products, 'products') : products;
  const visibleInventory = typeof visibleRecords === 'function' ? visibleRecords(inventory, 'inventory') : inventory;
  const visibleDefects = typeof visibleRecords === 'function' ? visibleRecords(defects, 'defect') : defects;
  const visibleWorkOrders = typeof visibleRecords === 'function' ? visibleRecords(workOrders, 'workOrder') : workOrders;

  // 발주전 자재
  visibleMaterials.filter(m => m.status === '발주전').forEach(m => {
    const p = getProductById(m.productId);
    generateAlert('err', `[자재발주 미처리] ${m.name} — ${p?.name || ''}`, `공급처: ${m.supplier||'미지정'} · 입고예정: ${m.expectedDate||'미설정'}`, 'mat_pending');
  });
  // 입고 지연 임박 (7일 이내)
  visibleMaterials.filter(m => m.status==='발주중' && m.expectedDate && daysUntil(m.expectedDate)<=7 && daysUntil(m.expectedDate)>=0).forEach(m => {
    generateAlert('warn', `[입고임박] ${m.name} (D-${daysUntil(m.expectedDate)})`, `${m.supplier} 공급 · 예정일 ${m.expectedDate}`, 'mat_delay');
  });
  // 납기 임박 제품 (14일 이내)
  visibleProducts.filter(p => p.deliveryDate && daysUntil(p.deliveryDate)<=14 && p.status!=='완료').forEach(p => {
    generateAlert('err', `[납기 위험] ${p.name} D-${daysUntil(p.deliveryDate)}`, `고객사: ${getClientName(p.clientId)} · 납기: ${p.deliveryDate}`, 'prod_delivery');
  });
  if (typeof sendAlimtalkDeliveryDue === 'function') {
    (visibleProducts || []).filter(function(p) {
      return p.deliveryDate && daysUntil(p.deliveryDate) <= 7 && daysUntil(p.deliveryDate) >= 0 && p.status !== '완료' && p.status !== '납품';
    }).forEach(function(p) { sendAlimtalkDeliveryDue(p); });
  }
  // 안전재고 미달
  visibleInventory.filter(i => i.qty <= i.minQty && i.minQty > 0).forEach(i => {
    generateAlert('warn', `[안전재고 미달] ${i.name}`, `현재 ${i.qty}${i.unit} / 기준 ${i.minQty}${i.unit} · ${i.location||'위치 미지정'}`, 'inv_low');
  });
  // 미처리 불량
  visibleDefects.filter(d => d.status === '조치중').forEach(d => {
    generateAlert('warn', `[불량 미조치] ${d.type} — ${getProductName(d.productId)}`, `공정: ${d.stage} · 수량: ${d.qty}개 · 발생: ${d.date}`, 'defect_open');
  });
  // 지연 생산지시
  visibleWorkOrders.filter(o => o.status==='지연').forEach(o => {
    generateAlert('err', `[생산지시 지연] ${o.id} — ${getProductName(o.productId)}`, `라인: ${o.line} · 담당: ${o.manager} · 납기: ${o.due}`, 'wo_delayed');
  });

  // 이미 확인 처리된 이력 중 현재 실시간 감지되지 않는(해소된) 항목은 이력에서 자동 삭제
  const beforeLen = dismissedAlerts.length;
  dismissedAlerts = dismissedAlerts.filter(t => _currentScannedTitles.includes(t));
  if (dismissedAlerts.length !== beforeLen) {
    saveStorage('dismissedAlerts', dismissedAlerts);
  }
}

function renderAlerts() {
  syncAlertSettingsUI();
  scanAndGenerateAlerts();
  const im = { err: 'ti-alert-circle', warn: 'ti-alert-triangle', info: 'ti-info-circle' };
  
  // 전체 목록 중 꺼져있는 자동알림 카테고리는 가공(필터)하여 렌더링에서 배제
  const fil = alertsList.filter(a => {
    if (a.auto !== false && a.category && alertSettings[a.category] === false) {
      return false;
    }
    return true;
  });

  // 필터링된 리스트를 바탕으로 선택된 알림 등급 필터 적용
  const finalFil = fil.filter(a => {
    if (currentAlertFilter === 'all') return true;
    return a.type === currentAlertFilter;
  });

  inp('alerts-list').innerHTML = finalFil.length ? finalFil.map((a, i) => {
    // 인덱스 대신 알림 고유 식별자(title)를 넘겨 stale-index 삭제를 방지합니다.
    const ref = encodeURIComponent(a.title);
    return `
    <div class="al al-${a.type}">
      <i class="ti ${im[a.type]||'ti-info-circle'}"></i>
      <div style="flex:1;">
        <div class="al-t">${esc(a.title)}</div>
        <div class="al-s">${esc(a.sub)}${a.createdAt ? ` · ${esc(a.createdAt)}` : ''}</div>
      </div>
      <button class="del-btn" onclick="delAlert('${ref}')"><i class="ti ti-x" style="font-size:12px;"></i>확인</button>
    </div>`;
  }).join('') : empty('수신 및 보존된 알림 내역이 비어있습니다.');

  // 안 읽은 긴급 알림 배지 수량은 필터링(활성화된 것만) 기준으로 갱신합니다.
  const activeAlerts = alertsList.filter(a => a.auto === false || !a.category || alertSettings[a.category] !== false);
  const activeErrCount = activeAlerts.filter(a => a.type === 'err').length;
  const sidebarBadge = inp('alertBadge');
  if (sidebarBadge) sidebarBadge.textContent = activeErrCount;
  const topbarBadge = inp('topbar-alert-badge');
  if (topbarBadge) {
    topbarBadge.textContent = activeAlerts.length > 99 ? '99+' : activeAlerts.length;
    topbarBadge.style.display = activeAlerts.length ? 'flex' : 'none';
  }
  renderTopbarAlerts(false);
}

function renderTopbarAlerts(scan) {
  const listEl = inp('topbar-alert-list');
  if (!listEl) return;
  if (scan && typeof scanAndGenerateAlerts === 'function') scanAndGenerateAlerts();

  const activeAlerts = alertsList.filter(a =>
    a.auto === false || !a.category || alertSettings[a.category] !== false
  );
  const icons = { err: 'ti-alert-circle', warn: 'ti-alert-triangle', info: 'ti-info-circle' };
  const countEl = inp('topbar-alert-count');
  const badgeEl = inp('topbar-alert-badge');

  if (countEl) countEl.textContent = `${activeAlerts.length}건`;
  if (badgeEl) {
    badgeEl.textContent = activeAlerts.length > 99 ? '99+' : activeAlerts.length;
    badgeEl.style.display = activeAlerts.length ? 'flex' : 'none';
  }

  listEl.innerHTML = activeAlerts.length ? activeAlerts.map(a => {
    const ref = encodeURIComponent(a.title);
    return `<div class="topbar-alert-item ${a.type || 'info'}">
      <i class="ti ${icons[a.type] || icons.info}"></i>
      <div>
        <div class="topbar-alert-item-title">${esc(a.title)}</div>
        <div class="topbar-alert-item-sub">${esc(a.sub)}${a.createdAt ? ` · ${esc(a.createdAt)}` : ''}</div>
      </div>
      <button type="button" class="topbar-alert-confirm" onclick="confirmTopbarAlert(event,'${ref}')">확인</button>
    </div>`;
  }).join('') : '<div class="topbar-alert-empty"><i class="ti ti-bell-off"></i><br>새로운 알림이 없습니다.</div>';
}

function confirmTopbarAlert(event, token) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const wrap = inp('topbar-alert');
  const list = inp('topbar-alert-list');
  const scrollTop = list ? list.scrollTop : 0;
  delAlert(token);
  if (wrap) wrap.classList.add('open');
  const button = inp('topbar-alert-btn');
  if (button) button.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    const refreshedList = inp('topbar-alert-list');
    if (refreshedList) refreshedList.scrollTop = scrollTop;
  });
}

function filterAlerts(type) {
  currentAlertFilter = type;
  const tButtons = document.querySelectorAll('#alerts-toolbar .btn');
  tButtons.forEach(btn => btn.classList.remove('btn-primary'));
  
  if (type === 'all') tButtons[0].classList.add('btn-primary');
  else if (type === 'err') tButtons[1].classList.add('btn-primary');
  else if (type === 'warn') tButtons[2].classList.add('btn-primary');
  
  renderAlerts();
}

function delAlert(token) {
  // 렌더 시점 인덱스 대신 알림 고유 식별자(title)로 삭제 — 팝업이 열린 채 목록이
  // 갱신돼도 엉뚱한 알림이 지워지지 않도록 한다. (title은 generateAlert의 중복 판정 키)
  const title = decodeURIComponent(String(token));
  const i = alertsList.findIndex(a => a.title === title);
  if (i < 0) return;
  const a = alertsList[i];
  // 만약 자동 알림(auto: true)이면 dismissedAlerts 리스트에 제목을 기록하여 재발 방지
  if (a.auto !== false) {
    if (!dismissedAlerts.includes(a.title)) {
      dismissedAlerts.push(a.title);
      saveStorage('dismissedAlerts', dismissedAlerts);
    }
  }
  alertsList.splice(i, 1);
  saveStorage('alerts', alertsList);
  renderAlerts();
}
