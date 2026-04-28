# dbbest-clinical-schema (Python)

Pydantic v2 bindings for the dbBEST clinical schema. Mirrors the JavaScript
package in [`../js`](../js).

## Install (dev mode, from a sibling project using submodule)

```toml
# pyproject.toml of the consuming project
dependencies = ["dbbest-clinical-schema"]

[tool.uv.sources]
dbbest-clinical-schema = { path = "external/clinical-schema/python", editable = true }
```

or with plain pip:

```sh
pip install -e ./external/clinical-schema/python
```

## Quick Start

```python
from dbbest_clinical_schema import (
    Patient, Visit, Observation,
    build_simple_json_export, parse_simple_json,
)

p = Patient(PATIENT_NUM=1, PATIENT_CD="EXT_01", BIRTH_DATE="1980-01-01")
v = Visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-04-28")
o = Observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                CONCEPT_CD="LID: 8480-6", VALTYPE_CD="N", NVAL_NUM=132)

envelope = build_simple_json_export(patients=[p], visits=[v], observations=[o])
# envelope is a dict ready to json.dumps()
```

## Tests

```sh
pip install -e '.[dev]'
pytest
```
