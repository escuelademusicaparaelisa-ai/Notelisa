// Generates practice exercises (sight-reading lines, scales and arpeggios) as MusicXML, so
// they open in the practice screen like any other piece.

import { chordName, harmonize, type AccompanimentStyle, type Harmony } from './accompaniment'

export type ExerciseKind = 'reading' | 'scale' | 'arpeggio' | 'scale-arpeggio' | 'chromatic'
export type Clef = 'treble' | 'bass' | 'grand'
export type TimeSignature = '2/4' | '3/4' | '4/4' | '6/8'
/** 1 whole/half notes, 2 + quarters, 3 + eighths, 4 + dotted figures and sixteenths. */
export type RhythmLevel = 1 | 2 | 3 | 4
/** 0 three notes, 1 five notes, 2 one octave, 3 wider with hand position changes, 4 two octaves, 5 notes chosen one by one. */
export type RangeLevel = 0 | 1 | 2 | 3 | 4 | 5
/** A melodic interval, named as in music: 2 is a step, 3 a third … 8 an octave. */
export type Interval = 2 | 3 | 4 | 5 | 6 | 7 | 8

export const INTERVALS: Interval[] = [2, 3, 4, 5, 6, 7, 8]

/** Widest interval each range used before it could be chosen. */
export function defaultMaxInterval(range: RangeLevel): Interval {
  return range <= 1 ? 3 : range === 2 ? 5 : 8
}

/** Notes each range spans, counted like intervals (5 notes span a fifth). */
export const RANGE_NOTES: Record<Exclude<RangeLevel, 5>, number> = { 0: 3, 1: 5, 2: 8, 3: 13, 4: 15 }

export type Instrument = 'piano' | 'flute' | 'cornet'

/** Cornet notes: the Do position (rotor off), the Re♭ position (rotor on) or both. */
export type CornetPosition = 'do' | 'reb' | 'both'

export interface ExerciseOptions {
  kind: ExerciseKind
  instrument: Instrument
  clef: Clef
  key: string
  time: TimeSignature
  rhythm: RhythmLevel
  rests: boolean
  range: RangeLevel
  /** Notes chosen one by one (range 5), as staff positions: 7 × octave + letter (C4 is 28). */
  notes: number[]
  /** Which keys "Elegir notas" lets you tap: only the notes of the key, or every key of the keyboard. */
  noteScope?: NoteScope
  /** Notes chosen anywhere on the keyboard (noteScope "all"), as MIDI numbers (C4 is 60). */
  freeNotes?: number[]
  /** Widest interval between two notes of a reading exercise. */
  maxInterval: Interval
  measures: number
  /** Which minor scale minor keys use. */
  minor: MinorScale
  /** Piano accompaniment heard with the exercise; none when omitted. */
  accompaniment?: AccompanimentStyle
  /** Starting note of the chromatic scale, as a pitch class (0 = Do … 11 = Si); Do when omitted. */
  chromaticStart?: number
  /** Cornet: which position's notes the scale or reading uses ('both' is the complete scale). */
  cornetPosition?: CornetPosition
  /** Cornet: Do-position notes in blue and Re♭-position notes in red. */
  cornetColors?: boolean
  /** Cornet notes chosen one by one (range 5), as MIDI numbers. */
  cornetChosen?: number[]
}

export type MinorScale = 'natural' | 'harmonic' | 'melodic'
export type NoteScope = 'key' | 'all'

export interface KeyDefinition {
  id: string
  /** Spanish name shown in the UI. */
  name: string
  /** Tonic letter: 0 = C … 6 = B. */
  letter: number
  alter: number
  fifths: number
  mode: 'major' | 'minor'
}

const LETTER_NAMES_ES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']

function keyDefinition(id: string, letter: number, alter: number, fifths: number, mode: 'major' | 'minor'): KeyDefinition {
  const name = LETTER_NAMES_ES[letter] + (alter > 0 ? '♯' : alter < 0 ? '♭' : '')
  return { id, name: `${name} ${mode === 'major' ? 'mayor' : 'menor'}`, letter, alter, fifths, mode }
}

/** All major keys, sharps first and then flats, in the order of the circle of fifths. */
export const MAJOR_KEYS: KeyDefinition[] = [
  keyDefinition('C', 0, 0, 0, 'major'),
  keyDefinition('G', 4, 0, 1, 'major'),
  keyDefinition('D', 1, 0, 2, 'major'),
  keyDefinition('A', 5, 0, 3, 'major'),
  keyDefinition('E', 2, 0, 4, 'major'),
  keyDefinition('B', 6, 0, 5, 'major'),
  keyDefinition('F#', 3, 1, 6, 'major'),
  keyDefinition('C#', 0, 1, 7, 'major'),
  keyDefinition('F', 3, 0, -1, 'major'),
  keyDefinition('Bb', 6, -1, -2, 'major'),
  keyDefinition('Eb', 2, -1, -3, 'major'),
  keyDefinition('Ab', 5, -1, -4, 'major'),
  keyDefinition('Db', 1, -1, -5, 'major'),
  keyDefinition('Gb', 4, -1, -6, 'major'),
  keyDefinition('Cb', 0, -1, -7, 'major'),
]

/** All minor keys, in the same order as their relative majors. */
export const MINOR_KEYS: KeyDefinition[] = [
  keyDefinition('Am', 5, 0, 0, 'minor'),
  keyDefinition('Em', 2, 0, 1, 'minor'),
  keyDefinition('Bm', 6, 0, 2, 'minor'),
  keyDefinition('F#m', 3, 1, 3, 'minor'),
  keyDefinition('C#m', 0, 1, 4, 'minor'),
  keyDefinition('G#m', 4, 1, 5, 'minor'),
  keyDefinition('D#m', 1, 1, 6, 'minor'),
  keyDefinition('A#m', 5, 1, 7, 'minor'),
  keyDefinition('Dm', 1, 0, -1, 'minor'),
  keyDefinition('Gm', 4, 0, -2, 'minor'),
  keyDefinition('Cm', 0, 0, -3, 'minor'),
  keyDefinition('Fm', 3, 0, -4, 'minor'),
  keyDefinition('Bbm', 6, -1, -5, 'minor'),
  keyDefinition('Ebm', 2, -1, -6, 'minor'),
  keyDefinition('Abm', 5, -1, -7, 'minor'),
]

export const KEYS: KeyDefinition[] = [...MAJOR_KEYS, ...MINOR_KEYS]

