/// <reference types="cypress" />
//
// E2E für das überarbeitete Bau-Tool: Kopf + Felder sind direkt sichtbar
// (zweispaltiges Layout mit Live-Vorschau), neue Felder werden auto-expandiert.
// Reihenfolge ändern, Live-Validierung, Speichern → Store-Prüfung.

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

describe('Bau-Tool (Builder, Redesign)', () => {
  beforeEach(() => {
    cy.viewport(1400, 900)
    cy.on('window:confirm', () => true)
  })

  it('intelligente Namensgebung + Items umsortieren + Live-Validierung + Speichern', () => {
    cy.visit('/#/questman/create', freshLoad())
    cy.get('[data-cy=questman_create]').should('exist')

    // Titel eingeben → short_title wird automatisch erzeugt
    // (Editor-Selektoren auf .builder-editor scopen — die Live-Vorschau nutzt
    //  teils dieselben data-cy wie der Fragebogen-Renderer.)
    cy.get('.builder-editor [data-cy=quest_title]').type('Mein Test Bogen')
    cy.get('.builder-editor [data-cy=quest_short_title]').should('have.value', 'mein_test_bogen')

    // zwei Felder hinzufügen (werden auto-expandiert)
    cy.get('[data-cy=btn_items_add]').click()
    cy.get('[data-cy=btn_items_add]').click()

    // Labels setzen (Felder sind bereits offen)
    cy.get('[data-cy=item_label_0]').clear().type('AAA').blur()
    cy.get('[data-cy=item_label_1]').clear().type('BBB').blur()

    // Live-Validierung: gültig
    cy.get('[data-cy=validation_ok]').should('exist')
    cy.get('[data-cy=validation_chip]').should('contain', 'gültig')

    // Live-Vorschau zeigt den Titel
    cy.get('[data-cy=builder_preview]').should('contain', 'Mein Test Bogen')

    // Item 0 nach unten
    cy.get('[data-cy=item_row_0] [data-cy=btn_options]').click()
    cy.get('[data-cy=item_down_0]').click()

    cy.get('[data-cy=btn_save]').click()
    cy.window().then((win) => {
      const q = win.__mainStore.QUESTMAN.get('mein_test_bogen')
      expect(q, 'Bogen gespeichert').to.exist
      expect(q.items).to.have.length(2)
      expect(q.items[0].label).to.equal('BBB')
      expect(q.items[1].label).to.equal('AAA')
    })
  })

  it('Feldtyp über Typ-Auswahl hinzufügen (radio) + Optionen umsortieren', () => {
    cy.visit('/#/questman/create', freshLoad())
    cy.get('[data-cy=questman_create]').should('exist')
    cy.get('.builder-editor [data-cy=quest_title]').type('Opt Test')

    // direkt als radio anlegen (Typ-Auswahl)
    cy.get('[data-cy=btn_items_add_menu]').click()
    cy.get('[data-cy=add_type_radio]').click()

    // radio bringt 2 Default-Optionen mit → Option 0 nach unten
    cy.get('[data-cy=opt_down_0]').click()

    cy.get('[data-cy=btn_save]').click()
    cy.window().then((win) => {
      const q = win.__mainStore.QUESTMAN.get('opt_test')
      expect(q, 'Bogen gespeichert').to.exist
      expect(q.items[0].type).to.equal('radio')
      expect(q.items[0].options.length).to.be.greaterThan(1)
    })
  })
})
