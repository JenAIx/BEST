"""Mirror js/src/parsers/simple-json.js."""
from __future__ import annotations

from typing import Any, Optional

from ..constants import (
    ACTIVE_STATUS_ACTIVE,
    CATEGORY_SURVEY,
    CONCEPT_QUESTIONNAIRE,
    DEFAULT_PROVIDER_ID,
    InOut,
    ValType,
    VITAL_STATUS_ALIVE,
)
from ..models._base import iso_date, iso_now


def parse_simple_json(envelope: dict) -> dict[str, list[dict]]:
    if not isinstance(envelope, dict):
        raise TypeError("parse_simple_json: envelope must be a dict")
    data = envelope.get("data") or {}
    return {
        "patients": [_transform_patient(p) for p in (data.get("patients") or [])],
        "visits": [_transform_visit(v) for v in (data.get("visits") or [])],
        "observations": [_transform_observation(o) for o in (data.get("observations") or [])],
    }


def _pick(d: dict, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


def _transform_patient(p: dict) -> dict:
    return {
        "PATIENT_NUM": _pick(p, "PATIENT_NUM", "id"),
        "PATIENT_CD": _pick(p, "PATIENT_CD", "patientId", "patient_cd"),
        "VITAL_STATUS_CD": _pick(p, "VITAL_STATUS_CD", default=VITAL_STATUS_ALIVE),
        "BIRTH_DATE": _pick(p, "BIRTH_DATE", "birthDate", "dob"),
        "DEATH_DATE": _pick(p, "DEATH_DATE", "deathDate"),
        "AGE_IN_YEARS": _pick(p, "AGE_IN_YEARS", "age"),
        "SEX_CD": _pick(p, "SEX_CD", "sex", "gender"),
        "LANGUAGE_CD": _pick(p, "LANGUAGE_CD", "language"),
        "RACE_CD": _pick(p, "RACE_CD", "race"),
        "MARITAL_STATUS_CD": _pick(p, "MARITAL_STATUS_CD", "maritalStatus"),
        "RELIGION_CD": _pick(p, "RELIGION_CD", "religion"),
        "STATECITYZIP_PATH": _pick(p, "STATECITYZIP_PATH", "address"),
        "PATIENT_BLOB": _pick(p, "PATIENT_BLOB"),
        "UPDATE_DATE": _pick(p, "UPDATE_DATE", default=iso_date()),
        "DOWNLOAD_DATE": _pick(p, "DOWNLOAD_DATE"),
        "IMPORT_DATE": _pick(p, "IMPORT_DATE", default=iso_now()),
        "SOURCESYSTEM_CD": _pick(p, "SOURCESYSTEM_CD", "sourceSystem", default="JSON_IMPORT"),
        "UPLOAD_ID": _pick(p, "UPLOAD_ID", default=1),
        "CREATED_AT": _pick(p, "CREATED_AT", default=iso_now()),
        "UPDATED_AT": _pick(p, "UPDATED_AT", default=iso_now()),
    }


def _transform_visit(v: dict) -> dict:
    return {
        "ENCOUNTER_NUM": _pick(v, "ENCOUNTER_NUM", "id"),
        "PATIENT_NUM": _pick(v, "PATIENT_NUM", "patientId"),
        "ACTIVE_STATUS_CD": _pick(v, "ACTIVE_STATUS_CD", default=ACTIVE_STATUS_ACTIVE),
        "START_DATE": _pick(v, "START_DATE", "startDate", "visitDate"),
        "END_DATE": _pick(v, "END_DATE", "endDate"),
        "INOUT_CD": _pick(v, "INOUT_CD", "inOut", "visitType", default=InOut.OUTPATIENT.value),
        "LOCATION_CD": _pick(v, "LOCATION_CD", "location"),
        "VISIT_BLOB": _pick(v, "VISIT_BLOB"),
        "UPDATE_DATE": _pick(v, "UPDATE_DATE"),
        "DOWNLOAD_DATE": _pick(v, "DOWNLOAD_DATE"),
        "IMPORT_DATE": _pick(v, "IMPORT_DATE"),
        "SOURCESYSTEM_CD": _pick(v, "SOURCESYSTEM_CD", "sourceSystem", default="JSON_IMPORT"),
        "UPLOAD_ID": _pick(v, "UPLOAD_ID", default=1),
        "CREATED_AT": _pick(v, "CREATED_AT", default=iso_date()),
    }


def _transform_observation(o: dict) -> dict:
    valtype = _pick(o, "VALTYPE_CD", "valtypeCd", "valueType")
    if valtype == ValType.QUESTIONNAIRE.value:
        return _transform_questionnaire(o)
    raw_value = o.get("value")
    return {
        "OBSERVATION_ID": _pick(o, "OBSERVATION_ID", "id"),
        "ENCOUNTER_NUM": _pick(o, "ENCOUNTER_NUM", "encounterId", "visitId"),
        "PATIENT_NUM": _pick(o, "PATIENT_NUM", "patientId"),
        "CATEGORY_CHAR": _pick(o, "CATEGORY_CHAR", "category"),
        "CONCEPT_CD": _pick(o, "CONCEPT_CD", "conceptCode", "concept_cd"),
        "PROVIDER_ID": _pick(o, "PROVIDER_ID", "providerId", default=DEFAULT_PROVIDER_ID),
        "START_DATE": _pick(o, "START_DATE", "startDate", "observationDate", default=iso_now()),
        "INSTANCE_NUM": _pick(o, "INSTANCE_NUM", "instanceNum", default=1),
        "VALTYPE_CD": valtype or ValType.TEXT.value,
        "TVAL_CHAR": _pick(o, "TVAL_CHAR", "textValue") or (raw_value if isinstance(raw_value, str) else None),
        "NVAL_NUM": _pick(o, "NVAL_NUM", "numericValue") or (raw_value if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool) else None),
        "VALUEFLAG_CD": _pick(o, "VALUEFLAG_CD", "valueFlag"),
        "QUANTITY_NUM": _pick(o, "QUANTITY_NUM", "quantity"),
        "UNIT_CD": _pick(o, "UNIT_CD", "unit"),
        "END_DATE": _pick(o, "END_DATE", "endDate"),
        "LOCATION_CD": _pick(o, "LOCATION_CD", "location"),
        "CONFIDENCE_NUM": _pick(o, "CONFIDENCE_NUM", "confidence"),
        "OBSERVATION_BLOB": _pick(o, "OBSERVATION_BLOB", "blob"),
        "UPDATE_DATE": _pick(o, "UPDATE_DATE"),
        "DOWNLOAD_DATE": _pick(o, "DOWNLOAD_DATE"),
        "IMPORT_DATE": _pick(o, "IMPORT_DATE"),
        "SOURCESYSTEM_CD": _pick(o, "SOURCESYSTEM_CD", "sourceSystem", default="JSON_IMPORT"),
        "UPLOAD_ID": _pick(o, "UPLOAD_ID", default=1),
        "CREATED_AT": _pick(o, "CREATED_AT", default=iso_date()),
    }


