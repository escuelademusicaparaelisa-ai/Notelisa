import { describe, expect, it } from 'vitest'
import type { AudioFrame } from './analysis'
import { checkLoudness, latencyFromClicks, thresholdFromNoise, tuningFromA } from './calibration'

const frame = (rms: number, frequency = 0, clarity = 0, time = 0): AudioFrame => ({ time, rms, frequency, clarity })

describe('thresholdFromNoise', () => {
  it('sits above the room noise', () => {
    expect(thresholdFromNoise([0.002, 0.003, 0.004, 0.0035].map(r => frame(r)))).toBeCloseTo(0.012)
  })
  it('never goes below a minimum in a silent room', () => {
    expect(thresholdFromNoise([frame(0), frame(0.0001)])).toBe(0.004)
  })
})

describe('checkLoudness', () => {
  const note = (rms: number) => Array.from({ length: 5 }, () => frame(rms, 261, 0.95))
  it('accepts a clearly loud note and keeps the threshold above the noise', () => {
    const result = checkLoudness(note(0.2), 0.005)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.threshold).toBeCloseTo(0.015)
  })
  it('lowers the threshold for a quiet piano that still stands out', () => {
    const result = checkLoudness(note(0.025), 0.005)
    expect(result.ok && result.threshold).toBeCloseTo(0.01)
  })
  it('reports a note too close to the noise', () => {
    expect(checkLoudness(note(0.015), 0.005)).toMatchObject({ ok: false, reason: 'tooQuiet' })
  })
  it('reports silence or unpitched noise', () => {
    expect(checkLoudness([frame(0.005)], 0.005)).toMatchObject({ ok: false, reason: 'silent' })
    expect(checkLoudness([frame(0.2, 0, 0.3)], 0.005)).toMatchObject({ ok: false, reason: 'silent' })
  })
})

describe('tuningFromA', () => {
  const heard = (hz: number) => Array.from({ length: 10 }, () => frame(0.1, hz, 0.95))
  it('finds A=440 from any octave', () => {
    const result = tuningFromA(heard(220), 0.01)
    expect(result.ok && result.a4Hz).toBeCloseTo(440)
  })
  it('measures a piano tuned low', () => {
    const result = tuningFromA(heard(864), 0.01)
    expect(result.ok && result.a4Hz).toBeCloseTo(432)
  })
  it('rejects a note that is not an A', () => {
    expect(tuningFromA(heard(261.6), 0.01)).toEqual({ ok: false, reason: 'notAnA' })
  })
  it('needs a clear pitch', () => {
    expect(tuningFromA([frame(0.1, 440, 0.5)], 0.01)).toEqual({ ok: false, reason: 'noPitch' })
  })
})

describe('latencyFromClicks', () => {
  // Frames every 10 ms with room noise and a click heard `delay` ms after each one.
  const recording = (clicks: number[], delay: number, clickRms: number, noise = 0.002) => {
    const frames: AudioFrame[] = []
    for (let t = 500; t < clicks[clicks.length - 1] + 500; t += 10) {
      const sinceClick = Math.min(...clicks.map(c => (t >= c + delay ? t - c - delay : Infinity)))
      frames.push(frame(sinceClick < 40 ? clickRms : noise, 0, 0, t))
    }
    return frames
  }

  it('takes the median delay', () => {
    expect(latencyFromClicks([1000, 1500, 2000], recording([1000, 1500, 2000], 70, 0.5), 0.01)).toBe(70)
  })
  it('hears clicks quieter than the playing threshold', () => {
    expect(latencyFromClicks([1000, 1500, 2000], recording([1000, 1500, 2000], 120, 0.012), 0.03)).toBe(120)
  })
  it('accepts clicks heard slightly before the estimated time', () => {
    expect(latencyFromClicks([1000, 1500, 2000], recording([1000, 1500, 2000], -40, 0.3), 0.01)).toBe(-40)
  })
  it('gives up when the clicks were not heard', () => {
    expect(latencyFromClicks([1000, 2000], [], 0.01)).toBeNull()
    expect(latencyFromClicks([1000, 1500], recording([1000, 1500], 50, 0.003), 0.01)).toBeNull()
  })
})
