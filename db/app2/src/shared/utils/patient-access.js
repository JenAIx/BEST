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
