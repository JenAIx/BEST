/// <reference types="cypress" />
//
// E2E für den durchgeklickten Preset-Flow (mehrere Bögen am Stück), inkl.
// Store-Prüfung (window.__mainStore). Sichert die UX-Ziele ab:
//   - globaler Fortschritt "Fragebogen X von Y"
//   - keine PID-Dopplung / kein PID-Zwischenschritt (PID kommt aus der URL)
//   - kein Review-Zwischenschritt zwischen den Bögen (nahtloser Übergang)
//   - nach jedem Absenden landet eine Response korrekt im Store (info.PID)
//   - nach dem letzten Bogen → /finished_quest, Ketten-Queue leer
// Gegenprobe: Einzelbogen/Direktlink behält PID-Schritt + Review, kein globaler Balken.

const PID = 'TESTPID'

// Lädt mit frischer IndexedDB + leerem localStorage (kein Migrationszustand).
function freshLoad() {
  return {
    onBeforeLoad(win) {
      win.localStorage.clear()
      return new Promise((resolve) => {
        const req = win.indexedDB.deleteDatabase('surveyBEST_DB')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
    },
  }
}

// Füllt die (einzige) multiple_radio-Matrix des aktuellen Bogens (Listen-Modus):
// jede Zeile in der angegebenen Spalte anklicken.
function fillMatrix(rows, col) {
  for (let r = 0; r < rows; r++) {
    cy.get('.mr-table').eq(0).find('tbody tr').eq(r).find('.q-radio').eq(col).click({ force: true })
  }
}

describe('Preset-Flow (Kette mit Store-Prüfung)', () => {
  beforeEach(() => {
    cy.on('window:confirm', () => true)
  })

  it('Fokus-Modus: 2-Bogen-Kette nahtlos durchklicken (keine PID-/Review-Zwischenschritte)', () => {
    cy.viewport('iphone-6') // < sm → Fokus-Modus aktiv
    // mrs ist radio-only → je Bogen genau ein Frage-Schritt (im Fokus-Modus gut klickbar)
    const params = { presets: ['mrs', 'mrs'], PID, mode: 'protected' }
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify(params))}`, freshLoad())

    cy.get('[data-cy=page_quest]').should('exist')

    // --- Bogen 1: globaler Fortschritt, keine PID-Abfrage, direkt die Frage ---
    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 1 von 2')
    cy.get('[data-cy=quest_chain_progress]').should('exist')
    cy.get('[data-cy=PID]').should('not.exist')                  // keine PID-Dopplung/-Abfrage
    cy.get('[data-cy=quest_pid_context]').should('contain', PID)  // PID nur als read-only Kontext
    cy.get('[data-cy=review_item]').should('not.exist')           // kein Review-Schritt
    cy.get('[data-cy=quest_prev]').should('be.disabled')          // erster Schritt = Frage

    cy.get('[data-cy=list_entries] .q-radio').first().click({ force: true })
    cy.get('[data-cy=submitquest]').should('exist').click()

    // --- Übergang: direkt Bogen 2, PID NICHT erneut abgefragt, kein Review ---
    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 2 von 2')
    cy.get('[data-cy=PID]').should('not.exist')
    cy.get('[data-cy=review_item]').should('not.exist')

    // Store nach dem 1. Absenden
    cy.window().then((win) => {
      const store = win.__mainStore
      expect(store.STORAGE.get().length, 'eine Response gespeichert').to.equal(1)
      expect(store.STORAGE.get(-1).info.PID, 'PID der Response').to.equal(PID)
      expect(store.QUESTMAN.preset_index).to.equal(2)
      expect(store.QUESTMAN.preset_total).to.equal(2)
    })

    cy.get('[data-cy=list_entries] .q-radio').first().click({ force: true })
    cy.get('[data-cy=submitquest]').should('exist').click()

    // --- nach dem letzten Bogen: Abschluss-Screen, zwei Responses ---
    cy.location('hash').should('include', '/finished_quest')
    cy.window().then((win) => {
      const store = win.__mainStore
      expect(store.STORAGE.get().length, 'zwei Responses gespeichert').to.equal(2)
      store.STORAGE.get().forEach((doc) => expect(doc.info.PID).to.equal(PID))
    })
  })

  it('Listen-Modus (iPad): Kette mit Matrizen, globaler Fortschritt, keine PID-Dopplung', () => {
    cy.viewport(1280, 900) // ≥ sm → Listen-Modus (alle Items auf einer Seite)
    const params = { presets: ['ess', 'whodas2'], PID, mode: 'protected' }
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify(params))}`, freshLoad())

    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 1 von 2')
    cy.get('[data-cy=PID]').should('not.exist')                  // PID-Feld ausgeblendet (PID vorgegeben)
    cy.get('[data-cy=quest_pid_context]').should('contain', PID)

    fillMatrix(8, 1) // ess: 8 Sub-Fragen
    cy.get('[data-cy=submitquest]').click()

    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 2 von 2')
    cy.window().then((win) => {
      const store = win.__mainStore
      expect(store.STORAGE.get().length).to.equal(1)
      expect(store.STORAGE.get(-1).info.PID).to.equal(PID)
    })

    fillMatrix(12, 1) // whodas2: 12 Sub-Fragen
    cy.get('[data-cy=submitquest]').click()

    cy.location('hash').should('include', '/finished_quest')
    cy.window().then((win) => {
      expect(win.__mainStore.STORAGE.get().length).to.equal(2)
    })
  })

  it('Einzelbogen/Direktlink behält PID-Schritt, kein globaler Balken', () => {
    cy.viewport('iphone-6')
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: 'mrs', mode: 'single' }))}`, freshLoad())

    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('[data-cy=quest_chain]').should('not.exist') // chainTotal === 1 → kein globaler Balken
    cy.get('[data-cy=PID]').should('exist')             // PID-Schritt vorhanden (keine PID vorgegeben)

    cy.window().then((win) => {
      expect(win.__mainStore.QUESTMAN.preset_total).to.equal(1)
    })
  })
})
