import { describe, it, expect } from 'vitest'
import { buildVisitForEdit } from '../../src/shared/utils/visit-edit-transform.js'
import { toggleExpanded, allExpanded, expandAll, collapseAll } from '../../src/shared/utils/expand-state.js'

describe('buildVisitForEdit', () => {
  const baseVisit = {
    id: 42,
    date: '2026-07-01',
    endDate: null,
    status: 'SCTID: 55561003',
    location: 'WARD_A',
    inout: 'O',
    visitType: 'stroke_lipid_v1',
    notes: 'aktuelle Notiz',
    last_changed: '2026-07-02',
  }

  it('merges the existing VISIT_BLOB with current store visitType/notes', () => {
    const visit = {
      ...baseVisit,
      rawData: {
        ENCOUNTER_NUM: 42,
        START_DATE: '2026-07-01',
        VISIT_BLOB: JSON.stringify({ visitType: 'routine', notes: 'alt', custom: 'bleibt' }),
      },
    }
    const result = buildVisitForEdit(visit)

    expect(result.encounterNum).toBe(42)
    expect(result.visitDate).toBe('2026-07-01')
    expect(result.observations).toEqual([])

    const blob = JSON.parse(result.visit.VISIT_BLOB)
    expect(blob.visitType).toBe('stroke_lipid_v1') // store value wins
    expect(blob.notes).toBe('aktuelle Notiz')
    expect(blob.custom).toBe('bleibt') // extra blob fields preserved
    expect(typeof blob.updatedAt).toBe('string')
  })

  it('recreates the blob when VISIT_BLOB is invalid JSON', () => {
    const visit = { ...baseVisit, rawData: { ENCOUNTER_NUM: 42, VISIT_BLOB: '{kaputt' } }
    const blob = JSON.parse(buildVisitForEdit(visit).visit.VISIT_BLOB)
    expect(blob.visitType).toBe('stroke_lipid_v1')
    expect(blob.notes).toBe('aktuelle Notiz')
  })

  it('constructs a raw row when rawData is missing (incl. emergency INOUT rule)', () => {
    const visit = { ...baseVisit, inout: null, visitType: 'emergency', rawData: null }
    const result = buildVisitForEdit(visit)
    expect(result.visit.ENCOUNTER_NUM).toBe(42)
    expect(result.visit.INOUT_CD).toBe('E')
    expect(result.visit.SOURCESYSTEM_CD).toBe('SYSTEM')
    expect(JSON.parse(result.visit.VISIT_BLOB).visitType).toBe('emergency')

    const nonEmergency = buildVisitForEdit({ ...baseVisit, inout: null, rawData: null })
    expect(nonEmergency.visit.INOUT_CD).toBe('O')
  })
})

describe('expand-state', () => {
  it('toggleExpanded adds/removes and returns a new Set', () => {
    const original = new Set([1])
    const added = toggleExpanded(original, 2)
    expect([...added].sort()).toEqual([1, 2])
    expect(original.has(2)).toBe(false) // original untouched

    const removed = toggleExpanded(added, 1)
    expect([...removed]).toEqual([2])
  })

  it('allExpanded requires every visible id, empty list is false', () => {
    expect(allExpanded([], new Set([1]))).toBe(false)
    expect(allExpanded([1, 2], new Set([1, 2, 3]))).toBe(true)
    expect(allExpanded([1, 2], new Set([1]))).toBe(false)
  })

  it('expandAll adds visible ids without dropping hidden ones', () => {
    const next = expandAll(new Set([99]), [1, 2])
    expect([...next].sort()).toEqual([1, 2, 99])
  })

  it('collapseAll removes only visible ids', () => {
    const next = collapseAll(new Set([1, 2, 99]), [1, 2])
    expect([...next]).toEqual([99])
  })
})
