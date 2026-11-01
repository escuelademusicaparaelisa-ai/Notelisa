// Range of keys drawn on the on-screen keyboard.

/** Range shown when the piece fits in it: Do3 to Do6. */
export const DEFAULT_KEYBOARD_RANGE = { low: 48, high: 84 } as const

const PIANO_LOW = 21 // La0
const PIANO_HIGH = 108 // Do8

/**
 * Keys to draw so that every note of the piece fits. Keeps at least the default range
 * and widens it to whole octaves (from Do to Do) when the piece goes lower or higher.
 */
export function keyboardRange(midis: Iterable<number>): { low: number; high: number } {
  let low: number = DEFAULT_KEYBOARD_RANGE.low
  let high: number = DEFAULT_KEYBOARD_RANGE.high
  for (const m of midis) {
    if (m < low) low = m
    if (m > high) high = m
  }
  low = Math.max(PIANO_LOW, low - (low % 12))
  high = Math.min(PIANO_HIGH, high % 12 === 0 ? high : high + (12 - (high % 12)))
  return { low, high }
}
