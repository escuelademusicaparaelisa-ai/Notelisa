// Piano accompaniment for generated exercises. It works in two layers:
//  1. Harmony: for each measure (or half measure in 4/4) the chord of the key that fits the
//     melody best, preferring I, IV and V, starting on I and closing with V–I.
//  2. Style: the same chords played with a different pattern (Alberti bass, waltz, march, ballad).
// The accompaniment is only heard: it is not written on the score and is not checked.

import type { ExerciseEvent, TimeSignature } from './generator'

export type AccompanimentStyle = 'off' | 'classical' | 'waltz' | 'ballad' | 'march' | 'rock'
type Style = Exclude<AccompanimentStyle, 'off'>

export const ACCOMPANIMENT_NAMES: Record<AccompanimentStyle, string> = {
  off: 'Sin acompañamiento', classical: 'Clásico', waltz: 'Vals', ballad: 'Balada', march: 'Marcha', rock: 'Rock',
}

/** Styles that make sense in each time signature, the most natural first. */
const STYLES_BY_TIME: Record<TimeSignature, Style[]> = {
  '2/4': ['march', 'classical', 'ballad', 'rock'],
  '3/4': ['waltz', 'classical', 'ballad', 'rock'],
  '4/4': ['classical', 'ballad', 'march', 'rock'],
  '6/8': ['ballad', 'march', 'rock'],
}

export function stylesForTime(time: TimeSignature): Style[] {
  return STYLES_BY_TIME[time]
}

/** The style that will sound: one chosen for another time signature becomes this one's first style. */
export function resolveStyle(style: AccompanimentStyle | undefined, time: TimeSignature): AccompanimentStyle {
  if (!style || style === 'off') return 'off'
  const styles = stylesForTime(time)
  return styles.includes(style) ? style : styles[0]
}

// --- Harmony ------------------------------------------------------------------

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]

/** Chords to choose from (root as a scale degree) and how much each is preferred. */
const CANDIDATES: Record<'major' | 'minor', { degree: number; prior: number }[]> = {
  major: [{ degree: 0, prior: 1 }, { degree: 4, prior: 0.9 }, { degree: 3, prior: 0.9 }, { degree: 5, prior: 0.5 }, { degree: 1, prior: 0.45 }],
  minor: [{ degree: 0, prior: 1 }, { degree: 4, prior: 0.9 }, { degree: 3, prior: 0.9 }, { degree: 5, prior: 0.5 }, { degree: 2, prior: 0.35 }],
}

export interface ChordSlot {
  measure: number
  /** Start inside the measure and length, in sixteenth notes. */
  start: number
  length: number
  /** Root as a scale degree: 0 = I … 6 = VII. */
  degree: number
  /** Root, third and fifth, in semitones above the tonic. */
  tones: [number, number, number]
}

export interface Harmony {
  time: TimeSignature
  /** Pitch class of the tonic (0 = C). */
  tonic: number
  /** Letter of the tonic, 0 = C … 6 = B, to spell the chords. */
  letter: number
  /** Measure length in sixteenth notes. */
  measureLength: number
  slots: ChordSlot[]
  /** The melody sits low (bass clef): the accompaniment goes an octave up so it is not muddy. */
  low: boolean
}

/** Root, third and fifth of the chord on a degree. In minor, V is major (raised seventh). */
export function chordTones(degree: number, mode: 'major' | 'minor'): [number, number, number] {
  const scale = mode === 'major' ? MAJOR : degree === 4 ? HARMONIC_MINOR : NATURAL_MINOR
  return [scale[degree], scale[(degree + 2) % 7], scale[(degree + 4) % 7]]
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

/** The chord's name as written over a melody: C, Am, F#m, Bb, Bdim… spelled in the key. */
export function chordName(slot: Pick<ChordSlot, 'degree' | 'tones'>, harmony: Pick<Harmony, 'tonic' | 'letter'>): string {
  const letter = (harmony.letter + slot.degree) % 7
  const root = (harmony.tonic + slot.tones[0]) % 12
  const alter = ((root - LETTER_SEMITONES[letter] + 18) % 12) - 6
  const third = (slot.tones[1] - slot.tones[0] + 12) % 12
  const fifth = (slot.tones[2] - slot.tones[0] + 12) % 12
  const quality = fifth === 6 ? 'dim' : third === 3 ? 'm' : ''
  return LETTERS[letter] + (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)) + quality
}

export interface HarmonizeOptions {
  tonic: number
  letter: number
  mode: 'major' | 'minor'
  time: TimeSignature
  measureLength: number
  beatLength: number
  /** Two chords per measure are allowed (4/4), when the melody asks for them. */
  split: boolean
}

