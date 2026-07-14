// 열(컬럼) 순서 — vanilla table-reorder.js 와 동일한 localStorage 규약을 공유한다.
// 키: 'colorder-<컨테이너 id>', 값: 원본 인덱스 배열(예: [0,2,1,3]).
// React 소유 표는 data-no-managed-table 로 vanilla 재정렬에서 빠지므로
// (DOM 을 직접 옮기면 vdom 과 어긋난다) 순서를 React 가 직접 소유해 렌더한다.
import { useRef } from 'react';

const storageKey = (tableId) => 'colorder-' + tableId;

export function defaultOrder(count) {
  return Array.from({ length: count }, (_, i) => i);
}

// 저장된 순서가 현재 열 구성과 맞을 때만 사용한다.
// (선택 체크박스 열이 켜지고 꺼지면 count 가 달라져 예전 순서는 무효)
export function loadColumnOrder(tableId, count) {
  let parsed;
  try {
    parsed = JSON.parse(globalThis.localStorage?.getItem(storageKey(tableId)) || 'null');
  } catch (error) {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== count) return null;
  const seen = new Array(count).fill(false);
  for (const index of parsed) {
    if (!Number.isInteger(index) || index < 0 || index >= count || seen[index]) return null;
    seen[index] = true;
  }
  return parsed;
}

export function saveColumnOrder(tableId, order) {
  try {
    globalThis.localStorage?.setItem(storageKey(tableId), JSON.stringify(order));
  } catch (error) { /* 저장 실패는 무시 — 순서는 이번 세션에만 적용된다 */ }
}

export function moveColumn(order, from, to) {
  if (from === to) return order;
  const next = order.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/* 헤더 드래그로 열을 옮긴다. onChange 로 리렌더를 알린다.
   thProps(visualIndex, draggable) 를 각 헤더 셀에 펼쳐 넣어 쓴다. */
export function useColumnReorder(tableId, count, onChange) {
  const order = loadColumnOrder(tableId, count) || defaultOrder(count);
  const dragFrom = useRef(null);

  function thProps(visualIndex, draggable) {
    if (!draggable) return {};
    return {
      draggable: true,
      onDragStart: (event) => {
        dragFrom.current = visualIndex;
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          try { event.dataTransfer.setData('text/plain', 'col'); } catch (_) { /* Safari 대비 */ }
        }
        event.currentTarget.classList.add('col-dragging');
      },
      onDragOver: (event) => {
        if (dragFrom.current === null) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('col-drop-target');
      },
      onDragLeave: (event) => event.currentTarget.classList.remove('col-drop-target'),
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('col-drop-target');
        const from = dragFrom.current;
        dragFrom.current = null;
        if (from === null || from === visualIndex) return;
        saveColumnOrder(tableId, moveColumn(order, from, visualIndex));
        onChange();
      },
      onDragEnd: (event) => {
        dragFrom.current = null;
        event.currentTarget.classList.remove('col-dragging');
        document.querySelectorAll('.col-drop-target').forEach((el) => el.classList.remove('col-drop-target'));
      }
    };
  }

  return { order, thProps };
}
