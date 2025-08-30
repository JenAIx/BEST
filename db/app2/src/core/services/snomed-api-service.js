/**
 * SNOMED CT API Service
 * Provides search functionality against SNOMED CT terminology servers
 * 
 * Supports multiple SNOMED CT API endpoints:
 * - Snowstorm (open source SNOMED CT terminology server)
 * - NHS Digital SNOMED CT Browser API
 * - Custom SNOMED CT FHIR endpoints
 */

import axios from 'axios'

class SnomedApiService {
  constructor() {
    // Use working FHIR-based SNOMED CT endpoints (old browser endpoints are down)
    this.endpoints = {
      // CSIRO OntoServer - Working FHIR endpoint with full SNOMED CT access
      fhirBase: 'https://r4.ontoserver.csiro.au/fhir',
      // Alternative: SNOMED tools dev server
      fhirAlt: 'https://dev-fhir.snomedtools.org/fhir'
    }
    
    this.defaultConfig = {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
    
    // Alternative endpoints (uncomment and configure as needed)
    this.alternativeEndpoints = {
      // NHS Digital SNOMED CT Browser (UK focused)
      // nhsDigital: {
      //   baseURL: 'https://ontology.nhs.uk/authoring/fhir',
      //   apiKey: process.env.NHS_SNOMED_API_KEY
      // },
      
      // Custom Snowstorm instance
      // custom: {
      //   baseURL: process.env.CUSTOM_SNOMED_ENDPOINT || 'https://your-snowstorm-server.com',
      //   apiKey: process.env.CUSTOM_SNOMED_API_KEY
      // }
    }
    
  }

  /**
   * Search SNOMED CT concepts by term using descriptions endpoint (like original implementation)
   * @param {string} searchTerm - The search term
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results (default: 50)
   * @param {boolean} options.activeOnly - Only active concepts (default: true)
   * @param {string} options.lang - Language (default: 'english')
   * @returns {Promise<Object>} Search results with concepts array
   */
  async searchConcepts(searchTerm, options = {}) {
    console.log('snomed_api/searchConcepts: ', searchTerm)
    
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.length < 3) {
      return {
        success: false,
        error: 'Search term must be at least 3 characters',
        data: [],
        total: 0,
        searchTerm,
        options
      }
    }

    try {
      const {
        limit = 50,
        skipTo = 0
      } = options

      // Use FHIR ValueSet $expand operation with filter (new working approach)
      const url = `${this.endpoints.fhirBase}/ValueSet/$expand`
      const params = {
        'url': 'http://snomed.info/sct?fhir_vs',
        'filter': searchTerm,
        'count': limit,
        'offset': skipTo,
        'includeDesignations': 'true'
      }
      
      console.log('[SNOMED API] FHIR Search:', url, params)

      // Direct axios call (webSecurity disabled in Electron allows external requests)
      const response = await axios.get(url, { 
        ...this.defaultConfig,
        params
      })

      if (response && response.data && response.data.expansion) {
        const concepts = this.transformFhirResults(response.data.expansion.contains || [])
        return {
          success: true,
          data: concepts,
          total: response.data.expansion.total || concepts.length,
          searchTerm,
          options
        }
      } else {
        return {
          success: false,
          error: 'No data returned from SNOMED CT FHIR API',
          data: [],
          total: 0,
          searchTerm,
          options
        }
      }
    } catch (error) {
      console.error('[SNOMED API] Search failed:', error)
      return {
        success: false,
        error: this.handleApiError(error).message,
        data: [],
        total: 0,
        searchTerm,
        options
      }
    }
  }

  /**
   * Get concept details by SCTID (like original query function)
   * @param {number|string} snomedId - SNOMED CT concept ID (SCTID)
   * @returns {Promise<Object>} Concept details
   */
  async query(snomedId) {
    console.log('snomed_api/query: ', snomedId)
    
    if (!snomedId) {
      return {
        success: false,
        error: 'SNOMED ID is required',
        data: null
      }
    }

    try {
      // Use FHIR CodeSystem $lookup operation
      const url = `${this.endpoints.fhirBase}/CodeSystem/$lookup`
      const params = {
        'system': 'http://snomed.info/sct',
        'code': snomedId.toString()
      }
      
      const response = await axios.get(url, { 
        ...this.defaultConfig,
        params
      })

      if (response && response.data && response.data.parameter) {
        return {
          success: true,
          data: this.transformFhirLookupResult(response.data),
          conceptId: snomedId
        }
      } else {
        return {
          success: false,
          error: 'No data returned',
          data: null,
          conceptId: snomedId
        }
      }
    } catch (error) {
      console.error('[SNOMED API] Query failed:', error)
      return {
        success: false,
        error: this.handleApiError(error).message,
        data: null,
        conceptId: snomedId
      }
    }
  }

