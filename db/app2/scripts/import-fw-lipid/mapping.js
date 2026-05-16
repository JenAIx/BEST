'use strict'

// Categories are stored as human-readable labels (matches the existing seed
// convention and how the FieldSet matcher in the frontend resolves them).
// See `006-fieldset-categories.js` for the matching FieldSet.categories[].
const CATEGORY = {
  STROKE: 'Stroke',
  LAB: 'Laboratory',
  MED: 'Medications',
  VITALS: 'Vital Signs',
  DEMO: 'Demographics',
  DIAG: 'Diagnosis',
  GENERAL: 'General',
}

const STUDY = {
  STUDY_CD: 'STROKE_LIPID',
  STUDY_NAME: 'Stroke-Lipid Management 2026',
  STUDY_CATEGORY: 'Stroke',
  PI: 'IDIR PostStroke',
}

const VISIT_TYPE = {
  V0: 'stroke_lipid_v0',
  V1: 'stroke_lipid_v1',
  V2: 'stroke_lipid_v2',
}

const VISIT_TYPE_LABELS = {
  [VISIT_TYPE.V0]: 'Stroke-Lipid V0 - Pre-Stroke Baseline',
  [VISIT_TYPE.V1]: 'Stroke-Lipid V1 - Index Stroke',
  [VISIT_TYPE.V2]: 'Stroke-Lipid V2 - Follow-up 3-6m',
}

const LOCATION_CD = 'Neurology Clinic'
const INOUT_CD = { V0: 'I', V1: 'I', V2: 'O' }

// Finding answer concepts (A-type, already in CONCEPT_DIMENSION)
const FINDING_YES = 'SCTID: 373066001'
const FINDING_NO = 'SCTID: 373067005'

// Patient-name concept (already in CONCEPT_DIMENSION as T-type)
const PATIENT_NAME_CONCEPT = 'SCTID: 371484003'

// Stroke event date concept (D-type)
const STROKE_EVENT_DATE_CONCEPT = 'STROKE_LIPID:STROKE_EVENT_DATE'

