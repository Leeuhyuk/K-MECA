import { IconButton } from './IconButton.jsx';

export function QuantityStepper({ value, unit, low = false, label, onDecrease, onIncrease }) {
  return (
    <div className={`modern-quantity-stepper${low ? ' is-low' : ''}`} role="group" aria-label={`${label} 수량 조정`}>
      <IconButton
        icon="ti-minus"
        label={`${label} 1 감소`}
        size="small"
        data-act="dec"
        onClick={onDecrease}
      />
      <span className="modern-quantity-value">
        <b>{value}</b>
        {unit && <small>{unit}</small>}
      </span>
      <IconButton
        icon="ti-plus"
        label={`${label} 1 증가`}
        size="small"
        data-act="inc"
        onClick={onIncrease}
      />
      {low && <i className="ti ti-alert-triangle modern-quantity-alert" title="안전재고 미달" aria-label="안전재고 미달" />}
    </div>
  );
}
