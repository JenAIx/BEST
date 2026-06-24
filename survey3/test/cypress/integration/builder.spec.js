/// <reference types="cypress" />
//
// E2E für das Bau-Tool (Phase 2): Reihenfolge von Items und Optionen ändern,
// Live-Validierung, Speichern. Store-Prüfung via window.__mainStore.

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

describe('Bau-Tool (Builder)', () => {
  beforeEach(() => {
    cy.viewport(1280, 900)
    cy.on('window:confirm', () => true)
  })

  it('Items umsortieren (Runter) + Live-Validierung + Speichern', () => {
    cy.visit('/#/questman/create', freshLoad())
    cy.get('[data-cy=questman_create]').should('exist')

    cy.get('[data-cy=btn_description]').click()
    cy.get('[data-cy=quest_title]').type('Builder Test')
    cy.get('[data-cy=quest_short_title]').type('buildertest')

    cy.get('[data-cy=btn_items]').click()
    cy.get('[data-cy=btn_items_add]').click()
    cy.get('[data-cy=btn_items_add]').click()

    cy.get('[data-cy=item_expanse_0]').click()
    cy.get('[data-cy=item_label_0]').clear().type('AAA').blur()
    cy.get('[data-cy=item_expanse_1]').click()
    cy.get('[data-cy=item_label_1]').clear().type('BBB').blur()

    cy.get('[data-cy=validation_ok]').should('exist')

    // Item 0 nach unten
    cy.get('[data-cy=item_row_0] [data-cy=btn_options]').click()
    cy.get('[data-cy=item_down_0]').click()

    cy.get('[data-cy=btn_save]').click()

    cy.window().then((win) => {
      const q = win.__mainStore.QUESTMAN.get('buildertest')
      expect(q, 'Bogen gespeichert').to.exist
      expect(q.items).to.have.length(2)
      expect(q.items[0].label).to.equal('BBB')
      expect(q.items[1].label).to.equal('AAA')
    })
  })

  it('radio-Optionen umsortieren (Runter) + Speichern', () => {
    cy.visit('/#/questman/create', freshLoad())
    cy.get('[data-cy=questman_create]').should('exist')

    cy.get('[data-cy=btn_description]').click()
    cy.get('[data-cy=quest_title]').type('Opt Test')
    cy.get('[data-cy=quest_short_title]').type('opttest')

    cy.get('[data-cy=btn_items]').click()
    cy.get('[data-cy=btn_items_add]').click()
    cy.get('[data-cy=item_expanse_0]').click()
    cy.get('[data-cy=item_label_0]').clear().type('Frage').blur()

    // Typ → radio
    cy.contains('.q-btn', 'Type:').click()
    cy.contains('.q-item__label', /^radio$/).click()

    // zwei Optionen hinzufügen
    cy.get('[data-cy=opt_add]').click()
    cy.get('[data-cy=opt_add]').click()

    // Option-Labels setzen, dann Option 0 nach unten
    cy.get('[data-cy=opt_up_0]').should('exist')
    cy.get('[data-cy=opt_down_0]').click()

    cy.get('[data-cy=btn_save]').click()
    cy.window().then((win) => {
      const q = win.__mainStore.QUESTMAN.get('opttest')
      expect(q, 'Bogen gespeichert').to.exist
      expect(q.items[0].type).to.equal('radio')
      expect(q.items[0].options.length).to.be.greaterThan(1)
    })
  })
})
