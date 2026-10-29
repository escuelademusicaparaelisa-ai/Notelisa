/** A labelled row of chips where one option is chosen. */
export interface Choice<T> {
  value: T
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

export function Choices<T extends string | number | boolean>({ label, value, choices, onChange, hint }: {
  label: string
  value: T
  choices: Choice<T>[]
  onChange(value: T): void
  hint?: string
}) {
  return (
    <fieldset className="exercise-option">
      <legend>{label}</legend>
      <div className="exercise-choices">
        {choices.map(choice => (
          <button key={String(choice.value)} type="button" className={`chip ${choice.value === value ? 'active' : ''}`}
            aria-pressed={choice.value === value} disabled={choice.disabled} onClick={() => onChange(choice.value)}>
            {choice.icon}{choice.label}
          </button>
        ))}
      </div>
      {hint && <p className="exercise-hint">{hint}</p>}
    </fieldset>
  )
}
