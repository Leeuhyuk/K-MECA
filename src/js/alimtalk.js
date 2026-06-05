/* ════════ 카카오 알림톡 연계 (SOLAPI) ════════ */

/**
 * SOLAPI HMAC-SHA256 서명 생성 (브라우저 SubtleCrypto 사용)
 */
async function _solapiSign(apiSecret, date, salt) {
  const msg = date + salt;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 알림톡 단건 발송
 * @param {string} to - 수신 전화번호
 * @param {string} templateId - SOLAPI 템플릿 코드
 * @param {Object} variables - 치환 변수 {'#{변수명}': '값'}
 */
async function sendAlimtalk(to, templateId, variables) {
  var cfg = alimtalkSettings;
  if (!cfg || !cfg.enabled || !cfg.apiKey || !cfg.pfId || !to) return;
  var phone = String(to).replace(/[^0-9]/g, '');
  if (phone.length < 10) return;

  try {
    var date = new Date().toISOString();
    var salt = Math.random().toString(36).substring(2, 12);
    var signature = await _solapiSign(cfg.apiSecret || cfg.apiKey, date, salt);

    var body = {
      message: {
        to: phone,
        from: cfg.senderPhone,
        kakaoOptions: {
          pfId: cfg.pfId,
          templateId: templateId,
          variables: variables
        },
        disableSms: false
      }
    };

    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'HMAC-SHA256 apiKey=' + cfg.apiKey + ', date=' + date + ', salt=' + salt + ', signature=' + signature
      },
      body: JSON.stringify(body)
    });
  } catch(e) {
    console.warn('알림톡 발송 실패:', e && e.message);
  }
}

/* ── 이벤트별 발송 함수 ── */

function sendAlimtalkMaterialIn(m) {
  if (!alimtalkSettings || !alimtalkSettings.enabled || !alimtalkSettings.events || !alimtalkSettings.events.materialIncoming) return;
  var partner = (partners || []).find(function(p) { return p.name === m.supplier; });
  var phone = partner ? (partner.mobile || partner.tel) : null;
  if (!phone) return;
  sendAlimtalk(phone, 'TPL_MAT_IN', {
    '#{자재명}': m.name,
    '#{수량}': (m.qty || 0) + (m.unit || 'EA'),
    '#{발주번호}': m.id,
    '#{회사명}': '당사'
  });
}

function sendAlimtalkDeliveryDue(product) {
  if (!alimtalkSettings || !alimtalkSettings.enabled || !alimtalkSettings.events || !alimtalkSettings.events.deliveryDue) return;
  var d = daysUntil(product.deliveryDate);
  if (d > 7 || d < 0) return;
  var manager = (workers || []).find(function(w) { return w.status === '근무중' && w.mobile; });
  if (!manager) return;
  sendAlimtalk(manager.mobile, 'TPL_DLV_DUE', {
    '#{제품명}': product.name,
    '#{고객사}': getClientName(product.clientId),
    '#{납기일}': product.deliveryDate,
    '#{D-Day}': 'D-' + d,
    '#{공정단계}': product.processStage
  });
}

function sendAlimtalkAsRegistered(asItem) {
  if (!alimtalkSettings || !alimtalkSettings.enabled || !alimtalkSettings.events || !alimtalkSettings.events.asRegistered) return;
  var owner = (workers || []).find(function(w) { return w.id === asItem.owner && w.mobile; });
  var target = owner || (workers || []).find(function(w) { return w.status === '근무중' && w.mobile; });
  if (!target) return;
  sendAlimtalk(target.mobile, 'TPL_AS_NEW', {
    '#{접수번호}': asItem.id,
    '#{고객사}': getClientName(asItem.clientId),
    '#{제품명}': asItem.productName || '—',
    '#{증상}': (asItem.symptom || '').substring(0, 30)
  });
}

/* ── 알림톡 설정 페이지 렌더 ── */

