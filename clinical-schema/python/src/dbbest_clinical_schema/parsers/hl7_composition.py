"""Mirror js/src/parsers/hl7-composition.js."""
from __future__ import annotations

from typing import Any

from ..constants import ACTIVE_STATUS_ACTIVE, InOut, ValType, VITAL_STATUS_ALIVE
from ..models._base import iso_date, iso_now


def parse_hl7_composition(envelope: dict) -> dict[str, list[dict]]:
    if not isinstance(envelope, dict):
        raise TypeError("parse_hl7_composition: envelope must be a dict")
    cda = envelope if envelope.get("resourceType") == "Composition" else envelope.get("cda")
    if not cda or cda.get("resourceType") != "Composition":
        raise ValueError("parse_hl7_composition: expected resourceType='Composition'")
    sections = cda.get("section")
    if not isinstance(sections, list):
        raise ValueError("parse_hl7_composition: Composition.section must be a list")
    return _extract_data_from_sections(sections)


def _extract_data_from_sections(sections: list[dict]) -> dict:
    patients: list[dict] = []
    visits: list[dict] = []
    observations: list[dict] = []
    patient_map: dict[str, dict] = {}
    visit_map: dict[int, dict] = {}
    patient_counter = 1
    visit_counter = 1
    observation_counter = 1

    for section in sections:
        entries = section.get("entry")
        if not isinstance(entries, list):
            continue
        title = section.get("title")
        if title == "Patient Information":
            _extract_patients(entries, patients, patient_map, patient_counter)
            patient_counter += len(entries)
        elif isinstance(title, str) and title.startswith("Visit "):
            _extract_visit(section, visits, visit_map, visit_counter, patient_map)
            visit_counter += 1
        else:
            _extract_observations(section, observations, observation_counter, patient_map, visit_map)
            observation_counter += len(entries)

    return {"patients": patients, "visits": visits, "observations": observations}


def _extract_patients(entries: list[dict], patients: list[dict], patient_map: dict, start: int) -> None:
    current = None
    num = start
    for entry in entries:
        title = entry.get("title", "")
        if title.startswith("Patient: "):
            if current:
                patients.append(current)
                patient_map[current["PATIENT_CD"]] = current
            current = {
                "PATIENT_NUM": num,
                "PATIENT_CD": entry.get("value"),
                "VITAL_STATUS_CD": VITAL_STATUS_ALIVE,
                "BIRTH_DATE": None, "DEATH_DATE": None, "AGE_IN_YEARS": None,
                "SEX_CD": None, "LANGUAGE_CD": None, "RACE_CD": None,
                "MARITAL_STATUS_CD": None, "RELIGION_CD": None,
                "STATECITYZIP_PATH": None, "PATIENT_BLOB": None,
                "UPDATE_DATE": iso_date(), "DOWNLOAD_DATE": None,
                "IMPORT_DATE": iso_now(), "SOURCESYSTEM_CD": "HL7_IMPORT",
                "UPLOAD_ID": 1, "CREATED_AT": iso_now(), "UPDATED_AT": iso_now(),
            }
            num += 1
        elif current:
            if title == "Gender":         current["SEX_CD"] = entry.get("value")
            elif title == "Age":           current["AGE_IN_YEARS"] = entry.get("value")
            elif title == "Date of birth": current["BIRTH_DATE"] = entry.get("value")
    if current:
        patients.append(current)
        patient_map[current["PATIENT_CD"]] = current


def _extract_visit(section: dict, visits: list[dict], visit_map: dict, num: int, patient_map: dict) -> None:
    visit_date: Any = None
    location: Any = None
    for entry in section.get("entry") or []:
        if entry.get("title") == "Visit Date": visit_date = entry.get("value")
        elif entry.get("title") == "Location":  location = entry.get("value")

    patient_ids = list(patient_map.keys())
    if not patient_ids:
        return
    pid = patient_ids[0] if num <= 2 else (patient_ids[1] if len(patient_ids) > 1 else patient_ids[0])
    patient = patient_map.get(pid)
    if not patient:
        return
    visit = {
        "ENCOUNTER_NUM": num,
        "PATIENT_NUM": patient["PATIENT_NUM"],
        "ACTIVE_STATUS_CD": ACTIVE_STATUS_ACTIVE,
        "START_DATE": visit_date or iso_date(),
        "END_DATE": None,
        "INOUT_CD": _determine_visit_type(location),
        "LOCATION_CD": location or "HL7_IMPORT",
        "VISIT_BLOB": None,
        "UPDATE_DATE": None, "DOWNLOAD_DATE": None, "IMPORT_DATE": None,
        "SOURCESYSTEM_CD": "HL7_IMPORT", "UPLOAD_ID": 1, "CREATED_AT": iso_date(),
    }
    visits.append(visit)
    visit_map[num] = visit


def _extract_observations(section: dict, observations: list[dict], start: int, patient_map: dict, visit_map: dict) -> None:
    num = start
    for entry in section.get("entry") or []:
        title = entry.get("title")
        if title in ("Visit Date", "Location"):
            continue
        value = entry.get("value")
        if isinstance(value, bool):
            valtype, tval, nval = ValType.TEXT.value, str(value), None
        elif isinstance(value, (int, float)):
            valtype, tval, nval = ValType.NUMERIC.value, None, float(value)
        elif isinstance(value, str):
            valtype, tval, nval = ValType.TEXT.value, value, None
        elif value is None:
            valtype, tval, nval = ValType.TEXT.value, None, None
        else:
            valtype, tval, nval = ValType.TEXT.value, str(value), None
        patient_ids = list(patient_map.keys())
        if not patient_ids:
            continue
        patient = patient_map[patient_ids[0]]
        visit_ids = list(visit_map.keys())
        observations.append({
            "OBSERVATION_ID": num,
            "ENCOUNTER_NUM": visit_ids[0] if visit_ids else None,
            "PATIENT_NUM": patient["PATIENT_NUM"],
            "CATEGORY_CHAR": None,
            "CONCEPT_CD": title,
            "PROVIDER_ID": None,
            "START_DATE": iso_date(),
            "INSTANCE_NUM": 1,
            "VALTYPE_CD": valtype, "TVAL_CHAR": tval, "NVAL_NUM": nval,
            "VALUEFLAG_CD": None, "QUANTITY_NUM": None, "UNIT_CD": None,
            "END_DATE": None, "LOCATION_CD": None, "CONFIDENCE_NUM": None,
            "OBSERVATION_BLOB": None,
            "UPDATE_DATE": None, "DOWNLOAD_DATE": None, "IMPORT_DATE": None,
            "SOURCESYSTEM_CD": "HL7_IMPORT", "UPLOAD_ID": 1, "CREATED_AT": iso_date(),
        })
        num += 1


def _determine_visit_type(location: Any) -> str:
    if not location:
        return InOut.OUTPATIENT.value
    lower = str(location).lower()
    if "emergency" in lower or "notaufnahme" in lower:
        return InOut.EMERGENCY.value
    if "hospital" in lower or "inpatient" in lower or "station" in lower:
        return InOut.INPATIENT.value
    if "clinic" in lower or "ambulanz" in lower:
        return InOut.OUTPATIENT.value
    return InOut.OUTPATIENT.value
