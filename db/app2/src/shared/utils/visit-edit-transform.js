/**
 * Transform a store visit object into the shape EditVisitDialog expects.
 * Extracted from VisitTimeline.editVisit so the unified view (and later the
 * old timeline) share one implementation.
 *
 * The dialog reads `visitForEdit.visit` as the raw VISIT_DIMENSION row; the
 * VISIT_BLOB is refreshed with the store's current visitType/notes so edits
 * always start from what the user sees.
 */
export function buildVisitForEdit(visit) {
  const nowIso = new Date().toISOString()

  const visitForEdit = {
    encounterNum: visit.id,
    visitDate: visit.date,
    endDate: visit.endDate,
    visit: visit.rawData || {
      // Fallback to constructed data if rawData is not available
      ENCOUNTER_NUM: visit.id,
      START_DATE: visit.date,
      END_DATE: visit.endDate,
      UPDATE_DATE: visit.last_changed,
      ACTIVE_STATUS_CD: visit.status,
      LOCATION_CD: visit.location,
      INOUT_CD: visit.inout || (visit.visitType === 'emergency' ? 'E' : 'O'),
      SOURCESYSTEM_CD: 'SYSTEM',
      VISIT_BLOB: JSON.stringify({
        visitType: visit.visitType || 'routine',
        notes: visit.notes || '',
        updatedAt: nowIso,
      }),
    },
    observations: [],
  }

  if (visit.rawData?.VISIT_BLOB) {
    try {
      const blobData = JSON.parse(visit.rawData.VISIT_BLOB)
      visitForEdit.visit.VISIT_BLOB = JSON.stringify({
        ...blobData,
        visitType: visit.visitType || blobData.visitType || 'routine',
        notes: visit.notes || blobData.notes || '',
        updatedAt: nowIso,
      })
    } catch {
      // Unparseable blob → recreate it from the store fields
      visitForEdit.visit.VISIT_BLOB = JSON.stringify({
        visitType: visit.visitType || 'routine',
        notes: visit.notes || '',
        updatedAt: nowIso,
      })
    }
  }

  return visitForEdit
}
