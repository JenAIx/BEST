#!/usr/bin/env node

/**
 * Test Output Cleanup Script
 *
 * This script cleans up the test output directory and organizes test files.
 * Run this script to clean up test databases and temporary files.
 */

import { readdir, unlink, rmdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve, join } from 'path'

const TEST_OUTPUT_DIR = resolve(__dirname, '../output')

async function cleanupOutputDirectory() {
  console.log('🧹 Cleaning up test output directory...')
  console.log(`📁 Target directory: ${TEST_OUTPUT_DIR}`)

  if (!existsSync(TEST_OUTPUT_DIR)) {
    console.log('✅ Output directory does not exist, nothing to clean')
    return
  }

  try {
    const files = await readdir(TEST_OUTPUT_DIR)

    if (files.length === 0) {
      console.log('✅ Output directory is already empty')
      return
    }

    let deletedCount = 0
    let totalSize = 0

    for (const file of files) {
      const filePath = join(TEST_OUTPUT_DIR, file)
      const stats = await stat(filePath)

      if (stats.isFile()) {
        await unlink(filePath)
        deletedCount++
        totalSize += stats.size
        console.log(`🗑️  Deleted: ${file} (${(stats.size / 1024).toFixed(2)} KB)`)
      } else if (stats.isDirectory()) {
        await rmdir(filePath, { recursive: true })
        deletedCount++
        console.log(`🗑️  Deleted directory: ${file}`)
      }
    }

    console.log(`\n✅ Cleanup complete!`)
    console.log(`📊 Deleted ${deletedCount} items`)
    console.log(`💾 Freed ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message)
    process.exit(1)
  }
}

async function main() {
  try {
    await cleanupOutputDirectory()
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Run cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { cleanupOutputDirectory }