/** Starting notes for the chromatic scale, spelled as usually named; the first and last notes keep this spelling. */
export const CHROMATIC_STARTS: { pitchClass: number; letter: number; alter: number; name: string }[] = [
  [0, 0], [1, 0, 1], [2, 1], [3, 2, -1], [4, 2], [5, 3], [6, 3, 1], [7, 4], [8, 5, -1], [9, 5], [10, 6, -1], [11, 6],
].map(([pitchClass, letter, alter = 0]) => ({
  pitchClass, letter, alter, name: LETTER_NAMES_ES[letter] + (alter > 0 ? '♯' : alter < 0 ? '♭' : ''),
}))

function chromaticStart(options: ExerciseOptions) {
  return CHROMATIC_STARTS.find(s => s.pitchClass === options.chromaticStart) ?? CHROMATIC_STARTS[0]
}

/** The key an exercise is written in. The chromatic scale has no key signature: every note carries its own accidental. */
export function exerciseKey(options: ExerciseOptions): KeyDefinition {
  if (options.instrument === 'cornet') return cornetKey(options)
  if (options.kind !== 'chromatic') return getKey(options.key)
  const start = chromaticStart(options)
  return { id: 'chromatic', name: start.name, letter: start.letter, alter: start.alter, fifths: 0, mode: 'major' }
}

export const MINOR_SCALE_NAMES: Record<MinorScale, string> = { natural: 'natural', harmonic: 'armónica', melodic: 'melódica' }

/** One note or rest. `degree` counts scale steps from the tonic (0 = tonic, 7 = octave). */
export interface ExerciseEvent {
  duration: number
  degree: number | null
  midi: number | null
  /** Piano finger, 1 = thumb … 5 = little finger. */
  finger?: number
  /** Written note, when it does not follow the key (cornet notes). */
  pitch?: { step: string; alter: number; octave: number }
  /** Notehead colour, e.g. the cornet position. */
  color?: string
}

export interface ExerciseStaff {
  clef: 'treble' | 'bass'
  measures: ExerciseEvent[][]
}

export interface Exercise {
  title: string
  options: ExerciseOptions
  staves: ExerciseStaff[]
  /** Quarter notes per minute. */
  tempo: number
  /** Chords that go with the melody, for the accompaniment. */
  harmony: Harmony
}

/** Durations are in sixteenth notes. */
const DIVISIONS = 4
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]
const MELODIC_MINOR = [0, 2, 3, 5, 7, 9, 11]
const FLUTE_RANGE = { low: 60, high: 91 }

const DURATION_TYPES: Record<number, { type: string; dot: boolean }> = {
  16: { type: 'whole', dot: false },
  12: { type: 'half', dot: true },
  8: { type: 'half', dot: false },
  6: { type: 'quarter', dot: true },
  4: { type: 'quarter', dot: false },
  3: { type: 'eighth', dot: true },
  2: { type: 'eighth', dot: false },
  1: { type: '16th', dot: false },
}

export function measureLength(time: TimeSignature): number {
  return { '2/4': 8, '3/4': 12, '4/4': 16, '6/8': 12 }[time]
}

/** Length of a beat: a quarter, or a dotted quarter in 6/8. */
export function beatLength(time: TimeSignature): number {
  return time === '6/8' ? 6 : 4
}

export function getKey(id: string): KeyDefinition {
  return KEYS.find(k => k.id === id) ?? KEYS[0]
}

/** Small seeded random generator, so an exercise can be rebuilt from its number. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let r = random() * total
  for (const item of items) {
    r -= item.weight
    if (r < 0) return item.value
  }
  return items[items.length - 1].value
}

// --- Pitches ---------------------------------------------------------------

class Pitches {
  readonly tonicMidi: number
  readonly key: KeyDefinition
  private readonly minor: MinorScale

  constructor(key: KeyDefinition, clef: 'treble' | 'bass', minor: MinorScale = 'natural') {
    this.key = key
    this.minor = minor
    const pitchClass = (LETTER_SEMITONES[key.letter] + key.alter + 12) % 12
    // Tonic between C4 and B4 for treble clef, and between G2 and F#3 for bass clef,
    // so the exercise stays on the staff.
    this.tonicMidi = clef === 'treble' ? 60 + pitchClass : pitchClass < 7 ? 48 + pitchClass : 36 + pitchClass
  }

  /** The melodic minor raises the 6th and 7th going up and uses the natural minor going down. */
  midi(degree: number, ascending = true): number {
    const steps = this.key.mode === 'major' ? MAJOR
      : this.minor === 'harmonic' ? HARMONIC_MINOR
        : this.minor === 'melodic' && ascending ? MELODIC_MINOR : NATURAL_MINOR
    const octave = Math.floor(degree / 7)
    return this.tonicMidi + 12 * octave + steps[degree - 7 * octave]
  }

  /** The tonic's own octave: the tonic letter written below its sounding pitch. */
  private get tonicOctave(): number {
    return Math.floor((this.tonicMidi - this.key.alter) / 12) - 1
  }

  /** Staff position (7 × octave + letter) of a degree, and back. */
  position(degree: number): number {
    return 7 * this.tonicOctave + this.key.letter + degree
  }

  degree(position: number): number {
    return position - 7 * this.tonicOctave - this.key.letter
  }

  /** MusicXML spelling of a degree sounding at `midi`. */
  spell(degree: number, midi: number): { step: string; alter: number; octave: number } {
    const total = this.key.letter + degree
    const letter = ((total % 7) + 7) % 7
    const octave = this.tonicOctave + Math.floor(total / 7)
    const alter = midi - (12 * (octave + 1) + LETTER_SEMITONES[letter])
    return { step: LETTER_NAMES[letter], alter, octave }
  }
}

// --- Rhythm ----------------------------------------------------------------

interface Cell {
  durations: number[]
  level: RhythmLevel
  /** The cell may only start where the position is a multiple of this. */
  align: number
  /** Whole-measure figures (a whole note in 4/4, a dotted half in 3/4 or 6/8). */
  wholeMeasure?: boolean
}

const SIMPLE_CELLS: Cell[] = [
  { durations: [16], level: 1, align: 16, wholeMeasure: true },
  { durations: [12], level: 1, align: 12, wholeMeasure: true },
  { durations: [8], level: 1, align: 8 },
  { durations: [4], level: 2, align: 4 },
  { durations: [2, 2], level: 3, align: 4 },
  { durations: [6, 2], level: 4, align: 8 },
  { durations: [3, 1], level: 4, align: 4 },
  { durations: [1, 1, 1, 1], level: 4, align: 4 },
  { durations: [2, 1, 1], level: 4, align: 4 },
  { durations: [1, 1, 2], level: 4, align: 4 },
]

