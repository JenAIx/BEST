/**
 * Observation Transformer Utility
 *
 * Handles transformation and formatting of observation data.
 * Separates data transformation logic from state management.
 */

// Logger can be injected if needed for debugging
// import { createLogger } from 'src/core/services/logging-service'
// const logger = createLogger('ObservationTransformer')

/**
 * Group observations by visit
 * @param {Array} observations - All observations
 * @param {Array} visits - All visits
 * @returns {Array} Grouped observations by visit
 */
export function groupObservationsByVisit(observations, visits) {
  // Start with all visits as the base
  const groups = visits.map((visit) => ({
    encounterNum: visit.id,
    visitDate: visit.date,
    endDate: visit.endDate,
    visit: {
      ENCOUNTER_NUM: visit.id,
      START_DATE: visit.date,
      END_DATE: visit.endDate,
      UPDATE_DATE: visit.last_changed,
      ACTIVE_STATUS_CD: visit.status,
      LOCATION_CD: visit.location,
      INOUT_CD: visit.inout || 'O',
      SOURCESYSTEM_CD: visit.rawData?.SOURCESYSTEM_CD || 'SYSTEM',
      VISIT_BLOB: visit.rawData?.VISIT_BLOB,
      visitType: visit.visitType,
      notes: visit.notes,
      id: visit.id,
    },
    observations: [],
  }))

  // Add observations to their respective visits
  observations.forEach((obs) => {
    const group = groups.find((g) => g.encounterNum === obs.encounterNum)
    if (group) {
      group.observations.push(transformObservationForTable(obs))
    }
  })

  // Sort groups by visit start date (most recent first)
  return groups.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
}

/**
 * Transform observation for table display
 * @param {Object} observation - Raw observation data
 * @returns {Object} Transformed observation
 */
export function transformObservationForTable(observation) {
  return {
    observationId: observation.observationId,
    conceptCode: observation.conceptCode,
    conceptName: observation.conceptName,
    valueType: observation.valueType,
    valTypeCode: observation.valueType,
    originalValue: observation.originalValue,
    value: observation.originalValue,
    tval_char: observation.originalValue,
    TVAL_CHAR: observation.originalValue,
    nval_num: observation.valueType === 'N' ? observation.originalValue : null,
    NVAL_NUM: observation.valueType === 'N' ? observation.originalValue : null,
    observation_blob: observation.rawData?.OBSERVATION_BLOB,
    OBSERVATION_BLOB: observation.rawData?.OBSERVATION_BLOB,
    resolvedValue: observation.resolvedValue,
    unit: observation.unit,
    category: observation.category,
    CATEGORY_CHAR: observation.category,
    date: observation.date,
    START_DATE: observation.date,
    encounterNum: observation.encounterNum,
    ENCOUNTER_NUM: observation.encounterNum,
  }
}

/**
 * Create table row from observation
 * @param {Object} observation - Observation data
 * @param {Map} pendingChanges - Map of pending changes
 * @returns {Object} Table row
 */
export function createTableRow(observation, pendingChanges = new Map()) {
  const rowId = `obs_${observation.observationId}`
  const actualValue = extractObservationValue(observation)
  const pendingValue = pendingChanges.get(rowId)

  return {
    id: rowId,
    observationId: observation.observationId,
    conceptCode: observation.conceptCode,
    conceptName: observation.conceptName,
    resolvedName: observation.conceptName,
    valueType: observation.valueType,
    origVal: actualValue,
    currentVal: pendingValue !== undefined ? pendingValue : actualValue,
    unit: observation.unit,
    category: observation.category,
    hasChanges: pendingValue !== undefined && pendingValue !== actualValue,
    saving: false,
    previousValue: null,
    displayValue: formatDisplayValue(observation),
    isMedication: observation.valueType === 'M' || observation.conceptCode?.includes('52418'),
    rawObservation: observation,
  }
}

/**
 * Extract the actual value from observation data
 * @param {Object} observation - Observation data
 * @returns {*} Extracted value
 */
export function extractObservationValue(observation) {
  const valType = observation.valueType || 'T'

  switch (valType) {
    case 'N': {
      // Numeric
      const numericValue = observation.nval_num || observation.NVAL_NUM
      if (numericValue !== null && numericValue !== undefined) {
        return numericValue
      }
      return observation.tval_char || observation.TVAL_CHAR || observation.originalValue || ''
    }
    case 'M': // Medication
      return observation.observation_blob || observation.OBSERVATION_BLOB || observation.tval_char || observation.TVAL_CHAR || observation.originalValue || ''
    case 'R': // Raw data/File
      return observation.observation_blob || observation.OBSERVATION_BLOB || observation.originalValue || ''
    default: // Text and others
      return observation.tval_char || observation.TVAL_CHAR || observation.originalValue || ''
  }
}

