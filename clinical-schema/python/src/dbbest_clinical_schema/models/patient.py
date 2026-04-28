"""Patient model — mirrors PATIENT_DIMENSION."""
from __future__ import annotations

from typing import Optional

from pydantic import Field

from ._base import ClinicalBase, iso_now, iso_date
from ..constants import VITAL_STATUS_ALIVE, DEFAULT_SOURCESYSTEM_CD


class Patient(ClinicalBase):
    PATIENT_NUM: int
    PATIENT_CD: str
    VITAL_STATUS_CD: str = VITAL_STATUS_ALIVE
    BIRTH_DATE: Optional[str] = None
    DEATH_DATE: Optional[str] = None
    AGE_IN_YEARS: Optional[int] = None
    SEX_CD: Optional[str] = None
    LANGUAGE_CD: Optional[str] = None
    RACE_CD: Optional[str] = None
    MARITAL_STATUS_CD: Optional[str] = None
    RELIGION_CD: Optional[str] = None
    STATECITYZIP_PATH: Optional[str] = None
    PATIENT_BLOB: Optional[str] = None
    UPDATE_DATE: str = Field(default_factory=iso_date)
    DOWNLOAD_DATE: Optional[str] = None
    IMPORT_DATE: str = Field(default_factory=iso_now)
    SOURCESYSTEM_CD: str = DEFAULT_SOURCESYSTEM_CD
    UPLOAD_ID: int = 1
    CREATED_AT: str = Field(default_factory=iso_now)
    UPDATED_AT: str = Field(default_factory=iso_now)
