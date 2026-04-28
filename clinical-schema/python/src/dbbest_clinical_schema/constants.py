"""Canonical constants. Keep byte-identical with js/src/constants.js."""
from __future__ import annotations

from enum import Enum


class ValType(str, Enum):
    NUMERIC = "N"
    TEXT = "T"
    DATE = "D"
    FINDING = "F"
    SELECTION = "S"
    ANSWER = "A"
    QUESTIONNAIRE = "Q"
    MEDICATION = "M"
    RAW = "R"
    BLOB = "B"


VALTYPE_CODES: tuple[str, ...] = tuple(v.value for v in ValType)


class InOut(str, Enum):
    INPATIENT = "I"
    OUTPATIENT = "O"
    EMERGENCY = "E"


INOUT_CODES: tuple[str, ...] = tuple(v.value for v in InOut)


# Code prefixes (dbBEST conventions, not strict FHIR)
SNOMED_PREFIX = "SCTID: "
LOINC_PREFIX = "LID: "
CUSTOM_PREFIX = "CUSTOM: "
ICD10_PREFIX = "ICD10:"

# System URLs
SNOMED_SYSTEM = "http://snomed.info/sct"
LOINC_SYSTEM = "http://loinc.org"

# Status defaults
VITAL_STATUS_ALIVE = "SCTID: 438949009"
VITAL_STATUS_DECEASED = "SCTID: 419099009"
ACTIVE_STATUS_ACTIVE = "SCTID: 55561003"
ACTIVE_STATUS_INACTIVE = "SCTID: 73504009"

# Categories
CATEGORY_SURVEY = "SURVEY_BEST"
CATEGORY_LAB = "LAB"
CATEGORY_DIAGNOSIS = "DIAGNOSIS"
CATEGORY_VITAL = "VITAL"

# Special concept codes
CONCEPT_QUESTIONNAIRE = "CUSTOM: QUESTIONNAIRE"
CONCEPT_RAW_DATA = "CUSTOM: RAW_DATA"

# Defaults
DEFAULT_SOURCESYSTEM_CD = "EXTERNAL"
DEFAULT_PROVIDER_ID = "@"

__all__ = [
    "ValType",
    "VALTYPE_CODES",
    "InOut",
    "INOUT_CODES",
    "SNOMED_PREFIX",
    "LOINC_PREFIX",
    "CUSTOM_PREFIX",
    "ICD10_PREFIX",
    "SNOMED_SYSTEM",
    "LOINC_SYSTEM",
    "VITAL_STATUS_ALIVE",
    "VITAL_STATUS_DECEASED",
    "ACTIVE_STATUS_ACTIVE",
    "ACTIVE_STATUS_INACTIVE",
    "CATEGORY_SURVEY",
    "CATEGORY_LAB",
    "CATEGORY_DIAGNOSIS",
    "CATEGORY_VITAL",
    "CONCEPT_QUESTIONNAIRE",
    "CONCEPT_RAW_DATA",
    "DEFAULT_SOURCESYSTEM_CD",
    "DEFAULT_PROVIDER_ID",
]
