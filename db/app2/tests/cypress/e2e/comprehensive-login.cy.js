// Comprehensive login test with all available users

describe('Comprehensive Login Tests', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.setupElectronAPIs()
    cy.waitForElectron()
    cy.waitForApp()
  })

  // Test all available user accounts
  const users = [
    { username: 'admin', password: 'admin', description: 'Administrator' },
    { username: 'ste', password: 'ste', description: 'Stefan User (Admin)' }, 
    { username: 'public', password: 'public', description: 'Public User' },
    { username: 'db', password: 'db', description: 'Database User' }
  ]

  users.forEach(user => {
    it(`should login successfully with ${user.description} (${user.username})`, () => {
      // Verify starting on login page
      cy.url().should('include', '/login')
      
      // Select database
      cy.get('[data-cy="login-database"]').click()
      cy.get('.q-item').first().click()
      cy.log(`✅ Database selected for ${user.username}`)
      
      // Enter credentials
      cy.get('[data-cy="login-username"]').clear().type(user.username)
      cy.get('[data-cy="login-password"]').clear().type(user.password)
      cy.log(`✅ Credentials entered for ${user.username}`)
      
      // Submit form
      cy.get('[data-cy="login-submit"]').click()
      cy.log(`✅ Login submitted for ${user.username}`)
      
      // Wait for login processing
      cy.wait(8000)
      
      // Verify successful login
      cy.url().should('not.include', '/login', { timeout: 15000 })
      cy.log(`✅ ${user.username} login successful - left login page`)
      
      // Should reach dashboard
      cy.url().should('include', '/dashboard', { timeout: 10000 })
      cy.log(`✅ ${user.username} reached dashboard`)
      
      // Verify app content loads
      cy.get('#q-app').should('be.visible')
      cy.log(`✅ ${user.username} - dashboard content loaded`)
    })
  })

  it('should show the correct default database selection', () => {
    // Check that database dropdown shows available options
    cy.get('[data-cy="login-database"]').click()
    
    // Should see production database as first option
    cy.get('.q-item').should('have.length.greaterThan', 0)
    cy.get('.q-item').first().should('contain', 'Production')
    
    cy.log('✅ Database options available')
  })
})


