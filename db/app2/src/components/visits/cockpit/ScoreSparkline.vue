<template>
  <!-- Tiny inline trend: last N points, last one marked. Pure SVG, no lib. -->
  <svg v-if="points.length >= 2" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="score-sparkline" aria-hidden="true">
    <polyline :points="polyline" fill="none" :stroke="stroke" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    <circle :cx="last.x" :cy="last.y" r="2" :fill="stroke" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{value}]
  width: { type: Number, default: 60 },
  height: { type: Number, default: 14 },
  stroke: { type: String, default: '#5c6bc0' },
  max: { type: Number, default: 8 },
})

const points = computed(() => {
  const vals = props.series.map((s) => Number(s.value)).filter((v) => Number.isFinite(v)).slice(-props.max)
  if (vals.length < 2) return []
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const stepX = (props.width - 4) / (vals.length - 1)
  return vals.map((v, i) => ({ x: 2 + i * stepX, y: props.height - 2 - ((v - min) / span) * (props.height - 4) }))
})
const polyline = computed(() => points.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const last = computed(() => points.value[points.value.length - 1] || { x: 0, y: 0 })
</script>

<style scoped>
.score-sparkline {
  display: block;
}
</style>
