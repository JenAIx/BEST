/**
 * Unit tests for shared/utils/enrollment-timeline.js — the pure logic behind
 * the "Einschlüsse pro Monat" chart and the enrolment-window filter on the
 * study insights tab.
 */
import { describe, it, expect } from 'vitest'
import {
  addMonths,
  buildMonthlySeries,
  monthKey,
  parseGermanDate,
  summarizeMonthlySeries,
  toGermanDate,
} from '../../src/shared/utils/enrollment-timeline.js'

describe('enrollment-timeline: date helpers', () => {
  it('monthKey / addMonths roll over year boundaries', () => {
    expect(monthKey(new Date(2024, 0, 15))).toBe('2024-01')
    expect(addMonths('2024-11', 1)).toBe('2024-12')
    expect(addMonths('2024-12', 1)).toBe('2025-01')
    expect(addMonths('2024-01', -1)).toBe('2023-12')
    expect(addMonths('2024-03', 14)).toBe('2025-05')
  })

  it('parseGermanDate accepts DD.MM.YYYY and rejects impossible dates', () => {
    expect(parseGermanDate('15.09.2025')).toBe('2025-09-15')
    expect(parseGermanDate(' 01.01.2024 ')).toBe('2024-01-01')
    expect(parseGermanDate('31.02.2024')).toBeNull()
    expect(parseGermanDate('2024-01-01')).toBeNull()
    expect(parseGermanDate('1.1.2024')).toBeNull()
    expect(parseGermanDate('')).toBeNull()
    expect(parseGermanDate(null)).toBeNull()
  })

  it('toGermanDate round-trips ISO dates and tolerates timestamps', () => {
    expect(toGermanDate('2025-09-15')).toBe('15.09.2025')
    expect(toGermanDate('2025-09-15T10:00:00')).toBe('15.09.2025')
    expect(toGermanDate(null)).toBe('')
    expect(toGermanDate('garbage')).toBe('')
    expect(toGermanDate(parseGermanDate('16.09.2025'))).toBe('16.09.2025')
  })
})

describe('enrollment-timeline: buildMonthlySeries', () => {
  const rows = [
    { month: '2024-01', count: 27 },
    { month: '2024-03', count: 19 },
    { month: '2024-06', count: 2 },
  ]

  it('fills gaps from the first month up to `until` and accumulates', () => {
    const s = buildMonthlySeries(rows, { until: '2024-08' })
    expect(s.map((r) => r.month)).toEqual([
      '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08',
    ])
    expect(s.map((r) => r.count)).toEqual([27, 0, 19, 0, 0, 2, 0, 0])
    expect(s.map((r) => r.cumulative)).toEqual([27, 27, 46, 46, 46, 48, 48, 48])
    expect(s.every((r) => r.inWindow)).toBe(true)
  })

  it('never truncates data newer than `until`', () => {
    const s = buildMonthlySeries(rows, { until: '2024-02' })
    expect(s[s.length - 1].month).toBe('2024-06')
  })

  it('defaults `until` to the current month', () => {
    const s = buildMonthlySeries([{ month: '2024-01', count: 1 }])
    expect(s[s.length - 1].month).toBe(monthKey(new Date()))
  })

  it('marks months outside the enrolment window (month granularity, inclusive)', () => {
    const s = buildMonthlySeries(rows, { until: '2024-08', from: '2024-03-15', to: '2024-06-01' })
    const inWin = Object.fromEntries(s.map((r) => [r.month, r.inWindow]))
    expect(inWin['2024-02']).toBe(false)
    expect(inWin['2024-03']).toBe(true) // window starts mid-March → March counts as overlapping
    expect(inWin['2024-06']).toBe(true)
    expect(inWin['2024-07']).toBe(false)
  })

  it('handles open-ended windows', () => {
    const s = buildMonthlySeries(rows, { until: '2024-08', from: '2024-05-01' })
    expect(s.find((r) => r.month === '2024-04').inWindow).toBe(false)
    expect(s.find((r) => r.month === '2024-08').inWindow).toBe(true)
  })

  it('ignores malformed rows and merges duplicate months', () => {
    const s = buildMonthlySeries(
      [{ month: 'bad' }, { month: '2024-01', count: 1 }, { month: '2024-01', count: 2 }, null],
      { until: '2024-01' },
    )
    expect(s).toEqual([{ month: '2024-01', count: 3, cumulative: 3, inWindow: true }])
  })

  it('returns [] for no data', () => {
    expect(buildMonthlySeries([])).toEqual([])
    expect(buildMonthlySeries(null)).toEqual([])
  })
})

describe('enrollment-timeline: summarizeMonthlySeries', () => {
  it('computes total, average per month, last-12 and peak', () => {
    const s = buildMonthlySeries(
      Array.from({ length: 15 }, (_, i) => ({ month: addMonths('2024-01', i), count: i + 1 })),
      { until: '2025-03' },
    )
    const sum = summarizeMonthlySeries(s)
    expect(sum.total).toBe(120)
    expect(sum.months).toBe(15)
    expect(sum.avgPerMonth).toBeCloseTo(8)
    expect(sum.last12).toBe(120 - (1 + 2 + 3))
    expect(sum.peak).toEqual({ month: '2025-03', count: 15, cumulative: 120, inWindow: true })
  })
})
