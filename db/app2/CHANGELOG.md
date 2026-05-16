# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Last-Mile fixes for v0.2

- **3-State Drug Edit-UI in the grid editor** — clicking a numeric drug cell
  now opens an editor with a small side-toggle that flips between entering a
  value and marking the cell as "not taken / no value" (VALUEFLAG_CD='NV').
  Round-trip across the three states works:
  - value → value: UPDATE with `NVAL_NUM` set, `VALUEFLAG_CD` cleared
  - value → NV: UPDATE with `NVAL_NUM=NULL, VALUEFLAG_CD='NV'`
  - NV → value: UPDATE with `NVAL_NUM` set, `VALUEFLAG_CD` cleared
  - value → cleared: DELETE the row (back to "not assessed")
  Covered by 6 unit tests in `tests/unit/15_editable-cell-nv-state.test.js`.
- **In-App Cohort Export** — new "Export Cohort" button on every Study
  Details page opens a small dialog (CSV vs HL7-JSON), triggers
  `exportStore.exportStudyPatients(...)` which runs the same `ExportService`
  the headless CLI uses, then download via Blob. Backed by a new
  `study-repository.findEnrolledPatientCds(studyCd)` method and tested in
  `tests/unit/16_export-store-study.test.js`.
- **CHANGELOG graduation** — the v0.2_20260516 content moved out of
  `[Unreleased]` into its own versioned section below; this `[Unreleased]`
  is the clean staging area for the next release.

## [0.2_20260516] - 2026-05-16

### App version

- **`VITE_APP_VERSION` bumped to `0.2_20260516`** (from `0.1_20251219`). This
  is the first version that ships the Stroke-Lipid data model, the grid view
  improvements, and the verified export pipeline.

### Documentation

- **`AGENTS.md` renamed to `CLAUDE.md`** (full git history preserved via
  `git mv`). Aligns with the Claude Code convention. All internal references
  in `README.md`, `IMPLEMENTATION_STATUS.md`, source comments, and tests
  updated to point at the new filename.
- **New section in `CLAUDE.md`: "Building a New Visit Template"** — a
  step-by-step recipe for introducing new studies / visit-type sets. Covers
  the mental model (concepts + field sets + visit types in CODE_LOOKUP), the
  inventory questions to answer before writing code, the migration skeleton,
  self-healing upserts, importer scaffolding, and a per-step pointer back to
  the Stroke-Lipid worked example. Future studies can be set up by copying
  the recipe rather than re-deriving the pattern.

### Grid view (more)

- **Compact column widths** (50+ Stroke-Lipid columns no longer overflow on a
  standard laptop screen): text columns 150 → 90 px, date 120 → 96 px,
  numeric 100 → 72 px, medication 120 → 84 px. Header text scaled down to
  match (0.7 / 0.6 rem).
- **Focus-column mode**: clicking an observation column header expands that
  one column to 220 px with a subtle blue tint, leaving the rest of the grid
  compact. Click again to collapse, click a different header to switch.
  180 ms transition.

### Export pipeline (CSV + HL7-JSON)

- **Headless export driver** `scripts/import-fw-lipid/export.js` — runs the same
  `ExportService` the app's UI uses, against `production.db` from a Node CLI:

  ```bash
  node export.js                     # both formats, all FW_LIPID patients
  node export.js --format csv        # CSV only
  node export.js --format hl7        # HL7-JSON only
  node export.js --limit 10          # first N (smoke)
  ```

  Mounts a `RealSQLiteConnection` + the five repositories (Patient / Visit /
  Observation / Concept / Cql) and shims a minimal `DatabaseService.getRepository`
  facade so the export path runs unchanged outside the Electron/Pinia boot.

- **Artifact-level verifier** `scripts/import-fw-lipid/export-verify.js` — parses
  the export file directly (no round-trip via import service) and checks every
  cell / entry against the DB state under the same `SOURCESYSTEM_CD`. Reports
  per-cell mismatches and writes a CSV diff if any.

