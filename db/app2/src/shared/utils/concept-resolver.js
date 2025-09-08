/**
 * Concept Resolver Utility
 *
 * Handles concept resolution from database with fallback mechanisms.
 * Provides single and batch resolution capabilities.
 */

import { determineColor } from './color-mapper.js'

/**
 * Concept Resolver class
 */
export class ConceptResolver {
  constructor(databaseStore, logger = null) {
    this.dbStore = databaseStore
    this.logger = logger
  }

  /**
   * Resolve concept from database
   * @param {string} conceptCode - The concept code
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolved concept
   */
  async resolveFromDatabase(conceptCode, options = {}) {
    try {
      // Try CONCEPT_DIMENSION first
      let result = await this.dbStore.executeQuery('SELECT NAME_CHAR, VALTYPE_CD, UNIT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [conceptCode])

      let resolvedName = null
      let resolvedValueType = null
      let resolvedUnit = null
      let parsedBlobData = null

      if (result.success && result.data.length > 0) {
        resolvedName = result.data[0].NAME_CHAR
        resolvedValueType = result.data[0].VALTYPE_CD
        resolvedUnit = result.data[0].UNIT_CD
      } else {
        // Try CODE_LOOKUP as fallback - include LOOKUP_BLOB for icon/color data
        const tableFilter = options.table ? `AND TABLE_CD = "${options.table}"` : ''
        const columnFilter = options.column ? `AND COLUMN_CD = "${options.column}"` : ''

        result = await this.dbStore.executeQuery(`SELECT NAME_CHAR, LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = ? ${tableFilter} ${columnFilter}`, [conceptCode])

        if (result.success && result.data.length > 0) {
          resolvedName = result.data[0].NAME_CHAR

          // Parse LOOKUP_BLOB for additional metadata (icon, color, etc.)
          const lookupBlob = result.data[0].LOOKUP_BLOB
          if (lookupBlob) {
            try {
              parsedBlobData = JSON.parse(lookupBlob)
            } catch (error) {
              this.log('warn', `Failed to parse LOOKUP_BLOB for concept ${conceptCode}`, error)
            }
          }
        }
      }

      // Determine color and label - use LOOKUP_BLOB data if available
      let color = 'grey'
      let icon = null
      let label = resolvedName || this.getFallbackLabel(conceptCode)

      // Use data from LOOKUP_BLOB if available
      if (parsedBlobData) {
        if (parsedBlobData.color) {
          color = parsedBlobData.color
        }
        if (parsedBlobData.icon) {
          icon = parsedBlobData.icon
        }
        if (parsedBlobData.label) {
          label = parsedBlobData.label
        }
      } else {
        // Fallback to automatic color determination
        try {
          color = determineColor(resolvedName || conceptCode, options.context)
        } catch (error) {
          this.log('warn', `Color determination failed for concept ${conceptCode}`, error)
        }
      }

      return {
        code: conceptCode,
        label,
        color,
        icon,
        resolved: !!resolvedName,
        source: resolvedName ? 'database' : 'fallback',
        valueType: resolvedValueType,
        unit: resolvedUnit,
      }
    } catch (error) {
      this.log('error', `Database resolution failed for ${conceptCode}`, error)
      throw error
    }
  }

  /**
   * Resolve multiple concepts in batch
   * @param {Array<string>} conceptCodes - Array of concept codes
   * @param {Object} options - Resolution options
   * @returns {Promise<Map>} Map of conceptCode -> resolved data
   */
  async resolveBatch(conceptCodes, options = {}) {
    if (!conceptCodes || conceptCodes.length === 0) {
      return new Map()
    }

    this.log('info', 'Starting batch concept resolution', {
      totalCodes: conceptCodes.length,
      context: options.context,
    })

    const timer = this.startTimer('batch_resolve')
    const results = new Map()

    try {
      // Build batch query for CONCEPT_DIMENSION
      const placeholders = conceptCodes.map(() => '?').join(',')
      const conceptQuery = `
        SELECT CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD
        FROM CONCEPT_DIMENSION
        WHERE CONCEPT_CD IN (${placeholders})
      `

      const conceptResult = await this.dbStore.executeQuery(conceptQuery, conceptCodes)
      const foundConcepts = new Map()

      if (conceptResult.success && conceptResult.data.length > 0) {
        for (const row of conceptResult.data) {
          foundConcepts.set(row.CONCEPT_CD, {
            name: row.NAME_CHAR,
            valueType: row.VALTYPE_CD,
            unit: row.UNIT_CD,
          })
        }
      }

      // Find codes not found in CONCEPT_DIMENSION
      const notFoundCodes = conceptCodes.filter((code) => !foundConcepts.has(code))

      // Try CODE_LOOKUP for remaining codes
      if (notFoundCodes.length > 0) {
        const tableFilter = options.table ? `AND TABLE_CD = "${options.table}"` : ''
        const columnFilter = options.column ? `AND COLUMN_CD = "${options.column}"` : ''
        const lookupPlaceholders = notFoundCodes.map(() => '?').join(',')

        const lookupQuery = `
          SELECT CODE_CD, NAME_CHAR
          FROM CODE_LOOKUP
          WHERE CODE_CD IN (${lookupPlaceholders}) ${tableFilter} ${columnFilter}
        `

        const lookupResult = await this.dbStore.executeQuery(lookupQuery, notFoundCodes)

        if (lookupResult.success && lookupResult.data.length > 0) {
          for (const row of lookupResult.data) {
            foundConcepts.set(row.CODE_CD, {
              name: row.NAME_CHAR,
              valueType: null,
              unit: null,
            })
          }
        }
      }

      // Build results for all requested codes
      for (const code of conceptCodes) {
        const found = foundConcepts.get(code)
        const resolvedName = found?.name
        let color = 'grey'
        try {
          color = determineColor(resolvedName || code, options.context)
        } catch (error) {
          this.log('warn', `Color determination failed for concept ${code}`, error)
        }
        const label = resolvedName || this.getFallbackLabel(code)

        results.set(code, {
          code,
          label,
          color,
          resolved: !!resolvedName,
          source: resolvedName ? 'database' : 'fallback',
          valueType: found?.valueType,
          unit: found?.unit,
        })
      }

      const duration = timer.end()
      this.log('info', 'Batch concept resolution completed', {
        totalCodes: conceptCodes.length,
        resolved: results.size,
        duration,
        successRate: `${((results.size / conceptCodes.length) * 100).toFixed(1)}%`,
      })

      return results
    } catch (error) {
      timer.end()
      this.log('error', 'Batch concept resolution failed', error, {
        totalCodes: conceptCodes.length,
        options,
      })
      throw error
    }
  }

  /**
   * Get fallback label for unresolved codes
   * @param {string} conceptCode - The concept code
   * @returns {string} Fallback label
   */
  getFallbackLabel(conceptCode) {
    if (!conceptCode) return 'Unknown'

    // Handle simple codes
    const simpleCodeMap = {
      A: 'Active',
      I: 'Inactive',
      D: 'Discharged',
      C: 'Completed',
      X: 'Cancelled',
      P: 'Pending',
      M: 'Male',
      F: 'Female',
      Y: 'Yes',
      N: 'No',
      U: 'Unknown',
    }

    return simpleCodeMap[conceptCode] || conceptCode
  }

  /**
   * Get fallback resolution for failed lookups
   * @param {string} conceptCode - The concept code
   * @returns {Object} Fallback resolution
   */
  getFallbackResolution(conceptCode) {
    return {
      code: conceptCode,
      label: this.getFallbackLabel(conceptCode),
      color: 'grey',
      resolved: false,
      source: 'fallback',
    }
  }

  /**
   * Reverse lookup: get code from resolved label
   * @param {string} label - Resolved label
   * @param {string} category - Category context
   * @param {Map} cache - Optional cache to search through
   * @returns {Promise<string|null>} Concept code or null
   */
  async getCodeFromLabel(label, category = null, cache = null) {
    if (!label) return null

    // Search through cache first if provided
    if (cache) {
      for (const [code, cached] of cache.entries()) {
        if (cached.data?.label === label) {
          return code
        }
      }
    }

    // Try database lookup
    try {
      let query = 'SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE NAME_CHAR = ?'
      let params = [label]

      if (category) {
        // Add category-specific filtering if needed
        // This could be enhanced based on specific requirements
      }

      const result = await this.dbStore.executeQuery(query, params)

      if (result.success && result.data.length > 0) {
        return result.data[0].CONCEPT_CD
      }

      // Try CODE_LOOKUP as fallback
      const lookupResult = await this.dbStore.executeQuery('SELECT CODE_CD FROM CODE_LOOKUP WHERE NAME_CHAR = ?', [label])

      if (lookupResult.success && lookupResult.data.length > 0) {
        return lookupResult.data[0].CODE_CD
      }
    } catch (error) {
      this.log('error', 'Failed to get code from label', error, { label, category })
    }

    // Fallback mappings for common cases
    const reverseMappings = {
      gender: {
        Male: 'SCTID: 248153007',
        Female: 'SCTID: 248152002',
        Transsexual: 'SCTID: 407374003',
        Intersex: 'SCTID: 32570691000036108',
      },
      vital_status: {
        alive: 'SCTID: 438949009',
        dead: 'SCTID: 419099009',
        Active: 'SCTID: 438949009',
        Deceased: 'SCTID: 419099009',
      },
    }

    return reverseMappings[category]?.[label] || null
  }

  /**
   * Validate concept code format
   * @param {string} conceptCode - Concept code to validate
   * @returns {boolean} True if valid format
   */
  isValidConceptCode(conceptCode) {
    if (!conceptCode || typeof conceptCode !== 'string') {
      return false
    }

    // Basic validation - can be enhanced based on specific requirements
    return conceptCode.trim().length > 0
  }

  /**
   * Extract concept system from code
   * @param {string} conceptCode - Concept code
   * @returns {string} Concept system (SNOMED-CT, ICD-10, etc.)
   */
  getConceptSystem(conceptCode) {
    if (!conceptCode) return 'unknown'

    if (conceptCode.startsWith('SCTID:')) {
      return 'SNOMED-CT'
    } else if (conceptCode.startsWith('ICD10:')) {
      return 'ICD-10'
    } else if (conceptCode.startsWith('ICD9:')) {
      return 'ICD-9'
    } else if (conceptCode.startsWith('LOINC:')) {
      return 'LOINC'
    } else if (conceptCode.startsWith('CPT:')) {
      return 'CPT'
    }

    return 'local'
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
      console.error(`[ConceptResolver] ${message}`, data, context)
    } else if (level === 'warn') {
      console.warn(`[ConceptResolver] ${message}`, data, context)
    } else if (level === 'info') {
      console.info(`[ConceptResolver] ${message}`, data, context)
    } else if (level === 'debug' && process.env.NODE_ENV === 'development') {
      console.debug(`[ConceptResolver] ${message}`, data, context)
    }
  }
}

/**
 * Create a concept resolver instance
 * @param {Object} databaseStore - Database store instance
 * @param {Object} logger - Logger instance
 * @returns {ConceptResolver} Concept resolver instance
 */
export function createConceptResolver(databaseStore, logger = null) {
  return new ConceptResolver(databaseStore, logger)
}

export default ConceptResolver
