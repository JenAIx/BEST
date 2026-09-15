/**
 * Levodopa-equivalent daily dose (LEDD) — pure module.
 *
 * Conversion factors follow the MDS 2023 consensus (Jost et al.), the same
 * table the SmartButton LevodopaCalculatorWidget has used; the widget now
 * imports it from here so both stay in sync.
 *
 *   kind 'levodopa'   LED = daily dose × factor, sums into the levodopa subtotal
 *   kind 'standard'   LED = daily dose × factor
 *   kind 'comt'       LED = levodopa subtotal × factor (applied ONCE, highest wins)
 *   kind 'multiplier' LED = levodopa subtotal × factor (istradefylline)
 *   kind 'fixed'      LED = constant while the drug is taken (dose > 0)
 *
 * `computeLEDD(medications)` works on the medication rows the app stores
 * per visit ({drugName, dosage, dosageUnit, frequency, route, …}); the
 * daily dose is dosage × doses-per-day from the frequency code. Rows that
 * cannot be resolved (unknown drug, unknown frequency, no dose) are listed
 * in `unresolved` so a total is never silently wrong.
 */

export const LEDD_VERSION = 'MDS2023'

export const LED_FACTORS = Object.freeze({
  // levodopa forms
  levodopa: { factor: 1.0, kind: 'levodopa', label: 'Levodopa (Standard)' },
  levodopa_dual: { factor: 0.85, kind: 'levodopa', label: 'Dual-release Levodopa' },
  levodopa_cr: { factor: 0.75, kind: 'levodopa', label: 'Controlled-release Levodopa' },
  levodopa_er: { factor: 0.5, kind: 'levodopa', label: 'Extended-release Levodopa (IPX066)' },
  levodopa_inhaled: { factor: 0.69, kind: 'levodopa', label: 'Inhaled Levodopa' },
  lcig: { factor: 1.11, kind: 'levodopa', label: 'LCIG (intrajejunal)' },
  lecig_morning: { factor: 1.11, kind: 'levodopa', label: 'LECIG morning dose' },
  lecig_maintenance: { factor: 1.46, kind: 'levodopa', label: 'LECIG maintenance' },
  foslevodopa: { factor: 0.75, kind: 'levodopa', label: 'Foslevodopa/Foscarbidopa (SC)' },
  // COMT inhibitors — applied to the levodopa subtotal
  comt_entacapone: { factor: 0.33, kind: 'comt', label: 'Entacapone' },
  comt_tolcapone: { factor: 0.5, kind: 'comt', label: 'Tolcapone' },
  comt_opicapone: { factor: 0.5, kind: 'comt', label: 'Opicapone' },
  // MAO-B
  selegiline_oral: { factor: 10, kind: 'standard', label: 'Selegiline (oral)' },
  selegiline_sl: { factor: 80, kind: 'standard', label: 'Selegiline (sublingual)' },
  rasagiline: { factor: 100, kind: 'standard', label: 'Rasagiline' },
  // non-ergot dopamine agonists
  pramipexole_salt: { factor: 100, kind: 'standard', label: 'Pramipexole (salt)' },
  pramipexole_base: { factor: 142.86, kind: 'standard', label: 'Pramipexole (base)' },
  ropinirole: { factor: 20, kind: 'standard', label: 'Ropinirole' },
  rotigotine: { factor: 30.3, kind: 'standard', label: 'Rotigotine' },
  piribedil: { factor: 1, kind: 'standard', label: 'Piribedil' },
  apomorphine_sc: { factor: 10, kind: 'standard', label: 'Apomorphine (SC)' },
  apomorphine_sl: { factor: 1.5, kind: 'standard', label: 'Apomorphine (sublingual)' },
  // ergot dopamine agonists
  lisuride: { factor: 100, kind: 'standard', label: 'Lisuride' },
  bromocriptine: { factor: 10, kind: 'standard', label: 'Bromocriptine' },
  pergolide: { factor: 100, kind: 'standard', label: 'Pergolide' },
  cabergoline: { factor: 66.67, kind: 'standard', label: 'Cabergoline' },
  dihydroergocryptine: { factor: 5, kind: 'standard', label: 'Dihydroergocryptine' },
  // amantadine
  amantadine_ir: { factor: 1, kind: 'standard', label: 'Amantadine IR' },
  amantadine_er: { factor: 1.25, kind: 'standard', label: 'Amantadine ER (ADS-5102)' },
  amantadine_os320: { factor: 1, kind: 'standard', label: 'Amantadine IR/ER (OS320)' },
  // fixed LED
  safinamide: { kind: 'fixed', led: 150, label: 'Safinamide' },
  zonisamide: { kind: 'fixed', led: 100, label: 'Zonisamide' },
  trihexyphenidyl: { kind: 'fixed', led: 100, label: 'Trihexyphenidyl' },
  // multiplier on the levodopa subtotal
  istradefylline: { factor: 0.2, kind: 'multiplier', label: 'Istradefylline' },
})

