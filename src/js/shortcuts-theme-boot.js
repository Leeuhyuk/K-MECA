/* ════════ 키보드 ESC 종료 및 엔터 승인 단축기 ════════ */
document.addEventListener('keydown', e => {
  if (e.defaultPrevented) return;
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
  const t = getSavedThemeMode();
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
    saveThemeMode('light');
    inp('themeIcon').className = 'ti ti-moon';
  } else {
    root.classList.add('dark');
    saveThemeMode('dark');
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
const MENU_ICON_MIN = 36;
const MENU_ICON_MAX = 84;
const MENU_ICON_DEFAULT = 46;
const THEME_STORAGE_KEY = 'theme';
const UI_SCALE_STORAGE_KEY = 'uiScale';
const UI_FONT_STORAGE_KEY = 'uiFontScale';
const MENU_ICON_STORAGE_KEY = 'menuIconSize';
const TABLE_GRID_STORAGE_KEY = 'tableGridLines';
const UI_COLORS_STORAGE_KEY = 'uiColors';
const BRAND_SETTINGS_KEY = 'uiBrandSettings';
const SCREEN_SETTINGS_SYNC_KEYS = [
  THEME_STORAGE_KEY, UI_SCALE_STORAGE_KEY, UI_FONT_STORAGE_KEY, MENU_ICON_STORAGE_KEY,
  TABLE_GRID_STORAGE_KEY, UI_COLORS_STORAGE_KEY, BRAND_SETTINGS_KEY
];
const BRAND_LOGO_MIN = 16;
const BRAND_LOGO_MAX = 100;
const BRAND_LOGO_DEFAULT = 20;
const BRAND_TITLE_MIN = 12;
const BRAND_TITLE_MAX = 100;
const BRAND_TITLE_DEFAULT = 15;
const BRAND_DEFAULTS = {
  title: 'MES Pro',
  logoDataUrl: '',
  logoName: '',
  logoSize: BRAND_LOGO_DEFAULT,
  titleSize: BRAND_TITLE_DEFAULT
};

function readSyncedSetting(key, defaultVal) {
  if (typeof loadStorage === 'function') return loadStorage(key, defaultVal);
  try {
    const raw = localStorage.getItem('mes_' + key);
    return raw == null ? defaultVal : JSON.parse(raw);
  } catch(e) {
    return defaultVal;
  }
}

function writeSyncedSetting(key, value) {
  if (typeof saveStorage === 'function') {
    saveStorage(key, value);
    return;
  }
  localStorage.setItem('mes_' + key, JSON.stringify(value));
}

function getSettingValue(key, defaultVal) {
  const saved = readSyncedSetting(key, defaultVal);
  if (saved && typeof saved === 'object' && !Array.isArray(saved) && Object.prototype.hasOwnProperty.call(saved, 'value')) {
    return saved.value;
  }
  return saved;
}

function getNumberSetting(key, defaultVal, min, max) {
  const value = Number(getSettingValue(key, defaultVal));
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : defaultVal;
}

function saveNumberSetting(key, value, defaultVal, min, max) {
  const raw = Number(value);
  const normalized = Math.round(Number.isFinite(raw) ? raw : defaultVal);
  const next = Math.min(max, Math.max(min, normalized));
  writeSyncedSetting(key, { value: next });
  return next;
}

function getSavedThemeMode() {
  const raw = localStorage.getItem('mes_' + THEME_STORAGE_KEY);
  if (raw === 'dark' || raw === 'light') return raw;
  try {
    const parsed = raw ? JSON.parse(raw) : '';
    const value = parsed && typeof parsed === 'object' ? parsed.value : parsed;
    if (value === 'dark' || value === 'light') return value;
  } catch(e) {
    /* legacy non-JSON values are handled above */
  }
  const saved = getSettingValue(THEME_STORAGE_KEY, '');
  return saved === 'dark' || saved === 'light' ? saved : '';
}

function saveThemeMode(mode) {
  writeSyncedSetting(THEME_STORAGE_KEY, { value: mode === 'dark' ? 'dark' : 'light' });
}

function normalizeScreenSettingsStorageForCloud() {
  const migrateNumber = (key, min, max) => {
    const raw = localStorage.getItem('mes_' + key);
    if (raw == null) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'value')) return;
      const value = Number(parsed);
      if (Number.isFinite(value)) {
        localStorage.setItem('mes_' + key, JSON.stringify({ value: Math.min(max, Math.max(min, Math.round(value))) }));
      }
    } catch(e) {
      const value = Number(raw);
      if (Number.isFinite(value)) {
        localStorage.setItem('mes_' + key, JSON.stringify({ value: Math.min(max, Math.max(min, Math.round(value))) }));
      }
    }
  };
  migrateNumber(UI_SCALE_STORAGE_KEY, UI_SCALE_MIN, UI_SCALE_MAX);
  migrateNumber(UI_FONT_STORAGE_KEY, UI_FONT_MIN, UI_FONT_MAX);
  migrateNumber(MENU_ICON_STORAGE_KEY, MENU_ICON_MIN, MENU_ICON_MAX);
  const rawTheme = localStorage.getItem('mes_' + THEME_STORAGE_KEY);
  if (rawTheme != null) {
    let theme = rawTheme === 'dark' || rawTheme === 'light' ? rawTheme : '';
    try {
      const parsed = JSON.parse(rawTheme);
      const value = parsed && typeof parsed === 'object' ? parsed.value : parsed;
      if (value === 'dark' || value === 'light') theme = value;
    } catch(e) {}
    if (theme) localStorage.setItem('mes_' + THEME_STORAGE_KEY, JSON.stringify({ value: theme }));
  }
}

