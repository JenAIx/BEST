/**
 * Medication changes between visits — shared/utils/medication-diff.js
 */
import { describe, it, expect } from 'vitest'
import { normalizeDrugKey, diffMedications, markerFor } from '../../src/shared/utils/medication-diff.js'

describe('normalizeDrugKey', () => {
  it('strips strengths, ratios, forms and noise; folds diacritics', () => {
    expect(normalizeDrugKey('Levodopa/Benserazid 100/25 mg').key).toBe('levodopa benserazid')
    expect(normalizeDrugKey('Levodopa Benserazid').key).toBe('levodopa benserazid')
    expect(normalizeDrugKey('Pramipexol retard 1,05 mg').key).toBe('pramipexol')
    expect(normalizeDrugKey('Pramipexol retard 1,05 mg').form).toBe('er')
    expect(normalizeDrugKey('Rotigotin 6 mg/24h Pflaster').key).toBe('rotigotin')
    expect(normalizeDrugKey('Amantadin 100mg Tabletten').key).toBe('amantadin')
    expect(normalizeDrugKey('').key).toBe('')
  })

  it('maps aliases to the catalogue code', () => {
    const opts = [{ value: 'levodopa_benserazide', label: 'Levodopa/Benserazid', aliases: ['Madopar', 'Restex'] }]
    expect(normalizeDrugKey('Madopar 125', opts).key).toBe('levodopa_benserazide')
    expect(normalizeDrugKey('Levodopa/Benserazid 100/25', opts).key).toBe('levodopa_benserazide')
    expect(normalizeDrugKey('Ramipril', opts).key).toBe('ramipril')
  })
})

describe('diffMedications', () => {
  const prev = [
    { observationId: 1, drugName: 'Levodopa/Benserazid 100/25', dosage: 100, frequency: 'tid', route: 'po' },
    { observationId: 2, drugName: 'Pramipexol', dosage: 0.35, frequency: 'tid', route: 'po' },
    { observationId: 3, drugName: 'Amantadin', dosage: 100, frequency: 'bid', route: 'po' },
    { observationId: 4, drugName: 'Ramipril', dosage: 5, frequency: 'qd', route: 'po' },
  ]
  const curr = [
    { observationId: 11, drugName: 'Levodopa/Benserazid 100/25', dosage: 100, frequency: 'qid', route: 'po' },
    { observationId: 12, drugName: 'Pramipexol retard', dosage: 1.05, frequency: 'qd', route: 'po' },
    { observationId: 13, drugName: 'Rasagilin', dosage: 1, frequency: 'qd', route: 'po' },
    { observationId: 14, drugName: 'Ramipril 5mg', dosage: 5, frequency: 'qd', route: 'po' },
  ]

  it('classifies added / stopped / changed / unchanged', () => {
    const d = diffMedications(prev, curr)
    expect(d.summary).toEqual({ added: 1, stopped: 1, changed: 2 })
    expect(d.added[0].key).toBe('rasagilin')
    expect(d.stopped[0].key).toBe('amantadin')
    expect(d.unchanged.map((u) => u.key)).toEqual(['ramipril'])
    const levo = d.changed.find((c) => c.key === 'levodopa benserazid')
    expect(levo.changes.dailyDose).toEqual({ from: 300, to: 400, direction: 'up' })
    expect(levo.changes.frequency).toEqual({ from: 'tid', to: 'qid' })
    const prami = d.changed.find((c) => c.key === 'pramipexol')
    expect(prami.changes.dailyDose).toBeUndefined() // 3 × 0.35 = 1.05 — same daily dose, retard once daily
    expect(prami.changes.form).toEqual({ from: null, to: 'er' })
    expect(prami.changes.frequency).toEqual({ from: 'tid', to: 'qd' })
  })

  it('same daily dose with different schedule is a frequency change, not a dose change', () => {
    const d = diffMedications([{ observationId: 1, drugName: 'Levodopa', dosage: 100, frequency: 'tid' }], [{ observationId: 2, drugName: 'Levodopa', dosage: 150, frequency: 'bid' }])
    expect(d.changed[0].changes.dailyDose).toBeUndefined()
    expect(d.changed[0].changes.frequency).toEqual({ from: 'tid', to: 'bid' })
    expect(d.changed[0].changes.dosage).toEqual({ from: 100, to: 150 })
  })

  it('PRN rows compare by signature only', () => {
    const d = diffMedications([{ observationId: 1, drugName: 'Apomorphin', dosage: 3, frequency: 'prn' }], [{ observationId: 2, drugName: 'Apomorphin', dosage: 3, frequency: 'prn' }])
    expect(d.unchanged).toHaveLength(1)
  })

  it('empty sides', () => {
    expect(diffMedications([], curr).summary).toEqual({ added: 4, stopped: 0, changed: 0 })
    expect(diffMedications(prev, []).summary).toEqual({ added: 0, stopped: 4, changed: 0 })
    expect(diffMedications(null, null).summary).toEqual({ added: 0, stopped: 0, changed: 0 })
  })

  it('markerFor tags current rows', () => {
    const d = diffMedications(prev, curr)
    expect(markerFor(d, curr[2])).toBe('new')
    expect(markerFor(d, curr[0])).toBe('up')
    expect(markerFor(d, curr[1])).toBe('changed')
    expect(markerFor(d, curr[3])).toBeNull()
  })
})
