# CLAUDE.md - Quick Reference Guide for AI Assistants

> **Purpose**: This file provides essential information about the BEST application architecture, database, users, and main pages for quick reference during development and debugging. *(Renamed from `AGENTS.md` in May 2026 to align with the Claude Code convention; same content, plus the new "Building a New Visit Template" recipe.)*

---

## 📁 Project Overview

**BEST - Scientific DB Manager**  
A modern research database for neuroscientific data built with Vue 3, Quasar, and SQLite.

- **Architecture**: Clean MVC (Model-View-Controller) pattern
- **Frontend**: Vue 3 + Quasar + Pinia stores
- **Database**: SQLite with star schema design
- **Language**: Dual German/English with Vue I18n
- **Testing**: 326+ tests with 100% pass rate

---

## 🗄️ Database Access

### Database Location

```
./database/production.db
```

### Direct SQLite3 Access

You can directly query the database using sqlite3 command line:

```bash
# Open database
sqlite3 ./database/production.db

# List all tables
.tables

# Show table schema
.schema USER_MANAGEMENT
.schema PATIENT_DIMENSION
.schema USER_PATIENT_LOOKUP

# Query users
SELECT USER_ID, USER_CD, NAME_CHAR, COLUMN_CD FROM USER_MANAGEMENT;

# Query patients
SELECT PATIENT_NUM, PATIENT_CD, AGE_IN_YEARS, SEX_CD FROM PATIENT_DIMENSION LIMIT 10;

# Query user-patient associations
SELECT u.USER_CD, u.NAME_CHAR, p.PATIENT_CD, upl.USER_PATIENT_ID
FROM USER_PATIENT_LOOKUP upl
JOIN USER_MANAGEMENT u ON upl.USER_ID = u.USER_ID
JOIN PATIENT_DIMENSION p ON upl.PATIENT_NUM = p.PATIENT_NUM;

# Count records
SELECT
  (SELECT COUNT(*) FROM PATIENT_DIMENSION) as patients,
  (SELECT COUNT(*) FROM VISIT_DIMENSION) as visits,
  (SELECT COUNT(*) FROM OBSERVATION_FACT) as observations,
  (SELECT COUNT(*) FROM USER_MANAGEMENT) as users;

# Exit
.quit
```

### Connection Flow

```
LoginPage → AuthStore → DatabaseStore → DatabaseService → SQLite Connection
```

### Main Database Classes

- **`src/stores/database-store.js`** - Pinia store for database state
- **`src/core/services/database-service.js`** - Database service coordination
- **`src/core/database/sqlite/electron-connection.js`** - Electron SQLite connection
- **`src/core/database/sqlite/real-connection.js`** - Real SQLite3 connection
- **`src-electron/electron-preload.js`** - Electron bridge for database operations

### Database Schema (Star Schema)

#### Core Tables

```
PATIENT_DIMENSION        - Patient demographics and metadata
VISIT_DIMENSION          - Patient encounters and visits (FK: PATIENT_NUM)
OBSERVATION_FACT         - Clinical observations (Central Fact Table)
                          FK: PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD
CONCEPT_DIMENSION        - Medical concepts (SNOMED/LOINC) - 611 seeded records
PROVIDER_DIMENSION       - Healthcare providers and hierarchy
CODE_LOOKUP              - Reference data and lookups
USER_MANAGEMENT          - User authentication and permissions (4 seeded users)
CQL_FACT                 - Clinical Quality Language rules - 8 seeded rules
CONCEPT_CQL_LOOKUP       - Concept-rule relationships (M:N)
```

#### Key Relationships

```
PATIENT (1) ──────┬─────► (N) VISITS
                  │
                  ├─────► (N) OBSERVATIONS
                  │
                  └─────► (N) NOTES

VISIT (1) ────────────────► (N) OBSERVATIONS

CONCEPT (1) ───────────────► (N) OBSERVATIONS

USER (M) ◄──────► (N) PATIENT    [via USER_PATIENT_LOOKUP]
STUDY (M) ◄─────► (N) PATIENT    [via STUDY_PATIENT_LOOKUP]
CONCEPT (M) ◄───► (N) CQL_RULES  [via CONCEPT_CQL_LOOKUP]

CASCADE DELETE:
  Delete Patient → Manual delete USER_PATIENT_LOOKUP (no CASCADE)
               → Auto-deletes Visits, Observations, Notes, Study Enrollments (CASCADE)
  Delete Visit → Auto-deletes related Observations
  Delete Study → Auto-deletes Enrollments
```

#### Supporting Tables

```
STUDY_DIMENSION          - Research study metadata
STUDY_PATIENT_LOOKUP     - Patient-study enrollment relationships
USER_PATIENT_LOOKUP      - User-patient access control (who can see which patients)
patient_list (VIEW)      - Materialized patient view with resolved codes
```

### User-Patient Access Control

The system uses **`USER_PATIENT_LOOKUP`** table for fine-grained access control:

```sql
CREATE TABLE USER_PATIENT_LOOKUP (
  USER_PATIENT_ID INTEGER PRIMARY KEY,
  USER_ID INTEGER NOT NULL,           -- Links to USER_MANAGEMENT
  PATIENT_NUM INTEGER NOT NULL,       -- Links to PATIENT_DIMENSION
  NAME_CHAR TEXT,                     -- Optional description
  USER_PATIENT_BLOB TEXT,             -- Additional metadata (JSON)
  UPDATE_DATE TEXT,
  FOREIGN KEY (PATIENT_NUM) REFERENCES PATIENT_DIMENSION(PATIENT_NUM),
  FOREIGN KEY (USER_ID) REFERENCES USER_MANAGEMENT(USER_ID)
);
```

**Purpose**: Controls which users can access which patients (not currently enforced in UI, but schema ready)

**Example Queries**:

```sql
-- Get all patients accessible to a specific user
SELECT p.* FROM PATIENT_DIMENSION p
JOIN USER_PATIENT_LOOKUP upl ON p.PATIENT_NUM = upl.PATIENT_NUM
WHERE upl.USER_ID = 1;

-- Get all users who can access a specific patient
SELECT u.* FROM USER_MANAGEMENT u
JOIN USER_PATIENT_LOOKUP upl ON u.USER_ID = upl.USER_ID
WHERE upl.PATIENT_NUM = 42;

-- Grant user access to patient
INSERT INTO USER_PATIENT_LOOKUP (USER_ID, PATIENT_NUM, NAME_CHAR, UPDATE_DATE)
VALUES (1, 42, 'Access granted for study XYZ', datetime('now'));
```

**Current Implementation Status**:

