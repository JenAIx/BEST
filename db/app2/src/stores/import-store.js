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

      logger.info('Proceeding with import without duplicate checking', {
        patientNum,
        encounterNum,
        questionnaireCode: questionnaireResponse.questionnaire_code,
      })

      importProgress.value = 'Saving questionnaire response...'
      importProgressValue.value = 75

      // Use the same storage method as QuestionnairePage.vue
      await questionnaireStore.saveQuestionnaireResponse(patientNum, encounterNum, questionnaireResponse)

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
        metadata: {
          ...importRecord.metadata,
        },
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
      // Look for CDA data in script tags with improved pattern
      const cdaScriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i)

      if (!cdaScriptMatch || !cdaScriptMatch[1]) {
        logger.error('No script tag found in HTML')
        return null
      }

      const scriptContent = cdaScriptMatch[1].trim()

      // Look for CDA= assignment and extract the JSON object using string methods
      const cdaIndex = scriptContent.indexOf('CDA=')
      if (cdaIndex === -1) {
        logger.error('No CDA= found in script content')
        return null
      }

      // Extract everything after 'CDA='
      let cdaDataString = scriptContent.substring(cdaIndex + 4).trim()

      // Remove trailing semicolon if present
      if (cdaDataString.endsWith(';')) {
        cdaDataString = cdaDataString.slice(0, -1)
      }

      logger.debug('Attempting to parse CDA JSON', {
        stringLength: cdaDataString.length,
        startsWithBrace: cdaDataString.startsWith('{'),
        endsWithBrace: cdaDataString.endsWith('}'),
        preview: cdaDataString.substring(0, 200) + '...',
        lastChars: cdaDataString.substring(Math.max(0, cdaDataString.length - 50)),
      })

      let cdaData
      try {
        cdaData = JSON.parse(cdaDataString)
      } catch (jsonError) {
        logger.error('JSON parsing failed', {
          error: jsonError.message,
          stringLength: cdaDataString.length,
          contextAround170: cdaDataString.substring(160, 180),
          charAtPosition170: cdaDataString.charAt(170),
          charCodeAt170: cdaDataString.charCodeAt(170),
        })
        throw new Error(`JSON parsing failed: ${jsonError.message}`)
      }

      if (!cdaData.cda) {
        logger.error('Invalid CDA structure - missing cda property')
        return null
      }

      logger.info('Successfully extracted CDA data', {
        hasPatient: !!cdaData.cda.subject,
        hasTitle: !!cdaData.cda.title,
        hasSections: !!cdaData.cda.section,
        sectionsCount: cdaData.cda.section?.length || 0,
        hasInfo: !!cdaData.info,
        patientId: cdaData.cda.subject?.display || 'unknown',
      })

      return cdaData
    } catch (error) {
      logger.error('Failed to extract survey data from HTML', error)

      // Try alternative extraction method
      try {
        return extractCdaAlternativeMethod(htmlContent)
      } catch (altError) {
        logger.error('Alternative extraction method also failed', altError)
        return null
      }
    }
  }

  /**
   * Alternative method to extract CDA data using a more robust approach
   * @param {string} htmlContent - HTML file content
   * @returns {Object|null} Extracted survey data
   */
  const extractCdaAlternativeMethod = (htmlContent) => {
    // Find the script tag content
    const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let match

    while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
      const scriptContent = match[1]

      if (scriptContent.includes('CDA=')) {
        // Find the start of CDA assignment
        const cdaStart = scriptContent.indexOf('CDA=') + 4

        // Find the opening brace
        let openBraceIndex = -1
        for (let i = cdaStart; i < scriptContent.length; i++) {
          if (scriptContent[i] === '{') {
            openBraceIndex = i
            break
          }
        }

        if (openBraceIndex === -1) {
          continue
        }

        // Find the matching closing brace
        let braceCount = 0
        let closeBraceIndex = -1

        for (let i = openBraceIndex; i < scriptContent.length; i++) {
          if (scriptContent[i] === '{') {
            braceCount++
          } else if (scriptContent[i] === '}') {
            braceCount--
            if (braceCount === 0) {
              closeBraceIndex = i
              break
            }
          }
        }

        if (closeBraceIndex === -1) {
          continue
        }

        // Extract the JSON string
        const jsonString = scriptContent.substring(openBraceIndex, closeBraceIndex + 1)

        try {
          const cdaData = JSON.parse(jsonString)

          if (cdaData.cda) {
            logger.info('Successfully extracted CDA data using alternative method')
            return cdaData
          }
        } catch (parseError) {
          logger.debug('Failed to parse extracted JSON with alternative method', parseError)
          continue
        }
      }
    }

    throw new Error('Could not extract valid CDA data using any method')
  }

  /**
   * Parse date string from CDA format to ISO format
   * @param {string|number} dateValue - Date value from CDA data
   * @returns {string} ISO date string
   */
  const parseCdaDate = (dateValue) => {
    if (!dateValue) {
      return new Date().toISOString()
    }

    // If it's a Unix timestamp (number)
    if (typeof dateValue === 'number') {
      return new Date(dateValue).toISOString()
    }

    // If it's a string, try to handle different formats
    let dateString = dateValue.toString()

    // Handle format like "2025-09-01T10:26:49GMT+0200"
    if (dateString.includes('GMT')) {
      // Replace GMT+XXXX with +XX:XX format
      dateString = dateString.replace(/GMT([+-]\d{4})$/, (match, offset) => {
        // Convert +0200 to +02:00
        const hours = offset.substring(0, 3)
        const minutes = offset.substring(3)
        return `${hours}:${minutes}`
      })
    }

    try {
      const parsedDate = new Date(dateString)
      if (isNaN(parsedDate.getTime())) {
        logger.warn('Failed to parse date, using current date', { originalDate: dateValue, parsedString: dateString })
        return new Date().toISOString()
      }
      return parsedDate.toISOString()
    } catch (error) {
      logger.warn('Date parsing error, using current date', { originalDate: dateValue, error: error.message })
      return new Date().toISOString()
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

    // Extract basic information - prioritize the proper questionnaire display name
    const title = cda.event?.[0]?.code?.[0]?.coding?.[0]?.display || info.title || cda.title || 'Imported Survey'
    const questionnaireCode = info.label || cda.event?.[0]?.code?.[0]?.coding?.[0]?.code || 'imported-survey'
    const patientId = cda.subject?.display || info.PID || 'UNKNOWN'

    // Extract and parse dates properly
    const startDateRaw = cda.event?.[0]?.period?.start || cda.date || info.date || Date.now()
    const endDateRaw = cda.event?.[0]?.period?.end || startDateRaw

    const startDate = parseCdaDate(startDateRaw)
    const endDate = parseCdaDate(endDateRaw)

    logger.debug('Survey date conversion', {
      startDateRaw,
      endDateRaw,
      startDate,
      endDate,
    })

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
    const basicAnalysis = await service.analyzeFileContent(content, filename)

    // If it's an HTML survey file, enhance the analysis with survey-specific details
    if (basicAnalysis.format === 'html') {
      try {
        const surveyData = extractSurveyDataFromHtml(content)

        if (surveyData && surveyData.cda) {
          const surveyAnalysis = analyzeSurveyData(surveyData)

          // Merge survey-specific analysis with basic analysis
          return {
            ...basicAnalysis,
            isSurvey: true,
            surveyData: surveyAnalysis,
            title: surveyAnalysis.title,
            questionnaire: surveyAnalysis.questionnaire,
            items: surveyAnalysis.items,
            results: surveyAnalysis.results,
            summary: surveyAnalysis.summary,
          }
        }
      } catch (error) {
        logger.warn('Failed to analyze survey data for preview', error)
      }
    }

    return basicAnalysis
  }

  /**
   * Analyze survey data for preview
   * @param {Object} surveyData - Extracted survey data
   * @returns {Object} Survey analysis
   */
  const analyzeSurveyData = (surveyData) => {
    const cda = surveyData.cda
    const info = surveyData.info || {}

    // Extract basic information - prioritize the proper questionnaire display name
    const title = cda.event?.[0]?.code?.[0]?.coding?.[0]?.display || info.title || cda.title || 'Imported Survey'
    const questionnaireCode = info.label || cda.event?.[0]?.code?.[0]?.coding?.[0]?.code || 'imported-survey'
    const questionnaire = {
      code: questionnaireCode,
      title: title,
      system: cda.event?.[0]?.code?.[0]?.coding?.[0]?.system || 'http://snomed.info/sct',
      display: cda.event?.[0]?.code?.[0]?.coding?.[0]?.display || title,
    }

    // Extract individual survey items (responses)
    const items = []
    const results = []

    // Process sections for findings (individual responses)
    if (cda.section) {
      for (const section of cda.section) {
        if (section.title === 'Findings Section' && section.entry) {
          for (const entry of section.entry) {
            const item = {
              id: entry.title,
              title: entry.title,
              value: entry.value,
              coding: entry.code?.[0]?.coding?.[0] || null,
              selected: true, // Default to selected
              type: typeof entry.value === 'number' ? 'numeric' : 'text',
              system: entry.code?.[0]?.coding?.[0]?.system || 'http://snomed.info/sct',
              code: entry.code?.[0]?.coding?.[0]?.code || '',
              display: entry.code?.[0]?.coding?.[0]?.display || entry.title,
            }
            items.push(item)
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
              selected: true, // Default to selected
              type: 'result',
              system: entry.code?.[0]?.coding?.[0]?.system || 'http://snomed.info/sct',
              code: entry.code?.[0]?.coding?.[0]?.code || '',
              display: entry.code?.[0]?.coding?.[0]?.display || entry.title,
            }
            results.push(result)
          }
        }
      }
    }

    // Create summary
    const totalScore = results.find((r) => r.id === 'sum' || r.title.toLowerCase().includes('sum'))
    const summary = {
      totalItems: items.length,
      totalResults: results.length,
      totalScore: totalScore ? totalScore.value : null,
      questionnaire: questionnaire.display || questionnaire.title,
      patientId: cda.subject?.display || info.PID || 'Unknown',
    }

    // Add evaluation if available
    if (cda.section) {
      const evalSection = cda.section.find((s) => s.title === 'Evaluation Section')
      if (evalSection && evalSection.text && evalSection.text.div) {
        // Extract evaluation text (remove HTML tags)
        const evaluationText = evalSection.text.div
          .replace(/<[^>]*>/g, '')
          .replace(/&[^;]+;/g, '')
          .trim()
        summary.evaluation = evaluationText
      }
    }

    return {
      title,
      questionnaire,
      items,
      results,
      summary,
      dates: {
        start: cda.event?.[0]?.period?.start || cda.date || info.date,
        end: cda.event?.[0]?.period?.end || cda.event?.[0]?.period?.start || cda.date || info.date,
      },
    }
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
    extractCdaAlternativeMethod,
    parseCdaDate,
    analyzeSurveyData,
    convertSurveyToQuestionnaireResponse,
  }
})
