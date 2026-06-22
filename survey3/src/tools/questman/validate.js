// Schema-Validator für die Scoring-Definition eines Fragebogens.
//
// Formalisiert die Invarianten, deren Verletzung in der Vergangenheit zu
// stillen Fehlberechnungen geführt hat (DGI-String-Wert, TWSTRS-Leerzeichen-
// Label & nicht implementiertes calc, ECOG value/score-Längen, whoqol
// String/Zahl-Mismatch). Dient zugleich als ausführbare Doku des results-Schemas.
//
// Reine Funktion ohne Seiteneffekte: gibt { errors, warnings } zurück.
// Eingesetzt vom Schema-Test (Guard) und nutzbar zur Laufzeit/Importzeit.

export const TOP_METHODS = ['sum', 'avg', 'count', 'count_targets', 'ids']
// Per-Item-Scoring-Methoden; fehlt das method-Feld, gilt das value[]->score[]-Mapping.
export const ITEM_METHODS = ['raw', 'multiply', 'range', 'count']
export const DOMAIN_METHODS = [
  'sum', 'avg', 'multiply', 'sum_range', 'diff_range', 'sum_multiply', 'avg_multiply', 'sum_sub_multiply',
]
// Kanonische coding.system-Werte. Abweichungen (z.B. "SNOMED-CT", Tippfehler)
// werden geflaggt -> einheitliche Codes für Interop/app2-Import.
export const KNOWN_SYSTEMS = ['http://snomed.info/sct', 'LOINC', 'CUSTOM', 'LEC-SEQ']

const isStringNumeric = (v) => typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))

/**
 * Sammelt alle Item-IDs eines Fragebogens — inkl. der Sub-Fragen-IDs von
 * multiple_radio (options.questions[].id), die NICHT in item.id stehen.
 * @returns {Set<number|string>}
 */
export function collectItemIds(quest) {
  const ids = new Set()
  ;(quest.items || []).forEach((it) => {
    const arr = Array.isArray(it.id) ? it.id : it.id !== undefined ? [it.id] : []
    arr.forEach((x) => ids.add(x))
    if (it.options && it.options.questions) {
      it.options.questions.forEach((q) => {
        if (q.id !== undefined) ids.add(q.id)
      })
    }
  })
  return ids
}

/**
 * Sammelt alle coding.system-Werte eines Fragebogens (quest/items/sub-fragen/
 * antworten/results/domaine).
 * @returns {Set<string>}
 */
export function collectCodingSystems(quest) {
  const systems = new Set()
  const add = (c) => {
    if (c && c.system) systems.add(c.system)
  }
  add(quest.coding)
  ;(quest.items || []).forEach((it) => {
    add(it.coding)
    if (it.options && it.options.questions) it.options.questions.forEach((q) => add(q.coding))
    if (it.options && it.options.answers) it.options.answers.forEach((a) => add(a.coding))
  })
  const res = quest.results
  if (res) {
    add(res.coding)
    ;(res.domaine || []).forEach((d) => add(d.coding))
    ;(res.scoring || []).forEach((s) => add(s.coding))
  }
  return systems
}

/**
 * Validiert den results-Block eines Fragebogens.
 * @param {object} quest  ein geladener Fragebogen (mit .items, .results)
 * @returns {{errors: Array<{code,msg}>, warnings: Array<{code,msg}>}}
 */
