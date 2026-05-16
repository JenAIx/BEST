<template>
  <div class="cohort-bar-list">
    <div v-if="!items || !items.length" class="text-grey-6 text-caption q-pa-md">
      {{ emptyLabel || 'Keine Daten' }}
    </div>
    <div
      v-for="(item, idx) in displayItems"
      :key="item.key ?? item.label ?? idx"
      class="bar-row"
    >
      <div class="bar-row__label" :title="item.label">{{ item.label }}</div>
      <q-linear-progress
        :value="progressValue(item)"
        :color="item.color || color"
        :buffer="bufferValue(item)"
        size="14px"
        rounded
        class="bar-row__progress"
      />
      <div class="bar-row__count text-grey-8">
        {{ formatCount(item) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /**
   * Rows to render. Each row may carry:
   *   - label, key
   *   - count, total            → renders progress = count / total
   *   - positive, total         → renders positive / total
   *   - taking, notTaking, totalEnrolled  → renders taking / totalEnrolled,
   *     and a secondary "buffer" bar for taking + notTaking
   *   - color (Quasar token, optional override of the default `color` prop)
   */
  items: { type: Array, default: () => [] },
  color: { type: String, default: 'primary' },
  maxItems: { type: Number, default: 16 },
  emptyLabel: { type: String, default: '' },
})

const displayItems = computed(() => (props.items || []).slice(0, props.maxItems))

function progressValue(item) {
  const num = item.count ?? item.positive ?? item.taking ?? 0
  const den = item.total ?? item.totalEnrolled ?? 0
  if (!den) return 0
  return Math.max(0, Math.min(1, num / den))
}

function bufferValue(item) {
  // Only the 3-state drug rows expose `notTaking` + `totalEnrolled` — buffer
  // is "asked, any answer" so the gap to 100% is the "unknown" segment.
  if (item.notTaking == null || !item.totalEnrolled) return undefined
  const asked = (item.taking || 0) + (item.notTaking || 0)
  return Math.max(0, Math.min(1, asked / item.totalEnrolled))
}

function formatCount(item) {
  if (item.taking != null && item.totalEnrolled != null) {
    const pct = item.totalEnrolled ? Math.round((100 * item.taking) / item.totalEnrolled) : 0
    return `${item.taking} / ${item.totalEnrolled} (${pct}%)`
  }
  const num = item.count ?? item.positive ?? 0
  const den = item.total ?? item.totalEnrolled ?? 0
  if (!den) return `${num}`
  const pct = Math.round((100 * num) / den)
  return `${num} / ${den} (${pct}%)`
}
</script>

<style lang="scss" scoped>
.cohort-bar-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(120px, 2fr) auto;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  line-height: 1.2;

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__progress {
    width: 100%;
  }

  &__count {
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    white-space: nowrap;
  }
}
</style>
