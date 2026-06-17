// Standard-Visiten-Vorlagen der LEC-SEQ-Studie (Lecigon-Sequenztherapie).
// VisitMan.init() synchronisiert sie versioniert in den Browser-Storage: läuft die
// gespeicherte Seed-Version < SEED_VERSION, werden die Default-Vorlagen per Label
// angelegt bzw. aktualisiert (selbst angelegte Vorlagen bleiben unberührt).
// SEED_VERSION bei Änderung der Defaults erhöhen, damit bestehende Installationen
// die Aktualisierung übernehmen. Zusammenstellung gemäß Handout-Score-Matrix (V1–V4).
//
// Hinweis: "Erwartungsfragebogen" (laut Handout V1 + V4) existiert noch nicht als
// Fragebogen und ist daher hier ausgelassen.
export const SEED_VERSION = 2
export const DEFAULT_VISIT_TEMPLATES = [
  {
    label: 'LEC-SEQ V1 – Baseline',
    questionnaires: ['lecseq-anamnese-v1', 'slts7', 'psq18', 'pdq8', 'whodas2', 'bdi2', 'pdss2', 'updrs_3', 'updrs_4', 'nms_quest', 'nmss'],
  },
  {
    label: 'LEC-SEQ V2 – 3 Monate',
    questionnaires: ['slts7', 'psq18', 'updrs_3', 'updrs_4', 'nms_quest', 'lecseq-verlauf', 'lecseq-adr'],
  },
  {
    label: 'LEC-SEQ V3 – 6 Monate',
    questionnaires: ['slts7', 'psq18', 'updrs_3', 'updrs_4', 'nms_quest', 'lecseq-verlauf', 'lecseq-adr'],
  },
  {
    label: 'LEC-SEQ V4 – 12 Monate (Abschluss)',
    questionnaires: ['slts7', 'psq18', 'pdq8', 'whodas2', 'bdi2', 'pdss2', 'updrs_3', 'updrs_4', 'nms_quest', 'nmss', 'lecseq-verlauf', 'lecseq-adr'],
  },
]
