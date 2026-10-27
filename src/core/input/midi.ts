import { noteBus, type NoteBus } from './bus'
import { parseMidiMessage } from './midiMessage'
import type { InputSource } from './types'

export interface MidiDevice {
  id: string
  name: string
}

export type MidiStatus =
  | { state: 'unsupported' }
  | { state: 'idle' }
  | { state: 'denied' }
  | { state: 'ready'; devices: MidiDevice[]; selected: string | null; connected: boolean }

type StatusListener = (status: MidiStatus) => void

const STORAGE_KEY = 'notelisa.midiDevice'

function rememberDevice(name: string | null): void {
  try {
    if (name) localStorage.setItem(STORAGE_KEY, name)
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage unavailable */ }
}

function rememberedDevice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * MIDI keyboard input. Lists devices, remembers the chosen one by name and
 * re-attaches automatically when it is unplugged and plugged in again.
 */
export class MidiInput implements InputSource {
  readonly kind = 'midi' as const
  private readonly bus: NoteBus
  private access: MIDIAccess | null = null
  private selectedName: string | null = rememberedDevice()
  private attached: MIDIInput | null = null
  private listeners = new Set<StatusListener>()
  private status: MidiStatus

  constructor(bus: NoteBus = noteBus) {
    this.bus = bus
    this.status = MidiInput.isSupported() ? { state: 'idle' } : { state: 'unsupported' }
  }

  /** Safari on iPhone/iPad (and Firefox before v108) has no Web MIDI. */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  }

  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {
    if (!MidiInput.isSupported() || this.access) return
    try {
      this.access = await navigator.requestMIDIAccess()
    } catch {
      this.setStatus({ state: 'denied' })
      return
    }
    this.access.onstatechange = () => this.refresh()
    this.refresh()
  }

  stop(): void {
    if (this.attached) this.attached.onmidimessage = null
    this.attached = null
    if (this.access) this.access.onstatechange = null
    this.access = null
    this.setStatus(MidiInput.isSupported() ? { state: 'idle' } : { state: 'unsupported' })
  }

  select(id: string | null): void {
    const input = id ? this.access?.inputs.get(id) : undefined
    this.selectedName = input?.name ?? null
    rememberDevice(this.selectedName)
    this.refresh()
  }

  private devices(): MIDIInput[] {
    return this.access ? [...this.access.inputs.values()] : []
  }

  private refresh(): void {
    const inputs = this.devices().filter(i => i.state === 'connected')
    // Pick the remembered device, or the only one plugged in.
    let target = inputs.find(i => i.name === this.selectedName) ?? null
    if (!target && !this.selectedName && inputs.length > 0) target = inputs[0]
    if (target !== this.attached) {
      if (this.attached) this.attached.onmidimessage = null
      this.attached = target
      if (target) {
        target.onmidimessage = event => {
          if (!event.data) return
          const note = parseMidiMessage(event.data, event.timeStamp)
          if (note) this.bus.emit(note)
        }
      }
    }
    this.setStatus({
      state: 'ready',
      devices: inputs.map(i => ({ id: i.id, name: i.name ?? 'Teclado MIDI' })),
      selected: this.attached?.id ?? null,
      connected: !!this.attached,
    })
  }

  private setStatus(status: MidiStatus): void {
    this.status = status
    for (const listener of this.listeners) listener(status)
  }
}

export const midiInput = new MidiInput()
