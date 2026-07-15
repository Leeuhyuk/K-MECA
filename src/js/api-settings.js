/* ════════ 시스템 관리 - API 연결 관리 ════════ */

function _apiEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* AI 설정. apiKey/model 은 더 이상 여기 없다 — 서버(Secret Manager)가 키를 갖고
   모델도 서버가 정한다. 클라이언트에 키를 두면 활성 사용자 누구나 꺼낼 수 있었다.
   기존 문서에 apiKey 가 남아 있어도 읽지 않는다(마이그레이션 불필요, 사용만 중단). */
function getGeminiConfig() {
  var saved = loadStorage('geminiConfig', {});
  return { enabled: saved.enabled !== false };
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
      '<div class="card-hd"><span class="card-ttl"><i class="ti ti-sparkles"></i>AI 기능 (Gemini)</span>' +
        _apiStatus(gemini.enabled, gemini.enabled ? '사용 중' : '중지') + '</div>' +
      '<div style="display:grid;gap:12px;max-width:720px;">' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;">' +
          '<input type="checkbox" id="api-gemini-enabled" ' + (gemini.enabled ? 'checked' : '') + '>AI 기능 사용 (메모 요약 · 견적 초안 · 클레임 분류 · 자연어 검색)</label>' +
        '<div style="font-size:11px;color:var(--tx-t);line-height:1.6;">' +
          'API 키는 서버(Secret Manager)에만 보관되며 브라우저로 내려오지 않습니다. 키 등록은 배포 담당자가 <code>firebase functions:secrets:set GEMINI_API_KEY</code> 로 수행합니다.<br>' +
          'AI 는 초안·분류·검색까지만 수행하며 금액 확정이나 승인은 하지 않습니다. 요약·초안 결과는 반드시 사람이 검토한 뒤 사용하세요.<br>' +
          '무료 티어 데이터는 서비스 개선에 사용될 수 있으므로 민감한 개인정보·원가 정보는 AI 에 보내기 전에 제외하는 것을 권장합니다.' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-primary" onclick="saveGeminiApiSettings()"><i class="ti ti-device-floppy"></i>저장</button>' +
          '<button class="btn" onclick="testGeminiApi(event)"><i class="ti ti-plug-connected"></i>연결 테스트</button>' +
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
  // enabled 만 저장한다. 키는 서버에 있고, 예전 문서에 남은 apiKey 는 여기서 지워 흔적을 없앤다.
  _saveApiLocal('geminiConfig', { enabled: !!(inp('api-gemini-enabled') && inp('api-gemini-enabled').checked) });
  showToast('AI 기능 설정이 저장되었습니다.', 'success');
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

/* ── AI 호출 (서버 프록시) ──────────────────────────────────────
   Gemini 를 브라우저에서 직접 부르지 않는다. 예전에는 geminiConfig 에 저장한 API 키를
   URL 에 실어 호출했는데, 그 문서는 읽기가 활성 사용자 전체에 열려 있어 staff 도 콘솔에서
   키를 꺼낼 수 있었다(사용량 기반 과금이라 유출 = 청구). 키는 이제 서버 Secret Manager 에만 있다.
   프롬프트도 서버(functions/index.js 의 AI_TASKS)가 소유한다 — 임의 프롬프트를 받으면
   남의 키로 아무 질문이나 돌리는 통로가 되기 때문. 클라이언트는 task 이름과 데이터만 보낸다. */
const AI_FN_REGION = 'asia-northeast3';

function _aiCallable() {
  if (typeof firebase === 'undefined' || !firebase.app) throw new Error('클라우드에 연결되지 않았습니다.');
  return firebase.app().functions(AI_FN_REGION).httpsCallable('aiGenerate');
}

/* task: functions 의 AI_TASKS 키 / payload: 그 task 가 받는 입력 JSON */
async function callAiTask(task, payload) {
  if (!getGeminiConfig().enabled) throw new Error('AI 기능이 꺼져 있습니다. 시스템 관리 → API 관리에서 켜세요.');
  if (typeof cloudConfigured === 'function' && !cloudConfigured()) {
    throw new Error('AI 기능은 클라우드 로그인 후 사용할 수 있습니다.');
  }
  let res;
  try {
    res = await _aiCallable()({ task: task, payload: payload || {} });
  } catch (error) {
    // onCall 은 HttpsError 의 message 를 그대로 전달한다(서버에서 이미 안전하게 다듬음).
    throw new Error((error && error.message) || 'AI 호출에 실패했습니다.');
  }
  return (res && res.data && res.data.result) || {};
}

async function summarizeMemoWithGemini(text) {
  var source = String(text || '').trim();
  if (!source) throw new Error('요약할 메모가 없습니다.');
  return callAiTask('memoSummary', { text: source.substring(0, 20000), today: today() });
}

async function testGeminiApi(ev) {
  saveGeminiApiSettings();
  var button = ev && ev.currentTarget;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="ti ti-loader animate-spin"></i>테스트 중';
  }
  try {
    // 서버 프록시까지 실제로 왕복해 본다(키 설정 여부는 서버가 판단해 알려준다).
    var result = await summarizeMemoWithGemini('연결 테스트용 메모입니다. 내일까지 견적서를 발송해야 합니다.');
    showToast(result && result.summary ? 'AI 연결에 성공했습니다.' : 'AI 응답이 비어 있습니다.', result && result.summary ? 'success' : 'error');
  } catch (error) {
    showToast(error.message || 'AI 연결에 실패했습니다.', 'error');
  } finally {
    renderApiSettings();
  }
}