- **Export-side fixes** required by the verifier to make all values round-trip
  safely:
  - `CsvService.formatObservationValue`: returns `''` (empty) instead of
    `'Unknown'` for cells with no value, so re-import treats them as "no
    observation" rather than as T-type `'Unknown'`. Adds explicit handling for
    `F` / `S` (selection answer ref in `TVAL_CHAR`) and prefers `TVAL_CHAR` over
    `START_DATE` for `D` (date) observations.
  - `Hl7Service.formatObservationValue`: same treatment plus emits `[NV]` marker
    for the 3-state numeric "assessed, explicitly no value" pattern.
  - **`[NV]` round-trip marker** in both formats: `VALUEFLAG_CD='NV'` numeric
    observations now serialise to `[NV]` on export; `CsvService.createObservationFromField`
    restores `VALTYPE='N', NVAL_NUM=NULL, VALUEFLAG_CD='NV'` on re-import.
  - `Hl7Service.verifyCda`: hash is now opt-in. Documents without an attached
    hash verify as true (enables headless round-trip / interchange JSON).
    Verification is still enforced when a hash IS present.

### Verified

- Full Stroke-Lipid export verified end-to-end against `production.db`:
  - CSV: 425 patients, 1037 visit rows, 53 columns, 21 969 non-empty cells,
    47 702 cells asserted, **0 mismatches**.
  - HL7-JSON: 425 patients, 1037 visit sections, 1084 sections total,
    21 969 concept-grouped entries asserted, **0 mismatches**.
- Test suite: 723 passing, 3 skipped, 0 failures (up from 717 — added six
  Stroke-Lipid pattern tests in `tests/unit/06_csv-service.test.js` covering NV
  3-state round-trip, F/S findings via SCTID Yes/No A-refs, D-type TVAL
  preference, empty-cell fallback; one HL7 test updated to assert the new
  opt-in signature behaviour).

### Grid view improvements

- **Visit-type chip under the visit date** in the Excel-like grid. Each row now
  shows the resolved visit-type label (e.g. *Stroke-Lipid V0 — Pre-Stroke Baseline*,
  *Parkinson Verlaufskontrolle*, *Routine Check-up*) with the icon + colour pulled
  from `CODE_LOOKUP(VISIT_DIMENSION/VISIT_TYPE_CD).LOOKUP_BLOB`. Loaded once per
  grid session, no per-row DB hit.
- **Category-banded column headers**: visible observation columns are now grouped
  by `CONCEPT_DIMENSION.CATEGORY_CHAR` into a top-level header band (Demographics →
  Vital Signs → Stroke → Laboratory → Medications → …). Helper
  `groupConceptsByCategory` in `src/shared/utils/grid-utils.js` produces the
  ordering; well-known clinical categories use a fixed clinical sequence, unknown
  ones are alphabetised, "Other" trails. Per-category background tints give scan
  cues on dense (50+ column) grids.
- **3-state numeric cell rendering** in `EditableCell.vue`: cells with
  `VALUEFLAG_CD='NV'` (e.g. drug explicitly not taken) now render a small grey
  `block` icon with tooltip *"Erfasst — kein Wert (nicht eingenommen / nicht
  zutreffend)"*, visually distinct from both a value cell and an empty cell.
  Click still opens the numeric editor.
- Grid-data pipeline (`database-store.processObservationDataForGrid`) now
  enriches each row with `visitTypeCode` (parsed from `VISIT_BLOB`), each
  observation cell with `valueFlag` (`VALUEFLAG_CD`), and each concept-column
  descriptor with `category` (`CATEGORY_CHAR`). Same one-shot batch query, just
  carrying three more fields downstream.

### Tests

- `tests/unit/14_grid-utils.test.js` — 9 cases covering `groupConceptsByCategory`
  (ordering, "Other" placement, intra-category stability, unknown-category
  alphabetisation) and smoke checks for existing helpers.

### Added

- **Migration `010-stroke-lipid-seed`** — seeds the Stroke-Lipid research study:
  - 50 concepts (16 study-specific drugs, 5 missing LOINC labs, 2 SNOMED comorbidities,
    9 study findings, 2 selection concepts with 9 A-type option codes, 3 visit-type
    markers, age-at-stroke, stroke-event-date, free-text concepts for symptoms/notes).
  - 5 field sets (`lipid_drugs`, `lipid_labor`, `lipid_pre_stroke`,
    `lipid_stroke_event`, `lipid_followup`) in `CODE_LOOKUP(VISIT_DIMENSION/FIELD_SET_CD)`
    with `{concepts[], categories[]}` for hybrid frontend matching.
  - 3 visit-types (`stroke_lipid_v0/v1/v2`) in `CODE_LOOKUP(VISIT_DIMENSION/VISIT_TYPE_CD)`
    with `LOOKUP_BLOB.fieldSets[]` referencing the field-set IDs.
  - 2 `VALUEFLAG_CD` lookups (`NV` = explicit no-value, `NI` = no information).
  - 1 `STUDY_DIMENSION` row + automatic patient enrollment via `STUDY_PATIENT_LOOKUP`.
