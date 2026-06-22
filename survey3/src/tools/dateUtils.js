import dateFormat from 'dateformat'

// Einheitliche Tagesdarstellung (YYYY-MM-DD) für ms-Timestamps oder Datums-Strings.
export function formatDay(d) {
  if (!d) return ''
  return dateFormat(d, 'yyyy-mm-dd')
}

// Wandelt einen Datums-String (YYYY-MM-DD bzw. ISO) in einen ms-Timestamp.
// Konvention „ms intern" (siehe ARCHITECTURE.md): System-Datums werden als ms
// gehalten; Eingaben aus q-date (YYYY-MM-DD) werden hiermit normalisiert.
// - leer/ungültig → null; bereits eine Zahl → unverändert (idempotent).
export function toTimestamp(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  // YYYY-MM-DD als LOKALE Mitternacht parsen (sonst UTC → Off-by-one ggü.
  // formatDay, das Lokalzeit nutzt).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}
