/**
 * Common shape for validator return values.
 *
 * { isValid: boolean, errors: [{ code, message, path? }], warnings: [...] }
 */
export function makeResult(errors = [], warnings = []) {
  return { isValid: errors.length === 0, errors, warnings }
}

export function err(code, message, path) {
  return path ? { code, message, path } : { code, message }
}

export function warn(code, message, path) {
  return path ? { code, message, path } : { code, message }
}