// All drug concepts are study-specific (numeric mg/day dose).
// `existing: true` means already in DB pre-import; otherwise it gets seeded.
const DRUGS = [
  { key: 'ASS', concept: 'STROKE_LIPID:DRUG:ASS', name: 'ASS (Acetylsalicylic acid)', col: { V0: 'ASS_V0', V1: 'ASS_V1', V2: 'ASS_V2' } },
  { key: 'CLOPIDOGREL', concept: 'STROKE_LIPID:DRUG:CLOPIDOGREL', name: 'Clopidogrel', col: { V0: 'Clopidogrel_V0', V1: 'Clopidogrel_V1', V2: 'Clopidogrel_V2' } },
  { key: 'APIXABAN', concept: 'STROKE_LIPID:DRUG:APIXABAN', name: 'Apixaban (Eliquis)', col: { V0: 'Eliquis/ Apixaban_V0', V1: 'Eliquis/ Apixaban_V1', V2: 'Eliquis/ Apixaban_V2' } },
  { key: 'RIVAROXABAN', concept: 'STROKE_LIPID:DRUG:RIVAROXABAN', name: 'Rivaroxaban (Xarelto)', col: { V0: 'Rivaroxaban/ Xarelto_V0', V1: 'Rivaroxaban/ Xarelto_V1', V2: 'Rivaroxaban/ Xarelto_V2' } },
  { key: 'EDOXABAN', concept: 'STROKE_LIPID:DRUG:EDOXABAN', name: 'Edoxaban (Lixiana)', col: { V0: 'Edoxaban/ Lixiana_V0', V1: 'Edoxaban/ Lixiana_V1', V2: 'Edoxaban/ Lixiana_V2' } },
  { key: 'DABIGATRAN', concept: 'STROKE_LIPID:DRUG:DABIGATRAN', name: 'Dabigatran (Pradaxa)', col: { V0: 'Dabigatran/ Pradaxa_V0', V1: 'Dabigatran/ Pradaxa_V1', V2: 'Dabigatran/ Pradaxa_V2' } },
  { key: 'ROSUVASTATIN', concept: 'STROKE_LIPID:DRUG:ROSUVASTATIN', name: 'Rosuvastatin', col: { V0: 'Rosuvastatin_V0', V1: 'Rosuvastatin_V1', V2: 'Rosuvastatin_V2' } },
  { key: 'ATORVASTATIN', concept: 'STROKE_LIPID:DRUG:ATORVASTATIN', name: 'Atorvastatin', col: { V0: 'Atorvastatin_V0', V1: 'Atorvastatin_V1', V2: 'Atorvastatin_V2' } },
  { key: 'SIMVASTATIN', concept: 'STROKE_LIPID:DRUG:SIMVASTATIN', name: 'Simvastatin', col: { V0: 'Simvastatin_V0', V1: 'Simvastatin_V1', V2: 'Simvastatin_V2' } },
  { key: 'FLUVASTATIN', concept: 'STROKE_LIPID:DRUG:FLUVASTATIN', name: 'Fluvastatin', col: { V0: 'Fluvastatin_V0', V1: null, V2: null } },
  { key: 'PRAVASTATIN', concept: 'STROKE_LIPID:DRUG:PRAVASTATIN', name: 'Pravastatin', col: { V0: 'Pravastatin _V0', V1: null, V2: null } },
  { key: 'EZETIMIB', concept: 'STROKE_LIPID:DRUG:EZETIMIB', name: 'Ezetimibe', col: { V0: 'Ezetimib_V0', V1: 'Ezetimib_V1', V2: 'Ezetimib_V2' } },
  { key: 'BEMPEDOIC_ACID', concept: 'STROKE_LIPID:DRUG:BEMPEDOIC_ACID', name: 'Bempedoic acid (Nilemdo/Nustendi)', col: { V0: 'Bempedoinsäure/ Nilemdo/ Nustendi_V0', V1: 'Bempedoinsäure/ Nilemdo/ Nustendi_V1', V2: 'Bempedoinsäure/ Nilemdo/ Nustendi_V2' } },
  { key: 'EVOLOCUMAB', concept: 'STROKE_LIPID:DRUG:EVOLOCUMAB', name: 'Evolocumab (Repatha)', col: { V0: 'Evolocumab/ Repatha_V0', V1: 'Evolocumab/ Repatha_V1', V2: 'Evolocumab/ Repatha_V2' } },
  { key: 'INCLISIRAN', concept: 'STROKE_LIPID:DRUG:INCLISIRAN', name: 'Inclisiran (Leqvio)', col: { V0: 'Inclisiran/ Leqvio_V0', V1: 'Inclisiran/ Leqvio_V1', V2: 'Inclisiran/ Leqvio_V2' } },
  { key: 'ALIROCUMAB', concept: 'STROKE_LIPID:DRUG:ALIROCUMAB', name: 'Alirocumab (Praluent)', col: { V0: 'Alirocumab/ Praluent_V0', V1: 'Alirocumab/ Praluent_V1', V2: 'Alirocumab/ Praluent_V2' } },
]

