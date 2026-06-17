// Auswerte-Pfade "count" und "count_targets" — Häufigkeitsauswertungen.

/**
 * "count": zählt, wie oft jeder vorkommende Antwortwert auftritt.
 * Datenform: { "method": "count" }
 *
 * @param {Array<{value:*}>} items
 * @returns {Array<{label:*, value:number, total:number}>} ein Eintrag je distinktem Wert
 */
export function calc_count(items) {
  const answers = items.map((item) => item.value)
  const unique = [...new Set(answers)]

  const buckets = {}
  unique.forEach((answ) => {
    buckets[answ] = { count: 0, label: answ }
  })

  let total = 0
  items.forEach((item) => {
    buckets[item.value].count++
    total++
  })

  return Object.keys(buckets).map((key) => ({
    label: buckets[key].label,
    value: buckets[key].count,
    total,
  }))
}

/**
 * "count_targets": zählt Treffer gegen vordefinierte Zielwerte und gewichtet
 * sie mit `target.score`.
 * Datenform: { "method": "count_targets", "targets": [{label, value, score}] }
 *
 * @param {Array<{value:*}>} items
 * @param {{targets: Array<{label:string, value:*, score:number}>}} method
 * @returns {Array<{label:string, value:number, total:number}>}
 */
export function calc_count_targets(items, method) {
  return method.targets.map((target) => {
    const res = { label: target.label, value: 0, total: 0 }
    items.forEach((item) => {
      if (item.value === target.value) {
        res.value += target.score
        res.total += target.score
      }
    })
    return res
  })
}