- ✅ Table exists in schema
- ✅ Repository methods available (`UserRepository.getUserWithPatientAccess()`)
- ✅ Store methods available (`userStore.createUserPatientAssociation()`)
- ✅ **FULLY IMPLEMENTED** - User-based access control is now active!
- ✅ Auto-assignment: New patients automatically assigned to creator
- ✅ Repository-level filtering: Regular users see only their patients
- ✅ Admin bypass: Admins see all patients
- ✅ Admin UI: `/users` → "Patient Access" tab for management
- ✅ All query paths secured: pagination, search, direct lookup
- ✅ Bug fixed: Consistent filtering across all methods (2025-12-30)
- ✅ Public-by-default: CreatePatientDialog has a "Public" toggle (default ON) —
  public patients get an additional lookup row with `USER_ID = 0` (public user),
  which every access-filtered query treats as "visible to all users"
- ✅ Owner semantics: the creator row is the lookup entry with
  `NAME_CHAR = 'Creator access - auto-assigned'` (written by
  `database-store.createPatient`); UI resolves owner/public via
  `UserPatientLookupRepository.getPatientAccessInfo(patientNums)` (batch)
- ✅ Migration 012 backfills `USER_ID = 0` access for every patient without any
  lookup row (e.g. bulk imports), idempotent via `NOT EXISTS`
- ✅ UI lookups use `PatientRepository.findAccessiblePatientByCode` /
  `findAccessiblePatientsByCodes` / `dbStore.getAccessiblePatientByCode` —
  `findByPatientCode` stays unfiltered for internal checks (duplicate
  detection on create) and must not be used for user-facing lists (2026-07-14)
- ✅ Single source of the access predicate: `PatientRepository.getAccessFilter(userAccess)`
  returns `{join, condition, param}` (or null for admins) — every filtered
  query composes from it; never inline the UPL join by hand. For list queries
  in components, always call the `dbStore` wrappers (`getPatientsPaginated`,
  `getAccessiblePatientByCode`), never `patientRepo.*` directly — the repo
  methods don't resolve the auth context themselves
- ✅ Every patient-creating path MUST write access rows: interactive creation
  via `database-store.createPatient` (creator + optional public), imports via
  `database-import-service.assignPatientAccess` (creator + public by default),
  demo data via public row. A patient without any UPL row is invisible to all
  regular users
- ✅ Deletion policy: only admins or the patient's creator may delete a patient
  (guard in `database-store.deletePatient`; dashboard hides the button for
  others). Public visibility alone does NOT grant deletion
- ✅ Study enrolment lists are access-filtered too:
  `dbStore.getEnrolledPatientsForStudy(studyId)` (regular users only see
  enrolled patients they may access)

**Relationship Diagram**:

```
USER_MANAGEMENT                USER_PATIENT_LOOKUP               PATIENT_DIMENSION
┌──────────────┐              ┌──────────────────┐              ┌──────────────┐
│ USER_ID (PK) │◄─────────────│ USER_ID (FK)     │              │ PATIENT_NUM  │
│ USER_CD      │              │ PATIENT_NUM (FK) │─────────────►│ (PK)         │
│ NAME_CHAR    │              │ NAME_CHAR        │              │ PATIENT_CD   │
│ PASSWORD     │              │ USER_PATIENT_BLOB│              │ AGE, SEX, etc│
│ COLUMN_CD    │              └──────────────────┘              └──────────────┘
│ (role)       │                     (M:N)
└──────────────┘              Many users can access
  (4 seeded)                  many patients
```

### Study-Patient Enrollment

Similar M:N relationship via **`STUDY_PATIENT_LOOKUP`** table:

```sql
CREATE TABLE STUDY_PATIENT_LOOKUP (
  STUDY_PATIENT_ID INTEGER PRIMARY KEY,
  STUDY_NUM INTEGER NOT NULL,         -- Links to STUDY_DIMENSION
  PATIENT_NUM INTEGER NOT NULL,       -- Links to PATIENT_DIMENSION
  ENROLLMENT_DATE TEXT,
  WITHDRAWAL_DATE TEXT,
  ENROLLMENT_STATUS_CD TEXT,          -- 'active', 'withdrawn', 'completed'
  STUDY_PATIENT_BLOB TEXT,
  FOREIGN KEY (STUDY_NUM) REFERENCES STUDY_DIMENSION(STUDY_NUM) ON DELETE CASCADE,
  FOREIGN KEY (PATIENT_NUM) REFERENCES PATIENT_DIMENSION(PATIENT_NUM) ON DELETE CASCADE,
  UNIQUE(STUDY_NUM, PATIENT_NUM)      -- One enrollment per patient per study
);
```

**Example Queries**:

```sql
-- Get all patients enrolled in a study
SELECT p.*, spl.ENROLLMENT_STATUS_CD, spl.ENROLLMENT_DATE
FROM PATIENT_DIMENSION p
JOIN STUDY_PATIENT_LOOKUP spl ON p.PATIENT_NUM = spl.PATIENT_NUM
WHERE spl.STUDY_NUM = 1 AND spl.ENROLLMENT_STATUS_CD = 'active';

-- Get all studies a patient is enrolled in
SELECT s.*, spl.ENROLLMENT_DATE, spl.ENROLLMENT_STATUS_CD
FROM STUDY_DIMENSION s
JOIN STUDY_PATIENT_LOOKUP spl ON s.STUDY_NUM = spl.STUDY_NUM
WHERE spl.PATIENT_NUM = 42;

-- Enroll patient in study
INSERT INTO STUDY_PATIENT_LOOKUP (STUDY_NUM, PATIENT_NUM, ENROLLMENT_DATE, ENROLLMENT_STATUS_CD)
VALUES (1, 42, date('now'), 'active');
```

### Key Database Operations

```javascript
// Initialize database
await dbStore.initializeDatabase('./database/production.db')

// Get repository
const patientRepo = dbStore.getRepository('patient')
const visitRepo = dbStore.getRepository('visit')
const observationRepo = dbStore.getRepository('observation')

// Execute queries
const result = await dbStore.executeQuery(sql, params)
```

---

## 📐 Data Modelling Conventions

These are project-wide invariants that ALL new concepts/observations/migrations must
follow. They were established as the codebase grew (most recently solidified by the
Stroke-Lipid research import, May 2026); see `CHANGELOG.md` for history.

### 1. `CATEGORY_CHAR` uses human-readable labels — not `CAT_*` codes

Both `CONCEPT_DIMENSION.CATEGORY_CHAR` and `OBSERVATION_FACT.CATEGORY_CHAR` store the
**display label** (`'Stroke'`, `'Demographics'`, `'Laboratory'`, `'Medications'`,
`'Vital Signs'`, `'General'`, …). The codes (`CAT_STROKE`, `CAT_MEDICATIONS`, …) are
only valid in `CODE_LOOKUP(CONCEPT_DIMENSION/CATEGORY_CHAR)` as `CODE_CD` keys mapping
to the labels.

**Why**: the frontend's field-set matcher compares `FieldSet.categories[]` (human
labels in `LOOKUP_BLOB`) against `CONCEPT_DIMENSION.CATEGORY_CHAR` directly. Concepts
stored with `CAT_*` codes fall through to "Uncategorized" because the labels don't match.

