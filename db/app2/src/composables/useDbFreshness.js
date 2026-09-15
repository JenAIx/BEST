/**
 * useDbFreshness — keep a page's data current when other users write.
 *
 * Listens to db-freshness-store.remoteCommitTick (another app instance
 * committed) and then checks whether the patients THIS page shows changed:
 * `MAX(UPDATE_DATE)` over their PATIENT_DIMENSION rows, which the
 * update_patient_on_* triggers bump on every visit/observation write.
 *
 *   - nothing being edited  → reload silently (`reload()`)
 *   - an edit is in progress → set `stale` (the page shows StaleDataBanner)
 *
 * Call `markFresh()` after any reload the page performs itself, so the
 * baseline follows the data on screen.
 *
 * @param {Object} o
 * @param {() => number[]} o.patientNums   PATIENT_NUMs shown on the page
 * @param {() => boolean} o.isEditing      true while the user edits (no auto-reload)
 * @param {() => Promise<void>} o.reload   the page's own reload function
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useDbFreshnessStore } from 'src/stores/db-freshness-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

export function useDbFreshness({ patientNums, isEditing, reload }) {
  const freshness = useDbFreshnessStore()
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('useDbFreshness')

  const stale = ref(false)
  let baseline = null
  let busy = false
  let active = true

  const readStamp = async () => {
    const nums = [...new Set((patientNums() || []).filter((n) => n !== null && n !== undefined))]
    if (nums.length === 0 || !dbStore.canPerformOperations) return null
    const result = await dbStore.executeQuery(`SELECT MAX(UPDATE_DATE) AS m, COUNT(*) AS n FROM PATIENT_DIMENSION WHERE PATIENT_NUM IN (${nums.map(() => '?').join(',')})`, nums)
    if (!result.success || !result.data[0]) return null
    return `${result.data[0].m}|${result.data[0].n}`
  }

  /** Re-capture the baseline after the page (re)loaded its data itself. */
  const markFresh = async () => {
    stale.value = false
    try {
      baseline = await readStamp()
    } catch (error) {
      logger.warn('Could not capture freshness baseline', { error: error?.message })
    }
  }

  /** Reload through the page's own function and re-baseline. */
  const refresh = async () => {
    await reload()
    await markFresh()
  }

  const onRemoteCommit = async () => {
    if (busy || !active) return
    busy = true
    try {
      const stamp = await readStamp()
      if (stamp === null) return
      if (baseline === null) {
        baseline = stamp
        return
      }
      if (stamp === baseline) return
      if (isEditing()) {
        stale.value = true
        logger.info('Remote change on shown patients while editing — banner')
      } else {
        logger.info('Remote change on shown patients — reloading')
        await refresh()
      }
    } catch (error) {
      logger.warn('Freshness check failed', { error: error?.message })
    } finally {
      busy = false
    }
  }

  const stopWatch = watch(() => freshness.remoteCommitTick, () => onRemoteCommit())

  onMounted(() => markFresh())
  onBeforeUnmount(() => {
    active = false
    stopWatch()
  })

  return { stale, refresh, markFresh }
}
