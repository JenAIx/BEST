import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// js/src/version.js → js/src → js → repo root
const versionFile = resolve(here, '..', '..', 'VERSION')

let version
try {
  version = readFileSync(versionFile, 'utf8').trim()
} catch {
  version = '0.0.0-unknown'
}

export const SCHEMA_VERSION = version
export const TEMPLATE_VERSION = version
export const FHIR_VERSION = '4.0.1'
export const DBBEST_MIN_VERSION = '0.0.1'
export const DBBEST_PROFILE_URL =
  'https://github.com/stebro01/dbBEST/StructureDefinition/dbBEST-Composition'
