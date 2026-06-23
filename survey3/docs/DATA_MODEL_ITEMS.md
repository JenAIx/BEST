# Datenmodell der Fragebogen-Items (UI → Store → Export)

Verbindlicher Kontrakt, wie jeder Item-`type` vom UI-Rendering über den Store (`item.value`),
die `summary`, das Scoring, die Validierung bis in die Exporte fließt. Grundlage der
Datenvalidität. Abgesichert durch `test/jest/__tests__/item_types_datamodel.test.js`
(Datenfluss) und `test/cypress/integration/item_types_coverage.spec.js` (echtes UI→Store).

## Wert-Form je Typ

| Typ | UI emittiert (`item.value`) | summary.items | Scoring (sum/avg/ids) | Validierung |
|---|---|---|---|---|
| **radio** | Skalar — Zahl **oder** String (`"Male"`, `"kA"`) | as-is | nur wenn Zahl, sonst übersprungen | vorhanden ⇔ `!= null` |
| **checkbox** | **Array** von Skalaren (`[]` wenn nichts gewählt) | as-is (Array bleibt) | Array elementweise, nur Zahlen | `Array && length>0` |
| **multiple_radio** | **Array**, 1 Wert je Teilfrage (`null` für offene) | **N Einträge** (je Teilfrage; `label`/`id`/`coding` von der Sub-Frage) | je Element wenn Zahl | Länge == #Teilfragen **und** kein `null` |
| **number** | Zahl \| `null` (`parseFloat`, NaN→`null`); optionale `min`/`max` werden auf den Wert geklemmt (`clampNumber`) | numerischer String → Zahl normalisiert; NaN verworfen | summiert | `!= null` |
| **slider** | Zahl (im `[min,max]`-Bereich) | as-is | summiert | `!= null` |
| **text** | String | as-is | übersprungen (Nicht-Zahl) | `!= null` |
| **date** | String `DD.MM.YYYY` | as-is | übersprungen | `!= null` |
| **date_year** | String `YYYY` | as-is | übersprungen | `!= null` |
| **time** | String `HH:mm` (24 h) | as-is | übersprungen | `!= null` |
| **separator / seperator / textbox / image** | kein Eingabewert | übersprungen (außer `image` mit gesetztem `value`) | — | `null` (nicht-interaktiv) |

Belege: `src/components/QuestItemField.vue` (Renderer-Dispatch), `RenderQuest_*.vue` (Emit-Form),
`src/components/RenderQuest.vue` (List-Binding `item.value = $event`, Fokus-Binding `onValue`),
`src/tools/questman/result-items.js` (`buildResultItems`), `src/tools/questman/scoring/*`,
`src/tools/visits/visit-model.js` (`itemValidity` / `isAnswered`).

