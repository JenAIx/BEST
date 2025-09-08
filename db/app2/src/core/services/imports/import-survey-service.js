/**
 * Survey Import Service
 *
 * Handles import of clinical data from HTML survey files with CDA content.
 * Creates importStructure format with:
 * - Patient and Visit data
 * - Main questionnaire observation (ValType='Q') with CDA in OBSERVATION_BLOB
 * - Individual observations only for entries with proper coding (code + system)
 */

import { BaseImportService } from './base-import-service.js'
import { createImportStructure } from './import-structure.js'
import { logger } from '../logging-service.js'

export class ImportSurveyService extends BaseImportService {
  constructor(conceptRepository, cqlRepository) {
    super(conceptRepository, cqlRepository)
  }

  /**
   * Import survey data from HTML file content
   * @param {string} htmlContent - Raw HTML file content
   * @param {Object} options - Import options
   * @param {Object} importService - Import service instance for structure creation
   * @returns {Promise<Object>} Import result with importStructure format
   */
  async importFromHtml(htmlContent, options = {}, importService = null) {
    // Suppress unused parameter warning
    void options
    try {
      logger.info('Starting HTML survey import', { contentLength: htmlContent?.length })

      // Extract CDA data from HTML
      const cdaJsonString = this.extractCdaFromHtml(htmlContent)
      if (!cdaJsonString) {
        return this.createErrorResult('NO_CDA_FOUND', 'No CDA data found in HTML content')
      }

      // Parse the CDA data
      const cdaData = this.parseCdaData(cdaJsonString)
      logger.info('CDA data parsed successfully', {
        hasSubject: !!cdaData.cda?.subject,
        hasSections: !!cdaData.cda?.section?.length,
      })

      // Transform to importStructure format
      const importStructure = this.transformToImportStructure(cdaData, importService)

      logger.info('HTML survey import completed successfully', {
        patients: importStructure.data.patients.length,
        visits: importStructure.data.visits.length,
        observations: importStructure.data.observations.length,
      })

      return {
        success: true,
        data: importStructure,
        errors: [],
        warnings: [],
      }
    } catch (error) {
      logger.error('HTML survey import failed', { error: error.message, stack: error.stack })
      return this.createErrorResult('IMPORT_FAILED', `Import failed: ${error.message}`)
    }
  }

