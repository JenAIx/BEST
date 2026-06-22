/// <reference types="cypress" />
//
// example_value (Demo-Vorschauwerte) darf im ECHTEN Ausfüll-Flow die
// multiple_radio-Matrix NICHT vorbefüllen — sonst sähe sie beantwortet aus,
// obwohl item.value leer ist. hlq hat eine multiple_radio-Matrix mit example_value.

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

describe('multiple_radio: example_value nur in Vorschau', () => {
  it('hlq echter Flow: Matrix mit example_value startet UNgewählt', () => {
    cy.viewport('iphone-6')
    cy.visit(`/#/quest/${encodeURIComponent(JSON.stringify({ presets: 'hlq', mode: 'single' }))}`, freshLoad())
    cy.get('[data-cy=page_quest]').should('exist')
    // bestätigen, dass die Matrix example_value besitzt
    cy.window().then((win) => {
      const mr = win.__mainStore.QUESTMAN.activeQuest.value.items.find(
        (it) => it.type === 'multiple_radio' && it.example_value
      )
      expect(mr, 'multiple_radio mit example_value vorhanden').to.exist
    })
    // PID → erste Matrix
    cy.get('[data-cy=PID]').should('exist').type('X')
    cy.get('[data-cy=quest_next]').click()
    cy.get('.mr-table').should('exist')
    // KEIN Radio darf vorausgewählt sein (real flow, kein preview)
    cy.get('.mr-table .q-radio__inner--truthy').should('not.exist')
    // und item.value ist noch leer
    cy.window().then((win) => {
      const mr = win.__mainStore.QUESTMAN.activeQuest.value.items.find(
        (it) => it.type === 'multiple_radio' && it.example_value
      )
      expect(mr.value == null || (Array.isArray(mr.value) && mr.value.every((x) => x == null))).to.be.true
    })
  })
})
