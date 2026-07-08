/* Cell double-click editing is intentionally disabled.
   Row-level selection and bulk actions are handled by table-selection.js/cloud-sync.js. */
(function () {
  'use strict';
  window.initMatInlineEdit = function initMatInlineEdit() {
    const cont = document.getElementById('mat-table');
    if (!cont) return;
    cont.querySelectorAll('.cell-sel,.cell-edit').forEach(el => {
      el.classList.remove('cell-sel', 'cell-edit');
    });
  };
})();