def _transform_questionnaire(o: dict) -> dict:
    title = _pick(o, "TVAL_CHAR", "textValue", default="Unknown Questionnaire")
    blob_raw = o.get("OBSERVATION_BLOB")
    if blob_raw:
        try:
            import json
            blob = json.loads(blob_raw) if isinstance(blob_raw, str) else blob_raw
            if blob.get("title"):
                title = blob["title"]
            elif blob.get("label"):
                title = blob["label"]
            elif blob.get("questionnaireReference", {}).get("questionnaireCode"):
                title = blob["questionnaireReference"]["questionnaireCode"]
        except (TypeError, ValueError):
            pass
    return {
        "OBSERVATION_ID": _pick(o, "OBSERVATION_ID", "id"),
        "ENCOUNTER_NUM": _pick(o, "ENCOUNTER_NUM", "encounterId", "visitId"),
        "PATIENT_NUM": _pick(o, "PATIENT_NUM", "patientId"),
        "CATEGORY_CHAR": _pick(o, "CATEGORY_CHAR", "category", default=CATEGORY_SURVEY),
        "CONCEPT_CD": _pick(o, "CONCEPT_CD", "conceptCode", default=CONCEPT_QUESTIONNAIRE),
        "PROVIDER_ID": _pick(o, "PROVIDER_ID", "providerId", default=DEFAULT_PROVIDER_ID),
        "START_DATE": _pick(o, "START_DATE", "startDate", "observationDate", default=iso_now()),
        "INSTANCE_NUM": _pick(o, "INSTANCE_NUM", "instanceNum", default=1),
        "VALTYPE_CD": ValType.QUESTIONNAIRE.value,
        "TVAL_CHAR": title,
        "NVAL_NUM": None,
        "VALUEFLAG_CD": None,
        "QUANTITY_NUM": None,
        "UNIT_CD": None,
        "END_DATE": _pick(o, "END_DATE", "endDate"),
        "LOCATION_CD": _pick(o, "LOCATION_CD", "location"),
        "CONFIDENCE_NUM": None,
        "OBSERVATION_BLOB": _pick(o, "OBSERVATION_BLOB", "blob"),
        "UPDATE_DATE": _pick(o, "UPDATE_DATE", default=iso_date()),
        "DOWNLOAD_DATE": _pick(o, "DOWNLOAD_DATE"),
        "IMPORT_DATE": _pick(o, "IMPORT_DATE", default=iso_date()),
        "SOURCESYSTEM_CD": _pick(o, "SOURCESYSTEM_CD", "sourceSystem", default="SURVEY_SYSTEM"),
        "UPLOAD_ID": _pick(o, "UPLOAD_ID"),
        "CREATED_AT": _pick(o, "CREATED_AT", default=iso_date()),
    }