const COMPOUND_CELLS: Cell[] = [
  { durations: [12], level: 1, align: 12, wholeMeasure: true },
  { durations: [6], level: 1, align: 6 },
  { durations: [4, 2], level: 2, align: 6 },
  { durations: [2, 2, 2], level: 3, align: 6 },
  { durations: [3, 1, 2], level: 4, align: 6 },
  { durations: [2, 2, 1, 1], level: 4, align: 6 },
  { durations: [1, 1, 2, 2], level: 4, align: 6 },
]

/** Durations filling one measure, using figures up to the chosen level. */
export function rhythmForMeasure(time: TimeSignature, level: RhythmLevel, random: () => number): number[] {
  const length = measureLength(time)
  const cells = (time === '6/8' ? COMPOUND_CELLS : SIMPLE_CELLS).filter(c => c.level <= level)
  const durations: number[] = []
  let position = 0
  while (position < length) {
    const fitting = cells.filter(c => {
      const span = c.durations.reduce((a, b) => a + b, 0)
      return position % c.align === 0 && position + span <= length && (!c.wholeMeasure || span === length)
    })
    if (fitting.length === 0) {
      // Only when the level's figures cannot fill the measure (e.g. halves in 3/4).
      durations.push(beatLength(time))
      position += beatLength(time)
      continue
    }
    // Figures new at this level come up more often.
    const cell = pick(random, fitting.map(c => ({ value: c, weight: c.level === level ? 3 : 1 })))
    durations.push(...cell.durations)
    position += cell.durations.reduce((a, b) => a + b, 0)
  }
  return durations
}

/** Splits a length into durations that can be written as single notes or rests. */
function writableDurations(length: number): number[] {
  const result: number[] = []
  for (const d of [16, 12, 8, 6, 4, 3, 2, 1]) {
    while (length >= d) {
      result.push(d)
      length -= d
    }
  }
  return result
}

// --- Exercises --------------------------------------------------------------

/** Lowest and highest notes for each clef: up to two ledger lines. */
const CLEF_RANGE = { treble: { low: 57, high: 81 }, bass: { low: 40, high: 64 } }
/** Notes chosen one by one may go further: up to three ledger lines (Fa3–Mi6, La1–Sol4). */
const CHOSEN_CLEF_RANGE = { treble: { low: 53, high: 88 }, bass: { low: 33, high: 67 } }

function degreeRange(pitches: Pitches, clef: 'treble' | 'bass', range: Exclude<RangeLevel, 5>, instrument: ExerciseOptions['instrument']): { low: number; high: number } {
  let { low, high } = [{ low: 0, high: 2 }, { low: 0, high: 4 }, { low: 0, high: 7 }, { low: -3, high: 9 }, { low: -3, high: 11 }][range]
  const limits = melodyLimits(clef, instrument)
  // Notes cut off at one end of the staff are added at the other, so the range keeps its size.
  while (pitches.midi(low) < limits.low) {
    low++
    if (pitches.midi(high + 1) <= limits.high) high++
  }
  while (pitches.midi(high) > limits.high) {
    high--
    if (pitches.midi(low - 1) >= limits.low) low--
  }
  return { low, high }
}

/** Joins rests that follow each other inside a beat (two eighth rests become a quarter rest). */
function mergeRests(events: ExerciseEvent[]): ExerciseEvent[] {
  const result: ExerciseEvent[] = []
  let position = 0
  for (const event of events) {
    const prev = result[result.length - 1]
    const prevStart = prev ? position - prev.duration : 0
    const joined = prev ? prev.duration + event.duration : 0
    if (prev && prev.midi === null && event.midi === null && DURATION_TYPES[joined] && joined <= 4 && prevStart % joined === 0) {
      result[result.length - 1] = { ...prev, duration: joined }
    } else {
      result.push(event)
    }
    position += event.duration
  }
  return result
}

/** How often each interval comes up; steps are the most common. */
const INTERVAL_WEIGHTS: Record<Interval, number> = { 2: 5, 3: 2, 4: 1.5, 5: 1.5, 6: 1, 7: 1, 8: 1 }

function nextDegree(current: number, pool: number[], maxInterval: Interval, random: () => number): number {
  const moves = [{ value: 0, weight: 1 }]
  for (const interval of INTERVALS.filter(i => i <= maxInterval)) {
    const weight = INTERVAL_WEIGHTS[interval]
    moves.push({ value: interval - 1, weight }, { value: 1 - interval, weight })
  }
  const allowed = moves.filter(m => pool.includes(current + m.value))
  // Chosen notes further apart than the widest interval: move to the next one up or down anyway.
  if (allowed.length === 1) {
    const i = pool.indexOf(current)
    for (const neighbour of [pool[i - 1], pool[i + 1]]) if (neighbour !== undefined) allowed.push({ value: neighbour - current, weight: 5 })
  }
  return current + pick(random, allowed)
}

/** The tonic (or its octave) closest to a degree among the notes in use; the first note if none is a tonic. */
function closestTonic(degree: number, pool: number[]): number {
  const candidates = pool.filter(d => ((d % 7) + 7) % 7 === 0)
  if (candidates.length === 0) return pool[0]
  return candidates.reduce((best, d) => (Math.abs(d - degree) < Math.abs(best - degree) ? d : best))
}

/** Lowest and highest notes the melody may use. */
function melodyLimits(clef: 'treble' | 'bass', instrument: ExerciseOptions['instrument']): { low: number; high: number } {
  return instrument === 'flute' || instrument === 'cornet' ? FLUTE_RANGE : CLEF_RANGE[clef]
}

/** Lowest and highest notes that may be chosen one by one. */
function chosenLimits(clef: 'treble' | 'bass', instrument: ExerciseOptions['instrument']): { low: number; high: number } {
  return instrument === 'flute' || instrument === 'cornet' ? FLUTE_RANGE : CHOSEN_CLEF_RANGE[clef]
}

export interface SelectableNote {
  /** What is stored when the note is chosen: its staff position for notes of the key, its MIDI number on the whole keyboard. */
  id: number
  position: number
  /** The key it sounds on the piano. */
  midi: number
  /** Spanish name with its octave, e.g. "Fa♯4". */
  name: string
}

