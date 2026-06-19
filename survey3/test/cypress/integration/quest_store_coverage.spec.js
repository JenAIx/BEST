/// <reference types="cypress" />
//
// E2E-Abdeckung ~10% der Fragebögen (11/107): Wir füllen jeden Bogen über die
// echte UI aus (Klicks auf radio / multiple_radio-Matrizen) und prüfen DANACH im
// Pinia-Store (window.__mainStore.QUESTMAN.summary), ob
//   (a) die strukturierten Werte korrekt im values-Array landen
//       (multiple_radio → ein Eintrag je Sub-Frage, in richtiger Reihenfolge),
//   (b) die abgeleiteten Berechnungen (results: sum/avg/ids-Domänen, evaluation)
//       exakt stimmen.
// Erwartungswerte sind unabhängig von Hand berechnet (siehe Kommentare je Fall).
//
// Deckt bewusst die fehleranfälligen multiple_radio-Arrays ab und ist zugleich
// Regressionsschutz für die hart erkämpfte Ausfüll→Store-Reaktivität
// (QuestMan bleibt reaktiv-im-State, kein markRaw — siehe ARCHITECTURE.md).

// answers-Spaltenreihenfolge je Bogen → Klick-Spalte = answers.indexOf(wunschwert)
// (hier direkt als Spaltenindizes angegeben; resultierender Wert = answers[col]).

const CASES = [
  {
    short: 'phq_9',
    // sum, answers [0,1,2,3]; Muster [0,1,2,3,0,1,2,3,0] → Summe 12
    matrices: [[0, 1, 2, 3, 0, 1, 2, 3, 0]],
    values: [0, 1, 2, 3, 0, 1, 2, 3, 0],
    results: [{ label: 'sum', value: 12, evaluation: "'leichtgradige' Depression", code: 'SCTID: 720433000' }],
  },
  {
    short: 'ess',
    // sum, answers [0,1,2,3]; [1,2,3,0,1,2,3,0] → 12 → range [11,32]
    matrices: [[1, 2, 3, 0, 1, 2, 3, 0]],
    values: [1, 2, 3, 0, 1, 2, 3, 0],
    results: [{ label: 'sum', value: 12, evaluation: 'Starke Tagesschläfrigkeit', code: 'SCTID: 763254009' }],
  },
  {
    short: 'DGI', // zuvor gefixter Scoring-Bug — hier als E2E festgenagelt
    // sum, answers [0,1,2,3]; [3,3,2,2,3,3,2,2] → 20
    matrices: [[3, 3, 2, 2, 3, 3, 2, 2]],
    values: [3, 3, 2, 2, 3, 3, 2, 2],
    results: [{ label: 'sum', value: 20, code: 'SCTID: 443707009' }],
  },
  {
    short: 'GDS',
    // ids→sum, answers [1,2] (Spalte 0 = Wert 1); alle Wert 1:
    // ids [1,5,7,11,13] (5×) → score 0; übrige 10 ids → score 1 → Summe 10
    matrices: [Array(15).fill(0)],
    values: Array(15).fill(1),
    results: [{ label: 'sum', value: 10, evaluation: 'Verdacht auf Depression' }],
  },
  {
    short: 'bfi10',
    // ids→avg-Domänen mit Reverse-Scoring. answers [1,2,3,4,5] (col = wert-1).
    // Werte je id 1..10: [1,5,1,1,1,5,5,5,5,5]
    // Scores: id1(rev)5, id2(id)5, id3(rev)5, id4(rev)5, id5(rev)5, id6(id)5,
    //         id7(rev)1, id8(id)5, id9(id)5, id10(id)5
    // Domänen avg: E[1,6]=5, N[4,9]=5, O[5,10]=5, G[3,8]=5, V[2,7]=(5+1)/2=3
    matrices: [[0, 4, 0, 0, 0, 4, 4, 4, 4, 4]],
    values: [1, 5, 1, 1, 1, 5, 5, 5, 5, 5],
    results: [
      { code: 'CUSTOM: NP\\BFI10\\E', value: 5 },
      { code: 'CUSTOM: NP\\BFI10\\N', value: 5 },
      { code: 'CUSTOM: NP\\BFI10\\O', value: 5 },
      { code: 'CUSTOM: NP\\BFI10\\G', value: 5 },
      { code: 'CUSTOM: NP\\BFI10\\V', value: 3 },
    ],
  },
  {
    short: 'pdss2',
    // ids (id1 reverse [0,1,2,3,4]→[4,3,2,1,0]; ids 2..15 raw) → sum.
    // answers [4,3,2,1,0] (Spalte 0 = Wert 4); alle Wert 4:
    // id1: Wert4 → score 0; ids 2..15 (14×): raw 4 → 56; Total 56
    matrices: [Array(15).fill(0)],
    values: Array(15).fill(4),
    results: [{ label: 'Total Score', value: 56 }],
  },
  {
    short: 'ECOG', // zuvor gefixter Bug + neu gefundener Domänen-Dup (Sprache id16)
    // 6 Matrizen, answers [0,1,2,3,kA] (Spalte 1 = Wert 1); alle Wert 1.
    // Total 39; Domänen 8/9/7/5/6/4 (= 39, nach Dup-Fix)
    matrices: [Array(8).fill(1), Array(9).fill(1), Array(7).fill(1), Array(5).fill(1), Array(6).fill(1), Array(4).fill(1)],
    values: Array(39).fill(1),
    results: [
      { code: 'CUSTOM: NP\\ECOG\\TOTALSCORE', value: 39 },
      { label: 'Gedächtnis', value: 8 },
      { label: 'Sprache', value: 9 },
      { label: 'EF-Planung', value: 5 },
      { label: 'EF-Organisation', value: 6 },
      { label: 'EF-geteilte_Aufmerksamkeit', value: 4 },
    ],
  },
  {
    short: 'PANAS',
    // ids identity → 2 avg-Domänen. answers [1,2,3,4,5] (col 2 = Wert 3); alle 3.
    // positive/negative avg je 3
    matrices: [Array(20).fill(2)],
    values: Array(20).fill(3),
    results: [{ label: 'positive', value: 3 }, { label: 'negative', value: 3 }],
  },
  {
    short: 'whodas2',
    // sum + evaluation. answers [1,2,3,4,5] (col 2 = Wert 3); alle 3 → 36 → [36,47]
    matrices: [Array(12).fill(2)],
    values: Array(12).fill(3),
    results: [{ label: 'sum', value: 36, evaluation: 'Schwere Beeinträchtigung', code: '450738001' }],
  },
  {
    short: 'aes_scale',
    // ids (ids 6,10,11 reverse) → sum. answers [3,2,1,0] (col 0 = Wert 3); alle 3.
    // 15 identity-Items → 3 (=45), 3 reverse-Items (6,10,11) → 0; Summe 45
    matrices: [Array(18).fill(0)],
    values: Array(18).fill(3),
    results: [{ label: 'sum', value: 45, code: 'CUSTOM: AES_APATHIE_SCORE' }],
  },
  {
    short: 'mrs',
    // Einzel-radio (kein multiple_radio) zur Kontrastabdeckung. Wert 3 → sum 3
    radio: 3,
    values: [3],
    results: [{ label: 'sum', value: 3, code: 'SCTID: 1255866005' }],
  },
]

