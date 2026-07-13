export function IconButton({
  icon,
  label,
  tone = 'neutral',
  size = 'medium',
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`modern-icon-button is-${tone} is-${size} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <i className={`ti ${icon}`} aria-hidden="true" />
    </button>
  );
}
