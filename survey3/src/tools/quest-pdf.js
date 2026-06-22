// Erzeugt ein einfaches, druckbares HTML-Leerformular aus einem Fragebogen
// (zum Ausdrucken und handschriftlichen Ausfüllen). Reine Funktion ohne
// DOM-Zugriff -> testbar. Bild-URLs werden über `imgBase` absolut gemacht,
// da das Druckfenster (window.open('')) keine brauchbare Base-URL hat.
//
// Einstieg: buildQuestPdfHtml(quest, { dateStr, timeStr, imgBase })

const esc = (s) => (s == null ? '' : String(s))
const stripHtml = (s) => esc(s).replace(/<[^>]*>/g, ' ').trim()
const hasOwnNum = (lbl) => /^\s*\d/.test(lbl)
const numPrefix = (n, lbl) => (hasOwnNum(lbl) ? '' : `<span class="item-num">${n}.</span> `)

// separator / textbox / undefined -> Abschnitts-Überschrift bzw. Hinweistext
function renderSection(item) {
  const label = item.label || ''
  const caption = item.caption || ''
  if (!label && !caption) return ''
  return (
    `<div class="section-block">` +
    (label ? `<div class="section-label">${label}</div>` : '') +
    (caption ? `<div class="section-caption">${caption}</div>` : '') +
    `</div>`
  )
}

// image -> Bild(er) einbetten (zuvor komplett übersprungen)
function renderImage(item, imgBase) {
  const files = Array.isArray(item.value) ? item.value : item.value ? [item.value] : []
  if (!files.length) return ''
  const style = typeof item.width === 'number' ? ` style="width:${item.width}px"` : ''
  const imgs = files.map((f) => `<img class="pdf-image" src="${imgBase}${esc(f)}"${style} alt="">`).join('')
  return `<div class="item-block image-block">${imgs}</div>`
}

// multiple_radio -> kompakte Tabelle (Fragen × Antwortspalten mit Kreisen)
function renderMultipleRadio(item, ctx) {
  const groupLabel = stripHtml(item.label)
  const answers = (item.options && item.options.answers) || []
  const questions = (item.options && item.options.questions) || []
  let html = groupLabel ? `<div class="section-block"><div class="section-label">${groupLabel}</div></div>` : ''
  html += `<table class="mr-table"><thead><tr><th class="mr-q"></th>`
  answers.forEach((a) => {
    html += `<th class="mr-a">${esc(a.label)}</th>`
  })
  html += `</tr></thead><tbody>`
  questions.forEach((q) => {
    ctx.num++
    const qLabel = esc(q.label || q.tag || `Frage ${ctx.num}`)
    const pfx = hasOwnNum(qLabel) ? '' : `<span class="mr-num">${ctx.num}.</span> `
    html += `<tr><td class="mr-q">${pfx}${qLabel}</td>`
    answers.forEach(() => {
      html += `<td class="mr-a"><span class="radio-circle"></span></td>`
    })
    html += `</tr>`
  })
  return html + `</tbody></table>`
}

// radio / checkbox -> Optionen inline mit Kreisen bzw. Kästchen
function renderOptions(item, label, ctx, shape) {
  let html = `<div class="item-block"><div class="item-label">${numPrefix(ctx.num, label)}${label}</div><div class="radio-options">`
  ;(item.options || []).forEach((o) => {
    html += `<label class="radio-opt"><span class="${shape}"></span> ${esc(o.label)}</label>`
  })
  return html + `</div></div>`
}

// text -> Label + Schreiblinie
function renderText(label, ctx) {
  return `<div class="item-block"><div class="item-label">${numPrefix(ctx.num, label)}${label}</div><div class="input-line"></div></div>`
}

// number / date / date_year / time -> Label + kleines Eingabekästchen
function renderShortInput(item, label, ctx) {
  const hint =
    item.type === 'time' ? 'hh:mm' : item.type === 'date' ? 'TT.MM.JJJJ' : item.type === 'date_year' ? 'JJJJ' : ''
  return `<div class="item-block item-inline"><div class="item-label">${numPrefix(ctx.num, label)}${label}</div><div class="input-box">${hint ? `<span class="input-hint">${hint}</span>` : ''}</div></div>`
}

