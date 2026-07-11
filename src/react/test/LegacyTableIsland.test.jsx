import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/bridge/store.js';
import { LegacyTableIsland } from '../src/components/LegacyTableIsland.jsx';

describe('LegacyTableIsland', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="legacy-table"><input id="legacy-field" value="원본"><table>
      <thead><tr><th><input type="checkbox" title="전체 선택"></th><th>이름</th><th>상태</th></tr></thead>
      <tbody>
        <tr onclick="event.stopPropagation()"><td><input type="checkbox" data-bid="A-1"></td><td>첫 항목</td><td><select><option>대기</option></select></td></tr>
        <tr><td><input type="checkbox" data-bid="A-2"></td><td>둘째 항목</td><td><button type="button">수정</button></td></tr>
      </tbody>
    </table></div>`;
    globalThis.setBulkSelectionFromReact = vi.fn();
    globalThis.updateSelectionDetailPanelFromReactDomain = vi.fn();
    globalThis.releaseSelectionDetailNavigationSuppress = vi.fn();
  });

  afterEach(() => {
    delete globalThis.setBulkSelectionFromReact;
    delete globalThis.updateSelectionDetailPanelFromReactDomain;
    delete globalThis.releaseSelectionDetailNavigationSuppress;
    document.body.innerHTML = '';
  });

  it('renders the legacy table through React and manages row selection', () => {
    const store = createStore();
    const { container } = render(
      <LegacyTableIsland domainKey="test-domain" entityType="test" sourceSelector="#legacy-table" store={store} />
    );

    const nameCell = container.querySelector('tbody tr:first-child td:nth-child(2)');
    expect(nameCell).toHaveTextContent('첫 항목');
    const row = nameCell.closest('tr');
    fireEvent.click(nameCell);

    expect(row).toHaveClass('table-row-selected');
    expect(row.querySelector('input')).toBeChecked();
    expect(globalThis.setBulkSelectionFromReact).toHaveBeenLastCalledWith('test-domain', ['A-1']);
  });

  it('mirrors visible form values back to the legacy source form', () => {
    const store = createStore();
    const { container } = render(
      <LegacyTableIsland domainKey="test-domain-form" entityType="test" sourceSelector="#legacy-table" store={store} />
    );

    const visibleInput = container.querySelector('#legacy-field');
    fireEvent.input(visibleInput, { target: { value: 'React 입력' } });
    expect(document.querySelector('#legacy-table #legacy-field')).toHaveValue('React 입력');
  });

  it('selects all visible rows and leaves embedded controls interactive', () => {
    const store = createStore();
    const { container } = render(
      <LegacyTableIsland domainKey="test-domain-all" entityType="test" sourceSelector="#legacy-table" store={store} />
    );

    const all = container.querySelector('thead input[type="checkbox"]');
    fireEvent.click(all);
    expect(Array.from(container.querySelectorAll('tbody input[type="checkbox"]'))).toEqual([
      expect.objectContaining({ checked: true }),
      expect.objectContaining({ checked: true })
    ]);

    fireEvent.click(container.querySelector('button'));
    expect(globalThis.setBulkSelectionFromReact).toHaveBeenLastCalledWith('test-domain-all', ['A-1', 'A-2']);
  });
});