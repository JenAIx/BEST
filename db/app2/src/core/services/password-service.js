/**
 * Password Service
 *
 * Central helper for password hashing and verification using bcryptjs.
 * Stored hashes use the bcrypt format: `$2a$<cost>$<salt+hash>` (60 chars).
 *
 * `isHashed()` distinguishes legacy plaintext rows from hashed rows during
 * migration and during the transitional auth flow (see auth-store.login).
 */

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

const BCRYPT_PREFIX_RE = /^\$2[aby]\$\d{2}\$/

/**
 * Detect whether a stored password value is already a bcrypt hash.
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function isHashed(value) {
  return typeof value === 'string' && value.length >= 60 && BCRYPT_PREFIX_RE.test(value)
}

/**
 * Hash a plaintext password.
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export async function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Password must be a non-empty string')
  }
  return bcrypt.hash(plaintext, SALT_ROUNDS)
}

/**
 * Hash synchronously — only use in migration/seed contexts where async is awkward.
 * @param {string} plaintext
 * @returns {string}
 */
export function hashPasswordSync(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Password must be a non-empty string')
  }
  return bcrypt.hashSync(plaintext, SALT_ROUNDS)
}

/**
 * Verify a plaintext password against a stored value.
 * If `stored` is a bcrypt hash, uses bcrypt.compare. Otherwise falls back
 * to constant-ish strict equality so legacy plaintext rows can still
 * authenticate once before migration upgrades them.
 * @param {string} plaintext
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plaintext, stored) {
  if (typeof stored !== 'string' || stored.length === 0) return false
  if (isHashed(stored)) {
    return bcrypt.compare(plaintext, stored)
  }
  return plaintext === stored
}
