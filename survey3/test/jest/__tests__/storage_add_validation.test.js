import { STORAGE } from 'src/tools/Storage'

// Absicherung der Import-Robustheit: STORAGE.add darf bei unvollständigen
// Payloads NICHT crashen (z.B. fehlendes info -> früher Zugriff info.uid),
// sondern false zurückgeben.
describe('STORAGE.add Validierung (Import-Robustheit)', () => {
  test('lehnt unvollständige/ungültige Payloads ab, ohne zu werfen', () => {
    expect(STORAGE.add(undefined)).toBe(false)
    expect(STORAGE.add({})).toBe(false)
    expect(STORAGE.add({ cda: {}, hash: 'h', exported: false })).toBe(false) // info fehlt -> kein Crash
    expect(STORAGE.add({ cda: {}, hash: 'h', info: {} })).toBe(false) // exported fehlt
    expect(STORAGE.add({ exported: false, hash: 'h', info: {} })).toBe(false) // cda fehlt
  })

  test('akzeptiert ein vollständiges Dokument (kein false)', () => {
    const r = STORAGE.add({ cda: { section: [] }, hash: 'h', exported: false, info: { PID: 'CY' } })
    expect(r).not.toBe(false)
  })
})
