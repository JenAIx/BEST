// #1 Einzelbogen-Responses an Patienten koppeln (Auto-Link über PID).
// Prüft (a) das CDA-Info-Mapping und (b) das Store-Wiring (get_patient_by_pid).
import { setActivePinia, createPinia } from 'pinia'
import * as CDA from '../../../src/tools/CDA_H7_JSON'
import { USER } from '../../../src/tools/User'
import { QUESTMAN } from '../../../src/tools/questman'

function makeQuestSummary() {
  QUESTMAN.activeQuest = 'mrs'
  QUESTMAN.random_fill()
  return QUESTMAN.summary
}

describe('import_quest: info.patientId-Mapping', () => {
  beforeAll(() => USER.create())

  test('übernimmt data.patientId in info.patientId', () => {
    const doc = CDA.import_quest({
      data: { PID: 'P1', patientId: 'uuid-123', quest: makeQuestSummary() },
      investigator: { uid: USER.uid, keyPair: USER.keyPair },
    })
    expect(doc.info.patientId).toBe('uuid-123')
  })

  test('ohne patientId → null (nicht undefined)', () => {
    const doc = CDA.import_quest({
      data: { PID: 'P1', quest: makeQuestSummary() },
      investigator: { uid: USER.uid, keyPair: USER.keyPair },
    })
    expect(doc.info.patientId).toBeNull()
  })
})

describe('storage_add: Auto-Link über vorhandenen Patienten', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    USER.create()
  })

  test('Patient mit passender PID existiert → info.patientId = patient.id', async () => {
    const { useMainStore } = await import('../../../src/stores/main')
    const store = useMainStore()
    const patient = store.VISITMAN.add_patient('LINKME')

    store.storage_add({ PID: 'LINKME', quest: makeQuestSummary() })
    const list = store.STORAGE.get()
    const added = list[list.length - 1]
    expect(added.info.PID).toBe('LINKME')
    expect(added.info.patientId).toBe(patient.id)
  })

  test('keine passende PID → info.patientId = null', async () => {
    const { useMainStore } = await import('../../../src/stores/main')
    const store = useMainStore()
    store.storage_add({ PID: 'UNBEKANNT', quest: makeQuestSummary() })
    const list = store.STORAGE.get()
    const added = list[list.length - 1]
    expect(added.info.patientId).toBeNull()
  })
})
