/**
 * JSON Import Service
 *
 * Handles import of clinical data from JSON files with support for:
 * - Structured clinical data matching 02_json.json format
 * - Metadata extraction from JSON structure
 * - Data transformation to importStructure format
 * - Proper handling of questionnaire observations with ValType='Q'
 */

import { createImportStructure } from './import-structure.js'
import { logger } from '../logging-service.js'

export class ImportJsonService {
  constructor(conceptRepository, cqlRepository) {
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository
  }

  /**
   * Import JSON data from file content
   * @param {string} jsonContent - Raw JSON file content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Import result with success/data/errors
   */
  async importFromJson(jsonContent, filename) {
    try {
      logger.info('Starting JSON import', { contentLength: jsonContent.length })

      // Parse JSON content
      const jsonData = this.parseJsonContent(jsonContent)

      // Validate JSON structure
      const validationResult = this.validateJsonStructure(jsonData)
      if (!validationResult.isValid) {
        return {
          success: false,
          data: null,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }
      }

      // Transform to importStructure format
      const importStructure = this.transformToImportStructure(jsonData, filename)

      logger.info('JSON import completed successfully', {
        patients: importStructure.data.patients.length,
        visits: importStructure.data.visits.length,
        observations: importStructure.data.observations.length,
      })

      return {
        success: true,
        data: importStructure,
        errors: [],
        warnings: validationResult.warnings,
      }
    } catch (error) {
      logger.error('JSON import failed', { error: error.message })
      return {
        success: false,
        data: null,
        errors: [{ code: 'JSON_IMPORT_ERROR', message: error.message }],
        warnings: [],
      }
    }
  }

