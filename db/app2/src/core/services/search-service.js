/**
 * Advanced Search Service for Clinical Data
 * 
 * Features:
 * - Multi-repository search across patients, visits, observations, notes, and providers
 * - Complex query building with multiple criteria
 * - Advanced filtering and sorting
 * - Date range filtering
 * - Pagination support
 * - Search result aggregation and statistics
 * - Performance optimization for large datasets
 */

export class SearchService {
  constructor(
    patientRepository,
    visitRepository,
    observationRepository,
    noteRepository,
    providerRepository,
    conceptRepository
  ) {
    this.patientRepository = patientRepository
    this.visitRepository = visitRepository
    this.observationRepository = observationRepository
    this.noteRepository = noteRepository
    this.providerRepository = providerRepository
    this.conceptRepository = conceptRepository
  }

  /**
   * Search patients with advanced criteria
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.searchTerm - Text search across patient fields
   * @param {string} criteria.sex - Gender filter
   * @param {Object} criteria.ageRange - Age range filter {min, max}
   * @param {string} criteria.vitalStatus - Vital status filter
   * @param {Object} criteria.dateRange - Date range filter {start, end}
   * @param {Object} criteria.pagination - Pagination options {page, pageSize}
   * @param {Array} criteria.sortBy - Sort fields [{field, direction}]
   * @returns {Object} Search results with pagination
   */
  async searchPatients(criteria = {}) {
    try {
      const {
        searchTerm,
        sex,
        ageRange,
        vitalStatus,
        dateRange,
        pagination = { page: 1, pageSize: 20 },
        sortBy = [{ field: 'PATIENT_NUM', direction: 'ASC' }]
      } = criteria

      // Build search criteria object
      const searchCriteria = {}
      
      if (sex) searchCriteria.sex = sex
      if (vitalStatus) searchCriteria.vitalStatus = vitalStatus
      if (ageRange) searchCriteria.ageRange = ageRange
      if (dateRange) searchCriteria.dateRange = dateRange

      // Perform search
      let results
      try {
        if (searchTerm) {
          if (typeof this.patientRepository.searchPatients === 'function') {
            results = await this.patientRepository.searchPatients(searchTerm)
          } else {
            throw new Error('Patient search method not available')
          }
        } else {
          if (typeof this.patientRepository.findPatientsByCriteria === 'function') {
            results = await this.patientRepository.findPatientsByCriteria(searchCriteria)
          } else {
            results = await this.patientRepository.findAll()
          }
        }
      } catch (error) {
        console.error('Patient search failed:', error)
        throw error // Re-throw the original error to preserve the message
      }

      // Apply sorting
      if (sortBy && sortBy.length > 0) {
        results = this.sortResults(results, sortBy)
      }

      // Apply pagination
      const paginatedResults = this.applyPagination(results, pagination)

      return {
        success: true,
        data: paginatedResults.data,
        pagination: paginatedResults.pagination,
        totalCount: results.length,
        searchCriteria: criteria
      }
    } catch (error) {
      console.error('Patient search failed:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, pageSize: 20, totalPages: 0 },
        totalCount: 0
      }
    }
  }

  /**
   * Search visits with advanced criteria
   * @param {Object} criteria - Search criteria
   * @param {number} criteria.patientNum - Patient number filter
   * @param {string} criteria.locationCode - Location filter
   * @param {string} criteria.inoutCode - In/Out status filter
   * @param {Object} criteria.dateRange - Date range filter {start, end}
   * @param {string} criteria.activeStatus - Active status filter
   * @param {Object} criteria.pagination - Pagination options
   * @returns {Object} Search results with pagination
   */
  async searchVisits(criteria = {}) {
    try {
      const {
        patientNum,
        locationCode,
        inoutCode,
        dateRange,
        activeStatus,
        pagination = { page: 1, pageSize: 20 }
      } = criteria

      let results = []

      // Build search based on criteria
      if (patientNum) {
        results = await this.visitRepository.findByPatientNum(patientNum)
      } else if (locationCode) {
        results = await this.visitRepository.findByLocationCode(locationCode)
      } else if (dateRange) {
        results = await this.visitRepository.findByDateRange(
          dateRange.start,
          dateRange.end
        )
      } else if (activeStatus) {
        if (activeStatus === 'active') {
          results = await this.visitRepository.findActiveVisits()
        } else {
          results = await this.visitRepository.findAll()
        }
      } else {
        results = await this.visitRepository.findAll()
      }

      // Apply additional filters
      if (inoutCode) {
        results = results.filter(visit => visit.INOUT_CD === inoutCode)
      }

      // Apply pagination
      const paginatedResults = this.applyPagination(results, pagination)

      return {
        success: true,
        data: paginatedResults.data,
        pagination: paginatedResults.pagination,
        totalCount: results.length,
        searchCriteria: criteria
      }
    } catch (error) {
      console.error('Visit search failed:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, pageSize: 20, totalPages: 0 },
        totalCount: 0
      }
    }
  }

