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
 * - form-field building for the edit grid (field-set concepts stay as empty
 *   fields when their observation is deleted; extra observations claimed
 *   only by category disappear with their observation)
 * - blank detection: read mode hides observations that were merely created
 *   without a value (NV-flagged rows stay — "explicitly no value" is data),
 *   edit mode dims blank fields
 */

import { matchesConceptCode } from './file-category.js'

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
 * True when the observation carries no value at all — created (e.g. as an
 * empty CRF field or via "add all") but never filled. NV-flagged rows are
 * NOT blank: "explicitly no value" is recorded information (CLAUDE.md §3).
 * Q rows are never blank (pending fills are meaningful), R rows always
 * carry their file.
 */
export function isBlankObservation(obs) {
  if (!obs) return true
  if (obs.valueType === 'Q' || obs.valueType === 'R') return false
  const flag = obs.rawData?.VALUEFLAG_CD ?? obs.valueFlag ?? null
  if (flag === 'NV') return false
  const value = obs.displayValue
  return value == null || value === '' || value === 'No value'
}

/**
 * The value a form-grid field edits: numerics from NVAL_NUM, coded values
 * (S/F/A) need the CODE for the select — TVAL_CHAR, not the resolved label.
 */
export function editValueOf(obs) {
  if (!obs) return ''
  if (obs.valueType === 'N') return obs.rawData?.NVAL_NUM ?? ''
  return obs.rawData?.TVAL_CHAR ?? obs.displayValue ?? ''
}

/**
 * Build the form-grid fields for one field set (pure — testable):
 * every configured concept becomes a field, filled by the first matching
 * observation or empty (delete keeps the slot); observations the group
 * claimed only by category (not listed in concepts[]) are appended after
 * and disappear together with their observation.
 *
 * @param {Object} args
 * @param {string[]} args.conceptCodes - fieldSet.concepts
 * @param {Map} args.resolvedConcepts - code → {label, valueType, unit}
 * @param {Array} args.observations - transformed observations of this group
 * @param {Map} args.pendingValues - key → unsaved input
 * @returns {Array<{key, concept, obs, row}>}
 */
export function buildFormFields({ conceptCodes = [], resolvedConcepts = new Map(), observations = [], pendingValues = new Map() }) {
  const makeField = (code, meta, obs) => {
    const concept = {
      code,
      name: meta?.label || obs?.conceptName || code,
      valueType: obs?.valueType || meta?.valueType || 'T',
      unit: obs?.unit || meta?.unit || null,
    }
    const current = editValueOf(obs)
    const value = pendingValues.has(code) ? pendingValues.get(code) : current
    return {
      key: code,
      concept,
      obs: obs || null,
      row: {
        id: code,
        key: code,
        observationId: obs?.observationId ?? null,
        conceptCode: code,
        valueType: concept.valueType,
        currentValue: value,
        originalValue: current,
        value,
      },
    }
  }

  const used = new Set()
  const out = []

  for (const code of conceptCodes) {
    const obs = observations.find((o) => !used.has(o.observationId) && matchesConceptCode(o.conceptCode, [code]))
    if (obs) used.add(obs.observationId)
    out.push(makeField(code, resolvedConcepts.get(code), obs))
  }

  for (const obs of observations) {
    if (used.has(obs.observationId)) continue
    out.push(makeField(obs.conceptCode, { label: obs.conceptName, valueType: obs.valueType, unit: obs.unit }, obs))
  }

  return out
}

/**
 * Blank check for a form-grid field (edit mode dims blank fields):
 * no observation, or an observation whose edited value is empty. R fields
 * are blank only without their observation (a file row always has a file);
 * M fields are blank without a drug name.
 */
export function isBlankFormField(field) {
  if (!field) return true
  const type = field.concept?.valueType
  if (type === 'R') return !field.obs
  if (type === 'M') return !field.obs || !parseMedicationObservation(field.obs).drugName
  const value = field.row?.value
  return value == null || value === ''
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
/**
 * Synchronous parse of an M-type observation into medication data — the
 * storage convention from medications-store: TVAL_CHAR = drug name,
 * NVAL_NUM = dosage, UNIT_CD = dosage unit, OBSERVATION_BLOB = JSON with
 * frequency/route/instructions. List queries include the (small) M blob,
 * so no async loading is needed here.
 */
export function parseMedicationObservation(obs) {
  const raw = obs?.rawData || {}
  let blob = {}
  const blobText = raw.OBSERVATION_BLOB
  if (typeof blobText === 'string' && blobText) {
    try {
      const parsed = JSON.parse(blobText)
      if (parsed && typeof parsed === 'object') blob = parsed
    } catch {
      blob = {}
    }
  }
  return {
    drugName: blob.drugName || raw.TVAL_CHAR || obs?.value || '',
    dosage: blob.dosage ?? raw.NVAL_NUM ?? obs?.numericValue ?? null,
    dosageUnit: blob.dosageUnit || raw.UNIT_CD || obs?.unit || 'mg',
    frequency: blob.frequency || '',
    route: blob.route || '',
    instructions: blob.instructions || '',
  }
}

/**
 * One-line medication summary for tiles/fields: "ASS 100 mg · 2x täglich ·
 * p.o.". Frequency/route arrive as display labels (resolved by the caller,
 * e.g. useMedicationOptions) — raw codes pass through unchanged.
 */
export function formatMedicationSummary(medication, { frequencyLabel = null, routeLabel = null } = {}) {
  if (!medication?.drugName) return ''
  const parts = [medication.drugName]
  if (medication.dosage != null && medication.dosage !== '') parts.push(`${medication.dosage} ${medication.dosageUnit || ''}`.trim())
  const frequency = frequencyLabel || medication.frequency
  if (frequency) parts.push(frequency)
  const route = routeLabel || medication.route
  if (route) parts.push(route)
  return parts.join(' · ')
}

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
