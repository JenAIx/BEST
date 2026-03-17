import {
  calc_simple_sum,
  calc_simple_avg,
  calc_count,
  calc_count_targets,
  getScore,
  calc_range,
  getDomaineScore,
  substract,
  evaluate
} from 'src/tools/questman/scoring'

// calc_simple_sum
describe('calc_simple_sum', () => {
  test('sums numeric values', () => {
    const items = [{ value: 1 }, { value: 2 }, { value: 3 }]
    const result = calc_simple_sum(items, {})
    expect(result).toEqual([{ label: 'sum', value: 6 }])
  })

  test('handles mixed types (string values ignored)', () => {
    const items = [{ value: 1 }, { value: 'a' }, { value: 3 }]
    const result = calc_simple_sum(items, {})
    expect(result).toEqual([{ label: 'sum', value: 4 }])
  })

  test('handles empty array', () => {
    const result = calc_simple_sum([], {})
    expect(result).toEqual([{ label: 'sum', value: 0 }])
  })

  test('respects ignore_for_result', () => {
    const items = [{ value: 5 }, { value: 10, ignore_for_result: true }]
    const result = calc_simple_sum(items, {})
    expect(result).toEqual([{ label: 'sum', value: 5 }])
  })

  test('sums array values', () => {
    const items = [{ value: [1, 2, 3] }, { value: 4 }]
    const result = calc_simple_sum(items, {})
    expect(result).toEqual([{ label: 'sum', value: 10 }])
  })

  test('includes coding when provided', () => {
    const items = [{ value: 1 }]
    const result = calc_simple_sum(items, { coding: { display: 'test' } })
    expect(result[0].coding).toEqual({ display: 'test' })
  })
})

// calc_simple_avg
describe('calc_simple_avg', () => {
  test('averages numeric values', () => {
    const items = [{ value: 2 }, { value: 4 }, { value: 6 }]
    const result = calc_simple_avg(items, {})
    expect(result).toEqual([{ label: 'avg', value: 4 }])
  })

  test('returns 0 for empty array (division by zero guard)', () => {
    const result = calc_simple_avg([], {})
    expect(result).toEqual([{ label: 'avg', value: 0 }])
  })

  test('single item', () => {
    const items = [{ value: 7 }]
    const result = calc_simple_avg(items, {})
    expect(result).toEqual([{ label: 'avg', value: 7 }])
  })
})

// calc_count
describe('calc_count', () => {
  test('counts unique values', () => {
    const items = [{ value: 'a' }, { value: 'b' }, { value: 'a' }]
    const result = calc_count(items)
    expect(result).toContainEqual({ label: 'a', value: 2, total: 3 })
    expect(result).toContainEqual({ label: 'b', value: 1, total: 3 })
  })

  test('counts duplicate values', () => {
    const items = [{ value: 1 }, { value: 1 }, { value: 1 }]
    const result = calc_count(items)
    expect(result).toEqual([{ label: 1, value: 3, total: 3 }])
  })
})

// calc_count_targets
describe('calc_count_targets', () => {
  test('counts matching targets', () => {
    const items = [{ value: 'yes' }, { value: 'no' }, { value: 'yes' }]
    const method = {
      targets: [
        { label: 'Yes Count', value: 'yes', score: 1 },
        { label: 'No Count', value: 'no', score: 1 }
      ]
    }
    const result = calc_count_targets(items, method)
    expect(result).toContainEqual({ label: 'Yes Count', value: 2, total: 2 })
    expect(result).toContainEqual({ label: 'No Count', value: 1, total: 1 })
  })

  test('returns zero when no matches', () => {
    const items = [{ value: 'maybe' }]
    const method = { targets: [{ label: 'Yes', value: 'yes', score: 1 }] }
    const result = calc_count_targets(items, method)
    expect(result).toEqual([{ label: 'Yes', value: 0, total: 0 }])
  })
})

// getScore
describe('getScore', () => {
  test('indexOf with match', () => {
    const scoring = [{ id: [1], value: ['a', 'b', 'c'], score: [10, 20, 30] }]
    const val = { id: 1, value: 'b' }
    expect(getScore(scoring, val)).toBe(20)
  })

  test('indexOf with no match (the -1 fix)', () => {
    const scoring = [{ id: [1], value: ['a', 'b'], score: [10, 20] }]
    const val = { id: 1, value: 'z' }
    expect(getScore(scoring, val)).toBe(0)
  })

  test('array values', () => {
    const scoring = [{ id: [1], value: ['a', 'b', 'c'], score: [10, 20, 30] }]
    const val = { id: 1, value: ['a', 'c'] }
    expect(getScore(scoring, val)).toBe(40)
  })

  test('raw method', () => {
    const scoring = [{ id: [1], method: 'raw' }]
    const val = { id: 1, value: 42 }
    expect(getScore(scoring, val)).toBe(42)
  })

  test('multiply method', () => {
    const scoring = [{ id: [1], method: 'multiply', value: 3 }]
    const val = { id: 1, value: 5 }
    expect(getScore(scoring, val)).toBe(15)
  })

  test('no matching id returns 0', () => {
    const scoring = [{ id: [99], value: ['a'], score: [10] }]
    const val = { id: 1, value: 'a' }
    expect(getScore(scoring, val)).toBe(0)
  })
})

