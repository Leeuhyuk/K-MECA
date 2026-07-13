import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { getDomainStore, inventoryStore, materialModalStore, materialsStore, modalStore } from './bridge/store.js';
import { getInventory, getMaterials, g } from './bridge/globals.js';
import { InventoryTable } from './components/InventoryTable.jsx';
import { MaterialsTable } from './components/MaterialsTable.jsx';
import { MaterialModal } from './components/MaterialModal.jsx';
import { SelectionDetailPanel } from './components/SelectionDetailPanel.jsx';
import { LegacyTableIsland } from './components/LegacyTableIsland.jsx';
import { useDomainSelection } from './hooks/useDomainSelection.js';
import { InventoryModal } from './components/InventoryModal.jsx';
import { AppShellNavigation } from './components/AppShellNavigation.jsx';
import { TodayWorkStrip, clearModernInventoryWorkFilter, clearModernMaterialsWorkFilter } from './components/TodayWorkStrip.jsx';

const LEGACY_TABLE_ISLANDS = [
  { key: 'rfq', entityType: 'rfq', selector: '#rfq-table', render: 'renderRfq' },
  { key: 'po', entityType: 'po', selector: '#po-table', render: 'renderPo', enhance: false },
  { key: 'orders', entityType: 'workOrder', selector: '#orders-table', render: 'renderOrders' },
  { key: 'defects', entityType: 'defect', selector: '#defect-table', render: 'renderQuality' },
  { key: 'checks', entityType: 'checkRecord', selector: '#check-table', render: 'renderQuality' },
  { key: 'claims', entityType: 'claim', selector: '#claims-table-full', render: 'renderClaims' },
  { key: 'deliveries', entityType: 'delivery', selector: '#dlv-table', render: 'renderDeliveries' },
  { key: 'workers', entityType: 'worker', selector: '#workers-table', render: 'renderWorkers' },
  { key: 'as', entityType: 'as', selector: '#as-body', render: 'renderAS' },
  { key: 'partners', entityType: 'partners', selector: '#bp-table', render: 'renderPartners' },
  { key: 'products', entityType: 'products', selector: '#client-list', render: 'renderClients' },
  { key: 'bom', entityType: 'bom', selector: '#bom-body', render: 'renderBom' },
  { key: 'statement', entityType: 'statement', selector: '#st-table', render: 'renderSalesDoc', renderArg: 'statement' },
  { key: 'tax', entityType: 'tax', selector: '#tx-table', render: 'renderSalesDoc', renderArg: 'tax' },
  { key: 'quote', entityType: 'quote', selector: '#qt-table', render: 'renderSODoc', renderArg: 'quote' },
  { key: 'order', entityType: 'order', selector: '#so-table', render: 'renderSODoc', renderArg: 'order' }
];

function emitLegacyTableIslands(renderName, args) {
  LEGACY_TABLE_ISLANDS.forEach((config) => {
    if (config.render !== renderName) return;
    if (config.renderArg && config.renderArg !== args[0]) return;
    if (config.enhance !== false) g('enhanceBulk', config.key);
    getDomainStore(config.key).emit();
  });
}

function wireLegacyTableIslandRenders(w) {
  new Set(LEGACY_TABLE_ISLANDS.map((config) => config.render)).forEach((renderName) => {
    const legacyName = '__legacyReactIsland_' + renderName;
    if (typeof w[renderName] !== 'function' || typeof w[legacyName] === 'function') return;
    w[legacyName] = w[renderName];
    w[renderName] = function (...args) {
      const result = w[legacyName].apply(this, args);
      emitLegacyTableIslands(renderName, args);
      return result;
    };
  });
}

