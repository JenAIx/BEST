// Run Test with:
// npm run test:unit test/jest/__tests__/lecseq_e2e.test.js
//
// End-to-End: Testproband durchläuft alle 4 LEC-SEQ-Visiten (alle Fragebögen
// ausgefüllt + abgeschlossen), Store wird geprüft und der komplette Patienten-Export
// erzeugt, inspiziert und nach /tmp geschrieben (Gegenprüfung gegen den app2-Parser
// erfolgt separat über das dump-File).

import fs from 'fs'
import { VISITMAN } from '../../../src/tools/visits/VisitMan'
import { QUESTMAN } from '../../../src/tools/questman'
import { DEFAULT_VISIT_TEMPLATES } from '../../../src/tools/visits/default-templates'

const PID = 'TESTPROBAND_01'
const FIXED_DATE = '2026-06-17T00:00:00.000Z'

let patientId
const visitIds = []

// erwartete Q-Observations = Summe aller Fragebögen über alle Vorlagen
const EXPECTED_Q = DEFAULT_VISIT_TEMPLATES.reduce((n, t) => n + t.questionnaires.length, 0)

describe('LEC-SEQ End-to-End (Testproband, alle Visiten)', () => {
  test('alle LEC-SEQ-Fragebögen sind geladen', () => {
    const list = QUESTMAN.quest_list
    const needed = new Set()
    DEFAULT_VISIT_TEMPLATES.forEach((t) => t.questionnaires.forEach((q) => needed.add(q)))
    const missing = [...needed].filter((q) => !list.includes(q))
    expect(missing).toEqual([])
  })

  test('Proband anlegen + 4 Visiten füllen und abschließen', () => {
    const patient = VISITMAN.add_patient(PID)
    patientId = patient.id

    DEFAULT_VISIT_TEMPLATES.forEach((tpl, idx) => {
      const visit = VISITMAN.add_visit(patientId, null, `2026-0${idx + 1}-01`)
      VISITMAN.update_visit(visit.id, { label: tpl.label })
      visitIds.push(visit.id)

      tpl.questionnaires.forEach((short_title) => {
        VISITMAN.add_questionnaire(visit.id, short_title)
        // ausfüllen via QuestMan
        QUESTMAN.activeQuest = short_title
        expect(QUESTMAN.activeQuest).not.toBe(undefined)
        expect(QUESTMAN.random_fill()).toBeTruthy()
        const values = QUESTMAN.activeQuest.value.items.map((i) => i.value)
        const summary = QUESTMAN.summary
        VISITMAN.complete_questionnaire(visit.id, short_title, summary, values)
      })
    })

    expect(visitIds.length).toBe(4)
  })

  test('Store: 4 abgeschlossene Visiten, alle Slots completed', () => {
    expect(VISITMAN.get_patient(patientId).pid).toBe(PID)
    const visits = VISITMAN.get_visits_for_patient(patientId)
    expect(visits.length).toBe(4)
    visits.forEach((v, idx) => {
      const prog = VISITMAN.progress(v.id)
      expect(prog.total).toBe(DEFAULT_VISIT_TEMPLATES[idx].questionnaires.length)
      expect(prog.completed).toBe(prog.total)
      expect(v.status).toBe('completed')
      expect(v.items.every((s) => s.status === 'completed' && s.response)).toBe(true)
    })
  })

  test('Export: alle Visiten + Fragebögen als Observations enthalten', () => {
    const struct = VISITMAN.build_patient_export(patientId, FIXED_DATE)

    // Patient + Visiten
    expect(struct.data.patients).toHaveLength(1)
    expect(struct.data.patients[0].PATIENT_CD).toBe(PID)
    expect(struct.data.visits).toHaveLength(4)

    // je Fragebogen genau 1 Q-Observation
    const qObs = struct.data.observations.filter((o) => o.VALTYPE_CD === 'Q')
    expect(qObs).toHaveLength(EXPECTED_Q)
    qObs.forEach((o) => {
      expect(o.CONCEPT_CD).toBe('CUSTOM: QUESTIONNAIRE')
      expect(o.CATEGORY_CHAR).toBe('SURVEY_BEST')
      expect(typeof o.OBSERVATION_BLOB).toBe('string')
    })

    // pro Visite (ENCOUNTER_NUM) stimmt die Anzahl Q-Observations mit der Vorlage
    DEFAULT_VISIT_TEMPLATES.forEach((tpl, idx) => {
      const enc = idx + 1
      const qForVisit = qObs.filter((o) => o.ENCOUNTER_NUM === enc)
      expect(qForVisit).toHaveLength(tpl.questionnaires.length)
    })

    // statistics konsistent
    expect(struct.statistics.visitCount).toBe(4)
    expect(struct.statistics.observationCount).toBe(struct.data.observations.length)

    // NMSS: Gesamtscore im Blob; SLTS-7: Subskalen im Blob
    const blobByLabel = {}
    qObs.forEach((o) => {
      const b = JSON.parse(o.OBSERVATION_BLOB)
      blobByLabel[b.label] = b
    })
    const nmss = blobByLabel['nmss']
    expect(nmss).toBeTruthy()
    const nmssSum = nmss.results.find((r) => r.label === 'sum' || (r.coding && r.coding.code === 'CUSTOM: NMSS_TOTAL'))
    expect(nmssSum).toBeTruthy()
    expect(typeof nmssSum.value).toBe('number')

    const slts = blobByLabel['slts7']
    expect(slts).toBeTruthy()
    expect(slts.results.some((r) => r.coding && r.coding.code === 'CUSTOM: SLTS7_TREATMENT')).toBe(true)

    // Export für manuelle Inspektion ablegen
    fs.writeFileSync('/tmp/lecseq_proband_export.json', JSON.stringify(struct, null, 2))
  })

  test('NMSS & SLTS-7: random_fill liefert numerische Scores', () => {
    QUESTMAN.activeQuest = 'nmss'
    QUESTMAN.random_fill()
    const nmssTotal = QUESTMAN.summary.results.find((r) => r.coding && r.coding.code === 'CUSTOM: NMSS_TOTAL')
    expect(typeof nmssTotal.value).toBe('number')
    expect(nmssTotal.value).toBeGreaterThanOrEqual(0)

    QUESTMAN.activeQuest = 'slts7'
    QUESTMAN.random_fill()
    const sltsTotal = QUESTMAN.summary.results.find((r) => r.coding && r.coding.code === 'CUSTOM: SLTS7_TOTAL')
    expect(typeof sltsTotal.value).toBe('number')
  })
})