function melodyClefOf(options: ExerciseOptions): 'treble' | 'bass' {
  return options.instrument === 'piano' && options.clef === 'bass' ? 'bass' : 'treble'
}

function noteName(step: string, alter: number, octave: number): string {
  return LETTER_NAMES_ES[LETTER_NAMES.indexOf(step)] + (alter > 0 ? '♯'.repeat(alter) : '♭'.repeat(-alter)) + octave
}

/** Notes of the key that fit on the melody's staff with up to three ledger lines (or the flute), low to high, to choose from one by one. */
export function selectableNotes(options: ExerciseOptions): SelectableNote[] {
  const clef = melodyClefOf(options)
  const pitches = new Pitches(getKey(options.key), clef, options.minor)
  const { low, high } = chosenLimits(clef, options.instrument)
  const notes: SelectableNote[] = []
  for (let degree = -21; degree <= 28; degree++) {
    const midi = pitches.midi(degree)
    if (midi < low || midi > high) continue
    const { step, alter, octave } = pitches.spell(degree, midi)
    const position = pitches.position(degree)
    notes.push({ id: position, position, midi, name: noteName(step, alter, octave) })
  }
  return notes
}

/**
 * Every key of the keyboard in the same span, black keys included. Notes of the key keep their
 * spelling; the others are written as naturals, or with sharps (flats in keys with flats).
 */
export function keyboardNotes(options: ExerciseOptions): SelectableNote[] {
  const clef = melodyClefOf(options)
  const key = getKey(options.key)
  const pitches = new Pitches(key, clef, options.minor)
  const inKey = new Map(selectableNotes(options).map(n => [n.midi, n]))
  const { low, high } = chosenLimits(clef, options.instrument)
  const useFlats = key.fifths < 0
  const notes: SelectableNote[] = []
  for (let midi = low; midi <= high; midi++) {
    const own = inKey.get(midi)
    if (own) {
      notes.push({ ...own, id: midi })
      continue
    }
    const [letter, alter] = (useFlats ? FLAT_SPELLING : SHARP_SPELLING)[midi % 12]
    const octave = Math.floor((midi - alter) / 12) - 1
    const position = 7 * octave + letter
    const degree = pitches.degree(position)
    const spelled = pitches.spell(degree, midi)
    notes.push({ id: midi, position, midi, name: noteName(spelled.step, spelled.alter, spelled.octave) })
  }
  return notes
}

/** The notes the "Elegir notas" keyboard offers, depending on its scope. */
export function pickerNotes(options: ExerciseOptions): SelectableNote[] {
  return options.noteScope === 'all' ? keyboardNotes(options) : selectableNotes(options)
}

/** Chosen notes that fit, low to high. */
export function chosenNotes(options: ExerciseOptions): SelectableNote[] {
  const chosen = new Set((options.noteScope === 'all' ? options.freeNotes : options.notes) ?? [])
  return pickerNotes(options).filter(n => chosen.has(n.id))
}

/** Staff positions of the tonic and the two notes above it: what "Elegir notas" starts with. */
export function defaultChosenNotes(options: ExerciseOptions): number[] {
  const clef = melodyClefOf(options)
  const pitches = new Pitches(getKey(options.key), clef, options.minor)
  return [0, 1, 2].map(d => pitches.position(d))
}

/** Degrees the melody may use, low to high. Fewer than two chosen notes that fit falls back to five notes. */
function melodyPool(options: ExerciseOptions, clef: 'treble' | 'bass', pitches: Pitches): number[] {
  if (options.range === 5) {
    const { low, high } = chosenLimits(clef, options.instrument)
    const chosen = [...new Set(options.notes ?? [])].map(p => pitches.degree(p))
      .filter(d => pitches.midi(d) >= low && pitches.midi(d) <= high).sort((a, b) => a - b)
    if (chosen.length >= 2) return chosen
  }
  const { low, high } = degreeRange(pitches, clef, options.range === 5 ? 1 : options.range, options.instrument)
  return Array.from({ length: high - low + 1 }, (_, i) => low + i)
}

function readingMelody(options: ExerciseOptions, clef: 'treble' | 'bass', pitches: Pitches, random: () => number): ExerciseEvent[][] {
  if (options.range === 5 && options.noteScope === 'all') {
    const free = chosenNotes(options)
    if (free.length >= 2) return freeMelody(options, free.map(n => ({ degree: pitches.degree(n.position), midi: n.midi })), pitches, random)
  }
  const pool = melodyPool(options, clef, pitches)
  const length = measureLength(options.time)
  let degree = pool.includes(0) ? 0 : closestTonic(0, pool)
  const measures: ExerciseEvent[][] = []
  for (let m = 0; m < options.measures; m++) {
    const last = m === options.measures - 1
    const durations = last ? [length] : rhythmForMeasure(options.time, options.rhythm, random)
    const events: ExerciseEvent[] = []
    durations.forEach((duration, i) => {
      const first = m === 0 && i === 0
      if (options.rests && !first && !last && duration <= 8 && random() < 0.18) {
        events.push({ duration, degree: null, midi: null })
        return
      }
      const previous = degree
      if (!first) degree = last ? closestTonic(degree, pool) : nextDegree(degree, pool, options.maxInterval, random)
      events.push({ duration, degree, midi: pitches.midi(degree, degree >= previous) })
    })
    measures.push(mergeRests(events))
  }
  return measures
}

interface PoolNote {
  degree: number
  midi: number
}

/** Index of the next note among notes chosen anywhere on the keyboard (two may share a letter, like Fa and Fa♯). */
function nextFreeNote(current: number, pool: PoolNote[], maxInterval: Interval, random: () => number): number {
  const moves = [{ value: current, weight: 1 }]
  pool.forEach((note, i) => {
    if (i === current) return
    // A semitone on the same letter (Fa–Fa♯) counts as a step.
    const interval = Math.max(2, Math.abs(note.degree - pool[current].degree) + 1) as Interval
    if (interval <= maxInterval) moves.push({ value: i, weight: INTERVAL_WEIGHTS[interval] })
  })
  // Chosen notes further apart than the widest interval are still reached from the next one up or down, so every chosen note comes up.
  for (const i of [current - 1, current + 1]) {
    if (pool[i] && !moves.some(m => m.value === i)) moves.push({ value: i, weight: moves.length === 1 ? 5 : 2 })
  }
  return pick(random, moves)
}

