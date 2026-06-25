/* ════════ 키보드 ESC 종료 및 엔터 승인 단축기 ════════ */
document.addEventListener('keydown', e => {
  const confirmDlg = inp('confirmDlg');
  const kanbanModal = inp('kanbanEditModal');

  if (confirmDlg && confirmDlg.classList.contains('open')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      inp('dlgOkBtn')?.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDlg();
    }
    return;
  }
  
  if (kanbanModal && kanbanModal.classList.contains('open')) {
    if (e.key === 'Enter') {
      if (document.activeElement?.id !== 'km-memo') {
        e.preventDefault();
        inp('kmSaveBtn')?.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeKanbanModal();
    }
    return;
  }

  /* 등록/수정 오버레이 모달: Enter = 저장(완료), Escape = 닫기 */
  const openOverlay = document.querySelector('.overlay.open');
  if (openOverlay) {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
      const saveBtn = openOverlay.querySelector('.dlg-actions .btn-primary');
      if (saveBtn) { e.preventDefault(); saveBtn.click(); return; }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(openOverlay.id);
      return;
    }
  }

  if (e.key === 'Escape') {
    document.querySelectorAll('.add-panel.open').forEach(p => p.classList.remove('open'));
  }

  /* Alt + ← : 뒤로가기 */
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    goBack();
  }
});

/* ════════ 실시간 다크 모드 수동전환 ════════ */
function initTheme() {
  const t = localStorage.getItem('mes_theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    inp('themeIcon').className = 'ti ti-sun';
  } else {
    document.documentElement.classList.remove('dark');
    inp('themeIcon').className = 'ti ti-moon';
  }
  applyUiThemeColors(getCurrentThemeMode());
}

function toggleTheme() {
  const root = document.documentElement;
  if (root.classList.contains('dark')) {
    root.classList.remove('dark');
    localStorage.setItem('mes_theme', 'light');
    inp('themeIcon').className = 'ti ti-moon';
  } else {
    root.classList.add('dark');
    localStorage.setItem('mes_theme', 'dark');
    inp('themeIcon').className = 'ti ti-sun';
  }
  applyUiThemeColors(getCurrentThemeMode());
  if (currentPage === 'system' && typeof systemTab !== 'undefined' && systemTab === 'display') {
    renderUiColorSettings();
  }
  if (currentPage === 'dashboard') {
    renderDashboard();
  }
}

/* ════════ 전체 UI 크기 ════════ */
const UI_SCALE_MIN = 80;
const UI_SCALE_MAX = 120;
const UI_FONT_MIN = 90;
const UI_FONT_MAX = 120;

function getSavedUiScale() {
  const value = Number(localStorage.getItem('mes_uiScale') || 100);
  return Number.isFinite(value) ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value)) : 100;
}

function getAutoUiScale() {
  const width = window.innerWidth;
  if (width <= 680) return 1;
  if (width <= 900) return .92;
  if (width <= 1100) return .94;
  if (width <= 1366) return .96;
  if (width <= 1600) return .98;
  return 1;
}

function applyUiScale(value) {
  const requested = Number(value || getSavedUiScale());
  const userPercent = window.innerWidth <= 680
    ? Math.min(110, Math.max(90, requested))
    : Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, requested));
  const finalScale = getAutoUiScale() * (userPercent / 100);
  document.body.style.removeProperty('zoom');
  document.body.style.height = '100vh';
  document.documentElement.style.setProperty('--ui-density-scale', String(finalScale));
  document.documentElement.style.setProperty('--user-ui-scale', String(userPercent / 100));
  return { requested, userPercent, finalScale };
}

function updateUiScaleControls(value) {
  const requested = Number(value || getSavedUiScale());
  const range = inp('ui-scale-range');
  const label = inp('ui-scale-value');
  if (range) range.value = String(requested);
  if (label) {
    const applied = window.innerWidth <= 680 ? Math.min(110, Math.max(90, requested)) : requested;
    label.textContent = applied === requested ? `${requested}%` : `${applied}% (모바일 제한)`;
  }
  document.querySelectorAll('.ui-scale-presets .btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === `${requested}%`);
  });
}

