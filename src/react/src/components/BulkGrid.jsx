import { setCell, addRow, removeRow, applyTransposedPaste } from '../hooks/useBulkGrid.js';
import { getInvCategory } from '../bridge/globals.js';

// inventory.js 의 registerBulkEntryTable('inv', ...) 필드 스키마와 동일.
export const INV_BULK_FIELDS = [
  { name: 'name', label: '품목명', type: 'text', placeholder: '품목명', required: true },
  { name: 'category', label: '재고 구분', type: 'select', options: ['완제품', '생산부품', '사무비품'], default: getInvCategory },
  { name: 'type', label: '세부 유형', type: 'select', options: ['자재', '반제품', '완제품', '비품', '소모품', '기타'], default: () => { const c = getInvCategory(); return c === '완제품' ? '완제품' : c === '사무비품' ? '소모품' : '자재'; } },
  { name: 'qty', label: '현재고', type: 'number', min: 0, step: 1, default: '0', required: true },
  { name: 'unit', label: '단위', type: 'select', options: ['EA', '대', 'SET', 'kg', 'M', 'L', 'BOX', 'ton'], default: 'EA' },
  { name: 'minQty', label: '안전재고', type: 'number', min: 0, step: 1, default: '10' },
  { name: 'location', label: '보관 위치', type: 'text', placeholder: '예: A-4 선반' },
  { name: 'note', label: '참고', type: 'text', placeholder: '비고' }
];

function cellValue(row, field) {
  const value = row[field.name];
  return value == null ? (typeof field.default === 'function' ? field.default() : (field.default ?? '')) : value;
}

function duplicateItem(rows, index) {
  const next = rows.slice();
  next.splice(index + 1, 0, { ...(rows[index] || {}) });
  return next;
}

export function BulkGrid({ fields, rows, onChange, title = '재고 품목 일괄 입력', helper = '좌측 라벨 고정 · 항목은 우측으로 추가' }) {
  const handlePaste = (event, itemIndex, fieldIndex) => {
    const text = event.clipboardData?.getData('text') || '';
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    onChange(applyTransposedPaste(rows, fields, itemIndex, fieldIndex, text));
  };

  const renderControl = (field, fieldIndex, row, itemIndex) => field.type === 'select' ? (
    <select
      data-field={field.name}
      data-item-index={itemIndex}
      value={String(cellValue(row, field))}
      onChange={(event) => onChange(setCell(rows, itemIndex, field.name, event.target.value))}
    >
      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  ) : (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      data-field={field.name}
      data-item-index={itemIndex}
      placeholder={field.placeholder || ''}
      min={field.min}
      step={field.step}
      value={String(cellValue(row, field))}
      onChange={(event) => onChange(setCell(rows, itemIndex, field.name, event.target.value))}
      onPaste={(event) => handlePaste(event, itemIndex, fieldIndex)}
    />
  );

  return (
    <div className="batch-entry-grid batch-entry-shared-grid">
      <div className="batch-entry-label">
        <span><i className="ti ti-table" />{title}</span>
        <small>{helper}</small>
      </div>
      <table className="batch-entry-shared-label-table">
        <thead>
          <tr>
            <th className="batch-entry-shared-label-col">항목</th>
            {rows.map((row, itemIndex) => (
              <th className="batch-entry-shared-item-head" key={itemIndex}>
                <div className="batch-entry-shared-item-head-inner">
                  <span>항목 {itemIndex + 1}</span>
                  <span className="batch-entry-shared-item-actions">
                    <button type="button" title="항목 복제" onClick={() => onChange(duplicateItem(rows, itemIndex))}>
                      <i className="ti ti-copy" />
                    </button>
                    <button type="button" title="항목 삭제" onClick={() => onChange(removeRow(rows, itemIndex))}>
                      <i className="ti ti-trash" />
                    </button>
                  </span>
                </div>
              </th>
            ))}
            <th className="batch-entry-shared-add-col">
              <button type="button" className="doc-add-row" title="항목 추가" onClick={() => onChange(addRow(rows))}>
                <i className="ti ti-plus" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody data-bulk-key="inv-react">
          {fields.map((field, fieldIndex) => (
            <tr key={field.name} data-field={field.name}>
              <th className="batch-entry-shared-label-cell">
                {field.label}{field.required ? <span> *</span> : null}
              </th>
              {rows.map((row, itemIndex) => (
                <td className={'batch-entry-shared-value batch-entry-field-' + field.name} key={itemIndex} data-item-index={itemIndex}>
                  {renderControl(field, fieldIndex, row, itemIndex)}
                </td>
              ))}
              <td className="batch-entry-shared-add-spacer" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}