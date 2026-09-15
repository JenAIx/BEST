/**
 * Observation audit trail
 *
 * OBSERVATION_FACT.VALUEFLAG_CD stays the single source of truth for the
 * CURRENT audit state (AUDIT / CONFIRMED / NV / NULL). This table records the
 * HISTORY behind it — who flagged, who resolved, when, and the comments
 * discussed along the way — one row per event, linked to the observation:
 *
 *   EVENT_CD   'FLAG'        VALUEFLAG_CD transition (FLAG_CD = new value)
 *              'COMMENT'     free-text comment, no state change
 *              'VALUE_EDIT'  a value edit reset a review flag (FLAG_CD = NULL)
 *
 * Why a dedicated table (and not NOTE_FACT / OBSERVATION_BLOB):
 *   - real FK to OBSERVATION_FACT with ON DELETE CASCADE + explicit trigger
 *     (NOTE_FACT has no OBSERVATION_ID; OBSERVATION_BLOB is nulled on every
 *     value save and carries Q/M/R payloads)
 *   - indexed lookups per observation / patient / visit
 *   - the trail survives value edits and flag resets
 *
 * Statements run one by one on purpose: the Electron preload used to split
 * multi-statement SQL on ';', which cuts CREATE TRIGGER bodies in half.
 */

export const OBSERVATION_AUDIT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS OBSERVATION_AUDIT_FACT (
      AUDIT_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      OBSERVATION_ID INTEGER NOT NULL,
      PATIENT_NUM INTEGER NOT NULL,
      ENCOUNTER_NUM INTEGER NOT NULL,
      EVENT_CD TEXT NOT NULL,
      FLAG_CD TEXT,
      COMMENT_TEXT TEXT,
      CREATED_BY TEXT,
      CREATED_AT TEXT NOT NULL DEFAULT (datetime('now')),
      SOURCESYSTEM_CD TEXT,
      FOREIGN KEY (OBSERVATION_ID) REFERENCES OBSERVATION_FACT(OBSERVATION_ID) ON DELETE CASCADE
    )`,
  'CREATE INDEX IF NOT EXISTS idx_obs_audit_observation ON OBSERVATION_AUDIT_FACT(OBSERVATION_ID)',
  'CREATE INDEX IF NOT EXISTS idx_obs_audit_patient ON OBSERVATION_AUDIT_FACT(PATIENT_NUM)',
  'CREATE INDEX IF NOT EXISTS idx_obs_audit_encounter ON OBSERVATION_AUDIT_FACT(ENCOUNTER_NUM)',
]

// Belt and braces: the app enables PRAGMA foreign_keys, but the existing
// cascade triggers (visit / patient delete) work without it — so does this.
export const OBSERVATION_AUDIT_TRIGGER = {
  name: 'delete_observation_audit_cascade',
  sql: `CREATE TRIGGER delete_observation_audit_cascade
    BEFORE DELETE ON OBSERVATION_FACT
    FOR EACH ROW
    BEGIN
      DELETE FROM OBSERVATION_AUDIT_FACT WHERE OBSERVATION_ID = OLD.OBSERVATION_ID;
    END`,
}

export const observationAuditFact = {
  name: '015-observation-audit-fact',
  description: 'Add OBSERVATION_AUDIT_FACT: per-observation audit trail (flag transitions + comments)',
  execute: async (connection) => {
    for (const sql of OBSERVATION_AUDIT_STATEMENTS) {
      await connection.executeCommand(sql)
    }
    await connection.executeCommand(`DROP TRIGGER IF EXISTS ${OBSERVATION_AUDIT_TRIGGER.name}`)
    await connection.executeCommand(OBSERVATION_AUDIT_TRIGGER.sql)
  },
}
