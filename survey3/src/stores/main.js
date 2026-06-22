import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { SETTINGS } from 'src/tools/settings'
import { STORAGE } from 'src/tools/Storage'
import { VISITMAN } from 'src/tools/visits/VisitMan'
import { QUESTMAN } from 'src/tools/questman'
import { Platform } from 'quasar'
import * as CDA from 'src/tools/CDA_H7_JSON'
import { log } from 'src/tools/Logger'
import { encrypt, verify } from 'src/tools/hhash'
import { sendMail } from 'src/tools/mail'
import { i18n } from 'src/boot/i18n'

// EINE QuestMan-Instanz appweit: das Modul-Singleton aus tools/questman.
// (Früher erzeugte der Store eine separate Instanz, die von den Tests
//  abwich.) QuestMan bleibt bewusst reaktiv-im-State — das Live-Ausfüllen
//  mutiert verschachtelte Item-Werte und braucht Pinias Tiefenreaktivität;
//  daher KEIN markRaw (anders als STORAGE/VISITMAN/SETTINGS). Siehe ARCHITECTURE.md.
//
// QUESTMAN.init() wird NICHT mehr hier beim Modulladen angestoßen, sondern im
// db-Boot-Default — erst NACH Migration/Reparatur (siehe boot/db.js). Sonst
// liefe init() in der Import-Phase los und läse die DB vor der Migration (Race,
// führte zu falscher Bogen-Anzahl beim ersten Laden).

// kompakter Zeitstempel YYYYMMDDHHmmss für Export-Dateinamen
function _stamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