function previewUiScale(value) {
  applyUiScale(value);
  updateUiScaleControls(value);
}

function saveUiScale(value) {
  const normalized = Math.round(Number(value));
  localStorage.setItem('mes_uiScale', String(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, normalized))));
  applyUiScale(normalized);
  updateUiScaleControls(normalized);
  showToast(`화면 크기를 ${normalized}%로 저장했습니다.`, 'success');
}

function setUiScale(value) {
  saveUiScale(value);
}

function resetUiScale() {
  localStorage.removeItem('mes_uiScale');
  applyUiScale(100);
  updateUiScaleControls(100);
  showToast('화면 크기를 기본값 100%로 복원했습니다.', 'success');
}

function getSavedUiFontScale() {
  const value = Number(localStorage.getItem('mes_uiFontScale') || 100);
  return Number.isFinite(value) ? Math.min(UI_FONT_MAX, Math.max(UI_FONT_MIN, value)) : 100;
}

function applyUiFontScale(value) {
  const requested = Number(value || getSavedUiFontScale());
  const userPercent = Math.min(UI_FONT_MAX, Math.max(UI_FONT_MIN, requested));
  document.documentElement.style.setProperty('--ui-font-scale', String(userPercent / 100));
  return userPercent;
}

function updateUiFontControls(value) {
  const requested = Number(value || getSavedUiFontScale());
  const range = inp('ui-font-range');
  const label = inp('ui-font-value');
  if (range) range.value = String(requested);
  if (label) label.textContent = `${requested}%`;
  document.querySelectorAll('.ui-font-presets .btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === `${requested}%`);
  });
}

function previewUiFontScale(value) {
  applyUiFontScale(value);
  updateUiFontControls(value);
}

function saveUiFontScale(value) {
  const normalized = Math.round(Number(value));
  localStorage.setItem('mes_uiFontScale', String(Math.min(UI_FONT_MAX, Math.max(UI_FONT_MIN, normalized))));
  applyUiFontScale(normalized);
  updateUiFontControls(normalized);
  showToast(`글자 크기를 ${normalized}%로 저장했습니다.`, 'success');
}

function setUiFontScale(value) {
  saveUiFontScale(value);
}

function resetUiFontScale() {
  localStorage.removeItem('mes_uiFontScale');
  applyUiFontScale(100);
  updateUiFontControls(100);
  showToast('글자 크기를 기본값 100%로 복원했습니다.', 'success');
}

function renderUiScaleSettings() {
  updateUiScaleControls(getSavedUiScale());
  updateUiFontControls(getSavedUiFontScale());
  renderUiColorSettings();
}

/* ════════ 테마별 화면 색상 ════════ */
const UI_COLOR_DEFAULTS = {
  light: { page:'#d9dde4', card:'#eef0f3', secondary:'#e4e7ec', topbar:'#eef0f3', accent:'#185FA5', text:'#212529' },
  dark:  { page:'#121214', card:'#1a1a1e', secondary:'#242428', topbar:'#1a1a1e', accent:'#85B7EB', text:'#f1f3f5' }
};
const UI_COLOR_FIELDS = [
  { key:'page', label:'전체 배경' },
  { key:'card', label:'카드·패널' },
  { key:'secondary', label:'보조 영역' },
  { key:'topbar', label:'상단바' },
  { key:'accent', label:'강조색' },
  { key:'text', label:'기본 글자' }
];
let uiColorTheme = null;
let uiColorDraft = null;

function getCurrentThemeMode() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function normalizeHex(value, fallback='#000000') {
  let hex = String(value || '').trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = '#' + [...hex.slice(1)].map(ch => ch + ch).join('');
  }
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : fallback.toUpperCase();
}

function hexRgb(hex) {
  const value = normalizeHex(hex).slice(1);
  return [
    parseInt(value.slice(0,2),16),
    parseInt(value.slice(2,4),16),
    parseInt(value.slice(4,6),16)
  ];
}

