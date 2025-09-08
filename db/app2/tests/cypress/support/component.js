// Cypress Component Testing support file

import { mount } from 'cypress/vue'

// Import global styles that your components might need
import 'quasar/src/css/index.sass'
import '@quasar/extras/material-icons/material-icons.css'

// Import Quasar plugins and setup
import { Quasar, Notify, Dialog } from 'quasar'

// Command to mount Vue components with Quasar setup
Cypress.Commands.add('mount', (component, options = {}) => {
  const { plugins = [], ...mountingOptions } = options

  // Setup Quasar for component testing
  const quasarConfig = {
    plugins: [Notify, Dialog],
    config: {
      notify: {},
      dialog: {},
    },
  }

  return mount(component, {
    global: {
      plugins: [[Quasar, quasarConfig], ...plugins],
    },
    ...mountingOptions,
  })
})

// Custom commands for component testing
Cypress.Commands.add('getByCy', (selector, ...args) => {
  return cy.get(`[data-cy=${selector}]`, ...args)
})

Cypress.Commands.add('getByTestId', (selector, ...args) => {
  return cy.get(`[data-testid=${selector}]`, ...args)
})

// Global configuration for component tests
beforeEach(() => {
  // Setup any global state or mocks needed for component testing
})

// Handle uncaught exceptions in component tests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing tests on certain expected exceptions
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  return true
})
