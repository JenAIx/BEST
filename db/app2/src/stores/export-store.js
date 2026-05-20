import { defineStore } from 'pinia'
import { useDatabaseStore } from './database-store'
import databaseService from 'src/core/services/database-service'
import { ExportService } from 'src/core/services/export-service'
import { createLogger } from 'src/core/services/logging-service'

export const useExportStore = defineStore('export', () => {
  const dbStore = useDatabaseStore()
  const logger = createLogger('ExportStore')

  /**
   * Export concepts to CSV format matching concept_dimension_data.csv structure
   */
  const exportConceptsToCSV = async () => {
    const timer = logger.startTimer('CSV Export')
    logger.info('Starting concept CSV export')

    try {
      const conceptRepo = dbStore.getRepository('concept')
      if (!conceptRepo) {
        logger.error('Concept repository not available')
        throw new Error('Concept repository not available')
      }

      // Get all concepts without pagination using findAll method
      logger.debug('Fetching all concepts from database')
      const allConcepts = await conceptRepo.findAll()

      if (!allConcepts || allConcepts.length === 0) {
        logger.warn('No concepts found to export')
        throw new Error('No concepts found to export')
      }

      logger.info(`Found ${allConcepts.length} concepts to export`)

      // Define CSV headers based on concept_dimension_data.csv
      const headers = [
        'CONCEPT_PATH',
        'CONCEPT_CD',
        'NAME_CHAR',
        'VALTYPE_CD',
        'UNIT_CD',
        'RELATED_CONCEPT',
        'CONCEPT_BLOB',
        'UPDATE_DATE',
        'DOWNLOAD_DATE',
        'IMPORT_DATE',
        'SOURCESYSTEM_CD',
        'UPLOAD_ID',
        'CATEGORY_CHAR',
      ]

      // Convert concepts to CSV rows
      const csvRows = [headers.join(',')]

      allConcepts.forEach((concept) => {
        const row = [
          escapeCsvValue(concept.CONCEPT_PATH || ''),
          escapeCsvValue(concept.CONCEPT_CD || ''),
          escapeCsvValue(concept.NAME_CHAR || ''),
          escapeCsvValue(concept.VALTYPE_CD || ''),
          escapeCsvValue(concept.UNIT_CD || ''),
          escapeCsvValue(concept.RELATED_CONCEPT || ''),
          escapeCsvValue(concept.CONCEPT_BLOB || ''),
          escapeCsvValue(concept.UPDATE_DATE || ''),
          escapeCsvValue(concept.DOWNLOAD_DATE || ''),
          escapeCsvValue(concept.IMPORT_DATE || ''),
          escapeCsvValue(concept.SOURCESYSTEM_CD || ''),
          escapeCsvValue(concept.UPLOAD_ID || ''),
          escapeCsvValue(concept.CATEGORY_CHAR || ''),
        ]
        csvRows.push(row.join(','))
      })

      const csvContent = csvRows.join('\n')
      logger.debug('CSV content generated', {
        totalRows: csvRows.length,
        contentLength: csvContent.length,
      })

      // Create and trigger download
      const filename = `concepts_export_${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(csvContent, filename)

      const duration = timer.end()
      logger.success('CSV export completed successfully', {
        recordCount: allConcepts.length,
        filename,
        duration: `${duration.toFixed(2)}ms`,
        fileSize: `${(csvContent.length / 1024).toFixed(2)}KB`,
      })

      return {
        recordCount: allConcepts.length,
        filename,
        message: `Successfully exported ${allConcepts.length} concepts to ${filename}`,
        duration: duration.toFixed(2),
        fileSize: (csvContent.length / 1024).toFixed(2),
      }
    } catch (error) {
      timer.end()
      logger.error('Failed to export concepts to CSV', error, {
        errorMessage: error.message,
        stack: error.stack,
      })
      throw error
    }
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) {
      return ''
    }

    const stringValue = String(value)

    // If the value contains comma, quote, or newline, wrap it in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }

    return stringValue
  }

  /**
   * Create and trigger file download
   */
  const downloadCSV = (csvContent, filename) => {
    logger.debug('Creating CSV download', {
      filename,
      contentSize: csvContent.length,
    })

    try {
      // Create blob with UTF-8 BOM for proper Excel compatibility
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })

      // Create download link
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      URL.revokeObjectURL(url)

      logger.debug('File download triggered successfully', { filename })
    } catch (error) {
      logger.error('Failed to trigger file download', error, { filename })
      throw new Error(`Failed to download file: ${error.message}`)
    }
  }

  /**
   * Export all patients enrolled in a study, in the chosen format.
   * Runs the same ExportService the headless CLI uses (scripts/import-fw-lipid/export.js)
   * and triggers a browser download.
   *
   * @param {string} studyCd - STUDY_CD (e.g. 'STROKE_LIPID')
   * @param {'csv'|'hl7'} format - export format
   * @returns {Promise<{recordCount:number, filename:string, sizeBytes:number}>}
   */
  const exportStudyPatients = async (studyCd, format = 'csv') => {
    const timer = logger.startTimer(`Study patient export (${format})`)
    logger.info('Starting study patient export', { studyCd, format })

    try {
      const studyRepo = dbStore.getRepository('study')
      if (!studyRepo || typeof studyRepo.findEnrolledPatientCds !== 'function') {
        throw new Error('Study repository or findEnrolledPatientCds not available')
      }
      const patientCds = await studyRepo.findEnrolledPatientCds(studyCd)
      if (!patientCds.length) {
        throw new Error(`No enrolled patients found for study ${studyCd}`)
      }

      // ExportService is part of the same DatabaseService boot the app has
      // already completed, so initialize() just hooks up the existing repos.
      const exporter = new ExportService(databaseService)
      await exporter.initialize()

      const selected = patientCds.map((cd) => ({ id: cd, PATIENT_CD: cd }))
      const result = await exporter.exportPatients(selected, format, {
        includeVisits: true,
        includeObservations: true,
        includeNotes: false,
      })

      const mimeType = format === 'hl7' ? 'application/json' : 'text/csv'
      downloadFile(result.content, result.filename, mimeType)

      const duration = timer.end()
      logger.success('Study patient export completed', {
        studyCd,
        format,
        recordCount: patientCds.length,
        filename: result.filename,
        sizeBytes: result.size,
        duration: `${duration.toFixed(2)}ms`,
      })

      return {
        recordCount: patientCds.length,
        filename: result.filename,
        sizeBytes: result.size,
      }
    } catch (error) {
      timer.end()
      logger.error('Failed to export study patients', error, { studyCd, format })
      throw error
    }
  }

  /**
   * Generic file download (factored out so both CSV and HL7-JSON can reuse it).
   * UTF-8 BOM is only useful for Excel-CSV; HL7-JSON ships without one.
   */
  const downloadFile = (content, filename, mimeType) => {
    try {
      const isCsv = mimeType && mimeType.includes('csv')
      const payload = isCsv ? '﻿' + content : content
      const blob = new Blob([payload], { type: `${mimeType};charset=utf-8;` })

      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      logger.error('Failed to trigger file download', error, { filename })
      throw new Error(`Failed to download file: ${error.message}`)
    }
  }

  return {
    exportConceptsToCSV,
    exportStudyPatients,
  }
})
