import * as Tone from 'tone'

// Metronome clicks. They are short noise bursts rather than beeps: a pitched beep
// would be heard by the microphone as a note.

export interface Click {
  /** AudioContext time in seconds. */
  at: number
  accent: boolean
}

const LOOKAHEAD_SECONDS = 0.3
const TICK_MS = 50

export class Metronome {
  private timer: number | null = null
  private buffers: { normal: AudioBuffer; accent: AudioBuffer } | null = null
  private sources: AudioBufferSourceNode[] = []

  private get context(): AudioContext {
    return Tone.getContext().rawContext as AudioContext
  }

  /**
   * Plays clicks given by `next(i)` (the i-th click, or null when there are no
   * more). Clicks are scheduled a little ahead of time so they stay steady.
   */
  start(next: (i: number) => Click | null): void {
    this.stop()
    const context = this.context
    const buffers = this.getBuffers(context)
    let i = 0
    let pending = next(0)
    const tick = () => {
      while (pending && pending.at < context.currentTime + LOOKAHEAD_SECONDS) {
        if (pending.at >= context.currentTime - 0.01) {
          const source = context.createBufferSource()
          source.buffer = pending.accent ? buffers.accent : buffers.normal
          source.connect(context.destination)
          source.start(pending.at)
          source.onended = () => { this.sources = this.sources.filter(s => s !== source) }
          this.sources.push(source)
        }
        pending = next(++i)
      }
      if (!pending) this.clearTimer()
    }
    tick()
    if (pending) this.timer = window.setInterval(tick, TICK_MS)
  }

  /** Steady clicks from a given time, with an accent every `beatsPerMeasure` beats. */
  startSteady(from: number, beatSeconds: number, beatsPerMeasure: number): void {
    this.start(i => ({ at: from + i * beatSeconds, accent: i % beatsPerMeasure === 0 }))
  }

  stop(): void {
    this.clearTimer()
    for (const source of this.sources) {
      try { source.stop() } catch { /* already finished */ }
    }
    this.sources = []
  }

  private clearTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  private getBuffers(context: AudioContext) {
    if (!this.buffers) {
      this.buffers = { normal: noiseBurst(context, 0.25, 0.02), accent: noiseBurst(context, 0.5, 0.03) }
    }
    return this.buffers
  }
}

function noiseBurst(context: AudioContext, volume: number, seconds: number): AudioBuffer {
  const length = Math.round(context.sampleRate * seconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * volume * Math.exp(-i / (length / 5))
  }
  return buffer
}

export const metronome = new Metronome()
