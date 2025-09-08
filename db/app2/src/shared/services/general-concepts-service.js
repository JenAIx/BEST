/**
 * General Concepts Service
 *
 * Handles hierarchical concept resolution for standard demographic and clinical concepts
 * using SNOMED-CT and LOINC concept paths. This service provides a clean interface
 * for retrieving answer options for general concepts like gender, language, marital status, etc.
 *
 * Architecture:
 * - Parent concepts define categories (VALTYPE_CD = 'S' for Selection)
 * - Child concepts under specific paths provide answer options (VALTYPE_CD = 'A' for Answer)
 * - Uses proper medical terminology standards (SNOMED-CT, LOINC)
 */

import { createLogger } from 'src/core/services/logging-service'

/**
 * General concept definitions with their hierarchical paths
 * Each concept defines the parent path and the expected answer path structure
 */
const GENERAL_CONCEPTS = [
  {
    concept_char: 'gender',
    concept_cd: 'SCTID: 263495000',
    path: '\\SNOMED-CT\\363787003\\278844005\\263495000',
    answers_path: '\\SNOMED-CT\\363787003\\278844005\\263495000\\LA\\',
    valtype_parent: 'S',
    valtype_answers: 'A',
    description: 'Gender identity concepts',
  },
  {
    concept_char: 'language',
    concept_cd: 'LOINC: 54505-3',
    path: '\\LOINC\\ADMIN.DEMOG\\Patient\\54505-3',
    answers_path: '\\LOINC\\ADMIN.DEMOG\\Patient\\54505-3\\LA\\',
    valtype_parent: 'S',
    valtype_answers: 'A',
    description: 'Language preference concepts',
  },
  {
    concept_char: 'marital_status',
    concept_cd: 'LOINC: 45404-1',
    path: '\\LOINC\\ADMIN.PATIENT.DEMOG\\Patient\\45404-1',
    answers_path: '\\LOINC\\ADMIN.PATIENT.DEMOG\\Patient\\45404-1\\LA\\',
    valtype_parent: 'S',
    valtype_answers: 'A',
    description: 'Marital status concepts',
  },
  {
    concept_char: 'race',
    concept_cd: 'LOINC: 46463-6',
    path: '\\LOINC\\ADMIN.DEMOG\\Patient\\46463-6',
    answers_path: '\\LOINC\\ADMIN.DEMOG\\Patient\\46463-6\\LA\\',
    valtype_parent: 'S',
    valtype_answers: 'A',
    description: 'Race and ethnicity concepts',
  },
  {
    concept_char: 'religion',
    concept_cd: 'SCTID: 160538000',
    path: '\\SNOMED-CT\\160538000',
    answers_path: '\\SNOMED-CT\\160538000\\LA\\',
    valtype_parent: 'S',
    valtype_answers: 'A',
    description: 'Religious affiliation concepts',
  },
  {
    concept_char: 'vital_status',
    concept_cd: 'SCTID: 106234000',
    path: '\\SNOMED-CT\\138875005\\362981000\\272099008\\106232001\\106234000',
    answers_path: '\\SNOMED-CT\\138875005\\362981000\\272099008\\106232001\\106234000\\LA\\',
    valtype_parent: 'S',
    valtype_answers: 'A',
    description: 'Vital status (alive/deceased) concepts',
  },
]

/**
 * General Concepts Service Class
 */
export class GeneralConceptsService {
  constructor(databaseStore, logger = null) {
    this.dbStore = databaseStore
    this.logger = logger || createLogger('GeneralConceptsService')
  }

  /**
   * Get all available general concept definitions
   * @returns {Array} Array of general concept definitions
   */
  getGeneralConceptDefinitions() {
    return [...GENERAL_CONCEPTS] // Return a copy to prevent mutations
  }

  /**
   * Get a specific general concept definition by character
   * @param {string} conceptChar - The concept character (gender, language, etc.)
   * @returns {Object|null} Concept definition or null if not found
   */
  getGeneralConceptDefinition(conceptChar) {
    return GENERAL_CONCEPTS.find((c) => c.concept_char === conceptChar) || null
  }

  /**
   * Check if a concept character is a supported general concept
   * @param {string} conceptChar - The concept character to check
   * @returns {boolean} True if supported, false otherwise
   */
  isGeneralConcept(conceptChar) {
    return GENERAL_CONCEPTS.some((c) => c.concept_char === conceptChar)
  }

  /**
   * Map category names to general concept characters
   * Handles various naming conventions used across the application
   * @param {string} category - Category name (gender, vital_status, sex, etc.)
   * @returns {string|null} Mapped concept character or null
   */
  mapCategoryToConceptChar(category) {
    const mappings = {
      gender: 'gender',
      sex: 'gender',
      vital_status: 'vital_status',
      status: 'vital_status',
      language: 'language',
      race: 'race',
      marital_status: 'marital_status',
      religion: 'religion',
    }

    return mappings[category] || null
  }

