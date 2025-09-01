/**
 * Base Import Service
 *
 * Provides common functionality for all import services including:
 * - Standardized import result structure
 * - Common validation methods
 * - Error handling and reporting
 * - Metadata extraction
 * - Data structure normalization
 */

export class BaseImportService {
  constructor(conceptRepository, cqlRepository) {
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository
  }

  /**
   * Standard import result structure
   * @typedef {Object} ImportResult
   * @property {boolean} success - Whether import was successful
   * @property {Object} data - Imported clinical data
   * @property {Object} metadata - Import metadata
   * @property {Array} errors - Import errors
   * @property {Array} warnings - Import warnings
   */

  /**
   * Create standardized import result
   * @param {boolean} success - Success status
   * @param {Object} data - Clinical data
   * @param {Object} metadata - Import metadata
   * @param {Array} errors - Error list
   * @param {Array} warnings - Warning list
   * @returns {ImportResult} Standardized result
   */
  createImportResult(success = false, data = null, metadata = {}, errors = [], warnings = []) {
    return {
      success,
      data,
      metadata: {
        importDate: new Date().toISOString(),
        service: this.constructor.name,
        ...metadata,
      },
      errors: Array.isArray(errors) ? errors : [],
      warnings: Array.isArray(warnings) ? warnings : [],
    }
  }

  /**
   * Create standardized error object
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @returns {Object} Standardized error
   */
  createError(code, message, details = {}) {
    return {
      code,
      message,
      timestamp: new Date().toISOString(),
      ...details,
    }
  }

  /**
   * Create standardized warning object
   * @param {string} code - Warning code
   * @param {string} message - Warning message
   * @param {Object} details - Additional warning details
   * @returns {Object} Standardized warning
   */
  createWarning(code, message, details = {}) {
    return {
      code,
      message,
      timestamp: new Date().toISOString(),
      ...details,
    }
  }

  /**
   * Validate required fields in data object
   * @param {Object} data - Data to validate
   * @param {Array} requiredFields - List of required field names
   * @param {string} context - Context for error messages
   * @returns {Array} Validation errors
   */
  validateRequiredFields(data, requiredFields, context = '') {
    const errors = []

    requiredFields.forEach((field) => {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        errors.push(this.createError('MISSING_REQUIRED_FIELD', `Required field '${field}' is missing or empty${context ? ` in ${context}` : ''}`, { field, context }))
      }
    })

