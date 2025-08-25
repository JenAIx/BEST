import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // For Electron testing, use a local HTTP server
    baseUrl: 'http://localhost:8080',
    
    // Specs pattern
    specPattern: 'tests/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Support file
    supportFile: 'tests/cypress/support/e2e.js',
    
    // Test isolation - disabled for Electron app testing
    testIsolation: false,
    
    // Viewport settings for consistent testing
    viewportWidth: 1600,
    viewportHeight: 900,
    
    // Video recording (useful for debugging in headless mode)
    video: true,
    videoCompression: 32,
    videosFolder: 'tests/cypress/videos',
    
    // Screenshots on failure
    screenshotsFolder: 'tests/cypress/screenshots',
    screenshotOnRunFailure: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Environment variables
    env: {
      // Test database settings
      TEST_DB_PATH: './tests/cypress/fixtures/test-db.db',
      // App specific settings
      ELECTRON_DISABLE_SECURITY_WARNINGS: true
    },
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
      
      // Task for database setup/cleanup if needed
      on('task', {
        // Database tasks
        'db:seed': () => {
          // Implement database seeding for tests
          return null
        },
        
        'db:clean': () => {
          // Implement database cleanup
          return null
        },
        
        // Log task for debugging
        'log': (message) => {
          console.log(message)
          return null
        }
      })
      
      // Browser launch options for Electron
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron') {
          // Configure Cypress to launch our Quasar Electron app
          launchOptions.args.push('--disable-dev-shm-usage')
          launchOptions.args.push('--no-sandbox')
          launchOptions.args.push('--disable-gpu')
          launchOptions.args.push('--disable-software-rasterizer')
          launchOptions.args.push('--disable-web-security')
          
          // Point to our built Electron app
          launchOptions.env = {
            ...launchOptions.env,
            ELECTRON_APP_PATH: './dist/electron/Packaged/Best - Scientific DB Manager-linux-arm64/Best - Scientific DB Manager'
          }
          
          // Enable Node.js integration for database/filesystem access
          launchOptions.preferences = {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            // Allow access to Node.js APIs in renderer
            enableRemoteModule: true
          }
        }
        
        return launchOptions
      })
      
      return config
    }
  },
  
  // Component testing configuration (optional)
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    specPattern: 'tests/cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'tests/cypress/support/component.js'
  },
  
  // Global configuration
  chromeWebSecurity: false,
  
  // File watching
  watchForFileChanges: true,
  
  // Experimental features
  experimentalStudio: true,
  experimentalWebKitSupport: true
})