/** Frequency code → doses per day (PRN = 0 → excluded; cont = dose already per day). */
export const DOSES_PER_DAY = Object.freeze({
  qd: 1,
  bid: 2,
  tid: 3,
  qid: 4,
  q4h: 6,
  q6h: 4,
  q8h: 3,
  q12h: 2,
  qhs: 1,
  ac: 3,
  pc: 3,
  prn: 0,
  cont: 1,
})

/**
 * Doses per day for a frequency code or a "1-0-1" style schedule.
 * `frequencyOptions` (CODE_LOOKUP rows with LOOKUP_BLOB.dosesPerDay) win
 * over the built-in table. Returns null when the frequency is unknown.
 */
export function dosesPerDay(frequency, frequencyOptions = null) {
  if (frequency == null || frequency === '') return null
  const raw = String(frequency).trim()
  const key = raw.toLowerCase()
  if (Array.isArray(frequencyOptions)) {
    const opt = frequencyOptions.find((o) => String(o.value ?? o.code ?? o.CODE_CD ?? '').toLowerCase() === key)
    const n = opt?.dosesPerDay ?? opt?.blob?.dosesPerDay ?? opt?.metadata?.dosesPerDay
    if (typeof n === 'number') return n
  }
  if (key in DOSES_PER_DAY) return DOSES_PER_DAY[key]
  // "1-0-1", "0.5-0-0.5-0", "1-1-1-1"
  if (/^\d+([.,]\d+)?(-\d+([.,]\d+)?)+$/.test(raw)) {
    return raw.split('-').reduce((s, p) => s + parseFloat(p.replace(',', '.')), 0)
  }
  return null
}

// Keyword fallback when no DRUG_OPTIONS row carries a ledType (order matters:
// combination products before their components, retard forms before plain)
const KEYWORD_LED_TYPES = [
  [/stalevo|levodopa.*entacapon|entacapon.*levodopa/i, { ledType: 'levodopa', comt: 'comt_entacapone' }],
  [/duodopa|lcig|intrajejunal/i, { ledType: 'lcig' }],
  [/lecigon|lecig/i, { ledType: 'lecig_maintenance' }],
  [/foslevodopa|produodopa|vyalev/i, { ledType: 'foslevodopa' }],
  [/inbrija|inhal/i, { ledType: 'levodopa_inhaled' }],
  [/(levodopa|l-dopa|madopar|nacom|isicom|sinemet|restex).*(retard|depot|\bcr\b|\ber\b|\bhbs\b|rytary)/i, { ledType: 'levodopa_cr' }],
  [/rytary|ipx066/i, { ledType: 'levodopa_er' }],
  [/levodopa|l-dopa|madopar|nacom|isicom|sinemet|restex|benserazid|carbidopa/i, { ledType: 'levodopa' }],
  [/entacapon|comtess|comtan/i, { ledType: 'comt_entacapone' }],
  [/opicapon|ongentys/i, { ledType: 'comt_opicapone' }],
  [/tolcapon|tasmar/i, { ledType: 'comt_tolcapone' }],
  [/rasagilin|azilect/i, { ledType: 'rasagiline' }],
  [/safinamid|xadago/i, { ledType: 'safinamide' }],
  [/selegilin.*(subl|sl|zydis|xilopar)/i, { ledType: 'selegiline_sl' }],
  [/selegilin|movergan/i, { ledType: 'selegiline_oral' }],
  [/pramipexol|sifrol|mirapex/i, { ledType: 'pramipexole_base' }],
  [/ropinirol|requip/i, { ledType: 'ropinirole' }],
  [/rotigotin|neupro/i, { ledType: 'rotigotine' }],
  [/piribedil|clarium/i, { ledType: 'piribedil' }],
  [/apomorphin.*(subl|sl|film|kynmobi)/i, { ledType: 'apomorphine_sl' }],
  [/apomorphin|apo-?go|dacepton/i, { ledType: 'apomorphine_sc' }],
  [/lisurid/i, { ledType: 'lisuride' }],
  [/bromocriptin/i, { ledType: 'bromocriptine' }],
  [/pergolid/i, { ledType: 'pergolide' }],
  [/cabergolin/i, { ledType: 'cabergoline' }],
  [/dihydroergocryptin|almirid|cripar/i, { ledType: 'dihydroergocryptine' }],
  [/amantadin.*(\ber\b|retard|gocovri|osmolex)/i, { ledType: 'amantadine_er' }],
  [/amantadin|pk-?merz/i, { ledType: 'amantadine_ir' }],
  [/zonisamid/i, { ledType: 'zonisamide' }],
  [/trihexyphenidyl|artane/i, { ledType: 'trihexyphenidyl' }],
  [/istradefyllin|nourianz/i, { ledType: 'istradefylline' }],
]

