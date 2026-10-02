// Reine Logik für den Patienten-/Visiten-Workflow.
// Bewusst OHNE Dexie-/Vue-Abhängigkeiten gehalten, damit sie — wie scoring.js —
// direkt mit Jest testbar ist. Persistenz übernimmt VisitMan.js.

import { isDayCurveValue, curveSummary } from '../daycurve'

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
  // drawing: erst beantwortet, wenn eine echte Zeichnung (data-URI PNG) vorliegt
  if (t === 'drawing') return typeof v === 'string' && v.startsWith('data:image') && v.length > 100
  // day_curve: erst beantwortet, wenn eine Kurve per „Übernehmen“ gespeichert wurde
  if (t === 'day_curve') return isDayCurveValue(v)
  return v !== undefined && v !== null
}

// ---- Bedingte Fragen (show_if) ----
// Ein Item mit show_if erscheint nur, wenn die Bedingung erfüllt ist; eine Liste
// von Bedingungen heißt „mindestens eine". Ausgeblendete Items sind kein
// Pflichtfeld, zählen nicht im Fortschritt und gehen mit hidden_value (falls
// gesetzt) in die Ergebnisse ein — z. B. „nicht angekreuzt = niemals".
//   { item: <id>, op: 'includes'|'equals'|'not_equals'|'gt'|'gte'|'answered', value, metric? }
// metric: bei day_curve ein Feld der Kurven-Auswertung (off_h, dys_h, …).
// values optional (indexgenau, z. B. aus einem Entwurf), sonst item.value.
export function conditionMet(cond, items, values) {
  if (!cond || !Array.isArray(items)) return false
  const idx = items.findIndex((it) => (cond.item !== undefined && it.id === cond.item) || (cond.tag !== undefined && it.tag === cond.tag))
  if (idx === -1) return false
  let v = Array.isArray(values) && values[idx] !== undefined ? values[idx] : items[idx].value
  if (cond.metric) {
    if (!isDayCurveValue(v)) return false
    v = (v.summary || curveSummary(v))[cond.metric]
  }
  switch (cond.op) {
    case 'includes': return Array.isArray(v) && v.includes(cond.value)
    case 'equals': return v === cond.value
    case 'not_equals': return v !== undefined && v !== null && v !== cond.value
    case 'gt': return typeof v === 'number' && v > cond.value
    case 'gte': return typeof v === 'number' && v >= cond.value
    case 'answered': return isAnswered(items[idx], v)
    default: return false
  }
}

export function isVisible(item, items, values) {
  const c = item && item.show_if
  if (!c || !Array.isArray(items)) return true
  return (Array.isArray(c) ? c : [c]).some((x) => conditionMet(x, items, values))
}

// items/values optional: mit ihnen werden ausgeblendete Items (show_if) übersprungen.
export function itemValidity(item, value, items, values) {
  if (items && !isVisible(item, items, values)) return null
  if (item.force === false) return true
  const t = item.type
  if (t === 'textbox' || t === 'separator' || t === undefined) return null
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
    const validity = itemValidity(item, value, items, values)
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
    if (t === 'textbox' || t === 'separator' || t === 'image' || t === undefined) return
    if (!isVisible(item, items, values)) return
    const value = Array.isArray(values) ? values[i] : item.value
    if (t === 'multiple_radio') {
      const subs =
        item.options && Array.isArray(item.options.questions) ? item.options.questions.length : 0
      total += subs
      if (Array.isArray(value)) filled += value.filter((x) => x !== undefined && x !== null).length
    } else if (t === 'checkbox') {
      total += 1
      if (Array.isArray(value) && value.length > 0) filled += 1
    } else if (t === 'drawing' || t === 'day_curve') {
      total += 1
      if (isAnswered(item, value)) filled += 1
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
