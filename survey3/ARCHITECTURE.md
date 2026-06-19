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
| `patient.pid` | Patienten-ID im **Visiten-Flow** (Patienten-/Visiten-Datenmodell) | `VisitMan.js`, `export_app2.js` (`PATIENT_CD`) |
| `patientId` | Technischer **UUID-Fremdschlüssel** Visite→Patient | `visit-model.js`, `VisitMan.js`, Route-Param |

`info.PID` (Einzelbogen) und `patient.pid` (Visiten) sind **nicht** verknüpft:
Einzelbogen-Responses hängen nicht an einem Patientendatensatz. Eine Kopplung wäre
eine Daten-Migration und ist bewusst nicht umgesetzt.

## 4. Persistenz (IndexedDB / Dexie)

- Writes sind „fire-and-forget" mit `.catch(log)`; reaktiver In-Memory-State ist die
  Quelle der Wahrheit, IndexedDB die Spiegelung. Für eine Single-User-Offline-PWA
  akzeptiert.
- Vor dem Schreiben wird die Reaktivität entfernt (`JSON.parse(JSON.stringify(...))`
  bzw. `toRaw`), da Dexie keine Vue-Proxies serialisieren kann.
- Schema-Upgrades in `src/tools/db.js` sind bisher rein additiv (neue Stores). Für
  künftige *breaking* Änderungen wäre ein `upgrade()`-Callback nötig.
