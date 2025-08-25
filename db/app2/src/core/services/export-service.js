/**
 * Export Service for Clinical Data
 *
 * Unified service for exporting clinical data in multiple formats:
 * - CSV: Using existing CsvService
 * - JSON: Native JSON export
 * - HL7: Using existing Hl7Service
 *
 * Features:
 * - Data fetching and preparation
 * - Format-specific export handling
 * - File download management
 * - Export metadata and audit trails
 */

import { CsvService } from './csv-service.js'
import { Hl7Service } from './hl7-service.js'
import { createLogger } from './logging-service.js'

export class ExportService {
  constructor(databaseService) {
    this.databaseService = databaseService
    this.logger = createLogger('ExportService')

    // Initialize format-specific services
    this.csvService = null
    this.hl7Service = null

    // Export configuration
    this.config = {
      maxPatientsPerExport: 1000,
      includeVisits: true,
      includeObservations: true,
      includeNotes: false, // Can be enabled later
    }
  }

  /**
   * Initialize the export service with repositories
   */
  async initialize() {
    try {
      if (!this.databaseService.isInitialized) {
        throw new Error('Database service must be initialized first')
      }

      // Get repositories
      const conceptRepo = this.databaseService.getRepository('concept')
      const cqlRepo = this.databaseService.getRepository('cql')

      if (!conceptRepo || !cqlRepo) {
        throw new Error('Required repositories (concept, cql) not available')
      }

      // Initialize format-specific services
      this.csvService = new CsvService(conceptRepo, cqlRepo)
      this.hl7Service = new Hl7Service(conceptRepo, cqlRepo)

      this.logger.info(null, 'Export service initialized successfully')
      return true
    } catch (error) {
      this.logger.error(null, 'Failed to initialize export service', error)
      throw error
    }
  }

