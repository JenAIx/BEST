import { describe, it, expect } from 'vitest'
import {
  extractVisitType,
  buildTypeMeta,
  statusCssClass,
  DEFAULT_TYPE_META,
} from '../../src/shared/utils/visit-labels.js'

describe('visit-labels', () => {
  describe('extractVisitType', () => {
    it('returns the visitType field when there is no VISIT_BLOB', () => {
      expect(extractVisitType({ visitType: 'routine' })).toBe('routine')
      expect(extractVisitType({ visitType: 'routine', rawData: {} })).toBe('routine')
    })

    it('prefers the visitType inside VISIT_BLOB over the transformed field', () => {
      const visit = {
        visitType: 'routine',
        rawData: { VISIT_BLOB: JSON.stringify({ visitType: 'stroke_lipid_v1' }) },
      }
      expect(extractVisitType(visit)).toBe('stroke_lipid_v1')
    })

    it('falls back to the field when VISIT_BLOB is malformed JSON', () => {
      const visit = { visitType: 'followup', rawData: { VISIT_BLOB: '{not json' } }
      expect(extractVisitType(visit)).toBe('followup')
    })

    it('falls back to the field when VISIT_BLOB has no visitType', () => {
      const visit = { visitType: 'followup', rawData: { VISIT_BLOB: JSON.stringify({ notes: 'x' }) } }
      expect(extractVisitType(visit)).toBe('followup')
    })

    it('returns null for missing input', () => {
      expect(extractVisitType(null)).toBeNull()
      expect(extractVisitType({})).toBeNull()
    })
  })

  describe('buildTypeMeta', () => {
    const options = [
      { value: 'stroke_lipid_v1', label: 'Stroke-Lipid V1 - Index Stroke', icon: 'emergency', color: 'red' },
      { value: 'routine', label: 'Routine-Kontrolle' },
    ]

    it('returns the DB option label verbatim (study labels)', () => {
      const meta = buildTypeMeta('stroke_lipid_v1', options)
      expect(meta).toEqual({ label: 'Stroke-Lipid V1 - Index Stroke', icon: 'emergency', color: 'red' })
    })

    it('fills missing option icon/color from static fallbacks', () => {
      const meta = buildTypeMeta('routine', options)
      expect(meta.label).toBe('Routine-Kontrolle') // option label wins
      expect(meta.icon).toBe('health_and_safety') // static fallback
      expect(meta.color).toBe('blue') // static fallback
    })

    it('uses the static map when the code is not in the options', () => {
      const meta = buildTypeMeta('emergency', options)
      expect(meta).toEqual({ label: 'Emergency', icon: 'emergency', color: 'negative' })
    })

    it('falls back to the raw code as label for unknown types', () => {
      const meta = buildTypeMeta('parkinson_baseline', [])
      expect(meta.label).toBe('parkinson_baseline')
      expect(meta.icon).toBe(DEFAULT_TYPE_META.icon)
      expect(meta.color).toBe(DEFAULT_TYPE_META.color)
    })

    it('returns the default meta for a missing code', () => {
      expect(buildTypeMeta(null, options)).toEqual({ ...DEFAULT_TYPE_META })
      expect(buildTypeMeta('', options)).toEqual({ ...DEFAULT_TYPE_META })
    })
  })

  describe('statusCssClass', () => {
    it('maps resolved SNOMED labels', () => {
      expect(statusCssClass('Active', 'SCTID: 55561003')).toBe('status-active')
      expect(statusCssClass('Classified', null)).toBe('status-active')
      expect(statusCssClass('Closed', null)).toBe('status-completed')
      expect(statusCssClass('Inactive', null)).toBe('status-cancelled')
    })

    it('maps legacy labels', () => {
      expect(statusCssClass('Completed', null)).toBe('status-completed')
      expect(statusCssClass('Discharged', null)).toBe('status-completed')
      expect(statusCssClass('Cancelled', null)).toBe('status-cancelled')
      expect(statusCssClass('Pending', null)).toBe('status-active')
    })

    it('falls back to the raw status code when the label is unknown', () => {
      expect(statusCssClass('Irgendwas', 'SCTID: 29179001')).toBe('status-completed')
      expect(statusCssClass(null, 'A')).toBe('status-active')
      expect(statusCssClass(null, 'C')).toBe('status-completed')
      expect(statusCssClass(null, 'X')).toBe('status-cancelled')
      expect(statusCssClass(null, 'P')).toBe('status-active')
    })

    it('returns status-default for fully unknown input', () => {
      expect(statusCssClass(null, null)).toBe('status-default')
      expect(statusCssClass('???', 'ZZ')).toBe('status-default')
    })
  })
})
