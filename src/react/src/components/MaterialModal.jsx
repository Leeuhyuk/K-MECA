import { useEffect, useState, useSyncExternalStore } from 'react';
import { materialModalStore } from '../bridge/store.js';
import { getClients, getMaterials, getProducts, g } from '../bridge/globals.js';
import { BulkGrid } from './BulkGrid.jsx';
import { SearchPickerField } from './SearchPickerField.jsx';
import { SideEntryPanel } from './SideEntryPanel.jsx';

const UNITS = ['EA', '대', 'SET', 'kg', 'M', 'L', 'BOX', 'ton'];
const STATUSES = ['발주전', '발주중', '입고완료', '지연'];
export const MATERIAL_BULK_FIELDS = [
  { name: 'name', label: '자재명', type: 'text', placeholder: '자재명', required: true },
  { name: 'spec', label: '규격', type: 'text', placeholder: '규격/사양' },
  { name: 'supplier', label: '공급처', type: 'text', placeholder: '공급처' },
  { name: 'qty', label: '수량', type: 'number', min: 0, step: '0.01', default: '1', required: true },
  { name: 'unit', label: '단위', type: 'select', default: 'EA', options: UNITS },
  { name: 'unitPrice', label: '단가', type: 'number', min: 0, step: 1, placeholder: '0' },
  { name: 'expectedDate', label: '입고예정일', type: 'date' },
  { name: 'status', label: '상태', type: 'select', default: '발주전', options: STATUSES },
  { name: 'note', label: '참고', type: 'text', placeholder: '비고' }
];

function todayValue() {
  return g('today') || new Date().toISOString().slice(0, 10);
}

function initialState(modal) {
  const materials = getMaterials();
  const clients = getClients();
  const products = getProducts();
  const source = modal.id ? materials.find((item) => item.id === modal.id) : null;
  const sourceProduct = source ? products.find((product) => product.id === source.productId) : null;
  const filterClient = g('v', 'mat-fc') || '';
  const clientId = sourceProduct?.clientId || filterClient || clients[0]?.id || '';
  const eligibleProducts = products.filter((product) => !clientId || product.clientId === clientId);
  const filteredProduct = g('v', 'mat-fp') || '';
  const productId = source?.productId || (eligibleProducts.some((product) => product.id === filteredProduct) ? filteredProduct : '');
  return {
    id: modal.mode === 'edit' ? source?.id || '' : g('nextMaterialCode') || '',
    clientId,
    productId,
    orderDate: modal.mode === 'edit' ? source?.orderDate || todayValue() : todayValue(),
    name: source?.name || '',
    spec: source?.spec || '',
    supplier: source?.supplier || '',
    unitPrice: String(source?.unitPrice ?? 0),
    qty: String(source?.qty ?? 1),
    unit: source?.unit || 'EA',
    status: modal.mode === 'clone' ? '발주전' : source?.status || '발주전',
    expectedDate: source?.expectedDate || '',
    note: source?.note || ''
  };
}

function fallbackMatches(items, query, meta) {
  const normalized = String(query || '').trim().toLowerCase();
  return items
    .filter((item) => !normalized || [item.name, item.id, item.spec].some((value) => String(value || '').toLowerCase().includes(normalized)))
    .slice(0, 8)
    .map((item) => ({ ...item, meta: meta(item) }));
}

