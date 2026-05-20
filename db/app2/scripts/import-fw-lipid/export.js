#!/usr/bin/env node
'use strict'

/**
 * Stroke-Lipid bulk export driver.
 *
 * Calls the real ExportService against production.db and writes CSV and/or
 * HL7-JSON output to ./_exports/. Same path the app's UI would take, but
 * invoked headlessly from Node so we can verify the export end-to-end.
 *
 * Usage:
 *   node export.js                          # both formats, all FW_LIPID patients
 *   node export.js --format csv             # CSV only
 *   node export.js --format hl7             # HL7-JSON only
 *   node export.js --limit 10               # first 10 patients (smoke)
 *   node export.js --source <SOURCESYSTEM>  # default 'FW_LIPID_XLSX_2026-05-08'
 *   node export.js --out _exports/          # output directory
 */

const path = require('node:path')
const fs = require('node:fs')
const url = require('node:url')

const args = process.argv.slice(2)
function arg(name, def = null) {
  const i = args.indexOf('--' + name)
  return i < 0 ? def : args[i + 1]
}

const ROOT = path.resolve(__dirname, '../..')
const DB_PATH = path.resolve(arg('db', path.join(ROOT, 'database/production.db')))
const SOURCE = arg('source', 'FW_LIPID_XLSX_2026-05-08')
const FORMAT = arg('format', 'both') // 'csv', 'hl7', or 'both'
const LIMIT = arg('limit') ? Number(arg('limit')) : null
const OUT_DIR = path.resolve(arg('out', path.join(__dirname, '_exports')))

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`)
  process.exit(2)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

async function main() {
  // ESM service modules - load via dynamic import from this CJS script.
  const RealSQLiteConnection = (await import(url.pathToFileURL(path.join(ROOT, 'src/core/database/sqlite/real-connection.js')).href)).default
  const PatientRepository = (await import(url.pathToFileURL(path.join(ROOT, 'src/core/database/repositories/patient-repository.js')).href)).default
  const VisitRepository = (await import(url.pathToFileURL(path.join(ROOT, 'src/core/database/repositories/visit-repository.js')).href)).default
  const ObservationRepository = (await import(url.pathToFileURL(path.join(ROOT, 'src/core/database/repositories/observation-repository.js')).href)).default
  const ConceptRepository = (await import(url.pathToFileURL(path.join(ROOT, 'src/core/database/repositories/concept-repository.js')).href)).default
  const CqlRepository = (await import(url.pathToFileURL(path.join(ROOT, 'src/core/database/repositories/cql-repository.js')).href)).default
  const { ExportService } = await import(url.pathToFileURL(path.join(ROOT, 'src/core/services/export-service.js')).href)

  console.log(`db:     ${DB_PATH}`)
  console.log(`source: ${SOURCE}`)
  console.log(`format: ${FORMAT}`)
  console.log(`limit:  ${LIMIT ?? 'all'}`)
  console.log(`out:    ${OUT_DIR}`)
  console.log()

  // Connect with the same RealSQLiteConnection the integration tests use.
  const conn = new RealSQLiteConnection()
  await conn.connect(DB_PATH)

  // Wire repositories the way DatabaseService does internally, but skip the
  // full DatabaseService boot (which needs an Electron/browser path).
  const repos = {
    patient: new PatientRepository(conn),
    visit: new VisitRepository(conn),
    observation: new ObservationRepository(conn),
    concept: new ConceptRepository(conn),
    cql: new CqlRepository(conn),
  }
  const dbServiceAdapter = {
    isInitialized: true,
    getRepository(name) {
      const r = repos[name]
      if (!r) throw new Error(`Unknown repository: ${name}`)
      return r
    },
  }

  const exporter = new ExportService(dbServiceAdapter)
  await exporter.initialize()

  // Pull patient CDs tagged with our SOURCESYSTEM_CD.
  const patientRowsRes = await conn.executeQuery(
    `SELECT PATIENT_CD FROM PATIENT_DIMENSION WHERE SOURCESYSTEM_CD = ? ORDER BY PATIENT_CD`,
    [SOURCE],
  )
  if (!patientRowsRes.success) throw new Error('Failed to query patients: ' + patientRowsRes.error)
  const allPatientCds = patientRowsRes.data.map((r) => r.PATIENT_CD)
  const patientCds = LIMIT ? allPatientCds.slice(0, LIMIT) : allPatientCds

  if (patientCds.length === 0) {
    console.error(`No patients found with SOURCESYSTEM_CD='${SOURCE}'`)
    await conn.disconnect()
    process.exit(2)
  }
  console.log(`exporting ${patientCds.length} of ${allPatientCds.length} patients`)
  const selected = patientCds.map((cd) => ({ id: cd, PATIENT_CD: cd }))

  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const formats = FORMAT === 'both' ? ['csv', 'hl7'] : [FORMAT]
  const summary = []

  for (const fmt of formats) {
    const label = fmt === 'hl7' ? 'HL7-JSON' : fmt.toUpperCase()
    process.stdout.write(`\n[${label}] export ... `)
    const t0 = Date.now()
    const result = await exporter.exportPatients(selected, fmt, {
      includeVisits: true,
      includeObservations: true,
      includeNotes: false,
    })
    const elapsed = Date.now() - t0

    // ExportService gives us {content, filename, mimeType, size, metadata}.
    // For HL7 the "content" is a JSON-stringified Composition (per generateFilename + size: content.length).
    const ext = fmt === 'hl7' ? 'hl7.json' : 'csv'
    const outFile = path.join(OUT_DIR, `stroke_lipid_${timestamp}_${patientCds.length}.${ext}`)
    fs.writeFileSync(outFile, result.content, 'utf-8')
    const stat = fs.statSync(outFile)
    console.log(`OK (${(stat.size / 1024).toFixed(1)} KB, ${elapsed} ms)`)
    console.log(`        → ${outFile}`)
    summary.push({ format: fmt, file: outFile, sizeBytes: stat.size, ms: elapsed, metadata: result.metadata })
  }

  await conn.disconnect()

  console.log()
  console.log('=== Summary ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