/** A reading melody on notes chosen anywhere on the keyboard, starting and ending on the tonic when it is among them. */
function freeMelody(options: ExerciseOptions, pool: PoolNote[], pitches: Pitches, random: () => number): ExerciseEvent[][] {
  const tonicClass = pitches.tonicMidi % 12
  const closestTonic = (midi: number) => {
    const tonics = pool.map((n, i) => ({ n, i })).filter(({ n }) => n.midi % 12 === tonicClass)
    if (tonics.length === 0) return 0
    return tonics.reduce((best, t) => (Math.abs(t.n.midi - midi) < Math.abs(best.n.midi - midi) ? t : best)).i
  }
  const length = measureLength(options.time)
  let index = closestTonic(pitches.tonicMidi)
  const measures: ExerciseEvent[][] = []
  for (let m = 0; m < options.measures; m++) {
    const last = m === options.measures - 1
    const durations = last ? [length] : rhythmForMeasure(options.time, options.rhythm, random)
    const events: ExerciseEvent[] = []
    durations.forEach((duration, i) => {
      const first = m === 0 && i === 0
      if (options.rests && !first && !last && duration <= 8 && random() < 0.18) {
        events.push({ duration, degree: null, midi: null })
        return
      }
      if (!first) index = last ? closestTonic(pool[index].midi) : nextFreeNote(index, pool, options.maxInterval, random)
      events.push({ duration, degree: pool[index].degree, midi: pool[index].midi })
    })
    measures.push(mergeRests(events))
  }
  return measures
}

/** Left hand of a two-staff reading exercise: the root of the chord that goes with each measure. */
function bassLine(options: ExerciseOptions, pitches: Pitches, harmony: Harmony): ExerciseEvent[][] {
  const length = measureLength(options.time)
  return Array.from({ length: options.measures }, (_, m) => {
    const chord = harmony.slots.find(s => s.measure === m)?.degree ?? 0
    // VI goes below the tonic, so the left hand stays near it.
    const degree = chord > 4 ? chord - 7 : chord
    return [{ duration: length, degree, midi: pitches.midi(degree) }]
  })
}

function harmonyFor(options: ExerciseOptions, key: KeyDefinition, melody: ExerciseEvent[][], split: boolean): Harmony {
  return harmonize(melody, {
    tonic: (LETTER_SEMITONES[key.letter] + key.alter + 12) % 12,
    letter: key.letter,
    mode: key.mode,
    time: options.time,
    measureLength: measureLength(options.time),
    beatLength: beatLength(options.time),
    split,
  })
}

/** Figure used for each note of a scale. */
function scaleNoteLength(time: TimeSignature, level: RhythmLevel): number {
  if (level === 1) return { '2/4': 8, '3/4': 12, '4/4': 8, '6/8': 6 }[time]
  if (level === 2) return time === '6/8' ? 2 : 4
  return level === 3 ? 2 : 1
}

interface LineNote {
  degree: number
  ascending: boolean
  finger?: number
}

/** Two octaves on the flute go from the tonic in the low octave up to the third octave (as high as B6). */
function scaleOctaves(options: ExerciseOptions): number {
  return options.range === 3 || options.range === 4 ? 2 : 1
}

/** Up and down the scale. */
function scaleNotes(octaves: number): LineNote[] {
  const top = 7 * octaves
  return [
    ...Array.from({ length: top + 1 }, (_, i) => ({ degree: i, ascending: true })),
    ...Array.from({ length: top }, (_, i) => ({ degree: top - 1 - i, ascending: false })),
  ]
}

/** Arpeggio fingering going up, for each hand and number of octaves; going down it is played backwards. */
const ARPEGGIO_FINGERS: Record<'treble' | 'bass', Record<number, number[]>> = {
  treble: { 1: [1, 2, 3, 5], 2: [1, 2, 3, 1, 2, 3, 5] },
  bass: { 1: [5, 4, 2, 1], 2: [5, 4, 2, 1, 4, 2, 1] },
}

/**
 * Up and down the tonic chord. Piano arpeggios on a white-key tonic carry the usual fingering
 * (right hand 1 2 3 5, left hand 5 4 2 1); those starting on a black key are fingered differently
 * from key to key, so they are left without it.
 */
function arpeggioNotes(octaves: number, pitches: Pitches, clef: 'treble' | 'bass', fingered: boolean): LineNote[] {
  const up = Array.from({ length: 3 * octaves + 1 }, (_, i) => 7 * Math.floor(i / 3) + [0, 2, 4][i % 3])
  const whiteTonic = LETTER_SEMITONES.includes(((pitches.tonicMidi % 12) + 12) % 12)
  const fingers = fingered && whiteTonic ? ARPEGGIO_FINGERS[clef][octaves] : undefined
  return [
    ...up.map((degree, i) => ({ degree, ascending: true, finger: fingers?.[i] })),
    ...up.slice(0, -1).reverse().map((degree, i) => ({ degree, ascending: false, finger: fingers?.[up.length - 2 - i] })),
  ]
}

/** The notes of a scale or arpeggio exercise. Scale and arpeggio share the tonic between them. */
function lineNotes(options: ExerciseOptions, pitches: Pitches, clef: 'treble' | 'bass'): LineNote[] {
  const octaves = scaleOctaves(options)
  const fingered = options.instrument === 'piano'
  if (options.kind === 'arpeggio') return arpeggioNotes(octaves, pitches, clef, fingered)
  if (options.kind === 'scale-arpeggio') return [...scaleNotes(octaves).slice(0, -1), ...arpeggioNotes(octaves, pitches, clef, fingered)]
  return scaleNotes(octaves)
}

/** Even notes up and down, ending on a long tonic. Two octaves for the wide range. */
function scaleLine(options: ExerciseOptions, pitches: Pitches, clef: 'treble' | 'bass'): ExerciseEvent[][] {
  const notes = lineNotes(options, pitches, clef)
    .map(({ degree, ascending, finger }) => ({ degree, midi: pitches.midi(degree, ascending), ...(finger ? { finger } : {}) }))
  return evenLine(options, notes)
}

/** Sharps for the black keys going up, flats going down. */
const SHARP_SPELLING = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]]
const FLAT_SPELLING = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]]

/**
 * Piano chromatic fingering: 3 on the black keys and 1 on the white ones, with 2 where two white keys
 * meet (Fa and Do in the right hand, Mi and Si in the left). The first and last notes start the hand with 1 on a white key.
 */
