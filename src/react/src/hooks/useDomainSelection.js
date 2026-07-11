import { useEffect, useState, useSyncExternalStore } from 'react';
import { g } from '../bridge/globals.js';

const clearers = new Map();
const selections = new Map();

function installSelectionBridge() {
  globalThis.clearReactDomainSelection = (key) => clearers.get(key)?.();
  globalThis.getReactDomainSelectedIds = (key) => Array.from(selections.get(key) || []);
}

export function useDomainSelection({ domainKey, entityType, store }) {
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    setSelectedIds((current) => current.size ? new Set() : current);
  }, [version]);

  useEffect(() => {
    selections.set(domainKey, selectedIds);
    g('setBulkSelectionFromReact', domainKey, Array.from(selectedIds));
    g('updateSelectionDetailPanelFromReactDomain', domainKey, entityType, Array.from(selectedIds));
  }, [domainKey, entityType, selectedIds]);

  useEffect(() => {
    installSelectionBridge();
    const clear = () => setSelectedIds(new Set());
    clearers.set(domainKey, clear);
    return () => {
      if (clearers.get(domainKey) === clear) clearers.delete(domainKey);
      selections.delete(domainKey);
      g('setBulkSelectionFromReact', domainKey, []);
      g('updateSelectionDetailPanelFromReactDomain', domainKey, entityType, []);
    };
  }, [domainKey, entityType]);

  const toggleRow = (id) => {
    g('releaseSelectionDetailNavigationSuppress');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids) => {
    g('releaseSelectionDetailNavigationSuppress');
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  return { selectedIds, toggleRow, toggleAll };
}