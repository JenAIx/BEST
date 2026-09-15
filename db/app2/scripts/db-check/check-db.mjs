#!/usr/bin/env node
/**
 * db-check — großer Integrationstest gegen eine BEST-Datenbankdatei.
 *
 *   node scripts/db-check/check-db.mjs <pfad/zur.db> [--keep] [--json out.json]
 *
 * Arbeitet IMMER auf einer Kopie (tests/output/db-check-<name>.db), die
 * Originaldatei wird nie geöffnet. Ablauf:
 *   1. Migrationen (identische Liste wie database-service.js) → welche liefen
 *   2. PRAGMA integrity_check / foreign_key_check
 *   3. Schema: Tabellen, Views, Trigger (13), Indizes
 *   4. Zeilenzahlen aller Tabellen
 *   5. Konsistenz + Konventionen (CLAUDE.md §1–§3b, Zugriffsregeln)
 *   6. Audit-System: Flags, Trail, Waisen
 *   7. Echte Repository-Pfade (StudyRepository) + Antwortzeiten der
 *      schweren Abfragen (Patientenliste, Zeitlinie, Kohorten-Insights)
 *
 * Exit-Code 0 = keine FAIL-Checks (WARN sind erlaubt).
 */
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import StudyRepository from '../../src/core/database/repositories/study-repository.js'
import ObservationAuditRepository from '../../src/core/database/repositories/observation-audit-repository.js'
import { collectSchemaTriggers } from '../../src/core/database/migrations/016-recreate-triggers.js'

const MIGRATIONS = [
  ['001-core-schema', 'coreSchema'], ['002-views', 'databaseViews'], ['003-triggers', 'databaseTriggers'],
  ['004-study-tables', 'studyTables'], ['005-questionnaire-fieldset', 'questionnaireFieldSet'],
  ['006-fieldset-categories', 'fieldsetCategories'], ['007-parkinson-visit-types', 'parkinsonVisitTypes'],
  ['008-password-hashing', 'passwordHashing'], ['009-fix-patient-cascade', 'fixPatientCascade'],
  ['010-stroke-lipid-seed', 'strokeLipidSeed'], ['011-audit-valueflags', 'auditValueflags'],
  ['012-public-patient-access', 'publicPatientAccess'], ['013-provider-user-sync', 'providerUserSync'],
  ['014-raw-file-concepts', 'rawFileConcepts'], ['015-observation-audit-fact', 'observationAuditFact'],
  ['016-recreate-triggers', 'recreateTriggers'],
]
const EXPECTED_TABLES = ['PATIENT_DIMENSION', 'VISIT_DIMENSION', 'OBSERVATION_FACT', 'CONCEPT_DIMENSION', 'PROVIDER_DIMENSION', 'CODE_LOOKUP', 'USER_MANAGEMENT', 'USER_PATIENT_LOOKUP', 'NOTE_FACT', 'CQL_FACT', 'CONCEPT_CQL_LOOKUP', 'STUDY_DIMENSION', 'STUDY_PATIENT_LOOKUP', 'OBSERVATION_AUDIT_FACT', 'migrations']
const EXPECTED_VIEWS = ['patient_list', 'patient_observations']

// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const src = args.find((a) => !a.startsWith('--'))
if (!src || !fs.existsSync(src)) {
  console.error('usage: node scripts/db-check/check-db.mjs <db-file> [--keep] [--json out.json]')
  process.exit(2)
}
const keep = args.includes('--keep')
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null

fs.mkdirSync('tests/output', { recursive: true })
const work = path.join('tests/output', `db-check-${path.basename(src).replace(/[^\w.-]/g, '_')}`)
fs.copyFileSync(src, work)
for (const ext of ['-wal', '-shm']) if (fs.existsSync(src + ext)) fs.copyFileSync(src + ext, work + ext)

