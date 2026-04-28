"""Visit model — mirrors VISIT_DIMENSION."""
from __future__ import annotations

from typing import Optional, Union

from pydantic import Field, field_validator

from ._base import ClinicalBase, iso_date
from ..constants import ACTIVE_STATUS_ACTIVE, InOut, DEFAULT_SOURCESYSTEM_CD
import json


class Visit(ClinicalBase):
    ENCOUNTER_NUM: int
    PATIENT_NUM: int
    START_DATE: str
    END_DATE: Optional[str] = None
    INOUT_CD: str = InOut.OUTPATIENT.value
    LOCATION_CD: Optional[str] = None
    ACTIVE_STATUS_CD: str = ACTIVE_STATUS_ACTIVE
    VISIT_BLOB: Optional[str] = None
    UPDATE_DATE: Optional[str] = None
    DOWNLOAD_DATE: Optional[str] = None
    IMPORT_DATE: Optional[str] = None
    SOURCESYSTEM_CD: str = DEFAULT_SOURCESYSTEM_CD
    UPLOAD_ID: int = 1
    CREATED_AT: str = Field(default_factory=iso_date)

    @field_validator("VISIT_BLOB", mode="before")
    @classmethod
    def _stringify_blob(cls, v: Union[str, dict, list, None]) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, (dict, list)):
            return json.dumps(v)
        return v
