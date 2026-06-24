/// <reference types="cypress" />
//
// E2E: klassischer Einzel-Fragebogen-Flow (parallel zum Visiten-Workflow).
//   Fragebogenauswahl → filtern → Quest öffnen → PID + ausfüllen → speichern →
//   Abschluss-Screen → Eintrag liegt unter „Gespeicherte Fragebögen".
// Router im Hash-Modus (/#/...).

context('Single Questionnaire Flow', () => {
  const PID = `CYQ_${Date.now()}`

  beforeEach(() => {
    cy.viewport(1280, 900)
    cy.on('window:confirm', () => true)
  })

  it('wählt MRS aus, füllt aus, speichert und findet den Eintrag im Storage', () => {
    // Auswahl
    cy.visit('/#/select')
    cy.get('[data-cy=selectquest]').should('exist')

    // filtern auf "Rankin" → nur MRS bleibt übrig (Suche immer sichtbar)
    cy.get('[data-cy=filter_input]').type('Rankin')
    cy.get('[data-cy=questlist0]').should('contain', 'Rankin').click()
    cy.get('[data-cy=btn_gotoquest]').click()

    // Quest ausfüllen (Listen-Modus = Standard)
    cy.get('[data-cy=page_quest]').should('exist')
    cy.get('[data-cy=PID]').type(PID)
    cy.get('[data-cy=list_entries]').find('.q-radio').first().click({ force: true })
    cy.get('[data-cy=submitquest]').click()

    // → Abschluss-Screen
    cy.hash().should('contain', 'finished_quest')

    // Eintrag liegt im Storage (Tab „Gespeicherte Fragebögen")
    cy.visit('/#/storage')
    cy.get('[data-cy=page_storage]').should('exist')
    cy.get('[data-cy=items]').should('contain', PID)
  })

  it('verlangt eine PID bevor gespeichert wird', () => {
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: 'mrs', mode: 'single' }))}`)
    cy.get('[data-cy=page_quest]').should('exist')

    // ohne PID ausfüllen und speichern → bleibt auf der Quest-Seite (Validierung)
    cy.get('[data-cy=list_entries]').find('.q-radio').first().click({ force: true })
    cy.get('[data-cy=submitquest]').click()
    cy.hash().should('contain', 'quest')
    cy.get('[data-cy=page_quest]').should('exist')
  })
})
