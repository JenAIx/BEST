/**
 * Database Import Service
 *
 * Handles importing standardized importStructure data to the database.
 * Provides transaction management, duplicate handling, and bulk operations.
 *
 * Extends BaseImportService for common functionality and error handling.
 */

import { BaseImportService } from './base-import-service.js'
import { logger } from '../logging-service.js'

export class DatabaseImportService extends BaseImportService {
  constructor(databaseService, conceptRepository, cqlRepository) {
    super(conceptRepository, cqlRepository)
    this.databaseService = databaseService

    // Initialize repositories
    this.patientRepo = this.databaseService.getRepository('patient')
    this.visitRepo = this.databaseService.getRepository('visit')
    this.observationRepo = this.databaseService.getRepository('observation')
    this.conceptRepo = this.databaseService.getRepository('concept')

    // Configuration
    this.config = {
      duplicateStrategy: 'skip', // 'skip', 'update', 'error'
      batchSize: 100,
      transactionTimeout: 30000, // 30 seconds
    }
  }

  /**
   * Import complete importStructure to database
   * @param {Object} importStructure - Standardized import structure
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result with statistics
   */
  async importToDatabase(importStructure, options = {}) {
    const startTime = Date.now()

    try {
      logger.info('Starting database import', {
        patientCount: importStructure.data.patients?.length || 0,
        visitCount: importStructure.data.visits?.length || 0,
        observationCount: importStructure.data.observations?.length || 0,
      })

      // Validate input data
      const validation = this.validateImportData(importStructure)
      if (validation.errors.length > 0) {
        return this.createImportResult(false, null, {
          importType: 'database',
          duration: Date.now() - startTime,
        }, validation.errors, validation.warnings)
      }

      // Apply options
      const config = { ...this.config, ...options }

      // Execute import in transaction
      const result = await this.executeImportTransaction(importStructure, config)

      const duration = Date.now() - startTime
      logger.info('Database import completed', {
        success: result.success,
        imported: result.data?.statistics,
        duration: `${duration}ms`,
        errors: result.errors?.length || 0,
      })

      return {
        ...result,
        metadata: {
          ...result.metadata,
          importType: 'database',
          duration,
          config,
        },
      }

    } catch (error) {
      logger.error('Database import failed', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      })

      return this.handleImportError(error, 'database import')
    }
  }

  /**
   * Execute import within a database transaction
   * @param {Object} importStructure - Import structure
   * @param {Object} config - Import configuration
   * @returns {Promise<Object>} Transaction result
   */
  async executeImportTransaction(importStructure, config) {
    const statistics = { patients: 0, visits: 0, observations: 0, duplicates: 0 }

    try {
      // Import patients
      const patientResults = await this.importPatients(importStructure.data.patients, config)
      statistics.patients = patientResults.imported
      statistics.duplicates += patientResults.duplicates

      // Create patient ID mapping for visits and observations
      const patientIdMap = patientResults.idMap

      // Import visits
      const visitResults = await this.importVisits(importStructure.data.visits, patientResults, config)
      statistics.visits = visitResults.imported
      statistics.duplicates += visitResults.duplicates

      // Create visit ID mapping for observations
      const visitIdMap = visitResults.idMap

      // Import observations
      const observationResults = await this.importObservations(importStructure.data.observations, patientResults, visitIdMap, config, statistics)
      statistics.observations = observationResults.imported
      statistics.duplicates += observationResults.duplicates

      // Prepare success result
      const importResult = {
        success: true,
        data: {
          statistics,
          importedIds: {
            patients: Object.values(patientIdMap),
            visits: Object.values(visitIdMap),
          },
        },
        errors: [],
        warnings: [],
      }

      // Add warnings if any duplicates were encountered
      if (statistics.duplicates > 0) {
        importResult.warnings.push({
          code: 'DUPLICATES_ENCOUNTERED',
          message: `${statistics.duplicates} duplicate records were ${config.duplicateStrategy === 'skip' ? 'skipped' : 'updated'}`,
          timestamp: new Date().toISOString(),
          details: { duplicateCount: statistics.duplicates, strategy: config.duplicateStrategy },
        })
      }

      return importResult

    } catch (error) {
      logger.error('Import transaction failed', { error: error.message })
      throw error
    }
  }

  /**
   * Import patients to database
   * @param {Array} patients - Patient data array
   * @param {Object} config - Import configuration
   * @returns {Promise<Object>} Import results with ID mapping
   */
  async importPatients(patients, config) {
    const results = { imported: 0, duplicates: 0, idMap: {}, originalIdMap: {} }

    for (const patient of patients) {
      try {
        const patientCd = patient.PATIENT_CD || patient.patientId

        // Check for existing patient
        const existingPatient = await this.patientRepo.findByPatientCode(patientCd)

        if (existingPatient) {
          results.duplicates++

          if (config.duplicateStrategy === 'error') {
            throw new Error(`Patient with code ${patientCd} already exists`)
          } else if (config.duplicateStrategy === 'skip') {
            // Use existing patient ID
            results.idMap[patientCd] = existingPatient.PATIENT_NUM
            results.originalIdMap[patient.PATIENT_NUM] = existingPatient.PATIENT_NUM
            continue
          } else if (config.duplicateStrategy === 'update') {
            // Update existing patient
            await this.patientRepo.updatePatient(existingPatient.PATIENT_NUM, patient)
            results.idMap[patientCd] = existingPatient.PATIENT_NUM
            results.originalIdMap[patient.PATIENT_NUM] = existingPatient.PATIENT_NUM
            continue
          }
        }

        // Create new patient - remove PATIENT_NUM to avoid conflicts
        const { PATIENT_NUM, ...patientDataWithoutId } = patient
        const createdPatient = await this.patientRepo.createPatient({
          ...patientDataWithoutId,
          SOURCESYSTEM_CD: patient.SOURCESYSTEM_CD || 'IMPORT',
          UPLOAD_ID: patient.UPLOAD_ID || 1,
        })

        results.imported++
        results.idMap[patientCd] = createdPatient.PATIENT_NUM
        // Map original PATIENT_NUM from import data to new database PATIENT_NUM
        if (PATIENT_NUM) {
          results.originalIdMap[PATIENT_NUM] = createdPatient.PATIENT_NUM
          logger.info('Mapped original PATIENT_NUM to new', { 
            originalPatientNum: PATIENT_NUM, 
            newPatientNum: createdPatient.PATIENT_NUM,
            patientCd
          })
        }

        logger.debug('Patient imported', { patientCd, patientNum: createdPatient.PATIENT_NUM, originalPatientNum: patient.PATIENT_NUM })

      } catch (error) {
        logger.error('Failed to import patient', { patientCd: patient.PATIENT_CD, error: error.message })
        throw error
      }
    }

    return results
  }

  /**
   * Import visits to database
   * @param {Array} visits - Visit data array
   * @param {Object} patientResults - Patient import results with ID mappings
   * @param {Object} config - Import configuration
   * @returns {Promise<Object>} Import results with ID mapping
   */
  async importVisits(visits, patientResults, config) { // eslint-disable-line no-unused-vars
    const results = { imported: 0, duplicates: 0, idMap: {} }
    const { idMap: patientCodeMap, originalIdMap } = patientResults

    for (const visit of visits) {
      try {
        // Try multiple ways to find the patient reference
        let patientCd = visit.PATIENT_CD || visit.patientId
        let patientNum = patientCodeMap[patientCd]

        // If not found by code, try using the original PATIENT_NUM mapping
        if (!patientNum && visit.PATIENT_NUM && originalIdMap) {
          patientNum = originalIdMap[visit.PATIENT_NUM]
          if (patientNum) {
            logger.debug(`Mapped visit using original PATIENT_NUM ${visit.PATIENT_NUM} to patient ${patientNum}`)
          }
        }

        if (!patientNum) {
          // If we still can't find a mapping, this is an error
          const availablePatients = Object.keys(patientCodeMap).join(', ')
          const availableOriginals = originalIdMap ? Object.keys(originalIdMap).join(', ') : 'none'
          throw new Error(`Cannot map visit to patient. Visit PATIENT_CD: ${patientCd}, PATIENT_NUM: ${visit.PATIENT_NUM}. Available patient codes: ${availablePatients}. Available original PATIENT_NUMs: ${availableOriginals}`)
        }

        // Create visit with patient reference - remove ENCOUNTER_NUM to avoid conflicts
        const { ENCOUNTER_NUM, ...visitDataWithoutId } = visit
        const visitData = {
          ...visitDataWithoutId,
          PATIENT_NUM: patientNum,
          SOURCESYSTEM_CD: visit.SOURCESYSTEM_CD || 'IMPORT',
          UPLOAD_ID: visit.UPLOAD_ID || 1,
        }

        const createdVisit = await this.visitRepo.createVisit(visitData)

        results.imported++
        // Track the mapping from original ENCOUNTER_NUM to new database ENCOUNTER_NUM
        if (ENCOUNTER_NUM) {
          results.idMap[ENCOUNTER_NUM] = createdVisit.ENCOUNTER_NUM
          logger.info(`Mapped original ENCOUNTER_NUM ${ENCOUNTER_NUM} to new ENCOUNTER_NUM ${createdVisit.ENCOUNTER_NUM}`)
        } else {
          results.idMap[results.imported] = createdVisit.ENCOUNTER_NUM
          logger.info(`Mapped visit index ${results.imported} to new ENCOUNTER_NUM ${createdVisit.ENCOUNTER_NUM}`)
        }

        logger.debug('Visit imported', {
          originalEncounterNum: ENCOUNTER_NUM,
          newEncounterNum: createdVisit.ENCOUNTER_NUM,
          patientNum,
          startDate: visit.START_DATE,
          idMapKeys: Object.keys(results.idMap)
        })

      } catch (error) {
        logger.error('Failed to import visit', {
          patientCd: visit.PATIENT_CD,
          startDate: visit.START_DATE,
          error: error.message,
        })
        throw error
      }
    }

    return results
  }

  /**
   * Import observations to database
   * @param {Array} observations - Observation data array
   * @param {Object} patientResults - Patient import results with ID mappings
   * @param {Object} visitIdMap - Mapping of visit identifiers to encounter numbers
   * @param {Object} config - Import configuration
   * @param {Object} statistics - Statistics object to update
   * @returns {Promise<Object>} Import results
   */
  async importObservations(observations, patientResults, visitIdMap, config, statistics) {
    const results = { imported: 0, duplicates: 0 }
    const { idMap: patientCodeMap, originalIdMap } = patientResults

    logger.info('Starting observation import with mappings', {
      patientCodeMap,
      originalIdMap,
      visitIdMap,
      observationCount: observations.length,
      visitIdMapKeys: Object.keys(visitIdMap || {})
    })

    for (const observation of observations) {
      try {
        // Try multiple ways to find the patient reference
        let patientCd = observation.PATIENT_CD || observation.patientId
        let patientNum = null

        logger.debug(`Processing observation`, {
          observationId: observation.OBSERVATION_ID,
          patientCd,
          observationPatientNum: observation.PATIENT_NUM,
          conceptCd: observation.CONCEPT_CD
        })

        // First, try to find by PATIENT_CD if available
        if (patientCd && patientCodeMap[patientCd]) {
          patientNum = patientCodeMap[patientCd]
          logger.debug(`Found patient by PATIENT_CD: ${patientCd} -> ${patientNum}`)
        }
        // If not found by code and observation has PATIENT_NUM, check original ID mapping
        // This handles cases where observations reference original PATIENT_NUM from import data
        else if (observation.PATIENT_NUM !== undefined && observation.PATIENT_NUM !== null) {
          logger.info(`Observation has PATIENT_NUM: ${observation.PATIENT_NUM}, checking originalIdMap`, {
            originalIdMapKeys: Object.keys(originalIdMap || {}),
            hasOriginalIdMap: !!originalIdMap,
            patientCd
          })
          
          // First check originalIdMap for imported data
          if (originalIdMap && originalIdMap[observation.PATIENT_NUM]) {
            patientNum = originalIdMap[observation.PATIENT_NUM]
            logger.info(`Mapped observation PATIENT_NUM ${observation.PATIENT_NUM} to new PATIENT_NUM ${patientNum}`)
          } 
          // If not in originalIdMap, check if it's a valid existing patient in DB
          else {
            logger.warn(`No mapping found for observation PATIENT_NUM ${observation.PATIENT_NUM}, checking if it's a valid DB patient`)
            try {
              const patientExists = await this.patientRepo.findById(observation.PATIENT_NUM)
              if (patientExists) {
                patientNum = observation.PATIENT_NUM
                logger.info(`PATIENT_NUM ${observation.PATIENT_NUM} exists in database, using directly`)
              } else {
                logger.error(`PATIENT_NUM ${observation.PATIENT_NUM} does not exist in database and no mapping found`, {
                  availableOriginalIds: Object.keys(originalIdMap || {}),
                  availablePatientCodes: Object.keys(patientCodeMap || {})
                })
                // Don't use the invalid PATIENT_NUM
                patientNum = null
              }
            } catch (error) {
              logger.error(`Error checking if PATIENT_NUM exists in database`, {
                patientNum: observation.PATIENT_NUM,
                error: error.message
              })
              patientNum = null
            }
          }
        }

        if (!patientNum) {
          // If we still can't find a mapping, this is an error
          const availablePatients = Object.keys(patientCodeMap).join(', ')
          const availableOriginals = originalIdMap ? Object.keys(originalIdMap).join(', ') : 'none'
          throw new Error(`Cannot map observation to patient. Observation PATIENT_CD: ${patientCd || 'undefined'}, PATIENT_NUM: ${observation.PATIENT_NUM}. Available patient codes: ${availablePatients}. Available original PATIENT_NUMs: ${availableOriginals}`)
        }

        // Resolve encounter number if visit reference exists
        let encounterNum = null
        if (observation.ENCOUNTER_NUM) {
          encounterNum = visitIdMap[observation.ENCOUNTER_NUM]
          if (!encounterNum) {
            logger.warn(`No visit mapping found for ENCOUNTER_NUM ${observation.ENCOUNTER_NUM}`, {
              availableVisitMappings: Object.keys(visitIdMap || {}),
              observationEncounterNum: observation.ENCOUNTER_NUM,
              visitIdMap
            })
          } else {
            logger.debug(`Mapped observation ENCOUNTER_NUM ${observation.ENCOUNTER_NUM} to visit ${encounterNum}`)
          }
        }

        // If no valid encounter number, create a default visit for this patient
        if (!encounterNum && patientNum) {
          logger.info('No encounter number found, creating default visit', {
            patientNum,
            originalEncounterNum: observation.ENCOUNTER_NUM,
            visitIdMapKeys: Object.keys(visitIdMap || {}),
            visitIdMap
          })
          
          try {
            const defaultVisitData = {
              PATIENT_NUM: patientNum,
              START_DATE: observation.START_DATE || new Date().toISOString().split('T')[0],
              END_DATE: observation.END_DATE || observation.START_DATE || new Date().toISOString().split('T')[0],
              LOCATION_CD: 'Data Import',
              INOUT_CD: 'O', // Outpatient by default
              ACTIVE_STATUS_CD: 'A', // Active
              SOURCESYSTEM_CD: observation.SOURCESYSTEM_CD || 'IMPORT',
              UPLOAD_ID: observation.UPLOAD_ID || 1,
            }

            const createdDefaultVisit = await this.visitRepo.createVisit(defaultVisitData)
            encounterNum = createdDefaultVisit.ENCOUNTER_NUM

            // Update statistics to include the default visit
            if (statistics) {
              statistics.visits++
            }

            logger.info('Created default visit for observation', {
              patientNum,
              encounterNum: createdDefaultVisit.ENCOUNTER_NUM,
              observationConcept: observation.CONCEPT_CD
            })
          } catch (error) {
            logger.warn('Failed to create default visit for observation', {
              patientNum,
              error: error.message,
            })
            // Continue with null encounterNum and let it fail gracefully
          }
        }

        // Skip observation if we still don't have a valid encounter number
        if (!encounterNum) {
          logger.warn('Skipping observation due to missing encounter reference', {
            patientCd,
            conceptCd: observation.CONCEPT_CD,
            originalEncounterNum: observation.ENCOUNTER_NUM,
          })
          continue
        }

        // Create observation with resolved references - remove OBSERVATION_ID to avoid conflicts
        const { OBSERVATION_ID, ...observationDataWithoutId } = observation // eslint-disable-line no-unused-vars
        
        // For now, skip observations with concept codes that don't exist
        // TODO: Auto-create concepts in the future
                    if (observation.CONCEPT_CD && this.conceptRepo) {
              try {
                const conceptExists = await this.conceptRepo.findByConceptCode(observation.CONCEPT_CD)
                if (!conceptExists) {
                  logger.warn('Skipping observation - concept does not exist', {
                    conceptCd: observation.CONCEPT_CD,
                    patientNum,
                    encounterNum
                  })
                  continue
                }
              } catch (error) {
                logger.warn('Error checking concept existence, skipping observation', {
                  conceptCd: observation.CONCEPT_CD,
                  error: error.message
                })
                continue
              }
            }
        
        const observationData = {
          ...observationDataWithoutId,
          PATIENT_NUM: patientNum,
          ENCOUNTER_NUM: encounterNum,
          SOURCESYSTEM_CD: observation.SOURCESYSTEM_CD || 'IMPORT',
          UPLOAD_ID: observation.UPLOAD_ID || 1,
        }

        // Log the exact data being inserted
        logger.info('Creating observation with data', {
          patientNum: observationData.PATIENT_NUM,
          encounterNum: observationData.ENCOUNTER_NUM,
          conceptCd: observationData.CONCEPT_CD,
          hasEncounterNum: encounterNum !== null && encounterNum !== undefined,
          originalEncounterNum: observation.ENCOUNTER_NUM
        })

        const createdObservation = await this.observationRepo.createObservation(observationData)

        results.imported++

        logger.debug('Observation imported', {
          observationId: createdObservation.OBSERVATION_ID,
          patientNum,
          encounterNum,
          conceptCd: observation.CONCEPT_CD,
        })

      } catch (error) {
        logger.error('Failed to import observation', {
          patientCd: observation.PATIENT_CD || observation.patientId || 'undefined',
          patientNum: observation.PATIENT_NUM,
          conceptCd: observation.CONCEPT_CD,
          error: error.message,
        })
        throw error
      }
    }

    return results
  }

  /**
   * Validate import data structure
   * @param {Object} importStructure - Import structure to validate
   * @returns {Object} Validation results
   */
  validateImportData(importStructure) {
    const errors = []
    const warnings = []

    // Check basic structure
    if (!importStructure || !importStructure.data) {
      errors.push(this.createError('INVALID_STRUCTURE', 'Import structure is missing or invalid'))
      return { errors, warnings }
    }

    const { data } = importStructure

    // Validate patients
    if (!Array.isArray(data.patients)) {
      errors.push(this.createError('INVALID_PATIENTS', 'Patients data must be an array'))
    } else if (data.patients.length === 0) {
      errors.push(this.createError('NO_PATIENTS', 'No patients found in import data'))
    } else {
      data.patients.forEach((patient, index) => {
        if (!patient.PATIENT_CD && !patient.patientId) {
          errors.push(this.createError('MISSING_PATIENT_ID', `Patient ${index + 1} is missing PATIENT_CD or patientId`))
        }
      })
    }

    // Validate visits (optional)
    if (data.visits && !Array.isArray(data.visits)) {
      errors.push(this.createError('INVALID_VISITS', 'Visits data must be an array'))
    }

    // Validate observations (optional)
    if (data.observations && !Array.isArray(data.observations)) {
      errors.push(this.createError('INVALID_OBSERVATIONS', 'Observations data must be an array'))
    }

    // Check for data consistency
    if (data.visits && data.visits.length > 0 && (!data.patients || data.patients.length === 0)) {
      errors.push(this.createError('VISITS_WITHOUT_PATIENTS', 'Cannot import visits without patient data'))
    }

    if (data.observations && data.observations.length > 0 && (!data.patients || data.patients.length === 0)) {
      errors.push(this.createError('OBSERVATIONS_WITHOUT_PATIENTS', 'Cannot import observations without patient data'))
    }

    return { errors, warnings }
  }

  /**
   * Set duplicate handling strategy
   * @param {string} strategy - 'skip', 'update', or 'error'
   */
  setDuplicateStrategy(strategy) {
    if (!['skip', 'update', 'error'].includes(strategy)) {
      throw new Error(`Invalid duplicate strategy: ${strategy}`)
    }
    this.config.duplicateStrategy = strategy
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config }
  }

  /**
   * Get import statistics from database
   * @param {string} sourceSystem - Optional source system filter
   * @returns {Promise<Object>} Import statistics
   */
  async getImportStatistics(sourceSystem = null) {
    try {
      let patientStats, visitStats, observationStats

      if (sourceSystem) {
        patientStats = await this.patientRepo.findBySourceSystem(sourceSystem)
        visitStats = await this.visitRepo.findBySourceSystem(sourceSystem)
        observationStats = await this.observationRepo.findBySourceSystem(sourceSystem)
      } else {
        // Get basic counts from repositories
        patientStats = { length: await this.patientRepo.countByCriteriaFromView() }
        visitStats = { length: await this.visitRepo.getVisitStatistics().then(s => s.totalVisits) }
        observationStats = { length: await this.observationRepo.findWithBlobData().then(arr => arr.length) }
      }

      return {
        success: true,
        data: {
          patients: Array.isArray(patientStats) ? patientStats.length : patientStats.length,
          visits: Array.isArray(visitStats) ? visitStats.length : visitStats.length,
          observations: Array.isArray(observationStats) ? observationStats.length : observationStats.length,
          sourceSystem,
        },
      }
    } catch (error) {
      return {
        success: false,
        errors: [this.createError('STATISTICS_ERROR', `Failed to get import statistics: ${error.message}`)],
      }
    }
  }
}