  /**
   * Export selected patients in specified format
   * @param {Array} selectedPatients - Array of patient objects from UI
   * @param {string} format - Export format ('csv', 'json', 'hl7')
   * @param {Object} options - Export options
   * @returns {Object} Export result with content and metadata
   */
  async exportPatients(selectedPatients, format = 'csv', options = {}) {
    try {
      this.logger.info(null, `Starting export of ${selectedPatients.length} patients in ${format} format`)

      // Validate inputs
      if (!selectedPatients || selectedPatients.length === 0) {
        throw new Error('No patients selected for export')
      }

      if (selectedPatients.length > this.config.maxPatientsPerExport) {
        throw new Error(`Too many patients selected. Maximum allowed: ${this.config.maxPatientsPerExport}`)
      }

      // Extract patient IDs
      const patientIds = selectedPatients.map((p) => p.id || p.PATIENT_CD)

      // Fetch complete patient data
      const exportData = await this.fetchPatientData(patientIds, options)

      // Generate export metadata
      const metadata = this.generateExportMetadata(selectedPatients, format, options)

      // Export in specified format
      let result
      switch (format.toLowerCase()) {
        case 'csv':
          result = await this.exportToCsv(exportData, metadata)
          break
        case 'json':
          result = await this.exportToJson(exportData, metadata)
          break
        case 'hl7':
          result = await this.exportToHl7(exportData, metadata)
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

      // Log successful export with details
      this.logger.success(null, `Export completed successfully`, {
        format: format.toUpperCase(),
        patientCount: selectedPatients.length,
        filename: result.filename,
        fileSize: `${(result.size / 1024).toFixed(2)} KB`,
        exportTime: new Date().toISOString(),
      })

      return result
    } catch (error) {
      this.logger.error(null, 'Export failed', error)
      throw error
    }
  }

  /**
   * Fetch complete patient data including visits and observations
   * @param {Array} patientIds - Array of patient IDs
   * @param {Object} options - Fetch options
   * @returns {Object} Complete patient data
   */
  async fetchPatientData(patientIds, options = {}) {
    try {
      const patientRepo = this.databaseService.getRepository('patient')
      const visitRepo = this.databaseService.getRepository('visit')
      const observationRepo = this.databaseService.getRepository('observation')

      // Fetch patients
      this.logger.info(null, `Fetching data for ${patientIds.length} patients`)
      const patients = []

      for (const patientId of patientIds) {
        const patient = await patientRepo.findByPatientCode(patientId)
        if (patient) {
          patients.push(patient)
        } else {
          this.logger.warn(null, `Patient not found: ${patientId}`)
        }
      }

      if (patients.length === 0) {
        throw new Error('No valid patients found for export')
      }

      // Get patient numbers for related data
      const patientNums = patients.map((p) => p.PATIENT_NUM)

      // Fetch visits if requested
      let visits = []
      if (options.includeVisits !== false && this.config.includeVisits) {
        this.logger.info(null, 'Fetching visit data')
        for (const patientNum of patientNums) {
          const patientVisits = await visitRepo.findByPatientNum(patientNum)
          visits.push(...patientVisits)
        }
      }

      // Fetch observations if requested
      let observations = []
      if (options.includeObservations !== false && this.config.includeObservations) {
        this.logger.info(null, 'Fetching observation data')
        for (const patientNum of patientNums) {
          const patientObservations = await observationRepo.findByPatientNum(patientNum)
          observations.push(...patientObservations)
        }
      }

      return {
        patients,
        visits,
        observations,
        metadata: {
          patientCount: patients.length,
          visitCount: visits.length,
          observationCount: observations.length,
          fetchedAt: new Date().toISOString(),
        },
      }
    } catch (error) {
      this.logger.error(null, 'Failed to fetch patient data', error)
      throw error
    }
  }

  /**
   * Export data to CSV format
   * @param {Object} exportData - Complete patient data
   * @param {Object} metadata - Export metadata
   * @returns {Object} CSV export result
   */
  async exportToCsv(exportData, metadata) {
    try {
      if (!this.csvService) {
        throw new Error('CSV service not initialized')
      }

      const csvContent = await this.csvService.exportToCsv({
        patients: exportData.patients,
        visits: exportData.visits,
        observations: exportData.observations,
        metadata,
      })

      return {
        content: csvContent,
        filename: this.generateFilename('csv', metadata),
        mimeType: 'text/csv',
        size: csvContent.length,
        metadata,
      }
    } catch (error) {
      this.logger.error(null, 'CSV export failed', error)
      throw error
    }
  }

  /**
   * Export data to JSON format
   * @param {Object} exportData - Complete patient data
   * @param {Object} metadata - Export metadata
   * @returns {Object} JSON export result
   */
  async exportToJson(exportData, metadata) {
    try {
      const jsonData = {
        metadata,
        exportInfo: {
          format: 'json',
          version: '1.0',
          exportedAt: new Date().toISOString(),
          source: 'BEST Medical System',
        },
        data: {
          patients: exportData.patients,
          visits: exportData.visits,
          observations: exportData.observations,
        },
        statistics: exportData.metadata,
      }

      const jsonContent = JSON.stringify(jsonData, null, 2)

      return {
        content: jsonContent,
        filename: this.generateFilename('json', metadata),
        mimeType: 'application/json',
        size: jsonContent.length,
        metadata,
      }
    } catch (error) {
      this.logger.error(null, 'JSON export failed', error)
      throw error
    }
  }

  /**
   * Export data to HL7 format
   * @param {Object} exportData - Complete patient data
   * @param {Object} metadata - Export metadata
   * @returns {Object} HL7 export result
   */
  async exportToHl7(exportData, metadata) {
    try {
      if (!this.hl7Service) {
        throw new Error('HL7 service not initialized')
      }

      const hl7Result = await this.hl7Service.exportToHl7({
        patients: exportData.patients,
        visits: exportData.visits,
        observations: exportData.observations,
        metadata,
      })

      const hl7Content = JSON.stringify(hl7Result.cda, null, 2)

      return {
        content: hl7Content,
        filename: this.generateFilename('hl7', metadata),
        mimeType: 'application/json', // HL7 FHIR is JSON-based
        size: hl7Content.length,
        metadata,
        hash: hl7Result.hash,
        additionalInfo: hl7Result.info,
      }
    } catch (error) {
      this.logger.error(null, 'HL7 export failed', error)
      throw error
    }
  }

  /**
   * Generate export metadata
   * @param {Array} selectedPatients - Selected patients
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Object} Export metadata
   */
  generateExportMetadata(selectedPatients, format, options) {
    return {
      title: `Patient Data Export - ${format.toUpperCase()}`,
      exportDate: new Date().toISOString(),
      format: format.toLowerCase(),
      source: 'BEST Medical System',
      version: '1.0',
      author: 'System Export',
      patientCount: selectedPatients.length,
      patientIds: selectedPatients.map((p) => p.id || p.PATIENT_CD),
      options: {
        includeVisits: options.includeVisits !== false,
        includeObservations: options.includeObservations !== false,
        includeNotes: options.includeNotes === true,
      },
    }
  }

  /**
   * Generate filename for export
   * @param {string} format - Export format
   * @param {Object} metadata - Export metadata
   * @returns {string} Generated filename
   */
  generateFilename(format, metadata) {
    const date = new Date().toISOString().split('T')[0]
    const time = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-')
    const patientCount = metadata.patientCount || 0

    return `patient-export-${patientCount}-patients-${date}-${time}.${format}`
  }

  /**
   * Download exported data as file
   * @param {Object} exportResult - Export result from exportPatients
   */
  downloadExportedData(exportResult) {
    try {
      const { content, filename, mimeType } = exportResult

      // Create blob and download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Clean up
      URL.revokeObjectURL(url)

      this.logger.success(null, `File download completed`, {
        filename,
        mimeType,
        size: `${(content.length / 1024).toFixed(2)} KB`,
        downloadTime: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error(null, 'Download failed', error)
      throw error
    }
  }

  /**
   * Get export statistics
   * @returns {Object} Export statistics
   */
  getExportStatistics() {
    return {
      supportedFormats: ['csv', 'json', 'hl7'],
      maxPatientsPerExport: this.config.maxPatientsPerExport,
      defaultIncludes: {
        visits: this.config.includeVisits,
        observations: this.config.includeObservations,
        notes: this.config.includeNotes,
      },
    }
  }

  /**
   * Update export configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.logger.info(null, 'Export configuration updated', newConfig)
  }
}

export default ExportService