/** Loose key for matching drug names against DRUG_OPTIONS rows. */
function looseKey(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Resolve the LED type of a medication row. DRUG_OPTIONS rows
 * ({value|code, label, ledType, comt?, aliases[]}) are consulted first
 * (by code, label or alias), then the keyword table.
 * @returns {{ledType: string|null, comt: string|null}}
 */
export function resolveLedType(medication, drugOptions = []) {
  const name = medication?.drugName || ''
  const key = looseKey(name)
  if (key && Array.isArray(drugOptions)) {
    for (const opt of drugOptions) {
      const blob = opt.blob || opt.metadata || opt
      const candidates = [opt.value, opt.code, opt.CODE_CD, opt.label, opt.NAME_CHAR, ...(blob.aliases || [])].filter(Boolean).map(looseKey)
      if (candidates.includes(key) && (blob.ledType || opt.ledType)) {
        return { ledType: blob.ledType || opt.ledType, comt: blob.comt || opt.comt || null }
      }
    }
  }
  for (const [re, hit] of KEYWORD_LED_TYPES) {
    if (re.test(name)) return { ledType: hit.ledType, comt: hit.comt || null }
  }
  return { ledType: null, comt: null }
}

/**
 * Compute the LEDD of a set of medication rows.
 * @param {Array<{observationId?:number, drugName:string, dosage:number|null, dosageUnit?:string, frequency?:string, route?:string}>} medications
 * @param {{frequencyOptions?: Array, drugOptions?: Array}} [options]
 */
export function computeLEDD(medications, { frequencyOptions = null, drugOptions = [] } = {}) {
  const breakdown = []
  const unresolved = []
  const comtCandidates = []
  let levodopaSubtotal = 0

  const rows = (medications || []).map((med) => {
    const { ledType, comt } = resolveLedType(med, drugOptions)
    const dose = Number(med?.dosage)
    const perDay = dosesPerDay(med?.frequency, frequencyOptions)
    return { med, ledType, comt, dose, perDay }
  })

  // pass 1: everything that does not depend on the levodopa subtotal
  for (const row of rows) {
    const { med, ledType, comt, dose, perDay } = row
    const base = { observationId: med?.observationId ?? null, drugName: med?.drugName || '', ledType, kind: null, dose: Number.isFinite(dose) ? dose : null, dosesPerDay: perDay, dailyDose: null, factor: null, led: 0, prn: perDay === 0, assumed: { frequency: ['ac', 'pc'].includes(String(med?.frequency || '').toLowerCase()) } }
    if (!ledType) {
      unresolved.push({ observationId: base.observationId, drugName: base.drugName, reason: 'no_ledType' })
      continue
    }
    const def = LED_FACTORS[ledType]
    base.kind = def.kind
    if (comt) comtCandidates.push({ ledType: comt, factor: LED_FACTORS[comt]?.factor || 0, source: base.drugName, observationId: base.observationId })
    if (def.kind === 'comt') {
      comtCandidates.push({ ledType, factor: def.factor, source: base.drugName, observationId: base.observationId })
      breakdown.push({ ...base, factor: def.factor })
      continue
    }
    if (def.kind === 'multiplier') {
      breakdown.push({ ...base, factor: def.factor })
      continue
    }
    if (!Number.isFinite(dose) || dose <= 0) {
      unresolved.push({ observationId: base.observationId, drugName: base.drugName, reason: 'no_dose' })
      continue
    }
    if (def.kind === 'fixed') {
      breakdown.push({ ...base, factor: null, led: def.led })
      continue
    }
    if (perDay == null) {
      unresolved.push({ observationId: base.observationId, drugName: base.drugName, reason: 'no_frequency' })
      continue
    }
    const dailyDose = perDay === 0 ? 0 : dose * perDay
    const led = round1(dailyDose * def.factor)
    if (def.kind === 'levodopa') levodopaSubtotal += led
    breakdown.push({ ...base, dailyDose, factor: def.factor, led })
  }

  // pass 2: COMT (once, highest factor) and multipliers on the subtotal
  levodopaSubtotal = round1(levodopaSubtotal)
  const comt = comtCandidates.length ? comtCandidates.reduce((a, b) => (b.factor > a.factor ? b : a)) : null
  for (const row of breakdown) {
    if (row.kind === 'comt') row.led = comt && comt.ledType === row.ledType && comt.observationId === row.observationId ? round1(levodopaSubtotal * row.factor) : 0
    if (row.kind === 'multiplier') row.led = round1(levodopaSubtotal * row.factor)
  }
  const comtFromCombination = comt && !breakdown.some((r) => r.kind === 'comt' && r.observationId === comt.observationId)
  const comtLed = comtFromCombination ? round1(levodopaSubtotal * comt.factor) : 0

  const total = round1(breakdown.reduce((s, r) => s + (r.led || 0), 0) + comtLed)
  return { total, levodopaSubtotal, version: LEDD_VERSION, breakdown, unresolved, comtApplied: comt ? comt.ledType : null, comtFromCombination: !!comtFromCombination, comtLed }
}

export function ledInterpretation(total) {
  if (!total) return 'none'
  if (total < 400) return 'low'
  if (total < 800) return 'moderate'
  if (total < 1200) return 'high'
  return 'very_high'
}

function round1(n) {
  return Math.round(n * 10) / 10
}
