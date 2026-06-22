import Dexie from 'dexie'

export const db = new Dexie('surveyBEST_DB')

db.version(1).stores({
  responses:      '++id, info.uid, info.date, info.PID, exported',
  presets:        '++id, label',
  settings:       'key',
  userQuests:     'short_title',
  deletedBundled: 'name',
  meta:           'key'
})

// v2 — Patienten-/Visiten-Workflow (parallel zum Single-Quest-Flow)
db.version(2).stores({
  responses:      '++id, info.uid, info.date, info.PID, exported',
  presets:        '++id, label',
  settings:       'key',
  userQuests:     'short_title',
  deletedBundled: 'name',
  meta:           'key',
  // NEU (id = uuid-String, von VisitMan vergeben — keine Autoincrement):
  patients:       'id, pid, created',
  visitTemplates: 'id, label',
  visits:         'id, patientId, status, date'
})

// v3 — Einzelbogen-Responses optional an Patienten gekoppelt (info.patientId).
// Rein additiver Index; bestehende Responses haben info.patientId === undefined.
db.version(3).stores({
  responses:      '++id, info.uid, info.date, info.PID, info.patientId, exported'
})
