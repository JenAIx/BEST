/**
 * Survey Import Service
 *
 * Handles import of clinical data from HTML survey files with support for:
 * - CDA data extraction from HTML content
 * - Questionnaire response parsing
 * - Survey result transformation
 * - Metadata extraction from survey structure
 */

import { BaseImportService } from './base-import-service.js'
import { Hl7Service } from '../hl7-service.js'

// Import existing questionnaire processing functionality
import { calculateResults } from '../../../shared/quest/questionnaire-results.js'
import { saveQuestionnaireResponse } from '../../../shared/quest/questionnaire-database.js'


export class ImportSurveyService extends BaseImportService {
  constructor(conceptRepository, cqlRepository) {
    super(conceptRepository, cqlRepository)

    // Initialize HL7 service for CDA processing
    this.hl7Service = new Hl7Service(conceptRepository, cqlRepository)

    // Survey-specific patterns
    this.surveyPatterns = {
      cdaScript: /<script[^>]*>[\s\S]*?({[\s\S]*?cda[\s\S]*?})[\s\S]*?<\/script>/gi,
      cdaJson: /{[\s\S]*?"cda"[\s\S]*?}/gi,
      questionnaireData: /window\.(questionnaire|survey)Data\s*=\s*({[\s\S]*?});/gi,
      embeddedJson: /{[\s\S]*?(?:questionnaire|survey|assessment)[\s\S]*?}/gi,
    }
  }

  /**
   * Import survey data from HTML file content
   * @param {string} htmlContent - Raw HTML file content
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result with success/data/errors
   */
  async importFromHtml(htmlContent, options = {}) {
    try {
      // Extract CDA data from HTML
      const cdaData = this.extractCdaFromHtml(htmlContent)

      if (!cdaData) {
        return this.createImportResult(false, null, { contentType: 'HTML', extracted: false }, [this.createError('NO_CDA_FOUND', 'No CDA data found in HTML content')])
      }

      // Parse the extracted CDA data
      const parsedCda = this.parseCdaData(cdaData)

      // Validate CDA structure
      const validationResult = this.validateSurveyCda(parsedCda)

      if (!validationResult.isValid) {
        return this.createImportResult(false, null, { contentType: 'HTML', extracted: true, parsed: true }, validationResult.errors, validationResult.warnings)
      }

      // Transform to clinical objects
      const clinicalData = await this.transformSurveyToClinical(parsedCda, options)

      // Validate clinical data structure
      const clinicalValidation = this.validateClinicalData(clinicalData)

      const metadata = {
        ...this.extractSurveyMetadata(htmlContent, parsedCda),
        contentType: 'HTML Survey',
        format: 'HTML Survey BEST CDA',
        patients: clinicalData.patients.length,
        visits: clinicalData.visits.length,
        observations: clinicalData.observations.length,
        hasCdaData: true,
      }

      return this.createImportResult(clinicalValidation.errors.length === 0, clinicalData, metadata, clinicalValidation.errors, clinicalValidation.warnings)
    } catch (error) {
      return this.handleImportError(error, 'HTML Survey processing')
    }
  }

  /**
   * Extract CDA data from HTML content
   * @param {string} htmlContent - Raw HTML content
   * @returns {string|null} Extracted CDA JSON string or null
   */
  extractCdaFromHtml(htmlContent) {
    // Try multiple extraction patterns
    const patterns = [this.surveyPatterns.cdaScript, this.surveyPatterns.questionnaireData, this.surveyPatterns.embeddedJson, this.surveyPatterns.cdaJson]

    for (const pattern of patterns) {
      const matches = htmlContent.match(pattern)
      if (matches && matches.length > 0) {
        for (const match of matches) {
          // Try to extract JSON from the match
          const jsonMatch = match.match(/{[\s\S]*}/)
          if (jsonMatch) {
            const jsonString = jsonMatch[0]
            try {
              // Validate it's parseable JSON
              JSON.parse(jsonString)
              return jsonString
            } catch {
              // Continue to next match
              continue
            }
          }
        }
      }
    }

    // Try a broader search for any JSON-like content containing 'cda'
    // Look for complete JSON objects with balanced braces
    const findCompleteJson = (text) => {
      let braceCount = 0
      let startIndex = -1
      let inString = false
      let escapeNext = false

      for (let i = 0; i < text.length; i++) {
        const char = text[i]

        if (escapeNext) {
          escapeNext = false
          continue
        }

        if (char === '\\') {
          escapeNext = true
          continue
        }

        if (char === '"' && !inString) {
          inString = true
        } else if (char === '"' && inString) {
          inString = false
        } else if (!inString) {
          if (char === '{') {
            if (startIndex === -1) {
              startIndex = i
            }
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0 && startIndex !== -1) {
              return text.substring(startIndex, i + 1)
            }
          }
        }
      }

      return null
    }

