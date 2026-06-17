// Scoring-Engine — Einstieg & Dispatcher.
//
// Modulare Struktur (ein Auswerte-Pfad je Datei):
//   sum.js          -> "sum"            einfache Summe
//   avg.js          -> "avg"            Mittelwert
//   count.js        -> "count" / "count_targets"  Häufigkeiten
//   ids.js          -> "ids"            zweistufiges klinisches Scoring
//   evaluate.js     ->                  Bereichs-Bewertung des sum-Scores
//   utils.js        ->                  geteilte Helfer (calc_range, substract)
//
// Aufgerufen wird ausschließlich `calc_results(data, methods)`; alles Weitere
// ist für Tests/Wiederverwendung re-exportiert.

import { log } from '../../Logger'
import { calc_simple_sum } from './sum'
import { calc_simple_avg } from './avg'
import { calc_count, calc_count_targets } from './count'
import { calc_ids } from './ids'

/**
 * Dispatcht den results-Block auf den passenden Auswerte-Pfad.
 * @param {{items: Array}} data  enthält die aufbereiteten Result-Items
 * @param {{method?: string}} methods  der results-Block des Fragebogens
 * @returns {Array|object} Pfad-spezifische Resultate; {} wenn keine Methode
 */
export function calc_results(data, methods) {
  if (methods === undefined || methods === null || methods.method === undefined) return {}
  switch (methods.method) {
    case 'sum':
      return calc_simple_sum(data.items, methods)
    case 'avg':
      return calc_simple_avg(data.items, methods)
    case 'count':
      return calc_count(data.items, methods)
    case 'count_targets':
      return calc_count_targets(data.items, methods)
    case 'ids':
      return calc_ids(data.items, methods)
    default:
      log({ warn: `calc_results: method ${methods.method} not supported` })
      return {}
  }
}

// Backward-kompatible Re-Exports (von QuestMan.js und den Tests genutzt).
export { calc_simple_sum } from './sum'
export { calc_simple_avg } from './avg'
export { calc_count, calc_count_targets } from './count'
export { calc_ids, getScore, getDomaineScore } from './ids'
export { calc_range, substract } from './utils'
export { evaluate } from './evaluate'
