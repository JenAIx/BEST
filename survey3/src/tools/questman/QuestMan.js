import { log } from '../Logger'
import { RANDOM, RANDOMWORD } from './helpers'
import { calc_results, evaluate } from './scoring'

// Eagerly load all questionnaire JSON files via Vite's glob import
const questModules = import.meta.glob('/src/assets/questionnaires/quest_*.json', { eager: true })

function loadQuestJson(name) {
  const key = `/src/assets/questionnaires/quest_${name}.json`
  const mod = questModules[key]
  if (!mod) return undefined
  return mod.default || mod
}

export class QuestMan {
  _QUESTS = undefined
  _activeQuest = undefined
  _presets = []
  _fieldname = 'surveyBEST_QUESTS'

  constructor(payload) {
    if (!payload) return log({ debug: "QuestMan>constructor: no payload" })
    log({ debug: 'QuestMan initializing ...' })
    if (payload && payload.init === false) {
      //no init
    }
    else {
      if (payload.QUESTS) this._LIST_QUESTS = payload.QUESTS
      this._load()
    }
  }

  _load(QUESTS) {
    log({ debug: 'load quest' })
    const data = JSON.parse(localStorage.getItem(this._fieldname))
    if (data === null || data === undefined) return this._init(QUESTS)
    this._QUESTS = data
  }

  _save() {
    log({ debug: 'save quest' })
    localStorage.setItem(this._fieldname, JSON.stringify(this._QUESTS))
  }

  _init() {
    log({ debug: 'init quest' })
    this._QUESTS = {}
    const quests = this._LIST_QUESTS()
    quests.forEach(q => {
      try {
        let Q = loadQuestJson(q)
        if (Q) this._add(Q)
        else log({ warn: `QuestMan>_init: quest_${q}.json not found` })
      } catch (e) {
        log({ error: "QuestMan>_init", data: e })
      }
    })
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
    if (list.length === 0) return undefined
    return list
  }

  get(label) {
    if (label === undefined) return this._QUESTS
    return this._QUESTS[label]
  }

  _add(quest) {
    this._QUESTS[quest.short_title] = quest
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
    if (index < 0 || index > this._QUESTS.length) return false
    const quest = this.quest_list[index]
    log({ debug: 'remove quest: ' + quest })
    delete this._QUESTS[quest]
    this._save()
  }

  remove_by_name(name) {
    if (!this.quest_list.includes(name)) return false
    delete this._QUESTS[name]
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

  check_activeQuest() {
    if (this.activeQuest === undefined) return undefined

    const index = []

    this.activeQuest.value.items.forEach(item => {
      if (item.force === false) index.push(true)
      else if (item.type === 'textbox' || item.type === 'seperator' || item.type === undefined) index.push(null)
      else if (item.type === 'multiple_radio') {
        if (item.value === undefined || item.value === null) index.push(false)
        else {
          let ISVALID = true
          item.value.forEach(val => {
            if (val === undefined || val === null) ISVALID = false
          })
          index.push(ISVALID)
        }
      }
      else if (item.value !== undefined && item.value !== null) index.push(true)
      else index.push(false)
    })

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
