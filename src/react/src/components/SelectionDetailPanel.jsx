import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';

const EMPTY_STATE = { open: false, html: '' };

function subscribe(listener) {
  globalThis.addEventListener?.('selection-detail-react-change', listener);
  return () => globalThis.removeEventListener?.('selection-detail-react-change', listener);
}

function getSnapshot() {
  return globalThis.__selectionDetailReactState || EMPTY_STATE;
}

function splitDetailHtml(html) {
  const root = document.createElement('div');
  root.innerHTML = html || '';
  const body = root.querySelector('.selection-detail-body');
  if (!body) return { structured: false, html: html || '' };

  const tabHtml = (key) => body.querySelector(`[data-selection-detail-tab="${key}"]`)?.innerHTML.trim() || '';
  return {
    structured: true,
    resizerHtml: root.querySelector('.selection-detail-resizer')?.outerHTML || '',
    headerHtml: root.querySelector('.selection-detail-hd')?.outerHTML || '',
    staticHtml: body.querySelector('[data-selection-detail-static]')?.innerHTML.trim() || '',
    overviewHtml: tabHtml('overview'),
    itemsHtml: tabHtml('items'),
    historyHtml: tabHtml('history'),
    actionsHtml: root.querySelector('.selection-detail-actions')?.innerHTML.trim() || ''
  };
}

const TAB_LABELS = {
  overview: '개요',
  items: '품목·선택',
  history: '이력'
};

export function SelectionDetailPanel() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const panelRef = useRef(null);
  const tabIdPrefix = useId();
  const [activeTab, setActiveTab] = useState('overview');
  const parts = useMemo(() => splitDetailHtml(state.html), [state.html]);

  useEffect(() => {
    setActiveTab('overview');
  }, [state.html]);

  useEffect(() => {
    if (panelRef.current) globalThis.bindSelectionDetailStatusMenu?.(panelRef.current);
  }, [state.html, state.open, activeTab]);

  if (!state.html) return null;
  const tabs = parts.structured
    ? [
        { key: 'overview', html: parts.overviewHtml },
        { key: 'items', html: parts.itemsHtml },
        { key: 'history', html: parts.historyHtml }
      ].filter((tab) => tab.html)
    : [];
  const selectedTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0]?.key;

  return (
    <aside
      ref={panelRef}
      className={'selection-detail-panel selection-detail-panel-react' + (state.open ? ' open' : '')}
      aria-live="polite"
      aria-hidden={!state.open}
    >
      {state.open && !parts.structured && <div dangerouslySetInnerHTML={{ __html: parts.html }} />}
      {state.open && parts.structured && (
        <>
          <div dangerouslySetInnerHTML={{ __html: parts.resizerHtml }} />
          <div dangerouslySetInnerHTML={{ __html: parts.headerHtml }} />
          <div className="selection-detail-body modern-inspector-body">
            <div className="modern-inspector-static" dangerouslySetInnerHTML={{ __html: parts.staticHtml }} />
            <div className="modern-inspector-tabs" role="tablist" aria-label="상세 정보 보기">
              {tabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  key={tab.key}
                  id={`${tabIdPrefix}-${tab.key}`}
                  aria-controls={`${tabIdPrefix}-${tab.key}-panel`}
                  aria-selected={selectedTab === tab.key}
                  className="modern-inspector-tab"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {TAB_LABELS[tab.key]}
                </button>
              ))}
            </div>
            {tabs.map((tab) => (
              <div
                key={tab.key}
                role="tabpanel"
                id={`${tabIdPrefix}-${tab.key}-panel`}
                aria-labelledby={`${tabIdPrefix}-${tab.key}`}
                className="modern-inspector-tab-panel"
                hidden={selectedTab !== tab.key}
                dangerouslySetInnerHTML={{ __html: tab.html }}
              />
            ))}
          </div>
          <div className="selection-detail-actions" dangerouslySetInnerHTML={{ __html: parts.actionsHtml }} />
        </>
      )}
    </aside>
  );
}