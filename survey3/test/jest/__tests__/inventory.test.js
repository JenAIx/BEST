// Guard: das eingecheckte Fragebogen-Inventar (docs/QUESTIONNAIRE_INVENTORY.md)
// ist synchron zu den gebündelten quest_*.json. Verhindert, dass ein neuer oder
// geänderter Bogen ohne aktualisiertes Inventar eingecheckt wird.
//
// Bei Fehlschlag: `npm run inventory` ausführen und die Datei committen.

const fs = require('fs')
const path = require('path')
const { buildRows, render } = require('../../../scripts/generate-inventory')

const INVENTORY = path.join(__dirname, '..', '..', '..', 'docs', 'QUESTIONNAIRE_INVENTORY.md')

describe('Fragebogen-Inventar', () => {
  const rows = buildRows()

  test('jeder Bogen hat einen Lizenzstatus (kein „fehlt")', () => {
    const missing = rows.filter((r) => r.license.includes('fehlt')).map((r) => r.label)
    expect(missing).toEqual([])
  })

  test('eingechecktes Inventar ist synchron (npm run inventory)', () => {
    const current = fs.readFileSync(INVENTORY, 'utf8')
    expect(current).toBe(render(rows))
  })
})
