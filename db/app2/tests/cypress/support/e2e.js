// Cypress E2E support file
// This is loaded before every test file

// Import commands.js using ES2015 syntax:
import './commands'
import './electron-apis'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global configuration and behavior

// Hide XHR requests from command log (optional)
// Cypress.on('window:before:load', (win) => {
//   win.fetch = null
// })

// Custom exception handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing tests on uncaught exceptions
  // that might be expected in an Electron environment

  // Log the error but don't fail the test for these known issues
  if (err.message.includes('ResizeObserver loop limit exceeded') || err.message.includes('Non-Error promise rejection captured')) {
    console.warn('Caught expected error:', err.message)
    return false
  }

  // Return false to prevent failing the test
  // Only for errors you expect and want to ignore
  return true
})

// Global before hook for setup
beforeEach(() => {
  // Reset application state or setup test data if needed
  // This runs before each test
  // Example: Clear local storage
  // cy.clearLocalStorage()
  // Example: Setup test database
  // cy.task('db:seed')
})

// Global after hook for cleanup
afterEach(() => {
  // Cleanup after each test if needed
  // Example: Reset database state
  // cy.task('db:clean')
  // Take screenshot on failure (handled automatically by Cypress)
})
