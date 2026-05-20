from __future__ import annotations

import json

from dbbest_clinical_schema import (
    build_patient, build_visit, build_observation, build_questionnaire_observation,
    build_simple_json_export, build_hl7_composition_export,
    parse_simple_json, parse_hl7_composition,
    ValType,
)


def test_parse_simple_json_fixture(fixtures_dir):
    data = json.loads((fixtures_dir / "02_simple_json.json").read_text())
    records = parse_simple_json(data)
    assert len(records["patients"]) > 0
    assert len(records["visits"]) > 0
    assert len(records["observations"]) > 0
    assert "PATIENT_NUM" in records["patients"][0]


def test_parse_simple_json_round_trip():
    p = build_patient(PATIENT_NUM=7, PATIENT_CD="RT_07")
    v = build_visit(ENCOUNTER_NUM=42, PATIENT_NUM=7, START_DATE="2026-04-28")
    o = build_observation(OBSERVATION_ID=100, ENCOUNTER_NUM=42, PATIENT_NUM=7,
                          CONCEPT_CD="LID: 8480-6", value=130)
    env = build_simple_json_export(patients=[p], visits=[v], observations=[o])
    back = parse_simple_json(env)
    assert back["patients"][0]["PATIENT_NUM"] == 7
    assert back["visits"][0]["ENCOUNTER_NUM"] == 42
    assert back["observations"][0]["OBSERVATION_ID"] == 100
    assert back["observations"][0]["VALTYPE_CD"] == ValType.NUMERIC.value
    assert back["observations"][0]["NVAL_NUM"] == 130


def test_parse_simple_json_questionnaire_round_trip():
    q = build_questionnaire_observation(
        OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
        questionnaire_code="MOCA", title="MoCA",
        items=[{"id": 1, "label": "A", "value": 1}],
        results=[{"label": "sum", "value": 30}],
    )
    p = build_patient(PATIENT_NUM=1, PATIENT_CD="X")
    v = build_visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-01-01")
    env = build_simple_json_export(patients=[p], visits=[v], observations=[q])
    back = parse_simple_json(env)
    obs = back["observations"][0]
    assert obs["VALTYPE_CD"] == ValType.QUESTIONNAIRE.value
    assert obs["TVAL_CHAR"] == "MoCA"
    blob = json.loads(obs["OBSERVATION_BLOB"])
    assert blob["questionnaire_code"] == "MOCA"
    assert blob["results"][0]["value"] == 30


def test_parse_simple_json_alt_keys():
    env = {
        "data": {
            "patients": [{"id": 1, "patientId": "X", "dob": "1990-01-01", "sex": "male"}],
            "visits": [{"id": 1, "patientId": 1, "startDate": "2026-01-01"}],
            "observations": [{"id": 1, "encounterId": 1, "patientId": 1, "conceptCode": "X",
                              "valtypeCd": "N", "value": 5}],
        }
    }
    back = parse_simple_json(env)
    assert back["patients"][0]["PATIENT_NUM"] == 1
    assert back["patients"][0]["PATIENT_CD"] == "X"
    assert back["visits"][0]["START_DATE"] == "2026-01-01"
    assert back["observations"][0]["NVAL_NUM"] == 5


def test_parse_hl7_composition_round_trip():
    p = build_patient(PATIENT_NUM=1, PATIENT_CD="EXT_01")
    v = build_visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-01-01", LOCATION_CD="CLINIC")
    env = build_hl7_composition_export(patients=[p], visits=[v])
    back = parse_hl7_composition(env)
    assert len(back["patients"]) == 1
    assert back["patients"][0]["PATIENT_CD"] == "EXT_01"
    assert len(back["visits"]) == 1
    assert back["visits"][0]["START_DATE"] == "2026-01-01"


def test_parse_hl7_composition_real_world_fixture(fixtures_dir):
    """Real fixture uses German section titles; just verify no crash."""
    data = json.loads((fixtures_dir / "03_hl7_composition.json").read_text())
    parse_hl7_composition(data)


def test_parse_hl7_rejects_non_composition():
    import pytest
    with pytest.raises(ValueError):
        parse_hl7_composition({"resourceType": "Bundle"})