// slider -> beschriftete VAS-Skala (zuvor nur ein leeres Kästchen ohne Skala).
// Endpunkt-Labels/Werte aus options.top/bottom; 11 gleichmäßige Teilstriche.
function renderVas(item, label, ctx) {
  const opt = item.options || {}
  const top = opt.top || {}
  const bottom = opt.bottom || {}
  const max = Number(top.value != null ? top.value : 100)
  const min = Number(bottom.value != null ? bottom.value : 0)
  const vertical = !!item.vertical
  const topLabel = stripHtml(top.label)
  const bottomLabel = stripHtml(bottom.label)

  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const frac = i / 10
    // vertikal: oben = max; horizontal: links = min
    const v = vertical ? max - frac * (max - min) : min + frac * (max - min)
    ticks.push(Math.round(v))
  }
  const head = `<div class="item-label">${numPrefix(ctx.num, label)}${label}</div>`

  if (vertical) {
    const rows = ticks.map((t) => `<div class="vas-tick-v"><span class="vas-mark"></span><span class="vas-num">${t}</span></div>`).join('')
    return `<div class="item-block vas-block">${head}
      <div class="vas vas-v">
        ${topLabel ? `<div class="vas-end-label">${topLabel}</div>` : ''}
        <div class="vas-track-v">${rows}</div>
        ${bottomLabel ? `<div class="vas-end-label">${bottomLabel}</div>` : ''}
      </div></div>`
  }
  const marks = ticks.map((t) => `<div class="vas-tick-h"><span class="vas-mark-h"></span><span class="vas-num">${t}</span></div>`).join('')
  return `<div class="item-block vas-block">${head}
    <div class="vas vas-h">
      <div class="vas-track-h">${marks}</div>
      <div class="vas-ends"><span>${bottomLabel}</span><span>${topLabel}</span></div>
    </div></div>`
}

function renderItem(item, ctx, imgBase) {
  if (!item.type || item.type === 'separator' || item.type === 'textbox') {
    return renderSection(item)
  }
  if (item.type === 'image') return renderImage(item, imgBase)
  if (item.type === 'multiple_radio' && item.options && item.options.questions) return renderMultipleRadio(item, ctx)

  // Ab hier zählende Items
  ctx.num++
  const label = stripHtml(item.label)
  if (item.type === 'radio' && item.options) return renderOptions(item, label, ctx, 'radio-circle')
  if (item.type === 'checkbox' && item.options) return renderOptions(item, label, ctx, 'check-box')
  if (item.type === 'slider') return renderVas(item, label, ctx)
  if (item.type === 'text') return renderText(label, ctx)
  if (['number', 'date', 'date_year', 'time'].includes(item.type)) return renderShortInput(item, label, ctx)
  return renderText(label, ctx) // Fallback: Schreiblinie
}

