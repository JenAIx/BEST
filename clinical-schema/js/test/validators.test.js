import { describe, it, expect } from 'vitest'
import {
  buildPatient, buildVisit, buildObservation,
  buildSimpleJsonExport, buildHl7CompositionExport,
  validatePatient, validateVisit, validateObservation,
  validateSimpleJsonEnvelope, validateHl7CompositionEnvelope, validateEnvelope,
} from '../index.js'

describe('validatePatient', () => {
  it('rejects patient without PATIENT_CD', () => {
    const r = validatePatient({ PATIENT_NUM: 1 })
    expect(r.isValid).toBe(false)
    expect(r.errors.map((e) => e.code)).toContain('MISSING_PATIENT_CD')
  })
  it('passes a built patient', () => {
    const r = validatePatient(buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' }))
    expect(r.isValid).toBe(true)
  })
})

describe('validateObservation', () => {
  it('flags unknown VALTYPE_CD', () => {
    const r = validateObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                     CONCEPT_CD: 'X', VALTYPE_CD: 'Z' })
    expect(r.isValid).toBe(false)
    expect(r.errors.map((e) => e.code)).toContain('UNKNOWN_VALTYPE_CD')
  })
  it('errors when VALTYPE_CD=Q has no OBSERVATION_BLOB', () => {
    const r = validateObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                     CONCEPT_CD: 'X', VALTYPE_CD: 'Q', TVAL_CHAR: 'MoCA' })
    expect(r.errors.map((e) => e.code)).toContain('Q_WITHOUT_BLOB')
  })
  it('warns when VALTYPE_CD=N has no NVAL_NUM', () => {
    const r = validateObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                     CONCEPT_CD: 'X', VALTYPE_CD: 'N' })
    expect(r.warnings.map((w) => w.code)).toContain('NUMERIC_WITHOUT_NVAL')
  })
})

describe('validateSimpleJsonEnvelope', () => {
  it('passes a built envelope', () => {
    const env = buildSimpleJsonExport({
      patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })],
      visits: [buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-01-01' })],
      observations: [buildObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1, CONCEPT_CD: 'X', value: 1 })],
    })
    const r = validateSimpleJsonEnvelope(env)
    expect(r.isValid).toBe(true)
  })
  it('warns when foreign keys do not resolve', () => {
    const env = buildSimpleJsonExport({
      patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })],
      visits: [buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 99, START_DATE: '2026-01-01' })],
    })
    const r = validateSimpleJsonEnvelope(env)
    expect(r.warnings.map((w) => w.code)).toContain('UNKNOWN_PATIENT_REF')
  })
})

describe('validateHl7CompositionEnvelope', () => {
  it('passes a built HL7 envelope', () => {
    const env = buildHl7CompositionExport({
      patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })],
      visits: [buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-01-01' })],
    })
    const r = validateHl7CompositionEnvelope(env)
    expect(r.isValid).toBe(true)
  })
  it('rejects missing cda', () => {
    const r = validateHl7CompositionEnvelope({ foo: 'bar' })
    expect(r.errors.map((e) => e.code)).toContain('MISSING_CDA')
  })
})

describe('validateEnvelope (auto-detect)', () => {
  it('routes Composition envelopes to HL7 validator', () => {
    const env = buildHl7CompositionExport({ patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })] })
    expect(validateEnvelope(env).isValid).toBe(true)
  })
  it('routes simple JSON envelopes to simple validator', () => {
    const env = buildSimpleJsonExport({ patients: [buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })] })
    expect(validateEnvelope(env).isValid).toBe(true)
  })
})
