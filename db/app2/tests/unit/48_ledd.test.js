/**
 * LEDD (levodopa-equivalent daily dose) — shared/utils/ledd.js.
 * Factors = MDS 2023 table that the SmartButton calculator used before
 * the extraction; computeLEDD works on the app's medication rows.
 */
import { describe, it, expect } from 'vitest'
import { LED_FACTORS, DOSES_PER_DAY, dosesPerDay, resolveLedType, computeLEDD, ledInterpretation } from '../../src/shared/utils/ledd.js'

describe('LED_FACTORS', () => {
  it('keeps the MDS-2023 numbers of the former widget table', () => {
    const expected = {
      levodopa: 1, levodopa_dual: 0.85, levodopa_cr: 0.75, levodopa_er: 0.5, levodopa_inhaled: 0.69, lcig: 1.11, lecig_morning: 1.11, lecig_maintenance: 1.46, foslevodopa: 0.75,
      comt_entacapone: 0.33, comt_tolcapone: 0.5, comt_opicapone: 0.5, selegiline_oral: 10, selegiline_sl: 80, rasagiline: 100,
      pramipexole_salt: 100, pramipexole_base: 142.86, ropinirole: 20, rotigotine: 30.3, piribedil: 1, apomorphine_sc: 10, apomorphine_sl: 1.5,
      lisuride: 100, bromocriptine: 10, pergolide: 100, cabergoline: 66.67, dihydroergocryptine: 5, amantadine_ir: 1, amantadine_er: 1.25, amantadine_os320: 1, istradefylline: 0.2,
    }
    for (const [k, f] of Object.entries(expected)) expect(LED_FACTORS[k].factor, k).toBe(f)
    expect(LED_FACTORS.safinamide).toMatchObject({ kind: 'fixed', led: 150 })
    expect(LED_FACTORS.zonisamide).toMatchObject({ kind: 'fixed', led: 100 })
    expect(LED_FACTORS.trihexyphenidyl).toMatchObject({ kind: 'fixed', led: 100 })
    expect(Object.keys(LED_FACTORS)).toHaveLength(34)
  })
})

describe('dosesPerDay', () => {
  it('maps codes, schedules and DB overrides', () => {
    expect(dosesPerDay('QD')).toBe(1)
    expect(dosesPerDay('tid')).toBe(3)
    expect(dosesPerDay('prn')).toBe(0)
    expect(dosesPerDay('1-0-1')).toBe(2)
    expect(dosesPerDay('0.5-0-0.5-0')).toBe(1)
    expect(dosesPerDay('1-1-1-1')).toBe(4)
    expect(dosesPerDay('cont')).toBe(1)
    expect(dosesPerDay('every full moon')).toBeNull()
    expect(dosesPerDay('')).toBeNull()
    expect(dosesPerDay('qd', [{ value: 'qd', dosesPerDay: 7 }])).toBe(7)
    expect(DOSES_PER_DAY.qid).toBe(4)
  })
})

describe('resolveLedType', () => {
  it('prefers DRUG_OPTIONS (code, label or alias), then keywords', () => {
    const opts = [{ value: 'levodopa_benserazide', label: 'Levodopa/Benserazid', ledType: 'levodopa', aliases: ['Madopar'] }]
    expect(resolveLedType({ drugName: 'Madopar' }, opts)).toEqual({ ledType: 'levodopa', comt: null })
    expect(resolveLedType({ drugName: 'levodopa_benserazide' }, opts).ledType).toBe('levodopa')
    expect(resolveLedType({ drugName: 'Levodopa/Benserazid 100/25 retard' }).ledType).toBe('levodopa_cr')
    expect(resolveLedType({ drugName: 'Stalevo 100' })).toEqual({ ledType: 'levodopa', comt: 'comt_entacapone' })
    expect(resolveLedType({ drugName: 'Pramipexol ret' }).ledType).toBe('pramipexole_base')
    expect(resolveLedType({ drugName: 'Rasagilin' }).ledType).toBe('rasagiline')
    expect(resolveLedType({ drugName: 'Ramipril' }).ledType).toBeNull()
  })
})

