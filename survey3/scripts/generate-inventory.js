#!/usr/bin/env node
// Erzeugt docs/QUESTIONNAIRE_INVENTORY.md aus den gebündelten Fragebögen.
// Single Source of Truth sind die quest_*.json — das Inventar wird daraus
// generiert, NICHT von Hand gepflegt. Bei neuem/geändertem Bogen neu erzeugen:
//
//   npm run inventory
//
// Der Guard test/jest/__tests__/inventory.test.js stellt sicher, dass das
// eingecheckte Inventar synchron ist (sonst schlägt die CI fehl).

const fs = require('fs')
const path = require('path')

const QUEST_DIR = path.join(__dirname, '..', 'src', 'assets', 'questionnaires')
const OUT = path.join(__dirname, '..', 'docs', 'QUESTIONNAIRE_INVENTORY.md')

const LIC_LABEL = {
  free: '🔓 frei',
  licensed: '🔒 Lizenz',
  unclear: '❔ unklar',
}

function cell(v) {
  // Markdown-Tabellenzellen: Pipes/Zeilenumbrüche neutralisieren
  return String(v == null ? '' : v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()
}

function buildRows() {
  const files = fs.readdirSync(QUEST_DIR).filter((f) => f.startsWith('quest_') && f.endsWith('.json'))
  const rows = files.map((file) => {
    const j = JSON.parse(fs.readFileSync(path.join(QUEST_DIR, file), 'utf8'))
    const status = j.license && j.license.status
    return {
      file,
      label: j.short_title || '',
      title: j.title || '',
      description: j.description || '',
      license: LIC_LABEL[status] || '⚠ fehlt',
      keywords: j.keywords || '',
    }
  })
  rows.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
  return rows
}

function render(rows) {
  const counts = rows.reduce((m, r) => ((m[r.license] = (m[r.license] || 0) + 1), m), {})
  const summary = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')
  const head = [
    '# Fragebogen-Inventar',
    '',
    '> **Automatisch generiert** aus `src/assets/questionnaires/quest_*.json` via',
    '> `npm run inventory`. **Nicht von Hand bearbeiten** — Änderungen an den',
    '> Bögen vornehmen und neu generieren. Der Guard `inventory.test.js` hält das',
    '> eingecheckte Inventar synchron (CI schlägt sonst fehl).',
    '',
    `**${rows.length} Fragebögen** — Lizenz: ${summary}`,
    '',
    '| Datei | Label (short_title) | Titel | Beschreibung | Lizenz | Keywords |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  const body = rows.map(
    (r) => `| \`${cell(r.file)}\` | \`${cell(r.label)}\` | ${cell(r.title)} | ${cell(r.description)} | ${cell(r.license)} | ${cell(r.keywords)} |`
  )
  return head.concat(body).join('\n') + '\n'
}

const md = render(buildRows())

// Bei --check nur vergleichen (für den Test), sonst schreiben.
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (current !== md) {
    console.error('Inventar veraltet — bitte `npm run inventory` ausführen und committen.')
    process.exit(1)
  }
  console.log('Inventar synchron.')
} else {
  fs.writeFileSync(OUT, md)
  console.log('Geschrieben:', path.relative(path.join(__dirname, '..'), OUT))
}

module.exports = { buildRows, render }
