/**
 * Import Analysis Service
 *
 * Service that handles format detection and content analysis for import files.
 * Focuses on analyzing file structure and determining import strategies.
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

    // Initialize individual import services for analysis only
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
   * Analyze file content and return detailed structure information
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Analysis result with file structure information
   */
  async analyzeFileContent(content, filename) {
    try {
      // Validate input parameters
      if (!content) {
        logger.error('File content analysis failed: content is undefined', { filename })
        return this.createErrorResult('INVALID_CONTENT', 'File content is empty or undefined', filename)
      }

      if (!filename) {
        logger.error('File content analysis failed: filename is undefined')
        return this.createErrorResult('INVALID_FILENAME', 'Filename is undefined', 'unknown')
      }

      logger.info('Starting file content analysis', {
        filename,
        contentLength: content.length,
        contentType: typeof content,
      })

      // Detect format first
      const format = this.detectFormat(content, filename)
      if (!format) {
        return this.createErrorResult('UNSUPPORTED_FORMAT', `Unsupported file format for ${filename}`, filename)
      }

      const analysis = {
        success: true,
        format,
        filename,
        fileSize: content.length,
        patientsCount: 0,
        visitsCount: 0,
        observationsCount: 0,
        hasMultiplePatients: false,
        hasMultipleVisits: false,
        patients: [],
        visits: [],
        observations: [], // Detailed observation data
        estimatedImportTime: 'Unknown',
        recommendedStrategy: 'single_patient', // 'single_patient', 'multiple_visits', 'multiple_patients', 'batch_import'
        warnings: [],
        errors: [],
      }

      // Format-specific analysis
      switch (format) {
        case 'csv':
          await this.analyzeCsvContent(content, analysis)
          break
        case 'json':
          await this.analyzeJsonContent(content, analysis)
          break
        case 'hl7':
          await this.analyzeHl7Content(content, analysis)
          break
        case 'html':
          await this.analyzeHtmlContent(content, analysis)
          break
      }

      // Check if format-specific analysis failed (only for JSON parsing errors, not CSV warnings)
      if (analysis.errors && analysis.errors.length > 0 && format !== 'csv') {
        analysis.success = false
      }

      // Determine recommended strategy
      this.determineRecommendedStrategy(analysis)

      // Estimate import time
      analysis.estimatedImportTime = this.estimateImportTime(analysis)

      logger.info('File content analysis completed', {
        format,
        patientsCount: analysis.patientsCount,
        visitsCount: analysis.visitsCount,
        observationsCount: analysis.observationsCount,
        recommendedStrategy: analysis.recommendedStrategy,
      })

      return analysis
    } catch (error) {
      logger.error('File content analysis failed', {
        error: error.message,
        stack: error.stack,
        filename,
        contentLength: content?.length,
        contentType: typeof content,
        errorType: error.constructor.name,
      })
      return this.createErrorResult('ANALYSIS_FAILED', error.message, filename)
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
      // Store actual IDs for patient-specific imports
      actualPatientNum: null,
      actualEncounterNum: null,
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
      targetPatientNum: options.targetPatientNum,
      targetEncounterNum: options.targetEncounterNum,
    })

    // Handle patient-specific imports with relaxed ID approach
    let actualPatientNum = null
    let actualEncounterNum = null

    if (options.targetPatientNum && options.targetEncounterNum) {
      try {
        // Relaxed approach: Create patient/visit without forcing specific IDs
        // Let the database auto-generate IDs and map them properly

        console.log('Starting patient-specific import with relaxed IDs', {
          targetPatientNum: options.targetPatientNum,
          targetEncounterNum: options.targetEncounterNum,
          hasClinicalData: !!clinicalData,
          hasPatients: !!(clinicalData && clinicalData.patients),
          patientsLength: clinicalData?.patients?.length || 0,
        })

        // Create a patient (ID will be auto-generated)
        const patientData = clinicalData.patients && clinicalData.patients[0] ? { ...clinicalData.patients[0] } : { PATIENT_CD: `PATIENT_${Date.now()}` }

        delete patientData.PATIENT_NUM // Let database auto-generate
        patientData.UPDATE_DATE = new Date().toISOString()
        patientData.DOWNLOAD_DATE = new Date().toISOString()
        patientData.IMPORT_DATE = new Date().toISOString()
        patientData.SOURCESYSTEM_CD = patientData.SOURCESYSTEM_CD || 'IMPORT_SYSTEM'
        patientData.UPLOAD_ID = 0

        console.log('Attempting to save patient with data:', patientData)

        const savedPatient = await this.patientRepo.createPatient(patientData)
        actualPatientNum = savedPatient.PATIENT_NUM
        result.actualPatientNum = actualPatientNum // Store in result
        result.patientsSaved++
        console.log('Created patient with relaxed ID:', actualPatientNum)

        // Create a visit (ID will be auto-generated)
        const visitData = clinicalData.visits && clinicalData.visits[0] ? { ...clinicalData.visits[0] } : { ENCOUNTER_CD: `ENCOUNTER_${Date.now()}` }

        delete visitData.ENCOUNTER_NUM // Let database auto-generate
        visitData.PATIENT_NUM = actualPatientNum
        visitData.START_DATE = visitData.START_DATE || new Date().toISOString().split('T')[0]
        visitData.UPDATE_DATE = new Date().toISOString()
        visitData.DOWNLOAD_DATE = new Date().toISOString()
        visitData.IMPORT_DATE = new Date().toISOString()
        visitData.SOURCESYSTEM_CD = visitData.SOURCESYSTEM_CD || 'IMPORT_SYSTEM'
        visitData.UPLOAD_ID = 0

        const savedVisit = await this.visitRepo.createVisit(visitData)
        actualEncounterNum = savedVisit.ENCOUNTER_NUM
        result.actualEncounterNum = actualEncounterNum // Store in result
        result.visitsSaved++
        console.log('Created visit with relaxed ID:', actualEncounterNum)

        // Map all patient IDs in the imported data to the actual patient ID
        if (clinicalData.patients) {
          clinicalData.patients.forEach((patient) => {
            patientIdMap.set(patient.PATIENT_NUM, actualPatientNum)
          })
        }
        // Also map the requested target ID
        patientIdMap.set(options.targetPatientNum, actualPatientNum)

        // Map all visit IDs in the imported data to the actual encounter ID
        if (clinicalData.visits) {
          clinicalData.visits.forEach((visit) => {
            visitIdMap.set(visit.ENCOUNTER_NUM, actualEncounterNum)
          })
        }
        // Also map the requested target ID
        visitIdMap.set(options.targetEncounterNum, actualEncounterNum)

        // Debug logging
        console.log('Patient-specific import ID mappings (relaxed):', {
          requestedPatientNum: options.targetPatientNum,
          requestedEncounterNum: options.targetEncounterNum,
          actualPatientNum,
          actualEncounterNum,
          patientIdMapEntries: Array.from(patientIdMap.entries()),
          visitIdMapEntries: Array.from(visitIdMap.entries()),
        })

        // For patient-specific imports, skip normal patient/visit processing
        // and go directly to observations
      } catch (error) {
        console.error('Error setting up patient-specific import:', error)
        logger.error('Error setting up patient-specific import', error)
        result.errors.push({
          code: 'PATIENT_SETUP_ERROR',
          message: `Failed to setup patient/encounter: ${error.message}`,
          details: error,
          stack: error.stack,
        })
        result.success = false
      }
    }

    try {
      // Save patients first and track their database-generated IDs
      // Only process if not a patient-specific import
      if (!options.targetPatientNum && clinicalData.patients && Array.isArray(clinicalData.patients)) {
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
      // Only process if not a patient-specific import
      if (!options.targetPatientNum && clinicalData.visits && Array.isArray(clinicalData.visits)) {
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
            let patientNum = patientIdMap.get(observation.PATIENT_NUM) || observation.PATIENT_NUM
            let encounterNum = visitIdMap.get(observation.ENCOUNTER_NUM) || observation.ENCOUNTER_NUM

            // If observation doesn't have PATIENT_NUM, try to get it from the visit
            if (!patientNum && encounterNum) {
              // Find the visit with this encounter number
              const visit = clinicalData.visits.find((v) => v.ENCOUNTER_NUM === observation.ENCOUNTER_NUM)
              if (visit && visit.PATIENT_NUM) {
                patientNum = patientIdMap.get(visit.PATIENT_NUM) || visit.PATIENT_NUM
              }
            }

            // If still no patient number and we only have one patient, use that
            if (!patientNum && clinicalData.patients && clinicalData.patients.length === 1) {
              patientNum = patientIdMap.values().next().value || clinicalData.patients[0].PATIENT_NUM
            }

            // For patient-specific imports, use the actual IDs that were created
            if (options.targetPatientNum) {
              // Use the actual IDs from the relaxed ID approach
              const actualPatient = result.actualPatientNum || options.targetPatientNum
              const actualEncounter = result.actualEncounterNum || options.targetEncounterNum

              // Debug what's happening before override
              if (!global.patientSpecificDebugLogged) {
                console.log('Patient-specific observation mapping:', {
                  originalPatientNum: observation.PATIENT_NUM,
                  mappedPatientNum: patientNum,
                  requestedPatientNum: options.targetPatientNum,
                  actualPatientNum: actualPatient,
                  originalEncounterNum: observation.ENCOUNTER_NUM,
                  mappedEncounterNum: encounterNum,
                  requestedEncounterNum: options.targetEncounterNum,
                  actualEncounterNum: actualEncounter,
                })
                global.patientSpecificDebugLogged = true
              }

              patientNum = actualPatient
              encounterNum = actualEncounter
            }

            // Debug missing patient num
            if (!patientNum && !global.patientNumDebugLogged) {
              console.log('Observation missing PATIENT_NUM debug:', {
                observation,
                patientNum,
                encounterNum,
                clinicalDataPatientsLength: clinicalData.patients ? clinicalData.patients.length : 0,
                patientIdMapSize: patientIdMap.size,
                visitIdMapSize: visitIdMap.size,
              })
              global.patientNumDebugLogged = true
            }

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

      // Get selected patient data for HL7 imports
      let targetPatientData = null
      if (patientNum) {
        try {
          const patientResult = await this.databaseStore.executeQuery(`SELECT * FROM PATIENT_DIMENSION WHERE PATIENT_NUM = ?`, [patientNum])
          if (patientResult.success && patientResult.data.length > 0) {
            targetPatientData = patientResult.data[0]
          }
        } catch (error) {
          logger.warn('Failed to load target patient data', error)
        }
      }

      // Pass the patient/encounter IDs through options so they can be used during import
      const importOptions = {
        ...options,
        targetPatientNum: patientNum,
        targetEncounterNum: encounterNum,
        targetPatientData: targetPatientData,
        createMultipleVisits: options.createMultipleVisits !== false, // Default to true
      }

      const result = await this.importFile(content, filename, importOptions)

      // Always ensure result.data exists for patient/encounter association
      if (!result.data) {
        result.data = {}
      }

      // Associate imported data with patient/visit
      // Use actual IDs if they were generated (relaxed ID approach)
      result.data.patientNum = result.actualPatientNum || patientNum
      result.data.encounterNum = result.actualEncounterNum || encounterNum

      // Also pass through the actual IDs for test verification
      if (result.actualPatientNum) {
        result.data.actualPatientNum = result.actualPatientNum
      }
      if (result.actualEncounterNum) {
        result.data.actualEncounterNum = result.actualEncounterNum
      }

      if (result.success) {
        logger.info('Patient import completed successfully', {
          patientNum,
          encounterNum,
          dataImported: {
            patients: result.data.patients?.length || 0,
            visits: result.data.visits?.length || 0,
            observations: result.data.observations?.length || 0,
          },
        })
      } else {
        logger.warn('Patient import completed with errors', {
          patientNum,
          encounterNum,
          errors: result.errors?.length || 0,
        })
      }

      return result
    } catch (error) {
      logger.error('Patient import failed', error)
      const errorResult = this.createErrorResult('PATIENT_IMPORT_FAILED', error.message, filename)

      // Ensure patient/encounter association even on error
      if (!errorResult.data) {
        errorResult.data = {}
      }
      errorResult.data.patientNum = patientNum
      errorResult.data.encounterNum = encounterNum

      return errorResult
    }
  }

  /**
   * Analyze file content to determine structure and import strategy
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Analysis result with file structure information
   */
  async analyzeFileContent(content, filename) {
    try {
      // Validate input parameters
      if (!content) {
        logger.error('File content analysis failed: content is undefined', { filename })
        return this.createErrorResult('INVALID_CONTENT', 'File content is empty or undefined', filename)
      }

      if (!filename) {
        logger.error('File content analysis failed: filename is undefined')
        return this.createErrorResult('INVALID_FILENAME', 'Filename is undefined', 'unknown')
      }

      logger.info('Starting file content analysis', {
        filename,
        contentLength: content.length,
        contentType: typeof content,
      })

      // Detect format first
      const format = this.detectFormat(content, filename)
      if (!format) {
        return this.createErrorResult('UNSUPPORTED_FORMAT', `Unsupported file format for ${filename}`, filename)
      }

      const analysis = {
        success: true,
        format,
        filename,
        fileSize: content.length,
        patientsCount: 0,
        visitsCount: 0,
        observationsCount: 0,
        hasMultiplePatients: false,
        hasMultipleVisits: false,
        patients: [],
        visits: [],
        observations: [], // Detailed observation data
        estimatedImportTime: 'Unknown',
        recommendedStrategy: 'single_patient', // 'single_patient', 'batch_import', 'interactive'
        warnings: [],
        errors: [],
      }

      // Format-specific analysis
      switch (format) {
        case 'csv':
          await this.analyzeCsvContent(content, analysis)
          break
        case 'json':
          await this.analyzeJsonContent(content, analysis)
          break
        case 'hl7':
          await this.analyzeHl7Content(content, analysis)
          break
        case 'html':
          await this.analyzeHtmlContent(content, analysis)
          break
      }

      // Check if format-specific analysis failed (only for JSON parsing errors, not CSV warnings)
      if (analysis.errors && analysis.errors.length > 0 && format !== 'csv') {
        analysis.success = false
      }

      // Determine recommended strategy
      this.determineRecommendedStrategy(analysis)

      // Estimate import time
      analysis.estimatedImportTime = this.estimateImportTime(analysis)

      logger.info('File content analysis completed', {
        format,
        patientsCount: analysis.patientsCount,
        visitsCount: analysis.visitsCount,
        observationsCount: analysis.observationsCount,
        recommendedStrategy: analysis.recommendedStrategy,
      })

      return analysis
    } catch (error) {
      logger.error('File content analysis failed', {
        error: error.message,
        stack: error.stack,
        filename,
        contentLength: content?.length,
        contentType: typeof content,
        errorType: error.constructor.name,
      })
      return this.createErrorResult('ANALYSIS_FAILED', error.message, filename)
    }
  }

  /**
   * Analyze CSV content structure
   * @param {string} content - CSV content
   * @param {Object} analysis - Analysis object to update
   */
  async analyzeCsvContent(content, analysis) {
    try {
      const lines = content.split('\n').filter((line) => line.trim())
      if (lines.length < 2) {
        analysis.errors.push('CSV file appears to be empty or malformed')
        return
      }

      // Parse header to understand structure
      const headerLine = lines[0]
      const delimiter = this.detectCsvDelimiter(headerLine)
      const headers = headerLine.split(delimiter).map((h) => h.trim())

      // Look for patient identifiers in headers
      const patientHeaders = headers.filter((h) => h.toLowerCase().includes('patient') || h.toLowerCase().includes('pat_num') || h.toLowerCase().includes('pat_cd'))

      // Look for visit identifiers in headers
      const visitHeaders = headers.filter((h) => h.toLowerCase().includes('visit') || h.toLowerCase().includes('encounter') || h.toLowerCase().includes('enc_num'))

      // Analyze data rows (skip header)
      const dataRows = lines.slice(1).filter((line) => line.trim())
      analysis.observationsCount = dataRows.length

      // Extract unique patients and visits
      const uniquePatients = new Set()
      const uniqueVisits = new Set()

      dataRows.forEach((row) => {
        try {
          const values = row.split(delimiter)
          if (values.length >= headers.length) {
            // Try to extract patient and visit info
            patientHeaders.forEach((header, headerIndex) => {
              const value = values[headerIndex]?.trim()
              if (value) uniquePatients.add(value)
            })

            visitHeaders.forEach((header, headerIndex) => {
              const value = values[headerIndex]?.trim()
              if (value) uniqueVisits.add(value)
            })
          }
        } catch {
          // Skip malformed rows
        }
      })

      analysis.patientsCount = uniquePatients.size
      analysis.visitsCount = uniqueVisits.size
      analysis.hasMultiplePatients = uniquePatients.size > 1
      analysis.hasMultipleVisits = uniqueVisits.size > 1

      // Extract sample patient info
      const patientArray = Array.from(uniquePatients)
      analysis.patients = patientArray.slice(0, 5).map((id) => ({
        id,
        name: `Patient ${id}`,
        visitsCount: Math.floor(Math.random() * 5) + 1, // Estimate
      }))
    } catch (error) {
      analysis.errors.push(`CSV analysis failed: ${error.message}`)
    }
  }

  /**
   * Analyze JSON content structure
   * @param {string} content - JSON content
   * @param {Object} analysis - Analysis object to update
   */
  async analyzeJsonContent(content, analysis) {
    try {
      const data = JSON.parse(content)

      // Check for standard clinical data structure
      if (data.patients) {
        analysis.patientsCount = Array.isArray(data.patients) ? data.patients.length : 1
        analysis.patients = data.patients.slice(0, 5).map((p, i) => ({
          id: p.PATIENT_CD || p.patientId || `Patient_${i + 1}`,
          name: p.name || `Patient ${p.PATIENT_CD || i + 1}`,
        }))
      }

      if (data.visits) {
        analysis.visitsCount = Array.isArray(data.visits) ? data.visits.length : 1
      }

      if (data.observations) {
        const observations = Array.isArray(data.observations) ? data.observations : [data.observations]
        analysis.observationsCount = observations.length
        analysis.observations = observations.slice(0, 10).map((obs, index) => ({
          id: obs.id || `obs_${index + 1}`,
          concept: obs.concept || obs.code || `Observation ${index + 1}`,
          valtype: obs.valtype || 'T', // Default to text if not specified
          value: obs.value || obs.valueString || obs.valueQuantity?.value || 'N/A',
          category: obs.category || 'Clinical',
          description: obs.description || obs.display || `Clinical observation ${index + 1}`,
        }))
      }

      analysis.hasMultiplePatients = analysis.patientsCount > 1
      analysis.hasMultipleVisits = analysis.visitsCount > 1
    } catch (error) {
      analysis.errors.push(`JSON analysis failed: ${error.message}`)
    }
  }

  /**
   * Analyze HL7 content structure
   * @param {string} content - HL7 content
   * @param {Object} analysis - Analysis object to update
   */
  async analyzeHl7Content(content, analysis) {
    try {
      const data = JSON.parse(content)

      // Extract patients from Patient Information section
      const patientMap = new Map()
      const visitMap = new Map()
      let totalObservations = 0

      if (data.section && Array.isArray(data.section)) {
        for (const section of data.section) {
          // Extract patients from Patient Information section
          if (section.title === 'Patient Information' && section.entry) {
            for (const entry of section.entry) {
              if (entry.title && entry.title.startsWith('Patient:')) {
                const patientId = entry.value || entry.title.replace('Patient:', '').trim()
                if (patientId && !patientMap.has(patientId)) {
                  patientMap.set(patientId, {
                    id: patientId,
                    name: patientId,
                    source: 'HL7 CDA',
                  })
                }
              }
            }
          }

          // Extract visits from Visit sections
          if (section.title && section.title.startsWith('Visit')) {
            const visitData = {
              title: section.title,
              patientId: null,
              date: null,
              location: null,
            }

            // Try to extract patient reference from section title
            const titleMatch = section.title.match(/Visit\s+\d+(?::\s*(.+))?/)
            if (titleMatch && titleMatch[1]) {
              visitData.patientId = titleMatch[1].trim()
            }

            // Extract visit details from entries
            if (section.entry) {
              for (const entry of section.entry) {
                if (entry.title === 'Visit Date' && entry.value) {
                  visitData.date = entry.value
                } else if (entry.title === 'Location' && entry.value) {
                  visitData.location = entry.value
                }
              }
            }

            // Create unique visit key
            if (visitData.date || visitData.location) {
              const visitKey = `${visitData.patientId || 'unknown'}-${visitData.date || 'unknown'}-${visitData.location || 'unknown'}`
              if (!visitMap.has(visitKey)) {
                visitMap.set(visitKey, visitData)
              }
            }
          }

          // Count observations from all sections with entries
          if (section.entry && Array.isArray(section.entry)) {
            totalObservations += section.entry.filter((entry) => entry.title && entry.value !== undefined && !entry.title.startsWith('Visit') && !entry.title.startsWith('Patient')).length
          }
        }
      }

      // If no patients found in Patient Information section, check subject
      if (patientMap.size === 0 && data.subject && data.subject.display) {
        patientMap.set(data.subject.display, {
          id: data.subject.display,
          name: data.subject.display,
          source: 'HL7 CDA Subject',
        })
      }

      // If no visits found but we have sections, estimate from structure
      if (visitMap.size === 0 && data.section) {
        const visitSections = data.section.filter((s) => s.title && s.title.startsWith('Visit'))
        if (visitSections.length > 0) {
          visitSections.forEach((section, index) => {
            visitMap.set(`visit-${index}`, {
              title: section.title,
              patientId: null,
              date: `Visit ${index + 1}`,
              location: 'HL7 Import',
            })
          })
        } else if (totalObservations > 0) {
          // If we have observations but no visit structure, assume one visit
          visitMap.set('default-visit', {
            title: 'Default Visit',
            patientId: null,
            date: new Date().toISOString().split('T')[0],
            location: 'HL7 Import',
          })
        }
      }

      // Set analysis results
      analysis.patientsCount = patientMap.size
      analysis.visitsCount = visitMap.size
      analysis.observationsCount = totalObservations

      analysis.patients = Array.from(patientMap.values())
      analysis.visits = Array.from(visitMap.values()).slice(0, 10) // Limit for preview

      analysis.hasMultiplePatients = patientMap.size > 1
      analysis.hasMultipleVisits = visitMap.size > 1

      // Extract sample observations for preview
      if (data.section && Array.isArray(data.section)) {
        analysis.observations = []
        let obsCount = 0

        for (const section of data.section) {
          if (section.entry && Array.isArray(section.entry) && obsCount < 10) {
            for (const entry of section.entry) {
              if (entry.title && entry.value !== undefined && !entry.title.startsWith('Visit') && !entry.title.startsWith('Patient') && obsCount < 10) {
                analysis.observations.push({
                  id: `obs_${obsCount + 1}`,
                  concept: entry.title,
                  valtype: typeof entry.value === 'number' ? 'N' : 'T',
                  value: entry.value,
                  category: 'HL7 CDA',
                  description: section.title || 'HL7 CDA clinical observation',
                })
                obsCount++
              }
            }
          }
        }
      }

      // Determine recommended strategy
      if (analysis.hasMultipleVisits) {
        analysis.recommendedStrategy = 'multiple_visits'
      } else if (analysis.hasMultiplePatients) {
        analysis.recommendedStrategy = 'multiple_patients'
      } else {
        analysis.recommendedStrategy = 'single_patient'
      }

      logger.info('HL7 content analysis completed', {
        patients: analysis.patientsCount,
        visits: analysis.visitsCount,
        observations: analysis.observationsCount,
        hasMultiplePatients: analysis.hasMultiplePatients,
        hasMultipleVisits: analysis.hasMultipleVisits,
        strategy: analysis.recommendedStrategy,
      })
    } catch (error) {
      logger.error('HL7 analysis failed', error)
      analysis.errors.push(`HL7 analysis failed: ${error.message}`)
    }
  }

  /**
   * Analyze HTML content structure
   * @param {string} content - HTML content
   * @param {Object} analysis - Analysis object to update
   */
  async analyzeHtmlContent(content, analysis) {
    try {
      // Look for embedded CDA in script tags
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
      if (scriptMatch) {
        const scriptContent = scriptMatch[1]

        // Check if it contains CDA data
        if (scriptContent.includes('CDA') || scriptContent.includes('resourceType')) {
          try {
            // Try to parse as JSON, handling CDA = assignment
            let jsonContent = scriptContent.trim()

            // Handle different possible formats
            if (jsonContent.startsWith('CDA =')) {
              jsonContent = jsonContent.substring(5).trim()
              if (jsonContent.endsWith(';')) {
                jsonContent = jsonContent.slice(0, -1).trim()
              }
            }

            // Try to parse as JSON
            let cdaData
            try {
              cdaData = JSON.parse(jsonContent)
            } catch (e) {
              // If direct parsing fails, try to extract JSON from the script
              const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                cdaData = JSON.parse(jsonMatch[0])
              } else {
                throw e
              }
            }

            // Extract patient and observation data
            if (cdaData.cda && cdaData.cda.subject) {
              analysis.patientsCount = 1
              analysis.patients = [
                {
                  id: cdaData.cda.subject.display || 'Unknown',
                  name: cdaData.cda.subject.display || 'Unknown Patient',
                },
              ]
              analysis.visitsCount = 1

              // Extract detailed observations for CDA
              const sections = cdaData.cda.section || []
              analysis.observationsCount = sections.length
              analysis.observations = sections.slice(0, 10).map((section, index) => ({
                id: `obs_${index + 1}`,
                concept: section.title || `Section ${index + 1}`,
                valtype: 'Q', // Questionnaire data
                value: section.title || `CDA Section ${index + 1}`,
                category: 'Questionnaire',
                description: section.text || 'CDA clinical section',
              }))
            } else if (cdaData.subject) {
              analysis.patientsCount = 1
              analysis.patients = [
                {
                  id: cdaData.subject.display || 'Unknown',
                  name: cdaData.subject.display || 'Unknown Patient',
                },
              ]
              analysis.visitsCount = 1

              // Extract detailed observations for FHIR CDA
              const sections = cdaData.section || []
              analysis.observationsCount = sections.length
              analysis.observations = sections.slice(0, 10).map((section, index) => ({
                id: `obs_${index + 1}`,
                concept: section.title || section.code?.display || `Section ${index + 1}`,
                valtype: 'Q', // Questionnaire data
                value: section.title || section.code?.display || `FHIR CDA Section ${index + 1}`,
                category: 'Questionnaire',
                description: section.text?.div || 'FHIR CDA clinical section',
              }))
            } else {
              // Fallback - assume there's at least one patient and observation
              analysis.patientsCount = 1
              analysis.patients = [
                {
                  id: 'Unknown',
                  name: 'Unknown Patient',
                },
              ]
              analysis.visitsCount = 1
              analysis.observationsCount = 1
              analysis.observations = [
                {
                  id: 'obs_1',
                  concept: 'Unknown Questionnaire',
                  valtype: 'Q',
                  value: 'Questionnaire Response',
                  category: 'Questionnaire',
                  description: 'Imported questionnaire data',
                },
              ]
            }
          } catch {
            // Script content might not be pure JSON
            analysis.warnings = analysis.warnings || []
            analysis.warnings.push('Could not parse embedded CDA data')
          }
        }
      }

      analysis.hasMultiplePatients = false
      analysis.hasMultipleVisits = false
    } catch (error) {
      analysis.errors = analysis.errors || []
      analysis.errors.push(`HTML analysis failed: ${error.message}`)
    }
  }

  /**
   * Detect CSV delimiter
   * @param {string} headerLine - First line of CSV
   * @returns {string} Detected delimiter
   */
  detectCsvDelimiter(headerLine) {
    const delimiters = [',', ';', '\t', '|']
    let bestDelimiter = ','
    let maxCount = 0

    for (const delimiter of delimiters) {
      const count = (headerLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      if (count > maxCount) {
        maxCount = count
        bestDelimiter = delimiter
      }
    }

    return bestDelimiter
  }

  /**
   * Determine recommended import strategy
   * @param {Object} analysis - Analysis object
   */
  determineRecommendedStrategy(analysis) {
    // Initialize warnings array if not present
    if (!analysis.warnings) {
      analysis.warnings = []
    }

    if (analysis.patientsCount === 0) {
      analysis.recommendedStrategy = 'single_patient'
      analysis.warnings.push('No patient data detected - will use single patient mode')
    } else if (analysis.patientsCount === 1) {
      analysis.recommendedStrategy = 'single_patient'
    } else if (analysis.patientsCount <= 10) {
      analysis.recommendedStrategy = 'batch_import'
    } else {
      analysis.recommendedStrategy = 'interactive'
    }
  }

  /**
   * Estimate import time based on data volume
   * @param {Object} analysis - Analysis object
   * @returns {string} Estimated time
   */
  estimateImportTime(analysis) {
    const totalRecords = analysis.patientsCount + analysis.visitsCount + analysis.observationsCount

    if (totalRecords === 0) return 'Instant'
    if (totalRecords <= 10) return '< 1 minute'
    if (totalRecords <= 100) return '1-2 minutes'
    if (totalRecords <= 1000) return '2-5 minutes'
    if (totalRecords <= 10000) return '5-15 minutes'
    return '15+ minutes'
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
  createErrorResult(code, message, filename = null) {
    return {
      success: false,
      data: null,
      metadata: {
        importDate: new Date().toISOString(),
        service: 'ImportService',
        filename: filename,
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
