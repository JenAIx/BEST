# Clinical Schema Specification

Canonical record and envelope spec for the dbBEST ecosystem. Version 1.0.0.

## Records

Field names are **i2b2-style UPPER_SNAKE** in the on-disk JSON (matches
dbBEST's `PATIENT_DIMENSION`, `VISIT_DIMENSION`, `OBSERVATION_FACT` tables).

### Patient

| Field | Type | Required | Notes |
|---|---|---|---|
| `PATIENT_NUM` | integer | yes | internal numeric id |
| `PATIENT_CD` | string | yes | external patient code |
| `BIRTH_DATE` | ISO date or null | no | YYYY-MM-DD |
| `DEATH_DATE` | ISO date or null | no | |
| `AGE_IN_YEARS` | integer or null | no | |
| `SEX_CD` | string or null | no | e.g. `"SCTID: 407374003"` |
| `VITAL_STATUS_CD` | string | no | default `"SCTID: 438949009"` (alive) |
| `LANGUAGE_CD` | string or null | no | |
| `RACE_CD` | string or null | no | |
| `MARITAL_STATUS_CD` | string or null | no | |
| `RELIGION_CD` | string or null | no | |
| `STATECITYZIP_PATH` | string or null | no | |
| `PATIENT_BLOB` | string or null | no | JSON-stringified |
| `UPDATE_DATE` | ISO date | no | |
| `DOWNLOAD_DATE` | ISO date or null | no | |
| `IMPORT_DATE` | ISO datetime | no | |
| `SOURCESYSTEM_CD` | string | no | default `"EXTERNAL"` |
| `UPLOAD_ID` | integer | no | default 1 |
| `CREATED_AT` | ISO datetime | no | |
| `UPDATED_AT` | ISO datetime | no | |

### Visit

| Field | Type | Required | Notes |
|---|---|---|---|
| `ENCOUNTER_NUM` | integer | yes | |
| `PATIENT_NUM` | integer | yes | FK to Patient |
| `START_DATE` | ISO date | yes | |
| `END_DATE` | ISO date or null | no | |
| `INOUT_CD` | `"I"` \| `"O"` \| `"E"` | no | inpatient/outpatient/emergency, default `"O"` |
| `LOCATION_CD` | string or null | no | |
| `ACTIVE_STATUS_CD` | string | no | default `"SCTID: 55561003"` (active) |
| `VISIT_BLOB` | string or null | no | JSON-stringified |
| `UPDATE_DATE`, `DOWNLOAD_DATE`, `IMPORT_DATE` | ISO date or null | no | |
| `SOURCESYSTEM_CD` | string | no | |
| `UPLOAD_ID` | integer | no | |
| `CREATED_AT` | ISO date | no | |

### Observation

| Field | Type | Required | Notes |
|---|---|---|---|
| `OBSERVATION_ID` | integer | yes | |
| `ENCOUNTER_NUM` | integer | yes | FK to Visit |
| `PATIENT_NUM` | integer | yes | FK to Patient |
| `CONCEPT_CD` | string | yes | see Concept Codes below |
| `CATEGORY_CHAR` | string or null | no | e.g. `"LAB"`, `"DIAGNOSIS"`, `"SURVEY_BEST"` |
| `PROVIDER_ID` | string | no | default `"@"` |
| `START_DATE` | ISO datetime | yes | |
| `END_DATE` | ISO datetime or null | no | |
| `INSTANCE_NUM` | integer | no | default 1 |
| `VALTYPE_CD` | enum | yes | see VALTYPE_CD below |
| `TVAL_CHAR` | string or null | conditional | see VALTYPE_CD |
| `NVAL_NUM` | number or null | conditional | see VALTYPE_CD |
| `VALUEFLAG_CD`, `QUANTITY_NUM`, `UNIT_CD` | various | no | |
| `LOCATION_CD`, `CONFIDENCE_NUM` | various | no | |
| `OBSERVATION_BLOB` | string or null | conditional | JSON-stringified, required for VALTYPE_CD `"Q"` and `"R"`/`"B"` |

### VALTYPE_CD Enum

| Code | Meaning | Value Slot |
|---|---|---|
| `N` | Numeric | `NVAL_NUM` |
| `T` | Text | `TVAL_CHAR` |
| `D` | Date | `TVAL_CHAR` (ISO) or `START_DATE` |
| `F` | Finding (yes/no/unknown) | `TVAL_CHAR` |
| `S` | SNOMED selection | `TVAL_CHAR` (SNOMED code) |
| `A` | Answer | `TVAL_CHAR` |
| `Q` | Questionnaire | `TVAL_CHAR` = title; `OBSERVATION_BLOB` = full payload |
| `M` | Medication | `TVAL_CHAR` |
| `R` | Raw / file | `OBSERVATION_BLOB` |
| `B` | Binary blob | `OBSERVATION_BLOB` |

### Questionnaire OBSERVATION_BLOB shape (VALTYPE_CD = `Q`)

```json
{
  "label": "MOCA",
  "title": "MoCA",
  "short_title": "moca",
  "questionnaire_code": "MOCA",
  "date_start": 1756461315489,
  "date_end":   1756461320683,
  "items": [
    { "id": 1, "label": "Visuospatial", "tag": 1, "value": 8,
      "coding": { "system": "http://snomed.info/sct", "code": "302199004", "display": "Visuospatial" } }
  ],
  "results": [
    { "label": "sum", "value": 73,
      "coding": { "system": "LOINC", "code": "LID: 72172-0", "display": "MoCA SUM" } }
  ],
  "coding": { "system": "LOINC", "code": "LID: 72133-2", "display": "MoCA" }
}
```

## Concept Codes

| Prefix | Meaning | Example |
|---|---|---|
| `SCTID: <id>` | SNOMED CT | `SCTID: 407374003` |
| `LID: <id>` | LOINC | `LID: 72172-0` |
| `CUSTOM: <name>` | dbBEST internal | `CUSTOM: QUESTIONNAIRE` |
| `ICD10:<code>` | ICD-10 | `ICD10:F06.7` |

## Envelope Formats

### 1. Simple JSON

```json
{
  "metadata": { "title": "...", "exportDate": "...", "format": "json", "version": "1.0",
                "source": "...", "author": "...", "patientCount": N, "patientIds": [...],
                "options": { "includeVisits": true, ... },
                "generator": { "templateVersion": "...", "schemaVersion": "1.0",
                               "targetApp": "dbBEST", "targetMinVersion": "0.0.1" } },
  "exportInfo": { "format": "json", "version": "1.0", "exportedAt": "...",
                  "source": "...", "templateVersion": "..." },
  "data": { "patients": [...], "visits": [...], "observations": [...] },
  "statistics": { "patientCount": N, "visitCount": M, "observationCount": K, "fetchedAt": "..." }
}
```

### 2. HL7 FHIR Composition

```json
{
  "cda": {
    "resourceType": "Composition",
    "id": "dbBEST-...",
    "meta": { "versionId": "v1.0", "lastUpdated": "...", "source": "...",
              "profile": ["https://github.com/stebro01/dbBEST/StructureDefinition/dbBEST-Composition"] },
    "fhirVersion": "4.0.1",
    "language": "de-DE",
    "text": { "status": "generated", "div": "<div>...</div>" },
    "identifier": { "system": "urn:ietf:rfc:3986", "value": "urn:uuid:..." },
    "status": "preliminary",
    "type": { "coding": [{ "system": "http://snomed.info/sct", "code": "404684003",
                            "display": "Clinical Observation" }] },
    "subject": { "display": "...", "code": { "coding": [...] } },
    "date": "...", "author": [{ "display": "..." }],
    "title": "...", "attester": [...], "custodian": {},
    "event": [{ "code": [...], "period": { "start": "..." } }],
    "section": [
      { "title": "Patient Information", "code": [...], "entry": [...] },
      { "title": "Visit 1",            "code": [...], "entry": [...] }
    ]
  },
  "hash": { "signature": null, "method": "SHA256", "documentHash": null },
  "generator": { ... }
}
```

## FHIR R4 Compatibility

The HL7 envelope is **FHIR R4-inspired** but uses a dbBEST-specific profile.
Strict FHIR validators will reject parts of it.

**Compliant:**
- `resourceType="Composition"`, required fields (`status`, `type`, `date`, `title`)
- `meta.versionId`, `meta.lastUpdated`, `meta.profile`, `meta.source`
- `identifier.{system,value}` as `urn:uuid`
- `type` and `event[].code` as `CodeableConcept`
- `section[].title`, `section[].code`, `section[].text`

**Deviates from strict FHIR R4** (kept for dbBEST round-trip):
- `subject` is `{display, code:{coding:[...]}}`, not `Reference`
- `author[]` is `[{display}]`, not `Reference[]`
- `attester.party` is `{}` or `{display}`, not `Reference`
- `section.entry[]` is inline `{title, code, value, text}`, not `Reference[]`
- Code prefixes `"SCTID: "` / `"LID: "` are dbBEST string conventions, not FHIR