// Lab concepts - prefer existing LOINC/SNOMED (already in DB pre-import).
// `existing: true` means concept must NOT be (re-)seeded; importer just references it.
// Units chosen to match what the German lab reports (and what the XLSX header carries):
//   ASAT/ALAT: µmol/(l·s) = µkat/l (same SI unit, German labs report as µmol/l*s).
//   Lipid panel + HbA1c: mmol/l / mmol/mol (German convention).
//   Lp(a): nmol/l (newer convention; old XLSX used mg/dl, new one uses nmol/l).
const LABS = [
  { key: 'ASAT', concept: 'LID: 1920-8', existing: false, name: 'AST (Aspartate aminotransferase) [Enzymatic activity/volume] in Serum or Plasma', unit: 'µkat/l', col: { V1: 'ASAT_V1_µmol/l*s', V2: 'ASAT_V2µmol/l*' } },
  { key: 'ALAT', concept: 'LID: 1742-6', existing: false, name: 'ALT (Alanine aminotransferase) [Enzymatic activity/volume] in Serum or Plasma', unit: 'µkat/l', col: { V1: 'ALAT_V1_µmol/l*', V2: 'ALAT_V2µmol/l*' } },
  { key: 'TRIGLYCERIDES', concept: 'LID: 14927-8', existing: true, name: 'Triglyceride (Moles/Volume) in Blood', unit: 'mmol/l', col: { V1: 'Triglyceride_V1_mmol/l', V2: 'Triglyceride_V2_mmol/l' } },
  { key: 'LDL', concept: 'LID: 22748-8', existing: true, name: 'LDL-Cholesterin (Moles/Volume) in Serum or Plasma', unit: 'mmol/l', col: { V1: 'LDL_V1_mmol/l', V2: 'LDL_V2_mmol/l' }, dateCol: { V1: 'LDL-V1-Datum', V2: 'LDL_Datum_V2' } },
  { key: 'HDL', concept: 'LID: 14646-4', existing: true, name: 'HDL-Cholesterin (Moles/Volume) in Serum or Plasma', unit: 'mmol/l', col: { V1: 'HDL_V1_mmol/l', V2: 'HDL_V2_mmol/l' } },
  { key: 'HBA1C_IFCC', concept: 'LID: 59261-8', existing: false, name: 'Hemoglobin A1c/Hemoglobin.total in Blood by IFCC protocol', unit: 'mmol/mol', col: { V1: 'Hba1c_V1mmol/mol', V2: 'Hba1c_V2mmol/mol' } },
  { key: 'LPA', concept: 'LID: 10835-7', existing: false, name: 'Lipoprotein(a) [Moles/volume] in Serum or Plasma', unit: 'nmol/l', col: { V1: 'Lpa_V1', V2: 'Lpa_V2_nmol/l' } },
  { key: 'GFR', concept: 'LID: 33914-3', existing: false, name: 'Glomerular filtration rate/1.73 sq M.predicted (eGFR)', unit: 'ml/min/1.73m²', col: { V1: 'GFR_V1', V2: 'GFR_V2_ml/min' } },
]

// V0: Pre-stroke baseline findings. Prefer existing SNOMED concept where available.
const FINDINGS_V0 = [
  { key: 'AFIB', concept: 'SCTID: 49436004', existing: true, name: 'Atrial fibrillation', col: 'VHF' },
  { key: 'EVENT_RECORDER', concept: 'SCTID: 1179808003', existing: true, name: 'Implantable loop recorder in situ', col: 'Looprecorder' },
  { key: 'HEART_FAILURE', concept: 'SCTID: 84114007', existing: false, name: 'Heart failure (Herzinsuffizienz)', col: 'Herzinsuff' },
  { key: 'HYPERTENSION', concept: 'SCTID: 38341003', existing: true, name: 'Hypertensive disorder, systemic arterial', col: 'Arterielle Hypertonie' },
  { key: 'DIABETES', concept: 'SCTID: 73211009', existing: false, name: 'Diabetes mellitus', col: 'Diabetes Mellitus' },
  { key: 'PAVK_MI_CAD', concept: 'STROKE_LIPID:COMORB:PAVK_MI_CAD', name: 'pAVK / Myocardial infarction / CAD (composite)', col: 'paVK_Herzinfarkt_KHK_koronare Herzkrankheit' },
  { key: 'PRIOR_INFARCT', concept: 'STROKE_LIPID:HX:PRIOR_INFARCT', name: 'Prior infarct / TIA before index event', col: 'Vorinfarkte 0= kein Infarkt/TIAvorher, 1= mindestens 1 Infarkt/TIA vorher' },
]

