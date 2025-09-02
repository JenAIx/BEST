/**
 * Import Service
 *
 * Main service for handling file imports. Uses modular approach with:
 * - import-structure.js for standardized data structure
 * - import-filetype.js for file type detection
 * - Individual import services for format-specific processing
 */

import { ImportCsvService } from './import-csv-service.js'
import { ImportJsonService } from './import-json-service.js'
import { ImportHl7Service } from './import-hl7-service.js'
import { ImportSurveyService } from './import-survey-service.js'
import { createImportStructure, getImportStructure } from './import-structure.js'
import { detectFormat, validateFileSize, SUPPORTED_FORMATS } from './import-filetype.js'
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
      supportedFormats: SUPPORTED_FORMATS,
    }
  }

  /**
   * Get the standard import structure template
   * @returns {Object} Standard import structure
   */
  getImportStructure() {
    return getImportStructure()
  }

  /**
   * Create a new import structure instance
   * @param {Object} overrides - Properties to override in the structure
   * @returns {Object} New import structure instance
   */
  createImportStructure(overrides = {}) {
    return createImportStructure(overrides)
  }

  /**
   * Detect file format based on content and filename
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {string|null} Detected format
   */
  detectFormat(content, filename) {
    return detectFormat(content, filename)
  }

  /**
   * Validate file size
   * @param {string} content - File content
   * @returns {boolean} True if valid size
   */
  validateFileSize(content) {
    return validateFileSize(content, this.config.maxFileSize)
  }

  /**
   * Get supported formats
   * @returns {Array<string>} List of supported formats
   */
  getSupportedFormats() {
    return this.config.supportedFormats
  }

  /**
   * Import file content using appropriate service
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result with importStructure format
   */
  async importFile(content, filename, options = {}) {
    try {
      logger.info('Starting file import', { filename, contentLength: content?.length })

      // Validate inputs
      if (!content) {
        return this.createErrorResult('INVALID_CONTENT', 'File content is empty or undefined')
      }

      if (!filename) {
        return this.createErrorResult('INVALID_FILENAME', 'Filename is undefined')
      }

      // Validate file size
      if (!this.validateFileSize(content)) {
        return this.createErrorResult('FILE_TOO_LARGE', `File size exceeds maximum allowed size of ${this.config.maxFileSize}`)
      }

      // Detect format
      const format = this.detectFormat(content, filename)
      if (!format) {
        return this.createErrorResult('UNSUPPORTED_FORMAT', `Unsupported file format for ${filename}`)
      }

      logger.info('File format detected', { format, filename })

      // Import using appropriate service
      const service = this.services[format]
      if (!service) {
        return this.createErrorResult('NO_SERVICE_AVAILABLE', `No import service available for format: ${format}`)
      }

      // Call the appropriate import method
      let result
      switch (format) {
        case 'html':
          result = await service.importFromHtml(content, options, this)
          break
        case 'json':
          result = await service.importFromJson(content, options, this)
          break
        case 'csv':
          result = await service.importFromCsv(content, options, this)
          break
        case 'hl7':
          result = await service.importFromHl7(content, options, this)
          break
        default:
          return this.createErrorResult('UNSUPPORTED_FORMAT', `Format ${format} is not yet implemented`)
      }

      if (result.success) {
        logger.info('File import completed successfully', {
          format,
          filename,
          patients: result.data?.data?.patients?.length || 0,
          visits: result.data?.data?.visits?.length || 0,
          observations: result.data?.data?.observations?.length || 0
        })
      } else {
        logger.warn('File import failed', { format, filename, errors: result.errors })
      }

      return result

    } catch (error) {
      logger.error('File import failed with exception', {
        error: error.message,
        stack: error.stack,
        filename,
        contentLength: content?.length
      })
      return this.createErrorResult('IMPORT_FAILED', `Import failed: ${error.message}`)
    }
  }

  /**
   * Analyze file content without importing
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeFile(content, filename) {
    try {
      logger.info('Starting file analysis', { filename, contentLength: content?.length })

      // Validate inputs
      if (!content) {
        return this.createErrorResult('INVALID_CONTENT', 'File content is empty or undefined')
      }

      if (!filename) {
        return this.createErrorResult('INVALID_FILENAME', 'Filename is undefined')
      }

      // Detect format
      const format = this.detectFormat(content, filename)
      if (!format) {
        return this.createErrorResult('UNSUPPORTED_FORMAT', `Unsupported file format for ${filename}`)
      }

      // Basic analysis result
      const analysis = {
        success: true,
        format,
        filename,
        fileSize: content.length,
        estimatedImportTime: this.estimateImportTime(content.length),
        isSupported: this.config.supportedFormats.includes(format),
        validFileSize: this.validateFileSize(content),
        maxFileSize: this.config.maxFileSize
      }

      logger.info('File analysis completed', { format, filename, fileSize: analysis.fileSize })

      return {
        success: true,
        data: analysis,
        errors: [],
        warnings: []
      }

    } catch (error) {
      logger.error('File analysis failed', {
        error: error.message,
        stack: error.stack,
        filename,
        contentLength: content?.length
      })
      return this.createErrorResult('ANALYSIS_FAILED', `Analysis failed: ${error.message}`)
    }
  }

  /**
   * Estimate import time based on file size
   * @param {number} fileSize - File size in bytes
   * @returns {string} Estimated time
   */
  estimateImportTime(fileSize) {
    if (fileSize === 0) return 'Instant'
    if (fileSize <= 1024) return '< 1 second'
    if (fileSize <= 10 * 1024) return '< 10 seconds'
    if (fileSize <= 100 * 1024) return '< 1 minute'
    if (fileSize <= 1024 * 1024) return '1-2 minutes'
    if (fileSize <= 10 * 1024 * 1024) return '2-5 minutes'
    return '5+ minutes'
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
}
