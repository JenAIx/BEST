// Read the VERSION file when running in Node. In a browser bundler
// (Vite, etc.) the `node:*` modules are externalised — destructured
// named imports turn into property access on a throwing Proxy. Using
// default-imports keeps the proxy untouched at module load; we only
// touch it inside the try block, where the throw is caught and the
// hardcoded fallback below is used instead.

import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'

let version = '1.0.0'
try {
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  const versionFile = path.resolve(here, '..', '..', 'VERSION')
  version = fs.readFileSync(versionFile, 'utf8').trim()
} catch {
  // Browser (or missing VERSION file): keep the hardcoded fallback.
}

export const SCHEMA_VERSION = version
export const TEMPLATE_VERSION = version
export const FHIR_VERSION = '4.0.1'
export const DBBEST_MIN_VERSION = '0.0.1'
export const DBBEST_PROFILE_URL =
  'https://github.com/stebro01/dbBEST/StructureDefinition/dbBEST-Composition'