const FINDINGS_V1 = [
  { key: 'STATIN_INTOLERANCE', concept: 'STROKE_LIPID:STATIN_INTOLERANCE', name: 'Statin intolerance', col: 'Statinunverträglichkeit' },
  { key: 'V1_NEW_MED', concept: 'STROKE_LIPID:V1:NEW_MED', name: 'New medication prescribed at V1', col: 'Neue Medikamente _V1' },
  { key: 'V1_DOSE_INC', concept: 'STROKE_LIPID:V1:DOSE_INCREASED', name: 'Medication dose increased at V1', col: 'erhöht_v1' },
]

const FINDINGS_V2 = [
  { key: 'REINFARCT', concept: 'STROKE_LIPID:HX:REINFARCT', name: 'Reinfarct / TIA after index event', col: 'Reinfarkte 0= kein Infarkt/TIA nachher, 1= mindestens 1 Infarkt/TIA nachhher' },
  { key: 'V2_NEW_MED', concept: 'STROKE_LIPID:V2:NEW_MED', name: 'New medication prescribed at V2', col: 'Neuverorndete MedikamenteLipid_V2' },
  { key: 'V2_DOSE_INC', concept: 'STROKE_LIPID:V2:DOSE_INCREASED', name: 'Medication dose increased at V2', col: 'Lipidmedikameterhöht_v2' },
  { key: 'OUR_CLINIC', concept: 'STROKE_LIPID:V2:OUR_CLINIC', name: 'Follow-up at our neurology clinic', col: 'War der Patient in unserer Ambulanz' },
]

// V1 free-text fields (recorded as T-type observations attached to the V1 visit).
const TEXTS_V1 = [
  { key: 'STATIN_INTOLERANCE_SYMPTOMS', concept: 'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS', name: 'Symptoms of statin intolerance', col: 'Welche Symptome Statinunverträglichkeit' },
  { key: 'NOTES', concept: 'STROKE_LIPID:NOTES', name: 'Study notes / open questions', col: 'Bemerkungen/Fragen' },
]

// V0 numeric observations: vitals only. Age-at-stroke is computed from
// BIRTH_DATE + Datum_Stroke in import.js (more reliable than XLSX column).
const NUMERIC_V0 = [
  { key: 'WEIGHT', concept: 'SCTID: 27113001', existing: true, name: 'Body weight', unit: 'kg', col: 'Gewicht_kg', category: 'VITALS' },
  { key: 'HEIGHT', concept: 'SCTID: 1153637007', existing: true, name: 'Body height', unit: 'cm', col: 'Groesse_cm', category: 'VITALS' },
]

const AGE_AT_STROKE_CONCEPT = 'STROKE_LIPID:AGE_AT_STROKE'

// V0 selections.
const SELECTIONS_V0 = [
  {
    key: 'ETIOLOGY',
    concept: 'STROKE_LIPID:ETIOLOGY',
    name: 'Stroke etiology (TOAST)',
    col: 'Aetiologie',
    parser: 'etiology',
    options: [
      { code: 'STROKE_LIPID:ETIO:CRYPTOGENIC', name: 'Cryptogenic' },
      { code: 'STROKE_LIPID:ETIO:MACRO', name: 'Macroangiopathic' },
      { code: 'STROKE_LIPID:ETIO:MICRO', name: 'Microangiopathic' },
      { code: 'STROKE_LIPID:ETIO:CARDIOEMBOLIC', name: 'Cardioembolic (AFib)' },
      { code: 'STROKE_LIPID:ETIO:VASCULITIS', name: 'Vasculitis' },
      { code: 'STROKE_LIPID:ETIO:OTHER', name: 'Other' },
    ],
  },
]

// V1 selections (event type only - this is THE stroke).
const SELECTIONS_V1 = [
  {
    key: 'EVENT_TYPE',
    concept: 'STROKE_LIPID:EVENT_TYPE',
    name: 'Cerebrovascular event type',
    col: 'stroke=1 TIA=2 ZAV zentralarterienverschluss=3',
    parser: 'eventType',
    options: [
      { code: 'STROKE_LIPID:EVT:STROKE', name: 'Stroke' },
      { code: 'STROKE_LIPID:EVT:TIA', name: 'TIA' },
      { code: 'STROKE_LIPID:EVT:ZAV', name: 'ZAV (Zentralarterienverschluss)' },
    ],
  },
]

