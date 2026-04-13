/**
 * Migration 005: Add questionnaires field set to CODE_LOOKUP
 *
 * Ensures the "questionnaires" field set exists for visit data entry,
 * and the CUSTOM: QUESTIONNAIRE concept exists in CONCEPT_DIMENSION.
 */

export const questionnaireFieldSet = {
  name: '005-questionnaire-fieldset',
  description: 'Add questionnaires field set and ensure questionnaire concept exists',
  execute: async (connection) => {
    // Add questionnaires field set (INSERT OR IGNORE to be idempotent)
    await connection.executeCommand(
      `INSERT OR IGNORE INTO CODE_LOOKUP
        (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID)
       VALUES
        ('VISIT_DIMENSION', 'FIELD_SET_CD', 'questionnaires', 'Fragebögen',
         '{"description":"Fragebögen und Surveys (MoCA, BDI, etc.)","icon":"quiz","concepts":["CUSTOM: QUESTIONNAIRE"]}',
         datetime('now'), datetime('now'), 'SYSTEM', 1)`,
    )

    // Ensure the CUSTOM: QUESTIONNAIRE concept exists
    await connection.executeCommand(
      `INSERT OR IGNORE INTO CONCEPT_DIMENSION
        (CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, UPDATE_DATE, DOWNLOAD_DATE, IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID)
       VALUES
        ('CUSTOM: QUESTIONNAIRE', 'CUSTOM: QUESTIONNAIRE', 'Survey Best - Questionnaire',
         datetime('now'), datetime('now'), datetime('now'), 'CUSTOM', 79190712)`,
    )
  },
}
