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
    note: '', // freie Notiz, in der UI editierbar
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

// Gültigkeit eines einzelnen Fragebogen-Items — die EINE Quelle der Wahrheit, die auch
// QuestMan.check_activeQuest nutzt.
//   true  = (Pflicht-)Feld ist beantwortet bzw. optional (force:false)
//   false = Pflichtfeld noch offen
//   null  = nicht-interaktiv (separator / textbox / ohne Typ) → kein Pflichtfeld
// value optional überschreibbar (z. B. aus einem Entwurf), sonst item.value.
// Reiner Wert-Check je Typ (OHNE Pflicht-/force-Logik): ist der Wert vorhanden
// bzw. vollständig? Eine Wahrheit, geteilt von itemValidity (Pflichtprüfung) und
// der UI (RenderQuest „beantwortet"-Marker). value optional überschreibbar.
export function isAnswered(item, value) {
  const v = value !== undefined ? value : item.value
  const t = item.type
  if (t === 'multiple_radio') {
    if (!Array.isArray(v) || v.length === 0) return false
    // Alle Teilfragen müssen beantwortet sein: Länge == Anzahl Teilfragen und kein null.
    // (Leeres Array [] zählt NICHT als ausgefüllt — sonst wäre v.every() vacuously true.)
    const expected =
      item.options && Array.isArray(item.options.questions) ? item.options.questions.length : 0
    if (expected > 0 && v.length !== expected) return false
    return v.every((x) => x !== undefined && x !== null)
  }
  // checkbox: mindestens eine Auswahl nötig (leeres [] zählt NICHT als ausgefüllt)
  if (t === 'checkbox') return Array.isArray(v) && v.length > 0
  return v !== undefined && v !== null
}

export function itemValidity(item, value) {
  if (item.force === false) return true
  const t = item.type
  if (t === 'textbox' || t === 'seperator' || t === 'separator' || t === undefined) return null
  return isAnswered(item, value)
}

// Pflichtfeld-Statistik über einen Fragebogen, optional gegen index-ausgerichtete Werte
// (z. B. slot.draft.values). Nicht-interaktive und optionale Items zählen nicht mit.
// Liefert { filled, total, percent }; percent = 100 wenn es keine Pflichtfelder gibt.
export function requiredFieldStats(items, values) {
  if (!Array.isArray(items)) return { filled: 0, total: 0, percent: 0 }
  let total = 0
  let filled = 0
  items.forEach((item, i) => {
    if (item.force === false) return
    const value = Array.isArray(values) ? values[i] : undefined
    const validity = itemValidity(item, value)
    if (validity === null) return // nicht-interaktiv
    total++
    if (validity === true) filled++
  })
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100)
  return { filled, total, percent }
}

// Fortschritts-Statistik für die ANZEIGE (nicht für die Pflichtprüfung): zählt alle
// beantwortbaren Antwort-Slots — eine multiple_radio-Matrix wird in ihre Teilfragen
// aufgelöst, optionale Felder (force:false) zählen ebenfalls mit. So zeigt z. B. ein
// optionaler Matrix-Bogen „0 von 18" statt „0 von 0".
// values optional (indexgenau, z. B. slot.draft.values), sonst item.value.
export function answerStats(items, values) {
  if (!Array.isArray(items)) return { filled: 0, total: 0, percent: 100 }
  let total = 0
  let filled = 0
  items.forEach((item, i) => {
    const t = item.type
    if (t === 'textbox' || t === 'seperator' || t === 'separator' || t === 'image' || t === undefined) return
    const value = Array.isArray(values) ? values[i] : item.value
    if (t === 'multiple_radio') {
      const subs =
        item.options && Array.isArray(item.options.questions) ? item.options.questions.length : 0
      total += subs
      if (Array.isArray(value)) filled += value.filter((x) => x !== undefined && x !== null).length
    } else if (t === 'checkbox') {
      total += 1
      if (Array.isArray(value) && value.length > 0) filled += 1
    } else {
      total += 1
      if (value !== undefined && value !== null) filled += 1
    }
  })
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100)
  return { filled, total, percent }
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
