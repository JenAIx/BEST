// Run Test with:
// npm run test:unit test/jest/__tests__/settings.test.js 

import { SETTINGS } from "../../../src/tools/settings"


describe('SETTINGS Class', () => {

  it('can use empty settings', () => {
    expect(SETTINGS._DATA).not.toBe(undefined)
  });

  it('can change values', () => {
    expect(SETTINGS.size).toBe('normal')
    SETTINGS.size = 'big'
    expect(SETTINGS.size).toBe('big')

    expect(SETTINGS.email_export).toBe(undefined)
    SETTINGS.email_export = 'ste@ste'
    expect(SETTINGS.email_export).toBe('ste@ste')
    expect(SETTINGS._USER.email).toBe('ste@ste')
  })

  it('load() is callable (persistence handled by async init)', () => {
    expect(() => SETTINGS.load()).not.toThrow()
  })



})


