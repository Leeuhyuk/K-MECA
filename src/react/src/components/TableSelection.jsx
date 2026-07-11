import { useEffect, useRef } from 'react';

export const TABLE_INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,label,[contenteditable="true"]';

export function isInteractiveTableTarget(target) {
  return !!target?.closest?.(TABLE_INTERACTIVE_SELECTOR);
}

export function SelectAllCheckbox({ ids, selectedIds, onToggleAll, ariaLabel = '현재 표시 항목 전체 선택' }) {
  const ref = useRef(null);
  const selectedCount = ids.filter((id) => selectedIds?.has?.(id)).length;
  const allSelected = ids.length > 0 && selectedCount === ids.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selectedCount > 0 && !allSelected;
  }, [selectedCount, allSelected]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="table-check-all"
      aria-label={ariaLabel}
      checked={allSelected}
      onChange={() => onToggleAll?.(ids)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}