function queueScreenSettingsCloudSave() {
  if (typeof cloudQueueSave !== 'function') return;
  SCREEN_SETTINGS_SYNC_KEYS.forEach(key => {
    if (localStorage.getItem('mes_' + key) != null) cloudQueueSave(key);
  });
  if (localStorage.getItem('mes_tableDisplayConfig') != null) cloudQueueSave('tableDisplayConfig');
}

function normalizeBrandSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const title = String(source.title == null ? BRAND_DEFAULTS.title : source.title).trim().slice(0, 28) || BRAND_DEFAULTS.title;
  const logoDataUrl = isSafeBrandLogoUrl(source.logoDataUrl) ? source.logoDataUrl : '';
  const logoName = logoDataUrl ? String(source.logoName || '').slice(0, 80) : '';
  const logoSizeRaw = Number(source.logoSize == null ? BRAND_LOGO_DEFAULT : source.logoSize);
  const logoSize = Number.isFinite(logoSizeRaw)
    ? Math.min(BRAND_LOGO_MAX, Math.max(BRAND_LOGO_MIN, Math.round(logoSizeRaw)))
    : BRAND_LOGO_DEFAULT;
  const titleSizeRaw = Number(source.titleSize == null ? BRAND_TITLE_DEFAULT : source.titleSize);
  const titleSize = Number.isFinite(titleSizeRaw)
    ? Math.min(BRAND_TITLE_MAX, Math.max(BRAND_TITLE_MIN, Math.round(titleSizeRaw)))
    : BRAND_TITLE_DEFAULT;
  return { title, logoDataUrl, logoName, logoSize, titleSize };
}

function getBrandSettings() {
  try {
    return normalizeBrandSettings(readSyncedSetting(BRAND_SETTINGS_KEY, {}));
  } catch(e) {
    return normalizeBrandSettings({});
  }
}

function isSafeBrandLogoUrl(url) {
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(url || ''));
}

function renderBrandMarkElement(el, settings) {
  if (!el) return;
  const s = normalizeBrandSettings(settings || getBrandSettings());
  el.innerHTML = '';
  el.classList.toggle('has-image', !!s.logoDataUrl);
  if (s.logoDataUrl) {
    const img = new Image();
    img.alt = '';
    img.src = s.logoDataUrl;
    el.appendChild(img);
  } else {
    const icon = document.createElement('i');
    icon.className = 'ti ti-building-factory-2';
    el.appendChild(icon);
  }
}

function getAppBrandTitle() {
  return getBrandSettings().title || BRAND_DEFAULTS.title;
}

function applyBrandSettings(settings) {
  const s = normalizeBrandSettings(settings || getBrandSettings());
  const title = inp('app-brand-title');
  document.documentElement.style.setProperty('--app-logo-size', s.logoSize + 'px');
  document.documentElement.style.setProperty('--app-brand-title-size', s.titleSize + 'px');
  renderBrandMarkElement(inp('app-brand-mark'), s);
  if (title) title.textContent = s.title;
  document.querySelectorAll('[data-app-brand-title]').forEach(el => { el.textContent = s.title; });
  const pageTitle = inp('ptitle');
  document.title = pageTitle && pageTitle.textContent
    ? pageTitle.textContent + ' — ' + s.title
    : s.title + ' — 제조실행 생산관리 시스템';
  renderBrandPreview(s);
}

