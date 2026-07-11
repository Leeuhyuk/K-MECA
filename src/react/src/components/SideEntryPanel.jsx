export function SideEntryPanel({
  id,
  title,
  icon = 'ti-edit',
  onClose,
  children,
  actions,
  dialogClassName = '',
  style
}) {
  return (
    <div className="overlay open side-entry-overlay" id={id}>
      <div className={'dlg side-entry-dialog ' + dialogClassName} style={style}>
        <div
          className="selection-detail-resizer"
          title="폭 조절"
          onPointerDown={(event) => globalThis.startSelectionDetailResize?.(event.nativeEvent)}
        />
        <div className="dlg-title side-entry-head">
          <i className={'ti ' + icon} />
          {title}
        </div>
        <button type="button" className="side-entry-close auto-side-entry-close" aria-label="닫기" onClick={onClose}>
          <i className="ti ti-x" />
        </button>
        <div className="side-entry-body thin-scroll">{children}</div>
        <div className="dlg-actions side-entry-actions">{actions}</div>
      </div>
    </div>
  );
}