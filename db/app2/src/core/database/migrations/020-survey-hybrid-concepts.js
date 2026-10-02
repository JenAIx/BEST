/**
 * surveyBEST Parkinson-Ambulanz-Hybridbogen (pd_hybrid_screen) importierbar machen
 *
 * surveyBEST (survey3 ≥ v1.20) exportiert den Hybridbogen als Q-Observation und
 * je Kennzahl eine N-Observation mit CONCEPT_CD `CUSTOM: PD_HYBRID_*`; dazu die
 * daraus abgeleiteten Originalbögen NMSQuest und PDSS-2 als eigene Q-Observation
 * mit Gesamtscore (`CUSTOM: SCORES_NMSQUEST`, `CUSTOM: SCORES_PDSS2`).
 *
 * Der Import überspringt Observations, deren Konzept fehlt
 * (database-import-service.js, Concept-Check) — ohne diese Migration gingen
 * alle Kennzahlen und der PDSS-2-Score stillschweigend verloren.
 *
 *   1. Konzepte für die Kennzahlen des Hybridbogens + PDSS-2-Gesamtscore
 *   2. Score-Leiste der Parkinson-Konsultationen um PDSS-2 und OFF/Tag
 *      ergänzen (MERGE: nur anhängen, was fehlt — Admin-Änderungen bleiben)
 *
 * Self-healing (ON CONFLICT … DO UPDATE) für die eigenen Konzepte; eine
 * Anweisung je executeCommand (Electron-Preload-Splitter, siehe 016).
 */

const NOW = "datetime('now')"
const SRC = 'SURVEY3'
const CAT = 'Parkinson Disease'

// [path, code, name, valtype, unit]
const CONCEPTS = [
  ['\\CUSTOM\\SCORES\\PDSS2', 'CUSTOM: SCORES_PDSS2', 'PDSS-2 Gesamtscore (0–60)', 'N', 'POINTS'],
  ['\\CUSTOM\\PD_HYBRID\\OFF_WAKE_H', 'CUSTOM: PD_HYBRID_OFF_WAKE_H', 'Hybrid-Screening: OFF in der Wachzeit', 'N', 'h'],
  ['\\CUSTOM\\PD_HYBRID\\OFF_WAKE_PCT', 'CUSTOM: PD_HYBRID_OFF_WAKE_PCT', 'Hybrid-Screening: OFF in der Wachzeit', 'N', '%'],
  ['\\CUSTOM\\PD_HYBRID\\DYS_WAKE_H', 'CUSTOM: PD_HYBRID_DYS_WAKE_H', 'Hybrid-Screening: Überbewegungen in der Wachzeit', 'N', 'h'],
  ['\\CUSTOM\\PD_HYBRID\\DYS_WAKE_PCT', 'CUSTOM: PD_HYBRID_DYS_WAKE_PCT', 'Hybrid-Screening: Überbewegungen in der Wachzeit', 'N', '%'],
  ['\\CUSTOM\\PD_HYBRID\\NIGHT_OFF_H', 'CUSTOM: PD_HYBRID_NIGHT_OFF_H', 'Hybrid-Screening: OFF nachts', 'N', 'h'],
  ['\\CUSTOM\\PD_HYBRID\\SWITCHES_TO_OFF', 'CUSTOM: PD_HYBRID_SWITCHES_TO_OFF', 'Hybrid-Screening: Wechsel in OFF pro Tag', 'N', null],
  ['\\CUSTOM\\PD_HYBRID\\LONGEST_OFF_H', 'CUSTOM: PD_HYBRID_LONGEST_OFF_H', 'Hybrid-Screening: längstes OFF', 'N', 'h'],
  ['\\CUSTOM\\PD_HYBRID\\UPDRS4_1_VORSCHLAG', 'CUSTOM: PD_HYBRID_UPDRS4_1_VORSCHLAG', 'Hybrid-Screening: MDS-UPDRS 4.1 (Vorschlag aus Tageskurve)', 'N', 'POINTS'],
  ['\\CUSTOM\\PD_HYBRID\\UPDRS4_3_VORSCHLAG', 'CUSTOM: PD_HYBRID_UPDRS4_3_VORSCHLAG', 'Hybrid-Screening: MDS-UPDRS 4.3 (Vorschlag aus Tageskurve)', 'N', 'POINTS'],
  ['\\CUSTOM\\PD_HYBRID\\NMSQUEST_TOTAL', 'CUSTOM: PD_HYBRID_NMSQUEST_TOTAL', 'Hybrid-Screening: NMSQuest (Anzahl Ja, 0–30)', 'N', 'POINTS'],
  ['\\CUSTOM\\PD_HYBRID\\PDSS2_TOTAL', 'CUSTOM: PD_HYBRID_PDSS2_TOTAL', 'Hybrid-Screening: PDSS-2 Summe (0–60)', 'N', 'POINTS'],
  ['\\CUSTOM\\PD_HYBRID\\AUFFAELLIG', 'CUSTOM: PD_HYBRID_AUFFAELLIG', 'Hybrid-Screening: auffällige Bereiche (0–3)', 'N', null],
]