/**
 * Format observation value for display
 * @param {Object} observation - Observation data
 * @returns {string} Formatted display value
 */
export function formatDisplayValue(observation) {
  switch (observation.valueType) {
    case 'S': // Selection
    case 'F': // Finding
    case 'A': // Array/Multiple choice
      return observation.resolvedValue || observation.originalValue || 'No value'

    case 'Q': // Questionnaire
      return observation.originalValue || 'Questionnaire'

    case 'R': // Raw data/File
      try {
        if (observation.originalValue) {
          const fileInfo = JSON.parse(observation.originalValue)
          return fileInfo.filename || 'File attached'
        }
      } catch {
        return 'Invalid file data'
      }
      break

    case 'N': // Numeric
      return observation.originalValue?.toString() || 'No value'

    case 'M': // Medication
      return observation.originalValue || 'No medication specified'

    default: // Text and others
      return observation.originalValue || 'No value'
  }
}

/**
 * Prepare update data based on value type
 * @param {string} valueType - Value type code
 * @param {*} value - New value
 * @returns {Object} Update data for database
 */
export function prepareUpdateData(valueType, value) {
  const updateData = {}

  switch (valueType) {
    case 'N': // Numeric
      updateData.NVAL_NUM = parseFloat(value)
      updateData.TVAL_CHAR = null
      updateData.OBSERVATION_BLOB = null
      break

    case 'S': // Selection
    case 'F': // Finding
    case 'A': // Array/Multiple choice
      updateData.TVAL_CHAR = String(value)
      updateData.NVAL_NUM = null
      updateData.OBSERVATION_BLOB = null
      break

    case 'R': // Raw data/File
      updateData.OBSERVATION_BLOB = value
      updateData.TVAL_CHAR = null
      updateData.NVAL_NUM = null
      break

    case 'T': // Text
    default:
      updateData.TVAL_CHAR = String(value)
      updateData.NVAL_NUM = null
      updateData.OBSERVATION_BLOB = null
      break
  }

  return updateData
}

/**
 * Sort table rows by category and concept name
 * @param {Array} rows - Table rows
 * @returns {Array} Sorted rows
 */
export function sortTableRows(rows) {
  return rows.sort((a, b) => {
    // Sort by category first, then by concept name
    const categoryA = a.category || 'ZZZZZ'
    const categoryB = b.category || 'ZZZZZ'
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB)
    }
    return a.conceptName.localeCompare(b.conceptName)
  })
}

/**
 * Get unique categories from observations
 * @param {Array} observations - Observations array
 * @returns {Array} Category options
 */
export function getCategoryOptions(observations) {
  const categories = [...new Set(observations.map((obs) => obs.category).filter(Boolean))]
  return categories.map((cat) => ({ label: cat, value: cat }))
}

/**
 * Filter observations based on criteria
 * @param {Array} observations - Observations to filter
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered observations
 */
export function filterObservations(observations, { text, category, valueType }) {
  let filtered = [...observations]

  if (text) {
    const searchTerm = text.toLowerCase()
    filtered = filtered.filter(
      (obs) =>
        (obs.conceptName && obs.conceptName.toLowerCase().includes(searchTerm)) ||
        (obs.conceptCode && obs.conceptCode.toLowerCase().includes(searchTerm)) ||
        (obs.originalValue && String(obs.originalValue).toLowerCase().includes(searchTerm)) ||
        (obs.category && obs.category.toLowerCase().includes(searchTerm)),
    )
  }

  if (category) {
    filtered = filtered.filter((obs) => obs.category === category)
  }

  if (valueType) {
    filtered = filtered.filter((obs) => {
      if (valueType === 'numeric') {
        return obs.numericValue !== null && obs.numericValue !== undefined
      } else if (valueType === 'text') {
        return obs.value && obs.value.trim() !== ''
      } else if (valueType === 'empty') {
        return !obs.numericValue && (!obs.value || obs.value.trim() === '')
      } else {
        return obs.valueType === valueType
      }
    })
  }

  return filtered
}

/**
 * Detect if observation is likely a medication
 * @param {Object} observation - Observation data
 * @returns {boolean} True if medication-related
 */
export function isMedicationObservation(observation) {
  return observation.valueType === 'M' || observation.conceptCode?.includes('52418') || observation.category?.toLowerCase().includes('medication')
}
