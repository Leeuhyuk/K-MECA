import { g, esc } from '../bridge/globals.js';

// 기존 vanilla 정렬 계약 재사용: 클릭 → window.toggleSort('inventory', key) → renderInventory() → emit.
export function SortableTh({ label, sortKey }) {
  const iconHtml = g('sortIcon', 'inventory', sortKey) || '';
  return (
    <th
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => g('toggleSort', 'inventory', sortKey)}
    >
      <span dangerouslySetInnerHTML={{ __html: esc(label) + ' ' + iconHtml }} />
    </th>
  );
}