// window.* 전역 재바인딩. inventory.js include 이후 실행되어 승리한다.
export function wireGlobals() {
  const w = globalThis;

  // 재고/자재 필터·검색의 인라인 핸들러(onchange/oninput)가 호출하는 전역.
  // import만 하고 전역에 붙이지 않으면 번들러가 미사용 export로 tree-shaking 제거해
  // ReferenceError로 필터·검색이 전면 동작 불능이 된다.
  w.clearModernInventoryWorkFilter = clearModernInventoryWorkFilter;
  w.clearModernMaterialsWorkFilter = clearModernMaterialsWorkFilter;

  w.closeReactEntryPanels = function () {
    modalStore.setState(null);
    materialModalStore.setState(null);
  };

  w.renderInventory = function () {
    if (typeof w.renderInventoryKpi === 'function') w.renderInventoryKpi();
    inventoryStore.emit();
  };

  w.openInvAdd = function () {
    if (typeof w.requireCreateAction === 'function' && !w.requireCreateAction('inventory', '재고 등록')) return;
    if (typeof w.editInvId !== 'undefined') w.editInvId = null;
    if (typeof w.clearReactInventorySelection === 'function') w.clearReactInventorySelection();
    g('closeSelectionDetailPanel', false);
    modalStore.setState({ mode: 'add' });
  };

  w.openInvEdit = function (id) {
    const item = getInventory().find((x) => x.id === id);
    if (!item) return;
    if (typeof w.requireRecordPermission === 'function' && !w.requireRecordPermission('edit', item, 'inventory')) return;
    if (typeof w.clearReactInventorySelection === 'function') w.clearReactInventorySelection();
    g('closeSelectionDetailPanel', false);
    modalStore.setState({ mode: 'edit', id });
  };

  if (typeof w.renderMaterials === 'function') {
    if (typeof w.__legacyRenderMaterials !== 'function') w.__legacyRenderMaterials = w.renderMaterials;
    w.renderMaterials = function () {
      w.__legacyRenderMaterials();
      materialsStore.emit();
    };
  }
  w.openMatAdd = function () {
    if (typeof w.requireCreateAction === 'function' && !w.requireCreateAction('materials', '자재 발주 등록')) return;
    w.clearReactDomainSelection?.('materials');
    g('closeSelectionDetailPanel', false);
    materialModalStore.setState({ mode:'add' });
  };

  w.openMatEdit = function (id) {
    const item = getMaterials().find((material) => material.id === id);
    if (!item) return;
    if (typeof w.requireRecordPermission === 'function' && !w.requireRecordPermission('edit', item, 'material')) return;
    w.clearReactDomainSelection?.('materials');
    g('closeSelectionDetailPanel', false);
    materialModalStore.setState({ mode:'edit', id });
  };

  w.cloneMat = function (id) {
    if (typeof w.checkAdminAction === 'function' && !w.checkAdminAction()) return;
    const item = getMaterials().find((material) => material.id === id);
    if (!item) return;
    w.clearReactDomainSelection?.('materials');
    g('closeSelectionDetailPanel', false);
    materialModalStore.setState({ mode:'clone', id });
  };

  wireLegacyTableIslandRenders(w);
  // adjustStock, deleteInventory 와 자재 저장·상태 변경은 vanilla 유지(각 render 함수가 store emit).
}

