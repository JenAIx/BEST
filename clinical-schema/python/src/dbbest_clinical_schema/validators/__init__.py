"""Lightweight envelope validation. Pydantic models already validate records."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)


def _err(code: str, message: str, path: str | None = None) -> dict:
    return {"code": code, "message": message, **({"path": path} if path else {})}


def _warn(code: str, message: str, path: str | None = None) -> dict:
    return {"code": code, "message": message, **({"path": path} if path else {})}


def validate_simple_json_envelope(envelope: Any) -> ValidationResult:
    errors: list[dict] = []
    warnings: list[dict] = []
    if not isinstance(envelope, dict):
        return ValidationResult(False, [_err("INVALID_ENVELOPE", "Envelope must be a dict")])
    if "metadata" not in envelope:
        warnings.append(_warn("MISSING_METADATA", "Envelope has no metadata"))
    data = envelope.get("data")
    if data is None:
        errors.append(_err("MISSING_DATA", "Envelope must contain data"))
        return ValidationResult(False, errors, warnings)
    for key in ("patients", "visits", "observations"):
        if key in data and not isinstance(data[key], list):
            errors.append(_err(f"{key.upper()}_NOT_LIST", f"data.{key} must be a list"))
    return ValidationResult(not errors, errors, warnings)


def validate_hl7_composition_envelope(envelope: Any) -> ValidationResult:
    errors: list[dict] = []
    warnings: list[dict] = []
    if not isinstance(envelope, dict):
        return ValidationResult(False, [_err("INVALID_ENVELOPE", "Envelope must be a dict")])
    cda = envelope if envelope.get("resourceType") == "Composition" else envelope.get("cda")
    if not cda:
        return ValidationResult(False, [_err("MISSING_CDA", "Envelope has no .cda Composition")])
    if cda.get("resourceType") != "Composition":
        errors.append(_err("INVALID_RESOURCE_TYPE", "Expected resourceType='Composition'"))
    if not isinstance(cda.get("section"), list):
        errors.append(_err("MISSING_SECTIONS", "Composition.section must be a list"))
    if not cda.get("title"):  warnings.append(_warn("MISSING_TITLE", "Composition.title is empty"))
    if not cda.get("date"):   warnings.append(_warn("MISSING_DATE", "Composition.date is empty"))
    if not cda.get("status"): warnings.append(_warn("MISSING_STATUS", "Composition.status is empty"))
    return ValidationResult(not errors, errors, warnings)


def validate_envelope(envelope: Any) -> ValidationResult:
    if isinstance(envelope, dict) and (
        envelope.get("resourceType") == "Composition"
        or (isinstance(envelope.get("cda"), dict) and envelope["cda"].get("resourceType") == "Composition")
    ):
        return validate_hl7_composition_envelope(envelope)
    return validate_simple_json_envelope(envelope)


__all__ = [
    "ValidationResult",
    "validate_simple_json_envelope",
    "validate_hl7_composition_envelope",
    "validate_envelope",
]