export function buildQuestPdfHtml(quest, { dateStr = '', timeStr = '', imgBase = '' } = {}) {
  const items = quest.items || []
  const ctx = { num: 0 }
  const bodyHtml = items.map((item) => renderItem(item, ctx, imgBase)).join('')

  const pidHtml = `<div class="pid-block">
        <span class="pid-label">Patienten-ID / Code:</span>
        <span class="pid-line"></span>
        <span class="pid-label" style="margin-left:24px">Datum:</span>
        <span class="pid-line-short"></span>
      </div>`

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${esc(quest.title)} — PDF Export</title>
<style>
  @page { size: A4; margin: 16mm 14mm 16mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.5pt; color: #1a1a1a; line-height: 1.4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #333; padding-bottom: 8px; margin-bottom: 14px; }
  .header-left h1 { font-size: 15pt; font-weight: 700; color: #1a1a1a; margin: 0; }
  .header-left .subtitle { font-size: 9pt; color: #666; margin-top: 2px; }
  .header-right { text-align: right; font-size: 8pt; color: #999; line-height: 1.5; }

  /* PID */
  .pid-block { display: flex; align-items: baseline; margin-bottom: 16px; font-size: 9pt; }
  .pid-label { font-weight: 600; color: #333; white-space: nowrap; }
  .pid-line { flex: 1; border-bottom: 1px solid #999; margin-left: 8px; min-width: 120px; height: 16px; }
  .pid-line-short { border-bottom: 1px solid #999; margin-left: 8px; width: 100px; height: 16px; }

  /* Section blocks */
  .section-block { margin: 14px 0 6px; page-break-inside: avoid; }
  .section-label { font-weight: 600; font-size: 10pt; color: #1a1a1a; border-left: 3px solid #555; padding-left: 8px; }
  .section-caption { font-size: 8.5pt; color: #666; margin-top: 2px; padding-left: 11px; }

  /* Item blocks */
  .item-block { margin: 8px 0; page-break-inside: avoid; }
  .item-label { color: #333; margin-bottom: 3px; }
  .item-num { color: #999; font-size: 8.5pt; min-width: 20px; display: inline-block; }
  .item-inline { display: flex; align-items: baseline; gap: 12px; }
  .item-inline .item-label { flex: 1; margin-bottom: 0; }

  /* Input elements */
  .input-line { border-bottom: 1px solid #bbb; height: 20px; margin-top: 2px; }
  .input-box { border: 1px solid #bbb; border-radius: 3px; min-width: 80px; width: 100px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .input-hint { font-size: 7.5pt; color: #ccc; letter-spacing: 1px; }

  /* Radio / Checkbox options */
  .radio-options { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 3px; padding-left: 20px; }
  .radio-opt { display: inline-flex; align-items: center; gap: 5px; font-size: 9pt; color: #444; cursor: default; }
  .radio-circle { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #888; border-radius: 50%; flex-shrink: 0; }
  .check-box { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #888; border-radius: 2px; flex-shrink: 0; }

  /* Multiple-radio compact table */
  .mr-table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.5pt; page-break-inside: avoid; }
  .mr-table th { padding: 4px 6px; font-weight: 600; color: #555; border-bottom: 2px solid #ccc; text-align: center; font-size: 7.5pt; line-height: 1.3; }
  .mr-table th.mr-q { text-align: left; width: 50%; }
  .mr-table td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: middle; }
  .mr-table td.mr-q { color: #333; }
  .mr-table td.mr-a { text-align: center; }
  .mr-num { color: #999; font-size: 8pt; }
  .mr-table .radio-circle { width: 10px; height: 10px; }

  /* Images */
  .image-block { text-align: center; margin: 10px 0; page-break-inside: avoid; }
  .pdf-image { max-width: 100%; height: auto; margin: 4px 6px; }

  /* VAS / Slider-Skala */
  .vas-block { margin: 10px 0 16px; page-break-inside: avoid; }
  .vas-v { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 6px; }
  .vas-end-label { font-size: 8pt; color: #555; max-width: 70mm; }
  .vas-track-v { display: flex; flex-direction: column; justify-content: space-between; height: 80mm; border-left: 1.5px solid #333; margin-left: 10px; }
  .vas-tick-v { display: flex; align-items: center; gap: 6px; }
  .vas-mark { display: inline-block; width: 9px; border-top: 1px solid #555; }
  .vas-num { font-size: 7.5pt; color: #666; }
  .vas-h { margin-top: 10px; }
  .vas-track-h { display: flex; justify-content: space-between; align-items: flex-start; border-top: 1.5px solid #333; }
  .vas-tick-h { display: flex; flex-direction: column; align-items: center; }
  .vas-mark-h { display: inline-block; height: 9px; border-left: 1px solid #555; }
  .vas-ends { display: flex; justify-content: space-between; font-size: 8pt; color: #555; margin-top: 4px; gap: 12px; }

  /* Manual / description */
  .manual { background: #f7f7f7; border-left: 3px solid #555; padding: 8px 12px; margin-bottom: 14px; font-size: 8.5pt; color: #444; page-break-inside: avoid; }
  .manual p { margin-bottom: 3px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${esc(quest.title)}</h1>
      ${quest.description ? `<div class="subtitle">${esc(quest.description)}</div>` : ''}
    </div>
    <div class="header-right">${dateStr}<br>${timeStr}</div>
  </div>

  ${pidHtml}

  ${quest.manual ? `<div class="manual">${quest.manual}</div>` : ''}

  ${bodyHtml}

</body>
</html>`
}
