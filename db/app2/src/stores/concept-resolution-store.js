import { defineStore } from 'pinia'
import { useDatabaseStore } from './database-store'
import { useGlobalSettingsStore } from './global-settings-store'
import { createLogger } from 'src/core/services/logging-service'
import { createCacheManager } from 'src/shared/utils/cache-manager'
import { createConceptResolver } from 'src/shared/utils/concept-resolver'
import { createOptionsLoader } from 'src/shared/utils/options-loader'
import { createConceptSearcher } from 'src/shared/utils/concept-searcher'
import { determineColor } from 'src/shared/utils/color-mapper'

export const useConceptResolutionStore = defineStore('conceptResolution', {
  state: () => ({
    // Logger instance
    logger: createLogger('ConceptResolutionStore'),
    // Shared utilities (initialized in initialize())
    cacheManager: null,
    conceptResolver: null,
    optionsLoader: null,
    conceptSearcher: null,
    // Track initialization state
    isInitialized: false,
  }),

  getters: {
    /**
     * Get resolved concept from cache
     * @param {string} conceptCode - The concept code to resolve
     * @returns {Object|null} Resolved concept or null if not cached
     */
    getResolved: (state) => (conceptCode) => {
      if (!conceptCode || !state.cacheManager) return null
      return state.cacheManager.get(conceptCode)
    },

    /**
     * Check if concept is currently being resolved
     * @param {string} conceptCode - The concept code
     * @returns {boolean} True if resolution is in progress
     */
    isResolving: (state) => (conceptCode) => {
      if (!state.cacheManager) return false
      return state.cacheManager.pendingOperations.has(conceptCode)
    },

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats: (state) => () => {
      if (!state.cacheManager) {
        return { size: 0, maxSize: 0, pendingCount: 0 }
      }
      return state.cacheManager.getStats()
    },
  },

  actions: {
    /**
     * Initialize the store - setup shared utilities and load cached data
     */
    async initialize() {
      // Prevent multiple initializations
      if (this.isInitialized) {
        this.logger.debug('Store already initialized, skipping')
        return
      }

      const timer = this.logger.startTimer('initialize')
      try {
        // Get store dependencies
        const dbStore = useDatabaseStore()
        const globalSettingsStore = useGlobalSettingsStore()

        // Initialize shared utilities
        this.cacheManager = createCacheManager({
          storagePrefix: 'concept_resolution_',
          cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
          maxCacheSize: 1000,
          logger: this.logger,
        })

        this.conceptResolver = createConceptResolver(dbStore, this.logger)
        this.optionsLoader = createOptionsLoader(dbStore, globalSettingsStore, this.logger)
        this.conceptSearcher = createConceptSearcher(dbStore, this.logger)

        // Initialize cache manager
        await this.cacheManager.initialize()

        this.isInitialized = true
        const cacheStats = this.cacheManager.getStats()

        this.logger.info('Store initialized successfully', {
          cachedConcepts: cacheStats.size,
          cacheExpiry: '24h',
          maxCacheSize: cacheStats.maxSize,
          utilitiesLoaded: ['cacheManager', 'conceptResolver', 'optionsLoader', 'conceptSearcher'],
        })
        timer.end()
      } catch (error) {
        timer.end()
        this.logger.error('Failed to initialize store', error)
        throw error
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

      if (!this.cacheManager || !this.conceptResolver) {
        await this.initialize()
      }

      // Use cache manager's getOrSet method for automatic caching and deduplication
      return await this.cacheManager.getOrSet(
        conceptCode,
        async () => {
          try {
            this.logger.debug('Starting concept resolution', { conceptCode, options })
            const resolved = await this.conceptResolver.resolveFromDatabase(conceptCode, options)

            this.logger.info('Concept resolved successfully', {
              conceptCode,
              label: resolved.label,
              source: resolved.source,
            })

            return resolved
          } catch (error) {
            this.logger.error('Failed to resolve concept', error, {
              conceptCode,
              options,
              context: options.context,
            })

            const fallback = this.conceptResolver.getFallbackResolution(conceptCode)
            this.logger.warn('Using fallback resolution', {
              conceptCode,
              fallbackLabel: fallback.label,
            })

            return fallback
          }
        },
        { tags: ['concept', options.context].filter(Boolean) },
      )
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

      if (!this.cacheManager || !this.conceptResolver) {
        await this.initialize()
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
        const cached = this.cacheManager.get(code)
        if (cached) {
          results.set(code, cached)
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

      // Use concept resolver's batch method for efficient database resolution
      if (toResolve.length > 0) {
        try {
          const batchResults = await this.conceptResolver.resolveBatch(toResolve, options)

          // Cache and add to results
          for (const [code, resolved] of batchResults) {
            await this.cacheManager.set(code, resolved, {
              tags: ['concept', options.context].filter(Boolean),
            })
            results.set(code, resolved)
          }
        } catch (error) {
          this.logger.error('Batch resolution failed, falling back to individual resolution', error)

          // Fallback to individual resolution
          const resolutionPromises = toResolve.map((code) => this.resolveConcept(code, options).then((resolved) => ({ code, resolved })))

          const resolved = await Promise.all(resolutionPromises)
          for (const { code, resolved: data } of resolved) {
            results.set(code, data)
          }
        }
      }

      const duration = timer.end()
      this.logger.info('Batch concept resolution completed', {
        totalCodes: conceptCodes.length,
        resolved: results.size,
        duration,
        successRate: `${((results.size / conceptCodes.length) * 100).toFixed(1)}%`,
      })

      return results
    },

    /**
     * Determine color based on resolved text and context
     * @param {string} text - Resolved text or code
     * @param {string} context - Context hint (e.g., 'status', 'gender', etc.)
     * @returns {string} Quasar color name
     */
    determineColor(text, context) {
      return determineColor(text, context)
    },

    /**
     * Get fallback label for unresolved codes
     * @param {string} conceptCode - The concept code
     * @returns {string} Fallback label
     */
    getFallbackLabel(conceptCode) {
      if (!this.conceptResolver) return conceptCode || 'Unknown'
      return this.conceptResolver.getFallbackLabel(conceptCode)
    },

    /**
     * Get fallback resolution for failed lookups
     * @param {string} conceptCode - The concept code
     * @returns {Object} Fallback resolution
     */
    getFallbackResolution(conceptCode) {
      if (!this.conceptResolver) {
        return {
          code: conceptCode,
          label: conceptCode || 'Unknown',
          color: 'grey',
          resolved: false,
          source: 'fallback',
        }
      }
      return this.conceptResolver.getFallbackResolution(conceptCode)
    },

    /**
     * Get visit type icon from resolved concept data
     * @param {string} visitType - The visit type code
     * @returns {string} Icon name or default
     */
    getVisitTypeIcon(visitType) {
      const resolved = this.getResolved(visitType)
      return resolved?.icon || 'category'
    },

    /**
     * Get visit type color from resolved concept data
     * @param {string} visitType - The visit type code
     * @returns {string} Color name or default
     */
    getVisitTypeColor(visitType) {
      const resolved = this.getResolved(visitType)
      return resolved?.color || 'primary'
    },

    /**
     * Get visit type label from resolved concept data
     * @param {string} visitType - The visit type code
     * @returns {string} Label or default
     */
    getVisitTypeLabel(visitType) {
      const resolved = this.getResolved(visitType)
      return resolved?.label || visitType || 'General Visit'
    },

    /**
     * Clear all cached data
     */
    async clearCache() {
      if (this.cacheManager) {
        await this.cacheManager.clear()
      }

      // Reset initialization flag to force re-initialization
      this.isInitialized = false

      this.logger.info('Cache cleared successfully', {
        memoryCache: 'cleared',
        pendingOperations: 'cleared',
        initializationReset: true,
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

      this.logger.info('Concept preloading completed', {
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
      if (!this.optionsLoader) {
        await this.initialize()
      }

      const cacheKey = 'concept_categories'

      return await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          return await this.optionsLoader.getCategoryOptions(forceRefresh)
        },
        { tags: ['categories', 'options'] },
      )
    },

    /**
     * Get dropdown options for a specific concept category
     * @param {string} category - Category (gender, vital_status, language, race, marital_status, religion)
     * @param {string} table - Optional table context
     * @param {string} column - Optional column context
     * @returns {Promise<Array>} Array of {label, value, color} options
     */
    async getConceptOptions(category, table = null, column = null) {
      if (!this.optionsLoader || !this.cacheManager) {
        await this.initialize()
      }

      // Create cache key for this specific category/table/column combination
      const cacheKey = `concept_options_${category}_${table || 'null'}_${column || 'null'}`

      return await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          const options = await this.optionsLoader.getConceptOptions(category, table, column)

          // Cache individual concepts for future resolution
          for (const option of options) {
            if (option.value && option.label) {
              await this.cacheManager.set(
                option.value,
                {
                  code: option.value,
                  label: option.label,
                  color: option.color,
                  resolved: true,
                  source: 'options_loader',
                },
                { tags: ['concept', category] },
              )
            }
          }

          return options
        },
        { tags: ['options', category, table, column].filter(Boolean) },
      )
    },

    /**
     * Get fallback options when database query fails
     * @param {string} category - Category name
     * @returns {Array} Fallback options
     */
    getFallbackOptions(category) {
      if (!this.optionsLoader) return []
      return this.optionsLoader.getFallbackOptions(category)
    },

    /**
     * Search concepts by name or code
     * @param {string} searchTerm - Search term (minimum 2 characters)
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of matching concepts
     */
    async searchConcepts(searchTerm, options = {}) {
      if (!this.conceptSearcher || !this.cacheManager) {
        await this.initialize()
      }

      try {
        const concepts = await this.conceptSearcher.searchConcepts(searchTerm, options)

        // Cache the concepts for future resolution
        for (const concept of concepts) {
          if (concept.CONCEPT_CD && concept.NAME_CHAR) {
            await this.cacheManager.set(
              concept.CONCEPT_CD,
              {
                code: concept.CONCEPT_CD,
                label: concept.NAME_CHAR,
                color: concept.color || this.determineColor(concept.NAME_CHAR, options.context),
                resolved: true,
                source: 'search',
                valueType: concept.VALTYPE_CD,
                unit: concept.UNIT_CD,
              },
              { tags: ['concept', 'search', options.context].filter(Boolean) },
            )
          }
        }

        return concepts
      } catch (error) {
        this.logger.error('Concept search failed', error, { searchTerm, options })
        throw error
      }
    },

    /**
     * Get finding-specific answer options based on concept hierarchy
     * @param {string} conceptCode - The finding concept code
     * @returns {Promise<Array>} Array of finding answer options
     */
    async getFindingOptions(conceptCode) {
      if (!this.optionsLoader || !this.cacheManager) {
        await this.initialize()
      }

      const cacheKey = `${conceptCode}_finding_options`

      return await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          const options = await this.optionsLoader.getFindingOptions(conceptCode)

          // Cache individual answer concepts for future resolution
          for (const option of options) {
            if (option.value && option.label) {
              await this.cacheManager.set(
                option.value,
                {
                  code: option.value,
                  label: option.label,
                  color: this.determineColor(option.label, 'finding_answer'),
                  resolved: true,
                  source: 'finding_options',
                },
                { tags: ['concept', 'finding_answer'] },
              )
            }
          }

          return options
        },
        { tags: ['finding_options', conceptCode] },
      )
    },

    /**
     * Get selection options for a concept (dispatches to appropriate method based on type)
     * @param {string} conceptCode - The concept code to get options for
     * @returns {Promise<Array>} Array of selection options
     */
    async getSelectionOptions(conceptCode) {
      if (!this.optionsLoader) {
        await this.initialize()
      }

      return await this.optionsLoader.getSelectionOptions(conceptCode)
    },

    /**
     * Get standard selection options for non-Finding concepts
     * @param {string} conceptCode - The concept code to get options for
     * @returns {Promise<Array>} Array of selection options
     */
    async getStandardSelectionOptions(conceptCode) {
      this.logger.info('ConceptResolutionStore: getStandardSelectionOptions called', { conceptCode })

      if (!this.optionsLoader) {
        await this.initialize()
      }

      const result = await this.optionsLoader.getStandardSelectionOptions(conceptCode)
      this.logger.info('ConceptResolutionStore: getStandardSelectionOptions result', {
        conceptCode,
        resultCount: result ? result.length : 0,
        firstFewResults: result ? result.slice(0, 2) : [],
      })

      return result
    },

    /**
     * Reverse lookup: get code from resolved label
     * @param {string} label - Resolved label
     * @param {string} category - Category context
     * @returns {Promise<string|null>} Concept code or null
     */
    async getCodeFromLabel(label, category) {
      if (!this.conceptResolver || !this.cacheManager) {
        await this.initialize()
      }

      return await this.conceptResolver.getCodeFromLabel(label, category, this.cacheManager.cache)
    },
  },
})
