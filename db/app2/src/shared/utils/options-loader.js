/**
 * Options Loader Utility
 *
 * Handles loading of various dropdown options from database:
 * - Category options
 * - Concept options by category
 * - Finding options for concepts
 * - Selection options for concepts
 */

import { determineColor } from './color-mapper.js'

/**
 * Options Loader class
 */
export class OptionsLoader {
  constructor(databaseStore, globalSettingsStore = null, logger = null) {
    this.dbStore = databaseStore
    this.globalSettingsStore = globalSettingsStore
    this.logger = logger
  }

  /**
   * Get category options for dropdowns
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value} options
   */
  async getCategoryOptions(forceRefresh = false) {
    const timer = this.startTimer('get_category_options')

    try {
      this.log('debug', 'Loading category options from global settings')

      if (this.globalSettingsStore) {
        const categoryOptions = await this.globalSettingsStore.getCategoryOptions(forceRefresh)
        const duration = timer.end()

        this.log('info', 'Category options loaded and cached', {
          optionsCount: categoryOptions.length,
          duration,
        })

        return categoryOptions
      }

      // Fallback if no global settings store
      const fallbackCategories = [
        { label: 'General', value: 'CAT_GENERAL' },
        { label: 'Demographics', value: 'CAT_DEMOGRAPHICS' },
        { label: 'Laboratory', value: 'CAT_LABORATORY' },
        { label: 'Vital Signs', value: 'CAT_VITAL_SIGNS' },
      ]

      timer.end()
      return fallbackCategories
    } catch (error) {
      timer.end()
      this.log('error', 'Failed to get category options', error)

      // Return fallback categories
      const fallbackCategories = [
        { label: 'General', value: 'CAT_GENERAL' },
        { label: 'Demographics', value: 'CAT_DEMOGRAPHICS' },
        { label: 'Laboratory', value: 'CAT_LABORATORY' },
        { label: 'Vital Signs', value: 'CAT_VITAL_SIGNS' },
      ]

      return fallbackCategories
    }
  }