  /**
   * Search observations with advanced criteria
   * @param {Object} criteria - Search criteria
   * @param {number} criteria.patientNum - Patient number filter
   * @param {number} criteria.encounterNum - Visit/encounter filter
   * @param {string} criteria.conceptCode - Concept code filter
   * @param {string} criteria.valueType - Value type filter (N, T, B, D)
   * @param {Object} criteria.valueRange - Numeric value range {min, max}
   * @param {Object} criteria.dateRange - Date range filter {start, end}
   * @param {Object} criteria.pagination - Pagination options
   * @returns {Object} Search results with pagination
   */
  async searchObservations(criteria = {}) {
    try {
      const {
        patientNum,
        encounterNum,
        conceptCode,
        valueType,
        valueRange,
        dateRange,
        pagination = { page: 1, pageSize: 20 }
      } = criteria

      let results = []

      // Build search based on criteria
      if (patientNum) {
        results = await this.observationRepository.findByPatientNum(patientNum)
      } else if (encounterNum) {
        results = await this.observationRepository.findByVisitNum(encounterNum)
      } else if (conceptCode) {
        results = await this.observationRepository.findByConceptCode(conceptCode)
      } else if (valueType) {
        results = await this.observationRepository.findByValueType(valueType)
      } else if (dateRange) {
        results = await this.observationRepository.findByDateRange(
          dateRange.start,
          dateRange.end
        )
      } else {
        results = await this.observationRepository.findAll()
      }

      // Apply additional filters
      if (valueRange && valueType === 'N') {
        results = results.filter(obs => 
          obs.NVAL_NUM >= valueRange.min && obs.NVAL_NUM <= valueRange.max
        )
      }

      // Apply pagination
      const paginatedResults = this.applyPagination(results, pagination)

      return {
        success: true,
        data: paginatedResults.data,
        pagination: paginatedResults.pagination,
        totalCount: results.length,
        searchCriteria: criteria
      }
    } catch (error) {
      console.error('Observation search failed:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, pageSize: 20, totalPages: 0 },
        totalCount: 0
      }
    }
  }

  /**
   * Search notes with advanced criteria
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.searchTerm - Text search in note content
   * @param {string} criteria.category - Note category filter
   * @param {number} criteria.patientNum - Patient number filter
   * @param {Object} criteria.dateRange - Date range filter {start, end}
   * @param {Object} criteria.pagination - Pagination options
   * @returns {Object} Search results with pagination
   */
  async searchNotes(criteria = {}) {
    try {
      const {
        searchTerm,
        category,
        patientNum,
        dateRange,
        pagination = { page: 1, pageSize: 20 }
      } = criteria

      let results = []

      // Build search based on criteria
      if (searchTerm) {
        results = await this.noteRepository.searchNotes(searchTerm)
      } else if (category) {
        results = await this.noteRepository.findByCategory(category)
      } else if (patientNum) {
        // Assuming note repository has findByPatientNum method
        results = await this.noteRepository.findByPatientNum(patientNum)
      } else {
        results = await this.noteRepository.findAll()
      }

      // Apply date range filter if specified
      if (dateRange) {
        results = results.filter(note => {
          const noteDate = new Date(note.CREATED_AT || note.UPDATE_DATE)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          return noteDate >= startDate && noteDate <= endDate
        })
      }

      // Apply pagination
      const paginatedResults = this.applyPagination(results, pagination)

      return {
        success: true,
        data: paginatedResults.data,
        pagination: paginatedResults.pagination,
        totalCount: results.length,
        searchCriteria: criteria
      }
    } catch (error) {
      console.error('Note search failed:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, pageSize: 20, totalPages: 0 },
        totalCount: 0
      }
    }
  }

