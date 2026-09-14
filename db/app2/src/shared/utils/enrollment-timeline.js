/**
 * Pure helpers for the "Einschlüsse pro Monat" chart and the enrolment
 * window filter on the study insights tab. No Vue, no store — unit-testable.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DE_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/

/** 'YYYY-MM' of a Date (local time). */
export function monthKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Add `n` months to a 'YYYY-MM' key. */
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/**
 * Parse a German date string (DD.MM.YYYY) into ISO (YYYY-MM-DD).
 * Returns null for empty/invalid input, incl. impossible dates (31.02.).
 */
export function parseGermanDate(text) {
  if (!text) return null
  const m = DE_DATE_RE.exec(String(text).trim())
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null
  return `${yyyy}-${mm}-${dd}`
}

/** ISO (YYYY-MM-DD) → German (DD.MM.YYYY); passes through null/invalid as ''. */
export function toGermanDate(iso) {
  if (!iso) return ''
  const m = ISO_DATE_RE.exec(String(iso).slice(0, 10))
  if (!m) return ''
  return `${m[3]}.${m[2]}.${m[1]}`
}

/**
 * Build a gap-free monthly series from sparse `{month, count}` rows.
 *
 * - Starts at the first month with an enrolment, ends at `until` (default:
 *   current month) — later months with zero enrolments are still rendered so
 *   a stalled recruitment is visible as a flat tail.
 * - `cumulative` is the running total.
 * - `inWindow` marks months that overlap the `{from, to}` ISO-date window
 *   (used to dim months outside the retention filter). Without a window every
 *   month is `inWindow: true`.
 *
 * @param {Array<{month:string, count:number}>} rows
 * @param {{until?: string, from?: string|null, to?: string|null}} [opts]
 * @returns {Array<{month:string, count:number, cumulative:number, inWindow:boolean}>}
 */
export function buildMonthlySeries(rows, { until = null, from = null, to = null } = {}) {
  const byMonth = new Map()
  for (const r of rows || []) {
    if (!r?.month || !/^\d{4}-\d{2}$/.test(r.month)) continue
    byMonth.set(r.month, (byMonth.get(r.month) || 0) + (Number(r.count) || 0))
  }
  if (byMonth.size === 0) return []

  const keys = [...byMonth.keys()].sort()
  const first = keys[0]
  let last = until || monthKey(new Date())
  if (last < keys[keys.length - 1]) last = keys[keys.length - 1]

  const fromKey = from ? String(from).slice(0, 7) : null
  const toKey = to ? String(to).slice(0, 7) : null

  const series = []
  let cumulative = 0
  for (let key = first; key <= last; key = addMonths(key, 1)) {
    const count = byMonth.get(key) || 0
    cumulative += count
    const inWindow = (!fromKey || key >= fromKey) && (!toKey || key <= toKey)
    series.push({ month: key, count, cumulative, inWindow })
  }
  return series
}

/** Summary numbers for the chart caption. */
export function summarizeMonthlySeries(series) {
  const total = series.reduce((s, r) => s + r.count, 0)
  const months = series.length
  const last12 = series.slice(-12).reduce((s, r) => s + r.count, 0)
  const peak = series.reduce((best, r) => (r.count > (best?.count ?? -1) ? r : best), null)
  return {
    total,
    months,
    avgPerMonth: months ? total / months : 0,
    last12,
    peak,
  }
}

/** 'YYYY-MM' → localized "Jan 2024" (short) or "Januar 2024" (long). */
export function formatMonth(key, locale = 'de-DE', style = 'short') {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  try {
    return new Intl.DateTimeFormat(locale, { month: style, year: 'numeric' }).format(d)
  } catch {
    return key
  }
}
