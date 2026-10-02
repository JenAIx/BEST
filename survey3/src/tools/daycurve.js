// Tageskurve (Fragetyp `day_curve`): Bewegungsprofil eines typischen Tages.
//
// Die Patientin/der Patient zeichnet ein, wann sie/er gut oder schlecht beweglich
// ist (die klassische Wirkfluktuations-Abbildung), tippt Tabletten- und
// Essenszeiten an und streicht nicht-motorische Beschwerden (Schmerzen,
// Sinnestäuschungen, …) in eigenen Zeilen unter der Kurve ein.
//
// Dieses Modul ist rein (kein DOM, kein Vue) und damit testbar. Es liefert
//   - Konfiguration + Leerwert (dcConfig, emptyCurve),
//   - Auswertung (curveSummary, curvePatterns, finalizeCurve, summaryText),
//   - EINE Zeichnung als SVG-String (dayCurveSvg) — benutzt von der Eingabe
//     (RenderQuest_daycurve.vue), der Ergebnis-Tabelle und dem Druck-PDF,
//   - Geometrie + Trefferprüfung für die Eingabe (dcLayout, dcHit).
//
// Gespeicherter Wert (item.value) — selbstbeschreibend, damit Auswertung und
// Export ohne den Fragebogen auskommen:
//   { kind: 'day_curve', version: 1, start: '06:00', step_min: 30,
//     night_from: '22:00', night_to: '06:00',
//     values: [50, …],                    // n Stützstellen 0–100, Index i = start + i·step
//     pills: ['07:00', …], meals: ['12:30', …],
//     symptoms: [{ key, label, color, times: ['14:00', '14:30'] }],  // je halbe Stunde ab Uhrzeit
//     summary: {…}, patterns: [{ code, time, text, … }] }
//
// Zonen: 0–33 schlecht beweglich (OFF) · 33–67 gut beweglich (ON) · 67–100
// Überbewegungen (ON mit Dyskinesien). Stützstelle i steht für den Abschnitt ab i.

export const DC_ZONE_LOW = 33
export const DC_ZONE_HIGH = 67
export const DC_COLORS = { off: '#cf4b45', on: '#2f9a5a', dys: '#7a5bc2' }
export const DC_ZONE_LABELS = { off: 'schlecht beweglich', on: 'gut beweglich', dys: 'Überbewegungen' }

export const DC_MARKERS = {
  pill: { label: 'Tablette', icon: '💊', color: '#1f6f8b' },
  meal: { label: 'Essen', icon: '🍽', color: '#b58a2a' },
}

const SYMPTOM_PALETTE = ['#d9822b', '#1f8a8a', '#b5487a', '#4a6fa5', '#6b8e23', '#8a6d3b']

export const DC_DEFAULT_SYMPTOMS = [
  { key: 'pain', label: 'Schmerzen' },
  { key: 'hallucinations', label: 'Sinnestäuschungen' },
  { key: 'anxiety', label: 'Angst / Unruhe' },
  { key: 'sleepiness', label: 'starke Müdigkeit' },
]

// Ein verzögertes ON zählt erst ab dieser Dauer (Minuten) als Muster.
export const DC_DELAYED_ON_MIN = 60
// Fenster vor einer Einnahme, in dem ein OFF als Wearing-off gilt (Minuten).
export const DC_WEARING_OFF_WINDOW_MIN = 60
// Fenster nach dem Essen, in dem ein neues OFF auffällt (Minuten).
export const DC_MEAL_WINDOW_MIN = 90
// Anteil einer Beschwerde, ab dem sie "überwiegend" in einer Phase liegt.
export const DC_SYMPTOM_SHARE = 2 / 3

// ---------- Zeit ----------

export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return null
  return (Number(m[1]) * 60 + Number(m[2])) % 1440
}

