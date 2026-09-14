/**
 * Re-create every trigger the schema relies on — idempotently, one statement
 * at a time.
 *
 * Background: the Electron preload split multi-statement migration SQL on
 * ';' (fixed alongside this migration). A CREATE TRIGGER body contains
 * semicolons, so 003-triggers, 009-fix-patient-cascade and 015 could not
 * create their triggers through the app — databases initialised by the
 * Electron app carry NO triggers at all (verified on the dev DB, Sept 2026):
 * no patient/visit delete cascades for NOTE_FACT, no UPDATE_DATE bumps, no
 * audit-trail cascade. This migration heals such databases; on healthy ones
 * it simply drops and re-creates the same triggers.
 */
import { databaseTriggers } from './003-triggers.js'
import { fixPatientCascade } from './009-fix-patient-cascade.js'
import { OBSERVATION_AUDIT_TRIGGER } from './015-observation-audit-fact.js'

const TRIGGER_RE = /CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)[\s\S]*?\bEND\b/gi

/** Extract every CREATE TRIGGER … END block (name + DDL) from a migration's SQL. */
export function extractTriggerStatements(sql) {
  const out = []
  for (const match of sql.matchAll(TRIGGER_RE)) {
    out.push({ name: match[1], sql: match[0].replace(/\s+/g, ' ').trim() })
  }
  return out
}

export function collectSchemaTriggers() {
  const seen = new Map()
  // later definitions win (009 replaces the patient cascade from 003)
  for (const t of [...extractTriggerStatements(databaseTriggers.sql), ...extractTriggerStatements(fixPatientCascade.sql), OBSERVATION_AUDIT_TRIGGER]) {
    seen.set(t.name, t)
  }
  return [...seen.values()]
}

export const recreateTriggers = {
  name: '016-recreate-triggers',
  description: 'Re-create all schema triggers statement by statement (heals DBs migrated through the old Electron SQL splitter)',
  execute: async (connection) => {
    for (const trigger of collectSchemaTriggers()) {
      await connection.executeCommand(`DROP TRIGGER IF EXISTS ${trigger.name}`)
      await connection.executeCommand(trigger.sql)
    }
  },
}
