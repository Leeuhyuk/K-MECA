/* ════════ 공통 KPI 카드 헬퍼 (kpiCardHtml) ════════
   화면마다 제각각이던 KPI 카드를 표준 .mc 카드 하나로 통일한다.
   규칙: 0값 색 규칙(상태 카운트가 0이면 중립색), tabular-nums(CSS), 아이콘/서브/필터 지원.
   함수 선언이므로 다른 render 함수보다 먼저 없어도 호이스팅으로 전역 사용 가능. */
function kpiCardTone(tone) {
  switch (tone) {
    case 'info': return 'var(--tx-i)';
    case 'ok': return 'var(--tx-ok)';
    case 'warn': return 'var(--tx-w)';
    case 'danger': return 'var(--tx-d)';
    case 'error': return 'var(--tx-err)';
    case 'neutral': return 'var(--tx-s)';
    default: return ''; // 상속(--tx)
  }
}

/* opts:
   - label   : 라벨(필수)
   - value   : 표시 문자열(필수, 예: '3건', '20%', fmtW 결과)
   - count   : 숫자(선택). 지정 시 0값 색 규칙 적용 대상.
   - tone    : 'info'|'ok'|'warn'|'danger'|'error'|'neutral'|''  숫자 색
   - icon    : tabler 아이콘 클래스(선택, 예: 'ti-alert-triangle')
   - sub     : 보조 텍스트(선택)
   - filterId/filterValue/renderFn : 클릭 필터(kpiFilter) 연결(선택)
   - active  : 필터 활성 강조(선택) */
function kpiCardHtml(opts) {
  opts = opts || {};
  const label = opts.label != null ? opts.label : '';
  const value = opts.value != null ? opts.value : '';
  const hasCount = typeof opts.count === 'number';
  // 0값 색 규칙: 카운트가 0이면 상태색 대신 중립색(--tx-s, 대비 6.7:1).
  const isZero = hasCount && opts.count === 0;
  const color = isZero ? 'var(--tx-s)' : kpiCardTone(opts.tone);
  const colorStyle = color ? ' style="color:' + color + ';"' : '';
  const iconHtml = opts.icon
    ? '<i class="ti ' + opts.icon + '"' + (color ? ' style="color:' + color + ';"' : '') + '></i>'
    : '';
  const subHtml = opts.sub ? '<div class="mc-sub">' + opts.sub + '</div>' : '';
  const clickable = opts.filterId && opts.renderFn;
  const cls = 'mc' + (clickable ? ' clickable' + (opts.active ? ' kpi-active' : '') : '');
  const onclick = clickable
    ? ' onclick="kpiFilter(\'' + opts.filterId + '\',\'' + (opts.filterValue || '') + '\',\'' + opts.renderFn + '\')"'
    : '';
  return '<div class="' + cls + '"' + onclick + '>' +
    '<div class="mc-lbl">' + iconHtml + label + '</div>' +
    '<div class="mc-val"' + colorStyle + '>' + value + '</div>' +
    subHtml +
    '</div>';
}
