"""Version constants. SCHEMA_VERSION is read from ../../VERSION when possible."""
from __future__ import annotations

from pathlib import Path


def _read_version() -> str:
    here = Path(__file__).resolve().parent
    # repo root is three levels up: src/dbbest_clinical_schema → src → python → repo
    candidate = here.parents[2] / "VERSION"
    try:
        return candidate.read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0-unknown"


SCHEMA_VERSION = _read_version()
TEMPLATE_VERSION = SCHEMA_VERSION
FHIR_VERSION = "4.0.1"
DBBEST_MIN_VERSION = "0.0.1"
DBBEST_PROFILE_URL = (
    "https://github.com/stebro01/dbBEST/StructureDefinition/dbBEST-Composition"
)

__all__ = [
    "SCHEMA_VERSION",
    "TEMPLATE_VERSION",
    "FHIR_VERSION",
    "DBBEST_MIN_VERSION",
    "DBBEST_PROFILE_URL",
]
