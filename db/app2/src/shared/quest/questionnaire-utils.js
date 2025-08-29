/**
 * Questionnaire Utility Functions
 *
 * Contains miscellaneous utility functions for questionnaire processing
 */

import { logger } from '../../core/services/logging-service.js'

/**
 * Fill questionnaire with random test data
 * @param {Object} activeQuestionnaire - The active questionnaire
 * @param {Function} updateResponse - Function to update responses
 * @returns {void}
 */
export const randomFill = (activeQuestionnaire, updateResponse) => {
  if (!activeQuestionnaire) return

  activeQuestionnaire.items.forEach((item) => {
    if (!item.id) return

    switch (item.type) {
      case 'number':
        updateResponse(item.id, Math.floor(Math.random() * 10))
        break
      case 'radio':
        if (item.options && item.options.length > 0) {
          const randomIndex = Math.floor(Math.random() * item.options.length)
          updateResponse(item.id, item.options[randomIndex].value)
        }
        break
      case 'text':
      case 'textarea':
        updateResponse(item.id, 'Test response')
        break
      case 'checkbox':
        if (item.options && item.options.length > 0) {
          const selectedOptions = item.options.filter(() => Math.random() > 0.5).map((option) => option.value)
          updateResponse(item.id, selectedOptions.length > 0 ? selectedOptions : [])
        }
        break
      default:
        break
    }
  })

  logger.info('Filled questionnaire with random values')
}

/**
 * Test function to manually trigger observation extraction for existing questionnaires
 * @param {Object} dbStore - Database store
 * @param {Object} visitObservationStore - Visit observation store
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @param {number} questionnaireObservationId - Questionnaire observation ID
 * @returns {Promise<void>}
 */
export const testQuestionnaireExtraction = async (dbStore, visitObservationStore, conceptResolutionStore, questionnaireObservationId) => {
  try {
    logger.info('Testing questionnaire extraction', { questionnaireObservationId })

    // Get the questionnaire data
    const result = await dbStore.executeQuery('SELECT OBSERVATION_BLOB FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [questionnaireObservationId])

    if (!result.success || result.data.length === 0) {
      logger.error('Questionnaire not found', { questionnaireObservationId })
      return
    }

    const questionnaireData = JSON.parse(result.data[0].OBSERVATION_BLOB)

    // Get patient and encounter info
    const obsResult = await dbStore.executeQuery('SELECT PATIENT_NUM, ENCOUNTER_NUM FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [questionnaireObservationId])

    if (!obsResult.success || obsResult.data.length === 0) {
      logger.error('Could not get patient/encounter info', { questionnaireObservationId })
      return
    }

    const { PATIENT_NUM, ENCOUNTER_NUM } = obsResult.data[0]

    logger.info('Starting extraction test', {
      questionnaireObservationId,
      patientNum: PATIENT_NUM,
      encounterNum: ENCOUNTER_NUM,
      questionnaireCode: questionnaireData.questionnaire_code,
    })

    // Import the extraction function (to avoid circular imports)
    const { saveIndividualResultsAsObservations } = await import('./questionnaire-database.js')

    // Trigger the extraction
    await saveIndividualResultsAsObservations(dbStore, PATIENT_NUM, ENCOUNTER_NUM, questionnaireData, questionnaireObservationId, visitObservationStore, conceptResolutionStore)

    logger.success('Extraction test completed', { questionnaireObservationId })
  } catch (error) {
    logger.error('Extraction test failed', error, { questionnaireObservationId })
  }
}
