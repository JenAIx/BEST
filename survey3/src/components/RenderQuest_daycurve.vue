<template>
  <div class="daycurve">
    <ol v-if="!preview" class="daycurve-steps text-body2">
      <li v-if="hasMarker('pill')">Oben bei <b>Tablette</b> antippen, wann Sie Ihre Parkinson-Tabletten nehmen.</li>
      <li v-if="hasMarker('meal')">Bei <b>Essen</b> antippen, wann Sie essen.</li>
      <li>Mit dem Finger Ihren Tag in der Kurve nachfahren: oben gut beweglich, unten schlecht beweglich.</li>
      <li v-if="cur.symptoms.length">Unten in den Zeilen einstreichen, wann Beschwerden auftreten (nochmal drüberstreichen löscht).</li>
    </ol>
    <div class="daycurve-scroll">
      <div
        ref="box"
        class="daycurve-box"
        :class="{ 'daycurve-box--preview': preview }"
        data-cy="daycurve_canvas"
        :style="{ aspectRatio: `${layout.W} / ${layout.H}` }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        v-html="svg"
      />
    </div>
    <div v-if="showFeedback" class="daycurve-feedback q-mt-sm" data-cy="daycurve_feedback">
      <div class="text-caption text-grey-8">{{ summary }}</div>
      <ul v-if="patterns.length" class="daycurve-patterns">
        <li v-for="(pt, k) in patterns" :key="k">{{ pt.text }}</li>
      </ul>
    </div>
    <div v-if="!preview" class="row justify-end items-center q-mt-xs">
      <q-btn flat dense no-caps icon="restart_alt" :label="$t('quest.daycurve_reset')" color="grey-7"
        data-cy="daycurve_reset" @click="reset" />
    </div>
  </div>
</template>

<script>
// Tageskurve (day_curve): Bewegungsprofil eines typischen Tages, gedacht fürs
// iPad. Rechnen und Zeichnen liegen in src/tools/daycurve.js (eine Zeichnung für
// Eingabe, Ergebnis-Tabelle und Druck); diese Komponente setzt nur die Gesten um:
//   - Tablette/Essen-Zeile: antippen setzt/entfernt eine Uhrzeit,
//   - Kurvenfläche: Finger nachfahren, die Linie folgt (Zwischenstellen werden
//     linear aufgefüllt, damit schnelle Striche keine Lücken lassen),
//   - Beschwerde-Zeile: einstreichen; beginnt der Strich auf einem markierten
//     Feld, wird stattdessen gelöscht.
// Gespeichert wird von selbst nach jedem Strich und jedem Antippen — ein eigener
// „Übernehmen"-Knopf wurde vergessen, und die Kurve war dann weg. Eine unberührte
// Kurve bleibt null (Pflichtfeld bleibt offen), „Neu beginnen" setzt zurück.
import {
  dcConfig, emptyCurve, isDayCurveValue, dcLayout, dcHit, dayCurveSvg,
  finalizeCurve, curvePatterns, summaryText, timeAt,
} from 'src/tools/daycurve'

let uidSeq = 0

