// 일괄입력 그리드 상태 변형 헬퍼(순수 함수). 컴포넌트는 rows/onChange 로 제어된다.
export function setCell(rows, rowIndex, field, value) {
  return rows.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r));
}

export function addRow(rows, defaults = {}) {
  return rows.concat([{ ...defaults }]);
}

export function removeRow(rows, rowIndex) {
  if (rows.length <= 1) return [{}];
  return rows.filter((_, i) => i !== rowIndex);
}

// 붙여넣기: 시작 셀(rowIndex, colIndex) 기준으로 탭/개행 텍스트를 격자에 채운다.
export function applyPaste(rows, fields, startRow, startCol, text) {
  const matrix = text.replace(/\r/g, '').split('\n').filter((l) => l.length).map((l) => l.split('\t'));
  let next = rows.map((r) => ({ ...r }));
  matrix.forEach((cells, r) => {
    const ri = startRow + r;
    while (next.length <= ri) next.push({});
    cells.forEach((cell, c) => {
      const field = fields[startCol + c];
      if (field) next[ri][field.name] = String(cell || '').trim();
    });
  });
  return next;
}
// 세로 라벨 배치: 줄바꿈은 필드 방향, 탭은 항목 방향으로 채운다.
export function applyTransposedPaste(rows, fields, startItem, startField, text) {
  const matrix = text.replace(/\r/g, '').split('\n').filter((line) => line.length).map((line) => line.split('\t'));
  const next = rows.map((row) => ({ ...row }));
  matrix.forEach((cells, fieldOffset) => {
    const field = fields[startField + fieldOffset];
    if (!field) return;
    cells.forEach((cell, itemOffset) => {
      const itemIndex = startItem + itemOffset;
      while (next.length <= itemIndex) next.push({});
      next[itemIndex][field.name] = String(cell || '').trim();
    });
  });
  return next;
}