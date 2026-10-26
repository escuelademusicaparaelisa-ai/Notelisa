import type { NoteInputEvent, NoteInputListener } from './types'

/** Fan-out point where every input source publishes its notes. */
export class NoteBus {
  private listeners = new Set<NoteInputListener>()

  subscribe(listener: NoteInputListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: NoteInputEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

/** The app-wide bus: practice modes listen here, input sources publish here. */
export const noteBus = new NoteBus()
