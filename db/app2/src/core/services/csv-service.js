/**
 * CSV Service for Clinical Data Import/Export
 * 
 * Features:
 * - Two header rows: human-readable descriptions + CONCEPT codes
 * - Complex nested data support (patients, visits, observations)
 * - Data validation and integrity preservation
 * - Flexible export formats
 * - Comprehensive import with error handling
 */

import { DataValidator } from '../validators/data-validator.js'

export class CsvService {
  constructor(conceptRepository, cqlRepository) {
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository
    this.dataValidator = new DataValidator(conceptRepository, cqlRepository)
    
    // CSV configuration
    this.config = {
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      lineEnding: '\n',
      encoding: 'utf-8'
    }
  }

  /**
   * Export clinical data to CSV format
   * @param {Object} exportOptions - Export configuration
   * @param {Array} exportOptions.patients - Patient data to export
   * @param {Array} exportOptions.visits - Visit data to export
   * @param {Array} exportOptions.observations - Observation data to export
   * @param {Object} exportOptions.metadata - Export metadata
   * @returns {string} CSV content
   */
  async exportToCsv(exportOptions) {
    try {
      const { patients, visits, observations, metadata } = exportOptions
      
      // Validate input data
      if (!patients || !Array.isArray(patients)) {
        throw new Error('Patients data is required and must be an array')
      }

      // Build CSV structure
      const csvStructure = await this.buildCsvStructure(patients, visits, observations)
      
      // Generate CSV content
      const csvContent = this.generateCsvContent(csvStructure, metadata)
      
      return csvContent
    } catch (error) {
      console.error('CSV export failed:', error)
      throw new Error(`CSV export failed: ${error.message}`)
    }
  }

  /**
   * Get unique concept codes from observations
   * @param {Array} observations - Observation data
   * @returns {Array} Array of unique concept codes
   */
  async getUniqueConcepts(observations) {
    const conceptMap = new Map()
    
    for (const obs of observations) {
      if (obs.CONCEPT_CD && !conceptMap.has(obs.CONCEPT_CD)) {
        conceptMap.set(obs.CONCEPT_CD, obs.CONCEPT_CD)
      }
    }
    
    return Array.from(conceptMap.values())
  }

  /**
   * Get concept information for display names
   * @param {string} conceptCode - Concept code
   * @returns {Object} Concept information
   */
  async getConceptInfo(conceptCode) {
    try {
      const concept = await this.conceptRepository.findByConceptCode(conceptCode)
      return {
        displayName: concept?.NAME_CHAR || conceptCode,
        conceptPath: concept?.CONCEPT_PATH || '',
        description: concept?.DESCRIPTION_CHAR || ''
      }
    } catch (error) {
      console.warn(`Could not fetch concept info for ${conceptCode}:`, error.message)
      return {
        displayName: conceptCode,
        conceptPath: '',
        description: ''
      }
    }
  }

  /**
   * Build CSV structure with two header rows
   * @param {Array} patients - Patient data
   * @param {Array} visits - Visit data
   * @param {Array} observations - Observation data
   * @returns {Object} CSV structure with headers and data
   */
  async buildCsvStructure(patients, visits, observations) {
    const structure = {
      descriptionHeaders: [], // Human-readable descriptions
      conceptHeaders: [],     // CONCEPT codes
      dataRows: []           // Actual data rows
    }

    // Start with patient-level fields
    structure.descriptionHeaders.push('Patient ID', 'Gender', 'Age', 'Date of Birth')
    structure.conceptHeaders.push('PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE')

    // Add visit-level fields
    if (visits && visits.length > 0) {
      structure.descriptionHeaders.push('Visit Date', 'Location', 'Type')
      structure.conceptHeaders.push('START_DATE', 'LOCATION_CD', 'INOUT_CD')
    }

    // Add observation fields dynamically
    if (observations && observations.length > 0) {
      const uniqueConcepts = await this.getUniqueConcepts(observations)
      
      for (const conceptCode of uniqueConcepts) {
        const conceptInfo = await this.getConceptInfo(conceptCode)
        structure.descriptionHeaders.push(conceptInfo.displayName || conceptCode)
        structure.conceptHeaders.push(conceptCode)
      }
    }

    // Build data rows
    structure.dataRows = await this.buildDataRows(patients, visits, observations, structure.conceptHeaders)

    return structure
  }

