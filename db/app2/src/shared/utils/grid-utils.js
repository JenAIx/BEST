/**
 * Data Grid Utilities
 * Shared utility functions specific to data grid functionality
 */

/**
 * Get CSS classes for a grid cell based on its state
 * @param {Object} row - Table row data
 * @param {Object} concept - Concept definition
 * @returns {Object} CSS class object
 */
export const getCellClass = (row, concept) => {
  const hasValue = !!row.observations[concept.code]

  return {
    'has-value': hasValue,
    'empty-cell': !hasValue,
  }
}

/**
 * Check if a table row has unsaved changes
 * @param {Object} row - Table row data
 * @param {Array} concepts - Array of concept definitions
 * @returns {boolean} True if row has changes
 */
export const hasRowChanges = (row, concepts) => {
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
 * Get the VALUEFLAG_CD for a cell (used by the audit workflow and stats).
 * @param {Object} row - Table row data
 * @param {Object} concept - Concept definition
 * @returns {string|null} VALUEFLAG_CD value (e.g. 'AUDIT', 'CONFIRMED', 'NV') or null
 */
export const getCellValueFlag = (row, concept) => {
  const obs = row.observations[concept.code]
  return obs?.valueFlag || null
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
 * Group an array of concepts by their CATEGORY_CHAR for two-level column headers.
 *
 * The order of categories follows clinical convention (demographics first, vitals
 * before labs, medications last). Concepts whose category is null/empty are bundled
 * under "Other". Within a group, concept order is preserved (alphabetical by
 * upstream caller).
 *
 * @param {Array<{code: string, name: string, valueType: string, category?: string|null}>} concepts
 * @returns {Array<{category: string, concepts: Array}>}
 */
export const groupConceptsByCategory = (concepts) => {
  if (!Array.isArray(concepts) || concepts.length === 0) return []

  const buckets = new Map()
  for (const c of concepts) {
    const cat = (c && c.category) || 'Other'
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat).push(c)
  }

  // Stable category ordering: well-known clinical categories first, the rest
  // alphabetical, "Other" always last so unclassified columns trail.
  const PREFERRED_ORDER = [
    'Demographics',
    'Vital Signs',
    'Stroke',
    'Diagnosis',
    'Assessment',
    'Clinical Scales',
    'Neurological Assessment',
    'Psychological Assessment',
    'Sleep Assessment',
    'Laboratory',
    'CSF Analysis',
    'Imaging',
    'Medications',
    'Social History',
    'Education',
    'General',
  ]
  const preferredIdx = (cat) => {
    const i = PREFERRED_ORDER.indexOf(cat)
    return i === -1 ? PREFERRED_ORDER.length : i
  }
  const sortedCats = [...buckets.keys()].sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    const ai = preferredIdx(a)
    const bi = preferredIdx(b)
    if (ai !== bi) return ai - bi
    return a.localeCompare(b)
  })

  return sortedCats.map((category) => ({ category, concepts: buckets.get(category) }))
}

/**
 * Get default view options for the data grid
 * @returns {Object} Default view options
 */
export const getDefaultViewOptions = () => {
  return {
    // Visit-type lock: cells whose concept is claimed by other visit types'
    // field sets (but not by the row's own visit type) render locked.
    visitTypeLockActive: false,
  }
}

/**
 * Validate view options object
 * @param {Object} options - Raw (possibly persisted) view options
 * @returns {Object} Validated view options
 */
export const validateViewOptions = (options = {}) => {
  return {
    visitTypeLockActive: options.visitTypeLockActive === true,
  }
}

/**
 * Build the visit-type lock map from CODE_LOOKUP rows.
 *
 * Inputs are the raw rows of CODE_LOOKUP(VISIT_DIMENSION/VISIT_TYPE_CD) and
 * CODE_LOOKUP(VISIT_DIMENSION/FIELD_SET_CD) — each with CODE_CD + LOOKUP_BLOB.
 * Only field sets referenced by at least one visit type participate ("explicitly
 * assigned"); orphan field sets never cause locks.
 *
 * @returns {{byVisitType: Map<string, {concepts: Set<string>, categories: Set<string>}>,
 *            claimedConcepts: Set<string>, claimedCategories: Set<string>}}
 */
export const buildVisitTypeLockMap = (visitTypeRows, fieldSetRows) => {
  const parseBlob = (blob) => {
    if (!blob) return null
    try {
      return typeof blob === 'string' ? JSON.parse(blob) : blob
    } catch {
      return null
    }
  }

  const fieldSetsById = new Map()
  for (const row of fieldSetRows || []) {
    const blob = parseBlob(row.LOOKUP_BLOB)
    if (!row.CODE_CD || !blob) continue
    fieldSetsById.set(row.CODE_CD, {
      concepts: Array.isArray(blob.concepts) ? blob.concepts : [],
      categories: Array.isArray(blob.categories) ? blob.categories : [],
    })
  }

  const byVisitType = new Map()
  const claimedConcepts = new Set()
  const claimedCategories = new Set()

  for (const row of visitTypeRows || []) {
    const blob = parseBlob(row.LOOKUP_BLOB)
    if (!row.CODE_CD || !blob || !Array.isArray(blob.fieldSets)) continue
    const allowed = { concepts: new Set(), categories: new Set() }
    for (const fsRef of blob.fieldSets) {
      const fieldSet = fieldSetsById.get(fsRef?.id)
      if (!fieldSet) continue
      for (const code of fieldSet.concepts) {
        allowed.concepts.add(code)
        claimedConcepts.add(code)
      }
      for (const category of fieldSet.categories) {
        allowed.categories.add(category)
        claimedCategories.add(category)
      }
    }
    byVisitType.set(row.CODE_CD, allowed)
  }

  return { byVisitType, claimedConcepts, claimedCategories }
}

/**
 * Decide whether a grid cell is locked under the visit-type lock.
 *
 * Two-tier matching, explicit beats category:
 * 1. Concept is explicitly listed in some visit type's field-set concepts[]:
 *    locked unless the row's visit type lists it explicitly too. The category
 *    fallback deliberately does NOT rescue it — e.g. STROKE_LIPID:V2:* concepts
 *    carry CATEGORY_CHAR='Stroke' which V0/V1 field sets also claim, yet they
 *    must stay V2-only.
 * 2. Concept is unlisted but its category is claimed by some visit type:
 *    locked unless the row's visit type claims the category (the
 *    "Medikamente_Allg" case — general concepts stay active everywhere their
 *    category is in scope).
 * Conservative by design: rows without a visit type, unknown visit types and
 * entirely unclaimed concepts are never locked.
 *
 * @param {Object|null} lockMap - Result of buildVisitTypeLockMap (or null)
 * @param {Object} row - Grid row ({visitTypeCode, isPlaceholder, ...})
 * @param {Object} concept - Grid column ({code, category, ...})
 * @returns {boolean}
 */
export const isCellVisitTypeLocked = (lockMap, row, concept) => {
  if (!lockMap || !row || !concept || row.isPlaceholder) return false
  if (!row.visitTypeCode) return false
  const allowed = lockMap.byVisitType.get(row.visitTypeCode)
  if (!allowed) return false
  if (lockMap.claimedConcepts.has(concept.code)) {
    return !allowed.concepts.has(concept.code)
  }
  if (concept.category && lockMap.claimedCategories.has(concept.category)) {
    return !allowed.categories.has(concept.category)
  }
  return false
}