// calc_range
describe('calc_range', () => {
  test('within range', () => {
    const range = [{ value: [0, 10], score: 'low' }, { value: [11, 20], score: 'high' }]
    expect(calc_range(5, range)).toBe('low')
    expect(calc_range(15, range)).toBe('high')
  })

  test('outside range', () => {
    const range = [{ value: [0, 10], score: 'low' }]
    expect(calc_range(15, range)).toBeUndefined()
  })

  test('undefined inputs', () => {
    expect(calc_range(undefined, [{ value: [0, 10], score: 'x' }])).toBeUndefined()
    expect(calc_range(5, undefined)).toBeUndefined()
  })
})

// getDomaineScore
describe('getDomaineScore', () => {
  test('sum method', () => {
    const VALUES = [
      { id: 1, score: 5 },
      { id: 2, score: 10 }
    ]
    const sub = { id: [1, 2], method: 'sum', label: 'total' }
    expect(getDomaineScore(VALUES, sub, [])).toBe(15)
  })

  test('avg method', () => {
    const VALUES = [
      { id: 1, score: 4 },
      { id: 2, score: 8 }
    ]
    const sub = { id: [1, 2], method: 'avg', label: 'average' }
    expect(getDomaineScore(VALUES, sub, [])).toBe(6)
  })

  test('multiply method', () => {
    const VALUES = [
      { id: 1, score: 3 },
      { id: 2, score: 4 }
    ]
    const sub = { id: [1, 2], method: 'multiply', label: 'product' }
    expect(getDomaineScore(VALUES, sub, [])).toBe(12)
  })

  test('avg with ignore_zeros (division by zero guard)', () => {
    const VALUES = [
      { id: 1, score: 0 },
      { id: 2, score: 0 }
    ]
    const sub = { id: [1, 2], method: 'avg', ignore_zeros: true, label: 'avg_zero' }
    expect(getDomaineScore(VALUES, sub, [])).toBe(0)
  })

  test('avg with empty id array', () => {
    const sub = { id: [], method: 'avg', label: 'empty' }
    expect(getDomaineScore([], sub, [])).toBe(0)
  })

  test('sum with string id referencing RESULTS', () => {
    const VALUES = []
    const RESULTS = [{ label: 'sub1', value: 5 }, { label: 'sub2', value: 3 }]
    const sub = { id: ['sub1', 'sub2'], method: 'sum', label: 'combined' }
    expect(getDomaineScore(VALUES, sub, RESULTS)).toBe(8)
  })
})

// substract
describe('substract', () => {
  test('subtracts numbers', () => {
    expect(substract(10, 3)).toBe(7)
  })

  test('concatenates non-numbers', () => {
    expect(substract('12:00', '08:00')).toBe('12:00-08:00')
  })
})

// evaluate
describe('evaluate', () => {
  test('sum label match within range', () => {
    const res = [{ label: 'sum', value: 15 }]
    const ev = [
      { range: [0, 10], label: 'low' },
      { range: [11, 20], label: 'medium' }
    ]
    const result = evaluate(res, ev)
    expect(result[0].evaluation).toBe('medium')
  })

  test('range boundary (inclusive)', () => {
    const res = [{ label: 'sum', value: 10 }]
    const ev = [{ range: [0, 10], label: 'low' }, { range: [11, 20], label: 'high' }]
    const result = evaluate(res, ev)
    expect(result[0].evaluation).toBe('low')
  })

  test('no match leaves evaluation undefined', () => {
    const res = [{ label: 'sum', value: 100 }]
    const ev = [{ range: [0, 10], label: 'low' }]
    const result = evaluate(res, ev)
    expect(result[0].evaluation).toBeUndefined()
  })

  test('non-sum labels are ignored', () => {
    const res = [{ label: 'avg', value: 5 }]
    const ev = [{ range: [0, 10], label: 'low' }]
    const result = evaluate(res, ev)
    expect(result[0].evaluation).toBeUndefined()
  })
})