## Eine Wahrheit für „beantwortet"
`visit-model.js` exportiert `isAnswered(item, value)` — den reinen Wert-/Vollständigkeits-Check je Typ
(ohne Pflicht-Logik). Beide Verbraucher delegieren daran:
- `itemValidity` = `force===false ? true : (nicht-interaktiv ? null : isAnswered)` → Pflichtprüfung.
- `RenderQuest.isAnswered` (UI „erledigt"-Haken) ruft denselben Helper.

Konvention: leeres Array `[]` zählt bei `checkbox`/`multiple_radio` **nicht** als ausgefüllt.

## number Min/Max
`number`-Items dürfen optionale `min`/`max`/`step` tragen. Der Renderer reicht sie ans `q-input`
durch, zeigt den Bereich im Hint und **klemmt** den eingegebenen Wert via `clampNumber` (src/tools/numUtils.js)
in `[min,max]` — so gelangen keine bereichsverletzenden Werte in den Store. `validate.js` prüft
`min <= max`. Annotiert sind bisher offensichtliche Demografie-/Schlaf-Items (Alter/Größe/Gewicht/
Schlafstunden in `quest_psqi`, `quest_biomag_fw`); der Rest bleibt unbeschränkt.

## Einzelbogen ↔ Patient (info.patientId)
Beim Speichern eines Einzelbogens wird `info.patientId` optional gesetzt: existiert ein Patient mit
der eingegebenen PID (`VISITMAN.get_patient_by_pid`), wird dessen `patients.id` hinterlegt, sonst `null`.
Rein additiv (DB `responses`-Index `info.patientId`, `db.version(3)`), kein UI, kein Backfill; legt das
Fundament, um Einzel-Responses später an Patientenakten zu hängen. Der CDA-Hash ist nicht betroffen
(signiert nur `cda`, nicht `info`).

## Persistenz-Round-Trip
- Speichern: `VisitMan.complete_questionnaire` legt `summary` **und** rohe `draft.values` ab
  (index-genau zur items-Reihenfolge, deep-cloned).
- Wieder-Öffnen: `QuestMan.restore_active_values` / `applyDraftValues(items, values)` schreibt die rohen
  Werte index-genau zurück (`undefined` überschreibt nicht). Alle Typen überstehen den Round-Trip 1:1.

## Export-Konsum
- **CDA** (`CDA_H7_JSON.js`): `extract_value` rendert Skalare als Text, **Arrays** (checkbox /
  multiple_radio) per `, `-Join in die HTML/Tabellen-Darstellung.
- **app2** (`export_app2.js`): `summary.items`/`results` landen unverändert im `OBSERVATION_BLOB` (Q).
  Zusätzliche N-Observationen entstehen **nur** für **numerische** `results` (`typeof value === 'number'`);
  Strings/Arrays werden nicht als N-Observation emittiert (bleiben im Q-Blob erhalten).

## Bewusst akzeptierte Konventionen / bekannte Schuld
- **Datums-Strings sind nicht ISO** (`DD.MM.YYYY` etc.). Für Scoring irrelevant (nicht numerisch);
  im Export reiner Anzeigetext. Eine ISO-Migration ist bewusst nicht erfolgt.
- **`ignore_for_result`** steuert nur das Scoring (sum/avg überspringen es), **nicht** den Export —
  Demografie/Metadaten bleiben in `summary.items` und im CDA/CSV erhalten.
- **Kategoriale Radios mit String-Werten** (z. B. `quest_biomag_fw` Alkoholmenge `"0","1","2-3",">7"`)
  sind absichtlich **nicht** bepunktet (deren `results` ist leer). `validate.js` warnt mit
  `STRING_NUMERIC` ausschließlich, wenn solche Werte in einem **tatsächlich bepunkteten** Bogen
  auftreten — derzeit kein einziger Fall. Daher keine automatische Zahl-Coercion (würde bei gemischten
  Spalten wie `"2-3"` nur inkonsistente Mixed-Typen erzeugen).
- **`separator`** ist der einzig gültige Trenner-Typ; der frühere `seperator`-Tippfehler wurde in den Daten bereinigt und die Code-Toleranz entfernt.
- **`example_value`** (nur `quest_hlq`, Demo-Zeile) wird **ausschließlich in der QuestManager-Vorschau**
  als Auswahl angezeigt (`preview`-Prop), **nicht** im echten Ausfüll-Flow (dort startet die Matrix leer).
  Es fließt nie in die gespeicherte Antwort ein (`RenderQuest_multipleradio.onRadioChange` baut die
  Antwort aus `item.value`/leerem Raster, nie aus `example_value`).

## Schema & Validierung (kanonischer Standard)

- **Maschinen-Schema:** [`questionnaire.schema.json`](./questionnaire.schema.json) ist die Single Source of
  Truth für Top-Level-Felder, Item-Schema je Typ und den `results`-Block.
- **Laufzeit-/Import-Validator:** `src/tools/questman/validate.js` (`validateQuestScoring`) gibt
  `{ errors, warnings }` zurück. **Errors blockieren** den Import (`QuestMan.add()` speichert dann nicht
  und zeigt die Fehler im UI); **Warnings** sind nicht blockierend.
- **Guard (Test):** `test/jest/__tests__/questman_scoring_schema.test.js` validiert **alle** gebündelten
  Bögen → jeder neue `quest_*.json` wird automatisch mitgeprüft (0 Errors Pflicht). `questionnaire_format.test.js`
  sichert LF-Zeilenenden + valides JSON.

**Top-Level-Felder:** `title`, `short_title` (eindeutig!), `items` sind Pflicht; `description`, `keywords`,
`manual`, `coding`, `results` empfohlen. Ausnahmen ohne `coding` (IPAQ_short, PEM_Screening) bzw. ohne
`results` (LEC-SEQ-Bögen: reine Datenerfassung) sind bewusst zulässig.

**Item-Typen (`ITEM_TYPES`):** `radio, checkbox, text, number, date, date_year, time, slider,
multiple_radio, separator, textbox, image`. Jedes Item braucht `type` + `label`.

**`force`-Default:** **weggelassen ⇒ Pflicht** (`itemValidity`: nur `force === false` macht optional).
Nicht-interaktive Typen (`separator/textbox/image`) sind nie Pflicht.

**`results`-Reihenfolge (empfohlen, nicht erzwungen):** `method, coding, evaluation, scoring, domaine`.
Methoden: top `sum/avg/count/count_targets/ids`; scoring `raw/multiply/range/count`;
domaine `sum/avg/multiply/sum_range/diff_range/sum_multiply/avg_multiply/sum_sub_multiply`.

> Anleitung zum Aufnehmen neuer Bögen: [`ADDING_QUESTIONNAIRES.md`](./ADDING_QUESTIONNAIRES.md).
