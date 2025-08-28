import { defineStore } from 'pinia'
import { useDatabaseStore } from './database-store'
import { useGlobalSettingsStore } from './global-settings-store'
import { createLogger } from 'src/core/services/logging-service'

export const useConceptResolutionStore = defineStore('conceptResolution', {
  state: () => ({
    // In-memory cache for current session (using reactive object instead of Map for Vue reactivity)
    cache: {},
    // Tracks which codes are currently being resolved to prevent duplicate requests
    pendingResolutions: new Set(),
    // Configuration
    config: {
      // Cache expiry time in milliseconds (24 hours)
      cacheExpiry: 24 * 60 * 60 * 1000,
      // Browser storage key prefix
      storagePrefix: 'concept_resolution_',
      // Maximum cache size to prevent memory issues
      maxCacheSize: 1000,
    },
    // Logger instance
    logger: createLogger('ConceptResolutionStore'),
  }),

  getters: {
    /**
     * Get resolved concept from cache
     * @param {string} conceptCode - The concept code to resolve
     * @returns {Object|null} Resolved concept or null if not cached
     */
    getResolved: (state) => (conceptCode) => {
      if (!conceptCode) return null
      return state.cache[conceptCode] || null
    },

    /**
     * Check if concept is currently being resolved
     * @param {string} conceptCode - The concept code
     * @returns {boolean} True if resolution is in progress
     */
    isResolving: (state) => (conceptCode) => {
      return state.pendingResolutions.has(conceptCode)
    },

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats: (state) => () => {
      return {
        size: Object.keys(state.cache).length,
        maxSize: state.config.maxCacheSize,
        pendingCount: state.pendingResolutions.size,
      }
    },
  },

  actions: {
    /**
     * Initialize the store - load cached data from browser storage
     */
    async initialize() {
      const timer = this.logger.startTimer('initialize')
      try {
        await this.loadFromBrowserStorage()
        const cacheSize = Object.keys(this.cache).length
        this.logger.info('Store initialized successfully', {
          cachedConcepts: cacheSize,
          cacheExpiry: `${this.config.cacheExpiry / (60 * 60 * 1000)}h`,
          maxCacheSize: this.config.maxCacheSize,
        })
        timer.end()
      } catch (error) {
        timer.end()
        this.logger.error('Failed to initialize store', error, {
          storagePrefix: this.config.storagePrefix,
        })
      }
    },

    /**
     * Resolve a single concept code
     * @param {string} conceptCode - The concept code to resolve
     * @param {Object} options - Resolution options
     * @returns {Promise<Object>} Resolved concept with label and color
     */
    async resolveConcept(conceptCode, options = {}) {
      if (!conceptCode) {
        return { label: 'Unknown', color: 'grey', code: conceptCode }
      }

      // Check in-memory cache first
      const cached = this.cache[conceptCode]
      if (cached && !this.isExpired(cached)) {
        this.logger.debug('Concept resolved from cache', { conceptCode, source: 'cache' })
        return cached.data
      }

      // Check if already being resolved
      if (this.pendingResolutions.has(conceptCode)) {
        this.logger.debug('Concept resolution already pending, waiting', { conceptCode })
        // Wait for existing resolution
        return await this.waitForResolution(conceptCode)
      }

      // Start resolution
      this.pendingResolutions.add(conceptCode)

      const timer = this.logger.startTimer(`resolve_${conceptCode}`)

      try {
        this.logger.debug('Starting concept resolution', { conceptCode, options })
        const resolved = await this.resolveFromDatabase(conceptCode, options)

        // Cache the result
        await this.cacheResult(conceptCode, resolved)

        this.logger.info('Concept resolved successfully', {
          conceptCode,
          label: resolved.label,
          source: resolved.source,
          duration: timer.end(),
        })

        return resolved
      } catch (error) {
        timer.end()
        this.logger.error('Failed to resolve concept', error, {
          conceptCode,
          options,
          context: options.context,
        })

        const fallback = this.getFallbackResolution(conceptCode)
        await this.cacheResult(conceptCode, fallback)

        this.logger.warn('Using fallback resolution', {
          conceptCode,
          fallbackLabel: fallback.label,
        })

        return fallback
      } finally {
        this.pendingResolutions.delete(conceptCode)
      }
    },

    /**
     * Resolve multiple concept codes in batch
     * @param {Array<string>} conceptCodes - Array of concept codes
     * @param {Object} options - Resolution options
     * @returns {Promise<Map>} Map of conceptCode -> resolved data
     */
    async resolveBatch(conceptCodes, options = {}) {
      if (!conceptCodes || conceptCodes.length === 0) {
        this.logger.debug('Empty concept codes array provided for batch resolution')
        return new Map()
      }

      this.logger.info('Starting batch concept resolution', {
        totalCodes: conceptCodes.length,
        context: options.context,
      })

      const timer = this.logger.startTimer('batch_resolve')
      const results = new Map()
      const toResolve = []

      // Check cache for each code
      for (const code of conceptCodes) {
        const cached = this.cache[code]
        if (cached && !this.isExpired(cached)) {
          results.set(code, cached.data)
        } else {
          toResolve.push(code)
        }
      }

      this.logger.debug('Batch resolution cache analysis', {
        totalCodes: conceptCodes.length,
        fromCache: results.size,
        toResolve: toResolve.length,
        cacheHitRate: `${((results.size / conceptCodes.length) * 100).toFixed(1)}%`,
      })

      // Resolve uncached codes in parallel
      if (toResolve.length > 0) {
        const resolutionPromises = toResolve.map((code) => this.resolveConcept(code, options).then((resolved) => ({ code, resolved })))

        const resolved = await Promise.all(resolutionPromises)
        for (const { code, resolved: data } of resolved) {
          results.set(code, data)
        }
      }

      const duration = timer.end()
      this.logger.success('Batch concept resolution completed', {
        totalCodes: conceptCodes.length,
        resolved: results.size,
        duration,
        successRate: `${((results.size / conceptCodes.length) * 100).toFixed(1)}%`,
      })

      return results
    },

    /**
     * Resolve concept from database
     * @param {string} conceptCode - The concept code
     * @param {Object} options - Resolution options
     * @returns {Promise<Object>} Resolved concept
     */
    async resolveFromDatabase(conceptCode, options = {}) {
      const dbStore = useDatabaseStore()

      try {
        // Try CONCEPT_DIMENSION first
        let result = await dbStore.executeQuery('SELECT NAME_CHAR, VALTYPE_CD, UNIT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [conceptCode])

        let resolvedName = null
        let resolvedValueType = null
        let resolvedUnit = null
        if (result.success && result.data.length > 0) {
          resolvedName = result.data[0].NAME_CHAR
          resolvedValueType = result.data[0].VALTYPE_CD
          resolvedUnit = result.data[0].UNIT_CD
        } else {
          // Try CODE_LOOKUP as fallback
          const tableFilter = options.table ? `AND TABLE_CD = "${options.table}"` : ''
          const columnFilter = options.column ? `AND COLUMN_CD = "${options.column}"` : ''

          result = await dbStore.executeQuery(`SELECT NAME_CHAR FROM CODE_LOOKUP WHERE CODE_CD = ? ${tableFilter} ${columnFilter}`, [conceptCode])

          if (result.success && result.data.length > 0) {
            resolvedName = result.data[0].NAME_CHAR
          }
        }

        // Determine color and label
        const color = this.determineColor(resolvedName || conceptCode, options.context)
        const label = resolvedName || this.getFallbackLabel(conceptCode)

        return {
          code: conceptCode,
          label,
          color,
          resolved: !!resolvedName,
          source: resolvedName ? 'database' : 'fallback',
          valueType: resolvedValueType,
          unit: resolvedUnit,
        }
      } catch (error) {
        console.error(`[ConceptResolutionStore] Database resolution failed for ${conceptCode}:`, error)
        throw error
      }
    },

    /**
     * Determine color based on resolved text and context
     * @param {string} text - Resolved text or code
     * @param {string} context - Context hint (e.g., 'status', 'gender', etc.)
     * @returns {string} Quasar color name
     */
    determineColor(text, context) {
      if (!text) return 'grey'

      const lowerText = text.toLowerCase()

      // Context-specific color mapping
      if (context === 'visit_status') {
        // Visit status specific color mapping (more colorful and intuitive)
        if (lowerText.includes('active') || lowerText.includes('classified') || lowerText.includes('pending') || lowerText.includes('admitted')) {
          return 'negative' // Red for active/ongoing/urgent/classified
        } else if (lowerText.includes('closed') || lowerText.includes('completed') || lowerText.includes('discharged')) {
          return 'positive' // Green for closed/completed/success
        } else if (lowerText.includes('inactive') || lowerText.includes('cancelled') || lowerText.includes('suspended')) {
          return 'grey' // Grey for inactive/cancelled
        }
      } else if (context === 'status' || context === 'vital_status') {
        if (lowerText.includes('active') || lowerText.includes('alive') || lowerText.includes('admitted')) {
          return 'positive'
        } else if (lowerText.includes('discharged') || lowerText.includes('completed') || lowerText.includes('inactive') || lowerText.includes('dead')) {
          return 'negative'
        } else if (lowerText.includes('cancelled') || lowerText.includes('suspended')) {
          return 'warning'
        } else if (lowerText.includes('transferred') || lowerText.includes('pending')) {
          return 'info'
        }
      } else if (context === 'gender') {
        if (lowerText.includes('male') && !lowerText.includes('female')) {
          return 'blue'
        } else if (lowerText.includes('female')) {
          return 'pink'
        }
      } else if (context === 'selection_answer' || context === 'finding_answer') {
        if (lowerText.includes('yes') || lowerText.includes('positive') || lowerText.includes('present') || lowerText.includes('normal')) {
          return 'positive'
        } else if (lowerText.includes('no') || lowerText.includes('negative') || lowerText.includes('absent') || lowerText.includes('abnormal')) {
          return 'negative'
        } else if (lowerText.includes('unknown') || lowerText.includes('not applicable')) {
          return 'warning'
        }
      }

      return 'grey'
    },

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
        C: 'Completed', // Changed from 'Cancelled' to 'Completed' to match EditVisitDialog
        X: 'Cancelled', // X is used for Cancelled in EditVisitDialog
        P: 'Pending',
        M: 'Male',
        F: 'Female',
      }

      return simpleCodeMap[conceptCode] || conceptCode
    },

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
    },

    /**
     * Cache resolution result
     * @param {string} conceptCode - The concept code
     * @param {Object} resolved - Resolved data
     */
    async cacheResult(conceptCode, resolved) {
      const cacheEntry = {
        data: resolved,
        timestamp: Date.now(),
        accessed: Date.now(),
      }

      // Add to in-memory cache
      this.cache[conceptCode] = cacheEntry

      // Enforce cache size limit
      if (Object.keys(this.cache).length > this.config.maxCacheSize) {
        await this.evictOldEntries()
      }

      // Save to browser storage
      await this.saveToBrowserStorage(conceptCode, cacheEntry)
    },

    /**
     * Load cached data from browser storage
     */
    async loadFromBrowserStorage() {
      try {
        const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.config.storagePrefix))

        for (const key of keys) {
          try {
            const conceptCode = key.replace(this.config.storagePrefix, '')
            const cached = JSON.parse(localStorage.getItem(key))

            if (cached && !this.isExpired(cached)) {
              // Update accessed time
              cached.accessed = Date.now()
              this.cache[conceptCode] = cached
            } else {
              // Remove expired entry
              localStorage.removeItem(key)
            }
          } catch (error) {
            console.warn(`[ConceptResolutionStore] Failed to load cached entry ${key}:`, error)
            localStorage.removeItem(key)
          }
        }
      } catch (error) {
        console.error('[ConceptResolutionStore] Failed to load from browser storage:', error)
      }
    },

    /**
     * Save cache entry to browser storage
     * @param {string} conceptCode - The concept code
     * @param {Object} cacheEntry - Cache entry to save
     */
    async saveToBrowserStorage(conceptCode, cacheEntry) {
      try {
        const key = this.config.storagePrefix + conceptCode
        localStorage.setItem(key, JSON.stringify(cacheEntry))
      } catch (error) {
        console.warn(`[ConceptResolutionStore] Failed to save to browser storage:`, error)
        // Handle quota exceeded or other storage errors gracefully
      }
    },

    /**
     * Check if cache entry is expired
     * @param {Object} cacheEntry - Cache entry to check
     * @returns {boolean} True if expired
     */
    isExpired(cacheEntry) {
      if (!cacheEntry || !cacheEntry.timestamp) return true
      return Date.now() - cacheEntry.timestamp > this.config.cacheExpiry
    },

    /**
     * Evict old cache entries to maintain size limit
     */
    async evictOldEntries() {
      const entries = Object.entries(this.cache)

      // Sort by last accessed time (oldest first)
      entries.sort((a, b) => a[1].accessed - b[1].accessed)

      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2)
      for (let i = 0; i < toRemove; i++) {
        const [conceptCode] = entries[i]
        delete this.cache[conceptCode]

        // Also remove from browser storage
        const key = this.config.storagePrefix + conceptCode
        localStorage.removeItem(key)
      }
    },

    /**
     * Wait for ongoing resolution to complete
     * @param {string} conceptCode - The concept code being resolved
     * @returns {Promise<Object>} Resolved concept
     */
    async waitForResolution(conceptCode) {
      // Poll until resolution is complete
      while (this.pendingResolutions.has(conceptCode)) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      // Return cached result
      const cached = this.cache[conceptCode]
      return cached ? cached.data : this.getFallbackResolution(conceptCode)
    },

    /**
     * Clear all cached data
     */
    async clearCache() {
      // Clear in-memory cache
      this.cache = {}
      this.pendingResolutions.clear()

      // Clear browser storage
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.config.storagePrefix))

      for (const key of keys) {
        localStorage.removeItem(key)
      }

      this.logger.info('Cache cleared successfully', {
        clearedKeys: keys.length,
        memoryCache: 'cleared',
        pendingResolutions: 'cleared',
      })
    },

    /**
     * Preload common concepts
     * @param {Array<string>} conceptCodes - Codes to preload
     */
    async preloadConcepts(conceptCodes) {
      if (!conceptCodes || conceptCodes.length === 0) {
        this.logger.debug('No concepts provided for preloading')
        return
      }

      this.logger.info('Starting concept preloading', {
        conceptCount: conceptCodes.length,
        concepts: conceptCodes.slice(0, 5), // Show first 5 for debugging
      })

      const timer = this.logger.startTimer('preload_concepts')
      await this.resolveBatch(conceptCodes, { context: 'preload' })

      this.logger.success('Concept preloading completed', {
        conceptCount: conceptCodes.length,
        duration: timer.end(),
      })
    },

    /**
     * Get concept categories for dropdowns with caching
     * @param {boolean} forceRefresh - Force refresh from database
     * @returns {Promise<Array>} Array of {label, value} options
     */
    async getCategoryOptions(forceRefresh = false) {
      const cacheKey = 'concept_categories'
      const cached = this.cache[cacheKey]

      if (cached && !this.isExpired(cached) && !forceRefresh) {
        this.logger.debug('Category options resolved from cache', { source: 'cache' })
        return cached.data
      }

      const timer = this.logger.startTimer('get_category_options')

      try {
        this.logger.debug('Loading category options from global settings')

        const globalSettingsStore = useGlobalSettingsStore()
        const categoryOptions = await globalSettingsStore.getCategoryOptions(forceRefresh)

        // Cache the result
        await this.cacheResult(cacheKey, categoryOptions)

        const duration = timer.end()
        this.logger.success('Category options loaded and cached', {
          optionsCount: categoryOptions.length,
          duration,
        })

        return categoryOptions
      } catch (error) {
        timer.end()
        this.logger.error('Failed to get category options', error)

        // Return fallback categories
        const fallbackCategories = [
          { label: 'General', value: 'CAT_GENERAL' },
          { label: 'Demographics', value: 'CAT_DEMOGRAPHICS' },
          { label: 'Laboratory', value: 'CAT_LABORATORY' },
          { label: 'Vital Signs', value: 'CAT_VITAL_SIGNS' },
        ]

        await this.cacheResult(cacheKey, fallbackCategories)
        return fallbackCategories
      }
    },

    /**
     * Get dropdown options for a specific concept category
     * @param {string} category - Category (gender, vital_status, language, race, marital_status, religion)
     * @param {string} table - Optional table context
     * @param {string} column - Optional column context
     * @returns {Promise<Array>} Array of {label, value, color} options
     */
    async getConceptOptions(category, table = null, column = null) {
      const timer = this.logger.startTimer(`get_options_${category}`)

      try {
        this.logger.debug('Loading concept options', { category, table, column })

        const dbStore = useDatabaseStore()
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

        const result = await dbStore.executeQuery(query, params)

        if (!result.success || !result.data) {
          return []
        }

        // Convert to options format and cache the concepts
        const options = result.data.map((row) => {
          const code = row.code
          const label = row.label
          const color = this.determineColor(label, category)

          // Cache the resolved concept
          this.cache[code] = {
            data: { code, label, color, resolved: true, source: 'database' },
            timestamp: Date.now(),
            accessed: Date.now(),
          }

          return {
            label,
            value: code,
            color,
          }
        })

        const duration = timer.end()
        this.logger.success('Concept options loaded successfully', {
          category,
          optionsCount: options.length,
          cachedConcepts: options.length,
          duration,
        })

        return options
      } catch (error) {
        timer.end()
        this.logger.error('Failed to get concept options', error, {
          category,
          table,
          column,
        })

        const fallbackOptions = this.getFallbackOptions(category)
        this.logger.warn('Using fallback options', {
          category,
          fallbackCount: fallbackOptions.length,
        })

        return fallbackOptions
      }
    },

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
        visit_status: [], // Will be populated from database query - uses SNOMED-CT concepts from CONCEPT_DIMENSION
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
    },

    /**
     * Search concepts by name or code
     * @param {string} searchTerm - Search term (minimum 2 characters)
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of matching concepts
     */
    async searchConcepts(searchTerm, options = {}) {
      if (!searchTerm || searchTerm.length < 2) {
        this.logger.debug('Search term too short or empty', { searchTerm })
        return []
      }

      const timer = this.logger.startTimer(`search_concepts_${searchTerm}`)

      try {
        this.logger.debug('Starting concept search', {
          searchTerm,
          options,
          limit: options.limit || 50,
        })

        const dbStore = useDatabaseStore()

        // Build search query
        const query = `
          SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, VALTYPE_CD, SOURCESYSTEM_CD, UNIT_CD
          FROM CONCEPT_DIMENSION
          WHERE (NAME_CHAR LIKE ? OR CONCEPT_CD LIKE ? OR CONCEPT_PATH LIKE ?)
          ${options.valueType ? 'AND VALTYPE_CD = ?' : ''}
          ${options.sourceSystem ? 'AND SOURCESYSTEM_CD = ?' : ''}
          ORDER BY
            CASE
              WHEN NAME_CHAR LIKE ? THEN 1
              WHEN CONCEPT_CD LIKE ? THEN 2
              ELSE 3
            END,
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

        // Add ordering parameters
        params.push(exactPattern, exactPattern)

        // Add limit
        params.push(options.limit || 50)

        const result = await dbStore.executeQuery(query, params)

        if (!result.success || !result.data) {
          this.logger.warn('Concept search returned no results', { searchTerm, result })
          return []
        }

        // Format results and cache them
        const concepts = result.data.map((row) => {
          const concept = {
            CONCEPT_CD: row.CONCEPT_CD,
            NAME_CHAR: row.NAME_CHAR,
            CONCEPT_BLOB: row.CONCEPT_BLOB,
            VALTYPE_CD: row.VALTYPE_CD || 'T',
            SOURCESYSTEM_CD: row.SOURCESYSTEM_CD,
            UNIT_CD: row.UNIT_CD,
          }

          // Cache the concept for future resolution
          this.cache[concept.CONCEPT_CD] = {
            data: {
              code: concept.CONCEPT_CD,
              label: concept.NAME_CHAR,
              color: this.determineColor(concept.NAME_CHAR, options.context),
              resolved: true,
              source: 'database',
            },
            timestamp: Date.now(),
            accessed: Date.now(),
          }

          return concept
        })

        const duration = timer.end()
        this.logger.success('Concept search completed', {
          searchTerm,
          resultsCount: concepts.length,
          duration,
          cached: concepts.length,
        })

        return concepts
      } catch (error) {
        timer.end()
        this.logger.error('Concept search failed', error, {
          searchTerm,
          options,
        })
        throw error
      }
    },

    /**
     * Get finding-specific answer options based on concept hierarchy
     * @param {string} conceptCode - The finding concept code
     * @returns {Promise<Array>} Array of finding answer options
     */
    async getFindingOptions(conceptCode) {
      if (!conceptCode) {
        this.logger.debug('No concept code provided for finding options')
        return []
      }

      // Check cache for finding options (using a special key format)
      const cacheKey = `${conceptCode}_finding_options`
      const cached = this.cache[cacheKey]
      if (cached && !this.isExpired(cached)) {
        this.logger.debug('Finding options resolved from cache', { conceptCode, source: 'cache' })
        return cached.data
      }

      const timer = this.logger.startTimer(`get_finding_options_${conceptCode}`)

      try {
        this.logger.info('Fetching finding options from concept hierarchy', { conceptCode })

        const dbStore = useDatabaseStore()

        // Get the finding concept and its hierarchy path
        const conceptQuery = 'SELECT CONCEPT_PATH, NAME_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?'
        const conceptResult = await dbStore.executeQuery(conceptQuery, [conceptCode])

        let formattedOptions = []

        if (conceptResult.success && conceptResult.data.length > 0) {
          const conceptData = conceptResult.data[0]
          const conceptPath = conceptData.CONCEPT_PATH
          const conceptName = conceptData.NAME_CHAR

          if (conceptPath) {
            this.logger.debug('Found finding concept path', { conceptCode, conceptPath, conceptName })

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

            const answerResult = await dbStore.executeQuery(answerQuery, [])

            if (answerResult.success && answerResult.data.length > 0) {
              this.logger.success('Found finding answer concepts in SNOMED-CT answer hierarchy', {
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
              this.logger.warn('No finding answer concepts found in SNOMED-CT answer hierarchy', {
                conceptCode,
                answerPath: '\\SNOMED-CT\\362981000\\260245000',
              })
            }
          } else {
            this.logger.warn('Finding concept has no CONCEPT_PATH', { conceptCode })
          }
        } else {
          this.logger.warn('Finding concept not found', { conceptCode })
        }

        // If no hierarchy-based options found, provide clinical finding answers
        if (formattedOptions.length === 0) {
          this.logger.info('No hierarchy options found, using clinical finding answers')
          formattedOptions = [
            { label: 'Present', value: 'SCTID: 52101004', conceptPath: '', type: 'fallback' }, // Present (qualifier value)
            { label: 'Absent', value: 'SCTID: 2667000', conceptPath: '', type: 'fallback' }, // Absent (qualifier value)
            { label: 'Positive', value: 'SCTID: 10828004', conceptPath: '', type: 'fallback' }, // Positive (qualifier value)
            { label: 'Negative', value: 'SCTID: 260385009', conceptPath: '', type: 'fallback' }, // Negative (qualifier value)
            { label: 'Normal', value: 'SCTID: 17621005', conceptPath: '', type: 'fallback' }, // Normal (qualifier value)
            { label: 'Abnormal', value: 'SCTID: 263654008', conceptPath: '', type: 'fallback' }, // Abnormal (qualifier value)
          ]
        }

        const finalOptions = formattedOptions.slice(0, 10) // Limit to 10 options

        // Cache the finding options
        await this.cacheResult(cacheKey, finalOptions)

        // Also cache each individual answer concept
        for (const option of finalOptions) {
          if (option.value && option.label) {
            await this.cacheResult(option.value, {
              code: option.value,
              label: option.label,
              color: this.determineColor(option.label, 'finding_answer'),
              resolved: true,
              source: 'finding_options',
            })
          }
        }

        const duration = timer.end()
        this.logger.success('Finding options fetched and cached', {
          conceptCode,
          optionsCount: finalOptions.length,
          duration,
          cached: finalOptions.length,
        })

        return finalOptions
      } catch (error) {
        timer.end()
        this.logger.error('Failed to get finding options', error, { conceptCode })

        // Return clinical finding fallback options and cache them
        const fallbackOptions = [
          { label: 'Present', value: 'Present', type: 'fallback' },
          { label: 'Absent', value: 'Absent', type: 'fallback' },
          { label: 'Positive', value: 'Positive', type: 'fallback' },
          { label: 'Negative', value: 'Negative', type: 'fallback' },
          { label: 'Normal', value: 'Normal', type: 'fallback' },
          { label: 'Abnormal', value: 'Abnormal', type: 'fallback' },
        ]

        await this.cacheResult(cacheKey, fallbackOptions)
        return fallbackOptions
      }
    },

    /**
     * Get selection options for a concept (dispatches to appropriate method based on type)
     * @param {string} conceptCode - The concept code to get options for
     * @returns {Promise<Array>} Array of selection options
     */
    async getSelectionOptions(conceptCode) {
      if (!conceptCode) {
        this.logger.debug('No concept code provided for selection options')
        return []
      }

      try {
        // First, get the concept to determine its VALTYPE_CD
        const dbStore = useDatabaseStore()
        const conceptQuery = 'SELECT VALTYPE_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?'
        const conceptResult = await dbStore.executeQuery(conceptQuery, [conceptCode])

        if (conceptResult.success && conceptResult.data.length > 0) {
          const valtype = conceptResult.data[0].VALTYPE_CD

          // For Finding type concepts, use the specialized getFindingOptions method
          if (valtype === 'F') {
            this.logger.debug('Dispatching to getFindingOptions for Finding type concept', { conceptCode, valtype })
            return await this.getFindingOptions(conceptCode)
          }
        }

        // For Selection type and other concepts, use the original logic
        this.logger.debug('Using standard selection options logic', { conceptCode })
        return await this.getStandardSelectionOptions(conceptCode)
      } catch (error) {
        this.logger.error('Failed to determine concept type, using standard selection options', error, { conceptCode })
        return await this.getStandardSelectionOptions(conceptCode)
      }
    },

    /**
     * Get standard selection options for non-Finding concepts
     * @param {string} conceptCode - The concept code to get options for
     * @returns {Promise<Array>} Array of selection options
     */
    async getStandardSelectionOptions(conceptCode) {
      // Check cache for selection options (using a special key format)
      const cacheKey = `${conceptCode}_selection_options`
      const cached = this.cache[cacheKey]
      if (cached && !this.isExpired(cached)) {
        this.logger.debug('Selection options resolved from cache', { conceptCode, source: 'cache' })
        return cached.data
      }

      const timer = this.logger.startTimer(`get_standard_selection_options_${conceptCode}`)

      try {
        this.logger.info('Fetching standard selection options from concept hierarchy', { conceptCode })

        const dbStore = useDatabaseStore()

        // First, get the parent concept to find its CONCEPT_PATH
        const parentQuery = 'SELECT CONCEPT_PATH FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?'
        const parentResult = await dbStore.executeQuery(parentQuery, [conceptCode])

        let formattedOptions = []

        if (parentResult.success && parentResult.data.length > 0) {
          const parentPath = parentResult.data[0].CONCEPT_PATH

          if (parentPath) {
            this.logger.debug('Found parent concept path', { conceptCode, parentPath })

            // Query for child concepts in the hierarchy path
            // Look for concepts that are children of this concept in the hierarchy
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
            const childResult = await dbStore.executeQuery(childQuery, [pathPattern, conceptCode, parentPath])

            if (childResult.success && childResult.data.length > 0) {
              this.logger.success('Found child concepts in hierarchy', {
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
              this.logger.warn('No child concepts found in hierarchy', { conceptCode, parentPath })
            }
          } else {
            this.logger.warn('Parent concept has no CONCEPT_PATH', { conceptCode })
          }
        } else {
          this.logger.warn('Parent concept not found', { conceptCode })
        }

        // If no hierarchy-based options found, provide common clinical answers
        if (formattedOptions.length === 0) {
          this.logger.info('No hierarchy options found, using common clinical answers')
          formattedOptions = [
            { label: 'Yes', value: 'SCTID: 373066001', conceptPath: '' }, // Yes (qualifier value)
            { label: 'No', value: 'SCTID: 373067005', conceptPath: '' }, // No (qualifier value)
            { label: 'Present', value: 'SCTID: 52101004', conceptPath: '' }, // Present (qualifier value)
            { label: 'Absent', value: 'SCTID: 2667000', conceptPath: '' }, // Absent (qualifier value)
            { label: 'Normal', value: 'SCTID: 17621005', conceptPath: '' }, // Normal (qualifier value)
            { label: 'Abnormal', value: 'SCTID: 263654008', conceptPath: '' }, // Abnormal (qualifier value)
          ]
        }

        const finalOptions = formattedOptions.slice(0, 10) // Limit to 10 options

        // Cache the selection options
        await this.cacheResult(cacheKey, finalOptions)

        // Also cache each individual option concept
        for (const option of finalOptions) {
          if (option.value && option.label) {
            await this.cacheResult(option.value, {
              code: option.value,
              label: option.label,
              color: this.determineColor(option.label, 'selection_answer'),
              resolved: true,
              source: 'selection_options',
            })
          }
        }

        const duration = timer.end()
        this.logger.success('Standard selection options fetched and cached', {
          conceptCode,
          optionsCount: finalOptions.length,
          duration,
          cached: finalOptions.length,
        })

        return finalOptions
      } catch (error) {
        timer.end()
        this.logger.error('Failed to get standard selection options', error, { conceptCode })

        // Return fallback options and cache them
        const fallbackOptions = [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' },
          { label: 'Unknown', value: 'Unknown' },
          { label: 'Not Applicable', value: 'N/A' },
        ]

        await this.cacheResult(cacheKey, fallbackOptions)
        return fallbackOptions
      }
    },

    /**
     * Reverse lookup: get code from resolved label
     * @param {string} label - Resolved label
     * @param {string} category - Category context
     * @returns {string|null} Concept code or null
     */
    getCodeFromLabel(label, category) {
      if (!label) return null

      // Search through cache for matching label
      for (const [code, cached] of Object.entries(this.cache)) {
        if (cached.data?.label === label) {
          return code
        }
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
    },
  },
})
