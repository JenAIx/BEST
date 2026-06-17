// Auswerte-Pfad "ids" — zweistufiges Scoring für klinische Summen-/Subskalen.
//
// Datenform (results-Block):
//   {
//     "method": "ids",
//     "scoring":  [ { id:[...], method?, value?, score?, range? }, ... ],
//     "domaine":  [ { label, id:[...], method, ... }, ... ],
//     "evaluation"?: [...]
//   }
//
// Ablauf:
//   1. ITEM-SCORE  (getScore):        je Item (per `id`) ein Punktwert laut `scoring`.
//   2. DOMÄNEN-SCORE (getDomaineScore): je `domaine`-Eintrag eine Aggregation über `id[]`.
//      Ein Eintrag in `id` ist entweder eine ZAHL (Item-Score) oder ein STRING
//      (Label einer ZUVOR berechneten Domäne -> Verkettung; reihenfolge-sensitiv).
//
// Die hier dokumentierten Semantiken sind durch Golden-Master- und manuelle
// Fixture-Tests abgesichert.

import { calc_range, substract } from './utils'

// ============================ STUFE 1: ITEM-SCORE ============================

// Per-Item-Methoden, die den Score ERSETZEN (bei mehreren passenden scoring-
// Einträgen gewinnt der letzte). Ohne `method`-Feld gilt das additive
// value[]->score[]-Mapping (siehe mapValueToScore).
const ITEM_METHODS = {
  count: (val) => (Array.isArray(val.value) ? val.value.length : 0),
  raw: (val) => val.value,
  multiply: (val, entry) => val.value * entry.value,
  range: (val, entry) => calc_range(val.value, entry.range),
}

// Summiert value[]->score[]: bei Array-Wert (Mehrfachauswahl/Checkbox) über alle
// getroffenen Optionen, bei Einzelwert über den einen Treffer. Kein Treffer -> 0.
function mapValueToScore(entry, value) {
  const values = Array.isArray(value) ? value : [value]
  let sum = 0
  values.forEach((v) => {
    const pos = entry.value.indexOf(v)
    if (pos !== -1) sum += entry.score[pos]
  })
  return sum
}

/**
 * Stufe 1: Item-Score gemäß scoring-Regeln für genau ein Item.
 * Methoden-Einträge ERSETZEN den Score (letzter Treffer gewinnt); value[]->score[]-
 * Einträge ADDIEREN. Diese gemischte Semantik ist Alt-Verhalten und bewusst erhalten.
 * @param {Array} scoring  results.scoring
 * @param {{id:*, value:*}} val  Item (id + Rohwert)
 * @returns {number}
 */
export function getScore(scoring, val) {
  let score = 0
  scoring.forEach((entry) => {
    if (!entry.id.includes(val.id)) return
    if (entry.method && ITEM_METHODS[entry.method]) {
      score = ITEM_METHODS[entry.method](val, entry) // ersetzt
    } else if (Array.isArray(entry.value)) {
      score += mapValueToScore(entry, val.value) // addiert
    }
  })
  return score
}

// ============================ STUFE 2: DOMÄNEN-SCORE =========================

// Methoden, deren Beiträge SUMMIERT werden (vor optionaler Nachverarbeitung).
// Hinweis: bei String-Referenzen ist avg_multiply NICHT enthalten (Alt-Verhalten).
const SUM_FAMILY = ['sum', 'sum_range', 'avg', 'avg_multiply', 'sum_multiply', 'sum_sub_multiply']
const SUM_FAMILY_STRINGREF = ['sum', 'sum_range', 'avg', 'sum_multiply', 'sum_sub_multiply']

// Aggregiert die Beiträge der referenzierten IDs zu einem Roh-Score.
// Zahl-ID  -> Item-Score aus VALUES; String-ID -> value einer vorher berechneten Domäne.
// `count_zeros` zählt NUR numerische Item-Scores == 0 (für avg+ignore_zeros).
function accumulate(VALUES, sub, RESULTS) {
  let score = 0
  let count_zeros = 0
  const combineMultiply = (cur, add) => (cur === 0 ? add : cur * add)

  sub.id.forEach((id) => {
    if (typeof id === 'number') {
      const el = VALUES.find((v) => v.id === id)
      if (el === undefined) return
      if (SUM_FAMILY.includes(sub.method)) {
        score += el.score
        count_zeros += el.score === 0
      } else if (sub.method === 'multiply') {
        score = combineMultiply(score, el.score)
      } else if (sub.method === 'diff_range') {
        score = score === 0 ? el.score : substract(score, el.score)
      }
    } else if (typeof id === 'string') {
      const el = RESULTS.find((v) => v.label === id)
      if (el === undefined) return
      if (SUM_FAMILY_STRINGREF.includes(sub.method)) {
        score += el.value
      } else if (sub.method === 'multiply') {
        score = combineMultiply(score, el.value)
      }
    }
  })
  return { score, count_zeros }
}

// Wendet die methoden-spezifische Nachverarbeitung auf den aggregierten Score an.
function postProcess(score, count_zeros, sub) {
  switch (sub.method) {
    case 'sum_multiply':
      return sub.value ? score * sub.value : score
    case 'avg':
    case 'avg_multiply': {
      const divisor = sub.ignore_zeros === true ? sub.id.length - count_zeros : sub.id.length
      const avg = divisor > 0 ? score / divisor : 0
      return sub.method === 'avg_multiply' ? avg * sub.value : avg
    }
    case 'sum_range':
    case 'diff_range':
      return calc_range(score, sub.sum_range)
    case 'sum_sub_multiply':
      return (score - sub.value[0]) * sub.value[1]
    default: // 'sum', 'multiply' -> Roh-Score unverändert
      return score
  }
}

/**
 * Stufe 2: Domänen-/Subskalen-Score über mehrere Item-Scores oder zuvor
 * berechnete Domänen (String-Referenz).
 * @param {Array<{id:*, score:number}>} VALUES  Item-Scores aus Stufe 1
 * @param {object} sub  ein domaine-Eintrag
 * @param {Array<{label:string, value:number}>} RESULTS  bereits berechnete Domänen
 * @returns {number|string}
 */
export function getDomaineScore(VALUES, sub, RESULTS) {
  const { score, count_zeros } = accumulate(VALUES, sub, RESULTS)
  return postProcess(score, count_zeros, sub)
}

// ============================ ORCHESTRIERUNG ================================

/**
 * Führt beide Stufen aus und liefert die Domänen-Resultate (auf 2 Nachkommastellen
 * gerundet). Domänen werden in Definitionsreihenfolge berechnet, sodass spätere
 * Domänen frühere per Label referenzieren können.
 * @param {Array<{id:*, value:*}>} items  aufbereitete Result-Items
 * @param {object} method  results-Block
 * @returns {Array<{label:string, value:number, coding?:object}>}
 */
export function calc_ids(items, method) {
  const results = []
  const VALUES = items.map((item) => ({ id: item.id, value: item.value }))

  // Stufe 1: Item-Scores
  VALUES.forEach((val) => {
    val.score = getScore(method.scoring, val)
  })

  // Stufe 2: Domänen (reihenfolge-sensitiv wegen String-Referenzen)
  method.domaine.forEach((sub) => {
    const val = {
      label: sub.label,
      value: Math.round(getDomaineScore(VALUES, sub, results) * 100) / 100,
    }
    if (sub.coding) val.coding = sub.coding
    results.push(val)
  })

  return results
}
