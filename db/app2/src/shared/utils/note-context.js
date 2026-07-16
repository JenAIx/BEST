/**
 * Note Context Utilities
 *
 * Pure functions for quick-note context handling:
 *  - buildNoteContext: captures the app context (patient / study / route) at
 *    save time into a JSON-serializable blob stored in NOTE_FACT.NOTE_BLOB
 *  - resolveContextTarget: turns a saved note back into a navigation target
 *    (priority: patient → study → originating route)
 *
 * Kept pure (no store/router imports) so they are directly unit-testable.
 */

/**
 * Build the context blob for a new quick note.
 * @param {Object} sources
 * @param {Object|null} sources.patient - patient-store selectedPatient (PATIENT_NUM, PATIENT_CD, name)
 * @param {Object|null} sources.visit - visit-store selectedVisit (id → ENCOUNTER_NUM, START_DATE)
 * @param {Object|null} sources.study - study-store selectedStudy (id, name)
 * @param {string|null} sources.route - current route fullPath
 * @param {string|null} sources.createdBy - USER_CD of the author
 * @returns {Object} - context blob for NOTE_BLOB
 */
export function buildNoteContext({ patient = null, visit = null, study = null, route = null, createdBy = null } = {}) {
  const context = { createdBy: createdBy || null, route: route || null }

  if (patient) {
    context.patientNum = patient.PATIENT_NUM ?? null
    context.patientCd = patient.PATIENT_CD ?? patient.id ?? null
    context.patientName = patient.name ?? patient.NAME_CHAR ?? null
  }
  if (visit) {
    context.encounterNum = visit.id ?? visit.ENCOUNTER_NUM ?? null
    context.visitDate = visit.START_DATE ?? visit.startDate ?? null
  }
  if (study) {
    context.studyId = study.id ?? null
    context.studyName = study.name ?? null
  }

  return context
}

/**
 * Resolve the primary navigation target of a saved note.
 * Priority: patient (→ /visits/<PATIENT_CD>) → study (→ /studies/<id>) →
 * originating route. Returns null when the note has no usable context.
 * @param {Object} note - NOTE_FACT row (NOTE_BLOB may be a JSON string or object)
 * @returns {{type: string, label: string, icon: string, to: string}|null}
 */
export function resolveContextTarget(note) {
  if (!note) return null

  const blob = parseNoteBlob(note.NOTE_BLOB)

  const patientCd = blob.patientCd ?? null
  if (patientCd) {
    return {
      type: 'patient',
      label: blob.patientName || String(patientCd),
      icon: 'person',
      to: `/visits/${patientCd}`,
    }
  }

  if (blob.studyId != null && blob.studyId !== '') {
    return {
      type: 'study',
      label: blob.studyName || `Study ${blob.studyId}`,
      icon: 'science',
      to: `/studies/${blob.studyId}`,
    }
  }

  if (blob.route) {
    return {
      type: 'route',
      label: blob.route,
      icon: 'link',
      to: blob.route,
    }
  }

  return null
}

/**
 * Safely parse NOTE_BLOB (JSON string, object, or null).
 * @param {string|Object|null} noteBlob
 * @returns {Object}
 */
export function parseNoteBlob(noteBlob) {
  if (!noteBlob) return {}
  if (typeof noteBlob === 'object') return noteBlob
  try {
    const parsed = JSON.parse(noteBlob)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Derive the NAME_CHAR title from the note text (first line, max 50 chars).
 * @param {string} text
 * @returns {string}
 */
export function deriveNoteTitle(text) {
  const firstLine = String(text || '')
    .trim()
    .split('\n')[0]
  return firstLine.length > 50 ? `${firstLine.slice(0, 47)}…` : firstLine
}
