/**
 * Anzeige von Fragebogen-Antworten aus surveyBEST-Q-Blobs.
 *
 * Neben Skalaren und Listen liefert surveyBEST Objekt-Werte — vor allem die
 * Tageskurve (`kind: 'day_curve'`, Fragetyp des Parkinson-Hybridbogens) — und
 * Bewertungen als HTML (`results[].evaluation`). Beides wurde als
 * "[object Object]" bzw. gar nicht angezeigt. Eine Stelle für alle Ansichten
 * (Fragebogen-Ansicht, Vorschau-Dialog, Visiten-PDF).
 */

const de1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',')

// Tageskurve → eine Zeile mit den Kennzahlen (wie surveyBEST summaryText)
export function dayCurveText(v) {
  const s = v.summary || {}
  const parts = []
  if (s.off_h !== undefined) parts.push(`OFF ${de1(s.off_h)} h`)
  if (s.on_h !== undefined) parts.push(`gut beweglich ${de1(s.on_h)} h`)
  if (s.dys_h !== undefined) parts.push(`Überbewegungen ${de1(s.dys_h)} h`)
  if (s.switches_to_off !== undefined) parts.push(`${s.switches_to_off}× Wechsel in OFF`)
  ;(v.symptoms || []).forEach((sym) => {
    const r = s.symptoms && s.symptoms[sym.key]
    if (r && r.hours > 0) parts.push(`${sym.label} ${de1(r.hours)} h`)
  })
  if (Array.isArray(v.pills) && v.pills.length) parts.push(`Tabletten ${v.pills.join(', ')}`)
  return `Tageskurve: ${parts.join(' · ') || 'ohne Auswertung'}`
}

/**
 * @param {*} value  Antwortwert aus dem Q-Blob
 * @param {{yes?: string, no?: string, empty?: string}} [labels]
 * @returns {string}
 */
export function formatQuestionnaireValue(value, labels = {}) {
  const { yes = 'Yes', no = 'No', empty = 'No response' } = labels
  if (Array.isArray(value)) return value.map((v) => formatQuestionnaireValue(v, labels)).join(', ')
  if (typeof value === 'boolean') return value ? yes : no
  if (value === null || value === undefined || value === '') return empty
  if (typeof value === 'object') {
    if (value.kind === 'day_curve' && Array.isArray(value.values)) return dayCurveText(value)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

// Muster der Tageskurve (Wearing-off, verzögertes ON …) als Textliste
export function dayCurvePatterns(value) {
  if (!value || typeof value !== 'object' || value.kind !== 'day_curve') return []
  return (value.patterns || []).map((p) => (typeof p === 'string' ? p : p.text)).filter(Boolean)
}

/**
 * Bewertungs-HTML (results[].evaluation) → Textzeilen. Bewusst kein v-html:
 * die Blobs kommen aus Importdateien. Block-Grenzen werden Zeilen, Listenpunkte
 * bekommen "• ", Entities werden aufgelöst, alle übrigen Tags fallen weg.
 */
export function evaluationLines(html) {
  if (!html || typeof html !== 'string') return []
  const text = html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(div|p|li|ul|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

// Alle Bewertungen eines Blobs (results[].evaluation, Fallback blob.evaluation)
export function blobEvaluationLines(blob) {
  if (!blob || typeof blob !== 'object') return []
  const fromResults = (Array.isArray(blob.results) ? blob.results : []).flatMap((r) => evaluationLines(r && r.evaluation))
  return fromResults.length ? fromResults : evaluationLines(blob.evaluation)
}