function rgbaFromHex(hex, alpha) {
  const [r,g,b] = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(base, overlay, ratio) {
  const a = hexRgb(base), b = hexRgb(overlay);
  const mixed = a.map((value, index) => Math.round(value * (1-ratio) + b[index] * ratio));
  return '#' + mixed.map(value => value.toString(16).padStart(2,'0')).join('').toUpperCase();
}

function getUiColorStore() {
  try {
    const saved = JSON.parse(localStorage.getItem('mes_uiColors') || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch(e) {
    return {};
  }
}

function getUiThemeColors(theme) {
  const mode = theme === 'dark' ? 'dark' : 'light';
  const saved = getUiColorStore()[mode] || {};
  const defaults = UI_COLOR_DEFAULTS[mode];
  const result = {};
  UI_COLOR_FIELDS.forEach(field => {
    result[field.key] = normalizeHex(saved[field.key], defaults[field.key]);
  });
  return result;
}

function applyUiThemeColors(theme, colors) {
  const mode = theme === 'dark' ? 'dark' : 'light';
  const c = Object.assign({}, UI_COLOR_DEFAULTS[mode], colors || getUiThemeColors(mode));
  const root = document.documentElement;
  root.style.setProperty('--bg-t', normalizeHex(c.page, UI_COLOR_DEFAULTS[mode].page));
  root.style.setProperty('--bg-p', normalizeHex(c.card, UI_COLOR_DEFAULTS[mode].card));
  root.style.setProperty('--bg-s', normalizeHex(c.secondary, UI_COLOR_DEFAULTS[mode].secondary));
  root.style.setProperty('--bg-top', normalizeHex(c.topbar, UI_COLOR_DEFAULTS[mode].topbar));
  root.style.setProperty('--tx-i', normalizeHex(c.accent, UI_COLOR_DEFAULTS[mode].accent));
  root.style.setProperty('--tx', normalizeHex(c.text, UI_COLOR_DEFAULTS[mode].text));
  root.style.setProperty('--tx-s', mixHex(c.text, c.card, .25));
  root.style.setProperty('--tx-t', mixHex(c.text, c.card, .52));
  root.style.setProperty('--bg-i', mixHex(c.card, c.accent, mode === 'dark' ? .22 : .12));
  root.style.setProperty('--br', rgbaFromHex(c.text, .08));
  root.style.setProperty('--br-s', rgbaFromHex(c.text, .15));
  root.style.setProperty('--br-i', rgbaFromHex(c.accent, .25));
}

function colorLuminance(hex) {
  const channels = hexRgb(hex).map(value => {
    const c = value / 255;
    return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
  });
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function colorContrast(a, b) {
  const l1 = colorLuminance(a), l2 = colorLuminance(b);
  return (Math.max(l1,l2) + .05) / (Math.min(l1,l2) + .05);
}

function updateUiColorContrast() {
  const el = inp('ui-color-contrast');
  if (!el || !uiColorDraft) return;
  const cardRatio = colorContrast(uiColorDraft.text, uiColorDraft.card);
  const pageRatio = colorContrast(uiColorDraft.text, uiColorDraft.page);
  const ratio = Math.min(cardRatio, pageRatio);
  const ok = ratio >= 4.5;
  el.className = 'ui-color-contrast ' + (ok ? 'ok' : 'warn');
  el.innerHTML = ok
    ? `<i class="ti ti-circle-check"></i><span>글자 대비 ${ratio.toFixed(2)}:1 · 읽기 좋은 조합입니다.</span>`
    : `<i class="ti ti-alert-triangle"></i><span>글자 대비 ${ratio.toFixed(2)}:1 · 권장 기준 4.5:1보다 낮아 가독성이 떨어질 수 있습니다.</span>`;
}

function renderUiColorFields() {
  const body = inp('ui-color-fields');
  if (!body || !uiColorDraft) return;
  const eyeSupported = typeof window.EyeDropper === 'function';
  body.innerHTML = UI_COLOR_FIELDS.map(field => {
    const color = normalizeHex(uiColorDraft[field.key], UI_COLOR_DEFAULTS[uiColorTheme][field.key]);
    return `<div class="ui-color-row">
      <label for="ui-color-${field.key}">${field.label}</label>
      <input class="ui-color-input" id="ui-color-${field.key}" type="color" value="${color}"
        oninput="updateUiColorField('${field.key}',this.value)">
      <input class="ui-color-hex" id="ui-color-hex-${field.key}" value="${color}" maxlength="7"
        onchange="updateUiColorField('${field.key}',this.value)">
      <button class="ui-eyedropper" type="button" onclick="pickUiColor('${field.key}')" ${eyeSupported?'':'disabled'}
        title="${eyeSupported?'화면에서 색상 선택':'이 브라우저는 스포이드를 지원하지 않습니다'}" aria-label="${field.label} 스포이드">
        <i class="ti ti-color-picker"></i>
      </button>
    </div>`;
  }).join('');
  updateUiColorContrast();
}

function renderUiColorSettings() {
  uiColorTheme = getCurrentThemeMode();
  uiColorDraft = getUiThemeColors(uiColorTheme);
  document.querySelectorAll('[data-color-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.colorTheme === uiColorTheme);
  });
  renderUiColorFields();
}

function selectUiColorTheme(theme) {
  uiColorTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', uiColorTheme === 'dark');
  localStorage.setItem('mes_theme', uiColorTheme);
  const icon = inp('themeIcon');
  if (icon) icon.className = uiColorTheme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
  uiColorDraft = getUiThemeColors(uiColorTheme);
  applyUiThemeColors(uiColorTheme, uiColorDraft);
  renderUiColorSettings();
}

function updateUiColorField(key, value) {
  if (!uiColorDraft || !UI_COLOR_FIELDS.some(field => field.key === key)) return;
  const fallback = uiColorDraft[key];
  const color = normalizeHex(value, fallback);
  uiColorDraft[key] = color;
  const picker = inp('ui-color-' + key);
  const text = inp('ui-color-hex-' + key);
  if (picker) picker.value = color;
  if (text) text.value = color;
  applyUiThemeColors(uiColorTheme, uiColorDraft);
  updateUiColorContrast();
}

async function pickUiColor(key) {
  if (typeof window.EyeDropper !== 'function') {
    showToast('현재 브라우저는 색상 스포이드를 지원하지 않습니다.', 'error');
    return;
  }
  try {
    const result = await new window.EyeDropper().open();
    if (result?.sRGBHex) updateUiColorField(key, result.sRGBHex);
  } catch(e) {
    if (e?.name !== 'AbortError') showToast('색상을 선택하지 못했습니다.', 'error');
  }
}

function saveUiColors() {
  if (!uiColorDraft || !uiColorTheme) return;
  const store = getUiColorStore();
  store[uiColorTheme] = Object.assign({}, uiColorDraft);
  localStorage.setItem('mes_uiColors', JSON.stringify(store));
  applyUiThemeColors(uiColorTheme, uiColorDraft);
  const ratio = Math.min(colorContrast(uiColorDraft.text, uiColorDraft.card), colorContrast(uiColorDraft.text, uiColorDraft.page));
  showToast(ratio >= 4.5 ? '화면 색상을 저장했습니다.' : '색상을 저장했습니다. 글자 대비 경고를 확인해주세요.', ratio >= 4.5 ? 'success' : 'info');
}

function cancelUiColorPreview() {
  uiColorDraft = getUiThemeColors(uiColorTheme || getCurrentThemeMode());
  applyUiThemeColors(uiColorTheme, uiColorDraft);
  renderUiColorFields();
  showToast('저장하지 않은 색상 변경을 취소했습니다.', 'info');
}

function resetUiColors() {
  const mode = uiColorTheme || getCurrentThemeMode();
  const store = getUiColorStore();
  delete store[mode];
  localStorage.setItem('mes_uiColors', JSON.stringify(store));
  uiColorDraft = Object.assign({}, UI_COLOR_DEFAULTS[mode]);
  applyUiThemeColors(mode, uiColorDraft);
  renderUiColorFields();
  showToast(`${mode === 'dark' ? '어두운' : '밝은'} 테마 색상을 기본값으로 복원했습니다.`, 'success');
}

window.addEventListener('resize', () => {
  applyUiScale(getSavedUiScale());
  if (currentPage === 'system' && typeof systemTab !== 'undefined' && systemTab === 'display') {
    updateUiScaleControls(getSavedUiScale());
  }
});

/* ════════════════════════════════════════════════════════════
   클라우드 동기화 (Firebase Auth + Firestore)
   ▶ 설정 방법:
     1) https://console.firebase.google.com 에서 프로젝트 생성
     2) 빌드 > Authentication > 시작하기 > '이메일/비밀번호' 사용 설정
     3) 빌드 > Firestore Database > 데이터베이스 만들기(프로덕션 모드)
        규칙(Rules) 탭에 아래 입력 후 게시:
          rules_version = '2';
          service cloud.firestore {
            match /databases/{db}/documents {
             match /mes_v2/{doc=**} {
               allow read, write: if request.auth != null;
             }
           }
         }
     4) 프로젝트 설정(⚙) > '내 앱' > 웹앱(</>) 추가 > firebaseConfig 값 복사
     5) 아래 FIREBASE_CONFIG 에 붙여넣기 → 저장 후 새로고침
   ※ apiKey/projectId 가 비어 있으면 자동으로 '로컬 전용 모드'로 동작합니다.
   ════════════════════════════════════════════════════════════ */
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBh4BqIl3zzVEygG5FMN1-xKTlhZR1Od1I",
  authDomain: "k-meca.firebaseapp.com",
  databaseURL: "https://k-meca-default-rtdb.firebaseio.com",
  projectId: "k-meca",
  storageBucket: "k-meca.firebasestorage.app",
  messagingSenderId: "606055722429",
  appId: "1:606055722429:web:f9352096fb4f97388536d4",
  measurementId: "G-PBGH98NRCT"
};
const FIREBASE_CONFIG = Object.assign(
  {},
  DEFAULT_FIREBASE_CONFIG,
  loadStorage('firebaseConfig', {})
);
/* 클라우드로 공유할 데이터 키(테마/관리자비번 등 기기·보안 로컬값은 제외) */
const CLOUD_KEYS = ['clients','products','materials','workOrders','workers','defects','claims','checkRecords','alerts','inventory','inventoryLedger','deliveries','stages','trash','rfqList','poList','partners','statementList','taxList','quoteList','orderList','financeData','attendance','leaves','payrollRecords','asList','bomList','memoList','todoList','companyInfo','docXlsxTemplates','driveOAuthSettings'];
let _fbAuth=null, _fbDb=null, _cloudUser=null;   // _cloudActive는 앞쪽(전역 상태)에서 선언됨
const _cloudQueue=new Set(); let _cloudTimer=null; let _cloudUnsub=null;

/* ════════ 프로그램 기동 초기화 (FIREBASE_CONFIG 선언 이후에 실행) ════════ */
syncFilterDropdowns();
initTheme();
applyUiScale(getSavedUiScale());
applyUiFontScale(getSavedUiFontScale());
repairWorkerTimeValues();
// 햄버거 메가 메뉴에서는 이전 사이드바 표시 상태를 사용하지 않음
if (typeof applySidebarMode === 'function') applySidebarMode();
if (typeof initAdaptiveSidebarObserver === 'function') initAdaptiveSidebarObserver();
setTimeout(initAppRouter, 0); // 모든 업무 모듈 선언 후 URL 화면을 복원
renderAlerts();
updateTrashBadge();
updateDlvBadge();
updateAsBadge();
updateTodoBadge();
updateAdminUI();

// 앱 초기화 완료 (데이터는 Firebase 동기화 + JSON/XLS 내보내기로 관리)
initEmailjs();
