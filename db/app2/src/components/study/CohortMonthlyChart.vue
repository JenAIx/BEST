<template>
  <div ref="rootEl" class="cohort-monthly-chart" @mouseleave="hovered = -1">
    <div v-if="!series.length" class="text-grey-6 text-caption q-pa-md">
      {{ emptyLabel }}
    </div>

    <template v-else>
      <svg
        :width="width"
        :height="HEIGHT"
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        class="cohort-monthly-chart__svg"
        role="img"
        :aria-label="ariaLabel"
      >
        <!-- recessive horizontal grid + y labels -->
        <g v-for="tick in yTicks" :key="tick">
          <line :x1="M.left" :x2="width - M.right" :y1="yFor(tick)" :y2="yFor(tick)" class="grid-line" />
          <text :x="M.left - 6" :y="yFor(tick) + 3" text-anchor="end" class="axis-text">{{ tick }}</text>
        </g>

        <!-- baseline -->
        <line :x1="M.left" :x2="width - M.right" :y1="baseY" :y2="baseY" class="axis-line" />

        <!-- bars: rounded 4px cap at the data end, anchored to the baseline -->
        <g v-for="(row, i) in series" :key="row.month">
          <path
            v-if="row.count > 0"
            :d="barPath(i, row.count)"
            :class="['bar', { 'bar--dim': !row.inWindow, 'bar--hover': hovered === i }]"
          />
          <!-- hit target covers the whole slot, full height -->
          <rect
            :x="slotX(i)"
            :y="M.top"
            :width="slotW"
            :height="baseY - M.top"
            class="hit"
            @mouseenter="hovered = i"
          />
        </g>

        <!-- x labels: every January shows the year; month abbreviations when there is room -->
        <g v-for="(row, i) in series" :key="`x-${row.month}`">
          <text
            v-if="xLabelFor(row, i)"
            :x="slotX(i) + slotW / 2"
            :y="HEIGHT - 8"
            text-anchor="middle"
            :class="['axis-text', { 'axis-text--strong': row.month.endsWith('-01') || i === 0 }]"
          >
            {{ xLabelFor(row, i) }}
          </text>
        </g>

        <!-- hover crosshair -->
        <line
          v-if="hovered >= 0"
          :x1="slotX(hovered) + slotW / 2"
          :x2="slotX(hovered) + slotW / 2"
          :y1="M.top"
          :y2="baseY"
          class="crosshair"
        />
      </svg>

      <div
        v-if="hovered >= 0"
        class="cohort-monthly-chart__tooltip"
        :style="tooltipStyle"
      >
        <div class="text-weight-medium">{{ formatMonth(series[hovered].month, locale, 'long') }}</div>
        <div>{{ series[hovered].count }} {{ t('study.insights.enrollmentsShort') }}</div>
        <div class="text-grey-6">{{ t('study.insights.cumulative') }}: {{ series[hovered].cumulative }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildMonthlySeries, formatMonth } from 'src/shared/utils/enrollment-timeline'

const props = defineProps({
  /** Sparse rows from StudyRepository.getCohortEnrollmentsPerMonth().months */
  months: { type: Array, default: () => [] },
  /** ISO dates; months outside the window are dimmed. */
  windowFrom: { type: String, default: null },
  windowTo: { type: String, default: null },
  emptyLabel: { type: String, default: '' },
})

const { t, locale: i18nLocale } = useI18n()
const locale = computed(() => (String(i18nLocale.value).startsWith('en') ? 'en-GB' : 'de-DE'))

const HEIGHT = 200
const M = { top: 12, right: 8, bottom: 26, left: 36 }
const MAX_BAR_W = 28
const GAP = 2

const rootEl = ref(null)
const width = ref(600)
const hovered = ref(-1)

let resizeObserver = null
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect?.width || 0)
      if (w > 0) width.value = w
    })
    resizeObserver.observe(rootEl.value)
  }
  if (rootEl.value?.clientWidth) width.value = rootEl.value.clientWidth
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const series = computed(() =>
  buildMonthlySeries(props.months, { from: props.windowFrom, to: props.windowTo }),
)

