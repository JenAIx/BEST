"""Convenience constructors mirroring js/src/builders/*."""
from __future__ import annotations

import json
from typing import Any, Optional, Union

from ..constants import (
    CATEGORY_SURVEY,
    CONCEPT_QUESTIONNAIRE,
    DEFAULT_PROVIDER_ID,
    ValType,
)
from ..models import Observation, Patient, Visit
from ..models._base import iso_now


def build_patient(**kwargs: Any) -> Patient:
    return Patient(**kwargs)


def build_visit(**kwargs: Any) -> Visit:
    return Visit(**kwargs)


def build_observation(
    *,
    value: Union[int, float, str, None] = None,
    VALTYPE_CD: Optional[str] = None,
    TVAL_CHAR: Optional[str] = None,
    NVAL_NUM: Optional[float] = None,
    **kwargs: Any,
) -> Observation:
    """Mirror js buildObservation: auto-route value to N/T slot."""
    if VALTYPE_CD is None:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            VALTYPE_CD = ValType.NUMERIC.value
            if NVAL_NUM is None:
                NVAL_NUM = float(value)
        elif isinstance(value, str):
            VALTYPE_CD = ValType.TEXT.value
            if TVAL_CHAR is None:
                TVAL_CHAR = value
        else:
            VALTYPE_CD = ValType.TEXT.value
    return Observation(
        VALTYPE_CD=VALTYPE_CD,
        TVAL_CHAR=TVAL_CHAR,
        NVAL_NUM=NVAL_NUM,
        **kwargs,
    )


def build_questionnaire_observation(
    *,
    OBSERVATION_ID: int,
    ENCOUNTER_NUM: int,
    PATIENT_NUM: int,
    questionnaire_code: str,
    title: str,
    short_title: Optional[str] = None,
    coding: Optional[dict] = None,
    items: Optional[list[dict]] = None,
    results: Optional[list[dict]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    CONCEPT_CD: str = CONCEPT_QUESTIONNAIRE,
    CATEGORY_CHAR: str = CATEGORY_SURVEY,
    SOURCESYSTEM_CD: str = "SURVEY_SYSTEM",
    UPLOAD_ID: int = 1,
) -> Observation:
    if start_date is None:
        start_date = iso_now()
    if end_date is None:
        end_date = iso_now()
    blob = {
        "label": questionnaire_code,
        "title": title,
        "short_title": short_title or title.lower(),
        "questionnaire_code": questionnaire_code,
        "date_start": _ms(start_date),
        "date_end": _ms(end_date),
        "items": items or [],
        "results": results or [],
        "coding": coding,
    }
    return Observation(
        OBSERVATION_ID=OBSERVATION_ID,
        ENCOUNTER_NUM=ENCOUNTER_NUM,
        PATIENT_NUM=PATIENT_NUM,
        CONCEPT_CD=CONCEPT_CD,
        CATEGORY_CHAR=CATEGORY_CHAR,
        PROVIDER_ID=DEFAULT_PROVIDER_ID,
        START_DATE=start_date,
        END_DATE=end_date,
        INSTANCE_NUM=1,
        VALTYPE_CD=ValType.QUESTIONNAIRE.value,
        TVAL_CHAR=title,
        LOCATION_CD="QUESTIONNAIRE",
        OBSERVATION_BLOB=json.dumps(blob),
        SOURCESYSTEM_CD=SOURCESYSTEM_CD,
        UPLOAD_ID=UPLOAD_ID,
    )


def _ms(iso_string: str) -> int:
    """Convert ISO datetime string to millisecond timestamp."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except (TypeError, ValueError):
        return 0