function chromaticFinger(midi: number, clef: 'treble' | 'bass', edge: boolean): number {
  const pitchClass = midi % 12
  if (!LETTER_SEMITONES.includes(pitchClass)) return 3
  if (edge) return 1
  return (clef === 'treble' ? [0, 5] : [4, 11]).includes(pitchClass) ? 2 : 1
}

/** Every semitone up and down from the starting note, one or two octaves. */
function chromaticLine(options: ExerciseOptions, pitches: Pitches, clef: 'treble' | 'bass'): ExerciseEvent[][] {
  const start = chromaticStart(options)
  const top = 12 * scaleOctaves(options)
  const steps = [...Array.from({ length: top + 1 }, (_, i) => i), ...Array.from({ length: top }, (_, i) => top - 1 - i)]
  const notes = steps.map((step, i) => {
    const midi = pitches.tonicMidi + step
    const pitchClass = midi % 12
    const [letter, alter] = pitchClass === start.pitchClass ? [start.letter, start.alter]
      : (i <= top ? SHARP_SPELLING : FLAT_SPELLING)[pitchClass]
    const octave = Math.floor((midi - alter) / 12) - 1
    const degree = 7 * octave + letter - pitches.position(0)
    const finger = options.instrument === 'piano' ? chromaticFinger(midi, clef, i === 0 || i === steps.length - 1) : undefined
    return { degree, midi, ...(finger ? { finger } : {}) }
  })
  return evenLine(options, notes)
}

/** Lays out notes of the same length in measures; the last one lasts until the end of its measure. */
function evenLine(options: ExerciseOptions, notes: Omit<ExerciseEvent, 'duration'>[]): ExerciseEvent[][] {
  const noteLength = scaleNoteLength(options.time, options.rhythm)
  const length = measureLength(options.time)
  const measures: ExerciseEvent[][] = []
  let current: ExerciseEvent[] = []
  let position = 0
  const push = (event: ExerciseEvent) => {
    current.push(event)
    position += event.duration
    if (position === length) {
      measures.push(current)
      current = []
      position = 0
    }
  }
  notes.forEach((note, i) => {
    if (i < notes.length - 1) return push({ ...note, duration: noteLength })
    // The last tonic lasts until the end of the measure (or a whole measure on the downbeat).
    const remaining = position === 0 ? length : length - position
    const [first, ...rest] = writableDurations(remaining)
    push({ ...note, duration: first })
    for (const d of rest) push({ duration: d, degree: null, midi: null })
  })
  return measures
}

const LINE_TITLES: Record<Exclude<ExerciseKind, 'reading'>, string> = {
  scale: 'Escala', arpeggio: 'Arpegio', 'scale-arpeggio': 'Escala y arpegio', chromatic: 'Escala cromática',
}

export function generateExercise(options: ExerciseOptions, seed: number): Exercise {
  if (options.instrument === 'cornet') return generateCornetExercise(options, seed)
  const random = seededRandom(seed)
  const key = exerciseKey(options)
  const clef: Clef = options.instrument !== 'piano' ? 'treble' : options.clef
  const opts = { ...options, clef, minor: options.minor ?? 'harmonic', maxInterval: options.maxInterval ?? defaultMaxInterval(options.range) }
  const name = key.mode === 'minor' ? `${key.name} ${MINOR_SCALE_NAMES[opts.minor]}` : key.name
  const staves: ExerciseStaff[] = []
  const tempo = opts.time === '6/8' ? 90 : opts.kind !== 'reading' ? 72 : 80

  if (opts.kind === 'chromatic') {
    for (const staffClef of clef === 'grand' ? (['treble', 'bass'] as const) : [clef]) {
      staves.push({ clef: staffClef, measures: chromaticLine(opts, new Pitches(key, staffClef), staffClef) })
    }
    // No chords fit every semitone, so the chromatic scale goes without accompaniment.
    const harmony = { ...harmonyFor(opts, key, staves[0].measures, false), slots: [] }
    return { title: `${LINE_TITLES.chromatic} · ${key.name}`, options: { ...opts, accompaniment: 'off' }, staves, tempo, harmony }
  }

  if (opts.kind !== 'reading') {
    for (const staffClef of clef === 'grand' ? (['treble', 'bass'] as const) : [clef]) {
      staves.push({ clef: staffClef, measures: scaleLine(opts, new Pitches(key, staffClef, opts.minor), staffClef) })
    }
    const harmony = harmonyFor(opts, key, staves[0].measures, opts.time === '4/4')
    // The arpeggio alone is the same in every minor scale.
    return { title: `${LINE_TITLES[opts.kind]} · ${opts.kind === 'arpeggio' ? key.name : name}`, options: opts, staves, tempo, harmony }
  }

  const melodyClef = clef === 'bass' ? 'bass' : 'treble'
  staves.push({ clef: melodyClef, measures: readingMelody(opts, melodyClef, new Pitches(key, melodyClef, opts.minor), random) })
  // With a written left hand, one chord per measure so the accompaniment matches it.
  const harmony = harmonyFor(opts, key, staves[0].measures, clef !== 'grand' && opts.time === '4/4')
  if (clef === 'grand') staves.push({ clef: 'bass', measures: bassLine(opts, new Pitches(key, 'bass', opts.minor), harmony) })
  return { title: `Lectura · ${name}`, options: opts, staves, tempo, harmony }
}

// --- Cornet -----------------------------------------------------------------

/**
 * The natural notes of the cornet in Do with a rotor to Re♭, written as the teacher wrote them:
 * Do position (rotor off) Sol4 Do5 Mi5 Sol5 Do6 Re6 Mi6, Re♭ position (rotor on) the same a semitone up.
 */
export interface CornetNote {
  midi: number
  pitch: { step: string; alter: number; octave: number }
  position: Exclude<CornetPosition, 'both'>
  /** Spanish name with its octave, e.g. "Re♭5". */
  name: string
}

const CORNET_DO: [string, number][] = [['G', 4], ['C', 5], ['E', 5], ['G', 5], ['C', 6], ['D', 6], ['E', 6]]
const CORNET_REB: [string, number, number][] = [['A', -1, 4], ['D', -1, 5], ['F', 0, 5], ['A', -1, 5], ['D', -1, 6], ['E', -1, 6], ['F', 0, 6]]

function cornetNote(step: string, alter: number, octave: number, position: CornetNote['position']): CornetNote {
  const letter = LETTER_NAMES.indexOf(step)
  return {
    midi: 12 * (octave + 1) + LETTER_SEMITONES[letter] + alter, pitch: { step, alter, octave }, position,
    name: LETTER_NAMES_ES[letter] + (alter < 0 ? '♭' : '') + octave,
  }
}