export function fmtMin(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

// Uhrzeit der Stützstelle i.
export function timeAt(value, i) {
  return fmtMin(toMin(value.start) + i * value.step_min)
}

// Index einer Uhrzeit (gerundet auf das Raster), relativ zum Start.
export function indexOf(value, hhmm) {
  const t = toMin(hhmm)
  if (t === null) return null
  return Math.round((((t - toMin(value.start)) % 1440) + 1440) % 1440 / value.step_min)
}

// ---------- Konfiguration / Leerwert ----------

// Konfiguration aus item.curve (alles optional).
export function dcConfig(item) {
  const c = (item && item.curve) || {}
  const start = toMin(c.start) !== null ? c.start : '06:00'
  const step = Number(c.step_min) > 0 ? Number(c.step_min) : 30
  const hours = Number(c.hours) > 0 ? Number(c.hours) : 24
  const markers = Array.isArray(c.markers) ? c.markers.filter((m) => DC_MARKERS[m]) : ['pill', 'meal']
  const symptoms = (Array.isArray(c.symptoms) ? c.symptoms : DC_DEFAULT_SYMPTOMS).map((s, i) => ({
    key: s.key,
    label: s.label,
    color: s.color || SYMPTOM_PALETTE[i % SYMPTOM_PALETTE.length],
  }))
  return {
    start,
    step_min: step,
    hours,
    n: Math.round((hours * 60) / step) + 1,
    night_from: toMin(c.night_from) !== null ? c.night_from : '22:00',
    night_to: toMin(c.night_to) !== null ? c.night_to : '06:00',
    markers,
    symptoms,
    feedback: c.feedback === true,
  }
}

export function emptyCurve(cfg) {
  return {
    kind: 'day_curve',
    version: 1,
    start: cfg.start,
    step_min: cfg.step_min,
    night_from: cfg.night_from,
    night_to: cfg.night_to,
    markers: cfg.markers.slice(),
    values: Array(cfg.n).fill(50),
    pills: [],
    meals: [],
    symptoms: cfg.symptoms.map((s) => ({ key: s.key, label: s.label, color: s.color, times: [] })),
  }
}

export function isDayCurveValue(v) {
  return !!v && typeof v === 'object' && v.kind === 'day_curve' && Array.isArray(v.values) && v.values.length > 1
}

// ---------- Auswertung ----------

export function zoneOf(v) {
  return v < DC_ZONE_LOW ? 'off' : v > DC_ZONE_HIGH ? 'dys' : 'on'
}

// Zustand je Abschnitt (n-1 Abschnitte).
export function slotStates(value) {
  return value.values.slice(0, -1).map(zoneOf)
}

function nightRange(value) {
  const n = value.values.length
  const from = indexOf(value, value.night_from)
  let to = indexOf(value, value.night_to)
  if (from === null) return [n - 1, n - 1]
  if (to === null || to <= from) to = n - 1
  return [from, to]
}

function symptomSlots(value, s) {
  const n = value.values.length
  return (s.times || []).map((t) => indexOf(value, t)).filter((j) => j !== null && j >= 0 && j < n - 1)
}

const round1 = (x) => Math.round(x * 10) / 10
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)

export function curveSummary(value) {
  const st = slotStates(value)
  const h = value.step_min / 60
  const count = (s) => st.filter((x) => x === s).length
  let switches = 0
  let run = 0
  let longest = 0
  st.forEach((s, j) => {
    if (s === 'off') {
      run++
      longest = Math.max(longest, run)
    } else run = 0
    if (j > 0 && s === 'off' && st[j - 1] !== 'off') switches++
  })
  const [nf, nt] = nightRange(value)
  const nightOff = st.slice(nf, nt).filter((s) => s === 'off').length
  const symptoms = {}
  ;(value.symptoms || []).forEach((s) => {
    const slots = symptomSlots(value, s)
    const inOff = slots.filter((j) => st[j] === 'off').length
    symptoms[s.key] = {
      hours: round1(slots.length * h),
      in_off_pct: pct(inOff, slots.length),
      in_good_pct: slots.length ? 100 - pct(inOff, slots.length) : 0,
    }
  })
  return {
    off_h: round1(count('off') * h),
    on_h: round1(count('on') * h),
    dys_h: round1(count('dys') * h),
    switches_to_off: switches,
    longest_off_h: round1(longest * h),
    night_off_h: round1(nightOff * h),
    pills: (value.pills || []).length,
    symptoms,
  }
}

const de = (x) => String(x).replace('.', ',')

