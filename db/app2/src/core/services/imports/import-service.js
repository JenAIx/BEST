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

// Import repositories for database operations
import PatientRepository from '../../database/repositories/patient-repository.js'
import VisitRepository from '../../database/repositories/visit-repository.js'
import ObservationRepository from '../../database/repositories/observation-repository.js'

export class ImportService {
  constructor(databaseStore, conceptRepository, cqlRepository) {
    this.databaseStore = databaseStore
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository

    // Initialize repositories for database operations
    this.patientRepo = new PatientRepository(databaseStore)
    this.visitRepo = new VisitRepository(databaseStore)
    this.observationRepo = new ObservationRepository(databaseStore)

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

      // If import was successful and we have clinical data, save it to database
      if (result.success && result.data) {
        try {
          const saveResult = await this.saveClinicalDataToDatabase(result.data, options)
          result.metadata = {
            ...result.metadata,
            savedToDatabase: saveResult.success,
            savedPatients: saveResult.patientsSaved,
            savedVisits: saveResult.visitsSaved,
            savedObservations: saveResult.observationsSaved,
          }

          if (!saveResult.success) {
            result.success = false
            result.errors = [...(result.errors || []), ...saveResult.errors]
          }

          logger.info('Database save completed', {
            success: saveResult.success,
            patients: saveResult.patientsSaved,
            visits: saveResult.visitsSaved,
            observations: saveResult.observationsSaved,
          })
        } catch (saveError) {
          logger.error('Database save failed', saveError)
          result.success = false
          result.errors = [
            ...(result.errors || []),
            {
              code: 'DATABASE_SAVE_FAILED',
              message: `Failed to save data to database: ${saveError.message}`,
              details: saveError,
            },
          ]
        }
      }

      logger.info('Import completed', {
        format,
        success: result.success,
        errors: result.errors?.length || 0,
        warnings: result.warnings?.length || 0,
        savedToDatabase: result.metadata?.savedToDatabase || false,
      })

      return result
    } catch (error) {
      logger.error('Import failed', error)
      return this.createErrorResult('IMPORT_FAILED', error.message)
    }
  }

  /**
   * Save clinical data to database
   * @param {Object} clinicalData - Processed clinical data
   * @param {Object} options - Save options
   * @returns {Promise<Object>} Save result
   */
  async saveClinicalDataToDatabase(clinicalData, options = {}) {
    const result = {
      success: true,
      patientsSaved: 0,
      visitsSaved: 0,
      observationsSaved: 0,
      errors: [],
    }

    // Maps to track original IDs to database-generated IDs
    const patientIdMap = new Map()
    const visitIdMap = new Map()

    console.log('Starting saveClinicalDataToDatabase', {
      patients: clinicalData.patients?.length || 0,
      visits: clinicalData.visits?.length || 0,
      observations: clinicalData.observations?.length || 0,
      hasPatients: !!clinicalData.patients,
      hasVisits: !!clinicalData.visits,
      hasObservations: !!clinicalData.observations,
    })

    try {
      // Save patients first and track their database-generated IDs
      if (clinicalData.patients && Array.isArray(clinicalData.patients)) {
        for (const patient of clinicalData.patients) {
          try {
            // Store the original patient ID
            const originalPatientId = patient.PATIENT_NUM

            // Add default fields if not present
            const patientData = {
              ...patient,
              UPDATE_DATE: patient.UPDATE_DATE || new Date().toISOString(),
              DOWNLOAD_DATE: patient.DOWNLOAD_DATE || new Date().toISOString(),
              IMPORT_DATE: patient.IMPORT_DATE || new Date().toISOString(),
              SOURCESYSTEM_CD: patient.SOURCESYSTEM_CD || 'IMPORT_SYSTEM',
              UPLOAD_ID: patient.UPLOAD_ID || 0,
            }

            // Remove the PATIENT_NUM field so SQLite can auto-generate it
            delete patientData.PATIENT_NUM

            // Debug patient data before save
            if (!global.firstPatientDataLogged) {
              console.log('First patient data to save:', patientData)
              global.firstPatientDataLogged = true
            }

            const savedPatient = await this.patientRepo.create(patientData)
            result.patientsSaved++

            // Debug saved patient result
            if (!global.firstSavedPatientLogged) {
              console.log('First saved patient result:', savedPatient)
              global.firstSavedPatientLogged = true
            }

            // Map the original ID to the database-generated ID
            patientIdMap.set(originalPatientId, savedPatient.PATIENT_NUM)

            logger.debug('Patient ID mapping created', {
              originalPatientId,
              databasePatientId: savedPatient.PATIENT_NUM,
              patientIdMapSize: patientIdMap.size,
            })

            // Debug first patient mapping
            if (!global.firstPatientLogged) {
              console.log('First patient mapping:', {
                originalPatientId,
                databasePatientId: savedPatient.PATIENT_NUM,
                patientIdMapKeys: Array.from(patientIdMap.keys()),
              })
              global.firstPatientLogged = true
            }
          } catch (error) {
            logger.warn('Failed to save patient', { patient, error: error.message })
            result.errors.push({
              code: 'PATIENT_SAVE_FAILED',
              message: `Failed to save patient: ${error.message}`,
              details: patient,
            })
          }
        }
      }

      // Save visits and track their database-generated IDs
      if (clinicalData.visits && Array.isArray(clinicalData.visits)) {
        for (const visit of clinicalData.visits) {
          try {
            // Store the original visit ID
            const originalVisitId = visit.ENCOUNTER_NUM

            // Map the patient ID to the database-generated patient ID
            const patientId = patientIdMap.get(visit.PATIENT_NUM) || visit.PATIENT_NUM

            // Add default fields if not present
            const visitData = {
              ...visit,
              PATIENT_NUM: patientId,
              UPDATE_DATE: visit.UPDATE_DATE || new Date().toISOString(),
              DOWNLOAD_DATE: visit.DOWNLOAD_DATE || new Date().toISOString(),
              IMPORT_DATE: visit.IMPORT_DATE || new Date().toISOString(),
              SOURCESYSTEM_CD: visit.SOURCESYSTEM_CD || 'IMPORT_SYSTEM',
              UPLOAD_ID: visit.UPLOAD_ID || 0,
            }

            // Remove the ENCOUNTER_NUM field so SQLite can auto-generate it
            delete visitData.ENCOUNTER_NUM

            const savedVisit = await this.visitRepo.create(visitData)
            result.visitsSaved++

            // Map the original ID to the database-generated ID
            visitIdMap.set(originalVisitId, savedVisit.ENCOUNTER_NUM)

            logger.debug('Visit ID mapping created', {
              originalVisitId,
              databaseVisitId: savedVisit.ENCOUNTER_NUM,
              patientId: patientId,
              visitIdMapSize: visitIdMap.size,
            })

            // Debug first visit mapping
            if (!global.firstVisitLogged) {
              console.log('First visit mapping:', {
                originalVisitId,
                databaseVisitId: savedVisit.ENCOUNTER_NUM,
                mappedPatientId: patientId,
                visitIdMapKeys: Array.from(visitIdMap.keys()),
              })
              global.firstVisitLogged = true
            }
          } catch (error) {
            logger.warn('Failed to save visit', { visit, error: error.message })
            result.errors.push({
              code: 'VISIT_SAVE_FAILED',
              message: `Failed to save visit: ${error.message}`,
              details: visit,
            })
          }
        }
      }

      // Save observations with mapped IDs
      if (clinicalData.observations && Array.isArray(clinicalData.observations)) {
        console.log(`Saving ${clinicalData.observations.length} observations`)
        for (const observation of clinicalData.observations) {
          try {
            // Map the patient and encounter IDs to database-generated IDs
            const patientNum = patientIdMap.get(observation.PATIENT_NUM) || observation.PATIENT_NUM
            const encounterNum = visitIdMap.get(observation.ENCOUNTER_NUM) || observation.ENCOUNTER_NUM

            // Debug problematic observations
            if (patientNum !== observation.PATIENT_NUM || encounterNum !== observation.ENCOUNTER_NUM) {
              if (!global.mappingDebugCount) global.mappingDebugCount = 0
              if (global.mappingDebugCount < 3) {
                console.log('Observation ID mapping worked', {
                  originalPatientNum: observation.PATIENT_NUM,
                  mappedPatientNum: patientNum,
                  originalEncounterNum: observation.ENCOUNTER_NUM,
                  mappedEncounterNum: encounterNum,
                })
                global.mappingDebugCount++
              }
            } else if (!global.noMappingDebugLogged) {
              console.log('Observation ID mapping failed (no mapping found)', {
                patientNum: observation.PATIENT_NUM,
                encounterNum: observation.ENCOUNTER_NUM,
                isPatientLevel: observation.ENCOUNTER_NUM === null || observation.ENCOUNTER_NUM === undefined,
                patientIdMapKeys: Array.from(patientIdMap.keys()),
                visitIdMapKeys: Array.from(visitIdMap.keys()),
                patientIdMapHasPatient: patientIdMap.has(observation.PATIENT_NUM),
                visitIdMapHasEncounter: visitIdMap.has(observation.ENCOUNTER_NUM),
              })
              global.noMappingDebugLogged = true
            }

            const observationData = {
              ENCOUNTER_NUM: encounterNum,
              PATIENT_NUM: patientNum,
              CONCEPT_CD: observation.CONCEPT_CD,
              PROVIDER_ID: observation.PROVIDER_ID,
              START_DATE: observation.START_DATE,
              INSTANCE_NUM: observation.INSTANCE_NUM || 1,
              VALTYPE_CD: observation.VALTYPE_CD,
              TVAL_CHAR: observation.TVAL_CHAR,
              NVAL_NUM: observation.NVAL_NUM,
              VALUEFLAG_CD: observation.VALUEFLAG_CD,
              QUANTITY_NUM: observation.QUANTITY_NUM,
              UNIT_CD: observation.UNIT_CD,
              END_DATE: observation.END_DATE,
              LOCATION_CD: observation.LOCATION_CD,
              CONFIDENCE_NUM: observation.CONFIDENCE_NUM,
              OBSERVATION_BLOB: observation.OBSERVATION_BLOB,
              UPDATE_DATE: observation.UPDATE_DATE || new Date().toISOString(),
              DOWNLOAD_DATE: observation.DOWNLOAD_DATE || new Date().toISOString(),
              IMPORT_DATE: observation.IMPORT_DATE || observation.IMPORT_SOURCE || new Date().toISOString(),
              SOURCESYSTEM_CD: observation.SOURCESYSTEM_CD || 'IMPORT_SYSTEM',
              UPLOAD_ID: observation.UPLOAD_ID || 0,
            }

            // Remove undefined values to avoid database errors
            Object.keys(observationData).forEach((key) => {
              if (observationData[key] === undefined) {
                delete observationData[key]
              }
            })

            await this.observationRepo.create(observationData)
            result.observationsSaved++
          } catch (error) {
            logger.warn('Failed to save observation', { observation, error: error.message })
            result.errors.push({
              code: 'OBSERVATION_SAVE_FAILED',
              message: `Failed to save observation: ${error.message}`,
              details: observation,
            })
          }
        }
      }

      // If any saves failed, mark as not successful but don't fail the whole operation
      if (result.errors.length > 0) {
        result.success = false
      }
    } catch (error) {
      logger.error('Critical database save error', error)
      result.success = false
      result.errors.push({
        code: 'DATABASE_ERROR',
        message: `Database error during save: ${error.message}`,
        details: error,
      })
    }

    return result
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
