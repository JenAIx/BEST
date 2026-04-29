/**
 * Patient Cascade Fix Migration
 * Extends delete_patient_cascade to also remove orphan NOTE_FACT and
 * OBSERVATION_FACT rows that reference the patient directly (without going
 * through a visit). The original trigger only deleted via the visit cascade,
 * which left dangling rows that blocked DELETE FROM PATIENT_DIMENSION with a
 * FOREIGN KEY constraint failure.
 */

export const fixPatientCascade = {
  name: '009-fix-patient-cascade',
  description: 'Extend delete_patient_cascade trigger to clear NOTE_FACT and OBSERVATION_FACT by PATIENT_NUM',
  sql: `
    DROP TRIGGER IF EXISTS delete_patient_cascade;

    CREATE TRIGGER delete_patient_cascade
    BEFORE DELETE ON PATIENT_DIMENSION
    FOR EACH ROW
    BEGIN
      DELETE FROM NOTE_FACT WHERE PATIENT_NUM = OLD.PATIENT_NUM;
      DELETE FROM OBSERVATION_FACT WHERE PATIENT_NUM = OLD.PATIENT_NUM;
      DELETE FROM VISIT_DIMENSION WHERE PATIENT_NUM = OLD.PATIENT_NUM;
      DELETE FROM USER_PATIENT_LOOKUP WHERE PATIENT_NUM = OLD.PATIENT_NUM;
    END;
  `,
}
