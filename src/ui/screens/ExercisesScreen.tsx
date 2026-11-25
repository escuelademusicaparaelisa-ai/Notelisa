import { useState } from 'react'
import {
  CHROMATIC_STARTS, chosenNotes, cornetNotes, cornetReadingNotes, cornetStaffPosition, defaultChosenNotes, defaultCornetChosen, INTERVALS, MAJOR_KEYS,
  MINOR_KEYS, MINOR_SCALE_NAMES, pickerNotes, RANGE_NOTES, selectableNotes,
  type CornetPosition, type ExerciseOptions, type MinorScale, type NoteScope,
} from '../../core/exercises/generator'
import { ACCOMPANIMENT_NAMES, resolveStyle, stylesForTime, type AccompanimentStyle } from '../../core/exercises/accompaniment'
import { saveExerciseOptions } from '../../core/exercises/savedOptions'
import { Choices } from '../components/Choices'
import { NotePicker } from '../components/NotePicker'
import { PracticeTools } from '../components/PracticeTools'
import { Arpeggio, ArrowLeft, Chromatic, Cornet, FileMusic, Flute, Piano, Scale, ScaleArpeggio, Sparkles } from '../icons'

interface Props {
  options: ExerciseOptions
  onCreate(options: ExerciseOptions): void
  onBack(): void
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

/**
 * A keyboard to tap the notes one by one; it can move lower or higher. It offers the notes of the
 * key or, with "Todo el teclado", every white and black key.
 */
function NoteChooser({ options, onChange }: { options: ExerciseOptions; onChange(options: ExerciseOptions): void }) {
  const all = options.noteScope === 'all'
  const chosenIds = (all ? options.freeNotes : options.notes) ?? []
  const toggle = (id: number) => {
    const next = chosenIds.includes(id) ? chosenIds.filter(p => p !== id) : [...chosenIds, id]
    onChange(all ? { ...options, freeNotes: next } : { ...options, notes: next })
  }
  // Switching keeps the notes already chosen that are on both keyboards.
  const setScope = (scope: NoteScope) => {
    if (scope === options.noteScope || (scope === 'key' && !all)) return
    const current = chosenNotes(options)
    if (scope === 'all') return onChange({ ...options, noteScope: 'all', freeNotes: current.map(n => n.midi) })
    const keyNotes = selectableNotes(options).filter(n => current.some(c => c.midi === n.midi)).map(n => n.position)
    onChange({ ...options, noteScope: 'key', notes: keyNotes.length ? keyNotes : options.notes })
  }
  const notes = pickerNotes(options)
  const chosen = chosenNotes(options).length
  return (
    <fieldset className="exercise-option">
      <legend>Elige las notas</legend>
      <div className="segmented note-scope" role="group" aria-label="Qué teclas se pueden elegir">
        {([['key', 'Tonalidad elegida'], ['all', 'Todo el teclado']] as [NoteScope, string][]).map(([scope, label]) => {
          const active = (options.noteScope ?? 'key') === scope
          return <button key={scope} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => setScope(scope)}>{label}</button>
        })}
      </div>
      {/* A new key, clef, instrument or scope opens the keyboard again around the chosen notes. */}
      <NotePicker key={`${options.key}-${options.minor}-${options.clef}-${options.instrument}-${options.noteScope ?? 'key'}`}
        notes={notes} chosen={chosenIds} onToggle={toggle} />
      <p className="exercise-hint">
        {chosen < 2 ? 'Elige al menos dos notas; mientras tanto se usarán 5 notas.'
          : all ? 'Toca cualquier tecla, blanca o negra, para añadirla o quitarla.'
            : 'Toca una tecla para añadirla o quitarla. Las teclas apagadas no son de la tonalidad: para usarlas, elige «Todo el teclado».'}
      </p>
    </fieldset>
  )
}

/** The cornet's natural notes of the chosen position(s), to tap one by one. */
function CornetNoteChooser({ options, onChange }: { options: ExerciseOptions; onChange(notes: number[]): void }) {
  const chosenMidis = options.cornetChosen ?? []
  const toggle = (midi: number) => onChange(chosenMidis.includes(midi) ? chosenMidis.filter(m => m !== midi) : [...chosenMidis, midi])
  // Re♭6 and Re6 share a staff position, so the cornet's notes are told apart by their MIDI number.
  const notes = cornetNotes(options.cornetPosition).map(n => ({ id: n.midi, position: cornetStaffPosition(n), midi: n.midi, name: n.name }))
  const chosen = notes.filter(n => chosenMidis.includes(n.midi)).length
  return (
    <fieldset className="exercise-option">
      <legend>Elige las notas</legend>
      <NotePicker key={`cornet-${options.cornetPosition}`} notes={notes} chosen={chosenMidis} onToggle={toggle} />
      <p className="exercise-hint">
        {chosen < 2 ? 'Elige al menos dos notas; mientras tanto se usarán 5 notas.'
          : 'Toca una tecla para añadirla o quitarla. Solo se encienden las notas de la corneta en esta escala.'}
      </p>
    </fieldset>
  )
}