// Muster für die Ärztin/den Arzt. Regeln, kein Befund.
export function curvePatterns(value) {
  const st = slotStates(value)
  const step = value.step_min
  const good = (s) => s === 'on' || s === 'dys'
  const out = []
  const pills = (value.pills || []).map((t) => indexOf(value, t)).filter((i) => i !== null).sort((a, b) => a - b)
  const wWin = Math.max(1, Math.round(DC_WEARING_OFF_WINDOW_MIN / step))

  pills.forEach((p, k) => {
    const before = []
    for (let j = p - wWin; j < p; j++) if (j >= 0) before.push(st[j])
    if (before.includes('off')) {
      out.push(k === 0
        ? { code: 'morning_off', time: timeAt(value, p), text: `Morgen-OFF: schlecht beweglich vor der ersten Tablette (${timeAt(value, p)})` }
        : { code: 'wearing_off', time: timeAt(value, p), text: `Wearing-off: schlecht beweglich vor der Tablette um ${timeAt(value, p)}` })
    }
    if (st[p] === 'off') {
      const next = k + 1 < pills.length ? pills[k + 1] : st.length
      let j = p
      while (j < next && !good(st[j])) j++
      if (j >= next) {
        out.push({ code: 'dose_failure', time: timeAt(value, p), text: `Kein ON nach der Tablette um ${timeAt(value, p)} bis zur nächsten Einnahme (Dosisversagen?)` })
      } else if ((j - p) * step >= DC_DELAYED_ON_MIN) {
        out.push({ code: 'delayed_on', time: timeAt(value, p), minutes: (j - p) * step, text: `Verzögertes ON: nach der Tablette um ${timeAt(value, p)} erst nach ~${(j - p) * step} min gut beweglich` })
      }
    }
  })

  const mWin = Math.max(1, Math.round(DC_MEAL_WINDOW_MIN / step))
  ;(value.meals || []).map((t) => indexOf(value, t)).filter((i) => i !== null).sort((a, b) => a - b).forEach((m) => {
    if (m > 0 && good(st[m - 1]) && st.slice(m, m + mWin).includes('off')) {
      out.push({ code: 'meal_off', time: timeAt(value, m), text: `Nach dem Essen um ${timeAt(value, m)} schlechter beweglich` })
    }
  })

  const sum = curveSummary(value)
  if (sum.night_off_h >= 2) out.push({ code: 'night_off', text: `Nachts ${de(sum.night_off_h)} h schlecht beweglich` })

  ;(value.symptoms || []).forEach((s) => {
    const r = sum.symptoms[s.key]
    if (!r || r.hours < 1) return
    if (r.in_off_pct >= DC_SYMPTOM_SHARE * 100) {
      out.push({ code: 'symptom_in_off', symptom: s.key, text: `${s.label}: ${de(r.hours)} h, überwiegend in schlechten Phasen (${r.in_off_pct} %) – nicht-motorische Fluktuation?` })
    } else if (r.in_good_pct >= DC_SYMPTOM_SHARE * 100) {
      out.push({ code: 'symptom_in_on', symptom: s.key, text: `${s.label}: ${de(r.hours)} h, überwiegend in guten Phasen (${r.in_good_pct} %)` })
    } else {
      out.push({ code: 'symptom', symptom: s.key, text: `${s.label}: ${de(r.hours)} h, ohne klaren Bezug zur Beweglichkeit` })
    }
  })
  return out
}

// Wert zum Speichern: gerundete Werte + Auswertung angehängt.
export function finalizeCurve(value) {
  const v = JSON.parse(JSON.stringify(value))
  v.values = v.values.map((x) => Math.max(0, Math.min(100, Math.round(x))))
  v.summary = curveSummary(v)
  v.patterns = curvePatterns(v)
  return v
}

// Einzeilige Zusammenfassung für Tabellen/CDA.
export function summaryText(value) {
  if (!isDayCurveValue(value)) return ''
  const s = value.summary || curveSummary(value)
  const parts = [
    `OFF ${de(s.off_h)} h`,
    `gut beweglich ${de(s.on_h)} h`,
    `Überbewegungen ${de(s.dys_h)} h`,
    `${s.switches_to_off}× Wechsel in OFF`,
  ]
  ;(value.symptoms || []).forEach((sym) => {
    const r = s.symptoms && s.symptoms[sym.key]
    if (r && r.hours > 0) parts.push(`${sym.label} ${de(r.hours)} h`)
  })
  return parts.join(' · ')
}

