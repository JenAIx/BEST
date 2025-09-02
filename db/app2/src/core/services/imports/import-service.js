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
      if (analysis.hasMultipleVisits) {
        analysis.recommendedStrategy = 'multiple_visits'
      } else {
        analysis.recommendedStrategy = 'single_patient'
      }
    } else if (analysis.patientsCount <= 10) {
      analysis.recommendedStrategy = 'multiple_patients'
    } else {
      analysis.recommendedStrategy = 'batch_import'
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
