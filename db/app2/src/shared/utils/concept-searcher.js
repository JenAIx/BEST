/**
 * Concept Searcher Utility
 *
 * Handles concept search functionality with ranking and filtering.
 * Provides search across CONCEPT_DIMENSION with intelligent ranking.
 */

import { determineColor } from './color-mapper.js'

/**
 * Concept Searcher class
 */
export class ConceptSearcher {
  constructor(databaseStore, logger = null) {
    this.dbStore = databaseStore
    this.logger = logger
  }

  /**
   * Search concepts by name or code
   * @param {string} searchTerm - Search term (minimum 2 characters)
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching concepts
   */
  async searchConcepts(searchTerm, options = {}) {
    if (!searchTerm || searchTerm.length < 2) {
      this.log('debug', 'Search term too short or empty', { searchTerm })
      return []
    }

    const timer = this.startTimer(`search_concepts_${searchTerm}`)

    try {
      this.log('debug', 'Starting concept search', {
        searchTerm,
        options,
        limit: options.limit || 50,
      })

      // Build search query with intelligent ranking
      const query = `
        SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, VALTYPE_CD, SOURCESYSTEM_CD, UNIT_CD, CONCEPT_PATH
        FROM CONCEPT_DIMENSION
        WHERE (NAME_CHAR LIKE ? OR CONCEPT_CD LIKE ? OR CONCEPT_PATH LIKE ?)
        ${options.valueType ? 'AND VALTYPE_CD = ?' : ''}
        ${options.sourceSystem ? 'AND SOURCESYSTEM_CD = ?' : ''}
        ${options.conceptPath ? 'AND CONCEPT_PATH LIKE ?' : ''}
        ORDER BY
          CASE
            WHEN NAME_CHAR LIKE ? THEN 1
            WHEN CONCEPT_CD LIKE ? THEN 2
            WHEN NAME_CHAR LIKE ? THEN 3
            WHEN CONCEPT_CD LIKE ? THEN 4
            ELSE 5
          END,
          LENGTH(NAME_CHAR),
          NAME_CHAR
        LIMIT ?
      `

      const searchPattern = `%${searchTerm}%`
      const exactPattern = `${searchTerm}%`
      const params = [searchPattern, searchPattern, searchPattern]

      // Add optional filters
      if (options.valueType) {
        params.push(options.valueType)
      }
      if (options.sourceSystem) {
        params.push(options.sourceSystem)
      }
      if (options.conceptPath) {
        params.push(`%${options.conceptPath}%`)
      }

      // Add ordering parameters
      params.push(exactPattern, exactPattern, searchPattern, searchPattern)

      // Add limit
      params.push(options.limit || 50)

      const result = await this.dbStore.executeQuery(query, params)

      if (!result.success || !result.data) {
        this.log('warn', 'Concept search returned no results', { searchTerm, result })
        return []
      }

      // Format results and add relevance scoring
      const concepts = result.data.map((row, index) => {
        const concept = {
          CONCEPT_CD: row.CONCEPT_CD,
          NAME_CHAR: row.NAME_CHAR,
          CONCEPT_BLOB: row.CONCEPT_BLOB,
          VALTYPE_CD: row.VALTYPE_CD || 'T',
          SOURCESYSTEM_CD: row.SOURCESYSTEM_CD,
          UNIT_CD: row.UNIT_CD,
          CONCEPT_PATH: row.CONCEPT_PATH,
          // Add search metadata
          searchRelevance: this.calculateRelevance(searchTerm, row.NAME_CHAR, row.CONCEPT_CD),
          searchRank: index + 1,
          color: determineColor(row.NAME_CHAR, options.context),
        }

        return concept
      })

      const duration = timer.end()
      this.log('info', 'Concept search completed', {
        searchTerm,
        resultsCount: concepts.length,
        duration,
        topResult: concepts[0]?.NAME_CHAR,
      })

      return concepts
    } catch (error) {
      timer.end()
      this.log('error', 'Concept search failed', error, {
        searchTerm,
        options,
      })
      throw error
    }
  }

