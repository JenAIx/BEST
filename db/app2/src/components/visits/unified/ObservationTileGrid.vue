<template>
  <!-- Compact read rendering: one tile per observation — value first,
       short concept beneath, value type as left accent, full concept name
       + code on hover. Content decides the width (tileSpan): numbers side
       by side, long text full row, files/questionnaires wide. -->
  <div v-if="categorizedObservations.length > 0" class="tile-groups">
    <div v-for="category in categorizedObservations" :key="category.name" class="tile-group" :data-group-name="category.name">
      <div class="tile-group-head">
        <q-icon :name="category.icon || getCategoryIcon(category.name)" size="16px" />
        <span>{{ category.name }}</span>
        <span class="tile-group-count">({{ category.observations.length }})</span>
      </div>

      <div class="tile-grid">
        <div
          v-for="obs in category.observations"
          :key="obs.observationId"
          class="obs-tile"
          :class="[`obs-tile--${tileSpan(obs)}`, { 'obs-tile--clickable': isPreviewable(obs), 'obs-tile--empty': isEmptyValue(obs), 'obs-tile--pending': isPendingQuest(obs) }]"
          :style="{ '--tv': valueTypeHex(obs.valueType) }"
          @click="onTileClick(obs)"
        >
          <!-- Value line by type -->
          <div v-if="obs.valueType === 'R'" class="tile-value">
            <q-icon :name="getFileIcon(obs.fileInfo?.ext)" size="15px" :color="getFileColor(obs.fileInfo?.ext)" />
            <span class="ellipsis">{{ obs.fileInfo?.title || obs.fileInfo?.filename || obs.displayValue }}</span>
            <span v-if="obs.fileInfo?.size" class="tile-unit">{{ formatFileSize(obs.fileInfo.size) }}</span>
          </div>
          <div v-else-if="obs.valueType === 'Q'" class="tile-value">
            <q-icon :name="questMeta(obs).isCompleted ? 'check_circle' : 'pending'" size="15px" :color="questMeta(obs).isCompleted ? 'positive' : 'amber-8'" />
            <span class="ellipsis">{{ questMeta(obs).title }}</span>
            <span v-if="questMeta(obs).score !== null" class="tile-unit">{{ $t('visit.questionnaireScore', { score: questMeta(obs).score }) }}</span>
            <span v-else-if="!questMeta(obs).isCompleted" class="tile-unit">{{ $t('visit.questionnaireFill') }}</span>
          </div>
          <div v-else-if="obs.valueType === 'M'" class="tile-value">
            <q-icon name="medication" size="15px" color="purple-7" />
            <span class="ellipsis">{{ medicationTileText(obs) }}</span>
          </div>
          <div v-else-if="isEmptyValue(obs)" class="tile-value tile-value--empty">
            <span>∅</span>
            <span v-if="obs.unit" class="tile-unit">{{ obs.unit }}</span>
          </div>
          <div v-else-if="tileSpan(obs) === 'full'" class="tile-value tile-value--text">{{ obs.displayValue }}</div>
          <div v-else class="tile-value">
            <span class="ellipsis">{{ obs.displayValue }}</span>
            <span v-if="obs.unit" class="tile-unit">{{ obs.unit }}</span>
          </div>

          <!-- R tiles: file-typical subline (filename — description);
               Q tiles: questionnaire short title/code;
               everything else shows the short concept name -->
          <div v-if="obs.valueType === 'R'" class="tile-concept ellipsis">{{ fileSubline(obs) }}</div>
          <div v-else-if="obs.valueType === 'Q'" class="tile-concept ellipsis">{{ questMeta(obs).shortTitle || questMeta(obs).questionnaireCode || shortConceptName(obs.conceptName) }}</div>
          <div v-else class="tile-concept ellipsis">{{ shortConceptName(obs.conceptName) }}</div>

          <!-- Incomplete questionnaires wear their fill progress -->
          <q-linear-progress v-if="isPendingQuest(obs) && questMeta(obs).progress !== null" :value="questMeta(obs).progress" color="amber-8" rounded size="3px" class="tile-progress" />

          <q-tooltip :delay="350" max-width="360px">
            <div class="tile-tooltip">
              {{ obs.conceptName }}
              <div v-if="obs.fileInfo?.title && obs.fileInfo?.filename && obs.fileInfo.title !== obs.fileInfo.filename" class="tile-tooltip-file">{{ obs.fileInfo.filename }}</div>
              <div v-if="obs.fileInfo?.description" class="tile-tooltip-desc">{{ obs.fileInfo.description }}</div>
              <div class="tile-tooltip-code">{{ obs.conceptCode }}</div>
            </div>
          </q-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getCategoryIcon, getFileIcon, getFileColor, formatFileSize } from 'src/shared/utils/medical-utils.js'
import { shortConceptName, tileSpan, valueTypeHex, parseMedicationObservation, formatMedicationSummary } from 'src/shared/utils/observation-display.js'
import { parseQuestionnaireObservation } from 'src/shared/utils/questionnaire-display.js'
import { useMedicationOptions } from 'src/composables/useMedicationOptions'

