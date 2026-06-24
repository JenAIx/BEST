# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Released]

### v1.15.0

#### Fixed

- [2026-06-24] `/select` Auswahl-Bug: Die Mehrfachauswahl wurde per Filter-Index getrackt — nach einem Filterwechsel verrutschten die Häkchen auf andere Bögen. Auswahl jetzt per Bogen-Key (bleibt über Suche/Filter hinweg korrekt)

#### Changed

- [2026-06-24] Bau-Tool (Editor) komplett überarbeitet — elegant, intuitiv, funktional:
  - **Dreispaltiges Layout**: vertikale **Feldtyp-Palette** (klicken ODER per Drag direkt an die richtige Stelle ziehen), Editor in der Mitte, **Live-Vorschau** rechts (debounced; auf Mobil als Vollbild-Dialog).
  - **WYSIWYG-Feldkarten**: das Item wird gerendert dargestellt (kompakt); **ID als Chip** vor der Frage (read-only, passt sich bei Reorder an); **Label oben direkt editierbar**; **Flags (Pflicht/inline/ohne Wertung) als klickbare Chips** in der Kopfzeile; Detail-Bearbeitung (Optionen, Coding eingeklappt) erst beim Aufklappen — kein Typ-Selektor mehr (Typ liegt fest).
  - **Intelligente Namensgebung**: `short_title` automatisch aus dem Titel (slug), lesbare Default-Labels/Tags statt UUIDs, generisches Default-Coding („Klinisches Assessment" statt „Blepharospasm…").
  - **Schlüsselworte als Chips** mit kuratierten Vorschlägen aus dem Bestand (anklicken/entfernen, freie Eingabe).
  - **Einfache Auswertung**: Methode wählen (Summe/Mittelwert/Anzahl) + Bewertungsbereiche (von/bis/Label) per UI; komplexes ID-/Domänen-Scoring bleibt unter „Erweitert".
- [2026-06-24] `/select` (Fragebogenauswahl) aufgehübscht: immer sichtbare Suche (Titel/Beschreibung/Schlüsselwort) mit Trefferzähler statt Filter-Button, Karten mit Schlüsselwort-Chips, klar erkennbare Mehrfachauswahl.
- [2026-06-24] Editier-Stabilität: `CreateItem` synchronisiert seine lokale Kopie jetzt per Watcher auf Typänderung statt durch externen Re-Mount — kein Fokusverlust/DOM-Detach mehr beim Bearbeiten

### v1.14.1

#### Added

- [2026-06-24] Visuokonstruktions-Zeichenbatterie: zwei neue Copy-Bögen `pentagons` (sich überschneidende Fünfecke) und `cube` (Würfel abzeichnen) — Modell-Figur als Inline-SVG + leeres Zeichenfeld (Pflicht) + optionales „Bemerkungen"-Feld. Ergänzt Uhr/Schrift/Spirale zu einer gemeinfreien Graphomotorik-/Visuokonstruktions-Batterie für Demenz-/Parkinson-Screening. E2E `visuoconstruction.spec.js`

### v1.14.0

#### Added

