# FW-Lipid XLSX Importer (v2.1)

One-off importer for the Stroke-Lipid-Management research dataset.

**Source**: `tmp/import_fw_lipid_202605/2026-05-08.xlsx`
**Target DB**: `database/production.db`
**Source marker**: `SOURCESYSTEM_CD = 'FW_LIPID_XLSX_2026-05-08'` (all rows written by this importer carry this tag — used for re-runs and rollback).
**Migration**: `src/core/database/migrations/010-stroke-lipid-seed.js` (seeds all concepts, field sets, visit types, VALUEFLAG_CD codes, study row).

## v2 → v2.1 changes

- `CATEGORY_CHAR` for all CONCEPT_DIMENSION + OBSERVATION_FACT rows now uses **human-readable labels** (`'Demographics'`, `'Stroke'`, `'Medications'`, `'Laboratory'`, `'Vital Signs'`, `'General'`) instead of `CAT_*` codes. The field-set matcher (frontend) compares against these labels, so the previous `CAT_*` form made everything fall into "Uncategorized".
- The existing **`SCTID: 371484003` (Patient name)** concept was reassigned from category `'General'` to `'Demographics'` via a fix-up step in the migration.
- **Age at stroke** is now computed from `BIRTH_DATE + Datum_Stroke` rather than read from the XLSX column. More reliable (fills nulls), removes a Excel-formula dependency. Stored with `OBSERVATION_BLOB={"computed":true,"from":"BIRTH_DATE + Datum_Stroke"}` for traceability.
- The migration is now **self-healing**: on conflict it re-applies `CATEGORY_CHAR` + `NAME_CHAR` + `UNIT_CD` via `ON CONFLICT(CONCEPT_CD) DO UPDATE`. Re-running `apply-migration.js` corrects category drift even after the migration row already exists. `--force` flag drops the migration row first.

## v1 → v2 changes

| v1 | v2 |
|---|---|
| Seed via in-script `seed.js` | Proper migration `010-stroke-lipid-seed.js` (registered in `database-service.js`) |
| V0 = V1 date | V0 = `Datum_Stroke − 1 day` (proper timeline order) |
| V1 carried comorbidities + vitals + etiology | V0 carries pre-stroke baseline (comorbidities, vitals, etiology, prior-infarct, stroke event date, age-at-stroke) |
| Custom `STROKE_LIPID:LAB:*` concepts | Reuse existing LOINC/SNOMED codes (`LID:`, `SCTID:`) where present, add only missing LOINCs (ASAT, ALAT, HbA1c IFCC, Lp(a), GFR) |
| F-Findings: `NVAL_NUM = 0/1` | F-Findings: `TVAL_CHAR = SCTID:373066001` (Yes) / `SCTID:373067005` (No) |
| Drug dose 0 → obs with NVAL_NUM=0 | Drug dose 0 → **3-state**: obs with `NVAL_NUM=NULL`, `UNIT_CD='mg'`, `VALUEFLAG_CD='NV'`, `OBSERVATION_BLOB={"explicit":true,"sourceValue":0}` |
| No field sets | 5 field sets: `lipid_drugs`, `lipid_labor`, `lipid_pre_stroke`, `lipid_stroke_event`, `lipid_followup` |
| Visit type was plain text | Visit type `LOOKUP_BLOB` carries `fieldSets: [{id, name, active}]` per `007-parkinson-visit-types.js` pattern |
| `Alter zum Zeitpunkt Stroke` read from XLSX | Computed from `BIRTH_DATE + Datum_Stroke` |

## 3-state pattern for medications

Three distinct semantic states are kept, all on the same drug concept (`STROKE_LIPID:DRUG:ATORVASTATIN` etc.):

