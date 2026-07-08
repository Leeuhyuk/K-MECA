/* ════════ 시스템 관리 - API 연결 관리 ════════ */

function _apiEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getGeminiConfig() {
  return loadStorage('geminiConfig', {
    enabled: true,
    apiKey: '',
    model: 'gemini-3.1-flash-lite'
  });
}

function _saveApiLocal(key, value) {
  localStorage.setItem('mes_' + key, JSON.stringify(value));
  if (typeof _triggerAutoSave === 'function') _triggerAutoSave();
}

function _apiStatus(configured, label) {
  return '<span style="font-size:11px;font-weight:700;color:' +
    (configured ? 'var(--tx-ok)' : 'var(--tx-t)') + ';">' +
    '<i class="ti ' + (configured ? 'ti-circle-check' : 'ti-circle-dashed') + '"></i> ' +
    (configured ? (label || '설정됨') : '미설정') + '</span>';
}

function _apiSecretInput(id, value, placeholder) {
  return '<div style="display:flex;gap:6px;">' +
    '<input class="form-inp" id="' + id + '" type="password" value="' + _apiEsc(value) +
    '" placeholder="' + _apiEsc(placeholder || '') + '" autocomplete="off">' +
    '<button class="btn btn-icon" type="button" onclick="toggleApiSecret(\'' + id +
    '\',this)" title="키 표시/숨김"><i class="ti ti-eye"></i></button></div>';
}

