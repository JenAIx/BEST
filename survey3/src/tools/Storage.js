import { exportFile } from 'quasar'
import { write_csv } from './ccordova.js'
import { uuidv4 } from 'src/tools/hhash'
import { log } from './Logger.js'

import dateFormat from 'dateformat'

class Storage {

  _STORAGE = []
  _PRESETS = []
  _fieldname = 'surveyBEST_STORAGE'
  _fieldname_presets = 'surveyBEST_PRESETS'
  _errors = []

  constructor() {
    log({ debug: 'storage & presets' })
  }

  // PRESETS
  get_presets() {
    return this._PRESETS
  }

  save_presets() {
    log({ debug: 'save presets' })
    localStorage.setItem(this._fieldname_presets, JSON.stringify(this._PRESETS))
  }

  load_presets() {
    log({ debug: 'load presets' })
    // STORAGE
    let data
    try {
      data = JSON.parse(localStorage.getItem(this._fieldname_presets))
    } catch (e) {
      log({ error: 'Storage>load_presets: failed to parse presets', data: e })
      return false
    }
    if (data === null || data === undefined) return false
    this._PRESETS = data
  }

  clear_presets() {
    log({ debug: 'clear presets' })
    this._PRESETS = [];
    localStorage.removeItem(this._fieldname_presets)
  }

  add_presets(payload) {
    log({ debug: 'add preset', data: payload })
    this._PRESETS.push({ 'label': payload.label, 'value': payload.value })
    this.save_presets()
  }

  update_presets(payload) {
    log({ debug: 'update_presets', data: payload.value })
    this._PRESETS[payload.index] = payload.value
    this.save_presets()
  }

  delete_presets(payload) {
    this._PRESETS.splice(payload, 1)
    this.save_presets()
  }

  // ERROR
  get error() {
    const err = this._errors.pop()
    return err
  }

  set error(val) {
    this._errors.push(val)
  }


  // STORAGE

  add(payload) {
    if (payload.cda === undefined || payload.exported === undefined || payload.hash === undefined) return log({ error: 'Storage>add: payload not valid!', data: payload })
    // else
    log({ debug: 'Storage>add', data: `size: ${JSON.stringify(payload).length} bytes` })
    if (payload.info.uid === undefined) payload.info.uid = uuidv4()
    this.load() //load storage first before loading, make sure no changes are lost
    this._STORAGE.push(payload)

    this.save()
  }

  get(index) {
    if (index === null || index === undefined) return this._STORAGE
    if (index === -1) index = this._STORAGE.length - 1
    if (index < 0 || index > this._STORAGE.length) return undefined
    log({ debug: 'Storage>get', data: `size: ${JSON.stringify(this._STORAGE[index]).length} bytes` })
    return this._STORAGE[index]
  }

  get_by_uid(uid) {
    if (!uid) return undefined
    var val = undefined
    for (let i = 0; i < this._STORAGE.length; i++) {
      if (this._STORAGE[i].info.uid === uid) return this._STORAGE[i]
    }
    return val
  }

  remove(uid) {
    for (let i = 0; i < this._STORAGE.length; i++) {
      if (this._STORAGE[i].info.uid === uid) {
        this._STORAGE.splice(i, 1)
        this.save()
      }
    }

  }

  update() {
    log({ debug: 'Storage>update' })
    this.save()
  }

  save() {
    log({ debug: 'Storage>save' })
    localStorage.setItem(this._fieldname, JSON.stringify(this._STORAGE))
  }

  load() {
    log({ debug: 'Storage>load' })
    // STORAGE
    let data
    try {
      data = JSON.parse(localStorage.getItem(this._fieldname))
    } catch (e) {
      log({ error: 'Storage>load: failed to parse storage', data: e })
      return false
    }
    if (data === null || data === undefined) return false
    data.forEach(d => {
      if (d.info.uid === undefined) d.info.uid = uuidv4() //added to support a UID for each entry
    })
    this._STORAGE = data
  }

  clear() {
    log({ debug: 'Storage>clear' })
    this._STORAGE = [];
    localStorage.removeItem(this._fieldname)
  }

  //* EXPORT FUNCTIONS

  // GENERAL EXPORT FUNTIONS

