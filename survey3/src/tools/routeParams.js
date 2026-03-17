export function parseRouteParams(raw) {
  if (raw === undefined || raw === null) return undefined
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    try { return JSON.parse(raw) } catch { return undefined }
  }
}
