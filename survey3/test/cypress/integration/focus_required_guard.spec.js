/// <reference types="cypress" />
//
// Guard: Im Fokus-Modus dürfen OBLIGATORISCHE (force !== false) Fragen NICHT
// übersprungen werden — weder per "Weiter" noch per "Absenden". Deckt besonders
// die multiple_radio-Matrizen ab (die fehleranfälligen "multiple options"-Fragen).
//
// Hinweis: Ob ein Bogen eine Matrix als Pflicht behandelt, steckt im Bogen-JSON
// (item.force). Dieser Test prüft das KORREKTE Verhalten an einem Pflicht-Bogen
// (ess: multiple_radio ohne force:false → Pflicht). Bögen mit force:false sind
// bewusst optional und hier nicht Gegenstand.

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

describe('Fokus-Modus: Pflicht-Fragen nicht überspringbar', () => {
  beforeEach(() => cy.viewport('iphone-6')) // < sm → Fokus-Modus

  it('ess: Pflicht-Matrix blockt "Weiter" bei leerer und bei teilweiser Antwort', () => {
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: 'ess', mode: 'single' }))}`, freshLoad())
    cy.get('[data-cy=page_quest]').should('exist')

    // PID-Schritt erledigen → Matrix-Schritt
    cy.get('[data-cy=PID]').should('exist').type('X')
    cy.get('[data-cy=quest_next]').click()
    cy.get('.mr-table tbody tr').should('have.length', 8)

    // (1) komplett leer → Weiter blockt (kein Review, Matrix bleibt)
    cy.get('[data-cy=quest_next]').click()
    cy.get('[data-cy=review_item]').should('not.exist')
    cy.get('.mr-table tbody tr').should('have.length', 8)

    // (2) nur 7 von 8 Zeilen → Weiter blockt weiterhin
    for (let r = 0; r < 7; r++) {
      cy.get('.mr-table tbody tr').eq(r).find('.q-radio').eq(1).click({ force: true })
    }
    cy.get('[data-cy=quest_next]').click()
    cy.get('[data-cy=review_item]').should('not.exist')
    cy.get('.mr-table tbody tr').should('have.length', 8)
    cy.window().then((win) => {
      const mr = win.__mainStore.QUESTMAN.activeQuest.value.items.find((it) => it.type === 'multiple_radio')
      expect(mr.value.filter((x) => x === null || x === undefined).length, 'noch eine offene Zeile').to.equal(1)
    })

    // (3) letzte Zeile beantworten → Weiter führt jetzt zum Review
    cy.get('.mr-table tbody tr').eq(7).find('.q-radio').eq(1).click({ force: true })
    cy.get('[data-cy=quest_next]').click()
    cy.get('[data-cy=review_item]').should('exist')
  })

  it('ess (Preset-Flow): Pflicht-Matrix blockt "Absenden" bei leerer Antwort', () => {
    // Im Preset-Flow ist die Matrix der letzte Schritt → Button ist "Absenden".
    const params = { presets: ['ess'], PID: 'TESTPID', mode: 'protected' }
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify(params))}`, freshLoad())
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('.mr-table tbody tr').should('have.length', 8)

    // Absenden ohne Antwort → bleibt auf der Matrix, KEIN Wechsel zu /finished_quest
    cy.get('[data-cy=submitquest]').click()
    cy.location('hash').should('not.include', '/finished_quest')
    cy.get('.mr-table tbody tr').should('have.length', 8)
    cy.window().then((win) => {
      expect(win.__mainStore.STORAGE.get().length, 'keine Response gespeichert').to.equal(0)
    })
  })
})