  /**
   * Build data rows for CSV export
   * @param {Array} patients - Patient data
   * @param {Array} visits - Visit data
   * @param {Array} observations - Observation data
   * @param {Array} conceptHeaders - Concept codes for headers
   * @returns {Array} Data rows
   */
  async buildDataRows(patients, visits, observations, conceptHeaders) {
    const dataRows = []
    
    for (const patient of patients) {
      const patientVisits = visits?.filter(v => v.PATIENT_NUM === patient.PATIENT_NUM) || []
      
      if (patientVisits.length === 0) {
        // Patient without visits - don't create a row
        continue
      } else {
        // Patient with visits
        for (const visit of patientVisits) {
          const row = this.buildPatientRow(patient, visit, observations, conceptHeaders)
          dataRows.push(row)
        }
      }
    }
    
    return dataRows
  }

  /**
   * Build a single data row for CSV
   * @param {Object} patient - Patient data
   * @param {Object|null} visit - Visit data or null
   * @param {Array} observations - Observation data
   * @param {Array} conceptHeaders - Concept codes for headers
   * @returns {Array} Data row values
   */
  buildPatientRow(patient, visit, observations, conceptHeaders) {
    const row = []
    
    // Patient fields
    row.push(
      patient.PATIENT_CD || '',
      patient.SEX_CD || '',
      patient.AGE_IN_YEARS || '',
      patient.BIRTH_DATE || ''
    )
    
    // Visit fields
    if (visit) {
      row.push(
        visit.START_DATE || '',
        visit.LOCATION_CD || '',
        visit.INOUT_CD || ''
      )
    } else {
      row.push('', '', '') // Empty visit fields
    }
    
    // Observation fields
    const visitObservations = observations?.filter(o => o.ENCOUNTER_NUM === visit?.ENCOUNTER_NUM) || []
    
    for (const conceptCode of conceptHeaders.slice(7)) { // Skip patient (4) and visit (3) fields
      const obs = visitObservations.find(o => o.CONCEPT_CD === conceptCode)
      if (obs) {
        row.push(this.formatObservationValue(obs))
      } else {
        row.push('') // No observation for this concept
      }
    }
    
    return row
  }

  /**
   * Format observation value for CSV export
   * @param {Object} observation - Observation data
   * @returns {string} Formatted value
   */
  formatObservationValue(observation) {
    if (observation.VALTYPE_CD === 'N' && observation.NVAL_NUM !== null) {
      return observation.NVAL_NUM.toString()
    } else if (observation.VALTYPE_CD === 'T' && observation.TVAL_CHAR) {
      return observation.TVAL_CHAR
    } else if (observation.VALTYPE_CD === 'B' && observation.OBSERVATION_BLOB) {
      // If it's already a string, return it directly; otherwise stringify
      return typeof observation.OBSERVATION_BLOB === 'string' 
        ? observation.OBSERVATION_BLOB 
        : JSON.stringify(observation.OBSERVATION_BLOB)
    } else if (observation.VALTYPE_CD === 'D' && observation.START_DATE) {
      return observation.START_DATE
    }
    
    return 'Unknown'
  }

  /**
   * Generate CSV content from structure
   * @param {Object} structure - CSV structure
   * @param {Object} metadata - Export metadata
   * @returns {string} CSV content
   */
  generateCsvContent(structure, metadata = {}) {
    let csv = ''
    
    // Add metadata comment lines
    if (metadata.exportDate) {
      csv += `# Export Date: ${metadata.exportDate}\n`
    }
    if (metadata.source) {
      csv += `# Source: ${metadata.source}\n`
    }
    if (metadata.version) {
      csv += `# Version: ${metadata.version}\n`
    }
    if (metadata.title) {
      csv += `# ${metadata.title}\n`
    }
    if (metadata.author) {
      csv += `# ${metadata.author}\n`
    }
    csv += '\n'
    
    // Add description headers (human-readable)
    csv += this.escapeCsvRow(structure.descriptionHeaders).join(this.config.delimiter)
    csv += this.config.lineEnding
    
    // Add concept headers (CONCEPT codes)
    csv += this.escapeCsvRow(structure.conceptHeaders).join(this.config.delimiter)
    csv += this.config.lineEnding
    
    // Add data rows
    for (const row of structure.dataRows) {
      csv += this.escapeCsvRow(row).join(this.config.delimiter)
      csv += this.config.lineEnding
    }
    
    return csv
  }

