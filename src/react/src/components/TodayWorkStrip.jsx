import { useSyncExternalStore } from 'react';
import { getInventory, getInvCategory, getMaterials, g } from '../bridge/globals.js';
import { inventoryStore, materialsStore } from '../bridge/store.js';

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function visibleMaterials() {
  return getMaterials().filter((item) => g('canViewRecord', item, 'material') !== false);
}

function visibleInventory() {
  return getInventory().filter((item) => g('canViewRecord', item, 'inventory') !== false);
}

function isIncomplete(material) {
  return material.status !== '입고완료';
}

export function materialWorkCounts(todayKey = localDateKey()) {
  const materials = visibleMaterials();
  return {
    dueToday: materials.filter((item) => isIncomplete(item) && item.expectedDate === todayKey).length,
    overdue: materials.filter((item) => isIncomplete(item) && (item.status === '지연' || (item.expectedDate && item.expectedDate < todayKey))).length,
    waiting: materials.filter((item) => item.status === '발주전').length,
    lowStock: visibleInventory().filter((item) => Number(item.qty) < Number(item.minQty || 0)).length
  };
}

export function inventoryWorkCounts(todayKey = localDateKey()) {
  const category = getInvCategory();
  const inventory = visibleInventory().filter((item) => (item.category || '생산부품') === category);
  const materials = visibleMaterials();
  return {
    lowStock: inventory.filter((item) => Number(item.qty) < Number(item.minQty || 0)).length,
    emptyStock: inventory.filter((item) => Number(item.qty) === 0).length,
    dueToday: materials.filter((item) => isIncomplete(item) && item.expectedDate === todayKey).length,
    overdue: materials.filter((item) => isIncomplete(item) && (item.status === '지연' || (item.expectedDate && item.expectedDate < todayKey))).length
  };
}

function setSelectValue(id, value) {
  const select = document.getElementById(id);
  if (select) select.value = value;
}

function focusList(selector) {
  globalThis.requestAnimationFrame?.(() => document.querySelector(selector)?.scrollIntoView?.({ block: 'start' }));
}

export function clearModernMaterialsWorkFilter() {
  globalThis.__modernMaterialsWorkFilter = '';
  materialsStore.emit();
}

export function clearModernInventoryWorkFilter() {
  globalThis.__modernInventoryWorkFilter = '';
  inventoryStore.emit();
}

function applyMaterialsFilter(key) {
  globalThis.__modernMaterialsWorkFilter = key;
  if (key === 'waiting') setSelectValue('mat-fs', '발주전');
  else setSelectValue('mat-fs', '');
  materialsStore.emit();
  focusList('#materials-react-root');
}

function applyInventoryFilter(key) {
  globalThis.__modernInventoryWorkFilter = key;
  if (key === 'lowStock') setSelectValue('inv-filter-status', 'low');
  else setSelectValue('inv-filter-status', '');
  inventoryStore.emit();
  focusList('#inventory-table');
}

function openLinkedInventory() {
  globalThis.__modernInventoryWorkFilter = 'lowStock';
  setSelectValue('inv-filter-status', 'low');
  g('goInventory', 'parts', null);
  inventoryStore.emit();
}

function openLinkedMaterials(key) {
  globalThis.__modernMaterialsWorkFilter = key;
  setSelectValue('mat-fs', '');
  g('go', 'materials', null);
  materialsStore.emit();
}

function QueueButton({ icon, label, count, tone, active, onClick }) {
  return (
    <button
      type="button"
      className={`modern-work-queue-item is-${tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <i className={`ti ${icon}`} aria-hidden="true" />
      <span>{label}</span>
      <strong>{count}건</strong>
    </button>
  );
}

export function TodayWorkStrip({ domain, todayKey = localDateKey() }) {
  useSyncExternalStore(materialsStore.subscribe, materialsStore.getVersion, materialsStore.getVersion);
  useSyncExternalStore(inventoryStore.subscribe, inventoryStore.getVersion, inventoryStore.getVersion);

  const materialCounts = materialWorkCounts(todayKey);
  const inventoryCounts = inventoryWorkCounts(todayKey);
  const materialActive = globalThis.__modernMaterialsWorkFilter || '';
  const inventoryActive = globalThis.__modernInventoryWorkFilter || '';
  const items = domain === 'inventory'
    ? [
        { key: 'lowStock', icon: 'ti-alert-triangle', label: '안전재고 미달', count: inventoryCounts.lowStock, tone: 'danger', onClick: () => applyInventoryFilter('lowStock') },
        { key: 'emptyStock', icon: 'ti-package-off', label: '현재고 0', count: inventoryCounts.emptyStock, tone: 'warning', onClick: () => applyInventoryFilter('emptyStock') },
        { key: 'dueToday', icon: 'ti-calendar-due', label: '오늘 입고 예정', count: inventoryCounts.dueToday, tone: 'info', onClick: () => openLinkedMaterials('dueToday') },
        { key: 'overdue', icon: 'ti-clock-exclamation', label: '지연 발주', count: inventoryCounts.overdue, tone: 'danger', onClick: () => openLinkedMaterials('overdue') }
      ]
    : [
        { key: 'dueToday', icon: 'ti-calendar-due', label: '오늘 입고 예정', count: materialCounts.dueToday, tone: 'info', onClick: () => applyMaterialsFilter('dueToday') },
        { key: 'overdue', icon: 'ti-clock-exclamation', label: '입고 지연', count: materialCounts.overdue, tone: 'danger', onClick: () => applyMaterialsFilter('overdue') },
        { key: 'waiting', icon: 'ti-circle-dashed', label: '발주 전', count: materialCounts.waiting, tone: 'neutral', onClick: () => applyMaterialsFilter('waiting') },
        { key: 'lowStock', icon: 'ti-package-off', label: '안전재고 미달', count: materialCounts.lowStock, tone: 'warning', onClick: openLinkedInventory }
      ];

  return (
    <section className="modern-work-queue" aria-label="오늘 처리 업무">
      <div className="modern-work-queue-title">
        <span>오늘 처리</span>
        <small>{todayKey}</small>
      </div>
      <div className="modern-work-queue-items">
        {items.map(({ key, ...item }) => (
          <QueueButton
            key={key}
            {...item}
            active={(domain === 'inventory' ? inventoryActive : materialActive) === key}
          />
        ))}
      </div>
    </section>
  );
}
