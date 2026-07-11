import { g, esc } from '../bridge/globals.js';

// 기존 vanilla 정렬 계약 재사용: 클릭 → window.toggleSort('inventory', key) → renderInventory() → emit.
// displayCol: RBAC 컬럼 게이팅 CSS 가 헤더도 함께 숨기도록 헤더 셀에도 data-table-display-col 부여.
export function SortableTh({ label, sortKey, displayCol, scope = 'inventory' }) {
  const iconHtml = g('sortIcon', scope, sortKey) || '';
  return (
    <th
      data-table-display-col={displayCol}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => g('toggleSort', scope, sortKey)}
    >
      <span dangerouslySetInnerHTML={{ __html: esc(label) + ' ' + iconHtml }} />
    </th>
  );
}