- [2026-06-23] Neuer Item-Typ **`drawing`** (quadratisches Zeichenfeld, Canvas/Pointer, touch-fähig): Ergebnis als Base64-PNG in `item.value`. Die Zeichnung zählt erst als beantwortet, wenn sie per **„Übernehmen"** bestätigt wird (Striche allein setzen den Wert nicht — der Fortschritt springt nicht mehr verfrüht auf 1/1); Zwischenzustand „noch nicht übernommen" + „Löschen". Optionale Vorlage (`canvas.background`: `blank`/`spiral`/Bilddatei). Pflicht-Zeichnungen (`force:true`) blocken das Absenden bis übernommen. End-to-end integriert (Renderer, Validator/`ITEM_TYPES`, isAnswered/answerStats, Export PDF als Bild, CDA mit `[Zeichnung]`-Platzhalter bei vollem Roh-Wert im strukturierten Export)
- [2026-06-23] Drei neue Bögen für den Zeichen-Flow: `clock` (Uhren-Zeichen-Test „10 nach 11"), `handwriting` (Schriftprobe), `spiral` (Archimedes-Spirale nachzeichnen) — als Preset-Kette nacheinander durchlaufbar (globaler Fortschritt, nahtloser Übergang). Je Bogen zusätzlich ein optionales Textfeld „Bemerkungen"
- [2026-06-24] Storage-Detailansicht (`TableView`): Zeichnungen werden als **Bildvorschau** statt Roh-Base64 gezeigt, mit **PNG-Download** je Zeichnung; Druck/Print bettet das Bild ein; CSV-Export nutzt einen `[Zeichnung]`-Platzhalter (kein Base64 in der Zelle)
- [2026-06-23] Tests: `drawing_flow.spec.js` (Zeichnen→Store, Pflicht-Block, 3er-Kette), Unit-Tests für `drawing` in `visit-model`/`validate`
- [2026-06-23] Bau-Tool (Phase 2): Items im Editor per **Drag & Drop** umsortieren (vuedraggable/SortableJS, touch-fähig) sowie per „Hoch/Runter"; Optionen, Antworten und Teilfragen (`multiple_radio`) lassen sich jetzt per „Hoch/Runter" umsortieren (vorher gar nicht). **Live-Validierung** zeigt Schema-Fehler/Warnungen direkt und blockiert das Speichern bei Fehlern (nutzt `validateQuestScoring`)

### v1.13.0

#### Added

- [2026-06-23] Fragebogen-Standard maschinell festgeschrieben: neues JSON-Schema `docs/questionnaire.schema.json` (Single Source of Truth) und Beitrags-Anleitung `docs/ADDING_QUESTIONNAIRES.md` (wie neue Bögen aufgenommen werden — inkl. automatischer Test-Erfassung). `docs/DATA_MODEL_ITEMS.md` um Schema-/Validierungs-, Top-Level-, results- und force-Default-Abschnitte erweitert
- [2026-06-23] Validator gehärtet (`validate.js`): prüft jetzt auch das Item-Schema (Pflicht `type` aus kanonischer `ITEM_TYPES`-Liste, `label`, Optionen je Typ; Warnung bei `multiple_radio`-Teilfragen ohne id). Der bestehende Schema-Guard erfasst damit automatisch jeden gebündelten Bogen
- [2026-06-23] Import-/Speicher-Validierung verdrahtet: `QuestMan.add()` liefert `{ ok, errors }` und lehnt ungültige Bögen ab; QuestManager-Import und -Editor zeigen die konkreten Fehler im UI (statt stiller Konsolen-Logs)
- [2026-06-23] Tests: `questman_schema_items.test.js` (Item-Schema-Regeln), `questionnaire_format.test.js` (LF-Zeilenenden + valides JSON), `add()`-Kontrakt in `questman.test.js`

#### Changed

- [2026-06-23] Datenmodell-Konsistenz: 23 Items ohne `type` (Überschriften/Spacer) auf `textbox`/`separator` gesetzt; 26 Bögen von CRLF auf LF normalisiert; `.gitattributes` (LF für Text-/Quelldateien) ergänzt; Builder-Typliste (`item_types`) um `textbox`/`date_year` angeglichen
- [2026-06-23] Bewusst zurückgestellt (Tier-3-Follow-up, als Warnung sichtbar): Teilfragen-`id` für 17 `multiple_radio`, `coding.version`-Backfill, `results`-Key-Reihenfolge, `image` im Builder

### v1.12.0

#### Fixed

- [2026-06-22] Pflicht-Fragen im Fokus-Modus nicht mehr überspringbar: 10 Fragebögen (DGI, aes_scale, PANAS, shaps_d, More-scale, quiprs, MPQ, whoqol, FIM, Fugl-Meyer) hatten ihre `multiple_radio`-Matrizen im Bogen-JSON als `force: false` (optional) markiert — dadurch ließ sich im Fokus-Modus per „Weiter" ohne Antwort weiterspringen. Alle betroffenen Matrizen sind jetzt Pflicht (`force: true`); andere bewusst optionale Felder bleiben unverändert. (Die Validierungslogik selbst war korrekt; Ursache war die Bogen-Definition.)
- [2026-06-22] `multiple_radio` + `example_value`: Demo-Beispielwerte wurden im echten Ausfüll-Flow als vorausgewählte Radios angezeigt (Matrix sah beantwortet aus, obwohl `item.value` leer war). `example_value` wird jetzt nur noch in der QuestManager-Vorschau gezeigt; im echten Flow startet die Matrix leer

#### Added

- [2026-06-22] Globale Fortschrittsanzeige über die Fragebogen-Kette ("Fragebogen X von Y" + dünner Balken), zusätzlich zur bestehenden Pro-Bogen-Anzeige. Quelle: neue `QuestMan`-Getter `preset_total`/`preset_index` (Position bleibt erhalten, obwohl die Queue beim `next()` geleert wird)
- [2026-06-22] E2E-Test `preset_flow.spec.js`: klickt eine Mehr-Bogen-Kette in Fokus- und Listen-Modus durch und prüft den Store (Response-Anzahl, `info.PID`, Ketten-Position, Abschluss) + QuestMan-Unit-Tests für die Ketten-Zähler
- [2026-06-22] E2E-Guard `focus_required_guard.spec.js`: Pflicht-Matrix blockt „Weiter" (leer + teilweise beantwortet) und „Absenden"; `multiradio_example_value.spec.js`: example_value erscheint nicht im echten Flow
- [2026-06-22] `ARCHITECTURE.md`: Abschnitt zu Fragebogen-Routing & Direktlinks (stabile `short_title`-URLs, `mode`/`PID`-Semantik)

#### Changed

- [2026-06-22] Preset-Flow geglättet ("Untersucher wählt aus → Patient klickt durch"): Im durchgeklickten Preset-Flow entfällt der redundante PID-Schritt (PID kommt aus der URL) und der Review-Zwischenschritt am Bogen-Ende → nahtloser Übergang von Bogen zu Bogen. Einzelbogen/Direktlink (`mode: 'single'`) behalten PID-Schritt und Review
- [2026-06-22] PID-Dopplung behoben: Ist die PID bereits vorgegeben, wird das PID-Eingabefeld im Bogen (Fokus- und Listen-Modus) nicht mehr angezeigt, sondern nur noch als read-only Kontext ("PID: …") im Kopf

### v1.11.2

#### Fixed

- [2026-06-22] Fragebogen-Migration: Beim Wechsel von der alten localStorage- auf die IndexedDB-Speicherung wurden gebündelte Fragebögen, die im alten Datenbestand (noch) fehlten, fälschlich als „vom Nutzer gelöscht" markiert und dauerhaft ausgeblendet — auf älteren iPads (iOS 17) sank die Liste so z. B. von 106 auf 75. Die Migration leitet Löschungen nicht mehr aus dem Fehlen im Alt-Blob ab; echte Löschungen kommen weiterhin ausschließlich aus dem expliziten `surveyBEST_DELETED_BUNDLED`-Schlüssel
- [2026-06-22] Einmalige Reparatur (`deletedBundled_repair_v1`): Auf bereits betroffenen Geräten wird die fälschlich befüllte Lösch-Liste genau einmal zurückgesetzt, sodass alle gebündelten Fragebögen wieder erscheinen (bewusst ausgeblendete Bundle-Bögen können in der UI erneut gelöscht werden); Nutzer-Fragebögen bleiben unberührt
- [2026-06-22] Race-Condition beim App-Start behoben: `QUESTMAN.init()` wurde bisher schon in der Import-Phase des Stores angestoßen und las die Datenbank teils, bevor Migration/Reparatur abgeschlossen waren (falsche Bogen-Anzahl beim ersten Laden). Die Initialisierung läuft jetzt im `db`-Boot-Default garantiert nach Migration und Reparatur

#### Added

- [2026-06-22] Tests: Unit-Tests für die Migrationslogik (`db_migrate.test.js`, inkl. „fehlende Bundle-Bögen werden nicht versteckt" und Idempotenz der Reparatur) sowie E2E-Regressionsschutz (`quest_count.spec.js`: frische Installation = 106, Migration aus Alt-Blob versteckt keine Bögen, Anzahl stabil nach Reload)

### v1.11.1

#### Fixed

- [2026-06-19] `multiple_radio`: gesetzte `example_value` (Demo-Vorschau) konnte beim ersten Klick als echte Antwort einsickern — die Antwort wird jetzt immer aus dem tatsächlichen Wert (bzw. leerem Raster) aufgebaut, nie aus dem Beispielwert
- [2026-06-19] ECOG-artige Konsistenz: „beantwortet"-Logik vereinheitlicht — Pflichtprüfung (`itemValidity`) und UI-Haken (`isAnswered`) nutzen jetzt denselben Wert-Check (zuvor leicht divergierende `multiple_radio`-Logik)

#### Added

- [2026-06-19] Datenmodell-Absicherung je Item-Typ (radio/checkbox/multiple_radio/number/slider/text/date/date_year/time/image): neue Unit-Tests (Wert-Form, Round-Trip, Scoring-Robustheit) und E2E-Tests (echte UI-Eingabe → Store-Wert/-Typ, inkl. Fokus-Modus) + verbindliche Referenz `docs/DATA_MODEL_ITEMS.md`

### v1.11.0

#### Added

- [2026-06-19] E2E-Store-Abdeckung: neuer Cypress-Spec füllt ~10 % der Fragebögen (11/107) über die echte UI aus und prüft im Pinia-Store, dass strukturierte Werte korrekt/geordnet im values-Array landen (insb. `multiple_radio`-Matrizen → ein Eintrag je Sub-Frage) und die Berechnungen exakt stimmen (sum/avg/ids-Domänen, Reverse-Scoring, Bereichs-Bewertung); zugleich Regressionsschutz für die Ausfüll→Store-Reaktivität
- [2026-06-19] `ARCHITECTURE.md`: dokumentiert Store-Zugriffsmuster, Reaktivität (markRaw-Begründung) sowie Datums- (ms intern / ISO an der Schnittstelle) und PID-Konventionen

#### Changed

- [2026-06-19] State-Architektur vereinheitlicht: appweit eine QuestMan-Instanz (Store nutzt das Modul-Singleton); STORAGE/VISITMAN/SETTINGS via `markRaw` im Store (verwalten ihre Reaktivität selbst), QuestMan bleibt bewusst reaktiv-im-State für das Live-Ausfüllen
- [2026-06-19] app2-Export gehärtet: `SOURCESYSTEM_CD` durchgehend `SURVEY3` (Erzeuger ≠ Vokabular), Investigator/Provider wird als `PROVIDER_ID` durchgereicht (Audit-Trail)
- [2026-06-19] Bestätigungsdialoge appweit von `window.confirm` auf `$q.dialog` umgestellt (mobiltauglich), hartkodierte Strings nach i18n, `aria-label`s an Icon-Buttons (a11y)

#### Fixed

- [2026-06-19] ECOG: Domäne „Sprache" zählte `id 16` doppelt (Domänensumme 40 statt 39) — korrigiert
- [2026-06-19] CDA-Export: Uhrzeit nutzte 12-Stunden-Format ohne AM/PM und ohne Padding (14:30 → „2:30") — auf 24-Stunden (`HH`) korrigiert
- [2026-06-19] Import robuster: defensive Fehlerbehandlung/Schemaprüfung bei kaputtem/falsch entschlüsseltem Input (kein UI-Crash)
- [2026-06-19] Coding-`system`-Werte in den Fragebogen-Daten kanonisiert (SNOMED/LOINC-Varianten & Tippfehler vereinheitlicht) für sauberen app2-Import

### v1.10.0

#### Added

- [2026-06-18] Fragebogen-Rendering im klinischen Wizard-Stil (ResearchKit): eine Frage pro Schritt mit großen, gut tippbaren Antwort-Reihen, ruhiger Karte, Fortschritt und Review-Schritt; Standard **adaptiv** (iPhone → Fokus-Wizard, iPad/Desktop → Liste), Umschalter Fokus↔Liste auf allen Geräten
- [2026-06-18] PDF-Druckformular: Slider-/EQ-VAS-Fragen werden als beschriftete Skala gerendert (zuvor leeres Kästchen), `image`-Items werden eingebettet (zuvor übersprungen) — behebt u.a. EQ-5D, abc-d, MPQ, VAS, Demenzscreening
- [2026-06-18] Scoring-Schema-Validator (`validate.js`) + Guard-Test über alle Fragebögen; Golden-Master- und handberechnete Fixture-Tests als Regressionsnetz; `internal`-Flag für Rechen-Zwischendomänen
- [2026-06-18] Beantwortete Fragen werden im Listen-Modus dezent markiert (Haken-Overlay)

#### Changed

- [2026-06-18] Antwort-Optionen (radio/checkbox) als große Reihen mit Auswahl-Tint; `multiple_radio`-Matrix als echte Tabelle — Spaltenlabels lesbar direkt über der Spalte (lange Labels vertikal), füllt die Kartenbreite ohne Überlauf, Zebra-Zeilen
- [2026-06-18] Fragebogen-Container responsiv (fluid bis 600px) für Desktop/iPad/iPhone; sticky Fortschritt + Navigation mit iOS-SafeArea
- [2026-06-18] Scoring-Engine modularisiert (ein Auswerte-Pfad je Datei: sum/avg/count/ids), `summary`-Relabeling und PDF-Builder ausgelagert, Schema dokumentiert

#### Fixed

- [2026-06-18] Scoring-Daten-Bugs behoben: DGI (`"3"` als String fiel aus der Summe), TWSTRS (`calc` nicht implementiert + Leerzeichen-Label → Schmerz-Subscore fehlte), ECOG („kA" gab 4 statt 0 Punkte); number-Items mit String-Wert (Altdaten/Import) werden jetzt übernommen statt verworfen
- [2026-06-18] B-ADL: Geschlecht war Freitext → jetzt kodierte Auswahl (männlich/weiblich/divers)
- [2026-06-18] iPhone: Fokus-Umschalter überlagerte den 3-Punkte-Button (Back/PDF) — auf schmalen Screens entzerrt
- [2026-06-18] Review-Schritt: `multiple_radio` zeigt jetzt „X von N beantwortet" statt nur der obersten Frage
- [2026-06-18] Sub-Renderer: Zeit-Eingabe (toter `changedVal`), Datums-Navigation (Max-Jahr war hart auf 2022)

### v1.9.0

#### Added

- [2026-06-17] Patienten-/Visiten-Workflow (parallel zum Einzel-Fragebogen-Flow): Patienten anlegen, Visiten aus wiederverwendbaren Vorlagen zusammenstellen, Komplettierungsstatus je Bogen mit Pflichtfeld-Prozent, Bögen als Entwurf speichern/fortsetzen oder abschließen (mit Logikprüfung)
- [2026-06-17] Export einer Visite oder eines Patienten als app2-kompatibles `importStructure`-JSON (Fragebögen als `VALTYPE_CD='Q'`-Observation + abgeleitete Score-Observations) — direkt in db/app2 importierbar; warnt explizit bei unvollständigen Bögen
- [2026-06-17] LEC-SEQ-Studieninstrumente: NMSS (vollständig, 30 Items / 9 Bereiche, Schwere×Häufigkeit-Scoring), SLTS-7, Aufnahmebogen V1 (`lecseq-anamnese-v1`), Verlaufs-Interview (`lecseq-verlauf`), ADR-Bogen (`lecseq-adr`)
- [2026-06-17] 4 versionierte Visiten-Vorlagen LEC-SEQ V1–V4 (Seed beim ersten Start, re-synct bei Versions-Bump)
- [2026-06-17] Startseite: Info-Card „Patienten"
- [2026-06-17] Headless-Cypress-E2E (Patienten-/Visiten-Flow + Einzel-Fragebogen-Flow) sowie Jest-End-to-End-Test für den kompletten Studienlauf inkl. Export

#### Changed

- [2026-06-17] App-weite Navigation vereinheitlicht: Header + Drawer sind überall verfügbar, nur beim Ausfüllen eines Fragebogens (Quest/VisitQuest) immersiv ausgeblendet — gesteuert über eine zentrale `route.meta.immersive`-Regel statt verstreutem `setProtectedMode`
- [2026-06-17] „Gespeicherte Fragebögen" und „Patienten & Visiten" als getrennte Seiten; Storage- und Patientenliste in wiederverwendbare Komponenten extrahiert
- [2026-06-17] Header-Titel „bestQUEST" springt zur Startseite

#### Fixed

- [2026-06-17] Vollständigkeitsanzeige: leere `multiple_radio`-/`checkbox`-Felder zählten fälschlich als ausgefüllt (PDQ-8 zeigte 100 %, Aufnahmebogen 18 %) — leere Arrays gelten jetzt korrekt als unbeantwortet; `multiple_radio` verlangt alle Teilfragen
- [2026-06-17] `calc_results` stürzte bei Fragebögen ohne `results`-Block ab
- [2026-06-17] Drawer: unterster Eintrag (Changelog) war durch das fixierte Logo-Overlay nicht klickbar — Logo in den normalen Fluss verschoben
- [2026-06-17] `/storage`: Liste und Filter wieder mittig zentriert (Regression aus der Komponenten-Extraktion)
- [2026-06-17] `BackButton`: „Zurück" im Visiten-Fragebogen führt zur jeweiligen Visite (korrektes `go_location`-Verhalten)

### v1.8.1

#### Fixed

- [2026-03-17] Fixed Storage reactivity: internal `_STORAGE` and `_PRESETS` arrays are now Vue `reactive()` — Pinia computed properties correctly update on data changes
- [2026-03-17] Fixed IndexedDB `DataCloneError` when writing reactive proxy objects — all writes now deep-clone data before persisting
- [2026-03-17] Fixed `MAIL_API_URL` and `MAIL_API_KEY` being `undefined` at runtime — removed redundant entries from `quasar.config.js` `build.env` that were overriding the `.env` file values
- [2026-03-17] Fixed HTML spec warning in Encrypt page — wrapped `<tr>` elements in `<tbody>`

#### Changed

- [2026-03-17] Redesigned StorageCard: replaced `q-item` with `q-card` layout — color accent bar (green/warning), hover lift effect, rounded status badges, selected state highlight
- [2026-03-17] StorageCard: clicking the card now opens preview; removed dedicated preview button
- [2026-03-17] Redesigned Encrypt page: card-based sections, outlined inputs, action buttons with icons, added top padding to avoid back button overlap

### v1.8.0

#### Changed

- [2026-03-17] Migrated storage backend from localStorage to IndexedDB via Dexie.js — removes the 5-10 MB cap, enables indexed lookups, and adds schema versioning for future upgrades
- [2026-03-17] All reads remain synchronous (in-memory cache); only writes go async to IndexedDB (fire-and-forget)
- [2026-03-17] Added async Quasar boot file (`src/boot/db.js`) that runs before app render to hydrate caches
- [2026-03-17] Removed all `localStorage` usage from Storage, Settings, and QuestMan classes

#### Added

- [2026-03-17] Added `dexie` dependency (~16 KB gzipped) for IndexedDB access with versioned schema migrations
- [2026-03-17] Added `src/tools/db.js` — Dexie database definition (6 tables: responses, presets, settings, userQuests, deletedBundled, meta)
- [2026-03-17] Added `src/tools/db-migrate.js` — automatic one-time migration from localStorage to IndexedDB (atomic transaction, no data loss)

### v1.7.4

#### Fixed

- [2026-03-17] Fixed StorageCard checkbox selection: changed `@blur` to `@update:model-value` and removed inverted emit — selections now apply immediately on click
- [2026-03-17] Fixed `Storage.remove()` loop-splice bug — used `findIndex` instead of iterating with splice
- [2026-03-17] Fixed filter comparison in Storage page: `.includes() > 0` replaced with `.includes()` (boolean, not number)
- [2026-03-17] Fixed date parsing in TableView for `dateformat` output (strips `GMT` prefix, inserts timezone colon, pads single-digit hours)

#### Changed

- [2026-03-17] Redesigned TableView (Vorschau): full-screen dialog with structured layout — condensed header, prominent result cards, numbered items table, evaluation section
- [2026-03-17] Added CSV export and print buttons to TableView
- [2026-03-17] TableView now reads structured CDA section data instead of rendering raw HTML div
- [2026-03-17] TableView styles use Quasar Sass variables (`$primary`, `$secondary`, `$grey-*`, `$dark`) matching app theme
- [2026-03-17] BackButton: added visible arrow-back mode (default) for standard navigation; quest page keeps hidden 3-dot menu via `:hidden="true"` prop

### v1.7.3

#### Fixed

- [2026-03-16] Fixed `indexOf` bug in scoring: `indexOf` returns `-1` not `undefined` — scores were silently wrong when a value wasn't found; also fixed `=` → `+=` for score accumulation
- [2026-03-16] Fixed division-by-zero in `calc_simple_avg` (empty items) and `getDomaineScore` (all zeros with `ignore_zeros`)
- [2026-03-16] Fixed missing `this.` in `Storage.export_cordova` causing ReferenceError at runtime
- [2026-03-16] Fixed `update_presets` not persisting changes (uncommented `save_presets()` call)
- [2026-03-16] Fixed `Storage._export_file` invalid `return status = ...` statement
- [2026-03-16] Fixed unsafe `JSON.parse` on route params in Quest, RenderQuest, and Preset pages — malformed URLs no longer crash the app
- [2026-03-16] Fixed unsafe `JSON.parse` in `Storage.load` and `Storage.load_presets` — corrupted localStorage no longer crashes
- [2026-03-16] Fixed error message concatenation in RenderQuest (missing space between PID and form errors)
- [2026-03-16] Fixed reference mutation in Preset.vue — `PARAMS` computed property was being mutated via object reference
- [2026-03-16] Fixed `quest_list_filtered` returning `undefined` instead of `[]` when no results match
- [2026-03-16] Fixed validation not recognizing `'separator'` (correct spelling) in `check_activeQuest`

#### Changed

- [2026-03-16] Extracted scoring helper functions (`getScore`, `calc_range`, `getDomaineScore`, `substract`) to module-level exports for testability
- [2026-03-16] Removed dead code (unused time-parsing variables) in `substract` function
- [2026-03-16] Added shared `parseRouteParams` helper (`src/tools/routeParams.js`) used by Quest, RenderQuest, and Preset pages
- [2026-03-16] Updated Jest configuration to work without the missing `@quasar/quasar-app-extension-testing-unit-jest` preset

#### Added

- [2026-03-16] Added 34 unit tests for scoring functions (`test/jest/__tests__/scoring.test.js`)
- [2026-03-16] Added 14 unit tests for questionnaire validation logic (`test/jest/__tests__/questman_validation.test.js`)

### v1.7.2

#### Added

- [2026-03-16] Added new quests: MDT-PD, RBD-SQ, Schwab-England Skala, WOQ-9

#### Changed

- [2026-03-16] Redesigned questionnaire store: bundled quests are now loaded fresh from the app bundle on every launch (auto-discovered via Vite glob import, no manual list needed). Only user-created quests are persisted in localStorage. App updates now automatically deliver new/updated questionnaires without requiring users to clear browser data. Includes one-time migration for existing users.
- [2025-10-30] Added new quests: WHODAS 2.0, EQ-5D-5L
- [2025-04-23] Added a new questionnaire: PDSS
- [2025-04-04] Added a new questionnaire: PD On/Demand for documenting on-demand therapy in Parkinson's disease, MNA
- [2025-03-06] Added a new questionnaire: VR Study for Max Schulze
- [2025-01-31] Added a new questionnaire: more scale
- [2024-12-10] Added a new questionnaire: AEB
- [2024-06-30] Added a new button to export a json file.
- [2024-02-06] Added a new questionnaire: BSI, CBI, PSQ18, QOL-AD
- [2024-01-26] Added a new questionnaire: VAS
- [2023-12-21] Added a new questionnaire: MDS-UPDRS I - IV
- [2023-12-21] Presets can be edited and deleted
- [2023-12-21] Filter for stored questionnaires includes an option for filtering by export status

#### Changed

- [2024-05-30] Changes: Parkinson/Anamnese
- [2024-02-05] Changed: AES
- [2024-01-11] Changed: AES, PNAS
- [2024-01-02] QuestMan class is now a singleton to avoid multiple instances and be usable in dbBEST, Logger.js is now a reference to the logger.js from dbBEST to avoid multiple software versions
- [2024-01-02] minor bugfixes and new quests
- [2023-12-24] export fileformat is now: `PID_quest_UID.html/json`

#### Fixed

- [2024-01-31] Fixed: AES (some value were changed from string to number)
- [2024-01-11] Fixed a bug, that the export button was not working

### v1.7.1

#### Added

- [2023-09-09] Added a new questionnaire: FIM, TINETTI, 6MWT, McGill, ParkMove

#### Changed

- [2023-09-09] Numeric values will be checked for validity (not string) and will be converted to numbers if nessesary
- [2023-09-09] switched from emailjs to a custom email service on http://178.254.43.96:3000/sendEmail via POST request and nodemailer

#### Fixed

- [2023-09-09] Fixed a bug, that if different questionnaires were stored from within different tabs, some data got lost
