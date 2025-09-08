// Debug test to understand what's happening in true Electron mode

describe('Debug True Electron Mode', () => {
  it('should debug what page loads in true Electron mode', () => {
    // In TRUE Electron mode, no need to visit - the app launches automatically

    // Wait for basic page load
    cy.get('body', { timeout: 20000 }).should('exist')

    // Debug current URL
    cy.url().then((url) => {
      cy.log(`Current URL: ${url}`)
    })

    // Debug page title
    cy.title().then((title) => {
      cy.log(`Page title: ${title}`)
    })

    // Debug what's in the body
    cy.get('body').then(($body) => {
      const bodyHTML = $body.html()
      cy.log(`Body HTML length: ${bodyHTML.length}`)
      cy.log(`Body HTML preview: ${bodyHTML.substring(0, 500)}...`)

      // Check for common elements
      const hasQApp = $body.find('#q-app').length > 0
      const hasApp = $body.find('[data-cy="app"]').length > 0
      const hasLogin = $body.find('[data-cy="login-username"]').length > 0
      const hasMain = $body.find('main').length > 0
      const hasDiv = $body.find('div').length

      cy.log(`Elements found:`)
      cy.log(`  #q-app: ${hasQApp}`)
      cy.log(`  [data-cy="app"]: ${hasApp}`)
      cy.log(`  [data-cy="login-username"]: ${hasLogin}`)
      cy.log(`  main: ${hasMain}`)
      cy.log(`  div count: ${hasDiv}`)
    })

    // Check if we can access window.electron
    cy.window().then((win) => {
      const hasElectron = !!win.electron
      const hasProcess = !!win.process
      const hasRequire = typeof win.require === 'function'

      cy.log(`Electron APIs:`)
      cy.log(`  window.electron: ${hasElectron}`)
      cy.log(`  window.process: ${hasProcess}`)
      cy.log(`  window.require: ${hasRequire}`)

      if (hasElectron) {
        cy.log(`  window.electron.dbman: ${!!win.electron.dbman}`)
      }
    })

    // Wait a bit and see if anything changes
    cy.wait(3000)

    // Check again after waiting
    cy.get('body').then(($body) => {
      const hasQApp = $body.find('#q-app').length > 0
      cy.log(`After 3s wait - #q-app found: ${hasQApp}`)

      if (hasQApp) {
        cy.get('#q-app').then(($app) => {
          cy.log(`#q-app content: ${$app.html().substring(0, 300)}...`)
        })
      }
    })
  })
})
