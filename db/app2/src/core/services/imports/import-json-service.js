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
import { parseSimpleJson } from '@dbbest/clinical-schema'
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

    // Transform data sections via shared clinical-schema parser
    const records = parseSimpleJson(jsonData)
    importStructure.data.patients = records.patients
    importStructure.data.visits = records.visits
    importStructure.data.observations = records.observations

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

}
