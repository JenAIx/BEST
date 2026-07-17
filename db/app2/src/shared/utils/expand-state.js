/**
 * Pure helpers for the unified timeline's expand/collapse state.
 *
 * The expanded state is a Set of visit ids (empty = everything collapsed,
 * the default). All helpers return NEW Sets so a Vue ref can be reassigned
 * (guaranteed reactivity, no in-place mutation).
 */

/** Toggle one id; returns a new Set. */
export function toggleExpanded(expandedIds, id) {
  const next = new Set(expandedIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** True when every visible id is expanded (false for an empty list). */
export function allExpanded(visibleIds, expandedIds) {
  if (!visibleIds || visibleIds.length === 0) return false
  return visibleIds.every((id) => expandedIds.has(id))
}

/** Expand all visible ids (keeps ids that are not currently visible). */
export function expandAll(expandedIds, visibleIds) {
  return new Set([...expandedIds, ...visibleIds])
}

/** Collapse all visible ids (keeps ids that are not currently visible). */
export function collapseAll(expandedIds, visibleIds) {
  const next = new Set(expandedIds)
  for (const id of visibleIds) next.delete(id)
  return next
}