function renderBrandPreview(settings) {
  const box = inp('ui-brand-preview');
  if (!box) return;
  const s = normalizeBrandSettings(settings || getBrandSettings());
  box.innerHTML = `
    <div class="ui-brand-preview-title"><span class="logo-mark" id="ui-brand-preview-mark"></span><strong>${esc(s.title)}</strong></div>
    <div class="ui-brand-preview-meta">${s.logoDataUrl ? esc(s.logoName || '사용자 로고') : '기본 아이콘 사용 중'} · 로고 ${s.logoSize}px · 명칭 ${s.titleSize}px</div>`;
  renderBrandMarkElement(inp('ui-brand-preview-mark'), s);
}

function saveBrandSettings(next, quiet) {
  const settings = normalizeBrandSettings(Object.assign({}, getBrandSettings(), next || {}));
  try {
    writeSyncedSetting(BRAND_SETTINGS_KEY, settings);
  } catch(e) {
    showToast('로고 이미지 저장 공간이 부족합니다. 더 작은 이미지를 사용하세요.', 'error');
    return false;
  }
  applyBrandSettings(settings);
  updateBrandControls(settings);
  if (!quiet) showToast('앱 로고 설정을 저장했습니다.', 'success');
  return true;
}

function updateBrandControls(settings) {
  const s = normalizeBrandSettings(settings || getBrandSettings());
  const title = inp('ui-brand-title');
  const logoRange = inp('ui-brand-logo-size');
  const logoValue = inp('ui-brand-logo-size-value');
  const titleRange = inp('ui-brand-title-size');
  const titleValue = inp('ui-brand-title-size-value');
  if (title) title.value = s.title;
  if (logoRange) logoRange.value = String(s.logoSize);
  if (logoValue) logoValue.textContent = s.logoSize + 'px';
  if (titleRange) titleRange.value = String(s.titleSize);
  if (titleValue) titleValue.textContent = s.titleSize + 'px';
  renderBrandPreview(s);
}

function saveBrandTextSettings() {
  saveBrandSettings({
    title: v('ui-brand-title')
  });
}

function clearBrandLogo() {
  saveBrandSettings({ logoDataUrl: '', logoName: '' });
}

function previewBrandLogoSize(value) {
  const size = Math.min(BRAND_LOGO_MAX, Math.max(BRAND_LOGO_MIN, Math.round(Number(value) || BRAND_LOGO_DEFAULT)));
  const settings = Object.assign({}, getBrandSettings(), { logoSize: size });
  applyBrandSettings(settings);
  updateBrandControls(settings);
}

function saveBrandLogoSize(value) {
  const size = Math.min(BRAND_LOGO_MAX, Math.max(BRAND_LOGO_MIN, Math.round(Number(value) || BRAND_LOGO_DEFAULT)));
  saveBrandSettings({ logoSize: size });
}

function setBrandLogoSize(value) {
  saveBrandLogoSize(value);
}

function previewBrandTitleSize(value) {
  const size = Math.min(BRAND_TITLE_MAX, Math.max(BRAND_TITLE_MIN, Math.round(Number(value) || BRAND_TITLE_DEFAULT)));
  const settings = Object.assign({}, getBrandSettings(), { titleSize: size });
  applyBrandSettings(settings);
  updateBrandControls(settings);
}

function saveBrandTitleSize(value) {
  const size = Math.min(BRAND_TITLE_MAX, Math.max(BRAND_TITLE_MIN, Math.round(Number(value) || BRAND_TITLE_DEFAULT)));
  saveBrandSettings({ titleSize: size });
}

function setBrandTitleSize(value) {
  saveBrandTitleSize(value);
}

function resetBrandSettings() {
  saveBrandSettings(BRAND_DEFAULTS, true);
  showToast('앱 로고 설정을 기본값으로 복원했습니다.', 'success');
}

