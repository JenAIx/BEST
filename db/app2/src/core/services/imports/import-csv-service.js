/**
 * CSV Import Service
 *
 * Handles import of clinical data from CSV files with support for:
 * - Two-header format (human-readable + concept codes) - Variant A
 * - Three-header format (FIELD_NAME + VALTYPE_CD + NAME_CHAR) - Variant B
 * - Automatic format detection and parsing
 * - Data validation and transformation
 * - Error handling and reporting
 */

import { BaseImportService } from './base-import-service.js'

export class ImportCsvService extends BaseImportService {
  constructor(conceptRepository, cqlRepository) {
    super(conceptRepository, cqlRepository)

    // CSV configuration for different variants
    this.config = {
      variantA: {
        delimiter: ',',
        quoteChar: '"',
        escapeChar: '"',
        headerRows: 2, // Human-readable + concept codes
        commentPrefix: '#',
      },
      variantB: {
        delimiter: ';',
        quoteChar: '"',
        escapeChar: '"',
        headerRows: 4, // FIELD_NAME + VALTYPE_CD + UNIT_CD + NAME_CHAR
        commentPrefix: '#',
      },
    }
  }

  /**
   * Import CSV data from file content
   * @param {string} csvContent - Raw CSV file content
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result with success/data/errors
   */
  // eslint-disable-next-line no-unused-vars
  async importFromCsv(csvContent, _options = {}) {
    try {
      // Detect CSV variant
      const variant = this.detectCsvVariant(csvContent)

      // Parse CSV based on detected variant
      const parsedData = this.parseCsvContent(csvContent, variant)

      // Validate parsed structure
      const validationResult = this.validateCsvStructure(parsedData, variant)

      // Transform to clinical objects
      const clinicalData = await this.transformCsvToClinical(parsedData, variant)

      // Validate clinical data structure
      const clinicalValidation = this.validateClinicalData(clinicalData)

      const metadata = {
        ...parsedData.metadata,
        variant,
        rowsProcessed: parsedData.dataRows.length,
        patients: clinicalData.patients.length,
        visits: clinicalData.visits.length,
        observations: clinicalData.observations.length,
        format: variant === 'variantA' ? 'Two-header (App Export)' : 'Four-header (Condensed)',
      }

      // Combine all errors and warnings
      const allErrors = [...validationResult.errors, ...clinicalValidation.errors]
      const allWarnings = [...validationResult.warnings, ...clinicalValidation.warnings]

      const isValid = allErrors.length === 0

      // Debug logging for first import
      if (!global.csvImportLogged) {
        console.log('CSV Import Debug:', {
          isValid,
          validationErrors: validationResult.errors.length,
          clinicalErrors: clinicalValidation.errors.length,
          allErrors: allErrors.length,
          firstValidationError: validationResult.errors[0],
          firstClinicalError: clinicalValidation.errors[0],
        })
        global.csvImportLogged = true
      }

      return this.createImportResult(isValid, clinicalData, metadata, allErrors, allWarnings)
    } catch (error) {
      return this.handleImportError(error, 'CSV processing')
    }
  }

  /**
   * Detect CSV variant based on content analysis
   * @param {string} csvContent - Raw CSV content
   * @returns {string} 'variantA' or 'variantB'
   */
  detectCsvVariant(csvContent) {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'))

    if (lines.length < 2) {
      throw new Error('CSV must have at least header rows')
    }

    // Check if it uses semicolons (common in Variant B)
    if (csvContent.includes(';')) {
      // Check for Variant B patterns
      const firstLine = lines[0]
      const secondLine = lines[1] || ''

      // Variant B typically starts with FIELD_NAME
      if (firstLine.startsWith('FIELD_NAME;') || firstLine.includes('FIELD_NAME;')) {
        return 'variantB'
      }

      // Check if second line has VALTYPE_CD patterns
      if (secondLine.includes('VALTYPE_CD') || secondLine.includes('numeric') || secondLine.includes('date')) {
        return 'variantB'
      }
    }

    // Check for Variant A patterns (human-readable headers)
    const firstLine = lines[0]
    if (firstLine.toLowerCase().includes('patient id') || firstLine.toLowerCase().includes('gender') || firstLine.toLowerCase().includes('date of birth') || firstLine.toLowerCase().includes('age')) {
      return 'variantA'
    }

    // Check if first line contains concept codes (Variant A pattern)
    if (firstLine.includes('PATIENT_CD') || firstLine.includes('SEX_CD') || firstLine.includes('START_DATE')) {
      return 'variantA'
    }

    // Default to Variant A if unclear
    return 'variantA'
  }

