/**
 * Pure helpers for the compact observation rendering in the unified
 * timeline: tile grid (read mode) and form grid (edit mode).
 *
 * - short concept names ("LDL-Cholesterin (Moles/Volume) in Serum…" →
 *   "LDL-Cholesterin"), full name always available via tooltip
 * - content-aware widths: numbers side by side, long text full width,
 *   files/questionnaires wide
 * - the exact same save/create payload semantics as the legacy
 *   ObservationFieldSet.saveRow / buildEmptyObservationData (incl. the
 *   VALUEFLAG_CD reset policy from CLAUDE.md §3)
 */

// Value-type accent colors (hex — used as CSS custom property values)
export const VALUE_TYPE_HEX = {
  N: '#00897b',
  T: '#607d8b',
  D: '#fb8c00',
  S: '#1e88e5',
  F: '#43a047',
  A: '#7cb342',
  M: '#8e24aa',
  R: '#fb8c00',
  Q: '#5e35b1',
}

export function valueTypeHex(valueType) {
  return VALUE_TYPE_HEX[valueType] || '#8a949c'
}

/**
 * Short display name: cut at the first bracket/comma qualifier, trim
 * separators, ellipsize. "Aspartate aminotransferase (Catalytic…)" →
 * "Aspartate aminotransferase".
 */
export function shortConceptName(name, max = 40) {
  if (!name) return ''
  let short = String(name).split(/[([]/)[0].trim()
  short = short.replace(/[\s,;:–-]+$/, '')
  if (!short) short = String(name).trim()
  if (short.length > max) short = `${short.slice(0, max - 1).trimEnd()}…`
  return short
}

/**
 * Content-aware tile width: 's' (one cell), 'm' (two cells), 'full' (row).
 * Numbers/dates stay small so several line up side by side; selections and
 * findings grow with their label; files, questionnaires and medications are
 * wide; long free text takes the full row.
 */
export function tileSpan(obs) {
  const type = obs?.valueType
  const text = String(obs?.displayValue ?? '')

  if (type === 'T') return text.length > 60 ? 'full' : 'm'
  if (type === 'R' || type === 'Q' || type === 'M') return 'm'
  if (type === 'N' || type === 'D') return 's'
  // S/F/A and everything else: grow with the value label
  return text.length > 16 ? 'm' : 's'
}

/**
 * Update payload for writing a value — mirrors ObservationFieldSet.saveRow:
 * writing a value always clears VALUEFLAG_CD (NV/AUDIT/CONFIRMED reset).
 */
export function buildObservationUpdate(valueType, value) {
  const updateData = { VALUEFLAG_CD: null }

  switch (valueType) {
    case 'N': {
      const numericValue = parseFloat(value)
      updateData.NVAL_NUM = Number.isFinite(numericValue) ? numericValue : null
      updateData.TVAL_CHAR = null
      updateData.OBSERVATION_BLOB = null
      break
    }
    case 'S':
    case 'F':
    case 'A':
      updateData.TVAL_CHAR = String(value)
      updateData.NVAL_NUM = null
      updateData.OBSERVATION_BLOB = null
      break
    case 'R':
    case 'M':
      updateData.OBSERVATION_BLOB = value
      updateData.TVAL_CHAR = null
      updateData.NVAL_NUM = null
      break
    case 'T':
    default:
      updateData.TVAL_CHAR = String(value)
      updateData.NVAL_NUM = null
      updateData.OBSERVATION_BLOB = null
      break
  }

  return updateData
}

/**
 * Create payload for a field-set concept — mirrors
 * ObservationFieldSet.buildEmptyObservationData, optionally with an initial
 * value merged in (create-on-first-input in the form grid).
 */
export function buildNewObservationData({ patientNum, encounterNum, concept, value = null, visitDate = null }) {
  const base = {
    PATIENT_NUM: patientNum,
    ENCOUNTER_NUM: encounterNum,
    CONCEPT_CD: concept.code,
    VALTYPE_CD: concept.valueType,
    START_DATE: visitDate || new Date().toISOString().split('T')[0],
    LOCATION_CD: 'VISITS_PAGE',
    INSTANCE_NUM: 1,
    UPLOAD_ID: 1,
    TVAL_CHAR: concept.valueType === 'N' ? null : '',
    NVAL_NUM: null,
    UNIT_CD: concept.unit || null,
    OBSERVATION_BLOB: null,
  }
  if (value !== null && value !== undefined && value !== '') {
    const { VALUEFLAG_CD, ...valueColumns } = buildObservationUpdate(concept.valueType, value)
    Object.assign(base, valueColumns, { VALUEFLAG_CD })
  }
  return base
}