  /**
   * Escape CSV row values
   * @param {Array} row - Row values
   * @returns {string} Escaped CSV row
   */
  escapeCsvRow(row) {
    return row.map(value => {
      const stringValue = value?.toString() || ''
      
      // Escape quotes and wrap in quotes if needed
      if (stringValue.includes(this.config.quoteChar) || 
          stringValue.includes(this.config.delimiter) || 
          stringValue.includes('\n') || 
          stringValue.includes('\r')) {
        return `${this.config.quoteChar}${stringValue.replace(new RegExp(this.config.quoteChar, 'g'), this.config.escapeChar + this.config.quoteChar)}${this.config.quoteChar}`
      }
      
      return stringValue
    })
  }

  /**
   * Import CSV data to clinical objects
   * @param {string} csvContent - CSV content
   * @param {Object} importOptions - Import configuration
   * @returns {Object} Import result with data and validation
   */
  async importFromCsv(csvContent, importOptions = {}) {
    try {
      // Parse CSV content
      const parsedData = this.parseCsvContent(csvContent)
      
      // Validate structure
      const validationResult = await this.validateCsvStructure(parsedData)
      
      if (!validationResult.isValid) {
        return {
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        }
      }
      
      // Transform to clinical objects
      const clinicalData = await this.transformCsvToClinical(parsedData, importOptions)
      
      return {
        success: true,
        data: clinicalData,
        metadata: {
          ...parsedData.metadata, // Include extracted metadata from CSV comments
          rowsProcessed: parsedData.dataRows.length,
          patients: clinicalData.patients.length,
          visits: clinicalData.visits.length,
          observations: clinicalData.observations.length
        }
      }
    } catch (error) {
      console.error('CSV import failed:', error)
      return {
        success: false,
        errors: [{
          code: 'IMPORT_ERROR',
          message: `CSV import failed: ${error.message}`,
          details: error.stack
        }]
      }
    }
  }

  /**
   * Parse CSV content into structured data
   * @param {string} csvContent - CSV content
   * @returns {Object} Parsed CSV structure
   */
  parseCsvContent(csvContent) {
    const lines = csvContent.split(/\r?\n/)
    const commentLines = lines.filter(line => line.trim().startsWith('#'))
    const dataLines = lines.filter(line => line.trim() && !line.startsWith('#'))
    
    if (dataLines.length < 2) {
      throw new Error('CSV must have at least description and concept header rows')
    }
    
    const descriptionHeaders = this.parseCsvRow(dataLines[0])
    const conceptHeaders = this.parseCsvRow(dataLines[1])
    const dataRows = dataLines.slice(2).map(line => this.parseCsvRow(line))
    
    // Extract metadata from comment lines
    const metadata = this.extractMetadataFromComments(commentLines)
    
    return {
      descriptionHeaders,
      conceptHeaders,
      dataRows,
      metadata
    }
  }

  /**
   * Extract metadata from comment lines
   * @param {Array} commentLines - Comment lines starting with #
   * @returns {Object} Extracted metadata
   */
  extractMetadataFromComments(commentLines) {
    const metadata = {}
    
    for (const line of commentLines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('# Export Date:')) {
        metadata.exportDate = trimmed.replace('# Export Date:', '').trim()
      } else if (trimmed.startsWith('# Source:')) {
        metadata.source = trimmed.replace('# Source:', '').trim()
      } else if (trimmed.startsWith('# Version:')) {
        metadata.version = trimmed.replace('# Version:', '').trim()
      } else if (trimmed.startsWith('# ') && !trimmed.includes(':')) {
        // Handle title and author lines
        const content = trimmed.replace('# ', '')
        if (!metadata.title) {
          metadata.title = content
        } else if (!metadata.author) {
          metadata.author = content
        }
      }
    }
    
