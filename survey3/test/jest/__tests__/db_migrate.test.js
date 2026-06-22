// Run Test with:
// npm run test:unit test/jest/__tests__/db_migrate.test.js
//
// Sichert den Bugfix gegen Regression ab: Die Migration aus dem alten
// monolithischen localStorage-Blob (surveyBEST_QUESTS) darf gebündelte
// Fragebögen, die im Alt-Blob fehlen, NICHT als gelöscht markieren — sonst
// verschwinden in neueren App-Versionen hinzugekommene Bögen (106 → 75 auf
// älteren iPads). Außerdem: repairDeletedBundled() setzt eine bereits
// fälschlich befüllte Liste einmalig zurück.

// --- In-Memory-Fake der genutzten Dexie-Tabellen ---
function makeKeyTable(keyField) {
  const map = new Map()
  return {
    _map: map,
    async get(key) { return map.get(key) },
    async put(obj) { map.set(obj[keyField], obj); return obj[keyField] },
    async clear() { map.clear() },
    async bulkAdd(arr) { for (const o of arr) map.set(o[keyField], o) },
    async toArray() { return [...map.values()] },
  }
}
function makeAutoTable() {
  const arr = []
  let id = 1
  return {
    _arr: arr,
    async bulkAdd(items) { for (const it of items) arr.push({ id: id++, ...it }) },
    async toArray() { return [...arr] },
    async clear() { arr.length = 0 },
    async put(obj) { arr.push(obj) },
  }
}

function makeFakeDb() {
  return {
    meta:           makeKeyTable('key'),
    deletedBundled: makeKeyTable('name'),
    userQuests:     makeKeyTable('short_title'),
    settings:       makeKeyTable('key'),
    responses:      makeAutoTable(),
    presets:        makeAutoTable(),
    async transaction(_mode, _tables, cb) { return cb() },
  }
}

function makeFakeLocalStorage(initial = {}) {
  const store = { ...initial }
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    _store: store,
  }
}

describe('db-migrate', () => {
  let fakeDb

  beforeEach(() => {
    jest.resetModules()
    fakeDb = makeFakeDb()
    jest.doMock('src/tools/db', () => ({ db: fakeDb }))
  })

  afterEach(() => {
    jest.dontMock('src/tools/db')
    delete global.localStorage
  })

  it('markiert fehlende Bundle-Bögen NICHT als gelöscht (Kern des Fixes)', async () => {
    // Alt-Blob enthält nur EINEN eigenen Bogen, KEINEN der gebündelten.
    global.localStorage = makeFakeLocalStorage({
      surveyBEST_QUESTS: JSON.stringify({
        myCustomQuest: { title: 'X', short_title: 'myCustomQuest', items: [] },
      }),
    })

    const { migrateFromLocalStorage } = require('src/tools/db-migrate')
    await migrateFromLocalStorage()

    const deleted = await fakeDb.deletedBundled.toArray()
    expect(deleted).toHaveLength(0) // NICHTS darf als gelöscht markiert sein

    const userQuests = await fakeDb.userQuests.toArray()
    expect(userQuests.map(q => q.short_title)).toContain('myCustomQuest')

    // Migration als erledigt markiert + Alt-Blob entfernt
    expect((await fakeDb.meta.get('migration')).done).toBe(true)
    expect(global.localStorage.getItem('surveyBEST_QUESTS')).toBeNull()
  })

  it('übernimmt explizite Löschungen aus surveyBEST_DELETED_BUNDLED', async () => {
    // Kein Alt-Blob, aber explizite (echte) Nutzer-Löschungen im neuen Format.
    global.localStorage = makeFakeLocalStorage({
      surveyBEST_DELETED_BUNDLED: JSON.stringify(['phq_9', 'ess']),
    })

    const { migrateFromLocalStorage } = require('src/tools/db-migrate')
    await migrateFromLocalStorage()

    const deleted = (await fakeDb.deletedBundled.toArray()).map(d => d.name)
    expect(deleted.sort()).toEqual(['ess', 'phq_9'])
  })

  it('repairDeletedBundled() leert die Liste einmalig und ist über Reloads idempotent', async () => {
    global.localStorage = makeFakeLocalStorage()
    // Vorzustand: fälschlich befüllte Liste
    await fakeDb.deletedBundled.bulkAdd([{ name: 'phq_9' }, { name: 'ess' }, { name: 'bfi' }])

    await require('src/tools/db-migrate').repairDeletedBundled()

    expect(await fakeDb.deletedBundled.toArray()).toHaveLength(0)
    expect((await fakeDb.meta.get('deletedBundled_repair_v1')).done).toBe(true)

    // Reload simulieren: frisches Modul (neuer Promise-Guard), gleiche DB.
    // Eine danach echte Nutzer-Löschung darf NICHT erneut geleert werden,
    // weil das meta-Flag die Reparatur dauerhaft sperrt.
    jest.resetModules()
    jest.doMock('src/tools/db', () => ({ db: fakeDb }))
    await fakeDb.deletedBundled.bulkAdd([{ name: 'spaeter_geloescht' }])
    await require('src/tools/db-migrate').repairDeletedBundled()
    expect((await fakeDb.deletedBundled.toArray()).map(d => d.name)).toEqual(['spaeter_geloescht'])
  })
})