  /**
   * Extract CDA data from HTML content
   * @param {string} htmlContent - Raw HTML content
   * @returns {string|null} Extracted CDA JSON string or null
   */
  extractCdaFromHtml(htmlContent) {
    // Look for CDA = {...} assignment in script tags
    const startMatch = htmlContent.match(/CDA\s*=\s*({)/i)
    if (!startMatch) {
      logger.warn('No CDA assignment found in HTML content')
      return null
    }

    const startIndex = startMatch.index + startMatch[0].length - 1 // Position after opening brace
    let braceCount = 1
    let endIndex = startIndex

    // Find the matching closing brace
    for (let i = startIndex + 1; i < htmlContent.length; i++) {
      if (htmlContent[i] === '{') {
        braceCount++
      } else if (htmlContent[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          endIndex = i + 1 // Include the closing brace
          break
        }
      }
    }

    if (braceCount !== 0) {
      logger.warn('Unmatched braces in CDA object')
      return null
    }

    const rawContent = htmlContent.substring(startIndex, endIndex)

    // Try to parse as JSON first
    try {
      JSON.parse(rawContent) // Validate JSON is parseable
      logger.info('CDA data extracted successfully (JSON format)')
      return rawContent
    } catch (jsonError) {
      // If JSON parsing fails, try to convert JavaScript object literal to JSON
      try {
        // Use eval in a safe way to parse JavaScript object literal
        // Create a safe context for evaluation
        const safeEval = (code) => {
          // Remove any potential unsafe code
          if (code.includes('function') || code.includes('=>') || code.includes('eval') || code.includes('require')) {
            throw new Error('Unsafe code detected')
          }

          // Create a function that returns the object
          const func = new Function(`return ${code}`)
          return func()
        }

        const parsedObject = safeEval(rawContent)
        const jsonString = JSON.stringify(parsedObject)

        // Validate that the converted JSON is parseable
        JSON.parse(jsonString)

        logger.info('CDA data extracted successfully (JavaScript object converted to JSON)')
        return jsonString
      } catch (jsError) {
        logger.warn('Failed to parse extracted CDA data', {
          jsonError: jsonError.message,
          jsError: jsError.message,
        })
        return null
      }
    }
  }

  /**
   * Parse CDA JSON string
   * @param {string} cdaJsonString - CDA JSON string
   * @returns {Object} Parsed CDA data
   */
  parseCdaData(cdaJsonString) {
    try {
      return JSON.parse(cdaJsonString)
    } catch (error) {
      throw new Error(`Failed to parse CDA data: ${error.message}`)
    }
  }

  /**
   * Transform CDA data to importStructure format
   * @param {Object} cdaData - Parsed CDA data
   * @param {Object} importService - Import service instance
   * @returns {Object} ImportStructure format
   */
  transformToImportStructure(cdaData, importService) {
    // Create base import structure
    const baseStructure = importService?.createImportStructure() || createImportStructure()

    // Extract components
    const metadata = this.extractMetadata(cdaData)
    const patient = this.createPatient(cdaData)
    const visit = this.createVisit(cdaData, patient.PATIENT_NUM)
    const observations = this.createObservations(cdaData, patient.PATIENT_NUM, visit.ENCOUNTER_NUM)

    // Build final structure
    return {
      ...baseStructure,
      metadata: {
        ...baseStructure.metadata,
        ...metadata,
        format: 'html_survey_cda',
        source: 'surveyBEST CDA',
        patientCount: 1,
        visitCount: 1,
        observationCount: observations.length,
        patientIds: [patient.PATIENT_CD],
      },
      data: {
        patients: [patient],
        visits: [visit],
        observations: observations,
      },
      statistics: {
        patientCount: 1,
        visitCount: 1,
        observationCount: observations.length,
        fetchedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Extract metadata from CDA
   * @param {Object} cdaData - CDA data
   * @returns {Object} Metadata
   */
  extractMetadata(cdaData) {
    const cda = cdaData.cda || {}
    const info = cdaData.info || {}

    return {
      title: info.title || cda.title || 'Imported Survey',
      exportDate: cda.date || new Date().toISOString(),
      author: cda.author?.[0]?.display || 'surveyBEST',
      version: cda.meta?.versionId || '1.0',
    }
  }

  /**
   * Create patient from CDA data
   * @param {Object} cdaData - CDA data
   * @returns {Object} Patient object
   */
  createPatient(cdaData) {
    const cda = cdaData.cda || {}
    const info = cdaData.info || {}

    const patientId = info.PID || cda.subject?.display || 'UNKNOWN'

    return {
      PATIENT_NUM: 1,
      PATIENT_CD: patientId,
      VITAL_STATUS_CD: null,
      BIRTH_DATE: null,
      DEATH_DATE: null,
      AGE_IN_YEARS: null,
      SEX_CD: null,
      LANGUAGE_CD: cda.language || null,
      RACE_CD: null,
      MARITAL_STATUS_CD: null,
      RELIGION_CD: null,
      STATECITYZIP_PATH: null,
      PATIENT_BLOB: null,
      UPDATE_DATE: new Date().toISOString().split('T')[0],
      DOWNLOAD_DATE: null,
      IMPORT_DATE: new Date().toISOString(),
      SOURCESYSTEM_CD: 'SURVEY_BEST',
      UPLOAD_ID: 1,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    }
  }

  /**
   * Create visit from CDA data
   * @param {Object} cdaData - CDA data
   * @param {number} patientNum - Patient number
   * @returns {Object} Visit object
   */
  createVisit(cdaData, patientNum) {
    const cda = cdaData.cda || {}
    const info = cdaData.info || {}

    const startDate = cda.event?.[0]?.period?.start || cda.date
    const endDate = cda.event?.[0]?.period?.end

    return {
      ENCOUNTER_NUM: 1,
      PATIENT_NUM: patientNum,
      ACTIVE_STATUS_CD: 'SCTID: 55561003', // Active
      START_DATE: startDate ? this.parseDate(startDate) : new Date().toISOString().split('T')[0],
      END_DATE: endDate ? this.parseDate(endDate) : null,
      INOUT_CD: 'O', // Outpatient
      LOCATION_CD: 'QUESTIONNAIRE',
      VISIT_BLOB: JSON.stringify({
        visitType: 'questionnaire',
        questionnaireCode: info.label,
        questionnaireTitle: info.title,
      }),
      UPDATE_DATE: null,
      DOWNLOAD_DATE: null,
      IMPORT_DATE: null,
      SOURCESYSTEM_CD: 'SURVEY_BEST',
      UPLOAD_ID: 1,
      CREATED_AT: new Date().toISOString().split('T')[0],
    }
  }

  /**
   * Create observations from CDA data
   * @param {Object} cdaData - CDA data
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @returns {Array} Array of observations
   */
  createObservations(cdaData, patientNum, encounterNum) {
    const observations = []

    // 1. Create main questionnaire observation with ValType='Q'
    const questionnaireObs = this.createQuestionnaireObservation(cdaData, patientNum, encounterNum)
    observations.push(questionnaireObs)

    // 2. Create individual observations from CDA sections (only with proper coding)
    const cda = cdaData.cda || {}
    if (cda.section && Array.isArray(cda.section)) {
      let observationId = 2 // Start after questionnaire observation

      for (const section of cda.section) {
        if (section.entry && Array.isArray(section.entry)) {
          for (const entry of section.entry) {
            const obs = this.createObservationFromEntry(entry, patientNum, encounterNum, observationId, section)
            if (obs) {
              observations.push(obs)
              observationId++
            }
          }
        }
      }
    }

    return observations
  }

  /**
   * Create main questionnaire observation with ValType='Q'
   * @param {Object} cdaData - CDA data
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @returns {Object} Questionnaire observation
   */
  createQuestionnaireObservation(cdaData, patientNum, encounterNum) {
    const cda = cdaData.cda || {}
    const info = cdaData.info || {}

    // Transform CDA structure to simple JSON format
    const simpleQuestionnaire = this.transformCdaToSimpleJson(cda, info)

    const questionnaireTitle = simpleQuestionnaire.title

    return {
      OBSERVATION_ID: 1,
      ENCOUNTER_NUM: encounterNum,
      PATIENT_NUM: patientNum,
      CATEGORY_CHAR: 'SURVEY_BEST',
      CONCEPT_CD: 'CUSTOM: QUESTIONNAIRE',
      PROVIDER_ID: '@',
      START_DATE: cda.date ? this.parseDate(cda.date) + 'T00:00:00.000Z' : new Date().toISOString(),
      INSTANCE_NUM: 1,
      VALTYPE_CD: 'Q', // Questionnaire type as requested
      TVAL_CHAR: questionnaireTitle, // Title of questionnaire as requested
      NVAL_NUM: null,
      VALUEFLAG_CD: null,
      QUANTITY_NUM: null,
      UNIT_CD: null,
      END_DATE: cda.event?.[0]?.period?.end ? this.parseDate(cda.event[0].period.end) + 'T00:00:00.000Z' : null,
      LOCATION_CD: 'QUESTIONNAIRE',
      CONFIDENCE_NUM: null,
      OBSERVATION_BLOB: JSON.stringify(simpleQuestionnaire), // Store transformed simple JSON structure
      UPDATE_DATE: new Date().toISOString().split('T')[0],
      DOWNLOAD_DATE: null,
      IMPORT_DATE: new Date().toISOString().split('T')[0],
      SOURCESYSTEM_CD: 'SURVEY_SYSTEM',
      UPLOAD_ID: null,
      CREATED_AT: new Date().toISOString().split('T')[0],
    }
  }

  /**
   * Transform CDA structure to simple JSON questionnaire format
   * @param {Object} cda - CDA data
   * @param {Object} info - Additional info
   * @returns {Object} Simple JSON questionnaire structure
   */
  transformCdaToSimpleJson(cda, info) {
    const items = []
    const results = []

    // Extract items from CDA sections
    cda.section?.forEach((section) => {
      if (section.entry && Array.isArray(section.entry)) {
        section.entry.forEach((entry) => {
          // Create item from CDA entry
          const item = {
            id: items.length + 1,
            label: entry.title || 'Unknown Question',
            type: typeof entry.value === 'number' ? 'number' : 'text',
            value: entry.value,
            coding: entry.code?.[0]?.coding?.[0] || null,
          }
          items.push(item)
        })
      }
    })

    // Extract results from Results Section
    const resultsSection = cda.section?.find((s) => s.title?.toLowerCase().includes('result'))
    if (resultsSection?.entry) {
      resultsSection.entry.forEach((entry) => {
        results.push({
          label: entry.title || 'Result',
          value: entry.value,
          coding: entry.code?.[0]?.coding?.[0] || null,
        })
      })
    }

    // Transform to simple JSON structure
    return {
      title: info.title || cda.title || 'Imported Questionnaire',
      short_title: info.label || null,
      questionnaire_code: info.label || 'imported_questionnaire',
      date_start: cda.event?.[0]?.period?.start ? this.parseDate(cda.event[0].period.start) : null,
      date_end: cda.event?.[0]?.period?.end ? this.parseDate(cda.event[0].period.end) : null,
      items: items,
      results: results.length > 0 ? results : null,
      coding: {
        system: 'LOINC', // Default to LOINC
        code: '72133-2', // Default MoCA code, can be overridden
        display: info.title || cda.title || 'Imported Questionnaire',
      },
    }
  }

  /**
   * Create observation from CDA entry (only if it has proper coding)
   * @param {Object} entry - CDA entry
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @param {number} observationId - Observation ID
   * @param {Object} section - Parent section
   * @returns {Object|null} Observation or null if no proper coding
   */
  createObservationFromEntry(entry, patientNum, encounterNum, observationId, section) {
    // Only create observations for entries with proper coding (code and system)
    if (!entry.code || !Array.isArray(entry.code) || entry.code.length === 0) {
      return null
    }

    const coding = entry.code[0]?.coding?.[0]
    if (!coding || !coding.code || !coding.system) {
      return null // Skip entries without proper coding as requested
    }

    // Skip entries with null/empty codes
    if (coding.code === null || coding.code === '' || coding.code === undefined) {
      return null
    }

    // Determine value type and value
    let valtypeCd = 'T'
    let tvalChar = null
    let nvalNum = null

    if (typeof entry.value === 'number') {
      valtypeCd = 'N'
      nvalNum = entry.value
      // For numeric values, TVAL_CHAR should be null
      tvalChar = null
    } else if (typeof entry.value === 'string') {
      valtypeCd = 'T'
      tvalChar = entry.value
    } else if (entry.value !== undefined && entry.value !== null) {
      valtypeCd = 'T'
      tvalChar = String(entry.value)
    } else {
      // For entries without values, use the display name for TVAL_CHAR
      tvalChar = coding.display || entry.title || 'Unknown'
    }

    // Format concept code properly
    let conceptCode = coding.code
    if (coding.system === 'http://snomed.info/sct' && !conceptCode.startsWith('SCTID:')) {
      conceptCode = `SCTID: ${coding.code}`
    } else if (coding.system === 'CUSTOM' && !conceptCode.startsWith('CUSTOM:')) {
      conceptCode = `CUSTOM: ${coding.code}`
    }

    return {
      OBSERVATION_ID: observationId,
      ENCOUNTER_NUM: encounterNum,
      PATIENT_NUM: patientNum,
      CATEGORY_CHAR: section.title === 'Results Section' ? 'SURVEY_RESULT' : 'SURVEY_ITEM',
      CONCEPT_CD: conceptCode,
      PROVIDER_ID: 'SYSTEM',
      START_DATE: new Date().toISOString(),
      INSTANCE_NUM: 1,
      VALTYPE_CD: valtypeCd,
      TVAL_CHAR: tvalChar,
      NVAL_NUM: nvalNum,
      VALUEFLAG_CD: null,
      QUANTITY_NUM: null,
      UNIT_CD: null,
      END_DATE: null,
      LOCATION_CD: 'QUESTIONNAIRE',
      CONFIDENCE_NUM: null,
      OBSERVATION_BLOB: JSON.stringify({
        questionnaireItem: {
          title: entry.title,
          value: entry.value,
          coding: coding,
          section: section.title,
        },
      }),
      UPDATE_DATE: null,
      DOWNLOAD_DATE: null,
      IMPORT_DATE: null,
      SOURCESYSTEM_CD: coding.system === 'http://snomed.info/sct' ? 'SNOMED_CT' : 'SURVEY_BEST',
      UPLOAD_ID: 1,
      CREATED_AT: new Date().toISOString().split('T')[0],
    }
  }

  /**
   * Parse date string handling various formats
   * @param {string|number} dateValue - Date value to parse
   * @returns {string} ISO date string (YYYY-MM-DD)
   */
  parseDate(dateValue) {
    if (!dateValue) {
      return new Date().toISOString().split('T')[0]
    }

    try {
      // Handle timestamp numbers
      if (typeof dateValue === 'number') {
        return new Date(dateValue).toISOString().split('T')[0]
      }

      // Handle string dates with GMT+XXXX format
      let dateString = String(dateValue)
      if (dateString.includes('GMT')) {
        // Convert "2025-09-01T10:26:49GMT+0200" to "2025-09-01T10:26:49+02:00"
        // Also handle "2025-09-02T2:27:26GMT+0200" (single digit hour)
        dateString = dateString.replace(/GMT([+-]\d{4})/, (match, offset) => {
          return offset.slice(0, 3) + ':' + offset.slice(3)
        })

        // Fix single digit hours: "T2:" -> "T02:"
        dateString = dateString.replace(/T(\d):/, 'T0$1:')
      }

      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        logger.warn('Invalid date format, using current date', { originalDate: dateValue })
        return new Date().toISOString().split('T')[0]
      }

      return date.toISOString().split('T')[0]
    } catch (error) {
      logger.warn('Date parsing failed, using current date', { originalDate: dateValue, error: error.message })
      return new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Create error result
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Array} additionalErrors - Additional errors
   * @returns {Object} Error result
   */
  createErrorResult(code, message, additionalErrors = []) {
    return {
      success: false,
      data: null,
      errors: [{ code, message }, ...additionalErrors],
      warnings: [],
    }
  }
}
