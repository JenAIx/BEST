import { boot } from 'quasar/wrappers'
import { migrateFromLocalStorage } from 'src/tools/db-migrate'
import { STORAGE } from 'src/tools/Storage'
import { SETTINGS } from 'src/tools/settings'
import { QuestMan } from 'src/tools/questman'

export default boot(async () => {
  await migrateFromLocalStorage()
  await SETTINGS.init()
  await STORAGE.init()
  // QuestMan instances are created per-store, init is called there
})

// Export an init helper for QuestMan instances
export async function initQuestMan(qm) {
  await qm.init()
}
