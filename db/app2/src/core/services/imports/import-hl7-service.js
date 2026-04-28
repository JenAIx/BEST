/**
 * HL7 Import Service
 *
 * Handles import of clinical data from HL7 FHIR Composition documents with support for:
 * - FHIR Composition document parsing
 * - Clinical data extraction and transformation
 * - Metadata preservation
 * - Proper handling of questionnaire observations with ValType='Q'
 *
 * NOTE: This service does NOT verify digital signatures on incoming HL7 documents.
 * Callers must establish trust through other means (transport security, manual review,
 * trusted source channels). If signature verification is required, add a Crypto-based
 * pre-check before parseHl7Content().
 */

import { createImportStructure } from './import-structure.js'
import { parseHl7Composition } from '@dbbest/clinical-schema'
import { logger } from '../logging-service.js'

export class ImportHl7Service {
  constructor(conceptRepository, cqlRepository) {
    this.conceptRepository = conceptRepository
    this.cqlRepository = cqlRepository
  }

  /**
   * Import HL7 FHIR Composition data from file content
   * @param {string} hl7Content - Raw HL7 FHIR file content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Import result with success/data/errors
   */
  async importFromHl7(hl7Content, filename) {
    try {
      logger.info('Starting HL7 FHIR Composition import', { filename })

      // Parse HL7 content
      const hl7Data = this.parseHl7Content(hl7Content)

      // Validate HL7 document structure
      const validationResult = this.validateHl7Document(hl7Data)
      if (!validationResult.isValid) {
        return {
          success: false,
          data: null,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }
      }

      // Transform to importStructure format
      const importStructure = this.transformToImportStructure(hl7Data, filename)

      // Validate the transformed structure
      const structureValidation = this.validateImportStructure(importStructure)
      if (!structureValidation.isValid) {
        return {
          success: false,
          data: null,
          errors: structureValidation.errors,
          warnings: structureValidation.warnings,
        }
      }

      logger.info('HL7 FHIR Composition import completed successfully', {
        patients: importStructure.data.patients.length,
        visits: importStructure.data.visits.length,
        observations: importStructure.data.observations.length,
      })

      return {
        success: true,
        data: importStructure,
        errors: [],
        warnings: validationResult.warnings,
      }
    } catch (error) {
      logger.error('HL7 FHIR Composition import failed', { error: error.message, filename })
      return {
        success: false,
        data: null,
        errors: [{ code: 'HL7_IMPORT_ERROR', message: error.message }],
        warnings: [],
      }
    }
  }

  /**
   * Parse HL7 content to extract FHIR Composition document
   * @param {string} hl7Content - Raw HL7 content
   * @returns {Object} FHIR Composition document
   */
  parseHl7Content(hl7Content) {
    try {
      // Strip UTF-8 BOM before trimming so files saved by Excel/Notepad still parse
      const cleanContent = hl7Content.replace(/^\uFEFF/, '').trim()

      if (!cleanContent.startsWith('{')) {
        throw new Error('HL7 content must be JSON format')
      }

      const hl7Data = JSON.parse(cleanContent)

      if (hl7Data.resourceType !== 'Composition') {
        throw new Error('Expected FHIR Composition resource type')
      }

      return hl7Data
    } catch (error) {
      if (error.message.includes('JSON')) {
        throw new Error('Failed to parse HL7 JSON content')
      }
      throw error
    }
  }