```sql
-- ✅ correct
INSERT INTO CONCEPT_DIMENSION (..., CATEGORY_CHAR) VALUES (..., 'Laboratory');
-- ❌ wrong — will appear as "Uncategorized" in the UI
INSERT INTO CONCEPT_DIMENSION (..., CATEGORY_CHAR) VALUES (..., 'CAT_LABORATORY');
```

### 2. F-Type Findings store answers in `TVAL_CHAR`, not `NVAL_NUM`

For VALTYPE `F` (Finding) observations, the Yes/No answer is recorded as a reference
to an A-type concept in `TVAL_CHAR` — analogous to how S-type Selections work.

```javascript
// Yes (= 1, "patient has hypertension")
TVAL_CHAR = 'SCTID: 373066001'  // Yes (A-type)
NVAL_NUM  = NULL

// No (= 0, "patient does NOT have hypertension")
TVAL_CHAR = 'SCTID: 373067005'  // No (A-type)
NVAL_NUM  = NULL
```

The two answer concepts (already seeded) are:

- `SCTID: 373066001` — "Yes" (VALTYPE `A`)
- `SCTID: 373067005` — "No" (VALTYPE `A`)

### 3. `VALUEFLAG_CD` state machine (3-state numerics + audit workflow)

`OBSERVATION_FACT.VALUEFLAG_CD` is a single-value enum that encodes both the
3-state numeric pattern and the audit workflow. **The flag values are mutually
exclusive** — a cell is in exactly one state at a time.

**3-state numeric** (`NV` — added by migration 010, intended for numerics):

| Semantic state | DB representation |
|---|---|
| Measured (value present) | `NVAL_NUM = 40`, `UNIT_CD = 'mg'`, `VALUEFLAG_CD = NULL` |
| Explicitly no value (asked + negative) | `NVAL_NUM = NULL`, `UNIT_CD = 'mg'`, `VALUEFLAG_CD = 'NV'`, `OBSERVATION_BLOB = {"explicit":true}` |
| Not assessed (unknown) | **No observation row at all** |

`NV` is registered in `CODE_LOOKUP(OBSERVATION_FACT/VALUEFLAG_CD)` with HL7v3
nullFlavor mapping `~ NP`. Use this pattern for medications
(taking/not-taking/unknown), labs where "explicitly not measured" is meaningful,
or any other numeric where zero and missing differ in meaning.

**Audit workflow** (`AUDIT` / `CONFIRMED` — added by migration 011):

| Semantic state | DB representation | UI |
|---|---|---|
| Needs review | value present, `VALUEFLAG_CD = 'AUDIT'` | 2px red cell border, footer chip "Audits offen: N" |
| Reviewed / OK | value present, `VALUEFLAG_CD = 'CONFIRMED'` | 1px green cell border |

These cover any value type (not just numerics) — useful when a reviewer wants
to flag a data point for discussion without changing the value, and later
record that it was reviewed. The "Audits offen" footer chip in the
Datentabellen-Editor (`GridFooter.vue`) doubles as a one-click filter that
hides every column/row without an open audit (`data-grid-store.auditFilterActive`).

**State transitions** — `data-grid-store.setObservationFlag({observationId, flag})`
is the single entry point:

- `flag='AUDIT'` / `'CONFIRMED'` — flips the flag, value untouched.
- `flag='NV'` — flips to NV **and** clears `NVAL_NUM` + `TVAL_CHAR` (so "no value" really is no value).
- `flag=null` — clears the flag, value untouched.

Direct value edits via `EditableCell.updateObservation` also write
`VALUEFLAG_CD = null` whenever a real numeric value is entered, so any prior
NV/AUDIT/CONFIRMED state is cleared automatically (see test
`tests/unit/15_editable-cell-nv-state.test.js`, case "value → value").

**Invariant — every save MUST propagate `valueFlag` to the grid's local state.**
`EditableCell.emit('update', {..., valueFlag})` carries the new flag back to
`data-grid-store.handleCellUpdate`, which mirrors it into
`row.observations[code].valueFlag`. Without this, an inline NV-toggle would
write `VALUEFLAG_CD='NV'` to the DB but the cell would re-render as empty
(stale `valueFlag=null` in local state) until a full grid reload. The store
actions that bypass the editor (`setObservationFlag`,
`deleteObservationFromGrid`) maintain this invariant themselves.

UI hint: in the Excel-like grid, render checkbox "no value" when
`VALUEFLAG_CD='NV'`, number input when `NVAL_NUM != NULL`, empty field when
no observation exists, red border for `'AUDIT'`, green border for `'CONFIRMED'`.

**Per-observation date** — `OBSERVATION_FACT.START_DATE` defaults to the parent
visit's `START_DATE` on INSERT, but can diverge per observation (e.g. a lab
drawn on a different day). The grid exposes this via the right-click menu
("Datum bearbeiten" / "Auf Visitendatum zurücksetzen"). Same propagation
invariant as `valueFlag`: every save MUST carry `startDate` back to the grid's
local state. `EditableCell.emit('update', {..., startDate})` →
`data-grid-store.handleCellUpdate` mirrors it. Cells where
`obs.startDate !== row.visitDate` render a small calendar corner badge so
users can see divergence without opening the menu.

### 3b. R-Type (raw file) observations

Files attached to a visit (upload area on `/visits/:id`, R-fields in the data
entry) are stored as `VALTYPE_CD='R'` observations with this convention:

- `TVAL_CHAR` = JSON envelope `{filename, size, ext, uploadDate, mimeType}`
- `OBSERVATION_BLOB` = the raw file bytes (Uint8Array, NOT base64)
- other value columns null, `SOURCESYSTEM_CD='FILE_UPLOAD'`, max 50 MB

The ONLY write/read paths are `database-store.uploadRawData` /
`downloadRawData` / `getRawDataInfo` (metadata without blob). Viewer:
`FilePreviewDialog.vue` (image/text/pdf/video). List queries must never
SELECT `OBSERVATION_BLOB`. Do NOT follow the conflicting (dead) convention in
`src/utils/observation-transformer.js`.

Raw-file concepts (all `CATEGORY_CHAR='Raw Data'`): `CUSTOM: RAW_DATA`
(generic), `RAW_IMAGE`, and from migration 014 `RAW_VIDEO`, `RAW_DOCUMENT`,
`RAW_CONSENT`. The upload dialog suggests one via
`src/shared/utils/file-category.js` (extension map; file names matching
/aufkl|consent|einwillig/i win as consent).

### 4. Concept reuse hierarchy

Before creating a `CUSTOM:` or domain-prefixed concept, walk this hierarchy:

1. **LOINC** (`LID: <code>`) — labs and observations. Search by name in
   `CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'LID:%'`.
2. **SNOMED CT** (`SCTID: <code>`) — findings, anatomy, conditions, devices.
   Search `CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'SCTID:%'`.
3. **ICD-10** (`ICD10: <code>`) — diagnoses if you need ICD specifically.
4. **Existing custom seed** — check the seed CSVs in
   `src/core/database/seeds/concept_dimension_data.csv`.