    // Find positions of 'cda' in the HTML
    const cdaPositions = []
    let pos = htmlContent.indexOf('"cda"')
    while (pos !== -1) {
      cdaPositions.push(pos)
      pos = htmlContent.indexOf('"cda"', pos + 1)
    }

    // Try to extract complete JSON around each 'cda' position
    for (const cdaPos of cdaPositions) {
      const searchStart = Math.max(0, cdaPos - 100) // Look back up to 100 chars
      const searchEnd = Math.min(htmlContent.length, cdaPos + 200) // Look forward up to 200 chars
      const searchText = htmlContent.substring(searchStart, searchEnd)

      const jsonBlock = findCompleteJson(searchText)
      if (jsonBlock && jsonBlock.includes('"cda"')) {
        try {
          JSON.parse(jsonBlock)
          return jsonBlock
        } catch {
          continue
        }
      }
    }

    return null
  }

  /**
   * Parse extracted CDA data
   * @param {string} cdaData - Raw CDA JSON string
   * @returns {Object} Parsed CDA object
   */
  parseCdaData(cdaData) {
    try {
      return JSON.parse(cdaData)
    } catch (error) {
      throw new Error(`Failed to parse CDA data: ${error.message}`)
    }
  }

  /**
   * Validate survey CDA structure
   * @param {Object} cdaData - Parsed CDA data
   * @returns {Object} Validation result
   */
  validateSurveyCda(cdaData) {
    const errors = []
    const warnings = []

    if (!cdaData) {
      errors.push(this.createError('INVALID_CDA_DATA', 'CDA data is null or undefined'))
      return { isValid: false, errors, warnings }
    }

    // Check for questionnaire/survey indicators
    const hasSurveyData = cdaData.questionnaire || cdaData.survey || cdaData.assessment || cdaData.responses || (cdaData.cda && (cdaData.cda.questionnaire || cdaData.cda.survey))

    if (!hasSurveyData) {
      warnings.push(this.createWarning('NO_SURVEY_DATA_DETECTED', 'CDA data does not appear to contain survey/questionnaire information'))
    }

    // Check for patient information
    const patientInfo = cdaData.patient || cdaData.subject || (cdaData.cda && cdaData.cda.patient)
    if (!patientInfo) {
      warnings.push(this.createWarning('MISSING_PATIENT_INFO', 'No patient information found in survey CDA'))
    }

    // Check for responses only if survey data is detected
    if (hasSurveyData) {
      const responses = cdaData.responses || cdaData.answers || (cdaData.cda && cdaData.cda.responses)
      if (!responses || (Array.isArray(responses) && responses.length === 0)) {
        errors.push(this.createError('NO_SURVEY_RESPONSES', 'Survey CDA contains no response data'))
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Transform survey CDA to clinical objects with questionnaire processing
   * @param {Object} cdaData - Parsed CDA data
   * @param {Object} dbStore - Database store for questionnaire processing (optional)
   * @param {Object} visitObservationStore - Visit observation store (optional)
   * @param {Object} conceptResolutionStore - Concept resolution store (optional)
   * @returns {Object} Clinical data structure with questionnaire results
   */
  async transformSurveyToClinical(cdaData, dbStore = null, visitObservationStore = null, conceptResolutionStore = null) {
    const patients = []
    const visits = []
    const observations = []

    // Extract patient information
    const patient = this.extractPatientFromSurvey(cdaData)
    if (patient) {
      patients.push(patient)
    }

    // Extract visit information
    const visit = this.extractVisitFromSurvey(cdaData, patient?.PATIENT_NUM)
    if (visit) {
      visits.push(visit)
    }

    // Extract responses from various possible locations
    const responses =
      cdaData.responses || (cdaData.cda && cdaData.cda.section && cdaData.cda.section[0] && cdaData.cda.section[0].entry) || (cdaData.section && cdaData.section[0] && cdaData.section[0].entry) || []

    // If we have database stores, use the full questionnaire processing pipeline
    if (dbStore && visitObservationStore && conceptResolutionStore && responses.length > 0) {
      try {
        // Create a questionnaire structure from the CDA data
        const questionnaire = this.createQuestionnaireFromCda(cdaData)

        // Format responses to match questionnaire response format
        const formattedResponses = this.formatSurveyResponses(responses)

        // Use existing questionnaire processing
        const results = calculateResults(questionnaire, formattedResponses)

        if (results && patient?.PATIENT_NUM && visit?.ENCOUNTER_NUM) {
          // Save using the existing questionnaire database functionality
          await saveQuestionnaireResponse(dbStore, patient.PATIENT_NUM, visit.ENCOUNTER_NUM, results, visitObservationStore, conceptResolutionStore)

          // Create a main observation for the questionnaire
          const questionnaireObs = this.createQuestionnaireObservation(patient.PATIENT_NUM, visit.ENCOUNTER_NUM, results)
          observations.push(questionnaireObs)
        }
      } catch (error) {
        console.warn('Questionnaire processing failed, falling back to basic observation extraction:', error)
        // Fall back to basic observation extraction
        const surveyObservations = this.extractObservationsFromSurvey(cdaData, visit?.ENCOUNTER_NUM)
        observations.push(...surveyObservations)
      }
    } else {
      // Fall back to basic observation extraction if no database stores provided
      const surveyObservations = this.extractObservationsFromSurvey(cdaData, visit?.ENCOUNTER_NUM)
      observations.push(...surveyObservations)
    }

    return { patients, visits, observations }
  }

  /**
   * Extract patient information from survey CDA
   * @param {Object} cdaData - CDA data
   * @returns {Object|null} Patient object or null
   */
  extractPatientFromSurvey(cdaData) {
    // Try multiple locations for patient data
    const patientData = cdaData.patient || cdaData.subject || (cdaData.cda && cdaData.cda.patient)

    // Also check info field for PID and direct patient data in cdaData
    const patientId = cdaData.info?.PID || cdaData.PID || (typeof patientData === 'object' && patientData?.display) || patientData?.patientNum

    if (!patientData && !patientId && !cdaData?.identifier && !cdaData?.gender) return null

    const patient = this.normalizePatient({
      PATIENT_NUM: this.generateId(), // Generate a temporary ID
      PATIENT_CD: patientData?.identifier || patientId || patientData?.patientId || patientData?.uid || cdaData?.identifier || 'UNKNOWN',
      SEX_CD: patientData?.gender || patientData?.sex || cdaData?.gender,
      AGE_IN_YEARS: patientData?.age || cdaData?.age,
      BIRTH_DATE: patientData?.birthDate || patientData?.dob || cdaData?.birthDate,
    })

    // Add survey type for UI purposes (not stored in database)
    patient.surveyType = cdaData.questionnaire?.type || cdaData.surveyType

    return patient
  }

  /**
   * Extract visit information from survey CDA
   * @param {Object} cdaData - CDA data
   * @param {number} patientNum - Patient number
   * @returns {Object|null} Visit object or null
   */
  extractVisitFromSurvey(cdaData, patientNum) {
    // Surveys are typically outpatient assessments
    const visit = this.normalizeVisit(
      {
        ENCOUNTER_NUM: this.generateId(),
        PATIENT_NUM: patientNum,
        START_DATE: cdaData.date || cdaData.completedAt || new Date().toISOString().split('T')[0],
        LOCATION_CD: 'OUTPATIENT', // Default for surveys
        INOUT_CD: 'O', // Outpatient
      },
      patientNum,
    )

    // Add survey type for UI purposes (not stored in database)
    visit.surveyType = cdaData.questionnaire?.type || cdaData.surveyType

    return visit
  }

  /**
   * Extract observations from survey responses
   * @param {Object} cdaData - CDA data
   * @param {number} encounterNum - Encounter number
   * @returns {Array} Array of observation objects
   */
  extractObservationsFromSurvey(cdaData, encounterNum) {
    const observations = []

    // Get responses from various possible locations
    const responses =
      cdaData.responses ||
      cdaData.answers ||
      (cdaData.cda && cdaData.cda.responses) ||
      (cdaData.cda && cdaData.cda.section && cdaData.cda.section[0] && cdaData.cda.section[0].entry) ||
      (cdaData.section && cdaData.section[0] && cdaData.section[0].entry) ||
      (cdaData.questionnaire && cdaData.questionnaire.responses) ||
      []

    if (!Array.isArray(responses)) return observations

    responses.forEach((response, index) => {
      const observation = this.createObservationFromSurveyResponse(response, encounterNum, index)
      if (observation) {
        observations.push(observation)
      }
    })

    // Also check for individual question responses
    if (cdaData.questions) {
      cdaData.questions.forEach((question, index) => {
        if (question.response || question.answer) {
          const observation = this.createObservationFromSurveyResponse(
            {
              question: question.text || question.question,
              answer: question.response || question.answer,
              code: question.code,
              ...question,
            },
            encounterNum,
            index + responses.length,
          )
          if (observation) {
            observations.push(observation)
          }
        }
      })
    }

    return observations
  }

  /**
   * Create observation from survey response
   * @param {Object} response - Survey response object
   * @param {number} encounterNum - Encounter number
   * @param {number} index - Response index for unique IDs
   * @returns {Object|null} Observation object or null
   */
  createObservationFromSurveyResponse(response, encounterNum, index) {
    if (!response) return null

    // Determine concept code - handle CDA structure
    let conceptCode = null

    // Handle different code structures
    if (typeof response.code === 'string') {
      conceptCode = response.code
    } else if (response.questionCode) {
      conceptCode = response.questionCode
    } else if (response.code && Array.isArray(response.code) && response.code[0]) {
      // Handle CDA code structure
      if (response.code[0].coding && response.code[0].coding[0] && response.code[0].coding[0].code) {
        conceptCode = response.code[0].coding[0].code
      }
    }

    if (!conceptCode) {
      // Generate a concept code if none provided
      conceptCode = `SURVEY_Q_${index + 1}`
    } else if (conceptCode.match(/^\d+$/)) {
      // If it's just a numeric code, assume it's SNOMED
      conceptCode = `SCTID: ${conceptCode}`
    }

    // Determine value and type
    let value = response.answer || response.response || response.value
    let valtypeCd = 'T' // Default to text

    if (value !== undefined && value !== null) {
      // Handle different answer types
      if (typeof value === 'number') {
        valtypeCd = 'N'
      } else if (typeof value === 'boolean') {
        valtypeCd = 'T'
        value = value ? 'Yes' : 'No'
      } else if (typeof value === 'string') {
        // Check if it's a numeric string
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
          valtypeCd = 'N'
        } else if (this.isDateLike(value)) {
          valtypeCd = 'D'
        }
      } else if (typeof value === 'object') {
        // Handle structured answers
        valtypeCd = 'B'
        value = JSON.stringify(value)
      }
    }

    return this.normalizeObservation(
      {
        ENCOUNTER_NUM: encounterNum,
        CONCEPT_CD: conceptCode,
        VALTYPE_CD: valtypeCd,
        VALUE: value,
        START_DATE: response.date || new Date().toISOString().split('T')[0],
        questionText: response.question,
        responseType: response.type || 'survey_response',
        surveyMetadata: {
          questionId: response.questionId,
          questionType: response.questionType,
          options: response.options,
        },
      },
      encounterNum,
    )
  }

  /**
   * Extract metadata from HTML survey
   * @param {string} htmlContent - Original HTML content
   * @param {Object} cdaData - Parsed CDA data
   * @returns {Object} Extracted metadata
   */
  extractSurveyMetadata(htmlContent, cdaData) {
    const metadata = {
      contentType: 'HTML Survey',
      format: 'HTML Survey BEST CDA',
      extractedAt: new Date().toISOString(),
    }

    // Extract title from HTML
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      metadata.title = titleMatch[1].trim()
    }

    // Extract survey type
    if (cdaData.questionnaire?.type) {
      metadata.surveyType = cdaData.questionnaire.type
    } else if (cdaData.survey?.type) {
      metadata.surveyType = cdaData.survey.type
    }

    // Extract completion date
    if (cdaData.completedAt) {
      metadata.completedAt = cdaData.completedAt
    } else if (cdaData.date) {
      metadata.completedAt = cdaData.date
    }

    // Extract questionnaire info
    if (cdaData.questionnaire) {
      metadata.questionnaire = {
        title: cdaData.questionnaire.title,
        version: cdaData.questionnaire.version,
        items: Array.isArray(cdaData.questionnaire.items) ? cdaData.questionnaire.items.length : cdaData.questionnaire.items || 0,
      }
    }

    // Count responses
    const responses = cdaData.responses || cdaData.answers || []
    metadata.responseCount = Array.isArray(responses) ? responses.length : 0

    return metadata
  }

  /**
   * Validate HTML content structure
   * @param {string} htmlContent - HTML content to validate
   * @returns {Object} Validation result
   */
  validateHtmlContent(htmlContent) {
    const errors = []
    const warnings = []

    if (!htmlContent || htmlContent.trim().length === 0) {
      errors.push(this.createError('EMPTY_HTML', 'HTML content is empty'))
      return { isValid: false, errors, warnings }
    }

    // Check for basic HTML structure
    if (!htmlContent.includes('<html') && !htmlContent.includes('<body')) {
      warnings.push(this.createWarning('NO_HTML_STRUCTURE', 'HTML content lacks standard HTML structure tags'))
    }

    // Check for script tags (where CDA data is typically embedded)
    if (!htmlContent.includes('<script')) {
      warnings.push(this.createWarning('NO_SCRIPT_TAGS', 'HTML content contains no script tags - CDA data may not be embedded'))
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Create a questionnaire structure from CDA data
   * @param {Object} cdaData - CDA data
   * @returns {Object} Questionnaire structure compatible with existing system
   */
  createQuestionnaireFromCda(cdaData) {
    const questionnaireType = cdaData.questionnaire?.type || cdaData.survey?.type || 'Imported Survey'

    return {
      code: questionnaireType.replace(/\s+/g, '_').toUpperCase(),
      title: cdaData.questionnaire?.title || questionnaireType,
      short_title: questionnaireType,
      items: this.createQuestionnaireItemsFromResponses(cdaData.responses || []),
      startTime: Date.now(),
      coding: 'SURVEY_BEST',
    }
  }

  /**
   * Create questionnaire items from survey responses
   * @param {Array} responses - Survey responses
   * @returns {Array} Questionnaire items
   */
  createQuestionnaireItemsFromResponses(responses) {
    return responses.map((response, index) => ({
      id: `q_${index + 1}`,
      type: 'text',
      text: response.question || `Question ${index + 1}`,
      force: true,
      value: response.answer || null,
    }))
  }

  /**
   * Format survey responses to match questionnaire response format
   * @param {Array} responses - Raw survey responses
   * @returns {Object} Formatted responses
   */
  formatSurveyResponses(responses) {
    const formattedResponses = {}

    responses.forEach((response, index) => {
      const itemId = `q_${index + 1}`
      formattedResponses[itemId] = response.answer || response.response || null
    })

    return formattedResponses
  }

  /**
   * Create a main questionnaire observation
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @param {Object} results - Questionnaire results
   * @returns {Object} Questionnaire observation
   */
  createQuestionnaireObservation(patientNum, encounterNum, results) {
    return {
      ENCOUNTER_NUM: encounterNum,
      PATIENT_NUM: patientNum,
      CONCEPT_CD: 'CUSTOM: QUESTIONNAIRE',
      VALTYPE_CD: 'Q',
      BVAL_BLOB: JSON.stringify(results),
      START_DATE: new Date().toISOString().split('T')[0],
      questionText: results.title || 'Imported Survey',
      surveyMetadata: {
        questionnaireCode: results.questionnaire_code,
        responseCount: results.items?.length || 0,
        completionDate: results.date_end,
      },
    }
  }
}
