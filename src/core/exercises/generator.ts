// Generates practice exercises (sight-reading lines and scales) as MusicXML, so
// they open in the practice screen like any other piece.

export type ExerciseKind = 'reading' | 'scale'
export type Clef = 'treble' | 'bass' | 'grand'
export type TimeSignature = '2/4' | '3/4' | '4/4' | '6/8'
/** 1 whole/half notes, 2 + quarters, 3 + eighths, 4 + dotted figures and sixteenths. */
export type RhythmLevel = 1 | 2 | 3 | 4
/** 0 three notes, 1 five notes, 2 one octave, 3 wider with hand position changes, 4 two octaves. */
export type RangeLevel = 0 | 1 | 2 | 3 | 4
/** A melodic interval, named as in music: 2 is a step, 3 a third … 8 an octave. */
export type Interval = 2 | 3 | 4 | 5 | 6 | 7 | 8

export const INTERVALS: Interval[] = [2, 3, 4, 5, 6, 7, 8]

/** Widest interval each range used before it could be chosen. */
export function defaultMaxInterval(range: RangeLevel): Interval {
  return range <= 1 ? 3 : range === 2 ? 5 : 8
}

/** Notes each range spans, counted like intervals (5 notes span a fifth). */
export const RANGE_NOTES: Record<RangeLevel, number> = { 0: 3, 1: 5, 2: 8, 3: 13, 4: 15 }

export interface ExerciseOptions {
  kind: ExerciseKind
  instrument: 'piano' | 'flute'
  clef: Clef
  key: string
  time: TimeSignature
  rhythm: RhythmLevel
  rests: boolean
  range: RangeLevel
  /** Widest interval between two notes of a reading exercise. */
  maxInterval: Interval
  measures: number
  /** Which minor scale minor keys use. */
  minor: MinorScale
}

export type MinorScale = 'natural' | 'harmonic' | 'melodic'

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

export const MINOR_SCALE_NAMES: Record<MinorScale, string> = { natural: 'natural', harmonic: 'armónica', melodic: 'melódica' }

/** One note or rest. `degree` counts scale steps from the tonic (0 = tonic, 7 = octave). */
export interface ExerciseEvent {
  duration: number
  degree: number | null
  midi: number | null
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

  /** MusicXML spelling of a degree sounding at `midi`. */
  spell(degree: number, midi: number): { step: string; alter: number; octave: number } {
    const total = this.key.letter + degree
    const letter = ((total % 7) + 7) % 7
    // The tonic's own octave: the tonic letter written below its sounding pitch.
    const tonicOctave = Math.floor((this.tonicMidi - this.key.alter) / 12) - 1
    const octave = tonicOctave + Math.floor(total / 7)
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

function degreeRange(pitches: Pitches, clef: 'treble' | 'bass', range: RangeLevel, instrument: ExerciseOptions['instrument']): { low: number; high: number } {
  let { low, high } = [{ low: 0, high: 2 }, { low: 0, high: 4 }, { low: 0, high: 7 }, { low: -3, high: 9 }, { low: -3, high: 11 }][range]
  const limits = instrument === 'flute' ? FLUTE_RANGE : CLEF_RANGE[clef]
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

function nextDegree(current: number, low: number, high: number, maxInterval: Interval, random: () => number): number {
  const moves = [{ value: 0, weight: 1 }]
  for (const interval of INTERVALS.filter(i => i <= maxInterval)) {
    const weight = INTERVAL_WEIGHTS[interval]
    moves.push({ value: interval - 1, weight }, { value: 1 - interval, weight })
  }
  const allowed = moves.filter(m => current + m.value >= low && current + m.value <= high)
  return current + pick(random, allowed)
}

/** The tonic (or its octave) closest to a degree, inside the range. */
function closestTonic(degree: number, low: number, high: number): number {
  const candidates = [-7, 0, 7, 14].filter(d => d >= low && d <= high)
  if (candidates.length === 0) return 0
  return candidates.reduce((best, d) => (Math.abs(d - degree) < Math.abs(best - degree) ? d : best))
}

function readingMelody(options: ExerciseOptions, clef: 'treble' | 'bass', pitches: Pitches, random: () => number): ExerciseEvent[][] {
  const { low, high } = degreeRange(pitches, clef, options.range, options.instrument)
  const length = measureLength(options.time)
  let degree = 0
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
      if (!first) degree = last ? closestTonic(degree, low, high) : nextDegree(degree, low, high, options.maxInterval, random)
      events.push({ duration, degree, midi: pitches.midi(degree, degree >= previous) })
    })
    measures.push(mergeRests(events))
  }
  return measures
}

