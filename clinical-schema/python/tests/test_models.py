from __future__ import annotations

import pytest
from pydantic import ValidationError

from dbbest_clinical_schema import (
    Patient, Visit, Observation,
    ValType, VITAL_STATUS_ALIVE, ACTIVE_STATUS_ACTIVE,
)


def test_patient_required_fields():
    p = Patient(PATIENT_NUM=1, PATIENT_CD="X")
    assert p.PATIENT_NUM == 1
    assert p.VITAL_STATUS_CD == VITAL_STATUS_ALIVE
    assert p.SOURCESYSTEM_CD == "EXTERNAL"


def test_patient_missing_required():
    with pytest.raises(ValidationError):
        Patient()


def test_visit_defaults():
    v = Visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-01-01")
    assert v.INOUT_CD == "O"
    assert v.ACTIVE_STATUS_CD == ACTIVE_STATUS_ACTIVE


def test_visit_blob_object_gets_stringified():
    v = Visit(ENCOUNTER_NUM=1, PATIENT_NUM=1, START_DATE="2026-01-01",
              VISIT_BLOB={"visitType": "consult"})
    assert isinstance(v.VISIT_BLOB, str)
    import json
    assert json.loads(v.VISIT_BLOB) == {"visitType": "consult"}


def test_observation_valtype_validation():
    Observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                CONCEPT_CD="X", VALTYPE_CD="N", NVAL_NUM=5)
    with pytest.raises(ValidationError):
        Observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                    CONCEPT_CD="X", VALTYPE_CD="Z")


def test_observation_is_questionnaire():
    o = Observation(OBSERVATION_ID=1, ENCOUNTER_NUM=1, PATIENT_NUM=1,
                    CONCEPT_CD="CUSTOM: QUESTIONNAIRE",
                    VALTYPE_CD=ValType.QUESTIONNAIRE.value, TVAL_CHAR="MoCA",
                    OBSERVATION_BLOB={"title": "MoCA", "items": []})
    assert o.is_questionnaire
    assert o.parsed_blob() == {"title": "MoCA", "items": []}
