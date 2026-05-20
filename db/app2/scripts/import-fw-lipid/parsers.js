'use strict'

function normString(v) {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') v = String(v)
  v = v.trim()
  if (v === '' || /^(n\.?a\.?|unklar|\?+)$/i.test(v)) return null
  return v
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return v.toISOString().slice(0, 10)
  }
  if (typeof v === 'number') {
    const ms = (v - 25569) * 86400 * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (!s) return null
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

function parsePLZ(v) {
  if (v === null || v === undefined) return null
  let s = typeof v === 'number' ? String(v) : String(v).trim()
  if (!s) return null
  s = s.replace(/[^\d]/g, '')
  if (!s) return null
  if (s.length === 4) s = '0' + s
  if (s.length !== 5) return null
  return s
}

function parseSex(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (n === 1) return 'M'
  if (n === 0) return 'F'
  return null
}

function parseFinding(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === '' || s === 'n.a.' || s === 'na' || s === 'unklar') return null
    if (s === '1' || s === 'ja' || s === 'yes' || s === 'true') return 1
    if (s === '0' || s === 'nein' || s === 'no' || s === 'false') return 0
  }
  const n = Number(v)
  if (n === 1) return 1
  if (n === 0) return 0
  return null
}

function parseDose(v) {
  if (v === null || v === undefined || v === '') return { value: null, raw: null, note: null }
  if (typeof v === 'number') return { value: v, raw: v, note: null }
  const s = String(v).trim()
  if (!s || /^(n\.?a\.?|unklar|\?+)$/i.test(s)) return { value: null, raw: s, note: 'unknown' }
  const norm = s.replace(',', '.')
  let m = /^<\s*([\d.]+)/.exec(norm)
  if (m) return { value: Number(m[1]), raw: s, note: 'left-censored' }
  m = /^>\s*([\d.]+)/.exec(norm)
  if (m) return { value: Number(m[1]), raw: s, note: 'right-censored' }
  const n = Number(norm)
  if (!Number.isNaN(n)) return { value: n, raw: null, note: null }
  return { value: null, raw: s, note: 'unparseable' }
}

const ETIOLOGY_MAP = {
  'kryptogen': 'STROKE_LIPID:ETIO:CRYPTOGENIC',
  'makroangiopathisch': 'STROKE_LIPID:ETIO:MACRO',
  'mikroangiopathisch': 'STROKE_LIPID:ETIO:MICRO',
  'kardioembolisch(vhf)': 'STROKE_LIPID:ETIO:CARDIOEMBOLIC',
  'kardioembolisch (vhf)': 'STROKE_LIPID:ETIO:CARDIOEMBOLIC',
  'vaskulitis': 'STROKE_LIPID:ETIO:VASCULITIS',
  'andere': 'STROKE_LIPID:ETIO:OTHER',
}

function parseEtiology(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim().toLowerCase()
  return ETIOLOGY_MAP[s] || null
}

const EVENT_TYPE_MAP = {
  1: 'STROKE_LIPID:EVT:STROKE',
  2: 'STROKE_LIPID:EVT:TIA',
  3: 'STROKE_LIPID:EVT:ZAV',
}

function parseEventType(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return EVENT_TYPE_MAP[n] || null
}

module.exports = {
  normString,
  parseDate,
  parsePLZ,
  parseSex,
  parseFinding,
  parseDose,
  parseEtiology,
  parseEventType,
  ETIOLOGY_MAP,
  EVENT_TYPE_MAP,
}
