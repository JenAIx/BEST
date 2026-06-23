/// <reference types="cypress" />
//
// E2E für den drawing-Item-Typ + die 3-Bogen-Kette (Uhr/Schrift/Spirale).
// Prüft: Pflicht-Zeichnung blockt das Absenden bis gezeichnet wurde; nach dem
// Zeichnen wird ein Base64-PNG im Store gespeichert; Kette läuft bis /finished_quest.

const PID = 'P1'

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

// Zeichnet ein paar Striche auf das Canvas (Pointer-Events).
function draw() {
  cy.get('[data-cy=drawing_canvas]')
    .trigger('pointerdown', 40, 40, { pointerId: 1, button: 0, force: true })
    .trigger('pointermove', 120, 90, { pointerId: 1, force: true })
    .trigger('pointermove', 200, 200, { pointerId: 1, force: true })
    .trigger('pointermove', 90, 240, { pointerId: 1, force: true })
    .trigger('pointerup', 90, 240, { pointerId: 1, force: true })
}

// Zeichnen + explizit „Übernehmen" (erst dann zählt die Zeichnung als beantwortet).
function drawAndConfirm() {
  draw()
  cy.get('[data-cy=drawing_save]').click()
}

describe('Zeichen-Flow (Uhr / Schrift / Spirale)', () => {
  beforeEach(() => cy.viewport(1280, 900)) // Listen-Modus

  it('Pflicht-Zeichnung: Absenden blockt bis gezeichnet, dann gespeichert', () => {
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: 'clock', mode: 'single', PID }))}`, freshLoad())
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('[data-cy=drawing_canvas]').should('exist')

    // ohne Zeichnung absenden → blockt (kein Wechsel zu /finished_quest, keine Response)
    cy.get('[data-cy=submitquest]').click()
    cy.location('hash').should('not.include', '/finished_quest')
    cy.window().then((win) => expect(win.__mainStore.STORAGE.get().length).to.equal(0))

    // gezeichnet, aber NICHT übernommen → weiterhin blockiert (Wert noch leer)
    draw()
    cy.get('[data-cy=drawing_unsaved]').should('exist')
    cy.get('[data-cy=submitquest]').click()
    cy.location('hash').should('not.include', '/finished_quest')
    cy.window().then((win) => expect(win.__mainStore.STORAGE.get().length).to.equal(0))

    // Übernehmen → absenden → gespeichert
    cy.get('[data-cy=drawing_save]').click()
    cy.get('[data-cy=drawing_unsaved]').should('not.exist')
    cy.get('[data-cy=submitquest]').click()
    cy.location('hash').should('include', '/finished_quest')
    cy.window().then((win) => {
      const doc = win.__mainStore.STORAGE.get(-1)
      const drawn = doc.cda // structure-agnostisch prüfen wir über summary unten
      expect(win.__mainStore.STORAGE.get().length).to.equal(1)
      expect(doc.info.PID).to.equal(PID)
    })
  })

  it('3er-Kette: jede Zeichnung wird als Base64-PNG gespeichert', () => {
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: ['clock', 'handwriting', 'spiral'], mode: 'protected', PID }))}`, freshLoad())
    cy.get('[data-cy=page_quest]').should('exist')

    // Bogen 1/3
    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 1 von 3')
    drawAndConfirm()
    cy.get('[data-cy=submitquest]').click()

    // Bogen 2/3
    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 2 von 3')
    drawAndConfirm()
    cy.get('[data-cy=submitquest]').click()

    // Bogen 3/3
    cy.get('[data-cy=quest_chain]').should('contain', 'Fragebogen 3 von 3')
    drawAndConfirm()
    cy.get('[data-cy=submitquest]').click()

    cy.location('hash').should('include', '/finished_quest')
    cy.window().then((win) => {
      const all = win.__mainStore.STORAGE.get()
      expect(all.length, '3 Responses').to.equal(3)
      // jede Response trägt eine echte Zeichnung (Base64-PNG) in irgendeinem Item-value
      all.forEach((doc) => {
        const json = JSON.stringify(doc)
        expect(json).to.match(/data:image\/png;base64,/)
        expect(doc.info.PID).to.equal(PID)
      })
    })
  })
})
