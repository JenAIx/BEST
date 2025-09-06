/**
 * Migration: Add missing columns to NOTE_FACT table
 * Adds SOURCESYSTEM_CD, NOTE_TEXT, PATIENT_NUM, and ENCOUNTER_NUM columns to NOTE_FACT
 */

export const addNoteFactColumns = {
  name: '003-add-note-fact-columns',
  description: 'Add missing columns to NOTE_FACT table for search service integration',
  async execute(connection) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const result = await connection.executeQuery(`PRAGMA table_info(${tableName})`)
        console.log(`PRAGMA table_info result:`, result)

        if (result.success && result.data && Array.isArray(result.data)) {
          const columns = result.data.map((col) => col.name)
          console.log(`Found columns in ${tableName}:`, columns)
          const exists = columns.includes(columnName)
          console.log(`Checking if column '${columnName}' exists:`, exists)
          return exists
        }
        console.log(`PRAGMA query failed or returned unexpected format`)
        return false
      } catch (error) {
        console.error(`Error checking column existence for ${columnName}:`, error)
        return false
      }
    }

    // Add columns only if they don't exist
    const columnsToAdd = [
      { name: 'SOURCESYSTEM_CD', type: 'TEXT' },
      { name: 'NOTE_TEXT', type: 'TEXT' },
      { name: 'PATIENT_NUM', type: 'INTEGER' },
      { name: 'ENCOUNTER_NUM', type: 'INTEGER' },
    ]

    console.log('Starting NOTE_FACT column migration...')

    for (const column of columnsToAdd) {
      const exists = await columnExists('NOTE_FACT', column.name)
      if (!exists) {
        try {
          await connection.executeCommand(`ALTER TABLE NOTE_FACT ADD COLUMN ${column.name} ${column.type};`)
          console.log(`✅ Added column ${column.name} to NOTE_FACT table`)
        } catch (error) {
          console.error(`❌ Failed to add column ${column.name}:`, error.message)
          // If it's a duplicate column error, that means it exists, so continue
          if (error.message.includes('duplicate column name')) {
            console.log(`Column ${column.name} already exists (caught duplicate error)`)
          } else {
            throw error // Re-throw other errors
          }
        }
      } else {
        console.log(`✅ Column ${column.name} already exists in NOTE_FACT table, skipping`)
      }
    }

    // Create indexes (these are safe to run multiple times)
    console.log('Creating indexes for NOTE_FACT...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_note_fact_patient_num ON NOTE_FACT(PATIENT_NUM)',
      'CREATE INDEX IF NOT EXISTS idx_note_fact_encounter_num ON NOTE_FACT(ENCOUNTER_NUM)',
      'CREATE INDEX IF NOT EXISTS idx_note_fact_sourcesystem_cd ON NOTE_FACT(SOURCESYSTEM_CD)',
      'CREATE INDEX IF NOT EXISTS idx_note_fact_note_text ON NOTE_FACT(NOTE_TEXT)',
    ]

    for (const indexSql of indexes) {
      try {
        await connection.executeCommand(indexSql)
        console.log(`✅ Created index successfully`)
      } catch (error) {
        console.error(`❌ Failed to create index:`, error.message)
      }
    }

    console.log('NOTE_FACT migration completed successfully!')
  },
}