  /**
   * Get dropdown options for a specific concept category
   * @param {string} category - Category (gender, vital_status, language, race, etc.)
   * @param {string} table - Optional table context
   * @param {string} column - Optional column context
   * @returns {Promise<Array>} Array of {label, value, color} options
   */
  async getConceptOptions(category, table = null, column = null) {
    const timer = this.startTimer(`get_options_${category}`)

    try {
      this.log('debug', 'Loading concept options from database', { category, table, column })

      let query = ''
      let params = []

      // Build query based on category
      switch (category) {
        case 'gender':
        case 'sex':
          query = `
            SELECT DISTINCT SEX_CD as code, SEX_RESOLVED as label
            FROM patient_list
            WHERE SEX_RESOLVED IS NOT NULL AND SEX_RESOLVED != ''
            ORDER BY SEX_RESOLVED
          `
          break

        case 'vital_status':
        case 'status':
          query = `
            SELECT DISTINCT VITAL_STATUS_CD as code, VITAL_STATUS_RESOLVED as label
            FROM patient_list
            WHERE VITAL_STATUS_RESOLVED IS NOT NULL AND VITAL_STATUS_RESOLVED != ''
            ORDER BY VITAL_STATUS_RESOLVED
          `
          break

        case 'language':
          query = `
            SELECT DISTINCT LANGUAGE_CD as code, LANGUAGE_RESOLVED as label
            FROM patient_list
            WHERE LANGUAGE_RESOLVED IS NOT NULL AND LANGUAGE_RESOLVED != ''
            ORDER BY LANGUAGE_RESOLVED
          `
          break

        case 'race':
          query = `
            SELECT DISTINCT RACE_CD as code, RACE_RESOLVED as label
            FROM patient_list
            WHERE RACE_RESOLVED IS NOT NULL AND RACE_RESOLVED != ''
            ORDER BY RACE_RESOLVED
          `
          break

        case 'marital_status':
          query = `
            SELECT DISTINCT MARITAL_STATUS_CD as code, MARITAL_STATUS_RESOLVED as label
            FROM patient_list
            WHERE MARITAL_STATUS_RESOLVED IS NOT NULL AND MARITAL_STATUS_RESOLVED != ''
            ORDER BY MARITAL_STATUS_RESOLVED
          `
          break

        case 'religion':
          query = `
            SELECT DISTINCT RELIGION_CD as code, RELIGION_RESOLVED as label
            FROM patient_list
            WHERE RELIGION_RESOLVED IS NOT NULL AND RELIGION_RESOLVED != ''
            ORDER BY RELIGION_RESOLVED
          `
          break

        case 'visit_status':
          // For visit status, query CONCEPT_DIMENSION for SNOMED-CT visit status concepts
          query = `
            SELECT DISTINCT CONCEPT_CD as code, NAME_CHAR as label, CONCEPT_PATH
            FROM CONCEPT_DIMENSION
            WHERE CONCEPT_PATH LIKE '\\SNOMED-CT\\138875005\\362981000\\272099008\\106232001\\106234000\\%'
            AND NAME_CHAR IS NOT NULL AND NAME_CHAR != ''
            ORDER BY NAME_CHAR
          `
          break

        case 'visit_type':
          // For visit type, query CODE_LOOKUP for visit types
          query = `
            SELECT DISTINCT CODE_CD as code, NAME_CHAR as label
            FROM CODE_LOOKUP
            WHERE TABLE_CD = 'VISIT_DIMENSION' AND COLUMN_CD = 'VISIT_TYPE_CD'
            AND NAME_CHAR IS NOT NULL AND NAME_CHAR != ''
            ORDER BY NAME_CHAR
          `
          break

        case 'inout_type':
        case 'visit_inout':
          // For inpatient/outpatient status, query CODE_LOOKUP for INOUT_CD values
          query = `
            SELECT DISTINCT CODE_CD as code, NAME_CHAR as label
            FROM CODE_LOOKUP
            WHERE TABLE_CD = 'VISIT_DIMENSION' AND COLUMN_CD = 'INOUT_CD'
            AND NAME_CHAR IS NOT NULL AND NAME_CHAR != ''
            ORDER BY NAME_CHAR
          `
          break

        default:
          // Generic concept lookup
          if (table && column) {
            query = `
              SELECT DISTINCT CODE_CD as code, NAME_CHAR as label
              FROM CODE_LOOKUP
              WHERE TABLE_CD = ? AND COLUMN_CD = ?
              AND NAME_CHAR IS NOT NULL AND NAME_CHAR != ''
              ORDER BY NAME_CHAR
            `
            params = [table, column]
          } else {
            // Fallback to CONCEPT_DIMENSION
            query = `
              SELECT DISTINCT CONCEPT_CD as code, NAME_CHAR as label
              FROM CONCEPT_DIMENSION
              WHERE NAME_CHAR IS NOT NULL AND NAME_CHAR != ''
              ORDER BY NAME_CHAR
              LIMIT 50
            `
          }
      }

      const result = await this.dbStore.executeQuery(query, params)

      if (!result.success || !result.data) {
        return this.getFallbackOptions(category)
      }

      // Convert to options format
      const options = result.data.map((row) => {
        const code = row.code
        const label = row.label
        const color = determineColor(label, category)

        return {
          label,
          value: code,
          color,
        }
      })

      const duration = timer.end()
      this.log('info', 'Concept options loaded successfully', {
        category,
        optionsCount: options.length,
        duration,
      })

      return options
    } catch (error) {
      timer.end()
      this.log('error', 'Failed to get concept options', error, {
        category,
        table,
        column,
      })

      const fallbackOptions = this.getFallbackOptions(category)
      this.log('warn', 'Using fallback options', {
        category,
        fallbackCount: fallbackOptions.length,
      })

      return fallbackOptions
    }
  }

