"""Common Pydantic configuration for all clinical-schema models."""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict


class ClinicalBase(BaseModel):
    """Base class — keeps UPPER_SNAKE field names verbatim, allows extras."""

    model_config = ConfigDict(
        extra="ignore",
        populate_by_name=True,
        validate_assignment=False,
        str_strip_whitespace=False,
    )


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def iso_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()