- **`VALUEFLAG_CD='NV'` 3-state pattern** for numeric observations: distinguishes
  "asked, explicitly no value" (e.g. patient not taking drug) from "not assessed"
  (no observation at all). Reusable for any numeric concept; no schema change.
- **Stroke-Lipid XLSX importer** (`scripts/import-fw-lipid/`) — isolated Node module
  that imports research master tables into `production.db` with:
  - Idempotent re-runs (`SOURCESYSTEM_CD` tag, per-patient delete-and-rewrite).
  - Full-coverage verifier `spotcheck.js` (was 2 % sample, now defaults to 100 %).
    Cell-by-cell field assertions, orphan-observation detection, study-enrollment
    check, source-row deduplication (last row wins, matching importer behaviour),
    and `_spotcheck_failures.csv` artefact on any mismatch.
  - NBSP (U+00A0) normalisation on header keys (explicit ` ` Unicode escape
    in `spotcheck.js`; `import.js` still uses a literal NBSP byte that's working
    but fragile — TODO refactor).
  - Auto-computed age-at-stroke from `BIRTH_DATE + Datum_Stroke`.

### Verified

- Full Stroke-Lipid import verified end-to-end against the Mastertabelle
  (`Mastertabelle_Franzi_LDL_Daten_20260513.xlsx`):
  - 427 unique patient IDs in source (1 duplicate `10032698`, handled correctly
    via per-patient delete-and-rewrite).
  - 425 patients in DB, 2 legitimately skipped (no `Datum_Stroke` in source).
  - 1037 visits, 21 969 observations.
  - **34 136 cell-level assertions, 0 mismatches, 0 orphan observations,
    425/425 study enrolments.**

### Changed

- **F-type Finding observations** now store their answer in `TVAL_CHAR` as an A-type
  concept reference (`SCTID: 373066001` Yes / `SCTID: 373067005` No), aligning with
  how S-type Selections work. Previously some imports stored `NVAL_NUM = 0/1`, which
  rendered as "Uncategorized" in field-set views.
- **`CONCEPT_DIMENSION.CATEGORY_CHAR`** convention clarified: always use human-readable
  labels (`'Stroke'`, `'Demographics'`, `'Laboratory'`, `'Medications'`, `'Vital Signs'`,
  `'General'`) — never `CAT_*` codes. The frontend's field-set matcher compares against
  these labels.
- **`SCTID: 371484003` (Patient name)** moved from category `'General'` to `'Demographics'`
  (was previously rendering as "Uncategorized").
- **Migration pattern** documented: idempotent migrations should use
  `INSERT ... ON CONFLICT(<key>) DO UPDATE SET ...` for fields that must always reflect
  the migration's intent (self-healing).

### Documentation

- New `CHANGELOG.md` (this file).
- `AGENTS.md` — added "Data Modelling Conventions" section covering F-type findings,
  3-state numerics, CATEGORY_CHAR labels, concept-reuse hierarchy (LOINC → SNOMED →
  custom), visit-type ↔ field-set linkage, and bulk-import tagging.
- `IMPLEMENTATION_STATUS.md` — added Stroke-Lipid migration milestone.
- `scripts/import-fw-lipid/README.md` — full documentation of the research-import
  workflow, including 3-state pattern and rollback recipes.

## Past releases

The project does not yet have tagged releases. The entries below summarise notable
changes from the recent commit history (see `git log` for full detail).

### 2026-05-12

- `feat(visits)`: merged patient search into `/visits` as a single hub.
- `chore(datagrid)`: dropped dead `fillDown*` i18n keys after revert.
- Reverted Ctrl+D fill-down and keyboard cell-navigation features in the data grid
  pending UX revisit.

### 2026-04

- `feat(datagrid)`: undo/redo for cell edits.
- `fix(datagrid)`: show patient row when no visits exist.
- `test(dbBEST)`: smoke tests for UI-prep foundation (notify, session monitor, error boundary).
- `refactor(dbBEST)`: migrated all `$q.notify` calls to `useNotify` composable.

[Unreleased]: https://github.com/JenAIx/BEST/compare/v0.2_20260516...HEAD
[0.2_20260516]: https://github.com/JenAIx/BEST/releases/tag/v0.2_20260516
