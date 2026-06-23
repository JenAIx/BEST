import { log } from '../Logger'
import { RANDOM, RANDOMWORD } from './helpers'
import { calc_results, evaluate } from './scoring'
import { buildResultItems } from './result-items'
import { itemValidity } from '../visits/visit-model'
import { validateQuestScoring } from './validate'
import { db } from '../db'

// Eagerly load all questionnaire JSON files via Vite's glob import
const questModules = import.meta.glob('/src/assets/questionnaires/quest_*.json', { eager: true })

function getAllBundledQuests() {
  const quests = {}
  for (const [path, mod] of Object.entries(questModules)) {
    const json = mod.default || mod
    if (json && json.short_title) {
      quests[json.short_title] = json
    }
  }
  return quests
}

export class QuestMan {
  _bundledQuests = {}
  _userQuests = {}
  _deletedBundled = []
  _QUESTS = {}
  _activeQuest = undefined
  _presets = []
  // Gesamtzahl der in die aktuelle Kette aufgenommenen Bögen. _presets wird beim
  // next() per shift() geleert; dieser Zähler bleibt erhalten, damit die UI die
  // globale Position ("Bogen X von Y") anzeigen kann.
  _presetTotal = 0

  constructor() {
    log({ debug: 'QuestMan initializing ...' })
    this._bundledQuests = getAllBundledQuests()
    this._rebuild()
  }

  async init() {
    log({ debug: 'QuestMan>init: loading from IndexedDB' })

    // Load user quests
    try {
      const rows = await db.userQuests.toArray()
      const userQuests = {}
      for (const row of rows) {
        userQuests[row.short_title] = row.data
      }
      this._userQuests = userQuests
    } catch (e) {
      log({ error: 'QuestMan>init: failed to load user quests', data: e })
      this._userQuests = {}
    }

    // Load deleted bundled list
    try {
      const rows = await db.deletedBundled.toArray()
      this._deletedBundled = rows.map(r => r.name)
    } catch (e) {
      log({ error: 'QuestMan>init: failed to load deleted bundled', data: e })
      this._deletedBundled = []
    }

    this._rebuild()
  }

  _rebuild() {
    const merged = {}
    // Start with bundled quests
    for (const [name, quest] of Object.entries(this._bundledQuests)) {
      if (!this._deletedBundled.includes(name)) {
        merged[name] = quest
      }
    }
    // Add user quests (overrides bundled if same name)
    for (const [name, quest] of Object.entries(this._userQuests)) {
      merged[name] = quest
    }
    this._QUESTS = merged
  }

  _save() {
    log({ debug: 'save quest' })
    // Fire-and-forget write to IndexedDB
    Promise.all([
      db.userQuests.clear().then(() =>
        db.userQuests.bulkAdd(
          Object.entries(this._userQuests).map(([name, quest]) => ({ short_title: name, data: quest }))
        )
      ),
      db.deletedBundled.clear().then(() =>
        db.deletedBundled.bulkAdd(
          this._deletedBundled.map(name => ({ name }))
        )
      ),
    ]).catch(e => {
      log({ error: 'QuestMan>_save: IndexedDB write failed', data: e })
    })
    this._rebuild()
  }

  _init() {
    log({ debug: 'init quest — reset to defaults' })
    this._userQuests = {}
    this._deletedBundled = []
    this._save()
  }

  //   QUEST FUNCTIONS
  get quest_list() {
    return Object.keys(this._QUESTS);
  }

  quest_list_filtered(filter_value) {
    const list = []
    Object.keys(this._QUESTS).forEach(key => {
      let value = this.get(key)
      if (filter_value === null) list.push(key)
      else if (value.keywords !== null && value.keywords !== undefined && value.keywords.toLowerCase().includes(filter_value.toLowerCase())) list.push(key)
      else if (value.description !== null && value.description !== undefined && value.description.toLowerCase().includes(filter_value.toLowerCase())) list.push(key)
      else if (value.title.toLowerCase().includes(filter_value.toLowerCase())) list.push(key)
    })
    if (list.length === 0) return []
    return list
  }

  get(label) {
    if (label === undefined) return this._QUESTS
    return this._QUESTS[label]
  }

  _add(quest) {
    this._userQuests[quest.short_title] = quest
  }

  // Importiert/speichert einen Fragebogen aus JSON-Text. Liefert ein Ergebnis
  // { ok, errors }: bei ungültigem JSON, fehlenden Pflichtfeldern oder
  // Schema-Fehlern (validateQuestScoring) wird NICHT gespeichert. Warnungen
  // (z. B. fehlende Teilfragen-id) blockieren den Import bewusst nicht.
  add(quest_txt) {
    if (quest_txt === null || quest_txt === undefined) {
      log({ error: 'QuestMan>add', data: 'no valid data' })
      return { ok: false, errors: ['Keine Daten übergeben.'] }
    }
    var json = undefined
    try {
      json = JSON.parse(quest_txt)
    } catch (e) {
      log({ error: 'QuestMan>add', data: e })
      return { ok: false, errors: ['Ungültiges JSON: ' + e.message] }
    }

    if (json.items === undefined || json.title === undefined || json.short_title === undefined) {
      log({ error: 'QuestMan>add', data: 'no valid data' })
      return { ok: false, errors: ['Pflichtfelder fehlen (title, short_title, items).'] }
    }

    const { errors } = validateQuestScoring(json)
    if (errors.length) {
      log({ error: 'QuestMan>add: Schema-Fehler', data: errors })
      return { ok: false, errors: errors.map((e) => `${e.code}: ${e.msg}`) }
    }

    this._add(json)
    this._save()
    return { ok: true, errors: [] }
  }

