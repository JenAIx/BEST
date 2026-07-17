/**
 * Tests for the visits upload area utilities (src/shared/utils/file-category.js):
 *   - suggestFileCategory: extension mapping, consent-name override, fallback
 *   - getFileExtension / getFileCategory helpers
 *   - groupObservationsByVisit: encounterNum grouping + category sub-grouping
 *     (shape consumed by VisitCompactSummary / VisitSummaryObservations)
 */

import { describe, it, expect } from 'vitest'
import { suggestFileCategory, getFileExtension, getFileCategory, groupObservationsByVisit, groupObservationsByFieldSets, filterObservations, FILE_CATEGORIES } from '../../src/shared/utils/file-category.js'

describe('getFileExtension', () => {
  it('extracts the lower-cased extension', () => {
    expect(getFileExtension('Befund.PDF')).toBe('pdf')
    expect(getFileExtension('video.mp4')).toBe('mp4')
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('handles names without extension', () => {
    expect(getFileExtension('README')).toBe('')
    expect(getFileExtension('ends.')).toBe('')
    expect(getFileExtension('')).toBe('')
    expect(getFileExtension(null)).toBe('')
  })
})

describe('suggestFileCategory', () => {
  it('maps video extensions to the video concept', () => {
    for (const name of ['gang.mp4', 'tremor.MOV', 'x.webm', 'x.mkv', 'x.avi']) {
      const cat = suggestFileCategory(name)
      expect(cat.key).toBe('video')
      expect(cat.conceptCd).toBe('CUSTOM: RAW_VIDEO')
    }
  })

  it('maps document extensions to the document concept', () => {
    expect(suggestFileCategory('brief.pdf').conceptCd).toBe('CUSTOM: RAW_DOCUMENT')
    expect(suggestFileCategory('notiz.docx').key).toBe('document')
    expect(suggestFileCategory('info.txt').key).toBe('document')
  })

  it('maps image extensions to the existing image concept', () => {
    expect(suggestFileCategory('mrt.png').conceptCd).toBe('CUSTOM: RAW_IMAGE')
    expect(suggestFileCategory('foto.JPEG').key).toBe('image')
  })

  it('consent-looking file names win over the extension category', () => {
    expect(suggestFileCategory('Aufklaerung_Studie.pdf').conceptCd).toBe('CUSTOM: RAW_CONSENT')
    expect(suggestFileCategory('Aufklärung V2.docx').key).toBe('consent')
    expect(suggestFileCategory('patient-consent.png').key).toBe('consent')
    expect(suggestFileCategory('Einwilligung_2026.pdf').key).toBe('consent')
  })

  it('falls back to the generic raw-data concept for unknown extensions', () => {
    expect(suggestFileCategory('daten.xyz').conceptCd).toBe('CUSTOM: RAW_DATA')
    expect(suggestFileCategory('README').key).toBe('other')
    expect(suggestFileCategory(null).key).toBe('other')
  })

  it('every category carries concept, icon and label key', () => {
    for (const cat of FILE_CATEGORIES) {
      expect(cat.conceptCd).toMatch(/^CUSTOM: RAW_/)
      expect(cat.icon).toBeTruthy()
      expect(cat.labelKey).toMatch(/^visit\./)
    }
  })
})

describe('getFileCategory', () => {
  it('resolves by key with other-fallback', () => {
    expect(getFileCategory('video').key).toBe('video')
    expect(getFileCategory('nope').key).toBe('other')
    expect(getFileCategory(null).key).toBe('other')
  })
})

describe('filterObservations', () => {
  const rows = [
    { conceptName: 'Kalium', displayValue: '4.2', category: 'Laboratory', unit: 'mmol/l' },
    { conceptName: 'Natrium', displayValue: '140', category: 'Laboratory', unit: 'mmol/l' },
    { conceptName: 'Blutdruck', displayValue: 'kalt gemessen', category: 'Vital Signs', unit: null },
  ]

  it('matches concept names case-insensitively (partial)', () => {
    expect(filterObservations(rows, 'Ka').map((r) => r.conceptName)).toEqual(['Kalium', 'Blutdruck'])
    expect(filterObservations(rows, 'kalium')).toHaveLength(1)
  })

  it('matches display values, categories and units too', () => {
    expect(filterObservations(rows, '140')[0].conceptName).toBe('Natrium')
    expect(filterObservations(rows, 'vital')[0].conceptName).toBe('Blutdruck')
    expect(filterObservations(rows, 'mmol')).toHaveLength(2)
  })

  it('empty or blank term returns everything', () => {
    expect(filterObservations(rows, '')).toHaveLength(3)
    expect(filterObservations(rows, '   ')).toHaveLength(3)
    expect(filterObservations(rows, null)).toHaveLength(3)
  })

  it('no match returns empty array; null input is safe', () => {
    expect(filterObservations(rows, 'xyz')).toHaveLength(0)
    expect(filterObservations(null, 'ka')).toEqual([])
  })
})

describe('groupObservationsByVisit', () => {
  const obs = (id, encounterNum, category) => ({ observationId: id, encounterNum, category })

  it('groups observations per encounter and category (sorted)', () => {
    const grouped = groupObservationsByVisit([obs(1, 10, 'Laboratory'), obs(2, 10, 'Demographics'), obs(3, 10, 'Laboratory'), obs(4, 20, 'Stroke')])

    expect([...grouped.keys()]).toEqual([10, 20])

    const visit10 = grouped.get(10)
    expect(visit10.map((g) => g.name)).toEqual(['Demographics', 'Laboratory'])
    expect(visit10.find((g) => g.name === 'Laboratory').observations).toHaveLength(2)

    expect(grouped.get(20)).toHaveLength(1)
  })

  it('defaults missing categories to General and skips rows without encounter', () => {
    const grouped = groupObservationsByVisit([obs(1, 10, null), { observationId: 2, encounterNum: null, category: 'X' }])

    expect(grouped.size).toBe(1)
    expect(grouped.get(10)[0].name).toBe('General')
  })

  it('handles empty input', () => {
    expect(groupObservationsByVisit([]).size).toBe(0)
    expect(groupObservationsByVisit(null).size).toBe(0)
  })
})

describe('groupObservationsByFieldSets', () => {
  const FIELD_SETS = [
    { id: 'lipid_labor', name: 'Lipid Study - Laboratory', icon: 'science', concepts: ['LID: 22748-8'], categories: [] },
    { id: 'vitals', name: 'Vital Signs Group', icon: 'monitor_heart', concepts: [], categories: ['Vital Signs'] },
  ]

  const OBS = [
    // claimed by concept code (exact)
    { encounterNum: 1, conceptCode: 'LID: 22748-8', conceptName: 'LDL', category: 'Laboratory' },
    // claimed by category fallback
    { encounterNum: 1, conceptCode: 'SCTID: 271649006', conceptName: 'RR systolisch', category: 'Vital Signs' },
    // remainder → own category group
    { encounterNum: 1, conceptCode: 'CUSTOM: NOTES', conceptName: 'Notiz', category: 'General' },
    { encounterNum: 2, conceptCode: 'CUSTOM: X', conceptName: 'X', category: 'Stroke' },
  ]

  it('groups field groups first (in order), remainder by category', () => {
    const groups = groupObservationsByFieldSets(OBS, FIELD_SETS).get(1)
    expect(groups.map((g) => g.name)).toEqual(['Lipid Study - Laboratory', 'Vital Signs Group', 'General'])
    expect(groups[0].icon).toBe('science')
    expect(groups[0].observations[0].conceptName).toBe('LDL')
  })

  it('concept-code claim beats a category claim by another group', () => {
    const sets = [
      { id: 'labs', name: 'Labs', concepts: ['LID: 22748-8'], categories: [] },
      { id: 'labcat', name: 'Lab Category', concepts: [], categories: ['Laboratory'] },
    ]
    const groups = groupObservationsByFieldSets([OBS[0]], sets).get(1)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Labs')
  })

  it('an exact concept claim beats an earlier fuzzy substring claim', () => {
    // ..._SYMPTOMS contains the first set's concept as substring — the row
    // must land in the set that lists its exact code, not the fuzzy one
    const sets = [
      { id: 'a', name: 'Prefix Set', concepts: ['STROKE_LIPID:STATIN_INTOLERANCE'], categories: [] },
      { id: 'b', name: 'Exact Set', concepts: ['STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS'], categories: [] },
    ]
    const row = { encounterNum: 1, conceptCode: 'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS', conceptName: 'Symptome', category: 'Stroke' }
    const groups = groupObservationsByFieldSets([row], sets).get(1)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Exact Set')
  })

  it('field-set groups carry their configured conceptCodes (completion denominator)', () => {
    const groups = groupObservationsByFieldSets(OBS, FIELD_SETS).get(1)
    expect(groups[0].conceptCodes).toEqual(['LID: 22748-8'])
    expect(groups[2].conceptCodes).toBeUndefined() // category remainder group
  })

  it('matches concepts across differing prefixes (trailing numeric code)', () => {
    // both sides prefixed → the trailing-numeric branch matches despite
    // different prefixes; a bare '22748-8' would match via substring instead
    const sets = [{ id: 'labs', name: 'Labs', concepts: ['LOCAL: 22748-8'], categories: [] }]
    const groups = groupObservationsByFieldSets([OBS[0]], sets).get(1)
    expect(groups[0].name).toBe('Labs')
  })

  it('degrades to pure category grouping without field sets', () => {
    const grouped = groupObservationsByFieldSets(OBS, [])
    expect(grouped.get(1).map((g) => g.name)).toEqual(['General', 'Laboratory', 'Vital Signs'])
    expect(grouped.get(2).map((g) => g.name)).toEqual(['Stroke'])
  })

  it('handles empty input', () => {
    expect(groupObservationsByFieldSets([], FIELD_SETS).size).toBe(0)
    expect(groupObservationsByFieldSets(null, null).size).toBe(0)
  })
})