  /**
   * Get finding-specific answer options based on concept hierarchy
   * @param {string} conceptCode - The finding concept code
   * @returns {Promise<Array>} Array of finding answer options
   */
  async getFindingOptions(conceptCode) {
    if (!conceptCode) {
      this.log('debug', 'No concept code provided for finding options')
      return []
    }

    const timer = this.startTimer(`get_finding_options_${conceptCode}`)

    try {
      this.log('info', 'Fetching finding options from concept hierarchy', { conceptCode })

      // Get the finding concept and its hierarchy path
      const conceptQuery = 'SELECT CONCEPT_PATH, NAME_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?'
      const conceptResult = await this.dbStore.executeQuery(conceptQuery, [conceptCode])

      let formattedOptions = []

      if (conceptResult.success && conceptResult.data.length > 0) {
        const conceptData = conceptResult.data[0]
        const conceptPath = conceptData.CONCEPT_PATH
        const conceptName = conceptData.NAME_CHAR

        if (conceptPath) {
          this.log('debug', 'Found finding concept path', { conceptCode, conceptPath, conceptName })

          // For findings, we look for answer values in the standard SNOMED-CT answer hierarchy
          // Path: \SNOMED-CT\362981000\260245000 contains standard clinical answer values
          const answerQuery = `
            SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_PATH
            FROM CONCEPT_DIMENSION
            WHERE CONCEPT_PATH LIKE '\\SNOMED-CT\\362981000\\260245000%'
            AND NAME_CHAR IS NOT NULL
            AND LENGTH(NAME_CHAR) < 50
            ORDER BY
              CASE
                WHEN NAME_CHAR LIKE '%yes%' THEN 1
                WHEN NAME_CHAR LIKE '%positive%' THEN 2
                WHEN NAME_CHAR LIKE '%present%' THEN 3
                WHEN NAME_CHAR LIKE '%detected%' THEN 4
                WHEN NAME_CHAR LIKE '%normal%' THEN 5
                WHEN NAME_CHAR LIKE '%no%' THEN 6
                WHEN NAME_CHAR LIKE '%negative%' THEN 7
                WHEN NAME_CHAR LIKE '%absent%' THEN 8
                WHEN NAME_CHAR LIKE '%not detected%' THEN 9
                WHEN NAME_CHAR LIKE '%abnormal%' THEN 10
                ELSE 11
              END,
              NAME_CHAR
            LIMIT 15
          `

          const answerResult = await this.dbStore.executeQuery(answerQuery, [])

          if (answerResult.success && answerResult.data.length > 0) {
            this.log('info', 'Found finding answer concepts in SNOMED-CT answer hierarchy', {
              conceptCode,
              answerPath: '\\SNOMED-CT\\362981000\\260245000',
              answerCount: answerResult.data.length,
            })

            // Convert answer concepts to selection format
            formattedOptions = answerResult.data.map((answer) => ({
              label: answer.NAME_CHAR,
              value: answer.CONCEPT_CD,
              conceptPath: answer.CONCEPT_PATH || '',
              type: 'finding_answer',
            }))
          } else {
            this.log('warn', 'No finding answer concepts found in SNOMED-CT answer hierarchy', {
              conceptCode,
              answerPath: '\\SNOMED-CT\\362981000\\260245000',
            })
          }
        } else {
          this.log('warn', 'Finding concept has no CONCEPT_PATH', { conceptCode })
        }
      } else {
        this.log('warn', 'Finding concept not found', { conceptCode })
      }

      // If no hierarchy-based options found, provide clinical finding answers
      if (formattedOptions.length === 0) {
        this.log('info', 'No hierarchy options found, using clinical finding answers')
        formattedOptions = [
          { label: 'Present', value: 'SCTID: 52101004', conceptPath: '', type: 'fallback' },
          { label: 'Absent', value: 'SCTID: 2667000', conceptPath: '', type: 'fallback' },
          { label: 'Positive', value: 'SCTID: 10828004', conceptPath: '', type: 'fallback' },
          { label: 'Negative', value: 'SCTID: 260385009', conceptPath: '', type: 'fallback' },
          { label: 'Normal', value: 'SCTID: 17621005', conceptPath: '', type: 'fallback' },
          { label: 'Abnormal', value: 'SCTID: 263654008', conceptPath: '', type: 'fallback' },
        ]
      }

      const finalOptions = formattedOptions.slice(0, 10) // Limit to 10 options

      const duration = timer.end()
      this.log('info', 'Finding options fetched', {
        conceptCode,
        optionsCount: finalOptions.length,
        duration,
      })

      return finalOptions
    } catch (error) {
      timer.end()
      this.log('error', 'Failed to get finding options', error, { conceptCode })

      // Return clinical finding fallback options
      const fallbackOptions = [
        { label: 'Present', value: 'Present', type: 'fallback' },
        { label: 'Absent', value: 'Absent', type: 'fallback' },
        { label: 'Positive', value: 'Positive', type: 'fallback' },
        { label: 'Negative', value: 'Negative', type: 'fallback' },
        { label: 'Normal', value: 'Normal', type: 'fallback' },
        { label: 'Abnormal', value: 'Abnormal', type: 'fallback' },
      ]

      return fallbackOptions
    }
  }

