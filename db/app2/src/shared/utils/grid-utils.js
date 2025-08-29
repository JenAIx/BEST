/**
 * Data Grid Utilities
 * Shared utility functions specific to data grid functionality
 */

/**
 * Get CSS classes for a grid cell based on its state
 * @param {Object} row - Table row data
 * @param {Object} concept - Concept definition
 * @param {boolean} highlightChanges - Whether to highlight changes
 * @param {boolean} compactView - Whether to use compact view
 * @returns {Object} CSS class object
 */
export const getCellClass = (row, concept, highlightChanges = true, compactView = false) => {
  const key = `${row.patientId}-${row.encounterNum}-${concept.code}`
  const hasChange = row.pendingChanges?.has(key)
  const hasValue = !!row.observations[concept.code]

  return {
    'has-value': hasValue,
    'empty-cell': !hasValue,
    'has-pending-change': hasChange && highlightChanges,
    compact: compactView,
  }
}

/**
 * Check if a table row has unsaved changes
 * @param {Object} row - Table row data
 * @param {Array} concepts - Array of concept definitions
 * @param {boolean} highlightChanges - Whether to highlight changes
 * @returns {boolean} True if row has changes
 */
export const hasRowChanges = (row, concepts, highlightChanges = true) => {
  if (!highlightChanges) return false

  return concepts.some((concept) => {
    const key = `${row.patientId}-${row.encounterNum}-${concept.code}`
    return row.pendingChanges?.has(key)
  })
}

/**
 * Get display value for a cell
 * @param {Object} row - Table row data
 * @param {Object} concept - Concept definition
 * @returns {string} Display value
 */
export const getCellValue = (row, concept) => {
  const obs = row.observations[concept.code]
  return obs?.value || ''
}

/**
 * Get observation ID for a cell
 * @param {Object} row - Table row data
 * @param {Object} concept - Concept definition
 * @returns {number|null} Observation ID or null
 */
export const getCellObservationId = (row, concept) => {
  const obs = row.observations[concept.code]
  return obs?.observationId || null
}

/**
 * Format patient name from patient object (grid-specific)
 * @param {Object} patient - Patient database object
 * @returns {string} Formatted patient name
 */
export const getPatientNameFromGridData = (patient) => {
  if (!patient) return 'Unknown Patient'

  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      if (blob.name) return blob.name
      if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
    } catch {
      // Fallback to PATIENT_CD
    }
  }
  return patient.PATIENT_CD || 'Unknown Patient'
}

/**
 * Clean and validate patient IDs for batch operations
 * @param {Array} patientIds - Array of patient IDs (can be objects or strings)
 * @returns {Array} Array of clean string patient IDs
 */
export const cleanPatientIds = (patientIds) => {
  if (!patientIds || !Array.isArray(patientIds)) return []

  return patientIds
    .map((id) => {
      // Handle case where id might be an object with an id property
      if (typeof id === 'object' && id.id) {
        return String(id.id)
      }
      return String(id)
    })
    .filter((id) => id && id.trim().length > 0)
}

/**
 * Create a unique key for tracking cell changes
 * @param {string} patientId - Patient ID
 * @param {number} encounterNum - Encounter number
 * @param {string} conceptCode - Concept code
 * @returns {string} Unique change key
 */
export const createChangeKey = (patientId, encounterNum, conceptCode) => {
  return `${patientId}-${encounterNum}-${conceptCode}`
}

/**
 * Parse change key back to components
 * @param {string} key - Change key in format "patientId-encounterNum-conceptCode"
 * @returns {Object} Object with patientId, encounterNum, conceptCode
 */
export const parseChangeKey = (key) => {
  const parts = key.split('-')
  if (parts.length < 3) return null

  const conceptCode = parts.slice(2).join('-') // Handle concept codes with dashes
  return {
    patientId: parts[0],
    encounterNum: parseInt(parts[1]),
    conceptCode,
  }
}

/**
 * Get default view options for the data grid
 * @returns {Object} Default view options
 */
export const getDefaultViewOptions = () => {
  return {
    showEmptyCells: true,
    compactView: false,
    highlightChanges: true,
  }
}

/**
 * Validate view options object
 * @param {Object} options - View options to validate
 * @returns {Object} Validated view options
 */
export const validateViewOptions = (options) => {
  const defaults = getDefaultViewOptions()
  return {
    showEmptyCells: typeof options.showEmptyCells === 'boolean' ? options.showEmptyCells : defaults.showEmptyCells,
    compactView: typeof options.compactView === 'boolean' ? options.compactView : defaults.compactView,
    highlightChanges: typeof options.highlightChanges === 'boolean' ? options.highlightChanges : defaults.highlightChanges,
  }
}