const PATIENT_COL = {
  ID: 'ID',
  NAME: 'Name',
  VORNAME: 'Vorname',
  BIRTH: 'Geb.',
  PLZ: 'Postleitzahl',
  SEX: 'Männlich=1, weiblich= 0',
  STROKE_DATE: 'Datum_Stroke',
  V2_DATE: 'V2_Datum',
}

const SKIP_COLS = new Set([
  'Nr',
  'Alter_Automatic',
  'Alter automatic',
  'Namenskürzel ',
  'Namenskürzel',
  '__EMPTY',
  'Wer hats geschrieben',
  'Kontrolle ? (durch Supervisor)',
])

// Field sets - reusable concept bundles attached via CODE_LOOKUP(VISIT_DIMENSION/FIELD_SET_CD).
// Each is JSON in LOOKUP_BLOB; the UI reads it to render input panels per visit.
function buildFieldSets() {
  return [
    {
      code: 'lipid_drugs',
      name: 'Lipid Study - Medications',
      blob: {
        description: 'Stroke-Lipid study: all 16 drug concepts (mg/day dose). Used at V0/V1/V2.',
        icon: 'medication',
        concepts: DRUGS.map((d) => d.concept),
        categories: ['Medications'],
      },
    },
    {
      code: 'lipid_labor',
      name: 'Lipid Study - Laboratory',
      blob: {
        description: 'Stroke-Lipid study: lipid panel, HbA1c IFCC, ASAT/ALAT, GFR, Lp(a). Used at V1/V2.',
        icon: 'science',
        concepts: LABS.map((l) => l.concept),
        categories: ['Laboratory'],
      },
    },
    {
      code: 'lipid_pre_stroke',
      name: 'Lipid Study - Pre-Stroke Baseline (V0)',
      blob: {
        description: 'Comorbidities, vitals, stroke etiology - assessed retrospectively as the patient\'s state immediately before the index stroke.',
        icon: 'monitor_heart',
        concepts: [
          ...FINDINGS_V0.map((f) => f.concept),
          ...NUMERIC_V0.map((n) => n.concept),
          ...SELECTIONS_V0.map((s) => s.concept),
          STROKE_EVENT_DATE_CONCEPT,
        ],
        categories: ['Stroke', 'Vital Signs'],
      },
    },
    {
      code: 'lipid_stroke_event',
      name: 'Lipid Study - Index Stroke (V1)',
      blob: {
        description: 'Index stroke event: type (Stroke/TIA/ZAV), statin intolerance, new medication, dose increases.',
        icon: 'emergency',
        concepts: [...SELECTIONS_V1.map((s) => s.concept), ...FINDINGS_V1.map((f) => f.concept)],
        categories: ['Stroke', 'Diagnosis'],
      },
    },
    {
      code: 'lipid_followup',
      name: 'Lipid Study - Follow-up (V2)',
      blob: {
        description: 'Follow-up visit 3-6 months post-stroke: re-infarct, new medication, dose increases, our clinic flag.',
        icon: 'event_repeat',
        concepts: FINDINGS_V2.map((f) => f.concept),
        categories: ['Stroke'],
      },
    },
  ]
}

module.exports = {
  CATEGORY,
  STUDY,
  VISIT_TYPE,
  VISIT_TYPE_LABELS,
  LOCATION_CD,
  INOUT_CD,
  FINDING_YES,
  FINDING_NO,
  PATIENT_NAME_CONCEPT,
  STROKE_EVENT_DATE_CONCEPT,
  AGE_AT_STROKE_CONCEPT,
  DRUGS,
  LABS,
  FINDINGS_V0,
  FINDINGS_V1,
  FINDINGS_V2,
  TEXTS_V1,
  NUMERIC_V0,
  SELECTIONS_V0,
  SELECTIONS_V1,
  PATIENT_COL,
  SKIP_COLS,
  buildFieldSets,
}
