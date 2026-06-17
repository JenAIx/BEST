// Run Test with:
// npm run test:unit test/jest/__tests__/questman_restore.test.js
//
// restore_active_values überlagert Entwurfs-Werte auf den aktiven Quest.

import { QUESTMAN } from '../../../src/tools/questman'

describe('QuestMan.restore_active_values', () => {
  test('gibt false zurück, wenn kein activeQuest gesetzt ist', () => {
    QUESTMAN.activeQuest = undefined
    expect(QUESTMAN.restore_active_values([1, 2, 3])).toBe(false)
  })

  test('überlagert gespeicherte Werte indexgenau auf items', () => {
    QUESTMAN.activeQuest = 'sf36'
    expect(QUESTMAN.activeQuest).not.toBe(undefined)
    const items = QUESTMAN.activeQuest.value.items
    const values = items.map((_, i) => `v${i}`)

    expect(QUESTMAN.restore_active_values(values)).toBe(true)
    items.forEach((it, i) => expect(it.value).toBe(`v${i}`))
  })

  test('kürzeres values-Array setzt nur die vorhandenen Indizes', () => {
    QUESTMAN.activeQuest = 'sf36'
    QUESTMAN.reset_activeQuest()
    const items = QUESTMAN.activeQuest.value.items
    QUESTMAN.restore_active_values(['only-first'])
    expect(items[0].value).toBe('only-first')
  })

  test('ignoriert ungültige Eingaben', () => {
    QUESTMAN.activeQuest = 'sf36'
    expect(QUESTMAN.restore_active_values(undefined)).toBe(false)
    expect(QUESTMAN.restore_active_values(null)).toBe(false)
  })
})
