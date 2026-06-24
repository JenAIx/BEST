<template>
  <div class="drawing-wrap">
    <div class="drawing-canvas-box" :style="{ maxWidth: size + 'px' }">
      <canvas
        ref="canvas"
        class="drawing-canvas"
        :width="size"
        :height="size"
        data-cy="drawing_canvas"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointerleave="onUp"
        @pointercancel="onUp"
      />
    </div>
    <div v-if="!preview" class="row justify-end items-center q-gutter-sm q-mt-xs">
      <span v-if="dirty" class="text-caption text-orange-9" data-cy="drawing_unsaved">
        {{ $t('quest.drawing_unsaved') }}
      </span>
      <q-btn flat dense no-caps icon="delete" :label="$t('quest.clear_drawing')" color="grey-7"
        data-cy="drawing_clear" @click="clearCanvas" />
      <q-btn unelevated no-caps icon="check" :label="$t('quest.confirm_drawing')" color="primary"
        :disable="!dirty" data-cy="drawing_save" @click="confirmDrawing" />
    </div>
  </div>
</template>

<script>
// Zeichen-Item: quadratisches Canvas, in dem der Proband zeichnet (Maus/Touch/Pen
// via Pointer-Events). Das Ergebnis wird als Base64-PNG (data-URI) in item.value
// gespeichert — aber ERST, wenn der Nutzer die Zeichnung explizit per „Übernehmen"
// bestätigt (nicht schon beim ersten Strich). So springt der Fortschritt nicht
// verfrüht auf „beantwortet", und Pflichtfelder (force) bleiben offen, bis
// übernommen wurde. Optionaler Hintergrund (blank | spiral | <datei>.png) als
// Vorlage; der Hintergrund ist Teil des gespeicherten Bildes (hilft beim Befunden).
export default {
  name: 'RenderDrawing',
  props: {
    ITEM: { required: true },
    preview: { type: Boolean, default: false },
  },
  emits: ['emitValue'],
  data() {
    // dirty = es gibt noch nicht übernommene Striche.
    return { ctx: null, drawing: false, hasDrawn: false, dirty: false, last: null }
  },
  computed: {
    size() {
      const s = this.ITEM && this.ITEM.canvas && this.ITEM.canvas.size
      return typeof s === 'number' && s > 0 ? s : 320
    },
    background() {
      return (this.ITEM && this.ITEM.canvas && this.ITEM.canvas.background) || 'blank'
    },
  },
  mounted() {
    const canvas = this.$refs.canvas
    this.ctx = canvas.getContext('2d')
    this.resetBackground()
    // Bestehende Zeichnung (Entwurf / erneutes Bearbeiten) wiederherstellen.
    if (typeof this.ITEM.value === 'string' && this.ITEM.value.startsWith('data:image')) {
      const img = new Image()
      img.onload = () => this.ctx.drawImage(img, 0, 0, this.size, this.size)
      img.src = this.ITEM.value
      this.hasDrawn = true
    }
  },
  methods: {
    // Weißer Grund + optionale Vorlage (wird mitgespeichert).
    resetBackground() {
      const ctx = this.ctx
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, this.size, this.size)
      if (this.background === 'spiral') this.drawSpiral()
      else if (this.background !== 'blank') this.drawImageTemplate(this.background)
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
    },
    // Archimedische Spirale r = b*θ als blasse Vorlage zum Nachzeichnen.
    drawSpiral() {
      const ctx = this.ctx
      const cx = this.size / 2
      const cy = this.size / 2
      const turns = 4
      const maxR = this.size * 0.45
      const b = maxR / (turns * 2 * Math.PI)
      ctx.save()
      ctx.strokeStyle = '#c9ced6'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let theta = 0; theta <= turns * 2 * Math.PI; theta += 0.1) {
        const r = b * theta
        const x = cx + r * Math.cos(theta)
        const y = cy + r * Math.sin(theta)
        if (theta === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
    },
    drawImageTemplate(file) {
      const img = new Image()
      img.onload = () => {
        this.ctx.save()
        this.ctx.globalAlpha = 0.25
        this.ctx.drawImage(img, 0, 0, this.size, this.size)
        this.ctx.restore()
      }
      img.src = `img/${file}`
    },
    pos(e) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left) * (this.size / rect.width),
        y: (e.clientY - rect.top) * (this.size / rect.height),
      }
    },
    onDown(e) {
      if (this.preview) return
      this.drawing = true
      this.last = this.pos(e)
      try { this.$refs.canvas.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    },
    onMove(e) {
      if (!this.drawing || this.preview) return
      const p = this.pos(e)
      this.ctx.beginPath()
      this.ctx.moveTo(this.last.x, this.last.y)
      this.ctx.lineTo(p.x, p.y)
      this.ctx.stroke()
      this.last = p
      this.hasDrawn = true
      this.dirty = true // es gibt nicht übernommene Änderungen
    },
    onUp() {
      if (!this.drawing || this.preview) return
      this.drawing = false
      // Bewusst KEIN emit hier — erst „Übernehmen" schreibt den Wert.
    },
    // Übernimmt die aktuelle Zeichnung als item.value (zählt erst jetzt als beantwortet).
    confirmDrawing() {
      if (!this.hasDrawn) return
      this.dirty = false
      this.$emit('emitValue', this.$refs.canvas.toDataURL('image/png'))
    },
    clearCanvas() {
      this.resetBackground()
      this.hasDrawn = false
      this.dirty = false
      this.$emit('emitValue', '')
    },
  },
}
</script>

<style lang="sass" scoped>
.drawing-canvas-box
  margin: 0 auto

.drawing-canvas
  width: 100%
  aspect-ratio: 1 / 1
  border: 1px solid $line
  border-radius: $radius-sm
  background: #fff
  touch-action: none
  cursor: crosshair
  display: block
</style>
