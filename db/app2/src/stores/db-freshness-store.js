/**
 * DB freshness — "did another app instance commit since I last looked?"
 *
 * Several users share one SQLite file. `PRAGMA data_version` is a
 * per-connection counter that changes whenever ANOTHER connection commits
 * (our own commits leave it untouched), so polling it every few seconds is a
 * cheap, exact remote-change signal: one header read, no table scan.
 *
 * On a remote commit the store bumps `remoteCommitTick`; page-level
 * composables (useDbFreshness) then run a targeted check for the data they
 * show. Lookup caches (global-settings / concept resolution) are invalidated
 * here when CODE_LOOKUP / CONCEPT_DIMENSION changed.
 *
 * The poller runs only while the window is visible and a database is
 * connected; App.vue instantiates the store once.
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'

export const FRESHNESS_POLL_MS = 5000

export const useDbFreshnessStore = defineStore('dbFreshness', () => {
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('DbFreshness')

  const remoteCommitTick = ref(0)
  const lastRemoteCommitAt = ref(null)
  const polling = ref(false)
  const lastDataVersion = ref(null)
  const lastLookupStamp = ref(null)

  let timer = null
  let checking = false

  const isVisible = () => typeof document === 'undefined' || !document.hidden

  const readDataVersion = async () => {
    const result = await dbStore.executeQuery('PRAGMA data_version')
    return result.success ? (result.data[0]?.data_version ?? null) : null
  }

  // CODE_LOOKUP / CONCEPT_DIMENSION are the sources of the lookup caches
  const readLookupStamp = async () => {
    const result = await dbStore.executeQuery('SELECT (SELECT MAX(UPDATE_DATE) FROM CODE_LOOKUP) AS lookups, (SELECT MAX(UPDATE_DATE) FROM CONCEPT_DIMENSION) AS concepts, (SELECT COUNT(*) FROM CODE_LOOKUP) AS lookupCount, (SELECT COUNT(*) FROM CONCEPT_DIMENSION) AS conceptCount')
    if (!result.success || !result.data[0]) return null
    const r = result.data[0]
    return `${r.lookups}|${r.concepts}|${r.lookupCount}|${r.conceptCount}`
  }

  const invalidateLookupCaches = async () => {
    try {
      const [{ useGlobalSettingsStore }, { useConceptResolutionStore }] = await Promise.all([import('./global-settings-store'), import('./concept-resolution-store')])
      useGlobalSettingsStore().clearCache()
      await useConceptResolutionStore().reset?.()
      logger.info('Lookup caches invalidated — CODE_LOOKUP / CONCEPT_DIMENSION changed remotely')
    } catch (error) {
      logger.warn('Failed to invalidate lookup caches', { error: error?.message })
    }
  }

  /** One poll step — safe to call ad hoc (focus, visibility change). */
  const check = async () => {
    if (checking || !dbStore.canPerformOperations || !isVisible()) return
    checking = true
    try {
      const version = await readDataVersion()
      if (version === null) return
      if (lastDataVersion.value === null) {
        lastDataVersion.value = version
        lastLookupStamp.value = await readLookupStamp()
        return
      }
      if (version === lastDataVersion.value) return
      lastDataVersion.value = version
      lastRemoteCommitAt.value = Date.now()
      remoteCommitTick.value++
      logger.debug('Remote commit detected', { dataVersion: version, tick: remoteCommitTick.value })
      const stamp = await readLookupStamp()
      if (stamp !== null && stamp !== lastLookupStamp.value) {
        lastLookupStamp.value = stamp
        await invalidateLookupCaches()
      }
    } catch (error) {
      logger.warn('Freshness check failed', { error: error?.message })
    } finally {
      checking = false
    }
  }

  const onVisibility = () => {
    if (isVisible()) check()
  }

  const start = () => {
    if (timer) return
    polling.value = true
    timer = setInterval(check, FRESHNESS_POLL_MS)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    if (typeof window !== 'undefined') window.addEventListener('focus', onVisibility)
    check()
  }

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
    polling.value = false
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    if (typeof window !== 'undefined') window.removeEventListener('focus', onVisibility)
  }

  const reset = () => {
    lastDataVersion.value = null
    lastLookupStamp.value = null
  }

  // Follow the connection: a new database = new baseline
  watch(
    () => dbStore.isConnected && dbStore.canPerformOperations,
    (connected) => {
      reset()
      if (connected) start()
      else stop()
    },
    { immediate: true },
  )

  return { remoteCommitTick, lastRemoteCommitAt, polling, check, start, stop, reset }
})
