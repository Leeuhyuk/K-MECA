/* ════════ 납기 캘린더 ════════ */
var calYear  = new Date().getFullYear();
var calMonth = new Date().getMonth(); // 0-based
var calDay   = new Date().getDate();
var calView  = 'month';

function calNav(delta) {
  if (calView === 'year') {
    calYear += delta;
  } else if (calView === 'day') {
    var d = new Date(calYear, calMonth, calDay);
    d.setDate(d.getDate() + delta);
    calYear = d.getFullYear(); calMonth = d.getMonth(); calDay = d.getDate();
  } else {
    calMonth += delta;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    if (calMonth < 0)  { calMonth = 11; calYear--; }
    calDay = Math.min(calDay, new Date(calYear, calMonth + 1, 0).getDate());
  }
  renderCalendar();
}

function calGoToday() {
  var now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth(); calDay = now.getDate();
  renderCalendar();
}
function calResetView() {
  calView = 'month';
  calGoToday();
}

function calChangeView(view) {
  calView = view || 'month';
  renderCalendar();
}

function calOpenMonth(month) {
  calMonth = month;
  calView = 'month';
  var sel = document.getElementById('cal-view'); if (sel) sel.value = 'month';
  renderCalendar();
}

function calOpenDay(dateStr) {
  var p = dateStr.split('-');
  calYear = Number(p[0]); calMonth = Number(p[1]) - 1; calDay = Number(p[2]);
  calView = 'day';
  var sel = document.getElementById('cal-view'); if (sel) sel.value = 'day';
  renderCalendar();
}