| XLSX cell | DB | UI rendering hint |
|---|---|---|
| `40` (positive number) | `NVAL_NUM=40, UNIT_CD='mg'` | Numeric input with value |
| `0` (explicit "not taking") | `NVAL_NUM=NULL, UNIT_CD='mg', VALUEFLAG_CD='NV', OBSERVATION_BLOB={"explicit":true,"sourceValue":0}` | Checkbox "not taking" set |
| empty / `n.a.` / `unklar` | **no observation** | Field empty (= "not assessed") |

`VALUEFLAG_CD='NV'` is defined in `CODE_LOOKUP` (`TABLE_CD='OBSERVATION_FACT', COLUMN_CD='VALUEFLAG_CD'`). HL7v3 nullFlavor mapping: `NV ~ NP` (not present, asked). Reusable for any future numeric concept that needs the same 3-state semantics.

**Frontend implication** (not part of this importer): the medication field-set renderer should branch on
`if (NVAL_NUM != null) → number input` / `if (VALUEFLAG_CD == 'NV') → "not taking" checkbox` / `else → empty`.

## Visit semantics (v2)

| Visit | LOCATION_CD       | INOUT_CD | START_DATE              | Content |
|-------|-------------------|----------|-------------------------|---------|
| V0    | `Neurology Clinic`| I        | `Datum_Stroke − 1 day`  | Patient name, **stroke event date (D-type)**, pre-stroke vitals (`Gewicht_kg`→SCTID:27113001, `Groesse_cm`→SCTID:1153637007), age-at-stroke, **etiology (S)**, **7 comorbidities (F, Yes/No)**, **V0 drugs (3-state)** |
| V1    | `Neurology Clinic`| I        | `Datum_Stroke`          | Event type (Stroke/TIA/ZAV), **8 lab values (LIDs)**, **V1 drugs (3-state)**, statin intolerance, new-med flag, dose-increased flag |
| V2    | `Neurology Clinic`| O        | `V2_Datum`              | Re-infarct, new-med flag V2, dose-increased flag V2, our-clinic flag, **V2 labs**, **V2 drugs (3-state)** |

`VISIT_BLOB` carries `{visitType, study, fieldSets: [...], createdBy, createdAt}`.

## Concept references (reused from existing seed)

| XLSX field | Reused concept | VALTYPE | Unit |
|---|---|---|---|
| Patient name | `SCTID: 371484003` | T | — |
| Gewicht_kg | `SCTID: 27113001` (Body weight) | N | kg |
| Groesse_cm | `SCTID: 1153637007` (Body height) | N | cm |
| VHF | `SCTID: 49436004` (Atrial fibrillation) | F | — |
| AH | `SCTID: 38341003` (Hypertensive disorder) | F | — |
| Eventrecorder | `SCTID: 1179808003` (Implantable loop recorder) | F | — |
| LDL_V1/V2 | `LID: 22748-8` | N | mmol/l |
| HDL_V1/V2 | `LID: 14646-4` | N | mmol/l |
| Triglyceride_V1/V2 | `LID: 14927-8` | N | mmol/l |
| Yes/No answer | `SCTID: 373066001` / `SCTID: 373067005` | A | — |

## Concept references (newly seeded via migration 010)

LOINC: `LID: 1920-8` (ASAT), `LID: 1742-6` (ALAT), `LID: 59261-8` (HbA1c IFCC mmol/mol), `LID: 10835-7` (Lp(a)), `LID: 33914-3` (eGFR).
SNOMED: `SCTID: 84114007` (Heart failure), `SCTID: 73211009` (Diabetes mellitus).
Custom: 16 `STROKE_LIPID:DRUG:*`, `STROKE_LIPID:STROKE_EVENT_DATE` (D-type), `STROKE_LIPID:AGE_AT_STROKE` (N), 9 study-specific findings, 2 selection concepts + 9 A-type options.

## Commands

