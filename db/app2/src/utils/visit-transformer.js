/**
 * Visit Transformer Utility
 *
 * Handles transformation and formatting of visit data.
 * Separates data transformation logic from state management.
 */

import { formatDate } from 'src/shared/utils/medical-utils'
import { createLogger } from 'src/core/services/logging-service'

const logger = createLogger('VisitTransformer')

/**
 * Transform database visit to UI format
 * @param {Object} dbVisit - Database visit record
 * @param {number} observationCount - Number of observations for this visit
 * @returns {Object} Transformed visit
 */
export function transformDatabaseVisit(dbVisit, observationCount = 0) {
  // Parse VISIT_BLOB to extract visitType and notes
  let visitType = 'routine'
  let visitNotes = ''

  if (dbVisit.VISIT_BLOB) {
    try {
      const blobData = JSON.parse(dbVisit.VISIT_BLOB)
      visitType = blobData.visitType || 'routine'
      visitNotes = blobData.notes || ''
    } catch (error) {
      logger.warn('Failed to parse VISIT_BLOB', error, {
        visitBlob: dbVisit.VISIT_BLOB,
      })
      visitNotes = dbVisit.VISIT_BLOB // Fallback to raw blob
    }
  }

  return {
    id: dbVisit.ENCOUNTER_NUM,
    date: dbVisit.START_DATE,
    last_changed: dbVisit.UPDATE_DATE,
    endDate: dbVisit.END_DATE,
    inout: dbVisit.INOUT_CD || 'O',
    location: dbVisit.LOCATION_CD,
    status: dbVisit.ACTIVE_STATUS_CD || 'completed',
    visitType: visitType,
    notes: visitNotes,
    observationCount,
    // Include raw data for components that need it
    rawData: {
      ENCOUNTER_NUM: dbVisit.ENCOUNTER_NUM,
      START_DATE: dbVisit.START_DATE,
      END_DATE: dbVisit.END_DATE,
      UPDATE_DATE: dbVisit.UPDATE_DATE,
      ACTIVE_STATUS_CD: dbVisit.ACTIVE_STATUS_CD,
      LOCATION_CD: dbVisit.LOCATION_CD,
      INOUT_CD: dbVisit.INOUT_CD,
      SOURCESYSTEM_CD: dbVisit.SOURCESYSTEM_CD,
      VISIT_BLOB: dbVisit.VISIT_BLOB,
    },
  }
}

/**
 * Prepare visit data for database creation
 * @param {number} patientNum - Patient number
 * @param {Object} visitData - Visit form data
 * @param {string} providerId - Provider user code
 * @returns {Object} Database-ready visit data
 */
export function prepareVisitForCreation(patientNum, visitData, providerId = 'SYSTEM') {
  const currentTimestamp = new Date().toISOString()

  return {
    PATIENT_NUM: patientNum,
    START_DATE: visitData.date || new Date().toISOString().split('T')[0],
    END_DATE: visitData.endDate || null,
    UPDATE_DATE: currentTimestamp,
    INOUT_CD: visitData.inout || (visitData.type === 'emergency' ? 'E' : 'O'),
    ACTIVE_STATUS_CD: visitData.status || 'SCTID: 55561003', // Active (SNOMED-CT)
    LOCATION_CD: visitData.location || 'CLINIC',
    SOURCESYSTEM_CD: 'SYSTEM',
    VISIT_BLOB: JSON.stringify({
      notes: visitData.notes || '',
      visitType: visitData.visitType || visitData.type || 'routine',
      createdBy: providerId,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    }),
  }
}

/**
 * Prepare visit data for database update
 * @param {Object} visitData - Visit form data
 * @param {Object} originalVisit - Original visit data
 * @returns {Object} Database-ready update data
 */
