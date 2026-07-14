import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialModal } from '../src/components/MaterialModal.jsx';
import { materialModalStore } from '../src/bridge/store.js';

function installGlobals() {
  globalThis.clients = [
    { id: 'C-1', name: '현대리바트' },
    { id: 'C-2', name: '한샘' }
  ];
  globalThis.products = [
    { id: 'P-1', clientId: 'C-1', name: '캐스터 하중 주행 시험기' },
    { id: 'P-2', clientId: 'C-2', name: '수납장 내구성 시험기', spec: 'HS-200' }
  ];
  globalThis.materials = [{
    id: 'MT-100', productId: 'P-1', name: '프로파일 케이스', spec: '40x40', supplier: '예주산업',
    unitPrice: 3300, qty: 2, unit: 'EA', status: '발주중', orderDate: '2026-07-10', expectedDate: '2026-07-20', note: '견적진행'
  }];
  globalThis.getMaterialsReactState = () => ({
    clients: globalThis.clients,
    products: globalThis.products,
    materials: globalThis.materials
  });
  globalThis.nextMaterialCode = () => 'MT-101';
  globalThis.today = () => '2026-07-11';
  globalThis.v = () => '';
  globalThis.updateSelectionDetailPanelTop = vi.fn();
  globalThis.initSelectionDetailPanelWidth = vi.fn();
  globalThis.startSelectionDetailResize = vi.fn();
  globalThis.saveMaterialFromReact = vi.fn(() => true);
  globalThis.ensureClientForReact = (id) => globalThis.clients.find((client) => client.id === id);
  globalThis.getClientSearchCandidatesReact = (query) => globalThis.clients
    .filter((client) => client.name.includes(query))
    .map((client) => ({ ...client, meta: client.id }));
  globalThis.getProductSearchCandidatesReact = (query, clientId) => globalThis.products
    .filter((product) => (!clientId || product.clientId === clientId) && product.name.includes(query))
    .map((product) => ({ ...product, meta: product.id }));
  globalThis.openClientPicker = vi.fn();
}

describe('MaterialModal', () => {
  beforeEach(() => {
    installGlobals();
    materialModalStore.setState(null);
  });

  it('다중 입력 행을 각각 저장 어댑터에 전달한다', () => {
    const { container } = render(<MaterialModal />);
    act(() => materialModalStore.setState({ mode: 'add' }));

    expect(screen.getByText('자재 수급/발주 등록')).toBeInTheDocument();
    expect(screen.getByText('자재 발주 일괄 입력')).toBeInTheDocument();
    fireEvent.change(container.querySelector('[data-field="name"][data-item-index="0"]'), { target: { value: '자재 A' } });
    fireEvent.click(screen.getByTitle('항목 추가'));
    fireEvent.change(container.querySelector('[data-field="name"][data-item-index="1"]'), { target: { value: '자재 B' } });
    fireEvent.click(screen.getByRole('button', { name: '일괄 등록' }));

    expect(globalThis.saveMaterialFromReact).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'add',
      bulk: true,
      rows: [expect.objectContaining({ name: '자재 A' }), expect.objectContaining({ name: '자재 B' })]
    }));
    expect(materialModalStore.getState()).toBeNull();
  });

  it('고객사와 품목 입력 검색 및 돋보기 피커를 제공한다', () => {
    render(<MaterialModal />);
    act(() => materialModalStore.setState({ mode: 'add' }));

    const clientSearch = screen.getByRole('combobox', { name: '연결 고객사 *' });
    expect(clientSearch).toHaveValue('현대리바트');
    fireEvent.click(screen.getByRole('button', { name: '고객사 찾기' }));
    expect(globalThis.openClientPicker).toHaveBeenCalled();
    expect(clientSearch).toHaveAttribute('aria-expanded', 'false');

    fireEvent.change(clientSearch, { target: { value: '한샘' } });
    fireEvent.click(screen.getByRole('option', { name: /한샘/ }));

    const productSearch = screen.getByRole('combobox', { name: '해당 품목 제품 *' });
    expect(screen.getByRole('button', { name: '제품 찾기' })).toBeInTheDocument();
    fireEvent.change(productSearch, { target: { value: '수납장' } });
    fireEvent.click(screen.getByRole('option', { name: /수납장 내구성 시험기/ }));
    fireEvent.click(screen.getByRole('button', { name: '일괄 등록' }));

    expect(globalThis.saveMaterialFromReact).toHaveBeenCalledWith(expect.objectContaining({
      form: expect.objectContaining({ clientId: 'C-2', productId: 'P-2' })
    }));
  });
  it('수정 모드에서 기존 값을 채우고 변경값을 저장한다', () => {
    render(<MaterialModal />);
    act(() => materialModalStore.setState({ mode: 'edit', id: 'MT-100' }));

    expect(screen.getByLabelText('자재명 *')).toHaveValue('프로파일 케이스');
    expect(screen.getByLabelText('구매 공급처 *')).toHaveValue('예주산업');
    fireEvent.change(screen.getByLabelText('자재명 *'), { target: { value: '프로파일 케이스 개선형' } });
    fireEvent.click(screen.getByRole('button', { name: '수정' }));

    expect(globalThis.saveMaterialFromReact).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'edit',
      editId: 'MT-100',
      bulk: false,
      form: expect.objectContaining({ name: '프로파일 케이스 개선형', productId: 'P-1' })
    }));
  });
});