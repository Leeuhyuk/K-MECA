import { useEffect, useRef, useSyncExternalStore } from 'react';

const EMPTY_STATE = { open: false, html: '' };

function subscribe(listener) {
  globalThis.addEventListener?.('selection-detail-react-change', listener);
  return () => globalThis.removeEventListener?.('selection-detail-react-change', listener);
}

function getSnapshot() {
  return globalThis.__selectionDetailReactState || EMPTY_STATE;
}

export function SelectionDetailPanel() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) globalThis.bindSelectionDetailStatusMenu?.(panelRef.current);
  }, [state.html, state.open]);

  if (!state.html) return null;
  return (
    <aside
      ref={panelRef}
      className={'selection-detail-panel selection-detail-panel-react' + (state.open ? ' open' : '')}
      aria-live="polite"
      aria-hidden={!state.open}
      dangerouslySetInnerHTML={{ __html: state.open ? state.html : '' }}
    />
  );
}