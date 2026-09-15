/**
 * Neuro consultation seed ("Visitenmodus")
 *
 * Everything the outpatient consultation cockpit needs as DATA, so that no
 * neurology-specific content lives in code:
 *
 *   1. category labels            CODE_LOOKUP(CONCEPT_DIMENSION/CATEGORY_CHAR)
 *   2. concepts                   diagnosis (secondary), texts, scores, PD context,
 *                                 DBS parameters, tremor, ICD-10 mini catalogue
 *   3. field sets                 neuro_* (explicit concept lists, no category bleed)
 *   4. visit types                ths_verlauf, tremor_erst/verlauf, ataxie, neuro_sonstiges
 *      + MERGE into parkinson_erst / parkinson_verlauf (007 seeded them with
 *        INSERT OR IGNORE; we add the neuro field sets without touching admin edits)
 *   5. consultation templates     CODE_LOOKUP(VISIT_DIMENSION/CONSULT_TEMPLATE_CD)
 *   6. medication option lists    Parkinson drug catalogue (with LEDD keys + aliases),
 *                                 dosesPerDay on every frequency, new routes
 *   7. questionnaire blobs        re-upsert the four definitions whose result codes
 *                                 were unprefixed (scores were silently dropped)
 *   8. DX_STATUS_CD labels
 *
 * Self-healing (ON CONFLICT … DO UPDATE) for everything this migration owns;
 * one statement per executeCommand (Electron preload splitter, see 016).
 */

const NOW = "datetime('now')"
const SRC = 'NEURO_CONSULT'

// ---------------------------------------------------------------------------
// 1. Categories (label ↔ CAT_* code, see CLAUDE.md §1)
// ---------------------------------------------------------------------------
const CATEGORIES = [
  ['CAT_CONSULTATION', 'Consultation'],
  ['CAT_DBS', 'Deep Brain Stimulation'],
  ['CAT_TREMOR', 'Tremor'],
]

