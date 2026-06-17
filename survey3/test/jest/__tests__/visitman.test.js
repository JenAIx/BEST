// Run Test with:
// npm run test:unit test/jest/__tests__/visitman.test.js
//
// Lifecycle des VisitMan-Singletons: anlegen → füllen → Entwurf → fortsetzen →
// abschließen → exportieren → kaskadiert löschen. IndexedDB-Writes scheitern im
// Node-Env still (fire-and-forget) — getestet wird der reaktive In-Memory-Zustand.

import { VISITMAN } from '../../../src/tools/visits/VisitMan'

const SUMMARY = {
  label: 'demo',
  title: 'Demo Quest',
  items: [{ label: 'F1', value: 2, coding: { code: 'X1' } }],
  results: [{ label: 'sum', value: 6, coding: { code: 'LID: 1', system: 'LOINC' } }],
  coding: { code: 'LID: 100', system: 'LOINC', display: 'Demo' },
  date_start: 1000,
  date_end: 2000,
}

let patientId
let templateId
let visitId

describe('VisitMan lifecycle', () => {
  test('Patient anlegen', () => {
    const p = VISITMAN.add_patient('PID_TEST_1')
    patientId = p.id
    expect(p.pid).toBe('PID_TEST_1')
    expect(VISITMAN.get_patient(patientId).id).toBe(patientId)
    expect(VISITMAN.get_patient_by_pid('PID_TEST_1').id).toBe(patientId)
  })

  test('Vorlage anlegen und Visite daraus erzeugen', () => {
    const tpl = VISITMAN.add_template('Aufnahme', ['quA', 'quB'])
    templateId = tpl.id
    const visit = VISITMAN.add_visit(patientId, templateId)
    visitId = visit.id
    expect(visit.patientId).toBe(patientId)
    expect(visit.items.map((i) => i.short_title)).toEqual(['quA', 'quB'])
    expect(VISITMAN.get_visits_for_patient(patientId).some((v) => v.id === visit.id)).toBe(true)
  })

  test('ad-hoc Fragebogen ergänzen (keine Duplikate)', () => {
    VISITMAN.add_questionnaire(visitId, 'quC')
    VISITMAN.add_questionnaire(visitId, 'quC') // Duplikat
    const visit = VISITMAN.get_visit(visitId)
    expect(visit.items.map((i) => i.short_title)).toEqual(['quA', 'quB', 'quC'])
  })

  test('Entwurf speichern setzt Status draft und persistiert Werte', () => {
    const slot = VISITMAN.save_draft(visitId, 'quA', [1, 2, 3])
    expect(slot.status).toBe('draft')
    expect(slot.draft.values).toEqual([1, 2, 3])
    expect(slot.date_start).toBeTruthy()
    // Visite noch nicht komplett
    expect(VISITMAN.get_visit(visitId).status).toBe('open')
  })

  test('Entwurf fortsetzen: gespeicherte Werte abrufbar', () => {
    const slot = VISITMAN.get_slot(visitId, 'quA')
    expect(slot.draft.values).toEqual([1, 2, 3])
  })

  test('Fragebogen abschließen setzt completed + speichert summary und Roh-Werte', () => {
    const slot = VISITMAN.complete_questionnaire(visitId, 'quA', SUMMARY, [1, 2, 3])
    expect(slot.status).toBe('completed')
    expect(slot.response.results[0].value).toBe(6)
    expect(slot.draft.values).toEqual([1, 2, 3]) // weiterhin editierbar
    expect(VISITMAN.progress(visitId)).toEqual({ completed: 1, total: 3 })
  })

  test('Visite wird completed, wenn alle Slots abgeschlossen sind', () => {
    VISITMAN.complete_questionnaire(visitId, 'quB', SUMMARY, [])
    VISITMAN.complete_questionnaire(visitId, 'quC', SUMMARY, [])
    const visit = VISITMAN.get_visit(visitId)
    expect(visit.status).toBe('completed')
    expect(VISITMAN.progress(visitId)).toEqual({ completed: 3, total: 3 })
  })

  test('Export einer Visite enthält nur abgeschlossene Fragebögen', () => {
    const structure = VISITMAN.build_visit_export(visitId, '2026-01-01T00:00:00.000Z')
    expect(structure.data.patients[0].PATIENT_CD).toBe('PID_TEST_1')
    expect(structure.data.visits).toHaveLength(1)
    // 3 abgeschlossene Fragebögen → je 1 Q-Obs + 1 N-Obs (results.sum) = 6 Observations
    expect(structure.data.observations).toHaveLength(6)
    const qObs = structure.data.observations.filter((o) => o.VALTYPE_CD === 'Q')
    expect(qObs).toHaveLength(3)
  })

  test('Export eines Patienten bündelt alle Visiten', () => {
    VISITMAN.add_visit(patientId, null) // leere Zusatz-Visite
    const structure = VISITMAN.build_patient_export(patientId, '2026-01-01T00:00:00.000Z')
    expect(structure.data.patients).toHaveLength(1)
    expect(structure.data.visits).toHaveLength(2)
    expect(structure.statistics.patientCount).toBe(1)
  })

  test('mark_exported setzt exportedAt', () => {
    VISITMAN.mark_exported(visitId)
    expect(VISITMAN.get_visit(visitId).exportedAt).toBeTruthy()
  })

  test('Patient löschen kaskadiert alle Visiten', () => {
    const before = VISITMAN.get_visits_for_patient(patientId).length
    expect(before).toBeGreaterThan(0)
    VISITMAN.remove_patient(patientId)
    expect(VISITMAN.get_patient(patientId)).toBeUndefined()
    expect(VISITMAN.get_visits_for_patient(patientId)).toHaveLength(0)
  })
})
