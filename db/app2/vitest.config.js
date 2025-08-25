import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30 seconds for integration tests
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.js',
        '**/*.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'src': resolve(__dirname, './src')
    }
  },
  define: {
    __TEST_OUTPUT_DIR__: JSON.stringify('./tests/output'),
    __TEST_DB_PATH__: JSON.stringify('./tests/output/test-db-shared.db'),
    __SEED_TEST_DB_PATH__: JSON.stringify('./tests/output/seed-test-db-shared.db')
  }
})
