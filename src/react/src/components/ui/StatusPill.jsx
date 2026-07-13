const STATUS_TONE = {
  '입고완료': 'success',
  '완료': 'success',
  '정상': 'success',
  '발주중': 'info',
  '진행중': 'info',
  '작성중': 'neutral',
  '발주전': 'neutral',
  '대기': 'neutral',
  '지연': 'danger',
  '반려': 'danger',
  '안전재고 미달': 'danger',
  '확인완료': 'warning'
};

export function StatusPill({ status, tone, className = '' }) {
  const text = status || '미지정';
  const resolvedTone = tone || STATUS_TONE[text] || 'neutral';
  return (
    <span className={`modern-status-pill is-${resolvedTone} ${className}`.trim()}>
      {text}
    </span>
  );
}
