# dbBEST Clinical Schema

Shared schema definitions, builders, validators and parsers for the dbBEST
clinical-data ecosystem. Used by:

- **dbBEST** (Quasar/Vue desktop app) — import + export
- **dbBEST Fragebogenapp** (planned) — questionnaire export
- **dbBEST Backend** (planned, Python) — server-side ingest/export

One schema, two language bindings (JavaScript + Python), one Git tag per
release.

## Layout

```
dbbest-clinical-schema/
├── VERSION              # single source of truth for both languages
├── SCHEMA.md            # canonical record + envelope spec
├── fixtures/            # JSON files used by both test suites
├── js/                  # JavaScript / ES modules (Vitest)
└── python/              # Python (Pydantic v2, pytest)
```

## Quick Start (JavaScript)

```js
import {
  buildPatient, buildVisit, buildObservation, buildQuestionnaireObservation,
  buildSimpleJsonExport, buildHl7CompositionExport,
  parseSimpleJson, parseHl7Composition,
  validateEnvelope,
} from '@dbbest/clinical-schema'

const patient = buildPatient({ PATIENT_NUM: 1, PATIENT_CD: 'EXT_01' })
const visit   = buildVisit({ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-04-28' })
const obs     = buildObservation({ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                                   CONCEPT_CD: 'LID: 8480-6', value: 132 })

const envelope = buildSimpleJsonExport({ patients: [patient], visits: [visit], observations: [obs] })
```

## Quick Start (Python)

```python
from dbbest_clinical_schema import (
    Patient, Visit, Observation, build_simple_json_export, parse_simple_json,
)

patient = Patient(PATIENT_NUM=1, PATIENT_CD="EXT_01")
visit   = Visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-04-28")
obs     = Observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                      CONCEPT_CD="LID: 8480-6", VALTYPE_CD="N", NVAL_NUM=132)

envelope = build_simple_json_export(patients=[patient], visits=[visit], observations=[obs])
```

## Output Formats

Both bindings emit and parse two on-disk formats:

1. **Simple JSON envelope** — `{ metadata, exportInfo, data, statistics }`.
   Consumed by dbBEST `ImportJsonService`.
2. **HL7 FHIR Composition** — FHIR R4-inspired `Composition` resource with
   sections/entries, wrapped as `{ cda, hash, generator }`.
   Consumed by dbBEST `ImportHl7Service`.

See [SCHEMA.md](./SCHEMA.md) for the canonical record and envelope spec, and
the deviations from strict FHIR R4.

## Versioning

`VERSION` is the single source of truth. Both `js/src/version.js` and
`python/src/dbbest_clinical_schema/version.py` read it at runtime.
Releases are git-tagged `v<major>.<minor>.<patch>`.

## Distribution

Designed to be consumed as a **git submodule**:

```sh
git submodule add <url> external/clinical-schema
```

Then in the consuming project:

- Node: add `"@dbbest/clinical-schema": "file:external/clinical-schema/js"` to `package.json`
- Python: add `dbbest-clinical-schema = {path = "external/clinical-schema/python", develop = true}` to `pyproject.toml`

## Tests

```sh
# JS
cd js && npm install && npm test

# Python
cd python && pip install -e '.[dev]' && pytest
```
