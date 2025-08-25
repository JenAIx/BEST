/**
 * Migration: Add Cascade Deletion Triggers
 * Implements database triggers for automatic cascade deletions
 * Based on the demo database pattern from test_DB_v20231222.db
 */

export const addCascadeTriggers = {
  name: '004-add-cascade-triggers',
  description: 'Add database triggers for cascade deletions (patient->visits->observations)',
  execute: async (connection) => {
    const statements = [
      // Drop existing triggers if they exist (for idempotency)
      'DROP TRIGGER IF EXISTS delete_patient_cascade',
      'DROP TRIGGER IF EXISTS delete_visit_cascade',
      'DROP TRIGGER IF EXISTS delete_concept_cql_lookup',
      'DROP TRIGGER IF EXISTS delete_concept_cascade',
      'DROP TRIGGER IF EXISTS delete_user_cascade',

      // Trigger: When a patient is deleted, cascade delete visits and user-patient lookups
      `CREATE TRIGGER [delete_patient_cascade]
BEFORE DELETE
ON [PATIENT_DIMENSION]
FOR EACH ROW
BEGIN
DELETE FROM VISIT_DIMENSION WHERE VISIT_DIMENSION.PATIENT_NUM = old.PATIENT_NUM;
DELETE FROM USER_PATIENT_LOOKUP WHERE USER_PATIENT_LOOKUP.PATIENT_NUM = old.PATIENT_NUM;
END`,

      // Trigger: When a visit is deleted, cascade delete all observations
      `CREATE TRIGGER [delete_visit_cascade]
BEFORE DELETE
ON [VISIT_DIMENSION]
FOR EACH ROW
BEGIN
DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_FACT.ENCOUNTER_NUM = old.ENCOUNTER_NUM;
END`,

      // Trigger: When a CQL rule is deleted, cascade delete concept-CQL lookups
      `CREATE TRIGGER [delete_concept_cql_lookup]
BEFORE DELETE
ON [CQL_FACT]
FOR EACH ROW
BEGIN
DELETE FROM CONCEPT_CQL_LOOKUP WHERE CONCEPT_CQL_LOOKUP.CQL_ID = old.CQL_ID;
END`,

      // Trigger: When a concept is deleted, cascade delete concept-CQL lookups
      `CREATE TRIGGER [delete_concept_cascade]
BEFORE DELETE
ON [CONCEPT_DIMENSION]
FOR EACH ROW
BEGIN
DELETE FROM CONCEPT_CQL_LOOKUP WHERE CONCEPT_CQL_LOOKUP.CONCEPT_CD = old.CONCEPT_CD;
END`,

      // Trigger: When a user is deleted, cascade delete user-patient lookups
      `CREATE TRIGGER [delete_user_cascade]
BEFORE DELETE
ON [USER_MANAGEMENT]
FOR EACH ROW
BEGIN
DELETE FROM USER_PATIENT_LOOKUP WHERE USER_PATIENT_LOOKUP.USER_ID = old.USER_ID;
END`,
    ]

    // Execute each statement individually
    for (const statement of statements) {
      await connection.executeCommand(statement)
    }
  },
}
