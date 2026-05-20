from __future__ import annotations

import json

from dbbest_clinical_schema import (
    build_patient, build_visit, build_observation, build_questionnaire_observation,
    build_simple_json_export, build_hl7_composition_export,
    SCHEMA_VERSION, FHIR_VERSION, DBBEST_PROFILE_URL,
    ValType,
)


def test_build_observation_auto_routes_numeric():
    o = build_observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                          CONCEPT_CD="LID: 8480-6", value=132)
    assert o.VALTYPE_CD == "N"
    assert o.NVAL_NUM == 132.0
    assert o.TVAL_CHAR is None


def test_build_observation_auto_routes_text():
    o = build_observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                          CONCEPT_CD="X", value="positive")
    assert o.VALTYPE_CD == "T"
    assert o.TVAL_CHAR == "positive"
    assert o.NVAL_NUM is None


def test_build_questionnaire_observation():
    o = build_questionnaire_observation(
        OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
        questionnaire_code="MOCA", title="MoCA",
        items=[{"id": 1, "label": "X", "value": 4}],
        results=[{"label": "sum", "value": 26}],
    )
    assert o.VALTYPE_CD == ValType.QUESTIONNAIRE.value
    assert o.TVAL_CHAR == "MoCA"
    assert o.CATEGORY_CHAR == "SURVEY_BEST"
    blob = json.loads(o.OBSERVATION_BLOB)
    assert blob["title"] == "MoCA"
    assert blob["questionnaire_code"] == "MOCA"
    assert len(blob["items"]) == 1
    assert blob["results"][0]["value"] == 26


def test_build_simple_json_export_envelope():
    p = build_patient(PATIENT_NUM=1, PATIENT_CD="EXT_01")
    v = build_visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-01-01")
    o = build_observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                          CONCEPT_CD="X", value=1)
    env = build_simple_json_export(patients=[p], visits=[v], observations=[o])
    assert env["metadata"]["generator"]["schemaVersion"] == SCHEMA_VERSION
    assert env["metadata"]["generator"]["targetApp"] == "dbBEST"
    assert env["statistics"]["patientCount"] == 1
    assert env["statistics"]["visitCount"] == 1
    assert env["statistics"]["observationCount"] == 1
    assert env["data"]["patients"][0]["PATIENT_CD"] == "EXT_01"


def test_build_hl7_composition_export_envelope():
    p = build_patient(PATIENT_NUM=1, PATIENT_CD="EXT_01", BIRTH_DATE="1980-01-01")
    v = build_visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-01-01", LOCATION_CD="CLINIC")
    out = build_hl7_composition_export(patients=[p], visits=[v])
    assert out["cda"]["resourceType"] == "Composition"
    assert out["cda"]["fhirVersion"] == FHIR_VERSION
    assert DBBEST_PROFILE_URL in out["cda"]["meta"]["profile"]
    assert out["cda"]["section"][0]["title"] == "Patient Information"
    assert out["cda"]["section"][1]["title"] == "Visit 1"
    assert out["generator"]["schemaVersion"] == SCHEMA_VERSION
