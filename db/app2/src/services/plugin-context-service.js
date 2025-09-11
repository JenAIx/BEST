/**
 * Plugin Context Service
 * Provides structured context data to SmartButton plugins while maintaining privacy
 * 
 * This service aggregates data from visit, observation, and patient stores
 * to provide contextual information for AI and plugin operations without
 * exposing sensitive patient data.
 */

import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { usePatientStore } from 'src/stores/patient-store'
import { createLogger } from 'src/core/services/logging-service'

class PluginContextService {
  constructor() {
    // Initialize stores lazily to avoid issues with store initialization timing
    this.visitStore = null
    this.observationStore = null
    this.patientStore = null
    
    // Initialize logger
    this.logger = createLogger('PluginContextService')
    this.logger.debug('PluginContextService initialized')
  }

  /**
   * Lazily initializes Pinia stores to avoid timing issues
   * @private
   */
  _initializeStores() {
    if (!this.visitStore) {
      this.logger.debug('Initializing stores...')
      try {
        this.visitStore = useVisitStore()
        this.observationStore = useObservationStore()
        this.patientStore = usePatientStore()
        
        this.logger.debug('Stores initialized successfully', {
          visitStoreExists: !!this.visitStore,
          observationStoreExists: !!this.observationStore,
          patientStoreExists: !!this.patientStore
        })
      } catch (error) {
        this.logger.error('Failed to initialize stores', error)
        throw new Error(`Store initialization failed: ${error.message}`)
      }
    }
  }

  /**
   * Get current context data for plugins
   * Returns structured data without exposing patient information
   * @returns {Object} Context object with visit and observation data
   */
  getContext() {
    try {
      this.logger.debug('Getting plugin context...')
      this._initializeStores()
      
      const selectedVisit = this.visitStore.selectedVisit
      const observations = this.observationStore.observations || []

      this.logger.debug('Retrieved store data', {
        visitId: selectedVisit?.id,
        observationsCount: observations.length
      })

      if (!selectedVisit) {
        this.logger.warn('No visit selected, returning no context')
        return {
          hasContext: false,
          message: 'No visit selected'
        }
      }

      // Process observations data
      const processedData = this._processObservations(observations)
      
      const context = {
        hasContext: true,
        visit: this._createVisitContext(selectedVisit),
        observations: {
          total: observations.length,
          byCategory: processedData.grouped,
          recent: processedData.recent,
          summary: processedData.summary
        },
        fieldSets: this._getActiveFieldSets(),
        timestamp: new Date().toISOString()
      }

      this.logger.info('Context created successfully', {
        hasContext: context.hasContext,
        visitId: context.visit.id,
        visitType: context.visit.visitType,
        observationsTotal: context.observations.total,
        categoriesCount: Object.keys(context.observations.byCategory).length,
        recentObservationsCount: context.observations.recent.length
      })

      return context
    } catch (error) {
      this.logger.error('Failed to get plugin context', error)
      return {
        hasContext: false,
        message: `Failed to load context: ${error.message}`
      }
    }
  }

  /**
   * Get enhanced context data specifically for AI operations
   * Includes additional details and insights for better AI analysis
   * @returns {Object} Enhanced context object with AI-specific data
   */
  getAIContext() {
    try {
      const baseContext = this.getContext()
      
      if (!baseContext.hasContext) {
        return baseContext
      }

      // Enhanced context for AI with more details
      return {
        ...baseContext,
        ai: {
          observationDetails: this._getObservationDetailsForAI(),
          visitContext: this._getVisitContextForAI(),
          fieldSetInfo: this._getFieldSetInfoForAI(),
          dataInsights: this._getDataInsights()
        }
      }
    } catch (error) {
      this.logger.error('Failed to get AI context', error)
      return {
        hasContext: false,
        message: `Failed to load AI context: ${error.message}`
      }
    }
  }

  /**
   * Get the appropriate display value for an observation based on its value type
   * @param {Object} obs - Observation object
   * @returns {string|number} Formatted display value
   * @private
   */
  _getDisplayValue(obs) {
    if (!obs) return 'N/A'
    
    switch (obs.valueType) {
      case 'N': // Numeric value
        return obs.numericValue ?? obs.value
      case 'T': // Text value
        return obs.value || ''
      case 'S': // Set value (concept code) - use resolved/display value
      case 'F': // Flag value (concept code) - use resolved/display value
        return obs.displayValue || obs.resolvedValue || obs.value || ''
      default:
        return obs.displayValue || obs.value || 'N/A'
    }
  }

