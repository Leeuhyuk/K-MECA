/* Right-side entry panel normalization for create/edit dialogs. */
const SIDE_ENTRY_MODAL_IDS = new Set([
  'partner-modal', 'rfq-modal', 'po-modal', 'salesdoc-modal', 'sodoc-modal',
  'ca-modal', 'prod-modal', 'as-modal', 'bom-modal', 'mat-modal',
  'inv-modal', 'order-modal', 'defect-modal', 'claim-modal', 'check-modal',
  'worker-modal', 'att-modal', 'leave-modal', 'finance-modal', 'fixed-cost-modal',
  'alert-modal'
]);
const EXCLUSIVE_ENTRY_MODAL_IDS = new Set([
  'partner-modal', 'rfq-modal', 'po-modal', 'salesdoc-modal', 'sodoc-modal',
  'ca-modal', 'prod-modal', 'as-modal', 'bom-modal', 'bom-material-import-modal',
  'mat-modal', 'inv-modal', 'order-modal', 'defect-modal', 'claim-modal', 'check-modal',
  'worker-modal', 'att-modal', 'leave-modal', 'finance-modal', 'fixed-cost-modal',
  'fixed-cost-month-modal', 'payment-modal', 'payreq-modal', 'payroll-editor',
  'payroll-settings-modal', 'stage-modal', 'kanbanEditModal', 'memo-editor',
  'todo-editor', 'company-modal', 'emailjs-modal', 'alert-modal'
]);
let exclusiveModalSyncing = false;

function isSideEntryModal(modal) {
  return !!(modal && SIDE_ENTRY_MODAL_IDS.has(modal.id));
}

function directDialogChild(dialog, className) {
  return Array.from(dialog ? dialog.children : []).find(child => child.classList && child.classList.contains(className));
}

function ensureSideEntryCloseButton(modal, dialog) {
  if (!modal || !dialog || dialog.querySelector(':scope > .auto-side-entry-close')) return;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'side-entry-close auto-side-entry-close';
  closeBtn.title = '닫기';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.innerHTML = '<i class="ti ti-x"></i>';
  closeBtn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeModal(modal.id);
  });
  dialog.appendChild(closeBtn);
}

function ensureSideEntryResizer(dialog) {
  if (!dialog || dialog.querySelector(':scope > .selection-detail-resizer')) return;
  const resizer = document.createElement('div');
  resizer.className = 'selection-detail-resizer';
  resizer.title = '폭 조절';
  resizer.addEventListener('pointerdown', event => {
    if (typeof startSelectionDetailResize === 'function') startSelectionDetailResize(event);
  });
  dialog.insertBefore(resizer, dialog.firstChild);
}

function normalizeGenericSideEntryDialog(modal, dialog) {
  const titleEl = directDialogChild(dialog, 'dlg-title');
  const actionsEl = directDialogChild(dialog, 'dlg-actions');

  if (titleEl) {
    titleEl.classList.add('side-entry-head');
  }
  ensureSideEntryCloseButton(modal, dialog);
  if (actionsEl) actionsEl.classList.add('side-entry-actions');

  if (!directDialogChild(dialog, 'side-entry-body')) {
    const body = document.createElement('div');
    body.className = 'side-entry-body thin-scroll';
    const movable = Array.from(dialog.children).filter(child => (
      child !== titleEl &&
      child !== actionsEl &&
      !child.classList.contains('selection-detail-resizer') &&
      !child.classList.contains('side-entry-close')
    ));
    const anchor = actionsEl || null;
    dialog.insertBefore(body, anchor);
    movable.forEach(child => body.appendChild(child));
  }
}

function normalizeSideEntryModal(modal) {
  if (!isSideEntryModal(modal)) return;
  modal.classList.add('side-entry-overlay');
  const dialog = modal.querySelector(':scope > .dlg');
  if (!dialog) return;
  dialog.classList.add('side-entry-dialog');
  ensureSideEntryResizer(dialog);

  if (dialog.classList.contains('mat-entry-dialog')) {
    dialog.querySelector('.mat-entry-body')?.classList.add('side-entry-body', 'thin-scroll');
    dialog.querySelector('.mat-entry-actions')?.classList.add('side-entry-actions');
    return;
  }
  normalizeGenericSideEntryDialog(modal, dialog);
}

function normalizeSideEntryModals(root) {
  const scope = root && root.querySelectorAll ? root : document;
  if (scope.matches && scope.matches('.overlay')) normalizeSideEntryModal(scope);
  scope.querySelectorAll('.overlay').forEach(normalizeSideEntryModal);
}

function closeSelectionDetailForEntryModal() {
  if (typeof closeSelectionDetailPanel === 'function') {
    closeSelectionDetailPanel(true);
    return;
  }
  document.getElementById('selection-detail-panel')?.classList.remove('open');
}

function closeOtherExclusiveEntryModals(activeModal) {
  if (!activeModal || !EXCLUSIVE_ENTRY_MODAL_IDS.has(activeModal.id) || exclusiveModalSyncing) return;
  exclusiveModalSyncing = true;
  try {
    closeSelectionDetailForEntryModal();
    document.querySelectorAll('.overlay.open').forEach(modal => {
      if (modal !== activeModal && EXCLUSIVE_ENTRY_MODAL_IDS.has(modal.id)) {
        modal.classList.remove('open');
      }
    });
  } finally {
    exclusiveModalSyncing = false;
  }
}

function initExclusiveEntryModalManager(root) {
  const scope = root && root.querySelectorAll ? root : document;
  const overlays = [];
  if (scope.matches && scope.matches('.overlay')) overlays.push(scope);
  scope.querySelectorAll('.overlay').forEach(modal => overlays.push(modal));
  overlays.forEach(modal => {
    if (!EXCLUSIVE_ENTRY_MODAL_IDS.has(modal.id) || modal.dataset.exclusiveEntryModalObserver === '1') return;
    modal.dataset.exclusiveEntryModalObserver = '1';
    const observer = new MutationObserver(() => {
      if (modal.classList.contains('open')) closeOtherExclusiveEntryModals(modal);
    });
    observer.observe(modal, { attributes:true, attributeFilter:['class'] });
    if (modal.classList.contains('open')) closeOtherExclusiveEntryModals(modal);
  });
}

function initSideEntryModals() {
  normalizeSideEntryModals(document);
  initExclusiveEntryModalManager(document);
  window.normalizeSideEntryModals = normalizeSideEntryModals;
  window.initExclusiveEntryModalManager = initExclusiveEntryModalManager;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSideEntryModals, { once: true });
} else {
  initSideEntryModals();
}
