/**
 * Tests for the visits upload area utilities (src/shared/utils/file-category.js):
 *   - suggestFileCategory: extension mapping, consent-name override, fallback
 *   - getFileExtension / getFileCategory helpers
 *   - groupObservationsByVisit: encounterNum grouping + category sub-grouping
 *     (shape consumed by VisitCompactSummary / VisitSummaryObservations)
 */

import { describe, it, expect } from 'vitest'
import { suggestFileCategory, getFileExtension, getFileCategory, groupObservationsByVisit, FILE_CATEGORIES } from '../../src/shared/utils/file-category.js'

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