```bash
cd scripts/import-fw-lipid

node apply-migration.js                # Apply 010-stroke-lipid-seed (idempotent)
node inspect.js                        # Inventory XLSX → _inspect/
node import.js --only 11223280         # Test single patient
node import.js --limit 10              # First 10 patients
node import.js                         # Full 164 patients
node verify.js                         # Global counts + Top concepts
node verify.js --sample 20015823       # Spot-check one patient
node import.js --dry                   # Parse-only, no writes
```

CLI flags: `--xlsx <path>`, `--db <path>`, `--limit <n>`, `--only <PATIENT_CD>`, `--dry`.

## Edge-case handling

- **PLZ**: 4-digit numbers get zero-padded to 5 (`7743 → '07743'`).
- **NBSP in headers**: `Alirocumab/ Praluent_V1` actually contains U+00A0 in source. Importer normalises all row keys (NBSP → space) on read.
- **Censored lab values** (`<20`, `<77.6`): kept as numeric lower bound with `OBSERVATION_BLOB={"censored":"left-censored","raw":"<20"}`.
- **Comma decimals**: `1,25` → `1.25`.
- **Date `LDL_Datum_V2`**: overrides observation `START_DATE` for the LDL_V2 observation if set, else defaults to `V2_Datum`.

## Re-runs

Fully idempotent.

- **Migration**: tracked by `name` in `migrations` table; `apply-migration.js` skips if already applied.
- **Patient data**: each `import.js` run deletes prior rows for each touched patient (matched by `PATIENT_NUM + SOURCESYSTEM_CD`) before re-inserting.

To fully roll back:

```sql
DELETE FROM OBSERVATION_FACT  WHERE SOURCESYSTEM_CD = 'FW_LIPID_XLSX_2026-05-08';
DELETE FROM VISIT_DIMENSION   WHERE SOURCESYSTEM_CD = 'FW_LIPID_XLSX_2026-05-08';
DELETE FROM STUDY_PATIENT_LOOKUP WHERE STUDY_NUM = (SELECT STUDY_NUM FROM STUDY_DIMENSION WHERE STUDY_CD = 'STROKE_LIPID');
DELETE FROM PATIENT_DIMENSION WHERE SOURCESYSTEM_CD = 'FW_LIPID_XLSX_2026-05-08';
-- migration-level concepts/lookups stay (they're part of the seed):
DELETE FROM STUDY_DIMENSION   WHERE STUDY_CD = 'STROKE_LIPID';
DELETE FROM CONCEPT_DIMENSION WHERE SOURCESYSTEM_CD = 'STROKE_LIPID_MIGRATION';
DELETE FROM CODE_LOOKUP       WHERE SOURCESYSTEM_CD = 'STROKE_LIPID_MIGRATION';
DELETE FROM migrations        WHERE name = '010-stroke-lipid-seed';
```

Pre-import safety backup at `database/production.db.pre_stroke_lipid_*`.

## Layout

```
scripts/import-fw-lipid/
  package.json
  apply-migration.js  # one-shot: run migration 010 via better-sqlite3
  inspect.js          # cell-level inventory (writes _inspect/)
  parsers.js          # date/PLZ/sex/finding/dose/etiology parsers
  mapping.js          # single source of truth: XLSX column → concept + visit
  import.js           # main: XLSX → DB
  verify.js           # counts, distributions, sample patient cross-check
  _inspect/           # output of inspect.js
  node_modules/       # isolated: xlsx + better-sqlite3
```

## Stats from the v2.1 production run

```
patients: 164
visits:   365   (V0:164  V1:164  V2:37)
obs:      9410
  by type:     N:7102  T:164  F:1652  S:328  D:164
  by category: Medications:5390  Stroke:2308  Laboratory:1387  Demographics:164  Vital Signs:161
  drugs:       taking=714  not_taking=4676  unknown=48
  age:         164 patients, min=29  max=94  mean=70.0 years (all auto-computed)
elapsed:  57 ms
```

Clinical sanity: mean LDL drops V1 → V2 from 2.74 → 1.80 mmol/l (n=162 → 27).
