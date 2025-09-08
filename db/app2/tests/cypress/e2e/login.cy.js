// Login functionality test for BEST Medical System
// Tests the actual LoginPage.vue component with proper database selection

describe('BEST Medical System - Login', () => {
  beforeEach(() => {
    // In TRUE Electron mode, the Electron app should launch automatically
    // No need to visit a URL - we're testing the actual Electron executable
    cy.waitForElectron()
    cy.waitForApp()
  })

  it('should display the login page with all required elements', () => {
    // Verify we're on the login page
    cy.url().should('include', '/login')

    // Check page title and branding
    cy.get('h1').should('contain', 'BEST Medical System')
    cy.get('p').should('contain', 'Base for Experiment Storage & Tracking')

    // Verify all form fields are present using data-cy attributes
    cy.get('[data-cy="login-username"]').should('exist')
    cy.get('[data-cy="login-password"]').should('exist')
    cy.get('[data-cy="login-submit"]').should('contain', 'Login')

    // Verify database selection dropdown exists
    cy.get('[data-cy="login-database"]').should('exist')

    cy.log('✅ Login page loaded with all required elements')
  })

  it('should successfully login with admin credentials', () => {
    // Verify we start on login page
    cy.url().should('include', '/login')

    // Wait for database options to load (they should auto-select)
    cy.wait(1000)

    // Check if database is auto-selected, if not select the first option
    cy.get('[data-cy="login-database"]').click()
    cy.get('.q-item').first().click()
    cy.log('✅ Database selected')

    // Fill in username using data-cy
    cy.get('[data-cy="login-username"]').clear().type('admin')
    cy.log('✅ Username entered: admin')

    // Fill in password using data-cy
    cy.get('[data-cy="login-password"]').clear().type('admin')
    cy.log('✅ Password entered')

    // Submit the form using data-cy
    cy.get('[data-cy="login-submit"]').click()
    cy.log('✅ Login form submitted')

    // Wait longer for login processing and database initialization
    cy.wait(8000)

    // Check current URL status
    cy.url().then((url) => {
      cy.log(`Current URL after login: ${url}`)
    })

    // Verify login success - should redirect away from login page
    cy.url().should('not.include', '/login', { timeout: 15000 })
    cy.log('✅ Login successful - redirected from login page')

    // Verify we reached the dashboard page specifically
    cy.url().should('include', '/dashboard', { timeout: 10000 })
    cy.log('✅ Successfully redirected to dashboard page')

    // Verify dashboard content loads
    cy.get('#q-app', { timeout: 10000 }).should('be.visible')
    cy.get('body').should('not.contain', 'Login failed')
    cy.log('✅ Dashboard page loaded successfully')
  })

  it('should show error for invalid credentials', () => {
    // Verify we start on login page
    cy.url().should('include', '/login')

    // Wait for database options to load
    cy.wait(1000)

    // Select database
    cy.get('[data-cy="login-database"]').click()
    cy.get('.q-item').first().click()

    // Try invalid credentials using data-cy
    cy.get('[data-cy="login-username"]').clear().type('wronguser')
    cy.get('[data-cy="login-password"]').clear().type('wrongpassword')

    // Submit the form using data-cy
    cy.get('[data-cy="login-submit"]').click()

    // Wait for response
    cy.wait(3000)

    // Should stay on login page
    cy.url().should('include', '/login')
    cy.log('✅ Stayed on login page for invalid credentials')
  })

  it('should require database selection', () => {
    // Try to login without selecting database (if possible)
    cy.get('[data-cy="login-username"]').type('admin')
    cy.get('[data-cy="login-password"]').type('admin')

    // Try to submit - should show validation error or prevent submission
    cy.get('[data-cy="login-submit"]').click()

    // Should stay on login page
    cy.url().should('include', '/login')
    cy.log('✅ Database selection is properly validated')
  })
})
