/**
 * Test Setup File
 * 
 * This file runs before all tests and ensures:
 * - Test output directory exists
 * - Global test configuration is set
 * - Environment variables are properly configured
 */

import { mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'

// Ensure test output directory exists
const testOutputDir = resolve(__dirname, 'output')
if (!existsSync(testOutputDir)) {
  mkdirSync(testOutputDir, { recursive: true })
}

// Set global test configuration
global.__TEST_OUTPUT_DIR__ = testOutputDir
global.__TEST_DB_PATH__ = resolve(testOutputDir, 'test-db-shared.db')
global.__SEED_TEST_DB_PATH__ = resolve(testOutputDir, 'seed-test-db-shared.db')

// Ensure database output directory exists
const dbOutputDir = dirname(global.__TEST_DB_PATH__)
if (!existsSync(dbOutputDir)) {
  mkdirSync(dbOutputDir, { recursive: true })
}

console.log(`🧪 Test setup complete. Output directory: ${testOutputDir}`)
console.log(`📁 Test DB path: ${global.__TEST_DB_PATH__}`)
console.log(`🌱 Seed test DB path: ${global.__SEED_TEST_DB_PATH__}`)