defineOptions({
  name: 'ObservationTileGrid',
})

const props = defineProps({
  // [{ name, icon?, observations: [...] }] — groupObservationsByFieldSets shape
  categorizedObservations: { type: Array, default: () => [] },
})

const emit = defineEmits(['preview-file', 'preview-questionnaire'])

const isPreviewable = (obs) => obs.valueType === 'R' || obs.valueType === 'Q'

// Q tiles show completion status + score/progress hint (shared parse with
// the editor's questionnaire grid)
const questMeta = (obs) => parseQuestionnaireObservation(obs)

const isPendingQuest = (obs) => obs.valueType === 'Q' && !questMeta(obs).isCompleted

// M tiles: classic prescription notation "Aspirin 100mg 1-0-1 p.o." —
// frequency/route abbreviations load lazily once an M tile appears
const { loadMedicationOptions, getFrequencyAbbreviation, getRouteAbbreviation } = useMedicationOptions()
const medicationOptionsLoaded = ref(false)

watch(
  () => props.categorizedObservations,
  (groups) => {
    if (medicationOptionsLoaded.value) return
    if ((groups || []).some((category) => category.observations.some((obs) => obs.valueType === 'M'))) {
      medicationOptionsLoaded.value = true
      loadMedicationOptions()
    }
  },
  { immediate: true },
)

const medicationTileText = (obs) => {
  const medication = parseMedicationObservation(obs)
  return (
    formatMedicationSummary(medication, {
      frequencyAbbrev: getFrequencyAbbreviation(medication.frequency),
      routeAbbrev: getRouteAbbreviation(medication.route),
    }) || obs.displayValue
  )
}

// NV-flagged ("explicitly no value") or simply unfilled observations render
// as a subtle ∅ tile instead of a bold "No value" text
const isEmptyValue = (obs) => {
  if (obs.valueType === 'R' || obs.valueType === 'Q') return false
  return obs.rawData?.VALUEFLAG_CD === 'NV' || obs.valueFlag === 'NV' || obs.displayValue == null || obs.displayValue === '' || obs.displayValue === 'No value'
}

const onTileClick = (obs) => {
  if (obs.valueType === 'R') emit('preview-file', obs)
  else if (obs.valueType === 'Q') emit('preview-questionnaire', obs)
}

// Subline with the file facts; the filename appears only when a custom
// title differs from it (uploads default title = filename)
const fileSubline = (obs) => {
  const info = obs.fileInfo || {}
  const filenameDiffers = info.title && info.filename && info.title !== info.filename
  const parts = [filenameDiffers ? info.filename : null, info.description].filter(Boolean)
  return parts.join(' — ') || shortConceptName(obs.conceptName)
}
</script>

<style lang="scss" scoped>
.tile-group {
  margin-bottom: 14px;

  &:last-child {
    margin-bottom: 4px;
  }
}

.tile-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $primary;
  font-weight: 600;
  font-size: 0.85rem;
  border-bottom: 1px solid $grey-4;
  padding-bottom: 4px;
  margin-bottom: 8px;

  .tile-group-count {
    color: $grey-6;
    font-weight: 400;
    font-size: 0.75rem;
  }
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
}

.obs-tile {
  position: relative;
  min-width: 0;
  background: white;
  border: 1px solid $grey-4;
  border-left: 3px solid var(--tv, $grey-5);
  border-radius: 6px;
  padding: 5px 9px 4px;

  &--m {
    grid-column: span 2;
  }

  &--full {
    grid-column: 1 / -1;
  }

  &--clickable {
    cursor: pointer;

    &:hover {
      background: $blue-1;
      border-color: $primary;
      border-left-color: var(--tv);
    }
  }

  // Empty / NV tiles step back visually
  &--empty {
    opacity: 0.5;
  }

  // Incomplete questionnaires clearly read as "not done yet"
  &--pending {
    border-left-color: $amber-6;
    background: rgba($amber-1, 0.35);
  }
}

.tile-progress {
  margin: 3px 0 1px;
}

.tile-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  color: $grey-9;

  .tile-unit {
    font-weight: 400;
    font-size: 0.68rem;
    font-style: italic;
    color: $grey-6;
    white-space: nowrap;
  }

  &--text {
    display: block;
    font-weight: 400;
    font-size: 0.82rem;
    white-space: pre-wrap;
  }

  &--empty {
    font-weight: 400;
    color: $grey-6;
  }
}

.tile-concept {
  font-size: 0.68rem;
  color: $grey-7;
  line-height: 1.3;
  margin-top: 1px;
}

.tile-tooltip {
  font-size: 0.75rem;

  .tile-tooltip-file {
    color: $grey-4;
    font-size: 0.7rem;
    margin-top: 2px;
  }

  .tile-tooltip-desc {
    margin-top: 3px;
    white-space: pre-wrap;
  }

  .tile-tooltip-code {
    color: $blue-3;
    font-family: monospace;
    font-size: 0.68rem;
    margin-top: 2px;
  }
}

// On narrow cards a "medium" tile may not have 2 columns to span
@media (max-width: 480px) {
  .obs-tile--m {
    grid-column: 1 / -1;
  }
}
</style>
