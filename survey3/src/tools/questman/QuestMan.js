import { log } from '../Logger'
import { RANDOM, RANDOMWORD } from './helpers'
import { calc_results, evaluate } from './scoring'
import { itemValidity } from '../visits/visit-model'
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

  add(quest_txt) {
    if (quest_txt === null || quest_txt === undefined) return log({ error: "QuestMan>add", data: "no valid data" })
    var json = undefined
    try {
      json = JSON.parse(quest_txt)
    } catch (e) {
      log({ error: "QuestMan>add", data: e })
      return false
    }

    if (json.items === undefined || json.title === undefined || json.short_title === undefined) return log({ error: "QuestMan>add", data: "no valid data" })
    this._add(json)
    this._save()
    return true
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
    if (this.quest_list.includes(val)) this._presets.push(val)
  }

  clear_preset() {
    this._presets = []
    this._activeQuest = undefined
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

    const result = {}
    result.label = this.activeQuest.value.short_title
    result.title = this.activeQuest.value.title
    result.items = [],
      this.activeQuest.value.items.forEach(item => {

        if (item.value !== undefined && item.value !== null) {
          if (item.type === 'number' && typeof (item.value) === 'string') item.value = parseFloat(item.value)
          else if (item.type === 'multiple_radio' && Array.isArray(item.value)) {
            for (let i = 0; i < item.value.length; i++) {

              let tmp_item = {
                tag: undefined,
                value: item.value[i],
                coding: item.options.questions[i].coding
              }
              if (item.tag !== undefined) tmp_item.tag = `${item.tag}_${item.options.questions[i].tag}`
              else tmp_item.tag = item.options.questions[i].tag

              if (item.options.questions[i].id !== undefined) tmp_item.id = item.options.questions[i].id
              this.push_result(result, tmp_item, item.ignore_for_result)
            }
          } else this.push_result(result, item, item.ignore_for_result)
        }
      })
    // results
    result.results = calc_results(result, this.activeQuest.value.results)
    result.coding = this.activeQuest.value.coding

    // evaluation
    if (this.activeQuest.value.results !== undefined && this.activeQuest.value.results.evaluation !== undefined) result.results = evaluate(result.results, this.activeQuest.value.results.evaluation)

    // dates
    result.date_start = this.activeQuest.date_start
    result.date_end = Date.now()
    log({ debug: 'summary: finished' })
    return result
  }

  push_result(result, item, ignore_for_result) {
    let tmp = {
      label: item.tag,
      value: item.value,
      coding: item.coding
    }
    if (tmp.coding !== undefined) tmp.label = tmp.coding.display
    if (item.id !== undefined) tmp.id = item.id
    if (ignore_for_result !== undefined) tmp.ignore_for_result = item.ignore_for_result
    result.items.push(tmp)
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
        case 'seperator':
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
