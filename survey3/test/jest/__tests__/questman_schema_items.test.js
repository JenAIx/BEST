// Run: npm run test:unit test/jest/__tests__/questman_schema_items.test.js
//
// Tests der gehärteten Item-Schema-Prüfung in validate.js (type/label/options).
// validate.js ist eine reine Funktion ohne import.meta.glob → direkt importierbar.

import { validateQuestScoring, ITEM_TYPES } from '../../../src/tools/questman/validate'

const codes = (res) => res.errors.map((e) => e.code)
const wcodes = (res) => res.warnings.map((e) => e.code)

describe('Item-Schema-Validierung', () => {
  test('ITEM_TYPES enthält alle Renderer-Typen inkl. textbox/image/date_year', () => {
    ;['radio', 'checkbox', 'text', 'number', 'date', 'date_year', 'time', 'slider',
      'multiple_radio', 'separator', 'textbox', 'image'].forEach((t) =>
      expect(ITEM_TYPES).toContain(t)
    )
  })

  test('valider Bogen: keine Fehler', () => {
    const quest = {
      title: 'T', short_title: 't',
      items: [
        { type: 'textbox', label: 'Info' },
        { type: 'radio', label: 'F1', options: [{ label: 'Ja', value: 1 }, { label: 'Nein', value: 0 }] },
      ],
    }
    expect(validateQuestScoring(quest).errors).toEqual([])
  })

  test('fehlendes type → MISSING_TYPE', () => {
    const res = validateQuestScoring({ items: [{ label: 'Überschrift' }] })
    expect(codes(res)).toContain('MISSING_TYPE')
  })

  test('unbekanntes type → UNKNOWN_TYPE', () => {
    const res = validateQuestScoring({ items: [{ type: 'dropdown', label: 'x' }] })
    expect(codes(res)).toContain('UNKNOWN_TYPE')
  })

  test('fehlendes label (kein String) → MISSING_LABEL', () => {
    const res = validateQuestScoring({ items: [{ type: 'text' }] })
    expect(codes(res)).toContain('MISSING_LABEL')
  })

  test('radio ohne options → MISSING_OPTIONS', () => {
    const res = validateQuestScoring({ items: [{ type: 'radio', label: 'F' }] })
    expect(codes(res)).toContain('MISSING_OPTIONS')
  })

  test('multiple_radio ohne questions/answers → MR_NO_QUESTIONS / MR_NO_ANSWERS', () => {
    const res = validateQuestScoring({ items: [{ type: 'multiple_radio', label: 'M', options: {} }] })
    expect(codes(res)).toEqual(expect.arrayContaining(['MR_NO_QUESTIONS', 'MR_NO_ANSWERS']))
  })

  test('drawing ist gültiger Typ, braucht keine options', () => {
    const res = validateQuestScoring({ items: [{ type: 'drawing', label: 'Uhr zeichnen', canvas: { size: 360 } }] })
    expect(res.errors).toEqual([])
    expect(ITEM_TYPES).toContain('drawing')
  })

  test('multiple_radio: Teilfrage ohne id → Warnung MR_QUESTION_NO_ID (kein Fehler)', () => {
    const quest = {
      items: [{
        type: 'multiple_radio', label: 'M',
        options: { questions: [{ label: 'q1', tag: 'a' }], answers: [{ label: 'Ja', value: 1 }] },
      }],
    }
    const res = validateQuestScoring(quest)
    expect(wcodes(res)).toContain('MR_QUESTION_NO_ID')
    expect(res.errors).toEqual([])
  })
})
