/**
 * Questionnaire VALTYPE_CD Processing
 *
 * Handles different VALTYPE_CD values for questionnaire observations
 */

import { logger } from '../../core/services/logging-service.js'

/**
 * Handle different VALTYPE_CD cases for questionnaire answers
 * @param {Object} observationData - Observation data object
 * @param {Object} concept - Concept from database
 * @param {any} value - Questionnaire answer value
 * @param {Object} item - Questionnaire item
 * @param {string} questionnaireCode - Questionnaire code
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<void>}
 */
export const handleValueTypeCd = async (observationData, concept, value, item, questionnaireCode, conceptResolutionStore) => {
  // IMPORTANT: Use the VALTYPE_CD from the concept retrieved from the database
  // The concept was looked up using item.coding.code, and we must respect its VALTYPE_CD
  const valtypeCd = concept.VALTYPE_CD

  logger.info('handleValueTypeCd called', {
    valtypeCd,
    conceptCode: concept.CONCEPT_CD,
    value,
    questionnaireCode,
    conceptValtypeCd: concept.VALTYPE_CD, // Log the concept's VALTYPE_CD for verification
  })

  switch (valtypeCd) {
    case 'T': // Text
      observationData.VALTYPE_CD = 'T'
      observationData.TVAL_CHAR = String(value)
      observationData.NVAL_NUM = null
      logger.debug('Handling VALTYPE_CD T (Text)', { value, tvChar: observationData.TVAL_CHAR })
      break

    case 'N': // Numeric
      if (typeof value === 'number') {
        observationData.VALTYPE_CD = 'N'
        observationData.NVAL_NUM = value
        observationData.TVAL_CHAR = null
        logger.debug('Handling VALTYPE_CD N (Numeric)', { value, nvalNum: observationData.NVAL_NUM })
      } else {
        // Try to parse as number
        const parsed = parseFloat(value)
        if (!isNaN(parsed)) {
          observationData.VALTYPE_CD = 'N'
          observationData.NVAL_NUM = parsed
          observationData.TVAL_CHAR = null
          logger.debug('Handling VALTYPE_CD N (Numeric) - parsed from string', { originalValue: value, parsedValue: parsed })
        } else {
          // Fallback to text if parsing fails
          observationData.VALTYPE_CD = 'T'
          observationData.TVAL_CHAR = String(value)
          observationData.NVAL_NUM = null
          logger.warn('VALTYPE_CD N but value is not numeric, falling back to text', { value })
        }
      }
      break

    case 'A': // Answer (typically yes/no)
      observationData.VALTYPE_CD = 'T'
      // Use SNOMED code for "Yes" (373066001) for positive answers
      observationData.TVAL_CHAR = 'SCTID: 373066001'
      observationData.NVAL_NUM = null
      logger.debug('Handling VALTYPE_CD A (Answer) - using Yes concept', { originalValue: value, tvChar: observationData.TVAL_CHAR })
      break

    case 'S': // Selection - need to resolve to specific concept
      console.log('🔍 DEBUG: VALTYPE_CD S case reached', {
        conceptCode: concept.CONCEPT_CD,
        value: value,
        questionnaireCode,
      })

      logger.info('Handling VALTYPE_CD S - starting selection resolution', {
        conceptCode: concept.CONCEPT_CD,
        value: value,
        questionnaireCode,
      })
      await handleSelectionValueType(observationData, concept, value, item, questionnaireCode, conceptResolutionStore)
      break

    case 'F': // Finding
      observationData.VALTYPE_CD = 'T'
      observationData.TVAL_CHAR = String(value)
      observationData.NVAL_NUM = null
      logger.debug('Handling VALTYPE_CD F (Finding)', { value, tvChar: observationData.TVAL_CHAR })
      break

    default:
      // Unknown VALTYPE_CD, default to text
      observationData.VALTYPE_CD = 'T'
      observationData.TVAL_CHAR = String(value)
      observationData.NVAL_NUM = null
      logger.warn('Unknown VALTYPE_CD, defaulting to text', { valtypeCd, value })
  }
}

/**
 * Handle VALTYPE_CD 'S' (Selection) by resolving to specific concept
 * @param {Object} observationData - Observation data object
 * @param {Object} concept - Concept from database
 * @param {any} value - Questionnaire answer value
 * @param {Object} item - Questionnaire item
 * @param {string} questionnaireCode - Questionnaire code
 * @param {Object} conceptResolutionStore - Concept resolution store
 * @returns {Promise<void>}
 */
