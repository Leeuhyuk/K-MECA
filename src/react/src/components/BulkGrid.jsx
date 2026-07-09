import { setCell, addRow, removeRow, applyPaste } from '../hooks/useBulkGrid.js';

// inventory.js 의 registerBulkEntryTable('inv', ...) 필드 스키마와 동일.
export const INV_BULK_FIELDS = [
  { name: 'name', label: '품목명', type: 'text', placeholder: '품목명', required: true },
  { name: 'category', label: '재고 구분', type: 'select', options: ['완제품', '생산부품', '사무비품'], default: '생산부품' },
  { name: 'type', label: '세부 유형', type: 'select', options: ['자재', '반제품', '완제품', '비품', '소모품', '기타'], default: '자재' },
  { name: 'qty', label: '현재고', type: 'number', min: 0, step: 1, default: '0', required: true },
  { name: 'unit', label: '단위', type: 'select', options: ['EA', '대', 'SET', 'kg', 'M', 'L', 'BOX', 'ton'], default: 'EA' },
  { name: 'minQty', label: '안전재고', type: 'number', min: 0, step: 1, default: '10' },
  { name: 'location', label: '보관 위치', type: 'text', placeholder: '예: A-4 선반' },
  { name: 'note', label: '참고', type: 'text', placeholder: '비고' }
];

function cellValue(row, field) {
  const v = row[field.name];
  return v == null ? (typeof field.default === 'function' ? field.default() : (field.default ?? '')) : v;
}

export function BulkGrid({ fields, rows, onChange }) {
  const handlePaste = (e, rowIndex, colIndex) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    onChange(applyPaste(rows, fields, rowIndex, colIndex, text));
  };

  return (
    <div className="batch-entry-grid">
      <div className="batch-entry-label"><i className="ti ti-table" />재고 품목 일괄 입력</div>
      <table className="batch-entry-sized-table">
        <thead>
          <tr>
            {fields.map((f) => <th key={f.name}>{f.label}{f.required ? <span className="req-mark"> *</span> : null}</th>)}
            <th />
          </tr>
        </thead>
        <tbody data-bulk-key="inv-react">
          {rows.map((row, ri) => (
            <tr key={ri}>
              {fields.map((f, ci) => (
                <td key={f.name}>
                  {f.type === 'select' ? (
                    <select
                      data-field={f.name}
                      value={String(cellValue(row, f))}
                      onChange={(e) => onChange(setCell(rows, ri, f.name, e.target.value))}
                    >
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      data-field={f.name}
                      placeholder={f.placeholder || ''}
                      min={f.min}
                      step={f.step}
                      value={String(cellValue(row, f))}
                      onChange={(e) => onChange(setCell(rows, ri, f.name, e.target.value))}
                      onPaste={(e) => handlePaste(e, ri, ci)}
                    />
                  )}
                </td>
              ))}
              <td>
                <button type="button" className="doc-add-row" title="행 삭제" onClick={() => onChange(removeRow(rows, ri))}>
                  <i className="ti ti-trash" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="doc-add-row" title="행 추가" onClick={() => onChange(addRow(rows))}>
        <i className="ti ti-plus" /> 행 추가
      </button>
    </div>
  );
}
