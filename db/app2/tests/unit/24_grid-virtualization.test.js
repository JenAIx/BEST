/**
 * Tests for the data grid row virtualization window math
 * (grid-utils.computeVirtualWindow). The invariant that keeps the scrollbar
 * geometry and sticky headers correct:
 *   topPad + (end - start) * rowHeight + bottomPad === totalRows * rowHeight
 */

import { describe, it, expect } from 'vitest'
import { computeVirtualWindow } from 'src/shared/utils/grid-utils'

const HEIGHT_INVARIANT = (w, rowHeight, totalRows) =>
  w.topPad + (w.end - w.start) * rowHeight + w.bottomPad === totalRows * rowHeight

describe('grid-utils.computeVirtualWindow', () => {
  it('returns an empty window for zero rows', () => {
    const w = computeVirtualWindow({ scrollTop: 0, viewportHeight: 600, rowHeight: 40, totalRows: 0 })
    expect(w).toEqual({ start: 0, end: 0, topPad: 0, bottomPad: 0 })
  })

  it('starts at the top without top padding', () => {
    const w = computeVirtualWindow({ scrollTop: 0, viewportHeight: 600, rowHeight: 40, totalRows: 1000 })
    expect(w.start).toBe(0)
    expect(w.topPad).toBe(0)
    // 15 visible + 1 partial + 10 overscan below
    expect(w.end).toBe(26)
    expect(HEIGHT_INVARIANT(w, 40, 1000)).toBe(true)
  })

  it('windows the middle of a large list with overscan on both sides', () => {
    const w = computeVirtualWindow({ scrollTop: 4000, viewportHeight: 600, rowHeight: 40, totalRows: 1000 })
    // firstVisible = 100 → start 90 (overscan 10), end 100 + 16 + 10 = 126
    expect(w.start).toBe(90)
    expect(w.end).toBe(126)
    expect(w.topPad).toBe(90 * 40)
    expect(HEIGHT_INVARIANT(w, 40, 1000)).toBe(true)
  })

  it('compensates zoom: visual scroll offsets map back to layout rows', () => {
    const unzoomed = computeVirtualWindow({ scrollTop: 4000, viewportHeight: 600, rowHeight: 40, totalRows: 1000, zoom: 1 })
    // At zoom 0.5 everything on screen is half size: visual 2000px ≙ layout 4000px
    const zoomed = computeVirtualWindow({ scrollTop: 2000, viewportHeight: 300, rowHeight: 40, totalRows: 1000, zoom: 0.5 })
    expect(zoomed.start).toBe(unzoomed.start)
    expect(zoomed.end).toBe(unzoomed.end)
    expect(zoomed.topPad).toBe(unzoomed.topPad)
  })

  it('clamps at the end of the list without bottom padding', () => {
    const w = computeVirtualWindow({ scrollTop: 999999, viewportHeight: 600, rowHeight: 40, totalRows: 100 })
    expect(w.end).toBe(100)
    expect(w.bottomPad).toBe(0)
    expect(w.start).toBeLessThanOrEqual(100)
  })

  it('renders everything when the list is smaller than the viewport', () => {
    const w = computeVirtualWindow({ scrollTop: 0, viewportHeight: 800, rowHeight: 40, totalRows: 5 })
    expect(w.start).toBe(0)
    expect(w.end).toBe(5)
    expect(w.topPad).toBe(0)
    expect(w.bottomPad).toBe(0)
  })

  it('survives degenerate inputs (rowHeight/zoom 0) with fallbacks', () => {
    const w = computeVirtualWindow({ scrollTop: 100, viewportHeight: 600, rowHeight: 0, totalRows: 50, zoom: 0 })
    expect(w.start).toBeGreaterThanOrEqual(0)
    expect(w.end).toBeLessThanOrEqual(50)
    expect(Number.isFinite(w.topPad)).toBe(true)
  })
})