/** Notes the melody spans, counted like an interval, to grey out wider intervals. */
function rangeNotes(options: ExerciseOptions): number {
  if (options.instrument === 'cornet') {
    const written = cornetReadingNotes(options).map(cornetStaffPosition)
    return Math.max(...written) - Math.min(...written) + 1
  }
  if (options.range !== 5) return RANGE_NOTES[options.range]
  const chosen = chosenNotes(options).map(n => n.position)
  return chosen.length >= 2 ? Math.max(...chosen) - Math.min(...chosen) + 1 : RANGE_NOTES[1]
}

/** Lets the teacher or student choose what to practise and creates a new exercise each time. */
export function ExercisesScreen({ options: initial, onCreate, onBack }: Props) {
  const [options, setOptions] = useState(initial)
  const set = <K extends keyof ExerciseOptions>(key: K) => (value: ExerciseOptions[K]) => setOptions(o => ({ ...o, [key]: value }))
  // Scales and arpeggios share their options.
  const scale = options.kind !== 'reading'
  const chromatic = options.kind === 'chromatic'
  const piano = options.instrument === 'piano'
  // The cornet plays only its natural notes, in the Do position, the Re♭ position or both: no keys to choose.
  const cornet = options.instrument === 'cornet'
  const position = options.cornetPosition ?? 'do'
  const chooseInstrument = (instrument: ExerciseOptions['instrument']) =>
    setOptions(o => ({
      ...o, instrument, kind: instrument === 'cornet' && o.kind !== 'reading' ? 'scale' : o.kind,
      // "Elegir notas" already open: the cornet starts from its three lowest notes too.
      cornetChosen: instrument === 'cornet' && o.range === 5 && !o.cornetChosen?.length ? defaultCornetChosen(o) : o.cornetChosen,
    }))
  const chooseCornetKind = (value: string) => setOptions(o => value === 'reading'
    ? { ...o, kind: 'reading' }
    : { ...o, kind: 'scale', cornetPosition: value.replace('scale-', '') as CornetPosition })
  // "Elegir notas" starts from the tonic and the two notes above it.
  const chooseRange = (range: ExerciseOptions['range']) =>
    setOptions(o => o.instrument === 'cornet'
      ? { ...o, range, cornetChosen: range === 5 && !o.cornetChosen?.length ? defaultCornetChosen(o) : o.cornetChosen }
      : { ...o, range, notes: range === 5 && !o.notes?.length ? defaultChosenNotes(o) : o.notes })

  const create = () => {
    saveExerciseOptions(options)
    onCreate(options)
  }

  return (
    <main className="library exercises">
      <header className="app-bar">
        <button className="big-button ghost" onClick={onBack}><ArrowLeft /> Biblioteca</button>
        <img className="app-logo" src={`${import.meta.env.BASE_URL}brand/logo-notelisa.png`} alt="Notelisa" />
      </header>
      <section className="library-hero">
        <h1>Ejercicios y escalas</h1>
        <p>Elige qué quieres practicar y se creará un ejercicio nuevo cada vez.</p>
      </section>
      <PracticeTools />
      <div className="exercise-options">
        {cornet ? (
          <Choices label="Tipo" value={scale ? `scale-${position}` : 'reading'} onChange={chooseCornetKind} choices={[
            { value: 'reading', label: 'Lectura', icon: <FileMusic /> },
            { value: 'scale-do', label: 'Escala en Do', icon: <Scale /> },
            { value: 'scale-reb', label: 'Escala en Re♭', icon: <Scale /> },
            { value: 'scale-both', label: 'Escala completa', icon: <Chromatic /> },
          ]} hint={scale && position === 'both' ? 'Todas las notas de las dos posiciones, ordenadas de grave a agudo.' : undefined} />
        ) : <Choices label="Tipo" value={options.kind} onChange={set('kind')} choices={[
          { value: 'reading', label: 'Lectura', icon: <FileMusic /> },
          { value: 'scale', label: 'Escala', icon: <Scale /> },
          { value: 'arpeggio', label: 'Arpegio', icon: <Arpeggio /> },
          { value: 'scale-arpeggio', label: 'Escala + arpegio', icon: <ScaleArpeggio /> },
          { value: 'chromatic', label: 'Cromática', icon: <Chromatic /> },
        ]} />}
        <Choices label="Instrumento" value={options.instrument} onChange={chooseInstrument} choices={[
          { value: 'piano', label: 'Piano', icon: <Piano /> },
          { value: 'flute', label: 'Flauta', icon: <Flute /> },
          { value: 'cornet', label: 'Corneta Do/Re♭', icon: <Cornet /> },
        ]} />
        {cornet && !scale && (
          <Choices<CornetPosition> label="Escala" value={position} onChange={set('cornetPosition')}
            hint="El ejercicio solo usa las notas de esa posición."
            choices={[
              { value: 'do', label: 'En Do' },
              { value: 'reb', label: 'En Re♭' },
              { value: 'both', label: 'Las dos' },
            ]} />
        )}
        {cornet && (
          <Choices<boolean> label="Color de las notas" value={!!options.cornetColors} onChange={set('cornetColors')}
            hint={position === 'both' ? 'En color: azul las de la posición de Do y rojo las de Re♭.' : undefined}
            choices={[
              { value: false, label: 'Negro' },
              { value: true, label: position === 'do' ? 'Azul' : position === 'reb' ? 'Rojo' : 'Azul y rojo' },
            ]} />
        )}
        {piano && (
          <Choices label="Clave" value={options.clef} onChange={set('clef')} choices={[
            { value: 'treble', label: '𝄞 Sol' },
            { value: 'bass', label: '𝄢 Fa' },
            { value: 'grand', label: '𝄞+𝄢 Dos pentagramas' },
          ]} />
        )}
        {cornet ? null : chromatic ? (
          <Choices<number> label="Empieza en" value={options.chromaticStart ?? 0} onChange={set('chromaticStart')}
            hint="Sube con sostenidos y baja con bemoles, de semitono en semitono."
            choices={CHROMATIC_STARTS.map(s => ({ value: s.pitchClass, label: s.name }))} />
        ) : <fieldset className="exercise-option">
          <legend>Tonalidad</legend>
          <div className="key-rows">
            <span className="key-row-label">Mayores</span>
            <KeyChips keys={MAJOR_KEYS} value={options.key} onChange={set('key')} />
            <span className="key-row-label">Menores</span>
            <div className="minor-row">
              <KeyChips keys={MINOR_KEYS} value={options.key} onChange={set('key')} />
              {/* The arpeggio alone is the same in every minor scale. */}
              {options.kind !== 'arpeggio' && <div className="segmented minor-scale" role="group" aria-label="Escala menor">
                {(Object.keys(MINOR_SCALE_NAMES) as MinorScale[]).map(minor => (
                  <button key={minor} type="button" className={options.minor === minor ? 'active' : ''}
                    aria-pressed={options.minor === minor} onClick={() => set('minor')(minor)}>
                    {MINOR_SCALE_NAMES[minor][0].toUpperCase() + MINOR_SCALE_NAMES[minor].slice(1)}
                  </button>
                ))}
              </div>}
            </div>
          </div>
        </fieldset>}
        <Choices label="Compás" value={options.time} onChange={set('time')} choices={[
          { value: '2/4', label: '2/4' },
          { value: '3/4', label: '3/4' },
          { value: '4/4', label: '4/4' },
          { value: '6/8', label: '6/8' },
        ]} />
        {/* No chords fit every semitone, so the chromatic scale goes without accompaniment. */}
        {!chromatic && !(cornet && position === 'both') && <Choices<AccompanimentStyle> label="Acompañamiento" value={resolveStyle(options.accompaniment, options.time)} onChange={set('accompaniment')}
          hint="Una base de piano que va con la melodía. Suena al escuchar y al tocar con tempo."
          choices={(['off', ...stylesForTime(options.time)] as AccompanimentStyle[]).map(style => ({ value: style, label: ACCOMPANIMENT_NAMES[style] }))} />}
        <Choices label={scale ? 'Figura' : 'Figuras'} value={options.rhythm} onChange={set('rhythm')} choices={scale ? [
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
        {!(cornet && scale) && <Choices label={scale ? 'Octavas' : 'Notas'} value={scale ? (options.range === 3 || options.range === 4 ? 4 : 1) : options.range} onChange={chooseRange} choices={scale ? [
          { value: 1, label: 'Una octava' },
          { value: 4, label: 'Dos octavas' },
        ] : [
          { value: 0, label: '3 notas' },
          { value: 1, label: '5 notas' },
          { value: 2, label: 'Una octava' },
          { value: 3, label: 'Con saltos' },
          { value: 4, label: 'Dos octavas' },
          { value: 5, label: 'Elegir notas' },
        ]} />}
        {cornet && !scale && options.range === 5 && <CornetNoteChooser options={options} onChange={set('cornetChosen')} />}
        {!cornet && !scale && options.range === 5 && <NoteChooser options={options} onChange={setOptions} />}
        {!scale && (
          // Intervals wider than the chosen notes cannot come up, so they are greyed out.
          <Choices label="Intervalo máximo" value={Math.min(options.maxInterval, rangeNotes(options)) as ExerciseOptions['maxInterval']}
            onChange={set('maxInterval')} hint="El salto más grande que puede aparecer entre dos notas seguidas."
            choices={INTERVALS.map(i => ({ value: i, label: i === 2 ? '2ª · por grados' : `${i}ª`, disabled: i > rangeNotes(options) }))} />
        )}
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
