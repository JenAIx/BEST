import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { useVisitObservationStore } from './visit-observation-store.js'
import { logger } from '../core/services/logging-service.js'

/**
 * Questionnaire Management Store
 * Handles loading questionnaires from database and managing responses
 */
export const useQuestionnaireStore = defineStore('questionnaire', () => {
  const dbStore = useDatabaseStore()
  const visitObservationStore = useVisitObservationStore()

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
   * Calculate questionnaire results (QuestMan-style)
   */
  const calculateResults = () => {
    if (!activeQuestionnaire.value) return null

    // Create QuestMan-style summary structure
    const results = {
      label: activeQuestionnaire.value.code,
      title: activeQuestionnaire.value.title,
      short_title: activeQuestionnaire.value.short_title || activeQuestionnaire.value.code,
      questionnaire_code: activeQuestionnaire.value.code,
      date_start: activeQuestionnaire.value.startTime,
      date_end: Date.now(),
      items: [],
      results: null,
      coding: activeQuestionnaire.value.coding,
    }

    // Process individual responses (QuestMan items format)
    activeQuestionnaire.value.items.forEach((item) => {
      if (item.id && currentResponses.value[item.id] !== undefined) {
        const itemResult = {
          id: item.id,
          label: item.label,
          tag: item.tag || item.id,
          value: currentResponses.value[item.id],
          coding: item.coding,
          ignore_for_result: item.ignore_for_result,
        }

        // Convert string numbers to actual numbers for calculation
        if (item.type === 'number' && typeof itemResult.value === 'string') {
          itemResult.value = parseFloat(itemResult.value) || 0
        }

        results.items.push(itemResult)
      }
    })

    // Calculate summary results based on configuration (QuestMan-style)
    if (activeQuestionnaire.value.results) {
      results.results = calculateQuestManResults(results.items, activeQuestionnaire.value.results)

      // Apply evaluation if configured
      if (activeQuestionnaire.value.results.evaluation) {
        results.results = evaluateResults(results.results, activeQuestionnaire.value.results.evaluation)
      }
    }

    return results
  }

  /**
   * Calculate QuestMan-style results
   */
  const calculateQuestManResults = (items, resultsConfig) => {
    if (!resultsConfig.method) return null

    switch (resultsConfig.method) {
      case 'sum':
        return calculateQuestManSum(items, resultsConfig)
      case 'avg':
        return calculateQuestManAvg(items, resultsConfig)
      case 'count':
        return calculateQuestManCount(items, resultsConfig)
      default:
        logger.warn(`Unsupported results method: ${resultsConfig.method}`)
        return null
    }
  }

  /**
   * QuestMan-style sum calculation
   */
  const calculateQuestManSum = (items, config) => {
    let sum = 0
    items.forEach((item) => {
      if (typeof item.value === 'number' && item.ignore_for_result !== true) {
        sum += item.value
      } else if (Array.isArray(item.value) && item.ignore_for_result !== true) {
        item.value.forEach((val) => {
          if (typeof val === 'number') sum += val
        })
      }
    })

    const result = { label: 'sum', value: sum }
    if (config.coding) result.coding = config.coding
    return [result]
  }

  /**
   * QuestMan-style average calculation
   */
  const calculateQuestManAvg = (items, config) => {
    let sum = 0
    let count = 0
    items.forEach((item) => {
      if (typeof item.value === 'number' && item.ignore_for_result !== true) {
        sum += item.value
        count++
      }
    })

    const average = count > 0 ? Math.round((sum / count) * 100) / 100 : 0
    const result = { label: 'avg', value: average }
    if (config.coding) result.coding = config.coding
    return [result]
  }

  /**
   * QuestMan-style count calculation
   */
  const calculateQuestManCount = (items, config) => {
    const answers = []
    items.forEach((item) => answers.push(item.value))

    const uniqueAnswers = [...new Set(answers)]
    const count = {}
    uniqueAnswers.forEach((answer) => {
      count[answer] = { count: 0, label: answer }
    })

    let total = 0
    items.forEach((item) => {
      count[item.value].count++
      total++
    })

    const results = []
    Object.keys(count).forEach((key) => {
      const result = {
        label: count[key].label,
        value: count[key].count,
        total: total,
      }
      if (config.coding) result.coding = config.coding
      results.push(result)
    })

    return results
  }

  /**
   * Evaluate results based on evaluation configuration
   */
  const evaluateResults = (results, evaluation) => {
    if (!Array.isArray(results)) return results

    results.forEach((result) => {
      if (result.label === 'sum') {
        evaluation.forEach((evalItem) => {
          if (evalItem.range && evalItem.range[0] <= result.value && evalItem.range[1] >= result.value) {
            result.evaluation = evalItem.label
          }
        })
      }
    })

    return results
  }

  /**
   * Save questionnaire response to database (using new VALTYPE_CD='Q' approach)
   */
  const saveQuestionnaireResponse = async (patientNum, encounterNum, results) => {
    // Save the main questionnaire first
    const mainResult = await saveMainQuestionnaireResponse(patientNum, encounterNum, results)

    // Extract and save individual results and answers as separate observations
    await saveIndividualResultsAsObservations(patientNum, encounterNum, results, mainResult.observationId)

    return mainResult
  }

  /**
   * Save main questionnaire response to database
   */
  const saveMainQuestionnaireResponse = async (patientNum, encounterNum, results) => {
    if (!results) return false

    loading.value = true
    error.value = null

    try {
      logger.info('Saving questionnaire response with new Q approach', {
        patientNum,
        encounterNum,
        questionnaireCode: results.questionnaire_code,
        title: results.title,
      })

      // Use the standard questionnaire concept for surveys
      let conceptCode = 'CUSTOM: QUESTIONNAIRE'

      // Check if the concept exists in CONCEPT_DIMENSION
      const conceptCheck = await dbStore.executeQuery('SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [conceptCode])

      if (!conceptCheck.success || conceptCheck.data.length === 0) {
        logger.warn('Standard questionnaire concept not found in CONCEPT_DIMENSION', {
          attemptedConcept: conceptCode,
          fallbackTo: results.questionnaire_code,
        })

        // Check if questionnaire code exists as concept
        const fallbackCheck = await dbStore.executeQuery('SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [results.questionnaire_code])

        if (fallbackCheck.success && fallbackCheck.data.length > 0) {
          conceptCode = results.questionnaire_code
        } else {
          // Create the standard questionnaire concept if it doesn't exist
          logger.info('Creating missing standard questionnaire concept', {
            conceptCode: 'CUSTOM: QUESTIONNAIRE',
          })

          try {
            await dbStore.executeQuery(
              `INSERT INTO CONCEPT_DIMENSION (
                CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, UPDATE_DATE,
                DOWNLOAD_DATE, IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID
              ) VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'), ?, ?)`,
              ['CUSTOM: QUESTIONNAIRE', 'CUSTOM: QUESTIONNAIRE', 'Survey Best - Questionnaire', 'CUSTOM', 79190712],
            )

            conceptCode = 'CUSTOM: QUESTIONNAIRE'
            logger.success('Created standard questionnaire concept successfully')
          } catch (conceptError) {
            logger.error('Failed to create questionnaire concept', conceptError)
            throw new Error(`Failed to create questionnaire concept: ${conceptError.message}`)
          }
        }
      }

      // Save single questionnaire record using VALTYPE_CD='Q'
      const result = await dbStore.executeQuery(
        `INSERT INTO OBSERVATION_FACT (
          ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, PROVIDER_ID,
          START_DATE, END_DATE, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB,
          UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, CATEGORY_CHAR, INSTANCE_NUM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?)`,
        [
          encounterNum,
          patientNum,
          conceptCode, // Use verified concept code
          '@', // Default provider
          new Date(results.date_start).toISOString(),
          new Date(results.date_end).toISOString(),
          'Q', // New questionnaire VALTYPE_CD
          results.title, // Questionnaire title in TVAL_CHAR
          JSON.stringify(results), // Complete QuestMan-style results in OBSERVATION_BLOB
          'SURVEY_SYSTEM',
          'SURVEY_BEST', // Category for questionnaires
          1, // Instance number
        ],
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to save questionnaire')
      }

      const observationId = result.lastInsertRowid || result.insertId

      logger.success('Questionnaire saved successfully', {
        patientNum,
        encounterNum,
        observationId,
        questionnaireCode: results.questionnaire_code,
        title: results.title,
        itemCount: results.items?.length || 0,
        hasResults: !!results.results,
      })

      return {
        success: true,
        observationId,
        message: `Questionnaire "${results.title}" saved successfully`,
      }
    } catch (err) {
      error.value = err.message
      logger.error('Failed to save questionnaire response', err, {
        patientNum,
        encounterNum,
        questionnaireCode: results.questionnaire_code,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Save individual results and answers as separate observations
   */
  const saveIndividualResultsAsObservations = async (patientNum, encounterNum, results, questionnaireObservationId) => {
    console.log('🔍 DEBUG: saveIndividualResultsAsObservations called', {
      questionnaireCode: results.questionnaire_code,
      questionnaireObservationId,
      hasResults: !!results.results,
      resultsIsArray: Array.isArray(results.results),
      hasItems: !!results.items,
      itemsIsArray: Array.isArray(results.items),
      itemCount: results.items?.length || 0,
    })

    logger.info('Saving individual results and answers as observations', {
      questionnaireCode: results.questionnaire_code,
      questionnaireObservationId,
    })

    // Process results first
    if (results.results && Array.isArray(results.results)) {
      await saveResultsAsObservations(patientNum, encounterNum, results.results, results, questionnaireObservationId)
    }

    // Process individual answers with coding
    if (results.items && Array.isArray(results.items)) {
      await saveAnswersAsObservations(patientNum, encounterNum, results.items, results, questionnaireObservationId)
    }
  }

  /**
   * Save questionnaire results as separate observations
   */
  const saveResultsAsObservations = async (patientNum, encounterNum, results, fullResults, questionnaireObservationId) => {
    logger.debug('Processing results', { resultCount: results.length })

    for (const result of results) {
      try {
        if (!result.coding || !result.coding.code) {
          logger.debug('Skipping result without coding', { result })
          continue
        }

        const concept = await findConceptInDatabase(result.coding.code)
        if (!concept) continue

        await createObservationFromQuestionnaireItem(patientNum, encounterNum, concept, result.value, result, fullResults, questionnaireObservationId, 'result')
      } catch (error) {
        logger.error('Failed to save result as observation', error, {
          conceptCode: result.coding?.code,
          result,
        })
      }
    }
  }

  /**
   * Save questionnaire answers as separate observations
   */
  const saveAnswersAsObservations = async (patientNum, encounterNum, items, fullResults, questionnaireObservationId) => {
    console.log('🔍 DEBUG: saveAnswersAsObservations called', {
      itemCount: items.length,
      questionnaireCode: fullResults.questionnaire_code,
      questionnaireObservationId,
    })

    logger.info('Processing answers', { itemCount: items.length, questionnaireCode: fullResults.questionnaire_code })

    for (const item of items) {
      try {
        logger.debug('Processing item', {
          id: item.id,
          label: item.label,
          hasCoding: !!item.coding,
          codingCode: item.coding?.code,
          value: item.value,
          valueType: typeof item.value,
          isArray: Array.isArray(item.value),
          arrayLength: Array.isArray(item.value) ? item.value.length : null,
        })

        if (!item.coding || !item.coding.code || item.value === null || item.value === undefined || item.value === '' || (Array.isArray(item.value) && item.value.length === 0)) {
          logger.debug('Skipping item without coding or value', { item })
          continue
        }

        logger.debug('Looking up concept for item', { conceptCode: item.coding.code, itemLabel: item.label })
        const concept = await findConceptInDatabase(item.coding.code)

        if (!concept) {
          logger.warn('No concept found for item, skipping', {
            conceptCode: item.coding.code,
            itemLabel: item.label,
            value: item.value,
          })
          continue
        }

        logger.info('Creating observation for item', {
          conceptCode: concept.CONCEPT_CD,
          valtypeCd: concept.VALTYPE_CD,
          itemLabel: item.label,
          value: item.value,
        })

        await createObservationFromQuestionnaireItem(patientNum, encounterNum, concept, item.value, item, fullResults, questionnaireObservationId, 'answer')
      } catch (error) {
        logger.error('Failed to save answer as observation', error, {
          conceptCode: item.coding?.code,
          item,
        })
      }
    }
  }

  /**
   * Find concept in database using flexible matching
   */
  const findConceptInDatabase = async (conceptCode) => {
    logger.debug('Searching for concept', { conceptCode })

    // First try exact match
    let conceptCheck = await dbStore.executeQuery('SELECT CONCEPT_CD, NAME_CHAR, VALTYPE_CD, SOURCESYSTEM_CD, CATEGORY_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [conceptCode])

    logger.debug('Exact match result', {
      conceptCode,
      success: conceptCheck.success,
      foundCount: conceptCheck.data?.length || 0,
      foundConcept: conceptCheck.data?.[0]?.CONCEPT_CD,
    })

    if (conceptCheck.success && conceptCheck.data.length > 0) {
      logger.debug('Found concept using exact match', { conceptCode, foundCode: conceptCheck.data[0].CONCEPT_CD })
      return conceptCheck.data[0]
    }

    // Try LIKE match for different prefixes (e.g., '424144002' vs 'SCTID: 424144002')
    conceptCheck = await dbStore.executeQuery('SELECT CONCEPT_CD, NAME_CHAR, VALTYPE_CD, SOURCESYSTEM_CD, CATEGORY_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE ?', [`%${conceptCode}%`])

    logger.debug('LIKE match result', {
      conceptCode,
      likePattern: `%${conceptCode}%`,
      success: conceptCheck.success,
      foundCount: conceptCheck.data?.length || 0,
      foundConcepts: conceptCheck.data?.map((c) => c.CONCEPT_CD) || [],
    })

    if (conceptCheck.success && conceptCheck.data.length > 0) {
      logger.debug('Found concept using LIKE match', {
        searchedCode: conceptCode,
        foundCode: conceptCheck.data[0].CONCEPT_CD,
      })
      return conceptCheck.data[0]
    }

    logger.warn('Concept not found in CONCEPT_DIMENSION', { conceptCode })
    return null
  }

  /**
   * Create observation from questionnaire item
   */
  const createObservationFromQuestionnaireItem = async (patientNum, encounterNum, concept, value, item, fullResults, questionnaireObservationId, type) => {
    // Prepare observation data
    const observationData = {
      PATIENT_NUM: patientNum,
      ENCOUNTER_NUM: encounterNum,
      CONCEPT_CD: concept.CONCEPT_CD,
      SOURCESYSTEM_CD: concept.SOURCESYSTEM_CD,
      // Let visit-observation-store use concept's CATEGORY_CHAR, fallback to SURVEY_BEST
      START_DATE: new Date().toISOString(),
      PROVIDER_ID: '@',
      LOCATION_CD: 'QUESTIONNAIRE',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    // Handle different value types
    if (concept.VALTYPE_CD === 'N' && typeof value === 'number') {
      observationData.VALTYPE_CD = 'N'
      observationData.NVAL_NUM = value
      observationData.TVAL_CHAR = null
    } else if (Array.isArray(value)) {
      // Handle array values (like multiple symptoms)
      observationData.VALTYPE_CD = 'A'
      observationData.TVAL_CHAR = value.join('; ')
      observationData.NVAL_NUM = null
    } else {
      // Default to text for other types
      observationData.VALTYPE_CD = concept.VALTYPE_CD || 'T'
      observationData.TVAL_CHAR = String(value)
      observationData.NVAL_NUM = null
    }

    // Store reference to the original questionnaire in OBSERVATION_BLOB
    observationData.OBSERVATION_BLOB = JSON.stringify({
      questionnaireReference: {
        questionnaireCode: fullResults.questionnaire_code,
        questionnaireObservationId: questionnaireObservationId,
        type: type, // 'result' or 'answer'
        originalItem: {
          id: item.id,
          label: item.label,
          tag: item.tag,
          value: item.value,
          coding: item.coding,
        },
      },
    })

    // Debug logging before creating observation
    console.log('🔍 DEBUG: Creating observation with data', {
      conceptCode: concept.CONCEPT_CD,
      conceptCategory: concept.CATEGORY_CHAR,
      willUseConceptCategory: !observationData.CATEGORY_CHAR,
      valtypeCd: observationData.VALTYPE_CD,
      value: value,
      type: type,
    })

    // Create the observation
    const newObservation = await visitObservationStore.createObservation(observationData)

    logger.success(`Created ${type} observation`, {
      conceptCode: concept.CONCEPT_CD,
      valtypeCd: concept.VALTYPE_CD,
      value: value,
      observationId: newObservation?.OBSERVATION_ID,
    })
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

    activeQuestionnaire.value.items.forEach((item) => {
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

  /**
   * Test function to manually trigger observation extraction for existing questionnaires
   */
  const testQuestionnaireExtraction = async (questionnaireObservationId) => {
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

      // Trigger the extraction
      await saveIndividualResultsAsObservations(PATIENT_NUM, ENCOUNTER_NUM, questionnaireData, questionnaireObservationId)

      logger.success('Extraction test completed', { questionnaireObservationId })
    } catch (error) {
      logger.error('Extraction test failed', error, { questionnaireObservationId })
    }
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
    randomFill,

    // Test functions
    testQuestionnaireExtraction,
  }
})
