const { defineConfig } = require('cypress')

// Cypress E2E-Konfiguration. Nutzt die bestehende test/cypress-Struktur
// (integration/ + support/). baseUrl = lokaler Quasar-Dev-Server (HTTP).
module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8088',
    supportFile: 'test/cypress/support/index.js',
    specPattern: 'test/cypress/integration/**/*.spec.js',
    fixturesFolder: 'test/cypress/fixtures',
    screenshotsFolder: 'test/cypress/screenshots',
    videosFolder: 'test/cypress/videos',
    video: false,
    defaultCommandTimeout: 8000,
    setupNodeEvents(on, config) {
      return config
    },
  },
})
