/** Pull-to-refresh: how far the finger has to travel down, about 4 cm on a phone. */
export const PULL_THRESHOLD = 150

/** Where a pull cannot start: fields, sliders and the on-screen keyboards, whose own drags must not reload. */
const NO_PULL = 'input, textarea, select, [contenteditable="true"], .key, .keyboard-scroll, .pick-keyboard, [data-no-pull-refresh]'

/** Whether a pull can start on this element: nothing under it is scrolled down and it is not a control. */
export function canStartPull(target: Element | null): boolean {
  if (!target) return true
  if (target.closest(NO_PULL)) return false
  // An open window (modal) scrolls on its own; it starts only from its top too.
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.scrollTop > 0) return false
  }
  const page = document.scrollingElement
  return !page || page.scrollTop <= 0
}

/**
 * How far the indicator shows for a finger moved dy down and dx across.
 * Zero for a pull that goes up or more across than down, so a sideways swipe never reloads.
 * Past the threshold it slows down, like a rubber band.
 */
export function pullDistance(dy: number, dx: number): number {
  if (dy <= 0 || Math.abs(dx) > dy) return 0
  return dy <= PULL_THRESHOLD ? dy : PULL_THRESHOLD + (dy - PULL_THRESHOLD) * 0.3
}