/** Left hand of a two-staff reading exercise: one long note per measure (I, IV, V, I). */
function bassLine(options: ExerciseOptions, pitches: Pitches): ExerciseEvent[][] {
  const length = measureLength(options.time)
  const progression = [0, 3, 4, 0]
  return Array.from({ length: options.measures }, (_, m) => {
    const last = m === options.measures - 1
    const degree = last ? 0 : progression[m % progression.length]
    return [{ duration: length, degree, midi: pitches.midi(degree) }]
  })
}

/** Figure used for each note of a scale. */
function scaleNoteLength(time: TimeSignature, level: RhythmLevel): number {
  if (level === 1) return { '2/4': 8, '3/4': 12, '4/4': 8, '6/8': 6 }[time]
  if (level === 2) return time === '6/8' ? 2 : 4
  return level === 3 ? 2 : 1
}

/** Up and down the scale, ending on a long tonic. Two octaves for the wide range. */
function scaleLine(options: ExerciseOptions, pitches: Pitches): ExerciseEvent[][] {
  const octaves = options.range >= 3 && options.instrument === 'piano' ? 2 : 1
  const top = 7 * octaves
  const degrees = [...Array.from({ length: top + 1 }, (_, i) => i), ...Array.from({ length: top }, (_, i) => top - 1 - i)]
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
  degrees.forEach((degree, i) => {
    const ascending = i <= top
    if (i < degrees.length - 1) return push({ duration: noteLength, degree, midi: pitches.midi(degree, ascending) })
    // The last tonic lasts until the end of the measure (or a whole measure on the downbeat).
    const remaining = position === 0 ? length : length - position
    const [first, ...rest] = writableDurations(remaining)
    push({ duration: first, degree, midi: pitches.midi(degree, ascending) })
    for (const d of rest) push({ duration: d, degree: null, midi: null })
  })
  return measures
}

export function generateExercise(options: ExerciseOptions, seed: number): Exercise {
  const random = seededRandom(seed)
  const key = getKey(options.key)
  const clef: Clef = options.instrument === 'flute' ? 'treble' : options.clef
  const opts = { ...options, clef, minor: options.minor ?? 'harmonic', maxInterval: options.maxInterval ?? defaultMaxInterval(options.range) }
  const name = key.mode === 'minor' ? `${key.name} ${MINOR_SCALE_NAMES[opts.minor]}` : key.name
  const staves: ExerciseStaff[] = []
  const tempo = opts.time === '6/8' ? 90 : opts.kind === 'scale' ? 72 : 80

  if (opts.kind === 'scale') {
    for (const staffClef of clef === 'grand' ? (['treble', 'bass'] as const) : [clef]) {
      staves.push({ clef: staffClef, measures: scaleLine(opts, new Pitches(key, staffClef, opts.minor)) })
    }
    return { title: `Escala · ${name}`, options: opts, staves, tempo }
  }

  const melodyClef = clef === 'bass' ? 'bass' : 'treble'
  staves.push({ clef: melodyClef, measures: readingMelody(opts, melodyClef, new Pitches(key, melodyClef, opts.minor), random) })
  if (clef === 'grand') staves.push({ clef: 'bass', measures: bassLine(opts, new Pitches(key, 'bass', opts.minor)) })
  return { title: `Lectura · ${name}`, options: opts, staves, tempo }
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

function noteXml(event: ExerciseEvent, pitches: Pitches, staff: number, beamTags: string[], wholeMeasure: boolean): string {
  const { type, dot } = DURATION_TYPES[event.duration]
  const voice = staff === 1 ? 1 : 5
  let head: string
  if (event.degree === null) {
    head = wholeMeasure ? '<rest measure="yes"/>' : '<rest/>'
  } else {
    const { step, alter, octave } = pitches.spell(event.degree, event.midi!)
    head = `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`
  }
  return `<note>${head}<duration>${event.duration}</duration><voice>${voice}</voice><type>${type}</type>${dot ? '<dot/>' : ''}`
    + `<staff>${staff}</staff>${beamTags.join('')}</note>`
}

export function exerciseToMusicXml(exercise: Exercise): string {
  const { options, staves, tempo } = exercise
  const key = getKey(options.key)
  const [beats, beatType] = options.time.split('/')
  const length = measureLength(options.time)
  const partName = options.instrument === 'flute' ? 'Flauta' : 'Piano'
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
      events.forEach((event, i) => { xml += noteXml(event, pitches, s + 1, beamTags[i], events.length === 1) })
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
