import dateFormat from 'dateformat'

// Einheitliche Tagesdarstellung (YYYY-MM-DD) für ms-Timestamps oder Datums-Strings.
export function formatDay(d) {
  if (!d) return ''
  return dateFormat(d, 'yyyy-mm-dd')
}