  /**
   * Get standard selection options for non-Finding concepts
   * @param {string} conceptCode - The concept code to get options for
   * @returns {Promise<Array>} Array of selection options
   */
  async getStandardSelectionOptions(conceptCode) {
    const timer = this.startTimer(`get_standard_selection_options_${conceptCode}`)

    try {
      this.log('info', 'Fetching standard selection options from concept hierarchy', { conceptCode })

      // First, get the parent concept to find its CONCEPT_PATH
      const parentQuery = 'SELECT CONCEPT_PATH FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?'
      const parentResult = await this.dbStore.executeQuery(parentQuery, [conceptCode])

      let formattedOptions = []

      if (parentResult.success && parentResult.data.length > 0) {
        const parentPath = parentResult.data[0].CONCEPT_PATH

        if (parentPath) {
          this.log('debug', 'Found parent concept path', { conceptCode, parentPath })

          // Query for child concepts in the hierarchy path
          const childQuery = `
            SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_PATH
            FROM CONCEPT_DIMENSION
            WHERE CONCEPT_PATH LIKE ?
            AND CONCEPT_CD != ?
            AND LENGTH(CONCEPT_PATH) > LENGTH(?)
            AND NAME_CHAR IS NOT NULL
            ORDER BY NAME_CHAR
            LIMIT 20
          `

          const pathPattern = `${parentPath}%`
          const childResult = await this.dbStore.executeQuery(childQuery, [pathPattern, conceptCode, parentPath])

          if (childResult.success && childResult.data.length > 0) {
            this.log('info', 'Found child concepts in hierarchy', {
              conceptCode,
              parentPath,
              childCount: childResult.data.length,
            })

            // Convert child concepts to selection format
            formattedOptions = childResult.data.map((child) => ({
              label: child.NAME_CHAR,
              value: child.CONCEPT_CD,
              conceptPath: child.CONCEPT_PATH || '',
            }))
          } else {
            this.log('warn', 'No child concepts found in hierarchy', { conceptCode, parentPath })
          }
        } else {
          this.log('warn', 'Parent concept has no CONCEPT_PATH', { conceptCode })
        }
      } else {
        this.log('warn', 'Parent concept not found', { conceptCode })
      }

      // If no hierarchy-based options found, provide common clinical answers
      if (formattedOptions.length === 0) {
        this.log('info', 'No hierarchy options found, using common clinical answers')
        formattedOptions = [
          { label: 'Yes', value: 'SCTID: 373066001', conceptPath: '' },
          { label: 'No', value: 'SCTID: 373067005', conceptPath: '' },
          { label: 'Present', value: 'SCTID: 52101004', conceptPath: '' },
          { label: 'Absent', value: 'SCTID: 2667000', conceptPath: '' },
          { label: 'Normal', value: 'SCTID: 17621005', conceptPath: '' },
          { label: 'Abnormal', value: 'SCTID: 263654008', conceptPath: '' },
        ]
      }

      const finalOptions = formattedOptions.slice(0, 10) // Limit to 10 options

      const duration = timer.end()
      this.log('info', 'Standard selection options fetched', {
        conceptCode,
        optionsCount: finalOptions.length,
        duration,
      })

      return finalOptions
    } catch (error) {
      timer.end()
      this.log('error', 'Failed to get standard selection options', error, { conceptCode })

      // Return fallback options
      const fallbackOptions = [
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' },
        { label: 'Unknown', value: 'Unknown' },
        { label: 'Not Applicable', value: 'N/A' },
      ]

      return fallbackOptions
    }
  }

