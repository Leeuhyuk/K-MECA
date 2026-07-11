import { useEffect, useState, useSyncExternalStore } from 'react';
import { modalStore } from '../bridge/store.js';
import { getInventory, getInvCategory, g } from '../bridge/globals.js';
import { saveInventorySingle, saveInventoryBulk } from '../actions/inventoryActions.js';
import { BulkGrid, INV_BULK_FIELDS } from './BulkGrid.jsx';
import { SideEntryPanel } from './SideEntryPanel.jsx';

const CATEGORIES = ['완제품', '생산부품', '사무비품'];
const TYPES = ['자재', '반제품', '완제품', '비품', '소모품', '기타'];
const UNITS = ['EA', '대', 'SET', 'kg', 'M', 'L', 'BOX', 'ton'];

function defaultType(cat) {
  return cat === '완제품' ? '완제품' : cat === '사무비품' ? '소모품' : '자재';
}
function blankForm(cat) {
  return { id: g('nextCode', 'INV', getInventory()), name: '', category: cat, type: defaultType(cat), unit: 'EA', qty: '0', minQty: '10', location: '', note: '' };
}
function formFromItem(i) {
  return { id: i.id, name: i.name, category: i.category || '생산부품', type: i.type, unit: i.unit || 'EA', qty: String(i.qty ?? 0), minQty: String(i.minQty ?? 0), location: i.location || '', note: i.note || '' };
}

function formForModal(modal) {
  const cat = getInvCategory();
  if (modal.mode !== 'edit') return blankForm(cat);
  const item = getInventory().find((x) => x.id === modal.id);
  return item ? formFromItem(item) : blankForm(cat);
}

function InventoryModalContent({ modal }) {
  const isEdit = modal.mode === 'edit';
  const [form, setForm] = useState(() => formForModal(modal));
  const [bulk, setBulk] = useState(() => !isEdit);
  const [bulkRows, setBulkRows] = useState([{}]);

  useEffect(() => {
    g('updateSelectionDetailPanelTop');
    g('initSelectionDetailPanelWidth');
  }, []);

  const close = () => modalStore.setState(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const onSave = () => {
    if (typeof globalThis.checkAdminAction === 'function' && !globalThis.checkAdminAction()) return;
    if (!isEdit && bulk) {
      const count = saveInventoryBulk({ rows: bulkRows });
      if (!count) return;
      g('renderInventory');
      g('showToast', '재고 품목 ' + count + '건이 등록되었습니다.');
      close();
      return;
    }
    const saved = saveInventorySingle({ editId: isEdit ? modal.id : null, form });
    if (!saved) return;
    g('renderInventory');
    g('showToast', isEdit ? '재고가 수정되었습니다.' : '재고가 등록되었습니다.');
    close();
  };

  return (
    <SideEntryPanel
      id="inv-modal"
      title={isEdit ? '재고 수정' : '재고 품목 등록'}
      icon={isEdit ? 'ti-edit' : 'ti-package'}
      onClose={close}
      dialogClassName="bulk-entry-dialog"
      style={{ maxWidth: 1040, width: '96%' }}
      actions={(
        <>
          <button type="button" className="btn" onClick={close}>취소</button>
          <button type="button" className="btn btn-primary" onClick={onSave}>
            <i className="ti ti-check" />{isEdit ? '수정' : '저장'}
          </button>
        </>
      )}
    >
      {!isEdit && (
        <div className="entry-mode-switch">
          <button type="button" className={!bulk ? 'active' : ''} onClick={() => setBulk(false)}>단건 입력</button>
          <button type="button" className={bulk ? 'active' : ''} onClick={() => setBulk(true)}>일괄 입력</button>
        </div>
      )}

      {(isEdit || !bulk) && (
        <div className="fg fg4" style={{ gap: 10, marginBottom: 14 }}>
          <div className="ff"><label htmlFor="inva-id">재고 코드</label><input id="inva-id" value={form.id} readOnly /></div>
          <div className="ff" style={{ gridColumn: 'span 3' }}><label htmlFor="inva-name">품목명 *</label><input id="inva-name" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="예: LM 가이드 레일" /></div>
          <div className="ff"><label htmlFor="inva-category">재고 구분 *</label><select id="inva-category" value={form.category} onChange={(event) => set('category', event.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
          <div className="ff"><label htmlFor="inva-type">세부 유형</label><select id="inva-type" value={form.type} onChange={(event) => set('type', event.target.value)}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="ff"><label htmlFor="inva-unit">단위 *</label><select id="inva-unit" value={form.unit} onChange={(event) => set('unit', event.target.value)}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></div>
          <div className="ff"><label htmlFor="inva-qty">현재고 수량 *</label><input id="inva-qty" type="number" min="0" value={form.qty} onChange={(event) => set('qty', event.target.value)} /></div>
          <div className="ff"><label htmlFor="inva-minQty">최소 안전 재고 *</label><input id="inva-minQty" type="number" min="0" value={form.minQty} onChange={(event) => set('minQty', event.target.value)} /></div>
          <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="inva-location">보관 위치</label><input id="inva-location" value={form.location} onChange={(event) => set('location', event.target.value)} placeholder="예: A-4 선반" /></div>
          <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="inva-note">참고사항</label><input id="inva-note" value={form.note} onChange={(event) => set('note', event.target.value)} placeholder="기타 메모" /></div>
        </div>
      )}

      {!isEdit && bulk && <BulkGrid fields={INV_BULK_FIELDS} rows={bulkRows} onChange={setBulkRows} />}
    </SideEntryPanel>
  );
}

export function InventoryModal() {
  const modal = useSyncExternalStore(modalStore.subscribe, modalStore.getState, modalStore.getState);
  if (!modal) return null;
  return <InventoryModalContent key={modal.mode + ':' + (modal.id ?? '')} modal={modal} />;
}