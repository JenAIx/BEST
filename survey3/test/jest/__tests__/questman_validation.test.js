// Run Test with:
// npm run test:unit test/jest/__tests__/questman_validation.test.js
//
// Tests the check_activeQuest validation logic directly,
// without importing QuestMan (which depends on import.meta.glob).

/**
 * Extracted check_activeQuest logic — mirrors QuestMan.check_activeQuest
 * so we can test it in isolation without Vite's import.meta.glob.
 */
function check_activeQuest(items) {
  if (items === undefined) return undefined

  const index = []

  items.forEach(item => {
    if (item.force === false) index.push(true)
    else if (item.type === 'textbox' || item.type === 'seperator' || item.type === 'separator' || item.type === undefined) index.push(null)
    else if (item.type === 'multiple_radio') {
      if (item.value === undefined || item.value === null) index.push(false)
      else {
        let ISVALID = true
        item.value.forEach(val => {
          if (val === undefined || val === null) ISVALID = false
        })
        index.push(ISVALID)
      }
    }
    else if (item.value !== undefined && item.value !== null) index.push(true)
    else index.push(false)
  })

  if (index.includes(false)) return index
  else return true
}

describe('check_activeQuest', () => {

  test('returns undefined when items is undefined', () => {
    expect(check_activeQuest(undefined)).toBeUndefined()
  })

  test('empty items array returns true', () => {
    expect(check_activeQuest([])).toBe(true)
  })

  test('all items valid returns true', () => {
    const items = [
      { type: 'radio', value: 1 },
      { type: 'text', value: 'hello' },
      { type: 'number', value: 42 }
    ]
    expect(check_activeQuest(items)).toBe(true)
  })

  test('one required item missing returns array with false', () => {
    const items = [
      { type: 'radio', value: 1 },
      { type: 'radio', value: undefined },
      { type: 'text', value: 'hello' }
    ]
    const result = check_activeQuest(items)
    expect(result).not.toBe(true)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toBe(true)
    expect(result[1]).toBe(false)
    expect(result[2]).toBe(true)
  })

  test('force: false items always valid', () => {
    const items = [
      { type: 'radio', force: false, value: undefined },
      { type: 'text', force: false, value: undefined }
    ]
    expect(check_activeQuest(items)).toBe(true)
  })

  test('separator items return null (old spelling)', () => {
    const items = [
      { type: 'seperator', label: 'Section 1' }
    ]
    const result = check_activeQuest(items)
    expect(result).toBe(true) // null entries don't include false
  })

  test('separator items return null (correct spelling)', () => {
    const items = [
      { type: 'separator', label: 'Section 1' }
    ]
    const result = check_activeQuest(items)
    expect(result).toBe(true)
  })

  test('textbox items return null', () => {
    const items = [
      { type: 'textbox', label: 'Info text' }
    ]
    expect(check_activeQuest(items)).toBe(true)
  })

  test('undefined type items return null', () => {
    const items = [
      { label: 'No type' }
    ]
    expect(check_activeQuest(items)).toBe(true)
  })

  test('multiple_radio with partial answers returns false', () => {
    const items = [
      { type: 'multiple_radio', value: [1, null, 3] }
    ]
    const result = check_activeQuest(items)
    expect(result).not.toBe(true)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toBe(false)
  })

  test('multiple_radio with all answers returns true', () => {
    const items = [
      { type: 'multiple_radio', value: [1, 2, 3] }
    ]
    expect(check_activeQuest(items)).toBe(true)
  })

  test('multiple_radio with undefined value returns false', () => {
    const items = [
      { type: 'multiple_radio', value: undefined }
    ]
    const result = check_activeQuest(items)
    expect(result).not.toBe(true)
    expect(result[0]).toBe(false)
  })

  test('multiple_radio with null value returns false', () => {
    const items = [
      { type: 'multiple_radio', value: null }
    ]
    const result = check_activeQuest(items)
    expect(result).not.toBe(true)
    expect(result[0]).toBe(false)
  })

  test('mixed item types', () => {
    const items = [
      { type: 'separator', label: 'Header' },
      { type: 'radio', value: 1 },
      { type: 'textbox', label: 'Info' },
      { type: 'text', value: null },
      { type: 'radio', force: false }
    ]
    const result = check_activeQuest(items)
    expect(result).not.toBe(true)
    expect(Array.isArray(result)).toBe(true)
    // separator → null, radio → true, textbox → null, text(null) → false, force:false → true
    expect(result).toEqual([null, true, null, false, true])
  })
})