interface SlotNote { pc: number; weight: number }

/** Notes of the melody sounding inside a slot, weighted by length and by how strong their beat is. */
function slotNotes(events: ExerciseEvent[], start: number, end: number, beat: number): SlotNote[] {
  const notes: SlotNote[] = []
  let position = 0
  for (const event of events) {
    const from = position
    const to = position + event.duration
    position = to
    if (event.midi === null || to <= start || from >= end) continue
    const overlap = Math.min(to, end) - Math.max(from, start)
    const accent = from === start ? 2 : from >= start && from % beat === 0 ? 1.4 : from < start ? 0.6 : 1
    notes.push({ pc: ((event.midi % 12) + 12) % 12, weight: overlap * accent })
  }
  return notes
}

function score(notes: SlotNote[], tonic: number, tones: number[], prior: number): number {
  const pcs = tones.map(t => (tonic + t) % 12)
  const total = notes.reduce((sum, n) => sum + n.weight, 0)
  const fit = notes.reduce((sum, n) => sum + (pcs.includes(n.pc) ? n.weight : -0.7 * n.weight), 0)
  return fit + prior * 0.35 * Math.max(total, 1)
}

/** Chooses the chords that go with a melody (one list of events per measure). */
export function harmonize(melody: ExerciseEvent[][], options: HarmonizeOptions): Harmony {
  const { tonic, letter, mode, time, measureLength, beatLength, split } = options
  const last = melody.length - 1
  const candidates = CANDIDATES[mode]
  const slots: ChordSlot[] = []
  let previous = 0

  const choose = (notes: SlotNote[], penultimate: boolean): number => {
    if (notes.length === 0) return previous
    const total = notes.reduce((sum, n) => sum + n.weight, 0)
    let best = candidates[0].degree
    let bestScore = -Infinity
    for (const { degree, prior } of candidates) {
      let s = score(notes, tonic, chordTones(degree, mode), prior)
      if (previous === 4 && degree === 0) s += 0.2 * total // V resolves to I
      if (previous === 4 && degree === 3) s -= 0.2 * total // V back to IV sounds weak
      if (penultimate && degree === 4) s += 0.6 * total // cadence: V before the last I
      if (s > bestScore) {
        bestScore = s
        best = degree
      }
    }
    return best
  }

  melody.forEach((events, m) => {
    const half = measureLength / 2
    // A second chord only where a note starts, so its name has a note to stand under.
    let position = 0
    const noteAtHalf = events.some(e => {
      const at = position
      position += e.duration
      return at === half && e.midi !== null
    })
    const halves = split && noteAtHalf
    const push = (start: number, length: number, degree: number) => {
      const prev = slots[slots.length - 1]
      // The same chord twice in one measure is one longer chord.
      if (prev && prev.measure === m && prev.degree === degree) prev.length += length
      else slots.push({ measure: m, start, length, degree, tones: chordTones(degree, mode) })
      previous = degree
    }
    if (m === 0 || m === last) {
      // Start and end on the tonic chord. A first measure split in two may move on in its second half.
      if (m === 0 && halves && last > 0) {
        push(0, half, 0)
        push(half, half, choose(slotNotes(events, half, measureLength, beatLength), false))
      } else {
        push(0, measureLength, 0)
      }
      return
    }
    const penultimate = m === last - 1
    if (!halves) {
      push(0, measureLength, choose(slotNotes(events, 0, measureLength, beatLength), penultimate))
      return
    }
    push(0, half, choose(slotNotes(events, 0, half, beatLength), false))
    push(half, half, choose(slotNotes(events, half, measureLength, beatLength), penultimate))
  })

  const sounding = melody.flat().filter(e => e.midi !== null).map(e => e.midi!)
  const average = sounding.reduce((a, b) => a + b, 0) / Math.max(1, sounding.length)
  return { time, tonic, letter, measureLength, slots, low: average < 57 }
}

// --- Style --------------------------------------------------------------------

/** One accompaniment note. Times are in whole notes from the start of the exercise. */
export interface BackingNote {
  time: number
  duration: number
  midi: number
  velocity: number
}

/** The lowest note of a pitch class at or above `low`. */
function place(pc: number, low: number): number {
  return low + ((pc - low) % 12 + 12) % 12
}