const results = [] // {section, name, status: PASS|WARN|FAIL|INFO, detail}
const add = (section, name, status, detail = '') => {
  results.push({ section, name, status, detail: String(detail) })
  const icon = { PASS: '✓', WARN: '⚠', FAIL: '✗', INFO: '·' }[status]
  console.log(`${icon} [${section}] ${name}${detail ? ' — ' + detail : ''}`)
}
const check = (section, name, ok, detail, warnOnly = false) => add(section, name, ok ? 'PASS' : warnOnly ? 'WARN' : 'FAIL', detail)

const c = new RealSQLiteConnection()
await c.connect(work)
const q = async (sql, params = []) => {
  const r = await c.executeQuery(sql, params)
  if (!r.success) throw new Error(`${r.error}\n${sql}`)
  return r.data
}
const one = async (sql, params = []) => Object.values((await q(sql, params))[0] || {})[0]
const timed = async (label, fn) => {
  const t0 = performance.now()
  const out = await fn()
  const ms = Math.round(performance.now() - t0)
  add('perf', label, ms > 2000 ? 'WARN' : 'PASS', `${ms} ms`)
  return out
}

console.log(`\n=== db-check: ${src} (${(fs.statSync(src).size / 1048576).toFixed(1)} MB) → Kopie ${work}\n`)

// 1. Migrationen -----------------------------------------------------------
{
  const mm = new MigrationManager(c)
  for (const [file, name] of MIGRATIONS) mm.registerMigration((await import(`../../src/core/database/migrations/${file}.js`))[name])
  const hasTable = await one("SELECT COUNT(*) FROM sqlite_master WHERE name='migrations'")
  const before = hasTable ? (await q('SELECT name FROM migrations')).map((r) => r.name) : []
  add('migration', 'Stand vor dem Lauf', 'INFO', `${before.length} Migrationen${before.length ? ', letzte: ' + before[before.length - 1] : ' (keine migrations-Tabelle)'}`)
  try {
    await timed('Migrationen ausführen', () => mm.initializeDatabase())
    const after = (await q('SELECT name FROM migrations ORDER BY id')).map((r) => r.name)
    const ran = after.filter((n) => !before.includes(n))
    add('migration', 'Neu ausgeführt', 'PASS', ran.length ? ran.join(', ') : 'nichts (bereits aktuell)')
    check('migration', 'Alle 16 Migrationen registriert', after.length === MIGRATIONS.length && MIGRATIONS.every(([f]) => after.includes(f)), `${after.length}/${MIGRATIONS.length}`)
  } catch (e) {
    add('migration', 'Migration fehlgeschlagen', 'FAIL', e.message)
  }
}

// 2. Integrität -------------------------------------------------------------
{
  const integrity = await timed('PRAGMA integrity_check', () => q('PRAGMA integrity_check'))
  check('integrity', 'integrity_check', integrity.length === 1 && integrity[0].integrity_check === 'ok', integrity.map((r) => r.integrity_check).join('; '))
  await c.executeCommand('PRAGMA foreign_keys = ON')
  const fk = await q('PRAGMA foreign_key_check')
  const byTable = {}
  for (const r of fk) byTable[r.table] = (byTable[r.table] || 0) + 1
  check('integrity', 'foreign_key_check', fk.length === 0, fk.length ? Object.entries(byTable).map(([t, n]) => `${t}: ${n}`).join(', ') : 'keine Verletzungen', true)
}

