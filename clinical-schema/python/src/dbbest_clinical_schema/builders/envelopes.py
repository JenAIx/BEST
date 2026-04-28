"""Envelope builders mirroring js/src/envelopes/*."""
from __future__ import annotations

import uuid
from typing import Any, Optional, Sequence

from ..constants import SNOMED_SYSTEM
from ..models import Observation, Patient, Visit
from ..models._base import iso_date, iso_now
from ..version import (
    DBBEST_MIN_VERSION,
    DBBEST_PROFILE_URL,
    FHIR_VERSION,
    SCHEMA_VERSION,
    TEMPLATE_VERSION,
)


def _to_dict(record: Any) -> dict:
    if hasattr(record, "model_dump"):
        return record.model_dump()
    return dict(record)


def build_simple_json_export(
    *,
    patients: Sequence[Patient | dict] = (),
    visits: Sequence[Visit | dict] = (),
    observations: Sequence[Observation | dict] = (),
    metadata: Optional[dict] = None,
) -> dict:
    """Mirror js buildSimpleJsonExport."""
    metadata = metadata or {}
    now = iso_now()
    p_dicts = [_to_dict(p) for p in patients]
    v_dicts = [_to_dict(v) for v in visits]
    o_dicts = [_to_dict(o) for o in observations]
    patient_ids = [p.get("PATIENT_CD") for p in p_dicts if p.get("PATIENT_CD")]

    return {
        "metadata": {
            "title": metadata.get("title", "Patient Data Export - JSON"),
            "exportDate": metadata.get("exportDate", now),
            "format": "json",
            "source": metadata.get("source", "External System"),
            "version": metadata.get("version", SCHEMA_VERSION),
            "author": metadata.get("author", "Export Template"),
            "patientCount": len(p_dicts),
            "patientIds": patient_ids,
            "options": {
                "includeVisits": len(v_dicts) > 0,
                "includeObservations": len(o_dicts) > 0,
                "includeNotes": False,
                **(metadata.get("options") or {}),
            },
            "generator": {
                "templateVersion": TEMPLATE_VERSION,
                "schemaVersion": SCHEMA_VERSION,
                "targetApp": "dbBEST",
                "targetMinVersion": DBBEST_MIN_VERSION,
            },
        },
        "exportInfo": {
            "format": "json",
            "version": SCHEMA_VERSION,
            "exportedAt": now,
            "source": metadata.get("source", "External System"),
            "templateVersion": TEMPLATE_VERSION,
        },
        "data": {"patients": p_dicts, "visits": v_dicts, "observations": o_dicts},
        "statistics": {
            "patientCount": len(p_dicts),
            "visitCount": len(v_dicts),
            "observationCount": len(o_dicts),
            "fetchedAt": now,
        },
    }


def _coding(system: str, code: str, display: str) -> dict:
    return {"coding": [{"system": system, "code": code, "display": display}]}


def _entry(title: str, concept_code: str, value: Any, system: str = SNOMED_SYSTEM) -> dict:
    return {
        "title": title,
        "code": [_coding(system, concept_code, title)],
        "value": value,
        "text": {
            "status": "generated",
            "div": (
                f"<table><tbody><tr><td>{title}</td></tr>"
                f"<tr><td>{value}</td></tr></tbody></table>"
            ),
        },
    }


