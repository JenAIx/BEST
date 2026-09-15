<template>
  <!-- Score tiles from the template: value (today = primary), Δ to the previous
       value, sparkline; click → history + "enter value" / "fill questionnaire". -->
  <div class="score-strip" data-cy="cockpit-scores">
    <div class="score-strip__label text-caption text-grey-7">{{ $t('visit.cockpit.scores') }}</div>
    <div class="score-strip__tiles">
      <div
        v-for="score in scores"
        :key="score.code"
        class="score-tile"
        :class="{ 'score-tile--today': score.isToday, 'score-tile--missing': score.required && editable && !score.isToday, 'score-tile--empty': score.current == null }"
        tabindex="0"
        :data-cy="`score-${score.code}`"
      >
        <div class="score-tile__label ellipsis">{{ score.short || score.code }}</div>
        <div class="score-tile__value">
          <span v-if="score.current != null">{{ fmt(score.current, score) }}<span v-if="score.unit" class="score-tile__unit">{{ score.unit }}</span></span>
          <span v-else class="text-grey-5">–</span>
          <span v-if="score.isToday && score.previous != null" class="score-tile__prev">({{ fmt(score.previous, score) }})</span>
        </div>
        <div class="score-tile__delta" :class="deltaClass(score)">
          <template v-if="score.delta != null">{{ score.delta > 0 ? '▲' : score.delta < 0 ? '▼' : '=' }} {{ score.delta > 0 ? '+' : '' }}{{ fmt(score.delta, score) }}</template>
          <template v-else-if="score.currentDate">{{ shortDate(score.currentDate) }}</template>
          <template v-else>&nbsp;</template>
        </div>
        <ScoreSparkline :series="score.series" :stroke="score.isToday ? '#1976d2' : '#9fa8da'" />

        <q-menu anchor="bottom left" self="top left" class="score-popover" @show="draft = ''">
          <q-card flat class="score-popover__card">
            <q-card-section class="q-pb-none row items-center">
              <div class="text-subtitle2">{{ score.short || score.code }}</div>
              <q-space />
              <span v-if="score.derived === 'ledd'" class="text-caption text-grey-6">{{ $t('visit.cockpit.leddBreakdown') }}</span>
            </q-card-section>
            <q-card-section v-if="score.derived === 'ledd'" class="q-pt-sm">
              <div v-if="!ledd || !ledd.breakdown.length" class="text-caption text-grey-6">{{ $t('visit.cockpit.noValues') }}</div>
              <table v-else class="score-table">
                <tbody>
                  <tr v-for="row in ledd.breakdown" :key="row.observationId || row.drugName">
                    <td>{{ row.drugName }}</td>
                    <td class="text-right text-grey-7">{{ row.dailyDose != null ? `${row.dailyDose} mg/d` : row.prn ? 'p.r.n.' : '' }}</td>
                    <td class="text-right">{{ row.led }} mg</td>
                  </tr>
                  <tr v-if="ledd.comtFromCombination"><td colspan="2" class="text-grey-7">COMT ({{ ledd.comtApplied }})</td><td class="text-right">{{ ledd.comtLed }} mg</td></tr>
                  <tr class="score-table__total"><td colspan="2">LEDD</td><td class="text-right">{{ ledd.total }} mg/d</td></tr>
                </tbody>
              </table>
              <div v-if="ledd && ledd.unresolved.length" class="text-caption text-warning q-mt-xs">{{ $t('visit.cockpit.leddUnresolved', { n: ledd.unresolved.length }) }}: {{ ledd.unresolved.map((u) => u.drugName).join(', ') }}</div>
            </q-card-section>
            <q-card-section v-else class="q-pt-sm">
              <div v-if="!score.rows || !score.rows.length" class="text-caption text-grey-6">{{ $t('visit.cockpit.noValues') }}</div>
              <table v-else class="score-table">
                <tbody>
                  <tr v-for="row in score.rows.slice(0, 8)" :key="row.observationId">
                    <td class="text-grey-7">{{ shortDate(row.visitDate) }}</td>
                    <td class="text-right text-weight-medium">{{ fmt(row.numericValue, score) }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="editable" class="row items-center q-gutter-xs q-mt-sm no-wrap">
                <q-input v-model="draft" dense outlined type="number" :step="score.decimals ? 0.5 : 1" :label="$t('visit.cockpit.enterValue')" class="score-popover__input" @keyup.enter="submit(score)" />
                <q-btn dense flat color="primary" icon="check" :disable="draft === ''" @click="submit(score)" />
                <q-btn v-if="score.questionnaireCode" dense flat no-caps color="primary" icon="quiz" :label="$t('visit.cockpit.fillQuestionnaire')" v-close-popup @click="$emit('fill-questionnaire', score)" />
              </div>
            </q-card-section>
          </q-card>
        </q-menu>
      </div>

      <div class="score-strip__side">
        <q-btn v-if="editable" dense flat no-caps color="primary" icon="add" :label="$t('visit.cockpit.addQuestionnaire')" data-cy="cockpit-add-questionnaire" @click="$emit('add-questionnaire')" />
        <div v-if="missing.length" class="text-caption text-warning">⚠ {{ $t('visit.cockpit.openToday') }}: {{ missing.map((m) => m.short || m.code).join(', ') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ScoreSparkline from './ScoreSparkline.vue'

const props = defineProps({
  scores: { type: Array, default: () => [] }, // consultStore.scoreStrip
  ledd: { type: Object, default: null },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['enter-value', 'fill-questionnaire', 'add-questionnaire'])

const draft = ref('')
const missing = computed(() => (props.editable ? props.scores.filter((s) => s.required && !s.isToday && s.derived !== 'ledd') : []))

const fmt = (v, score) => {
  if (v == null || !Number.isFinite(Number(v))) return '–'
  const n = Number(v)
  return score?.decimals != null ? n.toFixed(score.decimals).replace('.', ',') : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ',')
}
const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : ''
}
const deltaClass = (score) => {
  if (score.delta == null || score.delta === 0) return 'text-grey-6'
  const worse = score.higherIsWorse ? score.delta > 0 : score.delta < 0
  return worse ? 'text-negative' : 'text-positive'
}
const submit = (score) => {
  if (draft.value === '') return
  emit('enter-value', { score, value: Number(draft.value) })
  draft.value = ''
}
</script>

<style lang="scss" scoped>
.score-strip {
  display: flex;
  align-items: stretch;
  gap: 10px;

  &__label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.62rem;
    padding: 2px 0;
  }

  &__tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: stretch;
    flex: 1;
  }

  &__side {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 150px;
  }
}

.score-tile {
  width: 100px;
  min-height: 72px;
  padding: 5px 8px 4px;
  border: 1px solid $grey-4;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 1px;

  &:hover,
  &:focus-visible {
    border-color: $primary;
  }

  &--today {
    background: $blue-1;
    border-color: $blue-3;
  }

  &--missing {
    border-style: dashed;
    border-color: $warning;
  }

  &__label {
    font-size: 0.68rem;
    color: $grey-7;
  }

  &__value {
    font-size: 1.15rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    color: $grey-9;
  }

  &--today &__value {
    color: $primary;
  }

  &__unit {
    font-size: 0.65rem;
    font-weight: 400;
    color: $grey-6;
    margin-left: 2px;
  }

  &__prev {
    font-size: 0.72rem;
    font-weight: 400;
    color: $grey-6;
    margin-left: 4px;
  }

  &__delta {
    font-size: 0.66rem;
    font-variant-numeric: tabular-nums;
  }
}

.score-popover__card {
  min-width: 260px;
  max-width: 380px;
}

.score-popover__input {
  width: 140px;
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;

  td {
    padding: 2px 4px;
    border-bottom: 1px solid $grey-3;
  }

  &__total td {
    font-weight: 600;
    border-bottom: none;
  }
}
</style>
