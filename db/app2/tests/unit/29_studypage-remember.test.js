/**
 * @vitest-environment jsdom
 *
 * Tests for the "remember last selected study" feature:
 *   - local-settings-store.get/setLastSelectedStudyId (incl. localStorage
 *     round-trip across store reloads)
 *   - study-store persistence: setSelectedStudy / loadStudyById write the id,
 *     deleteStudy and a stale loadStudyById clear it
 *   - reopenLastStudy route guard: fresh navigation to /studies redirects to
 *     the remembered study; coming from a study page, ?stay=1, or no
 *     remembered id shows the list
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const studyRepoMock = {
  findById: vi.fn(),
  delete: vi.fn().mockResolvedValue(true),
}

const dbMock = {
  canPerformOperations: true,
  getRepository: vi.fn(() => studyRepoMock),
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
const { reopenLastStudy } = await import('src/router/study-remember-guard')

describe('local-settings lastSelectedStudyId', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to null', () => {
    const settings = useLocalSettingsStore()
    expect(settings.getLastSelectedStudyId()).toBeNull()
  })

  it('set → get returns the id, set(null) clears it', () => {
    const settings = useLocalSettingsStore()
    settings.setLastSelectedStudyId(7)
    expect(settings.getLastSelectedStudyId()).toBe(7)
    settings.setLastSelectedStudyId(null)
    expect(settings.getLastSelectedStudyId()).toBeNull()
  })

  it('survives a store reload via localStorage (F5)', () => {
    const settings = useLocalSettingsStore()
    settings.setLastSelectedStudyId(42)
    settings.saveSettings()

    setActivePinia(createPinia())
    const reloaded = useLocalSettingsStore()
    reloaded.loadSettings()
    expect(reloaded.getLastSelectedStudyId()).toBe(42)
  })
})

describe('study-store persistence of the selection', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    dbMock.getRepository.mockReturnValue(studyRepoMock)
  })

  it('setSelectedStudy remembers the id', () => {
    const store = useStudyStore()
    const settings = useLocalSettingsStore()
    store.setSelectedStudy({ id: 5, name: 'Stroke-Lipid' })
    expect(settings.getLastSelectedStudyId()).toBe(5)
  })

  it('setSelectedStudy(null) does not touch the remembered id', () => {
    const store = useStudyStore()
    const settings = useLocalSettingsStore()
    store.setSelectedStudy({ id: 5, name: 'Stroke-Lipid' })
    store.setSelectedStudy(null)
    expect(settings.getLastSelectedStudyId()).toBe(5)
  })

  it('loadStudyById remembers the id on success', async () => {
    studyRepoMock.findById.mockResolvedValue({ id: 9, name: 'Parkinson' })
    const store = useStudyStore()
    const settings = useLocalSettingsStore()
    await store.loadStudyById(9)
    expect(settings.getLastSelectedStudyId()).toBe(9)
  })

  it('loadStudyById clears a stale remembered id when the study is gone', async () => {
    studyRepoMock.findById.mockResolvedValue(null)
    const store = useStudyStore()
    const settings = useLocalSettingsStore()
    settings.setLastSelectedStudyId(9)

    await expect(store.loadStudyById(9)).rejects.toThrow('not found')
    expect(settings.getLastSelectedStudyId()).toBeNull()
  })

  it('loadStudyById keeps a remembered id belonging to another study', async () => {
    studyRepoMock.findById.mockResolvedValue(null)
    const store = useStudyStore()
    const settings = useLocalSettingsStore()
    settings.setLastSelectedStudyId(3)

    await expect(store.loadStudyById(9)).rejects.toThrow('not found')
    expect(settings.getLastSelectedStudyId()).toBe(3)
  })

  it('deleteStudy clears the remembered id of the deleted study', async () => {
    studyRepoMock.findById.mockResolvedValue({ id: 5, name: 'Stroke-Lipid' })
    const store = useStudyStore()
    const settings = useLocalSettingsStore()
    await store.loadStudyById(5)
    expect(settings.getLastSelectedStudyId()).toBe(5)

    await store.deleteStudy(5)
    expect(settings.getLastSelectedStudyId()).toBeNull()
  })
})

describe('reopenLastStudy route guard', () => {
  const guard = (toPath, fromPath, query = {}) => {
    const next = vi.fn()
    reopenLastStudy({ path: toPath, query }, { path: fromPath }, next)
    return next
  }

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('redirects a fresh navigation to the remembered study', () => {
    useLocalSettingsStore().setLastSelectedStudyId(7)
    const next = guard('/studies', '/dashboard')
    expect(next).toHaveBeenCalledWith('/studies/7')
  })

  it('shows the list when coming from a study details page', () => {
    useLocalSettingsStore().setLastSelectedStudyId(7)
    const next = guard('/studies', '/studies/7')
    expect(next).toHaveBeenCalledWith()
  })

  it('shows the list on re-navigation from the list itself', () => {
    useLocalSettingsStore().setLastSelectedStudyId(7)
    const next = guard('/studies', '/studies')
    expect(next).toHaveBeenCalledWith()
  })

  it('shows the list with the ?stay=1 escape hatch', () => {
    useLocalSettingsStore().setLastSelectedStudyId(7)
    const next = guard('/studies', '/dashboard', { stay: '1' })
    expect(next).toHaveBeenCalledWith()
  })

  it('shows the list when nothing is remembered', () => {
    const next = guard('/studies', '/dashboard')
    expect(next).toHaveBeenCalledWith()
  })
})
