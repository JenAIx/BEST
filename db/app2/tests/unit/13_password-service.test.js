import { describe, it, expect } from 'vitest'
import { hashPassword, hashPasswordSync, verifyPassword, isHashed } from '../../src/core/services/password-service.js'

describe('password-service', () => {
  it('hashPassword produces a bcrypt hash that verifies', async () => {
    const hash = await hashPassword('hunter2')
    expect(isHashed(hash)).toBe(true)
    expect(await verifyPassword('hunter2', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('hashPasswordSync is consistent with async API', async () => {
    const hash = hashPasswordSync('s3cret')
    expect(isHashed(hash)).toBe(true)
    expect(await verifyPassword('s3cret', hash)).toBe(true)
  })

  it('verifyPassword falls back to strict equality for plaintext-stored values', async () => {
    expect(await verifyPassword('admin', 'admin')).toBe(true)
    expect(await verifyPassword('admin', 'wrong')).toBe(false)
  })

  it('isHashed rejects plaintext and short strings', () => {
    expect(isHashed('admin')).toBe(false)
    expect(isHashed('')).toBe(false)
    expect(isHashed(null)).toBe(false)
    expect(isHashed(undefined)).toBe(false)
    expect(isHashed('$2a$10$tooShort')).toBe(false)
  })

  it('hashPassword rejects empty input', async () => {
    await expect(hashPassword('')).rejects.toThrow()
    await expect(hashPassword(null)).rejects.toThrow()
  })
})
