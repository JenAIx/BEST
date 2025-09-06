#!/usr/bin/env node

/**
 * Seed Data Test Script
 *
 * This script tests the complete seed data functionality including:
 * - Database creation with schema
 * - Concept seeding from CSV
 * - CQL rule seeding from CSV
 * - Concept-CQL lookup seeding from CSV
 * - Standard user seeding from CSV
 * - Data validation and integrity checks
 */

import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import ConceptRepository from '../../src/core/database/repositories/concept-repository.js'
import CqlRepository from '../../src/core/database/repositories/cql-repository.js'
import UserRepository from '../../src/core/database/repositories/user-repository.js'
import fs from 'fs'
import path from 'path'

async function testSeedData() {
  console.log('🌱 Testing Seed Data Functionality...\n')

  const testDbPath = '../output/seed-test-db.db'
  let connection, migrationManager, seedManager, conceptRepo, cqlRepo, userRepo

  try {
    // Ensure output directory exists
    const outputDir = path.dirname(testDbPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Clean up existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
      console.log('🗑️  Cleaned up existing test database')
    }

    // Initialize components
    connection = new RealSQLiteConnection()
    migrationManager = new MigrationManager(connection)
    seedManager = new SeedManager(connection)
    conceptRepo = new ConceptRepository(connection)
    cqlRepo = new CqlRepository(connection)
    userRepo = new UserRepository(connection)

    console.log('✅ Components initialized')

    // Connect to database
    await connection.connect(testDbPath)
    console.log('🔌 Connected to test database')

    // Register the current schema migration
    console.log('\n📊 Registering schema migration...')
    const { currentSchema } = await import('../../src/core/database/migrations/002-current-schema.js')
    migrationManager.registerMigration(currentSchema)
    console.log('✅ Schema migration registered')

    // Initialize database with schema and seeds
    console.log('\n📊 Initializing database with schema and seed data...')
    await migrationManager.initializeDatabaseWithSeeds(seedManager)
    console.log('✅ Database initialized with seed data')

    // Get seed data statistics
    console.log('\n📈 Getting seed data statistics...')
    const seedStats = await seedManager.getSeedDataStatistics()
    console.log('Seed Data Statistics:')
    console.log(`  - Concepts: ${seedStats.concepts}`)
    console.log(`  - CQL Rules: ${seedStats.cqlRules}`)
    console.log(`  - Concept-CQL Lookups: ${seedStats.conceptCqlLookups}`)
    console.log(`  - Users: ${seedStats.users}`)

    if (seedStats.errors.length > 0) {
      console.log('⚠️  Seeding errors:')
      seedStats.errors.forEach((error) => console.log(`    - ${error}`))
    }

    // Test concept functionality
    console.log('\n🔍 Testing concept functionality...')
    const concepts = await conceptRepo.findAll()
    console.log(`  - Total concepts: ${concepts.length}`)

    if (concepts.length > 0) {
      const sampleConcept = concepts[0]
      console.log(`  - Sample concept: ${sampleConcept.NAME_CHAR} (${sampleConcept.CONCEPT_CD})`)

      // Test concept search
      const customConcepts = await conceptRepo.findByConceptPath('CUSTOM')
      console.log(`  - CUSTOM path concepts: ${customConcepts.length}`)

      const conceptStats = await conceptRepo.getConceptStatistics()
      console.log(`  - Concept statistics: ${conceptStats.totalConcepts} total`)
    }

    // Test CQL functionality
    console.log('\n📋 Testing CQL functionality...')
    const cqlRules = await cqlRepo.findAll()
    console.log(`  - Total CQL rules: ${cqlRules.length}`)

    if (cqlRules.length > 0) {
      const sampleRule = cqlRules[0]
      console.log(`  - Sample rule: ${sampleRule.NAME_CHAR} (${sampleRule.CODE_CD})`)

      // Test CQL search
      const numericRules = await cqlRepo.findByCode('numeric')
      if (numericRules.length > 0) {
        console.log(`  - Numeric rule found: ${numericRules[0].NAME_CHAR}`)
      }

      const cqlStats = await cqlRepo.getCqlRuleStatistics()
      console.log(`  - CQL statistics: ${cqlStats.totalRules} total`)
    }

    // Test user functionality
    console.log('\n👥 Testing user functionality...')
    const users = await userRepo.findAll()
    console.log(`  - Total users: ${users.length}`)

    if (users.length > 0) {
      console.log('  - Users:')
      users.forEach((user) => {
        console.log(`    * ${user.USER_CD} (${user.COLUMN_CD}) - ${user.NAME_CHAR}`)
      })

      // Test user authentication
      console.log('\n🔐 Testing user authentication...')
      const testUsers = [
        { userCode: 'public', password: 'public' },
        { userCode: 'admin', password: 'admin' },
        { userCode: 'db', password: '123' },
        { userCode: 'ste', password: '123' },
      ]

      for (const testUser of testUsers) {
        const authResult = await userRepo.authenticateUser(testUser.userCode, testUser.password)
        if (authResult) {
          console.log(`  ✅ ${testUser.userCode} authentication successful`)
        } else {
          console.log(`  ❌ ${testUser.userCode} authentication failed`)
        }
      }

      // Test failed authentication
      const failedAuth = await userRepo.authenticateUser('public', 'wrongpassword')
      if (!failedAuth) {
        console.log('  ✅ Failed authentication correctly rejected')
      }

      const userStats = await userRepo.getUserStatistics()
      console.log(`  - User statistics: ${userStats.totalUsers} total`)
    }

    // Test data integrity
    console.log('\n🔗 Testing data integrity...')

    // Check concept-CQL relationships
    const conceptCqlCount = await connection.executeQuery(`
      SELECT COUNT(*) as count 
      FROM CONCEPT_CQL_LOOKUP ccl
      JOIN CONCEPT_DIMENSION cd ON ccl.CONCEPT_CD = cd.CONCEPT_CD
      JOIN CQL_FACT cf ON ccl.CQL_ID = cf.CQL_ID
    `)

    if (conceptCqlCount.success) {
      console.log(`  - Valid concept-CQL relationships: ${conceptCqlCount.data[0].count}`)
    }

    // Check foreign key constraints
    const orphanedLookups = await connection.executeQuery(`
      SELECT COUNT(*) as count 
      FROM CONCEPT_CQL_LOOKUP ccl
      LEFT JOIN CONCEPT_DIMENSION cd ON ccl.CONCEPT_CD = cd.CONCEPT_CD
      LEFT JOIN CQL_FACT cf ON ccl.CQL_ID = cf.CQL_ID
      WHERE cd.CONCEPT_CD IS NULL OR cf.CQL_ID IS NULL
    `)

    if (orphanedLookups.success) {
      console.log(`  - Orphaned lookups: ${orphanedLookups.data[0].count}`)
      if (orphanedLookups.data[0].count === 0) {
        console.log('  ✅ All lookups have valid references')
      }
    }

    // Test pagination
    console.log('\n📄 Testing pagination...')

    if (concepts.length > 0) {
      const conceptPage = await conceptRepo.getConceptsPaginated(1, 3)
      console.log(`  - Concept pagination: Page 1 of ${conceptPage.pagination.totalPages}`)
      console.log(`    Items: ${conceptPage.concepts.length}/${conceptPage.pagination.totalCount}`)
    }

    if (cqlRules.length > 0) {
      const cqlPage = await cqlRepo.getCqlRulesPaginated(1, 2)
      console.log(`  - CQL pagination: Page 1 of ${cqlPage.pagination.totalPages}`)
      console.log(`    Items: ${cqlPage.rules.length}/${cqlPage.pagination.totalCount}`)
    }

    if (users.length > 0) {
      const userPage = await userRepo.getUsersPaginated(1, 2)
      console.log(`  - User pagination: Page 1 of ${userPage.pagination.totalPages}`)
      console.log(`    Items: ${userPage.users.length}/${userPage.pagination.totalCount}`)
    }

    // Database size and performance
    console.log('\n📊 Database information...')
    const dbSize = await connection.getDatabaseSize()
    console.log(`  - Database size: ${dbSize} bytes (${(dbSize / 1024).toFixed(2)} KB)`)

    // Test connection status
    const status = connection.getStatus()
    console.log(`  - Connection status: ${status ? 'Connected' : 'Disconnected'}`)

    console.log('\n🎉 Seed data testing completed successfully!')

    // Summary
    console.log('\n📋 Summary:')
    console.log(`  - Database created: ${testDbPath}`)
    console.log(`  - Tables created: ${seedStats.concepts > 0 ? 'Yes' : 'No'}`)
    console.log(`  - Concepts seeded: ${seedStats.concepts}`)
    console.log(`  - CQL rules seeded: ${seedStats.cqlRules}`)
    console.log(`  - Lookups seeded: ${seedStats.conceptCqlLookups}`)
    console.log(`  - Users seeded: ${seedStats.users}`)
    console.log(`  - Errors: ${seedStats.errors.length}`)
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    // Cleanup
    if (connection && connection.getStatus()) {
      await connection.disconnect()
      console.log('\n🔌 Disconnected from database')
    }

    // Optionally keep the test database for inspection
    if (fs.existsSync(testDbPath)) {
      console.log(`\n💾 Test database preserved at: ${testDbPath}`)
      console.log('   You can inspect it using: sqlite3 ' + testDbPath)
    }
  }
}

// Run the test
testSeedData().catch(console.error)