function handleBrandLogoFile(input) {
  const file = input && input.files && input.files[0];
  if (input) input.value = '';
  if (!file) return;
  if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type || '')) {
    showToast('PNG, JPG, WebP 이미지만 사용할 수 있습니다.', 'error');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showToast('로고 이미지는 3MB 이하 파일을 사용하세요.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => showToast('로고 이미지를 읽지 못했습니다.', 'error');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => showToast('지원하지 않는 이미지입니다.', 'error');
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showToast('로고 이미지를 처리하지 못했습니다.', 'error');
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const scale = Math.min(size / img.width, size / img.height);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const x = Math.round((size - width) / 2);
      const y = Math.round((size - height) / 2);
      ctx.drawImage(img, x, y, width, height);
      saveBrandSettings({ logoDataUrl: canvas.toDataURL('image/png'), logoName: file.name });
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}

function getSavedUiScale() {
  return getNumberSetting(UI_SCALE_STORAGE_KEY, 100, UI_SCALE_MIN, UI_SCALE_MAX);
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
  const normalized = saveNumberSetting(UI_SCALE_STORAGE_KEY, value, 100, UI_SCALE_MIN, UI_SCALE_MAX);
  applyUiScale(normalized);
  updateUiScaleControls(normalized);
  showToast(`화면 크기를 ${normalized}%로 저장했습니다.`, 'success');
}

function setUiScale(value) {
  saveUiScale(value);
}

function resetUiScale() {
  writeSyncedSetting(UI_SCALE_STORAGE_KEY, { value: 100 });
  applyUiScale(100);
  updateUiScaleControls(100);
  showToast('화면 크기를 기본값 100%로 복원했습니다.', 'success');
}

function getSavedUiFontScale() {
  return getNumberSetting(UI_FONT_STORAGE_KEY, 100, UI_FONT_MIN, UI_FONT_MAX);
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
  const normalized = saveNumberSetting(UI_FONT_STORAGE_KEY, value, 100, UI_FONT_MIN, UI_FONT_MAX);
  applyUiFontScale(normalized);
  updateUiFontControls(normalized);
  showToast(`글자 크기를 ${normalized}%로 저장했습니다.`, 'success');
}

function setUiFontScale(value) {
  saveUiFontScale(value);
}

function resetUiFontScale() {
  writeSyncedSetting(UI_FONT_STORAGE_KEY, { value: 100 });
  applyUiFontScale(100);
  updateUiFontControls(100);
  showToast('글자 크기를 기본값 100%로 복원했습니다.', 'success');
}

function getSavedMenuIconSize() {
  return getNumberSetting(MENU_ICON_STORAGE_KEY, MENU_ICON_DEFAULT, MENU_ICON_MIN, MENU_ICON_MAX);
}

function applyMenuIconSize(value) {
  const requested = Number(value || getSavedMenuIconSize());
  const size = Math.min(MENU_ICON_MAX, Math.max(MENU_ICON_MIN, Math.round(requested)));
  const gridGap = Math.min(12, Math.max(5, Math.round(size * 0.12)));
  const padX = Math.min(22, Math.max(12, Math.round(size * 0.25)));
  const buttonMin = Math.round(size + 51);
  const menuWidth = Math.round((buttonMin * 3) + (gridGap * 2) + (padX * 2));
  const mobileIcon = Math.min(42, Math.max(21, Math.round(size * 0.48)));
  const mobileHeight = Math.max(58, mobileIcon + 38);
  document.documentElement.style.setProperty('--mega-menu-icon-size', `${size}px`);
  document.documentElement.style.setProperty('--mega-menu-icon-font-size', `${Math.round(size * 0.63)}px`);
  document.documentElement.style.setProperty('--mega-menu-button-min', `${buttonMin}px`);
  document.documentElement.style.setProperty('--mega-menu-grid-gap', `${gridGap}px`);
  document.documentElement.style.setProperty('--mega-menu-pad-x', `${padX}px`);
  document.documentElement.style.setProperty('--mega-menu-pad-y', `${Math.min(16, Math.max(10, Math.round(size * 0.2)))}px`);
  document.documentElement.style.setProperty('--mega-menu-width', `${menuWidth}px`);
  document.documentElement.style.setProperty('--mobile-tab-icon-size', `${mobileIcon}px`);
  document.documentElement.style.setProperty('--mobile-tabbar-base-height', `${mobileHeight}px`);
  return size;
}

function updateMenuIconControls(value) {
  const size = applyMenuIconSize(value || getSavedMenuIconSize());
  const range = inp('ui-menu-icon-range');
  const label = inp('ui-menu-icon-value');
  if (range) range.value = String(size);
  if (label) label.textContent = `${size}px`;
  document.querySelectorAll('.ui-menu-icon-presets .btn').forEach(btn => {
    const preset = Number(btn.dataset.size || 0);
    btn.classList.toggle('active', preset > 0 && size === preset);
  });
}

function previewMenuIconSize(value) {
  applyMenuIconSize(value);
  updateMenuIconControls(value);
}

function saveMenuIconSize(value) {
  const size = saveNumberSetting(MENU_ICON_STORAGE_KEY, value, MENU_ICON_DEFAULT, MENU_ICON_MIN, MENU_ICON_MAX);
  applyMenuIconSize(size);
  updateMenuIconControls(size);
  showToast(`메뉴 아이콘 크기를 ${size}px로 저장했습니다.`, 'success');
}

function setMenuIconSize(value) {
  saveMenuIconSize(value);
}

function resetMenuIconSize() {
  writeSyncedSetting(MENU_ICON_STORAGE_KEY, { value: MENU_ICON_DEFAULT });
  applyMenuIconSize(MENU_ICON_DEFAULT);
  updateMenuIconControls(MENU_ICON_DEFAULT);
  showToast('메뉴 아이콘 크기를 기본값으로 복원했습니다.', 'success');
}

function renderUiScaleSettings() {
  updateBrandControls(getBrandSettings());
  updateUiScaleControls(getSavedUiScale());
  updateUiFontControls(getSavedUiFontScale());
  updateMenuIconControls(getSavedMenuIconSize());
  updateTableGridLineControls(getTableGridLineSettings());
  renderUiColorSettings();
}

function getTableGridLineSettings() {
  try {
    const saved = readSyncedSetting(TABLE_GRID_STORAGE_KEY, {});
    return {
      horizontal: saved.horizontal !== false,
      vertical: saved.vertical !== false
    };
  } catch(e) {
    return { horizontal:true, vertical:true };
  }
}

function applyTableGridLineSettings(settings) {
  const next = Object.assign({ horizontal:true, vertical:true }, settings || getTableGridLineSettings());
  document.documentElement.classList.toggle('table-grid-horizontal-off', next.horizontal === false);
  document.documentElement.classList.toggle('table-grid-vertical-off', next.vertical === false);
  return next;
}

function updateTableGridLineControls(settings) {
  const next = applyTableGridLineSettings(settings || getTableGridLineSettings());
  const horizontal = inp('table-grid-horizontal');
  const vertical = inp('table-grid-vertical');
  if (horizontal) horizontal.checked = next.horizontal !== false;
  if (vertical) vertical.checked = next.vertical !== false;
}

function saveTableGridLineSettings(settings, quiet) {
  const next = applyTableGridLineSettings(settings);
  writeSyncedSetting(TABLE_GRID_STORAGE_KEY, next);
  updateTableGridLineControls(next);
  if (!quiet) showToast('테이블 선 표시 설정을 저장했습니다.', 'success');
}

function toggleTableGridLine(axis, checked) {
  const next = getTableGridLineSettings();
  if (axis === 'horizontal') next.horizontal = !!checked;
  if (axis === 'vertical') next.vertical = !!checked;
  saveTableGridLineSettings(next);
}

function resetTableGridLineSettings() {
  saveTableGridLineSettings({ horizontal:true, vertical:true }, true);
  showToast('테이블 선 표시를 기본값으로 복원했습니다.', 'success');
}

/* ════════ 테마별 화면 색상 ════════ */
const UI_COLOR_LEGACY_DEFAULTS = {
  light: { page:'#D9DDE4', card:'#EEF0F3', secondary:'#E4E7EC', topbar:'#EEF0F3', accent:'#185FA5', text:'#212529' }
};
const UI_COLOR_DEFAULTS = {
  light: { page:'#F5F8FB', card:'#FFFFFF', secondary:'#F8FAFC', topbar:'#FFFFFF', accent:'#185FA5', text:'#212529' },
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
    const saved = readSyncedSetting(UI_COLORS_STORAGE_KEY, {});
    const store = saved && typeof saved === 'object' ? saved : {};
    return migrateUiColorStoreDefaults(store);
  } catch(e) {
    return {};
  }
}

