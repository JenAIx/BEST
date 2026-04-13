/**
 * Migration 006: Add CATEGORY_CHAR mappings to FieldSets and FieldSet defaults to VisitTypes
 *
 * This migration:
 * 1. Adds `categories` arrays to FieldSet LOOKUP_BLOBs for hybrid matching
 *    (concept-code match first, then CATEGORY_CHAR fallback)
 * 2. Adds default FieldSet assignments to VisitTypes that currently have none
 */

export const fieldsetCategories = {
  name: '006-fieldset-categories',
  description: 'Add CATEGORY_CHAR mappings to FieldSets and FieldSet defaults to VisitTypes',
  execute: async (connection) => {
    // 1. Update FieldSet definitions with categories

    const fieldSetUpdates = [
      {
        code: 'vitals',
        blob: JSON.stringify({
          description: 'Blood pressure, heart rate, temperature, respiratory rate, oxygen saturation',
          icon: 'favorite',
          concepts: ['LID: 8480-6', 'LID: 8462-4', 'LID: 8867-4', 'LID: 8310-5', 'LID: 9279-1', 'LID: 2708-6'],
          categories: ['Vital Signs'],
        }),
      },
      {
        code: 'symptoms',
        blob: JSON.stringify({
          description: 'Patient reported symptoms and complaints',
          icon: 'sick',
          concepts: ['SCTID: 25064002', 'SCTID: 49727002', 'SCTID: 267036007', 'SCTID: 21522001', 'SCTID: 386661006', 'SCTID: 84229001'],
          categories: ['Neurological Assessment', 'Sleep Assessment'],
        }),
      },
      {
        code: 'physical',
        blob: JSON.stringify({
          description: 'Physical examination findings and demographics',
          icon: 'medical_services',
          concepts: ['SCTID: 5880005', 'SCTID: 32750006', 'SCTID: 113011001', 'SCTID: 37931006'],
          categories: ['Demographics'],
        }),
      },
      {
        code: 'medications',
        blob: JSON.stringify({
          description: 'Current medications and dosages',
          icon: 'medication',
          concepts: ['LID: 52418-1'],
          categories: ['Medications'],
        }),
      },
      {
        code: 'lab',
        blob: JSON.stringify({
          description: 'Laboratory test results',
          icon: 'science',
          concepts: ['LID: 33747-0', 'LID: 24323-8', 'LID: 57698-3', 'LID: 58410-2'],
          categories: ['Laboratory', 'CSF Analysis'],
        }),
      },
      {
        code: 'assessment',
        blob: JSON.stringify({
          description: 'Clinical assessment and diagnosis',
          icon: 'assignment',
          concepts: ['LID: 18630-4', 'SCTID: 439401001', 'SCTID: 27624003', 'SCTID: 422625006', 'SCTID: 281666001', 'SCTID: 160476009', 'SCTID: 417662000'],
          categories: ['Assessment', 'Diagnosis', 'Clinical Scales', 'Psychological Assessment'],
        }),
      },
      {
        code: 'questionnaires',
        blob: JSON.stringify({
          description: 'Fragebögen und Surveys (MoCA, BDI, etc.)',
          icon: 'quiz',
          concepts: ['CUSTOM: QUESTIONNAIRE'],
          categories: ['Survey Best'],
        }),
      },
    ]

    for (const fs of fieldSetUpdates) {
      await connection.executeCommand(
        `UPDATE CODE_LOOKUP SET LOOKUP_BLOB = ? WHERE TABLE_CD = 'VISIT_DIMENSION' AND COLUMN_CD = 'FIELD_SET_CD' AND CODE_CD = ?`,
        [fs.blob, fs.code],
      )
    }

    // 2. Add default FieldSet assignments to VisitTypes that lack them

    const visitTypeDefaults = [
      {
        code: 'routine',
        blob: JSON.stringify({
          label: 'Routine Check-up',
          icon: 'event_available',
          color: 'primary',
          fieldSets: [
            { id: 'vitals', name: 'Vital Signs', description: 'Blood pressure, heart rate, etc.', icon: 'favorite', active: true },
            { id: 'physical', name: 'Physical Exam', description: 'Physical examination findings', icon: 'medical_services', active: true },
            { id: 'medications', name: 'Medications', description: 'Current medications', icon: 'medication', active: true },
            { id: 'lab', name: 'Lab Results', description: 'Laboratory test results', icon: 'science', active: false },
            { id: 'assessment', name: 'Clinical Assessment', description: 'Clinical assessment', icon: 'assignment', active: false },
          ],
        }),
      },
      {
        code: 'followup',
        blob: JSON.stringify({
          label: 'Follow-up',
          icon: 'update',
          color: 'secondary',
          fieldSets: [
            { id: 'vitals', name: 'Vital Signs', description: 'Blood pressure, heart rate, etc.', icon: 'favorite', active: true },
            { id: 'medications', name: 'Medications', description: 'Current medications', icon: 'medication', active: true },
            { id: 'assessment', name: 'Clinical Assessment', description: 'Clinical assessment', icon: 'assignment', active: true },
          ],
        }),
      },
      {
        code: 'consultation',
        blob: JSON.stringify({
          label: 'Consultation',
          icon: 'forum',
          color: 'accent',
          fieldSets: [
            { id: 'assessment', name: 'Clinical Assessment', description: 'Clinical assessment', icon: 'assignment', active: true },
            { id: 'medications', name: 'Medications', description: 'Current medications', icon: 'medication', active: true },
          ],
        }),
      },
      {
        code: 'emergency',
        blob: JSON.stringify({
          label: 'Emergency',
          icon: 'emergency',
          color: 'negative',
          fieldSets: [
            { id: 'vitals', name: 'Vital Signs', description: 'Blood pressure, heart rate, etc.', icon: 'favorite', active: true },
            { id: 'medications', name: 'Medications', description: 'Current medications', icon: 'medication', active: true },
            { id: 'assessment', name: 'Clinical Assessment', description: 'Clinical assessment', icon: 'assignment', active: true },
          ],
        }),
      },
      {
        code: 'procedure',
        blob: JSON.stringify({
          label: 'Procedure',
          icon: 'healing',
          color: 'info',
          fieldSets: [
            { id: 'vitals', name: 'Vital Signs', description: 'Blood pressure, heart rate, etc.', icon: 'favorite', active: true },
            { id: 'medications', name: 'Medications', description: 'Current medications', icon: 'medication', active: true },
          ],
        }),
      },
    ]

    for (const vt of visitTypeDefaults) {
      await connection.executeCommand(
        `UPDATE CODE_LOOKUP SET LOOKUP_BLOB = ? WHERE TABLE_CD = 'VISIT_DIMENSION' AND COLUMN_CD = 'VISIT_TYPE_CD' AND CODE_CD = ?`,
        [vt.blob, vt.code],
      )
    }
  },
}
