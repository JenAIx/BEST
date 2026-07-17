/**
 * Pure helpers for resolving visit-type and visit-status display metadata.
 *
 * The authoritative label source is CODE_LOOKUP (VISIT_DIMENSION/VISIT_TYPE_CD),
 * exposed as options via globalSettingsStore.getVisitTypeOptions() — each option
 * carries the LOOKUP_BLOB label (e.g. "Stroke-Lipid V1 - Index Stroke"). The
 * static maps below are last-resort fallbacks only (parity with the legacy
 * resolver in VisitTimelineItem.vue).
 */

// Static fallbacks for the legacy generic visit types
const FALLBACK_TYPE_LABELS = {
  routine: 'Routine Check-up',
  followup: 'Follow-up',
  emergency: 'Emergency',
  consultation: 'Consultation',
  procedure: 'Procedure',
}

const FALLBACK_TYPE_ICONS = {
  routine: 'health_and_safety',
  followup: 'follow_the_signs',
  emergency: 'emergency',
  consultation: 'psychology',
  procedure: 'medical_services',
}

const FALLBACK_TYPE_COLORS = {
  routine: 'blue',
  followup: 'orange',
  emergency: 'negative',
  consultation: 'purple',
  procedure: 'teal',
}

export const DEFAULT_TYPE_META = Object.freeze({
  label: 'General Visit',
  icon: 'local_hospital',
  color: 'primary',
})

/**
 * Extract the effective visit-type code from a store visit object.
 * VISIT_BLOB (raw DB JSON) wins over the transformed visitType field,
 * mirroring VisitTimelineItem's resolution order.
 */
export function extractVisitType(visit) {
  if (!visit) return null
  let visitType = visit.visitType || null
  const blob = visit.rawData?.VISIT_BLOB
  if (blob) {
    try {
      const blobData = JSON.parse(blob)
      if (blobData && blobData.visitType) {
        visitType = blobData.visitType
      }
    } catch {
      // unparseable blob → keep the transformed field
    }
  }
  return visitType
}

/**
 * Build {label, icon, color} for a visit-type code from the DB-backed options
 * (globalSettingsStore.getVisitTypeOptions() shape: {value, label, icon?, color?}).
 * Option match wins; static maps and finally the code itself are fallbacks.
 */
export function buildTypeMeta(code, options = []) {
  if (!code) return { ...DEFAULT_TYPE_META }

  const option = options.find((vt) => vt.value === code)
  if (option) {
    return {
      label: option.label || FALLBACK_TYPE_LABELS[code] || code,
      icon: option.icon || FALLBACK_TYPE_ICONS[code] || DEFAULT_TYPE_META.icon,
      color: option.color || FALLBACK_TYPE_COLORS[code] || DEFAULT_TYPE_META.color,
    }
  }

  return {
    label: FALLBACK_TYPE_LABELS[code] || code,
    icon: FALLBACK_TYPE_ICONS[code] || DEFAULT_TYPE_META.icon,
    color: FALLBACK_TYPE_COLORS[code] || DEFAULT_TYPE_META.color,
  }
}

// Resolved status labels → timeline CSS classes (SNOMED labels + legacy)
const STATUS_CLASS_BY_LABEL = {
  Active: 'status-active', // SCTID: 55561003
  Classified: 'status-active', // SCTID: 73504009
  Closed: 'status-completed', // SCTID: 29179001
  Inactive: 'status-cancelled', // SCTID: 73425007
  Completed: 'status-completed',
  Discharged: 'status-completed',
  Cancelled: 'status-cancelled',
  Pending: 'status-active',
}

// Raw ACTIVE_STATUS_CD codes → CSS classes (fallback when the label is unknown)
const STATUS_CLASS_BY_CODE = {
  'SCTID: 55561003': 'status-active',
  'SCTID: 73504009': 'status-active',
  'SCTID: 29179001': 'status-completed',
  'SCTID: 73425007': 'status-cancelled',
  A: 'status-active',
  C: 'status-completed',
  I: 'status-cancelled',
  X: 'status-cancelled',
  P: 'status-active',
}

/**
 * CSS class for the timeline status dot/chip. Resolved label wins,
 * raw status code is the fallback, unknown → 'status-default'.
 */
export function statusCssClass(label, rawStatus) {
  if (label && STATUS_CLASS_BY_LABEL[label]) return STATUS_CLASS_BY_LABEL[label]
  return STATUS_CLASS_BY_CODE[rawStatus] || 'status-default'
}

export const DEFAULT_STATUS_META = Object.freeze({
  label: 'Unknown',
  color: 'grey',
  cssClass: 'status-default',
})