export const handleSelectionValueType = async (observationData, concept, value, item, questionnaireCode, conceptResolutionStore) => {
  try {
    logger.info('Handling VALTYPE_CD S (Selection) - getting options', {
      conceptCode: concept.CONCEPT_CD,
      value: value,
      questionnaireCode,
    })

    // Check if value is already a concept code (e.g., "SCTID: 438949009" or "LOINC: 12345-6")
    const valueStr = String(value).trim()
    const isConceptCode = /^(SCTID|LOINC|CUSTOM):\s*\d+/.test(valueStr)
    
    if (isConceptCode) {
      // Value is already a concept code (e.g., "SCTID: 438949009"), use it directly
      // IMPORTANT: Use the concept's VALTYPE_CD from the database (should be 'S' for Selection)
      logger.info('Value is already a concept code, using directly', {
        conceptCode: concept.CONCEPT_CD,
        conceptValtypeCd: concept.VALTYPE_CD,
        value: valueStr,
      })
      observationData.VALTYPE_CD = concept.VALTYPE_CD // Use the concept's VALTYPE_CD from database
      observationData.TVAL_CHAR = valueStr // Store the concept code
      observationData.NVAL_NUM = null
      return
    }

    // Get selection options for this concept
    const options = await conceptResolutionStore.getStandardSelectionOptions(concept.CONCEPT_CD)

    logger.info('Selection options retrieved from concept hierarchy', {
      conceptCode: concept.CONCEPT_CD,
      optionsCount: options ? options.length : 0,
      options: options ? options.slice(0, 3).map((opt) => ({ label: opt.label, value: opt.value })) : [], // Show first 3
      value: value,
      expectedMatches: options ? options.filter((opt) => opt.label && opt.label.toLowerCase().includes(value.toLowerCase().substring(0, 2))).map((opt) => opt.label) : [],
    })

    if (!options || options.length === 0) {
      logger.warn('No selection options found for concept, falling back to text', {
        conceptCode: concept.CONCEPT_CD,
        value: value,
      })
      // Fallback to text handling
      observationData.VALTYPE_CD = 'T'
      observationData.TVAL_CHAR = String(value)
      observationData.NVAL_NUM = null
      return
    }

    // Try to find matching option
    const matchedOption = findMatchingOption(value, options)

    if (matchedOption) {
      // IMPORTANT: Keep the VALTYPE_CD from the concept (should be 'S' for Selection)
      // The concept was retrieved from the database and has the correct VALTYPE_CD
      // We store the resolved answer concept code in TVAL_CHAR, but keep VALTYPE_CD as 'S'
      // so the system can properly resolve the code back to text when displaying
      observationData.CONCEPT_CD = concept.CONCEPT_CD // Keep original parent concept
      observationData.VALTYPE_CD = concept.VALTYPE_CD // Use the concept's VALTYPE_CD from database (should be 'S')
      observationData.TVAL_CHAR = matchedOption.value // Store the resolved answer concept code (e.g., "SCTID: 248153007")
      observationData.NVAL_NUM = null

      logger.debug('Found matching selection option', {
        originalValue: value,
        matchedLabel: matchedOption.label,
        matchedCode: matchedOption.value,
        storedCode: observationData.TVAL_CHAR,
        originalConcept: concept.CONCEPT_CD,
        conceptValtypeCd: concept.VALTYPE_CD, // The VALTYPE_CD from the database concept
        observationValtypeCd: observationData.VALTYPE_CD, // Should match concept.VALTYPE_CD
      })
    } else {
      // No match found, fall back to text handling
      logger.warn('No matching selection option found, falling back to text', {
        questionnaireCode,
        conceptCode: concept.CONCEPT_CD,
        value: value,
        availableOptions: options.map((opt) => ({ label: opt.label, value: opt.value })),
      })

      // Fallback to text handling
      observationData.VALTYPE_CD = 'T'
      observationData.TVAL_CHAR = String(value)
      observationData.NVAL_NUM = null
      return
    }
  } catch (error) {
    logger.error('Failed to handle selection VALTYPE_CD - FALLING BACK TO TEXT', error, {
      conceptCode: concept.CONCEPT_CD,
      value: value,
      questionnaireCode,
    })

    // Fallback to text handling on any error
    observationData.VALTYPE_CD = 'T'
    observationData.TVAL_CHAR = String(value)
    observationData.NVAL_NUM = null
  }
}

/**
 * Find matching option using first 2 letters comparison
 * @param {any} value - Value to match
 * @param {Array} options - Available options
 * @returns {Object|null} Matching option or null
 */
export const findMatchingOption = (value, options) => {
  if (!value || !options || options.length === 0) return null

  const searchValue = String(value).toLowerCase().trim()
  const firstTwoLetters = searchValue.substring(0, 2)

  logger.debug('Searching for matching option', {
    searchValue,
    firstTwoLetters,
    optionCount: options.length,
  })

  // First try exact match
  const exactMatch = options.find((option) => option.label && option.label.toLowerCase() === searchValue)
  if (exactMatch) {
    logger.debug('Found exact match', { label: exactMatch.label, value: exactMatch.value })
    return exactMatch
  }

  // Then try first 2 letters match
  const letterMatch = options.find((option) => option.label && option.label.toLowerCase().substring(0, 2) === firstTwoLetters)
  if (letterMatch) {
    logger.debug('Found first 2 letters match', { label: letterMatch.label, value: letterMatch.value })
    return letterMatch
  }

  logger.debug('No matching option found', { searchValue, firstTwoLetters })
  return null
}
