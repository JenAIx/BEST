/**
 * Tests for the medications-store paths used by the unified form grid:
 *   - createMedication with direct patientNum + field-set conceptCode +
 *     visit date (no patient-code lookup)
 *   - legacy path (patientId lookup, default concept) stays intact
 *   - update/create return the serialized OBSERVATION_BLOB so the grid can
 *     mirror the save into the store object (CLAUDE.md propagation invariant)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const createObservationMock = vi.fn()
const findByPatientCodeMock = vi.fn()
const executeQueryMock = vi.fn()

vi.mock('src/stores/database-store.js', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    getRepository: (name) => {
      if (name === 'observation') return { createObservation: createObservationMock }
      if (name === 'patient') return { findByPatientCode: findByPatientCodeMock }
      return null
    },
  }),
}))

vi.mock('src/stores/auth-store.js', () => ({
  useAuthStore: () => ({ providerId: 'PROV1' }),
}))

vi.mock('src/stores/global-settings-store.js', () => ({
  useGlobalSettingsStore: () => ({
    getDefaultSourceSystem: vi.fn().mockResolvedValue('VISITS_PAGE'),
  }),
}))

vi.mock('src/stores/logging-store.js', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() }),
  }),
}))

const { useMedicationsStore } = await import('src/stores/medications-store.js')

const medicationData = { drugName: 'ASS', dosage: 100, dosageUnit: 'mg', frequency: 'BID', route: 'PO', instructions: 'Nach dem Essen' }

describe('medications-store (unified grid paths)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createObservationMock.mockReset().mockResolvedValue({ observationId: 555 })
    findByPatientCodeMock.mockReset().mockResolvedValue({ PATIENT_NUM: 99 })
    executeQueryMock.mockReset().mockResolvedValue({ success: true, changes: 1 })
  })

  it('createMedication with patientNum + conceptCode + visitDate skips the code lookup', async () => {
    const store = useMedicationsStore()
    const result = await store.createMedication({
      patientNum: 505,
      visitId: 1139,
      conceptCode: 'CUSTOM: STUDY_MED',
      visitDate: '2026-06-01',
      medicationData,
    })

    expect(findByPatientCodeMock).not.toHaveBeenCalled()
    expect(createObservationMock).toHaveBeenCalledTimes(1)
    const row = createObservationMock.mock.calls[0][0]
    expect(row).toMatchObject({
      PATIENT_NUM: 505,
      ENCOUNTER_NUM: 1139,
      CONCEPT_CD: 'CUSTOM: STUDY_MED',
      VALTYPE_CD: 'M',
      TVAL_CHAR: 'ASS',
      NVAL_NUM: 100,
      UNIT_CD: 'mg',
      START_DATE: '2026-06-01',
      CATEGORY_CHAR: 'Medications',
    })
    const blob = JSON.parse(row.OBSERVATION_BLOB)
    expect(blob).toMatchObject({ drugName: 'ASS', dosage: 100, frequency: 'BID', route: 'PO', instructions: 'Nach dem Essen' })

    // serialized blob comes back for local mirroring
    expect(JSON.parse(result.observationBlob).frequency).toBe('BID')
    expect(result.conceptCode).toBe('CUSTOM: STUDY_MED')
  })

  it('legacy path: patientId lookup + default medication concept', async () => {
    const store = useMedicationsStore()
    await store.createMedication({ patientId: 'P-0001', visitId: 7, medicationData })

    expect(findByPatientCodeMock).toHaveBeenCalledWith('P-0001')
    const row = createObservationMock.mock.calls[0][0]
    expect(row.PATIENT_NUM).toBe(99)
    expect(row.CONCEPT_CD).toBe('LID: 52418-1')
  })

  it('createMedication requires a drug name', async () => {
    const store = useMedicationsStore()
    await expect(store.createMedication({ patientNum: 505, visitId: 1, medicationData: { drugName: '  ' } })).rejects.toThrow('Drug name is required')
  })

  it('updateMedication writes TVAL/NVAL/UNIT/BLOB and returns the serialized blob', async () => {
    const store = useMedicationsStore()
    const result = await store.updateMedication({ observationId: 321, medicationData })

    const updateCall = executeQueryMock.mock.calls.find((c) => /UPDATE OBSERVATION_FACT/.test(c[0]))
    expect(updateCall).toBeTruthy()
    const [sql, params] = updateCall
    expect(sql).toContain('TVAL_CHAR = ?')
    expect(sql).toContain('OBSERVATION_BLOB = ?')
    expect(params[0]).toBe('ASS') // drug name
    expect(params[1]).toBe(100) // dosage
    expect(params[2]).toBe('mg') // unit
    expect(JSON.parse(params[3])).toMatchObject({ frequency: 'BID', route: 'PO' })
    expect(params[4]).toBe('PROV1')
    expect(params[5]).toBe(321)

    expect(result.drugName).toBe('ASS')
    expect(JSON.parse(result.observationBlob).route).toBe('PO')
  })
})