function isSameUiPalette(a, b) {
  if (!a || !b) return false;
  return UI_COLOR_FIELDS.every(field => normalizeHex(a[field.key], '') === normalizeHex(b[field.key], ''));
}

function migrateUiColorStoreDefaults(store) {
  if (!store || typeof store !== 'object') return {};
  if (store.light && isSameUiPalette(store.light, UI_COLOR_LEGACY_DEFAULTS.light)) {
    delete store.light;
    writeSyncedSetting(UI_COLORS_STORAGE_KEY, store);
  }
  return store;
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
  saveThemeMode(uiColorTheme);
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
  writeSyncedSetting(UI_COLORS_STORAGE_KEY, store);
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
  writeSyncedSetting(UI_COLORS_STORAGE_KEY, store);
  uiColorDraft = Object.assign({}, UI_COLOR_DEFAULTS[mode]);
  applyUiThemeColors(mode, uiColorDraft);
  renderUiColorFields();
  showToast(`${mode === 'dark' ? '어두운' : '밝은'} 테마 색상을 기본값으로 복원했습니다.`, 'success');
}

function applyScreenSettingsFromStorage() {
  initTheme();
  applyUiScale(getSavedUiScale());
  applyUiFontScale(getSavedUiFontScale());
  applyMenuIconSize(getSavedMenuIconSize());
  applyTableGridLineSettings(getTableGridLineSettings());
  applyBrandSettings();
  if (typeof currentPage !== 'undefined' && currentPage === 'system' && typeof systemTab !== 'undefined' && systemTab === 'display') {
    renderUiScaleSettings();
  }
  if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderDashboard === 'function') {
    renderDashboard();
  }
}