    return metadata
  }

  /**
   * Parse a single CSV row
   * @param {string} line - CSV line
   * @returns {Array} Parsed values
   */
  parseCsvRow(line) {
    const values = []
    let current = ''
    let inQuotes = false
    let i = 0
    
    while (i < line.length) {
      const char = line[i]
      
      if (char === this.config.quoteChar) {
        if (inQuotes && line[i + 1] === this.config.quoteChar) {
          // Escaped quote
          current += this.config.quoteChar
          i += 2
          continue
        }
        inQuotes = !inQuotes
      } else if (char === this.config.delimiter && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
      
      i++
    }
    
    values.push(current.trim())
    return values
  }

  /**
   * Validate CSV structure and data
   * @param {Object} parsedData - Parsed CSV data
   * @returns {Object} Validation result
   */
  async validateCsvStructure(parsedData) {
    const errors = []
    const warnings = []
    
    // Check header consistency
    if (parsedData.descriptionHeaders.length !== parsedData.conceptHeaders.length) {
      errors.push({
        code: 'HEADER_MISMATCH',
        message: 'Description and concept headers must have the same number of columns',
        details: `Description: ${parsedData.descriptionHeaders.length}, Concept: ${parsedData.conceptHeaders.length}`
      })
    }
    
    // Check required fields
    const requiredFields = ['PATIENT_CD']
    for (const field of requiredFields) {
      if (!parsedData.conceptHeaders.includes(field)) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field missing: ${field}`,
          details: 'PATIENT_CD is required for all imports'
        })
      }
    }
    
    // Validate data rows
    for (let i = 0; i < parsedData.dataRows.length; i++) {
      const row = parsedData.dataRows[i]
      const rowErrors = this.validateDataRow(row, parsedData.conceptHeaders, i + 3) // +3 for 0-index, description header, concept header
      
      errors.push(...rowErrors)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate a single data row
   * @param {Array} row - Data row
   * @param {Array} conceptHeaders - Concept headers
   * @param {number} rowNumber - Row number for error reporting
   * @returns {Array} Validation errors
   */
  validateDataRow(row, conceptHeaders, rowNumber) {
    const errors = []
    
    // Check row length
    if (row.length !== conceptHeaders.length) {
      errors.push({
        code: 'ROW_LENGTH_MISMATCH',
        message: `Row ${rowNumber} has incorrect number of columns`,
        details: `Expected ${conceptHeaders.length}, got ${row.length}`
      })
      return errors
    }
    
    // Validate required fields
    const patientCdIndex = conceptHeaders.indexOf('PATIENT_CD')
    if (patientCdIndex >= 0 && (!row[patientCdIndex] || row[patientCdIndex].trim() === '')) {
      errors.push({
        code: 'MISSING_PATIENT_CD',
        message: `Row ${rowNumber} missing required PATIENT_CD`,
        details: 'Patient ID is required for all rows'
      })
    }
    
    return errors
  }

  /**
   * Transform CSV data to clinical objects
   * @param {Object} parsedData - Parsed CSV data
   * @param {Object} importOptions - Import options
   * @returns {Object} Clinical data objects
   */
  async transformCsvToClinical(parsedData) {
    const clinicalData = {
      patients: [],
      visits: [],
      observations: []
    }
    
    const patientMap = new Map()
    const visitMap = new Map()
    
    for (const row of parsedData.dataRows) {
      const rowData = this.mapRowToObject(row, parsedData.conceptHeaders)
      
      // Create or update patient
      if (rowData.PATIENT_CD) {
        let patient = patientMap.get(rowData.PATIENT_CD)
        if (!patient) {
          patient = this.createPatientFromRow(rowData)
          patientMap.set(rowData.PATIENT_CD, patient)
          clinicalData.patients.push(patient)
        }
        
        // Create or update visit
        if (rowData.START_DATE || rowData.LOCATION_CD) {
          const visitKey = `${rowData.PATIENT_CD}_${rowData.START_DATE || 'unknown'}`
          let visit = visitMap.get(visitKey)
          if (!visit) {
            visit = this.createVisitFromRow(rowData, patient.PATIENT_NUM)
            visitMap.set(visitKey, visit)
            clinicalData.visits.push(visit)
          }
          
          // Create observations
          const observations = this.createObservationsFromRow(rowData, patient.PATIENT_NUM, visit.ENCOUNTER_NUM)
          clinicalData.observations.push(...observations)
        }
      }
    }
    
    return clinicalData
  }

  /**
   * Map CSV row to object using concept headers
   * @param {Array} row - Data row
   * @param {Array} conceptHeaders - Concept headers
   * @returns {Object} Mapped object
   */
  mapRowToObject(row, conceptHeaders) {
    const obj = {}
    
    for (let i = 0; i < conceptHeaders.length; i++) {
      if (conceptHeaders[i] && row[i] !== undefined) {
        obj[conceptHeaders[i]] = row[i]
      }
    }
    
    return obj
  }

  /**
   * Create patient object from row data
   * @param {Object} rowData - Row data
   * @returns {Object} Patient object
   */
  createPatientFromRow(rowData) {
    return {
      PATIENT_CD: rowData.PATIENT_CD,
      SEX_CD: rowData.SEX_CD || 'U',
      AGE_IN_YEARS: rowData.AGE_IN_YEARS ? parseInt(rowData.AGE_IN_YEARS) : null,
      BIRTH_DATE: rowData.BIRTH_DATE || null,
      SOURCESYSTEM_CD: 'CSV_IMPORT',
      UPLOAD_ID: 1
    }
  }

  /**
   * Create visit object from row data
   * @param {Object} rowData - Row data
   * @param {number} patientNum - Patient number
   * @returns {Object} Visit object
   */
  createVisitFromRow(rowData, patientNum) {
    return {
      PATIENT_NUM: patientNum,
      ENCOUNTER_NUM: 1, // Default encounter number for CSV import
      START_DATE: rowData.START_DATE || null,
      LOCATION_CD: rowData.LOCATION_CD || 'UNKNOWN',
      INOUT_CD: rowData.INOUT_CD || 'O',
      SOURCESYSTEM_CD: 'CSV_IMPORT',
      UPLOAD_ID: 1
    }
  }

  /**
   * Create observations from row data
   * @param {Object} rowData - Row data
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @returns {Array} Observation objects
   */
  createObservationsFromRow(rowData, patientNum, encounterNum) {
    const observations = []
    
    // Skip patient and visit fields
    const skipFields = ['PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE', 'START_DATE', 'LOCATION_CD', 'INOUT_CD']
    
    for (const [field, value] of Object.entries(rowData)) {
      if (skipFields.includes(field) || !value || value.trim() === '') {
        continue
      }
      
      const observation = this.createObservationFromField(field, value, patientNum, encounterNum)
      if (observation) {
        observations.push(observation)
      }
    }
    
    return observations
  }

  /**
   * Create observation from field data
   * @param {string} field - Field name (CONCEPT_CD)
   * @param {string} value - Field value
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @returns {Object|null} Observation object or null
   */
  createObservationFromField(field, value, patientNum, encounterNum) {
    // Determine value type
    let valtype = 'T'
    let tval = value
    let nval = null
    let observationBlob = null
    
    // Try to parse as number
    if (!isNaN(value) && value.trim() !== '') {
      valtype = 'N'
      nval = parseFloat(value)
      tval = null
    }
    
    // Try to parse as date (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        valtype = 'D'
        tval = null
        // For date observations, we store the date in START_DATE field
      }
    }
    
    // Try to parse as JSON (for BLOB data)
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        const parsed = JSON.parse(value)
        valtype = 'B'
        observationBlob = JSON.stringify(parsed) // Compact JSON for CSV storage
        tval = null
        nval = null
      }
    } catch {
      // Not JSON, keep as text
    }
    
    return {
      PATIENT_NUM: patientNum,
      ENCOUNTER_NUM: encounterNum,
      CONCEPT_CD: field,
      VALTYPE_CD: valtype,
      TVAL_CHAR: tval,
      NVAL_NUM: nval,
      OBSERVATION_BLOB: observationBlob,
      START_DATE: valtype === 'D' ? value : new Date().toISOString().split('T')[0],
      SOURCESYSTEM_CD: 'CSV_IMPORT',
      UPLOAD_ID: 1
    }
  }

  /**
   * Set CSV configuration
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current CSV configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config }
  }
}

export default CsvService