5. Only then create a new study-specific concept (`<DOMAIN>:CATEGORY:KEY`,
   e.g. `STROKE_LIPID:DRUG:ATORVASTATIN`).

This keeps concept reuse high across studies and ensures interoperability with
external systems.

### 5. Visit-Type ↔ Field-Set linkage pattern

Visit types live in `CODE_LOOKUP(VISIT_DIMENSION/VISIT_TYPE_CD)` and carry a
`LOOKUP_BLOB.fieldSets[]` array referencing field-set IDs by their `CODE_CD`:

```json
{
  "label": "Stroke-Lipid V1 - Index Stroke",
  "icon": "emergency", "color": "red",
  "fieldSets": [
    { "id": "lipid_stroke_event", "name": "Stroke Event",    "active": true },
    { "id": "lipid_labor",        "name": "Laboratory",      "active": true },
    { "id": "lipid_drugs",        "name": "Lipid Medications","active": true }
  ]
}
```

Field sets live in `CODE_LOOKUP(VISIT_DIMENSION/FIELD_SET_CD)` and carry
`LOOKUP_BLOB.{concepts[], categories[]}` for hybrid matching:

```json
{
  "description": "Lipid panel + HbA1c + ASAT/ALAT + GFR + Lp(a)",
  "icon": "science",
  "concepts": ["LID: 22748-8", "LID: 14646-4", ...],
  "categories": ["Laboratory"]
}
```

