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
          :class="[`obs-tile--${tileSpan(obs)}`, { 'obs-tile--clickable': isPreviewable(obs) }]"
          :style="{ '--tv': valueTypeHex(obs.valueType) }"
          @click="onTileClick(obs)"
        >
          <!-- Value line by type -->
          <div v-if="obs.valueType === 'R'" class="tile-value">
            <q-icon :name="getFileIcon(obs.fileInfo?.ext)" size="15px" :color="getFileColor(obs.fileInfo?.ext)" />
            <span class="ellipsis">{{ obs.fileInfo?.filename || obs.displayValue }}</span>
            <span v-if="obs.fileInfo?.size" class="tile-unit">{{ formatFileSize(obs.fileInfo.size) }}</span>
          </div>
          <div v-else-if="obs.valueType === 'Q'" class="tile-value">
            <q-icon name="quiz" size="15px" color="deep-purple-6" />
            <span class="ellipsis">{{ obs.displayValue }}</span>
          </div>
          <div v-else-if="tileSpan(obs) === 'full'" class="tile-value tile-value--text">{{ obs.displayValue }}</div>
          <div v-else class="tile-value">
            <span class="ellipsis">{{ obs.displayValue }}</span>
            <span v-if="obs.unit" class="tile-unit">{{ obs.unit }}</span>
          </div>

          <div class="tile-concept ellipsis">{{ shortConceptName(obs.conceptName) }}</div>

          <q-tooltip :delay="350" max-width="360px">
            <div class="tile-tooltip">
              {{ obs.conceptName }}
              <div class="tile-tooltip-code">{{ obs.conceptCode }}</div>
            </div>
          </q-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getCategoryIcon, getFileIcon, getFileColor, formatFileSize } from 'src/shared/utils/medical-utils.js'
import { shortConceptName, tileSpan, valueTypeHex } from 'src/shared/utils/observation-display.js'

defineOptions({
  name: 'ObservationTileGrid',
})

defineProps({
  // [{ name, icon?, observations: [...] }] — groupObservationsByFieldSets shape
  categorizedObservations: { type: Array, default: () => [] },
})

const emit = defineEmits(['preview-file', 'preview-questionnaire'])

const isPreviewable = (obs) => obs.valueType === 'R' || obs.valueType === 'Q'

const onTileClick = (obs) => {
  if (obs.valueType === 'R') emit('preview-file', obs)
  else if (obs.valueType === 'Q') emit('preview-questionnaire', obs)
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
}

.tile-concept {
  font-size: 0.68rem;
  color: $grey-7;
  line-height: 1.3;
  margin-top: 1px;
}

.tile-tooltip {
  font-size: 0.75rem;

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
