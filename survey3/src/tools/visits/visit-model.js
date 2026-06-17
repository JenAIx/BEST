// Reine Logik für den Patienten-/Visiten-Workflow.
// Bewusst OHNE Dexie-/Vue-Abhängigkeiten gehalten, damit sie — wie scoring.js —
// direkt mit Jest testbar ist. Persistenz übernimmt VisitMan.js.

// Status eines Fragebogen-Slots innerhalb einer Visite:
//   'empty'      — noch nicht begonnen
//   'draft'      — teilweise ausgefüllt, fortsetzbar
//   'completed'  — abgeschlossen (Logikprüfung bestanden), summary gespeichert
export function createVisitSlot(short_title) {
  return {
    short_title,
    status: 'empty',
    draft: null,        // { values: [...] } — rohe item.value je Index (zum Fortsetzen)
    response: null,     // summary-Objekt (QUESTMAN.summary) nach Abschluss
    date_start: null,
    date_end: null,
  }
}

// Erzeugt ein Visiten-Objekt (ohne id — die vergibt Dexie/VisitMan).
// template === null/undefined → leere Visite (Fragebögen ad-hoc ergänzbar).
export function createVisitFromTemplate(template, patientId, date) {
  const questionnaires =
    template && Array.isArray(template.questionnaires) ? template.questionnaires : []
  return {
    patientId,
    templateId: template && template.id !== undefined && template.id !== null ? template.id : null,
    label: (template && template.label) || 'Visite',
    date: date || null,
    inOut: 'O', // Outpatient — Default
    status: 'open', // 'open' | 'completed' (Inhaltsstatus)
    exportedAt: null, // Zeitstempel des letzten Exports (Badge in der UI)
    items: questionnaires.map(createVisitSlot),
  }
}

export function visitProgress(visit) {
  if (!visit || !Array.isArray(visit.items)) return { completed: 0, total: 0 }
  const total = visit.items.length
  const completed = visit.items.filter((i) => i.status === 'completed').length
  return { completed, total }
}

// Setzt visit.status auf 'completed', sobald alle Slots abgeschlossen sind, sonst 'open'.
export function recomputeVisitStatus(visit) {
  if (!visit || !Array.isArray(visit.items)) return visit
  const { completed, total } = visitProgress(visit)
  visit.status = total > 0 && completed === total ? 'completed' : 'open'
  return visit
}

// Überlagert gespeicherte Entwurfs-Werte (indexgenau) auf die items eines aktiven Quests.
// values ist ein Array roher item.value-Einträge, ausgerichtet an der items-Reihenfolge.
export function applyDraftValues(items, values) {
  if (!Array.isArray(items) || !Array.isArray(values)) return items
  const n = Math.min(items.length, values.length)
  for (let i = 0; i < n; i++) {
    if (values[i] !== undefined) items[i].value = values[i]
  }
  return items
}
