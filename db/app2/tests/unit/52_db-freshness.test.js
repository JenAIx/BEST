/**
 * @vitest-environment jsdom
 *
 * Remote-change detection: db-freshness-store (PRAGMA data_version poll →
 * remoteCommitTick, lookup-cache invalidation) and useDbFreshness (targeted
 * MAX(UPDATE_DATE) check → silent reload or stale banner).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const executeQueryMock = vi.fn()
const dbState = { isConnected: true, canPerformOperations: true }
vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    get isConnected() {
      return dbState.isConnected
    },
    get canPerformOperations() {
      return dbState.canPerformOperations
    },
  }),
}))
const clearCacheMock = vi.fn()
const resetConceptsMock = vi.fn()
vi.mock('src/stores/global-settings-store', () => ({ useGlobalSettingsStore: () => ({ clearCache: clearCacheMock }) }))
vi.mock('src/stores/concept-resolution-store', () => ({ useConceptResolutionStore: () => ({ reset: resetConceptsMock }) }))
vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() }) }),
}))

const { useDbFreshnessStore } = await import('src/stores/db-freshness-store')
const { useDbFreshness } = await import('src/composables/useDbFreshness')

// programmable answers per SQL
let dataVersion = 10
let lookupStamp = { lookups: 'a', concepts: 'b', lookupCount: 1, conceptCount: 1 }
let patientStamp = { m: '2026-01-01 10:00:00', n: 1 }
const answer = (sql) => {
  if (/PRAGMA data_version/.test(sql)) return { success: true, data: [{ data_version: dataVersion }] }
  if (/FROM CODE_LOOKUP/.test(sql)) return { success: true, data: [lookupStamp] }
  if (/FROM PATIENT_DIMENSION/.test(sql)) return { success: true, data: [patientStamp] }
  return { success: true, data: [] }
}

describe('db-freshness-store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockImplementation(async (sql) => answer(sql))
    clearCacheMock.mockClear()
    resetConceptsMock.mockClear()
    dataVersion = 10
    lookupStamp = { lookups: 'a', concepts: 'b', lookupCount: 1, conceptCount: 1 }
    dbState.isConnected = true
    dbState.canPerformOperations = true
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('takes a baseline on start and ticks only when data_version changes', async () => {
    const store = useDbFreshnessStore()
    await flushPromises()
    expect(store.polling).toBe(true)
    expect(store.remoteCommitTick).toBe(0)

    await vi.advanceTimersByTimeAsync(5000) // same version → no tick
    expect(store.remoteCommitTick).toBe(0)

    dataVersion = 11
    await vi.advanceTimersByTimeAsync(5000)
    expect(store.remoteCommitTick).toBe(1)
    expect(clearCacheMock).not.toHaveBeenCalled() // lookups unchanged
  })

  it('invalidates lookup + concept caches when CODE_LOOKUP/CONCEPT_DIMENSION changed remotely', async () => {
    const store = useDbFreshnessStore()
    await flushPromises()
    dataVersion = 12
    lookupStamp = { ...lookupStamp, concepts: 'c' }
    await vi.advanceTimersByTimeAsync(5000)
    expect(store.remoteCommitTick).toBe(1)
    expect(clearCacheMock).toHaveBeenCalledTimes(1)
    expect(resetConceptsMock).toHaveBeenCalledTimes(1)
  })

  it('stops polling when the window is hidden and while disconnected', async () => {
    const store = useDbFreshnessStore()
    await flushPromises()
    const calls = executeQueryMock.mock.calls.length
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    dataVersion = 13
    await vi.advanceTimersByTimeAsync(5000)
    expect(executeQueryMock.mock.calls.length).toBe(calls) // no query while hidden
    expect(store.remoteCommitTick).toBe(0)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    store.stop()
    await vi.advanceTimersByTimeAsync(10000)
    expect(store.remoteCommitTick).toBe(0)
  })
})

describe('useDbFreshness', () => {
  const mountWith = ({ editing }) => {
    const reload = vi.fn().mockResolvedValue()
    const editingRef = ref(editing)
    let api
    const Comp = defineComponent({
      setup() {
        api = useDbFreshness({ patientNums: () => [42], isEditing: () => editingRef.value, reload })
        return () => h('div')
      },
    })
    const wrapper = mount(Comp)
    return { wrapper, api: () => api, reload, editingRef }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockImplementation(async (sql) => answer(sql))
    dataVersion = 10
    patientStamp = { m: '2026-01-01 10:00:00', n: 1 }
    dbState.isConnected = true
    dbState.canPerformOperations = true
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads silently when the shown patient changed and nothing is being edited', async () => {
    const { api, reload } = mountWith({ editing: false })
    await flushPromises()
    const store = useDbFreshnessStore()
    // remote commit, patient stamp unchanged → no reload
    dataVersion = 11
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(reload).not.toHaveBeenCalled()
    // remote commit that touched our patient → reload
    dataVersion = 12
    patientStamp = { m: '2026-01-01 10:05:00', n: 1 }
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(api().stale.value).toBe(false)
    expect(store.remoteCommitTick).toBe(2)
  })

  it('shows the banner instead of reloading while editing; refresh() clears it', async () => {
    const { api, reload } = mountWith({ editing: true })
    await flushPromises()
    dataVersion = 11
    patientStamp = { m: '2026-01-01 11:00:00', n: 1 }
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(reload).not.toHaveBeenCalled()
    expect(api().stale.value).toBe(true)
    await api().refresh()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(api().stale.value).toBe(false)
    // baseline follows the reload: the same stamp is not stale again
    dataVersion = 12
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(api().stale.value).toBe(false)
    await nextTick()
  })
})
