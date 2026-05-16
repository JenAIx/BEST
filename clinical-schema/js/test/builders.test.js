import { describe, it, expect } from 'vitest'
import {
  buildPatient, buildVisit, buildObservation, buildQuestionnaireObservation,
  VALTYPE, VITAL_STATUS, ACTIVE_STATUS, CONCEPT, CATEGORY,
} from '../index.js'

describe('buildPatient', () => {
  it('requires PATIENT_NUM and PATIENT_CD', () => {
    expect(() => buildPatient({})).toThrow(/PATIENT_NUM/)
    expect(() => buildPatient({ PATIENT_NUM: 1 })).toThrow(/PATIENT_CD/)
  })
  it('produces all canonical fields with sensible defaults', () => {
    const p = buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'X' })
    expect(p).toMatchObject({
      PATIENT_NUM: 1,
      PATIENT_CD: 'X',
      VITAL_STATUS_CD: VITAL_STATUS.ALIVE,
      SOURCESYSTEM_CD: 'EXTERNAL',
      UPLOAD_ID: 1,
    })
    expect(p).toHaveProperty('IMPORT_DATE')
    expect(p).toHaveProperty('CREATED_AT')
  })
})

describe('buildVisit', () => {
  it('requires ENCOUNTER_NUM, PATIENT_NUM, START_DATE', () => {
    expect(() => buildVisit({})).toThrow(/ENCOUNTER_NUM/)
    expect(() => buildVisit({ ENCOUNTER_NUM: 1 })).toThrow(/PATIENT_NUM/)
    expect(() => buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1 })).toThrow(/START_DATE/)
  })
  it('defaults INOUT_CD to outpatient and ACTIVE_STATUS_CD to active', () => {
    const v = buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-01-01' })
    expect(v.INOUT_CD).toBe('O')
    expect(v.ACTIVE_STATUS_CD).toBe(ACTIVE_STATUS.ACTIVE)
  })
  it('stringifies VISIT_BLOB if it is an object', () => {
    const v = buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-01-01',
                           VISIT_BLOB: { visitType: 'consult' } })
    expect(typeof v.VISIT_BLOB).toBe('string')
    expect(JSON.parse(v.VISIT_BLOB)).toEqual({ visitType: 'consult' })
  })
})

describe('buildObservation', () => {
  it('auto-routes numeric value to NVAL_NUM with VALTYPE_CD=N', () => {
    const o = buildObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                  CONCEPT_CD: 'LID: 8480-6', value: 132 })
    expect(o.VALTYPE_CD).toBe(VALTYPE.NUMERIC)
    expect(o.NVAL_NUM).toBe(132)
    expect(o.TVAL_CHAR).toBeNull()
  })
  it('auto-routes string value to TVAL_CHAR with VALTYPE_CD=T', () => {
    const o = buildObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                  CONCEPT_CD: 'X', value: 'positive' })
    expect(o.VALTYPE_CD).toBe(VALTYPE.TEXT)
    expect(o.TVAL_CHAR).toBe('positive')
    expect(o.NVAL_NUM).toBeNull()
  })
  it('respects explicit VALTYPE_CD override', () => {
    const o = buildObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                  CONCEPT_CD: 'X', VALTYPE_CD: 'F', TVAL_CHAR: 'yes' })
    expect(o.VALTYPE_CD).toBe('F')
    expect(o.TVAL_CHAR).toBe('yes')
  })
  it('throws on missing required fields', () => {
    expect(() => buildObservation({})).toThrow(/OBSERVATION_ID/)
  })
})

describe('buildQuestionnaireObservation', () => {
  const args = {
    OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
    questionnaireCode: 'MOCA', title: 'MoCA',
    items: [{ id: 1, label: 'Visuospatial', value: 4 }],
    results: [{ label: 'sum', value: 26 }],
  }
  it('sets VALTYPE_CD=Q, CATEGORY=SURVEY_BEST, CONCEPT_CD=CUSTOM: QUESTIONNAIRE', () => {
    const o = buildQuestionnaireObservation(args)
    expect(o.VALTYPE_CD).toBe(VALTYPE.QUESTIONNAIRE)
    expect(o.CATEGORY_CHAR).toBe(CATEGORY.SURVEY)
    expect(o.CONCEPT_CD).toBe(CONCEPT.QUESTIONNAIRE)
    expect(o.TVAL_CHAR).toBe('MoCA')
    expect(o.NVAL_NUM).toBeNull()
  })
  it('serializes blob with items + results', () => {
    const o = buildQuestionnaireObservation(args)
    const blob = JSON.parse(o.OBSERVATION_BLOB)
    expect(blob.title).toBe('MoCA')
    expect(blob.questionnaire_code).toBe('MOCA')
    expect(blob.items).toHaveLength(1)
    expect(blob.results).toHaveLength(1)
  })
})