window.addEventListener('resize', () => {
  applyUiScale(getSavedUiScale());
  if (currentPage === 'system' && typeof systemTab !== 'undefined' && systemTab === 'display') {
    updateUiScaleControls(getSavedUiScale());
    updateMenuIconControls(getSavedMenuIconSize());
  }
});

/* ════════════════════════════════════════════════════════════
   클라우드 동기화 (Firebase Auth + Firestore)
   ▶ 설정 방법:
     1) https://console.firebase.google.com 에서 프로젝트 생성
     2) 빌드 > Authentication > 시작하기 > '이메일/비밀번호' 사용 설정
     3) 빌드 > Firestore Database > 데이터베이스 만들기(프로덕션 모드)
        프로젝트 루트의 firestore.rules를 Firebase CLI로 배포:
          firebase deploy --only firestore:rules
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
function shouldLockCloudShellOnBoot() {
  const host = (location && location.hostname) || '';
  const isLocal = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (isLocal && localStorage.getItem('mes_enableCloudOnLocal') !== 'true') return false;
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
if (typeof setAuthShellLocked === 'function') setAuthShellLocked(shouldLockCloudShellOnBoot());
/* 클라우드로 공유할 데이터 키(테마/관리자비번 등 기기·보안 로컬값은 제외) */
const CLOUD_KEYS = (typeof cloudDataKeysFromBackupKeys === 'function')
  ? cloudDataKeysFromBackupKeys()
  : ['clients','products','materials','workOrders','workers','defects','claims','checkRecords','alerts','inventory','inventoryLedger','deliveries','stages','trash','rfqList','poList','partners','statementList','taxList','quoteList','orderList','financeData','attendance','leaves','payrollRecords','asList','bomList','memoList','todoList','companyInfo','docXlsxTemplates','driveOAuthSettings','googleDriveConfig'];
var _fbAuth=null, _fbDb=null, _cloudUser=null;   // 초기 데이터 마이그레이션에서도 안전하게 참조되도록 var 사용
const _cloudQueue=new Set(); let _cloudTimer=null; let _cloudUnsub=null;

/* ════════ 프로그램 기동 초기화 (FIREBASE_CONFIG 선언 이후에 실행) ════════ */
syncFilterDropdowns();
normalizeScreenSettingsStorageForCloud();
initTheme();
applyUiScale(getSavedUiScale());
applyUiFontScale(getSavedUiFontScale());
applyMenuIconSize(getSavedMenuIconSize());
applyTableGridLineSettings(getTableGridLineSettings());
applyBrandSettings();
repairWorkerTimeValues();
// 햄버거 메가 메뉴에서는 이전 사이드바 표시 상태를 사용하지 않음
if (typeof applySidebarMode === 'function') applySidebarMode();
if (typeof initSidebarExpandableGroups === 'function') initSidebarExpandableGroups();
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