// Score-Leiste der Parkinson-Konsultationen (017 PD_SCORE_STRIP) — anhängen, falls fehlt
const STRIP_ADD = [
  { code: 'CUSTOM: SCORES_PDSS2', short: 'PDSS-2', questionnaireCode: 'PDSS2' },
  { code: 'CUSTOM: PD_HYBRID_OFF_WAKE_H', short: 'OFF/Tag', questionnaireCode: 'PD_HYBRID_SCREEN', decimals: 1 },
]
const STRIP_TEMPLATES = ['consult_pd_erst', 'consult_pd_verlauf', 'consult_ths_verlauf']

export const SURVEY_HYBRID_DATA = { CONCEPTS, STRIP_ADD, STRIP_TEMPLATES }

export const surveyHybridConcepts = {
  name: '020-survey-hybrid-concepts',
  description: 'surveyBEST Hybrid-Screening: Konzepte für Kennzahlen + PDSS-2-Score, Score-Leiste ergänzt',
  execute: async (connection) => {
    // 1. Konzepte (eigene → überschreiben)
    for (const [path, code, name, valtype, unit] of CONCEPTS) {
      await connection.executeCommand(
        `INSERT INTO CONCEPT_DIMENSION (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD, CATEGORY_CHAR, SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE, UPLOAD_ID)
         VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW}, ${NOW}, 1)
         ON CONFLICT(CONCEPT_CD) DO UPDATE SET
           CONCEPT_PATH = excluded.CONCEPT_PATH,
           NAME_CHAR = excluded.NAME_CHAR,
           VALTYPE_CD = excluded.VALTYPE_CD,
           UNIT_CD = excluded.UNIT_CD,
           CATEGORY_CHAR = excluded.CATEGORY_CHAR,
           UPDATE_DATE = excluded.UPDATE_DATE`,
        [path, code, name, valtype, unit, CAT, SRC],
      )
    }

    // 2. Score-Leiste: nur anhängen (017 nicht angewendet → nichts zu tun)
    for (const tplCode of STRIP_TEMPLATES) {
      const r = await connection.executeQuery('SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = ?', [tplCode])
      if (!r.success || !r.data?.length) continue
      let blob
      try {
        blob = JSON.parse(r.data[0].LOOKUP_BLOB || '{}') || {}
      } catch {
        continue
      }
      const strip = Array.isArray(blob.scoreConcepts) ? [...blob.scoreConcepts] : []
      let changed = false
      for (const add of STRIP_ADD) {
        if (!strip.some((s) => s.code === add.code)) {
          strip.push(add)
          changed = true
        }
      }
      if (!changed) continue
      await connection.executeCommand(`UPDATE CODE_LOOKUP SET LOOKUP_BLOB = ?, UPDATE_DATE = ${NOW} WHERE CODE_CD = ?`, [JSON.stringify({ ...blob, scoreConcepts: strip }), tplCode])
    }
  },
}
