import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { extractTimeline } from './osmdTimeline'
import type { Timeline } from './timeline'

/** Owns the OSMD instance: renders a score and moves its cursor to a given step. */
export class ScoreController {
  private osmd: OpenSheetMusicDisplay
  private position = 0
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

  async load(url: string): Promise<Timeline> {
    await this.osmd.load(url)
    this.osmd.render()
    this.osmd.cursor.show()
    this.timeline = extractTimeline(this.osmd)
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

  setZoom(zoom: number): void {
    this.osmd.Zoom = zoom
    this.osmd.render()
    // render() rebuilds the cursor, so restore its position.
    const step = this.position
    this.osmd.cursor.show()
    this.osmd.cursor.reset()
    this.position = 0
    this.goTo(step)
  }

  dispose(): void {
    this.osmd.clear()
  }
}
