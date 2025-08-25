// Cypress custom commands
// Add your reusable custom commands here

// Login command for BEST Medical System
Cypress.Commands.add('login', (username = 'admin', password = 'admin') => {
  // Make sure we're on login page first
  cy.url().should('include', '/login')
  
  // Wait for page to load
  cy.wait(1000)
  
  // Select database (should be auto-selected, but click to make sure)
  cy.get('.q-select').click()
  cy.get('.q-item').first().click()
  
  // Enter credentials using the actual form structure
  cy.get('input[placeholder="Enter your username"]').clear().type(username)
  cy.get('input[placeholder="Enter your password"]').clear().type(password)
  
  // Submit the form
  cy.get('button[type="submit"]').click()
  
  // Wait for login to process
  cy.wait(3000)
  
  // Verify successful login
  cy.url().should('not.include', '/login')
  
  cy.log(`✅ Successfully logged in as ${username}`)
})

// Example: Navigate to a specific page
Cypress.Commands.add('navigateTo', (page) => {
  const routes = {
    dashboard: '/dashboard',
    patients: '/patient-search',
    visits: '/visits',
    concepts: '/concepts',
    settings: '/settings',
    export: '/export'
  }
  
  if (routes[page]) {
    cy.visit(routes[page])
  } else {
    throw new Error(`Unknown page: ${page}`)
  }
})

// Example: Wait for application to be ready
Cypress.Commands.add('waitForApp', () => {
  // Set up Electron APIs first
  cy.setupElectronAPIs()
  
  // Wait for basic DOM to be ready
  cy.get('body').should('be.visible')
  
  // Wait for Vue app to be ready
  cy.get('#q-app').should('be.visible').and('not.be.empty')
  
  // Give the app a moment to initialize
  cy.wait(1000)
  
  cy.log('✅ App is ready with Electron APIs')
})

// Example: Create a test patient
Cypress.Commands.add('createTestPatient', (patientData = {}) => {
  const defaultPatient = {
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    ...patientData
  }
  
  // Navigate to patient creation
  cy.get('[data-cy="create-patient-btn"]').click()
  
  // Fill out the form
  cy.get('[data-cy="patient-first-name"]').type(defaultPatient.firstName)
  cy.get('[data-cy="patient-last-name"]').type(defaultPatient.lastName)
  cy.get('[data-cy="patient-dob"]').type(defaultPatient.dateOfBirth)
  cy.get('[data-cy="patient-gender"]').select(defaultPatient.gender)
  
  // Submit the form
  cy.get('[data-cy="patient-save-btn"]').click()
  
  // Wait for success
  cy.get('.q-notification--positive').should('be.visible')
})

// Example: Database seeding helper
Cypress.Commands.add('seedDatabase', () => {
  cy.task('db:seed')
})

// Example: Clean database helper
Cypress.Commands.add('cleanDatabase', () => {
  cy.task('db:clean')
})

// Example: Wait for Electron app to be ready
Cypress.Commands.add('waitForElectron', () => {
  // In Electron mode, check for Node.js availability (indicates we're in Electron)
  cy.window().then((win) => {
    // Check if we have access to Node.js process (sign we're in Electron)
    if (win.process) {
      expect(win.process).to.exist
      expect(win.process.type).to.equal('renderer')
      cy.log('✅ Confirmed running in Electron renderer process')
    } else {
      cy.log('ℹ️ Process object not directly available, checking user agent...')
      expect(win.navigator.userAgent).to.contain('Electron')
    }
  })
  
  // Wait for main content to load
  cy.get('body').should('be.visible')
})

// Utility command for handling Quasar dialogs
Cypress.Commands.add('closeDialog', () => {
  // Close any open dialogs by clicking the backdrop or close button
  cy.get('.q-dialog__backdrop').click({ force: true })
})

// Add support for ignoring specific errors that are common in Electron
Cypress.Commands.add('ignoreElectronErrors', () => {
  cy.on('window:before:load', (win) => {
    // Handle any Electron-specific setup
    win.console.warn = cy.stub().as('consoleWarn')
  })
})
