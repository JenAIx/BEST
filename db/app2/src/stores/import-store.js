import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { useQuestionnaireStore } from './questionnaire-store.js'
import { logger } from '../core/services/logging-service.js'
import { ImportService } from '../core/services/imports/import-service.js'

/**
 * Import Management Store
 * Handles file import operations, survey imports, and import state management
 */
export const useImportStore = defineStore('import', () => {
  const dbStore = useDatabaseStore()
  const questionnaireStore = useQuestionnaireStore()

  // State
  const importHistory = ref([])
  const currentImport = ref(null)
  const isImporting = ref(false)
  const importProgress = ref('')
  const importProgressValue = ref(0)
  const lastImportResult = ref(null)

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
   * Import file for specific patient and visit
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  const importForPatient = async (content, filename, patientNum, encounterNum, options = {}) => {
    const service = initializeImportService()

    isImporting.value = true
    importProgress.value = 'Starting import...'
    importProgressValue.value = 10

    const importRecord = {
      id: Date.now(),
      filename,
      patientNum,
      encounterNum,
      timestamp: new Date().toISOString(),
      success: false,
      error: null,
      metadata: {},
    }

    try {
      logger.info('Starting patient-specific import via store', {
        filename,
        patientNum,
        encounterNum,
        contentLength: content.length,
      })

      importProgress.value = 'Detecting file format...'
      importProgressValue.value = 20

      // Detect format first
      const format = service.detectFormat(content, filename)
      importRecord.format = format

      if (!format) {
        throw new Error(`Unsupported file format for ${filename}`)
      }

      logger.info('Detected file format', { format, filename })

      // Handle survey/questionnaire files specially
      if (format === 'html') {
        return await importSurveyForPatient(content, filename, patientNum, encounterNum, options, importRecord)
      }

      // Handle other formats through regular import service
      importProgress.value = 'Processing file...'
      importProgressValue.value = 40

      const result = await service.importForPatient(content, filename, patientNum, encounterNum, options)

      // Update progress
      importProgress.value = result.success ? 'Import completed!' : 'Import failed'
      importProgressValue.value = result.success ? 100 : 0

      // Record the import
      importRecord.success = result.success
      importRecord.error = result.success ? null : result.errors?.[0]?.message || 'Unknown error'
      importRecord.metadata = result.metadata || {}

      importHistory.value.push(importRecord)
      lastImportResult.value = result
      currentImport.value = importRecord

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
   * Import survey/questionnaire file for specific patient and visit
   * @param {string} content - HTML file content
   * @param {string} filename - Original filename
   * @param {number} patientNum - Patient number
   * @param {number} encounterNum - Encounter number
   * @param {Object} options - Import options
   * @param {Object} importRecord - Import record to update
   * @returns {Promise<Object>} Import result
   */
  const importSurveyForPatient = async (content, filename, patientNum, encounterNum, options, importRecord) => {
    try {
      importProgress.value = 'Parsing survey data...'
      importProgressValue.value = 30

      // Extract and parse survey data from HTML
      const surveyData = await extractSurveyDataFromHtml(content)

      if (!surveyData) {
        throw new Error('No valid survey data found in HTML file')
      }

      importProgress.value = 'Converting to questionnaire format...'
      importProgressValue.value = 50

      // Convert survey data to questionnaire response format
      const questionnaireResponse = convertSurveyToQuestionnaireResponse(surveyData)

      importProgress.value = 'Saving questionnaire response...'
      importProgressValue.value = 70

      // Use the same storage method as QuestionnairePage.vue
      await questionnaireStore.saveQuestionnaireResponseStore(patientNum, encounterNum, questionnaireResponse)

      importProgress.value = 'Import completed!'
      importProgressValue.value = 100

      // Update import record
      importRecord.success = true
      importRecord.metadata = {
        questionnaire: questionnaireResponse.questionnaire_code || 'unknown',
        title: questionnaireResponse.title || filename,
        responseCount: questionnaireResponse.items?.length || 0,
        hasResults: !!questionnaireResponse.results,
        format: 'HTML Survey',
      }

      const result = {
        success: true,
        data: {
          patientNum,
          encounterNum,
          questionnaire: questionnaireResponse,
        },
        metadata: importRecord.metadata,
        errors: [],
        warnings: [],
      }

      importHistory.value.push(importRecord)
      lastImportResult.value = result
      currentImport.value = importRecord

      logger.info('Survey import completed successfully', {
        filename,
        patientNum,
        encounterNum,
        questionnaire: questionnaireResponse.questionnaire_code,
        title: questionnaireResponse.title,
      })

      return result
    } catch (error) {
      logger.error('Survey import failed', error)
      throw error
    }
  }

  /**
   * Extract survey data from HTML content
   * @param {string} htmlContent - HTML file content
   * @returns {Object|null} Extracted survey data
   */
  const extractSurveyDataFromHtml = (htmlContent) => {
    try {
      // Look for CDA data in script tags
      const cdaScriptMatch = htmlContent.match(/<script[^>]*>[\s\S]*?CDA\s*=\s*({[\s\S]*?})[\s\S]*?<\/script>/i)

      if (!cdaScriptMatch || !cdaScriptMatch[1]) {
        logger.error('No CDA data found in HTML script tag')
        return null
      }

      const cdaDataString = cdaScriptMatch[1]
      const cdaData = JSON.parse(cdaDataString)

      if (!cdaData.cda) {
        logger.error('Invalid CDA structure - missing cda property')
        return null
      }

      return cdaData
    } catch (error) {
      logger.error('Failed to extract survey data from HTML', error)
      return null
    }
  }

  /**
   * Convert survey CDA data to questionnaire response format
   * @param {Object} surveyData - Extracted survey data
   * @returns {Object} Questionnaire response format
   */
  const convertSurveyToQuestionnaireResponse = (surveyData) => {
    const cda = surveyData.cda
    const info = surveyData.info || {}

    // Extract basic information
    const title = cda.title || info.title || 'Imported Survey'
    const questionnaireCode = info.label || cda.event?.[0]?.code?.[0]?.coding?.[0]?.code || 'imported-survey'
    const patientId = cda.subject?.display || info.PID || 'UNKNOWN'

    // Extract dates
    const startDate = cda.event?.[0]?.period?.start || cda.date || info.date || new Date().toISOString()
    const endDate = cda.event?.[0]?.period?.end || startDate

    // Extract individual responses and results
    const responses = []
    const results = []

    // Process sections for findings (individual responses)
    if (cda.section) {
      for (const section of cda.section) {
        if (section.title === 'Findings Section' && section.entry) {
          for (const entry of section.entry) {
            const response = {
              id: entry.title,
              title: entry.title,
              value: entry.value,
              response: entry.value,
              coding: entry.code?.[0]?.coding?.[0] || null,
            }
            responses.push(response)
          }
        }

        // Process results section
        if (section.title === 'Results Section' && section.entry) {
          for (const entry of section.entry) {
            const result = {
              id: entry.title,
              title: entry.title,
              value: entry.value,
              coding: entry.code?.[0]?.coding?.[0] || null,
            }
            results.push(result)
          }
        }
      }
    }

    // Create questionnaire response in the expected format
    const questionnaireResponse = {
      questionnaire_code: questionnaireCode,
      questionnaire_title: title,
      title: title,
      date_start: startDate,
      date_end: endDate,
      patient_id: patientId,
      items: responses,
      responses: responses,
      results: results,
      summary:
        results.length > 0
          ? {
              value: results[0].value,
              label: results[0].title,
            }
          : null,
      metadata: {
        source: 'HTML Survey Import',
        original_format: 'CDA/HTML',
        import_timestamp: new Date().toISOString(),
        document_id: cda.identifier?.value || null,
        questionnaire_system: cda.event?.[0]?.code?.[0]?.coding?.[0]?.system || 'http://snomed.info/sct',
      },
    }

    return questionnaireResponse
  }

  /**
   * Analyze file content for import preview
   * @param {string} content - File content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Analysis result
   */
  const analyzeFileContent = async (content, filename) => {
    const service = initializeImportService()
    return await service.analyzeFileContent(content, filename)
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

  return {
    // State
    importHistory,
    currentImport,
    isImporting,
    importProgress,
    importProgressValue,
    lastImportResult,

    // Computed
    isInitialized,
    recentImports,
    successfulImports,
    failedImports,

    // Actions
    importForPatient,
    importSurveyForPatient,
    analyzeFileContent,
    clearImportHistory,
    resetImportState,
    getImportById,
    initializeImportService,

    // Utility functions (exported for testing)
    extractSurveyDataFromHtml,
    convertSurveyToQuestionnaireResponse,
  }
})
