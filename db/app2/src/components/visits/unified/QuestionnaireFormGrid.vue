<template>
  <!-- Edit rendering of the questionnaires group in the CRF form-grid look
       (same visual language as ObservationFormGrid): one wide tile per
       questionnaire — status icon, title, score or fill progress — plus a
       dashed add tile. All actions bubble up to the card editor. -->
  <div class="form-group" :data-group-name="fieldSet?.name || 'Fragebögen'">
    <div class="form-group-head">
      <q-icon :name="fieldSet?.icon || 'quiz'" size="16px" />
      <span>{{ fieldSet?.name || 'Fragebögen' }}</span>
      <span class="form-group-count">({{ completedCount }}/{{ questionnaires.length }})</span>
    </div>

    <div class="form-grid">
      <div v-for="q in questionnaires" :key="q.observationId" class="form-field form-field--m" :style="{ '--tv': valueTypeHex('Q') }">
        <div class="field-label">
          <span class="field-dot"></span>
          <span class="ellipsis">{{ q.shortTitle || q.questionnaireCode || $t('observation.questionnaire') }}</span>
          <q-btn flat round dense size="xs" icon="close" class="field-delete" tabindex="-1" @click.stop="confirmRemove(q)">
            <q-tooltip>{{ $t('visit.removeQuestionnaire') }}</q-tooltip>
          </q-btn>
        </div>

        <div class="field-quest" :class="q.isCompleted ? 'field-quest--completed' : 'field-quest--pending'" @click="onQuestionnaireClick(q)">
          <q-icon :name="q.isCompleted ? 'check_circle' : 'pending'" :color="q.isCompleted ? 'positive' : 'amber-8'" size="15px" />
          <span class="ellipsis">{{ q.title }}</span>
          <span v-if="q.isCompleted && q.score !== null" class="field-quest-score">{{ $t('visit.questionnaireScore', { score: q.score }) }}</span>
          <span v-else-if="!q.isCompleted" class="field-quest-score">{{ $t('visit.questionnaireFill') }}</span>
          <q-linear-progress
            v-if="!q.isCompleted && q.progress !== null"
            :value="q.progress"
            :color="q.progress < 0.5 ? 'negative' : q.progress < 1 ? 'warning' : 'positive'"
            class="field-quest-progress"
            rounded
            size="3px"
          />
        </div>

        <q-tooltip :delay="350" max-width="360px">
          <div class="field-tooltip">
            {{ q.title }}
            <div>{{ q.isCompleted ? $t('visit.completed') : $t('visit.questionnaireFill') }}</div>
            <div v-if="q.questionnaireCode" class="field-tooltip-code">{{ q.questionnaireCode }}</div>
          </div>
        </q-tooltip>
      </div>

      <!-- Add tile — same day-to-day action as the rail entry -->
      <div class="form-field form-field--m">
        <div class="field-quest field-quest--add" @click="$emit('add-questionnaire')">
          <q-icon name="add" size="15px" color="primary" />
          <span class="ellipsis">{{ $t('visit.addQuestionnaire') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { valueTypeHex } from 'src/shared/utils/observation-display.js'

defineOptions({
  name: 'QuestionnaireFormGrid',
})

const props = defineProps({
  fieldSet: { type: Object, default: () => ({ icon: 'quiz', name: 'Fragebögen' }) },
  // Parsed entries from useVisitQuestionnaires (parseQuestionnaireObservation shape)
  questionnaires: { type: Array, default: () => [] },
})

const emit = defineEmits(['add-questionnaire', 'fill-questionnaire', 'view-questionnaire', 'remove-questionnaire'])

const $q = useQuasar()
const { t } = useI18n()

const completedCount = computed(() => props.questionnaires.filter((q) => q.isCompleted).length)

const onQuestionnaireClick = (q) => {
  if (q.isCompleted) emit('view-questionnaire', q)
  else emit('fill-questionnaire', q)
}

const confirmRemove = (q) => {
  $q.dialog({
    title: t('visit.removeQuestionnaire'),
    message: t('visit.removeQuestionnaireConfirm', { title: q.title }),
    cancel: t('common.cancel'),
    persistent: true,
    ok: { label: t('common.delete'), color: 'negative' },
  }).onOk(() => emit('remove-questionnaire', q))
}
</script>

<style lang="scss" scoped>
// Same visual frame as ObservationFormGrid (scoped copies, like the tile grid)
.form-group {
  background: white;
  border: 1px solid $grey-4;
  border-radius: 8px;
  padding: 8px 12px 10px;
}

.form-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $primary;
  font-weight: 600;
  font-size: 0.85rem;
  border-bottom: 1px solid $grey-4;
  padding-bottom: 4px;
  margin-bottom: 8px;

  .form-group-count {
    color: $grey-6;
    font-weight: 400;
    font-size: 0.75rem;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px 10px;
}

.form-field {
  position: relative;
  min-width: 0;

  &--m {
    grid-column: span 2;
  }
}

.field-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  color: $grey-7;
  line-height: 1.3;
  margin-bottom: 2px;
  min-width: 0;

  .field-dot {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: var(--tv, $grey-5);
  }

  .field-delete {
    opacity: 0;
    transition: opacity 0.15s ease;
    color: $grey-6;
  }
}

.form-field:hover .field-delete {
  opacity: 1;
}

.field-tooltip {
  font-size: 0.75rem;

  .field-tooltip-code {
    color: $blue-3;
    font-family: monospace;
    font-size: 0.68rem;
    margin-top: 2px;
  }
}

// Questionnaire tile body — same box language as the R-file field
.field-quest {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid $grey-4;
  border-radius: 5px;
  padding: 5px 9px 6px;
  font-size: 0.82rem;
  cursor: pointer;
  min-width: 0;

  &:hover {
    background: $blue-1;
    border-color: $primary;
  }

  &--completed {
    border-left: 3px solid $positive;
  }

  &--pending {
    border-left: 3px solid $amber-6;
    background: rgba($amber-1, 0.3);
  }

  &--add {
    border-style: dashed;
    color: $primary;
    justify-content: center;

    &:hover {
      background: rgba($primary, 0.05);
    }
  }

  .field-quest-score {
    flex-shrink: 0;
    margin-left: auto;
    font-size: 0.68rem;
    font-style: italic;
    color: $grey-6;
    white-space: nowrap;
  }

  .field-quest-progress {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 1px;
  }
}

@media (max-width: 480px) {
  .form-field--m {
    grid-column: 1 / -1;
  }
}
</style>
