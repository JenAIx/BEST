# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/your-org/best/compare/HEAD