  remove_by_index(index) {
    const names = Object.keys(this._QUESTS)
    if (index < 0 || index >= names.length) return false
    const name = names[index]
    log({ debug: 'remove quest: ' + name })
    this.remove_by_name(name)
  }

  remove_by_name(name) {
    if (!this.quest_list.includes(name)) return false
    if (name in this._userQuests) {
      delete this._userQuests[name]
    }
    if (name in this._bundledQuests && !this._deletedBundled.includes(name)) {
      this._deletedBundled.push(name)
    }
    this._save()
  }

  // ACTIVE QUEST
  set activeQuest(label) {
    if (!this.quest_list.includes(label) || label === undefined) this._activeQuest = undefined
    else this._activeQuest = {
      label: label,
      value: JSON.parse(JSON.stringify(this.get(label))),
      date_start: Date.now()
    }
  }

  get activeQuest() {
    return this._activeQuest
  }

  next() {
    this.activeQuest = this.next_preset
    if (this.activeQuest === undefined) return false
    return true
  }

  reset_activeQuest() {
    if (this.activeQuest === undefined) return false
    this._activeQuest.value = JSON.parse(JSON.stringify(this.get(this._activeQuest.label)))
    return true
  }

  // Überlagert gespeicherte Entwurfs-Werte (indexgenau) auf den aktiven Quest.
  // values: Array roher item.value-Einträge, ausgerichtet an items-Reihenfolge.
  restore_active_values(values) {
    if (this.activeQuest === undefined) return false
    if (!Array.isArray(values)) return false
    const items = this.activeQuest.value.items
    const n = Math.min(items.length, values.length)
    for (let i = 0; i < n; i++) {
      if (values[i] !== undefined) items[i].value = values[i]
    }
    return true
  }

  check_activeQuest() {
    if (this.activeQuest === undefined) return undefined
    // Per-Item-Logik liegt zentral in itemValidity (geteilt mit requiredFieldStats).
    const index = this.activeQuest.value.items.map(item => itemValidity(item))
    if (index.includes(false)) return index
    else return true
  }

  // LIST OF MULTIPLE QUESTS TO PROCESS
  get presets() {
    return this._presets
  }

  set presets(value) {
    if (value === undefined) return
    if (!Array.isArray(value)) return this.add_preset(value)
    value.forEach(val => this.add_preset(val))
  }

  add_preset(val) {
    if (val === undefined) return
    if (this.quest_list.includes(val)) {
      this._presets.push(val)
      this._presetTotal++
    }
  }

  clear_preset() {
    this._presets = []
    this._presetTotal = 0
    this._activeQuest = undefined
  }

  // Gesamtzahl der Bögen in der aktuellen Kette (0, wenn keine Kette aktiv).
  get preset_total() {
    return this._presetTotal
  }

  // 1-basierte Position des aktuell geladenen Bogens in der Kette. next() nimmt
  // per shift() einen Bogen aus _presets; entsprechend ist die Position
  // total − verbleibende. Vor dem ersten next() ist sie 0.
  get preset_index() {
    return this._presetTotal - this._presets.length
  }

  get next_preset() {
    if (this._presets.length === 0) return undefined
    const result = this._presets[0]
    this._presets.shift()
    return result
  }

  // RESULTS
  get summary() {
    log({ debug: 'summary: start' })
    if (this.activeQuest === undefined) return undefined

    const quest = this.activeQuest.value
    const result = {
      label: quest.short_title,
      title: quest.title,
      items: buildResultItems(quest.items),
    }

    // Scoring + optionale Bereichs-Bewertung
    result.results = calc_results(result, quest.results)
    result.coding = quest.coding
    if (quest.results !== undefined && quest.results.evaluation !== undefined) {
      result.results = evaluate(result.results, quest.results.evaluation)
    }

    // dates
    result.date_start = this.activeQuest.date_start
    result.date_end = Date.now()
    log({ debug: 'summary: finished' })
    return result
  }

  // RANDOM FILL THE ACTIVE QUEST
  random_fill() {
    if (this.activeQuest === undefined) return undefined

    var complete = true

    this.activeQuest.value.items.forEach(item => {
      switch (item.type) {
        case 'checkbox':
          let rndValueCheck = []
          for (let i = 0; i < item.options.length - 1; i++) {
            if (RANDOM(1) === 1) rndValueCheck.push(item.options[i].value)
          }
          item.value = rndValueCheck
          break
        case 'radio':
          let rndNum = RANDOM(item.options.length - 1)
          let rndValue = item.options[rndNum].value
          item.value = rndValue
          break

        case 'multiple_radio':
          const val = []
          item.options.questions.forEach(quest => {
            let rndNum = RANDOM(item.options.answers.length - 1)
            val.push(item.options.answers[rndNum].value)
          })
          item.value = val
          break

        case 'number':
          item.value = RANDOM(100)
          break

        case 'slider':
          item.value = 0
          break

        case 'text':
          item.value = RANDOMWORD()
          break

        case undefined:
        case 'separator':
        case 'textbox':
          break

        case 'date':
          item.value = '01.01.1970'
          break

        case 'date_year':
          item.value = '1970'
          break

        case 'time':
          item.value = '12:00'
          break

        default:
          log({ warn: `random fill: item type: ${item.type} not supported`, data: item })
          complete = false
          break
      }
    })

    return complete
  }

  //   SIMPLE CHECK
  check() {
    return true
  }
}
