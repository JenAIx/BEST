/**
 * Migration 007: Replace generic parkinson visit type with Erstvorstellung and Verlaufskontrolle
 *
 * This migration:
 * 1. Removes the legacy "parkinson" visit type
 * 2. Inserts "parkinson_erst" (Erstvorstellung / Initial Assessment)
 * 3. Inserts "parkinson_verlauf" (Verlaufskontrolle / Follow-up)
 * Both include suggestedQuestionnaires for visit-type-specific recommendations.
 */

export const parkinsonVisitTypes = {
  name: '007-parkinson-visit-types',
  description: 'Replace generic parkinson visit type with Erstvorstellung and Verlaufskontrolle',
  execute: async (connection) => {
    // 1. Remove the legacy "parkinson" visit type
    await connection.executeCommand(
      `DELETE FROM CODE_LOOKUP
       WHERE TABLE_CD = 'VISIT_DIMENSION'
         AND COLUMN_CD = 'VISIT_TYPE_CD'
         AND CODE_CD = 'parkinson'`,
    )

    // 2. Insert parkinson_erst (Erstvorstellung)
    const erstBlob = JSON.stringify({
      label: 'Parkinson Erstvorstellung',
      icon: 'psychology',
      color: 'deep-purple',
      fieldSets: [
        { id: 'assessment', name: 'Klinische Beurteilung / Diagnose', description: 'Diagnosestellung, Kriterien, klinisches Bild', icon: 'assignment', active: true },
        { id: 'medications', name: 'Medikation', description: 'Aktuelle und geplante Medikation', icon: 'medication', active: true },
        { id: 'physical', name: 'Körperliche Untersuchung', description: 'Neurologischer Befund', icon: 'medical_services', active: true },
        { id: 'questionnaires', name: 'Fragebögen / Scores', description: 'Standardisierte Parkinson-Scores', icon: 'quiz', active: true },
        { id: 'vitals', name: 'Vitalzeichen', description: 'Blutdruck, Puls etc.', icon: 'favorite', active: false },
        { id: 'lab', name: 'Labor', description: 'Laborwerte', icon: 'science', active: false },
      ],
      suggestedQuestionnaires: [
        'UPDRS_1', 'UPDRS_2', 'UPDRS_3', 'UPDRS_4',
        'HOEHNYAHR', 'SCHWAB_ENGLAND',
        'MOCA', 'BDI2', 'HADS', 'NMS_QUEST', 'PDQ8', 'RBD_SQ', 'PDSS2', 'BAIN_TREMOR',
      ],
    })

    await connection.executeCommand(
      `INSERT OR IGNORE INTO CODE_LOOKUP
         (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID)
       VALUES ('VISIT_DIMENSION', 'VISIT_TYPE_CD', 'parkinson_erst', 'Parkinson Erstvorstellung', ?, datetime('now'), datetime('now'), 'SYSTEM', 1)`,
      [erstBlob],
    )

    // 3. Insert parkinson_verlauf (Verlaufskontrolle)
    const verlaufBlob = JSON.stringify({
      label: 'Parkinson Verlaufskontrolle',
      icon: 'update',
      color: 'teal',
      fieldSets: [
        { id: 'medications', name: 'Medikation', description: 'Aktuelle Medikation und Dosisanpassungen', icon: 'medication', active: true },
        { id: 'questionnaires', name: 'Verlaufsparameter / Fragebögen', description: 'Klinische Verlaufsscores', icon: 'quiz', active: true },
        { id: 'assessment', name: 'Klinische Beurteilung', description: 'Verlauf und Therapieansprechen', icon: 'assignment', active: true },
        { id: 'vitals', name: 'Vitalzeichen', description: 'Blutdruck, Puls etc.', icon: 'favorite', active: false },
        { id: 'physical', name: 'Körperliche Untersuchung', description: 'Neurologischer Befund', icon: 'medical_services', active: false },
      ],
      suggestedQuestionnaires: [
        'UPDRS_3', 'UPDRS_4',
        'HOEHNYAHR', 'SCHWAB_ENGLAND',
        'WOQ9', 'BDI2', 'PHQ_9', 'PDQ8', 'NMS_QUEST', 'PDSS2', 'MDT',
      ],
    })

    await connection.executeCommand(
      `INSERT OR IGNORE INTO CODE_LOOKUP
         (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID)
       VALUES ('VISIT_DIMENSION', 'VISIT_TYPE_CD', 'parkinson_verlauf', 'Parkinson Verlaufskontrolle', ?, datetime('now'), datetime('now'), 'SYSTEM', 1)`,
      [verlaufBlob],
    )
  },
}
