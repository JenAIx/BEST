import { db } from './db'
import { log } from './Logger'

const LS_KEYS = {
  storage:        'surveyBEST_STORAGE',
  presets:        'surveyBEST_PRESETS',
  settings:       'surveyBEST_SETTINGS',
  userQuests:     'surveyBEST_USER_QUESTS',
  deletedBundled: 'surveyBEST_DELETED_BUNDLED',
  legacy:         'surveyBEST_QUESTS',
}

function safeParse(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch (e) {
    log({ error: `db-migrate: failed to parse ${key}`, data: e })
    return null
  }
}

export async function migrateFromLocalStorage() {
  // Check if migration already done
  const flag = await db.meta.get('migration')
  if (flag && flag.done) return

  // Check if there's any localStorage data to migrate
  const hasData = Object.values(LS_KEYS).some(k => localStorage.getItem(k) !== null)
  if (!hasData) {
    // No localStorage data — mark as done (fresh install)
    await db.meta.put({ key: 'migration', done: true })
    return
  }

  log({ debug: 'db-migrate: starting migration from localStorage' })

  try {
    await db.transaction('rw', [db.responses, db.presets, db.settings, db.userQuests, db.deletedBundled, db.meta], async () => {
      // --- Migrate legacy quest key first (old format → split keys) ---
      const legacyQuests = safeParse(LS_KEYS.legacy)
      if (legacyQuests && typeof legacyQuests === 'object') {
        // Import questionnaire JSON files to identify bundled quests
        const questModules = import.meta.glob('/src/assets/questionnaires/quest_*.json', { eager: true })
        const bundledQuests = {}
        for (const [, mod] of Object.entries(questModules)) {
          const json = mod.default || mod
          if (json && json.short_title) bundledQuests[json.short_title] = json
        }

        for (const [name, quest] of Object.entries(legacyQuests)) {
          if (bundledQuests[name]) {
            if (JSON.stringify(quest) !== JSON.stringify(bundledQuests[name])) {
              await db.userQuests.put({ short_title: name, data: quest })
            }
          } else {
            await db.userQuests.put({ short_title: name, data: quest })
          }
        }

        for (const name of Object.keys(bundledQuests)) {
          if (!(name in legacyQuests)) {
            await db.deletedBundled.put({ name })
          }
        }
      }

      // --- Migrate responses ---
      const responses = safeParse(LS_KEYS.storage)
      if (Array.isArray(responses) && responses.length > 0) {
        await db.responses.bulkAdd(responses)
      }

      // --- Migrate presets ---
      const presets = safeParse(LS_KEYS.presets)
      if (Array.isArray(presets) && presets.length > 0) {
        await db.presets.bulkAdd(presets)
      }

      // --- Migrate settings ---
      const settings = safeParse(LS_KEYS.settings)
      if (settings && typeof settings === 'object') {
        await db.settings.put({ key: 'main', ...settings })
      }

      // --- Migrate user quests (new split format, if legacy didn't exist) ---
      if (!legacyQuests) {
        const userQuests = safeParse(LS_KEYS.userQuests)
        if (userQuests && typeof userQuests === 'object') {
          for (const [name, quest] of Object.entries(userQuests)) {
            await db.userQuests.put({ short_title: name, data: quest })
          }
        }

        const deletedBundled = safeParse(LS_KEYS.deletedBundled)
        if (Array.isArray(deletedBundled)) {
          for (const name of deletedBundled) {
            await db.deletedBundled.put({ name })
          }
        }
      }

      // --- Mark migration as done ---
      await db.meta.put({ key: 'migration', done: true })
    })

    // Remove localStorage keys after successful migration
    for (const key of Object.values(LS_KEYS)) {
      localStorage.removeItem(key)
    }
    log({ debug: 'db-migrate: migration complete, localStorage keys removed' })
  } catch (e) {
    log({ error: 'db-migrate: migration failed, localStorage left intact', data: e })
  }
}