/** All cornet notes, low to high. */
export const CORNET_NOTES: CornetNote[] = [
  ...CORNET_DO.map(([step, octave]) => cornetNote(step, 0, octave, 'do')),
  ...CORNET_REB.map(([step, alter, octave]) => cornetNote(step, alter, octave, 'reb')),
].sort((a, b) => a.midi - b.midi)

export const CORNET_COLORS: Record<CornetNote['position'], string> = { do: '#1d5fd1', reb: '#d42a2a' }

export const CORNET_POSITION_NAMES: Record<CornetPosition, string> = { do: 'Do', reb: 'Re♭', both: 'Do y Re♭' }

/** The notes of one position, or of both. */
export function cornetNotes(position: CornetPosition = 'do'): CornetNote[] {
  return CORNET_NOTES.filter(n => position === 'both' || n.position === position)
}

/**
 * Cornet exercises are written without key signature, each note with its accidental, as on the
 * teacher's sheet. The accompaniment plays in Do or Re♭ major; both positions together have no key.
 */
function cornetKey(options: ExerciseOptions): KeyDefinition {
  const reb = options.cornetPosition === 'reb'
  return { id: reb ? 'cornet-reb' : 'cornet-do', name: reb ? 'Re♭' : 'Do', letter: reb ? 1 : 0, alter: reb ? -1 : 0, fifths: 0, mode: 'major' }
}

function cornetEvent(note: CornetNote, index: number, colors: boolean): Omit<ExerciseEvent, 'duration'> {
  return { degree: index, midi: note.midi, pitch: note.pitch, ...(colors ? { color: CORNET_COLORS[note.position] } : {}) }
}

/**
 * The notes a cornet reading line may use: like the other instruments' "Notas", counted on each
 * position's natural notes from the lowest: 3 notes, 5 notes, an octave (Sol4–Sol5, La♭4–La♭5),
 * all of them (with leaps, two octaves) or notes chosen one by one.
 */
export function cornetReadingNotes(options: ExerciseOptions): CornetNote[] {
  const all = cornetNotes(options.cornetPosition)
  if (options.range === 5) {
    const chosen = all.filter(n => options.cornetChosen?.includes(n.midi))
    if (chosen.length >= 2) return chosen
  }
  const range = options.range === 5 ? 1 : options.range
  const lowest = (n: CornetNote) => cornetNotes(n.position)[0].midi
  return all.filter(n => {
    const index = cornetNotes(n.position).indexOf(n)
    return range === 0 ? index < 3 : range === 1 ? index < 5 : range === 2 ? n.midi <= lowest(n) + 12 : true
  })
}

/** What "Elegir notas" starts with on the cornet: the three lowest notes of the position(s). */
export function defaultCornetChosen(options: ExerciseOptions): number[] {
  return cornetNotes(options.cornetPosition).slice(0, 3).map(n => n.midi)
}

/** Staff position (7 × octave + letter) of a cornet note, to measure intervals as written. */
export function cornetStaffPosition(note: CornetNote): number {
  return 7 * note.pitch.octave + LETTER_NAMES.indexOf(note.pitch.step)
}

/** A reading line on the position's notes: starts on Do (or Re♭), moves mostly to near notes and ends on the closest Do or Re♭. */
function cornetMelody(options: ExerciseOptions, pool: CornetNote[], random: () => number): ExerciseEvent[][] {
  const colors = !!options.cornetColors
  const found = pool.map((n, i) => (n.pitch.step === 'C' || (n.pitch.step === 'D' && n.pitch.alter === -1) ? i : -1)).filter(i => i >= 0)
  // Chosen notes without Do or Re♭: start and end on the lowest one.
  const tonics = found.length ? found : [0]
  const closestTonic = (i: number) => tonics.reduce((best, t) => (Math.abs(t - i) < Math.abs(best - i) ? t : best))
  const length = measureLength(options.time)
  // Starting on any of the Do (or Re♭) in use, so the line does not always begin at the bottom.
  let index = tonics[Math.floor(random() * tonics.length)]
  const measures: ExerciseEvent[][] = []
  for (let m = 0; m < options.measures; m++) {
    const last = m === options.measures - 1
    const durations = last ? [length] : rhythmForMeasure(options.time, options.rhythm, random)
    const events: ExerciseEvent[] = []
    durations.forEach((duration, i) => {
      const first = m === 0 && i === 0
      if (options.rests && !first && !last && duration <= 8 && random() < 0.18) {
        events.push({ duration, degree: null, midi: null })
        return
      }
      if (last) index = closestTonic(index)
      else if (!first) {
        // On the cornet the next note up or down is always a step, even when the gap between two natural notes
        // is wider than the chosen interval (Sol5–Do6 is a 4ª): otherwise the line could never cross it.
        // The interval limits only the leaps over other notes. Neighbouring notes are the most common.
        const here = cornetStaffPosition(pool[index])
        const moves = [{ value: 0, weight: 1 }]
        for (let j = 0; j < pool.length; j++) {
          const span = Math.abs(cornetStaffPosition(pool[j]) - here) + 1
          const steps = Math.abs(j - index)
          if (steps === 1) moves.push({ value: j - index, weight: 5 })
          else if (j !== index && span <= options.maxInterval) moves.push({ value: j - index, weight: steps === 2 ? 2 : 1 })
        }
        index += pick(random, moves)
      }
      events.push({ ...cornetEvent(pool[index], index, colors), duration })
    })
    measures.push(mergeRests(events))
  }
  return measures
}

