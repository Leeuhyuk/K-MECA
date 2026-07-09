import { createRoot } from 'react-dom/client';
import { inventoryStore, modalStore } from './bridge/store.js';
import { InventoryTable } from './components/InventoryTable.jsx';
import { InventoryModal } from './components/InventoryModal.jsx';

// window.* 전역 재바인딩. inventory.js include 이후 실행되어 승리한다.
export function wireGlobals() {
  const w = globalThis;

  w.renderInventory = function () {
    if (typeof w.renderInventoryKpi === 'function') w.renderInventoryKpi();
    inventoryStore.emit();
  };

  w.openInvAdd = function () {
    if (typeof w.requireCreateAction === 'function' && !w.requireCreateAction('inventory', '재고 등록')) return;
    if (typeof w.editInvId !== 'undefined') w.editInvId = null;
    modalStore.setState({ mode: 'add' });
  };

  w.openInvEdit = function (id) {
    const item = (w.inventory || []).find((x) => x.id === id);
    if (!item) return;
    if (typeof w.requireRecordPermission === 'function' && !w.requireRecordPermission('edit', item, 'inventory')) return;
    modalStore.setState({ mode: 'edit', id });
  };
  // adjustStock, deleteInventory 는 vanilla 유지(내부에서 renderInventory 호출 → emit).
}

function mount() {
  const host = document.getElementById('inventory-table');
  if (host) {
    host.innerHTML = '';
    createRoot(host).render(<InventoryTable />);
  }
  // 모달 마운트 지점: body 끝에 컨테이너 생성.
  let modalHost = document.getElementById('inv-modal-react-root');
  if (!modalHost) {
    modalHost = document.createElement('div');
    modalHost.id = 'inv-modal-react-root';
    document.body.appendChild(modalHost);
  }
  createRoot(modalHost).render(<InventoryModal />);
}

function boot() {
  wireGlobals();
  mount();
  inventoryStore.emit();
}

// 브라우저에서만 자동 부팅. 테스트(vitest) 환경에서는 건너뛴다.
if (typeof document !== 'undefined' && import.meta.env.MODE !== 'test') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
