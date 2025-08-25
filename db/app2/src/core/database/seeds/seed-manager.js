/**
 * Seed Data Manager
 *
 * This class manages the seeding of initial data into the database.
 * Works in both browser (via Vite) and Node.js (tests) environments.
 */

import {
  conceptsData,
  cqlRulesData,
  conceptCqlLookupsData,
  standardUsersData,
} from './csv-loader.js'

class SeedManager {
  constructor(connection) {
    this.connection = connection

    // Parse CSV data at instantiation
    this.standardUsers = this.parseCSV(standardUsersData)
    this.concepts = this.parseCSV(conceptsData)
    this.cqlRules = this.parseCSV(cqlRulesData)
    this.conceptCqlLookups = this.parseCSV(conceptCqlLookupsData)

    console.log(`📊 Loaded seed data:
      - ${this.standardUsers.length} users
      - ${this.concepts.length} concepts
      - ${this.cqlRules.length} CQL rules
      - ${this.conceptCqlLookups.length} concept-CQL lookups`)
  }

  /**
   * Parse CSV string into array of objects
   * @param {string} csvString - Raw CSV string
   * @returns {Array<Object>} - Array of parsed objects
   */
  parseCSV(csvString) {
    if (!csvString) return []

    const lines = csvString.trim().split('\n')
    if (lines.length < 2) return []

    // Extract headers
    const headers = this.parseCsvLine(lines[0])

    // Parse data rows
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i])
      if (values.length === headers.length) {
        const row = {}
        headers.forEach((header, index) => {
          // Convert empty strings to null for database compatibility
          row[header] = values[index] === '' ? null : values[index]
        })
        data.push(row)
      }
    }

    return data
  }

  /**
   * Parse a single CSV line handling quoted values
   * @param {string} line - CSV line to parse
   * @returns {Array<string>} - Array of values
   */
  parseCsvLine(line) {
    const values = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i++
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }

    // Don't forget the last value
    values.push(current)

    return values
  }

  /**
   * Initialize all seed data in the database
   * @returns {Promise<Object>} - Seeding results
   */
  async initializeSeedData() {
    try {
      console.log('🌱 Initializing seed data...')

      const results = {
        concepts: 0,
        cqlRules: 0,
        conceptCqlLookups: 0,
        users: 0,
        errors: [],
      }

      // Seed in correct order (foreign key dependencies)

      // 1. Seed concepts first (referenced by lookups)
      try {
        results.concepts = await this.seedConcepts()
        console.log(`✅ Seeded ${results.concepts} concepts`)
      } catch (error) {
        results.errors.push(`Concepts: ${error.message}`)
        console.error('❌ Error seeding concepts:', error)
      }

      // 2. Seed CQL rules (referenced by lookups)
      try {
        results.cqlRules = await this.seedCqlRules()
        console.log(`✅ Seeded ${results.cqlRules} CQL rules`)
      } catch (error) {
        results.errors.push(`CQL Rules: ${error.message}`)
        console.error('❌ Error seeding CQL rules:', error)
      }

      // 3. Seed concept-CQL lookups (depends on concepts and CQL rules)
      try {
        results.conceptCqlLookups = await this.seedConceptCqlLookups()
        console.log(`✅ Seeded ${results.conceptCqlLookups} concept-CQL lookups`)
      } catch (error) {
        results.errors.push(`Concept-CQL Lookups: ${error.message}`)
        console.error('❌ Error seeding concept-CQL lookups:', error)
      }

      // 4. Seed users (independent)
      try {
        results.users = await this.seedStandardUsers()
        console.log(`✅ Seeded ${results.users} standard users`)
      } catch (error) {
        results.errors.push(`Users: ${error.message}`)
        console.error('❌ Error seeding users:', error)
        throw error // Users are critical, so we re-throw
      }

      if (results.errors.length === 0) {
        console.log('🎉 All seed data initialized successfully!')
      } else {
        console.log('⚠️  Some seed data failed to initialize:', results.errors)
      }

      return results
    } catch (error) {
      console.error('❌ Failed to initialize seed data:', error)
      throw error
    }
  }

  /**
   * Seed concepts from parsed CSV data
   * @returns {Promise<number>} - Number of concepts seeded
   */
  async seedConcepts() {
    if (!this.concepts || this.concepts.length === 0) {
      console.log('⚠️  No concepts to seed')
      return 0
    }

    console.log(`🌱 Seeding ${this.concepts.length} concepts...`)

    let seededCount = 0
    const batchSize = 25 // Smaller batches to reduce connection stress

    for (let i = 0; i < this.concepts.length; i += batchSize) {
      const batch = this.concepts.slice(i, i + batchSize)

      for (const concept of batch) {
        try {
          await this.insertConceptWithRetry(concept)
          seededCount++

          // Log progress every 50 concepts
          if (seededCount % 50 === 0) {
            console.log(`  📍 Progress: ${seededCount}/${this.concepts.length} concepts`)
          }
        } catch (error) {
          console.error(`❌ Error seeding concept ${concept.CONCEPT_CD}:`, error.message)
        }
      }

      // Small delay between batches to prevent connection overload
      if (i + batchSize < this.concepts.length) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    return seededCount
  }

  /**
   * Seed CQL rules from parsed CSV data
   * @returns {Promise<number>} - Number of CQL rules seeded
   */
  async seedCqlRules() {
    if (!this.cqlRules || this.cqlRules.length === 0) {
      console.log('⚠️  No CQL rules to seed')
      return 0
    }

    console.log(`🌱 Seeding ${this.cqlRules.length} CQL rules...`)

    let seededCount = 0

    for (const cqlRule of this.cqlRules) {
      try {
        await this.insertCqlRule(cqlRule)
        seededCount++
        console.log(`✅ Seeded CQL rule: ${cqlRule.CODE_CD}`)
      } catch (error) {
        console.error(`❌ Error seeding CQL rule ${cqlRule.CODE_CD}:`, error.message)
      }
    }

    return seededCount
  }

  /**
   * Seed concept-CQL lookups from parsed CSV data
   * @returns {Promise<number>} - Number of lookups seeded
   */
  async seedConceptCqlLookups() {
    if (!this.conceptCqlLookups || this.conceptCqlLookups.length === 0) {
      console.log('⚠️  No concept-CQL lookups to seed')
      return 0
    }

    console.log(`🌱 Seeding ${this.conceptCqlLookups.length} concept-CQL lookups...`)

    let seededCount = 0

    for (const lookup of this.conceptCqlLookups) {
      try {
        await this.insertConceptCqlLookup(lookup)
        seededCount++
        console.log(`✅ Seeded concept-CQL lookup: ${lookup.CONCEPT_CD} -> CQL ${lookup.CQL_ID}`)
      } catch (error) {
        console.error(`❌ Error seeding concept-CQL lookup:`, error.message)
      }
    }

    return seededCount
  }

  /**
   * Seed standard users from parsed CSV data
   * @returns {Promise<number>} - Number of users seeded
   */
  async seedStandardUsers() {
    if (!this.standardUsers || this.standardUsers.length === 0) {
      console.log('⚠️  No users to seed')
      return 0
    }

    console.log(`🌱 Seeding ${this.standardUsers.length} standard users...`)

    let seededCount = 0

    for (const user of this.standardUsers) {
      try {
        await this.insertUser(user)
        seededCount++
        console.log(`✅ Seeded user: ${user.USER_CD}`)
      } catch (error) {
        console.error(`❌ Error seeding user ${user.USER_CD}:`, error.message)
      }
    }

    return seededCount
  }

  /**
   * Insert a single concept with retry mechanism
   * @param {Object} concept - Concept data
   * @returns {Promise<void>}
   */
  async insertConceptWithRetry(concept, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.insertConcept(concept)
        return // Success, exit retry loop
      } catch (error) {
        if (attempt === maxRetries) {
          throw error // Final attempt failed, re-throw error
        }

        // Check if it's a connection error
        if (
          error.message.includes('Database not connected') ||
          error.message.includes('SQLITE_MISUSE')
        ) {
          console.warn(
            `⚠️  Connection issue on attempt ${attempt} for concept ${concept.CONCEPT_CD}, retrying...`,
          )
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
        } else {
          throw error // Non-connection error, don't retry
        }
      }
    }
  }

  /**
   * Insert a concept into the CONCEPT_DIMENSION table
   * @param {Object} concept - Concept object to insert
   * @returns {Promise<void>}
   */
  async insertConcept(concept) {
    const fields = Object.keys(concept).filter(
      (key) => concept[key] !== null && concept[key] !== undefined,
    )
    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map((field) => concept[field])

    const sql = `INSERT OR IGNORE INTO CONCEPT_DIMENSION (${fields.join(', ')}) VALUES (${placeholders})`
    await this.connection.executeCommand(sql, values)
  }

  /**
   * Insert a CQL rule into the CQL_FACT table
   * @param {Object} cqlRule - CQL rule object to insert
   * @returns {Promise<void>}
   */
  async insertCqlRule(cqlRule) {
    const fields = Object.keys(cqlRule).filter(
      (key) => cqlRule[key] !== null && cqlRule[key] !== undefined,
    )
    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map((field) => cqlRule[field])

    const sql = `INSERT OR IGNORE INTO CQL_FACT (${fields.join(', ')}) VALUES (${placeholders})`
    await this.connection.executeCommand(sql, values)
  }

  /**
   * Insert a concept-CQL lookup into the CONCEPT_CQL_LOOKUP table
   * @param {Object} lookup - Lookup object to insert
   * @returns {Promise<void>}
   */
  async insertConceptCqlLookup(lookup) {
    const fields = Object.keys(lookup).filter(
      (key) => lookup[key] !== null && lookup[key] !== undefined,
    )
    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map((field) => lookup[field])

    const sql = `INSERT OR IGNORE INTO CONCEPT_CQL_LOOKUP (${fields.join(', ')}) VALUES (${placeholders})`
    await this.connection.executeCommand(sql, values)
  }

  /**
   * Insert a user into the USER_MANAGEMENT table
   * @param {Object} user - User object to insert
   * @returns {Promise<void>}
   */
  async insertUser(user) {
    const fields = Object.keys(user).filter((key) => user[key] !== null && user[key] !== undefined)
    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map((field) => user[field])

    const sql = `INSERT OR IGNORE INTO USER_MANAGEMENT (${fields.join(', ')}) VALUES (${placeholders})`

    console.log(`🔍 [SeedManager] Inserting user ${user.USER_CD}`)
    await this.connection.executeCommand(sql, values)
  }

  /**
   * Get seed data statistics
   * @returns {Promise<Object>} - Seed data statistics
   */
  async getSeedDataStatistics() {
    try {
      const [conceptCount, cqlCount, lookupCount, userCount] = await Promise.all([
        this.connection.executeQuery('SELECT COUNT(*) as count FROM CONCEPT_DIMENSION'),
        this.connection.executeQuery('SELECT COUNT(*) as count FROM CQL_FACT'),
        this.connection.executeQuery('SELECT COUNT(*) as count FROM CONCEPT_CQL_LOOKUP'),
        this.connection.executeQuery('SELECT COUNT(*) as count FROM USER_MANAGEMENT'),
      ])

      return {
        concepts: conceptCount.success ? conceptCount.data[0].count : 0,
        cqlRules: cqlCount.success ? cqlCount.data[0].count : 0,
        conceptCqlLookups: lookupCount.success ? lookupCount.data[0].count : 0,
        users: userCount.success ? userCount.data[0].count : 0,
      }
    } catch (error) {
      console.error('Error getting seed data statistics:', error)
      return {
        concepts: 0,
        cqlRules: 0,
        conceptCqlLookups: 0,
        users: 0,
        errors: [error.message],
      }
    }
  }
}

export default SeedManager
