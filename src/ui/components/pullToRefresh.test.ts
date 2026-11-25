import { describe, expect, it } from 'vitest'
import { PULL_THRESHOLD, pullDistance } from './pullToRefresh'

describe('pullDistance', () => {
  it('follows the finger up to the threshold', () => expect(pullDistance(100, 10)).toBe(100))
  it('ignores pulls upwards', () => expect(pullDistance(-40, 0)).toBe(0))
  it('ignores sideways swipes', () => expect(pullDistance(60, 90)).toBe(0))
  it('slows down past the threshold', () => {
    expect(pullDistance(PULL_THRESHOLD + 100, 0)).toBe(PULL_THRESHOLD + 30)
  })
})
