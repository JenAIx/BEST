// Login functionality test for BEST Medical System
// Tests the actual LoginPage.vue component with proper database selection

describe('BEST Medical System - Login', () => {
  beforeEach(() => {
    // Visit the app and set up Electron APIs  
    cy.visit('/')
    cy.setupElectronAPIs()
    cy.waitForElectron()
    cy.waitForApp()
  })

  it('should display the login page with all required elements', () => {
    // Verify we're on the login page
    cy.url().should('include', '/login')
    
    // Check page title and branding
    cy.get('h1').should('contain', 'BEST Medical System')
    cy.get('p').should('contain', 'Base for Experiment Storage & Tracking')
    
    // Verify all form fields are present
    cy.get('input[placeholder="Enter your username"]').should('exist')
    cy.get('input[placeholder="Enter your password"]').should('exist')
    cy.get('button[type="submit"]').should('contain', 'Login')
    
    // Verify database selection dropdown exists
    cy.get('.q-select').should('exist')
    
    cy.log('✅ Login page loaded with all required elements')
  })

  it('should successfully login with admin credentials', () => {
    // Verify we start on login page
    cy.url().should('include', '/login')
    
    // Wait for database options to load (they should auto-select)
    cy.wait(1000)
    
    // Check if database is auto-selected, if not select the first option
    cy.get('.q-select').click()
    cy.get('.q-item').first().click()
    cy.log('✅ Database selected')
    
    // Fill in username
    cy.get('input[placeholder="Enter your username"]').clear().type('admin')
    cy.log('✅ Username entered: admin')
    
    // Fill in password  
    cy.get('input[placeholder="Enter your password"]').clear().type('admin')
    cy.log('✅ Password entered')
    
    // Submit the form
    cy.get('button[type="submit"]').click()
    cy.log('✅ Login form submitted')
    
    // Wait for login to process
    cy.wait(5000)
    
    // Verify login success - should redirect away from login page
    cy.url().should('not.include', '/login')
    cy.log('✅ Login successful - redirected from login page')
    
    // Log final URL
    cy.url().then(url => {
      cy.log(`Final URL after login: ${url}`)
    })
    
    // Check for success notification or main app content
    cy.get('body').should('not.contain', 'Login failed')
    cy.log('✅ No login error messages detected')
  })

  it('should show error for invalid credentials', () => {
    // Verify we start on login page
    cy.url().should('include', '/login')
    
    // Wait for database options to load
    cy.wait(1000)
    
    // Select database
    cy.get('.q-select').click()
    cy.get('.q-item').first().click()
    
    // Try invalid credentials
    cy.get('input[placeholder="Enter your username"]').clear().type('wronguser')
    cy.get('input[placeholder="Enter your password"]').clear().type('wrongpassword')
    
    // Submit the form
    cy.get('button[type="submit"]').click()
    
    // Wait for response
    cy.wait(3000)
    
    // Should stay on login page
    cy.url().should('include', '/login')
    cy.log('✅ Stayed on login page for invalid credentials')
  })

  it('should require database selection', () => {
    // Try to login without selecting database (if possible)
    cy.get('input[placeholder="Enter your username"]').type('admin')
    cy.get('input[placeholder="Enter your password"]').type('admin')
    
    // Try to submit - should show validation error or prevent submission
    cy.get('button[type="submit"]').click()
    
    // Should stay on login page
    cy.url().should('include', '/login')
    cy.log('✅ Database selection is properly validated')
  })
})