function renderApiSettings() {
  var body = inp('api-settings-body');
  if (!body) return;

  var gemini = getGeminiConfig();
  var email = getEmailjsConfig();
  var solapi = alimtalkSettings || {};
  var firebaseCfg = loadStorage('firebaseConfig', {});
  var activeFirebase = Object.assign({}, DEFAULT_FIREBASE_CONFIG, firebaseCfg);

  body.innerHTML =
    '<div class="card" style="margin-bottom:16px;background:var(--bg-s);border-color:#f59f00;">' +
      '<div style="display:flex;gap:10px;align-items:flex-start;">' +
        '<i class="ti ti-shield-lock" style="font-size:21px;color:#f59f00;"></i>' +
        '<div style="font-size:12px;color:var(--tx-s);line-height:1.7;">' +
          '<b style="color:var(--tx);">API 키 변경 안내</b><br>' +
          '새 키를 발급한 뒤 아래 기존 값을 지우고 새 키를 입력하여 저장하세요. 저장 후 연결 테스트를 실행하고, 정상 확인 뒤 공급자 사이트에서 이전 키를 폐기하세요. ' +
          '이 HTML 버전은 키를 현재 브라우저 저장소에 보관하므로 신뢰할 수 있는 사내 PC에서만 사용하세요. SOLAPI Secret과 Gemini 키는 향후 서버 함수로 이전하는 것이 가장 안전합니다.' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="card" id="api-card-gemini" style="margin-bottom:16px;">' +
      '<div class="card-hd"><span class="card-ttl"><i class="ti ti-sparkles"></i>Gemini - 메모 AI 요약</span>' +
        _apiStatus(!!gemini.apiKey, gemini.model) + '</div>' +
      '<div style="display:grid;gap:12px;max-width:720px;">' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;">' +
          '<input type="checkbox" id="api-gemini-enabled" ' + (gemini.enabled !== false ? 'checked' : '') + '>메모 AI 요약 사용</label>' +
        '<div class="form-row"><label class="form-lbl">Gemini API Key</label>' +
          _apiSecretInput('api-gemini-key', gemini.apiKey, 'AIza...') + '</div>' +
        '<div class="form-row"><label class="form-lbl">모델</label>' +
          '<input class="form-inp" id="api-gemini-model" value="' + _apiEsc(gemini.model) + '" placeholder="gemini-3.1-flash-lite"></div>' +
        '<div style="font-size:11px;color:var(--tx-t);line-height:1.6;">Google AI Studio에서 API 키를 발급합니다. 무료 티어 데이터는 서비스 개선에 사용될 수 있으므로 민감한 개인정보·원가 정보는 요약 전에 제외하는 것을 권장합니다.</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-primary" onclick="saveGeminiApiSettings()"><i class="ti ti-device-floppy"></i>저장</button>' +
          '<button class="btn" onclick="testGeminiApi(event)"><i class="ti ti-plug-connected"></i>연결 테스트</button>' +
          '<a class="btn" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"><i class="ti ti-external-link"></i>키 발급 페이지</a>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="card" id="api-card-solapi" style="margin-bottom:16px;">' +
      '<div class="card-hd"><span class="card-ttl"><i class="ti ti-brand-kakao"></i>SOLAPI - 카카오 알림톡</span>' +
        _apiStatus(!!(solapi.apiKey && solapi.apiSecret)) + '</div>' +
      '<div style="display:grid;gap:12px;max-width:720px;">' +
        '<div class="form-row"><label class="form-lbl">API Key</label>' +
          _apiSecretInput('api-solapi-key', solapi.apiKey, 'NCS...') + '</div>' +
        '<div class="form-row"><label class="form-lbl">API Secret</label>' +
          _apiSecretInput('api-solapi-secret', solapi.apiSecret, 'SOLAPI API Secret') + '</div>' +
        '<div style="font-size:11px;color:var(--tx-t);">키 저장 후 알림톡 설정 탭에서 채널 ID, 발신번호와 자동 발송 이벤트를 설정하세요.</div>' +
        '<div><button class="btn btn-primary" onclick="saveSolapiApiSettings()"><i class="ti ti-device-floppy"></i>저장</button></div>' +
      '</div>' +
    '</div>' +

    '<div class="card" id="api-card-emailjs" style="margin-bottom:16px;">' +
      '<div class="card-hd"><span class="card-ttl"><i class="ti ti-mail-cog"></i>EmailJS - 문서 이메일 발송</span>' +
        _apiStatus(!!(email.serviceId && email.templateId && email.publicKey)) + '</div>' +
      '<div style="display:grid;gap:12px;max-width:720px;">' +
        '<div class="form-row"><label class="form-lbl">Service ID</label><input class="form-inp" id="api-email-service" value="' + _apiEsc(email.serviceId) + '" placeholder="service_xxxxxxx"></div>' +
        '<div class="form-row"><label class="form-lbl">Template ID</label><input class="form-inp" id="api-email-template" value="' + _apiEsc(email.templateId) + '" placeholder="template_xxxxxxx"></div>' +
        '<div class="form-row"><label class="form-lbl">Public Key</label>' + _apiSecretInput('api-email-key', email.publicKey, 'EmailJS Public Key') + '</div>' +
        '<div><button class="btn btn-primary" onclick="saveEmailjsApiSettings()"><i class="ti ti-device-floppy"></i>저장</button></div>' +
      '</div>' +
    '</div>' +

    '<div class="card" id="api-card-firebase">' +
      '<div class="card-hd"><span class="card-ttl"><i class="ti ti-brand-firebase"></i>Firebase - 로그인·클라우드 동기화</span>' +
        _apiStatus(!!(activeFirebase.apiKey && activeFirebase.projectId), activeFirebase.projectId) + '</div>' +
      '<div style="display:grid;gap:12px;max-width:720px;">' +
        '<div class="form-row"><label class="form-lbl">API Key</label>' + _apiSecretInput('api-fb-key', activeFirebase.apiKey, 'Firebase Web API Key') + '</div>' +
        '<div class="form-row"><label class="form-lbl">Auth Domain</label><input class="form-inp" id="api-fb-auth" value="' + _apiEsc(activeFirebase.authDomain) + '"></div>' +
        '<div class="form-row"><label class="form-lbl">Database URL</label><input class="form-inp" id="api-fb-database" value="' + _apiEsc(activeFirebase.databaseURL) + '"></div>' +
        '<div class="form-row"><label class="form-lbl">Project ID</label><input class="form-inp" id="api-fb-project" value="' + _apiEsc(activeFirebase.projectId) + '"></div>' +
        '<div class="form-row"><label class="form-lbl">Storage Bucket</label><input class="form-inp" id="api-fb-storage" value="' + _apiEsc(activeFirebase.storageBucket) + '"></div>' +
        '<div class="form-row"><label class="form-lbl">Messaging Sender ID</label><input class="form-inp" id="api-fb-sender" value="' + _apiEsc(activeFirebase.messagingSenderId) + '"></div>' +
        '<div class="form-row"><label class="form-lbl">App ID</label><input class="form-inp" id="api-fb-app" value="' + _apiEsc(activeFirebase.appId) + '"></div>' +
        '<div class="form-row"><label class="form-lbl">Measurement ID</label><input class="form-inp" id="api-fb-measurement" value="' + _apiEsc(activeFirebase.measurementId) + '"></div>' +
        '<div style="font-size:11px;color:var(--tx-t);">Firebase 설정은 앱 시작 시 적용되므로 변경 후 자동으로 새로고침됩니다. Firebase 웹 API Key는 식별용 공개 설정이며 Firestore 보안 규칙과 로그인이 실제 접근을 보호합니다.</div>' +
        '<div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="saveFirebaseApiSettings()"><i class="ti ti-refresh"></i>저장 후 새로고침</button>' +
          '<button class="btn btn-danger" onclick="resetFirebaseApiSettings()"><i class="ti ti-restore"></i>기본 설정 복원</button></div>' +
      '</div>' +
    '</div>';
}

function toggleApiSecret(id, button) {
  var field = inp(id);
  if (!field) return;
  field.type = field.type === 'password' ? 'text' : 'password';
  var icon = button && button.querySelector('i');
  if (icon) icon.className = field.type === 'password' ? 'ti ti-eye' : 'ti ti-eye-off';
}

