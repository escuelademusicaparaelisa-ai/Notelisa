import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '../../music/pitch'
import type { NoteInputEvent } from '../types'
import { FrameAnalyzer } from './analysis'
import { NoteTracker, type TrackerSettings } from './noteTracker'

// Renders piano-like tones (harmonics with exponential decay, and a short damper
// fade when the key is released) and feeds them through the real pitch detector
// and the tracker, like the microphone does.

const SAMPLE_RATE = 44100
const FRAME = 2048
const HOP = 512

interface Strike { midi: number; at: number; length: number; gain?: number; a4?: number }

function render(strikes: Strike[], seconds: number, noise = 0.001): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < out.length; i++) out[i] = random() * noise
  for (const s of strikes) {
    const f = midiToFrequency(s.midi, s.a4)
    const start = Math.round(s.at * SAMPLE_RATE)
    const end = Math.min(out.length, start + Math.round(s.length * SAMPLE_RATE))
    for (let i = start; i < end; i++) {
      const t = (i - start) / SAMPLE_RATE
      const release = Math.min(1, (end - i) / SAMPLE_RATE / 0.04)
      const envelope = Math.min(1, t / 0.005) * Math.exp(-t / 1.2) * release * (s.gain ?? 0.3)
      let v = 0
      for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * h * t) / h
      out[i] += v * envelope * 0.5
    }
  }
  return out
}

function track(signal: Float32Array, settings: Partial<TrackerSettings> = {}): NoteInputEvent[] {
  const analyzer = new FrameAnalyzer(FRAME, SAMPLE_RATE)
  const tracker = new NoteTracker({ threshold: 0.01, ...settings })
  const events: NoteInputEvent[] = []
  for (let start = 0; start + FRAME <= signal.length; start += HOP) {
    const time = ((start + FRAME) / SAMPLE_RATE) * 1000
    events.push(...tracker.process(analyzer.analyze(signal.subarray(start, start + FRAME), time)))
  }
  return events
}

const ons = (events: NoteInputEvent[]) => events.filter(e => e.type === 'noteon')

describe('NoteTracker with a simulated piano', () => {
  it('detects a single note', () => {
    const on = ons(track(render([{ midi: 64, at: 0.1, length: 1 }], 1.5)))
    expect(on.map(e => e.midi)).toEqual([64])
    expect(on[0].time).toBeLessThan(300)
  })

  it('detects a melody', () => {
    const melody = [64, 64, 65, 67, 67, 65, 64, 62]
    const strikes = melody.map((midi, i) => ({ midi, at: 0.1 + i * 0.4, length: 0.4 }))
    expect(ons(track(render(strikes, 3.6))).map(e => e.midi)).toEqual(melody)
  })

  it('does not count a sustained note twice', () => {
    expect(ons(track(render([{ midi: 60, at: 0.1, length: 3 }], 3.2)))).toHaveLength(1)
  })

  it('counts the same key struck again while still ringing', () => {
    const strikes = [{ midi: 67, at: 0.1, length: 2 }, { midi: 67, at: 0.7, length: 1.4 }]
    expect(ons(track(render(strikes, 2.2))).map(e => e.midi)).toEqual([67, 67])
  })

  it('works across the keyboard (low and high notes)', () => {
    const strikes = [{ midi: 41, at: 0.1, length: 0.8 }, { midi: 84, at: 1, length: 0.8 }]
    expect(ons(track(render(strikes, 2))).map(e => e.midi)).toEqual([41, 84])
  })

  it('ignores background noise below the threshold', () => {
    expect(track(render([], 1, 0.005))).toEqual([])
  })

  it('ignores a quiet note below the calibrated threshold', () => {
    expect(ons(track(render([{ midi: 64, at: 0.1, length: 1, gain: 0.01 }], 1.2), { threshold: 0.02 }))).toEqual([])
  })

  it('releases the note after silence', () => {
    const events = track(render([{ midi: 62, at: 0.1, length: 0.3 }], 1))
    expect(events.map(e => e.type)).toEqual(['noteon', 'noteoff'])
  })

  it('uses the calibrated tuning (piano tuned to A=432)', () => {
    const signal = render([{ midi: 69, at: 0.1, length: 1, a4: 432 }], 1.2)
    expect(ons(track(signal, { a4Hz: 432 })).map(e => e.midi)).toEqual([69])
  })
})
