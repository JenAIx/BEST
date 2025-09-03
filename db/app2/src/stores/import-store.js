import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
// import { useQuestionnaireStore } from './questionnaire-store.js'
import { logger } from '../core/services/logging-service.js'
import { ImportService } from '../core/services/imports/import-service.js'
import { DatabaseImportService } from '../core/services/imports/database-import-service.js'

/**
 * Import Management Store
 * Handles file import operations using the new modular import system
 */
export const useImportStore = defineStore('import', () => {
  const dbStore = useDatabaseStore()
  // const questionnaireStore = useQuestionnaireStore()

  // State
  const importHistory = ref([])
  const currentImport = ref(null)
  const isImporting = ref(false)
  const importProgress = ref('')
  const importProgressValue = ref(0)
  const lastImportResult = ref(null)

  // Selection state for preview dialog
  const currentSelections = ref(null)
  const selectionHistory = ref([])

  // Import service instances
  const importService = ref(null)
  const databaseImportService = ref(null)

  // Initialize import service
  const initializeImportService = () => {
    if (!importService.value) {
      const conceptRepository = dbStore.getRepository('concept')
      const cqlRepository = dbStore.getRepository('cql')
      importService.value = new ImportService(dbStore, conceptRepository, cqlRepository)
    }
    return importService.value
  }

  // Initialize database import service
  const initializeDatabaseImportService = () => {
    if (!databaseImportService.value) {
      const conceptRepository = dbStore.getRepository('concept')
      const cqlRepository = dbStore.getRepository('cql')
      databaseImportService.value = new DatabaseImportService(dbStore, conceptRepository, cqlRepository)
    }
    return databaseImportService.value
  }

  // Computed
  const isInitialized = computed(() => !!importService.value)

  const recentImports = computed(() => {
    return importHistory.value.slice(-10).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  })

  const successfulImports = computed(() => {
    return importHistory.value.filter((imp) => imp.success)
  })

  const failedImports = computed(() => {
    return importHistory.value.filter((imp) => !imp.success)
  })

  // Actions

  /**
   * Analyze file content for import preview
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Analysis result with importStructure
   */
  const analyzeFileContent = async (content, filename) => {
    const service = initializeImportService()

    try {
      logger.info('Starting file analysis', { filename, contentLength: content.length })

      // Use the new import service to analyze the file
      const analysisResult = await service.analyzeFile(content, filename)

      if (!analysisResult.success) {
        logger.error('File analysis failed', { filename, errors: analysisResult.errors })
        return {
          success: false,
          errors: analysisResult.errors,
          format: 'unknown',
          patientsCount: 0,
          visitsCount: 0,
          observationsCount: 0,
          recommendedStrategy: 'single_patient',
          warnings: [],
          estimatedImportTime: 'N/A',
        }
      }

      // For supported formats, also get the full import structure for preview
      let importStructure = null
      if (analysisResult.data.isSupported) {
        try {
          const importResult = await service.importFile(content, filename)
          if (importResult.success) {
            importStructure = importResult.data
          }
        } catch (error) {
          logger.warn('Failed to get import structure for preview', { error: error.message })
        }
      }

      // Create analysis result with importStructure
      const result = {
        success: true,
        format: analysisResult.data.format,
        filename: analysisResult.data.filename,
        fileSize: analysisResult.data.fileSize,
        estimatedImportTime: analysisResult.data.estimatedImportTime,
        isSupported: analysisResult.data.isSupported,
        validFileSize: analysisResult.data.validFileSize,
        maxFileSize: analysisResult.data.maxFileSize,
        // Import structure data for preview
        importStructure: importStructure,
        patientsCount: importStructure?.data?.patients?.length || 0,
        visitsCount: importStructure?.data?.visits?.length || 0,
        observationsCount: importStructure?.data?.observations?.length || 0,
        // Determine recommended strategy based on data
        recommendedStrategy: determineImportStrategy(importStructure),
        hasMultiplePatients: (importStructure?.data?.patients?.length || 0) > 1,
        warnings: [],
        errors: [],
      }

      logger.info('File analysis completed successfully', {
        filename,
        format: result.format,
        patientsCount: result.patientsCount,
        visitsCount: result.visitsCount,
        observationsCount: result.observationsCount,
        recommendedStrategy: result.recommendedStrategy,
      })

      return result
    } catch (error) {
      logger.error('File analysis failed with exception', {
        error: error.message,
        filename,
        contentLength: content.length,
      })

      return {
        success: false,
        errors: [`Analysis failed: ${error.message}`],
        format: 'unknown',
        patientsCount: 0,
        visitsCount: 0,
        observationsCount: 0,
        recommendedStrategy: 'single_patient',
        warnings: [],
        estimatedImportTime: 'N/A',
      }
    }
  }

  /**
   * Determine the recommended import strategy based on importStructure
   * @param {Object} importStructure - Import structure data
   * @returns {string} Recommended strategy
   */
  const determineImportStrategy = (importStructure) => {
    if (!importStructure?.data) {
      return 'single_patient'
    }

    const { patients } = importStructure.data
    const patientCount = patients?.length || 0

    if (patientCount > 1) {
      return 'multiple_patients'
    } else {
      return 'single_patient'
    }
  }

  /**
   * Import file using the new import service
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  const importFile = async (content, filename, options = {}) => {
    const service = initializeImportService()

    isImporting.value = true
    importProgress.value = 'Starting import...'
    importProgressValue.value = 10

    const importRecord = {
      id: Date.now(),
      filename,
      timestamp: new Date().toISOString(),
      success: false,
      error: null,
      metadata: {},
    }

    try {
      logger.info('Starting file import via store', {
        filename,
        contentLength: content.length,
        options,
      })

      importProgress.value = 'Detecting file format...'
      importProgressValue.value = 20

      // Use the new import service
      const result = await service.importFile(content, filename, options)

      // Update progress
      importProgress.value = result.success ? 'Import completed!' : 'Import failed'
      importProgressValue.value = result.success ? 100 : 0

      // Record the import
      importRecord.success = result.success
      importRecord.error = result.success ? null : result.errors?.[0]?.message || 'Unknown error'
      importRecord.metadata = {
        format: result.data?.metadata?.format || 'unknown',
        patientCount: result.data?.data?.patients?.length || 0,
        visitCount: result.data?.data?.visits?.length || 0,
        observationCount: result.data?.data?.observations?.length || 0,
        ...result.metadata,
      }

      importHistory.value.push(importRecord)
      lastImportResult.value = result
      currentImport.value = importRecord

      logger.info('File import completed via store', {
        filename,
        success: result.success,
        patientCount: importRecord.metadata.patientCount,
        visitCount: importRecord.metadata.visitCount,
        observationCount: importRecord.metadata.observationCount,
      })

      return result
    } catch (error) {
      logger.error('Import failed via store', error)

      importRecord.success = false
      importRecord.error = error.message
      importHistory.value.push(importRecord)
      lastImportResult.value = { success: false, errors: [{ message: error.message }] }
      currentImport.value = importRecord

      importProgress.value = 'Import failed'
      importProgressValue.value = 0

      throw error
    } finally {
      isImporting.value = false
    }
  }

  /**
   * Import file for specific patient and visit (legacy method for compatibility)
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  const importForPatient = async (content, filename, patientNum, encounterNum, options = {}) => {
    // For now, use the general import method
    // TODO: Implement patient-specific import logic if needed
    logger.info('Import for patient called (using general import)', {
      filename,
      patientNum,
      encounterNum,
    })

    return await importFile(content, filename, {
      ...options,
      targetPatientNum: patientNum,
      targetEncounterNum: encounterNum,
    })
  }

  /**
   * Import file to database with optional selections
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  const importFileToDatabase = async (content, filename, options = {}) => {
    const dbImportService = initializeDatabaseImportService()

    isImporting.value = true
    importProgress.value = 'Starting database import...'
    importProgressValue.value = 10

    const importRecord = {
      id: Date.now(),
      filename,
      timestamp: new Date().toISOString(),
      success: false,
      error: null,
      metadata: {},
    }

    try {
      logger.info('Starting database import via store', {
        filename,
        contentLength: content.length,
        options,
      })

      importProgress.value = 'Parsing file content...'
      importProgressValue.value = 20

      // First, parse the file to get the import structure
      const importService = initializeImportService()
      const parseResult = await importService.importFile(content, filename)

      if (!parseResult.success) {
        throw new Error(parseResult.errors?.[0]?.message || 'File parsing failed')
      }

      const importStructure = parseResult.data

      importProgress.value = 'Applying user selections...'
      importProgressValue.value = 40

      // Apply user selections if provided
      let processedStructure = options.selections ? applySelectionsToStructure(importStructure, options.selections) : importStructure

      // Handle selected patient and visit for existing patient mode
      if (options.patientMode === 'existing' && options.selectedPatient && options.selectedVisit) {
        processedStructure = applyPatientVisitSelection(processedStructure, options.selectedPatient, options.selectedVisit)
      }

      importProgress.value = 'Importing to database...'
      importProgressValue.value = 60

      // Import to database using the DatabaseImportService
      const dbResult = await dbImportService.importToDatabase(processedStructure, {
        duplicateStrategy: options.duplicateStrategy || 'skip',
        importToDatabase: true,
      })

      importProgress.value = 'Finalizing import...'
      importProgressValue.value = 90

      if (!dbResult.success) {
        throw new Error(dbResult.errors?.[0]?.message || 'Database import failed')
      }

      importProgress.value = 'Import completed successfully!'
      importProgressValue.value = 100

      // Record the import
      importRecord.success = true
      importRecord.metadata = {
        format: importStructure.metadata?.format || 'unknown',
        patientCount: processedStructure.data?.patients?.length || 0,
        visitCount: processedStructure.data?.visits?.length || 0,
        observationCount: processedStructure.data?.observations?.length || 0,
        dbStats: dbResult.data?.statistics || {},
        selectionsApplied: !!options.selections,
        ...dbResult.metadata,
      }

      importHistory.value.push(importRecord)
      lastImportResult.value = dbResult
      currentImport.value = importRecord

      logger.info('Database import completed successfully', {
        filename,
        patientCount: importRecord.metadata.patientCount,
        visitCount: importRecord.metadata.visitCount,
        observationCount: importRecord.metadata.observationCount,
        dbStats: importRecord.metadata.dbStats,
      })

      return dbResult
    } catch (error) {
      logger.error('Database import failed via store', error)

      importRecord.success = false
      importRecord.error = error.message
      importHistory.value.push(importRecord)
      lastImportResult.value = { success: false, errors: [{ message: error.message }] }
      currentImport.value = importRecord

      importProgress.value = 'Import failed'
      importProgressValue.value = 0

      throw error
    } finally {
      isImporting.value = false
    }
  }

  /**
   * Apply user selections to filter the import structure
   * @param {Object} importStructure - Original import structure
   * @param {Object} selections - User selections
   * @returns {Object} Filtered import structure
   */
  /**
   * Apply selected patient and visit to import structure (for existing patient mode)
   * @param {Object} importStructure - The parsed import structure
   * @param {Object} selectedPatient - Selected patient object
   * @param {Object} selectedVisit - Selected visit object
   * @returns {Object} Modified import structure
   */
  const applyPatientVisitSelection = (importStructure, selectedPatient, selectedVisit) => {
    if (!importStructure?.data) return importStructure

    const modified = {
      ...importStructure,
      data: {
        ...importStructure.data,
      },
    }

    logger.info('Applying selected patient and visit to import structure', {
      selectedPatientId: selectedPatient.PATIENT_NUM || selectedPatient.patientNum,
      selectedVisitId: selectedVisit.ENCOUNTER_NUM || selectedVisit.encounterNum,
      originalCounts: {
        patients: importStructure.data.patients?.length || 0,
        visits: importStructure.data.visits?.length || 0,
        observations: importStructure.data.observations?.length || 0,
      },
    })

    // Replace all patients with the selected patient
    if (selectedPatient) {
      const patientNum = selectedPatient.PATIENT_NUM || selectedPatient.patientNum
      modified.data.patients = [
        {
          PATIENT_CD: selectedPatient.PATIENT_CD || selectedPatient.patientCd || `PATIENT_${patientNum}`,
          PATIENT_NUM: patientNum,
          ...selectedPatient, // Include all other patient fields
        },
      ]
    }

    // Replace all visits with the selected visit
    if (selectedVisit) {
      const encounterNum = selectedVisit.ENCOUNTER_NUM || selectedVisit.encounterNum
      modified.data.visits = [
        {
          ENCOUNTER_NUM: encounterNum,
          PATIENT_NUM: selectedPatient.PATIENT_NUM || selectedPatient.patientNum,
          START_DATE: selectedVisit.START_DATE || selectedVisit.startDate,
          END_DATE: selectedVisit.END_DATE || selectedVisit.endDate,
          INOUT_CD: selectedVisit.INOUT_CD || selectedVisit.inoutCd || 'I',
          LOCATION_CD: selectedVisit.LOCATION_CD || selectedVisit.locationCd || 'UNKNOWN',
          ...selectedVisit, // Include all other visit fields
        },
      ]
    }

    // Update all observations to use the selected patient and visit
    if (modified.data.observations && modified.data.observations.length > 0) {
      const patientNum = selectedPatient.PATIENT_NUM || selectedPatient.patientNum
      const encounterNum = selectedVisit.ENCOUNTER_NUM || selectedVisit.encounterNum

      modified.data.observations = modified.data.observations.map((observation) => ({
        ...observation,
        PATIENT_NUM: patientNum,
        ENCOUNTER_NUM: encounterNum,
      }))
    }

    logger.info('Selected patient and visit applied to import structure', {
      modifiedCounts: {
        patients: modified.data.patients?.length || 0,
        visits: modified.data.visits?.length || 0,
        observations: modified.data.observations?.length || 0,
      },
      patientNum: selectedPatient.PATIENT_NUM || selectedPatient.patientNum,
      encounterNum: selectedVisit.ENCOUNTER_NUM || selectedVisit.encounterNum,
    })

    return modified
  }

  const applySelectionsToStructure = (importStructure, selections) => {
    if (!importStructure?.data) return importStructure

    const filtered = {
      ...importStructure,
      data: {
        ...importStructure.data,
      },
    }

    logger.info('Applying selections to import structure', {
      selections,
      originalCounts: {
        patients: importStructure.data.patients?.length || 0,
        visits: importStructure.data.visits?.length || 0,
        observations: importStructure.data.observations?.length || 0,
      },
    })

    // Filter patients if selections provided
    if (selections.patients && Array.isArray(selections.patients) && selections.patients.length > 0) {
      const selectedPatientIds = new Set(selections.patients.map((p) => p.PATIENT_CD || p.patientId))
      filtered.data.patients = importStructure.data.patients.filter((patient) => selectedPatientIds.has(patient.PATIENT_CD || patient.patientId))
    }

    // Filter visits if selections provided
    if (selections.visits && Array.isArray(selections.visits) && selections.visits.length > 0) {
      const selectedVisitIds = new Set(selections.visits.map((v) => v.ENCOUNTER_NUM || v.visitId))
      filtered.data.visits = importStructure.data.visits.filter((visit) => selectedVisitIds.has(visit.ENCOUNTER_NUM || visit.visitId))
    }

    // Filter observations if selections provided
    if (selections.observations && Array.isArray(selections.observations) && selections.observations.length > 0) {
      const selectedObservationIds = new Set(selections.observations.map((o) => o.OBSERVATION_ID || o.observationId))
      filtered.data.observations = importStructure.data.observations.filter((observation) => selectedObservationIds.has(observation.OBSERVATION_ID || observation.observationId))
    }

    logger.info('Selections applied to import structure', {
      filteredCounts: {
        patients: filtered.data.patients?.length || 0,
        visits: filtered.data.visits?.length || 0,
        observations: filtered.data.observations?.length || 0,
      },
    })

    return filtered
  }

  /**
   * Clear import history
   */
  const clearImportHistory = () => {
    importHistory.value = []
    currentImport.value = null
    lastImportResult.value = null
  }

  /**
   * Reset import state
   */
  const resetImportState = () => {
    isImporting.value = false
    importProgress.value = ''
    importProgressValue.value = 0
    currentImport.value = null
  }

  /**
   * Get import by ID
   * @param {number} importId - Import ID
   * @returns {Object|null} Import record
   */
  const getImportById = (importId) => {
    return importHistory.value.find((imp) => imp.id === importId) || null
  }

  /**
   * Update current selections from preview dialog
   * @param {Object} selections - Selection data from preview dialog
   */
  const updateSelections = (selections) => {
    currentSelections.value = selections

    // Add to selection history
    const selectionRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      selections: JSON.parse(JSON.stringify(selections)), // Deep copy
      summary: {
        patients: selections.patients?.length || 0,
        visits: selections.visits?.length || 0,
        observations: selections.observations?.length || 0,
      },
    }

    selectionHistory.value.push(selectionRecord)

    // Keep only last 10 selection records
    if (selectionHistory.value.length > 10) {
      selectionHistory.value = selectionHistory.value.slice(-10)
    }

    logger.info('Updated import selections', {
      patients: selectionRecord.summary.patients,
      visits: selectionRecord.summary.visits,
      observations: selectionRecord.summary.observations,
    })
  }

  /**
   * Get current selections
   * @returns {Object|null} Current selections
   */
  const getCurrentSelections = () => {
    return currentSelections.value
  }

  /**
   * Clear current selections
   */
  const clearSelections = () => {
    currentSelections.value = null
  }

  /**
   * Get selection history
   * @returns {Array} Selection history
   */
  const getSelectionHistory = () => {
    return selectionHistory.value
  }

  /**
   * Get supported file formats
   * @returns {Array<string>} Supported formats
   */
  const getSupportedFormats = () => {
    const service = initializeImportService()
    return service.getSupportedFormats()
  }

  /**
   * Validate file size
   * @param {string} content - File content
   * @returns {boolean} True if valid size
   */
  const validateFileSize = (content) => {
    const service = initializeImportService()
    return service.validateFileSize(content)
  }

  return {
    // State
    importHistory,
    currentImport,
    isImporting,
    importProgress,
    importProgressValue,
    lastImportResult,
    currentSelections,
    selectionHistory,

    // Computed
    isInitialized,
    recentImports,
    successfulImports,
    failedImports,

    // Actions
    analyzeFileContent,
    importFile,
    importForPatient,
    importFileToDatabase,
    clearImportHistory,
    resetImportState,
    getImportById,
    initializeImportService,

    // Selection management
    updateSelections,
    getCurrentSelections,
    clearSelections,
    getSelectionHistory,
    applySelectionsToStructure,
    applyPatientVisitSelection,

    // Utility methods
    getSupportedFormats,
    validateFileSize,
  }
})