function openApiSettings(provider) {
  if (typeof go === 'function') go('system');
  switchSystemTab('api');
  setTimeout(function() {
    var card = inp('api-card-' + provider);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function saveGeminiApiSettings() {
  var config = {
    enabled: !!(inp('api-gemini-enabled') && inp('api-gemini-enabled').checked),
    apiKey: v('api-gemini-key').trim(),
    model: v('api-gemini-model').trim() || 'gemini-3.1-flash-lite'
  };
  _saveApiLocal('geminiConfig', config);
  showToast('Gemini 메모 요약 설정이 저장되었습니다.', 'success');
  renderApiSettings();
}

function saveSolapiApiSettings() {
  alimtalkSettings.apiKey = v('api-solapi-key').trim();
  alimtalkSettings.apiSecret = v('api-solapi-secret').trim();
  _saveApiLocal('alimtalkSettings', alimtalkSettings);
  showToast('SOLAPI 키가 저장되었습니다.', 'success');
  renderApiSettings();
}

function saveEmailjsApiSettings() {
  var config = {
    serviceId: v('api-email-service').trim(),
    templateId: v('api-email-template').trim(),
    publicKey: v('api-email-key').trim()
  };
  _saveApiLocal('emailjsConfig', config);
  if (config.publicKey && window.emailjs) emailjs.init({ publicKey: config.publicKey });
  showToast('EmailJS 설정이 저장되었습니다.', 'success');
  renderApiSettings();
}

function saveFirebaseApiSettings() {
  var config = {
    apiKey: v('api-fb-key').trim(),
    authDomain: v('api-fb-auth').trim(),
    databaseURL: v('api-fb-database').trim(),
    projectId: v('api-fb-project').trim(),
    storageBucket: v('api-fb-storage').trim(),
    messagingSenderId: v('api-fb-sender').trim(),
    appId: v('api-fb-app').trim(),
    measurementId: v('api-fb-measurement').trim()
  };
  _saveApiLocal('firebaseConfig', config);
  location.reload();
}

function resetFirebaseApiSettings() {
  if (!confirm('Firebase 연결 설정을 프로그램 기본값으로 복원하시겠습니까?')) return;
  localStorage.removeItem('mes_firebaseConfig');
  location.reload();
}

function _geminiText(response) {
  var candidates = response && response.candidates;
  var parts = candidates && candidates[0] && candidates[0].content && candidates[0].content.parts;
  return Array.isArray(parts) ? parts.map(function(part) { return part.text || ''; }).join('') : '';
}

async function callGeminiForMemo(prompt) {
  var config = getGeminiConfig();
  if (!config.enabled) throw new Error('Gemini 메모 요약 기능이 비활성화되어 있습니다.');
  if (!config.apiKey) throw new Error('시스템 관리의 API 관리에서 Gemini API 키를 설정하세요.');

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(config.model || 'gemini-3.1-flash-lite') +
    ':generateContent?key=' + encodeURIComponent(config.apiKey);
  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });
  var data = await response.json().catch(function() { return {}; });
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || ('Gemini API 오류 (' + response.status + ')'));
  }
  var text = _geminiText(data);
  if (!text) throw new Error('Gemini에서 결과를 받지 못했습니다.');
  try {
    return JSON.parse(text);
  } catch (error) {
    return { summary: text, keyPoints: [], actionItems: [], risks: [], suggestedTags: [] };
  }
}

async function summarizeMemoWithGemini(text) {
  var source = String(text || '').trim();
  if (!source) throw new Error('요약할 메모가 없습니다.');
  var now = new Date();
  var currentDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  return callGeminiForMemo(
    '다음 업무 메모를 한국어로 정리하세요. 현재 한국 날짜는 ' + currentDate + '입니다. ' +
    '반드시 JSON 객체만 반환하세요. 메모에 연도 없이 월과 일만 있으면 현재 날짜를 기준으로 가장 가까운 미래 날짜로 해석하고, ' +
    'dueDate는 반드시 YYYY-MM-DD 형식으로 작성하세요. 날짜를 알 수 없으면 빈 문자열을 사용하세요. ' +
    '형식: {"summary":"3문장 이내 요약","keyPoints":["핵심 내용"],' +
    '"actionItems":[{"text":"할 일","owner":"","dueDate":""}],' +
    '"risks":["위험 또는 확인사항"],"suggestedTags":["태그"]}\n\n메모:\n' + source.substring(0, 20000)
  );
}

async function testGeminiApi(ev) {
  saveGeminiApiSettings();
  var button = ev && ev.currentTarget;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="ti ti-loader animate-spin"></i>테스트 중';
  }
  try {
    var result = await callGeminiForMemo(
      '연결 테스트입니다. 반드시 {"summary":"Gemini 연결 성공","keyPoints":[],"actionItems":[],"risks":[],"suggestedTags":[]} JSON만 반환하세요.'
    );
    showToast(result.summary || 'Gemini 연결에 성공했습니다.', 'success');
  } catch (error) {
    showToast(error.message || 'Gemini 연결에 실패했습니다.', 'error');
  } finally {
    renderApiSettings();
  }
}