  /**
   * Get selection options for a concept (dispatches to appropriate method based on type)
   * @param {string} conceptCode - The concept code to get options for
   * @returns {Promise<Array>} Array of selection options
   */
  async getSelectionOptions(conceptCode) {
    if (!conceptCode) {
      this.log('debug', 'No concept code provided for selection options')
      return []
    }

    try {
      // First, get the concept to determine its VALTYPE_CD
      const conceptQuery = 'SELECT VALTYPE_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?'
      const conceptResult = await this.dbStore.executeQuery(conceptQuery, [conceptCode])

      if (conceptResult.success && conceptResult.data.length > 0) {
        const valtype = conceptResult.data[0].VALTYPE_CD

        // For Finding type concepts, use the specialized getFindingOptions method
        if (valtype === 'F') {
          this.log('debug', 'Dispatching to getFindingOptions for Finding type concept', { conceptCode, valtype })
          return await this.getFindingOptions(conceptCode)
        }
      }

      // For Selection type and other concepts, use the original logic
      this.log('debug', 'Using standard selection options logic', { conceptCode })
      return await this.getStandardSelectionOptions(conceptCode)
    } catch (error) {
      this.log('error', 'Failed to determine concept type, using standard selection options', error, { conceptCode })
      return await this.getStandardSelectionOptions(conceptCode)
    }
  }

  /**
   * Get fallback options when database query fails
   * @param {string} category - Category name
   * @returns {Array} Fallback options
   */
  getFallbackOptions(category) {
    const fallbacks = {
      gender: [
        { label: 'Male', value: 'M', color: 'blue' },
        { label: 'Female', value: 'F', color: 'pink' },
      ],
      vital_status: [
        { label: 'Active', value: 'A', color: 'positive' },
        { label: 'Deceased', value: 'D', color: 'negative' },
        { label: 'Inactive', value: 'I', color: 'grey' },
      ],
      language: [
        { label: 'English', value: 'en', color: 'blue' },
        { label: 'German', value: 'de', color: 'blue' },
        { label: 'Other', value: 'other', color: 'grey' },
      ],
      race: [{ label: 'Not Specified', value: 'unknown', color: 'grey' }],
      marital_status: [
        { label: 'Single', value: 'S', color: 'blue' },
        { label: 'Married', value: 'M', color: 'positive' },
        { label: 'Divorced', value: 'D', color: 'orange' },
        { label: 'Widowed', value: 'W', color: 'grey' },
      ],
      religion: [{ label: 'Not Specified', value: 'unknown', color: 'grey' }],
      visit_status: [],
      visit_type: [
        { label: 'Routine Check-up', value: 'routine', color: 'blue' },
        { label: 'Follow-up', value: 'followup', color: 'orange' },
        { label: 'Emergency', value: 'emergency', color: 'negative' },
        { label: 'Consultation', value: 'consultation', color: 'purple' },
        { label: 'Procedure', value: 'procedure', color: 'teal' },
      ],
      inout_type: [
        { label: 'Outpatient', value: 'O', color: 'blue' },
        { label: 'Inpatient', value: 'I', color: 'orange' },
        { label: 'Emergency', value: 'E', color: 'negative' },
        { label: 'Day Care', value: 'D', color: 'teal' },
      ],
    }

    return fallbacks[category] || []
  }

  /**
   * Start performance timer
   * @param {string} label - Timer label
   * @returns {Object} Timer object with end() method
   */
  startTimer(label) {
    const start = Date.now()
    return {
      end: () => {
        const duration = Date.now() - start
        this.log('debug', `Timer: ${label}`, { duration: `${duration}ms` })
        return duration
      },
    }
  }

  /**
   * Log message using configured logger or console
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Additional data
   * @param {Object} context - Context information
   */
  log(level, message, data, context) {
    if (this.logger) {
      this.logger[level](message, data, context)
    } else if (level === 'error') {
      console.error(`[OptionsLoader] ${message}`, data, context)
    } else if (level === 'warn') {
      console.warn(`[OptionsLoader] ${message}`, data, context)
    } else if (level === 'info') {
      console.info(`[OptionsLoader] ${message}`, data, context)
    } else if (level === 'debug' && process.env.NODE_ENV === 'development') {
      console.debug(`[OptionsLoader] ${message}`, data, context)
    }
  }
}

/**
 * Create an options loader instance
 * @param {Object} databaseStore - Database store instance
 * @param {Object} globalSettingsStore - Global settings store instance
 * @param {Object} logger - Logger instance
 * @returns {OptionsLoader} Options loader instance
 */
export function createOptionsLoader(databaseStore, globalSettingsStore = null, logger = null) {
  return new OptionsLoader(databaseStore, globalSettingsStore, logger)
}

export default OptionsLoader