function MaterialModalContent({ modal }) {
  const isEdit = modal.mode === 'edit';
  const isClone = modal.mode === 'clone';
  const [form, setForm] = useState(() => initialState(modal));
  const [bulk, setBulk] = useState(() => !isEdit && !isClone);
  const [bulkRows, setBulkRows] = useState([{}]);
  const clients = getClients();
  const products = getProducts();
  const eligibleProducts = products.filter((product) => !form.clientId || product.clientId === form.clientId);

  useEffect(() => {
    g('updateSelectionDetailPanelTop');
    g('initSelectionDetailPanelWidth');
  }, []);

  const close = () => materialModalStore.setState(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeClient = (clientId) => {
    setForm((current) => current.clientId === clientId
      ? current
      : { ...current, clientId, productId: '' });
  };
  const selectClient = (clientId) => {
    if (!clientId) {
      changeClient('');
      return;
    }
    const ensured = g('ensureClientForReact', clientId);
    changeClient(ensured?.id || clientId);
  };
  const findClients = (query) => {
    const matches = g('getClientSearchCandidatesReact', query);
    if (Array.isArray(matches)) return matches;
    return fallbackMatches(clients, query, (client) => `${client.id} · 담당 ${client.manager || '미지정'} · ${client.tel || client.email || '연락처 미지정'}`);
  };
  const findProducts = (query) => {
    const matches = g('getProductSearchCandidatesReact', query, form.clientId);
    if (Array.isArray(matches)) return matches;
    return fallbackMatches(eligibleProducts, query, (product) => `${product.id}${product.spec ? ' · ' + product.spec : ''}`);
  };
  const openClientSearch = (query) => {
    g('openClientPicker', (client) => selectClient(client.id), {
      mode: 'client-field',
      initialQuery: query
    });
    return false;
  };
  const save = () => {
    const saved = g('saveMaterialFromReact', {
      mode: modal.mode,
      editId: isEdit ? modal.id : null,
      bulk: !isEdit && bulk,
      form,
      rows: bulkRows
    });
    if (saved) close();
  };
  const title = isEdit ? '자재 발주 수정' : isClone ? '자재 발주 복제 등록' : '자재 수급/발주 등록';

  return (
    <SideEntryPanel
      id="mat-modal-react"
      title={title}
      icon={isEdit ? 'ti-edit' : isClone ? 'ti-copy' : 'ti-package-import'}
      onClose={close}
      dialogClassName="bulk-entry-dialog mat-entry-dialog"
      style={{ maxWidth: 1040, width: '96%' }}
      actions={(
        <>
          <button type="button" className="btn" onClick={close}>취소</button>
          <button type="button" className="btn btn-primary" onClick={save}>
            <i className="ti ti-check" />{isEdit ? '수정' : bulk ? '일괄 등록' : '등록'}
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
      <div className="fg fg4" style={{ gap: 10, marginBottom: 10 }}>
        <div className="ff"><label htmlFor="matr-id">자재 코드</label><input id="matr-id" value={form.id} readOnly /></div>
        <SearchPickerField
          id="matr-client-search"
          label="연결 고객사"
          required
          value={form.clientId}
          items={clients}
          placeholder="고객사명 검색"
          searchTitle="고객사 찾기"
          onSelect={selectClient}
          getMatches={findClients}
          onOpenPicker={openClientSearch}
        />
        <SearchPickerField
          key={'product-client-' + form.clientId}
          id="matr-product-search"
          label="해당 품목 제품"
          required
          value={form.productId}
          items={eligibleProducts}
          placeholder="제품명 검색"
          searchTitle="제품 찾기"
          onSelect={(productId) => set('productId', productId)}
          getMatches={findProducts}
          className="material-product-search-field"
        />
        <div className="ff"><label htmlFor="matr-orderDate">발주 일자</label><input id="matr-orderDate" type="date" value={form.orderDate} onChange={(event) => set('orderDate', event.target.value)} /></div>
      </div>

      {(isEdit || !bulk) && (
        <div className="fg fg4" style={{ gap: 10, marginBottom: 14 }}>
          <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="matr-name">자재명 *</label><input id="matr-name" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="예: 서보모터용 하우징" /></div>
          <div className="ff"><label htmlFor="matr-spec">규격</label><input id="matr-spec" value={form.spec} onChange={(event) => set('spec', event.target.value)} placeholder="예: SFU1605" /></div>
          <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="matr-supplier">구매 공급처 *</label><input id="matr-supplier" value={form.supplier} onChange={(event) => set('supplier', event.target.value)} placeholder="공급 협력사명" /></div>
          <div className="ff"><label htmlFor="matr-price">매입 단가 (원)</label><input id="matr-price" type="number" min="0" value={form.unitPrice} onChange={(event) => set('unitPrice', event.target.value)} /></div>
          <div className="ff"><label htmlFor="matr-qty">수량</label><input id="matr-qty" type="number" min="0" value={form.qty} onChange={(event) => set('qty', event.target.value)} /></div>
          <div className="ff"><label htmlFor="matr-unit">단위</label><select id="matr-unit" value={form.unit} onChange={(event) => set('unit', event.target.value)}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></div>
          <div className="ff"><label htmlFor="matr-status">입고 상황</label><select id="matr-status" value={form.status} onChange={(event) => set('status', event.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>
          <div className="ff"><label htmlFor="matr-expectedDate">입고 예정일</label><input id="matr-expectedDate" type="date" value={form.expectedDate} onChange={(event) => set('expectedDate', event.target.value)} /></div>
          <div className="ff" style={{ gridColumn: 'span 2' }}><label htmlFor="matr-note">참고사항</label><input id="matr-note" value={form.note} onChange={(event) => set('note', event.target.value)} placeholder="가공 도면 유무 등" /></div>
        </div>
      )}

      {!isEdit && bulk && (
        <BulkGrid
          fields={MATERIAL_BULK_FIELDS}
          rows={bulkRows}
          onChange={setBulkRows}
          title="자재 발주 일괄 입력"
        />
      )}
    </SideEntryPanel>
  );
}

export function MaterialModal() {
  const modal = useSyncExternalStore(materialModalStore.subscribe, materialModalStore.getState, materialModalStore.getState);
  if (!modal) return null;
  return <MaterialModalContent key={modal.mode + ':' + (modal.id || '')} modal={modal} />;
}