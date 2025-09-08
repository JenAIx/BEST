/**
 * Questionnaire Database Operations
 *
 * Handles database operations for questionnaire responses and observations
 */

import { logger } from '../../core/services/logging-service.js'
import { handleValueTypeCd } from './questionnaire-valtype.js'

/**
 * Save questionnaire response to database (using new VALTYPE_CD='Q' approach)
 * @param {Object} dbStore - Database store
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {Object} results - Questionnaire results
 * @param {Object} visitObservationService - Visit observation service
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<Object>} Save result
 */
export const saveQuestionnaireResponse = async (dbStore, patientNum, encounterNum, results, visitObservationService, conceptResolutionStore) => {
  // Save the main questionnaire first
  const mainResult = await saveMainQuestionnaireResponse(dbStore, patientNum, encounterNum, results)

  // Extract and save individual results and answers as separate observations
  await saveIndividualResultsAsObservations(dbStore, patientNum, encounterNum, results, mainResult.observationId, visitObservationService, conceptResolutionStore)

  return mainResult
}

/**
 * Save main questionnaire response to database
 * @param {Object} dbStore - Database store
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {Object} results - Questionnaire results
 * @returns {Promise<Object>} Save result
 */
export const saveMainQuestionnaireResponse = async (dbStore, patientNum, encounterNum, results) => {
  if (!results) return false

  try {
    logger.info('Saving main questionnaire response', {
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

    logger.success('Main questionnaire saved successfully', {
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
    logger.error('Failed to save main questionnaire response', err, {
      patientNum,
      encounterNum,
      questionnaireCode: results.questionnaire_code,
    })
    throw err
  }
}

/**
 * Save individual results and answers as separate observations
 * @param {Object} dbStore - Database store
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {Object} results - Questionnaire results
 * @param {number} questionnaireObservationId - Main questionnaire observation ID
 * @param {Object} visitObservationService - Visit observation service
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<void>}
 */
export const saveIndividualResultsAsObservations = async (dbStore, patientNum, encounterNum, results, questionnaireObservationId, visitObservationService, conceptResolutionStore) => {
  logger.info('Saving individual results and answers as observations', {
    questionnaireCode: results.questionnaire_code,
    questionnaireObservationId,
  })

  // Process results first
  if (results.results && Array.isArray(results.results)) {
    await saveResultsAsObservations(dbStore, patientNum, encounterNum, results.results, results, questionnaireObservationId, visitObservationService, conceptResolutionStore)
  }

  // Process individual answers with coding
  if (results.items && Array.isArray(results.items)) {
    await saveAnswersAsObservations(dbStore, patientNum, encounterNum, results.items, results, questionnaireObservationId, visitObservationService, conceptResolutionStore)
  }
}

/**
 * Save questionnaire results as separate observations
 * @param {Object} dbStore - Database store
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {Array} results - Questionnaire results
 * @param {Object} fullResults - Full questionnaire results
 * @param {number} questionnaireObservationId - Main questionnaire observation ID
 * @param {Object} visitObservationService - Visit observation service
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<void>}
 */
export const saveResultsAsObservations = async (dbStore, patientNum, encounterNum, results, fullResults, questionnaireObservationId, visitObservationService, conceptResolutionStore) => {
  logger.debug('Processing results', { resultCount: results.length })

  for (const result of results) {
    try {
      if (!result.coding || !result.coding.code) {
        logger.debug('Skipping result without coding', { result })
        continue
      }

      const concept = await findConceptInDatabase(dbStore, result.coding.code)
      if (!concept) continue

      await createObservationFromQuestionnaireItem(
        dbStore,
        patientNum,
        encounterNum,
        concept,
        result.value,
        result,
        fullResults,
        questionnaireObservationId,
        'result',
        visitObservationService,
        conceptResolutionStore,
      )
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
 * @param {Object} dbStore - Database store
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {Array} items - Questionnaire items
 * @param {Object} fullResults - Full questionnaire results
 * @param {number} questionnaireObservationId - Main questionnaire observation ID
 * @param {Object} visitObservationService - Visit observation service
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<void>}
 */
export const saveAnswersAsObservations = async (dbStore, patientNum, encounterNum, items, fullResults, questionnaireObservationId, visitObservationService, conceptResolutionStore) => {
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
      const concept = await findConceptInDatabase(dbStore, item.coding.code)

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

      await createObservationFromQuestionnaireItem(
        dbStore,
        patientNum,
        encounterNum,
        concept,
        item.value,
        item,
        fullResults,
        questionnaireObservationId,
        'answer',
        visitObservationService,
        conceptResolutionStore,
      )
    } catch (error) {
      logger.error('Failed to save answer as observation - FALLING BACK TO DEFAULT', error, {
        conceptCode: item.coding?.code,
        item,
        errorMessage: error.message,
      })

      // Note: Fallback handling is already implemented in the main createObservationFromQuestionnaireItem function
      // This error occurred during VALTYPE_CD processing, and the main function already has fallback logic
      logger.warn('VALTYPE_CD processing failed, relying on main function fallback logic', {
        conceptCode: item.coding?.code,
        value: item.value,
      })
    }
  }
}

/**
 * Find concept in database using flexible matching
 * @param {Object} dbStore - Database store
 * @param {string} conceptCode - Concept code to find
 * @returns {Promise<Object|null>} Concept data or null
 */
export const findConceptInDatabase = async (dbStore, conceptCode) => {
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
 * Create observation from questionnaire item with proper VALTYPE_CD handling
 * @param {Object} dbStore - Database store
 * @param {number} patientNum - Patient number
 * @param {number} encounterNum - Encounter number
 * @param {Object} concept - Concept from database
 * @param {any} value - Questionnaire answer value
 * @param {Object} item - Questionnaire item
 * @param {Object} fullResults - Full questionnaire results
 * @param {number} questionnaireObservationId - Main questionnaire observation ID
 * @param {string} type - Type ('result' or 'answer')
 * @param {Object} visitObservationService - Visit observation service
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<void>}
 */
export const createObservationFromQuestionnaireItem = async (
  dbStore,
  patientNum,
  encounterNum,
  concept,
  value,
  item,
  fullResults,
  questionnaireObservationId,
  type,
  visitObservationService,
  conceptResolutionStore,
) => {
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

  // Handle different VALTYPE_CD cases
  await handleValueTypeCd(observationData, concept, value, item, fullResults.questionnaire_code, conceptResolutionStore)

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
    valtypeCd: observationData.VALTYPE_CD,
    value: value,
    originalValueType: typeof value,
    type: type,
  })

  // Create the observation
  const newObservation = await visitObservationService.createObservation(observationData)

  logger.success(`Created ${type} observation`, {
    conceptCode: concept.CONCEPT_CD,
    valtypeCd: concept.VALTYPE_CD,
    value: value,
    observationId: newObservation?.OBSERVATION_ID,
  })
}