  /**
   * Get full concept details with relationships using FHIR (like original _query_full function)
   * @param {number|string} snomedId - SNOMED CT concept ID
   * @returns {Promise<Object>} Full concept details with relationships
   */
  async _queryFull(snomedId) {
    if (!snomedId) return null

    try {
      // Use FHIR CodeSystem $lookup with property request for parent relationships  
      const url = `${this.endpoints.fhirBase}/CodeSystem/$lookup`
      const params = {
        'system': 'http://snomed.info/sct',
        'code': snomedId.toString(),
        'property': 'parent' // Get parent relationships
      }
      
      const response = await axios.get(url, { 
        ...this.defaultConfig,
        params
      })
      
      if (response && response.data && response.data.parameter) {
        return this.transformFhirLookupToOldFormat(response.data)
      } else {
        return null
      }
    } catch (error) {
      console.error('[SNOMED API] Full query failed:', error)
      return null
    }
  }

  /**
   * Resolve SNOMED CT concept to full hierarchical path (like original resolve function)
   * @param {number|string} snomedId - SNOMED CT concept ID
   * @returns {Promise<string>} Full concept path like \\SNOMED-CT\\parentId\\childId\\conceptId
   */
  async resolve(snomedId) {
    console.log('snomed_api/resolve: ', snomedId)
    
    if (!snomedId || (typeof snomedId !== 'number' && typeof snomedId !== 'string')) {
      return null
    }

    // Convert to number for consistency with original implementation
    const conceptId = typeof snomedId === 'string' ? parseInt(snomedId) : snomedId

    try {
      let res = await this._queryFull(conceptId)
      if (!res) return null // nothing found

      let url = `${conceptId}`
      let parentId = this._getParent(res)
      let cc = 0
      
      // Build path by traversing up the hierarchy (like original implementation)
      while (parentId !== undefined && cc < 10) {
        cc++ // safety break
        url = `${parentId}\\${url}`
        
        let parentRes = await this._queryFull(parentId)
        if (parentRes) {
          parentId = this._getParent(parentRes)
        } else {
          break
        }
      }

      return `\\SNOMED-CT\\${url}`
    } catch (error) {
      console.error('[SNOMED API] Resolve failed:', error)
      return null
    }
  }

  /**
   * Extract parent concept ID from relationships (like original _get_parent function)
   * @private
   * @param {Object} conceptData - Full concept data with relationships (FHIR format)
   * @returns {number|undefined} Parent concept ID
   */
  _getParent(conceptData) {
    if (!conceptData || !conceptData.relationships) return undefined
    
    const relationships = conceptData.relationships
    if (relationships.length > 0) {
      // Get the first parent's destination ID (like original implementation)
      const destinationId = relationships[0].destinationId
      // Convert to number for consistency with original implementation
      return typeof destinationId === 'string' ? parseInt(destinationId) : destinationId
    } else {
      return undefined
    }
  }

  /**
   * Get concept descriptions (synonyms) 
   * @param {string} conceptId - SNOMED CT concept ID
   * @returns {Promise<Array>} Array of descriptions
   */
  async getConceptDescriptions(conceptId) {
    try {
      // Use FHIR CodeSystem $lookup with includeDesignations
      const url = `${this.endpoints.fhirBase}/CodeSystem/$lookup`
      const params = {
        'system': 'http://snomed.info/sct',
        'code': conceptId.toString(),
        'includeDesignations': 'true'
      }
      
      const response = await axios.get(url, { 
        ...this.defaultConfig,
        params
      })

      if (response && response.data && response.data.parameter) {
        const result = this.transformFhirLookupResult(response.data)
        return {
          success: true,
          data: result.designations || [],
          conceptId
        }
      } else {
        return {
          success: true,
          data: [],
          conceptId
        }
      }
    } catch (error) {
      console.error('[SNOMED API] Get descriptions failed:', error)
      return {
        success: false,
        error: this.handleApiError(error).message,
        data: [],
        conceptId
      }
    }
  }