export default {
  name: 'RenderDayCurve',
  props: {
    ITEM: { required: true },
    preview: { type: Boolean, default: false },
  },
  emits: ['emitValue'],
  data() {
    const cfg = dcConfig(this.ITEM)
    const v = isDayCurveValue(this.ITEM.value) ? JSON.parse(JSON.stringify(this.ITEM.value)) : emptyCurve(cfg)
    return { cfg, cur: v, drag: null, uid: `dc${++uidSeq}` }
  },
  computed: {
    layout() {
      return dcLayout(this.cur)
    },
    svg() {
      return dayCurveSvg(this.cur, { uid: this.uid })
    },
    showFeedback() {
      return this.cfg.feedback || this.preview
    },
    summary() {
      return summaryText(this.cur)
    },
    patterns() {
      return curvePatterns(this.cur)
    },
  },
  methods: {
    hasMarker(key) {
      return this.cur.markers.includes(key)
    },
    point(e) {
      const svg = this.$refs.box.querySelector('svg')
      const rect = (svg || this.$refs.box).getBoundingClientRect()
      const s = this.layout.W / rect.width
      return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s }
    },
    onDown(e) {
      if (this.preview) return
      const p = this.point(e)
      const hit = dcHit(this.cur, this.layout, p.x, p.y)
      if (!hit) return
      if (hit.region === 'marker') {
        const list = hit.key === 'pill' ? this.cur.pills : this.cur.meals
        const t = timeAt(this.cur, hit.i)
        const k = list.indexOf(t)
        if (k >= 0) list.splice(k, 1)
        else list.push(t)
        list.sort((a, b) => this.order(a) - this.order(b))
        this.save()
        return
      }
      try { this.$refs.box.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
      if (hit.region === 'chart') {
        this.cur.values[hit.i] = hit.v
        this.drag = { region: 'chart', last: hit.i }
      } else if (hit.region === 'symptom') {
        const sym = this.cur.symptoms.find((s) => s.key === hit.key)
        const erase = sym.times.includes(timeAt(this.cur, hit.j))
        this.drag = { region: 'symptom', key: hit.key, last: hit.j, erase }
        this.setSlot(sym, hit.j, !erase)
      }
    },
    onMove(e) {
      if (!this.drag || this.preview) return
      const p = this.point(e)
      const L = this.layout
      const n = this.cur.values.length
      const frac = Math.max(0, Math.min(1, (p.x - L.l) / L.pw))
      if (this.drag.region === 'chart') {
        const i = Math.round(frac * (n - 1))
        const v = Math.max(0, Math.min(100, (1 - (p.y - L.t) / L.ph) * 100))
        const a = this.drag.last
        const va = this.cur.values[a]
        const step = i >= a ? 1 : -1
        for (let k = a; k !== i + step; k += step) {
          this.cur.values[k] = a === i ? v : va + ((v - va) * (k - a)) / (i - a)
        }
        this.drag.last = i
      } else {
        const j = Math.min(n - 2, Math.floor(frac * (n - 1)))
        const sym = this.cur.symptoms.find((s) => s.key === this.drag.key)
        const lo = Math.min(j, this.drag.last)
        const hi = Math.max(j, this.drag.last)
        for (let k = lo; k <= hi; k++) this.setSlot(sym, k, !this.drag.erase)
        this.drag.last = j
      }
    },
    onUp() {
      if (!this.drag) return
      this.drag = null
      this.save()
    },
    order(t) {
      const [h, m] = t.split(':').map(Number)
      const s = this.cur.start.split(':').map(Number)
      return ((h * 60 + m - (s[0] * 60 + s[1])) % 1440 + 1440) % 1440
    },
    setSlot(sym, j, on) {
      const t = timeAt(this.cur, j)
      const k = sym.times.indexOf(t)
      if (on && k < 0) {
        sym.times.push(t)
        sym.times.sort((a, b) => this.order(a) - this.order(b))
      } else if (!on && k >= 0) sym.times.splice(k, 1)
    },
    save() {
      this.$emit('emitValue', finalizeCurve(this.cur))
    },
    reset() {
      this.cur = emptyCurve(this.cfg)
      this.drag = null
      this.$emit('emitValue', null)
    },
  },
}
</script>

<style lang="sass" scoped>
.daycurve-steps
  margin: 0 0 $gap-sm
  padding-left: 1.3em
  color: $grey-8

.daycurve
  min-width: 0
  max-width: 100%

.daycurve-scroll
  overflow-x: auto
  max-width: 100%

/* nimmt den verfügbaren Platz; erst unter 520px (kleine Handys) wird horizontal
   gescrollt statt unlesbar klein */
.daycurve-box
  min-width: 520px
  touch-action: none
  user-select: none
  -webkit-user-select: none
  cursor: crosshair
  border: 1px solid $line
  border-radius: $radius-sm
  background: #fff
  box-sizing: content-box
  padding: 4px
  // Höhe aus festem Seitenverhältnis statt aus dem SVG: in Quasars Spalten-Flex
  // (q-item__section, flex-wrap) wurde die Höhe sonst zu klein gerechnet und die
  // nächste Frage überlappte die Kurve.
  :deep(svg)
    display: block
    width: 100%
    height: 100%

.daycurve-box--preview
  cursor: default

.daycurve-patterns
  margin: 4px 0 0
  padding-left: 1.2em
  font-size: 0.85rem
</style>