const baseY = computed(() => HEIGHT - M.bottom)
const innerW = computed(() => Math.max(0, width.value - M.left - M.right))
const slotW = computed(() => (series.value.length ? innerW.value / series.value.length : 0))
const barW = computed(() => Math.max(2, Math.min(MAX_BAR_W, slotW.value - GAP)))

const maxCount = computed(() => Math.max(1, ...series.value.map((r) => r.count)))
// Counts are integers, so ticks must be too: pick the smallest "nice" step
// that needs at most 5 intervals, then round the axis top up to that step.
const yStep = computed(() => {
  const raw = maxCount.value
  const mag = 10 ** Math.floor(Math.log10(Math.max(1, raw / 5)))
  for (const s of [1, 2, 5, 10]) {
    const step = s * mag
    if (Math.ceil(raw / step) <= 5) return step
  }
  return 10 * mag
})
const yMax = computed(() => Math.max(yStep.value, Math.ceil(maxCount.value / yStep.value) * yStep.value))
const yTicks = computed(() => {
  const ticks = []
  for (let v = 0; v <= yMax.value; v += yStep.value) ticks.push(v)
  return ticks
})

function yFor(value) {
  const h = baseY.value - M.top
  return baseY.value - (value / yMax.value) * h
}
function slotX(i) {
  return M.left + i * slotW.value
}
function barPath(i, count) {
  const x = slotX(i) + (slotW.value - barW.value) / 2
  const w = barW.value
  const top = yFor(count)
  const bottom = baseY.value
  const r = Math.min(4, w / 2, Math.max(0, bottom - top))
  // rounded cap at the top only, flat at the baseline
  return [
    `M${x},${bottom}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + w - r}`,
    `Q${x + w},${top} ${x + w},${top + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ')
}

function xLabelFor(row, i) {
  const isJan = row.month.endsWith('-01')
  if (isJan || i === 0) return row.month.slice(0, 4)
  if (slotW.value >= 30) {
    // show abbreviated month names if there is room for them
    return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(
      new Date(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)) - 1, 1),
    )
  }
  if (slotW.value >= 14 && [4, 7, 10].includes(Number(row.month.slice(5, 7)))) {
    return row.month.slice(5, 7)
  }
  return ''
}

const tooltipStyle = computed(() => {
  if (hovered.value < 0) return {}
  const cx = slotX(hovered.value) + slotW.value / 2
  const flip = cx > width.value * 0.7
  return {
    left: `${cx}px`,
    top: `${M.top}px`,
    transform: flip ? 'translate(calc(-100% - 10px), 0)' : 'translate(10px, 0)',
  }
})

const ariaLabel = computed(() => t('study.insights.enrollmentsPerMonth'))
</script>

<style lang="scss" scoped>
.cohort-monthly-chart {
  position: relative;
  width: 100%;
  user-select: none;

  &__svg {
    display: block;
    overflow: visible;
  }

  &__tooltip {
    position: absolute;
    pointer-events: none;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    z-index: 2;
  }
}

.grid-line {
  stroke: #eeeeee;
  stroke-width: 1;
}
.axis-line {
  stroke: #bdbdbd;
  stroke-width: 1;
}
.axis-text {
  fill: #757575;
  font-size: 11px;
  &--strong {
    fill: #424242;
    font-weight: 500;
  }
}
.bar {
  fill: #3f51b5; // Quasar indigo
  transition: fill 0.12s ease;
  &--dim {
    fill: #cfd8dc;
  }
  &--hover {
    fill: #283593;
  }
  &--dim.bar--hover {
    fill: #90a4ae;
  }
}
.crosshair {
  stroke: #9e9e9e;
  stroke-width: 1;
  stroke-dasharray: 3 3;
  pointer-events: none;
}
.hit {
  fill: transparent;
  cursor: crosshair;
}
</style>
