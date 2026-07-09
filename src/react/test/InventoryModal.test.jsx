import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryModal } from '../src/components/InventoryModal.jsx';
import { modalStore, inventoryStore } from '../src/bridge/store.js';

function installGlobals() {
  globalThis.inventory = [{ id: 'INV-1', name: '레일', category: '생산부품', type: '자재', unit: 'EA', qty: 3, minQty: 5, location: 'A-1', note: '' }];
  globalThis.invCategory = '생산부품';
  globalThis.nextCode = () => 'INV-NEW';
  globalThis.stampRecordCreate = (r) => r;
  globalThis.stampRecordUpdate = (r) => r;
  globalThis.writeAuditLog = vi.fn();
  globalThis.saveStorage = vi.fn();
  globalThis.showToast = vi.fn();
  globalThis.requireRecordPermission = () => true;
  globalThis.requireCreateAction = () => true;
  globalThis._safeJsonClone = (v) => JSON.parse(JSON.stringify(v));
  globalThis.esc = (s) => String(s ?? '');
  globalThis.renderInventory = vi.fn();
}

describe('InventoryModal', () => {
  beforeEach(() => { installGlobals(); modalStore.setState(null); });

  it('modalStore 가 null 이면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<InventoryModal />);
    expect(container.querySelector('.dlg')).toBeFalsy();
  });

  it('add 모드에서 제목 "재고 품목 등록" 과 단건 폼을 연다', () => {
    render(<InventoryModal />);
    modalStore.setState({ mode: 'add' });
    expect(screen.getByText(/재고 품목 등록/)).toBeInTheDocument();
    // add 모드는 일괄 기본이지만 "단건 입력" 탭으로 전환 가능해야 한다
    fireEvent.click(screen.getByRole('button', { name: '단건 입력' }));
    expect(screen.getByLabelText(/품목명/)).toBeInTheDocument();
  });

  it('edit 모드에서 기존 값을 채우고 저장 시 renderInventory 를 호출한다', () => {
    render(<InventoryModal />);
    modalStore.setState({ mode: 'edit', id: 'INV-1' });
    const nameInput = screen.getByLabelText(/품목명/);
    expect(nameInput.value).toBe('레일');
    fireEvent.change(nameInput, { target: { value: '레일2' } });
    fireEvent.click(screen.getByRole('button', { name: /수정|저장/ }));
    expect(globalThis.inventory[0].name).toBe('레일2');
    expect(globalThis.renderInventory).toHaveBeenCalled();
    expect(modalStore.getState()).toBeNull();
  });

  it('취소 버튼은 저장 없이 모달을 닫는다', () => {
    render(<InventoryModal />);
    modalStore.setState({ mode: 'add' });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(modalStore.getState()).toBeNull();
    expect(globalThis.saveStorage).not.toHaveBeenCalled();
  });
});
