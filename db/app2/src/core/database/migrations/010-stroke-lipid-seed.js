/**
 * Migration 010: Stroke-Lipid study seed
 *
 * Seeds all concepts, field sets, visit types, and the study row needed by the
 * Stroke-Lipid XLSX importer (scripts/import-fw-lipid/).
 *
 * Pattern follows 006-fieldset-categories + 007-parkinson-visit-types.
 *
 * Idempotent: all inserts use INSERT OR IGNORE / ON CONFLICT.
 */

const NOW = "datetime('now')"

// ---------------------------------------------------------------------------
// CONCEPTS to seed (custom + missing LOINC/SNOMED)
// ---------------------------------------------------------------------------

// Custom drug concepts (16 wirkstoffe, all N-type, mg)
const DRUG_KEYS = [
  ['ASS', 'ASS (Acetylsalicylic acid)'],
  ['CLOPIDOGREL', 'Clopidogrel'],
  ['APIXABAN', 'Apixaban (Eliquis)'],
  ['RIVAROXABAN', 'Rivaroxaban (Xarelto)'],
  ['EDOXABAN', 'Edoxaban (Lixiana)'],
  ['DABIGATRAN', 'Dabigatran (Pradaxa)'],
  ['ROSUVASTATIN', 'Rosuvastatin'],
  ['ATORVASTATIN', 'Atorvastatin'],
  ['SIMVASTATIN', 'Simvastatin'],
  ['FLUVASTATIN', 'Fluvastatin'],
  ['PRAVASTATIN', 'Pravastatin'],
  ['EZETIMIB', 'Ezetimibe'],
  ['BEMPEDOIC_ACID', 'Bempedoic acid (Nilemdo/Nustendi)'],
  ['EVOLOCUMAB', 'Evolocumab (Repatha)'],
  ['INCLISIRAN', 'Inclisiran (Leqvio)'],
  ['ALIROCUMAB', 'Alirocumab (Praluent)'],
]

