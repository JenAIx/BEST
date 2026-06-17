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
//   1. ITEM-SCORE (getScore): jedem Item (per `id`) wird laut `scoring` ein
//      Punktwert zugeordnet.
//   2. DOMÄNEN (getDomaineScore): jeder `domaine`-Eintrag aggregiert über
//      `id[]`. Ein Eintrag in `id` ist entweder eine ZAHL (Item-Score) oder ein
//      STRING (Label einer ZUVOR berechneten Domäne -> Verkettung).
//
// HINWEIS (Tech-Debt, Schritt 4 der Konsolidierung): die String-Referenz ist
// reihenfolgeabhängig und ungeprüft; getScore akkumuliert/überschreibt je nach
// Branch unterschiedlich. Hier zunächst unverändert übernommen, abgesichert
// durch den Golden-Master-Test.

import { calc_range, substract } from './utils'

/**
 * Stufe 1: Item-Score gemäß scoring-Regeln für genau ein Item.
 * @param {Array} scoring  results.scoring
 * @param {{id:*, value:*}} val  Item (id + Rohwert)
 * @returns {number}
 */
export function getScore(scoring, val) {
  let score = 0
  scoring.forEach((s) => {
    if (!s.id.includes(val.id)) return
    if (s.method === 'count') score = Array.isArray(val.value) ? val.value.length : 0
    else if (s.method === 'raw') score = val.value
    else if (s.method === 'multiply') score = val.value * s.value
    else if (s.method === 'range') score = calc_range(val.value, s.range)
    else if (Array.isArray(val.value) && Array.isArray(s.value)) {
      // Mehrfachauswahl: Score aller getroffenen Optionen aufsummieren.
      val.value.forEach((v) => {
        const pos = s.value.indexOf(v)
        if (pos !== -1) score += s.score[pos]
      })
    } else if (Array.isArray(s.value)) {
      // Einzelwert: value[]->score[]-Mapping.
      const pos = s.value.indexOf(val.value)
      if (pos !== -1) score += s.score[pos]
    }
  })
  return score
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
  let score = 0
  let count_zeros = 0
  const SUM_FAMILY = ['sum', 'sum_range', 'avg', 'avg_multiply', 'sum_multiply', 'sum_sub_multiply']

  sub.id.forEach((id) => {
    if (typeof id === 'number') {
      const el = VALUES.find((v) => v.id === id)
      if (el === undefined) return
      if (SUM_FAMILY.includes(sub.method)) {
        score += el.score
        count_zeros += el.score === 0
      } else if (sub.method === 'multiply') {
        score = score === 0 ? el.score : score * el.score
      } else if (sub.method === 'diff_range') {
        score = score === 0 ? el.score : substract(score, el.score)
      }
    } else if (typeof id === 'string') {
      const el = RESULTS.find((v) => v.label === id)
      if (el === undefined) return
      if (['sum', 'sum_range', 'avg', 'sum_multiply', 'sum_sub_multiply'].includes(sub.method)) {
        score += el.value
      } else if (sub.method === 'multiply') {
        score = score === 0 ? el.value : score * el.value
      }
    }
  })

  if (sub.method === 'sum_multiply') {
    if (sub.value) score = score * sub.value
  }
  if (sub.method === 'avg' || sub.method === 'avg_multiply') {
    if (sub.ignore_zeros === true) {
      const divisor = sub.id.length - count_zeros
      score = divisor > 0 ? score / divisor : 0
    } else {
      score = sub.id.length > 0 ? score / sub.id.length : 0
    }
    if (sub.method === 'avg_multiply') score = score * sub.value
  }
  if (sub.method === 'sum_range' || sub.method === 'diff_range') score = calc_range(score, sub.sum_range)
  if (sub.method === 'sum_sub_multiply') score = (score - sub.value[0]) * sub.value[1]

  return score
}

/**
 * Orchestriert beide Stufen und liefert die Domänen-Resultate.
 * @param {Array<{id:*, value:*}>} items  aufbereitete Result-Items
 * @param {object} method  results-Block
 * @returns {Array<{label:string, value:number, coding?:object}>}
 */
export function calc_ids(items, method) {
  const results = []
  const VALUES = items.map((item) => ({ id: item.id, value: item.value }))

  // Stufe 1
  VALUES.forEach((val) => {
    val.score = getScore(method.scoring, val)
  })

  // Stufe 2
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
