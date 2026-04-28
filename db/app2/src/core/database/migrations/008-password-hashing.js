/**
 * Migration 008: Hash all stored passwords with bcrypt + Hard-Reset flag
 *
 * Steps:
 * 1. Add MUST_CHANGE_PASSWORD column to USER_MANAGEMENT (default 0).
 * 2. For every existing row whose PASSWORD_CHAR is not yet a bcrypt hash,
 *    replace it with a bcrypt hash of the original plaintext value.
 *    This keeps existing seed credentials (admin/admin, ste/123, …) usable
 *    one more time, but stored on disk only as a hash.
 * 3. Set MUST_CHANGE_PASSWORD = 1 for those rows so the next login forces
 *    a fresh password (Hard-Reset semantics).
 *
 * Rows that already hold a bcrypt hash are left untouched, so re-running
 * the migration is a no-op.
 */

import { hashPasswordSync, isHashed } from '../../services/password-service.js'

export const passwordHashing = {
  name: '008-password-hashing',
  description: 'Hash plaintext passwords + add MUST_CHANGE_PASSWORD flag for hard-reset',
  execute: async (connection) => {
    const columnInfo = await connection.executeQuery(`PRAGMA table_info(USER_MANAGEMENT)`)
    const columns = columnInfo.success ? columnInfo.data.map((c) => c.name) : []

    if (!columns.includes('MUST_CHANGE_PASSWORD')) {
      await connection.executeCommand(
        `ALTER TABLE USER_MANAGEMENT ADD COLUMN MUST_CHANGE_PASSWORD INTEGER DEFAULT 0`,
      )
    }

    const usersResult = await connection.executeQuery(
      `SELECT USER_ID, PASSWORD_CHAR FROM USER_MANAGEMENT`,
    )
    if (!usersResult.success) {
      throw new Error('Failed to read USER_MANAGEMENT for password migration')
    }

    for (const row of usersResult.data) {
      const stored = row.PASSWORD_CHAR
      if (!stored || isHashed(stored)) continue

      const hash = hashPasswordSync(stored)
      await connection.executeCommand(
        `UPDATE USER_MANAGEMENT
         SET PASSWORD_CHAR = ?, MUST_CHANGE_PASSWORD = 1, UPDATE_DATE = ?
         WHERE USER_ID = ?`,
        [hash, new Date().toISOString(), row.USER_ID],
      )
    }
  },
}
