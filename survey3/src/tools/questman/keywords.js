// Kontrolliertes Schlüsselwort-Vokabular (primär deutsch, Domänen-Begriffe).
//
// Eine Quelle der Wahrheit für:
//   - die Keyword-Vorschläge im Bau-Tool (QuestManagerCreate.vue),
//   - den Lint-Test (keyword_vocab.test.js), der erzwingt, dass alle gebündelten
//     Fragebögen ausschließlich Keywords aus diesem Vokabular tragen.
//
// Regeln (siehe docs/ADDING_QUESTIONNAIRES.md):
//   - Keine Instrumentennamen/Abkürzungen als Keyword (kein "bfi", "bayer", …).
//   - Domänen-Begriffe, die die Suche unterstützen (Was misst der Bogen?).
//   - Erweiterbar — neue Begriffe hier ergänzen, dann im Korpus verwenden.

export const KEYWORD_VOCAB = [
  // Parkinson / Bewegung
  'Parkinson', 'Tremor', 'Dystonie', 'Torticollis', 'Motorik', 'Gangbild', 'Gleichgewicht', 'Mobilität',
  'Sturz', 'Sturzangst', 'Wearing-off', 'Fluktuation', 'Dyskinesie', 'Dysphagie', 'Schlaganfall',
  'Neurorehabilitation', 'Rehabilitation',
  // Kognition
  'Demenz', 'Kognition', 'Gedächtnis', 'Aufmerksamkeit', 'exekutive Funktion', 'Visuokonstruktion',
  'Intelligenz', 'Konzentration',
  // Psyche
  'Depression', 'Angst', 'Apathie', 'Anhedonie', 'Stimmung', 'Sucht', 'posttraumatisch', 'Belastung',
  // Schlaf / Erschöpfung
  'Schlaf', 'Tagesschläfrigkeit', 'Fatigue', 'Erschöpfung', 'REM-Schlafstörung',
  // Schmerz
  'Schmerz',
  // Lebensqualität / Alltag
  'Lebensqualität', 'Wohlbefinden', 'Gesundheitszustand', 'Alltagsaktivitäten', 'Selbstständigkeit',
  'Funktionsfähigkeit', 'Behinderung', 'körperliche Aktivität',
  // Versorgung / Kontext
  'Patientenzufriedenheit', 'Versorgung', 'Adhärenz', 'Medikation', 'Ernährung', 'Geriatrie',
  'autonome Symptome', 'Persönlichkeit', 'Anamnese', 'Verlauf', 'Screening', 'Selbstbeurteilung',
  'Fremdbeurteilung', 'Motivation', 'Zielerreichung', 'Angehörige',
]

export const KEYWORD_VOCAB_SET = new Set(KEYWORD_VOCAB)
