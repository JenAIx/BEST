/**
 * Import Services Module
 *
 * Main entry point for all import functionality
 */

// Main orchestrator
import { ImportService } from './import-service.js'
export { ImportService, default as ImportServiceDefault } from './import-service.js'

// Base service
export { BaseImportService } from './base-import-service.js'

// Individual services
export { ImportCsvService } from './import-csv-service.js'
export { ImportJsonService } from './import-json-service.js'
export { ImportHl7Service } from './import-hl7-service.js'
export { ImportSurveyService } from './import-survey-service.js'

// Export supported formats
export const SUPPORTED_FORMATS = ['csv', 'json', 'hl7', 'html']

// Export default configuration
export const DEFAULT_IMPORT_CONFIG = {
  maxFileSize: '50MB',
  supportedFormats: ['csv', 'json', 'hl7', 'html'],
  validationLevel: 'strict',
  duplicateHandling: 'skip',
  batchSize: 1000,
  transactionMode: 'single',
}

// Factory function to create import service
export function createImportService(databaseStore, conceptRepository, cqlRepository) {
  return new ImportService(databaseStore, conceptRepository, cqlRepository)
}

// Utility functions
export function getSupportedFormats() {
  return [...SUPPORTED_FORMATS]
}

export function isFormatSupported(format) {
  return SUPPORTED_FORMATS.includes(format.toLowerCase())
}

export function getFormatFromFilename(filename) {
  const extension = filename.toLowerCase().split('.').pop()
  const extensionMap = {
    csv: 'csv',
    json: 'json',
    xml: 'hl7',
    hl7: 'hl7',
    html: 'html',
    htm: 'html',
  }
  return extensionMap[extension] || null
}