def build_hl7_composition_export(
    *,
    patients: Sequence[Patient | dict],
    visits: Sequence[Visit | dict] = (),
    observations: Sequence[Observation | dict] = (),
    metadata: Optional[dict] = None,
) -> dict:
    """Mirror js buildHl7CompositionExport."""
    metadata = metadata or {}
    p_dicts = [_to_dict(p) for p in patients]
    v_dicts = [_to_dict(v) for v in visits]
    o_dicts = [_to_dict(o) for o in observations]
    if not p_dicts:
        raise ValueError("build_hl7_composition_export: at least one patient is required")

    doc_id = "urn:uuid:" + str(uuid.uuid4())
    export_date = metadata.get("exportDate", iso_date())

    patient_section = {
        "title": "Patient Information",
        "code": [_coding(SNOMED_SYSTEM, "422549004", "Patient Information")],
        "entry": [],
    }
    for p in p_dicts:
        patient_section["entry"].append(_entry(f"Patient: {p['PATIENT_CD']}", "422549004", p["PATIENT_CD"]))
        if p.get("SEX_CD"):       patient_section["entry"].append(_entry("Gender", "263495000", p["SEX_CD"]))
        if p.get("AGE_IN_YEARS"): patient_section["entry"].append(_entry("Age", "63900-5", p["AGE_IN_YEARS"]))
        if p.get("BIRTH_DATE"):   patient_section["entry"].append(_entry("Date of birth", "SCTID: 184099003", p["BIRTH_DATE"]))

    visit_sections = []
    for i, v in enumerate(v_dicts):
        visit_obs = [o for o in o_dicts if o["ENCOUNTER_NUM"] == v["ENCOUNTER_NUM"]]
        entries = []
        if v.get("START_DATE"):  entries.append(_entry("Visit Date", "184099003", v["START_DATE"]))
        if v.get("LOCATION_CD"): entries.append(_entry("Location", "442724003", v["LOCATION_CD"]))
        for o in visit_obs:
            if o["VALTYPE_CD"] == "N":
                value = o["NVAL_NUM"]
            elif o["VALTYPE_CD"] == "Q":
                value = o["OBSERVATION_BLOB"]
            else:
                value = o["TVAL_CHAR"]
            entries.append(_entry(o["CONCEPT_CD"], o["CONCEPT_CD"], value))
        visit_sections.append({
            "title": f"Visit {i + 1}",
            "code": [_coding(SNOMED_SYSTEM, "308335008", "Visit")],
            "text": {"status": "generated", "div": f"<h3>Visit {i + 1}</h3>"},
            "entry": entries,
        })

    cda = {
        "resourceType": "Composition",
        "id": "dbBEST-" + str(uuid.uuid4()),
        "meta": {
            "versionId": metadata.get("version", "v" + SCHEMA_VERSION),
            "lastUpdated": iso_now(),
            "source": metadata.get("source", "External System"),
            "profile": [DBBEST_PROFILE_URL],
        },
        "fhirVersion": FHIR_VERSION,
        "language": metadata.get("language", "de-DE"),
        "text": {
            "status": "generated",
            "div": (
                f'<div xmlns="http://www.w3.org/1999/xhtml">'
                f'<h1>{metadata.get("title", "Clinical Data Export")}</h1></div>'
            ),
        },
        "identifier": {"system": "urn:ietf:rfc:3986", "value": doc_id},
        "status": "preliminary",
        "type": {"coding": [{"system": SNOMED_SYSTEM, "code": "404684003",
                              "display": "Clinical Observation"}]},
        "subject": {
            "display": p_dicts[0]["PATIENT_CD"],
            "code": {"coding": [{"system": SNOMED_SYSTEM, "code": "422549004",
                                  "display": "Patient Code"}]},
        },
        "date": export_date,
        "author": [{"display": metadata.get("author", "External System")}],
        "title": metadata.get("title", "Clinical Data Export"),
        "attester": [{"mode": "legal", "time": export_date, "party": {}}],
        "custodian": {},
        "event": [
            {
                "code": [_coding(SNOMED_SYSTEM, "308335008", f"Visit {i + 1}")],
                "period": {
                    "start": v["START_DATE"],
                    **({"end": v["END_DATE"]} if v.get("END_DATE") else {}),
                },
            }
            for i, v in enumerate(v_dicts)
        ],
        "section": [patient_section, *visit_sections],
    }

    return {
        "cda": cda,
        "hash": {"signature": None, "method": "SHA256", "documentHash": None},
        "generator": {
            "templateVersion": TEMPLATE_VERSION,
            "schemaVersion": SCHEMA_VERSION,
            "fhirVersion": FHIR_VERSION,
            "profile": DBBEST_PROFILE_URL,
            "targetApp": "dbBEST",
            "targetMinVersion": DBBEST_MIN_VERSION,
        },
    }