  async export_tofile(uid, payload) {
    // first check the data
    if (uid === null || uid === undefined) return false
    // now prepare a job
    const job = this._prepare_job(uid) //this will return an array with all indices

    // now loob through the job
    var status = false
    var export_format = payload.export_format || 'html'
    for (let i = 0; i < job.length; i++) {
      await sleep(1000)//break is necessary for the exportFile routine to work properly

      let DOCUMENT = this.get(job[i])
      log({ debug: 'exportiere: ', data: DOCUMENT.info.uid })
      let filename = prepare_filename(DOCUMENT, export_format)
      if (filename !== undefined) {

        let DATA = prepare_export_data(DOCUMENT, export_format)
        status = exportFile(filename, DATA)
        if (status) this._STORAGE[job[i]].exported = true
      }
    }

    log({ debug: 'export_tofile', data: status })
    this.save()
    return status
  }

  _prepare_job(uid) {
    const job = []
    uid.forEach(id => {
      for (let i = 0; i < this._STORAGE.length; i++) {
        if (this._STORAGE[i].info.uid === id) job.push(i)
      }
    })

    return job
  }

  // * CORDOVA >> EMAIL on IOS
  async export_cordova(uid, payload) {
    // first check the data
    if (uid === null || uid === undefined) return false
    // now prepare a job
    const job = this._prepare_job(uid) //this will return an array with all indices

    // prepare promises and loop through jobs
    const promises = []
    for (let i = 0; i < job.length; i++) {
      let DOCUMENT = this.get(job[i])
      let filename_html = prepare_filename(DOCUMENT, 'html')
      if (filename_html !== undefined) {
        let html = DOCUMENT.cda.text.div
        promises.push(write_csv(filename_html, html))
      }
    }

    // WAIT FOR PROMISES
    const filenames = []
    await Promise.all(promises).then(res => {
      res.forEach(r => filenames.push(r))
    })

    // SOME CHEKS
    if (filenames.length === 0) return false
    if (filenames[0] === null || filenames[0] === undefined) return false

    // NOW PREPARE THE MAIL
    const status = await cordova.plugins.email.open({
      to: payload.email,
      subject: payload.subject,
      body: payload.body,
      attachments: filenames
    })

    // NOW MAKE THE EXPORT TRUE
    for (let i = 0; i < job.length; i++) this._STORAGE[job[i]].exported = true
    return true
  }

  // SOME PRIVATE FUNCTIONS TO BE ACCESSIBLE VIA THE INSTANCE
  _create_filename(DOCUMENT, suffix) {
    return prepare_filename(DOCUMENT, suffix)
  }

  _export_file(filename, DATA) {
    return exportFile(filename, DATA)
  }
}

export const STORAGE = new Storage()

// SOME LOCAL FUNCTIONS
function check_text(pid) {
  pid = pid.replace(/[, ]/g, '_');
  pid = pid.replace(/[üÜ]/g, 'ue');
  pid = pid.replace(/[äÄ]/g, 'ae');
  pid = pid.replace(/[öÖ]/g, 'oe');
  pid = pid.replace(/[^a-zA-Z0-9 _]/g, "")
  return pid
}


// EXPORT FILENAME
function prepare_filename(DOCUMENT, suffix) {
  if (DOCUMENT === undefined) return undefined
  var nice_date = dateFormat(DOCUMENT.info.date, 'yyyymmddhhMMss')
  // splite date by DATA_TIME
  return `PID_${check_text(DOCUMENT.info.PID)}_quest_${check_text(DOCUMENT.info.label)}_UID_${DOCUMENT.info.uid}.${suffix}`
}

function prepare_export_data(DOCUMENT, export_format) {
  switch (export_format) {
    case 'html':
      var HTML = ''
      // HTML
      HTML += '<!DOCTYPE html>\n'
      HTML += '<html>\n'
      // HEADER + JSON
      HTML += '<head>\n'
      HTML += `<script>\nCDA=${JSON.stringify({ cda: DOCUMENT.cda, hash: DOCUMENT.hash, info: DOCUMENT.info, exported: true })}\n</script>`
      HTML += '</head>\n'

      // BODY
      HTML += '<body>\n'

      HTML += DOCUMENT.cda.text.div
      HTML += '</body>\n'
      HTML += '</html>\n'

      return HTML

    case 'json':
    case 'cda':
    default:
      return JSON.stringify({ cda: DOCUMENT.cda, hash: DOCUMENT.hash, info: DOCUMENT.info, exported: true })
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
