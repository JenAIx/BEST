// Geteilte Darstellungs-Metadaten für Visiten-/Slot-Status (Farbe, Icon, i18n-Keys).
// Reine UI-Daten — kein Vue/Dexie.

export const STATUS_META = {
  empty: { color: 'grey-6', icon: 'edit', labelKey: 'visit.status.empty', actionKey: 'visit.fill' },
  draft: { color: 'orange', icon: 'play_arrow', labelKey: 'visit.status.draft', actionKey: 'visit.resume' },
  completed: { color: 'positive', icon: 'visibility', labelKey: 'visit.status.completed', actionKey: 'visit.edit' },
}

export function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.empty
}

// Fortschrittsfarbe einer Visite aus { completed, total }
export function progressColor(progress) {
  if (!progress || progress.total === 0) return 'grey-6'
  if (progress.completed === progress.total) return 'positive'
  if (progress.completed > 0) return 'orange'
  return 'grey-6'
}