    return errors
  }

  /**
   * Normalize patient data structure
   * @param {Object} patientData - Raw patient data
   * @returns {Object} Normalized patient object
   */
  normalizePatient(patientData) {
    return {
      PATIENT_NUM: patientData.PATIENT_NUM || this.generateId(),
      PATIENT_CD: patientData.PATIENT_CD || patientData.patientId || 'UNKNOWN',
      SEX_CD: this.normalizeSexCode(patientData.SEX_CD || patientData.sex || patientData.gender),
      AGE_IN_YEARS: this.parseNumericValue(patientData.AGE_IN_YEARS || patientData.age),
      BIRTH_DATE: this.normalizeDate(patientData.BIRTH_DATE || patientData.birthDate),
      // Add other standard patient fields
      IMPORT_SOURCE: this.constructor.name,
      IMPORT_DATE: new Date().toISOString(),
    }
  }

  /**
   * Normalize visit data structure
   * @param {Object} visitData - Raw visit data
   * @param {number} patientNum - Patient number
   * @returns {Object} Normalized visit object
   */
  normalizeVisit(visitData, patientNum) {
    return {
      ENCOUNTER_NUM: visitData.ENCOUNTER_NUM || this.generateId(),
      PATIENT_NUM: patientNum,
      START_DATE: this.normalizeDate(visitData.START_DATE || visitData.startDate || visitData.visitDate),
      LOCATION_CD: visitData.LOCATION_CD || visitData.location,
      INOUT_CD: this.normalizeInOutCode(visitData.INOUT_CD || visitData.inOut),
      // Add other standard visit fields
      IMPORT_SOURCE: this.constructor.name,
      IMPORT_DATE: new Date().toISOString(),
    }
  }

  /**
   * Normalize observation data structure
   * @param {Object} observationData - Raw observation data
   * @param {number} encounterNum - Encounter number (null for patient-level)
   * @returns {Object} Normalized observation object
   */
  normalizeObservation(observationData, encounterNum = null) {
    const conceptCd = observationData.CONCEPT_CD || observationData.conceptCode
    const value = observationData.VALUE || observationData.value
    const valtypeCd = observationData.VALTYPE_CD || this.determineValtypeCd(value)

    const observation = {
      ENCOUNTER_NUM: encounterNum,
      CONCEPT_CD: conceptCd,
      VALTYPE_CD: valtypeCd,
      START_DATE: this.normalizeDate(observationData.START_DATE || observationData.startDate) || new Date().toISOString().split('T')[0],
      IMPORT_SOURCE: this.constructor.name,
      IMPORT_DATE: new Date().toISOString(),
    }

    // Set appropriate value field based on VALTYPE_CD
    switch (valtypeCd) {
      case 'N':
        observation.NVAL_NUM = this.parseNumericValue(value)
        break
      case 'T':
        observation.TVAL_CHAR = value != null ? String(value) : null
        break
      case 'D':
        observation.TVAL_CHAR = this.normalizeDate(value) || (value != null ? String(value) : null)
        break
      case 'B':
        observation.BVAL_BLOB = value != null ? String(value) : null
        break
      default:
        observation.TVAL_CHAR = value != null ? String(value) : null
    }

    return observation
  }

  /**
   * Normalize sex code to standard format
   * @param {string} sexValue - Raw sex/gender value
   * @returns {string} Normalized sex code
   */
  normalizeSexCode(sexValue) {
    if (!sexValue) return null

    const value = String(sexValue).toLowerCase().trim()

    // Map common variations to standard codes
    if (['m', 'male', 'man', '1'].includes(value)) return 'M'
    if (['f', 'female', 'woman', '2'].includes(value)) return 'F'
    if (['u', 'unknown', 'other', '3'].includes(value)) return 'U'

    return sexValue // Return original if no mapping found
  }

  /**
   * Normalize in/out code for visits
   * @param {string} inOutValue - Raw in/out value
   * @returns {string} Normalized in/out code
   */
  normalizeInOutCode(inOutValue) {
    if (!inOutValue) return null

    const value = String(inOutValue).toLowerCase().trim()

    // Map common variations
    if (['i', 'inpatient', 'in', '1'].includes(value)) return 'I'
    if (['o', 'outpatient', 'out', '2'].includes(value)) return 'O'
    if (['e', 'emergency', 'er', '3'].includes(value)) return 'E'

    return inOutValue // Return original if no mapping found
  }

  /**
   * Parse numeric value safely
   * @param {any} value - Value to parse
   * @returns {number|null} Parsed number or null
   */
  parseNumericValue(value) {
    if (value === null || value === undefined || value === '') return null

    const num = parseFloat(value)
    return isNaN(num) ? null : num
  }

  /**
   * Normalize date value to YYYY-MM-DD format
   * @param {string} dateValue - Raw date value
   * @returns {string|null} Normalized date or null
   */
  normalizeDate(dateValue) {
    if (!dateValue) return null

    try {
      // Try to parse various date formats
      const date = new Date(dateValue)

      if (isNaN(date.getTime())) {
        return null // Invalid date
      }

      // Return in YYYY-MM-DD format
      return date.toISOString().split('T')[0]
    } catch {
      return null
    }
  }

  /**
   * Determine VALTYPE_CD based on value content
   * @param {any} value - Value to analyze
   * @returns {string} VALTYPE_CD
   */
  determineValtypeCd(value) {
    if (value === null || value === undefined) return 'T'

    const strValue = String(value).trim()

    if (strValue === '') return 'T'

    // Try to parse as number
    if (!isNaN(strValue) && !isNaN(parseFloat(strValue))) {
      return 'N' // Numeric
    }

    // Check for date patterns
    if (this.isDateLike(strValue)) {
      return 'D' // Date
    }

    // Check for JSON/BLOB content
    if (this.isJsonLike(strValue)) {
      return 'B' // BLOB
    }

    return 'T' // Default to Text
  }

  /**
   * Check if value appears to be date-like
   * @param {string} value - Value to check
   * @returns {boolean} True if appears to be a date
   */
  isDateLike(value) {
    if (!value) return false

    // Common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    ]

    return datePatterns.some((pattern) => pattern.test(value))
  }

  /**
   * Check if value appears to be JSON-like
   * @param {string} value - Value to check
   * @returns {boolean} True if appears to be JSON
   */
  isJsonLike(value) {
    if (!value) return false

    const str = String(value).trim()

    // Check for JSON object/array patterns
    return (str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))
  }

  /**
   * Generate a unique ID for import data
   * @returns {number} Unique numeric ID
   */
  generateId() {
    return Date.now() + Math.floor(Math.random() * 1000000)
  }

  /**
   * Extract metadata from various sources
   * @param {Object} source - Source object to extract metadata from
   * @returns {Object} Extracted metadata
   */
  extractMetadata(source) {
    const metadata = {
      source: source.source || 'Unknown',
      version: source.version || '1.0',
      description: source.description || '',
      extractedAt: new Date().toISOString(),
    }

    // Extract from common metadata fields
    const metaSource = source.meta || source.metadata || {}
    if (metaSource) {
      metadata.source = metaSource.source || metadata.source
      metadata.version = metaSource.version || metaSource.versionId || metadata.version
      metadata.lastUpdated = metaSource.lastUpdated
      metadata.description = metaSource.description || metadata.description
    }

    // Extract from comments if present
    if (source.comments && Array.isArray(source.comments)) {
      source.comments.forEach((comment) => {
        if (comment.includes('Export Date:')) {
          metadata.exportDate = comment.split(':')[1]?.trim()
        }
        if (comment.includes('Source:')) {
          metadata.source = comment.split(':')[1]?.trim()
        }
      })
    }

    return metadata
  }

  /**
   * Validate clinical data structure
   * @param {Object} data - Clinical data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  validateClinicalData(data) {
    const errors = []
    const warnings = []

    // Validate patients
    if (!data.patients || !Array.isArray(data.patients)) {
      errors.push(this.createError('INVALID_DATA_STRUCTURE', 'Patients data must be an array'))
    } else {
      data.patients.forEach((patient, index) => {
        const patientErrors = this.validateRequiredFields(patient, ['PATIENT_CD'], `patient ${index + 1}`)
        errors.push(...patientErrors)
      })
    }

    // Validate visits
    if (data.visits && Array.isArray(data.visits)) {
      data.visits.forEach((visit, index) => {
        if (!visit.PATIENT_NUM) {
          errors.push(this.createError('INVALID_VISIT', `Visit ${index + 1} is missing PATIENT_NUM`, { visitIndex: index }))
        }
      })
    }

    // Validate observations
    if (data.observations && Array.isArray(data.observations)) {
      data.observations.forEach((obs, index) => {
        const obsErrors = this.validateRequiredFields(obs, ['CONCEPT_CD'], `observation ${index + 1}`)
        errors.push(...obsErrors)
      })
    }

    return { errors, warnings }
  }

  /**
   * Handle import errors consistently
   * @param {Error} error - Original error
   * @param {string} context - Context where error occurred
   * @returns {ImportResult} Error result
   */
  handleImportError(error, context = '') {
    console.error(`Import error in ${this.constructor.name}${context}:`, error)

    return this.createImportResult(false, null, { context }, [
      this.createError('IMPORT_ERROR', `Import failed: ${error.message}`, {
        context,
        stack: error.stack,
        originalError: error.name,
      }),
    ])
  }
}
