// Auswerte-Pfad "avg" — Mittelwert aller numerischen Item-Werte.
//
// Datenform: { "method": "avg", "coding"?: {...} }
//
// Nur numerische Werte gehen in Summe UND Zähler ein. Ergebnis auf 2
// Nachkommastellen gerundet. Leere Menge -> 0 (Division-durch-0-Schutz).

/**
 * @param {Array<{value:*, ignore_for_result?:boolean}>} items
 * @param {{coding?:object}} methods
 * @returns {Array<{label:'avg', value:number, coding?:object}>}
 */
export function calc_simple_avg(items, methods) {
  let sum = 0
  let count = 0
  items.forEach((item) => {
    if (item.ignore_for_result === true) return
    if (typeof item.value === 'number') {
      sum += item.value
      count++
    }
  })

  const value = count === 0 ? 0 : Math.round((100 * sum) / count) / 100
  const result = { label: 'avg', value }
  if (methods && methods.coding) result.coding = methods.coding
  return [result]
}
