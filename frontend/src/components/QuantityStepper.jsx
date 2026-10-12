export default function QuantityStepper({ value, min = 1, max, onChange, size = 'md' }) {
  const canDecrease = value > min
  const canIncrease = value < max

  return (
    <div className={`stepper stepper--${size}`}>
      <button
        type="button"
        className="stepper__btn"
        disabled={!canDecrease}
        aria-label="Kurangi jumlah"
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="stepper__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="stepper__btn"
        disabled={!canIncrease}
        aria-label="Tambah jumlah"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}
