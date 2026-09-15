/**
 * Patient Repository
 * Handles all database operations for patient entities
 * Extends BaseRepository with patient-specific functionality
 */

import BaseRepository from './base-repository.js'
import { resolveAccessMode } from '../../../shared/utils/patient-access.js'

class PatientRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'PATIENT_DIMENSION', 'PATIENT_NUM')
    // Use patient_list view for queries that need resolved concept codes
    this.viewName = 'patient_list'
  }

  /**
   * Find patient by patient code (PATIENT_CD)
   * @param {string} patientCode - Patient code
   * @returns {Promise<Object|null>} - Found patient or null
   */
  async findByPatientCode(patientCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PATIENT_CD = ?`
    const result = await this.connection.executeQuery(sql, [patientCode])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find patient by patient code with resolved concepts
   * @param {string} patientCode - Patient code
   * @returns {Promise<Object|null>} - Found patient with resolved concept names or null
   */
  async findByPatientCodeWithConcepts(patientCode) {
    const sql = `SELECT * FROM ${this.viewName} WHERE PATIENT_CD = ?`
    const result = await this.connection.executeQuery(sql, [patientCode])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * The single source of the user-access predicate used by every filtered
   * patient query. A regular user sees a patient when USER_PATIENT_LOOKUP
   * links the patient to them OR to the public user (USER_ID = 0).
   *
   * Returns null for admins or when NO context object is passed (system
   * callers, no filtering). A context object WITHOUT a user id yields a
   * deny-all filter (fail closed). USER_ID 0 (`public`) is a regular user.
   * Otherwise returns the JOIN fragment (expects the patient table aliased
   * as `p`), the WHERE condition, and its parameter.
   *
   * @param {{userId: number, isAdmin: boolean}|null} userAccess
   * @returns {{join: string, condition: string, param: number}|null}
   */
  getAccessFilter(userAccess) {
    const mode = resolveAccessMode(userAccess)
    if (mode === 'unfiltered') return null
    if (mode === 'deny') {
      // Fail closed: a context object without a user id must see nothing.
      return {
        join: 'INNER JOIN USER_PATIENT_LOOKUP upl ON p.PATIENT_NUM = upl.PATIENT_NUM',
        condition: '(1 = 0 AND upl.USER_ID = ?)',
        param: -1,
      }
    }
    return {
      join: 'INNER JOIN USER_PATIENT_LOOKUP upl ON p.PATIENT_NUM = upl.PATIENT_NUM',
      condition: '(upl.USER_ID = ? OR upl.USER_ID = 0)',
      param: userAccess.userId,
    }
  }

  /**
   * Access predicate for an arbitrary PATIENT_NUM column (no JOIN needed) —
   * for aggregate/COUNT queries on VISIT_DIMENSION, OBSERVATION_FACT etc.
   * Same fail-closed semantics as getAccessFilter.
   *
   * @param {{userId: number|null, isAdmin: boolean}|null} userAccess
   * @param {string} [patientNumExpr='PATIENT_NUM']
   * @returns {{sql: string, params: Array}|null} null = no filtering
   */
  getAccessPredicate(userAccess, patientNumExpr = 'PATIENT_NUM') {
    const mode = resolveAccessMode(userAccess)
    if (mode === 'unfiltered') return null
    if (mode === 'deny') return { sql: '1 = 0', params: [] }
    return {
      sql: `${patientNumExpr} IN (SELECT PATIENT_NUM FROM USER_PATIENT_LOOKUP WHERE USER_ID = ? OR USER_ID = 0)`,
      params: [userAccess.userId],
    }
  }

  /**
   * Every dashboard counter in ONE round trip (scalar subqueries).
   *
   * All counters are access-filtered for regular users, so the tiles agree
   * with the (filtered) patient list underneath them. `hiddenPatients` is the
   * only unfiltered number: total minus accessible.
   *
   * Dates are compared as half-open text ranges (`>= day AND < nextDay`) —
   * START_DATE ('YYYY-MM-DD') and UPDATE_DATE ('YYYY-MM-DD HH:MM:SS') are ISO
   * text, so this stays index-friendly, unlike `DATE(col) = ?`.
   *
   * @param {{userId: number|null, isAdmin: boolean}|null} userAccess
   * @param {string} todayIso - 'YYYY-MM-DD'
   */
  async getDashboardStatistics(userAccess, todayIso) {
    const day = todayIso || new Date().toISOString().slice(0, 10)
    const next = new Date(`${day}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    const nextDay = next.toISOString().slice(0, 10)

    const access = this.getAccessPredicate(userAccess)
    const params = []
    const sub = (sql, subParams = []) => {
      params.push(...subParams)
      return `(${sql})`
    }
    const filtered = (base, extra = null, extraParams = []) => {
      const clauses = [extra, access?.sql].filter(Boolean)
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
      return sub(base + where, [...extraParams, ...(access?.params || [])])
    }
    const userId = userAccess?.userId
    const hasUser = userId !== undefined && userId !== null

    const sql = `SELECT
      ${filtered(`SELECT COUNT(*) FROM ${this.tableName}`)} AS totalPatients,
      ${filtered('SELECT COUNT(*) FROM VISIT_DIMENSION')} AS totalVisits,
      ${filtered('SELECT COUNT(*) FROM OBSERVATION_FACT')} AS totalObservations,
      ${filtered('SELECT COUNT(DISTINCT PATIENT_NUM) FROM VISIT_DIMENSION', 'START_DATE >= ? AND START_DATE < ?', [day, nextDay])} AS patientsSeenToday,
      ${filtered('SELECT COUNT(*) FROM VISIT_DIMENSION', 'START_DATE >= ? AND START_DATE < ?', [day, nextDay])} AS visitsToday,
      ${filtered('SELECT COUNT(*) FROM OBSERVATION_FACT', 'UPDATE_DATE >= ? AND UPDATE_DATE < ?', [day, nextDay])} AS observationsToday,
      ${filtered('SELECT COUNT(*) FROM OBSERVATION_FACT', "VALUEFLAG_CD = 'AUDIT'")} AS openAudits,
      ${hasUser ? sub(`SELECT COUNT(DISTINCT upl.PATIENT_NUM) FROM USER_PATIENT_LOOKUP upl JOIN ${this.tableName} p ON p.PATIENT_NUM = upl.PATIENT_NUM WHERE upl.USER_ID = ?`, [userId]) : '0'} AS myPatients,
      ${sub(`SELECT COUNT(*) FROM ${this.tableName}`)} AS allPatients`

    const result = await this.connection.executeQuery(sql, params)
    const row = (result.success && result.data[0]) || {}
    const n = (v) => Number(v) || 0
    const totalPatients = n(row.totalPatients)
    const allPatients = n(row.allPatients)
    return {
      totalPatients,
      totalVisits: n(row.totalVisits),
      totalObservations: n(row.totalObservations),
      patientsSeenToday: n(row.patientsSeenToday),
      visitsToday: n(row.visitsToday),
      observationsToday: n(row.observationsToday),
      openAudits: n(row.openAudits),
      myPatients: n(row.myPatients),
      // accessible vs. hidden — identical to total for admins (nothing hidden)
      visiblePatients: totalPatients,
      hiddenPatients: Math.max(0, allPatients - totalPatients),
    }
  }

  /**
   * Find patient by code with user access control (patient_list view).
   * Regular users only get the patient if it is assigned to them or to the
   * public user (USER_ID = 0) in USER_PATIENT_LOOKUP; admins (or missing user
   * context) get the unfiltered lookup. Use this for every UI-facing lookup —
   * findByPatientCode stays unfiltered for internal checks (e.g. createPatient
   * duplicate detection).
   *
   * @param {string} patientCode - Patient code
   * @param {{userId: number, isAdmin: boolean}|null} userAccess - User access context
   * @returns {Promise<Object|null>} - Found patient or null (not found OR access denied)
   */
  async findAccessiblePatientByCode(patientCode, userAccess = null) {
    const access = this.getAccessFilter(userAccess)
    const sql = access
      ? `SELECT DISTINCT p.* FROM ${this.viewName} p ${access.join} WHERE p.PATIENT_CD = ? AND ${access.condition}`
      : `SELECT * FROM ${this.viewName} WHERE PATIENT_CD = ?`
    const params = access ? [patientCode, access.param] : [patientCode]
    const result = await this.connection.executeQuery(sql, params)
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Batch variant of findAccessiblePatientByCode on PATIENT_DIMENSION (raw rows,
   * no concept resolution) — used by the data grid's stored-selection loader.
   * Inaccessible codes are silently dropped from the result.
   *
   * @param {string[]} patientCodes
   * @param {{userId: number, isAdmin: boolean}|null} userAccess
   * @param {{fromView?: boolean}} [options] - fromView: read from patient_list
   *   (resolved SEX/STATUS labels, computed age) instead of the raw table
   * @returns {Promise<Array>}
   */
  async findAccessiblePatientsByCodes(patientCodes, userAccess = null, { fromView = false } = {}) {
    if (!Array.isArray(patientCodes) || patientCodes.length === 0) return []
    const placeholders = patientCodes.map(() => '?').join(',')
    const access = this.getAccessFilter(userAccess)
    const source = fromView ? this.viewName : this.tableName
    const sql = access
      ? `SELECT DISTINCT p.* FROM ${source} p ${access.join} WHERE p.PATIENT_CD IN (${placeholders}) AND ${access.condition}`
      : `SELECT * FROM ${source} WHERE PATIENT_CD IN (${placeholders})`
    const params = access ? [...patientCodes, access.param] : patientCodes
    const result = await this.connection.executeQuery(sql, params)
    return result.success ? result.data : []
  }

  /**
   * Find patients by vital status
   * @param {string} vitalStatus - Vital status code
   * @returns {Promise<Array>} - Array of patients
   */
  async findByVitalStatus(vitalStatus) {
    return await this.findByCriteria({ VITAL_STATUS_CD: vitalStatus })
  }

  /**
   * Find patients by sex
   * @param {string} sex - Sex code
   * @returns {Promise<Array>} - Array of patients
   */
  async findBySex(sex) {
    return await this.findByCriteria({ SEX_CD: sex })
  }

  /**
   * Find patients by age range
   * @param {number} minAge - Minimum age
   * @param {number} maxAge - Maximum age
   * @returns {Promise<Array>} - Array of patients
   */
  async findByAgeRange(minAge, maxAge) {
    const criteria = {
      AGE_IN_YEARS: {
        operator: 'BETWEEN',
        value: [minAge, maxAge],
      },
    }
    return await this.findByCriteria(criteria)
  }

  /**
   * Find patients by birth date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of patients
   */
  async findByBirthDateRange(startDate, endDate) {
    const criteria = {
      BIRTH_DATE: {
        operator: 'BETWEEN',
        value: [startDate, endDate],
      },
    }
    return await this.findByCriteria(criteria)
  }

  /**
   * Find patients by source system
   * @param {string} sourceSystem - Source system code
   * @returns {Promise<Array>} - Array of patients from source system
   */
  async findBySourceSystem(sourceSystem) {
    const sql = `SELECT * FROM ${this.tableName} WHERE SOURCESYSTEM_CD = ? ORDER BY CREATED_AT DESC`
    const result = await this.connection.executeQuery(sql, [sourceSystem])
    return result.success ? result.data : []
  }

  /**
   * Find patients by multiple criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of patients
   */
  async findPatientsByCriteria(criteria) {
    const searchCriteria = {}

    if (criteria.vitalStatus) {
      searchCriteria.VITAL_STATUS_CD = criteria.vitalStatus
    }

    if (criteria.sex) {
      searchCriteria.SEX_CD = criteria.sex
    }

    if (criteria.ageRange) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageRange.min, criteria.ageRange.max],
      }
    }

    if (criteria.birthDateRange) {
      searchCriteria.BIRTH_DATE = {
        operator: 'BETWEEN',
        value: [criteria.birthDateRange.start, criteria.birthDateRange.end],
      }
    }

    if (criteria.language) {
      searchCriteria.LANGUAGE_CD = criteria.language
    }

    if (criteria.race) {
      searchCriteria.RACE_CD = criteria.race
    }

    if (criteria.maritalStatus) {
      searchCriteria.MARITAL_STATUS_CD = criteria.maritalStatus
    }

    if (criteria.religion) {
      searchCriteria.RELIGION_CD = criteria.religion
    }

    if (criteria.location) {
      searchCriteria.STATECITYZIP_PATH = criteria.location
    }

    if (criteria.sourceSystem) {
      searchCriteria.SOURCESYSTEM_CD = criteria.sourceSystem
    }

    if (criteria.uploadId) {
      searchCriteria.UPLOAD_ID = criteria.uploadId
    }

    // Handle searchTerm by using the searchPatients method if provided
    if (criteria.searchTerm) {
      const searchResults = await this.searchPatients(criteria.searchTerm)
      // Apply additional filters to search results if any other criteria exist
      if (Object.keys(searchCriteria).length > 0) {
        return searchResults.filter((patient) => {
          // Apply filters to search results
          if (searchCriteria.VITAL_STATUS_CD && patient.VITAL_STATUS_CD !== searchCriteria.VITAL_STATUS_CD) return false
          if (searchCriteria.SEX_CD && patient.SEX_CD !== searchCriteria.SEX_CD) return false
          if (searchCriteria.AGE_IN_YEARS) {
            const age = patient.AGE_IN_YEARS
            if (age < searchCriteria.AGE_IN_YEARS.value[0] || age > searchCriteria.AGE_IN_YEARS.value[1]) return false
          }
          if (searchCriteria.STATECITYZIP_PATH && !patient.STATECITYZIP_PATH?.includes(searchCriteria.STATECITYZIP_PATH)) return false
          if (searchCriteria.SOURCESYSTEM_CD && patient.SOURCESYSTEM_CD !== searchCriteria.SOURCESYSTEM_CD) return false
          if (searchCriteria.UPLOAD_ID && patient.UPLOAD_ID !== searchCriteria.UPLOAD_ID) return false
          return true
        })
      }
      return searchResults
    }

    return await this.findByCriteria(searchCriteria, criteria.options)
  }

  /**
   * Find patients by multiple criteria with resolved concept names
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of patients with resolved concepts
   */
  async findPatientsByCriteriaWithConcepts(criteria) {
    const searchCriteria = {}

    // Preserve user access control
    if (criteria._userAccess) {
      searchCriteria._userAccess = criteria._userAccess
    }

    if (criteria.VITAL_STATUS_CD) {
      searchCriteria.VITAL_STATUS_CD = criteria.VITAL_STATUS_CD
    }

    if (criteria.SEX_CD) {
      searchCriteria.SEX_CD = criteria.SEX_CD
    }

    if (criteria.ageRange) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageRange.min, criteria.ageRange.max],
      }
    }

    if (criteria.ageMin !== undefined || criteria.ageMax !== undefined) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageMin ?? 0, criteria.ageMax ?? 120],
      }
    }

    if (criteria.birthDateRange) {
      searchCriteria.BIRTH_DATE = {
        operator: 'BETWEEN',
        value: [criteria.birthDateRange.start, criteria.birthDateRange.end],
      }
    }

    if (criteria.language) {
      searchCriteria.LANGUAGE_CD = criteria.language
    }

    if (criteria.race) {
      searchCriteria.RACE_CD = criteria.race
    }

    if (criteria.maritalStatus) {
      searchCriteria.MARITAL_STATUS_CD = criteria.maritalStatus
    }

    if (criteria.religion) {
      searchCriteria.RELIGION_CD = criteria.religion
    }

    if (criteria.location) {
      searchCriteria.STATECITYZIP_PATH = criteria.location
    }

    if (criteria.sourceSystem) {
      searchCriteria.SOURCESYSTEM_CD = criteria.sourceSystem
    }

    if (criteria.uploadId) {
      searchCriteria.UPLOAD_ID = criteria.uploadId
    }

    // Handle patient number filtering (e.g., for study enrollment)
    if (criteria.patientNums && Array.isArray(criteria.patientNums) && criteria.patientNums.length > 0) {
      searchCriteria.PATIENT_NUM = {
        operator: 'IN',
        value: criteria.patientNums,
      }
    }

    // Handle searchTerm with view-based search
    if (criteria.searchTerm) {
      const otherCriteria = { ...searchCriteria }
      delete otherCriteria._userAccess // Don't include _userAccess in filter logic
      const hasOtherCriteria = Object.keys(otherCriteria).length > 0
      const limit = criteria.options?.limit
      const offset = criteria.options?.offset || 0

      // Plain text search: page in SQL. With extra criteria the filters run in
      // JS, so fetch the full match list and slice afterwards.
      const searchResults = await this.searchPatientsWithConcepts(criteria.searchTerm, criteria._userAccess, hasOtherCriteria ? {} : { limit, offset })

      if (hasOtherCriteria) {
        const filtered = searchResults.filter((patient) => {
          // Apply filters to search results
          // Filter by patient numbers (for study enrollment)
          if (otherCriteria.PATIENT_NUM && otherCriteria.PATIENT_NUM.operator === 'IN') {
            if (!otherCriteria.PATIENT_NUM.value.includes(patient.PATIENT_NUM)) return false
          }
          if (otherCriteria.VITAL_STATUS_CD && patient.VITAL_STATUS_CD !== otherCriteria.VITAL_STATUS_CD) return false
          if (otherCriteria.SEX_CD && patient.SEX_CD !== otherCriteria.SEX_CD) return false
          if (otherCriteria.AGE_IN_YEARS && otherCriteria.AGE_IN_YEARS.operator === 'BETWEEN') {
            const age = patient.AGE_IN_YEARS
            // Skip patients with null/undefined age if age filter is active
            if (age == null) return false
            if (age < otherCriteria.AGE_IN_YEARS.value[0] || age > otherCriteria.AGE_IN_YEARS.value[1]) return false
          }
          if (otherCriteria.STATECITYZIP_PATH && !patient.STATECITYZIP_PATH?.includes(otherCriteria.STATECITYZIP_PATH)) return false
          return true
        })
        return Number.isInteger(limit) && limit > 0 ? filtered.slice(offset, offset + limit) : filtered
      }
      return searchResults
    }

    // Use view-based query with resolved concepts
    return await this.findByCriteriaFromView(searchCriteria, criteria.options)
  }

  /**
   * WHERE fragment shared by the text search and its COUNT.
   *
   * Targets: PATIENT_CD, PATIENT_BLOB (the only name carrier) and
   * STATECITYZIP_PATH. The former six `*_RESOLVED LIKE ?` targets were dropped
   * (Sept 2026): "male"/"alive"/"German" matched almost every patient and each
   * one was an unindexable leading-wildcard scan over the view.
   *
   * @returns {{from: string, where: string, params: Array}} — expects the view
   *   aliased as `p` (both the access JOIN and the criteria use that alias)
   */
  _buildSearchQuery(searchTerm, userAccess) {
    const searchPattern = `%${searchTerm}%`
    const access = this.getAccessFilter(userAccess)
    const from = `FROM ${this.viewName} p${access ? `\n        ${access.join}` : ''}`
    const textMatch = '(p.PATIENT_CD LIKE ? OR p.PATIENT_BLOB LIKE ? OR p.STATECITYZIP_PATH LIKE ?)'
    const where = access ? `WHERE ${access.condition} AND ${textMatch}` : `WHERE ${textMatch}`
    const params = access ? [access.param, searchPattern, searchPattern, searchPattern] : [searchPattern, searchPattern, searchPattern]
    return { from, where, params, distinct: !!access }
  }

  /**
   * Search patients with resolved concepts by text (name, code, location)
   * @param {string} searchTerm - Search term
   * @param {Object} userAccess - User access control (optional)
   * @param {{limit?: number, offset?: number}} [options] - page window; without
   *   a limit the full match list is returned (callers that post-filter in JS)
   * @returns {Promise<Array>} - Array of matching patients with resolved concepts
   */
  async searchPatientsWithConcepts(searchTerm, userAccess = null, options = {}) {
    const { from, where, params, distinct } = this._buildSearchQuery(searchTerm, userAccess)
    let sql = `
        SELECT ${distinct ? 'DISTINCT ' : ''}p.*
        ${from}
        ${where}
        ORDER BY p.PATIENT_CD`
    const queryParams = [...params]
    if (Number.isInteger(options.limit) && options.limit > 0) {
      sql += '\n        LIMIT ? OFFSET ?'
      queryParams.push(options.limit, Number.isInteger(options.offset) && options.offset > 0 ? options.offset : 0)
    }

    const result = await this.connection.executeQuery(sql, queryParams)
    return result.success ? result.data : []
  }

  /**
   * COUNT for the text search — same WHERE as searchPatientsWithConcepts, no rows.
   */
  async countSearchPatientsWithConcepts(searchTerm, userAccess = null) {
    const { from, where, params } = this._buildSearchQuery(searchTerm, userAccess)
    const result = await this.connection.executeQuery(`SELECT COUNT(DISTINCT p.PATIENT_NUM) as count ${from} ${where}`, params)
    return result.success ? result.data[0]?.count || 0 : 0
  }

  /**
   * Find by criteria using the patient_list view
   * @param {Object} searchCriteria - Search criteria object
   * @param {Object} options - Query options (limit, offset, orderBy, etc.)
   * @returns {Promise<Array>} - Array of patients with resolved concepts
   */
  async findByCriteriaFromView(searchCriteria, options = {}) {
    const conditions = []
    const params = []

    // Extract user access control (if present)
    const userAccess = searchCriteria._userAccess
    delete searchCriteria._userAccess // Remove from actual search criteria

    // Build base query with user access control FIRST (to know if we need table alias)
    let sql
    let tableAlias = ''
    const access = this.getAccessFilter(userAccess)

    if (access) {
      tableAlias = 'p.'
      sql = `
        SELECT DISTINCT p.*
        FROM ${this.viewName} p
        ${access.join}
      `
      conditions.push(access.condition)
      params.push(access.param)
    } else {
      // Admin or no user context - show all
      sql = `SELECT * FROM ${this.viewName}`
    }

    // Build WHERE clause (with table alias if needed)
    for (const [field, value] of Object.entries(searchCriteria)) {
      if (value !== undefined && value !== null) {
        const fieldName = tableAlias ? `${tableAlias}${field}` : field

        if (typeof value === 'object' && value.operator) {
          // Handle special operators like BETWEEN, IN, etc.
          if (value.operator === 'BETWEEN' && Array.isArray(value.value) && value.value.length === 2) {
            // For age filtering, exclude NULL values explicitly
            if (field === 'AGE_IN_YEARS') {
              conditions.push(`${fieldName} IS NOT NULL AND ${fieldName} BETWEEN ? AND ?`)
            } else {
              conditions.push(`${fieldName} BETWEEN ? AND ?`)
            }
            params.push(value.value[0], value.value[1])
          } else if (value.operator === 'IN' && Array.isArray(value.value)) {
            const placeholders = value.value.map(() => '?').join(', ')
            conditions.push(`${fieldName} IN (${placeholders})`)
            params.push(...value.value)
          } else if (value.operator === 'LIKE') {
            conditions.push(`${fieldName} LIKE ?`)
            params.push(value.value)
          }
        } else {
          // Simple equality check
          conditions.push(`${fieldName} = ?`)
          params.push(value)
        }
      }
    }

    // Add WHERE clause
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add ORDER BY with special handling for UPDATE_DATE_WITH_FALLBACK
    let orderBy = options.orderBy || 'PATIENT_CD'
    const orderDirection = options.orderDirection || 'ASC'

    if (orderBy === 'UPDATE_DATE_WITH_FALLBACK') {
      // Use UPDATE_DATE as default, IMPORT_DATE as fallback
      if (tableAlias) {
        // If we have a table alias (user filter), prefix both fields
        orderBy = `COALESCE(${tableAlias}UPDATE_DATE, ${tableAlias}IMPORT_DATE)`
      } else {
        // No alias, use as-is
        orderBy = 'COALESCE(UPDATE_DATE, IMPORT_DATE)'
      }
    } else if (tableAlias && !orderBy.includes('(')) {
      // Only add alias if orderBy is a simple field name (not a function/expression)
      orderBy = `${tableAlias}${orderBy}`
    }

    sql += ` ORDER BY ${orderBy} ${orderDirection}`

    // Add LIMIT and OFFSET
    if (options.limit) {
      sql += ` LIMIT ?`
      params.push(options.limit)

      if (options.offset) {
        sql += ` OFFSET ?`
        params.push(options.offset)
      }
    }

    const result = await this.connection.executeQuery(sql, params)
    return result.success ? result.data : []
  }

  /**
   * Create a new patient with validation
   * @param {Object} patientData - Patient data
   * @returns {Promise<Object>} - Created patient
   */
  async createPatient(patientData) {
    // Validate required fields
    if (!patientData.PATIENT_CD) {
      throw new Error('PATIENT_CD is required')
    }

    // Check if patient already exists
    const existingPatient = await this.findByPatientCode(patientData.PATIENT_CD)
    if (existingPatient) {
      throw new Error(`Patient with code ${patientData.PATIENT_CD} already exists`)
    }

    // Add audit fields
    const now = new Date().toISOString()
    const patient = {
      ...patientData,
      IMPORT_DATE: patientData.IMPORT_DATE || now,
      UPDATE_DATE: now,
      CREATED_AT: now,
      UPDATED_AT: now,
    }

    // Create the patient
    const createdPatient = await this.create(patient)

    // If lastID is undefined, fetch the patient to get the actual ID
    if (createdPatient.PATIENT_NUM === undefined) {
      const fetchedPatient = await this.findByPatientCode(patientData.PATIENT_CD)
      if (fetchedPatient) {
        return { ...createdPatient, PATIENT_NUM: fetchedPatient.PATIENT_NUM }
      }
    }

    return createdPatient
  }

  /**
   * Update patient information
   * @param {string|number} patientId - Patient ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updatePatient(patientId, updateData) {
    // Add audit fields
    const updateInfo = {
      ...updateData,
      UPDATE_DATE: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    }

    return await this.update(patientId, updateInfo)
  }

  /**
   * Get patient statistics
   * @returns {Promise<Object>} - Patient statistics
   */
  async getPatientStatistics() {
    const stats = {}

    // Total patient count
    const totalResult = await this.connection.executeQuery(`SELECT COUNT(*) as total FROM ${this.tableName}`)
    stats.totalPatients = totalResult.success ? totalResult.data[0].total : 0

    // Count by vital status
    const vitalStatusResult = await this.connection.executeQuery(`SELECT VITAL_STATUS_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY VITAL_STATUS_CD`)
    stats.byVitalStatus = vitalStatusResult.success ? vitalStatusResult.data : []

    // Count by sex
    const sexResult = await this.connection.executeQuery(`SELECT SEX_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY SEX_CD`)
    stats.bySex = sexResult.success ? sexResult.data : []

    // Average age
    const ageResult = await this.connection.executeQuery(`SELECT AVG(AGE_IN_YEARS) as averageAge FROM ${this.tableName} WHERE AGE_IN_YEARS IS NOT NULL`)
    stats.averageAge = ageResult.success && ageResult.data[0].averageAge !== null && ageResult.data[0].averageAge !== undefined ? Math.round(ageResult.data[0].averageAge) : null

    return stats
  }

  /**
   * Search patients by text (name, code, location)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching patients
   */
  async searchPatients(searchTerm) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE PATIENT_CD LIKE ?
         OR PATIENT_BLOB LIKE ?
         OR STATECITYZIP_PATH LIKE ?
      ORDER BY PATIENT_CD
    `
    const searchPattern = `%${searchTerm}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern])

    return result.success ? result.data : []
  }

  /**
   * Get patients with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Page size
   * @param {Object} criteria - Search criteria
   * @param {{userId: number|null, isAdmin: boolean}|null} userAccess - auth
   *   context; null = system caller (unfiltered), see getAccessFilter
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getPatientsPaginated(page = 1, pageSize = 20, criteria = {}, userAccess = null) {
    const offset = (page - 1) * pageSize

    // Merge pagination options with any existing options
    const mergedOptions = {
      limit: pageSize,
      offset: offset,
      orderBy: 'PATIENT_CD',
      orderDirection: 'ASC',
      ...criteria.options,
    }

    // Add user access control to criteria
    const enhancedCriteria = {
      ...criteria,
      options: mergedOptions,
      _userAccess: userAccess,
    }

    const patients = await this.findPatientsByCriteriaWithConcepts(enhancedCriteria)

    // Callers that only render the first page (dashboard, SmartSearch, recents)
    // pass options.skipCount — the COUNT over the view is then not run at all.
    if (mergedOptions.skipCount === true) {
      return {
        patients,
        pagination: { currentPage: page, pageSize, totalCount: null, totalPages: null, hasNextPage: null, hasPreviousPage: page > 1 },
      }
    }

    // Filter out options from criteria for count query
    const countCriteria = { ...criteria, _userAccess: enhancedCriteria._userAccess }
    delete countCriteria.options
    const totalCount = await this.countByCriteriaFromView(countCriteria)
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      patients,
      pagination: {
        currentPage: page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    }
  }

  /**
   * Count patients by criteria using the patient_list view
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} - Total count
   */
  async countByCriteriaFromView(criteria = {}) {
    // Extract user access control
    const userAccess = criteria._userAccess
    delete criteria._userAccess

    // Convert criteria to searchCriteria format (same as findPatientsByCriteriaWithConcepts)
    const searchCriteria = {}

    if (criteria.VITAL_STATUS_CD) {
      searchCriteria.VITAL_STATUS_CD = criteria.VITAL_STATUS_CD
    }

    if (criteria.SEX_CD) {
      searchCriteria.SEX_CD = criteria.SEX_CD
    }

    if (criteria.ageRange) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageRange.min, criteria.ageRange.max],
      }
    }

    if (criteria.ageMin !== undefined || criteria.ageMax !== undefined) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageMin ?? 0, criteria.ageMax ?? 120],
      }
    }

    if (criteria.location) {
      searchCriteria.STATECITYZIP_PATH = criteria.location
    }

    if (criteria.patientNums && Array.isArray(criteria.patientNums) && criteria.patientNums.length > 0) {
      searchCriteria.PATIENT_NUM = {
        operator: 'IN',
        value: criteria.patientNums,
      }
    }

    // Handle searchTerm specially - it needs to search across multiple fields
    if (criteria.searchTerm) {
      if (Object.keys(searchCriteria).length > 0) {
        // If there are other criteria, we need to get the search results first
        // and then apply additional filters - this is more complex but accurate.
        // Pass userAccess so the count matches the access-filtered result list.
        const searchResults = await this.searchPatientsWithConcepts(criteria.searchTerm, userAccess)

        // Apply additional filters to search results
        const filteredResults = searchResults.filter((patient) => {
          // Filter by patient numbers (for study enrollment)
          if (searchCriteria.PATIENT_NUM && searchCriteria.PATIENT_NUM.operator === 'IN') {
            if (!searchCriteria.PATIENT_NUM.value.includes(patient.PATIENT_NUM)) return false
          }
          // Filter by gender
          if (searchCriteria.SEX_CD && patient.SEX_CD !== searchCriteria.SEX_CD) return false
          // Filter by vital status
          if (searchCriteria.VITAL_STATUS_CD && patient.VITAL_STATUS_CD !== searchCriteria.VITAL_STATUS_CD) return false
          // Filter by age range
          if (searchCriteria.AGE_IN_YEARS && searchCriteria.AGE_IN_YEARS.operator === 'BETWEEN') {
            const age = patient.AGE_IN_YEARS
            // Skip patients with null/undefined age if age filter is active
            if (age == null) return false
            if (age < searchCriteria.AGE_IN_YEARS.value[0] || age > searchCriteria.AGE_IN_YEARS.value[1]) return false
          }
          // Filter by location
          if (searchCriteria.STATECITYZIP_PATH && !patient.STATECITYZIP_PATH?.includes(searchCriteria.STATECITYZIP_PATH)) return false
          return true
        })

        return filteredResults.length
      } else {
        // Simple search count — same WHERE as the result list, but COUNT only
        return await this.countSearchPatientsWithConcepts(criteria.searchTerm, userAccess)
      }
    }

    // Handle non-search criteria
    const conditions = []
    const params = []

    // Regular users get a JOIN with USER_PATIENT_LOOKUP below — prefix criteria
    // columns with the view alias so shared column names (PATIENT_NUM, UPDATE_DATE)
    // don't become ambiguous.
    const access = this.getAccessFilter(userAccess)
    const tableAlias = access ? 'p.' : ''

    // Build WHERE clause for non-search criteria (using searchCriteria which has proper field names)
    for (const [field, value] of Object.entries(searchCriteria)) {
      if (value !== undefined && value !== null && value !== '') {
        const fieldName = `${tableAlias}${field}`
        if (typeof value === 'object' && value.operator) {
          // Handle special operators like BETWEEN, IN, etc.
          if (value.operator === 'BETWEEN' && Array.isArray(value.value) && value.value.length === 2) {
            // For age filtering, exclude NULL values explicitly
            if (field === 'AGE_IN_YEARS') {
              conditions.push(`${fieldName} IS NOT NULL AND ${fieldName} BETWEEN ? AND ?`)
            } else {
              conditions.push(`${fieldName} BETWEEN ? AND ?`)
            }
            params.push(value.value[0], value.value[1])
          } else if (value.operator === 'IN' && Array.isArray(value.value)) {
            const placeholders = value.value.map(() => '?').join(', ')
            conditions.push(`${fieldName} IN (${placeholders})`)
            params.push(...value.value)
          } else if (value.operator === 'LIKE') {
            conditions.push(`${fieldName} LIKE ?`)
            params.push(value.value)
          }
        } else {
          // Simple equality check
          conditions.push(`${fieldName} = ?`)
          params.push(value)
        }
      }
    }

    // Build count query using the view
    // Add user access control
    let sql
    if (access) {
      conditions.push(access.condition)
      params.push(access.param)

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      sql = `
        SELECT COUNT(DISTINCT p.PATIENT_NUM) as count
        FROM ${this.viewName} p
        ${access.join}
        ${whereClause}
      `
    } else {
      // Admin or no user context - show all
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      sql = `SELECT COUNT(*) as count FROM ${this.viewName} ${whereClause}`
    }

    const result = await this.connection.executeQuery(sql, params)
    return result.success && result.data.length > 0 ? result.data[0].count : 0
  }
}

export default PatientRepository
