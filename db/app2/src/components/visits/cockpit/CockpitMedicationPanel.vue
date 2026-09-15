<template>
  <!-- Current medication in prescription notation, grouped per template,
       with change markers vs. the last visit and the LEDD sum. -->
  <div class="med-panel" data-cy="cockpit-medication">
    <div class="med-panel__head">
      <div class="text-caption text-grey-7 med-panel__title">{{ $t('visit.cockpit.medication') }}</div>
      <q-space />
      <span v-if="ledd" class="med-panel__ledd" :class="{ 'text-warning': ledd.unresolved.length }">LEDD {{ ledd.total }} mg/d
        <q-tooltip v-if="ledd.unresolved.length">{{ $t('visit.cockpit.leddUnresolved', { n: ledd.unresolved.length }) }}</q-tooltip>
      </span>
    </div>
    <div v-if="!isToday && stateDate" class="text-caption text-grey-6 q-mb-xs">{{ $t('visit.cockpit.stateOf', { date: fmtDate(stateDate) }) }}</div>
    <div v-if="editable" class="row q-gutter-xs q-mb-sm">
      <q-btn v-if="canContinue" dense no-caps outline color="primary" icon="content_copy" :label="$t('visit.cockpit.continueMeds')" data-cy="med-continue" @click="$emit('continue')">
        <q-tooltip>{{ $t('visit.cockpit.continueMedsHint', { date: fmtDate(previousDate) }) }}</q-tooltip>
      </q-btn>
      <q-btn dense no-caps unelevated color="primary" icon="add" :label="$t('visit.cockpit.addMedication')" data-cy="med-add" @click="$emit('add')" />
    </div>

    <div v-if="!medications.length && !(diff && diff.stopped.length)" class="text-caption text-grey-6">{{ $t('visit.cockpit.noMedication') }}</div>

    <template v-for="group in groups" :key="group.label">
      <div v-if="groups.length > 1 && group.rows.length" class="med-group text-caption text-grey-6">{{ group.label }}</div>
      <div v-for="med in group.rows" :key="med.observationId" class="med-row" :class="[`med-row--${markerOf(med) || 'plain'}`, { 'med-row--editable': editable }]" :data-cy="`med-${med.observationId}`" @click="editable && $emit('edit', med)">
        <div class="med-row__main">
          <div class="med-row__name ellipsis">{{ med.drugName }}<span v-if="med.dosage != null" class="med-row__dose">&nbsp;{{ med.dosage }}{{ med.dosageUnit || '' }}</span></div>
          <div class="med-row__schedule text-grey-7">{{ schedule(med) }}</div>
          <div v-if="wasText(med)" class="med-row__was text-grey-6">{{ $t('visit.cockpit.was', { value: wasText(med) }) }}</div>
        </div>
        <q-badge v-if="markerOf(med)" :color="markerColor(markerOf(med))" :label="markerLabel(markerOf(med))" class="med-row__marker" />
        <q-btn v-if="editable" flat round dense size="xs" icon="close" class="med-row__stop" @click.stop="$emit('stop', med)">
          <q-tooltip>{{ $t('visit.cockpit.stopMedication') }}</q-tooltip>
        </q-btn>
      </div>
    </template>

    <template v-if="diff && diff.stopped.length">
      <div class="med-group text-caption text-grey-6">— {{ $t('visit.cockpit.stopped') }} —</div>
      <div v-for="s in diff.stopped" :key="s.key" class="med-row med-row--stopped">
        <div class="med-row__main">
          <div class="med-row__name ellipsis">{{ s.prev[0].drugName }}<span v-if="s.prev[0].dosage != null" class="med-row__dose">&nbsp;{{ s.prev[0].dosage }}{{ s.prev[0].dosageUnit || '' }}</span></div>
          <div class="med-row__schedule text-grey-6">{{ schedule(s.prev[0]) }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { markerFor } from 'src/shared/utils/medication-diff.js'
import { resolveLedType } from 'src/shared/utils/ledd.js'

const props = defineProps({
  medications: { type: Array, default: () => [] },
  diff: { type: Object, default: null },
  ledd: { type: Object, default: null },
  groupsConfig: { type: Array, default: () => [] }, // [{label, ledd:true}|{label, rest:true}]
  drugOptions: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  isToday: { type: Boolean, default: false },
  stateDate: { type: String, default: null },
  previousDate: { type: String, default: null },
  canContinue: { type: Boolean, default: false },
  frequencyAbbrev: { type: Function, default: (f) => f },
  routeAbbrev: { type: Function, default: (r) => r },
})
defineEmits(['add', 'edit', 'stop', 'continue'])
const { t } = useI18n()

const groups = computed(() => {
  const cfg = props.groupsConfig || []
  if (!cfg.length) return [{ label: '', rows: props.medications }]
  const rest = [...props.medications]
  const out = []
  for (const g of cfg) {
    if (g.rest) continue
    const rows = rest.filter((m) => (g.ledd ? !!resolveLedType(m, props.drugOptions).ledType : (g.keys || []).some((k) => m.drugName?.toLowerCase().includes(String(k).toLowerCase()))))
    for (const r of rows) rest.splice(rest.indexOf(r), 1)
    out.push({ label: g.label, rows })
  }
  const restCfg = cfg.find((g) => g.rest)
  out.push({ label: restCfg?.label || t('visit.cockpit.otherGroup'), rows: rest })
  return out
})

const schedule = (med) => [props.frequencyAbbrev(med.frequency) || med.frequency, props.routeAbbrev(med.route) || med.route].filter(Boolean).join(' ')
const markerOf = (med) => markerFor(props.diff, med)
const markerLabel = (m) => ({ new: t('visit.cockpit.markerNew'), up: t('visit.cockpit.markerUp'), down: t('visit.cockpit.markerDown'), changed: t('visit.cockpit.markerChanged') })[m]
const markerColor = (m) => ({ new: 'positive', up: 'orange-8', down: 'orange-8', changed: 'orange-8' })[m]
const wasText = (med) => {
  if (!props.diff) return ''
  const ch = props.diff.changed.find((c) => c.curr.some((r) => r.observationId === med.observationId))
  if (!ch) return ''
  const p = ch.prev[0]
  return [p.dosage != null ? `${p.dosage}${p.dosageUnit || ''}` : null, props.frequencyAbbrev(p.frequency) || p.frequency].filter(Boolean).join(' ')
}
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || ''
}
</script>

<style lang="scss" scoped>
.med-panel {
  &__head {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
  }

  &__title {
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.62rem;
  }

  &__ledd {
    font-size: 0.78rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: $primary;
  }
}

.med-group {
  margin: 8px 0 3px;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.med-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 5px;
  border-left: 3px solid transparent;
  margin-bottom: 2px;
  font-size: 0.8rem;

  &--editable {
    cursor: pointer;

    &:hover {
      background: $grey-2;
    }
  }

  &--new {
    border-left-color: $positive;
  }

  &--up,
  &--down,
  &--changed {
    border-left-color: $orange-7;
  }

  &--stopped {
    opacity: 0.6;

    .med-row__name {
      text-decoration: line-through;
    }
  }

  &__main {
    min-width: 0;
    flex: 1;
  }

  &__name {
    font-weight: 500;
  }

  &__dose {
    font-weight: 400;
  }

  &__schedule {
    font-size: 0.74rem;
    font-variant-numeric: tabular-nums;
  }

  &__was {
    font-size: 0.68rem;
  }

  &__marker {
    align-self: center;
    font-size: 0.6rem;
  }

  &__stop {
    opacity: 0;
    color: $grey-6;
  }

  &:hover &__stop {
    opacity: 1;
  }
}
</style>
