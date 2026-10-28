import { OpenSheetMusicDisplay, PointF2D, type BoundingBox, type GraphicalNote } from 'opensheetmusicdisplay'
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
  private disposed = false

  constructor(container: HTMLElement) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawLyricist: true,
      drawCredits: true,
      drawPartNames: false,
      // Only the first measure of each line is numbered: numbers in between get mixed up with fingerings.
      drawMeasureNumbersOnlyAtSystemStart: true,
      followCursor: true,
      cursorsOptions: [{ type: 0, color: '#a457bd', alpha: 0.35, follow: true }],
    })
  }

  /** Loads a score from a URL or from MusicXML/MXL content already in memory. */
  async load(source: string): Promise<Timeline> {
    await this.osmd.load(source)
    // Disposed while loading (the screen changed score): drawing now would leave a
    // second copy of the score in the container.
    if (this.disposed) throw new Error('Score view closed while loading')
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

  /**
   * Index of the measure drawn under a point of the screen (clientX/clientY), or null
   * when the point is outside every measure (margins, title, space between lines).
   */
  measureAt(clientX: number, clientY: number): number | null {
    const sheet = this.osmd.GraphicSheet
    if (!sheet) return null
    const point = sheet.svgToOsmd(sheet.domToSvg(new PointF2D(clientX, clientY)))
    const measures = this.osmd.Sheet.SourceMeasures
    // Taps a little above or below the staves (fingerings, dynamics) still count.
    const margin = 2
    let best: { index: number; distance: number } | null = null
    for (const staves of sheet.MeasureList) {
      const measure = staves.find(m => m?.ParentMusicSystem)
      if (!measure) continue
      const box = measure.PositionAndShape
      const left = box.AbsolutePosition.x + box.BorderLeft
      const right = box.AbsolutePosition.x + box.BorderRight
      if (point.x < left || point.x > right) continue
      const system = measure.ParentMusicSystem.PositionAndShape
      const distance = distanceOutside(point.y, edge(system, 'top'), edge(system, 'bottom'))
      if (distance > margin || (best && best.distance <= distance)) continue
      const index = measures.indexOf(measure.parentSourceMeasure)
      if (index >= 0) best = { index, distance }
    }
    return best?.index ?? null
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
    this.disposed = true
    this.osmd.clear()
  }
}

function edge(box: BoundingBox, side: 'top' | 'bottom'): number {
  return box.AbsolutePosition.y + (side === 'top' ? box.BorderTop : box.BorderBottom)
}

/** How far a value lies outside a range (0 when inside). */
function distanceOutside(value: number, from: number, to: number): number {
  return value < from ? from - value : value > to ? value - to : 0
}
