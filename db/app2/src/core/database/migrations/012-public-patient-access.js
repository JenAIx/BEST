// Backfill public access for patients without any USER_PATIENT_LOOKUP entry.
//
// Access model: a regular user sees a patient when USER_PATIENT_LOOKUP links the
// patient to that user OR to the public user (USER_ID = 0). Patients created
// before access control (and bulk imports like the 425 Stroke-Lipid patients)
// have no lookup rows at all, so they are invisible to every non-admin user.
// This migration assigns each such patient to the public user, making the
// pre-existing data visible to everyone — matching the new "public by default"
// behaviour of the create-patient dialog.
//
// Idempotent via NOT EXISTS (USER_PATIENT_LOOKUP has no UNIQUE(USER_ID, PATIENT_NUM),
// so INSERT OR IGNORE would not prevent duplicates on re-run).

export const publicPatientAccess = {
  name: '012-public-patient-access',
  description: 'Assign patients without any user association to the public user (USER_ID 0)',
  execute: async (connection) => {
    await connection.executeCommand(
      `INSERT INTO USER_PATIENT_LOOKUP (USER_ID, PATIENT_NUM, NAME_CHAR, UPDATE_DATE, IMPORT_DATE)
       SELECT 0, p.PATIENT_NUM, 'Public access - migration backfill', datetime('now'), datetime('now')
       FROM PATIENT_DIMENSION p
       WHERE NOT EXISTS (
         SELECT 1 FROM USER_PATIENT_LOOKUP upl WHERE upl.PATIENT_NUM = p.PATIENT_NUM
       )`,
    )
  },
}
