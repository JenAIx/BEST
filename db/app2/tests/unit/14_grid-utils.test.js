/**
 * Unit tests for `src/shared/utils/grid-utils.js`.
 *
 * Focus: the new `groupConceptsByCategory` helper used by ExcelLikeEditor to
 * render the category band header. The pure helper has no DOM dependencies,
 * so it can run in vitest's node environment.
 */

import { describe, it, expect } from 'vitest'
import {
  groupConceptsByCategory,
  getCellValue,
  getCellObservationId,
  createChangeKey,
  parseChangeKey,
} from '../../src/shared/utils/grid-utils.js'

describe('groupConceptsByCategory', () => {
  it('returns an empty array for empty or non-array input', () => {
    expect(groupConceptsByCategory([])).toEqual([])
    expect(groupConceptsByCategory(null)).toEqual([])
    expect(groupConceptsByCategory(undefined)).toEqual([])
  })

  it('groups concepts by CATEGORY_CHAR', () => {
    const concepts = [
      { code: 'A', name: 'A', category: 'Laboratory' },
      { code: 'B', name: 'B', category: 'Medications' },
      { code: 'C', name: 'C', category: 'Laboratory' },
      { code: 'D', name: 'D', category: 'Medications' },
    ]
    const groups = groupConceptsByCategory(concepts)
    expect(groups).toHaveLength(2)
    const cats = groups.map((g) => g.category)
    expect(cats).toContain('Laboratory')
    expect(cats).toContain('Medications')
    const lab = groups.find((g) => g.category === 'Laboratory')
    expect(lab.concepts.map((c) => c.code)).toEqual(['A', 'C'])
  })

  it('orders categories by clinical convention (Demographics first, Medications last among well-known)', () => {
    const concepts = [
      { code: 'M1', category: 'Medications' },
      { code: 'L1', category: 'Laboratory' },
      { code: 'D1', category: 'Demographics' },
      { code: 'V1', category: 'Vital Signs' },
      { code: 'S1', category: 'Stroke' },
    ]
    const order = groupConceptsByCategory(concepts).map((g) => g.category)
    expect(order).toEqual(['Demographics', 'Vital Signs', 'Stroke', 'Laboratory', 'Medications'])
  })

  it('puts "Other" (and null/empty category) bucket last', () => {
    const concepts = [
      { code: 'X', category: null },
      { code: 'M1', category: 'Medications' },
      { code: 'Y', category: '' },
      { code: 'L1', category: 'Laboratory' },
    ]
    const groups = groupConceptsByCategory(concepts)
    expect(groups[groups.length - 1].category).toBe('Other')
    expect(groups[groups.length - 1].concepts.map((c) => c.code)).toEqual(['X', 'Y'])
  })

  it('preserves concept order within a category', () => {
    const concepts = [
      { code: 'b', category: 'Laboratory' },
      { code: 'a', category: 'Laboratory' },
      { code: 'c', category: 'Laboratory' },
    ]
    const group = groupConceptsByCategory(concepts)[0]
    expect(group.concepts.map((c) => c.code)).toEqual(['b', 'a', 'c'])
  })

  it('alphabetises unknown categories after the well-known ones', () => {
    const concepts = [
      { code: 'A', category: 'Zoology' },
      { code: 'B', category: 'Medications' },
      { code: 'C', category: 'Anthropology' },
    ]
    const order = groupConceptsByCategory(concepts).map((g) => g.category)
    expect(order).toEqual(['Medications', 'Anthropology', 'Zoology'])
  })
})

describe('grid-utils existing helpers (smoke)', () => {
  const row = {
    observations: {
      foo: { observationId: 7, value: '42' },
    },
  }

  it('getCellValue returns the observation value or empty string', () => {
    expect(getCellValue(row, { code: 'foo' })).toBe('42')
    expect(getCellValue(row, { code: 'missing' })).toBe('')
  })

  it('getCellObservationId returns the observation id or null', () => {
    expect(getCellObservationId(row, { code: 'foo' })).toBe(7)
    expect(getCellObservationId(row, { code: 'missing' })).toBeNull()
  })

  it('createChangeKey / parseChangeKey reconstruct concept codes that contain dashes', () => {
    // Note: parseChangeKey assumes the patient ID has no '-' in it (uses first
    // segment). Concept codes with dashes (e.g. 'LID: 14927-8') are handled by
    // joining the trailing segments. Test the documented behaviour.
    const key = createChangeKey('11223280', 99, 'LID: 14927-8')
    const parsed = parseChangeKey(key)
    expect(parsed.patientId).toBe('11223280')
    expect(parsed.encounterNum).toBe(99)
    expect(parsed.conceptCode).toBe('LID: 14927-8')
  })
})
