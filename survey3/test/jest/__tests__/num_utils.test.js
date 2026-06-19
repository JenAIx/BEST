import { clampNumber } from '../../../src/tools/numUtils'

describe('clampNumber', () => {
  test('klemmt in den Bereich [min,max]', () => {
    expect(clampNumber(150, 0, 120)).toBe(120)
    expect(clampNumber(-5, 0, 120)).toBe(0)
    expect(clampNumber(42, 0, 120)).toBe(42)
  })
  test('nur eine Grenze gesetzt', () => {
    expect(clampNumber(150, undefined, 120)).toBe(120)
    expect(clampNumber(-5, 0, undefined)).toBe(0)
    expect(clampNumber(50, 10, undefined)).toBe(50)
  })
  test('ohne Grenzen → unverändert', () => {
    expect(clampNumber(9999)).toBe(9999)
    expect(clampNumber(9999, undefined, undefined)).toBe(9999)
  })
  test('nicht-numerische Eingabe wird unverändert durchgereicht (kein erzwungenes 0)', () => {
    expect(clampNumber(null, 0, 10)).toBe(null)
    expect(clampNumber(undefined, 0, 10)).toBe(undefined)
    expect(clampNumber(NaN, 0, 10)).toBeNaN()
  })
})
