// Raw-file concepts for the visits upload area.
//
// Files dropped on the patient visits view are stored as VALTYPE_CD='R'
// observations (metadata JSON in TVAL_CHAR, bytes in OBSERVATION_BLOB — see
// database-store.uploadRawData). The upload dialog suggests a category from
// the file name/extension (src/shared/utils/file-category.js); each category
// maps to one of these concepts. CUSTOM: RAW_DATA (generic) and
// CUSTOM: RAW_IMAGE already exist in the seeds — this migration adds the
// missing video / document / consent concepts.
//
// Self-healing upsert: re-running refreshes names/categories.

const CONCEPTS = [
  ['\\CUSTOM\\RAW\\VIDEO', 'CUSTOM: RAW_VIDEO', 'Videodatei', 'R', 'Raw Data'],
  ['\\CUSTOM\\RAW\\DOCUMENT', 'CUSTOM: RAW_DOCUMENT', 'Dokument', 'R', 'Raw Data'],
  ['\\CUSTOM\\RAW\\CONSENT', 'CUSTOM: RAW_CONSENT', 'Aufklärung / Einwilligung', 'R', 'Raw Data'],
]

export const rawFileConcepts = {
  name: '014-raw-file-concepts',
  description: 'Seed raw-file concepts (video/document/consent) for the visits upload area',
  execute: async (connection) => {
    for (const [path, code, name, valtype, category] of CONCEPTS) {
      await connection.executeCommand(
        `INSERT INTO CONCEPT_DIMENSION (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD, CATEGORY_CHAR, SOURCESYSTEM_CD, UPDATE_DATE, IMPORT_DATE)
         VALUES (?, ?, ?, ?, ?, 'RAW_FILE_MIGRATION', datetime('now'), datetime('now'))
         ON CONFLICT(CONCEPT_CD) DO UPDATE SET
           CONCEPT_PATH = excluded.CONCEPT_PATH,
           NAME_CHAR = excluded.NAME_CHAR,
           VALTYPE_CD = excluded.VALTYPE_CD,
           CATEGORY_CHAR = excluded.CATEGORY_CHAR,
           UPDATE_DATE = excluded.UPDATE_DATE`,
        [path, code, name, valtype, category],
      )
    }
  },
}
