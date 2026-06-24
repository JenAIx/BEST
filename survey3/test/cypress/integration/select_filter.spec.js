/// <reference types="cypress" />
//
// /select: inline-Suche + Auswahl bleibt über Filterwechsel hinweg korrekt
// (Auswahl per Bogen-Key statt Filter-Index — früher verrutschten die Häkchen).

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

describe('/select — Suche & Auswahl', () => {
  beforeEach(() => cy.viewport(1100, 900))

  it('Auswahl bleibt über Filterwechsel erhalten', () => {
    cy.visit('/#/select', freshLoad())
    cy.get('[data-cy=selectquest]').should('exist')

    // zwei Bögen wählen
    cy.get('[data-cy=questlist0]').click()
    cy.get('[data-cy=questlist1]').click()
    cy.get('[data-cy=select_count]').should('contain', '2').and('contain', 'ausgewählt')

    // Filter, der die Auswahl ausblendet → Auswahl bleibt trotzdem bestehen
    cy.get('[data-cy=filter_input]').type('zzz_kein_treffer_xyz')
    cy.get('[data-cy=select_count]').should('contain', '2').and('contain', 'ausgewählt')

    // Filter leeren → mehr als ein Bogen wählbar → „Vorlage erstellen" sichtbar
    cy.get('[data-cy=filter_input]').clear()
    cy.get('[data-cy=btn_gotopreset]').should('exist')
  })

  it('Suche filtert die Liste (Treffer reduziert)', () => {
    cy.visit('/#/select', freshLoad())
    cy.get('[data-cy=questlist0]', { timeout: 10000 }).should('exist')
    cy.get('[data-cy=filter_input]').type('Rankin')
    cy.get('[data-cy=questlistRoot] .select-card').should('have.length', 1)
    cy.get('[data-cy=questlist0]').should('contain', 'MRS')
  })
})