The frontend uses both: a concept matches the field-set if its code appears in
`concepts[]`, OR its `CATEGORY_CHAR` appears in `categories[]`. This is why the
CATEGORY_CHAR label convention (rule #1) matters.

When introducing a new visit type, follow the migration pattern of
`007-parkinson-visit-types.js` / `010-stroke-lipid-seed.js`.

### 6. Bulk-import / re-import pattern

For any non-trivial bulk data import (XLSX/CSV/JSON):

- **Tag every row** with `SOURCESYSTEM_CD = '<UNIQUE_TAG>'` across all four
  tables (`PATIENT_DIMENSION`, `VISIT_DIMENSION`, `OBSERVATION_FACT`,
  `STUDY_PATIENT_LOOKUP`). Enables surgical rollback:

  ```sql
  DELETE FROM OBSERVATION_FACT WHERE SOURCESYSTEM_CD = '<TAG>';
  DELETE FROM VISIT_DIMENSION  WHERE SOURCESYSTEM_CD = '<TAG>';
  DELETE FROM PATIENT_DIMENSION WHERE SOURCESYSTEM_CD = '<TAG>';
  ```

- **Per-patient delete-and-rewrite** for idempotent re-runs: before inserting,
  `DELETE FROM <table> WHERE PATIENT_NUM = ? AND SOURCESYSTEM_CD = ?`.
- **Compute derived values** rather than reading from source where possible
  (e.g. age from `BIRTH_DATE + event_date`). Mark with
  `OBSERVATION_BLOB.computed = true` for traceability.
- **Normalise XLSX header keys** for U+00A0 (NBSP) — German Excel exports
  frequently contain NBSPs in column headers (e.g. `"Alirocumab/ Praluent_V1"`).
  Use an explicit ` ` regex.

The Stroke-Lipid importer in `scripts/import-fw-lipid/` is the reference
implementation.

### 7. Self-healing migrations

Migrations that **only insert** should use `INSERT OR IGNORE`. Migrations that
need to correct prior state (e.g. category labels written incorrectly by an
earlier run) should use `INSERT ... ON CONFLICT(<key>) DO UPDATE SET …`:

```sql
INSERT INTO CONCEPT_DIMENSION (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, ...)
VALUES (?, ?, ?, ...)
ON CONFLICT(CONCEPT_CD) DO UPDATE SET
  NAME_CHAR     = excluded.NAME_CHAR,
  CATEGORY_CHAR = excluded.CATEGORY_CHAR,
  UPDATE_DATE   = excluded.UPDATE_DATE;
```

For one-off fix-ups of existing rows that this migration doesn't own, add explicit
`UPDATE` statements after the upserts (see `010-stroke-lipid-seed.js`'s
`categoryFixups` block — that's how `SCTID: 371484003` was moved from `'General'`
to `'Demographics'`).

---

## 🌿 Git Strategy

Lightweight, predictable. Three layers of branches:

```
main          ← stable releases only. Tagged. Never receive direct commits.
  │
  └── development    ← the integration trunk. All feature work flows here.
        │
        ├── features/<topic>     ← short-lived feature branches
        ├── features/<other>     ← started off the current development tip
        └── fixes/<topic>        ← bugfix branches use the same rules
```

### Rules

1. **`development` is the working trunk.** Every change starts here. When you
   begin a new feature, `git checkout development && git pull && git checkout
   -b features/<topic>`. Don't branch off `main` and don't branch off another
   feature branch.

2. **Feature branches stay short-lived.** Aim for days, not weeks. Merge back
   into `development` as soon as the feature is self-consistent and tested
   (full vitest suite green, lint clean). Long-running feature branches drift
   and accumulate merge cost.

3. **Merge into `development` with `--no-ff`** so each feature shows up as a
   single merge commit in `git log --oneline development`. Makes it easy to
   read history and to revert a whole feature with one revert. Squash only
   for tiny / experimental branches where the intermediate commits add no
   value.

4. **`main` only receives merges from `development`**, never from a feature
   branch directly. The promotion happens when `development` is stable
   (suite green, manual smoke pass, CHANGELOG up to date). Tag the resulting
   merge commit on `main` with the version from `.env`
   (e.g. `v0.2_20260516`).

5. **No force-push to `development` or `main`.** Feature branches you own
   may be force-pushed during rebase. Once a feature branch is merged, leave
   it as-is — it's history.

6. **CHANGELOG entries go under `[Unreleased]`** while feature work is in
   progress. The promotion to `main` is the right moment to cut a new
   versioned section in CHANGELOG.

### Standard flow

```bash
# Start a new feature
git checkout development
git pull
git checkout -b features/my-feature

# … work, commit, push …
git push -u origin features/my-feature

# When stable, merge back to development (locally or via PR)
git checkout development
git pull
git merge --no-ff features/my-feature -m "Merge branch 'features/my-feature' into development

<summary of what landed>"
git push origin development

# When development is stable enough to release, promote to main
git checkout main
git pull
git merge --no-ff development -m "Release v<X.Y_YYYYMMDD>"
git tag v<X.Y_YYYYMMDD>
git push origin main --tags
```

### Where to find the current state

- `git log --oneline development -20` — recent integration history.
- `git log --oneline main -10`         — release history.
- `git branch -a`                       — live feature branches.
- `CHANGELOG.md` `[Unreleased]`         — what's queued for the next release.

---

## 🩺 Building a New Visit Template

This is the project's reference recipe for introducing a new study or
visit-type set into the system. It captures every decision that went into the
Stroke-Lipid implementation (May 2026) so the next study can be set up in an
afternoon instead of a sprint. Concrete files referenced here:

- Migration template: `src/core/database/migrations/010-stroke-lipid-seed.js`
- Importer template:  `scripts/import-fw-lipid/` (mapping, parsers, import, verify)
- Earlier templates:  `007-parkinson-visit-types.js`, `006-fieldset-categories.js`

### The mental model

A "visit template" in BEST is the combination of **four artefacts** in
`CODE_LOOKUP` + `CONCEPT_DIMENSION` that together tell the UI how to render a
new kind of visit:

```
CONCEPT_DIMENSION
  └─ N concept rows (drugs, labs, findings, selections + A-type options, date, …)
        with CATEGORY_CHAR set to a human-readable label

CODE_LOOKUP (TABLE_CD='VISIT_DIMENSION')
  ├─ COLUMN_CD='VISIT_TYPE_CD'  → one row per visit type
  │      LOOKUP_BLOB = { label, icon, color, fieldSets:[{id,name,active}] }
  └─ COLUMN_CD='FIELD_SET_CD'   → one row per field set referenced above
         LOOKUP_BLOB = { description, icon, concepts:[…], categories:[…] }

STUDY_DIMENSION
  └─ optional: one row that identifies the study, used for patient enrolment
```

When a user creates a visit of type `<your_type>`, the editor reads the visit
type's `fieldSets[]`, looks each field-set's `concepts[]` + `categories[]` up,
and renders matching observation inputs. **No code changes are needed in the UI
to add a new visit type** — everything is data-driven.

### Step 1: Inventory the new study

Before writing any code, answer these on paper (or in a working doc — see the
plan files in `~/.claude/plans/` for past examples):

1. **Visit timeline** — how many visits per patient? Are they sequential
   (V0/V1/V2 like Stroke-Lipid) or named (Erstvorstellung / Verlaufskontrolle
   like Parkinson)? What's each visit's `INOUT_CD` (`I`/`O`/`E`)?
2. **What observations are recorded at each visit?** Group them into 3–6 buckets
   (one bucket = one field set). Bucket by semantic family, not by row order.
3. **For each observation:**
   - VALTYPE (`N`/`T`/`F`/`S`/`D`/`B`/`R`/`Q`)
   - For numerics: unit
   - For F-findings: the answer is always Yes/No (SCTID:373066001 / SCTID:373067005)
   - For S-selections: write down every option
   - **Can it be reused from LOINC / SNOMED / ICD-10 / the existing seed?**
     Walk the concept-reuse hierarchy (Data Modelling Conventions §4).
4. **3-state numerics?** Mark every numeric where "assessed, explicitly no
   value" differs from "not assessed" (typically: medications, optional labs).
   These will use the `VALUEFLAG_CD='NV'` pattern (§3).

The reference Stroke-Lipid inventory (50 concepts, 5 field sets, 3 visit types)
lives in the data section near the top of `010-stroke-lipid-seed.js`.

### Step 2: Write the migration

Create `src/core/database/migrations/0NN-<study>-seed.js`. Structure:

```js
// 1. Concept rows (path, code, name, valtype, unit, category)
const CONCEPTS = [
  // drugs (N, mg)
  ['\\STUDY\\DRUG\\X', 'STUDY:DRUG:X', 'Drug X', 'N', 'mg', 'Medications'],
  // findings (F)
  ['\\STUDY\\FINDING\\Y', 'STUDY:FINDING:Y', 'Finding Y', 'F', null, 'Stroke'],
  // selections (S) + their A-type options
  ['\\STUDY\\SEL\\Z', 'STUDY:SEL:Z', 'Selection Z', 'S', null, 'Stroke'],
  ['\\STUDY\\SEL\\Z\\OPT1', 'STUDY:Z:OPT1', 'Option 1', 'A', null, 'Stroke'],
  // dates (D)
  ['\\STUDY\\EVENT_DATE', 'STUDY:EVENT_DATE', 'Event date', 'D', null, 'Stroke'],
  // free text (T)
  ['\\STUDY\\NOTES', 'STUDY:NOTES', 'Notes', 'T', null, 'Stroke'],
  // re-use existing where possible — don't list these here, just reference them
  // in field sets by their existing CONCEPT_CD (e.g. 'LID: 22748-8' for LDL).
]

// 2. Field set rows — one per UI input panel.
const FIELD_SETS = [
  {
    code: 'study_baseline',
    name: 'Study - Baseline',
    blob: {
      description: 'Comorbidities, vitals, etiology',
      icon: 'monitor_heart',
      concepts: ['STUDY:FINDING:Y', 'SCTID: 49436004', 'STUDY:SEL:Z'],
      categories: ['Stroke', 'Vital Signs'], // hybrid matching fallback
    },
  },
  // … one per bucket
]

// 3. Visit type rows — each referencing its field sets by code.
const VISIT_TYPES = [
  {
    code: 'study_v0',
    name: 'Study V0 (Baseline)',
    blob: {
      label: 'Study V0 - Baseline',
      icon: 'monitor_heart', color: 'orange',
      fieldSets: [
        { id: 'study_baseline', name: 'Baseline', active: true },
        { id: 'study_drugs',    name: 'Medications', active: true },
      ],
    },
  },
  // … one per visit type
]

// 4. Optional: VALUEFLAG_CD codes if you use 3-state numerics.
//    (NV / NI are already seeded by 010-stroke-lipid-seed; re-seeding is safe.)

// 5. Optional: STUDY_DIMENSION row.

// 6. Optional: category fix-ups for existing CONCEPT_DIMENSION rows that you
//    want to re-categorise (rare — see categoryFixups in 010).
```

Use **self-healing upserts** (Data Modelling Conventions §7) so the migration
can correct earlier mistakes when re-run. Pattern:

```sql
INSERT INTO CONCEPT_DIMENSION (...)
VALUES (?, ?, ?, ?, ?, ?, 'STUDY_MIGRATION', NOW, NOW)
ON CONFLICT(CONCEPT_CD) DO UPDATE SET
  NAME_CHAR = excluded.NAME_CHAR,
  CATEGORY_CHAR = excluded.CATEGORY_CHAR,
  UPDATE_DATE = excluded.UPDATE_DATE;
```

Register the migration in `src/core/services/database-service.js` alongside the
existing migrations:

```js
import { studySeed } from '../database/migrations/0NN-study-seed.js'
// …
this.migrationManager.registerMigration(studySeed)
```

The migration runs automatically on the next app start. To apply it to an
existing dev DB without restarting the app, copy the `apply-migration.js`
pattern from `scripts/import-fw-lipid/`:

```bash
node scripts/import-fw-lipid/apply-migration.js  # idempotent; supports --force
```

### Step 3: Verify the seed before importing data

```bash
sqlite3 database/production.db << 'EOF'
-- Concepts seeded
SELECT VALTYPE_CD, COUNT(*) FROM CONCEPT_DIMENSION
WHERE CONCEPT_CD LIKE 'STUDY:%' GROUP BY VALTYPE_CD;
-- Visit types
SELECT CODE_CD, NAME_CHAR FROM CODE_LOOKUP
WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='VISIT_TYPE_CD' AND CODE_CD LIKE 'study_%';
-- Field sets
SELECT CODE_CD, NAME_CHAR FROM CODE_LOOKUP
WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD' AND CODE_CD LIKE 'study_%';
EOF
```

At this point you can already create a visit of type `study_v0` in the UI; the
editor will show the correct field sets and accept observations against the
seeded concepts.

### Step 4: Optional - bulk-import patient data

If the study has historical patient data (XLSX / CSV / JSON), follow the
**Bulk-import / re-import pattern** (Data Modelling Conventions §6) by copying
`scripts/import-fw-lipid/` and adapting:

- `mapping.js` — single source of truth: every source column → concept code,
  visit, valtype, unit. Mark each concept with `existing: true` if it comes
  from outside the new migration (reuse from LOINC/SNOMED).
- `parsers.js` — date, PLZ, dose, finding, selection-value parsers. Most of
  these are study-agnostic and can be reused as-is.
- `import.js` — per-patient `delete-and-rewrite` keyed on
  `SOURCESYSTEM_CD='<STUDY>_<DATE>'`. Apply the 3-state logic for medications.
- `spotcheck.js` — cell-by-cell verifier. The version in the Stroke-Lipid
  importer checks every patient × every mapped field; copy it and the only
  thing that should change is the mapping it imports.
- `export.js` + `export-verify.js` — headless CSV/HL7 round-trip if needed.

### Step 5: Document

Append an entry under `## Recent Milestones` in `IMPLEMENTATION_STATUS.md` and
under `[Unreleased] > Added` in `CHANGELOG.md` describing what was added and
linking to the migration / importer paths.

### The Stroke-Lipid worked example

For a concrete reference of every step above, see:

| Step | File |
|---|---|
| Inventory | Commit message of `c0557b5` (migration introduction) |
| Migration | `src/core/database/migrations/010-stroke-lipid-seed.js` (50 concepts, 5 field sets, 3 visit types) |
| Importer  | `scripts/import-fw-lipid/import.js` (425 patients, 1037 visits, 21 969 observations) |
| Verifier  | `scripts/import-fw-lipid/spotcheck.js` (34 136 cell assertions, 0 mismatches) |
| Export    | `scripts/import-fw-lipid/export.js` + `export-verify.js` (CSV + HL7-JSON, 0 mismatches) |
| Docs      | `scripts/import-fw-lipid/README.md` (the workflow as a runnable how-to) |

The Stroke-Lipid migration introduces 3 visit types (V0 pre-stroke baseline,
V1 index stroke, V2 follow-up) wired to 5 field sets (`lipid_pre_stroke`,
`lipid_stroke_event`, `lipid_followup`, `lipid_labor`, `lipid_drugs`). V0
carries comorbidities + vitals + etiology + age + stroke date; V1 carries
event-type + labs + drugs + statin intolerance + new-med / dose-increase
flags + free text; V2 carries follow-up labs + drugs + reinfarct + new-med /
dose-increase flags + our-clinic flag. Drugs use the 3-state pattern
(VALUEFLAG_CD='NV') so "asked, not taking" is distinct from "not assessed".

---

## 👥 Test Users (Seeded Data)

All users are seeded automatically during database initialization.

| Username | Password | Role  | Admin  | Description         |
| -------- | -------- | ----- | ------ | ------------------- |
| `admin`  | `admin`  | admin | ✅ Yes | Administrator       |
| `ste`    | `123`    | admin | ✅ Yes | Stefan User (Admin) |
| `db`     | `123`    | user  | ❌ No  | Database User       |
| `public` | `public` | user  | ❌ No  | Public User         |

**Password storage**: Stored as bcrypt hashes in `USER_MANAGEMENT.PASSWORD_CHAR` (migration 008). The plaintext column never persists. After running migration 008 against a pre-existing database, every user has `MUST_CHANGE_PASSWORD = 1` (Hard-Reset) and the seeded credentials above remain valid for one final login. The `auth-store.mustChangePassword` flag exposes this state to the UI; `verifyPassword` (`src/core/services/password-service.js`) accepts both bcrypt hashes and legacy plaintext for the transition.

### User Permissions

- **Admin Users** (`COLUMN_CD = 'admin'`):
  - Full access to all pages including /concepts, /cql, /users, /global-settings, /database-test
  - Can manage other users
  - Can modify system settings
- **Regular Users** (`COLUMN_CD = 'user'`):
  - Access to patient management, visits, studies, import/export
  - Cannot access admin pages
  - Cannot modify system settings

**Note**: Fine-grained patient access via `USER_PATIENT_LOOKUP` table exists but is not yet enforced in the UI.

### Authentication Flow

```javascript
// Login process
authStore.login(username, password, databasePath)
  → UserRepository.authenticateUser()
  → DatabaseStore.initializeDatabase()
  → Router.push('/dashboard')
```

---

## 🎨 Layouts

### MainLayout.vue (`src/layouts/MainLayout.vue`)

**Primary application layout with:**

- **Header**: Logo, language toggle, smart search, notifications, user menu, DB status
- **Sidebar**: Collapsible navigation with:
  - Dashboard
  - Patient Management (Patients, Visits, Questionnaires)
  - Study Management (Studies, Data Grid)
  - Administration (Concepts, CQL, Users, Global Settings) - Admin only
  - Data Operations (Import, Export)
  - Support & Feedback
- **Breadcrumbs**: Dynamic page navigation trail
- **Mode Toggle**: Dashboard supports "Visit Mode" and "Deep Work Mode"

### GridLayout.vue (`src/layouts/GridLayout.vue`)

**Specialized layout for Excel-like data grid editor**

### PublicLayout.vue (`src/layouts/PublicLayout.vue`)

**Minimal layout for login and public pages**

---

## 📄 Main Pages

### 🏠 Core Pages

#### DashboardPage.vue (`/dashboard`)

**Single-view dashboard with statistics and quick actions** *(the former
"Deep Work Mode" with its patient table was removed July 2026 — patient
search/management lives on `/visits`)*

- Quick actions: patient search, new patient, visits today, import
- Recent patients as compact card grid (shared `PatientCard`, owner badge)
- Current studies list
- Today's statistics (patients seen, visits, reports, active studies; for
  non-admins additionally visible/hidden patient counts)

