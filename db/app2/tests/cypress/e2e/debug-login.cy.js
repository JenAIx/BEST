// Debug test to see exactly what happens during login

describe('Debug Login Process', () => {
  it('should debug the login step by step', () => {
    cy.visit('/')
    cy.setupElectronAPIs()
    cy.waitForElectron()
    cy.waitForApp()
    
    // Verify login page
    cy.url().should('include', '/login')
    cy.log('✅ On login page')
    
    // Check if database is already selected
    cy.get('[data-cy="login-database"]').then($select => {
      const selectedText = $select.text()
      cy.log(`Database dropdown text: ${selectedText}`)
    })
    
    // Select database anyway
    cy.get('[data-cy="login-database"]').click()
    cy.wait(500)
    cy.get('.q-item').first().click()
    cy.log('✅ Database selected')
    
    // Fill username
    cy.get('[data-cy="login-username"]').clear().type('admin')
    cy.log('✅ Username entered')
    
    // Fill password  
    cy.get('[data-cy="login-password"]').clear().type('admin')
    cy.log('✅ Password entered')
    
    // Check for any error messages before submitting
    cy.get('body').then($body => {
      if ($body.find('.text-negative').length > 0) {
        cy.get('.text-negative').each($error => {
          cy.log(`Pre-submit error: ${$error.text()}`)
        })
      }
    })
    
    // Submit form
    cy.get('[data-cy="login-submit"]').click()
    cy.log('✅ Form submitted')
    
    // Wait a bit and check URL
    cy.wait(2000)
    cy.url().then(url => {
      cy.log(`URL after 2s: ${url}`)
    })
    
    // Check for error messages
    cy.wait(3000)
    cy.get('body').then($body => {
      if ($body.find('.text-negative').length > 0) {
        cy.get('.text-negative').each($error => {
          cy.log(`Login error: ${$error.text()}`)
        })
      }
      
      // Check for any q-banner error messages
      if ($body.find('.q-banner').length > 0) {
        cy.get('.q-banner').each($banner => {
          cy.log(`Banner message: ${$banner.text()}`)
        })
      }
    })
    
    // Final URL check
    cy.wait(2000)
    cy.url().then(url => {
      cy.log(`Final URL after 5s total: ${url}`)
      if (url.includes('/login')) {
        cy.log('❌ Still on login page - login failed')
      } else {
        cy.log('✅ Login succeeded - redirected')
      }
    })
  })
})

