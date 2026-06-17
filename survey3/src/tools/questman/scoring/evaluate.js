// Nachgelagerte Bewertung: bildet den "sum"-Score über Bereiche auf ein Label
// ab (z.B. BDI-II: 0-12 -> "klinisch unauffällig").
//
// Datenform (results.evaluation):
//   [ { "range": [min, max], "label": "..." }, ... ]
//
// Wirkt NUR auf das Result mit label === 'sum'.

/**
 * @param {Array<{label:string, value:number, evaluation?:string}>} res  berechnete Results (mutiert)
 * @param {Array<{range:[number,number], label:string}>} ev
 * @returns {typeof res}
 */
export function evaluate(res, ev) {
  res.forEach((r) => {
    if (r.label !== 'sum') return
    let tmp = undefined
    ev.forEach((e) => {
      if (e.range[0] <= r.value && e.range[1] >= r.value) tmp = e.label
    })
    if (tmp !== undefined) r.evaluation = tmp
  })
  return res
}
