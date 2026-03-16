import { generateKeys, uuidv4 } from "./hhash"
import { log } from "./Logger"

class User {

    _keyPair = undefined
    _uid = undefined
    _email = undefined

    constructor(val) {
      log({ debug: 'create User' })
      if (val === undefined) return
      this.import(val)
    }

    // GETTER AND SOME SETTER
    get uid() { return this._uid }
    set uid(val) { this._uid = val }

    get keyPair() { return this._keyPair }
    set keyPair(val) { this._keyPair = val }

    get email() { return this._email }
    set email(val) { this._email = val }

    // PUBLIC FUNCTIONS

    clear() {
      this.keyPair = undefined
      this.uid = undefined
      this.email = undefined
    }

    create() {
      this.clear();
      this.uid = uuidv4();
      this.keyPair = generateKeys();
    }

    export() {
      const exp = {
        keyPair: this.keyPair,
        uid: this.uid,
        email: this.email,
      }

      return JSON.stringify(exp)
    }

    import(jsondata) {
      if (jsondata === undefined || jsondata === null) return false
      const data = JSON.parse(jsondata)
      if (data.uid === undefined || data.keyPair === undefined) {
        log({ warn: 'JSON data not valid!' })
        return false
      }

      this.clear();
      this.uid = data.uid
      this.keyPair = data.keyPair
      this.email = data.email
    }
  }

export const USER = new User()
