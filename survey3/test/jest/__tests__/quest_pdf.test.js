// Tests für den PDF-Builder (reines, druckbares Leerformular).
// Sichert die behobenen Defekte ab: slider -> VAS-Skala, image -> eingebettet.

import { buildQuestPdfHtml } from '../../../src/tools/quest-pdf'

const build = (quest, opts) => buildQuestPdfHtml(quest, opts || {})

describe('buildQuestPdfHtml', () => {
  test('vertikaler Slider rendert eine VAS-Skala mit Endpunkt-Labels und Min/Max', () => {
    const quest = {
      title: 'EQ-5D',
      items: [
        {
          label: 'Heutiger Gesundheitszustand',
          type: 'slider',
          vertical: true,
          options: { top: { value: 100, label: 'Bester Zustand' }, bottom: { value: 0, label: 'Schlechtester Zustand' }, steps: 1 },
        },
      ],
    }
    const out = build(quest)
    expect(out).toContain('vas-v') // vertikale Skala statt leerem Kästchen
    expect(out).toContain('Bester Zustand')
    expect(out).toContain('Schlechtester Zustand')
    expect(out).toContain('>100<') // Max-Teilstrich
    expect(out).toContain('>0<') // Min-Teilstrich
    expect(out).not.toContain('class="input-box"') // nicht mehr das alte leere Kästchen-Element
  })

  test('horizontaler Slider rendert eine horizontale VAS-Skala', () => {
    const quest = {
      title: 'VAS',
      items: [{ label: 'Schmerz', type: 'slider', options: { top: { value: 10, label: 'maximal' }, bottom: { value: 0, label: 'kein' } } }],
    }
    const out = build(quest)
    expect(out).toContain('vas-h')
    expect(out).toContain('>10<')
    expect(out).toContain('maximal')
  })

  test('image-Items werden eingebettet (zuvor übersprungen), mit absoluter URL', () => {
    const quest = { title: 'Demenzscreening', items: [{ type: 'image', value: ['krahn.png', 'palme.png'], width: 200 }] }
    const out = build(quest, { imgBase: 'https://app.example/img/' })
    expect(out).toContain('<img class="pdf-image" src="https://app.example/img/krahn.png"')
    expect(out).toContain('https://app.example/img/palme.png')
    expect(out).toContain('width:200px')
  })

  test('radio -> Options-Kreise, multiple_radio -> Matrix-Tabelle', () => {
    const quest = {
      title: 'Test',
      items: [
        { label: '1. Frage', type: 'radio', options: [{ label: 'ja', value: 1 }, { label: 'nein', value: 0 }] },
        { label: 'Matrix', type: 'multiple_radio', options: { answers: [{ label: 'nie', value: 0 }], questions: [{ tag: 'q1', label: 'Frage A' }] } },
      ],
    }
    const out = build(quest)
    expect(out).toContain('radio-circle')
    expect(out).toContain('mr-table')
    expect(out).toContain('Frage A')
  })

  test('Kopf enthält Titel und PID-Feld', () => {
    const out = build({ title: 'Mein Bogen', items: [] })
    expect(out).toContain('Mein Bogen')
    expect(out).toContain('Patienten-ID')
  })
})