const CONCEPTS = [
  // Visit-type marker concepts (documentation only)
  ['\\STROKE_LIPID\\VISIT\\V0', 'STROKE_LIPID:VISIT:V0', 'Stroke-Lipid V0 - Pre-Stroke Baseline', 'T', null, 'General'],
  ['\\STROKE_LIPID\\VISIT\\V1', 'STROKE_LIPID:VISIT:V1', 'Stroke-Lipid V1 - Index Stroke', 'T', null, 'General'],
  ['\\STROKE_LIPID\\VISIT\\V2', 'STROKE_LIPID:VISIT:V2', 'Stroke-Lipid V2 - Follow-up 3-6m', 'T', null, 'General'],

  // Index stroke event date (D-type at V0)
  ['\\STROKE_LIPID\\STROKE_EVENT_DATE', 'STROKE_LIPID:STROKE_EVENT_DATE', 'Index stroke event date', 'D', null, 'Stroke'],

  // Age at stroke (N-type, V0)
  ['\\STROKE_LIPID\\AGE_AT_STROKE', 'STROKE_LIPID:AGE_AT_STROKE', 'Age at stroke event', 'N', 'years', 'Stroke'],

  // Custom findings
  ['\\STROKE_LIPID\\COMORB\\PAVK_MI_CAD', 'STROKE_LIPID:COMORB:PAVK_MI_CAD', 'pAVK / Myocardial infarction / CAD (composite)', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\HX\\PRIOR_INFARCT', 'STROKE_LIPID:HX:PRIOR_INFARCT', 'Prior infarct / TIA before index event', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\HX\\REINFARCT', 'STROKE_LIPID:HX:REINFARCT', 'Reinfarct / TIA after index event', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\STATIN_INTOLERANCE', 'STROKE_LIPID:STATIN_INTOLERANCE', 'Statin intolerance', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\V1\\NEW_MED', 'STROKE_LIPID:V1:NEW_MED', 'New medication prescribed at V1', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\V1\\DOSE_INCREASED', 'STROKE_LIPID:V1:DOSE_INCREASED', 'Medication dose increased at V1', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\V2\\NEW_MED', 'STROKE_LIPID:V2:NEW_MED', 'New medication prescribed at V2', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\V2\\DOSE_INCREASED', 'STROKE_LIPID:V2:DOSE_INCREASED', 'Medication dose increased at V2', 'F', null, 'Stroke'],
  ['\\STROKE_LIPID\\V2\\OUR_CLINIC', 'STROKE_LIPID:V2:OUR_CLINIC', 'Follow-up at our neurology clinic', 'F', null, 'Stroke'],

  // Free-text observations
  ['\\STROKE_LIPID\\TEXT\\STATIN_INTOLERANCE_SYMPTOMS', 'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS', 'Symptoms of statin intolerance (free text)', 'T', null, 'Stroke'],
  ['\\STROKE_LIPID\\TEXT\\NOTES', 'STROKE_LIPID:NOTES', 'Study notes / open questions (free text)', 'T', null, 'Stroke'],

  // Selection concepts + their A-type options
  ['\\STROKE_LIPID\\SEL\\EVENT_TYPE', 'STROKE_LIPID:EVENT_TYPE', 'Cerebrovascular event type', 'S', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\EVENT_TYPE\\STROKE', 'STROKE_LIPID:EVT:STROKE', 'Stroke', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\EVENT_TYPE\\TIA', 'STROKE_LIPID:EVT:TIA', 'TIA (Transient ischemic attack)', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\EVENT_TYPE\\ZAV', 'STROKE_LIPID:EVT:ZAV', 'ZAV (Zentralarterienverschluss)', 'A', null, 'Stroke'],

  ['\\STROKE_LIPID\\SEL\\ETIOLOGY', 'STROKE_LIPID:ETIOLOGY', 'Stroke etiology (TOAST classification)', 'S', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\ETIOLOGY\\CRYPTOGENIC', 'STROKE_LIPID:ETIO:CRYPTOGENIC', 'Cryptogenic', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\ETIOLOGY\\MACRO', 'STROKE_LIPID:ETIO:MACRO', 'Macroangiopathic', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\ETIOLOGY\\MICRO', 'STROKE_LIPID:ETIO:MICRO', 'Microangiopathic', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\ETIOLOGY\\CARDIOEMBOLIC', 'STROKE_LIPID:ETIO:CARDIOEMBOLIC', 'Cardioembolic (AFib-related)', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\ETIOLOGY\\VASCULITIS', 'STROKE_LIPID:ETIO:VASCULITIS', 'Vasculitis', 'A', null, 'Stroke'],
  ['\\STROKE_LIPID\\SEL\\ETIOLOGY\\OTHER', 'STROKE_LIPID:ETIO:OTHER', 'Other etiology', 'A', null, 'Stroke'],

  // Missing LOINC lab concepts
  ['\\LOINC\\1920-8', 'LID: 1920-8', 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma', 'N', 'µkat/l', 'Laboratory'],
  ['\\LOINC\\1742-6', 'LID: 1742-6', 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma', 'N', 'µkat/l', 'Laboratory'],
  ['\\LOINC\\59261-8', 'LID: 59261-8', 'Hemoglobin A1c/Hemoglobin.total in Blood by IFCC protocol', 'N', 'mmol/mol', 'Laboratory'],
  ['\\LOINC\\10835-7', 'LID: 10835-7', 'Lipoprotein(a) [Moles/volume] in Serum or Plasma', 'N', 'nmol/l', 'Laboratory'],
  ['\\LOINC\\33914-3', 'LID: 33914-3', 'Glomerular filtration rate/1.73 sq M.predicted (eGFR)', 'N', 'ml/min/1.73m²', 'Laboratory'],

  // Missing SNOMED comorbidity concepts
  ['\\SNOMED\\84114007', 'SCTID: 84114007', 'Heart failure', 'F', null, 'Stroke'],
  ['\\SNOMED\\73211009', 'SCTID: 73211009', 'Diabetes mellitus', 'F', null, 'Stroke'],
]

// Drug concepts auto-generated from DRUG_KEYS
for (const [key, name] of DRUG_KEYS) {
  CONCEPTS.push([
    `\\STROKE_LIPID\\DRUG\\${key}`,
    `STROKE_LIPID:DRUG:${key}`,
    name,
    'N',
    'mg',
    'Medications',
  ])
}

// ---------------------------------------------------------------------------
// FIELD SETS (CODE_LOOKUP VISIT_DIMENSION/FIELD_SET_CD)
// ---------------------------------------------------------------------------

const DRUG_CONCEPTS = DRUG_KEYS.map(([k]) => `STROKE_LIPID:DRUG:${k}`)
const LAB_CONCEPTS = [
  'LID: 1920-8', // ASAT
  'LID: 1742-6', // ALAT
  'LID: 14927-8', // Triglycerides
  'LID: 22748-8', // LDL
  'LID: 14646-4', // HDL
  'LID: 59261-8', // HbA1c IFCC
  'LID: 10835-7', // Lp(a)
  'LID: 33914-3', // GFR
]
const PRE_STROKE_CONCEPTS = [
  // Comorbidities (V0)
  'SCTID: 49436004', // AFib
  'SCTID: 1179808003', // Loop recorder
  'SCTID: 84114007', // Heart failure
  'SCTID: 38341003', // Hypertension
  'SCTID: 73211009', // Diabetes
  'STROKE_LIPID:COMORB:PAVK_MI_CAD',
  'STROKE_LIPID:HX:PRIOR_INFARCT',
  // Vitals (V0)
  'SCTID: 27113001', // Body weight
  'SCTID: 1153637007', // Body height
  // Stroke baseline (V0)
  'STROKE_LIPID:AGE_AT_STROKE',
  'STROKE_LIPID:ETIOLOGY',
  'STROKE_LIPID:STROKE_EVENT_DATE',
]
const STROKE_EVENT_CONCEPTS = [
  'STROKE_LIPID:EVENT_TYPE',
  'STROKE_LIPID:STATIN_INTOLERANCE',
  'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS',
  'STROKE_LIPID:V1:NEW_MED',
  'STROKE_LIPID:V1:DOSE_INCREASED',
  'STROKE_LIPID:NOTES',
]
const FOLLOWUP_CONCEPTS = [
  'STROKE_LIPID:HX:REINFARCT',
  'STROKE_LIPID:V2:NEW_MED',
  'STROKE_LIPID:V2:DOSE_INCREASED',
  'STROKE_LIPID:V2:OUR_CLINIC',
]

const FIELD_SETS = [
  {
    code: 'lipid_drugs',
    name: 'Lipid Study - Medications',
    blob: {
      description: 'Stroke-Lipid study: 16 drug concepts (mg/day dose). 3-state: dose / not-taking (VALUEFLAG_CD=NV) / unknown.',
      icon: 'medication',
      concepts: DRUG_CONCEPTS,
      categories: ['Medications'],
    },
  },
  {
    code: 'lipid_labor',
    name: 'Lipid Study - Laboratory',
    blob: {
      description: 'Stroke-Lipid study: lipid panel + HbA1c IFCC + ASAT/ALAT + GFR + Lp(a).',
      icon: 'science',
      concepts: LAB_CONCEPTS,
      categories: ['Laboratory'],
    },
  },
  {
    code: 'lipid_pre_stroke',
    name: 'Lipid Study - Pre-Stroke Baseline (V0)',
    blob: {
      description: "Comorbidities, vitals, stroke etiology - assessed retrospectively as the patient's state immediately before the index stroke.",
      icon: 'monitor_heart',
      concepts: PRE_STROKE_CONCEPTS,
      categories: ['Stroke', 'Vital Signs'],
    },
  },
  {
    code: 'lipid_stroke_event',
    name: 'Lipid Study - Index Stroke (V1)',
    blob: {
      description: 'Index stroke event details: type (Stroke/TIA/ZAV), statin intolerance, new medication, dose increases.',
      icon: 'emergency',
      concepts: STROKE_EVENT_CONCEPTS,
      categories: ['Stroke', 'Diagnosis'],
    },
  },
  {
    code: 'lipid_followup',
    name: 'Lipid Study - Follow-up (V2)',
    blob: {
      description: 'Follow-up visit 3-6 months post-stroke: re-infarct, new medication, dose increases, our clinic flag.',
      icon: 'event_repeat',
      concepts: FOLLOWUP_CONCEPTS,
      categories: ['Stroke'],
    },
  },
]

// ---------------------------------------------------------------------------
// VISIT TYPES (CODE_LOOKUP VISIT_DIMENSION/VISIT_TYPE_CD)
// Each blob includes a fieldSets[] array referencing the field set codes above.
// ---------------------------------------------------------------------------

const VISIT_TYPES = [
  {
    code: 'stroke_lipid_v0',
    name: 'Stroke-Lipid V0 (Pre-Stroke Baseline)',
    blob: {
      label: 'Stroke-Lipid V0 - Pre-Stroke Baseline',
      icon: 'monitor_heart',
      color: 'orange',
      fieldSets: [
        { id: 'lipid_pre_stroke', name: 'Pre-Stroke Baseline', description: 'Comorbidities, vitals, etiology', icon: 'monitor_heart', active: true },
        { id: 'lipid_drugs', name: 'Lipid Medications', description: 'Medications before stroke (3-state)', icon: 'medication', active: true },
      ],
    },
  },
  {
    code: 'stroke_lipid_v1',
    name: 'Stroke-Lipid V1 (Index Stroke)',
    blob: {
      label: 'Stroke-Lipid V1 - Index Stroke',
      icon: 'emergency',
      color: 'red',
      fieldSets: [
        { id: 'lipid_stroke_event', name: 'Stroke Event', description: 'Type, statin intolerance, new meds, dose changes', icon: 'emergency', active: true },
        { id: 'lipid_labor', name: 'Laboratory', description: 'Lipid panel + HbA1c + ASAT/ALAT + GFR + Lp(a)', icon: 'science', active: true },
        { id: 'lipid_drugs', name: 'Lipid Medications', description: 'Discharge medications (3-state)', icon: 'medication', active: true },
      ],
    },
  },
  {
    code: 'stroke_lipid_v2',
    name: 'Stroke-Lipid V2 (Follow-up 3-6m)',
    blob: {
      label: 'Stroke-Lipid V2 - Follow-up 3-6m',
      icon: 'event_repeat',
      color: 'teal',
      fieldSets: [
        { id: 'lipid_followup', name: 'Follow-up Findings', description: 'Re-infarct, new meds, dose changes, our clinic', icon: 'event_repeat', active: true },
        { id: 'lipid_labor', name: 'Laboratory', description: 'Lipid panel + HbA1c + ASAT/ALAT + GFR + Lp(a)', icon: 'science', active: true },
        { id: 'lipid_drugs', name: 'Lipid Medications', description: 'Current medications (3-state)', icon: 'medication', active: true },
      ],
    },
  },
]

// ---------------------------------------------------------------------------
// VALUEFLAG_CD codes for 3-state pattern (no schema change, just lookup rows)
// ---------------------------------------------------------------------------

const VALUEFLAG_CODES = [
  {
    code: 'NV',
    name: 'No Value (explicit)',
    blob: {
      description: 'Concept was assessed; the patient explicitly has no value for it (e.g. medication explicitly not taken). Distinct from "not assessed" (no observation at all).',
      semantic: 'hl7v3:NP',
    },
  },
  {
    code: 'NI',
    name: 'No Information',
    blob: {
      description: 'Concept was assessed but no information available (asked but unknown).',
      semantic: 'hl7v3:NASK',
    },
  },
]

// ---------------------------------------------------------------------------
// STUDY
// ---------------------------------------------------------------------------

const STUDY = {
  STUDY_CD: 'STROKE_LIPID',
  NAME_CHAR: 'Stroke-Lipid Management 2026',
  CATEGORY_CHAR: 'Stroke',
  DESCRIPTION_CHAR:
    'Retrospective cohort of stroke patients with lipid management across V0 (pre-stroke baseline) / V1 (index stroke) / V2 (follow-up 3-6m).',
  PRINCIPAL_INVESTIGATOR: 'IDIR PostStroke',
}

// ---------------------------------------------------------------------------
// Migration export (matches the app's MigrationManager contract)
// ---------------------------------------------------------------------------

export const strokeLipidSeed = {
  name: '010-stroke-lipid-seed',
  description: 'Seed Stroke-Lipid study: concepts, field sets, visit types, VALUEFLAG_CD codes, study row',
  execute: async (connection) => {
    // CONCEPT_DIMENSION (self-healing: re-applies CATEGORY_CHAR on conflict so the
    // migration can correct previously-wrong categories).
    for (const [path, code, nameChar, valtype, unit, category] of CONCEPTS) {
      await connection.executeCommand(
        `INSERT INTO CONCEPT_DIMENSION
          (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD, CATEGORY_CHAR,
           SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
         VALUES (?, ?, ?, ?, ?, ?, 'STROKE_LIPID_MIGRATION', ${NOW}, ${NOW})
         ON CONFLICT(CONCEPT_CD) DO UPDATE SET
           CATEGORY_CHAR = excluded.CATEGORY_CHAR,
           UPDATE_DATE = excluded.UPDATE_DATE`,
        [path, code, nameChar, valtype, unit, category],
      )
    }

    // Fix-ups for existing concepts that this study reuses but were previously
    // categorised as 'General' / 'Vital Signs'. The field-set matcher uses
    // human-readable category labels, so concepts without the right label show
    // up as "Uncategorized" in the UI.
    const categoryFixups = [
      ['SCTID: 371484003', 'Demographics'], // Patient name (was 'General')
    ]
    for (const [code, cat] of categoryFixups) {
      await connection.executeCommand(
        `UPDATE CONCEPT_DIMENSION SET CATEGORY_CHAR = ?, UPDATE_DATE = ${NOW} WHERE CONCEPT_CD = ?`,
        [cat, code],
      )
    }

    // FIELD SETS
    for (const fs of FIELD_SETS) {
      await connection.executeCommand(
        `INSERT OR IGNORE INTO CODE_LOOKUP
          (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB,
           SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
         VALUES ('VISIT_DIMENSION', 'FIELD_SET_CD', ?, ?, ?, 'STROKE_LIPID_MIGRATION', ${NOW}, ${NOW})`,
        [fs.code, fs.name, JSON.stringify(fs.blob)],
      )
    }

    // VISIT TYPES
    for (const vt of VISIT_TYPES) {
      await connection.executeCommand(
        `INSERT OR IGNORE INTO CODE_LOOKUP
          (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB,
           SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
         VALUES ('VISIT_DIMENSION', 'VISIT_TYPE_CD', ?, ?, ?, 'STROKE_LIPID_MIGRATION', ${NOW}, ${NOW})`,
        [vt.code, vt.name, JSON.stringify(vt.blob)],
      )
    }

    // VALUEFLAG_CD codes
    for (const vf of VALUEFLAG_CODES) {
      await connection.executeCommand(
        `INSERT OR IGNORE INTO CODE_LOOKUP
          (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB,
           SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
         VALUES ('OBSERVATION_FACT', 'VALUEFLAG_CD', ?, ?, ?, 'STROKE_LIPID_MIGRATION', ${NOW}, ${NOW})`,
        [vf.code, vf.name, JSON.stringify(vf.blob)],
      )
    }

    // STUDY_DIMENSION
    await connection.executeCommand(
      `INSERT OR IGNORE INTO STUDY_DIMENSION
        (STUDY_CD, NAME_CHAR, CATEGORY_CHAR, DESCRIPTION_CHAR, STATUS_CD, PRINCIPAL_INVESTIGATOR,
         SOURCESYSTEM_CD, IMPORT_DATE)
       VALUES (?, ?, ?, ?, 'active', ?, 'STROKE_LIPID_MIGRATION', ${NOW})`,
      [STUDY.STUDY_CD, STUDY.NAME_CHAR, STUDY.CATEGORY_CHAR, STUDY.DESCRIPTION_CHAR, STUDY.PRINCIPAL_INVESTIGATOR],
    )
  },
}

// Also export raw data structures so the standalone Stroke-Lipid importer
// (scripts/import-fw-lipid/) can apply the same seed via better-sqlite3
// without going through the app's async connection wrapper.
export const STROKE_LIPID_SEED_DATA = {
  concepts: CONCEPTS,
  fieldSets: FIELD_SETS,
  visitTypes: VISIT_TYPES,
  valueflagCodes: VALUEFLAG_CODES,
  study: STUDY,
  categoryFixups: [
    ['SCTID: 371484003', 'Demographics'],
  ],
}
