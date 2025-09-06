# Cypress E2E Testing for Best Scientific DB Manager

This directory contains Cypress end-to-end tests for the Electron application, integrated with the existing test structure. The setup is designed to work in Docker containers using a headless environment similar to the existing VNC setup.

## Test Organization

The Cypress tests complement your existing test suite:

- **Unit tests** (`tests/unit/`) - Individual component and service testing with Vitest
- **Integration tests** (`tests/integration/`) - Database and API integration tests with Vitest
- **E2E tests** (`tests/cypress/e2e/`) - Full user workflow testing with Cypress

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Cypress Binary

```bash
npm run cypress:install
```

## Running Tests

### Headless Mode (Recommended for CI/Docker)

```bash
# Run all tests headlessly
npm run cypress:run:headless

# Run specific test file
./cypress-headless.sh 01-app-launch.cy.js
```

### VNC Interactive Mode (Visual Testing in Docker)

```bash
# Start Cypress with VNC access for visual interaction
npm run cypress:vnc

# Then connect with VNC client to: localhost:5901
```

### Local Interactive Mode (Direct GUI Access)

```bash
# Open Cypress Test Runner (requires local display)
npm run cypress:open

# Run tests in command line
npm run cypress:run
```

## Docker Environment Modes

### Headless Mode (`cypress-headless.sh`)

For automated testing:

- Virtual display on `:99`
- No visual interface
- Test execution with video recording
- Fast execution for CI/CD

### VNC Interactive Mode (`cypress-vnc.sh`)

For visual debugging and test development:

- Virtual display on `:98` (separate from main app VNC on `:99`)
- VNC access on `localhost:5901` (main app uses `localhost:5900`)
- Interactive Cypress Test Runner interface
- Click-to-run individual tests
- Real-time debugging and inspection

### Debugging Options

#### VNC Interactive Mode (Recommended)

1. **Run VNC mode**: `npm run cypress:vnc`
2. **Connect via VNC**: Use a VNC client to connect to `localhost:5901`
3. **Interactive testing**: Click on tests in the Cypress interface to run them
4. **Live debugging**: Set breakpoints, inspect elements, step through tests

#### Headless Mode Debugging

If tests fail in headless mode:

1. **Check videos**: Videos are saved in `tests/cypress/videos/`
2. **View screenshots**: Screenshots on failure are in `tests/cypress/screenshots/`
3. **Check logs**: Console output shows test execution details
4. **Switch to VNC mode**: Use `npm run cypress:vnc` for visual debugging

## Test Structure

### E2E Tests (`tests/cypress/e2e/`)

- `01-app-launch.cy.js` - Basic app startup and navigation tests
- `02-patient-management.cy.js` - Patient CRUD operations
- `03-data-workflow.cy.js` - Complex workflows and data management

### Support Files (`tests/cypress/support/`)

- `e2e.js` - Global test configuration and hooks
- `commands.js` - Custom Cypress commands
- `component.js` - Component testing support (if needed)

### Fixtures (`tests/cypress/fixtures/`)

- `test-data.json` - Test data for users, patients, etc.

## Custom Commands

The setup includes several custom commands:

```javascript
// Login with default or custom credentials
cy.login('username', 'password')

// Navigate to specific pages
cy.navigateTo('patients')

// Wait for app to be ready
cy.waitForApp()
cy.waitForElectron()

// Create test data
cy.createTestPatient({ firstName: 'John', lastName: 'Doe' })

// Database operations
cy.seedDatabase()
cy.cleanDatabase()
```

## Configuration

### Test Data Selectors

The tests expect elements to have `data-cy` attributes for reliable selection:

```html
<!-- Good -->
<button data-cy="create-patient-btn">Create Patient</button>

<!-- Avoid -->
<button class="btn-primary">Create Patient</button>
```

### Environment Variables

Set in `cypress.config.js` or via environment:

- `TEST_DB_PATH` - Path to test database
- `ELECTRON_DISABLE_SECURITY_WARNINGS` - Disable Electron security warnings

## Best Practices

1. **Use data-cy attributes** for test selectors
2. **Clean up test data** after each test
3. **Use fixtures** for consistent test data
4. **Handle async operations** with proper waits
5. **Test error scenarios** not just happy paths

## Troubleshooting

### Common Issues

1. **App doesn't start**: Check Electron build is present
2. **VNC connection fails**: Ensure port 5901 is available
3. **Tests timeout**: Increase timeouts in config for slow operations
4. **Database conflicts**: Ensure test database is isolated

### Performance Tips

- Use `testIsolation: false` for faster test execution
- Group related tests in same file
- Use beforeEach hooks for common setup
- Mock external APIs when possible

## Integration with Existing Tests

This Cypress setup complements your existing Vitest tests:

- **Vitest**: Unit and integration tests for business logic
- **Cypress**: End-to-end UI and workflow tests

Both can run in parallel in your CI/CD pipeline.
