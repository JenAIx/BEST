/**
 * Patient access-control policy — single source of truth shared by the UI
 * (PatientCard menu, PatientAccessCard) and the store guard
 * (database-store.assertOwnerOrAdmin).
 *
 * Who may change a patient's owner / public visibility:
 *   - admins            → always
 *   - the patient owner → their own patient
 *   - any logged-in user → for an OWNERLESS patient that is public
 *     (e.g. bulk-imported patients that only carry a public-access row —
 *      these are "claimable")
 *
 * NOTE: this is the access/rights policy only. Patient DELETION keeps its
 * stricter "admin or creator" rule (database-store.deletePatient).
 */
export function canManagePatientAccess({ isAdmin, currentUserId, ownerUserId, isPublic }) {
  if (isAdmin) return true
  if (currentUserId === undefined || currentUserId === null) return false
  if (ownerUserId === currentUserId) return true
  if ((ownerUserId === undefined || ownerUserId === null) && isPublic) return true
  return false
}

/**
 * How an access-filtered query must treat the given auth context.
 *
 *   'unfiltered' — admins, or NO context object at all (`null`/`undefined`):
 *                  system/internal callers (imports, tests) that explicitly
 *                  run without access control.
 *   'deny'       — a context object exists but carries no user id (auth store
 *                  not resolvable, logged out, error). FAIL CLOSED: the query
 *                  must return nothing rather than everything.
 *   'filter'     — a regular user (USER_ID may legitimately be 0 = `public`).
 *
 * The old inline checks (`!userAccess.userId`) treated USER_ID 0 as "no user"
 * and returned EVERYTHING to the public account — never use truthiness here.
 */
export function resolveAccessMode(userAccess) {
  if (userAccess === undefined || userAccess === null) return 'unfiltered'
  if (userAccess.isAdmin === true) return 'unfiltered'
  if (userAccess.userId === undefined || userAccess.userId === null) return 'deny'
  return 'filter'
}