// 3. Schema ------------------------------------------------------------------
{
  const tables = (await q("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name)
  const views = (await q("SELECT name FROM sqlite_master WHERE type='view'")).map((r) => r.name)
  const triggers = (await q("SELECT name FROM sqlite_master WHERE type='trigger'")).map((r) => r.name)
  const missingT = EXPECTED_TABLES.filter((t) => !tables.includes(t))
  check('schema', 'Erwartete Tabellen', missingT.length === 0, missingT.length ? 'fehlen: ' + missingT.join(', ') : `${tables.length} Tabellen`)
  const missingV = EXPECTED_VIEWS.filter((v) => !views.includes(v))
  check('schema', 'Views', missingV.length === 0, missingV.length ? 'fehlen: ' + missingV.join(', ') : views.join(', '))
  const expectedTriggers = collectSchemaTriggers().map((t) => t.name)
  const missingTr = expectedTriggers.filter((t) => !triggers.includes(t))
  check('schema', `Trigger (${expectedTriggers.length} erwartet)`, missingTr.length === 0, missingTr.length ? 'fehlen: ' + missingTr.join(', ') : `${triggers.length} vorhanden`)
  const idx = await one("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
  add('schema', 'Indizes', 'INFO', `${idx} idx_*`)
  const fkAudit = await q('PRAGMA foreign_key_list(OBSERVATION_AUDIT_FACT)')
  check('schema', 'OBSERVATION_AUDIT_FACT FK ON DELETE CASCADE', fkAudit.some((r) => r.table === 'OBSERVATION_FACT' && r.on_delete === 'CASCADE'))
}

// 4. Zeilenzahlen -------------------------------------------------------------
const counts = {}
for (const t of EXPECTED_TABLES.filter((t) => t !== 'migrations')) {
  try { counts[t] = await one(`SELECT COUNT(*) FROM ${t}`) } catch { counts[t] = null }
}
add('counts', 'Zeilen', 'INFO', Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(' · '))

// 5. Konsistenz + Konventionen ------------------------------------------------
{
  const orphan = async (name, sql) => {
    const n = await one(sql)
    check('consistency', name, n === 0, `${n}`)
  }
  await orphan('Visiten ohne Patient', 'SELECT COUNT(*) FROM VISIT_DIMENSION v LEFT JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM=v.PATIENT_NUM WHERE p.PATIENT_NUM IS NULL')
  await orphan('Beobachtungen ohne Visite', 'SELECT COUNT(*) FROM OBSERVATION_FACT o LEFT JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM=o.ENCOUNTER_NUM WHERE v.ENCOUNTER_NUM IS NULL')
  await orphan('Beobachtungen ohne Patient', 'SELECT COUNT(*) FROM OBSERVATION_FACT o LEFT JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM=o.PATIENT_NUM WHERE p.PATIENT_NUM IS NULL')
  await orphan('Beobachtung/Visite mit abweichendem Patienten', 'SELECT COUNT(*) FROM OBSERVATION_FACT o JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM=o.ENCOUNTER_NUM WHERE v.PATIENT_NUM != o.PATIENT_NUM')
  const unknownConcepts = await q('SELECT o.CONCEPT_CD, COUNT(*) n FROM OBSERVATION_FACT o LEFT JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD=o.CONCEPT_CD WHERE c.CONCEPT_CD IS NULL GROUP BY o.CONCEPT_CD ORDER BY n DESC LIMIT 10')
  check('consistency', 'Beobachtungen mit unbekanntem Konzept', unknownConcepts.length === 0, unknownConcepts.map((r) => `${r.CONCEPT_CD} (${r.n})`).join(', '))
  await orphan('Einschreibungen ohne Patient/Studie', 'SELECT COUNT(*) FROM STUDY_PATIENT_LOOKUP spl LEFT JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM=spl.PATIENT_NUM LEFT JOIN STUDY_DIMENSION s ON s.STUDY_NUM=spl.STUDY_NUM WHERE p.PATIENT_NUM IS NULL OR s.STUDY_NUM IS NULL')
  await orphan('USER_PATIENT_LOOKUP ohne Patient', 'SELECT COUNT(*) FROM USER_PATIENT_LOOKUP upl LEFT JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM=upl.PATIENT_NUM WHERE p.PATIENT_NUM IS NULL')
  await orphan('USER_PATIENT_LOOKUP mit unbekanntem User (≠ 0)', 'SELECT COUNT(*) FROM USER_PATIENT_LOOKUP upl LEFT JOIN USER_MANAGEMENT u ON u.USER_ID=upl.USER_ID WHERE upl.USER_ID != 0 AND u.USER_ID IS NULL')
  await orphan('Doppelte PATIENT_CD', 'SELECT COUNT(*) FROM (SELECT PATIENT_CD FROM PATIENT_DIMENSION GROUP BY PATIENT_CD HAVING COUNT(*) > 1)')
  await orphan('Doppelte CONCEPT_CD', 'SELECT COUNT(*) FROM (SELECT CONCEPT_CD FROM CONCEPT_DIMENSION GROUP BY CONCEPT_CD HAVING COUNT(*) > 1)')

  // Zugriff: Patienten ohne jede UPL-Zeile sind für Nicht-Admins unsichtbar
  const invisible = await one('SELECT COUNT(*) FROM PATIENT_DIMENSION p WHERE NOT EXISTS (SELECT 1 FROM USER_PATIENT_LOOKUP upl WHERE upl.PATIENT_NUM=p.PATIENT_NUM)')
  check('access', 'Patienten ohne USER_PATIENT_LOOKUP-Zeile (für Nutzer unsichtbar)', invisible === 0, `${invisible}`, true)
  const pub = await one('SELECT COUNT(DISTINCT PATIENT_NUM) FROM USER_PATIENT_LOOKUP WHERE USER_ID = 0')
  const owned = await one("SELECT COUNT(DISTINCT PATIENT_NUM) FROM USER_PATIENT_LOOKUP WHERE NAME_CHAR = 'Creator access - auto-assigned'")
  add('access', 'Öffentlich / mit Creator-Zeile', 'INFO', `${pub} öffentlich · ${owned} mit Creator-Zeile · ${counts.PATIENT_DIMENSION} gesamt`)
  const perUser = await q("SELECT COALESCE(u.USER_CD, 'USER_ID=' || upl.USER_ID) user, COUNT(DISTINCT upl.PATIENT_NUM) n FROM USER_PATIENT_LOOKUP upl LEFT JOIN USER_MANAGEMENT u ON u.USER_ID=upl.USER_ID WHERE upl.USER_ID != 0 GROUP BY upl.USER_ID ORDER BY n DESC")
  add('access', 'Patienten pro Benutzer (Lookup-Zeilen)', 'INFO', perUser.map((r) => `${r.user}=${r.n}`).join(' · '))

  // Konventionen
  const catCodes = await one("SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CATEGORY_CHAR LIKE 'CAT_%'")
  check('convention', '§1 CATEGORY_CHAR ohne CAT_*-Codes (Konzepte)', catCodes === 0, `${catCodes}`)
  const catCodesObs = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE CATEGORY_CHAR LIKE 'CAT_%'")
  check('convention', '§1 CATEGORY_CHAR ohne CAT_*-Codes (Beobachtungen)', catCodesObs === 0, `${catCodesObs}`, true)
  const fNum = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALTYPE_CD='F' AND NVAL_NUM IS NOT NULL AND TVAL_CHAR IS NULL")
  check('convention', '§2 F-Findings mit Antwort in TVAL_CHAR (nicht NVAL_NUM)', fNum === 0, `${fNum} Zeilen mit NVAL_NUM`, true)
  // Answers must reference an A-type concept (Yes/No/unknown/k.A. …); free text is a smell
  const fBad = await one("SELECT COUNT(*) FROM OBSERVATION_FACT o WHERE o.VALTYPE_CD='F' AND o.TVAL_CHAR IS NOT NULL AND o.TVAL_CHAR != '' AND NOT EXISTS (SELECT 1 FROM CONCEPT_DIMENSION c WHERE c.CONCEPT_CD = o.TVAL_CHAR AND c.VALTYPE_CD = 'A')")
  check('convention', '§2 F-Findings verweisen auf A-Antwortkonzepte', fBad === 0, `${fBad} Freitext-/unbekannte Antworten`, true)
  const fBlank = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALTYPE_CD='F' AND (TVAL_CHAR IS NULL OR TVAL_CHAR = '') AND VALUEFLAG_CD IS NULL")
  add('convention', '§2 F-Findings ohne Antwort (leere Slots)', 'INFO', `${fBlank}`)
  const flagCodes = (await q("SELECT CODE_CD FROM CODE_LOOKUP WHERE TABLE_CD='OBSERVATION_FACT' AND COLUMN_CD='VALUEFLAG_CD'")).map((r) => r.CODE_CD)
  const flagsUsed = await q('SELECT VALUEFLAG_CD f, COUNT(*) n FROM OBSERVATION_FACT GROUP BY VALUEFLAG_CD')
  const unknownFlags = flagsUsed.filter((r) => r.f != null && !flagCodes.includes(r.f))
  check('convention', '§3 VALUEFLAG_CD nur registrierte Codes', unknownFlags.length === 0, flagsUsed.map((r) => `${r.f ?? 'NULL'}=${r.n}`).join(' · '))
  const nvWithValue = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALUEFLAG_CD='NV' AND (NVAL_NUM IS NOT NULL OR TVAL_CHAR IS NOT NULL)")
  check('convention', '§3 NV-Zeilen ohne Wert', nvWithValue === 0, `${nvWithValue}`)
  const rNoBlob = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALTYPE_CD='R' AND OBSERVATION_BLOB IS NULL")
  check('convention', '§3b R-Zeilen tragen ihre Datei im Blob', rNoBlob === 0, `${rNoBlob} ohne Blob`, true)
  const rBadEnvelope = (await q("SELECT TVAL_CHAR FROM OBSERVATION_FACT WHERE VALTYPE_CD='R'")).filter((r) => { try { const j = JSON.parse(r.TVAL_CHAR); return !j || !j.filename } catch { return true } }).length
  check('convention', '§3b R-Zeilen mit gültigem TVAL_CHAR-Envelope', rBadEnvelope === 0, `${rBadEnvelope} ungültig`, true)
  const bigBlobNonR = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALTYPE_CD != 'R' AND length(OBSERVATION_BLOB) > 100000")
  check('convention', 'Keine großen Blobs außerhalb von R', bigBlobNonR === 0, `${bigBlobNonR}`, true)
  const vtypes = await q("SELECT json_extract(VISIT_BLOB,'$.visitType') vt, COUNT(*) n FROM VISIT_DIMENSION GROUP BY vt ORDER BY n DESC")
  const knownVt = (await q("SELECT CODE_CD FROM CODE_LOOKUP WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='VISIT_TYPE_CD'")).map((r) => r.CODE_CD)
  const unknownVt = vtypes.filter((r) => r.vt != null && !knownVt.includes(r.vt))
  check('convention', '§5 Visitentypen in CODE_LOOKUP registriert', unknownVt.length === 0, unknownVt.length ? 'unbekannt: ' + unknownVt.map((r) => `${r.vt} (${r.n})`).join(', ') : vtypes.map((r) => `${r.vt ?? 'NULL'}=${r.n}`).join(' · '), true)
  const noDateEnrol = await one('SELECT COUNT(*) FROM STUDY_PATIENT_LOOKUP WHERE ENROLLMENT_DATE IS NULL')
  check('convention', 'Einschreibungen mit ENROLLMENT_DATE', noDateEnrol === 0, `${noDateEnrol} ohne Datum`, true)
  const vtDist = await q('SELECT VALTYPE_CD t, COUNT(*) n FROM OBSERVATION_FACT GROUP BY t ORDER BY n DESC')
  add('convention', 'VALTYPE-Verteilung', 'INFO', vtDist.map((r) => `${r.t ?? 'NULL'}=${r.n}`).join(' · '))
}

// 6. Audit-System --------------------------------------------------------------
{
  const open = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALUEFLAG_CD='AUDIT'")
  const confirmed = await one("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALUEFLAG_CD='CONFIRMED'")
  add('audit', 'Flags', 'INFO', `${open} offen · ${confirmed} geprüft`)
  const trailOrphans = await one('SELECT COUNT(*) FROM OBSERVATION_AUDIT_FACT a LEFT JOIN OBSERVATION_FACT o ON o.OBSERVATION_ID=a.OBSERVATION_ID WHERE o.OBSERVATION_ID IS NULL')
  check('audit', 'Trail ohne Waisen', trailOrphans === 0, `${trailOrphans}`)
  const trailMismatch = await one('SELECT COUNT(*) FROM OBSERVATION_AUDIT_FACT a JOIN OBSERVATION_FACT o ON o.OBSERVATION_ID=a.OBSERVATION_ID WHERE o.PATIENT_NUM != a.PATIENT_NUM OR o.ENCOUNTER_NUM != a.ENCOUNTER_NUM')
  check('audit', 'Trail-Zeilen mit passendem Patient/Visite', trailMismatch === 0, `${trailMismatch}`)
  const events = await q('SELECT EVENT_CD e, COUNT(*) n FROM OBSERVATION_AUDIT_FACT GROUP BY e')
  add('audit', 'Trail-Ereignisse', 'INFO', events.length ? events.map((r) => `${r.e}=${r.n}`).join(' · ') : 'leer')
  // Repository-Roundtrip auf der Kopie: markieren → Trail → Kaskade
  const auditRepo = new ObservationAuditRepository(c)
  const sample = (await q('SELECT OBSERVATION_ID FROM OBSERVATION_FACT WHERE VALTYPE_CD IN (\'N\',\'T\') AND VALUEFLAG_CD IS NULL LIMIT 1'))[0]
  if (sample) {
    const row = await auditRepo.logEvent({ observationId: sample.OBSERVATION_ID, eventCd: 'FLAG', flagCd: 'AUDIT', commentText: 'db-check', createdBy: 'db-check', source: 'CHECK' })
    check('audit', 'logEvent kopiert Patient/Visite', !!row && row.PATIENT_NUM != null && row.ENCOUNTER_NUM != null)
    await c.executeCommand('DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [sample.OBSERVATION_ID])
    const left = await one('SELECT COUNT(*) FROM OBSERVATION_AUDIT_FACT WHERE OBSERVATION_ID = ?', [sample.OBSERVATION_ID])
    check('audit', 'Löschen der Beobachtung räumt den Trail (Trigger/FK)', left === 0, `${left} übrig`)
  }
}

// 7. Echte Abfragepfade + Antwortzeiten ---------------------------------------
{
  const studies = await q('SELECT STUDY_NUM, STUDY_CD, NAME_CHAR FROM STUDY_DIMENSION')
  add('repo', 'Studien', 'INFO', studies.map((s) => `${s.STUDY_CD} (${s.NAME_CHAR})`).join(' · ') || 'keine')
  const studyRepo = new StudyRepository(c)
  for (const s of studies) {
    const counts = await timed(`Insights ${s.STUDY_CD}: getCohortPatientCount`, () => studyRepo.getCohortPatientCount(s.STUDY_CD))
    const perMonth = await timed(`Insights ${s.STUDY_CD}: getCohortEnrollmentsPerMonth`, () => studyRepo.getCohortEnrollmentsPerMonth(s.STUDY_CD))
    const monthSum = perMonth.months.reduce((a, m) => a + m.count, 0) + perMonth.undated
    check('repo', `Insights ${s.STUDY_CD}: Monatssumme = Eingeschriebene`, monthSum === counts.enrolled, `${monthSum} vs ${counts.enrolled} (${perMonth.undated} ohne Datum)`)
    const win = await timed(`Insights ${s.STUDY_CD}: Zeitraum-Filter`, () => studyRepo.getCohortPatientCount(s.STUDY_CD, { from: '2024-01-01', to: '2025-09-14' }))
    check('repo', `Insights ${s.STUDY_CD}: Zeitraum ⊆ Gesamt`, win.enrolled <= counts.enrolled, `${win.enrolled} ≤ ${counts.enrolled}`)
    await timed(`Insights ${s.STUDY_CD}: Drug usage`, () => studyRepo.getCohortDrugUsage(s.STUDY_CD, 'STROKE_LIPID:DRUG:'))
    await timed(`Insights ${s.STUDY_CD}: Findings`, () => studyRepo.getCohortFindingPrevalence(s.STUDY_CD))
    await timed(`Insights ${s.STUDY_CD}: Lab summary`, () => studyRepo.getCohortLabSummary(s.STUDY_CD, 'LID: 22748-8'))
    const audit = await timed(`Audit ${s.STUDY_CD}: getStudyAuditSummary`, () => studyRepo.getStudyAuditSummary(s.STUDY_NUM, null))
    add('repo', `Audit ${s.STUDY_CD}`, 'INFO', `${audit.total} offen · ${audit.byPatient.length} Patienten · ${audit.byUser.length} Nutzer`)
  }
  // Die schweren UI-Abfragen (Patientenliste, Zeitlinie des größten Patienten)
  await timed('Patientenliste (patient_list VIEW, Seite 1)', () => q('SELECT * FROM patient_list ORDER BY PATIENT_NUM DESC LIMIT 25'))
  await timed('Patientenliste: Zählung mit Zugriffsfilter (USER_ID 1 / öffentlich)', () => q('SELECT COUNT(*) FROM PATIENT_DIMENSION p WHERE EXISTS (SELECT 1 FROM USER_PATIENT_LOOKUP upl WHERE upl.PATIENT_NUM=p.PATIENT_NUM AND (upl.USER_ID = 1 OR upl.USER_ID = 0))'))
  const biggest = (await q('SELECT PATIENT_NUM, COUNT(*) n FROM OBSERVATION_FACT GROUP BY PATIENT_NUM ORDER BY n DESC LIMIT 1'))[0]
  if (biggest) {
    add('repo', 'Größter Patient', 'INFO', `PATIENT_NUM ${biggest.PATIENT_NUM} mit ${biggest.n} Beobachtungen`)
    check('repo', 'Zeitlinie lädt alle Beobachtungen (Limit 1000)', biggest.n <= 1000, `${biggest.n} ≤ 1000`, true)
    await timed('Zeitlinie: Visiten des größten Patienten', () => q('SELECT v.*, COUNT(o.OBSERVATION_ID) AS observationCount FROM VISIT_DIMENSION v LEFT JOIN OBSERVATION_FACT o ON o.ENCOUNTER_NUM = v.ENCOUNTER_NUM WHERE v.PATIENT_NUM = ? GROUP BY v.ENCOUNTER_NUM ORDER BY v.START_DATE DESC', [biggest.PATIENT_NUM]))
    await timed('Zeitlinie: alle Beobachtungen (patient_observations, Blob-Regel)', () => q("SELECT OBSERVATION_ID, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, TVAL_CHAR, NVAL_NUM, VALUEFLAG_CD, START_DATE, CASE WHEN VALTYPE_CD = 'R' THEN NULL ELSE OBSERVATION_BLOB END AS OBSERVATION_BLOB FROM patient_observations WHERE PATIENT_NUM = ? LIMIT 1000", [biggest.PATIENT_NUM]))
    await timed('Zeitlinie: Audit-Trail des Patienten', () => new ObservationAuditRepository(c).getTrailForPatient(biggest.PATIENT_NUM))
  }
  await timed('Dashboard: offene Audits', () => q("SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALUEFLAG_CD = 'AUDIT'"))
  await timed('Grid: Beobachtungen einer Visite × 50 Konzepte', () => q('SELECT o.* FROM OBSERVATION_FACT o WHERE o.ENCOUNTER_NUM IN (SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION ORDER BY START_DATE DESC LIMIT 50)'))
}

// Summary ----------------------------------------------------------------------
await c.disconnect()
const tally = results.reduce((t, r) => ((t[r.status] = (t[r.status] || 0) + 1), t), {})
console.log(`\n=== Ergebnis: ${tally.PASS || 0} PASS · ${tally.WARN || 0} WARN · ${tally.FAIL || 0} FAIL (${tally.INFO || 0} Info)`)
for (const r of results.filter((r) => r.status === 'FAIL')) console.log(`   ✗ ${r.section}: ${r.name} — ${r.detail}`)
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ source: src, results, counts }, null, 2))
if (!keep) for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(work + ext)) fs.unlinkSync(work + ext)
process.exit(tally.FAIL ? 1 : 0)
