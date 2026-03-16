import { USER } from "src/tools/User";
import { log } from "./Logger";

const emptySettings = {
  size: "normal", // 'bigger', 'biggest'
  export_format: "html",
  filter_storage: { order: { label: "Datum", value: "date" }, text: null },
};

class settings {
  _DATA = undefined;
  _USER = USER;
  _fieldname = "surveyBEST_SETTINGS";

  constructor() {
    log({ debug: "settings initializing ..." });
    this.load();
  }

  // GETTER / SETTER
  get filter_storage() {
    return this._DATA.filter_storage;
  }
  set filter_storage(val) {
    this._DATA.filter_storage = val;
    this.save();
  }

  get size() {
    return this._DATA.size;
  }
  set size(val) {
    this._DATA.size = val;
    this.save();
  }

  get export_format() {
    if (this._DATA.export_format === undefined)
      this._DATA.export_format = "html";
    return this._DATA.export_format;
  }
  set export_format(val) {
    this._DATA.export_format = val;
    this.save();
  }

  get email_export() {
    return this._USER.email;
  }
  set email_export(val) {
    this._USER.email = val;
    this.save();
  }

  get user_uid() {
    return this._USER.uid;
  }
  get user_keyPair() {
    return this._USER.keyPair;
  }

  // GENERAL FUNCTIONS

  get(label) {
    return this._DATA[label];
  }

  set(payload) {
    if (
      payload === undefined ||
      payload.value === undefined ||
      payload.field === undefined
    )
      return false;
    this._DATA[payload.field] = payload.value;
    this.save();
    return true;
  }

  // SAVE
  save() {
    log({ debug: "settings: save" });
    this._DATA.userdata = this._USER.export();
    localStorage.setItem(this._fieldname, JSON.stringify(this._DATA));
  }

  load() {
    const data = localStorage.getItem(this._fieldname);
    if (data === null || data === undefined) {
      this._DATA = emptySettings;
      this._USER.create();
      this.save()
    } else {
      this._DATA = JSON.parse(data);
      this._USER.import(this._DATA.userdata);
    }
  }
}

export const SETTINGS = new settings();
