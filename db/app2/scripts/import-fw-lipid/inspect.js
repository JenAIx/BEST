#!/usr/bin/env node
const XLSX = require('xlsx')
const fs = require('node:fs')
const path = require('node:path')

const XLSX_PATH = path.resolve(__dirname, '../../tmp/import_fw_lipid_202605/2026-05-08.xlsx')
const OUT_DIR = path.resolve(__dirname, '_inspect')
fs.mkdirSync(OUT_DIR, { recursive: true })

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
const SHEET = 'Datensammlung'
const ws = wb.Sheets[SHEET]
if (!ws) throw new Error(`Sheet "${SHEET}" missing`)

const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true })
const headers = Object.keys(rows[0] || {})

const TRIM_NL = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s)

const summary = headers.map((h) => {
  const values = rows.map((r) => r[h])
  const nonNull = values.filter((v) => v !== null && v !== '' && v !== undefined)
  const types = new Set(nonNull.map((v) => (v instanceof Date ? 'date' : typeof v)))
  const distinct = [...new Set(nonNull.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)))]
  const sample = nonNull.slice(0, 6)
  const specials = nonNull.filter((v) =>
    typeof v === 'string' && /^(n\.?a\.?|unklar|<|>|\?)/i.test(v.trim()),
  )
  return {
    header: h,
    headerTrim: TRIM_NL(h),
    nonNullCount: nonNull.length,
    types: [...types],
    distinctCount: distinct.length,
    distinctPreview: distinct.slice(0, 15),
    sample,
    specials: [...new Set(specials)].slice(0, 10),
  }
})

fs.writeFileSync(path.join(OUT_DIR, 'columns.json'), JSON.stringify(summary, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'first5.json'), JSON.stringify(rows.slice(0, 5), null, 2))

console.log(`rows=${rows.length} cols=${headers.length}`)
console.log('headers:')
for (const h of headers) console.log('  ', JSON.stringify(h), '→', TRIM_NL(h))
console.log(`wrote ${path.join(OUT_DIR, 'columns.json')}`)
