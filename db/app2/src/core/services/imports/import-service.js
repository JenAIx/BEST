/**
 * Main Import Service Orchestrator
 *
 * Central service that handles format detection, routing to appropriate
 * import services, and provides unified import functionality.
 */

import { ImportCsvService } from './import-csv-service.js'
import { ImportJsonService } from './import-json-service.js'
import { ImportHl7Service } from './import-hl7-service.js'
import { ImportSurveyService } from './import-survey-service.js'
import { logger } from '../logging-service.js'

export class ImportService {
  constructor(databaseStore, conceptRepository, cqlRepository) {
    this.databaseStore = databaseStore
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository

    // Initialize individual import services
    this.services = {
      csv: new ImportCsvService(conceptRepository, cqlRepository),
      json: new ImportJsonService(conceptRepository, cqlRepository),
      hl7: new ImportHl7Service(conceptRepository, cqlRepository),
      html: new ImportSurveyService(conceptRepository, cqlRepository),
    }

    // Configuration
    this.config = {
      maxFileSize: '50MB',
      supportedFormats: ['csv', 'json', 'hl7', 'html'],
      validationLevel: 'strict',
      duplicateHandling: 'skip',
      batchSize: 1000,
      transactionMode: 'single',
    }
  }

  /**
   * Detect file format based on content and extension
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {string} Detected format ('csv', 'json', 'hl7', 'html', or null)
   */
  detectFormat(content, filename) {
    const extension = filename.toLowerCase().split('.').pop()

    // Check by extension first
    if (extension === 'csv') return 'csv'
    if (extension === 'json') return 'json'
    if (extension === 'xml' || extension === 'hl7') return 'hl7'
    if (extension === 'html' || extension === 'htm') return 'html'

    // Check by content analysis (order matters - more specific checks first)
    if (this.isCsvContent(content)) return 'csv'
    if (this.isHtmlContent(content)) return 'html'
    if (this.isHl7Content(content)) return 'hl7'
    if (this.isJsonContent(content)) return 'json'

    return null
  }

  /**
   * Check if content is CSV format
   * @param {string} content - File content
   * @returns {boolean} True if CSV
   */
  isCsvContent(content) {
    const lines = content.split('\n').filter((line) => line.trim())
    if (lines.length < 2) return false

    // Check for comma or semicolon separators
    const firstLine = lines[0]
    const commaCount = (firstLine.match(/,/g) || []).length
    const semicolonCount = (firstLine.match(/;/g) || []).length

    return commaCount > 0 || semicolonCount > 0
  }

  /**
   * Check if content is JSON format
   * @param {string} content - File content
   * @returns {boolean} True if JSON
   */
  isJsonContent(content) {
    const trimmed = content.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false

    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if content is HL7 format
   * @param {string} content - File content
   * @returns {boolean} True if HL7
   */
  isHl7Content(content) {
    const trimmed = content.trim()

    // Check for FHIR structure
    if (trimmed.includes('"resourceType"')) return true

    // Check for HL7 XML structure
    if (trimmed.includes('<ClinicalDocument') || trimmed.includes('<hl7:')) return true

    return false
  }

  /**
   * Check if content is HTML format
   * @param {string} content - File content
   * @returns {boolean} True if HTML
   */
  isHtmlContent(content) {
    const trimmed = content.trim()
    return trimmed.includes('<html') || trimmed.includes('<HTML') || (trimmed.includes('<script') && trimmed.includes('cda'))
  }

  /**
   * Import file content using detected format
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFile(content, filename, options = {}) {
    try {
      logger.info('Starting file import', { filename, contentLength: content.length })

      // Detect format
      const format = this.detectFormat(content, filename)
      if (!format) {
        return this.createErrorResult('UNSUPPORTED_FORMAT', `Unsupported file format for ${filename}`)
      }

      logger.info('Detected file format', { format, filename })

      // Route to appropriate service
      const service = this.services[format]
      if (!service) {
        return this.createErrorResult('SERVICE_NOT_FOUND', `No import service available for format: ${format}`)
      }

      // Call the appropriate import method
      let result
      switch (format) {
        case 'csv':
          result = await service.importFromCsv(content, options)
          break
        case 'json':
          result = await service.importFromJson(content, options)
          break
        case 'hl7':
          result = await service.importFromHl7(content)
          break
        case 'html':
          result = await service.importFromHtml(content, options)
          break
        default:
          return this.createErrorResult('UNSUPPORTED_FORMAT', `Unsupported format: ${format}`)
      }

      logger.info('Import completed', {
        format,
        success: result.success,
        errors: result.errors?.length || 0,
        warnings: result.warnings?.length || 0,
      })

      return result
    } catch (error) {
      logger.error('Import failed', error)
      return this.createErrorResult('IMPORT_FAILED', error.message)
    }
  }

  /**
   * Import data for specific patient and visit
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importForPatient(content, filename, patientNum, encounterNum, options = {}) {
    try {
      logger.info('Starting patient-specific import', {
        filename,
        patientNum,
        encounterNum,
        contentLength: content.length,
      })

      const result = await this.importFile(content, filename, options)

      if (result.success && result.data) {
        // Associate imported data with patient/visit if needed
        result.data.patientNum = patientNum
        result.data.encounterNum = encounterNum

        logger.info('Patient import completed successfully', {
          patientNum,
          encounterNum,
          dataImported: {
            patients: result.data.patients?.length || 0,
            visits: result.data.visits?.length || 0,
            observations: result.data.observations?.length || 0,
          },
        })
      }

      return result
    } catch (error) {
      logger.error('Patient import failed', error)
      return this.createErrorResult('PATIENT_IMPORT_FAILED', error.message)
    }
  }

  /**
   * Get supported formats
   * @returns {Array<string>} List of supported formats
   */
  getSupportedFormats() {
    return this.config.supportedFormats
  }

  /**
   * Update import configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    logger.info('Import configuration updated', this.config)
  }

  /**
   * Create error result
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @returns {Object} Error result
   */
  createErrorResult(code, message) {
    return {
      success: false,
      data: null,
      metadata: {
        importDate: new Date().toISOString(),
        service: 'ImportService',
      },
      errors: [
        {
          code,
          message,
          timestamp: new Date().toISOString(),
        },
      ],
      warnings: [],
    }
  }

  /**
   * Validate file size
   * @param {string} content - File content
   * @returns {boolean} True if valid size
   */
  validateFileSize(content) {
    const maxSize = this.parseFileSize(this.config.maxFileSize)
    return content.length <= maxSize
  }

  /**
   * Parse file size string to bytes
   * @param {string} sizeStr - Size string like '50MB'
   * @returns {number} Size in bytes
   */
  parseFileSize(sizeStr) {
    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    }

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
    if (!match) return 50 * 1024 * 1024 // Default 50MB

    const size = parseFloat(match[1])
    const unit = match[2].toUpperCase()

    return size * (units[unit] || 1)
  }
}

export default ImportService
