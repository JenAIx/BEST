/**
 * Medication changes between two visits — derived from the per-visit M
 * snapshots (no patient-level medication list exists on purpose).
 *
 * Rows are the medication objects the app uses everywhere:
 * {observationId, drugName, dosage, dosageUnit, frequency, route, instructions}
 */
import { dosesPerDay } from './ledd.js'

const STRENGTH_RE = /\b\d+([.,]\d+)?\s*(mg|µg|mcg|ug|g|ml|iu|ie|%)(\s*\/\s*\d+([.,]\d+)?\s*(mg|µg|mcg|ug|g|ml|h|24h))?\b/gi
const RATIO_RE = /\b\d+([.,]\d+)?\s*\/\s*\d+([.,]\d+)?(\s*\/\s*\d+([.,]\d+)?)?\b/g
const FORM_RE = /\b(retard|ret\.?|depot|cr|er|hbs|mr|xl|sr)\b/gi
const NOISE_RE = /\b(tabl(etten?)?|tbl|kaps(eln?)?|kps|filmtabl(etten?)?|pflaster|pumpe|inf(usion)?|lsg|lösung|tropfen|gel|sc|s\.c\.|p\.o\.|po)\b/gi

/**
 * Canonical key for a drug name: strengths, ratios, form and noise words
 * removed, diacritics folded. With `drugOptions` (rows {value|code, label,
 * aliases[]}) a matching name maps to the option's code so "Madopar" and
 * "Levodopa/Benserazid" collapse to one key when the catalogue says so.
 * @returns {{key: string, form: 'er'|null}}
 */
export function normalizeDrugKey(drugName, drugOptions = []) {
  const raw = String(drugName || '')
  const form = FORM_RE.test(raw) ? 'er' : null
  FORM_RE.lastIndex = 0
  let s = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(STRENGTH_RE, ' ')
    .replace(RATIO_RE, ' ')
    .replace(FORM_RE, ' ')
    .replace(NOISE_RE, ' ')
    .replace(/\b\d+([.,]\d+)?\b/g, ' ') // leftover bare numbers ("Madopar 125")
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  if (s && Array.isArray(drugOptions)) {
    for (const opt of drugOptions) {
      const blob = opt.blob || opt.metadata || opt
      const code = opt.value ?? opt.code ?? opt.CODE_CD
      const names = [code, opt.label, opt.NAME_CHAR, ...(blob.aliases || [])].filter(Boolean).map((n) => normalizePlain(n))
      if (names.includes(s)) {
        s = String(code)
        break
      }
    }
  }
  return { key: s, form }
}

function normalizePlain(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(STRENGTH_RE, ' ')
    .replace(RATIO_RE, ' ')
    .replace(FORM_RE, ' ')
    .replace(NOISE_RE, ' ')
    .replace(/\b\d+([.,]\d+)?\b/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function signature(row) {
  return [row.dosage ?? '', String(row.frequency || '').toLowerCase(), String(row.route || '').toLowerCase()].join('|')
}

function dailyDoseOf(rows, frequencyOptions) {
  let sum = 0
  let complete = true
  for (const r of rows) {
    const per = dosesPerDay(r.frequency, frequencyOptions)
    const dose = Number(r.dosage)
    if (per == null || !Number.isFinite(dose)) {
      complete = false
      continue
    }
    sum += dose * per
  }
  return { sum: Math.round(sum * 10000) / 10000, complete }
}

/**
 * Diff two medication snapshots (previous visit → current visit).
 * @returns {{added: Array, stopped: Array, changed: Array, unchanged: Array, summary: {added:number, stopped:number, changed:number}}}
 */
export function diffMedications(prevRows, currRows, { frequencyOptions = null, drugOptions = [] } = {}) {
  const group = (rows) => {
    const map = new Map()
    for (const row of rows || []) {
      if (!row?.drugName) continue
      const { key, form } = normalizeDrugKey(row.drugName, drugOptions)
      if (!key) continue
      if (!map.has(key)) map.set(key, { key, rows: [], forms: new Set() })
      map.get(key).rows.push(row)
      if (form) map.get(key).forms.add(form)
    }
    return map
  }
  const prev = group(prevRows)
  const curr = group(currRows)
  const added = []
  const stopped = []
  const changed = []
  const unchanged = []

  for (const [key, c] of curr) {
    const p = prev.get(key)
    if (!p) {
      added.push({ key, curr: c.rows })
      continue
    }
    const sigP = p.rows.map(signature).sort().join(';')
    const sigC = c.rows.map(signature).sort().join(';')
    const formP = [...p.forms].sort().join(',')
    const formC = [...c.forms].sort().join(',')
    if (sigP === sigC && formP === formC) {
      unchanged.push({ key, curr: c.rows })
      continue
    }
    const changes = {}
    const dP = dailyDoseOf(p.rows, frequencyOptions)
    const dC = dailyDoseOf(c.rows, frequencyOptions)
    const prnOnly = p.rows.every((r) => dosesPerDay(r.frequency, frequencyOptions) === 0) && c.rows.every((r) => dosesPerDay(r.frequency, frequencyOptions) === 0)
    if (!prnOnly && dP.complete && dC.complete && dP.sum !== dC.sum) {
      changes.dailyDose = { from: dP.sum, to: dC.sum, direction: dC.sum > dP.sum ? 'up' : 'down' }
    }
    if (p.rows.length === 1 && c.rows.length === 1) {
      const a = p.rows[0]
      const b = c.rows[0]
      if (String(a.frequency || '').toLowerCase() !== String(b.frequency || '').toLowerCase()) changes.frequency = { from: a.frequency || null, to: b.frequency || null }
      if (String(a.route || '').toLowerCase() !== String(b.route || '').toLowerCase()) changes.route = { from: a.route || null, to: b.route || null }
      if ((a.dosage ?? null) !== (b.dosage ?? null) && !changes.dailyDose) changes.dosage = { from: a.dosage ?? null, to: b.dosage ?? null }
    }
    if (formP !== formC) changes.form = { from: formP || null, to: formC || null }
    if (p.rows.length !== c.rows.length) changes.count = { from: p.rows.length, to: c.rows.length }
    changed.push({ key, prev: p.rows, curr: c.rows, changes })
  }
  for (const [key, p] of prev) {
    if (!curr.has(key)) stopped.push({ key, prev: p.rows })
  }
  return { added, stopped, changed, unchanged, summary: { added: added.length, stopped: stopped.length, changed: changed.length } }
}

/** Marker for one current row: 'new' | 'changed' | null (stopped rows come from diff.stopped). */
export function markerFor(diff, row) {
  if (!diff || !row?.observationId) return null
  if (diff.added.some((a) => a.curr.some((r) => r.observationId === row.observationId))) return 'new'
  const ch = diff.changed.find((c) => c.curr.some((r) => r.observationId === row.observationId))
  if (ch) return ch.changes.dailyDose ? (ch.changes.dailyDose.direction === 'up' ? 'up' : 'down') : 'changed'
  return null
}
