/**
 * Regression tests for the observation list queries feeding the unified
 * timeline. The read cards render from loadAllObservationsForPatient —
 * that query MUST ship VALUEFLAG_CD (NV ∅ tiles, blank filter) and the
 * small Q/M blobs (questionnaire status/score, medication
 * frequency/route), while R blobs (raw file bytes) stay NULL in every
 * list load (perf invariant).
 *
 * The gap this pins down: the patient-wide query selected neither
 * VALUEFLAG_CD nor OBSERVATION_BLOB, so read mode showed medications
 * without "1-0-0 p.o.", questionnaires always as completed, and the
 * blank filter would have hidden NV rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isBlankObservation, parseMedicationObservation } from '../../src/shared/utils/observation-display.js'
import { parseQuestionnaireObservation } from '../../src/shared/utils/questionnaire-display.js'

const executeQueryMock = vi.fn()

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({ executeQuery: executeQueryMock }),
}))

vi.mock('src/stores/auth-store', () => ({
  useAuthStore: () => ({ providerId: 'PROV1' }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() }),
  }),
}))

const { useObservationStore } = await import('src/stores/observation-store')

const M_BLOB = JSON.stringify({ drugName: 'Aspirin', dosage: 100, dosageUnit: 'mg', frequency: 'qd', route: 'po', instructions: '' })
const Q_PENDING_BLOB = JSON.stringify({ _status: 'pending', _questionnaireCode: 'MOCA', _savedResponses: { a: 1, b: '' }, title: 'MoCA' })

const dbRows = [
  { OBSERVATION_ID: 1, CONCEPT_CD: 'LID: 52418-1', VALTYPE_CD: 'M', TVAL_CHAR: 'Aspirin', NVAL_NUM: 100, UNIT_CD: 'mg', ENCOUNTER_NUM: 5, OBSERVATION_BLOB: M_BLOB, VALUEFLAG_CD: null },
  { OBSERVATION_ID: 2, CONCEPT_CD: 'CUSTOM: QUESTIONNAIRE', VALTYPE_CD: 'Q', TVAL_CHAR: 'MoCA', ENCOUNTER_NUM: 5, OBSERVATION_BLOB: Q_PENDING_BLOB, VALUEFLAG_CD: null },
  { OBSERVATION_ID: 3, CONCEPT_CD: 'LID: 2947-0', VALTYPE_CD: 'N', TVAL_CHAR: null, NVAL_NUM: null, UNIT_CD: 'mmol/l', ENCOUNTER_NUM: 5, OBSERVATION_BLOB: null, VALUEFLAG_CD: 'NV' },
]

describe('observation list queries (unified timeline data source)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    executeQueryMock.mockReset().mockResolvedValue({ success: true, data: dbRows })
  })

  it('loadAllObservationsForPatient ships VALUEFLAG_CD + Q/M blobs, R blobs stay NULL', async () => {
    const store = useObservationStore()
    await store.loadAllObservationsForPatient(505)

    const [sql] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('VALUEFLAG_CD')
    expect(sql).toMatch(/CASE WHEN VALTYPE_CD = 'R' THEN NULL ELSE OBSERVATION_BLOB END/)
  })

  it('the transformed read rows carry everything the tiles derive from', async () => {
    const store = useObservationStore()
    const rows = await store.loadAllObservationsForPatient(505)

    // M tile → prescription notation source data
    const medication = parseMedicationObservation(rows[0])
    expect(medication).toMatchObject({ drugName: 'Aspirin', dosage: 100, dosageUnit: 'mg', frequency: 'qd', route: 'po' })

    // Q tile → pending status + progress
    const quest = parseQuestionnaireObservation(rows[1])
    expect(quest.isCompleted).toBe(false)
    expect(quest.progress).toBe(0.5)

    // NV row → visible ∅ tile, NOT hidden by the blank filter
    expect(rows[2].rawData.VALUEFLAG_CD).toBe('NV')
    expect(isBlankObservation(rows[2])).toBe(false)
  })

  it('loadObservationsForVisit (editor source) ships VALUEFLAG_CD too', async () => {
    const store = useObservationStore()
    await store.loadObservationsForVisit(5)

    const [sql] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('VALUEFLAG_CD')
    expect(sql).toMatch(/CASE WHEN VALTYPE_CD = 'R' THEN NULL ELSE OBSERVATION_BLOB END/)
  })
})
