import { useEffect, useRef, useState } from 'react';

export function SearchPickerField({
  id,
  label,
  required = false,
  value,
  items,
  placeholder,
  searchTitle,
  onSelect,
  getMatches,
  onOpenPicker,
  className = ''
}) {
  const selected = items.find((item) => item.id === value);
  const selectedName = selected?.name || '';
  const [query, setQuery] = useState(() => selectedName);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listId = id + '-results';
  const matches = open ? getMatches(query) : [];

  useEffect(() => {
    if (value && selectedName) {
      setQuery(selectedName);
      setOpen(false);
    }
  }, [selectedName, value]);

  const choose = (item) => {
    setQuery(item.name || '');
    setOpen(false);
    setActiveIndex(0);
    onSelect(item.id, item);
  };

  const handleInput = (event) => {
    const next = event.target.value;
    setQuery(next);
    setOpen(true);
    setActiveIndex(0);
    if (selected && next.trim() !== String(selected.name || '').trim()) onSelect('', null);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + matches.length) % matches.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(matches[activeIndex] || matches[0]);
    }
  };

  const openPicker = () => {
    inputRef.current?.focus();
    setActiveIndex(0);
    const keepInlineOpen = onOpenPicker?.(query);
    setOpen(keepInlineOpen !== false);
  };

  const handleBlur = (event) => {
    if (rootRef.current?.contains(event.relatedTarget)) return;
    setOpen(false);
  };

  return (
    <div className={'ff ' + className} ref={rootRef} onBlur={handleBlur}>
      <label htmlFor={id}>{label}{required ? ' *' : ''}</label>
      <div className="field-search">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && matches.length > 0}
          aria-activedescendant={open && matches[activeIndex] ? id + '-option-' + activeIndex : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={handleInput}
          onFocus={() => { setOpen(true); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="field-search-btn" title={searchTitle} aria-label={searchTitle} onClick={openPicker}>
          <i className="ti ti-search" />
        </button>
      </div>
      {open && matches.length > 0 && (
        <div className="inline-search-results" id={listId} role="listbox" style={{ display: 'block' }}>
          {matches.map((item, index) => (
            <button
              type="button"
              className="inline-search-item"
              id={id + '-option-' + index}
              role="option"
              aria-selected={index === activeIndex}
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <strong>{item.name || item.id}</strong>
              <span>{item.meta || item.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}