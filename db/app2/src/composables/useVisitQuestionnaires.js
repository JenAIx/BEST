/**
 * useVisitQuestionnaires — Q-type (questionnaire) handling extracted from
 * VisitDataEntry.vue for reuse in the unified card editor.
 *
 * Works on the globally selected visit's observations
 * (observationStore.observations). `visitRef`/`patientRef` identify the visit
 * a new questionnaire placeholder is attached to.
 *
 * options.onAdded: called after a questionnaire was added (the host uses it
 * to ensure the questionnaires field set is active).
 */

import { ref, computed } from 'vue'
import { useObservationStore } from 'src/stores/observation-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useNotify } from 'src/composables/useNotify'
import { visitObservationService } from 'src/services/visit-observation-service'
import { parseQuestionnaireObservation } from 'src/shared/utils/questionnaire-display.js'

export function useVisitQuestionnaires(visitRef, patientRef, options = {}) {
  const observationStore = useObservationStore()
  const databaseStore = useDatabaseStore()
  const authStore = useAuthStore()
  const notify = useNotify()
  const logger = useLoggingStore().createLogger('VisitQuestionnaires')

  const activeQuestionnaire = ref(null)
  const showFillDialog = ref(false)
  const showAddDialog = ref(false)

  /** Q-type observations of the selected visit, parsed into questionnaire entries. */
  const visitQuestionnaires = computed(() => {
    if (!visitRef.value || !observationStore.observations) return []

    return observationStore.observations.filter((obs) => obs.valueType === 'Q').map((obs) => parseQuestionnaireObservation(obs))
  })

  const existingQuestionnaireCodes = computed(() => visitQuestionnaires.value.map((q) => q.questionnaireCode).filter(Boolean))

  /** Create a pending Q-type placeholder observation on the visit. */
  const onQuestionnaireSelected = async (selectedQ) => {
    try {
      const encounterNum = visitRef.value.id
      const patientNum = patientRef.value.PATIENT_NUM

      const blob = JSON.stringify({
        _status: 'pending',
        _questionnaireCode: selectedQ.code,
        _savedResponses: {},
        _createdAt: new Date().toISOString(),
        title: selectedQ.title,
        short_title: selectedQ.shortTitle,
      })

      await databaseStore.executeQuery(
        `INSERT INTO OBSERVATION_FACT (
          ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, PROVIDER_ID,
          START_DATE, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB,
          UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, CATEGORY_CHAR, INSTANCE_NUM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?)`,
        [encounterNum, patientNum, 'CUSTOM: QUESTIONNAIRE', authStore.providerId, new Date().toISOString(), 'Q', selectedQ.title, blob, 'SURVEY_SYSTEM', 'SURVEY_BEST', 1],
      )

      await visitObservationService.selectVisitAndLoadObservations(visitRef.value)
      if (typeof options.onAdded === 'function') await options.onAdded()

      notify.success(`Fragebogen "${selectedQ.title}" zur Visite hinzugefügt`)
    } catch (error) {
      logger.error('Failed to add questionnaire to visit', error)
      notify.error('Fragebogen konnte nicht hinzugefügt werden')
    }
  }

  const onFillQuestionnaire = (q) => {
    activeQuestionnaire.value = {
      questionnaireCode: q.questionnaireCode,
      observationId: q.observationId,
      observationBlob: q.observationBlob,
      isCompleted: false,
    }
    showFillDialog.value = true
  }

  const onViewQuestionnaire = (q) => {
    activeQuestionnaire.value = {
      questionnaireCode: q.questionnaireCode,
      observationId: q.observationId,
      observationBlob: q.observationBlob,
      isCompleted: true,
    }
    showFillDialog.value = true
  }

  const onQuestionnaireCompleted = async () => {
    activeQuestionnaire.value = null
    if (visitRef.value) {
      await visitObservationService.selectVisitAndLoadObservations(visitRef.value)
    }
  }

  const onQuestionnaireFillClose = () => {
    if (visitRef.value) {
      visitObservationService.selectVisitAndLoadObservations(visitRef.value)
    }
    activeQuestionnaire.value = null
  }

  const onRemoveQuestionnaire = async (q) => {
    try {
      await visitObservationService.deleteObservation(q.observationId)
      notify.success(`Fragebogen "${q.title}" entfernt`, { timeout: 2000 })
    } catch (error) {
      logger.error('Failed to remove questionnaire', error)
      notify.error('Fragebogen konnte nicht entfernt werden')
    }
  }

  return {
    visitQuestionnaires,
    existingQuestionnaireCodes,
    activeQuestionnaire,
    showFillDialog,
    showAddDialog,
    onQuestionnaireSelected,
    onFillQuestionnaire,
    onViewQuestionnaire,
    onQuestionnaireCompleted,
    onQuestionnaireFillClose,
    onRemoveQuestionnaire,
  }
}
