// Baut aus den (befüllten) Fragebogen-Items die Ergebnis-Item-Liste der summary —
// inkl. Relabeling, multiple_radio-Expansion und Übernahme von id/coding/
// ignore_for_result. Reines Datenmapping (zuvor inline in QuestMan.summary).
//
// Form der Ausgabe-Einträge: { label, value, coding?, id?, ignore_for_result? }
// Diese Form wird sowohl vom Scoring (calc_results: via id/value/ignore_for_result)
// als auch vom CDA-Export (via label/coding/value) konsumiert und bleibt daher
// strikt unverändert.
//
// Hinweis: `ignore_for_result` steuert NUR das Scoring (sum/avg überspringen es),
// NICHT den Export. So markierte Demografie/Metadaten (Alter, Geschlecht, Visite …)
// bleiben bewusst in den Ergebnis-Items und im CDA/CSV-Export erhalten. Siehe
// scoring/README.md.

// Erzeugt einen Ergebnis-Eintrag aus einer Quelle { tag, value, coding?, id? }.
// label = tag; existiert ein coding, überschreibt dessen display das label
// (Alt-Verhalten). ignore_for_result wird übernommen, wenn der Parameter gesetzt ist.
function pushResultItem(out, src, ignoreForResult) {
  const tmp = { label: src.tag, value: src.value, coding: src.coding }
  if (tmp.coding !== undefined) tmp.label = tmp.coding.display
  if (src.id !== undefined) tmp.id = src.id
  if (ignoreForResult !== undefined) tmp.ignore_for_result = src.ignore_for_result
  out.push(tmp)
}

/**
 * @param {Array} items  items des aktiven Fragebogens (mit gesetzten .value)
 * @returns {Array<{label:string, value:*, coding?:object, id?:*, ignore_for_result?:boolean}>}
 */
export function buildResultItems(items) {
  const out = []
  items.forEach((item) => {
    if (item.value === undefined || item.value === null) return

    // multiple_radio -> ein Eintrag je Sub-Frage. Tag-Verkettung ${item.tag}_${sub.tag}
    // (bzw. nur sub.tag), coding/id stammen von der Sub-Frage; ignore_for_result vom Item.
    if (item.type === 'multiple_radio' && Array.isArray(item.value)) {
      item.value.forEach((value, i) => {
        const sub = item.options.questions[i]
        const src = {
          tag: item.tag !== undefined ? `${item.tag}_${sub.tag}` : sub.tag,
          value,
          coding: sub.coding,
        }
        if (sub.id !== undefined) src.id = sub.id
        pushResultItem(out, src, item.ignore_for_result)
      })
      return
    }

    // number: numerische String-Werte (Altdaten/Import) zu Zahl normalisieren und
    // ganz normal übernehmen; ungültige (parseFloat -> NaN) gelten wie "nicht
    // beantwortet" und werden übersprungen (sonst würde NaN die Summe vergiften).
    if (item.type === 'number' && typeof item.value === 'string') {
      const parsed = parseFloat(item.value)
      if (Number.isNaN(parsed)) return
      item.value = parsed
    }

    pushResultItem(out, item, item.ignore_for_result)
  })
  return out
}
