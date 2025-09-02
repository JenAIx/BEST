/**
 * CSV Import Service
 *
 * Handles import of clinical data from CSV files with support for:
 * - Two-header format (human-readable + concept codes) - Variant A
 * - Four-header format (FIELD_NAME + VALTYPE_CD + UNIT_CD + NAME_CHAR) - Variant B
 * - Automatic format detection and parsing
 * - Data validation and transformation
 * - Proper handling of questionnaire observations with ValType='Q'
 */

import { createImportStructure } from './import-structure.js'
import { logger } from '../logging-service.js'

export class ImportCsvService {
  constructor(conceptRepository, cqlRepository) {
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository
  }

  /**
   * Import CSV data from file content
   * @param {string} csvContent - Raw CSV file content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Import result with success/data/errors
   */
  async importFromCsv(csvContent, filename) {
    try {
      logger.info('Starting CSV import', { filename })

      // Detect CSV variant
      const variant = this.detectCsvVariant(csvContent)

      // Parse CSV based on detected variant
      const parsedData = this.parseCsvContent(csvContent, variant)

      // Validate parsed structure
      const validationResult = this.validateCsvStructure(parsedData, variant)
      if (!validationResult.isValid) {
        return {
          success: false,
          data: null,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }
      }

      // Transform to importStructure format
      const importStructure = this.transformToImportStructure(parsedData, variant, filename)

      // Validate the transformed structure
      const structureValidation = this.validateImportStructure(importStructure)
      if (!structureValidation.isValid) {
        return {
          success: false,
          data: null,
          errors: structureValidation.errors,
          warnings: structureValidation.warnings,
        }
      }

      logger.info('CSV import completed successfully', {
        variant,
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
      logger.error('CSV import failed', { error: error.message, filename })
      return {
        success: false,
        data: null,
        errors: [{ code: 'CSV_IMPORT_ERROR', message: error.message }],
        warnings: [],
      }
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

    // First, detect the delimiter by counting occurrences
    // const delimiter = this.detectDelimiterFromContent(csvContent)

    // Now determine variant based on content structure
    const firstLine = lines[0]

    // Check for Variant B patterns (FIELD_NAME header)
    if (firstLine.includes('FIELD_NAME')) {
      return 'variantB'
    }

    // Check if second line has VALTYPE_CD patterns (Variant B)
    if (lines.length > 1) {
      const secondLine = lines[1]
      if (secondLine.includes('VALTYPE_CD') || secondLine.includes('numeric') || secondLine.includes('date')) {
        return 'variantB'
      }
    }

    // Check for Variant A patterns (human-readable headers)
    if (firstLine.toLowerCase().includes('patient id') || firstLine.toLowerCase().includes('gender') || firstLine.toLowerCase().includes('age')) {
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
   * Parse CSV content based on detected variant
   * @param {string} csvContent - Raw CSV content
   * @param {string} variant - 'variantA' or 'variantB'
   * @returns {Object} Parsed CSV structure
   */
  parseCsvContent(csvContent, variant) {
    const lines = csvContent.split(/\r?\n/)

    // Extract comments for metadata
    const commentLines = lines.filter((line) => line.trim().startsWith('#'))

    // Extract data lines (non-empty, non-comment)
    const dataLines = lines.filter((line) => line.trim() && !line.startsWith('#'))

    // Detect delimiter from content
    const delimiter = this.detectDelimiterFromContent(csvContent)

    if (variant === 'variantA') {
      return this.parseVariantA(dataLines, commentLines, delimiter)
    } else {
      return this.parseVariantB(dataLines, commentLines, delimiter)
    }
  }

  /**
   * Parse Variant A format (2 headers: human-readable + concept codes)
   * @param {Array} dataLines - Data lines
   * @param {Array} commentLines - Comment lines
   * @param {string} delimiter - Detected delimiter
   * @returns {Object} Parsed structure
   */
  parseVariantA(dataLines, commentLines, delimiter) {
    if (dataLines.length < 2) {
      throw new Error('Variant A CSV must have at least 2 header rows')
    }

    const headers = {
      humanReadable: this.parseCsvRow(dataLines[0], delimiter),
      conceptCodes: this.parseCsvRow(dataLines[1], delimiter),
    }

    const dataRows = dataLines.slice(2).map((line) => this.parseCsvRow(line, delimiter))

    return {
      headers,
      dataRows,
      metadata: this.extractMetadataFromComments(commentLines),
      variant: 'variantA',
    }
  }

  /**
   * Parse Variant B format (4 headers: FIELD_NAME + VALTYPE_CD + UNIT_CD + NAME_CHAR)
   * @param {Array} dataLines - Data lines
   * @param {Array} commentLines - Comment lines
   * @param {string} delimiter - Detected delimiter
   * @returns {Object} Parsed structure
   */
  parseVariantB(dataLines, commentLines, delimiter) {
    if (dataLines.length < 4) {
      throw new Error('Variant B CSV must have at least 4 header rows')
    }

    const headers = {
      fieldNames: this.parseCsvRow(dataLines[0], delimiter),
      valtypeCodes: this.parseCsvRow(dataLines[1], delimiter),
      unitCodes: this.parseCsvRow(dataLines[2], delimiter),
      nameChars: this.parseCsvRow(dataLines[3], delimiter),
    }

    const dataRows = dataLines.slice(4).map((line) => this.parseCsvRow(line, delimiter))

    return {
      headers,
      dataRows,
      metadata: this.extractMetadataFromComments(commentLines),
      variant: 'variantB',
    }
  }

  /**
   * Detect the most likely delimiter used in CSV content by counting occurrences
   * @param {string} csvContent - Full CSV content
   * @returns {string} Detected delimiter (defaults to comma)
   */
  detectDelimiterFromContent(csvContent) {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'))

    if (lines.length === 0) {
      return ','
    }

    // Count occurrences of each delimiter across all lines
    const delimiters = [',', ';', '|', '\t']
    const totalCounts = {}

    delimiters.forEach((delimiter) => {
      totalCounts[delimiter] = 0
    })

    // Count occurrences in each line
    lines.forEach((line) => {
      delimiters.forEach((delimiter) => {
        const count = (line.match(new RegExp('\\' + delimiter, 'g')) || []).length
        totalCounts[delimiter] += count
      })
    })

    // Find delimiter with highest total count
    let bestDelimiter = ','
    let maxCount = 0

    Object.entries(totalCounts).forEach(([delimiter, count]) => {
      if (count > maxCount) {
        maxCount = count
        bestDelimiter = delimiter
      }
    })

    return bestDelimiter
  }

  /**
   * Detect the most likely delimiter used in a CSV line
   * @param {string} line - Sample CSV line
   * @returns {string|null} Detected delimiter or null
   */
  detectDelimiter(line) {
    const delimiters = [',', ';', '|', '\t']
    const counts = {}

    delimiters.forEach((delimiter) => {
      counts[delimiter] = line.split(delimiter).length - 1
    })

    // Find delimiter with highest count (but at least 2 occurrences)
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

    const { headers, dataRows } = parsedData

    // Check headers
    if (variant === 'variantA') {
      if (!headers.humanReadable || headers.humanReadable.length === 0) {
        errors.push({ code: 'MISSING_HEADERS', message: 'Human-readable headers are missing' })
      }
      if (!headers.conceptCodes || headers.conceptCodes.length === 0) {
        errors.push({ code: 'MISSING_HEADERS', message: 'Concept code headers are missing' })
      }
      if (headers.humanReadable?.length !== headers.conceptCodes?.length) {
        errors.push({ code: 'HEADER_MISMATCH', message: 'Header row lengths do not match' })
      }
    } else {
      if (!headers.fieldNames || headers.fieldNames.length === 0) {
        errors.push({ code: 'MISSING_HEADERS', message: 'Field name headers are missing' })
      }
      if (!headers.valtypeCodes || headers.valtypeCodes.length === 0) {
        errors.push({ code: 'MISSING_HEADERS', message: 'Value type headers are missing' })
      }
    }

    // Check data rows
    if (!dataRows || dataRows.length === 0) {
      errors.push({ code: 'NO_DATA_ROWS', message: 'No data rows found in CSV' })
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Transform parsed CSV data to importStructure format
   * @param {Object} parsedData - Parsed CSV data
   * @param {string} variant - CSV variant
   * @param {string} filename - Original filename
   * @returns {Object} Import structure
   */
  transformToImportStructure(parsedData, variant, filename) {
    const importStructure = createImportStructure({
      metadata: {
        title: parsedData.metadata.description || 'CSV Import',
        format: 'csv',
        source: parsedData.metadata.source || 'CSV Import Service',
        author: 'CSV Import Service',
        exportDate: parsedData.metadata.exportDate || new Date().toISOString(),
        filename: filename,
      },
      exportInfo: {
        format: 'csv',
        version: parsedData.metadata.version || '1.0',
        exportedAt: new Date().toISOString(),
        source: 'CSV Import Service',
      },
    })

    // Extract data from CSV
    const { patients, visits, observations } = this.extractDataFromCsv(parsedData, variant)

    // Populate import structure
    importStructure.data.patients = patients
    importStructure.data.visits = visits
    importStructure.data.observations = observations

    // Update statistics
    importStructure.statistics.patientCount = patients.length
    importStructure.statistics.visitCount = visits.length
    importStructure.statistics.observationCount = observations.length
    importStructure.metadata.patientCount = patients.length
    importStructure.metadata.visitCount = visits.length
    importStructure.metadata.observationCount = observations.length
    importStructure.metadata.patientIds = patients.map((p) => p.PATIENT_CD || p.id)

    return importStructure
  }

  /**
   * Extract clinical data from CSV
   * @param {Object} parsedData - Parsed CSV data
   * @param {string} variant - CSV variant
   * @returns {Object} Extracted clinical data
   */
  extractDataFromCsv(parsedData, variant) {
    const patients = []
    const visits = []
    const observations = []

    // Track patient and visit mappings
    const patientMap = new Map()
    const visitMap = new Map()
    let patientCounter = 1
    let visitCounter = 1
    let observationCounter = 1

    // Group rows by patient
    const patientGroups = new Map()

    parsedData.dataRows.forEach((row, rowIndex) => {
      try {
        if (variant === 'variantA') {
          this.processVariantARow(row, parsedData.headers, patientGroups, rowIndex)
        } else {
          this.processVariantBRow(row, parsedData.headers, patientGroups, rowIndex)
        }
      } catch (error) {
        logger.warn(`Failed to process row ${rowIndex + 1}:`, error.message)
      }
    })

    // Convert grouped data to clinical objects
    for (const [, patientData] of patientGroups) {
      // Create patient
      const patient = this.createPatientFromData(patientData.patientInfo, patientCounter++)
      patients.push(patient)
      patientMap.set(patient.PATIENT_CD, patient)

      // Create visits
      if (patientData.visits && patientData.visits.length > 0) {
        patientData.visits.forEach((visitInfo) => {
          const visit = this.createVisitFromData(visitInfo, patient.PATIENT_NUM, visitCounter++)
          visits.push(visit)
          visitMap.set(visit.ENCOUNTER_NUM, visit)

          // Create observations for this visit
          if (visitInfo.observations && visitInfo.observations.length > 0) {
            visitInfo.observations.forEach((obsInfo) => {
              const observation = this.createObservationFromData(obsInfo, visit.ENCOUNTER_NUM, patient.PATIENT_NUM, observationCounter++)
              observations.push(observation)
            })
          }
        })
      }

      // Create patient-level observations
      if (patientData.observations && patientData.observations.length > 0) {
        patientData.observations.forEach((obsInfo) => {
          const observation = this.createObservationFromData(obsInfo, null, patient.PATIENT_NUM, observationCounter++)
          observations.push(observation)
        })
      }
    }

    return { patients, visits, observations }
  }

  /**
   * Process a row from Variant A format
   * @param {Array} row - CSV row data
   * @param {Object} headers - Header information
   * @param {Map} patientGroups - Patient grouping map
   * @param {number} rowIndex - Row index for error reporting
   */
  processVariantARow(row, headers, patientGroups, rowIndex) {
    const patientCdIndex = headers.conceptCodes.indexOf('PATIENT_CD')
    if (patientCdIndex === -1) return

    const patientKey = row[patientCdIndex]?.trim() || `PATIENT_${rowIndex}`

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
      if (!value) return

      if (this.isPatientField(conceptCode)) {
        patientData.patientInfo[conceptCode] = value
      } else if (this.isVisitField(conceptCode)) {
        this.addVisitData(patientData, conceptCode, value, row, headers)
      } else {
        this.addObservationData(patientData, conceptCode, value, row, headers)
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
  processVariantBRow(row, headers, patientGroups, rowIndex) {
    const patientCdIndex = headers.fieldNames.indexOf('PATIENT_CD')
    if (patientCdIndex === -1) return

    const patientKey = row[patientCdIndex]?.trim() || `PATIENT_${rowIndex}`

    if (!patientGroups.has(patientKey)) {
      patientGroups.set(patientKey, {
        patientInfo: {},
        visits: [],
        observations: [],
      })
    }

    const patientData = patientGroups.get(patientKey)

    // Extract data based on field names
    headers.fieldNames.forEach((fieldName, colIndex) => {
      const value = row[colIndex]?.trim()
      if (!value) return

      const valtypeCd = headers.valtypeCodes[colIndex] || 'text'
      const unitCd = headers.unitCodes[colIndex] || null

      if (this.isPatientFieldVariantB(fieldName)) {
        patientData.patientInfo[fieldName] = value
      } else if (this.isVisitFieldVariantB(fieldName)) {
        this.addVisitDataVariantB(patientData, fieldName, value, row, headers)
      } else {
        this.addObservationDataVariantB(patientData, fieldName, value, valtypeCd, unitCd, row, headers)
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
    const patientFields = ['PATIENT_NUM', 'PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE']
    return patientFields.includes(fieldName)
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
   * Check if field name is a visit-level field (Variant B)
   * @param {string} fieldName - Field name to check
   * @returns {boolean} True if visit field
   */
  isVisitFieldVariantB(fieldName) {
    const visitFields = ['ENCOUNTER_NUM', 'START_DATE', 'END_DATE', 'PROVIDER_ID', 'LOCATION_CD']
    return visitFields.includes(fieldName)
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
    const startDateIndex = headers.conceptCodes.indexOf('START_DATE')
    const visitStartDate = startDateIndex >= 0 ? row[startDateIndex] : null

    let visit = null
    if (visitStartDate) {
      visit = patientData.visits.find((v) => v.START_DATE === visitStartDate)
    }

    if (!visit) {
      visit = { observations: [] }
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

    // Try to associate with a visit
    const visitIndex = headers.conceptCodes.indexOf('START_DATE')
    if (visitIndex >= 0 && row[visitIndex]) {
      const visitDate = row[visitIndex]
      let visit = patientData.visits.find((v) => v.START_DATE === visitDate)
      if (!visit) {
        visit = { START_DATE: visitDate, observations: [] }
        patientData.visits.push(visit)
      }
      visit.observations.push(observation)
    } else {
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
    let visit = patientData.visits[0]
    if (!visit) {
      visit = { observations: [] }
      patientData.visits.push(visit)
    }

    const mappedField = this.mapVariantBFieldToInternal(fieldName)
    visit[mappedField] = value
  }

  /**
   * Add observation data to patient data structure (Variant B)
   * @param {Object} patientData - Patient data object
   * @param {string} fieldName - Field name
   * @param {string} value - Field value
   * @param {string} valtypeCd - Value type code
   * @param {string} unitCd - Unit code
   * @param {Array} row - Full row data
   * @param {Object} headers - Header information
   */
  addObservationDataVariantB(patientData, fieldName, value, valtypeCd, unitCd) {
    if (this.isPatientFieldVariantB(fieldName) || this.isVisitFieldVariantB(fieldName)) {
      return
    }

    const observation = {
      CONCEPT_CD: fieldName,
      VALUE: value,
      VALTYPE_CD: this.mapValtypeCd(valtypeCd),
      UNIT_CD: unitCd,
    }

    if (patientData.visits.length > 0) {
      patientData.visits[0].observations.push(observation)
    } else {
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
      END_DATE: 'END_DATE',
      PROVIDER_ID: 'PROVIDER_ID',
      LOCATION_CD: 'LOCATION_CD',
    }
    return mapping[fieldName] || fieldName
  }

  /**
   * Map Variant B value type codes to internal format
   * @param {string} valtypeCd - Variant B value type code
   * @returns {string} Internal value type code
   */
  mapValtypeCd(valtypeCd) {
    const mapping = {
      numeric: 'N',
      text: 'T',
      date: 'D',
      finding: 'T',
    }
    return mapping[valtypeCd] || 'T'
  }

  /**
   * Determine value type code from value
   * @param {string} value - Field value
   * @returns {string} Value type code
   */
  determineValtypeCd(value) {
    if (!value) return 'T'

    // Check if it's a number
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return 'N'
    }

    // Check if it's a date
    if (this.isDate(value)) {
      return 'D'
    }

    return 'T'
  }

  /**
   * Check if value is a date
   * @param {string} value - Value to check
   * @returns {boolean} True if date
   */
  isDate(value) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    return dateRegex.test(value)
  }

  /**
   * Create patient object from extracted data
   * @param {Object} patientInfo - Patient information
   * @param {number} patientNum - Patient number
   * @returns {Object} Patient object
   */
  createPatientFromData(patientInfo, patientNum) {
    return {
      PATIENT_NUM: patientNum,
      PATIENT_CD: patientInfo.PATIENT_CD || `PATIENT_${patientNum}`,
      VITAL_STATUS_CD: 'SCTID: 438949009', // Default: alive
      BIRTH_DATE: patientInfo.BIRTH_DATE || null,
      DEATH_DATE: null,
      AGE_IN_YEARS: patientInfo.AGE_IN_YEARS ? parseInt(patientInfo.AGE_IN_YEARS) : null,
      SEX_CD: patientInfo.SEX_CD || null,
      LANGUAGE_CD: null,
      RACE_CD: null,
      MARITAL_STATUS_CD: null,
      RELIGION_CD: null,
      STATECITYZIP_PATH: null,
      PATIENT_BLOB: null,
      UPDATE_DATE: new Date().toISOString().split('T')[0],
      DOWNLOAD_DATE: null,
      IMPORT_DATE: new Date().toISOString(),
      SOURCESYSTEM_CD: 'CSV_IMPORT',
      UPLOAD_ID: 1,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    }
  }

  /**
   * Create visit object from extracted data
   * @param {Object} visitInfo - Visit information
   * @param {number} patientNum - Patient number
   * @param {number} visitNum - Visit number
   * @returns {Object} Visit object
   */
  createVisitFromData(visitInfo, patientNum, visitNum) {
    return {
      ENCOUNTER_NUM: visitInfo.ENCOUNTER_NUM || visitNum,
      PATIENT_NUM: patientNum,
      ACTIVE_STATUS_CD: 'SCTID: 55561003', // Default: active
      START_DATE: visitInfo.START_DATE || new Date().toISOString().split('T')[0],
      END_DATE: visitInfo.END_DATE || null,
      INOUT_CD: visitInfo.INOUT_CD || 'O', // Default: outpatient
      LOCATION_CD: visitInfo.LOCATION_CD || 'CSV_IMPORT',
      VISIT_BLOB: null,
      UPDATE_DATE: null,
      DOWNLOAD_DATE: null,
      IMPORT_DATE: null,
      SOURCESYSTEM_CD: 'CSV_IMPORT',
      UPLOAD_ID: 1,
      CREATED_AT: new Date().toISOString().split('T')[0],
    }
  }

  /**
   * Create observation object from extracted data
   * @param {Object} obsInfo - Observation information
   * @param {number} encounterNum - Encounter number (null for patient-level)
   * @param {number} patientNum - Patient number
   * @param {number} observationNum - Observation number
   * @returns {Object} Observation object
   */
  createObservationFromData(obsInfo, encounterNum, patientNum, observationNum) {
    const observation = {
      OBSERVATION_ID: observationNum,
      ENCOUNTER_NUM: encounterNum,
      PATIENT_NUM: patientNum,
      CATEGORY_CHAR: this.determineCategory(obsInfo.CONCEPT_CD),
      CONCEPT_CD: obsInfo.CONCEPT_CD,
      PROVIDER_ID: null,
      START_DATE: new Date().toISOString().split('T')[0],
      INSTANCE_NUM: 1,
      VALTYPE_CD: obsInfo.VALTYPE_CD || 'T',
      TVAL_CHAR: null,
      NVAL_NUM: null,
      VALUEFLAG_CD: null,
      QUANTITY_NUM: null,
      UNIT_CD: obsInfo.UNIT_CD || null,
      END_DATE: null,
      LOCATION_CD: null,
      CONFIDENCE_NUM: null,
      OBSERVATION_BLOB: null,
      UPDATE_DATE: null,
      DOWNLOAD_DATE: null,
      IMPORT_DATE: null,
      SOURCESYSTEM_CD: 'CSV_IMPORT',
      UPLOAD_ID: 1,
      CREATED_AT: new Date().toISOString().split('T')[0],
    }

    // Set value based on type
    if (obsInfo.VALTYPE_CD === 'N') {
      observation.NVAL_NUM = parseFloat(obsInfo.VALUE)
    } else {
      observation.TVAL_CHAR = obsInfo.VALUE
    }

    return observation
  }

  /**
   * Determine observation category from concept code
   * @param {string} conceptCd - Concept code
   * @returns {string} Category code
   */
  determineCategory(conceptCd) {
    if (!conceptCd) return 'CLINICAL'

    const conceptLower = conceptCd.toLowerCase()
    if (conceptLower.includes('questionnaire') || conceptLower.includes('custom')) return 'SURVEY_BEST'
    if (conceptLower.includes('lid:') && conceptLower.includes('72172')) return 'SURVEY_BEST' // MoCA
    if (conceptLower.includes('sctid:') && conceptLower.includes('47965005')) return 'DIAGNOSIS'
    if (conceptLower.includes('lid:') && (conceptLower.includes('2947') || conceptLower.includes('6298'))) return 'LAB'
    if (conceptLower.includes('sctid:') && conceptLower.includes('399423000')) return 'ADMINISTRATIVE'
    if (conceptLower.includes('sctid:') && conceptLower.includes('60621009')) return 'VITAL_SIGNS'
    if (conceptLower.includes('lid:') && conceptLower.includes('52418')) return 'MEDICATION'
    if (conceptLower.includes('lid:') && conceptLower.includes('74287')) return 'SOCIAL_HISTORY'
    if (conceptLower.includes('sctid:') && conceptLower.includes('262188008')) return 'ASSESSMENT'

    return 'CLINICAL'
  }

  /**
   * Validate import structure
   * @param {Object} importStructure - Import structure to validate
   * @returns {Object} Validation result
   */
  validateImportStructure(importStructure) {
    const errors = []
    const warnings = []

    if (!importStructure) {
      errors.push({ code: 'MISSING_STRUCTURE', message: 'Import structure is missing' })
      return { isValid: false, errors, warnings }
    }

    if (!importStructure.data) {
      errors.push({ code: 'MISSING_DATA', message: 'Import structure missing data section' })
    }

    if (!importStructure.metadata) {
      errors.push({ code: 'MISSING_METADATA', message: 'Import structure missing metadata section' })
    }

    return { isValid: errors.length === 0, errors, warnings }
  }
}
