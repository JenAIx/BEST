# Architektur — State, Datums- & PID-Konventionen

Kurzreferenz zur State-Verwaltung von survey3 (Quasar/Vue 3/Pinia, offline-first,
IndexedDB via Dexie). Beschreibt die kanonischen Zugriffsmuster und die bewusst
in Kauf genommenen Konventionen/Schulden.

## 1. Singletons & Store-Zugriff

Vier fachliche Singletons werden als **Modul-Singletons** erzeugt und in den
Pinia-Store (`src/stores/main.js`) eingehängt:

| Singleton | Definition | Im Store als |
|-----------|------------|--------------|
| `QUESTMAN` | `src/tools/questman/index.js` (`export const QUESTMAN = new QuestMan()`) | `state.QuestMan` (reaktiv) |
| `STORAGE` | `src/tools/Storage.js` | `state.STORAGE` (`markRaw`) |
| `VISITMAN` | `src/tools/visits/VisitMan.js` | `state.VISITMAN` (`markRaw`) |
| `SETTINGS` | `src/tools/settings.js` | `state.SETTINGS` (`markRaw`) |
| `USER` | `src/tools/User.js` | gehalten in `SETTINGS._USER` |

**Kanonischer Zugriff: immer über den Store.**

```js
import { useMainStore } from 'src/stores/main'
setup() { return { mainStore: useMainStore() } }
// this.mainStore.QUESTMAN / .STORAGE / .VISIT_MAN / .SETTINGS
```

- Komponenten/Pages greifen **ausschließlich** über `useMainStore()` zu, nie per
  direktem `import { STORAGE }`.
- Direkte Singleton-Importe sind nur in **Boot** (`src/boot/db.js`, ruft `.init()`),
  im **Store** selbst und in **Unit-Tests** erlaubt.
- Es existiert genau **eine** Instanz pro Singleton appweit. (Früher erzeugte der
  Store eine eigene `new QuestMan()` neben dem exportierten `QUESTMAN` — die Tests
  prüften dann eine andere Instanz als die App lief. Behoben: Store nutzt das
  Singleton.)

### Reaktivität: warum `markRaw` für drei, aber nicht für QuestMan

`STORAGE`/`VISITMAN`/`SETTINGS` verwalten ihre reaktiven Daten **selbst**:
- `Storage._STORAGE`, `Storage._PRESETS` sowie `VisitMan._PATIENTS/_TEMPLATES/_VISITS`
  sind explizit `reactive([])`.
- `settings._DATA` ist explizit `reactive({...})` (und wird in `init()` per
  `Object.assign` in-place mutiert, damit die Objekt-Identität stabil bleibt).

Deshalb werden diese Instanzen mit **`markRaw`** in den State gelegt: Pinia soll die
Klasseninstanz nicht zusätzlich tief proxyen (Methoden, und v. a.
`SETTINGS._USER.keyPair`, das WebCrypto-`CryptoKey`-Objekte hält, die nicht reaktiv
gewrappt werden sollten). Getter wie `PATIENTS`, `STORAGE.get()` bleiben reaktiv,
weil die zurückgegebenen Arrays/Objekte selbst reaktiv sind.

`QUESTMAN` bleibt bewusst **reaktiv-im-State** (kein `markRaw`): Beim Ausfüllen
mutiert die UI verschachtelte Strukturen (`activeQuest.value.items[i].value`), die
nicht eigenständig reaktiv sind — hier wird Pinias Tiefenreaktivität gebraucht,
damit Fortschritt/„beantwortet"-Marker live aktualisieren.

## 2. Datums-Konventionen

- **Intern gespeichert:** Millisekunden-Zeitstempel (`Date.now()`), z. B.
  `visit.date`, `slot.date_start/date_end`, `patient.created/updated`,
  `visit.exportedAt`. Erlaubt einfaches Sortieren/Vergleichen.
