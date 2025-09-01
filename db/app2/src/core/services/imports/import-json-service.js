/**
 * JSON Import Service
 *
 * Handles import of clinical data from JSON files with support for:
 * - Structured clinical data with nested objects
 * - Metadata extraction from JSON structure
 * - Schema validation
 * - Data transformation and normalization
 */

import { BaseImportService } from './base-import-service.js'

export class ImportJsonService extends BaseImportService {
  constructor(conceptRepository, cqlRepository) {
    super(conceptRepository, cqlRepository)

    // JSON schema patterns
    this.schemas = {
      clinicalData: {
        patients: 'array',
        visits: 'array',
        observations: 'array',
        metadata: 'object',
      },
    }
  }

  /**
   * Import JSON data from file content
   * @param {string} jsonContent - Raw JSON file content
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result with success/data/errors
   */
  async importFromJson(jsonContent, options = {}) {
    try {
      // Parse JSON content
      const jsonData = this.parseJsonContent(jsonContent)

      // Validate JSON structure
      const validationResult = this.validateJsonStructure(jsonData)

      if (!validationResult.isValid) {
        return this.createImportResult(false, null, { contentType: 'json', parsed: true }, validationResult.errors, validationResult.warnings)
      }

      // Transform to clinical objects
      const clinicalData = this.transformJsonToClinical(jsonData, options)

      // Validate clinical data structure
      const clinicalValidation = this.validateClinicalData(clinicalData)

      const metadata = {
        ...this.extractMetadata(jsonData),
        patients: clinicalData.patients.length,
        visits: clinicalData.visits.length,
        observations: clinicalData.observations.length,
        format: 'Structured JSON',
      }

      return this.createImportResult(clinicalValidation.errors.length === 0, clinicalData, metadata, clinicalValidation.errors, clinicalValidation.warnings)
    } catch (error) {
      return this.handleImportError(error, 'JSON processing')
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
   * Validate JSON structure against expected schema
   * @param {Object} jsonData - Parsed JSON data
   * @returns {Object} Validation result
   */
  validateJsonStructure(jsonData) {
    const errors = []
    const warnings = []

    // Check if it's an object
    if (!jsonData || typeof jsonData !== 'object') {
      errors.push(this.createError('INVALID_JSON_STRUCTURE', 'JSON data must be a valid object'))
      return { isValid: false, errors, warnings }
    }

    // Handle nested data structure
    const clinicalData = jsonData.data || jsonData.cda || jsonData

    // Check for expected clinical data sections
    const expectedSections = ['patients', 'visits', 'observations']
    const hasClinicalData = expectedSections.some((section) => clinicalData[section])

    // Only require clinical data if the JSON has some structure but no clinical sections
    // Empty JSON {} or metadata-only JSON should be valid (success with empty data)
    if (!hasClinicalData && Object.keys(jsonData).length > 1) {
      errors.push(this.createError('MISSING_CLINICAL_DATA', 'JSON must contain at least one of: patients, visits, or observations'))
    }

    // Validate patients section
    if (clinicalData.patients) {
      if (!Array.isArray(clinicalData.patients)) {
        errors.push(this.createError('INVALID_PATIENTS_FORMAT', 'Patients section must be an array'))
      } else {
        clinicalData.patients.forEach((patient, index) => {
          if (!patient.PATIENT_CD && !patient.patientId) {
            errors.push(this.createError('MISSING_PATIENT_ID', `Patient ${index + 1} is missing PATIENT_CD or patientId`, { patientIndex: index }))
          }
        })
      }
    }

    // Validate visits section
    if (clinicalData.visits) {
      if (!Array.isArray(clinicalData.visits)) {
        errors.push(this.createError('INVALID_VISITS_FORMAT', 'Visits section must be an array'))
      } else {
        clinicalData.visits.forEach((visit, index) => {
          if (!visit.PATIENT_NUM && !visit.patientId) {
            warnings.push(this.createWarning('MISSING_VISIT_PATIENT_REF', `Visit ${index + 1} has no patient reference (PATIENT_NUM or patientId)`, { visitIndex: index }))
          }
        })
      }
    }

    // Validate observations section
    if (clinicalData.observations) {
      if (!Array.isArray(clinicalData.observations)) {
        errors.push(this.createError('INVALID_OBSERVATIONS_FORMAT', 'Observations section must be an array'))
      } else {
        clinicalData.observations.forEach((obs, index) => {
          if (!obs.CONCEPT_CD && !obs.conceptCode) {
            errors.push(this.createError('MISSING_OBSERVATION_CONCEPT', `Observation ${index + 1} is missing CONCEPT_CD or conceptCode`, { observationIndex: index }))
          }
        })
      }
    }

    // Check for empty clinical content
    const patientsCount = clinicalData.patients?.length || 0
    const visitsCount = clinicalData.visits?.length || 0
    const observationsCount = clinicalData.observations?.length || 0

    if (patientsCount === 0 && visitsCount === 0 && observationsCount === 0 && hasClinicalData) {
      warnings.push(this.createWarning('NO_CLINICAL_CONTENT', 'JSON contains clinical data sections but they are all empty'))
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Transform JSON data to clinical objects
   * @param {Object} jsonData - Parsed JSON data
   * @returns {Object} Clinical data structure
   */
  transformJsonToClinical(jsonData) {
    const patients = []
    const visits = []
    const observations = []

    // Handle nested data structure (e.g., { data: { patients: [...] } } or { cda: { patients: [...] } })
    const clinicalData = jsonData.data || jsonData.cda || jsonData

    // Process patients
    if (clinicalData.patients && Array.isArray(clinicalData.patients)) {
      clinicalData.patients.forEach((patientData) => {
        const patient = this.createPatientFromJson(patientData)
        if (patient) patients.push(patient)
      })
    }

    // Process visits
    if (clinicalData.visits && Array.isArray(clinicalData.visits)) {
      clinicalData.visits.forEach((visitData) => {
        const visit = this.createVisitFromJson(visitData)
        if (visit) visits.push(visit)
      })
    }

    // Process observations
    if (clinicalData.observations && Array.isArray(clinicalData.observations)) {
      clinicalData.observations.forEach((obsData) => {
        const observation = this.createObservationFromJson(obsData)
        if (observation) observations.push(observation)
      })
    }

    return { patients, visits, observations }
  }

  /**
   * Create patient object from JSON data
   * @param {Object} patientData - Patient data from JSON
   * @returns {Object} Normalized patient object
   */
  createPatientFromJson(patientData) {
    return this.normalizePatient({
      PATIENT_NUM: patientData.PATIENT_NUM || patientData.id,
      PATIENT_CD: patientData.PATIENT_CD || patientData.patientId || patientData.patient_cd,
      SEX_CD: patientData.SEX_CD || patientData.sex || patientData.gender,
      AGE_IN_YEARS: patientData.AGE_IN_YEARS || patientData.age,
      BIRTH_DATE: patientData.BIRTH_DATE || patientData.birthDate || patientData.dob,
      // Support additional fields that might be in JSON
      ...patientData,
    })
  }

  /**
   * Create visit object from JSON data
   * @param {Object} visitData - Visit data from JSON
   * @returns {Object} Normalized visit object
   */
  createVisitFromJson(visitData) {
    // Find patient number - could be direct reference or need lookup
    let patientNum = visitData.PATIENT_NUM

    if (!patientNum && visitData.patientId) {
      // If we have patientId but not PATIENT_NUM, we'll need to resolve this later
      // For now, create a placeholder that can be resolved
      patientNum = `PATIENT_REF_${visitData.patientId}`
    }

    return this.normalizeVisit(
      {
        ENCOUNTER_NUM: visitData.ENCOUNTER_NUM || visitData.id,
        PATIENT_NUM: patientNum,
        START_DATE: visitData.START_DATE || visitData.startDate || visitData.visitDate,
        LOCATION_CD: visitData.LOCATION_CD || visitData.location,
        INOUT_CD: visitData.INOUT_CD || visitData.inOut || visitData.visitType,
        // Support additional fields
        ...visitData,
      },
      patientNum,
    )
  }

  /**
   * Create observation object from JSON data
   * @param {Object} obsData - Observation data from JSON
   * @returns {Object} Normalized observation object
   */
  createObservationFromJson(obsData) {
    // Find encounter number - could be direct reference or need lookup
    let encounterNum = obsData.ENCOUNTER_NUM

    if (!encounterNum && obsData.visitId) {
      encounterNum = `VISIT_REF_${obsData.visitId}`
    }

    return this.normalizeObservation(
      {
        ENCOUNTER_NUM: encounterNum,
        CONCEPT_CD: obsData.CONCEPT_CD || obsData.conceptCode,
        VALTYPE_CD: obsData.VALTYPE_CD || obsData.valtypeCd,
        VALUE: obsData.VALUE || obsData.value,
        START_DATE: obsData.START_DATE || obsData.startDate || obsData.observationDate,
        // Support additional fields
        ...obsData,
      },
      encounterNum,
    )
  }

  /**
   * Resolve cross-references between entities
   * @param {Object} clinicalData - Clinical data with potential references
   * @returns {Object} Clinical data with resolved references
   */
  resolveReferences(clinicalData) {
    const { patients, visits, observations } = clinicalData

    // Create lookup maps
    const patientMap = new Map()
    const visitMap = new Map()

    patients.forEach((patient) => {
      if (patient.PATIENT_CD) {
        patientMap.set(patient.PATIENT_CD, patient.PATIENT_NUM)
      }
    })

    visits.forEach((visit) => {
      if (visit.START_DATE && visit.PATIENT_NUM) {
        const key = `${visit.PATIENT_NUM}_${visit.START_DATE}`
        visitMap.set(key, visit.ENCOUNTER_NUM)
      }
    })

    // Resolve visit patient references
    visits.forEach((visit) => {
      if (typeof visit.PATIENT_NUM === 'string' && visit.PATIENT_NUM.startsWith('PATIENT_REF_')) {
        const patientId = visit.PATIENT_NUM.replace('PATIENT_REF_', '')
        const resolvedPatientNum = patientMap.get(patientId)
        if (resolvedPatientNum) {
          visit.PATIENT_NUM = resolvedPatientNum
        }
      }
    })

    // Resolve observation visit references
    observations.forEach((obs) => {
      if (typeof obs.ENCOUNTER_NUM === 'string' && obs.ENCOUNTER_NUM.startsWith('VISIT_REF_')) {
        const visitId = obs.ENCOUNTER_NUM.replace('VISIT_REF_', '')
        // For now, try to find by patient reference
        // This is a simplified approach - in a real implementation,
        // you might need more sophisticated reference resolution
        const resolvedVisitNum = visitMap.get(visitId)
        if (resolvedVisitNum) {
          obs.ENCOUNTER_NUM = resolvedVisitNum
        } else {
          // If we can't resolve, set to null (patient-level observation)
          obs.ENCOUNTER_NUM = null
        }
      }
    })

    return clinicalData
  }

  /**
   * Normalize patient sex codes to standard values
   * @param {string} sexCode - Raw sex code from data
   * @returns {string} Normalized sex code
   */
  normalizeSexCode(sexCode) {
    if (!sexCode) return 'U'

    const code = sexCode.toString().toLowerCase().trim()

    switch (code) {
      case 'm':
      case 'male':
      case '1':
        return 'M'
      case 'f':
      case 'female':
      case '2':
        return 'F'
      case 'u':
      case 'unknown':
        return 'U'
      default:
        return 'U' // Default to unknown for any other value
    }
  }

  /**
   * Normalize visit in/out codes to standard values
   * @param {string} inOutCode - Raw in/out code from data
   * @returns {string} Normalized in/out code
   */
  normalizeInOutCode(inOutCode) {
    if (!inOutCode) return null

    const code = inOutCode.toString().toLowerCase().trim()

    switch (code) {
      case 'i':
      case 'inpatient':
        return 'I'
      case 'o':
      case 'outpatient':
        return 'O'
      case 'e':
      case 'emergency':
        return 'E'
      default:
        return inOutCode // Return original if not recognized
    }
  }

  /**
   * Parse and normalize numeric values
   * @param {*} value - Raw value to parse
   * @returns {number|null} Parsed numeric value or null
   */
  parseNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return null
    }

    const num = Number(value)
    return isNaN(num) ? null : num
  }

  /**
   * Normalize date values to standard format
   * @param {string} dateString - Raw date string
   * @returns {string|null} Normalized date string or null
   */
  normalizeDate(dateString) {
    if (!dateString) return null

    try {
      // Handle ISO timestamps
      if (dateString.includes('T')) {
        return dateString.split('T')[0]
      }

      // Validate date format (basic check)
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return null
      }

      return dateString
    } catch {
      return null
    }
  }
}
