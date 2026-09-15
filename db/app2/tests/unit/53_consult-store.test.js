/**
 * consult-store — orchestration of the Visitenmodus with mocked stores/repos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const visits = []
const visitStoreMock = {
  visits,
  selectedVisit: null,
  createVisit: vi.fn(),
  loadVisitsForPatient: vi.fn(async () => {}),
  updateVisit: vi.fn(async () => {}),
}
const observationStoreMock = {
  observations: [],
  getObservationHistory: vi.fn(async () => []),
  loadObservationsForVisit: vi.fn(async () => {}),
}
const medicationsStoreMock = {
  getMedicationHistoryForPatient: vi.fn(async () => []),
  carryForwardMedications: vi.fn(async () => ({ created: [], skipped: [] })),
}
const diagnosisRepoMock = { getProblemList: vi.fn(async () => []), carryForward: vi.fn(async () => ({ created: 1, skipped: 0 })), upsertDiagnosis: vi.fn(async () => ({})), deleteDiagnosis: vi.fn(async () => true), searchIcd10: vi.fn(async () => []) }
const consultRepoMock = { getLetters: vi.fn(async () => []), searchPatientText: vi.fn(async () => []), saveLetter: vi.fn(async () => ({ noteId: 1 })) }
const serviceMock = {
  selectVisitAndLoadObservations: vi.fn(async () => {}),
  createObservation: vi.fn(async (data) => ({ OBSERVATION_ID: 500, ...data })),
  updateObservation: vi.fn(async () => true),
}

const templates = [
  { code: 'consult_pd_erst', label: 'PD Erst', visitType: 'parkinson_erst', followUpTemplate: 'consult_pd_verlauf', inoutCd: 'O', locationCd: 'AMB', staleAfterDays: 365, previousVisitScope: 'any', diagnosis: { show: true, carryForward: false }, medication: { show: true, ledd: true, carryForward: false, showDiff: false, groups: [] }, scoreConcepts: [{ code: 'SCTID: 716138005', short: 'H&Y', higherIsWorse: true, required: true }, { code: 'NEURO:SCORE:LEDD', short: 'LEDD', derived: 'ledd' }], contextConcepts: [], textConcepts: [{ code: 'SCTID: 422625006', label: 'Anamnese', carryForward: false }, { code: 'LID: 51848-0', label: 'Beurteilung', carryForward: true }], checklist: ['SCTID: 716138005', 'LID: 51848-0'], suggestedQuestionnaires: [], letterSections: [] },
  { code: 'consult_pd_verlauf', label: 'PD Verlauf', visitType: 'parkinson_verlauf', inoutCd: 'O', locationCd: 'AMB', staleAfterDays: 365, previousVisitScope: 'any', diagnosis: { show: true, carryForward: true }, medication: { show: true, ledd: true, carryForward: true, showDiff: true, groups: [] }, scoreConcepts: [{ code: 'SCTID: 716138005', short: 'H&Y', higherIsWorse: true, required: true }, { code: 'NEURO:SCORE:LEDD', short: 'LEDD', derived: 'ledd' }], contextConcepts: [], textConcepts: [{ code: 'SCTID: 422625006', label: 'Verlauf', carryForward: false }, { code: 'LID: 51848-0', label: 'Beurteilung', carryForward: true }], checklist: ['SCTID: 716138005', 'LID: 51848-0'], suggestedQuestionnaires: [], letterSections: [] },
]

vi.mock('src/stores/database-store', () => ({ useDatabaseStore: () => ({ getRepository: (name) => ({ diagnosis: diagnosisRepoMock, consult: consultRepoMock })[name] || null }) }))
vi.mock('src/stores/visit-store', () => ({ useVisitStore: () => visitStoreMock }))
vi.mock('src/stores/observation-store', () => ({ useObservationStore: () => observationStoreMock }))
vi.mock('src/stores/medications-store', () => ({ useMedicationsStore: () => medicationsStoreMock }))
vi.mock('src/stores/global-settings-store', () => ({ useGlobalSettingsStore: () => ({ getConsultTemplateOptions: async () => templates, loadLookupValues: async () => [], parseMetadata: () => ({}) }) }))
vi.mock('src/stores/auth-store', () => ({ useAuthStore: () => ({ providerId: 'ste' }) }))
vi.mock('src/stores/logging-store', () => ({ useLoggingStore: () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }) }))
vi.mock('src/services/visit-observation-service', () => ({ visitObservationService: serviceMock }))

const { useConsultStore } = await import('src/stores/consult-store')

const today = new Date()
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const mkVisit = (id, date, blob) => ({ id, date, visitType: blob.visitType, rawData: { VISIT_BLOB: JSON.stringify(blob) } })

describe('consult-store', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    visits.length = 0
    visits.push(mkVisit(10, '2026-03-12', { visitType: 'parkinson_erst', consultTemplate: 'consult_pd_erst' }))
    visitStoreMock.selectedVisit = null
    for (const m of [visitStoreMock.createVisit, visitStoreMock.loadVisitsForPatient, visitStoreMock.updateVisit, observationStoreMock.getObservationHistory, observationStoreMock.loadObservationsForVisit, medicationsStoreMock.getMedicationHistoryForPatient, medicationsStoreMock.carryForwardMedications, diagnosisRepoMock.getProblemList, diagnosisRepoMock.carryForward, consultRepoMock.getLetters, serviceMock.selectVisitAndLoadObservations, serviceMock.createObservation, serviceMock.updateObservation]) m.mockClear()
    observationStoreMock.getObservationHistory.mockResolvedValue([
      { observationId: 1, encounterNum: 10, conceptCode: 'SCTID: 716138005', valueType: 'N', numericValue: 2.5, visitDate: '2026-03-12' },
      { observationId: 2, encounterNum: 10, conceptCode: 'LID: 51848-0', valueType: 'T', value: 'Stabiles IPS.', visitDate: '2026-03-12' },
    ])
    medicationsStoreMock.getMedicationHistoryForPatient.mockResolvedValue([{ encounterNum: 10, visitDate: '2026-03-12', medications: [{ observationId: 7, drugName: 'Levodopa/Benserazid', dosage: 100, frequency: 'tid' }] }])
    serviceMock.createObservation.mockImplementation(async (data) => ({ OBSERVATION_ID: 500, ...data }))
    store = useConsultStore()
  })

  it('opens read-only with the follow-up template suggested from the last visit', async () => {
    await store.openCockpit({ patientNum: 1 })
    expect(store.templateCode).toBe('consult_pd_verlauf') // erst → verlauf
    expect(store.todayVisit).toBeNull()
    expect(store.isEditable).toBe(false)
    expect(store.lastVisit.id).toBe(10)
    expect(store.daysSinceLastVisit).toBeGreaterThan(0)
    // scores: shown value = last visit's, not today
    const hy = store.scoreStrip.find((s) => s.code === 'SCTID: 716138005')
    expect(hy).toMatchObject({ current: 2.5, isToday: false, currentDate: '2026-03-12' })
    // LEDD derived from the last medication visit
    const ledd = store.scoreStrip.find((s) => s.derived === 'ledd')
    expect(ledd.current).toBe(300)
    expect(store.medicationVisitId).toBe(10)
    expect(store.textSections.find((t) => t.code === 'LID: 51848-0').history[0].value).toBe('Stabiles IPS.')
    expect(() => store.saveTextSync).not.toThrow()
  })

  it('startConsultation creates today\'s visit with the template in VISIT_BLOB and selects it', async () => {
    visitStoreMock.createVisit.mockImplementation(async (data) => {
      const created = { ENCOUNTER_NUM: 11, ...data }
      visits.push(mkVisit(11, data.START_DATE, JSON.parse(data.VISIT_BLOB)))
      return created
    })
    await store.openCockpit({ patientNum: 1 })
    await store.startConsultation({ templateCode: 'consult_pd_verlauf' })
    const payload = visitStoreMock.createVisit.mock.calls[0][0]
    expect(payload.PATIENT_NUM).toBe(1)
    expect(payload.START_DATE.startsWith(todayIso)).toBe(true)
    expect(JSON.parse(payload.VISIT_BLOB)).toMatchObject({ visitType: 'parkinson_verlauf', consultTemplate: 'consult_pd_verlauf', createdBy: 'CONSULT' })
    expect(serviceMock.selectVisitAndLoadObservations).toHaveBeenCalled()
    expect(store.todayVisit.id).toBe(11)
    expect(store.isEditable).toBe(true)
    expect(store.lastVisit.id).toBe(10)
    // previous medication = last visit; today has none → diff shows everything as stopped
    expect(store.previousMedicationVisitId).toBe(10)
    expect(store.medications).toEqual([])
  })

  it('saveText creates on first save (skipReload) and updates afterwards; carry-forward copies the last text', async () => {
    visits.push(mkVisit(11, todayIso, { visitType: 'parkinson_verlauf', consultTemplate: 'consult_pd_verlauf' }))
    await store.openCockpit({ patientNum: 1 })
    expect(store.todayVisit.id).toBe(11)
    await store.saveText('SCTID: 422625006', 'Seit dem letzten Mal stabil.')
    expect(serviceMock.createObservation).toHaveBeenCalledTimes(1)
    const [data, opts] = serviceMock.createObservation.mock.calls[0]
    expect(data).toMatchObject({ PATIENT_NUM: 1, ENCOUNTER_NUM: 11, CONCEPT_CD: 'SCTID: 422625006', VALTYPE_CD: 'T', TVAL_CHAR: 'Seit dem letzten Mal stabil.' })
    expect(opts).toEqual({ skipReload: true })
    expect(store.textSections.find((t) => t.code === 'SCTID: 422625006').current.observationId).toBe(500)
    await store.saveText('SCTID: 422625006', 'Seit dem letzten Mal stabil, leichtes Wearing-off.')
    expect(serviceMock.updateObservation).toHaveBeenCalledWith(500, expect.objectContaining({ TVAL_CHAR: 'Seit dem letzten Mal stabil, leichtes Wearing-off.', VALUEFLAG_CD: null }), { skipReload: true })
    expect(observationStoreMock.loadObservationsForVisit).toHaveBeenCalledWith(11)

    const src = await store.carryForwardText('LID: 51848-0')
    expect(src.value).toBe('Stabiles IPS.')
    expect(store.textSections.find((t) => t.code === 'LID: 51848-0')).toMatchObject({ carried: true, current: { value: 'Stabiles IPS.' } })
    // editing the carried text drops the chip
    await store.saveText('LID: 51848-0', 'Stabiles IPS, Dosis erhöht.')
    expect(store.textSections.find((t) => t.code === 'LID: 51848-0').carried).toBe(false)
  })

  it('setScoreValue writes a numeric row and the strip shows it as today\'s value with Δ', async () => {
    visits.push(mkVisit(11, todayIso, { visitType: 'parkinson_verlauf', consultTemplate: 'consult_pd_verlauf' }))
    await store.openCockpit({ patientNum: 1 })
    await store.setScoreValue('SCTID: 716138005', 3)
    const hy = store.scoreStrip.find((s) => s.code === 'SCTID: 716138005')
    expect(hy).toMatchObject({ current: 3, previous: 2.5, delta: 0.5, isToday: true })
    expect(store.checklist.done).toBe(1)
  })

  it('carryForwardAll respects the template flags and recomputes LEDD after medication carry-over', async () => {
    visits.push(mkVisit(11, todayIso, { visitType: 'parkinson_verlauf', consultTemplate: 'consult_pd_verlauf' }))
    medicationsStoreMock.carryForwardMedications.mockImplementation(async () => {
      medicationsStoreMock.getMedicationHistoryForPatient.mockResolvedValue([
        { encounterNum: 10, visitDate: '2026-03-12', medications: [{ observationId: 7, drugName: 'Levodopa/Benserazid', dosage: 100, frequency: 'tid' }] },
        { encounterNum: 11, visitDate: todayIso, medications: [{ observationId: 8, drugName: 'Levodopa/Benserazid', dosage: 100, frequency: 'tid', carriedFrom: { encounterNum: 10 } }] },
      ])
      return { created: [{}], skipped: [] }
    })
    await store.openCockpit({ patientNum: 1 })
    const r = await store.carryForwardAll()
    expect(diagnosisRepoMock.carryForward).toHaveBeenCalledWith(expect.objectContaining({ fromEncounter: 10, toEncounter: 11 }))
    expect(medicationsStoreMock.carryForwardMedications).toHaveBeenCalledWith(expect.objectContaining({ fromEncounter: 10, toEncounter: 11 }))
    expect(r.texts.map((x) => x.code)).toEqual(['LID: 51848-0'])
    expect(store.medications).toHaveLength(1)
    expect(store.medicationDiff.summary).toEqual({ added: 0, stopped: 0, changed: 0 })
    // LEDD persisted as computed observation
    const leddCall = serviceMock.createObservation.mock.calls.find(([d]) => d.CONCEPT_CD === 'NEURO:SCORE:LEDD')
    expect(leddCall[0].NVAL_NUM).toBe(300)
    expect(JSON.parse(leddCall[0].OBSERVATION_BLOB).computed).toBe(true)
  })

  it('recomputeLEDD leaves a manual value alone', async () => {
    visits.push(mkVisit(11, todayIso, { visitType: 'parkinson_verlauf', consultTemplate: 'consult_pd_verlauf' }))
    observationStoreMock.getObservationHistory.mockResolvedValue([{ observationId: 9, encounterNum: 11, conceptCode: 'NEURO:SCORE:LEDD', valueType: 'N', numericValue: 999, blob: null, visitDate: todayIso }])
    medicationsStoreMock.getMedicationHistoryForPatient.mockResolvedValue([{ encounterNum: 11, visitDate: todayIso, medications: [{ observationId: 8, drugName: 'Levodopa', dosage: 100, frequency: 'tid' }] }])
    await store.openCockpit({ patientNum: 1 })
    const r = await store.recomputeLEDD()
    expect(r).toEqual({ manual: true, value: 999 })
    expect(serviceMock.updateObservation).not.toHaveBeenCalled()
  })

  it('throws a clear error when writing without today\'s visit', async () => {
    await store.openCockpit({ patientNum: 1 })
    await expect(store.saveText('SCTID: 422625006', 'x')).rejects.toThrow(/Visite beginnen/)
  })
})
