/**
 * Optimistic locking for OBSERVATION_FACT — VERSION column + guard trigger.
 *
 * Several users edit the same observations from separate app instances on
 * one shared file. Until now every write was "last writer wins": user A's
 * stale form value silently overwrote user B's newer one. Every write now
 * carries `AND VERSION = ?` (the version the client loaded) and bumps
 * `VERSION = VERSION + 1`; zero affected rows means "changed elsewhere" and
 * the UI reloads that observation instead of pretending success.
 *
 * Why an integer VERSION and not UPDATE_DATE: UPDATE_DATE has second
 * resolution (two commits in one second are indistinguishable), mixed
 * formats, is NULL on rows the visits page wrote for years, and the client
 * cannot know the post-write value without a re-read. VERSION is exact,
 * monotonic, clock-skew-free across hosts and the next value is `n + 1`.
 *
 * The guard trigger bumps VERSION (and fills UPDATE_DATE) for every UPDATE
 * that did not do so itself — legacy paths and app versions still running
 * against the shared file — so new clients detect their writes too. The
 * WHEN clause makes it a no-op for statements that already bumped, and
 * prevents recursion.
 *
 * `patient_observations` is re-created with the VERSION column (002's SQL
 * plus one line, minus the trailing ORDER BY every caller repeats anyway);
 * 002 stays untouched so its checksum remains valid.
 */

export const OBSERVATION_VERSION_TRIGGER = {
  name: 'observation_version_guard',
  sql: `CREATE TRIGGER observation_version_guard
    AFTER UPDATE ON OBSERVATION_FACT
    FOR EACH ROW
    WHEN NEW.VERSION IS OLD.VERSION
    BEGIN
      UPDATE OBSERVATION_FACT
         SET VERSION = OLD.VERSION + 1,
             UPDATE_DATE = CASE WHEN NEW.UPDATE_DATE IS OLD.UPDATE_DATE THEN datetime('now') ELSE NEW.UPDATE_DATE END
       WHERE OBSERVATION_ID = NEW.OBSERVATION_ID;
    END`,
}

export const PATIENT_OBSERVATIONS_VIEW_SQL = `CREATE VIEW patient_observations AS
SELECT
    PATIENT_DIMENSION.PATIENT_CD as PATIENT_CD,
    PATIENT_DIMENSION.PATIENT_NUM as PATIENT_NUM,
    VISIT_DIMENSION.ENCOUNTER_NUM as ENCOUNTER_NUM,
    OBSERVATION_FACT.START_DATE as START_DATE,
    OBSERVATION_FACT.OBSERVATION_ID as OBSERVATION_ID,
    OBSERVATION_FACT.CATEGORY_CHAR as CATEGORY_CHAR,
    OBSERVATION_FACT.CONCEPT_CD as CONCEPT_CD,
    CD1.NAME_CHAR as CONCEPT_NAME_CHAR,
    CD1.CONCEPT_BLOB as CONCEPT_DESCRIPTION,
    OBSERVATION_FACT.VALTYPE_CD as VALTYPE_CD,
    OBSERVATION_FACT.NVAL_NUM as NVAL_NUM,
    OBSERVATION_FACT.UNIT_CD as UNIT_CD,
    CD3.NAME_CHAR as UNIT_RESOLVED,
    OBSERVATION_FACT.TVAL_CHAR as TVAL_CHAR,
    CD2.NAME_CHAR as TVAL_RESOLVED,
    OBSERVATION_FACT.OBSERVATION_BLOB as OBSERVATION_BLOB,
    OBSERVATION_FACT.LOCATION_CD as LOCATION_CD,
    OBSERVATION_FACT.PROVIDER_ID as PROVIDER_ID,
    OBSERVATION_FACT.END_DATE as END_DATE,
    OBSERVATION_FACT.INSTANCE_NUM as INSTANCE_NUM,
    OBSERVATION_FACT.VALUEFLAG_CD as VALUEFLAG_CD,
    OBSERVATION_FACT.QUANTITY_NUM as QUANTITY_NUM,
    OBSERVATION_FACT.CONFIDENCE_NUM as CONFIDENCE_NUM,
    OBSERVATION_FACT.UPDATE_DATE as UPDATE_DATE,
    OBSERVATION_FACT.DOWNLOAD_DATE as DOWNLOAD_DATE,
    OBSERVATION_FACT.IMPORT_DATE as IMPORT_DATE,
    OBSERVATION_FACT.SOURCESYSTEM_CD as SOURCESYSTEM_CD,
    OBSERVATION_FACT.UPLOAD_ID as UPLOAD_ID,
    OBSERVATION_FACT.VERSION as VERSION
FROM
    OBSERVATION_FACT
INNER JOIN PATIENT_DIMENSION ON
    PATIENT_DIMENSION.PATIENT_NUM = OBSERVATION_FACT.PATIENT_NUM
INNER JOIN VISIT_DIMENSION ON
    VISIT_DIMENSION.ENCOUNTER_NUM = OBSERVATION_FACT.ENCOUNTER_NUM
LEFT JOIN CONCEPT_DIMENSION AS CD1 ON
    CD1.CONCEPT_CD = OBSERVATION_FACT.CONCEPT_CD
LEFT JOIN CONCEPT_DIMENSION AS CD2 ON
    CD2.CONCEPT_CD = OBSERVATION_FACT.TVAL_CHAR
LEFT JOIN CONCEPT_DIMENSION AS CD3 ON
    CD3.CONCEPT_CD = OBSERVATION_FACT.UNIT_CD`

export const observationVersion = {
  name: '019-observation-version',
  description: 'OBSERVATION_FACT.VERSION for optimistic locking + guard trigger; patient_observations exposes VERSION',
  execute: async (connection) => {
    // ALTER TABLE ADD COLUMN is not idempotent — check first (re-runs, check-db)
    const info = await connection.executeQuery('PRAGMA table_info(OBSERVATION_FACT)')
    const hasVersion = (info?.data || []).some((col) => String(col.name).toUpperCase() === 'VERSION')
    if (!hasVersion) {
      await connection.executeCommand('ALTER TABLE OBSERVATION_FACT ADD COLUMN VERSION INTEGER NOT NULL DEFAULT 0')
    }
    await connection.executeCommand('DROP VIEW IF EXISTS patient_observations')
    await connection.executeCommand(PATIENT_OBSERVATIONS_VIEW_SQL)
    await connection.executeCommand(`DROP TRIGGER IF EXISTS ${OBSERVATION_VERSION_TRIGGER.name}`)
    await connection.executeCommand(OBSERVATION_VERSION_TRIGGER.sql)
  },
}