// ---------------------------------------------------------------------------
// 2. Concepts [path, code, name, valtype, unit, category]
// ---------------------------------------------------------------------------
const CONCEPTS = [
  // diagnoses + texts
  ['\\NEURO\\DX\\SECONDARY', 'NEURO:DX:SECONDARY', 'Nebendiagnose', 'S', null, 'Diagnosis'],
  ['\\LOINC\\51848-0', 'LID: 51848-0', 'Beurteilung / Zusammenfassung (Evaluation note)', 'T', null, 'Consultation'],
  // scores
  ['\\NEURO\\SCORE\\LEDD', 'NEURO:SCORE:LEDD', 'LEDD (Levodopa-Äquivalenzdosis)', 'N', 'mg/d', 'Parkinson Disease'],
  ['\\SNOMED-CT\\273544001', 'SCTID: 273544001', 'Schwab & England ADL (%)', 'N', '%', 'Parkinson Disease'],
  ['\\NEURO\\SCORE\\WOQ9', 'NEURO:SCORE:WOQ9', 'WOQ-9 Wearing-off Score', 'N', 'POINTS', 'Parkinson Disease'],
  ['\\NEURO\\SCORE\\RBD_SQ', 'NEURO:SCORE:RBD_SQ', 'RBD-SQ Score', 'N', 'POINTS', 'Parkinson Disease'],
  ['\\NEURO\\SCORE\\SARA_TOTAL', 'NEURO:SCORE:SARA_TOTAL', 'SARA Gesamtscore (0–40)', 'N', 'POINTS', 'Clinical Scales'],
  ['\\NEURO\\SCORE\\SARA_GAIT', 'NEURO:SCORE:SARA_GAIT', 'SARA Gang (0–8)', 'N', 'POINTS', 'Clinical Scales'],
  ['\\NEURO\\SCORE\\SARA_STANCE', 'NEURO:SCORE:SARA_STANCE', 'SARA Stand (0–6)', 'N', 'POINTS', 'Clinical Scales'],
  ['\\NEURO\\SCORE\\SARA_SPEECH', 'NEURO:SCORE:SARA_SPEECH', 'SARA Sprache (0–6)', 'N', 'POINTS', 'Clinical Scales'],
  ['\\NEURO\\SCORE\\TETRAS_TOTAL', 'NEURO:SCORE:TETRAS_TOTAL', 'TETRAS Gesamtscore', 'N', 'POINTS', 'Clinical Scales'],
  ['\\NEURO\\SCORE\\TETRAS_PERFORMANCE', 'NEURO:SCORE:TETRAS_PERFORMANCE', 'TETRAS Performance-Subscore', 'N', 'POINTS', 'Clinical Scales'],
  ['\\NEURO\\SCORE\\FTM_TOTAL', 'NEURO:SCORE:FTM_TOTAL', 'Fahn-Tolosa-Marín Tremor Rating Scale (gesamt)', 'N', 'POINTS', 'Clinical Scales'],
  // Bain tremor items referenced by quest_bain_tremor.json
  ['\\CUSTOM\\BAIN\\REST_R', 'CUSTOM: BAIN_REST_R', 'Bain: Ruhetremor rechts', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\REST_L', 'CUSTOM: BAIN_REST_L', 'Bain: Ruhetremor links', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\POSTURAL_R', 'CUSTOM: BAIN_POSTURAL_R', 'Bain: Haltetremor rechts', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\POSTURAL_L', 'CUSTOM: BAIN_POSTURAL_L', 'Bain: Haltetremor links', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\INTENTION_R', 'CUSTOM: BAIN_INTENTION_R', 'Bain: Intentionstremor rechts', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\INTENTION_L', 'CUSTOM: BAIN_INTENTION_L', 'Bain: Intentionstremor links', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\POURING', 'CUSTOM: BAIN_POURING', 'Bain: Wasser eingießen', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\SPIRAL', 'CUSTOM: BAIN_SPIRAL', 'Bain: Spirale', 'N', 'POINTS', 'Clinical Scales'],
  ['\\CUSTOM\\BAIN\\WRITING', 'CUSTOM: BAIN_WRITING', 'Bain: Schreiben', 'N', 'POINTS', 'Clinical Scales'],
  // PD context
  ['\\NEURO\\PD\\MED_STATE', 'NEURO:PD:MED_STATE', 'Medikamentöser Zustand bei Untersuchung', 'S', null, 'Parkinson Disease'],
  ['\\NEURO\\PD\\MED_STATE\\ON', 'NEURO:PD:MED_STATE:ON', 'ON', 'A', null, 'Parkinson Disease'],
  ['\\NEURO\\PD\\MED_STATE\\OFF', 'NEURO:PD:MED_STATE:OFF', 'OFF', 'A', null, 'Parkinson Disease'],
  ['\\NEURO\\PD\\STIM_STATE', 'NEURO:PD:STIM_STATE', 'Stimulationszustand bei Untersuchung', 'S', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\PD\\STIM_STATE\\ON', 'NEURO:PD:STIM_STATE:ON', 'Stim ON', 'A', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\PD\\STIM_STATE\\OFF', 'NEURO:PD:STIM_STATE:OFF', 'Stim OFF', 'A', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\PD\\DYSKINESIA', 'NEURO:PD:DYSKINESIA', 'Dyskinesien', 'F', null, 'Parkinson Disease'],
  ['\\NEURO\\PD\\FLUCTUATIONS', 'NEURO:PD:FLUCTUATIONS', 'Motorische Fluktuationen', 'F', null, 'Parkinson Disease'],
  // DBS
  ['\\NEURO\\DBS\\TARGET', 'NEURO:DBS:TARGET', 'THS-Zielpunkt', 'S', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\TARGET\\STN', 'NEURO:DBS:TARGET:STN', 'STN (Nucleus subthalamicus)', 'A', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\TARGET\\GPI', 'NEURO:DBS:TARGET:GPI', 'GPi (Globus pallidus internus)', 'A', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\TARGET\\VIM', 'NEURO:DBS:TARGET:VIM', 'VIM (Nucleus ventralis intermedius)', 'A', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\TARGET\\OTHER', 'NEURO:DBS:TARGET:OTHER', 'Anderer Zielpunkt', 'A', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\IMPLANT_DATE', 'NEURO:DBS:IMPLANT_DATE', 'THS-Implantationsdatum', 'D', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\IPG_TYPE', 'NEURO:DBS:IPG_TYPE', 'Impulsgenerator (Modell)', 'T', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\CONTACTS_L', 'NEURO:DBS:CONTACTS_L', 'Aktive Kontakte links', 'T', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\CONTACTS_R', 'NEURO:DBS:CONTACTS_R', 'Aktive Kontakte rechts', 'T', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\AMPLITUDE_L', 'NEURO:DBS:AMPLITUDE_L', 'Amplitude links', 'N', 'mA', 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\AMPLITUDE_R', 'NEURO:DBS:AMPLITUDE_R', 'Amplitude rechts', 'N', 'mA', 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\PULSE_WIDTH_L', 'NEURO:DBS:PULSE_WIDTH_L', 'Impulsbreite links', 'N', 'µs', 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\PULSE_WIDTH_R', 'NEURO:DBS:PULSE_WIDTH_R', 'Impulsbreite rechts', 'N', 'µs', 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\FREQUENCY_L', 'NEURO:DBS:FREQUENCY_L', 'Frequenz links', 'N', 'Hz', 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\FREQUENCY_R', 'NEURO:DBS:FREQUENCY_R', 'Frequenz rechts', 'N', 'Hz', 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\SETTINGS_CHANGED', 'NEURO:DBS:SETTINGS_CHANGED', 'Stimulationseinstellung geändert', 'F', null, 'Deep Brain Stimulation'],
  ['\\NEURO\\DBS\\PROGRAMMING_NOTE', 'NEURO:DBS:PROGRAMMING_NOTE', 'Programmiernotiz', 'T', null, 'Deep Brain Stimulation'],
  // tremor
  ['\\NEURO\\TREMOR\\TYPE', 'NEURO:TREMOR:TYPE', 'Tremortyp', 'S', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\TYPE\\ESSENTIAL', 'NEURO:TREMOR:TYPE:ESSENTIAL', 'Essentieller Tremor', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\TYPE\\PARKINSONIAN', 'NEURO:TREMOR:TYPE:PARKINSONIAN', 'Parkinson-Tremor', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\TYPE\\DYSTONIC', 'NEURO:TREMOR:TYPE:DYSTONIC', 'Dystoner Tremor', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\TYPE\\CEREBELLAR', 'NEURO:TREMOR:TYPE:CEREBELLAR', 'Zerebellärer Tremor', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\TYPE\\FUNCTIONAL', 'NEURO:TREMOR:TYPE:FUNCTIONAL', 'Funktioneller Tremor', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\TYPE\\OTHER', 'NEURO:TREMOR:TYPE:OTHER', 'Sonstiger Tremor', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\DOMINANT_SIDE', 'NEURO:TREMOR:DOMINANT_SIDE', 'Dominante Seite', 'S', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\DOMINANT_SIDE\\L', 'NEURO:TREMOR:DOMINANT_SIDE:L', 'links', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\DOMINANT_SIDE\\R', 'NEURO:TREMOR:DOMINANT_SIDE:R', 'rechts', 'A', null, 'Tremor'],
  ['\\NEURO\\TREMOR\\DOMINANT_SIDE\\B', 'NEURO:TREMOR:DOMINANT_SIDE:B', 'beidseits', 'A', null, 'Tremor'],
]

// ICD-10-GM mini catalogue for movement disorders [code, name]; path derived
const ICD10 = [
  ['G20', 'Primäres Parkinson-Syndrom'],
  ['G21.0', 'Malignes Neuroleptika-Syndrom'],
  ['G21.1', 'Sonstiges arzneimittelinduziertes Parkinson-Syndrom'],
  ['G21.2', 'Parkinson-Syndrom durch sonstige exogene Agenzien'],
  ['G21.3', 'Postenzephalitisches Parkinson-Syndrom'],
  ['G21.4', 'Vaskuläres Parkinson-Syndrom'],
  ['G21.8', 'Sonstiges sekundäres Parkinson-Syndrom'],
  ['G21.9', 'Sekundäres Parkinson-Syndrom, nicht näher bezeichnet'],
  ['G22', 'Parkinson-Syndrom bei anderenorts klassifizierten Krankheiten'],
  ['G23.0', 'Hallervorden-Spatz-Syndrom (NBIA)'],
  ['G23.1', 'Progressive supranukleäre Blickparese (PSP)'],
  ['G23.2', 'Multisystematrophie vom Parkinson-Typ (MSA-P)'],
  ['G23.3', 'Multisystematrophie vom zerebellären Typ (MSA-C)'],
  ['G23.8', 'Sonstige degenerative Krankheiten der Basalganglien'],
  ['G23.9', 'Degenerative Krankheit der Basalganglien, nicht näher bezeichnet'],
  ['G24.0', 'Arzneimittelinduzierte Dystonie'],
  ['G24.1', 'Idiopathische familiäre Dystonie'],
  ['G24.2', 'Idiopathische nichtfamiliäre Dystonie'],
  ['G24.3', 'Torticollis spasticus'],
  ['G24.4', 'Idiopathische orofaziale Dystonie'],
  ['G24.5', 'Blepharospasmus'],
  ['G24.8', 'Sonstige Dystonie'],
  ['G24.9', 'Dystonie, nicht näher bezeichnet'],
  ['G25.0', 'Essentieller Tremor'],
  ['G25.1', 'Arzneimittelinduzierter Tremor'],
  ['G25.2', 'Sonstige näher bezeichnete Tremorformen'],
  ['G25.3', 'Myoklonus'],
  ['G25.5', 'Sonstige Chorea'],
  ['G25.8', 'Sonstige näher bezeichnete extrapyramidale Krankheiten und Bewegungsstörungen'],
  ['G25.9', 'Extrapyramidale Krankheit und Bewegungsstörung, nicht näher bezeichnet'],
  ['G26', 'Extrapyramidale Krankheiten und Bewegungsstörungen bei anderenorts klassifizierten Krankheiten'],
  ['G10', 'Chorea Huntington'],
  ['G11.0', 'Angeborene nichtprogressive Ataxie'],
  ['G11.1', 'Früh beginnende zerebellare Ataxie'],
  ['G11.2', 'Spät beginnende zerebellare Ataxie'],
  ['G11.3', 'Zerebellare Ataxie mit defektem DNA-Reparatursystem'],
  ['G11.4', 'Hereditäre spastische Paraplegie'],
  ['G11.8', 'Sonstige hereditäre Ataxien'],
  ['G11.9', 'Hereditäre Ataxie, nicht näher bezeichnet'],
  ['G30.0', 'Alzheimer-Krankheit mit frühem Beginn'],
  ['G30.1', 'Alzheimer-Krankheit mit spätem Beginn'],
  ['G30.9', 'Alzheimer-Krankheit, nicht näher bezeichnet'],
  ['G31.0', 'Umschriebene Hirnatrophie (frontotemporale Demenz)'],
  ['G31.8', 'Sonstige näher bezeichnete degenerative Krankheiten des Nervensystems (u. a. Lewy-Körper-Krankheit)'],
  ['G31.9', 'Degenerative Krankheit des Nervensystems, nicht näher bezeichnet'],
  ['G90.3', 'Multisystem-Atrophie (MSA)'],
  ['G47.0', 'Ein- und Durchschlafstörungen'],
  ['G47.8', 'Sonstige Schlafstörungen (u. a. REM-Schlaf-Verhaltensstörung)'],
  ['F02.3', 'Demenz bei primärem Parkinson-Syndrom'],
  ['F02.8', 'Demenz bei anderenorts klassifizierten Krankheitsbildern'],
  ['F06.7', 'Leichte kognitive Störung'],
  ['F32.0', 'Leichte depressive Episode'],
  ['F32.1', 'Mittelgradige depressive Episode'],
  ['F44.4', 'Dissoziative Bewegungsstörungen (funktionell)'],
  ['R25.1', 'Tremor, nicht näher bezeichnet'],
  ['R26.0', 'Ataktischer Gang'],
  ['R26.2', 'Gehbeschwerden, anderenorts nicht klassifiziert'],
  ['R27.0', 'Ataxie, nicht näher bezeichnet'],
  ['I10', 'Essentielle (primäre) Hypertonie'],
  ['I95.1', 'Orthostatische Hypotonie'],
  ['E11.9', 'Diabetes mellitus Typ 2 ohne Komplikationen'],
]
const icdBlock = (code) => {
  const letter = code[0]
  const num = parseInt(code.slice(1, 3), 10)
  const blocks = { G: [[0, 9, 'G00-G09'], [10, 14, 'G10-G14'], [20, 26, 'G20-G26'], [30, 32, 'G30-G32'], [40, 47, 'G40-G47'], [90, 99, 'G90-G99']], F: [[0, 9, 'F00-F09'], [30, 39, 'F30-F39'], [40, 48, 'F40-F48']], R: [[25, 29, 'R25-R29']], I: [[10, 15, 'I10-I15'], [95, 99, 'I95-I99']], E: [[10, 14, 'E10-E14']] }
  const hit = (blocks[letter] || []).find(([a, b]) => num >= a && num <= b)
  return hit ? hit[2] : `${letter}00-${letter}99`
}
const ICD10_CONCEPTS = ICD10.map(([code, name]) => [`\\ICD-10\\${icdBlock(code)}\\${code.split('.')[0]}\\${code}`, `ICD10: ${code}`, name, 'A', null, 'Diagnosis'])

// ---------------------------------------------------------------------------
// 3. Field sets
// ---------------------------------------------------------------------------
const TEXT_CONCEPTS = ['SCTID: 422625006', 'SCTID: 84728005', 'LID: 51848-0', 'SCTID: 304541006']
const PD_SCORES = ['SCTID: 716138005', 'NEURO:SCORE:LEDD', 'LID: 77720-1', 'LID: 77718-5', 'LID: 77719-3', 'LID: 77721-9', 'SCTID: 273544001', 'LID: 72172-0', 'CUSTOM: SCORES_NMSQUEST', 'CUSTOM: PDQ_8', 'NEURO:SCORE:WOQ9', 'NEURO:SCORE:RBD_SQ', 'CUSTOM: SCORES_QUIP_RS_SUM']
const PD_CONTEXT = ['NEURO:PD:MED_STATE', 'NEURO:PD:DYSKINESIA', 'NEURO:PD:FLUCTUATIONS']
const DBS_CONCEPTS = ['NEURO:PD:STIM_STATE', 'NEURO:DBS:TARGET', 'NEURO:DBS:IMPLANT_DATE', 'NEURO:DBS:IPG_TYPE', 'NEURO:DBS:CONTACTS_L', 'NEURO:DBS:AMPLITUDE_L', 'NEURO:DBS:PULSE_WIDTH_L', 'NEURO:DBS:FREQUENCY_L', 'NEURO:DBS:CONTACTS_R', 'NEURO:DBS:AMPLITUDE_R', 'NEURO:DBS:PULSE_WIDTH_R', 'NEURO:DBS:FREQUENCY_R', 'NEURO:DBS:SETTINGS_CHANGED', 'NEURO:DBS:PROGRAMMING_NOTE']
const TREMOR_SCORES = ['CUSTOM: SCORES_BAIN_TREMOR', 'NEURO:SCORE:TETRAS_TOTAL', 'NEURO:SCORE:TETRAS_PERFORMANCE', 'NEURO:SCORE:FTM_TOTAL', 'NEURO:TREMOR:TYPE', 'NEURO:TREMOR:DOMINANT_SIDE', 'LID: 72172-0']
const ATAXIA_SCORES = ['NEURO:SCORE:SARA_TOTAL', 'NEURO:SCORE:SARA_GAIT', 'NEURO:SCORE:SARA_STANCE', 'NEURO:SCORE:SARA_SPEECH', 'LID: 72172-0']

const FIELD_SETS = [
  { code: 'neuro_diagnoses', name: 'Diagnosen', blob: { description: 'Hauptdiagnose + Nebendiagnosen (Freitext, ICD-10 optional)', icon: 'medical_information', concepts: ['SCTID: 8319008', 'NEURO:DX:SECONDARY'], categories: [] } },
  { code: 'neuro_consult_texts', name: 'Konsultation (Texte)', blob: { description: 'Anamnese/Verlauf, Befund, Beurteilung, Empfehlungen', icon: 'description', concepts: TEXT_CONCEPTS, categories: [] } },
  { code: 'neuro_pd_scores', name: 'Parkinson-Scores', blob: { description: 'H&Y, LEDD, MDS-UPDRS, S&E, MoCA, NMS, PDQ-8, WOQ-9, RBD-SQ, QUIP-RS + ON/OFF-Kontext', icon: 'analytics', concepts: [...PD_SCORES, ...PD_CONTEXT], categories: [] } },
  { code: 'neuro_dbs', name: 'Tiefe Hirnstimulation', blob: { description: 'Zielpunkt, Implantation, Stimulationsparameter je Seite', icon: 'memory', concepts: DBS_CONCEPTS, categories: [] } },
  { code: 'neuro_tremor_scores', name: 'Tremor', blob: { description: 'Bain, TETRAS, FTM, Tremortyp, Seite, MoCA', icon: 'vibration', concepts: TREMOR_SCORES, categories: [] } },
  { code: 'neuro_ataxia_scores', name: 'Ataxie', blob: { description: 'SARA (gesamt + Kernitems), MoCA', icon: 'accessibility_new', concepts: ATAXIA_SCORES, categories: [] } },
]

// ---------------------------------------------------------------------------
// 4. Visit types (new) + merge spec for the 007 Parkinson types
// ---------------------------------------------------------------------------
const fs = (id, name, active = true) => ({ id, name, active })
const VISIT_TYPES = [
  { code: 'ths_verlauf', name: 'THS-Verlaufskontrolle', blob: { label: 'THS-Verlaufskontrolle', icon: 'memory', color: 'indigo', fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('medications', 'Medications'), fs('neuro_pd_scores', 'Parkinson-Scores'), fs('neuro_dbs', 'Tiefe Hirnstimulation'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('questionnaires', 'Fragebögen')], suggestedQuestionnaires: ['UPDRS_3', 'UPDRS_4', 'HOEHNYAHR', 'SCHWAB_ENGLAND', 'PDQ8', 'NMS_QUEST'] } },
  { code: 'tremor_erst', name: 'Tremor Erstvorstellung', blob: { label: 'Tremor Erstvorstellung', icon: 'vibration', color: 'orange', fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('medications', 'Medications'), fs('neuro_tremor_scores', 'Tremor'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('questionnaires', 'Fragebögen')], suggestedQuestionnaires: ['BAIN_TREMOR', 'MOCA'] } },
  { code: 'tremor_verlauf', name: 'Tremor Verlaufskontrolle', blob: { label: 'Tremor Verlaufskontrolle', icon: 'vibration', color: 'orange', fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('medications', 'Medications'), fs('neuro_tremor_scores', 'Tremor'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('questionnaires', 'Fragebögen')], suggestedQuestionnaires: ['BAIN_TREMOR'] } },
  { code: 'ataxie', name: 'Ataxie', blob: { label: 'Ataxie', icon: 'accessibility_new', color: 'brown', fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('medications', 'Medications'), fs('neuro_ataxia_scores', 'Ataxie'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('questionnaires', 'Fragebögen')], suggestedQuestionnaires: ['MOCA'] } },
  { code: 'neuro_sonstiges', name: 'Neurologie – Sonstiges', blob: { label: 'Neurologie – Sonstiges', icon: 'medical_information', color: 'grey-8', fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('medications', 'Medications'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('questionnaires', 'Fragebögen')], suggestedQuestionnaires: [] } },
]
const PARKINSON_MERGE = {
  parkinson_erst: { fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('neuro_pd_scores', 'Parkinson-Scores')], suggestedQuestionnaires: ['SCHWAB_ENGLAND', 'RBD_SQ'] },
  parkinson_verlauf: { fieldSets: [fs('neuro_diagnoses', 'Diagnosen'), fs('neuro_consult_texts', 'Konsultation (Texte)'), fs('neuro_pd_scores', 'Parkinson-Scores')], suggestedQuestionnaires: ['SCHWAB_ENGLAND', 'WOQ9'] },
}

// ---------------------------------------------------------------------------
// 5. Consultation templates
// ---------------------------------------------------------------------------
const S = (code, short, extra = {}) => ({ code, short, ...extra })
const PD_SCORE_STRIP = [
  S('SCTID: 716138005', 'H&Y', { questionnaireCode: 'HOEHNYAHR', decimals: 1, required: true }),
  S('LID: 77720-1', 'UPDRS III', { questionnaireCode: 'UPDRS_3', required: true }),
  S('NEURO:SCORE:LEDD', 'LEDD', { derived: 'ledd' }),
  S('LID: 72172-0', 'MoCA', { questionnaireCode: 'MOCA', higherIsWorse: false }),
  S('LID: 77721-9', 'UPDRS IV', { questionnaireCode: 'UPDRS_4' }),
  S('SCTID: 273544001', 'S&E', { questionnaireCode: 'SCHWAB_ENGLAND', higherIsWorse: false }),
  S('LID: 77718-5', 'UPDRS I', { questionnaireCode: 'UPDRS_1' }),
  S('LID: 77719-3', 'UPDRS II', { questionnaireCode: 'UPDRS_2' }),
  S('CUSTOM: SCORES_NMSQUEST', 'NMS', { questionnaireCode: 'NMS_QUEST' }),
  S('CUSTOM: PDQ_8', 'PDQ-8', { questionnaireCode: 'PDQ8' }),
  S('NEURO:SCORE:WOQ9', 'WOQ-9', { questionnaireCode: 'WOQ9' }),
  S('NEURO:SCORE:RBD_SQ', 'RBD-SQ', { questionnaireCode: 'RBD_SQ' }),
]
const TEXTS = (firstLabel) => [
  { code: 'SCTID: 422625006', label: firstLabel, short: firstLabel === 'Anamnese' ? 'Anamnese' : 'Verlauf', carryForward: false, letter: 'Anamnese' },
  { code: 'SCTID: 84728005', label: 'Neurologischer Befund', short: 'Befund', carryForward: true, letter: 'Befund' },
  { code: 'LID: 51848-0', label: 'Beurteilung / Zusammenfassung', short: 'Beurteilung', carryForward: true, letter: 'Beurteilung' },
  { code: 'SCTID: 304541006', label: 'Empfehlungen / Procedere', short: 'Empfehlung', carryForward: true, letter: 'Procedere' },
]
const LETTER = ['diagnoses', 'medication', 'medicationChanges', 'scores', 'text:SCTID: 422625006', 'text:SCTID: 84728005', 'text:LID: 51848-0', 'text:SCTID: 304541006']
const PD_GROUPS = [{ label: 'Parkinson-Medikation', ledd: true }, { label: 'Sonstige Medikation', rest: true }]

const TEMPLATES = [
  { code: 'consult_pd_erst', name: 'Parkinson – Erstvorstellung', blob: { order: 1, label: 'Parkinson – Erstvorstellung', icon: 'psychology', color: 'deep-purple', visitType: 'parkinson_erst', followUpTemplate: 'consult_pd_verlauf', diagnosis: { show: true, carryForward: false }, medication: { show: true, ledd: true, carryForward: false, showDiff: false, groups: PD_GROUPS }, scoreConcepts: PD_SCORE_STRIP, contextConcepts: PD_CONTEXT, textConcepts: TEXTS('Anamnese'), checklist: ['SCTID: 8319008', 'SCTID: 716138005', 'LID: 77720-1', 'LID: 72172-0', 'LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: ['UPDRS_1', 'UPDRS_2', 'UPDRS_3', 'UPDRS_4', 'HOEHNYAHR', 'SCHWAB_ENGLAND', 'MOCA', 'NMS_QUEST', 'PDQ8', 'RBD_SQ', 'BDI2', 'PDSS2'], letterSections: LETTER } },
  { code: 'consult_pd_verlauf', name: 'Parkinson – Verlaufskontrolle', blob: { order: 2, label: 'Parkinson – Verlaufskontrolle', icon: 'update', color: 'teal', visitType: 'parkinson_verlauf', diagnosis: { show: true, carryForward: true }, medication: { show: true, ledd: true, carryForward: true, showDiff: true, groups: PD_GROUPS }, scoreConcepts: PD_SCORE_STRIP, contextConcepts: PD_CONTEXT, textConcepts: TEXTS('Verlauf seit letzter Vorstellung'), checklist: ['SCTID: 716138005', 'LID: 77720-1', 'LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: ['UPDRS_3', 'UPDRS_4', 'HOEHNYAHR', 'SCHWAB_ENGLAND', 'WOQ9', 'PDQ8', 'NMS_QUEST', 'PDSS2', 'BDI2'], letterSections: LETTER } },
  { code: 'consult_ths_verlauf', name: 'THS – Verlaufskontrolle', blob: { order: 3, label: 'THS – Verlaufskontrolle', icon: 'memory', color: 'indigo', visitType: 'ths_verlauf', diagnosis: { show: true, carryForward: true }, medication: { show: true, ledd: true, carryForward: true, showDiff: true, groups: PD_GROUPS }, scoreConcepts: PD_SCORE_STRIP, contextConcepts: [...PD_CONTEXT, 'NEURO:PD:STIM_STATE'], textConcepts: TEXTS('Verlauf seit letzter Vorstellung'), panels: ['dbs'], checklist: ['LID: 77720-1', 'NEURO:DBS:AMPLITUDE_L', 'NEURO:DBS:AMPLITUDE_R', 'LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: ['UPDRS_3', 'UPDRS_4', 'HOEHNYAHR', 'SCHWAB_ENGLAND', 'PDQ8', 'NMS_QUEST'], letterSections: [...LETTER.slice(0, 4), 'panel:dbs', ...LETTER.slice(4)] } },
  { code: 'consult_tremor_erst', name: 'Tremor – Erstvorstellung', blob: { order: 4, label: 'Tremor – Erstvorstellung', icon: 'vibration', color: 'orange', visitType: 'tremor_erst', followUpTemplate: 'consult_tremor_verlauf', diagnosis: { show: true, carryForward: false }, medication: { show: true, ledd: false, carryForward: false, showDiff: false, groups: [] }, scoreConcepts: [S('CUSTOM: SCORES_BAIN_TREMOR', 'Bain', { questionnaireCode: 'BAIN_TREMOR', required: true }), S('NEURO:SCORE:TETRAS_TOTAL', 'TETRAS'), S('NEURO:SCORE:TETRAS_PERFORMANCE', 'TETRAS-P'), S('NEURO:SCORE:FTM_TOTAL', 'FTM'), S('LID: 72172-0', 'MoCA', { questionnaireCode: 'MOCA', higherIsWorse: false })], contextConcepts: ['NEURO:TREMOR:TYPE', 'NEURO:TREMOR:DOMINANT_SIDE'], textConcepts: TEXTS('Anamnese'), checklist: ['SCTID: 8319008', 'NEURO:TREMOR:TYPE', 'CUSTOM: SCORES_BAIN_TREMOR', 'LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: ['BAIN_TREMOR', 'MOCA'], letterSections: LETTER } },
  { code: 'consult_tremor_verlauf', name: 'Tremor – Verlaufskontrolle', blob: { order: 5, label: 'Tremor – Verlaufskontrolle', icon: 'vibration', color: 'orange', visitType: 'tremor_verlauf', diagnosis: { show: true, carryForward: true }, medication: { show: true, ledd: false, carryForward: true, showDiff: true, groups: [] }, scoreConcepts: [S('CUSTOM: SCORES_BAIN_TREMOR', 'Bain', { questionnaireCode: 'BAIN_TREMOR', required: true }), S('NEURO:SCORE:TETRAS_TOTAL', 'TETRAS'), S('NEURO:SCORE:TETRAS_PERFORMANCE', 'TETRAS-P'), S('NEURO:SCORE:FTM_TOTAL', 'FTM')], contextConcepts: ['NEURO:TREMOR:TYPE', 'NEURO:TREMOR:DOMINANT_SIDE'], textConcepts: TEXTS('Verlauf seit letzter Vorstellung'), checklist: ['CUSTOM: SCORES_BAIN_TREMOR', 'LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: ['BAIN_TREMOR'], letterSections: LETTER } },
  { code: 'consult_ataxie', name: 'Ataxie', blob: { order: 6, label: 'Ataxie', icon: 'accessibility_new', color: 'brown', visitType: 'ataxie', diagnosis: { show: true, carryForward: true }, medication: { show: true, ledd: false, carryForward: true, showDiff: true, groups: [] }, scoreConcepts: [S('NEURO:SCORE:SARA_TOTAL', 'SARA', { required: true }), S('NEURO:SCORE:SARA_GAIT', 'SARA Gang'), S('NEURO:SCORE:SARA_STANCE', 'SARA Stand'), S('NEURO:SCORE:SARA_SPEECH', 'SARA Sprache'), S('LID: 72172-0', 'MoCA', { questionnaireCode: 'MOCA', higherIsWorse: false })], contextConcepts: [], textConcepts: TEXTS('Verlauf / Anamnese'), checklist: ['NEURO:SCORE:SARA_TOTAL', 'LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: ['MOCA'], letterSections: LETTER } },
  { code: 'consult_sonstiges', name: 'Neurologie – Sonstiges', blob: { order: 7, isDefault: true, label: 'Neurologie – Sonstiges', icon: 'medical_information', color: 'grey-8', visitType: 'neuro_sonstiges', diagnosis: { show: true, carryForward: true }, medication: { show: true, ledd: false, carryForward: true, showDiff: true, groups: [] }, scoreConcepts: [], contextConcepts: [], textConcepts: TEXTS('Verlauf / Anamnese'), checklist: ['LID: 51848-0', 'SCTID: 304541006'], suggestedQuestionnaires: [], letterSections: LETTER } },
]

// ---------------------------------------------------------------------------
// 6. Medication option lists
// ---------------------------------------------------------------------------
// [code, name, generic, default_strength, route, frequency, ledType, comt, aliases]
const DRUGS = [
  ['carbidopa_levodopa', 'Levodopa/Carbidopa', 'Levodopa + Decarboxylasehemmer', '100/25mg', 'PO', 'QID', 'levodopa', null, ['Nacom', 'Isicom', 'Sinemet', 'Carbidopa-Levodopa', 'Levocarb']],
  ['levodopa_benserazide', 'Levodopa/Benserazid', 'Levodopa + Decarboxylasehemmer', '100/25mg', 'PO', 'QID', 'levodopa', null, ['Madopar', 'Restex', 'Levodopa Benserazid', 'Levodopa/Benserazid']],
  ['levodopa_carbidopa_er', 'Levodopa/Carbidopa retard', 'Levodopa retard', '200/50mg', 'PO', 'BID', 'levodopa_cr', null, ['Nacom retard', 'Sinemet CR', 'Levodopa retard']],
  ['levodopa_benserazide_er', 'Levodopa/Benserazid retard (HBS)', 'Levodopa retard', '100/25mg', 'PO', 'QHS', 'levodopa_cr', null, ['Madopar Depot', 'Madopar HBS']],
  ['levodopa_carbidopa_entacapone', 'Levodopa/Carbidopa/Entacapon', 'Levodopa + COMT-Hemmer', '100/25/200mg', 'PO', 'QID', 'levodopa', 'comt_entacapone', ['Stalevo', 'Corbilta']],
  ['levodopa_lcig', 'Levodopa/Carbidopa intestinal (LCIG)', 'Pumpentherapie', '20/5mg/ml', 'JEJ', 'CONT', 'lcig', null, ['Duodopa', 'LCIG']],
  ['levodopa_lecig', 'Levodopa/Carbidopa/Entacapon intestinal (LECIG)', 'Pumpentherapie', '20/5/400mg/ml', 'JEJ', 'CONT', 'lecig_maintenance', null, ['Lecigon', 'LECIG']],
  ['foslevodopa_foscarbidopa', 'Foslevodopa/Foscarbidopa (s.c.)', 'Pumpentherapie', '240/12mg/ml', 'SC', 'CONT', 'foslevodopa', null, ['Produodopa', 'Vyalev']],
  ['entacapone', 'Entacapon', 'COMT-Hemmer', '200mg', 'PO', 'QID', 'comt_entacapone', null, ['Comtess', 'Comtan']],
  ['opicapone', 'Opicapon', 'COMT-Hemmer', '50mg', 'PO', 'QHS', 'comt_opicapone', null, ['Ongentys']],
  ['tolcapone', 'Tolcapon', 'COMT-Hemmer', '100mg', 'PO', 'TID', 'comt_tolcapone', null, ['Tasmar']],
  ['rasagiline', 'Rasagilin', 'MAO-B-Hemmer', '1mg', 'PO', 'QD', 'rasagiline', null, ['Azilect']],
  ['safinamide', 'Safinamid', 'MAO-B-Hemmer', '50mg', 'PO', 'QD', 'safinamide', null, ['Xadago']],
  ['selegiline', 'Selegilin', 'MAO-B-Hemmer', '5mg', 'PO', 'QD', 'selegiline_oral', null, ['Movergan', 'Antiparkin']],
  ['pramipexole', 'Pramipexol', 'Dopaminagonist (non-ergot)', '0.35mg', 'PO', 'TID', 'pramipexole_base', null, ['Sifrol', 'Mirapex', 'Pramipexol Base']],
  ['pramipexole_er', 'Pramipexol retard', 'Dopaminagonist (non-ergot)', '1.05mg', 'PO', 'QD', 'pramipexole_base', null, ['Sifrol retard', 'Pramipexol ret', 'Pramipexol ER']],
  ['ropinirole', 'Ropinirol', 'Dopaminagonist (non-ergot)', '2mg', 'PO', 'TID', 'ropinirole', null, ['Requip']],
  ['ropinirole_er', 'Ropinirol retard', 'Dopaminagonist (non-ergot)', '8mg', 'PO', 'QD', 'ropinirole', null, ['Requip-Modutab', 'Ropinirol ER']],
  ['rotigotine', 'Rotigotin (Pflaster)', 'Dopaminagonist (transdermal)', '6mg/24h', 'TD', 'QD', 'rotigotine', null, ['Neupro', 'Leganto']],
  ['piribedil', 'Piribedil', 'Dopaminagonist', '50mg', 'PO', 'TID', 'piribedil', null, ['Clarium']],
  ['apomorphine_sc', 'Apomorphin (Pumpe s.c.)', 'Dopaminagonist (s.c.)', '5mg/ml', 'SC', 'CONT', 'apomorphine_sc', null, ['APO-go Pumpe', 'Dacepton', 'Apomorphin Pumpe']],
  ['apomorphine_pen', 'Apomorphin (Pen s.c.)', 'Dopaminagonist (s.c.)', '3mg', 'SC', 'PRN', 'apomorphine_sc', null, ['APO-go Pen', 'Apomorphin Pen']],
  ['amantadine', 'Amantadin', 'NMDA-Antagonist', '100mg', 'PO', 'BID', 'amantadine_ir', null, ['PK-Merz', 'Amantadin IR']],
  ['istradefylline', 'Istradefyllin', 'Adenosin-A2A-Antagonist', '20mg', 'PO', 'QD', 'istradefylline', null, ['Nourianz', 'Nouriast']],
  ['zonisamide', 'Zonisamid', 'Antikonvulsivum (PD-Zusatz)', '25mg', 'PO', 'QD', 'zonisamide', null, ['Zonegran']],
  ['trihexyphenidyl', 'Trihexyphenidyl', 'Anticholinergikum', '2mg', 'PO', 'TID', 'trihexyphenidyl', null, ['Artane', 'Parkopan']],
  ['propranolol', 'Propranolol', 'Betablocker (Tremor)', '40mg', 'PO', 'BID', null, null, ['Dociton']],
  ['primidone', 'Primidon', 'Antikonvulsivum (Tremor)', '62.5mg', 'PO', 'QHS', null, null, ['Mylepsinum', 'Liskantin']],
  ['topiramate', 'Topiramat', 'Antikonvulsivum (Tremor)', '25mg', 'PO', 'BID', null, null, ['Topamax']],
  ['clozapine', 'Clozapin', 'Antipsychotikum (PD-Psychose)', '12.5mg', 'PO', 'QHS', null, null, ['Leponex']],
  ['quetiapine', 'Quetiapin', 'Antipsychotikum', '25mg', 'PO', 'QHS', null, null, ['Seroquel']],
  ['rivastigmine', 'Rivastigmin', 'Cholinesterasehemmer', '4.6mg/24h', 'TD', 'QD', null, null, ['Exelon']],
  ['donepezil', 'Donepezil', 'Cholinesterasehemmer', '5mg', 'PO', 'QHS', null, null, ['Aricept']],
  ['midodrine', 'Midodrin', 'Sympathomimetikum (orthostatische Hypotonie)', '2.5mg', 'PO', 'TID', null, null, ['Gutron']],
  ['fludrocortisone', 'Fludrocortison', 'Mineralokortikoid (orthostatische Hypotonie)', '0.1mg', 'PO', 'QD', null, null, ['Astonin H']],
  ['domperidone', 'Domperidon', 'Antiemetikum', '10mg', 'PO', 'TID', null, null, ['Motilium']],
  ['clonazepam', 'Clonazepam', 'Benzodiazepin (RBD)', '0.5mg', 'PO', 'QHS', null, null, ['Rivotril']],
  ['melatonin', 'Melatonin', 'Schlaf (RBD)', '2mg', 'PO', 'QHS', null, null, ['Circadin']],
]
const DOSES_PER_DAY = { qd: 1, bid: 2, tid: 3, qid: 4, q4h: 6, q6h: 4, q8h: 3, q12h: 2, qhs: 1, ac: 3, pc: 3, prn: 0, cont: 1 }
const NEW_FREQUENCIES = [['cont', 'CONT', { label: 'Kontinuierlich (Pumpe / Pflaster)', icon: 'schedule', category: 'frequency', abbreviation: 'kont.', application: 'kont.', dosesPerDay: 1 }]]
const NEW_ROUTES = [
  ['td', 'TD', { label: 'Transdermal (Pflaster)', icon: 'route', category: 'route', abbreviation: 't.d.' }],
  ['jej', 'JEJ', { label: 'Intrajejunal (Pumpe)', icon: 'route', category: 'route', abbreviation: 'jej.' }],
]

// ---------------------------------------------------------------------------
// 7. Questionnaires whose result codes were repaired in the bundled JSON
// ---------------------------------------------------------------------------
const QUESTIONNAIRE_FILES = ['quest_schwab_england.json', 'quest_woq9.json', 'quest_rbd_sq.json', 'quest_bain_tremor.json']

// 8. Diagnosis status labels
const DX_STATUS = [
  ['dx_aktiv', 'aktiv', { color: 'positive', order: 1 }],
  ['dx_verdacht', 'Verdacht auf', { color: 'warning', order: 2 }],
  ['dx_inaktiv', 'inaktiv', { color: 'grey', order: 3 }],
]

export const NEURO_CONSULT_SEED_DATA = { CATEGORIES, CONCEPTS, ICD10_CONCEPTS, FIELD_SETS, VISIT_TYPES, PARKINSON_MERGE, TEMPLATES, DRUGS, NEW_FREQUENCIES, NEW_ROUTES, QUESTIONNAIRE_FILES, DX_STATUS, DOSES_PER_DAY }

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function upsertLookup(connection, { table, column, code, name, blob, source = SRC }) {
  await connection.executeCommand(
    `INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE, UPLOAD_ID)
     VALUES (?, ?, ?, ?, ?, ?, ${NOW}, ${NOW}, 1)
     ON CONFLICT(CODE_CD) DO UPDATE SET
       NAME_CHAR = excluded.NAME_CHAR,
       LOOKUP_BLOB = excluded.LOOKUP_BLOB,
       UPDATE_DATE = excluded.UPDATE_DATE`,
    [table, column, code, name, blob == null ? null : typeof blob === 'string' ? blob : JSON.stringify(blob), source],
  )
}

async function readBlob(connection, code) {
  const r = await connection.executeQuery('SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = ?', [code])
  if (!r.success || !r.data?.length) return null
  try {
    return JSON.parse(r.data[0].LOOKUP_BLOB || '{}') || {}
  } catch {
    return {}
  }
}

async function loadQuestionnaireFiles() {
  try {
    const mod = await import('../seeds/csv-loader.js')
    return mod.questionnaireFiles || []
  } catch {
    return []
  }
}

export const neuroConsultSeed = {
  name: '017-neuro-consult-seed',
  description: 'Neuro consultation cockpit: concepts (diagnoses, texts, scores, DBS, tremor, ICD-10), field sets, visit types, consult templates, Parkinson drug catalogue, questionnaire result fixes',
  execute: async (connection) => {
    // 1. categories
    for (const [code, label] of CATEGORIES) {
      await connection.executeCommand(
        `INSERT OR IGNORE INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE, UPLOAD_ID)
         VALUES ('CONCEPT_DIMENSION', 'CATEGORY_CHAR', ?, ?, ?, ${NOW}, ${NOW}, 1)`,
        [code, label, SRC],
      )
    }

    // 2. concepts (self-healing incl. path — S options resolve via CONCEPT_PATH children)
    for (const [path, code, name, valtype, unit, category] of [...CONCEPTS, ...ICD10_CONCEPTS]) {
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
        [path, code, name, valtype, unit, category, code.startsWith('ICD10:') ? 'ICD10-GM' : SRC],
      )
    }

    // 3. field sets (owned → overwrite)
    for (const fsDef of FIELD_SETS) {
      await upsertLookup(connection, { table: 'VISIT_DIMENSION', column: 'FIELD_SET_CD', code: fsDef.code, name: fsDef.name, blob: fsDef.blob })
    }

    // 4. visit types (new, owned → overwrite) + merge into the 007 Parkinson types
    for (const vt of VISIT_TYPES) {
      await upsertLookup(connection, { table: 'VISIT_DIMENSION', column: 'VISIT_TYPE_CD', code: vt.code, name: vt.name, blob: vt.blob })
    }
    for (const [code, merge] of Object.entries(PARKINSON_MERGE)) {
      const blob = await readBlob(connection, code)
      if (!blob) continue // 007 not applied (fresh test DB without it) → nothing to merge
      const fieldSets = Array.isArray(blob.fieldSets) ? [...blob.fieldSets] : []
      for (const add of merge.fieldSets) if (!fieldSets.some((f) => f.id === add.id)) fieldSets.push(add)
      const suggested = Array.isArray(blob.suggestedQuestionnaires) ? [...blob.suggestedQuestionnaires] : []
      for (const q of merge.suggestedQuestionnaires) if (!suggested.includes(q)) suggested.push(q)
      await connection.executeCommand(`UPDATE CODE_LOOKUP SET LOOKUP_BLOB = ?, UPDATE_DATE = ${NOW} WHERE CODE_CD = ?`, [JSON.stringify({ ...blob, fieldSets, suggestedQuestionnaires: suggested }), code])
    }

    // 5. consultation templates
    for (const t of TEMPLATES) {
      await upsertLookup(connection, { table: 'VISIT_DIMENSION', column: 'CONSULT_TEMPLATE_CD', code: t.code, name: t.name, blob: t.blob })
    }

    // 6. medication option lists
    for (const [code, name, generic, strength, route, frequency, ledType, comt, aliases] of DRUGS) {
      const blob = { generic, default_strength: strength, default_route: route, default_frequency: frequency, category: 'neurological', aliases }
      if (ledType) blob.ledType = ledType
      if (comt) blob.comt = comt
      await upsertLookup(connection, { table: 'VISIT_DIMENSION', column: 'DRUG_OPTIONS', code, name, blob })
    }
    for (const [code, name, blob] of NEW_FREQUENCIES) {
      await upsertLookup(connection, { table: 'CONCEPT_DIMENSION', column: 'FREQUENCY_OPTIONS', code, name, blob })
    }
    const freqRows = await connection.executeQuery(`SELECT CODE_CD, LOOKUP_BLOB FROM CODE_LOOKUP WHERE TABLE_CD = 'CONCEPT_DIMENSION' AND COLUMN_CD = 'FREQUENCY_OPTIONS'`)
    for (const row of freqRows.success ? freqRows.data : []) {
      const key = String(row.CODE_CD).toLowerCase()
      if (!(key in DOSES_PER_DAY)) continue
      let blob = {}
      try {
        blob = JSON.parse(row.LOOKUP_BLOB || '{}') || {}
      } catch {
        blob = {}
      }
      if (blob.dosesPerDay === DOSES_PER_DAY[key]) continue
      await connection.executeCommand(`UPDATE CODE_LOOKUP SET LOOKUP_BLOB = ?, UPDATE_DATE = ${NOW} WHERE CODE_CD = ?`, [JSON.stringify({ ...blob, dosesPerDay: DOSES_PER_DAY[key] }), row.CODE_CD])
    }
    for (const [code, name, blob] of NEW_ROUTES) {
      await upsertLookup(connection, { table: 'CONCEPT_DIMENSION', column: 'ROUTE_OPTIONS', code, name, blob })
    }

    // 7. questionnaire definitions with repaired result codes (INSERT OR IGNORE at
    //    first seed never refreshes them; BAIN_TREMOR may be missing entirely)
    const files = await loadQuestionnaireFiles()
    for (const filename of QUESTIONNAIRE_FILES) {
      const file = files.find((f) => f.filename === filename)
      if (!file) continue
      let def
      try {
        def = JSON.parse(file.content)
      } catch {
        continue
      }
      const code = String(def.short_title || filename.replace(/^quest_|\.json$/g, '')).toUpperCase()
      await upsertLookup(connection, { table: 'SURVEY_BEST', column: 'QUESTIONNAIRE', code, name: def.title || code, blob: file.content, source: 'SURVEY3' })
    }

    // 8. diagnosis status labels
    for (const [code, name, blob] of DX_STATUS) {
      await upsertLookup(connection, { table: 'OBSERVATION_FACT', column: 'DX_STATUS_CD', code, name, blob })
    }
  },
}
