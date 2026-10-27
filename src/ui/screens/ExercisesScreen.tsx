import { useState } from 'react'
import { MAJOR_KEYS, MINOR_KEYS, MINOR_SCALE_NAMES, type ExerciseOptions, type MinorScale } from '../../core/exercises/generator'
import { saveExerciseOptions } from '../../core/exercises/savedOptions'
import { ArrowLeft, FileMusic, Flute, Piano, Scale, Sparkles } from '../icons'

interface Props {
  options: ExerciseOptions
  onCreate(options: ExerciseOptions): void
  onBack(): void
}

interface Choice<T> {
  value: T
  label: string
  icon?: React.ReactNode
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
            {choice.icon}{choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Key chips show just the tonic ("Sol", "Si♭"); the row says major or minor. */
function KeyChips({ keys, value, onChange }: { keys: typeof MAJOR_KEYS; value: string; onChange(id: string): void }) {
  return (
    <div className="exercise-choices">
      {keys.map(k => (
        <button key={k.id} type="button" className={`chip key-chip ${k.id === value ? 'active' : ''}`}
          aria-pressed={k.id === value} aria-label={k.name} onClick={() => onChange(k.id)}>
          {k.name.replace(/ (mayor|menor)$/, '')}
        </button>
      ))}
    </div>
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
      <header className="app-bar">
        <button className="big-button ghost" onClick={onBack}><ArrowLeft /> Biblioteca</button>
        <img className="app-logo small" src={`${import.meta.env.BASE_URL}brand/logo-n.png`} alt="Notelisa" />
      </header>
      <section className="library-hero">
        <h1>Ejercicios y escalas</h1>
        <p>Elige qué quieres practicar y se creará un ejercicio nuevo cada vez.</p>
      </section>
      <div className="exercise-options">
        <Choices label="Tipo" value={options.kind} onChange={set('kind')} choices={[
          { value: 'reading', label: 'Lectura', icon: <FileMusic /> },
          { value: 'scale', label: 'Escala', icon: <Scale /> },
        ]} />
        <Choices label="Instrumento" value={options.instrument} onChange={set('instrument')} choices={[
          { value: 'piano', label: 'Piano', icon: <Piano /> },
          { value: 'flute', label: 'Flauta', icon: <Flute /> },
        ]} />
        {piano && (
          <Choices label="Clave" value={options.clef} onChange={set('clef')} choices={[
            { value: 'treble', label: '𝄞 Sol' },
            { value: 'bass', label: '𝄢 Fa' },
            { value: 'grand', label: '𝄞+𝄢 Dos pentagramas' },
          ]} />
        )}
        <fieldset className="exercise-option">
          <legend>Tonalidad</legend>
          <div className="key-rows">
            <span className="key-row-label">Mayores</span>
            <KeyChips keys={MAJOR_KEYS} value={options.key} onChange={set('key')} />
            <span className="key-row-label">Menores</span>
            <div className="minor-row">
              <KeyChips keys={MINOR_KEYS} value={options.key} onChange={set('key')} />
              <div className="segmented minor-scale" role="group" aria-label="Escala menor">
                {(Object.keys(MINOR_SCALE_NAMES) as MinorScale[]).map(minor => (
                  <button key={minor} type="button" className={options.minor === minor ? 'active' : ''}
                    aria-pressed={options.minor === minor} onClick={() => set('minor')(minor)}>
                    {MINOR_SCALE_NAMES[minor][0].toUpperCase() + MINOR_SCALE_NAMES[minor].slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>
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
      <button className="big-button primary create-exercise" onClick={create}><Sparkles /> Crear ejercicio</button>
    </main>
  )
}