export function prepareVisitForUpdate(visitData, originalVisit) {
  const currentTimestamp = new Date().toISOString()
  const updateData = {}

  // Only include changed fields
  if (visitData.date !== undefined && visitData.date !== originalVisit.START_DATE) {
    updateData.START_DATE = visitData.date
  }

  if (visitData.endDate !== undefined && visitData.endDate !== originalVisit.END_DATE) {
    updateData.END_DATE = visitData.endDate
  }

  if (visitData.status !== undefined && visitData.status !== originalVisit.ACTIVE_STATUS_CD) {
    updateData.ACTIVE_STATUS_CD = visitData.status
  }

  if (visitData.location !== undefined && visitData.location !== originalVisit.LOCATION_CD) {
    updateData.LOCATION_CD = visitData.location
  }

  if (visitData.inout !== undefined && visitData.inout !== originalVisit.INOUT_CD) {
    updateData.INOUT_CD = visitData.inout
  }

  // Always update timestamp
  updateData.UPDATE_DATE = currentTimestamp

  // Handle VISIT_BLOB updates
  if (visitData.notes !== undefined || visitData.visitType !== undefined) {
    let blobData = {}

    // Parse existing blob if exists
    if (originalVisit.VISIT_BLOB) {
      try {
        blobData = JSON.parse(originalVisit.VISIT_BLOB)
      } catch {
        blobData = {}
      }
    }

    // Update blob fields
    if (visitData.notes !== undefined) {
      blobData.notes = visitData.notes
    }

    if (visitData.visitType !== undefined) {
      blobData.visitType = visitData.visitType
    }

    blobData.updatedAt = currentTimestamp

    updateData.VISIT_BLOB = JSON.stringify(blobData)
  }

  return updateData
}

/**
 * Create visit options for dropdown
 * @param {Array} visits - Array of visits
 * @returns {Array} Visit options
 */
export function createVisitOptions(visits) {
  if (!visits || visits.length === 0) {
    return []
  }

  return visits.map((visit) => ({
    id: visit.id,
    label: formatDate(visit.date),
    summary: `${visit.visitType} • ${visit.observationCount || 0} observations`,
    value: visit,
  }))
}

/**
 * Get visit type from INOUT_CD
 * @param {string} inoutCd - Inpatient/Outpatient code
 * @returns {string} Visit type
 */
export function getVisitTypeFromInoutCd(inoutCd) {
  switch (inoutCd) {
    case 'I':
      return 'inpatient'
    case 'E':
      return 'emergency'
    case 'O':
    default:
      return 'outpatient'
  }
}

/**
 * Get INOUT_CD from visit type
 * @param {string} visitType - Visit type
 * @returns {string} Inpatient/Outpatient code
 */
export function getInoutCdFromVisitType(visitType) {
  switch (visitType) {
    case 'inpatient':
      return 'I'
    case 'emergency':
      return 'E'
    case 'outpatient':
    default:
      return 'O'
  }
}

/**
 * Parse visit notes from VISIT_BLOB
 * @param {string} visitBlob - VISIT_BLOB JSON string
 * @returns {string} Parsed notes
 */
export function parseVisitNotes(visitBlob) {
  if (!visitBlob) return ''

  try {
    const parsed = JSON.parse(visitBlob)
    return parsed.notes || parsed.description || ''
  } catch {
    // If not JSON, return as-is
    return visitBlob || ''
  }
}

/**
 * Format visit summary text
 * @param {Object} visit - Visit object
 * @returns {string} Formatted summary
 */
export function formatVisitSummary(visit) {
  const date = formatDate(visit.date)
  const type = visit.visitType || 'Visit'
  const location = visit.location || 'Unknown location'
  const obsCount = visit.observationCount || 0

  return `${type} on ${date} at ${location} (${obsCount} observations)`
}

/**
 * Prepare visit clone data
 * @param {Object} originalVisit - Visit to clone
 * @param {number} patientNum - Patient number
 * @param {string} providerId - Provider user code
 * @returns {Object} Database-ready clone data
 */
export function prepareVisitClone(originalVisit, patientNum, providerId = 'SYSTEM') {
  const currentTimestamp = new Date().toISOString()

  return {
    PATIENT_NUM: patientNum,
    START_DATE: new Date().toISOString().split('T')[0],
    END_DATE: originalVisit.endDate || null,
    UPDATE_DATE: currentTimestamp,
    INOUT_CD: originalVisit.inout || 'O',
    ACTIVE_STATUS_CD: originalVisit.status || 'SCTID: 55561003',
    LOCATION_CD: originalVisit.location || 'CLINIC',
    SOURCESYSTEM_CD: 'SYSTEM',
    VISIT_BLOB: JSON.stringify({
      notes: `Cloned from visit on ${formatDate(originalVisit.date)}`,
      visitType: originalVisit.visitType || 'routine',
      originalVisit: originalVisit.id,
      createdBy: providerId,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    }),
  }
}