**Key Features**: Real-time statistics, patient creation, study management

---

### 👤 Patient Management

#### PatientSearchPage.vue (`/patients`)

**Intelligent patient search and discovery**

- Smart search with AI-like suggestions
- Advanced filters: age range, gender, vital status, location, studies
- Patient results grid with cards
- Real-time search with debouncing
- Quick patient creation

**Key Features**: Full-text search, filter combinations, patient statistics

#### PatientPage.vue (`/patient/:id`)

**Individual patient details and management**

- Patient demographics
- Visit history
- Observations and measurements
- Study enrollment
- Full CRUD operations

**Key Features**: Patient editing, visit management, data entry

---

### 🏥 Visit Management

#### VisitsPage.vue (`/visits`)

**Medical encounter tracking and management**

- Visit list by patient
- Visit lifecycle (active, completed, cancelled)
- Timeline view
- Data entry for observations
- Medication management

**Key Features**: Visit CRUD, observation entry, timeline visualization

---

### 🔬 Study Management

#### StudySearchPage.vue (`/studies`)

**Research study search and discovery**

- Study search by name, category, clinical scales
- Advanced filters: research category, clinical scale, study status
- Study statistics (total studies, active studies, enrolled patients)
- Study creation and management

**Key Features**: Study search, enrollment management, statistics

