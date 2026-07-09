import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { modalStore } from '../bridge/store.js';
import { getInventory, getInvCategory, g } from '../bridge/globals.js';
import { saveInventorySingle, saveInventoryBulk } from '../actions/inventoryActions.js';
import { BulkGrid, INV_BULK_FIELDS } from './BulkGrid.jsx';

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

export function InventoryModal() {
  const [modal, setModal] = useState(modalStore.getState());
  // 스토어 변경을 구독한다. vanilla 코드가 modalStore.setState 를 호출하면
  // flushSync 로 즉시 DOM 에 반영해 모달이 동기적으로 열리도록 한다.
  useEffect(() => modalStore.subscribe(() => {
    const next = modalStore.getState();
    try { flushSync(() => setModal(next)); } catch { setModal(next); }
  }), []);

  const isEdit = modal?.mode === 'edit';
  const modalKey = modal ? `${modal.mode}:${modal.id ?? ''}` : null;
  const [loadedKey, setLoadedKey] = useState(null);
  const [form, setForm] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState([{}]);

  // 모달이 열리거나 대상이 바뀌면 렌더 도중 폼을 동기적으로 초기화한다.
  // (React 권장 "렌더 중 상태 조정" 패턴 — useEffect 지연 없이 즉시 반영)
  if (modalKey !== loadedKey) {
    if (!modal) {
      setForm(null);
      setBulk(false);
      setBulkRows([{}]);
    } else {
      const cat = getInvCategory();
      if (modal.mode === 'edit') {
        const item = getInventory().find((x) => x.id === modal.id);
        setForm(item ? formFromItem(item) : blankForm(cat));
        setBulk(false);
      } else {
        setForm(blankForm(cat));
        setBulk(true);
        setBulkRows([{}]);
      }
    }
    setLoadedKey(modalKey);
  }

  if (!modal || !form) return null;

  const close = () => modalStore.setState(null);
  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));

  const onSave = () => {
    if (typeof globalThis.checkAdminAction === 'function' && !globalThis.checkAdminAction()) return;
    if (!isEdit && bulk) {
      const n = saveInventoryBulk({ rows: bulkRows });
      if (!n) return;
      close();
      g('renderInventory');
      g('showToast', `재고 품목 ${n}건이 등록되었습니다.`);
      return;
    }
    const ok = saveInventorySingle({ editId: isEdit ? modal.id : null, form });
    if (!ok) return;
    close();
    g('renderInventory');
    g('showToast', isEdit ? '재고가 수정되었습니다.' : '재고가 등록되었습니다.');
  };

  return (
    <div className="overlay open" id="inv-modal">
      <div className="dlg bulk-entry-dialog" style={{ maxWidth: 1040, width: '96%' }}>
        <div className="dlg-title">
          <i className={'ti ' + (isEdit ? 'ti-edit' : 'ti-package')} />
          {isEdit ? '재고 수정' : '재고 품목 등록'}
        </div>

        {!isEdit && (
          <div className="entry-mode-switch">
            <button type="button" className={!bulk ? 'active' : ''} onClick={() => setBulk(false)}>단건 입력</button>
            <button type="button" className={bulk ? 'active' : ''} onClick={() => setBulk(true)}>일괄 입력</button>
          </div>
        )}

        {(isEdit || !bulk) && (
          <div className="fg fg4" style={{ gap: 10, marginBottom: 14 }}>
            <div className="ff"><label htmlFor="inva-id">재고 코드</label><input id="inva-id" value={form.id} readOnly /></div>
            <div className="ff" style={{ gridColumn: 'span 3' }}><label htmlFor="inva-name">품목명 *</label><input id="inva-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="예: LM 가이드 레일" /></div>
            <div className="ff"><label htmlFor="inva-category">재고 구분 *</label>
              <select id="inva-category" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="ff"><label htmlFor="inva-type">세부 유형</label>
              <select id="inva-type" value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="ff"><label htmlFor="inva-unit">단위 *</label>
              <select id="inva-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div className="ff"><label htmlFor="inva-qty">현재고 수량 *</label><input id="inva-qty" type="number" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} /></div>
            <div className="ff"><label htmlFor="inva-minQty">최소 안전 재고 *</label><input id="inva-minQty" type="number" min="0" value={form.minQty} onChange={(e) => set('minQty', e.target.value)} /></div>
            <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="inva-location">보관 위치</label><input id="inva-location" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="예: A-4 선반" /></div>
            <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="inva-note">참고사항</label><input id="inva-note" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="기타 메모" /></div>
          </div>
        )}

        {!isEdit && bulk && <BulkGrid fields={INV_BULK_FIELDS} rows={bulkRows} onChange={setBulkRows} />}

        <div className="dlg-actions">
          <button className="btn" onClick={close}>취소</button>
          <button className="btn btn-primary" onClick={onSave}>
            <i className="ti ti-check" />{isEdit ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