export function validateQuestScoring(quest) {
  const errors = []
  const warnings = []
  const E = (code, msg) => errors.push({ code, msg })
  const W = (code, msg) => warnings.push({ code, msg })

  // Coding-Systeme prüfen (gilt auch für unbepunktete Bögen)
  collectCodingSystems(quest).forEach((sys) => {
    if (!KNOWN_SYSTEMS.includes(sys)) W('UNKNOWN_CODING_SYSTEM', `coding.system "${sys}" ist nicht kanonisch`)
  })

  // number-Items: optionale min/max müssen konsistent sein (gilt auch für unbepunktete Bögen)
  ;(quest.items || []).forEach((it, ix) => {
    if (it.type !== 'number') return
    const hasMin = typeof it.min === 'number'
    const hasMax = typeof it.max === 'number'
    if (hasMin && hasMax && it.min > it.max) {
      E('NUMBER_RANGE', `item[${ix}] number: min (${it.min}) > max (${it.max})`)
    }
  })

  const r = quest.results
  if (!r || r.method === undefined) return { errors, warnings } // unbepunktet -> nichts mehr zu prüfen

  if (!TOP_METHODS.includes(r.method)) E('UNKNOWN_METHOD', `results.method "${r.method}"`)

  const itemIds = collectItemIds(quest)

  // --- scoring-Einträge ---
  ;(r.scoring || []).forEach((s, i) => {
    ;(s.id || []).forEach((id) => {
      if (typeof id === 'number' && !itemIds.has(id)) E('SCORING_ID_MISSING', `scoring[${i}] verweist auf Item-id ${id} (existiert nicht)`)
    })
    if (s.method && !ITEM_METHODS.includes(s.method)) E('UNKNOWN_SCORING_METHOD', `scoring[${i}] method "${s.method}"`)
    if (Array.isArray(s.value) && Array.isArray(s.score) && s.value.length !== s.score.length) {
      E('VALUE_SCORE_LENGTH', `scoring[${i}]: value(${s.value.length}) != score(${s.score.length})`)
    }
  })

  // --- domaine-Einträge (reihenfolge-sensitiv) ---
  const seen = new Set()
  ;(r.domaine || []).forEach((d, i) => {
    if (d.method && !DOMAIN_METHODS.includes(d.method)) E('UNKNOWN_DOMAIN_METHOD', `domaine[${i}] "${d.label}" method "${d.method}"`)
    if (typeof d.label === 'string' && d.label !== d.label.trim()) W('LABEL_WHITESPACE', `domaine[${i}] Label "${d.label}" hat führende/abschließende Leerzeichen`)
    if (seen.has(d.label)) W('LABEL_DUPLICATE', `domaine[${i}] Label "${d.label}" doppelt`)
    ;(d.id || []).forEach((id) => {
      if (typeof id === 'number' && !itemIds.has(id)) E('DOMAIN_ID_MISSING', `domaine "${d.label}" verweist auf Item-id ${id} (existiert nicht)`)
      if (typeof id === 'string' && !seen.has(id)) E('DOMAIN_REF_UNRESOLVED', `domaine "${d.label}" referenziert "${id}", das nicht ZUVOR definiert ist`)
    })
    seen.add(d.label)
  })

  // --- interne Domänen müssen referenziert werden, sonst verschwinden sie spurlos ---
  const referencedLabels = new Set()
  ;(r.domaine || []).forEach((d) => (d.id || []).forEach((id) => typeof id === 'string' && referencedLabels.add(id)))
  ;(r.domaine || []).forEach((d, i) => {
    if (d.internal === true && !referencedLabels.has(d.label)) {
      W('INTERNAL_UNREFERENCED', `domaine[${i}] "${d.label}" ist internal, wird aber von keiner Domäne referenziert (verschwindet wirkungslos)`)
    }
  })

  // --- Typ-Konsistenz der Antwortwerte (DGI-Klasse) ---
  // String-numerische Werte werden von sum/avg ignoriert und matchen nicht in
  // numerischen ids-value-Arrays -> stille Untererfassung. Nur relevant für
  // Items, die tatsächlich zum Score beitragen (nicht für reine Demografie).
  const scoredIds = new Set()
  ;(r.scoring || []).forEach((s) => (s.id || []).forEach((x) => typeof x === 'number' && scoredIds.add(x)))
  ;(r.domaine || []).forEach((d) => (d.id || []).forEach((x) => typeof x === 'number' && scoredIds.add(x)))
  // Bei sum/avg/count(_targets) gibt es keine id-Liste; jeder numerische
  // Item-Wert fließt ein -> alle interaktiven Items gelten als bepunktet.
  const scoresAllItems = r.method !== 'ids'

  ;(quest.items || []).forEach((it, ix) => {
    const itemIdList = Array.isArray(it.id) ? it.id : it.id !== undefined ? [it.id] : []
    const mrIds = it.options && it.options.questions ? it.options.questions.map((q) => q.id) : []
    const contributes = scoresAllItems || [...itemIdList, ...mrIds].some((x) => scoredIds.has(x))
    if (!contributes) return

    const opts = []
    if (Array.isArray(it.options)) opts.push(...it.options)
    if (it.options && it.options.answers) opts.push(...it.options.answers)
    if (opts.some((o) => isStringNumeric(o.value))) {
      E('STRING_NUMERIC', `item[${ix}] (${it.type}) hat string-numerische Werte (z.B. "3" statt 3)`)
    }
  })

  return { errors, warnings }
}
