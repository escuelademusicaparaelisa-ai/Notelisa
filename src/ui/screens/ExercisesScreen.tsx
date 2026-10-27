import { useState } from 'react'
import { KEYS, type ExerciseOptions } from '../../core/exercises/generator'
import { saveExerciseOptions } from '../../core/exercises/savedOptions'

interface Props {
  options: ExerciseOptions
  onCreate(options: ExerciseOptions): void
  onBack(): void
}

interface Choice<T> {
  value: T
  label: string
}

function Choices<T extends string | number | boolean>({ label, value, choices, onChange }: {
  label: string
  value: T
  choices: Choice<T>[]
  onChange(value: T): void
}) {
  return (
    <fieldset className="exercise-option">
      <legend>{label}</legend>
      <div className="exercise-choices">
        {choices.map(choice => (
          <button key={String(choice.value)} type="button" className={`chip ${choice.value === value ? 'active' : ''}`}
            aria-pressed={choice.value === value} onClick={() => onChange(choice.value)}>
            {choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Lets the teacher or student choose what to practise and creates a new exercise each time. */
export function ExercisesScreen({ options: initial, onCreate, onBack }: Props) {
  const [options, setOptions] = useState(initial)
  const set = <K extends keyof ExerciseOptions>(key: K) => (value: ExerciseOptions[K]) => setOptions(o => ({ ...o, [key]: value }))
  const scale = options.kind === 'scale'
  const piano = options.instrument === 'piano'

  const create = () => {
    saveExerciseOptions(options)
    onCreate(options)
  }

  return (
    <main className="library exercises">
      <header className="library-header">
        <button className="big-button ghost" onClick={onBack}>← Biblioteca</button>
        <h1>🎯 Ejercicios y escalas</h1>
        <p>Elige qué quieres practicar y se creará un ejercicio nuevo cada vez.</p>
      </header>
      <div className="exercise-options">
        <Choices label="Tipo" value={options.kind} onChange={set('kind')} choices={[
          { value: 'reading', label: '🎼 Lectura' },
          { value: 'scale', label: '🪜 Escala' },
        ]} />
        <Choices label="Instrumento" value={options.instrument} onChange={set('instrument')} choices={[
          { value: 'piano', label: '🎹 Piano' },
          { value: 'flute', label: '🪈 Flauta' },
        ]} />
        {piano && (
          <Choices label="Clave" value={options.clef} onChange={set('clef')} choices={[
            { value: 'treble', label: '𝄞 Sol' },
            { value: 'bass', label: '𝄢 Fa' },
            { value: 'grand', label: '𝄞+𝄢 Dos pentagramas' },
          ]} />
        )}
        <Choices label="Tonalidad" value={options.key} onChange={set('key')}
          choices={KEYS.map(k => ({ value: k.id, label: k.name }))} />
        <Choices label="Compás" value={options.time} onChange={set('time')} choices={[
          { value: '2/4', label: '2/4' },
          { value: '3/4', label: '3/4' },
          { value: '4/4', label: '4/4' },
          { value: '6/8', label: '6/8' },
        ]} />
        <Choices label={scale ? 'Figura de la escala' : 'Figuras'} value={options.rhythm} onChange={set('rhythm')} choices={scale ? [
          { value: 1, label: 'Lentas (blancas)' },
          { value: 2, label: 'Negras' },
          { value: 3, label: 'Corcheas' },
          { value: 4, label: 'Semicorcheas' },
        ] : [
          { value: 1, label: '1 · Redondas y blancas' },
          { value: 2, label: '2 · + Negras' },
          { value: 3, label: '3 · + Corcheas' },
          { value: 4, label: '4 · + Puntillos y semicorcheas' },
        ]} />
        {!scale && (
          <Choices label="Silencios" value={options.rests} onChange={set('rests')} choices={[
            { value: false, label: 'Sin silencios' },
            { value: true, label: 'Con silencios' },
          ]} />
        )}
        <Choices label={scale ? 'Octavas' : 'Notas'} value={scale ? (options.range === 3 && piano ? 3 : 1) : options.range} onChange={set('range')} choices={scale ? [
          { value: 1, label: 'Una octava' },
          ...(piano ? [{ value: 3 as const, label: 'Dos octavas' }] : []),
        ] : [
          { value: 1, label: '5 notas' },
          { value: 2, label: 'Una octava' },
          { value: 3, label: 'Con saltos' },
        ]} />
        {!scale && (
          <Choices label="Compases" value={options.measures} onChange={set('measures')} choices={[
            { value: 4, label: '4' },
            { value: 8, label: '8' },
            { value: 12, label: '12' },
          ]} />
        )}
      </div>
      <button className="big-button primary create-exercise" onClick={create}>✨ Crear ejercicio</button>
    </main>
  )
}