function generateCornetExercise(options: ExerciseOptions, seed: number): Exercise {
  const random = seededRandom(seed)
  const position = options.cornetPosition ?? 'do'
  const kind = options.kind === 'reading' ? 'reading' : 'scale'
  const opts: ExerciseOptions = {
    ...options, kind, clef: 'treble', cornetPosition: position, minor: options.minor ?? 'harmonic',
    maxInterval: options.maxInterval ?? defaultMaxInterval(options.range),
  }
  const key = cornetKey(opts)
  const pool = cornetNotes(position)
  const tempo = opts.time === '6/8' ? 90 : kind === 'reading' ? 80 : 72
  let measures: ExerciseEvent[][]
  if (kind === 'scale') {
    const up = pool.map((n, i) => cornetEvent(n, i, !!opts.cornetColors))
    measures = evenLine(opts, [...up, ...up.slice(0, -1).reverse()])
  } else {
    measures = cornetMelody(opts, cornetReadingNotes(opts), random)
  }
  const staves: ExerciseStaff[] = [{ clef: 'treble', measures }]
  const harmony = harmonyFor(opts, key, measures, opts.time === '4/4')
  const title = kind === 'scale'
    ? (position === 'both' ? 'Corneta · Escala completa' : `Corneta · Escala en ${CORNET_POSITION_NAMES[position]}`)
    : `Corneta · Lectura en ${CORNET_POSITION_NAMES[position]}`
  // Both positions together have no key, so no chords fit them.
  if (position === 'both') return { title, options: { ...opts, accompaniment: 'off' }, staves, tempo, harmony: { ...harmony, slots: [] } }
  return { title, options: opts, staves, tempo, harmony }
}

// --- MusicXML ---------------------------------------------------------------

/** Beam values for each event: notes shorter than a quarter inside the same beat are joined. */
function beams(events: ExerciseEvent[], beat: number): string[][] {
  const result: string[][] = events.map(() => [])
  let position = 0
  const starts = events.map(e => {
    const start = position
    position += e.duration
    return start
  })
  let i = 0
  while (i < events.length) {
    const beatIndex = Math.floor(starts[i] / beat)
    let j = i
    while (j < events.length && events[j].midi !== null && events[j].duration < 4
      && Math.floor(starts[j] / beat) === beatIndex && starts[j] + events[j].duration <= (beatIndex + 1) * beat) j++
    if (j - i >= 2) {
      for (let k = i; k < j; k++) {
        const first = k === i ? 'begin' : k === j - 1 ? 'end' : 'continue'
        result[k].push(`<beam number="1">${first}</beam>`)
        if (events[k].duration === 1) {
          const prev = k > i && events[k - 1].duration === 1
          const next = k < j - 1 && events[k + 1].duration === 1
          const second = prev && next ? 'continue' : prev ? 'end' : next ? 'begin' : k === i ? 'forward hook' : 'backward hook'
          result[k].push(`<beam number="2">${second}</beam>`)
        }
      }
      i = j
    } else {
      i = Math.max(j, i + 1)
    }
  }
  return result
}

function noteXml(event: ExerciseEvent, pitches: Pitches, staff: number, beamTags: string[], wholeMeasure: boolean, chord?: string): string {
  const { type, dot } = DURATION_TYPES[event.duration]
  const voice = staff === 1 ? 1 : 5
  let head: string
  if (event.degree === null) {
    head = wholeMeasure ? '<rest measure="yes"/>' : '<rest/>'
  } else {
    const { step, alter, octave } = event.pitch ?? pitches.spell(event.degree, event.midi!)
    head = `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`
  }
  const fingering = event.finger
    ? `<notations><technical><fingering placement="${staff === 1 ? 'above' : 'below'}">${event.finger}</fingering></technical></notations>`
    : ''
  const color = event.color && event.midi !== null ? ` color="${event.color}"` : ''
  return `<note${color}>${head}<duration>${event.duration}</duration><voice>${voice}</voice><type>${type}</type>${dot ? '<dot/>' : ''}`
    + `<staff>${staff}</staff>${beamTags.join('')}${fingering}`
    // Chord names go as lyrics: the score lines them all up on one row under the staff.
    + (chord ? `<lyric number="1" name="acordes" placement="below"><syllabic>single</syllabic><text>${chord}</text></lyric>` : '')
    + '</note>'
}

const PART_NAMES: Record<Instrument, string> = { piano: 'Piano', flute: 'Flauta', cornet: 'Corneta' }

export interface MusicXmlOptions {
  /** Writes the name of each accompaniment chord (C, Am, G…) under the first staff. */
  chords?: boolean
}

export function exerciseToMusicXml(exercise: Exercise, { chords: withChords = false }: MusicXmlOptions = {}): string {
  const { options, staves, tempo } = exercise
  const key = exerciseKey(options)
  const [beats, beatType] = options.time.split('/')
  const length = measureLength(options.time)
  const partName = PART_NAMES[options.instrument] ?? 'Piano'
  const clefXml = (clef: 'treble' | 'bass', n: number) =>
    `<clef number="${n}">${clef === 'treble' ? '<sign>G</sign><line>2</line>' : '<sign>F</sign><line>4</line>'}</clef>`
  const metronome = options.time === '6/8'
    ? `<beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>${Math.round(tempo / 1.5)}</per-minute>`
    : `<beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute>`
  const measureCount = staves[0].measures.length

  const measures: string[] = []
  for (let m = 0; m < measureCount; m++) {
    let xml = `<measure number="${m + 1}">`
    if (m === 0) {
      xml += `<attributes><divisions>${DIVISIONS}</divisions>`
        + `<key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>`
        + `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>`
        + (staves.length > 1 ? `<staves>${staves.length}</staves>` : '')
        + staves.map((s, i) => clefXml(s.clef, i + 1)).join('')
        + '</attributes>'
        + `<direction placement="above"><direction-type><metronome>${metronome}</metronome></direction-type>`
        + `<staff>1</staff><sound tempo="${tempo}"/></direction>`
    }
    staves.forEach((staff, s) => {
      if (s > 0) xml += `<backup><duration>${length}</duration></backup>`
      const events = staff.measures[m]
      const pitches = new Pitches(key, staff.clef, options.minor)
      const beamTags = beams(events, beatLength(options.time))
      const chords = s === 0 && withChords ? exercise.harmony.slots.filter(slot => slot.measure === m) : []
      const named = new Set<number>()
      let position = 0
      events.forEach((event, i) => {
        // Under the first note of each chord (after a rest when it starts on one).
        const chord = event.midi === null ? undefined
          : chords.find(c => !named.has(c.start) && position >= c.start && position < c.start + c.length)
        if (chord) named.add(chord.start)
        xml += noteXml(event, pitches, s + 1, beamTags[i], events.length === 1, chord && chordName(chord, exercise.harmony))
        position += event.duration
      })
    })
    if (m === measureCount - 1) xml += '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
    measures.push(xml + '</measure>')
  }

  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<score-partwise version="3.1">'
    + `<movement-title>${exercise.title}</movement-title>`
    + `<part-list><score-part id="P1"><part-name>${partName}</part-name></score-part></part-list>`
    + `<part id="P1">${measures.join('')}</part>`
    + '</score-partwise>'
}
