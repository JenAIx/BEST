/**
 * Tests for useSingleVisitEdit — the "at most one visit in edit mode" state
 * machine of the unified timeline (features/visits-unified).
 */

import { describe, it, expect, vi } from 'vitest'
import { useSingleVisitEdit } from '../../src/composables/useSingleVisitEdit.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useSingleVisitEdit', () => {
  it('sets the id only AFTER select and enter completed', async () => {
    const order = []
    const edit = useSingleVisitEdit({
      selectVisit: async () => {
        order.push('select')
      },
      onEnter: async () => {
        order.push('enter')
      },
    })

    const promise = edit.startEditing({ id: 1 })
    expect(edit.editingVisitId.value).toBeNull() // not yet
    await promise
    expect(order).toEqual(['select', 'enter'])
    expect(edit.editingVisitId.value).toBe(1)
    expect(edit.isEditing(1)).toBe(true)
  })

  it('uses the store copy from resolveVisit', async () => {
    const storeCopy = { id: 7, visitType: 'stroke_lipid_v1', rawData: {} }
    const selectVisit = vi.fn(async () => {})
    const edit = useSingleVisitEdit({
      resolveVisit: (v) => (v.id === 7 ? storeCopy : null),
      selectVisit,
    })

    await edit.startEditing({ id: 7 }) // dialog payload without rawData
    expect(selectVisit).toHaveBeenCalledWith(storeCopy)
    expect(edit.editingVisitId.value).toBe(7)
  })

  it('switching cards closes the previous editor first and refreshes its data', async () => {
    const idsDuringSelect = []
    const onExit = vi.fn(async () => {})
    const edit = useSingleVisitEdit({
      selectVisit: async () => {
        idsDuringSelect.push(edit.editingVisitId.value)
      },
      onExit,
    })

    await edit.startEditing({ id: 1 })
    expect(onExit).not.toHaveBeenCalled() // fresh entry, nothing to exit

    await edit.startEditing({ id: 2 })

    // during the second select the first editor was already unmounted (null),
    // and the unseated visit's read data was refreshed
    expect(idsDuringSelect).toEqual([null, null])
    expect(edit.editingVisitId.value).toBe(2)
    expect(edit.isEditing(1)).toBe(false)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('ignores re-entrant calls while entering', async () => {
    let resolveSelect
    const edit = useSingleVisitEdit({
      selectVisit: () => new Promise((resolve) => (resolveSelect = resolve)),
    })

    const first = edit.startEditing({ id: 1 })
    const second = edit.startEditing({ id: 2 }) // ignored, still entering
    await second
    resolveSelect()
    await first
    await flush()

    expect(edit.editingVisitId.value).toBe(1)
  })

  it('stopEditing clears the id and runs onExit; no-op when not editing', async () => {
    const onExit = vi.fn(async () => {})
    const edit = useSingleVisitEdit({ selectVisit: async () => {}, onExit })

    await edit.stopEditing() // not editing → no exit callback
    expect(onExit).not.toHaveBeenCalled()

    await edit.startEditing({ id: 3 })
    await edit.stopEditing()
    expect(edit.editingVisitId.value).toBeNull()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('a failing selectVisit leaves no editor open', async () => {
    const edit = useSingleVisitEdit({
      selectVisit: async () => {
        throw new Error('db down')
      },
    })

    await expect(edit.startEditing({ id: 4 })).rejects.toThrow('db down')
    expect(edit.editingVisitId.value).toBeNull()

    // and the machine is usable again (entering flag was reset)
    const edit2Select = vi.fn(async () => {})
    const edit2 = useSingleVisitEdit({ selectVisit: edit2Select })
    await edit2.startEditing({ id: 5 })
    expect(edit2.editingVisitId.value).toBe(5)
  })
})
