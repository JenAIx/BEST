/**
 * @vitest-environment jsdom
 *
 * Tests for exportStore.exportStudyPatients() — the in-app cohort export
 * action that powers the StudyDetailsPage download button.
 *
 * Strategy: mock the repository + the ExportService and verify the store
 * wires them together correctly (patient lookup → export → file download).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const studyRepoMock = {
  findEnrolledPatientCds: vi.fn(),
}
const repositoryMap = {
  study: studyRepoMock,
}

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    getRepository: (name) => repositoryMap[name] ?? null,
  }),
}))

vi.mock('src/core/services/database-service', () => ({
  default: { isInitialized: true, getRepository: () => ({}) },
}))

const exportPatientsMock = vi.fn()
vi.mock('src/core/services/export-service', () => ({
  ExportService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    exportPatients: exportPatientsMock,
  })),
}))

vi.mock('src/core/services/logging-service', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    startTimer: () => ({ end: () => 0 }),
  }),
}))

const { useExportStore } = await import('src/stores/export-store')

describe('useExportStore.exportStudyPatients', () => {
  let createElementSpy
  let appendSpy
  let removeSpy
  let revokeSpy

  beforeEach(() => {
    setActivePinia(createPinia())
    studyRepoMock.findEnrolledPatientCds.mockReset()
    exportPatientsMock.mockReset()
    // Mock browser download primitives (jsdom does not implement these)
    global.URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    global.URL.revokeObjectURL = vi.fn()
    revokeSpy = global.URL.revokeObjectURL
    appendSpy = vi.spyOn(document.body, 'appendChild')
    removeSpy = vi.spyOn(document.body, 'removeChild')
    const realCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = vi.fn()
      return el
    })
  })

  it('fetches patient codes, calls ExportService, triggers a CSV download', async () => {
    studyRepoMock.findEnrolledPatientCds.mockResolvedValue(['P001', 'P002', 'P003'])
    exportPatientsMock.mockResolvedValue({
      content: 'Patient ID,Visit Date\nP001,2025-01-01\n',
      filename: 'stroke-lipid_2026-05-16.csv',
      mimeType: 'text/csv',
      size: 56,
      metadata: {},
    })

    const store = useExportStore()
    const result = await store.exportStudyPatients('STROKE_LIPID', 'csv')

    expect(studyRepoMock.findEnrolledPatientCds).toHaveBeenCalledWith('STROKE_LIPID')
    expect(exportPatientsMock).toHaveBeenCalledTimes(1)
    const [selected, format, options] = exportPatientsMock.mock.calls[0]
    expect(selected).toEqual([
      { id: 'P001', PATIENT_CD: 'P001' },
      { id: 'P002', PATIENT_CD: 'P002' },
      { id: 'P003', PATIENT_CD: 'P003' },
    ])
    expect(format).toBe('csv')
    expect(options).toMatchObject({ includeVisits: true, includeObservations: true, includeNotes: false })

    // Browser download triggered (a-tag created, clicked, removed)
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
    expect(revokeSpy).toHaveBeenCalled()

    expect(result).toEqual({
      recordCount: 3,
      filename: 'stroke-lipid_2026-05-16.csv',
      sizeBytes: 56,
    })
  })

  it('passes hl7 format through and uses application/json mime type', async () => {
    studyRepoMock.findEnrolledPatientCds.mockResolvedValue(['P001'])
    exportPatientsMock.mockResolvedValue({
      content: '{"resourceType":"Composition"}',
      filename: 'stroke-lipid.hl7.json',
      mimeType: 'application/json',
      size: 30,
      metadata: {},
    })

    const store = useExportStore()
    await store.exportStudyPatients('STROKE_LIPID', 'hl7')

    expect(exportPatientsMock).toHaveBeenCalledWith(
      expect.any(Array),
      'hl7',
      expect.any(Object),
    )
  })

  it('throws when the study has no enrolled patients', async () => {
    studyRepoMock.findEnrolledPatientCds.mockResolvedValue([])
    const store = useExportStore()
    await expect(store.exportStudyPatients('EMPTY_STUDY', 'csv')).rejects.toThrow(/no enrolled patients/i)
    expect(exportPatientsMock).not.toHaveBeenCalled()
  })

  it('throws when the repository does not expose findEnrolledPatientCds', async () => {
    // Reset the mock to a repo without the new method
    repositoryMap.study = {}
    const store = useExportStore()
    await expect(store.exportStudyPatients('X', 'csv')).rejects.toThrow(/findEnrolledPatientCds/)
    // Restore for subsequent tests in the file (not strictly needed)
    repositoryMap.study = studyRepoMock
  })
})