// Abgeleitete Zahlen als Ergebnis-Einträge (numerisch → exportierbar).
// Bewusst ignore_for_result: sie fließen nie in eine Bogen-Summe ein.
export function dayCurveResultItems(tag, value) {
  if (!isDayCurveValue(value)) return []
  const s = value.summary || curveSummary(value)
  const base = tag || 'day_curve'
  const out = [
    ['off_h', s.off_h], ['on_h', s.on_h], ['dys_h', s.dys_h],
    ['switches_to_off', s.switches_to_off], ['longest_off_h', s.longest_off_h], ['night_off_h', s.night_off_h],
  ].map(([k, v]) => ({ label: `${base}_${k}`, value: v, ignore_for_result: true }))
  ;(value.symptoms || []).forEach((sym) => {
    const r = s.symptoms && s.symptoms[sym.key]
    if (!r) return
    out.push({ label: `${base}_${sym.key}_h`, value: r.hours, ignore_for_result: true })
    out.push({ label: `${base}_${sym.key}_in_off_pct`, value: r.in_off_pct, ignore_for_result: true })
  })
  return out
}

// ---------- Geometrie ----------

export function dcLayout(value) {
  const W = 960
  const l = 186
  const r = 28
  const rowH = 34
  const gap = 6
  let y = 6
  const markerRows = (value.markers || []).map((key) => {
    const row = { key, y }
    y += rowH + gap
    return row
  })
  const t = y + 6
  const ph = 260
  let sy = t + ph + 58
  const symRows = (value.symptoms || []).map((s) => {
    const row = { key: s.key, y: sy }
    sy += rowH + gap
    return row
  })
  const pw = W - l - r
  const n = value.values.length
  return {
    W, H: sy + 2, l, r, pw, t, ph, rowH, markerRows, symRows, axisY: t + ph + 24, symTop: t + ph + 50,
    x: (i) => l + (i / (n - 1)) * pw,
    y: (v) => t + (1 - v / 100) * ph,
  }
}

// Trefferprüfung in SVG-Koordinaten → welcher Bereich, welche Stelle.
export function dcHit(value, L, px, py) {
  const n = value.values.length
  const frac = (px - L.l) / L.pw
  if (frac < -0.02 || frac > 1.02) return null
  const i = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))))
  const j = Math.max(0, Math.min(n - 2, Math.floor(frac * (n - 1))))
  for (const row of L.markerRows) if (py >= row.y && py <= row.y + L.rowH) return { region: 'marker', key: row.key, i }
  if (py >= L.t - 4 && py <= L.t + L.ph + 4) {
    const v = Math.max(0, Math.min(100, (1 - (py - L.t) / L.ph) * 100))
    return { region: 'chart', i, v }
  }
  for (const row of L.symRows) if (py >= row.y - 3 && py <= row.y + L.rowH + 3) return { region: 'symptom', key: row.key, j }
  return null
}

// ---------- Zeichnung ----------

const escXml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function smoothPath(pts, yMin, yMax) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  const cl = (y) => Math.max(yMin, Math.min(yMax, y))
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cl(p1[1] + (p2[1] - p0[1]) / 6)]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cl(p2[1] - (p3[1] - p1[1]) / 6)]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/**
 * SVG der Tageskurve.
 * @param {object} value  Kurvenwert (isDayCurveValue)
 * @param {object} [opts] { uid: eindeutige id (Gradient), blank: Kurve weglassen (Papierformular) }
 */