- **An den Export-Grenzen** in ISO konvertiert:
  - app2 (`src/tools/export_app2.js`): `isoFromTimestamp()` → UTC-ISO,
    `isoDate()` → `YYYY-MM-DD`.
  - CDA (`src/tools/CDA_H7_JSON.js`): `formatDate()` → `yyyy-mm-dd'T'HH:MM:ssZ`
    (24-Stunden; der frühere `h`-Token erzeugte 12 h ohne AM/PM → „2:30" statt
    „14:30", behoben).

Regel: **ms intern, ISO nur an der Schnittstelle.** Felder, die schon als
ISO-String hereinkommen, werden in den Konvertern toleriert (Pass-through).

## 3. PID-Konventionen (drei, bewusst koexistierend)

| Bezeichner | Bedeutung | Wo |
|------------|-----------|-----|
| `info.PID` | Vom Nutzer eingegebene Patienten-ID im **Einzelbogen-Flow** (Quest-Response) | `Storage.js`, `db.js`-Index, `CDA_H7_JSON.js` |
| `info.patientId` | Optionaler **Link** einer Einzelbogen-Response an `patients.id` (Auto-Link über die PID) | `main.js storage_add`, `CDA_H7_JSON.js`, `db.js`-Index (v3) |
| `patient.pid` | Patienten-ID im **Visiten-Flow** (Patienten-/Visiten-Datenmodell) | `VisitMan.js`, `export_app2.js` (`PATIENT_CD`) |
| `patientId` | Technischer **UUID-Fremdschlüssel** Visite→Patient | `visit-model.js`, `VisitMan.js`, Route-Param |

Einzelbogen-Responses werden beim Speichern über `info.patientId` **optional** an einen vorhandenen
Patienten gekoppelt: existiert ein Patient mit der eingegebenen PID (`VISITMAN.get_patient_by_pid`),
wird dessen `patients.id` gesetzt, sonst `null` (Auto-Link, additiv, kein UI/Backfill). Damit ist die
Brücke `info.PID → patients.id` gelegt; ein rückwirkendes Verknüpfen bestehender Responses und das
Anzeigen von Einzelbögen auf der Patientenseite bleiben als spätere Erweiterung offen.

## 4. Persistenz (IndexedDB / Dexie)

- Writes sind „fire-and-forget" mit `.catch(log)`; reaktiver In-Memory-State ist die
  Quelle der Wahrheit, IndexedDB die Spiegelung. Für eine Single-User-Offline-PWA
  akzeptiert.
- Vor dem Schreiben wird die Reaktivität entfernt (`JSON.parse(JSON.stringify(...))`
  bzw. `toRaw`), da Dexie keine Vue-Proxies serialisieren kann.
- Schema-Upgrades in `src/tools/db.js` sind bisher rein additiv (neue Stores). Für
  künftige *breaking* Änderungen wäre ein `upgrade()`-Callback nötig.

## 5. Fragebogen-Routing & Direktlinks

Der Quest-Flow wird über einen **URL-kodierten Parameter** gesteuert (Hash-Mode):

```
/#/quest/<encodeURIComponent(JSON.stringify(params))>
```

`params` wird in `src/tools/routeParams.js` geparst (`decodeURIComponent` → `JSON.parse`,
mit Fallback). Felder:

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `presets` | `string` \| `string[]` | Ein **stabiler `short_title`** oder eine Liste davon (Reihenfolge = Durchlauf-Reihenfolge der Kette) |
| `mode` | `'single'` \| `'new_preset'` \| `'protected'` \| `'encrypted'` | `single` = Einzelbogen (PID-Schritt + Review bleiben); alles andere = Preset-Flow (PID-Schritt entfällt bei gesetzter `PID`, Review wird übersprungen) |
| `PID` | `string` | Optional vorgegebene Patienten-ID; wird durchgereicht, der PID-Schritt entfällt dann |
| `email`, `pubKey` | `string` | Nur `mode: 'encrypted'` |

**Direktlinks sind tragfähig**, weil `presets` auf `short_title` zeigt (stabil, versionsübergreifend –
siehe Datenmodell-Absicherung). Beispiele:

```
# Einzelbogen, Patient gibt PID selbst ein:
/#/quest/%7B%22presets%22%3A%22mrs%22%2C%22mode%22%3A%22single%22%7D
  → { "presets": "mrs", "mode": "single" }

# Kette aus drei Bögen, PID vorgegeben (Patient klickt nur durch):
  → { "presets": ["mrs","phq_9","ess"], "PID": "P-001", "mode": "protected" }
```

Erzeugt werden die Links in `SelectQ.vue` (Auswahl), `Preset.vue` (Start/encrypted) und
`PresetStore.vue` (gespeicherte Vorlagen). Ein eigenes „Link kopieren"-UI gibt es bewusst (noch) nicht;
die Kodierung ist die Grundlage dafür, falls es später gewünscht wird.

Die globale Ketten-Position (`„Fragebogen X von Y"`) liefert `QuestMan`: `preset_total` (Anzahl
aufgenommener Bögen) und `preset_index` (`preset_total − verbleibende`, 1-basiert). `_presets` wird beim
`next()` per `shift()` geleert, `_presetTotal` bleibt erhalten; beide werden in `clear_preset()`
zurückgesetzt.