#### StudyDetailsPage.vue (`/studies/:id`)

**Individual study details and patient enrollment**

- Study metadata
- Enrolled patients
- Study timeline
- Data collection forms
- Study status management

**Key Features**: Study editing, patient enrollment, data collection

---

### 📊 Data Operations

#### DataGridPage.vue (`/data-grid`)

**Excel-like data grid editor for bulk operations**

- Spreadsheet interface
- Column-based editing
- Batch operations
- Import/export CSV

**Key Features**: Bulk editing, formula support, data validation

#### ImportPage.vue (`/import`)

**Data import from various formats**

- CSV import with two-header row support
- HL7 FHIR Composition (JSON) import — **no digital signature verification** is performed
- Data validation and preview
- Batch import operations

**Key Features**: File upload, format detection, validation, preview

#### ExportPage.vue (`/export`)

**Data export to various formats**

- Patient data export
- Observation export
- Study data export
- CSV, HL7 CDA formats
- Custom field selection

**Key Features**: Filtered export, format selection, batch export

---

### ⚙️ Administration (Admin Only)

#### GlobalSettingsPage.vue (`/global-settings`)

**System-wide configuration and code lookup management**

- Manage CODE_LOOKUP table entries
- Questionnaire definitions (LOOKUP_BLOB)
- Field set definitions
- Visit type configurations
- Category and column selection
- JSON editor for complex data

**Key Features**: Code lookup CRUD, questionnaire import, JSON editing

#### ConceptsPage.vue (`/concepts`)

**Medical concept management (SNOMED/LOINC)**

- Concept tree view
- Concept search
- Category management
- Concept relationships

**Key Features**: Concept CRUD, hierarchical view, search

#### CqlPage.vue (`/cql`)

**Clinical Quality Language rule management**

- CQL rule editor
- Concept-rule mappings
- Validation rules
- Rule testing

**Key Features**: CQL CRUD, syntax validation, testing

#### UserManagementPage.vue (`/users`)

**User account and permission management**

- User CRUD operations
- Role assignment
- Permission management
- Password management

**Key Features**: User administration, role-based access control

---

### 📋 Other Pages

#### QuestionnairePage.vue (`/questionnaires`)

**Survey and questionnaire management**

- Questionnaire builder
- Field definitions
- Validation rules
- Response collection

#### SettingsPage.vue (`/settings`)

**User-specific settings and preferences**

- Language preference
- UI theme
- Notification settings
- Default values

#### HelpPage.vue (`/help`)

**In-app user guide (German) covering the whole application**

- 13 sections: overview, concepts & data model, all main areas, admin,
  settings, plus three step-by-step standard workflows
- 18 real app screenshots in `public/help/` (lightbox on click),
  sticky TOC, full-text filter
- Screenshots are regenerated via `scripts/help-screenshots/capture.js`
  (CDP against the headless Electron app; see the README there). The
  `REMOTE_DEBUG_PORT` env switch in `src-electron/electron-main.js`
  enables the DevTools protocol only when set.
- When UI changes make screenshots stale: re-run the capture script and
  update the affected section texts in `src/pages/HelpPage.vue`

#### FeedbackPage.vue (`/feedback`)

**User feedback and support**

- Feedback form
- Issue reporting
- Feature requests

#### ChangelogPage.vue (`/changelog`)

**Application version history and updates**

#### DatabaseTest.vue (`/database-test`) - Admin Only

**Database testing and debugging interface**

- Connection testing
- Query execution
- Schema inspection
- Data seeding

---

## 🏗️ MVC Architecture

### Model Layer (Pinia Stores)

```
src/stores/
  ├── patient-store.js          - Patient state and operations
  ├── visit-store.js            - Visit state and operations
  ├── observation-store.js      - Observation state and operations
  ├── medications-store.js      - Medication logic
  ├── study-store.js            - Study management
  ├── concept-resolution-store.js - Concept resolution and caching
  ├── database-store.js         - Database connection and operations
  ├── auth-store.js             - Authentication and authorization
  └── global-settings-store.js  - Global settings management
```

### Controller Layer (Services)

```
src/core/services/
  ├── database-service.js           - Database coordination
  ├── visit-observation-service.js  - Business logic coordination
  └── csv-service.js                - CSV import/export
```

### View Layer (Components)

```
src/pages/              - Page components (Views)
src/components/         - Reusable components
src/layouts/            - Layout components
```

### Data Access Layer (Repositories)

```
src/core/database/repositories/
  ├── base-repository.js       - Base CRUD operations
  ├── patient-repository.js    - Patient data access
  ├── visit-repository.js      - Visit data access
  ├── observation-repository.js - Observation data access
  ├── concept-repository.js    - Concept data access
  ├── cql-repository.js        - CQL data access
  ├── user-repository.js       - User data access
  └── study-repository.js      - Study data access
```

---

## 🌐 Internationalization (I18n)

### Language Support

- **Default**: German (de)
- **Secondary**: English (en)
- **Storage**: `localStorage.locale`

### Translation Files

```
src/i18n/locales/
  ├── de.json   - German translations (422+ lines)
  └── en.json   - English translations (421+ lines)
```

### Usage in Components

```vue
<!-- Template -->
<q-btn :label="$t('common.save')" />

<!-- Script -->
import { useI18n } from 'vue-i18n' const { t } = useI18n() const message = t('messages.success')
```

### Translation Categories

```
common, navigation, auth, patient, visit, observation, user, settings,
smartButton, dataGrid, export, import, questionnaire, study, validation, messages
```

---

## 🚀 Quick Start Commands

### Development

```bash
npm install              # Install dependencies
npm run dev             # Start dev server
```

### SQLite3 Quick Reference

