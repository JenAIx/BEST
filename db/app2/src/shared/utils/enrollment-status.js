/**
 * Enrollment status constants for STUDY_PATIENT_LOOKUP.ENROLLMENT_STATUS_CD.
 *
 * Single source of truth for the study-enrollment workflow states:
 *  - 'active'    — patient is enrolled and still being worked on ("open")
 *  - 'completed' — data collection for this patient is finished
 *  - 'withdrawn' — patient left the study (WITHDRAWAL_DATE is set)
 *
 * A NULL ENROLLMENT_STATUS_CD is treated as 'active' everywhere.
 */

export const ENROLLMENT_STATUS_ACTIVE = 'active'
export const ENROLLMENT_STATUS_COMPLETED = 'completed'
export const ENROLLMENT_STATUS_WITHDRAWN = 'withdrawn'

export const ENROLLMENT_STATUSES = [
  { code: ENROLLMENT_STATUS_ACTIVE, color: 'positive', icon: 'play_circle', labelKey: 'study.enrollmentStatus.active' },
  { code: ENROLLMENT_STATUS_COMPLETED, color: 'info', icon: 'check_circle', labelKey: 'study.enrollmentStatus.completed' },
  { code: ENROLLMENT_STATUS_WITHDRAWN, color: 'negative', icon: 'cancel', labelKey: 'study.enrollmentStatus.withdrawn' },
]

export const ENROLLMENT_STATUS_CODES = ENROLLMENT_STATUSES.map((s) => s.code)

/**
 * SQL fragment: enrollment row still counts as enrolled (active OR completed).
 * Expects the STUDY_PATIENT_LOOKUP alias `spl`.
 */
export const ENROLLED_STATUS_SQL = "(spl.ENROLLMENT_STATUS_CD IS NULL OR spl.ENROLLMENT_STATUS_CD != 'withdrawn')"

/** Normalize a raw DB status value (NULL → 'active'). */
export function normalizeEnrollmentStatus(status) {
  return status || ENROLLMENT_STATUS_ACTIVE
}