export const useMainStore = defineStore('main', {
  state: () => ({
    ENV: {
      APP_NAME: process.env.APP_NAME,
      APP_VERSION: process.env.APP_VERSION,
      APP_UPDATED: process.env.APP_UPDATED,
    },
    leftDrawerOpen: true,
    QuestMan: QUESTMAN,
    // markRaw: diese Singletons verwalten ihre reaktiven Daten selbst
    // (Storage/VisitMan via interner reactive([])-Arrays, Settings via
    //  reaktivem _DATA). Pinia soll die Klasseninstanzen NICHT zusätzlich
    //  tief proxyen (Methoden, Settings._USER.keyPair = CryptoKeys u. Ä.).
    STORAGE: markRaw(STORAGE),
    VISITMAN: markRaw(VISITMAN),
    SETTINGS: markRaw(SETTINGS),
    debug: false,
    PROTECTED_MODE: false,
    editquest: undefined,
    EXPORT_DATA: [],
  }),

  getters: {
    ACTIVE_QUEST_LABEL(state) {
      if (state.QuestMan.activeQuest === undefined) return undefined
      if (state.QuestMan.activeQuest.label === undefined) return undefined
      return state.QuestMan.activeQuest.label
    },
    ACTIVE_QUEST(state) {
      if (state.QuestMan.activeQuest === undefined) return undefined
      if (state.QuestMan.activeQuest.value === undefined) return undefined
      return state.QuestMan.activeQuest.value
    },
    QUEST_LIST(state) {
      return state.QuestMan.quest_list
    },
    QUESTMAN(state) {
      return state.QuestMan
    },
    PRESET_STORE(state) {
      return state.STORAGE.get_presets()
    },
    DEBUG_MODE(state) {
      return state.debug
    },
    // --- Patienten/Visiten ---
    VISIT_MAN(state) {
      return state.VISITMAN
    },
    PATIENTS(state) {
      return state.VISITMAN.patients
    },
    VISIT_TEMPLATES(state) {
      return state.VISITMAN.templates
    },
    VISITS(state) {
      return state.VISITMAN.visits
    },
  },

  actions: {
    // --- mutations turned into actions ---
    setProtectedMode(payload) {
      this.PROTECTED_MODE = payload
    },
    presetStore(payload) {
      this.STORAGE.add_presets(payload)
    },
    presetUpdate(payload) {
      this.STORAGE.update_presets(payload)
    },
    presetDelete(payload) {
      this.STORAGE.delete_presets(payload)
    },
    presetLoad() {
      this.STORAGE.load_presets()
    },
    presetClear() {
      this.STORAGE.clear_presets()
    },
    exportClear() {
      log({ debug: 'mutation: EXPORT_CLEAR' })
      this.EXPORT_DATA = []
    },
    storageLoad() {
      log({ debug: 'mutation: STORAGE_LOAD' })
      this.STORAGE.load()
    },
    storageAdd(payload) {
      log({ debug: 'mutation: STORAGE_ADD' })
      this.STORAGE.add(payload)
    },
    storageRemove(payload) {
      log({ debug: 'mutation: STORAGE_ADD' })
      this.STORAGE.remove(payload)
    },
    settingsSet(payload) {
      log({ debug: 'mutation: SETTINGS_SET', data: JSON.stringify(payload) })
      this.SETTINGS.set(payload)
    },

    // --- original Vuex actions ---
    loadNextQuest() {
      // original committed QUEST_LOAD_NEXT — that mutation doesn't exist in the codebase,
      // so this is a no-op placeholder kept for dispatch compatibility
    },
    storage_add(payload) {
      // Einzelbogen-Response optional an einen vorhandenen Patienten koppeln
      // (Auto-Link über die PID; kein Patient gefunden → null). Additiv, kein UI.
      const patient = this.VISITMAN.get_patient_by_pid(payload.PID)
      const document = CDA.import_quest({
        data: {
          PID: payload.PID,
          patientId: patient ? patient.id : null,
          quest: payload.quest,
        },
        investigator: {
          uid: this.SETTINGS.user_uid,
          keyPair: this.SETTINGS.user_keyPair,
        },
      })
      this.storageAdd(document)
    },
    storage_add_from_file(payload) {
      return new Promise((res, rej) => {
        // Mindest-Schema eines importierbaren CDA-Dokuments
        if (!payload || payload.cda === undefined || payload.hash === undefined || !payload.info) {
          log({ error: 'import fehlgeschlagen: ungültiges Dokument', data: payload })
          rej(false)
          return
        }
        this.storageAdd(payload)
        res(true)
      })
    },
    storage_encrypted_export(payload) {
      log({ debug: 'storage_encrypted_export' })
      var document = payload.document
      if (document === undefined) document = this.STORAGE.get(-1)
      const publicKey = payload.pubKey
      if (document === undefined) return log({ error: 'storage_encrypted_export: no cda found' })
      if (publicKey === undefined) return log({ error: 'storage_encrypted_export: no publicKey found' })

      const enc = encrypt(JSON.stringify(document), publicKey)
      const filename = this.STORAGE._create_filename(document, 'json')
      const status = this.STORAGE._export_file(filename, JSON.stringify(enc))

      this.EXPORT_DATA.push({
        enc: enc,
        filename: filename,
        email: payload.email,
      })

      return status
    },
    mail_exported_data() {
      log({ debug: 'mail_exported_data' })
      return new Promise((resolve, reject) => {
        const data = this.EXPORT_DATA
        if (!data || data.length < 1) return reject(false)

        const message = {
          email: data[0].email,
          data: [],
        }

        data.forEach((d) => message.data.push(d.enc))

        log({ debug: 'mail_exported_data', data: message })

        sendMail(message)

        this.exportClear()
        return resolve(true)
      })
    },
    verify_quest_signature(payload) {
      return new Promise((resolve, reject) => {
        if (payload === undefined || payload.cda === undefined || payload.hash === undefined) reject('invalid data')
        const isverified = verify(payload.cda, payload.hash)
        if (!isverified) reject('could not verify document')
        resolve('document is valid')
      })
    },
    storage_update(payload) {
      this.STORAGE.update(payload)
    },
    storage_load() {
      this.STORAGE.load()
    },
    storage_save() {
      this.STORAGE.save()
    },
    storage_clear() {
      this.STORAGE.clear()
    },
    storage_export(payload) {
      log({ debug: 'action: storage_export', data: payload })
      const t = i18n.global.t
      if (Platform.is.cordova)
        return this.STORAGE.export_cordova(payload, {
          email: this.SETTINGS.email_export,
          subject: t('email.subject'),
          body: t('email.body'),
          export_format: this.SETTINGS.export_format,
        })
      if (Platform.is.desktop || Platform.is.ios)
        return this.STORAGE.export_tofile(payload, { export_format: this.SETTINGS.export_format })
    },

    // --- Patienten/Visiten Export (app2-importStructure JSON) ---
    exportVisit(visitId) {
      const data = this.VISITMAN.build_visit_export(visitId, undefined, {
        providerId: this.SETTINGS.user_uid,
      })
      if (data === undefined) return false
      const pid = (data.metadata.patientIds[0] || 'patient').replace(/[^a-zA-Z0-9_-]/g, '_')
      const filename = `survey3_visit_${pid}_${_stamp()}.json`
      const ok = this.STORAGE._export_file(filename, JSON.stringify(data, null, 2))
      if (ok) this.VISITMAN.mark_exported(visitId)
      return ok
    },
    exportPatient(patientId) {
      const data = this.VISITMAN.build_patient_export(patientId, undefined, {
        providerId: this.SETTINGS.user_uid,
      })
      if (data === undefined) return false
      const pid = (data.metadata.patientIds[0] || 'patient').replace(/[^a-zA-Z0-9_-]/g, '_')
      const filename = `survey3_patient_${pid}_${_stamp()}.json`
      return this.STORAGE._export_file(filename, JSON.stringify(data, null, 2))
    },

    // --- preset actions (thin wrappers kept for dispatch compat) ---
    updatePreset(payload) {
      this.presetUpdate(payload)
    },
    storePreset(payload) {
      this.presetStore(payload)
    },
    deletePreset(payload) {
      this.presetDelete(payload)
    },
    savePreset() {
      // original committed PRESET_SAVE — not in mutations, no-op
    },
    loadPreset() {
      this.presetLoad()
    },
    clearPreset() {
      this.presetClear()
    },
  },
})
