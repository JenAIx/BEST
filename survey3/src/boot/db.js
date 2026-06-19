import { boot } from 'quasar/wrappers'
import { migrateFromLocalStorage } from 'src/tools/db-migrate'
import { STORAGE } from 'src/tools/Storage'
import { SETTINGS } from 'src/tools/settings'
import { VISITMAN } from 'src/tools/visits/VisitMan'

export default boot(async () => {
  await migrateFromLocalStorage()
  await SETTINGS.init()
  await STORAGE.init()
  await VISITMAN.init()
  // Das QUESTMAN-Singleton wird im Store eingebunden und dort via
  // initQuestMan() initialisiert (siehe stores/main.js).
})

// Init-Helper für das QUESTMAN-Singleton (lädt User-/gelöschte Bundled-Quests).
export async function initQuestMan(qm) {
  await qm.init()
}