  /**
   * Parse JSON content safely
   * @param {string} jsonContent - Raw JSON content
   * @returns {Object} Parsed JSON object
   */
  parseJsonContent(jsonContent) {
    try {
      // Clean the content (remove BOM if present)
      const cleanContent = jsonContent.replace(/^\uFEFF/, '')
      return JSON.parse(cleanContent)
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`)
    }
  }

  /**
   * Validate JSON structure against expected format
   * @param {Object} jsonData - Parsed JSON data
   * @returns {Object} Validation result
   */
  validateJsonStructure(jsonData) {
    const errors = []
    const warnings = []

    // Check if it's an object
    if (!jsonData || typeof jsonData !== 'object') {
      errors.push({ code: 'INVALID_JSON_STRUCTURE', message: 'JSON data must be a valid object' })
      return { isValid: false, errors, warnings }
    }

    // Check for required sections (metadata, data, statistics)
    if (!jsonData.metadata) {
      warnings.push({ code: 'MISSING_METADATA', message: 'JSON missing metadata section' })
    }

    if (!jsonData.data) {
      errors.push({ code: 'MISSING_DATA', message: 'JSON must contain data section' })
      return { isValid: false, errors, warnings }
    }

    // Validate data structure
    const data = jsonData.data
    if (!data.patients && !data.visits && !data.observations) {
      errors.push({ code: 'MISSING_CLINICAL_DATA', message: 'Data section must contain at least one of: patients, visits, or observations' })
      return { isValid: false, errors, warnings }
    }

    // Validate patients array
    if (data.patients && !Array.isArray(data.patients)) {
      errors.push({ code: 'INVALID_PATIENTS_FORMAT', message: 'Patients must be an array' })
    }

    // Validate visits array
    if (data.visits && !Array.isArray(data.visits)) {
      errors.push({ code: 'INVALID_VISITS_FORMAT', message: 'Visits must be an array' })
    }

    // Validate observations array
    if (data.observations && !Array.isArray(data.observations)) {
      errors.push({ code: 'INVALID_OBSERVATIONS_FORMAT', message: 'Observations must be an array' })
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Transform JSON data to importStructure format
   * @param {Object} jsonData - Parsed JSON data
   * @param {string} filename - Original filename
   * @returns {Object} ImportStructure format
   */
  transformToImportStructure(jsonData, filename) {
    // Create base import structure
    const importStructure = createImportStructure({
      metadata: {
        title: jsonData.metadata?.title || 'JSON Import',
        format: 'json_import',
        source: jsonData.metadata?.source || 'JSON File',
        version: jsonData.metadata?.version || '1.0',
        author: jsonData.metadata?.author || 'JSON Import Service',
        exportDate: jsonData.metadata?.exportDate || new Date().toISOString(),
        filename: filename,
      },
      exportInfo: {
        format: 'json',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        source: 'JSON Import Service',
      },
    })

    // Transform data sections
    const data = jsonData.data || {}

    // Process patients
    if (data.patients && Array.isArray(data.patients)) {
      importStructure.data.patients = data.patients.map((patient) => this.transformPatient(patient))
    }

    // Process visits
    if (data.visits && Array.isArray(data.visits)) {
      importStructure.data.visits = data.visits.map((visit) => this.transformVisit(visit))
    }

    // Process observations
    if (data.observations && Array.isArray(data.observations)) {
      importStructure.data.observations = data.observations.map((obs) => this.transformObservation(obs))
    }

    // Update statistics
    importStructure.statistics.patientCount = importStructure.data.patients.length
    importStructure.statistics.visitCount = importStructure.data.visits.length
    importStructure.statistics.observationCount = importStructure.data.observations.length
    importStructure.statistics.fetchedAt = new Date().toISOString()

    // Update metadata with counts
    importStructure.metadata.patientCount = importStructure.data.patients.length
    importStructure.metadata.visitCount = importStructure.data.visits.length
    importStructure.metadata.observationCount = importStructure.data.observations.length
    importStructure.metadata.patientIds = importStructure.data.patients.map((p) => p.PATIENT_CD || p.id)

    return importStructure
  }

  /**
   * Transform patient data
   * @param {Object} patientData - Patient data from JSON
   * @returns {Object} Transformed patient
   */
  transformPatient(patientData) {
    return {
      PATIENT_NUM: patientData.PATIENT_NUM || patientData.id || null,
      PATIENT_CD: patientData.PATIENT_CD || patientData.patientId || patientData.patient_cd || null,
      VITAL_STATUS_CD: patientData.VITAL_STATUS_CD || null,
      BIRTH_DATE: patientData.BIRTH_DATE || patientData.birthDate || patientData.dob || null,
      DEATH_DATE: patientData.DEATH_DATE || patientData.deathDate || null,
      AGE_IN_YEARS: patientData.AGE_IN_YEARS || patientData.age || null,
      SEX_CD: patientData.SEX_CD || patientData.sex || patientData.gender || null,
      LANGUAGE_CD: patientData.LANGUAGE_CD || patientData.language || null,
      RACE_CD: patientData.RACE_CD || patientData.race || null,
      MARITAL_STATUS_CD: patientData.MARITAL_STATUS_CD || patientData.maritalStatus || null,
      RELIGION_CD: patientData.RELIGION_CD || patientData.religion || null,
      STATECITYZIP_PATH: patientData.STATECITYZIP_PATH || patientData.address || null,
      PATIENT_BLOB: patientData.PATIENT_BLOB || null,
      UPDATE_DATE: patientData.UPDATE_DATE || new Date().toISOString().split('T')[0],
      DOWNLOAD_DATE: patientData.DOWNLOAD_DATE || null,
      IMPORT_DATE: patientData.IMPORT_DATE || new Date().toISOString(),
      SOURCESYSTEM_CD: patientData.SOURCESYSTEM_CD || patientData.sourceSystem || 'JSON_IMPORT',
      UPLOAD_ID: patientData.UPLOAD_ID || 1,
      CREATED_AT: patientData.CREATED_AT || new Date().toISOString(),
      UPDATED_AT: patientData.UPDATED_AT || new Date().toISOString(),
    }
  }

  /**
   * Transform visit data
   * @param {Object} visitData - Visit data from JSON
   * @returns {Object} Transformed visit
   */
  transformVisit(visitData) {
    return {
      ENCOUNTER_NUM: visitData.ENCOUNTER_NUM || visitData.id || null,
      PATIENT_NUM: visitData.PATIENT_NUM || visitData.patientId || null,
      ACTIVE_STATUS_CD: visitData.ACTIVE_STATUS_CD || 'SCTID: 55561003', // Default to active
      START_DATE: visitData.START_DATE || visitData.startDate || visitData.visitDate || null,
      END_DATE: visitData.END_DATE || visitData.endDate || null,
      INOUT_CD: visitData.INOUT_CD || visitData.inOut || visitData.visitType || 'O',
      LOCATION_CD: visitData.LOCATION_CD || visitData.location || null,
      VISIT_BLOB: visitData.VISIT_BLOB || null,
      UPDATE_DATE: visitData.UPDATE_DATE || null,
      DOWNLOAD_DATE: visitData.DOWNLOAD_DATE || null,
      IMPORT_DATE: visitData.IMPORT_DATE || null,
      SOURCESYSTEM_CD: visitData.SOURCESYSTEM_CD || visitData.sourceSystem || 'JSON_IMPORT',
      UPLOAD_ID: visitData.UPLOAD_ID || 1,
      CREATED_AT: visitData.CREATED_AT || new Date().toISOString().split('T')[0],
    }
  }

  /**
   * Transform observation data
   * @param {Object} obsData - Observation data from JSON
   * @returns {Object} Transformed observation
   */
  transformObservation(obsData) {
    // Handle questionnaire observations specially
    if (obsData.VALTYPE_CD === 'Q' || obsData.valtypeCd === 'Q') {
      return this.transformQuestionnaireObservation(obsData)
    }

    // Handle regular observations
    return {
      OBSERVATION_ID: obsData.OBSERVATION_ID || obsData.id || null,
      ENCOUNTER_NUM: obsData.ENCOUNTER_NUM || obsData.encounterId || obsData.visitId || null,
      PATIENT_NUM: obsData.PATIENT_NUM || obsData.patientId || null,
      CATEGORY_CHAR: obsData.CATEGORY_CHAR || obsData.category || null,
      CONCEPT_CD: obsData.CONCEPT_CD || obsData.conceptCode || obsData.concept_cd || null,
      PROVIDER_ID: obsData.PROVIDER_ID || obsData.providerId || '@',
      START_DATE: obsData.START_DATE || obsData.startDate || obsData.observationDate || new Date().toISOString(),
      INSTANCE_NUM: obsData.INSTANCE_NUM || obsData.instanceNum || 1,
      VALTYPE_CD: obsData.VALTYPE_CD || obsData.valtypeCd || obsData.valueType || 'T',
      TVAL_CHAR: obsData.TVAL_CHAR || obsData.textValue || obsData.value || null,
      NVAL_NUM: obsData.NVAL_NUM || obsData.numericValue || (typeof obsData.value === 'number' ? obsData.value : null),
      VALUEFLAG_CD: obsData.VALUEFLAG_CD || obsData.valueFlag || null,
      QUANTITY_NUM: obsData.QUANTITY_NUM || obsData.quantity || null,
      UNIT_CD: obsData.UNIT_CD || obsData.unit || null,
      END_DATE: obsData.END_DATE || obsData.endDate || null,
      LOCATION_CD: obsData.LOCATION_CD || obsData.location || null,
      CONFIDENCE_NUM: obsData.CONFIDENCE_NUM || obsData.confidence || null,
      OBSERVATION_BLOB: obsData.OBSERVATION_BLOB || obsData.blob || null,
      UPDATE_DATE: obsData.UPDATE_DATE || null,
      DOWNLOAD_DATE: obsData.DOWNLOAD_DATE || null,
      IMPORT_DATE: obsData.IMPORT_DATE || null,
      SOURCESYSTEM_CD: obsData.SOURCESYSTEM_CD || obsData.sourceSystem || 'JSON_IMPORT',
      UPLOAD_ID: obsData.UPLOAD_ID || 1,
      CREATED_AT: obsData.CREATED_AT || new Date().toISOString().split('T')[0],
    }
  }

  /**
   * Transform questionnaire observation (ValType='Q')
   * @param {Object} obsData - Questionnaire observation data
   * @returns {Object} Transformed questionnaire observation
   */
  transformQuestionnaireObservation(obsData) {
    // Extract questionnaire title from TVAL_CHAR or OBSERVATION_BLOB
    let questionnaireTitle = obsData.TVAL_CHAR || obsData.textValue || 'Unknown Questionnaire'

    // Try to extract title from OBSERVATION_BLOB if it's JSON
    if (obsData.OBSERVATION_BLOB) {
      try {
        const blob = typeof obsData.OBSERVATION_BLOB === 'string' ? JSON.parse(obsData.OBSERVATION_BLOB) : obsData.OBSERVATION_BLOB

        if (blob.title) {
          questionnaireTitle = blob.title
        } else if (blob.label) {
          questionnaireTitle = blob.label
        } else if (blob.questionnaireReference?.questionnaireCode) {
          questionnaireTitle = blob.questionnaireReference.questionnaireCode
        }
      } catch (error) {
        // If parsing fails, use the original TVAL_CHAR
        logger.warn('Failed to parse OBSERVATION_BLOB for questionnaire title', { error: error.message })
      }
    }

    return {
      OBSERVATION_ID: obsData.OBSERVATION_ID || obsData.id || null,
      ENCOUNTER_NUM: obsData.ENCOUNTER_NUM || obsData.encounterId || obsData.visitId || null,
      PATIENT_NUM: obsData.PATIENT_NUM || obsData.patientId || null,
      CATEGORY_CHAR: obsData.CATEGORY_CHAR || obsData.category || 'SURVEY_BEST',
      CONCEPT_CD: obsData.CONCEPT_CD || obsData.conceptCode || 'CUSTOM: QUESTIONNAIRE',
      PROVIDER_ID: obsData.PROVIDER_ID || obsData.providerId || '@',
      START_DATE: obsData.START_DATE || obsData.startDate || obsData.observationDate || new Date().toISOString(),
      INSTANCE_NUM: obsData.INSTANCE_NUM || obsData.instanceNum || 1,
      VALTYPE_CD: 'Q', // Always 'Q' for questionnaire observations
      TVAL_CHAR: questionnaireTitle, // Questionnaire title
      NVAL_NUM: null, // Questionnaires don't have numeric values
      VALUEFLAG_CD: null,
      QUANTITY_NUM: null,
      UNIT_CD: null,
      END_DATE: obsData.END_DATE || obsData.endDate || null,
      LOCATION_CD: obsData.LOCATION_CD || obsData.location || null,
      CONFIDENCE_NUM: null,
      OBSERVATION_BLOB: obsData.OBSERVATION_BLOB || obsData.blob || null, // Store full questionnaire data
      UPDATE_DATE: obsData.UPDATE_DATE || new Date().toISOString().split('T')[0],
      DOWNLOAD_DATE: obsData.DOWNLOAD_DATE || null,
      IMPORT_DATE: obsData.IMPORT_DATE || new Date().toISOString().split('T')[0],
      SOURCESYSTEM_CD: obsData.SOURCESYSTEM_CD || obsData.sourceSystem || 'SURVEY_SYSTEM',
      UPLOAD_ID: obsData.UPLOAD_ID || null,
      CREATED_AT: obsData.CREATED_AT || new Date().toISOString().split('T')[0],
    }
  }
}