/** A close triad near the middle of the left hand, moving as little as possible from the last one. */
function voicing(rootPc: number, tones: number[], center: number, previous: number[] | null): number[] {
  const intervals = tones.map(t => (t - tones[0] + 12) % 12)
  const options: number[][] = []
  for (let bottom = center - 6; bottom <= center + 5; bottom++) {
    for (let inversion = 0; inversion < 3; inversion++) {
      const pcs = [0, 1, 2].map(i => (rootPc + intervals[(i + inversion) % 3]) % 12)
      if (bottom % 12 !== pcs[0]) continue
      const notes = [bottom]
      for (const pc of pcs.slice(1)) notes.push(place(pc, notes[notes.length - 1] + 1))
      options.push(notes)
    }
  }
  const cost = (notes: number[]) => previous
    ? notes.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0)
    : Math.abs(notes[1] - center)
  return options.reduce((best, notes) => (cost(notes) < cost(best) ? notes : best))
}

/** The notes of the accompaniment in a style, ready to be played with the exercise. */
export function accompanimentNotes(harmony: Harmony, style: AccompanimentStyle): BackingNote[] {
  if (style === 'off') return []
  const { slots, measureLength, time, tonic } = harmony
  const shift = harmony.low ? 12 : 0
  const beat = time === '6/8' ? 6 : 4
  const notes: BackingNote[] = []
  const lastMeasure = slots[slots.length - 1]?.measure ?? 0
  let previousChord: number[] | null = null

  for (const slot of slots) {
    const at = slot.measure * measureLength + slot.start
    const add = (position: number, duration: number, midi: number, velocity: number) =>
      notes.push({ time: (at + position) / 16, duration: duration / 16, midi, velocity })
    const rootPc = (tonic + slot.tones[0]) % 12
    const third = (slot.tones[1] - slot.tones[0] + 12) % 12
    const fifth = (slot.tones[2] - slot.tones[0] + 12) % 12
    const bass = place(rootPc, 36 + shift)
    const bassFifth = bass + fifth
    const root = place(rootPc, 48 + shift)
    const chord = voicing(rootPc, slot.tones.map(t => (tonic + t) % 12), 55 + shift, previousChord)
    previousChord = chord
    const addChord = (position: number, duration: number, velocity: number) => {
      for (const midi of chord) add(position, duration, midi, velocity)
    }
    const length = slot.length

    // The last measure: one long chord over the bass, whatever the style.
    if (slot.measure === lastMeasure) {
      add(0, length, bass, 0.45)
      addChord(0, length, 0.32)
      continue
    }

    switch (style) {
      case 'classical': {
        // Alberti bass: low, high, middle, high in eighth notes.
        const figure = [root, root + fifth, root + third, root + fifth]
        for (let p = 0; p < length; p += 2) add(p, 2, figure[(p / 2) % 4], 0.36)
        break
      }
      case 'waltz': {
        // Bass on the first beat, chord on the other two.
        for (let p = 0; p < length; p += beat) {
          if (p === 0) add(p, beat, bass, 0.45)
          else addChord(p, beat - 1, 0.3)
        }
        break
      }
      case 'march': {
        if (beat === 6) {
          // 6/8: long bass and short chord in each beat, bass alternating root and fifth.
          for (let p = 0; p < length; p += beat) {
            add(p, 4, (p / beat) % 2 === 0 ? bass : bassFifth, 0.45)
            addChord(p + 4, 2, 0.3)
          }
        } else {
          // Bass on strong beats (root, then fifth) and chord on weak beats.
          const beatsPerMeasure = measureLength / beat
          for (let p = 0; p < length; p += beat) {
            const k = (slot.start + p) / beat
            if (k % 2 === 0) {
              const pair = slot.measure * Math.max(1, beatsPerMeasure / 2) + k / 2
              add(p, beat - 1, pair % 2 === 0 ? bass : bassFifth, 0.45)
            } else {
              addChord(p, 2, 0.3)
            }
          }
        }
        break
      }
      case 'rock': {
        // Boogie bass in eighth notes (root, fifth, sixth, fifth) and chords on the backbeat.
        const sixth = fifth === 6 ? fifth : third === 3 ? 8 : 9
        const figure = [bass, bass + fifth, bass + sixth, bass + fifth]
        for (let p = 0; p < length; p += 2) add(p, 2, figure[(p / 2) % 4], (slot.start + p) % beat === 0 ? 0.5 : 0.4)
        for (let p = 0; p < length; p += beat) {
          const k = (slot.start + p) / beat
          if (k % 2 === 1) addChord(p, 2, 0.34)
        }
        break
      }
      case 'ballad': {
        // Bass held through the chord and a broken chord rising above it, left ringing.
        add(0, length, bass, 0.42)
        const figure = [bass + fifth, bass + 12, bass + 12 + third, bass + 12]
        for (let p = 2; p < length; p += 2) add(p, length - p, figure[(p / 2 - 1) % 4], 0.3)
        break
      }
    }
  }
  return notes
}
