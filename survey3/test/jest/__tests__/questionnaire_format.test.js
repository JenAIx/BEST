// Run: npm run test:unit test/jest/__tests__/questionnaire_format.test.js
//
// Formatierungs-Guard für die gebündelten Fragebögen: einheitliche LF-Zeilenenden
// (kein CRLF) — abgesichert zusätzlich durch .gitattributes. Verhindert die
// spurious git-Diffs, die gemischte Editoren früher erzeugt haben.

import fs from 'fs'
import path from 'path'

const DIR = path.resolve(__dirname, '../../../src/assets/questionnaires')

describe('Fragebogen-Dateiformat', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith('quest_') && f.endsWith('.json'))

  test('es gibt Fragebogen-Dateien', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  test('kein quest_*.json enthält CRLF (\\r)', () => {
    const offenders = files.filter((f) => fs.readFileSync(path.join(DIR, f), 'utf8').includes('\r'))
    expect(offenders).toEqual([])
  })

  test('alle quest_*.json sind valides JSON', () => {
    const broken = []
    for (const f of files) {
      try { JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch (e) { broken.push(`${f}: ${e.message}`) }
    }
    expect(broken).toEqual([])
  })
})