  /**
   * Transform FHIR ValueSet expansion results to standardized format
   * @private
   * @param {Array} concepts - Array of concept objects from FHIR expansion
   * @returns {Array} Transformed concept results
   */
  transformFhirResults(concepts) {
    return concepts.map(concept => ({
      code: concept.code,
      display: concept.display,
      preferredTerm: concept.display,
      fsn: concept.display, // FHIR doesn't separate FSN in expansion
      active: true, // FHIR expansion only returns active concepts by default
      sourceSystem: 'SNOMED-CT',
      system: concept.system
    }))
  }

  /**
   * Transform FHIR CodeSystem lookup result to standardized format
   * @private
   * @param {Object} lookupResult - FHIR Parameters resource from $lookup
   * @returns {Object} Transformed concept details
   */
  transformFhirLookupResult(lookupResult) {
    const result = {
      code: null,
      display: null,
      preferredTerm: null,
      fsn: null,
      active: true,
      sourceSystem: 'SNOMED-CT',
      designations: []
    }

    // Extract parameters from FHIR response
    if (lookupResult.parameter) {
      lookupResult.parameter.forEach(param => {
        switch (param.name) {
          case 'code':
            result.code = param.valueCode
            break
          case 'display':
            result.display = param.valueString
            result.preferredTerm = param.valueString
            break
          case 'designation':
            if (param.part) {
              const designation = {}
              param.part.forEach(part => {
                if (part.name === 'value') designation.value = part.valueString
                if (part.name === 'use') designation.use = part.valueCoding
              })
              result.designations.push(designation)
              
              // Check if this is FSN
              if (designation.use?.code === '900000000000003001') {
                result.fsn = designation.value
              }
            }
            break
        }
      })
    }

    return result
  }

  /**
   * Transform FHIR lookup result to old API format for compatibility with path resolution
   * @private
   * @param {Object} fhirResult - FHIR Parameters resource
   * @returns {Object} Old format compatible object
   */
  transformFhirLookupToOldFormat(fhirResult) {
    const result = {
      conceptId: null,
      relationships: []
    }

    if (fhirResult.parameter) {
      fhirResult.parameter.forEach(param => {
        if (param.name === 'code') {
          result.conceptId = param.valueCode
        }
        if (param.name === 'property' && param.part) {
          // Handle property parameters that contain parent relationships
          const propCode = param.part.find(p => p.name === 'code')?.valueCode
          const propValue = param.part.find(p => p.name === 'value')?.valueCode
          
          if (propCode === 'parent' && propValue) {
            // Create relationship in old format (use string like FHIR returns)
            result.relationships.push({
              destinationId: propValue, // Keep as string initially
              type: 'IS-A'
            })
          }
        }
      })
    }

    return result
  }

  /**
   * Transform description search results from API format to standardized format
   * @private
   * @param {Array} descriptions - Array of description objects from API
   * @returns {Array} Transformed concept results
   */
  transformDescriptionResults(descriptions) {
    // Group descriptions by concept to avoid duplicates
    const conceptMap = new Map()
    
    descriptions.forEach(desc => {
      const conceptId = desc.concept?.conceptId || desc.conceptId
      if (!conceptId) return
      
      if (!conceptMap.has(conceptId)) {
        conceptMap.set(conceptId, {
          code: conceptId,
          display: desc.term,
          preferredTerm: desc.term,
          fsn: null,
          active: desc.concept?.active !== false,
          module: desc.concept?.module?.conceptId,
          definitionStatus: desc.concept?.definitionStatus?.conceptId,
          sourceSystem: 'SNOMED-CT',
          effectiveTime: desc.concept?.effectiveTime,
          released: desc.concept?.released,
          descriptions: [desc]
        })
      } else {
        // Add additional descriptions for the same concept
        const existing = conceptMap.get(conceptId)
        existing.descriptions.push(desc)
        
        // Use FSN if this description is FSN
        if (desc.type?.conceptId === '900000000000003001') {
          existing.fsn = desc.term
        }
        
        // Use preferred term if this is PT
        if (desc.type?.conceptId === '900000000000013009') {
          existing.preferredTerm = desc.term
          existing.display = desc.term
        }
      }
    })
    
    return Array.from(conceptMap.values())
  }

