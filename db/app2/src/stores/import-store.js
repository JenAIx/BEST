import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
// import { useQuestionnaireStore } from './questionnaire-store.js'
import { logger } from '../core/services/logging-service.js'
import { ImportService } from '../core/services/imports/import-service.js'

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

  // Import service instance
  const importService = ref(null)

  // Initialize import service
  const initializeImportService = () => {
    if (!importService.value) {
      const conceptRepository = dbStore.getRepository('concept')
      const cqlRepository = dbStore.getRepository('cql')
      importService.value = new ImportService(dbStore, conceptRepository, cqlRepository)
    }
    return importService.value
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
        hasMultipleVisits: (importStructure?.data?.visits?.length || 0) > 1,
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

    const { patients, visits } = importStructure.data
    const patientCount = patients?.length || 0
    const visitCount = visits?.length || 0

    if (patientCount > 1) {
      return 'multiple_patients'
    } else if (visitCount > 1) {
      return 'multiple_visits'
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
    clearImportHistory,
    resetImportState,
    getImportById,
    initializeImportService,

    // Selection management
    updateSelections,
    getCurrentSelections,
    clearSelections,
    getSelectionHistory,

    // Utility methods
    getSupportedFormats,
    validateFileSize,
  }
})