  /**
   * Validate HL7 document structure
   * @param {Object} hl7Data - FHIR Composition document
   * @returns {Object} Validation result
   */
  validateHl7Document(hl7Data) {
    const errors = []
    const warnings = []

    if (!hl7Data) {
      errors.push({ code: 'MISSING_DOCUMENT', message: 'HL7 document is empty or null' })
      return { isValid: false, errors, warnings }
    }

    if (hl7Data.resourceType !== 'Composition') {
      errors.push({ code: 'INVALID_RESOURCE_TYPE', message: 'Expected FHIR Composition resource type' })
    }

    if (!hl7Data.section || !Array.isArray(hl7Data.section)) {
      errors.push({ code: 'MISSING_SECTIONS', message: 'HL7 document missing sections array' })
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Transform HL7 data to importStructure format
   * @param {Object} hl7Data - FHIR Composition document
   * @param {string} filename - Original filename
   * @returns {Object} Import structure
   */
  transformToImportStructure(hl7Data, filename) {
    const importStructure = createImportStructure({
      metadata: {
        title: hl7Data.title || 'HL7 FHIR Composition Import',
        format: 'hl7',
        source: 'HL7 FHIR Composition',
        author: hl7Data.author?.[0]?.display || 'HL7 Import Service',
        exportDate: hl7Data.date || new Date().toISOString(),
        filename: filename,
      },
      exportInfo: {
        format: 'hl7',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        source: 'HL7 Import Service',
      },
    })

    // Extract data from sections via shared clinical-schema parser.
    // Lib leaves CATEGORY_CHAR null; we backfill via determineCategory() to
    // preserve dbBEST-specific category routing (LAB/DIAGNOSIS/SURVEY_BEST/...).
    const { patients, visits, observations } = parseHl7Composition(hl7Data)
    for (const o of observations) {
      o.CATEGORY_CHAR = this.determineCategory(o.CONCEPT_CD)
    }

    // Populate import structure
    importStructure.data.patients = patients
    importStructure.data.visits = visits
    importStructure.data.observations = observations

    // Update statistics
    importStructure.statistics.patientCount = patients.length
    importStructure.statistics.visitCount = visits.length
    importStructure.statistics.observationCount = observations.length
    importStructure.metadata.patientCount = patients.length
    importStructure.metadata.visitCount = visits.length
    importStructure.metadata.observationCount = observations.length
    importStructure.metadata.patientIds = patients.map((p) => p.PATIENT_CD || p.id)

    return importStructure
  }

  /**
   * Determine observation category from title
   * @param {string} title - Observation title
   * @returns {string} Category code
   */
  determineCategory(title) {
    if (!title) return 'CLINICAL'

    const titleLower = title.toLowerCase()
    if (titleLower.includes('questionnaire') || titleLower.includes('custom')) return 'SURVEY_BEST'
    if (titleLower.includes('lid:') && titleLower.includes('72172')) return 'SURVEY_BEST' // MoCA
    if (titleLower.includes('sctid:') && titleLower.includes('47965005')) return 'DIAGNOSIS'
    if (titleLower.includes('lid:') && (titleLower.includes('2947') || titleLower.includes('6298'))) return 'LAB'
    if (titleLower.includes('sctid:') && titleLower.includes('399423000')) return 'ADMINISTRATIVE'
    if (titleLower.includes('sctid:') && titleLower.includes('60621009')) return 'VITAL_SIGNS'
    if (titleLower.includes('lid:') && titleLower.includes('52418')) return 'MEDICATION'
    if (titleLower.includes('lid:') && titleLower.includes('74287')) return 'SOCIAL_HISTORY'
    if (titleLower.includes('sctid:') && titleLower.includes('262188008')) return 'ASSESSMENT'

    return 'CLINICAL'
  }

  /**
   * Validate import structure
   * @param {Object} importStructure - Import structure to validate
   * @returns {Object} Validation result
   */
  validateImportStructure(importStructure) {
    const errors = []
    const warnings = []

    if (!importStructure) {
      errors.push({ code: 'MISSING_STRUCTURE', message: 'Import structure is missing' })
      return { isValid: false, errors, warnings }
    }

    if (!importStructure.data) {
      errors.push({ code: 'MISSING_DATA', message: 'Import structure missing data section' })
    }

    if (!importStructure.metadata) {
      errors.push({ code: 'MISSING_METADATA', message: 'Import structure missing metadata section' })
    }

    if (!importStructure.statistics) {
      errors.push({ code: 'MISSING_STATISTICS', message: 'Import structure missing statistics section' })
    }

    return { isValid: errors.length === 0, errors, warnings }
  }
}
