import { OpenSheetMusicDisplay, type GraphicalNote } from 'opensheetmusicdisplay'
import { extractTimeline } from './osmdTimeline'
import type { Timeline } from './timeline'

/** Owns the OSMD instance: renders a score and moves its cursor to a given step. */
export class ScoreController {
  private osmd: OpenSheetMusicDisplay
  private position = 0
  private colored: SVGElement[] = []
  // Drawn notes of every step, so any step can be painted (not only the one under the cursor).
  private stepNotes: GraphicalNote[][] = []
  timeline: Timeline | null = null

  constructor(container: HTMLElement) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawCredits: false,
      drawPartNames: false,
      followCursor: true,
      cursorsOptions: [{ type: 0, color: '#5b4bdb', alpha: 0.35, follow: true }],
    })
  }

  /** Loads a score from a URL or from MusicXML/MXL content already in memory. */
  async load(source: string): Promise<Timeline> {
    await this.osmd.load(source)
    this.osmd.render()
    this.osmd.cursor.show()
    this.timeline = extractTimeline(this.osmd)
    this.collectNotes()
    this.position = 0
    return this.timeline
  }

  get stepCount(): number {
    return this.timeline?.steps.length ?? 0
  }

  get currentStep(): number {
    return this.position
  }

  goTo(step: number): void {
    const target = Math.max(0, Math.min(step, this.stepCount - 1))
    const cursor = this.osmd.cursor
    if (target < this.position) {
      cursor.reset()
      this.position = 0
    }
    while (this.position < target && !cursor.Iterator.EndReached) {
      cursor.next()
      this.position++
    }
  }

  private collectNotes(): void {
    const cursor = this.osmd.cursor
    this.stepNotes = []
    cursor.reset()
    while (!cursor.Iterator.EndReached) {
      this.stepNotes.push(cursor.GNotesUnderCursor())
      cursor.next()
    }
    cursor.reset()
  }

  /** Paints the noteheads under the cursor (see colorStep). */
  colorCurrent(midis: readonly number[], color: string): void {
    this.colorStep(this.position, midis, color)
  }

  /**
   * Paints the noteheads of a step. Only notes whose MIDI number is listed are
   * painted, so a chord can turn green note by note.
   */
  colorStep(step: number, midis: readonly number[], color: string): void {
    for (const gNote of this.stepNotes[step] ?? []) {
      const note = gNote.sourceNote
      if (note.isRest() || !midis.includes(note.halfTone + 12)) continue
      const heads = (gNote as unknown as { getNoteheadSVGs?: () => HTMLElement[] }).getNoteheadSVGs?.() ?? []
      for (const head of heads) {
        for (const el of [head, ...head.querySelectorAll<SVGElement>('path')]) {
          el.setAttribute('fill', color)
          el.style.fill = color
          this.colored.push(el as SVGElement)
        }
      }
    }
  }

  clearColors(): void {
    for (const el of this.colored) {
      el.removeAttribute('fill')
      el.style.fill = ''
    }
    this.colored = []
  }

  setZoom(zoom: number): void {
    this.osmd.Zoom = zoom
    this.osmd.render()
    this.colored = []
    // render() rebuilds the cursor and the drawn notes, so restore its position.
    const step = this.position
    this.osmd.cursor.show()
    this.collectNotes()
    this.position = 0
    this.goTo(step)
  }

  dispose(): void {
    this.osmd.clear()
  }
}
