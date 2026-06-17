// Run Test with:
// npm run test:unit test/jest/__tests__/export_app2.test.js
//
// Export in das native app2-importStructure-Format.

import {
  buildImportStructure,
  buildPatientRecord,
  buildVisitRecord,
  buildQuestionnaireObservations,
  blobFromSummary,
} from '../../../src/tools/export_app2'

const SUMMARY = {
  label: 'demo',
  title: 'Demo Quest',
  items: [
    { label: 'Frage 1', value: 2, id: 1, coding: { display: 'F1', code: 'X1', system: 'SCT' } },
    { label: 'Frage 2', value: 4, id: 2, coding: { display: 'F2', code: 'X2', system: 'SCT' } },
  ],
  results: [
    { label: 'sum', value: 6, coding: { display: 'SUM', code: 'LID: 72172-0', system: 'LOINC' } },
  ],
  coding: { system: 'LOINC', code: 'LID: 72133-2', display: 'Demo' },
  date_start: 1000,
  date_end: 2000,
}

const FIXED_DATE = '2026-01-01T00:00:00.000Z'

describe('export_app2', () => {
  test('buildPatientRecord erzeugt PATIENT_DIMENSION', () => {
    const rec = buildPatientRecord({ pid: 'P1' }, 1)
    expect(rec.PATIENT_NUM).toBe(1)
    expect(rec.PATIENT_CD).toBe('P1')
    expect(rec.SOURCESYSTEM_CD).toBe('SURVEY3')
    expect(typeof rec.VITAL_STATUS_CD).toBe('string')
  })

  test('buildVisitRecord verknüpft Patient/Encounter', () => {
    const rec = buildVisitRecord({ date: '2024-11-29', label: 'V1', inOut: 'O', templateId: null }, 1, 1)
    expect(rec.PATIENT_NUM).toBe(1)
    expect(rec.ENCOUNTER_NUM).toBe(1)
    expect(rec.INOUT_CD).toBe('O')
    expect(rec.START_DATE).toBe('2024-11-29')
    expect(JSON.parse(rec.VISIT_BLOB).label).toBe('V1')
  })

  test('buildQuestionnaireObservations: Q-Observation + abgeleitete N-Observation', () => {
    const obs = buildQuestionnaireObservations(SUMMARY, 1, 1, 1000)
    expect(obs.length).toBe(2)

    const q = obs[0]
    expect(q.VALTYPE_CD).toBe('Q')
    expect(q.CONCEPT_CD).toBe('CUSTOM: QUESTIONNAIRE')
    expect(q.CATEGORY_CHAR).toBe('SURVEY_BEST')
    expect(q.ENCOUNTER_NUM).toBe(1)
    expect(q.PATIENT_NUM).toBe(1)
    const blob = JSON.parse(q.OBSERVATION_BLOB)
    expect(blob.items).toEqual(SUMMARY.items)
    expect(blob.results).toEqual(SUMMARY.results)
    expect(blob.short_title).toBe('demo')
    expect(blob.questionnaire_code).toBe('LID: 72133-2')

    const n = obs[1]
    expect(n.VALTYPE_CD).toBe('N')
    expect(n.NVAL_NUM).toBe(6)
    expect(n.CONCEPT_CD).toBe('LID: 72172-0')
    expect(n.SOURCESYSTEM_CD).toBe('LOINC')
  })

  test('blobFromSummary mappt short_title und questionnaire_code', () => {
    const blob = blobFromSummary(SUMMARY)
    expect(blob.short_title).toBe('demo')
    expect(blob.questionnaire_code).toBe('LID: 72133-2')
    expect(blob.title).toBe('Demo Quest')
  })

  test('buildImportStructure liefert vollständige Struktur mit konsistenten Zählungen', () => {
    const structure = buildImportStructure(
      [
        {
          patient: { pid: 'P1' },
          visits: [
            { visit: { date: '2024-11-29', label: 'V1', inOut: 'O', templateId: null }, summaries: [SUMMARY] },
          ],
        },
      ],
      FIXED_DATE
    )

    // top-level
    expect(structure.metadata.format).toBe('json_import')
    expect(structure.metadata.source).toBe('survey3')
    expect(structure.metadata.patientIds).toEqual(['P1'])
    expect(structure.exportInfo.exportedAt).toBe(FIXED_DATE)

    // data
    expect(structure.data.patients).toHaveLength(1)
    expect(structure.data.patients[0].PATIENT_CD).toBe('P1')
    expect(structure.data.patients[0].PATIENT_NUM).toBe(1)
    expect(structure.data.visits).toHaveLength(1)
    expect(structure.data.visits[0].PATIENT_NUM).toBe(1)
    expect(structure.data.visits[0].ENCOUNTER_NUM).toBe(1)
    expect(structure.data.visits[0].INOUT_CD).toBe('O')
    expect(structure.data.observations).toHaveLength(2)

    // statistics konsistent
    expect(structure.statistics.patientCount).toBe(1)
    expect(structure.statistics.visitCount).toBe(1)
    expect(structure.statistics.observationCount).toBe(2)
    expect(structure.metadata.observationCount).toBe(2)
  })

  test('mehrere Patienten/Visiten vergeben fortlaufende NUMs', () => {
    const structure = buildImportStructure(
      [
        {
          patient: { pid: 'A' },
          visits: [
            { visit: { date: '2024-01-01' }, summaries: [SUMMARY] },
            { visit: { date: '2024-02-01' }, summaries: [] },
          ],
        },
        { patient: { pid: 'B' }, visits: [{ visit: { date: '2024-03-01' }, summaries: [SUMMARY] }] },
      ],
      FIXED_DATE
    )
    expect(structure.data.patients.map((p) => p.PATIENT_NUM)).toEqual([1, 2])
    expect(structure.data.visits.map((v) => v.ENCOUNTER_NUM)).toEqual([1, 2, 3])
    // Patient B ist Encounter 3 → seine Observation referenziert PATIENT_NUM 2 / ENCOUNTER_NUM 3
    const bObs = structure.data.observations.find((o) => o.ENCOUNTER_NUM === 3)
    expect(bObs.PATIENT_NUM).toBe(2)
  })
})
