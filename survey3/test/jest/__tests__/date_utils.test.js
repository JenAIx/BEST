import { formatDay, toTimestamp } from '../../../src/tools/dateUtils'

describe('toTimestamp', () => {
  test('YYYY-MM-DD → ms (Round-Trip mit formatDay, zeitzonenstabil)', () => {
    const ms = toTimestamp('2024-03-15')
    expect(typeof ms).toBe('number')
    expect(formatDay(ms)).toBe('2024-03-15') // kein Off-by-one durch UTC/Local
  })
  test('idempotent für Zahl', () => {
    expect(toTimestamp(1710460800000)).toBe(1710460800000)
  })
  test('leer/ungültig → null', () => {
    expect(toTimestamp('')).toBeNull()
    expect(toTimestamp(null)).toBeNull()
    expect(toTimestamp(undefined)).toBeNull()
    expect(toTimestamp('keinDatum')).toBeNull()
  })
  test('ISO-Datetime wird geparst', () => {
    expect(typeof toTimestamp('2024-03-15T10:00:00Z')).toBe('number')
  })
})