function renderCalendar() {
  var titleEl = document.getElementById('cal-title');
  if (titleEl) {
    titleEl.textContent = calView === 'year' ? calYear + '년'
      : calView === 'day' ? calYear + '년 ' + (calMonth + 1) + '월 ' + calDay + '일'
      : calYear + '년 ' + (calMonth + 1) + '월';
  }
  var viewSel = document.getElementById('cal-view'); if (viewSel) viewSel.value = calView;

  var events = {};
  function addEvent(date, label, color) {
    if (!date) return;
    var d = date.substring(0, 10);
    if (!events[d]) events[d] = [];
    events[d].push({ label: label, color: color });
  }

  var todayStr = today();

  var calProducts = typeof visibleRecords === 'function' ? visibleRecords(products || [], 'processProduct') : (products || []);
  var calMaterials = typeof visibleRecords === 'function' ? visibleRecords(materials || [], 'material') : (materials || []);

  calProducts.filter(function(p) {
    return p.deliveryDate && p.status !== '완료' && p.status !== '납품';
  }).forEach(function(p) {
    var d = daysUntil(p.deliveryDate);
    var color = d <= 3 ? '#e03131' : d <= 7 ? '#f08c00' : '#1971c2';
    addEvent(p.deliveryDate, '📦 ' + getClientName(p.clientId) + ' — ' + p.name, color);
  });

  calMaterials.filter(function(m) {
    return m.expectedDate && m.status !== '입고완료';
  }).forEach(function(m) {
    addEvent(m.expectedDate, '🔩 ' + m.name + ' (' + m.id + ')', '#40c057');
  });

  var grid = document.getElementById('cal-grid');
  if (!grid) return;
  if (calView === 'year') {
    var monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    grid.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">' +
      monthNames.map(function(name, month) {
        var prefix = calYear + '-' + String(month + 1).padStart(2,'0');
        var dates = Object.keys(events).filter(function(d){ return d.slice(0,7) === prefix; });
        var count = dates.reduce(function(s,d){ return s + events[d].length; }, 0);
        var productCount = calProducts.filter(function(p){ return (p.deliveryDate||'').slice(0,7)===prefix && p.status!=='완료' && p.status!=='납품'; }).length;
        var materialCount = calMaterials.filter(function(m){ return (m.expectedDate||'').slice(0,7)===prefix && m.status!=='입고완료'; }).length;
        return '<button onclick="calOpenMonth(' + month + ')" style="text-align:left;padding:16px;border:1px solid var(--br);border-radius:var(--rl);background:var(--bg-p);color:var(--tx);cursor:pointer;">' +
          '<div style="font-size:15px;font-weight:800;margin-bottom:10px;">' + name + '</div>' +
          '<div style="font-size:22px;font-weight:800;color:' + (count?'var(--tx-i)':'var(--tx-t)') + ';">' + count + '건</div>' +
          '<div style="font-size:11px;color:var(--tx-t);margin-top:6px;">제품 납기 ' + productCount + ' · 자재 입고 ' + materialCount + '</div></button>';
      }).join('') + '</div>';
    return;
  }

  if (calView === 'day') {
    var dayStr = calYear + '-' + String(calMonth + 1).padStart(2,'0') + '-' + String(calDay).padStart(2,'0');
    var dayEvents = events[dayStr] || [];
    grid.innerHTML = '<div class="card"><div class="card-hd"><span class="card-ttl"><i class="ti ti-calendar-event"></i>' + dayStr + ' 일정</span>' +
      '<span style="font-size:11px;color:var(--tx-t);">' + dayEvents.length + '건</span></div>' +
      (dayEvents.length ? dayEvents.map(function(e) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:11px 4px;border-bottom:1px solid var(--br);">' +
          '<span style="width:9px;height:9px;border-radius:50%;background:' + e.color + ';flex:none;"></span>' +
          '<span style="font-size:13px;font-weight:600;">' + e.label + '</span></div>';
      }).join('') : '<div style="padding:30px;text-align:center;color:var(--tx-t);">등록된 일정이 없습니다.</div>') + '</div>';
    return;
  }

  var firstDay = new Date(calYear, calMonth, 1).getDay();
  var lastDate = new Date(calYear, calMonth + 1, 0).getDate();
  var days = ['일', '월', '화', '수', '목', '금', '토'];

  var html = '<table style="width:100%;border-collapse:collapse;min-width:700px;table-layout:fixed;">' +
    '<colgroup>' + days.map(function(){ return '<col style="width:14.285%;">'; }).join('') + '</colgroup>' +
    '<thead><tr>' +
    days.map(function(d, i) {
      return '<th style="padding:8px 4px;font-size:12px;font-weight:600;color:' +
        (i === 0 ? 'var(--tx-d)' : i === 6 ? '#228be6' : 'var(--tx-s)') +
        ';border-bottom:2px solid var(--br);text-align:center;">' + d + '</th>';
    }).join('') +
    '</tr></thead><tbody>';

  var dayCount = 1;
  for (var week = 0; week < 6; week++) {
    if (dayCount > lastDate) break;
    html += '<tr>';
    for (var dow = 0; dow < 7; dow++) {
      var isEmpty = (week === 0 && dow < firstDay) || dayCount > lastDate;
      if (isEmpty) {
        html += '<td style="height:90px;padding:4px;border:1px solid var(--br);background:var(--bg-s);"></td>';
        continue;
      }
      var mm = String(calMonth + 1).padStart(2, '0');
      var dd = String(dayCount).padStart(2, '0');
      var dateStr = calYear + '-' + mm + '-' + dd;
      var isToday = dateStr === todayStr;
      var dayEvents = events[dateStr] || [];
      var dayColor = dow === 0 ? 'var(--tx-d)' : dow === 6 ? '#228be6' : 'var(--tx)';

      html += '<td style="height:90px;padding:4px;border:1px solid var(--br);vertical-align:top;' +
        'background:' + (isToday ? 'rgba(79,142,247,.08)' : 'var(--bg-p)') + ';' +
        'cursor:' + (dayEvents.length ? 'pointer' : 'default') + ';"' +
        ' onclick="calOpenDay(\'' + dateStr + '\')" title="일 보기로 전환">';

      if (isToday) {
        html += '<div style="font-size:12px;font-weight:700;margin-bottom:3px;">' +
          '<span style="background:var(--tx-i);color:#fff;border-radius:50%;width:22px;height:22px;' +
          'display:inline-flex;align-items:center;justify-content:center;font-size:11px;">' +
          dayCount + '</span></div>';
      } else {
        html += '<div style="font-size:12px;font-weight:400;color:' + dayColor + ';margin-bottom:3px;">' + dayCount + '</div>';
      }

      dayEvents.slice(0, 3).forEach(function(e) {
        html += '<div style="font-size:9px;background:' + e.color + '22;color:' + e.color + ';' +
          'border-left:2px solid ' + e.color + ';padding:1px 3px;border-radius:2px;' +
          'margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          e.label + '</div>';
      });
      if (dayEvents.length > 3) {
        html += '<div style="font-size:9px;color:var(--tx-t);">+' + (dayEvents.length - 3) + '건</div>';
      }

      html += '</td>';
      dayCount++;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  grid.innerHTML = html;
}

function calShowDetail(dateStr) {
  var detail = document.getElementById('cal-detail');
  if (!detail) return;
  detail.style.display = 'block';

  var prods = (products || []).filter(function(p) {
    return p.deliveryDate && p.deliveryDate.startsWith(dateStr);
  });
  var mats = (materials || []).filter(function(m) {
    return m.expectedDate && m.expectedDate.startsWith(dateStr) && m.status !== '입고완료';
  });

  var html = '<div class="card"><div class="card-hd">' +
    '<span class="card-ttl"><i class="ti ti-calendar-event"></i>' + dateStr + ' 일정</span>' +
    '<button class="btn btn-sm" onclick="document.getElementById(\'cal-detail\').style.display=\'none\'"><i class="ti ti-x"></i></button>' +
    '</div>';

  if (prods.length) {
    html += '<div style="margin-bottom:8px;font-size:12px;font-weight:700;color:var(--tx-s);">납기 제품 (' + prods.length + '건)</div>';
    prods.forEach(function(p) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--br);">' +
        dayBadge(p.deliveryDate) +
        '<span style="font-weight:700;">' + p.name + '</span>' +
        '<span style="font-size:11px;color:var(--tx-t);">' + getClientName(p.clientId) + '</span>' +
        '<span class="bd">' + p.processStage + '</span>' +
        '</div>';
    });
  }

  if (mats.length) {
    html += '<div style="margin:8px 0;font-size:12px;font-weight:700;color:var(--tx-s);">자재 입고 예정 (' + mats.length + '건)</div>';
    mats.forEach(function(m) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--br);">' +
        '<i class="ti ti-package" style="color:#40c057;"></i>' +
        '<span style="font-weight:700;">' + m.name + '</span>' +
        '<span style="font-size:11px;color:var(--tx-t);">' + (m.supplier||'—') + ' · ' + m.id + '</span>' +
        '</div>';
    });
  }

  if (!prods.length && !mats.length) {
    html += '<div style="padding:12px;color:var(--tx-t);font-size:12px;">일정 없음</div>';
  }

  html += '</div>';
  detail.innerHTML = html;
}