  /**
   * Search concepts with advanced filtering and faceting
   * @param {string} searchTerm - Search term
   * @param {Object} filters - Advanced filters
   * @returns {Promise<Object>} Search results with facets
   */
  async advancedSearch(searchTerm, filters = {}) {
    const timer = this.startTimer(`advanced_search_${searchTerm}`)

    try {
      this.log('debug', 'Starting advanced concept search', { searchTerm, filters })

      // Build base query
      let whereConditions = []
      let params = []

      if (searchTerm && searchTerm.length >= 2) {
        whereConditions.push('(NAME_CHAR LIKE ? OR CONCEPT_CD LIKE ? OR CONCEPT_PATH LIKE ?)')
        const searchPattern = `%${searchTerm}%`
        params.push(searchPattern, searchPattern, searchPattern)
      }

      // Add filters
      if (filters.valueTypes && filters.valueTypes.length > 0) {
        const placeholders = filters.valueTypes.map(() => '?').join(',')
        whereConditions.push(`VALTYPE_CD IN (${placeholders})`)
        params.push(...filters.valueTypes)
      }

      if (filters.sourceSystems && filters.sourceSystems.length > 0) {
        const placeholders = filters.sourceSystems.map(() => '?').join(',')
        whereConditions.push(`SOURCESYSTEM_CD IN (${placeholders})`)
        params.push(...filters.sourceSystems)
      }

      if (filters.conceptPaths && filters.conceptPaths.length > 0) {
        const pathConditions = filters.conceptPaths.map(() => 'CONCEPT_PATH LIKE ?').join(' OR ')
        whereConditions.push(`(${pathConditions})`)
        params.push(...filters.conceptPaths.map((path) => `%${path}%`))
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      // Main search query
      const searchQuery = `
        SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, VALTYPE_CD, SOURCESYSTEM_CD, UNIT_CD, CONCEPT_PATH
        FROM CONCEPT_DIMENSION
        ${whereClause}
        ORDER BY
          CASE
            WHEN NAME_CHAR LIKE ? THEN 1
            WHEN CONCEPT_CD LIKE ? THEN 2
            ELSE 3
          END,
          LENGTH(NAME_CHAR),
          NAME_CHAR
        LIMIT ?
      `

      // Add ordering parameters if we have a search term
      if (searchTerm && searchTerm.length >= 2) {
        const exactPattern = `${searchTerm}%`
        params.push(exactPattern, exactPattern)
      } else {
        params.push('', '') // Empty patterns for ordering
      }

      params.push(filters.limit || 100)

      // Execute search
      const searchResult = await this.dbStore.executeQuery(searchQuery, params)

      // Get facets (counts by category)
      const facetQueries = await Promise.all([
        this.getFacetCounts('VALTYPE_CD', whereConditions, params.slice(0, -3)), // Remove ordering and limit params
        this.getFacetCounts('SOURCESYSTEM_CD', whereConditions, params.slice(0, -3)),
      ])

      const concepts =
        searchResult.success && searchResult.data
          ? searchResult.data.map((row, index) => ({
              CONCEPT_CD: row.CONCEPT_CD,
              NAME_CHAR: row.NAME_CHAR,
              CONCEPT_BLOB: row.CONCEPT_BLOB,
              VALTYPE_CD: row.VALTYPE_CD || 'T',
              SOURCESYSTEM_CD: row.SOURCESYSTEM_CD,
              UNIT_CD: row.UNIT_CD,
              CONCEPT_PATH: row.CONCEPT_PATH,
              searchRelevance: this.calculateRelevance(searchTerm, row.NAME_CHAR, row.CONCEPT_CD),
              searchRank: index + 1,
              color: determineColor(row.NAME_CHAR, filters.context),
            }))
          : []

      const duration = timer.end()
      this.log('info', 'Advanced concept search completed', {
        searchTerm,
        resultsCount: concepts.length,
        duration,
        facetsLoaded: facetQueries.length,
      })

      return {
        concepts,
        facets: {
          valueTypes: facetQueries[0] || [],
          sourceSystems: facetQueries[1] || [],
        },
        totalResults: concepts.length,
        searchTerm,
        filters,
      }
    } catch (error) {
      timer.end()
      this.log('error', 'Advanced concept search failed', error, { searchTerm, filters })
      throw error
    }
  }

  /**
   * Get concept suggestions based on partial input
   * @param {string} partialTerm - Partial search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of concept suggestions
   */
  async getSuggestions(partialTerm, options = {}) {
    if (!partialTerm || partialTerm.length < 1) {
      return []
    }

    const timer = this.startTimer(`get_suggestions_${partialTerm}`)

    try {
      this.log('debug', 'Getting concept suggestions', { partialTerm, options })

      const query = `
        SELECT CONCEPT_CD, NAME_CHAR, VALTYPE_CD
        FROM CONCEPT_DIMENSION
        WHERE NAME_CHAR LIKE ?
        ${options.valueType ? 'AND VALTYPE_CD = ?' : ''}
        ORDER BY
          CASE
            WHEN NAME_CHAR LIKE ? THEN 1
            ELSE 2
          END,
          LENGTH(NAME_CHAR),
          NAME_CHAR
        LIMIT ?
      `

      const searchPattern = `${partialTerm}%`
      const params = [searchPattern]

      if (options.valueType) {
        params.push(options.valueType)
      }

      params.push(searchPattern) // For ordering
      params.push(options.limit || 10)

      const result = await this.dbStore.executeQuery(query, params)

      if (!result.success || !result.data) {
        return []
      }

      const suggestions = result.data.map((row) => ({
        label: row.NAME_CHAR,
        value: row.CONCEPT_CD,
        valueType: row.VALTYPE_CD,
        color: determineColor(row.NAME_CHAR, options.context),
      }))

      const duration = timer.end()
      this.log('debug', 'Concept suggestions retrieved', {
        partialTerm,
        suggestionsCount: suggestions.length,
        duration,
      })

      return suggestions
    } catch (error) {
      timer.end()
      this.log('error', 'Failed to get concept suggestions', error, { partialTerm, options })
      return []
    }
  }

  /**
   * Search concepts by hierarchy path
   * @param {string} hierarchyPath - SNOMED-CT or other hierarchy path
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of concepts in hierarchy
   */
  async searchByHierarchy(hierarchyPath, options = {}) {
    if (!hierarchyPath) {
      return []
    }

    const timer = this.startTimer(`search_hierarchy_${hierarchyPath}`)

    try {
      this.log('debug', 'Searching concepts by hierarchy', { hierarchyPath, options })

      const query = `
        SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_PATH, VALTYPE_CD, SOURCESYSTEM_CD
        FROM CONCEPT_DIMENSION
        WHERE CONCEPT_PATH LIKE ?
        ${options.exactLevel ? 'AND LENGTH(CONCEPT_PATH) - LENGTH(REPLACE(CONCEPT_PATH, "\\", "")) = ?' : ''}
        ORDER BY CONCEPT_PATH, NAME_CHAR
        LIMIT ?
      `

      const pathPattern = `${hierarchyPath}%`
      const params = [pathPattern]

      if (options.exactLevel) {
        // Calculate expected depth based on hierarchy path
        const expectedDepth = (hierarchyPath.match(/\\/g) || []).length + 1
        params.push(expectedDepth)
      }

      params.push(options.limit || 100)

      const result = await this.dbStore.executeQuery(query, params)

      if (!result.success || !result.data) {
        return []
      }

      const concepts = result.data.map((row) => ({
        CONCEPT_CD: row.CONCEPT_CD,
        NAME_CHAR: row.NAME_CHAR,
        CONCEPT_PATH: row.CONCEPT_PATH,
        VALTYPE_CD: row.VALTYPE_CD,
        SOURCESYSTEM_CD: row.SOURCESYSTEM_CD,
        hierarchyLevel: (row.CONCEPT_PATH.match(/\\/g) || []).length,
        color: determineColor(row.NAME_CHAR, options.context),
      }))

      const duration = timer.end()
      this.log('info', 'Hierarchy search completed', {
        hierarchyPath,
        resultsCount: concepts.length,
        duration,
      })

      return concepts
    } catch (error) {
      timer.end()
      this.log('error', 'Hierarchy search failed', error, { hierarchyPath, options })
      throw error
    }
  }

  /**
   * Calculate relevance score for search results
   * @param {string} searchTerm - Original search term
   * @param {string} conceptName - Concept name
   * @param {string} conceptCode - Concept code
   * @returns {number} Relevance score (0-100)
   */
  calculateRelevance(searchTerm, conceptName, conceptCode) {
    if (!searchTerm || (!conceptName && !conceptCode)) {
      return 0
    }

    const term = searchTerm.toLowerCase()
    const name = (conceptName || '').toLowerCase()
    const code = (conceptCode || '').toLowerCase()

    let score = 0

    // Exact matches get highest score
    if (name === term || code === term) {
      score += 100
    }
    // Starts with search term
    else if (name.startsWith(term) || code.startsWith(term)) {
      score += 80
    }
    // Contains search term
    else if (name.includes(term) || code.includes(term)) {
      score += 60
    }

    // Bonus for shorter names (more specific)
    if (conceptName && conceptName.length < 50) {
      score += 10
    }

    // Bonus for exact word matches
    const words = term.split(' ')
    const nameWords = name.split(' ')
    const exactWordMatches = words.filter((word) => nameWords.includes(word)).length
    score += exactWordMatches * 5

    return Math.min(score, 100)
  }

  /**
   * Get facet counts for advanced search
   * @param {string} column - Column to facet on
   * @param {Array} whereConditions - Existing where conditions
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Facet counts
   */
  async getFacetCounts(column, whereConditions, params) {
    try {
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      const query = `
        SELECT ${column} as value, COUNT(*) as count
        FROM CONCEPT_DIMENSION
        ${whereClause}
        AND ${column} IS NOT NULL
        GROUP BY ${column}
        ORDER BY count DESC, ${column}
        LIMIT 20
      `

      const result = await this.dbStore.executeQuery(query, params)

      if (result.success && result.data) {
        return result.data.map((row) => ({
          value: row.value,
          count: row.count,
          label: this.getFacetLabel(column, row.value),
        }))
      }

      return []
    } catch (error) {
      this.log('error', 'Failed to get facet counts', error, { column })
      return []
    }
  }

  /**
   * Get human-readable label for facet values
   * @param {string} column - Column name
   * @param {string} value - Facet value
   * @returns {string} Human-readable label
   */
  getFacetLabel(column, value) {
    const labels = {
      VALTYPE_CD: {
        S: 'Selection',
        F: 'Finding',
        A: 'Array/Multiple',
        R: 'Raw Data/File',
        N: 'Numeric',
        D: 'Date/Time',
        T: 'Text',
      },
      SOURCESYSTEM_CD: {
        'SNOMED-CT': 'SNOMED Clinical Terms',
        ICD10: 'ICD-10',
        ICD9: 'ICD-9',
        LOINC: 'LOINC',
        CPT: 'CPT',
      },
    }

    return labels[column]?.[value] || value
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
      console.error(`[ConceptSearcher] ${message}`, data, context)
    } else if (level === 'warn') {
      console.warn(`[ConceptSearcher] ${message}`, data, context)
    } else if (level === 'info') {
      console.info(`[ConceptSearcher] ${message}`, data, context)
    } else if (level === 'debug' && process.env.NODE_ENV === 'development') {
      console.debug(`[ConceptSearcher] ${message}`, data, context)
    }
  }
}

/**
 * Create a concept searcher instance
 * @param {Object} databaseStore - Database store instance
 * @param {Object} logger - Logger instance
 * @returns {ConceptSearcher} Concept searcher instance
 */
export function createConceptSearcher(databaseStore, logger = null) {
  return new ConceptSearcher(databaseStore, logger)
}

export default ConceptSearcher