describe('computeLEDD', () => {
  const meds = [
    { observationId: 1, drugName: 'Levodopa/Benserazid', dosage: 100, frequency: 'qid' },
    { observationId: 2, drugName: 'Pramipexol', dosage: 0.35, frequency: 'tid' },
    { observationId: 3, drugName: 'Rasagilin', dosage: 1, frequency: 'qd' },
  ]

  it('sums standard rows: daily dose × factor', () => {
    const r = computeLEDD(meds)
    expect(r.levodopaSubtotal).toBe(400)
    expect(r.breakdown.find((b) => b.observationId === 2).led).toBe(150) // 1.05 × 142.86
    expect(r.breakdown.find((b) => b.observationId === 3).led).toBe(100)
    expect(r.total).toBe(650)
    expect(r.unresolved).toEqual([])
    expect(r.version).toBe('MDS2023')
  })

  it('applies exactly one COMT factor to the levodopa subtotal (highest wins)', () => {
    const withEnta = computeLEDD([...meds, { observationId: 4, drugName: 'Entacapon', dosage: 200, frequency: 'qid' }])
    expect(withEnta.comtApplied).toBe('comt_entacapone')
    expect(withEnta.breakdown.find((b) => b.observationId === 4).led).toBe(132) // 400 × 0.33
    expect(withEnta.total).toBe(782)

    const both = computeLEDD([...meds, { observationId: 4, drugName: 'Entacapon', dosage: 200, frequency: 'qid' }, { observationId: 5, drugName: 'Opicapon', dosage: 50, frequency: 'qd' }])
    expect(both.comtApplied).toBe('comt_opicapone')
    expect(both.breakdown.find((b) => b.observationId === 4).led).toBe(0)
    expect(both.breakdown.find((b) => b.observationId === 5).led).toBe(200)
    expect(both.total).toBe(850)
  })

  it('handles combination products (Stalevo) as levodopa + COMT once', () => {
    const r = computeLEDD([{ observationId: 1, drugName: 'Stalevo', dosage: 100, frequency: 'qid' }])
    expect(r.levodopaSubtotal).toBe(400)
    expect(r.comtFromCombination).toBe(true)
    expect(r.comtLed).toBe(132)
    expect(r.total).toBe(532)
  })

  it('fixed LED, multiplier, PRN and cont', () => {
    const r = computeLEDD([
      { observationId: 1, drugName: 'Levodopa', dosage: 200, frequency: 'tid' },
      { observationId: 2, drugName: 'Safinamid', dosage: 50, frequency: 'qd' },
      { observationId: 3, drugName: 'Istradefyllin', dosage: 20, frequency: 'qd' },
      { observationId: 4, drugName: 'Apomorphin Pen', dosage: 3, frequency: 'prn' },
      { observationId: 5, drugName: 'Duodopa', dosage: 1200, frequency: 'cont' },
    ])
    expect(r.breakdown.find((b) => b.observationId === 2).led).toBe(150)
    expect(r.levodopaSubtotal).toBe(600 + 1332) // 600 + 1200 × 1.11
    expect(r.breakdown.find((b) => b.observationId === 3).led).toBe(386.4)
    const prn = r.breakdown.find((b) => b.observationId === 4)
    expect(prn.prn).toBe(true)
    expect(prn.led).toBe(0)
  })

  it('lists unresolved rows instead of guessing', () => {
    const r = computeLEDD([
      { observationId: 1, drugName: 'Ramipril', dosage: 5, frequency: 'qd' },
      { observationId: 2, drugName: 'Levodopa', dosage: null, frequency: 'qd' },
      { observationId: 3, drugName: 'Levodopa', dosage: 100, frequency: 'irgendwann' },
    ])
    expect(r.total).toBe(0)
    expect(r.unresolved.map((u) => u.reason)).toEqual(['no_ledType', 'no_dose', 'no_frequency'])
  })

  it('interprets the total', () => {
    expect(ledInterpretation(0)).toBe('none')
    expect(ledInterpretation(399)).toBe('low')
    expect(ledInterpretation(800)).toBe('high')
    expect(ledInterpretation(1200)).toBe('very_high')
  })
})