  /**
   * Creates sanitized visit context without patient information
   * @param {Object} visit - Visit object from store
   * @returns {Object} Sanitized visit context
   * @private
   */
  _createVisitContext(visit) {
    return {
      id: visit.id,
      date: visit.date,
      visitType: visit.visitType || 'unknown',
      status: visit.status,
      location: visit.location,
      notes: visit.notes || '',
      visitBlob: visit.rawData?.VISIT_BLOB || null
    }
  }

  /**
   * Processes observations data and returns grouped, recent, and summary data
   * @param {Array} observations - Array of observation objects
   * @returns {Object} Processed observation data
   * @private
   */
  _processObservations(observations) {
    if (!Array.isArray(observations)) {
      this.logger.warn('_processObservations: observations is not an array', { observations })
      observations = []
    }

    this.logger.debug('Processing observations', { count: observations.length })
    
    return {
      grouped: this._groupObservationsByCategory(observations),
      recent: this._getRecentObservations(observations, 5),
      summary: this._createObservationSummary(observations)
    }
  }

  /**
   * Groups observations by category
   * @param {Array} observations - Array of observation objects
   * @returns {Object} Grouped observations by category
   * @private
   */
  _groupObservationsByCategory(observations) {
    const grouped = {}
    
    observations.forEach(obs => {
      const category = obs.category || 'uncategorized'
      if (!grouped[category]) {
        grouped[category] = []
      }
      
      grouped[category].push({
        conceptCode: obs.conceptCode,
        conceptName: obs.conceptName,
        value: this._getDisplayValue(obs),
        unit: this._normalizeUnit(obs.unit),
        date: obs.date || null,
        source: obs.source || null
      })
    })
    
    return grouped
  }

  /**
   * Gets recent observations up to the specified limit
   * @param {Array} observations - Array of observation objects
   * @param {number} limit - Maximum number of observations to return
   * @returns {Array} Array of recent observations
   * @private
   */
  _getRecentObservations(observations, limit = 5) {
    if (!Array.isArray(observations) || observations.length === 0) {
      return []
    }
    
    const recent = observations
      .slice(0, Math.max(0, limit))
      .map(obs => ({
        conceptCode: obs.conceptCode,
        conceptName: obs.conceptName,
        value: this._getDisplayValue(obs),
        unit: this._normalizeUnit(obs.unit),
        date: obs.date || null,
        category: obs.category
      }))
    
    this.logger.debug('Recent observations extracted', {
      requested: limit,
      returned: recent.length,
      total: observations.length
    })
    
    return recent
  }

  /**
   * Creates a summary of observations data
   * @param {Array} observations - Array of observation objects
   * @returns {Object} Summary object with counts and metadata
   * @private
   */
  _createObservationSummary(observations) {
    if (!Array.isArray(observations)) {
      return {
        totalCount: 0,
        categories: [],
        dateRange: null,
        valueTypes: []
      }
    }

    const dateInfo = this._analyzeDates(observations)
    
    return {
      totalCount: observations.length,
      categories: Object.keys(this._groupObservationsByCategory(observations)),
      dateRange: dateInfo.range,
      dateSpanDays: dateInfo.spanDays,
      valueTypes: this._getValueTypes(observations)
    }
  }

  /**
   * Normalizes unit values, filtering out N/A and null values
   * @param {string} unit - Unit string
   * @returns {string|null} Normalized unit or null
   * @private
   */
  _normalizeUnit(unit) {
    if (!unit || unit === 'N/A' || unit === 'null') {
      return null
    }
    return unit
  }

  /**
   * Gets active field sets for the current context
   * @returns {Array} Array of active field sets
   * @private
   * @todo Implement based on field set system
   */
  _getActiveFieldSets() {
    // TODO: Implement based on field set system when available
    this.logger.debug('Getting active field sets (not implemented)')
    return []
  }

  /**
   * Gets detailed observation data for AI analysis
   * @returns {Array} Array of detailed observation objects for AI
   * @private
   */
  _getObservationDetailsForAI() {
    try {
      const observations = this.observationStore?.observations || []
      return observations.map(obs => ({
        conceptCode: obs.conceptCode,
        conceptName: obs.conceptName,
        value: this._getDisplayValue(obs),
        unit: this._normalizeUnit(obs.unit),
        category: obs.category,
        date: obs.date || null,
        source: obs.source || null,
        valueType: obs.valueType,
        displayValue: obs.displayValue,
        numericValue: obs.numericValue
      }))
    } catch (error) {
      this.logger.error('Failed to get observation details for AI', error)
      return []
    }
  }

