import { describe, it, expect } from 'vitest'
import { shortConceptName, tileSpan, buildObservationUpdate, buildNewObservationData, valueTypeHex } from '../../src/shared/utils/observation-display.js'

describe('shortConceptName', () => {
  it('cuts at the first bracket qualifier and trims separators', () => {
    expect(shortConceptName('LDL-Cholesterin (Moles/Volume) in Serum or Plasma')).toBe('LDL-Cholesterin')
    expect(shortConceptName('Hemoglobin A1c/Hemoglobin.total [Mass fraction]')).toBe('Hemoglobin A1c/Hemoglobin.total')
    expect(shortConceptName('Aspartate aminotransferase, (Catalytic)')).toBe('Aspartate aminotransferase')
  })

  it('ellipsizes long names and keeps short ones', () => {
    expect(shortConceptName('Statin intolerance')).toBe('Statin intolerance')
    const long = shortConceptName('History of clinical finding in subject observable entity', 30)
    expect(long.length).toBeLessThanOrEqual(30)
    expect(long.endsWith('…')).toBe(true)
  })

  it('falls back to the full name when the cut would be empty', () => {
    expect(shortConceptName('(nur Klammer)')).toBe('(nur Klammer)')
    expect(shortConceptName('')).toBe('')
    expect(shortConceptName(null)).toBe('')
  })
})

describe('tileSpan', () => {
  it('numbers and dates stay small (side by side)', () => {
    expect(tileSpan({ valueType: 'N', displayValue: '1.96' })).toBe('s')
    expect(tileSpan({ valueType: 'D', displayValue: '2024-06-10' })).toBe('s')
  })

  it('selections grow with their label', () => {
    expect(tileSpan({ valueType: 'F', displayValue: 'No' })).toBe('s')
    expect(tileSpan({ valueType: 'S', displayValue: 'Intracerebral haemorrhage' })).toBe('m')
  })

  it('files, questionnaires and medications are wide', () => {
    expect(tileSpan({ valueType: 'R', displayValue: 'Befund.pdf' })).toBe('m')
    expect(tileSpan({ valueType: 'Q', displayValue: 'MoCA' })).toBe('m')
    expect(tileSpan({ valueType: 'M', displayValue: 'Atorvastatin' })).toBe('m')
  })

  it('free text: medium, full row when long', () => {
    expect(tileSpan({ valueType: 'T', displayValue: 'kurz' })).toBe('m')
    expect(tileSpan({ valueType: 'T', displayValue: 'x'.repeat(80) })).toBe('full')
  })
})

describe('buildObservationUpdate', () => {
  it('numeric writes NVAL_NUM, clears the rest and the flag', () => {
    expect(buildObservationUpdate('N', '1.96')).toEqual({ VALUEFLAG_CD: null, NVAL_NUM: 1.96, TVAL_CHAR: null, OBSERVATION_BLOB: null })
    expect(buildObservationUpdate('N', 'abc').NVAL_NUM).toBeNull()
  })

  it('coded values (S/F/A) write TVAL_CHAR', () => {
    for (const type of ['S', 'F', 'A']) {
      expect(buildObservationUpdate(type, 'SCTID: 373066001')).toEqual({ VALUEFLAG_CD: null, TVAL_CHAR: 'SCTID: 373066001', NVAL_NUM: null, OBSERVATION_BLOB: null })
    }
  })

  it('text/default writes TVAL_CHAR, R/M write the blob', () => {
    expect(buildObservationUpdate('T', 'Notiz').TVAL_CHAR).toBe('Notiz')
    expect(buildObservationUpdate('M', '{"drugName":"Atorvastatin"}').OBSERVATION_BLOB).toBe('{"drugName":"Atorvastatin"}')
  })
})

describe('buildNewObservationData', () => {
  const concept = { code: 'LID: 22748-8', valueType: 'N', unit: 'mmol/l' }

  it('builds the empty payload like the legacy chip creator', () => {
    const data = buildNewObservationData({ patientNum: 505, encounterNum: 1139, concept, visitDate: '2024-06-10' })
    expect(data).toMatchObject({
      PATIENT_NUM: 505,
      ENCOUNTER_NUM: 1139,
      CONCEPT_CD: 'LID: 22748-8',
      VALTYPE_CD: 'N',
      START_DATE: '2024-06-10',
      LOCATION_CD: 'VISITS_PAGE',
      UNIT_CD: 'mmol/l',
      TVAL_CHAR: null,
      NVAL_NUM: null,
    })
  })

  it('merges an initial value via the update semantics', () => {
    const data = buildNewObservationData({ patientNum: 505, encounterNum: 1139, concept, value: '1.96' })
    expect(data.NVAL_NUM).toBe(1.96)
    expect(data.TVAL_CHAR).toBeNull()
  })
})

describe('valueTypeHex', () => {
  it('has a color per type and a fallback', () => {
    expect(valueTypeHex('N')).toMatch(/^#/)
    expect(valueTypeHex('ZZ')).toMatch(/^#/)
  })
})
