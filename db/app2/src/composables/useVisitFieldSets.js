/**
 * useVisitFieldSets — field-set loading/activation extracted from
 * VisitDataEntry.vue so the unified card editor (and later the legacy data
 * entry) share one implementation.
 *
 * Field sets come from CODE_LOOKUP (VISIT_DIMENSION/FIELD_SET_CD) via
 * globalSettingsStore.getFieldSetOptions(); the visit type's LOOKUP_BLOB
 * decides which sets activate. Active ids persist to localSettings under
 * `visits.activeFieldSets` (same key as the legacy tab, deliberately —
 * activation-by-visit-type overwrites it on every visit selection anyway).
 */

import { ref, computed } from 'vue'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'

export function useVisitFieldSets(options = {}) {
  const { persistKey = 'visits.activeFieldSets' } = options

  const globalSettingsStore = useGlobalSettingsStore()
  const observationStore = useObservationStore()
  const localSettings = useLocalSettingsStore()
  const logger = useLoggingStore().createLogger('VisitFieldSets')

  const availableFieldSets = ref([])
  const activeFieldSets = ref([])
  const loadingFieldSets = ref(false)

  const activeFieldSetsList = computed(() => availableFieldSets.value.filter((fs) => activeFieldSets.value.includes(fs.id)))

  const persist = () => localSettings.setSetting(persistKey, activeFieldSets.value)

  const loadFieldSets = async () => {
    try {
      loadingFieldSets.value = true
      const fieldSets = await globalSettingsStore.getFieldSetOptions()
      availableFieldSets.value = fieldSets && fieldSets.length > 0 ? fieldSets : []
    } catch (error) {
      logger.error('Failed to load field sets from global settings', error)
      availableFieldSets.value = []
    } finally {
      loadingFieldSets.value = false
    }
  }

  /**
   * Activate the field sets configured for the visit's type (LOOKUP_BLOB
   * fieldSets, active only), intersected with the available sets. No visit
   * type or empty configuration leaves the current activation untouched.
   */
  const activateFieldSetsForVisitType = async (visit) => {
    if (!visit) return

    // visitType field first, VISIT_BLOB fallback (same order as VisitDataEntry)
    let visitType = visit.visitType || null
    if (!visitType && visit.rawData?.VISIT_BLOB) {
      try {
        visitType = JSON.parse(visit.rawData.VISIT_BLOB)?.visitType || null
      } catch {
        logger.warn('Failed to parse VISIT_BLOB for visit type', { visitId: visit.id })
      }
    }
    if (!visitType) {
      logger.warn('No visit type found for visit', { visitId: visit.id })
      return
    }

    try {
      globalSettingsStore.clearCache()
      const visitTypeFieldSets = await globalSettingsStore.getFieldSetsForVisitType(visitType, true)
      if (!visitTypeFieldSets || visitTypeFieldSets.length === 0) return

      const validFieldSets = visitTypeFieldSets.filter((fsId) => availableFieldSets.value.some((fs) => fs.id === fsId))
      if (validFieldSets.length === 0) {
        logger.warn(`No valid field sets found for visit type: ${visitType}`)
        return
      }

      activeFieldSets.value = [...validFieldSets]
      persist()
      logger.info(`Activated ${validFieldSets.length} field sets for visit type: ${visitType}`)
    } catch (error) {
      logger.error('Failed to activate field sets for visit type', error)
    }
  }

  const toggleFieldSet = (fieldSetId) => {
    const index = activeFieldSets.value.indexOf(fieldSetId)
    if (index > -1) activeFieldSets.value.splice(index, 1)
    else activeFieldSets.value.push(fieldSetId)
    persist()
  }

  /**
   * Make sure the questionnaires pseudo field set is available and active
   * (added dynamically when the DB seed doesn't provide it yet).
   */
  const ensureQuestionnaireFieldSetActive = async () => {
    if (!availableFieldSets.value.some((fs) => fs.id === 'questionnaires')) {
      globalSettingsStore.clearCache()
      const fresh = await globalSettingsStore.getFieldSetOptions(true)
      if (fresh && fresh.length > 0) availableFieldSets.value = fresh

      if (!availableFieldSets.value.some((fs) => fs.id === 'questionnaires')) {
        availableFieldSets.value.push({
          id: 'questionnaires',
          name: 'Fragebögen',
          description: 'Fragebögen und Surveys (MoCA, BDI, etc.)',
          icon: 'quiz',
          concepts: ['CUSTOM: QUESTIONNAIRE'],
        })
      }
    }

    if (!activeFieldSets.value.includes('questionnaires')) {
      activeFieldSets.value.push('questionnaires')
      persist()
    }
  }

  // Observations of the SELECTED visit that match a field set (hybrid
  // concept/category matching lives in the observation store)
  const getFieldSetObservations = (fieldSetId) => {
    if (!fieldSetId) return []
    return observationStore.getFieldSetObservations(fieldSetId, availableFieldSets.value)
  }

  const getFieldSetObservationCount = (fieldSetId) => getFieldSetObservations(fieldSetId).length

  return {
    availableFieldSets,
    activeFieldSets,
    activeFieldSetsList,
    loadingFieldSets,
    loadFieldSets,
    activateFieldSetsForVisitType,
    toggleFieldSet,
    ensureQuestionnaireFieldSetActive,
    getFieldSetObservations,
    getFieldSetObservationCount,
  }
}
