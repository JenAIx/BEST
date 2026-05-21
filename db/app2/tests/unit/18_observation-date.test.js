/**
 * @vitest-environment jsdom
 *
 * Tests for the per-observation date workflow exposed by the data grid:
 *   - data-grid-store.setObservationStartDate (UPDATE START_DATE + local mirror)
 *   - data-grid-store.handleCellUpdate mirrors startDate into local state
 *
 * Strategy: mock the database store, drive the actions, assert the SQL +
 * mutated row state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const executeQueryMock = vi.fn()

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    loadBatchPatientData: vi.fn(),
    loadBatchObservationData: vi.fn(),
    processObservationDataForGrid: vi.fn(),
  }),
}))

vi.mock('src/stores/local-settings-store', () => ({
  useLocalSettingsStore: () => ({
    getSetting: () => null,
    setSetting: () => {},
  }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
    }),
  }),
}))

const { useDataGridStore } = await import('src/stores/data-grid-store')

const makeRow = (patientId, encounterNum, visitDate, observations) => ({
  patientId,
  encounterNum,
  visitDate,
  observations,
})

const setupGrid = () => {
  const store = useDataGridStore()
  store.observationConcepts = [{ code: 'LDL', name: 'LDL', valueType: 'N' }]
  store.tableRows = [
    makeRow('P1', 1, '2026-01-15', {
      LDL: { observationId: 101, value: '120', startDate: '2026-01-15', valueType: 'N' },
    }),
    makeRow('P2', 2, '2026-02-01', {
      LDL: { observationId: 201, value: '90', startDate: '2026-01-29', valueType: 'N' },
    }),
  ]
  return store
}

describe('data-grid-store.setObservationStartDate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockResolvedValue({ success: true })
  })

  it('UPDATEs START_DATE and mirrors into local state', async () => {
    const store = setupGrid()
    await store.setObservationStartDate({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      observationId: 101,
      startDate: '2026-01-10',
    })

    expect(executeQueryMock).toHaveBeenCalledOnce()
    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('UPDATE OBSERVATION_FACT')
    expect(sql).toContain('START_DATE = ?')
    expect(params).toEqual(['2026-01-10', 101])

    expect(store.tableRows[0].observations.LDL.startDate).toBe('2026-01-10')
  })

  it('is a no-op when observationId is missing', async () => {
    const store = setupGrid()
    await store.setObservationStartDate({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      observationId: null,
      startDate: '2026-01-10',
    })
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('throws when startDate is empty (catches accidental clear)', async () => {
    const store = setupGrid()
    await expect(
      store.setObservationStartDate({
        patientId: 'P1',
        encounterNum: 1,
        conceptCode: 'LDL',
        observationId: 101,
        startDate: '',
      }),
    ).rejects.toThrow(/non-empty/)
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('reset-to-visit-date uses the row.visitDate as the new startDate', async () => {
    const store = setupGrid()
    // Simulates the "Auf Visitendatum zurücksetzen" caller — same action,
    // startDate sourced from row.visitDate.
    const row = store.tableRows[1]
    await store.setObservationStartDate({
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      conceptCode: 'LDL',
      observationId: 201,
      startDate: row.visitDate,
    })
    expect(executeQueryMock).toHaveBeenCalledOnce()
    expect(executeQueryMock.mock.calls[0][1]).toEqual(['2026-02-01', 201])
    expect(row.observations.LDL.startDate).toBe('2026-02-01')
  })

  it('surfaces DB errors and leaves local state untouched', async () => {
    executeQueryMock.mockResolvedValueOnce({ success: false, error: 'boom' })
    const store = setupGrid()
    await expect(
      store.setObservationStartDate({
        patientId: 'P1',
        encounterNum: 1,
        conceptCode: 'LDL',
        observationId: 101,
        startDate: '2026-01-10',
      }),
    ).rejects.toThrow('boom')
    expect(store.tableRows[0].observations.LDL.startDate).toBe('2026-01-15')
  })
})

describe('data-grid-store.handleCellUpdate (startDate propagation)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mirrors startDate from the emit payload into row.observations', () => {
    const store = setupGrid()
    store.handleCellUpdate({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      value: '120',
      observationId: 101,
      startDate: '2026-01-12',
    })
    expect(store.tableRows[0].observations.LDL.startDate).toBe('2026-01-12')
  })

  it('does not touch startDate when the payload omits it (backwards compat)', () => {
    const store = setupGrid()
    store.handleCellUpdate({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      value: '125',
      observationId: 101,
      // no startDate
    })
    expect(store.tableRows[0].observations.LDL.startDate).toBe('2026-01-15')
  })
})