  /**
   * Detect the most likely delimiter used in a CSV line
   * @param {string} line - Sample CSV line
   * @returns {string|null} Detected delimiter or null
   */
  detectDelimiter(line) {
    const delimiters = [',', ';', '|', '\t']
    const counts = {}

    // Count occurrences of each delimiter
    delimiters.forEach((delimiter) => {
      counts[delimiter] = line.split(delimiter).length - 1
    })

    // Find delimiter with highest count (but at least 2 occurrences to be reliable)
    let bestDelimiter = null
    let maxCount = 0

    Object.entries(counts).forEach(([delimiter, count]) => {
      if (count > maxCount && count >= 2) {
        maxCount = count
        bestDelimiter = delimiter
      }
    })

    return bestDelimiter
  }

  /**
   * Parse CSV content based on detected variant
   * @param {string} csvContent - Raw CSV content
   * @param {string} variant - 'variantA' or 'variantB'
   * @returns {Object} Parsed CSV structure
   */
  parseCsvContent(csvContent, variant) {
    const config = this.config[variant]
    const lines = csvContent.split(/\r?\n/)

    // Extract comments for metadata
    const commentLines = lines.filter((line) => line.trim().startsWith(config.commentPrefix))

    // Extract data lines (non-empty, non-comment)
    const dataLines = lines.filter((line) => line.trim() && !line.startsWith(config.commentPrefix))

    if (dataLines.length < config.headerRows) {
      throw new Error(`CSV must have at least ${config.headerRows} header rows for ${variant}`)
    }

    let headers, dataRows

    if (variant === 'variantA') {
      // Variant A: Two headers (human-readable + concept codes)
      const actualDelimiter = this.detectDelimiter(dataLines[0]) || config.delimiter
      headers = {
        humanReadable: this.parseCsvRow(dataLines[0], actualDelimiter),
        conceptCodes: this.parseCsvRow(dataLines[1], actualDelimiter),
      }
      dataRows = dataLines.slice(2).map((line) => this.parseCsvRow(line, actualDelimiter))
    } else {
      // Variant B: Four headers (FIELD_NAME + VALTYPE_CD + UNIT_CD + NAME_CHAR)
      const actualDelimiter = this.detectDelimiter(dataLines[0]) || config.delimiter
      headers = {
        fieldNames: this.parseCsvRow(dataLines[0], actualDelimiter),
        valtypeCodes: this.parseCsvRow(dataLines[1], actualDelimiter),
        unitCodes: this.parseCsvRow(dataLines[2], actualDelimiter),
        nameChars: this.parseCsvRow(dataLines[3], actualDelimiter),
      }
      dataRows = dataLines.slice(4).map((line) => this.parseCsvRow(line, actualDelimiter))
    }

    // Extract metadata from comments
    const metadata = this.extractMetadataFromComments(commentLines)

    return {
      headers,
      dataRows,
      metadata,
      variant,
    }
  }