function findResult(results, exp) {
  if (exp.code) return results.find((r) => r.coding && r.coding.code === exp.code)
  return results.find((r) => r.label === exp.label)
}

context('Questionnaire store coverage (UI → store)', () => {
  beforeEach(() => {
    cy.viewport(1280, 900) // Desktop → Listen-Modus (alle Items auf einer Seite)
    cy.on('window:confirm', () => true)
  })

  CASES.forEach((tc) => {
    it(`${tc.short}: füllt aus und speichert korrekt strukturiert im Store`, () => {
      cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: tc.short, mode: 'single' }))}`)
      cy.get('[data-cy=page_quest]').should('exist')
      cy.get('[data-cy=list_entries]').should('exist')

      // --- ausfüllen ---
      if (tc.matrices) {
        tc.matrices.forEach((cols, mIdx) => {
          cols.forEach((col, row) => {
            cy.get('.mr-table').eq(mIdx).find('tbody tr').eq(row).find('.q-radio').eq(col).click({ force: true })
          })
        })
      }
      if (tc.radio !== undefined) {
        cy.get('[data-cy=list_entries] .q-radio').eq(tc.radio).click({ force: true })
      }

      // --- im Store prüfen ---
      cy.window().then((win) => {
        const summary = win.__mainStore.QUESTMAN.summary
        expect(summary, 'summary vorhanden').to.exist

        // (a) strukturierte Werte: multiple_radio → ein Item je Sub-Frage, in Reihenfolge
        const values = summary.items.map((it) => it.value)
        expect(summary.items, 'Anzahl Ergebnis-Items').to.have.length(tc.values.length)
        expect(values, 'values-Array (Reihenfolge & Struktur)').to.deep.equal(tc.values)

        // (b) Berechnungen
        tc.results.forEach((exp) => {
          const r = findResult(summary.results, exp)
          expect(r, `result ${exp.code || exp.label} vorhanden`).to.exist
          expect(r.value, `result ${exp.code || exp.label} value`).to.equal(exp.value)
          if (exp.evaluation !== undefined) {
            expect(r.evaluation, `evaluation ${exp.label}`).to.equal(exp.evaluation)
          }
        })
      })
    })
  })
})