  /**
   * Gets visit context data for AI analysis
   * @returns {Object|null} Visit context object or null if no visit
   * @private
   */
  _getVisitContextForAI() {
    try {
      const visit = this.visitStore?.selectedVisit
      if (!visit) return null

      return {
        visitType: visit.visitType,
        date: visit.date,
        status: visit.status,
        location: visit.location,
        notes: visit.notes,
        visitBlobData: this._parseVisitBlob(visit.rawData?.VISIT_BLOB)
      }
    } catch (error) {
      this.logger.error('Failed to get visit context for AI', error)
      return null
    }
  }

  /**
   * Gets field set information for AI analysis
   * @returns {Object} Field set information object
   * @private
   * @todo Implement based on field set system
   */
  _getFieldSetInfoForAI() {
    // TODO: Implement based on field set system when available
    this.logger.debug('Getting field set info for AI (not implemented)')
    return {
      activeFieldSets: [],
      availableFieldSets: []
    }
  }

  /**
   * Generates data insights for AI analysis
   * @returns {Object} Data insights object
   * @private
   */
  _getDataInsights() {
    try {
      const observations = this.observationStore?.observations || []
      const dateInfo = this._analyzeDates(observations)
      
      return {
        hasNumericValues: observations.some(obs => obs.valueType === 'N'),
        hasTextValues: observations.some(obs => obs.valueType === 'T'),
        mostCommonCategory: this._getMostCommonCategory(observations),
        dateSpanDays: dateInfo.spanDays,
        totalObservations: observations.length,
        uniqueCategories: new Set(observations.map(obs => obs.category)).size
      }
    } catch (error) {
      this.logger.error('Failed to get data insights', error)
      return {
        hasNumericValues: false,
        hasTextValues: false,
        mostCommonCategory: null,
        dateSpanDays: 0,
        totalObservations: 0,
        uniqueCategories: 0
      }
    }
  }

  /**
   * Parses visit blob JSON data
   * @param {string} visitBlob - JSON string to parse
   * @returns {Object|null} Parsed object or null if parsing fails
   * @private
   */
  _parseVisitBlob(visitBlob) {
    if (!visitBlob || typeof visitBlob !== 'string') return null
    
    try {
      return JSON.parse(visitBlob)
    } catch (error) {
      this.logger.warn('Failed to parse visit blob', { error: error.message, visitBlob: visitBlob.slice(0, 100) })
      return null
    }
  }

  /**
   * Analyzes dates in observations and returns range and span information
   * @param {Array} observations - Array of observation objects
   * @returns {Object} Date analysis object with range and span
   * @private
   */
  _analyzeDates(observations) {
    if (!Array.isArray(observations) || observations.length === 0) {
      return {
        range: null,
        spanDays: 0
      }
    }
    
    try {
      const validDates = observations
        .map(obs => obs.date)
        .filter(dateStr => dateStr && dateStr !== null && dateStr !== undefined)
        .map(dateStr => {
          const date = new Date(dateStr)
          return isNaN(date.getTime()) ? null : date
        })
        .filter(date => date !== null)
      
      if (validDates.length === 0) {
        return {
          range: { start: 'N/A', end: 'N/A', note: 'No valid dates available' },
          spanDays: 0
        }
      }
      
      const minDate = new Date(Math.min(...validDates))
      const maxDate = new Date(Math.max(...validDates))
      const spanDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24))
      
      return {
        range: {
          start: minDate.toISOString().split('T')[0],
          end: maxDate.toISOString().split('T')[0]
        },
        spanDays: spanDays
      }
    } catch (error) {
      this.logger.warn('Error analyzing dates', error)
      return {
        range: { start: 'N/A', end: 'N/A', note: 'Date parsing error' },
        spanDays: 0
      }
    }
  }

  /**
   * Gets unique value types present in observations
   * @param {Array} observations - Array of observation objects
   * @returns {Array} Array of unique value types
   * @private
   */
  _getValueTypes(observations) {
    if (!Array.isArray(observations)) return []
    
    const types = new Set()
    observations.forEach(obs => {
      if (obs && obs.valueType) {
        types.add(obs.valueType)
      }
    })
    return Array.from(types)
  }

  /**
   * Finds the most common category in observations
   * @param {Array} observations - Array of observation objects
   * @returns {string|null} Most common category or null if none found
   * @private
   */
  _getMostCommonCategory(observations) {
    if (!Array.isArray(observations) || observations.length === 0) return null
    
    const categoryCount = {}
    observations.forEach(obs => {
      if (obs) {
        const category = obs.category || 'uncategorized'
        categoryCount[category] = (categoryCount[category] || 0) + 1
      }
    })
    
    let maxCount = 0
    let mostCommon = null
    Object.entries(categoryCount).forEach(([category, count]) => {
      if (count > maxCount) {
        maxCount = count
        mostCommon = category
      }
    })
    
    return mostCommon
  }

}

// Export singleton instance
export const pluginContextService = new PluginContextService()
export default pluginContextService
