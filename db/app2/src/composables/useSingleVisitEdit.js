/**
 * useSingleVisitEdit — the "at most ONE visit in edit mode" state machine of
 * the unified timeline. Pure orchestration, injected callbacks:
 *
 *   resolveVisit(visit) → the store's full copy (rawData/visitType present)
 *   selectVisit(visit)  → make it the globally selected visit + load its
 *                         observations (MUST complete before panels mount)
 *   onEnter(visit)      → e.g. expand the card
 *   onExit()            → e.g. reload the patient-wide observation list
 *                         (autosaves use skipReload, read cards would be stale)
 */

import { ref } from 'vue'

export function useSingleVisitEdit({ resolveVisit, selectVisit, onEnter, onExit } = {}) {
  const editingVisitId = ref(null)
  const entering = ref(false)

  const isEditing = (id) => editingVisitId.value === id

  const startEditing = async (visit) => {
    if (entering.value || !visit) return
    const full = (typeof resolveVisit === 'function' && resolveVisit(visit)) || visit

    // Switching cards: unmount the previous editor first (clears its timers)
    if (editingVisitId.value !== null && editingVisitId.value !== full.id) {
      editingVisitId.value = null
    }

    entering.value = true
    try {
      if (typeof selectVisit === 'function') await selectVisit(full)
      if (typeof onEnter === 'function') await onEnter(full)
      editingVisitId.value = full.id
    } finally {
      entering.value = false
    }
  }

  const stopEditing = async () => {
    if (editingVisitId.value == null) return
    editingVisitId.value = null
    if (typeof onExit === 'function') await onExit()
  }

  return { editingVisitId, isEditing, startEditing, stopEditing }
}
