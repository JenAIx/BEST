/**
 * Generic Cache Manager
 *
 * Provides a generalized caching system with:
 * - In-memory reactive caching (Vue-compatible)
 * - Browser localStorage persistence
 * - Expiry management
 * - Size limits and LRU eviction
 * - Pending request deduplication
 * - Statistics and monitoring
 */

import { reactive } from 'vue'

export class CacheManager {
  constructor(options = {}) {
    this.config = {
      // Cache expiry time in milliseconds (default: 24 hours)
      cacheExpiry: options.cacheExpiry || 24 * 60 * 60 * 1000,
      // Browser storage key prefix
      storagePrefix: options.storagePrefix || 'cache_',
      // Maximum cache size to prevent memory issues
      maxCacheSize: options.maxCacheSize || 1000,
      // Enable browser storage persistence
      enablePersistence: options.enablePersistence !== false,
      // Logger instance (optional)
      logger: options.logger || null,
      ...options,
    }

    // Reactive cache for Vue compatibility
    this.cache = reactive({})

    // Track pending operations to prevent duplicates
    this.pendingOperations = new Set()

    // Track initialization state
    this.isInitialized = false
  }

  /**
   * Initialize cache - load from browser storage if enabled
   */
  async initialize() {
    if (this.isInitialized) {
      this.log('debug', 'Cache already initialized, skipping')
      return
    }

    const timer = this.startTimer('cache_initialize')

    try {
      if (this.config.enablePersistence) {
        await this.loadFromStorage()
      }

      const cacheSize = Object.keys(this.cache).length
      this.isInitialized = true

      this.log('info', 'Cache initialized successfully', {
        cachedItems: cacheSize,
        cacheExpiry: `${this.config.cacheExpiry / (60 * 60 * 1000)}h`,
        maxCacheSize: this.config.maxCacheSize,
        persistenceEnabled: this.config.enablePersistence,
      })

      timer.end()
    } catch (error) {
      timer.end()
      this.log('error', 'Failed to initialize cache', error, {
        storagePrefix: this.config.storagePrefix,
      })
    }
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if not found/expired
   */
  get(key) {
    if (!key) return null

    const cached = this.cache[key]
    if (!cached) return null

    if (this.isExpired(cached)) {
      this.delete(key)
      return null
    }

    // Update access time for LRU
    cached.accessed = Date.now()
    return cached.data
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {Object} options - Caching options
   */
  async set(key, data, options = {}) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      accessed: Date.now(),
      ttl: options.ttl || this.config.cacheExpiry,
      tags: options.tags || [],
    }

    // Add to in-memory cache
    this.cache[key] = cacheEntry

    // Enforce cache size limit
    if (Object.keys(this.cache).length > this.config.maxCacheSize) {
      await this.evictOldEntries()
    }

    // Save to browser storage if enabled
    if (this.config.enablePersistence) {
      await this.saveToStorage(key, cacheEntry)
    }

    this.log('debug', 'Item cached', { key, dataType: typeof data })
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    delete this.cache[key]

    if (this.config.enablePersistence) {
      const storageKey = this.config.storagePrefix + key
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        this.log('warn', 'Failed to remove item from storage', error, { key })
      }
    }
  }

  /**
   * Check if item exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if item exists and is valid
   */
  has(key) {
    return this.get(key) !== null
  }

  /**
   * Clear all cached data
   */
  async clear() {
    // Clear in-memory cache
    Object.keys(this.cache).forEach((key) => delete this.cache[key])
    this.pendingOperations.clear()
    this.isInitialized = false

    // Clear browser storage
    if (this.config.enablePersistence) {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.config.storagePrefix))

      for (const key of keys) {
        localStorage.removeItem(key)
      }
    }

    this.log('info', 'Cache cleared successfully', {
      clearedKeys: Object.keys(this.cache).length,
      memoryCache: 'cleared',
      pendingOperations: 'cleared',
      initializationReset: true,
    })
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const entries = Object.entries(this.cache)

    return {
      size: entries.length,
      maxSize: this.config.maxCacheSize,
      pendingCount: this.pendingOperations.size,
      expiredCount: entries.filter(([, entry]) => this.isExpired(entry)).length,
      hitRate: this.hitRate || 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(([, entry]) => entry.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(([, entry]) => entry.timestamp)) : null,
    }
  }

  /**
   * Execute operation with caching and deduplication
   * @param {string} key - Cache key
   * @param {Function} operation - Async operation to execute
   * @param {Object} options - Caching options
   * @returns {Promise<any>} Operation result
   */
  async getOrSet(key, operation, options = {}) {
    // Check cache first
    const cached = this.get(key)
    if (cached !== null) {
      this.log('debug', 'Cache hit', { key, source: 'cache' })
      return cached
    }

    // Check if operation is already pending
    if (this.pendingOperations.has(key)) {
      this.log('debug', 'Operation already pending, waiting', { key })
      return await this.waitForOperation(key)
    }

    // Start operation
    this.pendingOperations.add(key)
    const timer = this.startTimer(`operation_${key}`)

    try {
      this.log('debug', 'Executing operation', { key, options })
      const result = await operation()

      // Cache the result
      await this.set(key, result, options)

      this.log('debug', 'Operation completed and cached', {
        key,
        resultType: typeof result,
        duration: timer.end(),
      })

      return result
    } catch (error) {
      timer.end()
      this.log('error', 'Operation failed', error, { key, options })
      throw error
    } finally {
      this.pendingOperations.delete(key)
    }
  }

  /**
   * Invalidate cache entries by tags
   * @param {Array<string>} tags - Tags to invalidate
   */
  invalidateByTags(tags) {
    const toDelete = []

    for (const [key, entry] of Object.entries(this.cache)) {
      if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
        toDelete.push(key)
      }
    }

    toDelete.forEach((key) => this.delete(key))

    this.log('info', 'Cache invalidated by tags', {
      tags,
      invalidatedCount: toDelete.length,
    })
  }

  /**
   * Check if cache entry is expired
   * @param {Object} cacheEntry - Cache entry to check
   * @returns {boolean} True if expired
   */
  isExpired(cacheEntry) {
    if (!cacheEntry || !cacheEntry.timestamp) return true
    const ttl = cacheEntry.ttl || this.config.cacheExpiry
    return Date.now() - cacheEntry.timestamp > ttl
  }

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
      const [key] = entries[i]
      this.delete(key)
    }

    this.log('debug', 'Evicted old cache entries', {
      evictedCount: toRemove,
      remainingCount: Object.keys(this.cache).length,
    })
  }

  /**
   * Load cached data from browser storage
   */
  async loadFromStorage() {
    if (!this.config.enablePersistence) return

    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.config.storagePrefix))

      for (const key of keys) {
        try {
          const cacheKey = key.replace(this.config.storagePrefix, '')
          const cached = JSON.parse(localStorage.getItem(key))

          if (cached && !this.isExpired(cached)) {
            // Update accessed time
            cached.accessed = Date.now()
            this.cache[cacheKey] = cached
          } else {
            // Remove expired entry
            localStorage.removeItem(key)
          }
        } catch (error) {
          this.log('warn', 'Failed to load cached entry', error, { key })
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      this.log('error', 'Failed to load from browser storage', error)
    }
  }

  /**
   * Save cache entry to browser storage
   * @param {string} key - Cache key
   * @param {Object} cacheEntry - Cache entry to save
   */
  async saveToStorage(key, cacheEntry) {
    if (!this.config.enablePersistence) return

    try {
      const storageKey = this.config.storagePrefix + key
      localStorage.setItem(storageKey, JSON.stringify(cacheEntry))
    } catch (error) {
      this.log('warn', 'Failed to save to browser storage', error, { key })
      // Handle quota exceeded or other storage errors gracefully
    }
  }

  /**
   * Wait for ongoing operation to complete
   * @param {string} key - Operation key
   * @returns {Promise<any>} Operation result
   */
  async waitForOperation(key) {
    // Poll until operation is complete
    while (this.pendingOperations.has(key)) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // Return cached result
    return this.get(key)
  }

  /**
   * Estimate memory usage of cache
   * @returns {number} Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    try {
      return JSON.stringify(this.cache).length * 2 // Rough estimate
    } catch {
      return 0
    }
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
    if (this.config.logger) {
      this.config.logger[level](message, data, context)
    } else if (level === 'error') {
      console.error(`[CacheManager] ${message}`, data, context)
    } else if (level === 'warn') {
      console.warn(`[CacheManager] ${message}`, data, context)
    } else if (level === 'info') {
      console.info(`[CacheManager] ${message}`, data, context)
    } else if (level === 'debug' && process.env.NODE_ENV === 'development') {
      console.debug(`[CacheManager] ${message}`, data, context)
    }
  }
}

/**
 * Create a cache manager instance with default configuration
 * @param {Object} options - Configuration options
 * @returns {CacheManager} Cache manager instance
 */
export function createCacheManager(options = {}) {
  return new CacheManager(options)
}

/**
 * Global cache manager instances for common use cases
 */
export const conceptCache = createCacheManager({
  storagePrefix: 'concept_',
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
  maxCacheSize: 1000,
})

export const optionsCache = createCacheManager({
  storagePrefix: 'options_',
  cacheExpiry: 12 * 60 * 60 * 1000, // 12 hours
  maxCacheSize: 500,
})

export const searchCache = createCacheManager({
  storagePrefix: 'search_',
  cacheExpiry: 30 * 60 * 1000, // 30 minutes
  maxCacheSize: 200,
})
