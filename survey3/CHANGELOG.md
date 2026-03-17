# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Released]

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