function renderAlimtalkSettings() {
  var cont = document.getElementById('alimtalk-settings-body');
  if (!cont) return;
  var cfg = alimtalkSettings || {};
  var evts = cfg.events || {};

  var html = '<div style="display:grid;gap:14px;max-width:560px;padding:4px 0;">' +
    '<label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;">' +
    '<input type="checkbox" ' + (cfg.enabled ? 'checked' : '') + ' onchange="alimtalkToggle(this.checked)" style="width:16px;height:16px;">' +
    '카카오 알림톡 사용 (SOLAPI)' +
    '</label>';

  if (cfg.enabled) {
    html +=
      '<div class="form-row"><label class="form-lbl">SOLAPI API Key</label>' +
      '<input class="form-inp" id="at-apiKey" value="' + (cfg.apiKey || '') + '" placeholder="NCSXXXXX..."></div>' +
      '<div class="form-row"><label class="form-lbl">SOLAPI API Secret</label>' +
      '<input class="form-inp" id="at-apiSecret" type="password" value="' + (cfg.apiSecret || '') + '" placeholder="API Secret"></div>' +
      '<div class="form-row"><label class="form-lbl">카카오 채널 ID (pfId)</label>' +
      '<input class="form-inp" id="at-pfId" value="' + (cfg.pfId || '') + '" placeholder="_xKBBxjxb"></div>' +
      '<div class="form-row"><label class="form-lbl">발신번호</label>' +
      '<input class="form-inp" id="at-senderPhone" value="' + (cfg.senderPhone || '') + '" placeholder="01012345678"></div>' +
      '<div style="border-top:1px solid var(--br);padding-top:12px;">' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--tx-s);">발송 이벤트</div>' +
      [
        ['materialIncoming', '자재 입고완료 → 공급처 확인 요청'],
        ['deliveryDue',      '납기 D-7 이내 → 내부 담당자 알림'],
        ['asRegistered',     'A/S 접수 → 담당자 알림'],
        ['poSent',           '발주서 발송 → 공급처 확인 요청']
      ].map(function(pair) {
        return '<label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:8px;">' +
          '<input type="checkbox" ' + (evts[pair[0]] ? 'checked' : '') +
          ' onchange="alimtalkEventToggle(\'' + pair[0] + '\',this.checked)">' +
          pair[1] + '</label>';
      }).join('') +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-sm btn-primary" onclick="saveAlimtalkSettings()"><i class="ti ti-device-floppy"></i>저장</button>' +
      '<button class="btn btn-sm" onclick="testAlimtalk()"><i class="ti ti-send"></i>테스트 발송</button>' +
      '</div>';
  }

  html += '</div>';
  cont.innerHTML = html;
}

function alimtalkToggle(on) {
  alimtalkSettings.enabled = on;
  saveStorage('alimtalkSettings', alimtalkSettings);
  renderAlimtalkSettings();
}

function alimtalkEventToggle(key, on) {
  if (!alimtalkSettings.events) alimtalkSettings.events = {};
  alimtalkSettings.events[key] = on;
}

function saveAlimtalkSettings() {
  var k  = document.getElementById('at-apiKey');
  var s  = document.getElementById('at-apiSecret');
  var p  = document.getElementById('at-pfId');
  var ph = document.getElementById('at-senderPhone');
  if (k)  alimtalkSettings.apiKey      = k.value.trim();
  if (s)  alimtalkSettings.apiSecret   = s.value.trim();
  if (p)  alimtalkSettings.pfId        = p.value.trim();
  if (ph) alimtalkSettings.senderPhone = ph.value.trim();
  saveStorage('alimtalkSettings', alimtalkSettings);
  showToast('알림톡 설정이 저장됐습니다.');
}

async function testAlimtalk() {
  var manager = (workers || []).find(function(w) { return w.mobile; });
  if (!manager) { showToast('모바일 번호가 등록된 직원이 없습니다.', 'error'); return; }
  await sendAlimtalk(manager.mobile, 'TPL_TEST', { '#{메시지}': 'MESPro 알림톡 테스트 메시지입니다.' });
  showToast('테스트 발송 요청 완료. SOLAPI 발송 내역을 확인하세요.');
}
