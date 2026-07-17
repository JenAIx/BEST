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

    return observationStore.observations
      .filter((obs) => obs.valueType === 'Q')
      .map((obs) => {
        let isCompleted = false
        let title = obs.value || obs.originalValue || 'Fragebogen'
        let questionnaireCode = null
        let shortTitle = null
        let score = null
        let progress = null

        if (obs.rawData?.OBSERVATION_BLOB) {
          try {
            const blobData = JSON.parse(obs.rawData.OBSERVATION_BLOB)

            if (blobData && typeof blobData === 'object' && blobData._status === 'pending') {
              isCompleted = false
              questionnaireCode = blobData._questionnaireCode || null
              title = blobData.title || title
              shortTitle = blobData.short_title || null

              if (blobData._savedResponses && typeof blobData._savedResponses === 'object') {
                const entries = Object.values(blobData._savedResponses)
                const filledCount = entries.filter((v) => v !== null && v !== undefined && v !== '').length
                progress = entries.length > 0 ? filledCount / entries.length : 0
              } else {
                progress = 0
              }
            } else if (blobData && typeof blobData === 'object') {
              isCompleted = true
              questionnaireCode = blobData.questionnaire_code || blobData._questionnaireCode || null
              title = blobData.title || title
              shortTitle = blobData.short_title || null
              if (Array.isArray(blobData.results) && blobData.results.length > 0) {
                score = blobData.results[0].value
              }
            } else {
              isCompleted = true
            }
          } catch (e) {
            logger.warn('Failed to parse questionnaire blob', { observationId: obs.observationId, error: e.message })
            isCompleted = true
          }
        } else {
          // No blob data but Q type — assume completed (legacy data)
          isCompleted = true
        }

        return {
          observationId: obs.observationId,
          title,
          shortTitle,
          questionnaireCode,
          isCompleted,
          score,
          progress,
          observationBlob: obs.rawData?.OBSERVATION_BLOB || null,
          rawObservation: obs,
        }
      })
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
