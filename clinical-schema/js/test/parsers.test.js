import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  buildPatient, buildVisit, buildObservation, buildQuestionnaireObservation,
  buildSimpleJsonExport, buildHl7CompositionExport,
  parseSimpleJson, parseHl7Composition,
  VALTYPE,
} from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = resolve(here, '..', '..', 'fixtures')

describe('parseSimpleJson', () => {
  it('parses the dbBEST 02_simple_json.json fixture', () => {
    const json = JSON.parse(readFileSync(resolve(fixtures, '02_simple_json.json'), 'utf8'))
    const records = parseSimpleJson(json)
    expect(records.patients.length).toBeGreaterThan(0)
    expect(records.visits.length).toBeGreaterThan(0)
    expect(records.observations.length).toBeGreaterThan(0)
    // first patient must have canonical UPPER_SNAKE keys
    expect(records.patients[0]).toHaveProperty('PATIENT_NUM')
    expect(records.patients[0]).toHaveProperty('PATIENT_CD')
  })

  it('round-trips: build → parse keeps PATIENT_NUM, ENCOUNTER_NUM, OBSERVATION_ID', () => {
    const patient = buildPatient({ PATIENT_NUM: 7, PATIENT_CD: 'RT_07' })
    const visit = buildVisit({ ENCOUNTER_NUM: 42, PATIENT_NUM: 7, START_DATE: '2026-04-28' })
    const obs = buildObservation({ OBSERVATION_ID: 100, ENCOUNTER_NUM: 42, PATIENT_NUM: 7,
                                    CONCEPT_CD: 'LID: 8480-6', value: 130 })
    const env = buildSimpleJsonExport({ patients: [patient], visits: [visit], observations: [obs] })
    const back = parseSimpleJson(env)
    expect(back.patients[0].PATIENT_NUM).toBe(7)
    expect(back.patients[0].PATIENT_CD).toBe('RT_07')
    expect(back.visits[0].ENCOUNTER_NUM).toBe(42)
    expect(back.observations[0].OBSERVATION_ID).toBe(100)
    expect(back.observations[0].VALTYPE_CD).toBe(VALTYPE.NUMERIC)
    expect(back.observations[0].NVAL_NUM).toBe(130)
  })

  it('preserves questionnaire observations through round-trip', () => {
    const q = buildQuestionnaireObservation({
      OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
      questionnaireCode: 'MOCA', title: 'MoCA',
      items: [{ id: 1, label: 'A', value: 1 }], results: [{ label: 'sum', value: 30 }],
    })
    const env = buildSimpleJsonExport({
      patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })],
      visits: [buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-01-01' })],
      observations: [q],
    })
    const back = parseSimpleJson(env)
    expect(back.observations[0].VALTYPE_CD).toBe(VALTYPE.QUESTIONNAIRE)
    expect(back.observations[0].TVAL_CHAR).toBe('MoCA')
    const blob = JSON.parse(back.observations[0].OBSERVATION_BLOB)
    expect(blob.questionnaire_code).toBe('MOCA')
    expect(blob.results[0].value).toBe(30)
  })

  it('accepts alt key names (lowercase / camelCase)', () => {
    const env = {
      data: {
        patients: [{ id: 1, patientId: 'X', dob: '1990-01-01', sex: 'male' }],
        visits: [{ id: 1, patientId: 1, startDate: '2026-01-01' }],
        observations: [{ id: 1, encounterId: 1, patientId: 1, conceptCode: 'X',
                         valtypeCd: 'N', value: 5 }],
      },
    }
    const back = parseSimpleJson(env)
    expect(back.patients[0].PATIENT_NUM).toBe(1)
    expect(back.patients[0].PATIENT_CD).toBe('X')
    expect(back.visits[0].START_DATE).toBe('2026-01-01')
    expect(back.observations[0].NVAL_NUM).toBe(5)
  })
})

describe('parseHl7Composition', () => {
  it('does not throw on the dbBEST 03_hl7_composition.json fixture', () => {
    // Real-world fixture uses German "Visite: N" section titles which neither
    // the parser nor dbBEST's own importer recognize. Just verify we accept
    // the envelope shape without crashing.
    const json = JSON.parse(readFileSync(resolve(fixtures, '03_hl7_composition.json'), 'utf8'))
    expect(() => parseHl7Composition(json)).not.toThrow()
  })

  it('round-trips a freshly built HL7 export', () => {
    const env = buildHl7CompositionExport({
      patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'EXT_01' })],
      visits: [buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-01-01', LOCATION_CD: 'CLINIC' })],
    })
    const back = parseHl7Composition(env)
    expect(back.patients).toHaveLength(1)
    expect(back.patients[0].PATIENT_CD).toBe('EXT_01')
    expect(back.visits).toHaveLength(1)
    expect(back.visits[0].START_DATE).toBe('2026-01-01')
  })

  it('rejects non-Composition input', () => {
    expect(() => parseHl7Composition({ resourceType: 'Bundle' })).toThrow(/Composition/)
  })
})
