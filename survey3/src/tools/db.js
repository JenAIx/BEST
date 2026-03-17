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