  /**
   * Search providers with advanced criteria
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.searchTerm - Text search in provider fields
   * @param {string} criteria.specialty - Specialty filter
   * @param {string} criteria.organization - Organization filter
   * @param {Object} criteria.pagination - Pagination options
   * @returns {Object} Search results with pagination
   */
  async searchProviders(criteria = {}) {
    try {
      const {
        searchTerm,
        specialty,
        organization,
        pagination = { page: 1, pageSize: 20 }
      } = criteria

      let results = []

      // Build search based on criteria
      if (searchTerm) {
        // Assuming provider repository has search method
        results = await this.providerRepository.searchProviders(searchTerm)
      } else if (specialty) {
        results = await this.providerRepository.findBySpecialty(specialty)
      } else {
        results = await this.providerRepository.findAll()
      }

      // Apply organization filter if specified
      if (organization) {
        results = results.filter(provider => 
          provider.ORGANIZATION_CD === organization
        )
      }

      // Apply pagination
      const paginatedResults = this.applyPagination(results, pagination)

      return {
        success: true,
        data: paginatedResults.data,
        pagination: paginatedResults.pagination,
        totalCount: results.length,
        searchCriteria: criteria
      }
    } catch (error) {
      console.error('Provider search failed:', error)
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { page: 1, pageSize: 20, totalPages: 0 },
        totalCount: 0
      }
    }
  }

  /**
   * Build complex queries with multiple criteria
   * @param {Object} searchParams - Complex search parameters
   * @returns {Object} Structured search query
   */
  buildComplexQueries(searchParams) {
    const query = {
      patients: null,
      visits: null,
      observations: null,
      notes: null,
      providers: null,
      crossReferences: []
    }

    // Extract patient-based criteria
    if (searchParams.patientCriteria) {
      query.patients = this.buildPatientQuery(searchParams.patientCriteria)
    }

    // Extract visit-based criteria
    if (searchParams.visitCriteria) {
      query.visits = this.buildVisitQuery(searchParams.visitCriteria)
    }

    // Extract observation-based criteria
    if (searchParams.observationCriteria) {
      query.observations = this.buildObservationQuery(searchParams.observationCriteria)
    }

    // Build cross-references
    if (searchParams.crossReference) {
      query.crossReferences = this.buildCrossReferences(searchParams.crossReference)
    }

    return query
  }

  /**
   * Apply date range filters to queries
   * @param {Object} query - Base query object
   * @param {Object} dateRange - Date range {start, end}
   * @returns {Object} Modified query with date filters
   */
  applyDateRangeFilters(query, dateRange) {
    if (!dateRange || (!dateRange.start && !dateRange.end)) {
      return query
    }

    const modifiedQuery = { ...query }

    // Add date filters to relevant parts of the query
    if (modifiedQuery.visits) {
      modifiedQuery.visits.dateRange = dateRange
    }

    if (modifiedQuery.observations) {
      modifiedQuery.observations.dateRange = dateRange
    }

    if (modifiedQuery.notes) {
      modifiedQuery.notes.dateRange = dateRange
    }

    return modifiedQuery
  }

  /**
   * Execute complex search across multiple repositories
   * @param {Object} complexQuery - Complex search query
   * @returns {Object} Aggregated search results
   */
  async executeComplexSearch(complexQuery) {
    try {
      const results = {
        patients: [],
        visits: [],
        observations: [],
        notes: [],
        providers: [],
        summary: {
          totalPatients: 0,
          totalVisits: 0,
          totalObservations: 0,
          totalNotes: 0,
          totalProviders: 0
        }
      }

      // Execute searches in parallel
      const searchPromises = []

      if (complexQuery.patients) {
        searchPromises.push(
          this.searchPatients(complexQuery.patients).then(result => {
            if (result.success) {
              results.patients = result.data
              results.summary.totalPatients = result.totalCount
            } else {
              // If search failed, throw error to trigger catch
              throw new Error(result.error || 'Patient search failed')
            }
          }).catch(error => {
            console.error('Patient search failed:', error)
            throw error
          })
        )
      }

      if (complexQuery.visits) {
        searchPromises.push(
          this.searchVisits(complexQuery.visits).then(result => {
            if (result.success) {
              results.visits = result.data
              results.summary.totalVisits = result.totalCount
            }
          }).catch(error => {
            console.error('Visit search failed:', error)
            throw error
          })
        )
      }

      if (complexQuery.observations) {
        searchPromises.push(
          this.searchObservations(complexQuery.observations).then(result => {
            if (result.success) {
              results.observations = result.data
              results.summary.totalObservations = result.totalCount
            }
          }).catch(error => {
            console.error('Observation search failed:', error)
            throw error
          })
        )
      }

      if (complexQuery.notes) {
        searchPromises.push(
          this.searchNotes(complexQuery.notes).then(result => {
            if (result.success) {
              results.notes = result.data
              results.summary.totalNotes = result.totalCount
            }
          }).catch(error => {
            console.error('Note search failed:', error)
            throw error
          })
        )
      }

      if (complexQuery.providers) {
        searchPromises.push(
          this.searchProviders(complexQuery.providers).then(result => {
            if (result.success) {
              results.providers = result.data
              results.summary.totalProviders = result.totalCount
            }
          }).catch(error => {
            console.error('Provider search failed:', error)
            throw error
          })
        )
      }

      // Wait for all searches to complete
      try {
        await Promise.all(searchPromises)
      } catch (error) {
        console.error('Complex search failed:', error)
        return {
          success: false,
          error: error.message,
          results: {},
          query: complexQuery
        }
      }

      return {
        success: true,
        results,
        query: complexQuery,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Complex search failed:', error)
      return {
        success: false,
        error: error.message,
        results: {},
        query: complexQuery
      }
    }
  }

  /**
   * Get search statistics and analytics
   * @param {Object} searchCriteria - Search criteria used
   * @returns {Object} Search statistics
   */
  async getSearchStatistics(searchCriteria) {
    try {
      const stats = {
        totalResults: 0,
        resultBreakdown: {},
        searchPerformance: {},
        commonPatterns: []
      }

      // Calculate total results across all repositories
      if (searchCriteria.patients) {
        const patientResults = await this.searchPatients(searchCriteria.patients)
        if (patientResults.success) {
          stats.totalResults += patientResults.totalCount
          stats.resultBreakdown.patients = patientResults.totalCount
        }
      }

      if (searchCriteria.visits) {
        const visitResults = await this.searchVisits(searchCriteria.visits)
        if (visitResults.success) {
          stats.totalResults += visitResults.totalCount
          stats.resultBreakdown.visits = visitResults.totalCount
        }
      }

      if (searchCriteria.observations) {
        const observationResults = await this.searchObservations(searchCriteria.observations)
        if (observationResults.success) {
          stats.totalResults += observationResults.totalCount
          stats.resultBreakdown.observations = observationResults.totalCount
        }
      }

      return {
        success: true,
        statistics: stats,
        searchCriteria
      }
    } catch (error) {
      console.error('Search statistics failed:', error)
      return {
        success: false,
        error: error.message,
        statistics: {}
      }
    }
  }

  // Private helper methods

  /**
   * Build patient query from criteria
   * @private
   */
  buildPatientQuery(criteria) {
    return {
      sex: criteria.sex,
      ageRange: criteria.ageRange,
      vitalStatus: criteria.vitalStatus,
      searchTerm: criteria.searchTerm
    }
  }

  /**
   * Build visit query from criteria
   * @private
   */
  buildVisitQuery(criteria) {
    return {
      locationCode: criteria.locationCode,
      inoutCode: criteria.inoutCode,
      activeStatus: criteria.activeStatus,
      dateRange: criteria.dateRange
    }
  }

  /**
   * Build observation query from criteria
   * @private
   */
  buildObservationQuery(criteria) {
    return {
      conceptCode: criteria.conceptCode,
      valueType: criteria.valueType,
      valueRange: criteria.valueRange,
      dateRange: criteria.dateRange
    }
  }

  /**
   * Build cross-references between entities
   * @private
   */
  buildCrossReferences(crossRefCriteria) {
    return crossRefCriteria.map(ref => ({
      fromEntity: ref.from,
      toEntity: ref.to,
      relationship: ref.relationship,
      conditions: ref.conditions
    }))
  }

  /**
   * Sort results by multiple fields
   * @private
   */
  sortResults(results, sortBy) {
    return results.sort((a, b) => {
      for (const sort of sortBy) {
        const { field, direction } = sort
        const aVal = a[field]
        const bVal = b[field]

        if (aVal < bVal) return direction === 'ASC' ? -1 : 1
        if (aVal > bVal) return direction === 'ASC' ? 1 : -1
      }
      return 0
    })
  }

  /**
   * Apply pagination to results
   * @private
   */
  applyPagination(results, pagination) {
    // Validate and normalize pagination parameters
    let { page = 1, pageSize = 20 } = pagination
    
    // Ensure valid page and pageSize
    page = Math.max(1, Math.floor(page) || 1)
    pageSize = Math.max(1, Math.floor(pageSize) || 20)
    
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const totalPages = Math.ceil(results.length / pageSize)

    return {
      data: results.slice(startIndex, endIndex),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalCount: results.length,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    }
  }
}

export default SearchService
