"""Observation model — mirrors OBSERVATION_FACT."""
from __future__ import annotations

import json
from typing import Any, Optional, Union

from pydantic import Field, field_validator

from ._base import ClinicalBase, iso_now, iso_date
from ..constants import (
    DEFAULT_PROVIDER_ID,
    DEFAULT_SOURCESYSTEM_CD,
    VALTYPE_CODES,
    ValType,
)


class QuestionnaireBlob(ClinicalBase):
    """Shape of OBSERVATION_BLOB when VALTYPE_CD=='Q'."""

    label: Optional[str] = None
    title: Optional[str] = None
    short_title: Optional[str] = None
    questionnaire_code: Optional[str] = None
    date_start: Optional[int] = None
    date_end: Optional[int] = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    results: list[dict[str, Any]] = Field(default_factory=list)
    coding: Optional[dict[str, Any]] = None


class Observation(ClinicalBase):
    OBSERVATION_ID: int
    ENCOUNTER_NUM: int
    PATIENT_NUM: int
    CONCEPT_CD: str
    CATEGORY_CHAR: Optional[str] = None
    PROVIDER_ID: str = DEFAULT_PROVIDER_ID
    START_DATE: str = Field(default_factory=iso_now)
    END_DATE: Optional[str] = None
    INSTANCE_NUM: int = 1
    VALTYPE_CD: str
    TVAL_CHAR: Optional[str] = None
    NVAL_NUM: Optional[float] = None
    VALUEFLAG_CD: Optional[str] = None
    QUANTITY_NUM: Optional[float] = None
    UNIT_CD: Optional[str] = None
    LOCATION_CD: Optional[str] = None
    CONFIDENCE_NUM: Optional[float] = None
    OBSERVATION_BLOB: Optional[str] = None
    UPDATE_DATE: Optional[str] = None
    DOWNLOAD_DATE: Optional[str] = None
    IMPORT_DATE: Optional[str] = None
    SOURCESYSTEM_CD: str = DEFAULT_SOURCESYSTEM_CD
    UPLOAD_ID: int = 1
    CREATED_AT: str = Field(default_factory=iso_date)

    @field_validator("VALTYPE_CD")
    @classmethod
    def _check_valtype(cls, v: str) -> str:
        if v not in VALTYPE_CODES:
            raise ValueError(f"VALTYPE_CD must be one of {VALTYPE_CODES}, got {v!r}")
        return v

    @field_validator("OBSERVATION_BLOB", mode="before")
    @classmethod
    def _stringify_blob(cls, v: Union[str, dict, list, None]) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, (dict, list)):
            return json.dumps(v)
        if isinstance(v, QuestionnaireBlob):
            return v.model_dump_json()
        return v

    def parsed_blob(self) -> Optional[dict[str, Any]]:
        """Parse OBSERVATION_BLOB as JSON, returning None if empty/invalid."""
        if not self.OBSERVATION_BLOB:
            return None
        try:
            return json.loads(self.OBSERVATION_BLOB)
        except (TypeError, ValueError):
            return None

    @property
    def is_questionnaire(self) -> bool:
        return self.VALTYPE_CD == ValType.QUESTIONNAIRE.value
