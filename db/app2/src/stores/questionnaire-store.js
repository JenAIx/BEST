import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { logger } from '../core/services/logging-service.js'

/**
 * Questionnaire Management Store
 * Handles loading questionnaires from database and managing responses
 */
export const useQuestionnaireStore = defineStore('questionnaire', () => {
  const dbStore = useDatabaseStore()

  // State
  const questionnaires = ref({})
  const activeQuestionnaire = ref(null)
  const currentResponses = ref({})
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const questionnaireList = computed(() => {
    return Object.keys(questionnaires.value).map(key => ({
      code: key,
      title: questionnaires.value[key].title,
      description: questionnaires.value[key].description,
      shortTitle: questionnaires.value[key].short_title
    }))
  })

  const isActiveQuestionnaireComplete = computed(() => {
    if (!activeQuestionnaire.value) return false
    
    const requiredItems = activeQuestionnaire.value.items.filter(item => 
      item.force !== false && item.type !== 'separator' && item.type !== 'textbox'
    )
    
    return requiredItems.every(item => {
      const response = currentResponses.value[item.id]
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
         WHERE TABLE_CD = 'SURVEY_BEST' AND COLUMN_CD = 'QUESTIONNAIR'
         ORDER BY NAME_CHAR`
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
              lastUpdated: row.UPDATE_DATE
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
        startTime: Date.now()
      }
      // Initialize responses object
      currentResponses.value = {}
      questionnaire.items.forEach(item => {
        if (item.id) {
          currentResponses.value[item.id] = item.value || null
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
   * Calculate questionnaire results
   */
  const calculateResults = () => {
    if (!activeQuestionnaire.value) return null

    const results = {
      questionnaire_code: activeQuestionnaire.value.code,
      questionnaire_title: activeQuestionnaire.value.title,
      start_time: activeQuestionnaire.value.startTime,
      end_time: Date.now(),
      responses: [],
      summary: null
    }

    // Process individual responses
    activeQuestionnaire.value.items.forEach(item => {
      if (item.id && currentResponses.value[item.id] !== undefined) {
        const response = {
          item_id: item.id,
          label: item.label,
          value: currentResponses.value[item.id],
          coding: item.coding
        }
        
        // Convert string numbers to actual numbers for calculation
        if (item.type === 'number' && typeof response.value === 'string') {
          response.value = parseFloat(response.value) || 0
        }
        
        results.responses.push(response)
      }
    })

    // Calculate summary based on results configuration
    if (activeQuestionnaire.value.results) {
      results.summary = calculateSummary(results.responses, activeQuestionnaire.value.results)
    }

    return results
  }

  /**
   * Calculate summary scores based on questionnaire configuration
   */
  const calculateSummary = (responses, resultsConfig) => {
    if (!resultsConfig.method) return null

    switch (resultsConfig.method) {
      case 'sum':
        return calculateSum(responses, resultsConfig)
      case 'avg':
        return calculateAverage(responses, resultsConfig)
      default:
        logger.warn(`Unsupported results method: ${resultsConfig.method}`)
        return null
    }
  }

  /**
   * Calculate sum of numeric responses
   */
  const calculateSum = (responses, config) => {
    let sum = 0
    responses.forEach(response => {
      if (typeof response.value === 'number') {
        sum += response.value
      }
    })

    return {
      method: 'sum',
      value: sum,
      coding: config.coding,
      label: 'Sum'
    }
  }

  /**
   * Calculate average of numeric responses
   */
  const calculateAverage = (responses, config) => {
    let sum = 0
    let count = 0
    
    responses.forEach(response => {
      if (typeof response.value === 'number') {
        sum += response.value
        count++
      }
    })

    const average = count > 0 ? Math.round((sum / count) * 100) / 100 : 0

    return {
      method: 'avg',
      value: average,
      coding: config.coding,
      label: 'Average'
    }
  }

  /**
   * Save questionnaire response to database
   */
  const saveQuestionnaireResponse = async (patientNum, encounterNum, results) => {
    if (!results) return false

    loading.value = true
    error.value = null

    try {
      // Save main questionnaire record
      const mainResult = await dbStore.executeQuery(
        `INSERT INTO OBSERVATION_FACT (
          ENCOUNTER_NUM, PATIENT_NUM, CATEGORY_CHAR, CONCEPT_CD,
          START_DATE, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB,
          UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
        [
          encounterNum,
          patientNum,
          'CAT_QUESTIONNAIRE',
          results.questionnaire_code,
          new Date(results.start_time).toISOString(),
          'T',
          results.questionnaire_title,
          JSON.stringify(results),
          'SURVEY_SYSTEM'
        ]
      )

      if (!mainResult.success) {
        throw new Error(mainResult.error)
      }

      // Save individual responses
      for (const response of results.responses) {
        await dbStore.executeQuery(
          `INSERT INTO OBSERVATION_FACT (
            ENCOUNTER_NUM, PATIENT_NUM, CATEGORY_CHAR, CONCEPT_CD,
            START_DATE, VALTYPE_CD, TVAL_CHAR, NVAL_NUM, OBSERVATION_BLOB,
            UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
          [
            encounterNum,
            patientNum,
            'CAT_QUESTIONNAIRE_ITEM',
            `${results.questionnaire_code}_${response.item_id}`,
            new Date(results.start_time).toISOString(),
            typeof response.value === 'number' ? 'N' : 'T',
            response.label,
            typeof response.value === 'number' ? response.value : null,
            JSON.stringify(response),
            'SURVEY_SYSTEM'
          ]
        )
      }

      logger.success(`Saved questionnaire response for patient ${patientNum}`)
      return true

    } catch (err) {
      error.value = err.message
      logger.error('Failed to save questionnaire response', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear current questionnaire and responses
   */
  const clearActive = () => {
    activeQuestionnaire.value = null
    currentResponses.value = {}
  }

  /**
   * Random fill for testing (similar to survey3)
   */
  const randomFill = () => {
    if (!activeQuestionnaire.value) return

    activeQuestionnaire.value.items.forEach(item => {
      if (!item.id) return

      switch (item.type) {
        case 'number':
          currentResponses.value[item.id] = Math.floor(Math.random() * 10)
          break
        case 'radio':
          if (item.options && item.options.length > 0) {
            const randomIndex = Math.floor(Math.random() * item.options.length)
            currentResponses.value[item.id] = item.options[randomIndex].value
          }
          break
        case 'text':
          currentResponses.value[item.id] = 'Test response'
          break
        default:
          break
      }
    })

    logger.info('Filled questionnaire with random values')
  }

  /**
   * Refresh questionnaires from database
   */
  const refreshQuestionnaires = async () => {
    await loadQuestionnaires()
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
    calculateResults,
    saveQuestionnaireResponse,
    clearActive,
    randomFill
  }
})
