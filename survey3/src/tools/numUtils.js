// Helfer für numerische Eingaben (number-Items).

// Klemmt einen Wert in den optionalen Bereich [min, max].
// - value: bereits geparste Zahl (oder null/undefined/NaN → unverändert durchgereicht)
// - min/max: optional; ist nur eine Grenze gesetzt, wird nur diese angewandt.
// Gibt für nicht-numerische Eingaben den Wert unverändert zurück (kein erzwungenes 0).
export function clampNumber(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return value
  let v = value
  if (typeof min === 'number' && !Number.isNaN(min) && v < min) v = min
  if (typeof max === 'number' && !Number.isNaN(max) && v > max) v = max
  return v
}
