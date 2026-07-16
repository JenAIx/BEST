/**
 * @vitest-environment jsdom
 *
 * Tests for the grid-jump plumbing of the study-audit feature:
 *   - local-settings-store.setPendingAuditFilter / consumePendingAuditFilter
 *     (one-shot semantics: set → consume true → subsequent consume false)
 *   - study-store.setEnrollmentStatus (delegates to the db wrapper and
 *     refreshes the cached audit summary for the same study)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const dbMock = {
  updateEnrollmentStatus: vi.fn().mockResolvedValue(true),
  getStudyAuditSummary: vi.fn().mockResolvedValue({ total: 0, byUser: [], byPatient: [] }),
  getStudyEnrollmentStatusCounts: vi.fn().mockResolvedValue({ active: 0, completed: 0, withdrawn: 0, total: 0 }),
  getCohortUserStats: vi.fn().mockResolvedValue([]),
  getRepository: vi.fn(),
}

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => dbMock,
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

const { useLocalSettingsStore } = await import('src/stores/local-settings-store')
const { useStudyStore } = await import('src/stores/study-store')

describe('local-settings pendingAuditFilter (one-shot)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to false and consume without set returns false', () => {
    const settings = useLocalSettingsStore()
    expect(settings.consumePendingAuditFilter()).toBe(false)
  })

  it('set → consume returns true exactly once', () => {
    const settings = useLocalSettingsStore()
    settings.setPendingAuditFilter(true)
    expect(settings.consumePendingAuditFilter()).toBe(true)
    expect(settings.consumePendingAuditFilter()).toBe(false)
  })

  it('survives a store reload via localStorage (F5 between set and consume)', () => {
    const settings = useLocalSettingsStore()
    settings.setPendingAuditFilter(true)
    settings.saveSettings()

    // Fresh pinia = fresh store instance, same localStorage
    setActivePinia(createPinia())
    const reloaded = useLocalSettingsStore()
    reloaded.loadSettings()
    expect(reloaded.consumePendingAuditFilter()).toBe(true)
    expect(reloaded.consumePendingAuditFilter()).toBe(false)
  })
})

describe('study-store.setEnrollmentStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('delegates to dbStore.updateEnrollmentStatus with a normalized array', async () => {
    const store = useStudyStore()
    await store.setEnrollmentStatus(7, 42, 'completed')

    expect(dbMock.updateEnrollmentStatus).toHaveBeenCalledWith(7, [42], 'completed')
  })

  it('refreshes the cached audit summary when it belongs to the same study', async () => {
    const store = useStudyStore()
    await store.loadStudyAudit(7)
    expect(dbMock.getStudyAuditSummary).toHaveBeenCalledTimes(1)

    await store.setEnrollmentStatus(7, [42], 'completed')
    expect(dbMock.getStudyAuditSummary).toHaveBeenCalledTimes(2)
  })

  it('does not refresh when the cache belongs to another study', async () => {
    const store = useStudyStore()
    await store.loadStudyAudit(99)
    expect(dbMock.getStudyAuditSummary).toHaveBeenCalledTimes(1)

    await store.setEnrollmentStatus(7, [42], 'completed')
    expect(dbMock.getStudyAuditSummary).toHaveBeenCalledTimes(1)
  })
})
