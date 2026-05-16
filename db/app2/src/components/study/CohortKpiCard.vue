<template>
  <q-card flat bordered class="kpi-card">
    <q-card-section class="q-pa-md">
      <div class="row items-center no-wrap q-gutter-sm">
        <q-icon v-if="icon" :name="icon" :color="iconColor || 'primary'" size="28px" />
        <div class="col">
          <div class="kpi-value">{{ value }}</div>
          <div class="kpi-label text-grey-7">{{ label }}</div>
        </div>
        <div v-if="delta != null" class="kpi-delta" :class="deltaClass">
          <q-icon :name="deltaIcon" size="14px" />
          {{ deltaText }}
        </div>
      </div>
      <div v-if="caption" class="kpi-caption text-grey-6 q-mt-sm">{{ caption }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  caption: { type: String, default: '' },
  icon: { type: String, default: '' },
  iconColor: { type: String, default: '' },
  /**
   * Optional Δ-value (numeric) for trend KPIs. Positive renders green,
   * negative orange. The component does not interpret the sign clinically;
   * if "lower is better" (e.g. LDL drop), the caller can flip the sign or
   * pass `deltaInverse: true`.
   */
  delta: { type: [Number, null], default: null },
  deltaLabel: { type: String, default: '' },
  deltaInverse: { type: Boolean, default: false },
})

const deltaClass = computed(() => {
  if (props.delta == null) return ''
  const sign = props.delta > 0 ? (props.deltaInverse ? 'negative' : 'positive') : props.delta < 0 ? (props.deltaInverse ? 'positive' : 'negative') : 'neutral'
  return `kpi-delta--${sign}`
})

const deltaIcon = computed(() => {
  if (props.delta == null || props.delta === 0) return 'remove'
  return props.delta > 0 ? 'arrow_upward' : 'arrow_downward'
})

const deltaText = computed(() => {
  if (props.delta == null) return ''
  const sign = props.delta > 0 ? '+' : ''
  const formatted = `${sign}${Number(props.delta).toFixed(2)}`
  return props.deltaLabel ? `${formatted} ${props.deltaLabel}` : formatted
})
</script>

<style lang="scss" scoped>
.kpi-card {
  background: white;
}

.kpi-value {
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.kpi-label {
  font-size: 0.8rem;
  margin-top: 2px;
}

.kpi-caption {
  font-size: 0.72rem;
}

.kpi-delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;

  &--positive {
    color: #1b8a3a;
    background: rgba(33, 186, 69, 0.1);
  }

  &--negative {
    color: #c62828;
    background: rgba(244, 67, 54, 0.1);
  }

  &--neutral {
    color: #757575;
    background: rgba(0, 0, 0, 0.05);
  }
}
</style>
