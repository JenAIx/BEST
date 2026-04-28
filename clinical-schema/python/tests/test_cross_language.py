"""Cross-language compatibility: JS-built fixtures parse identically in Python."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from dbbest_clinical_schema import parse_simple_json, parse_hl7_composition


PROJECT_ROOT = Path(__file__).resolve().parents[2]
JS_DIR = PROJECT_ROOT / "js"


def _node_available() -> bool:
    return shutil.which("node") is not None and (JS_DIR / "node_modules").exists()


JS_INDEX = (JS_DIR / "index.js").as_posix()


@pytest.mark.skipif(not _node_available(), reason="Node + js/node_modules not available")
def test_js_built_simple_json_parses_in_python(tmp_path: Path):
    script = f"""
import {{
  buildPatient, buildVisit, buildObservation, buildSimpleJsonExport,
}} from '{JS_INDEX}'
const p = buildPatient({{ PATIENT_NUM: 1, PATIENT_CD: 'CL_01' }})
const v = buildVisit({{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-04-28' }})
const o = buildObservation({{ OBSERVATION_ID: 1, ENCOUNTER_NUM: 1, PATIENT_NUM: 1,
                              CONCEPT_CD: 'LID: 8480-6', value: 132 }})
const env = buildSimpleJsonExport({{ patients:[p], visits:[v], observations:[o] }})
console.log(JSON.stringify(env))
""".strip()
    js_file = tmp_path / "build.mjs"
    js_file.write_text(script)
    result = subprocess.run(
        ["node", str(js_file)],
        capture_output=True, text=True, check=True, cwd=PROJECT_ROOT,
        env={**os.environ},
    )
    env = json.loads(result.stdout)
    records = parse_simple_json(env)
    assert records["patients"][0]["PATIENT_CD"] == "CL_01"
    assert records["visits"][0]["ENCOUNTER_NUM"] == 1
    assert records["observations"][0]["NVAL_NUM"] == 132


@pytest.mark.skipif(not _node_available(), reason="Node + js/node_modules not available")
def test_js_built_hl7_parses_in_python(tmp_path: Path):
    script = f"""
import {{
  buildPatient, buildVisit, buildHl7CompositionExport,
}} from '{JS_INDEX}'
const p = buildPatient({{ PATIENT_NUM: 1, PATIENT_CD: 'CL_HL7' }})
const v = buildVisit({{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2026-04-28' }})
const env = buildHl7CompositionExport({{ patients:[p], visits:[v] }})
console.log(JSON.stringify(env))
""".strip()
    js_file = tmp_path / "build_hl7.mjs"
    js_file.write_text(script)
    result = subprocess.run(
        ["node", str(js_file)],
        capture_output=True, text=True, check=True, cwd=PROJECT_ROOT,
        env={**os.environ},
    )
    env = json.loads(result.stdout)
    records = parse_hl7_composition(env)
    assert len(records["patients"]) == 1
    assert records["patients"][0]["PATIENT_CD"] == "CL_HL7"
