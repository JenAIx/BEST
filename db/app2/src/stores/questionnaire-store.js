import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { useConceptResolutionStore } from './concept-resolution-store.js'
import { logger } from '../core/services/logging-service.js'

// Import helper functions
import { calculateResults } from '../shared/quest/questionnaire-results.js'
import { saveQuestionnaireResponse } from '../shared/quest/questionnaire-database.js'
import { visitObservationService } from '../services/visit-observation-service.js'
import { randomFill, testQuestionnaireExtraction } from '../shared/quest/questionnaire-utils.js'

// Re-export helper functions for backward compatibility
export { calculateResults, saveQuestionnaireResponse, randomFill, testQuestionnaireExtraction }

/**
 * Questionnaire Management Store
 * Handles loading questionnaires from database and managing responses
 */
export const useQuestionnaireStore = defineStore('questionnaire', () => {
  const dbStore = useDatabaseStore()
  const conceptResolutionStore = useConceptResolutionStore()

  // State
  const questionnaires = ref({})
  const activeQuestionnaire = ref(null)
  const currentResponses = ref({})
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const questionnaireList = computed(() => {
    return Object.keys(questionnaires.value).map((key) => ({
      code: key,
      title: questionnaires.value[key].title,
      description: questionnaires.value[key].description,
      shortTitle: questionnaires.value[key].short_title,
    }))
  })

  const isActiveQuestionnaireComplete = computed(() => {
    if (!activeQuestionnaire.value) return false

    const requiredItems = activeQuestionnaire.value.items.filter((item) => item.force !== false && item.type !== 'separator' && item.type !== 'textbox')

    return requiredItems.every((item) => {
      const itemId = item.type === 'multiple_radio' && Array.isArray(item.id) ? item.id[0] : item.id
      const response = currentResponses.value[itemId]

      // For multiple_radio, check if array has at least one non-null/undefined value
      if (item.type === 'multiple_radio' && Array.isArray(response)) {
        return response.some((value) => value !== null && value !== undefined)
      }

      // For other types, 0 is a valid value, only exclude null, undefined, and empty string
      return response !== undefined && response !== null && response !== ''
    })
  })

  // Actions

  /**
   * Load all questionnaires from the database
   */
  const loadQuestionnaires = async () => {
    loading.value = true
    error.value = null

    try {
      const result = await dbStore.executeQuery(
        `SELECT CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE
         FROM CODE_LOOKUP
         WHERE TABLE_CD = 'SURVEY_BEST' AND COLUMN_CD = 'QUESTIONNAIRE'
         ORDER BY NAME_CHAR`,
      )

      if (result.success) {
        questionnaires.value = {}

        for (const row of result.data) {
          try {
            const questionnaireData = JSON.parse(row.LOOKUP_BLOB)
            // Add metadata from database
            questionnaireData._metadata = {
              code: row.CODE_CD,
              displayName: row.NAME_CHAR,
              lastUpdated: row.UPDATE_DATE,
            }
            questionnaires.value[row.CODE_CD] = questionnaireData
          } catch (parseError) {
            logger.error(`Failed to parse questionnaire ${row.CODE_CD}`, parseError)
          }
        }

        logger.info(`Loaded ${result.data.length} questionnaires`)
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load questionnaires', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a specific questionnaire by code
   */
  const getQuestionnaire = (code) => {
    return questionnaires.value[code] || null
  }

  /**
   * Set the active questionnaire
   */
  const setActiveQuestionnaire = (code) => {
    const questionnaire = getQuestionnaire(code)
    if (questionnaire) {
      activeQuestionnaire.value = {
        ...questionnaire,
        code: code,
        startTime: Date.now(),
      }
      // Initialize responses object
      currentResponses.value = {}
      questionnaire.items.forEach((item) => {
        if (item.id) {
          // Handle multiple_radio questions with array IDs
          if (item.type === 'multiple_radio' && Array.isArray(item.id)) {
            // For multiple_radio, item.id is an array of question IDs
            // Initialize as an array with null values for each question
            const arrayId = item.id[0] || item.id // Use first ID or the ID itself
            currentResponses.value[arrayId] = new Array(item.id.length).fill(null)
          } else {
            currentResponses.value[item.id] = item.value || null
          }
        }
      })
      return true
    }
    return false
  }

  /**
   * Update a response for a specific question
   */
  const updateResponse = (itemId, value) => {
    if (activeQuestionnaire.value) {
      currentResponses.value[itemId] = value
      logger.debug(`Updated response for item ${itemId}:`, value)
    }
  }

  /**
   * Get current response for an item
   */
  const getResponse = (itemId) => {
    return currentResponses.value[itemId]
  }

  /**
   * Calculate questionnaire results (QuestMan-style)
   */
  const calculateResultsStore = () => {
    return calculateResults(activeQuestionnaire.value, currentResponses)
  }

  /**
   * Save questionnaire response to database (using new VALTYPE_CD='Q' approach)
   */
  const saveQuestionnaireResponseStore = async (patientNum, encounterNum, results) => {
    return await saveQuestionnaireResponse(dbStore, patientNum, encounterNum, results, visitObservationService, conceptResolutionStore)
  }

  /**
   * Clear current questionnaire and responses
   */
  const clearActive = () => {
    activeQuestionnaire.value = null
    currentResponses.value = {}
  }

  /**
   * Random fill for testing
   */
  const randomFillStore = () => {
    randomFill(activeQuestionnaire.value, (itemId, value) => updateResponse(itemId, value))
  }

  /**
   * Refresh questionnaires from database
   */
  const refreshQuestionnaires = async () => {
    await loadQuestionnaires()
  }

  /**
   * Test function to manually trigger observation extraction for existing questionnaires
   */
  const testQuestionnaireExtractionStore = async (questionnaireObservationId) => {
    await testQuestionnaireExtraction(dbStore, null, conceptResolutionStore, questionnaireObservationId)
  }

  return {
    // State
    questionnaires,
    activeQuestionnaire,
    currentResponses,
    loading,
    error,

    // Computed
    questionnaireList,
    isActiveQuestionnaireComplete,

    // Actions
    loadQuestionnaires,
    refreshQuestionnaires,
    getQuestionnaire,
    setActiveQuestionnaire,
    updateResponse,
    getResponse,
    calculateResults: calculateResultsStore,
    saveQuestionnaireResponse: saveQuestionnaireResponseStore,
    clearActive,
    randomFill: randomFillStore,

    // Test functions
    testQuestionnaireExtraction: testQuestionnaireExtractionStore,
  }
})
