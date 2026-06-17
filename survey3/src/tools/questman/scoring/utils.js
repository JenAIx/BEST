// Geteilte Hilfsfunktionen der Scoring-Pfade.
//
// Bewusst frei von Seiteneffekten und ohne Abhängigkeit zu den einzelnen
// Methoden, damit jeder Auswerte-Pfad sie nutzen kann.

/**
 * Bildet einen Zahlenwert über eine Liste von Banden auf einen Score ab.
 * Eine Bande gilt als getroffen, wenn `range.value[0] <= val <= range.value[1]`.
 * Die letzte passende Bande gewinnt.
 *
 * @param {number} val   zu klassifizierender Wert
 * @param {Array<{value:[number,number], score:*}>} range  Banden
 * @returns {*} Score der getroffenen Bande oder `undefined`
 */
export function calc_range(val, range) {
  if (val === undefined || range === undefined) return undefined
  let out = undefined
  range.forEach((r) => {
    if (r.value[0] <= val && r.value[1] >= val) out = r.score
  })
  return out
}

/**
 * Differenz zweier Zahlen. Sind nicht beide numerisch, wird statt zu rechnen
 * ein lesbarer "a-b"-String zurückgegeben (Alt-Verhalten der Engine, z.B. für
 * Zeitangaben).
 */
export function substract(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return `${a}-${b}`
}
