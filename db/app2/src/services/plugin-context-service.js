/**
 * Plugin Context Service
 * Provides structured context data to SmartButton plugins while maintaining privacy
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

  _initializeStores() {
    if (!this.visitStore) {
      this.logger.debug('Initializing stores...')
      this.visitStore = useVisitStore()
      this.observationStore = useObservationStore()
      this.patientStore = usePatientStore()
      
      this.logger.debug('Stores initialized', {
        visitStoreExists: !!this.visitStore,
        observationStoreExists: !!this.observationStore,
        patientStoreExists: !!this.patientStore
      })
    }
  }

  /**
   * Get current context data for plugins
   * Returns structured data without exposing patient information
   */
  getContext() {
    try {
      this.logger.debug('Getting plugin context...')
      this._initializeStores()
      
      const selectedVisit = this.visitStore.selectedVisit
      const observations = this.observationStore.observations

      this.logger.debug('Getting context for visit', {
        visitId: selectedVisit?.id,
        observationsCount: observations?.length || 0
      })


    if (!selectedVisit) {
      this.logger.warn('No visit selected, returning no context')
      return {
        hasContext: false,
        message: 'No visit selected'
      }
    }

    // Create sanitized context without patient information
    this.logger.debug('Creating context object...')
    
    const groupedObservations = this._groupObservationsByCategory(observations)
    const recentObservations = this._getRecentObservations(observations, 5)
    const observationSummary = this._createObservationSummary(observations)
    
    this.logger.info('Observations extracted and processed', {
      total: observations.length,
      categories: Object.keys(groupedObservations),
      recent: recentObservations.length,
      recentObservations: recentObservations,
      groupedObservations: groupedObservations
    })

    const context = {
      hasContext: true,
      visit: {
        id: selectedVisit.id,
        date: selectedVisit.date,
        visitType: selectedVisit.visitType || 'unknown',
        status: selectedVisit.status,
        location: selectedVisit.location,
        notes: selectedVisit.notes || '',
        // Include visit blob data if available
        visitBlob: selectedVisit.rawData?.VISIT_BLOB || null
      },
      observations: {
        total: observations.length,
        byCategory: groupedObservations,
        recent: recentObservations,
        // Include observation summaries without sensitive data
        summary: observationSummary
      },
      // Include field sets if available
      fieldSets: this._getActiveFieldSets(),
      // Timestamp for context freshness
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
      this.logger.error('Failed to get plugin context', error, {
        hasStores: !!(this.visitStore && this.observationStore && this.patientStore),
        errorMessage: error.message,
        errorStack: error.stack
      })
      return {
        hasContext: false,
        message: 'Failed to load context: ' + error.message
      }
    }
  }

  /**
   * Get context for AI prompts - includes more detailed information
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
          // Include observation details for AI analysis
          observationDetails: this._getObservationDetailsForAI(),
          // Include visit notes and context
          visitContext: this._getVisitContextForAI(),
          // Include field set information
          fieldSetInfo: this._getFieldSetInfoForAI(),
          // Include data patterns and insights
          dataInsights: this._getDataInsights()
        }
      }
    } catch (error) {
      console.warn('Failed to get AI context:', error)
      return {
        hasContext: false,
        message: 'Failed to load AI context: ' + error.message
      }
    }
  }

  /**
   * Get the appropriate display value for an observation based on its value type
   */
  _getDisplayValue(obs) {
    switch (obs.valueType) {
      case 'N': // Numeric value
        return obs.numericValue
      case 'T': // Text value
        return obs.value
      case 'S': // Set value (concept code) - use resolved/display value
      case 'F': // Flag value (concept code) - use resolved/display value
        // Use displayValue if available, otherwise fall back to resolvedValue or original value
        return obs.displayValue || obs.resolvedValue || obs.value
      default:
        // For unknown types, prefer displayValue, then original value
        return obs.displayValue || obs.value
    }
  }

  /**
   * Group observations by category
   */
  _groupObservationsByCategory(observations) {
    this.logger.debug('Grouping observations by category', { count: observations.length })
    
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
        unit: obs.unit && obs.unit !== 'N/A' ? obs.unit : null,
        date: obs.date || null,
        source: obs.source || null
      })
    })
    
    
    return grouped
  }

  /**
   * Get recent observations
   */
  _getRecentObservations(observations, limit = 5) {
    
    // Simply return all observations for the current visit, no date filtering needed
    // The observations are already filtered by encounter_num in the store
    const recent = observations
      .slice(0, limit) // Just take the first 'limit' observations
      .map(obs => ({
        conceptCode: obs.conceptCode,
        conceptName: obs.conceptName,
        value: this._getDisplayValue(obs),
        unit: obs.unit && obs.unit !== 'N/A' ? obs.unit : null,
        date: obs.date || null,
        category: obs.category
      }))
    
    this.logger.info('Recent observations extracted', { 
      count: recent.length,
      observations: recent.map(obs => ({
        concept: obs.conceptCode,
        name: obs.conceptName,
        value: obs.value,
        unit: obs.unit,
        category: obs.category,
        valueType: observations.find(o => o.conceptCode === obs.conceptCode)?.valueType
      }))
    })
    
    return recent
  }

  /**
   * Create observation summary
   */
  _createObservationSummary(observations) {
    const summary = {
      totalCount: observations.length,
      categories: Object.keys(this._groupObservationsByCategory(observations)),
      dateRange: this._getDateRange(observations),
      valueTypes: this._getValueTypes(observations)
    }
    return summary
  }

  /**
   * Get active field sets
   */
  _getActiveFieldSets() {
    // This would need to be implemented based on your field set system
    // For now, return empty array
    return []
  }

  /**
   * Get observation details for AI analysis
   */
  _getObservationDetailsForAI() {
    const observations = this.observationStore.observations
    return observations.map(obs => ({
      conceptCode: obs.conceptCode,
      conceptName: obs.conceptName,
      value: this._getDisplayValue(obs),
      unit: obs.unit && obs.unit !== 'N/A' ? obs.unit : null,
      category: obs.category,
      date: obs.date || null,
      source: obs.source || null,
      valueType: obs.valueType,
      displayValue: obs.displayValue
    }))
  }

  /**
   * Get visit context for AI
   */
  _getVisitContextForAI() {
    const visit = this.visitStore.selectedVisit
    if (!visit) return null

    return {
      visitType: visit.visitType,
      date: visit.date,
      status: visit.status,
      location: visit.location,
      notes: visit.notes,
      // Include parsed visit blob if available
      visitBlobData: this._parseVisitBlob(visit.rawData?.VISIT_BLOB)
    }
  }

  /**
   * Get field set information for AI
   */
  _getFieldSetInfoForAI() {
    // This would need to be implemented based on your field set system
    return {
      activeFieldSets: [],
      availableFieldSets: []
    }
  }

  /**
   * Get data insights
   */
  _getDataInsights() {
    const observations = this.observationStore.observations
    return {
      hasNumericValues: observations.some(obs => obs.valueType === 'N'),
      hasTextValues: observations.some(obs => obs.valueType === 'T'),
      mostCommonCategory: this._getMostCommonCategory(observations),
      dateSpan: this._getDateSpan(observations)
    }
  }

  /**
   * Parse visit blob data
   */
  _parseVisitBlob(visitBlob) {
    if (!visitBlob) return null
    
    try {
      return JSON.parse(visitBlob)
    } catch (error) {
      console.warn('Failed to parse visit blob:', error)
      return null
    }
  }

  /**
   * Get date range of observations
   */
  _getDateRange(observations) {
    if (observations.length === 0) return null
    
    // Try to get date range, but don't fail if dates are invalid
    try {
      const validDates = observations
        .map(obs => obs.date)
        .filter(dateStr => dateStr && dateStr !== null && dateStr !== undefined)
        .map(dateStr => new Date(dateStr))
        .filter(date => !isNaN(date.getTime()))
      
      if (validDates.length === 0) {
        return { start: 'N/A', end: 'N/A', note: 'No valid dates available' }
      }
      
      const minDate = new Date(Math.min(...validDates))
      const maxDate = new Date(Math.max(...validDates))
      
      return {
        start: minDate.toISOString().split('T')[0],
        end: maxDate.toISOString().split('T')[0]
      }
    } catch {
      return { start: 'N/A', end: 'N/A', note: 'Date parsing error' }
    }
  }

  /**
   * Get value types in observations
   */
  _getValueTypes(observations) {
    const types = new Set()
    observations.forEach(obs => {
      if (obs.valueType) {
        types.add(obs.valueType)
      }
    })
    return Array.from(types)
  }

  /**
   * Get most common category
   */
  _getMostCommonCategory(observations) {
    const categoryCount = {}
    observations.forEach(obs => {
      const category = obs.category || 'uncategorized'
      categoryCount[category] = (categoryCount[category] || 0) + 1
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

  /**
   * Get date span of observations
   */
  _getDateSpan(observations) {
    if (observations.length === 0) return 0
    
    // Try to calculate date span, but return 0 if dates are not available
    try {
      const validDates = observations
        .map(obs => obs.date)
        .filter(dateStr => dateStr && dateStr !== null && dateStr !== undefined)
        .map(dateStr => new Date(dateStr))
        .filter(date => !isNaN(date.getTime()))
      
      if (validDates.length === 0) return 0
      
      const minDate = new Date(Math.min(...validDates))
      const maxDate = new Date(Math.max(...validDates))
      
      return Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) // days
    } catch {
      return 0
    }
  }
}

// Export singleton instance
export const pluginContextService = new PluginContextService()
export default pluginContextService
