// Auswerte-Pfad "sum" — einfache Summe aller numerischen Item-Werte.
//
// Datenform (results-Block):
//   { "method": "sum", "coding"?: {...} }
//
// Regeln:
//   - Nur numerische Werte zählen (typeof === 'number'). Strings werden
//     ignoriert — Eingabe-Items müssen daher numerische Werte liefern
//     (siehe Validator: STRING_NUMERIC).
//   - Array-Werte (z.B. Checkbox / aufgelöste multiple_radio) werden
//     elementweise summiert, soweit numerisch.
//   - Items mit `ignore_for_result === true` werden übersprungen.

/**
 * @param {Array<{value:*, ignore_for_result?:boolean}>} items  aufbereitete Result-Items
 * @param {{coding?:object}} methods  results-Block
 * @returns {Array<{label:'sum', value:number, coding?:object}>}
 */
export function calc_simple_sum(items, methods) {
  let sum = 0
  items.forEach((item) => {
    if (item.ignore_for_result === true) return
    if (typeof item.value === 'number') {
      sum += item.value
    } else if (Array.isArray(item.value)) {
      item.value.forEach((val) => {
        if (typeof val === 'number') sum += val
      })
    }
  })

  const result = { label: 'sum', value: sum }
  if (methods && methods.coding) result.coding = methods.coding
  return [result]
}
