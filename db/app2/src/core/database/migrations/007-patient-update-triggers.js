/**
 * Migration: Patient UPDATE_DATE Auto-Update Triggers
 * Implements database triggers to automatically update PATIENT_DIMENSION.UPDATE_DATE
 * when patient data or related visits/observations are modified
 */

export const patientUpdateTriggers = {
  name: '007-patient-update-triggers',
  description: 'Add triggers to automatically update PATIENT_DIMENSION.UPDATE_DATE when patient, visit, or observation data changes',
  execute: async (connection) => {
    const statements = [
      // Drop existing triggers if they exist (for idempotency)
      'DROP TRIGGER IF EXISTS update_patient_on_patient_update',
      'DROP TRIGGER IF EXISTS update_patient_on_visit_insert',
      'DROP TRIGGER IF EXISTS update_patient_on_visit_update',
      'DROP TRIGGER IF EXISTS update_patient_on_visit_delete',
      'DROP TRIGGER IF EXISTS update_patient_on_observation_insert',
      'DROP TRIGGER IF EXISTS update_patient_on_observation_update',
      'DROP TRIGGER IF EXISTS update_patient_on_observation_delete',

      // Trigger 1: Update patient UPDATE_DATE when patient data is directly modified
      `CREATE TRIGGER update_patient_on_patient_update
AFTER UPDATE
ON PATIENT_DIMENSION
FOR EACH ROW
WHEN NEW.UPDATE_DATE = OLD.UPDATE_DATE OR NEW.UPDATE_DATE IS NULL
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = NEW.PATIENT_NUM;
END`,

      // Trigger 2: Update patient UPDATE_DATE when a visit is added
      `CREATE TRIGGER update_patient_on_visit_insert
AFTER INSERT
ON VISIT_DIMENSION
FOR EACH ROW
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = NEW.PATIENT_NUM;
END`,

      // Trigger 3: Update patient UPDATE_DATE when a visit is modified
      `CREATE TRIGGER update_patient_on_visit_update
AFTER UPDATE
ON VISIT_DIMENSION
FOR EACH ROW
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = NEW.PATIENT_NUM;
END`,

      // Trigger 4: Update patient UPDATE_DATE when a visit is deleted
      `CREATE TRIGGER update_patient_on_visit_delete
AFTER DELETE
ON VISIT_DIMENSION
FOR EACH ROW
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = OLD.PATIENT_NUM;
END`,

      // Trigger 5: Update patient UPDATE_DATE when an observation is added
      `CREATE TRIGGER update_patient_on_observation_insert
AFTER INSERT
ON OBSERVATION_FACT
FOR EACH ROW
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = NEW.PATIENT_NUM;
END`,

      // Trigger 6: Update patient UPDATE_DATE when an observation is modified
      `CREATE TRIGGER update_patient_on_observation_update
AFTER UPDATE
ON OBSERVATION_FACT
FOR EACH ROW
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = NEW.PATIENT_NUM;
END`,

      // Trigger 7: Update patient UPDATE_DATE when an observation is deleted
      `CREATE TRIGGER update_patient_on_observation_delete
AFTER DELETE
ON OBSERVATION_FACT
FOR EACH ROW
BEGIN
  UPDATE PATIENT_DIMENSION
  SET UPDATE_DATE = datetime('now')
  WHERE PATIENT_NUM = OLD.PATIENT_NUM;
END`,
    ]

    // Execute each statement individually using executeQuery to avoid SQL splitting issues
    for (const statement of statements) {
      if (statement.startsWith('DROP TRIGGER')) {
        // Drop statements can use executeCommand safely
        await connection.executeCommand(statement)
      } else {
        // Trigger creation must use executeQuery to avoid semicolon splitting
        await connection.executeQuery(statement, [])
      }
    }
  },
}
