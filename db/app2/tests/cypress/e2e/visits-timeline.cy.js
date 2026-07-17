/**
 * Cypress E2E: unified visits timeline ("Zeitlinie" on /visits/:patientId).
 *
 * NOTE ON RUNNABILITY: the project's Cypress setup runs in "TRUE Electron
 * mode" (cypress.config.js launches the PACKAGED app so the SQLite bridge
 * exists — a plain browser has no electron-preload and cannot reach the DB).
 * The packaged Linux build (dist/electron/Packaged/...-linux-arm64/) is
 * currently NOT built, so this spec cannot run yet; it is written against
 * the stable data-cy anchors so it works unchanged once the package exists:
 *
 *   npm run build   (electron-builder linux-arm64)
 *   bash cypress-headless.sh visits-timeline.cy.js
 *
 * Until then, the SAME core functions are covered automatically by the CDP
 * routine `bash scripts/verify-visits/run.sh` (shared data-cy selectors,
 * plus DB backup / delete guards / integrity check).
 *
 * Expects the seeded credentials and the Stroke-Lipid demo patient.
 */

const USER = Cypress.env('VERIFY_USER') || 'admin'
const PASS = Cypress.env('VERIFY_PASS') || 'admin'
const PATIENT_CD = Cypress.env('VERIFY_PATIENT') || '10002506'
const LABEL = Cypress.env('VERIFY_LABEL') || 'Stroke-Lipid'
const FILTER = Cypress.env('VERIFY_FILTER') || 'LDL'

const login = () => {
  cy.get('[data-cy="login-username"]').type(USER)
  cy.get('input[type="password"]').first().type(PASS)
  cy.get('[data-cy="login-submit"]').click()
  cy.get('.q-drawer, .q-page', { timeout: 15000 }).should('exist')
}

describe('Zeitlinie (unified visits view)', () => {
  before(() => {
    cy.visit('/#/login')
    login()
    cy.visit(`/#/visits/${PATIENT_CD}`)
    cy.get('[data-cy="view-mode-unified"]').click()
  })

  it('shows collapsed visit cards with correct study labels', () => {
    cy.get('[data-cy="unified-card"]').should('have.length.at.least', 1)
    cy.get('[data-cy="unified-card"] .q-chip').should('contain.text', LABEL)
    cy.get('[data-cy="unified-card"] .q-chip').should('not.contain.text', 'General Visit')
    // collapsed by default → no bodies, no quick nav
    cy.get('[data-cy="unified-card"] .visit-block-body').should('not.exist')
    cy.get('[data-cy="unified-quick-nav"]').should('not.exist')
  })

  it('expands a card via header click and shows the quick nav', () => {
    cy.get('[data-cy="unified-card-header"]').first().click()
    cy.get('[data-cy="unified-card"] .visit-block-body').should('exist')
    cy.get('[data-cy="unified-quick-nav"]').should('exist')
    cy.get('[data-cy="unified-card-header"]').first().click()
  })

  it('filters observations and force-expands matching visits', () => {
    cy.get('[data-cy="unified-search"]').type(FILTER)
    cy.get('[data-cy="unified-card"]').should('have.length.at.least', 1)
    cy.get('[data-cy="unified-card"] .visit-block-body').should('contain.text', FILTER)
    cy.get('[data-cy="unified-search"]').clear()
  })

  it('expand-all / collapse-all toggle works', () => {
    cy.get('[data-cy="unified-expand-toggle"]').click()
    cy.get('[data-cy="unified-card"]').then(($cards) => {
      cy.get('[data-cy="unified-card"] .visit-block-body, [data-cy="unified-card"] .visit-block-empty').should('have.length', $cards.length)
    })
    cy.get('[data-cy="unified-expand-toggle"]').click()
    cy.get('[data-cy="unified-card"] .visit-block-body').should('not.exist')
  })

  it('clones a visit, edits it inline with autosave, and deletes the clone', () => {
    // clone — identify the new card by data-visit-id set difference
    cy.get('[data-cy="unified-card"]').then(($before) => {
      const idsBefore = [...$before].map((el) => el.dataset.visitId)

      cy.get('[data-cy="unified-card-menu"]').first().click()
      cy.get('[data-cy="unified-menu-clone"]').click()
      cy.get('.q-dialog .q-btn').contains('OK').click()

      cy.get('[data-cy="unified-card"]').should('have.length', idsBefore.length + 1)
      cy.get('[data-cy="unified-card"]').then(($after) => {
        const cloneId = [...$after].map((el) => el.dataset.visitId).find((id) => !idsBefore.includes(id))
        expect(cloneId, 'clone id').to.exist
        const clone = () => cy.get(`[data-cy="unified-card"][data-visit-id="${cloneId}"]`)

        // inline edit mode (focus mode: only the editing card remains)
        clone().find('[data-cy="unified-card-edit"]').click()
        cy.get('[data-cy="unified-card-editing-chip"]').should('exist')
        cy.get('[data-cy="editor-add-observation"]').should('exist')
        cy.get('[data-cy="unified-new-visit"]').should('not.exist')
        cy.get('[data-cy="unified-card"]').should('have.length', 1)

        // autosave: numeric value → Enter → visible after Fertig
        clone()
          .find('input[type="number"]')
          .first()
          .clear()
          .type('123{enter}')
        cy.get('[data-cy="unified-card-finish"]').click()
        clone().should('contain.text', '123')

        // delete the clone (guarded by id)
        clone().find('[data-cy="unified-card-menu"]').click()
        cy.get('[data-cy="unified-menu-delete"]').click()
        cy.get('.q-dialog .q-btn').contains('Löschen').click()
        cy.get(`[data-cy="unified-card"][data-visit-id="${cloneId}"]`).should('not.exist')
        cy.get('[data-cy="unified-card"]').should('have.length', idsBefore.length)
      })
    })
  })

  it('a new visit opens directly in edit mode and can be removed again', () => {
    cy.get('[data-cy="unified-card"]').then(($before) => {
      const idsBefore = [...$before].map((el) => el.dataset.visitId)

      cy.get('[data-cy="unified-new-visit"]').click()
      cy.get('.q-dialog .q-btn').contains('erstellen').click()

      cy.get('[data-cy="unified-card-editing-chip"]').should('exist')
      cy.get('[data-cy="unified-card-finish"]').click()

      cy.get('[data-cy="unified-card"]').then(($after) => {
        const newId = [...$after].map((el) => el.dataset.visitId).find((id) => !idsBefore.includes(id))
        expect(newId, 'new visit id').to.exist
        cy.get(`[data-cy="unified-card"][data-visit-id="${newId}"]`).find('[data-cy="unified-card-menu"]').click()
        cy.get('[data-cy="unified-menu-delete"]').click()
        cy.get('.q-dialog .q-btn').contains('Löschen').click()
        cy.get('[data-cy="unified-card"]').should('have.length', idsBefore.length)
      })
    })
  })
})
