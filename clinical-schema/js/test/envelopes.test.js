import { describe, it, expect } from 'vitest'
import {
  buildPatient, buildVisit, buildObservation,
  buildSimpleJsonExport, buildHl7CompositionExport,
  SCHEMA_VERSION, FHIR_VERSION, DBBEST_PROFILE_URL,
} from '../index.js'

const samplePatient = buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'EXT_01', BIRTH_DATE: '1980-01-01', SEX_CD: 'SCTID: 407374003', AGE_IN_YEARS: 45 })
const sampleVisit   = buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-04-28', LOCATION_CD: 'CLINIC' })
const sampleObs     = buildObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1, CONCEPT_CD: 'LID: 8480-6', value: 132 })

describe('buildSimpleJsonExport', () => {
  it('produces metadata/exportInfo/data/statistics envelope', () => {
    const env = buildSimpleJsonExport({ patients: [samplePatient], visits: [sampleVisit], observations: [sampleObs] })
    expect(env).toHaveProperty('metadata')
    expect(env).toHaveProperty('exportInfo')
    expect(env).toHaveProperty('data.patients')
    expect(env).toHaveProperty('data.visits')
    expect(env).toHaveProperty('data.observations')
    expect(env).toHaveProperty('statistics')
  })
  it('embeds schema and template version in metadata.generator', () => {
    const env = buildSimpleJsonExport({ patients: [samplePatient] })
    expect(env.metadata.generator.schemaVersion).toBe(SCHEMA_VERSION)
    expect(env.metadata.generator.templateVersion).toBe(SCHEMA_VERSION)
    expect(env.metadata.generator.targetApp).toBe('dbBEST')
  })
  it('counts records correctly in statistics', () => {
    const env = buildSimpleJsonExport({
      patients: [samplePatient], visits: [sampleVisit], observations: [sampleObs, sampleObs],
    })
    expect(env.statistics.patientCount).toBe(1)
    expect(env.statistics.visitCount).toBe(1)
    expect(env.statistics.observationCount).toBe(2)
  })
})

describe('buildHl7CompositionExport', () => {
  it('emits Composition with required FHIR-ish fields', () => {
    const out = buildHl7CompositionExport({ patients: [samplePatient], visits: [sampleVisit], observations: [sampleObs] })
    expect(out.cda.resourceType).toBe('Composition')
    expect(out.cda.fhirVersion).toBe(FHIR_VERSION)
    expect(out.cda.meta.profile).toContain(DBBEST_PROFILE_URL)
    expect(out.cda.status).toBe('preliminary')
    expect(out.cda.title).toBeTruthy()
    expect(out.cda.section[0].title).toBe('Patient Information')
    expect(out.cda.section[1].title).toBe('Visit 1')
  })
  it('throws on empty patients', () => {
    expect(() => buildHl7CompositionExport({ patients: [] })).toThrow(/patient/)
  })
  it('embeds version info in generator', () => {
    const out = buildHl7CompositionExport({ patients: [samplePatient] })
    expect(out.generator.schemaVersion).toBe(SCHEMA_VERSION)
    expect(out.generator.fhirVersion).toBe(FHIR_VERSION)
  })
})