```bash
# Common inspection queries
sqlite3 ./database/production.db "SELECT * FROM USER_MANAGEMENT;"
sqlite3 ./database/production.db "SELECT COUNT(*) as total FROM PATIENT_DIMENSION;"
sqlite3 ./database/production.db "SELECT PATIENT_CD, AGE_IN_YEARS, SEX_CD FROM PATIENT_DIMENSION LIMIT 5;"

# Check relationships
sqlite3 ./database/production.db "
SELECT
  p.PATIENT_CD,
  COUNT(DISTINCT v.ENCOUNTER_NUM) as visits,
  COUNT(DISTINCT o.OBSERVATION_ID) as observations
FROM PATIENT_DIMENSION p
LEFT JOIN VISIT_DIMENSION v ON p.PATIENT_NUM = v.PATIENT_NUM
LEFT JOIN OBSERVATION_FACT o ON p.PATIENT_NUM = o.PATIENT_NUM
GROUP BY p.PATIENT_CD
LIMIT 10;"

# Check user permissions
sqlite3 ./database/production.db "
SELECT USER_CD, NAME_CHAR, COLUMN_CD as role
FROM USER_MANAGEMENT
ORDER BY COLUMN_CD DESC, USER_CD;"

# Export data to CSV
sqlite3 -header -csv ./database/production.db "SELECT * FROM PATIENT_DIMENSION;" > patients.csv
```

### Testing

```bash
npm test -- --run       # Run all tests (326 tests)
npm test tests/unit/ -- --run        # Unit tests only
npm test tests/integration/ -- --run # Integration tests

# E2E verification of the unified visits view ("Zeitlinie neu"):
# headless app + CDP walkthrough, DB backup + delete guards + integrity
# check built in (see scripts/verify-visits/README.md). App must NOT be
# running (shares the SQLite DB).
bash scripts/verify-visits/run.sh
```

### Windows Build

```powershell
npm.cmd run build:win-x64   # Build Windows x64 app
```

---

## 📊 Data Flow Examples

### Patient Creation Flow

```
DashboardPage.vue (View)
  → CreatePatientDialog (View)
  → patient-store.createPatient() (Model)
  → PatientRepository.createPatient() (Data Access)
  → DatabaseService.executeCommand() (Service)
  → SQLite Connection (Database)
```

### Visit Data Entry Flow

```
VisitsPage.vue (View)
  → VisitDataEntry (View)
  → visit-observation-service.createObservation() (Controller)
  → observation-store.createObservation() (Model)
  → ObservationRepository.createObservation() (Data Access)
  → DatabaseService.executeCommand() (Service)
  → SQLite Connection (Database)
```

### Dashboard Statistics Flow

```
DashboardPage.vue (View)
  → loadDashboardStatistics() (View Logic)
  → database-store.getStatistics() (Model)
  → Multiple Repositories (Data Access)
  → DatabaseService.executeQuery() (Service)
  → SQLite Connection (Database)
```

---

## 🔧 Common Development Tasks

### Adding a New Page

1. Create Vue component in `src/pages/`
2. Add route in `src/router/routes.js`
3. Add navigation item in `MainLayout.vue`
4. Add translations in `de.json` and `en.json`

### Adding a New Database Table

1. Create migration in `src/core/database/migrations/`
2. Register migration in `database-service.js`
3. Create repository in `src/core/database/repositories/`
4. Add repository to `database-service.js`
5. Create Pinia store if needed in `src/stores/`
6. Write tests in `tests/unit/` and `tests/integration/`

### Adding New Translations

1. Add key to `src/i18n/locales/de.json`
2. Add key to `src/i18n/locales/en.json`
3. Use in component: `$t('category.key')` or `t('category.key')`

---

## 🐛 Common Issues & Solutions

### Database Not Connecting

```javascript
// Check database path
console.log(dbStore.databasePath)

// Check connection status
console.log(dbStore.isConnected)
console.log(dbStore.canPerformOperations)

// Re-initialize
await dbStore.initializeDatabase('./database/production.db')
```

### Direct Database Inspection

```bash
# Check if database file exists
ls -lh ./database/production.db

# Open and inspect
sqlite3 ./database/production.db

# Check database integrity
sqlite3 ./database/production.db "PRAGMA integrity_check;"

# Check foreign keys are enabled
sqlite3 ./database/production.db "PRAGMA foreign_keys;"

# Export schema
sqlite3 ./database/production.db ".schema" > schema.sql

# Backup database
cp ./database/production.db ./database/backup_$(date +%Y%m%d_%H%M%S).db
```

### Authentication Issues

```javascript
// Check current user
console.log(authStore.currentUser)
console.log(authStore.isAuthenticated)

// Check permissions
console.log(authStore.isAdmin)
console.log(authStore.canAccessRoute('/global-settings'))
```

### Translation Missing

```javascript
// Check if key exists
console.log($t('category.key'))

// Add fallback
{
  {
    $t('category.key', 'Fallback Text')
  }
}
```

---

## 📝 Notes for AI Assistants

### When Working with Database

- Always check `dbStore.canPerformOperations` before operations
- Use repositories for data access, never direct SQL in components
- Follow the repository pattern: View → Store → Repository → Database
- Handle errors gracefully with try-catch and user notifications
- Foreign keys are **enabled** - CASCADE deletes work automatically
- Use transactions for multi-step operations
- Patient deletion automatically cascades to visits, observations, and notes

### When Creating UI Components

- **Standard patient card**: `src/components/shared/PatientCard.vue` is THE
  patient card for every patient list/grid (dashboard, /visits recents +
  search results, …). Don't build new patient card/list-item markup — pass
  `{ id, name, age?, visitCount?, lastVisit?, owner?, isPublic?, studies?,
  PATIENT_NUM? }` and listen to `@select`. It handles name-vs-ID fallback
  (no duplicate ID, person icon instead of digit "initials"), the two-part
  meta line, gender-colored avatar, study tags, and the owner badge.
  Right-click opens the built-in context menu (`PatientCardMenu.vue`:
  open visits, copy ID, assign study, export, public toggle / owner change /
  delete for admin+owner) — listen to `@changed` and reload your list after
  menu mutations. Render collections in a grid:
  `repeat(auto-fill, minmax(280px, 1fr))`.
- Follow Quasar component conventions
- Use I18n for all user-facing text
- Implement proper loading states
- Add appropriate error handling and user feedback
- Use reactive refs and computed properties

### When Modifying Architecture

- Maintain clean MVC separation
- Keep stores focused on single responsibility
- Use services for complex business logic coordination
- Keep views thin - move logic to stores/services
- Write tests for new functionality

### Code Style

- Use Vue 3 Composition API (`<script setup>`)
- Use Pinia for state management
- Use Quasar UI components
- Use async/await for async operations
- Follow existing naming conventions
- Add JSDoc comments for complex functions

---

## 🔗 Quick Links

- **Main Entry**: `src/App.vue`
- **Router**: `src/router/routes.js`
- **Database Service**: `src/core/services/database-service.js`
- **Main Store**: `src/stores/database-store.js`
- **Main Layout**: `src/layouts/MainLayout.vue`
- **Seed Data**: `src/core/database/seeds/`
- **Tests**: `tests/unit/` and `tests/integration/`

---

**Last Updated**: December 30, 2025  
**Version**: 1.0.0  
**Database Schema Version**: 002 (Current)
