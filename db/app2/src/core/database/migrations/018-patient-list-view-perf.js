/**
 * patient_list view — performance + age correctness
 *
 * Background (Sept 2026 audit): the original view (002-views) derived
 * AGE_IN_YEARS from a `ROW_NUMBER() OVER (PARTITION BY PATIENT_NUM …)`
 * subquery over ALL of OBSERVATION_FACT, filtered by five leading-wildcard
 * LIKEs on concept name / code / unit. SQLite has to MATERIALIZE that
 * subquery for EVERY query against the view — including `WHERE PATIENT_CD = ?`
 * and `SELECT COUNT(*)` — so the cost grows with the number of observations,
 * not with the number of patients (16–19 ms on a 22k-observation DB, hit
 * twice per dashboard load and twice per SmartSearch keystroke).
 *
 * It was also wrong: `LIKE '%age%'` matched both the real "Age" concept
 * (LID: 63900-5) and "Age at stroke event" (STROKE_LIPID:AGE_AT_STROKE), so a
 * Stroke-Lipid patient's card showed the age at a past event instead of the
 * stored AGE_IN_YEARS.
 *
 * This migration re-creates the view with a correlated scalar subquery on the
 * exact age concept (index seek on idx_observation_patient_num, pruned
 * entirely when the column is not selected), drops the redundant trailing
 * ORDER BY (every caller orders itself) and adds the indexes the dashboard /
 * study cards actually need. 002-views.js is left untouched so its migration
 * checksum stays valid.
 */

/** LOINC "Age" — the ONLY concept that may feed patient_list.AGE_IN_YEARS. */
export const AGE_CONCEPT_CD = 'LID: 63900-5'

export const PATIENT_LIST_VIEW_SQL = `CREATE VIEW patient_list AS
SELECT
    PATIENT_DIMENSION.PATIENT_NUM as PATIENT_NUM,
    PATIENT_DIMENSION.PATIENT_CD as PATIENT_CD,
    PATIENT_DIMENSION.IMPORT_DATE as IMPORT_DATE,
    PATIENT_DIMENSION.UPDATE_DATE as UPDATE_DATE,
    PATIENT_DIMENSION.BIRTH_DATE as BIRTH_DATE,
    PATIENT_DIMENSION.DEATH_DATE as DEATH_DATE,
    -- Age: latest "Age" observation (exact concept), then stored AGE_IN_YEARS,
    -- then derived from BIRTH_DATE. Correlated scalar subquery = index seek.
    COALESCE(
      (SELECT o.NVAL_NUM
         FROM OBSERVATION_FACT o
        WHERE o.PATIENT_NUM = PATIENT_DIMENSION.PATIENT_NUM
          AND o.CONCEPT_CD = '${AGE_CONCEPT_CD}'
          AND o.NVAL_NUM IS NOT NULL
        ORDER BY o.START_DATE DESC
        LIMIT 1),
      PATIENT_DIMENSION.AGE_IN_YEARS,
      CASE
        WHEN PATIENT_DIMENSION.BIRTH_DATE IS NOT NULL THEN
          CAST(
            (julianday('now') - julianday(PATIENT_DIMENSION.BIRTH_DATE)) / 365.25 AS INTEGER
          )
        ELSE NULL
      END
    ) as AGE_IN_YEARS,
    PATIENT_DIMENSION.SEX_CD as SEX_CD,
    SEX.NAME_CHAR as SEX_RESOLVED,
    PATIENT_DIMENSION.VITAL_STATUS_CD as VITAL_STATUS_CD,
    STATUS.NAME_CHAR as VITAL_STATUS_RESOLVED,
    PATIENT_DIMENSION.LANGUAGE_CD as LANGUAGE_CD,
    LANG.NAME_CHAR as LANGUAGE_RESOLVED,
    PATIENT_DIMENSION.RACE_CD as RACE_CD,
    RACE.NAME_CHAR as RACE_RESOLVED,
    PATIENT_DIMENSION.MARITAL_STATUS_CD as MARITAL_STATUS_CD,
    MARITAL.NAME_CHAR as MARITAL_STATUS_RESOLVED,
    PATIENT_DIMENSION.RELIGION_CD as RELIGION_CD,
    REL.NAME_CHAR as RELIGION_RESOLVED,
    PATIENT_DIMENSION.STATECITYZIP_PATH as STATECITYZIP_PATH,
    PATIENT_DIMENSION.PATIENT_BLOB as PATIENT_BLOB,
    PATIENT_DIMENSION.SOURCESYSTEM_CD as SOURCESYSTEM_CD,
    PATIENT_DIMENSION.UPLOAD_ID as UPLOAD_ID,
    PATIENT_DIMENSION.CREATED_AT as CREATED_AT,
    PATIENT_DIMENSION.UPDATED_AT as UPDATED_AT
FROM
    PATIENT_DIMENSION
LEFT JOIN CONCEPT_DIMENSION AS SEX ON SEX.CONCEPT_CD = PATIENT_DIMENSION.SEX_CD
LEFT JOIN CONCEPT_DIMENSION AS STATUS ON STATUS.CONCEPT_CD = PATIENT_DIMENSION.VITAL_STATUS_CD
LEFT JOIN CONCEPT_DIMENSION AS LANG ON LANG.CONCEPT_CD = PATIENT_DIMENSION.LANGUAGE_CD
LEFT JOIN CONCEPT_DIMENSION AS RACE ON RACE.CONCEPT_CD = PATIENT_DIMENSION.RACE_CD
LEFT JOIN CONCEPT_DIMENSION AS MARITAL ON MARITAL.CONCEPT_CD = PATIENT_DIMENSION.MARITAL_STATUS_CD
LEFT JOIN CONCEPT_DIMENSION AS REL ON REL.CONCEPT_CD = PATIENT_DIMENSION.RELIGION_CD`

export const PERF_INDEXES = [
  // Open-audit counters (dashboard tile, study cards, StudyAuditPanel) filter
  // on VALUEFLAG_CD = 'AUDIT' — a partial index keeps it tiny (flags are rare)
  // and the second column serves the access-filtered / study-joined variants.
  `CREATE INDEX IF NOT EXISTS idx_observation_valueflag
     ON OBSERVATION_FACT(VALUEFLAG_CD, PATIENT_NUM)
     WHERE VALUEFLAG_CD IS NOT NULL`,
  // Dashboard "recent patients" orders by exactly this expression.
  `CREATE INDEX IF NOT EXISTS idx_patient_recent
     ON PATIENT_DIMENSION(COALESCE(UPDATE_DATE, IMPORT_DATE))`,
]

export const patientListViewPerf = {
  name: '018-patient-list-view-perf',
  description: 'patient_list: exact age concept instead of full-table LIKE scan; drop trailing ORDER BY; audit/recent indexes',
  execute: async (connection) => {
    const statements = ['DROP VIEW IF EXISTS patient_list', PATIENT_LIST_VIEW_SQL, ...PERF_INDEXES, 'ANALYZE']
    for (const statement of statements) {
      await connection.executeCommand(statement)
    }
  },
}
