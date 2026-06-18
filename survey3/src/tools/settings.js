import { USER } from "src/tools/User";
import { log } from "./Logger";
import { db } from "./db";

const emptySettings = {
  size: "normal", // 'bigger', 'biggest'
  export_format: "html",
  quest_focus_mode: null, // Wizard (eine Frage/Schritt) vs. Liste; null = adaptiv (iPhone Wizard, sonst Liste)
  quest_auto_advance: true, // bei Einfachauswahl automatisch zur nächsten Frage springen
  filter_storage: { order: { label: "Datum", value: "date" }, text: null },
};

class settings {
  _DATA = emptySettings;
  _USER = USER;

  constructor() {
    log({ debug: "settings initializing ..." });
  }

  async init() {
    log({ debug: "settings: init from IndexedDB" });
    const row = await db.settings.get("main");
    if (row) {
      const { key, ...data } = row;
      this._DATA = data;
      this._USER.import(this._DATA.userdata);
    } else {
      this._DATA = { ...emptySettings };
      this._USER.create();
      this.save();
    }
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

  get quest_focus_mode() {
    // Rohwert: boolean = explizite Nutzerwahl, null/undefined = adaptiv (in RenderQuest aufgelöst)
    return this._DATA.quest_focus_mode;
  }
  set quest_focus_mode(val) {
    this._DATA.quest_focus_mode = val;
    this.save();
  }

  get quest_auto_advance() {
    if (this._DATA.quest_auto_advance === undefined) return true;
    return this._DATA.quest_auto_advance;
  }
  set quest_auto_advance(val) {
    this._DATA.quest_auto_advance = val;
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
    db.settings.put({ key: "main", ...this._DATA }).catch((e) => {
      log({ error: "settings: IndexedDB write failed", data: e });
    });
  }

  load() {
    // No-op: init() handles loading from IndexedDB
  }
}

export const SETTINGS = new settings();
