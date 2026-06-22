/// <reference types="cypress" />
//
// Regressionsschutz für den iOS-Migrationsbug (106 → 75): Beim Migrieren aus
// dem alten monolithischen localStorage-Key (surveyBEST_QUESTS) dürfen
// gebündelte Fragebögen, die im Alt-Blob fehlen, NICHT als gelöscht markiert
// werden. Wir seeden einen Alt-Blob (wie auf einer alten iPad-App-Version)
// und prüfen, dass danach weiterhin ALLE gebündelten Bögen sichtbar sind.

const EXPECTED_COUNT = 106 // 107 JSON-Dateien, 1 doppelter short_title (nms_quest)

// Lädt die App mit frischer IndexedDB (Bug tritt nur bei frischer Migration auf)
// und optionalem Alt-Blob im localStorage. DB-Löschung + Seed laufen in
// onBeforeLoad VOR dem App-Boot, sonst greift das bereits gesetzte migration-Flag.
function freshLoad(seedLegacy) {
  return {
    onBeforeLoad(win) {
      win.localStorage.clear()
      if (seedLegacy) {
        win.localStorage.setItem('surveyBEST_QUESTS', JSON.stringify(seedLegacy))
      }
      return new Promise((resolve) => {
        const req = win.indexedDB.deleteDatabase('surveyBEST_DB')
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      })
    },
  }
}

describe('Anzahl Fragebögen', () => {
  it('frische Installation zeigt alle gebündelten Bögen', () => {
    cy.visit('/#/questman', freshLoad())
    cy.get('[data-cy="questlistRoot"]', { timeout: 12000 }).should('exist')
    cy.get('[data-cy="questlistRoot"] > div').should('have.length', EXPECTED_COUNT)
  })

  it('Migration aus Alt-Blob versteckt KEINE Bögen (iOS-Bug-Repro)', () => {
    // Alt-Blob einer älteren App-Version: nur ein einziger (eigener) Bogen.
    // Früher wurden dadurch alle ~105 "fehlenden" Bundle-Bögen versteckt (→ 75).
    cy.visit('/#/questman', freshLoad({
      myOldQuest: { title: 'Alt', short_title: 'myOldQuest', items: [] },
    }))
    cy.get('[data-cy="questlistRoot"]', { timeout: 12000 }).should('exist')
    // 106 Bundle-Bögen + 1 migrierter Eigen-Bogen = 107
    cy.get('[data-cy="questlistRoot"] > div').should('have.length', EXPECTED_COUNT + 1)

    cy.window().then((win) => {
      expect(win.__mainStore).to.exist
      expect(win.__mainStore.QUEST_LIST.length).to.equal(EXPECTED_COUNT + 1)
    })
  })

  it('nach Reload bleibt die Anzahl stabil', () => {
    cy.visit('/#/questman', freshLoad())
    cy.get('[data-cy="questlistRoot"]', { timeout: 12000 }).should('exist')
    cy.get('[data-cy="questlistRoot"] > div').should('have.length', EXPECTED_COUNT)
    cy.reload()
    cy.get('[data-cy="questlistRoot"]', { timeout: 12000 }).should('exist')
    cy.get('[data-cy="questlistRoot"] > div').should('have.length', EXPECTED_COUNT)
  })
})