  /**
   * Transform concept results from API format to standardized format
   * @private
   */
  transformConceptResults(concepts) {
    return concepts.map(concept => ({
      code: concept.conceptId || concept.id,
      display: concept.pt?.term || concept.preferredTerm || concept.fsn?.term || concept.name,
      fsn: concept.fsn?.term || concept.fullySpecifiedName,
      preferredTerm: concept.pt?.term || concept.preferredTerm,
      active: concept.active !== false,
      module: concept.module?.conceptId || concept.moduleId,
      definitionStatus: concept.definitionStatus?.conceptId || concept.definitionStatusId,
      sourceSystem: 'SNOMED-CT',
      // Additional metadata
      effectiveTime: concept.effectiveTime,
      released: concept.released,
      releasedEffectiveTime: concept.releasedEffectiveTime
    }))
  }

  /**
   * Transform concept details from API format
   * @private
   */
  transformConceptDetails(concept) {
    return {
      code: concept.conceptId || concept.id,
      display: concept.pt?.term || concept.preferredTerm,
      fsn: concept.fsn?.term || concept.fullySpecifiedName,
      active: concept.active !== false,
      module: concept.module?.conceptId || concept.moduleId,
      definitionStatus: concept.definitionStatus?.conceptId || concept.definitionStatusId,
      descriptions: concept.descriptions?.items || concept.descriptions || [],
      relationships: concept.relationships?.items || concept.relationships || [],
      sourceSystem: 'SNOMED-CT'
    }
  }

  /**
   * Handle API errors and provide meaningful error messages
   * @private
   */
  handleApiError(error) {
    if (error.response) {
      const status = error.response.status
      const statusText = error.response.statusText
      
      switch (status) {
        case 400:
          return new Error('Invalid search parameters provided to SNOMED CT API')
        case 401:
          return new Error('SNOMED CT API authentication failed - check API key')
        case 403:
          return new Error('Access denied to SNOMED CT API - insufficient permissions')
        case 404:
          return new Error('SNOMED CT API endpoint not found')
        case 429:
          return new Error('SNOMED CT API rate limit exceeded - please try again later')
        case 500:
          return new Error('SNOMED CT API server error - please try again later')
        default:
          return new Error(`SNOMED CT API error: ${status} ${statusText}`)
      }
    } else if (error.request) {
      return new Error('Cannot connect to SNOMED CT API - check your internet connection')
    } else {
      return error
    }
  }

  /**
   * Alias for searchConcepts to match original API structure
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options  
   * @returns {Promise<Object>} Search results
   */
  async queryby_string(searchTerm, options = {}) {
    return this.searchConcepts(searchTerm, options)
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      // Try a simple search to test connectivity
      const result = await this.searchConcepts('diabetes', { limit: 1 })
      return {
        success: result.success,
        message: result.success ? 'SNOMED CT API connection successful' : 'SNOMED CT API connection failed',
        endpoint: this.endpoints.fhirBase
      }
    } catch (error) {
      return {
        success: false,
        message: `SNOMED CT API connection failed: ${error.message}`,
        endpoint: this.endpoints.fhirBase
      }
    }
  }

  /**
   * Get API information and capabilities
   * @returns {Promise<Object>} API information
   */
  async getApiInfo() {
    try {
      // Test with a simple query to verify endpoint availability
      const testResult = await this.testConnection()
      return {
        success: testResult.success,
        data: {
          message: testResult.message,
          endpoints: this.endpoints,
          version: 'SNOMED CT International Edition via FHIR R4'
        },
        endpoint: this.endpoints.fhirBase
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        endpoint: this.endpoints.fhirBase
      }
    }
  }
}

// Create singleton instance
const snomedApiService = new SnomedApiService()

// Export convenience functions that match original API structure
export const resolve = (snomedId) => snomedApiService.resolve(snomedId)
export const query = (snomedId) => snomedApiService.query(snomedId) 
export const queryby_string = (searchTerm) => snomedApiService.searchConcepts(searchTerm)

export default snomedApiService
export { SnomedApiService }
