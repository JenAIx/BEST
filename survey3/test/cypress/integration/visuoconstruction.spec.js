/// <reference types="cypress" />
//
// E2E für die Visuokonstruktions-Copy-Bögen (Fünfecke / Würfel): Modell-Figur
// (Inline-SVG) wird angezeigt, die Abzeichnung ist Pflicht und wird als PNG
// gespeichert; das optionale Bemerkungsfeld blockt nicht.

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

function draw() {
  cy.get('[data-cy=drawing_canvas]')
    .trigger('pointerdown', 60, 60, { pointerId: 1, force: true })
    .trigger('pointermove', 220, 120, { pointerId: 1, force: true })
    .trigger('pointermove', 140, 260, { pointerId: 1, force: true })
    .trigger('pointerup', 140, 260, { pointerId: 1, force: true })
}

describe('Visuokonstruktion (Fünfecke / Würfel)', () => {
  beforeEach(() => cy.viewport(1000, 1000))

  ;['pentagons', 'cube'].forEach((short) => {
    it(`${short}: Modell sichtbar, Abzeichnung Pflicht → als PNG gespeichert`, () => {
      cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: short, mode: 'single', PID }))}`, freshLoad())
      cy.get('[data-cy=page_quest]').should('exist')
      // Modell-Figur (Inline-SVG) wird gezeigt
      cy.get('svg').should('exist')
      cy.get('[data-cy=drawing_canvas]').should('exist')

      // ohne Abzeichnung absenden → blockt (Pflicht)
      cy.get('[data-cy=submitquest]').click()
      cy.location('hash').should('not.include', '/finished_quest')

      // zeichnen + übernehmen + absenden → gespeichert mit PNG
      draw()
      cy.get('[data-cy=drawing_save]').click()
      cy.get('[data-cy=submitquest]').click()
      cy.location('hash').should('include', '/finished_quest')
      cy.window().then((win) => {
        const doc = win.__mainStore.STORAGE.get(-1)
        expect(doc.info.PID).to.equal(PID)
        expect(JSON.stringify(doc)).to.match(/data:image\/png;base64,/)
      })
    })
  })
})