export function dayCurveSvg(value, opts = {}) {
  const L = dcLayout(value)
  const n = value.values.length
  const uid = opts.uid || 'dc'
  const p = []
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" class="dc-svg" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">`)
  p.push(`<defs><linearGradient id="${uid}-g" gradientUnits="userSpaceOnUse" x1="0" y1="${L.t}" x2="0" y2="${L.t + L.ph}">`)
  const a = 1 - DC_ZONE_HIGH / 100
  const b = 1 - DC_ZONE_LOW / 100
  p.push(`<stop offset="0" stop-color="${DC_COLORS.dys}"/><stop offset="${a}" stop-color="${DC_COLORS.dys}"/><stop offset="${a}" stop-color="${DC_COLORS.on}"/><stop offset="${b}" stop-color="${DC_COLORS.on}"/><stop offset="${b}" stop-color="${DC_COLORS.off}"/><stop offset="1" stop-color="${DC_COLORS.off}"/></linearGradient></defs>`)

  // Zonen
  const zones = [[100, DC_ZONE_HIGH, '#f0ebfa', 'dys'], [DC_ZONE_HIGH, DC_ZONE_LOW, '#e7f4ec', 'on'], [DC_ZONE_LOW, 0, '#fbebea', 'off']]
  zones.forEach(([hi, lo, fill, z]) => {
    p.push(`<rect x="${L.l}" y="${L.y(hi)}" width="${L.pw}" height="${L.y(lo) - L.y(hi)}" fill="${fill}"/>`)
    p.push(`<text x="${L.l - 12}" y="${(L.y(hi) + L.y(lo)) / 2 + 5}" text-anchor="end" font-size="16" font-weight="600" fill="${DC_COLORS[z]}">${DC_ZONE_LABELS[z]}</text>`)
  })

  // Raster + Uhrzeiten (volle Stunden; beschriftet alle 2 h)
  const perHour = Math.max(1, Math.round(60 / value.step_min))
  for (let i = 0; i < n; i += perHour) {
    const major = (i / perHour) % 2 === 0
    p.push(`<line x1="${L.x(i)}" x2="${L.x(i)}" y1="${L.t}" y2="${L.t + L.ph}" stroke="#fff" stroke-width="${major ? 2 : 1}"/>`)
    if (major) p.push(`<text x="${L.x(i)}" y="${L.axisY}" text-anchor="middle" font-size="14" fill="#5f6a7a">${timeAt(value, i)}</text>`)
  }

  // Marker-Zeilen (Tablette, Essen)
  L.markerRows.forEach((row) => {
    const m = DC_MARKERS[row.key]
    const list = row.key === 'pill' ? value.pills : value.meals
    p.push(`<rect x="${L.l}" y="${row.y}" width="${L.pw}" height="${L.rowH}" rx="7" fill="#f2f4f7"/>`)
    p.push(`<text x="${L.l - 12}" y="${row.y + L.rowH / 2 + 6}" text-anchor="end" font-size="16" fill="#1d2430">${escXml(m.label)}</text>`)
    ;(list || []).forEach((t) => {
      const i = indexOf(value, t)
      if (i === null || i >= n) return
      p.push(`<line x1="${L.x(i)}" x2="${L.x(i)}" y1="${L.t}" y2="${L.t + L.ph}" stroke="${m.color}" stroke-width="1.6" stroke-dasharray="5 5" opacity=".75"/>`)
      p.push(`<text x="${L.x(i)}" y="${row.y + L.rowH / 2 + 8}" text-anchor="middle" font-size="22">${m.icon}</text>`)
    })
  })

  // Beschwerde-Zeilen
  if (L.symRows.length) {
    p.push(`<text x="${L.l}" y="${L.symTop - 2}" font-size="13" font-weight="600" fill="#5f6a7a">Beschwerden – wann treten sie auf?</text>`)
  }
  ;(value.symptoms || []).forEach((s, k) => {
    const row = L.symRows[k]
    p.push(`<rect x="${L.l}" y="${row.y}" width="${L.pw}" height="${L.rowH}" rx="7" fill="#f2f4f7"/>`)
    p.push(`<circle cx="${L.l - 14}" cy="${row.y + L.rowH / 2}" r="6" fill="${s.color}"/>`)
    p.push(`<text x="${L.l - 26}" y="${row.y + L.rowH / 2 + 6}" text-anchor="end" font-size="16" fill="#1d2430">${escXml(s.label)}</text>`)
    symptomSlots(value, s).forEach((j) => {
      p.push(`<rect x="${L.x(j) + 0.5}" y="${row.y + 3}" width="${L.x(j + 1) - L.x(j) - 1}" height="${L.rowH - 6}" rx="4" fill="${s.color}"/>`)
    })
  })

  // Nacht (über Kurve und Beschwerde-Zeilen)
  const [nf, nt] = nightRange(value)
  if (nt > nf) {
    const lastRow = L.symRows.length ? L.symRows[L.symRows.length - 1].y + L.rowH : L.t + L.ph
    p.push(`<rect x="${L.x(nf)}" y="${L.t}" width="${L.x(nt) - L.x(nf)}" height="${lastRow - L.t}" fill="rgba(40,55,90,.07)"/>`)
    p.push(`<text x="${(L.x(nf) + L.x(nt)) / 2}" y="${L.t + 20}" text-anchor="middle" font-size="14" fill="#5f6a7a">☾ Nacht</text>`)
  }

  // Kurve
  if (!opts.blank) {
    const pts = value.values.map((v, i) => [L.x(i), L.y(v)])
    p.push(`<path d="${smoothPath(pts, L.y(100), L.y(0))}" fill="none" stroke="url(#${uid}-g)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`)
  }
  p.push('</svg>')
  return p.join('')
}