  /**
   * Parse a single CSV row handling quotes and delimiters
   * @param {string} row - CSV row string
   * @param {string} delimiter - Field delimiter
   * @returns {Array} Parsed row values
   */
  parseCsvRow(row, delimiter = ',') {
    const result = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < row.length) {
      const char = row[i]

      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          i++
        }
      } else if (char === delimiter && !inQuotes) {
        // Field separator
        result.push(current.trim())
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }

    // Add final field
    result.push(current.trim())

    return result
  }

  /**
   * Extract metadata from CSV comment lines
   * @param {Array} commentLines - Array of comment lines
   * @returns {Object} Extracted metadata
   */
  extractMetadataFromComments(commentLines) {
    const metadata = {
      exportDate: null,
      source: null,
      version: null,
      description: null,
    }

    commentLines.forEach((line) => {
      const cleanLine = line.replace(/^#\s*/, '').trim()

      if (cleanLine.toLowerCase().startsWith('export date:')) {
        metadata.exportDate = cleanLine.substring(cleanLine.indexOf(':') + 1).trim()
      } else if (cleanLine.toLowerCase().startsWith('source:')) {
        metadata.source = cleanLine.substring(cleanLine.indexOf(':') + 1).trim()
      } else if (cleanLine.toLowerCase().startsWith('version:')) {
        metadata.version = cleanLine.substring(cleanLine.indexOf(':') + 1).trim()
      } else if (cleanLine.toLowerCase().includes('description') || cleanLine.toLowerCase().includes('export')) {
        metadata.description = cleanLine
      }
    })

    return metadata
  }

  /**
   * Validate parsed CSV structure
   * @param {Object} parsedData - Parsed CSV data
   * @param {string} variant - CSV variant
   * @returns {Object} Validation result
   */
  validateCsvStructure(parsedData, variant) {
    const errors = []
    const warnings = []

    try {
      const { headers, dataRows } = parsedData

      // Check headers
      if (variant === 'variantA') {
        if (!headers.humanReadable || headers.humanReadable.length === 0) {
          errors.push(this.createError('MISSING_HEADERS', 'Human-readable headers are missing', { type: 'header' }))
        }
        if (!headers.conceptCodes || headers.conceptCodes.length === 0) {
          errors.push(this.createError('MISSING_HEADERS', 'Concept code headers are missing', { type: 'header' }))
        }
        if (headers.humanReadable?.length !== headers.conceptCodes?.length) {
          errors.push(this.createError('HEADER_MISMATCH', 'Header row lengths do not match', { type: 'header' }))
        }
      } else {
        if (!headers.fieldNames || headers.fieldNames.length === 0) {
          errors.push(this.createError('MISSING_HEADERS', 'Field name headers are missing', { type: 'header' }))
        }
        if (!headers.valtypeCodes || headers.valtypeCodes.length === 0) {
          errors.push(this.createError('MISSING_HEADERS', 'Value type headers are missing', { type: 'header' }))
        }
        if (!headers.unitCodes || headers.unitCodes.length === 0) {
          errors.push(this.createError('MISSING_HEADERS', 'Unit code headers are missing', { type: 'header' }))
        }
        if (!headers.nameChars || headers.nameChars.length === 0) {
          errors.push(this.createError('MISSING_HEADERS', 'Name character headers are missing', { type: 'header' }))
        }
      }

      // Check data rows
      if (!dataRows || dataRows.length === 0) {
        errors.push(this.createError('NO_DATA_ROWS', 'No data rows found in CSV', { type: 'data' }))
      } else {
        // Validate each data row has correct number of columns
        const expectedColumns = variant === 'variantA' ? headers.humanReadable?.length : headers.fieldNames?.length

        dataRows.forEach((row, index) => {
          if (row.length !== expectedColumns) {
            errors.push(this.createError('ROW_LENGTH_MISMATCH', `Row ${index + 1} has ${row.length} columns, expected ${expectedColumns}`, { type: 'data', row: index + 1 }))
          }
        })
      }

      // Validate required fields exist
      if (variant === 'variantA') {
        const conceptHeaders = headers.conceptCodes || []
        const requiredFields = ['PATIENT_CD', 'START_DATE']

        requiredFields.forEach((field) => {
          if (!conceptHeaders.includes(field)) {
            warnings.push(this.createWarning('MISSING_RECOMMENDED_FIELD', `Recommended field '${field}' not found in headers`, { type: 'field' }))
          }
        })
      }
    } catch (error) {
      errors.push(this.createError('VALIDATION_ERROR', `Validation failed: ${error.message}`, { type: 'system' }))
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Transform parsed CSV data to clinical objects
   * @param {Object} parsedData - Parsed CSV data
   * @param {string} variant - CSV variant
   * @param {Object} options - Transformation options
   * @returns {Promise<Object>} Clinical data structure
   */
  async transformCsvToClinical(parsedData, variant) {
    const { headers, dataRows } = parsedData

    const patients = []
    const visits = []
    const observations = []

    // Group rows by patient
    const patientGroups = new Map()

    dataRows.forEach((row, rowIndex) => {
      try {
        if (variant === 'variantA') {
          this.processVariantARow(row, headers, patientGroups, rowIndex)
        } else {
          this.processVariantBRow(row, headers, patientGroups, rowIndex)
        }
      } catch (error) {
        console.warn(`Failed to process row ${rowIndex + 1}:`, error.message)
      }
    })

    // Convert grouped data to clinical objects
    for (const [, patientData] of patientGroups) {
      // Create patient
      const patient = this.createPatientFromData(patientData.patientInfo)
      patients.push(patient)

      // Create visits
      if (patientData.visits && patientData.visits.length > 0) {
        patientData.visits.forEach((visitInfo) => {
          const visit = this.createVisitFromData(visitInfo, patient.PATIENT_NUM)
          visits.push(visit)

          // Create observations for this visit
          if (visitInfo.observations && visitInfo.observations.length > 0) {
            visitInfo.observations.forEach((obsInfo) => {
              const observation = this.createObservationFromData(obsInfo, visit.ENCOUNTER_NUM, patient.PATIENT_NUM)
              observations.push(observation)
            })
          }
        })
      }

      // Create patient-level observations
      if (patientData.observations && patientData.observations.length > 0) {
        patientData.observations.forEach((obsInfo) => {
          const observation = this.createObservationFromData(obsInfo, null, patient.PATIENT_NUM)
          observations.push(observation)
        })
      }
    }

    return {
      patients,
      visits,
      observations,
    }
  }

  /**
   * Process a row from Variant A format
   * @param {Array} row - CSV row data
   * @param {Object} headers - Header information
   * @param {Map} patientGroups - Patient grouping map
   * @param {number} rowIndex - Row index for error reporting
   */
  processVariantARow(row, headers, patientGroups, rowIndex) {
    const patientKey = row[headers.conceptCodes.indexOf('PATIENT_CD')] || `PATIENT_${rowIndex}`

    if (!patientGroups.has(patientKey)) {
      patientGroups.set(patientKey, {
        patientInfo: {},
        visits: [],
        observations: [],
      })
    }

    const patientData = patientGroups.get(patientKey)

    // Extract patient information
    headers.conceptCodes.forEach((conceptCode, colIndex) => {
      const value = row[colIndex]?.trim()

      if (value && conceptCode) {
        if (this.isPatientField(conceptCode)) {
          patientData.patientInfo[conceptCode] = value
        } else if (this.isVisitField(conceptCode)) {
          // Create or update visit
          this.addVisitData(patientData, conceptCode, value, row, headers)
        } else {
          // Observation data
          this.addObservationData(patientData, conceptCode, value, row, headers)
        }
      }
    })
  }

  /**
   * Process a row from Variant B format
   * @param {Array} row - CSV row data
   * @param {Object} headers - Header information
   * @param {Map} patientGroups - Patient grouping map
   * @param {number} rowIndex - Row index for error reporting
   */
  processVariantBRow(row, headers, patientGroups) {
    // For Variant B, we need to identify the patient first
    // The format has specific column positions, but we need to map them
    const fieldNames = headers.fieldNames

    // Find patient identifier
    const patientCdIndex = fieldNames.indexOf('PATIENT_CD')
    if (patientCdIndex === -1) return // Can't process without patient ID

    const patientKey = row[patientCdIndex]?.trim()
    if (!patientKey) return

    if (!patientGroups.has(patientKey)) {
      patientGroups.set(patientKey, {
        patientInfo: {},
        visits: [],
        observations: [],
      })
    }

    const patientData = patientGroups.get(patientKey)

    // Extract data based on field names
    fieldNames.forEach((fieldName, colIndex) => {
      const value = row[colIndex]?.trim()
      if (!value) return

      // Map Variant B fields to our internal format
      if (this.isPatientFieldVariantB(fieldName)) {
        patientData.patientInfo[fieldName] = value
      } else if (this.isVisitFieldVariantB(fieldName)) {
        this.addVisitDataVariantB(patientData, fieldName, value, row, headers)
      } else {
        // Observation data
        this.addObservationDataVariantB(patientData, fieldName, value, row, headers)
      }
    })
  }

  /**
   * Check if field name is a patient-level field (Variant A)
   * @param {string} conceptCode - Concept code to check
   * @returns {boolean} True if patient field
   */
  isPatientField(conceptCode) {
    const patientFields = ['PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE']
    return patientFields.includes(conceptCode)
  }

  /**
   * Check if field name is a patient-level field (Variant B)
   * @param {string} fieldName - Field name to check
   * @returns {boolean} True if patient field
   */
  isPatientFieldVariantB(fieldName) {
    const patientFields = ['PATIENT_CD', 'PATIENT_NUM', 'SEX_CD', 'GENDER', 'AGE_IN_YEARS', 'AGE', 'BIRTH_DATE', 'DOB']
    return patientFields.includes(fieldName)
  }

  /**
   * Check if field name is a visit-level field (Variant B)
   * @param {string} fieldName - Field name to check
   * @returns {boolean} True if visit field
   */
  isVisitFieldVariantB(fieldName) {
    const visitFields = ['START_DATE', 'VISIT_DATE', 'END_DATE', 'LOCATION_CD', 'INOUT_CD', 'ENCOUNTER_NUM']
    return visitFields.includes(fieldName)
  }

  /**
   * Check if concept code is a visit-level field
   * @param {string} conceptCode - Concept code to check
   * @returns {boolean} True if visit field
   */
  isVisitField(conceptCode) {
    const visitFields = ['START_DATE', 'LOCATION_CD', 'INOUT_CD']
    return visitFields.includes(conceptCode)
  }

  /**
   * Add visit data to patient data structure
   * @param {Object} patientData - Patient data object
   * @param {string} conceptCode - Concept code
   * @param {string} value - Field value
   * @param {Array} row - Full row data
   * @param {Object} headers - Header information
   */
  addVisitData(patientData, conceptCode, value, row, headers) {
    // Get the START_DATE from the row to identify the visit
    const startDateIndex = headers.conceptCodes.indexOf('START_DATE')
    const visitStartDate = startDateIndex >= 0 ? row[startDateIndex] : null

    // Find or create visit based on START_DATE
    let visit = null
    if (visitStartDate) {
      visit = patientData.visits.find((v) => v.START_DATE === visitStartDate)
    }

    if (!visit) {
      visit = {
        observations: [],
      }
      patientData.visits.push(visit)
    }

    visit[conceptCode] = value
  }

  /**
   * Add observation data to patient data structure
   * @param {Object} patientData - Patient data object
   * @param {string} conceptCode - Concept code
   * @param {string} value - Field value
   * @param {Array} row - Full row data
   * @param {Object} headers - Header information
   */
  addObservationData(patientData, conceptCode, value, row, headers) {
    const observation = {
      CONCEPT_CD: conceptCode,
      VALUE: value,
      VALTYPE_CD: this.determineValtypeCd(value),
    }

    // Try to associate with a visit if visit data exists in the same row
    const visitIndex = headers.conceptCodes.indexOf('START_DATE')
    if (visitIndex >= 0 && row[visitIndex]) {
      const visitDate = row[visitIndex]
      let visit = patientData.visits.find((v) => v.START_DATE === visitDate)
      if (!visit) {
        visit = {
          START_DATE: visitDate,
          observations: [],
        }
        patientData.visits.push(visit)
      }
      visit.observations.push(observation)
    } else {
      // Patient-level observation
      patientData.observations.push(observation)
    }
  }

  /**
   * Add visit data to patient data structure (Variant B)
   * @param {Object} patientData - Patient data object
   * @param {string} fieldName - Field name
   * @param {string} value - Field value
   * @param {Array} row - Full row data
   * @param {Object} headers - Header information
   */
  addVisitDataVariantB(patientData, fieldName, value) {
    // For Variant B, we need to find or create a visit
    // This is simplified - in practice we'd need more sophisticated logic
    let visit = patientData.visits[0] // For now, just use the first visit or create one

    if (!visit) {
      visit = {
        observations: [],
      }
      patientData.visits.push(visit)
    }

    // Map field name to our internal format
    const mappedField = this.mapVariantBFieldToInternal(fieldName)
    visit[mappedField] = value
  }

  /**
   * Add observation data to patient data structure (Variant B)
   * @param {Object} patientData - Patient data object
   * @param {string} fieldName - Field name
   * @param {string} value - Field value
   * @param {Array} row - Full row data
   * @param {Object} headers - Header information
   */
  addObservationDataVariantB(patientData, fieldName, value) {
    // Skip standard fields that are handled elsewhere
    if (this.isPatientFieldVariantB(fieldName) || this.isVisitFieldVariantB(fieldName)) {
      return
    }

    const observation = {
      CONCEPT_CD: fieldName, // Use field name as concept code for now
      VALUE: value,
      VALTYPE_CD: this.determineValtypeCd(value),
    }

    // Try to associate with a visit if one exists
    if (patientData.visits.length > 0) {
      patientData.visits[0].observations.push(observation)
    } else {
      // Patient-level observation
      patientData.observations.push(observation)
    }
  }

  /**
   * Map Variant B field names to internal format
   * @param {string} fieldName - Variant B field name
   * @returns {string} Internal field name
   */
  mapVariantBFieldToInternal(fieldName) {
    const mapping = {
      PATIENT_NUM: 'PATIENT_NUM',
      PATIENT_CD: 'PATIENT_CD',
      ENCOUNTER_NUM: 'ENCOUNTER_NUM',
      START_DATE: 'START_DATE',
      VISIT_DATE: 'START_DATE',
      END_DATE: 'END_DATE',
      LOCATION_CD: 'LOCATION_CD',
      INOUT_CD: 'INOUT_CD',
      SEX_CD: 'SEX_CD',
      GENDER: 'SEX_CD',
      AGE_IN_YEARS: 'AGE_IN_YEARS',
      AGE: 'AGE_IN_YEARS',
      BIRTH_DATE: 'BIRTH_DATE',
      DOB: 'BIRTH_DATE',
    }

    return mapping[fieldName] || fieldName
  }

  /**
   * Create patient object from extracted data
   * @param {Object} patientInfo - Patient information
   * @returns {Object} Patient object
   */
  createPatientFromData(patientInfo) {
    return this.normalizePatient(patientInfo)
  }

  /**
   * Create visit object from extracted data
   * @param {Object} visitInfo - Visit information
   * @param {number} patientNum - Patient number
   * @returns {Object} Visit object
   */
  createVisitFromData(visitInfo, patientNum) {
    return this.normalizeVisit(visitInfo, patientNum)
  }

  /**
   * Create observation object from extracted data
   * @param {Object} obsInfo - Observation information
   * @param {number} encounterNum - Encounter number (null for patient-level)
   * @param {number} patientNum - Patient number
   * @returns {Object} Observation object
   */
  createObservationFromData(obsInfo, encounterNum, patientNum) {
    const observation = this.normalizeObservation(obsInfo, encounterNum)

    // Add patient number to the observation
    observation.PATIENT_NUM = patientNum

    return observation
  }
}
