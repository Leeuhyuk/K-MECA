export function EmptyState({ icon = 'ti-inbox', title, description, action }) {
  return (
    <div className="modern-empty-state" role="status">
      <i className={`ti ${icon}`} aria-hidden="true" />
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}