  /**
   * Get answer options for a general concept using hierarchical concept paths
   * @param {string} conceptChar - The concept character (gender, language, etc.)
   * @returns {Promise<Array>} Array of {label, value, color} options
   */
  async getGeneralConceptAnswers(conceptChar) {
    const conceptDef = this.getGeneralConceptDefinition(conceptChar)
    if (!conceptDef) {
      this.logger.warn('Unknown general concept requested', { conceptChar })
      return []
    }

    const timer = this.logger.startTimer(`get_general_concept_answers_${conceptChar}`)

    try {
      // Query for answer concepts under the specific path
      const query = `
        SELECT CONCEPT_CD as code, NAME_CHAR as label, CONCEPT_PATH
        FROM CONCEPT_DIMENSION
        WHERE CONCEPT_PATH LIKE ?
        AND VALTYPE_CD = ?
        AND NAME_CHAR IS NOT NULL AND NAME_CHAR != ''
        ORDER BY NAME_CHAR
      `

      const pathPattern = `${conceptDef.answers_path}%`
      const result = await this.dbStore.executeQuery(query, [pathPattern, conceptDef.valtype_answers])

      if (result.success && result.data.length > 0) {
        const options = result.data.map((row) => ({
          label: row.label,
          value: row.code,
          color: this.determineColor(row.label, conceptChar),
          conceptPath: row.CONCEPT_PATH,
        }))

        timer.end()
        return options
      } else {
        timer.end()
        this.logger.warn('No answers found for general concept', { conceptChar, path: conceptDef.answers_path })
        return []
      }
    } catch (error) {
      timer.end()
      this.logger.error('Failed to load general concept answers', error, { conceptChar })
      return []
    }
  }

  /**
   * Get answer options for a category, mapping it to the appropriate general concept
   * @param {string} category - Category name (gender, vital_status, sex, etc.)
   * @returns {Promise<Array>} Array of {label, value, color} options
   */
  async getAnswersForCategory(category) {
    const conceptChar = this.mapCategoryToConceptChar(category)

    if (!conceptChar) {
      return []
    }

    return await this.getGeneralConceptAnswers(conceptChar)
  }

  /**
   * Determine color based on resolved text and context
   * @param {string} text - Resolved text or label
   * @param {string} context - Context hint (gender, vital_status, etc.)
   * @returns {string} Quasar color name
   */
  determineColor(text, context) {
    if (!text) return 'grey'

    const lowerText = text.toLowerCase()

    // Context-specific color mapping
    switch (context) {
      case 'gender':
        if (lowerText.includes('male') && !lowerText.includes('female')) return 'blue'
        if (lowerText.includes('female')) return 'pink'
        if (lowerText.includes('other') || lowerText.includes('non-binary')) return 'purple'
        break

      case 'vital_status':
        if (lowerText.includes('alive') || lowerText.includes('active')) return 'positive'
        if (lowerText.includes('dead') || lowerText.includes('deceased')) return 'negative'
        if (lowerText.includes('inactive') || lowerText.includes('unknown')) return 'grey'
        break

      case 'language':
        return 'blue'

      case 'race':
        return 'teal'

      case 'marital_status':
        if (lowerText.includes('married')) return 'positive'
        if (lowerText.includes('single')) return 'blue'
        if (lowerText.includes('divorced') || lowerText.includes('separated')) return 'orange'
        if (lowerText.includes('widowed')) return 'grey'
        break

      case 'religion':
        return 'purple'
    }

    return 'primary'
  }

  /**
   * Validate that required concept definitions exist in the database
   * @returns {Promise<Object>} Validation results with missing concepts
   */
  async validateGeneralConcepts() {
    const validation = {
      valid: true,
      missing: [],
      errors: [],
    }

    try {
      for (const concept of GENERAL_CONCEPTS) {
        // Check if parent concept exists
        const parentQuery = `
          SELECT CONCEPT_CD, NAME_CHAR, VALTYPE_CD
          FROM CONCEPT_DIMENSION
          WHERE CONCEPT_CD = ? AND VALTYPE_CD = ?
        `

        const parentResult = await this.dbStore.executeQuery(parentQuery, [concept.concept_cd, concept.valtype_parent])

        if (!parentResult.success || parentResult.data.length === 0) {
          validation.valid = false
          validation.missing.push({
            type: 'parent',
            concept_char: concept.concept_char,
            concept_cd: concept.concept_cd,
            expected_valtype: concept.valtype_parent,
          })
        }

        // Check if answer concepts exist
        const answersQuery = `
          SELECT COUNT(*) as count
          FROM CONCEPT_DIMENSION
          WHERE CONCEPT_PATH LIKE ? AND VALTYPE_CD = ?
        `

        const answersResult = await this.dbStore.executeQuery(answersQuery, [`${concept.answers_path}%`, concept.valtype_answers])

        if (!answersResult.success || answersResult.data[0].count === 0) {
          validation.valid = false
          validation.missing.push({
            type: 'answers',
            concept_char: concept.concept_char,
            answers_path: concept.answers_path,
            expected_valtype: concept.valtype_answers,
          })
        }
      }

      this.logger.info('General concepts validation completed', {
        valid: validation.valid,
        missingCount: validation.missing.length,
        totalConcepts: GENERAL_CONCEPTS.length,
      })
    } catch (error) {
      validation.valid = false
      validation.errors.push(error.message)
      this.logger.error('Failed to validate general concepts', error)
    }

    return validation
  }
}

/**
 * Create a general concepts service instance
 * @param {Object} databaseStore - Database store instance
 * @param {Object} logger - Logger instance (optional)
 * @returns {GeneralConceptsService} Service instance
 */
export function createGeneralConceptsService(databaseStore, logger = null) {
  return new GeneralConceptsService(databaseStore, logger)
}

export default GeneralConceptsService
