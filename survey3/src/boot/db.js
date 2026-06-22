import { boot } from 'quasar/wrappers'
import { migrateFromLocalStorage, repairDeletedBundled } from 'src/tools/db-migrate'
import { STORAGE } from 'src/tools/Storage'
import { SETTINGS } from 'src/tools/settings'
import { VISITMAN } from 'src/tools/visits/VisitMan'
import { QUESTMAN } from 'src/tools/questman'

export default boot(async () => {
  // Reihenfolge ist kritisch: Migration und Reparatur MÜSSEN abgeschlossen sein,
  // bevor QUESTMAN.init() die deletedBundled-/userQuests-Tabellen liest. Früher
  // stieß der Store das init() bereits beim Modulladen an (Import-Phase, vor dem
  // Boot-Default) — dadurch las init() die noch nicht migrierten/reparierten
  // Tabellen und zeigte beim ersten Laden eine falsche Bogen-Anzahl (Race).
  await migrateFromLocalStorage()
  await repairDeletedBundled()
  await initQuestMan(QUESTMAN)
  await SETTINGS.init()
  await STORAGE.init()
  await VISITMAN.init()
})

// Init-Helper für das QUESTMAN-Singleton (lädt User-/gelöschte Bundled-Quests).
// Wird ausschließlich hier im Boot-Default aufgerufen — NICHT mehr beim
// Store-Modulladen — damit Migration/Reparatur garantiert vorher laufen.
export async function initQuestMan(qm) {
  await qm.init()
}
