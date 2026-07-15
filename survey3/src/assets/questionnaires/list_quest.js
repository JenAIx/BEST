export const quest_template = {
  title: null,
  short_title: null,
  description: null,
  coding: {
    system: "http://snomed.info/sct",
    code: "386053000",
    display: "Klinisches Assessment"
  },
  manual: null,
  keywords: null,
  ref: null,
  items: [],
  results: { method: "sum" }
}

export const item_template = {
  "label": "",
  "id": null,
  "coding": { "display": "Untersuchung", "code": "302199004", "system": "http://snomed.info/sct" },
  "value": null,
  "type": "text",
  "inline": false,
  "force": false
}

// Im Builder anbietbare Item-Typen. Deckungsgleich mit den Renderern; "image"
// bleibt vorerst draußen (braucht Datei-Handling), ist aber im Validator-
// Allowlist (ITEM_TYPES in tools/questman/validate.js) als gültig zugelassen.
export const item_types = ["text", "number", "date", "date_year", "time", "radio", "checkbox", "slider", "multiple_radio", "separator", "textbox", "drawing"]
export const result_types = ["nothing", "sum", "count", "avg", "count_targets", "ids"]
export const result_method_templates = {
  targets: { label: 'correct', value: 1, score: 1 },
  scoring: { id: [], value: [], score: [] },
  domaine: { label: "sum", id: [], method: "sum" },
  evaluation: { range: [0, 12], label: "klinisch unauffällig" }


}