function InventoryTableController() {
  const version = useSyncExternalStore(inventoryStore.subscribe, inventoryStore.getVersion, inventoryStore.getVersion);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    setSelectedIds((current) => current.size ? new Set() : current);
  }, [version]);

  useEffect(() => {
    g('updateSelectionDetailPanelFromReactInventory', Array.from(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    const clear = () => setSelectedIds(new Set());
    globalThis.clearReactInventorySelection = clear;
    return () => {
      if (globalThis.clearReactInventorySelection === clear) delete globalThis.clearReactInventorySelection;
      g('updateSelectionDetailPanelFromReactInventory', []);
    };
  }, []);

  const toggleRow = (id) => {
    g('releaseSelectionDetailNavigationSuppress');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids) => {
    g('releaseSelectionDetailNavigationSuppress');
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  return (
    <InventoryTable
      selectable
      selectedIds={selectedIds}
      onToggleRow={toggleRow}
      onToggleAll={toggleAll}
    />
  );
}

function MaterialsTableController() {
  const { selectedIds, toggleRow, toggleAll } = useDomainSelection({
    domainKey: 'materials',
    entityType: 'material',
    store: materialsStore
  });

  return (
    <MaterialsTable
      selectable
      selectedIds={selectedIds}
      onToggleRow={toggleRow}
      onToggleAll={toggleAll}
    />
  );
}

function mountLegacyTableIsland(config) {
  const legacyHost = document.querySelector(config.selector);
  if (!legacyHost) return;
  legacyHost.style.display = 'none';
  const rootId = config.key + '-react-table-root';
  let host = document.getElementById(rootId);
  if (!host) {
    host = document.createElement('div');
    host.id = rootId;
    host.style.overflowX = 'auto';
    legacyHost.insertAdjacentElement('afterend', host);
  }
  createRoot(host).render(
    <LegacyTableIsland
      domainKey={config.key}
      entityType={config.entityType}
      sourceSelector={config.selector}
      store={getDomainStore(config.key)}
    />
  );
}

function mountAppShellNavigation() {
  const main = document.querySelector('.main');
  if (!main) return;
  let host = document.getElementById('modern-app-nav-root');
  if (!host) {
    host = document.createElement('div');
    host.id = 'modern-app-nav-root';
    main.insertAdjacentElement('beforebegin', host);
  }
  createRoot(host).render(<AppShellNavigation />);
}
function mountTodayWorkStrip(domain, pageSelector) {
  const page = document.querySelector(pageSelector);
  if (!page) return;
  const rootId = `${domain}-today-work-react-root`;
  let host = document.getElementById(rootId);
  if (!host) {
    host = document.createElement('div');
    host.id = rootId;
    host.className = 'modern-work-queue-root';
    page.insertAdjacentElement('afterbegin', host);
  }
  createRoot(host).render(<TodayWorkStrip domain={domain} />);
}

function mount() {
  mountAppShellNavigation();
  mountTodayWorkStrip('materials', '#pg-materials');
  mountTodayWorkStrip('inventory', '#pg-inventory');
  const host = document.getElementById('inventory-table');
  if (host) {
    host.innerHTML = '';
    createRoot(host).render(<InventoryTableController />);
  }

  const legacyMaterialsHost = document.getElementById('mat-table');
  if (legacyMaterialsHost) {
    legacyMaterialsHost.style.display = 'none';
    let materialsHost = document.getElementById('materials-react-root');
    if (!materialsHost) {
      materialsHost = document.createElement('div');
      materialsHost.id = 'materials-react-root';
      materialsHost.style.overflowX = 'auto';
      legacyMaterialsHost.insertAdjacentElement('afterend', materialsHost);
    }
    createRoot(materialsHost).render(<MaterialsTableController />);
  }
  LEGACY_TABLE_ISLANDS.forEach(mountLegacyTableIsland);
  // 모달 마운트 지점: body 끝에 컨테이너 생성.
  let modalHost = document.getElementById('inv-modal-react-root');
  if (!modalHost) {
    modalHost = document.createElement('div');
    modalHost.id = 'inv-modal-react-root';
    document.body.appendChild(modalHost);
  }
  createRoot(modalHost).render(<InventoryModal />);

  let materialModalHost = document.getElementById('material-modal-react-root');
  if (!materialModalHost) {
    materialModalHost = document.createElement('div');
    materialModalHost.id = 'material-modal-react-root';
    document.body.appendChild(materialModalHost);
  }
  document.getElementById('mat-modal')?.classList.remove('open');
  createRoot(materialModalHost).render(<MaterialModal />);

  let selectionDetailHost = document.getElementById('selection-detail-react-root');
  if (!selectionDetailHost) {
    selectionDetailHost = document.createElement('div');
    selectionDetailHost.id = 'selection-detail-react-root';
    document.body.appendChild(selectionDetailHost);
  }
  createRoot(selectionDetailHost).render(<SelectionDetailPanel />);
}

function boot() {
  wireGlobals();
  mount();
  inventoryStore.emit();
  if (typeof globalThis.renderMaterials === 'function') globalThis.renderMaterials();
  new Set(LEGACY_TABLE_ISLANDS.map((config) => config.render)).forEach((renderName) => {
    const configs = LEGACY_TABLE_ISLANDS.filter((config) => config.render === renderName);
    const args = configs.map((config) => config.renderArg).filter(Boolean);
    if (args.length) args.forEach((arg) => globalThis[renderName]?.(arg));
    else globalThis[renderName]?.();
  });
}

// 브라우저에서만 자동 부팅. 테스트(vitest) 환경에서는 건너뛴다.
if (typeof document !== 'undefined' && import.meta.env.MODE !== 'test') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
