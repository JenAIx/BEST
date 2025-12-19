<template>
  <div class="questionnaire-item q-mb-lg">
    <q-card flat bordered class="questionnaire-card">
      <q-card-section>
        <div class="questionnaire-header-row q-mb-md">
          <div class="row items-center justify-between">
            <div class="col">
              <div class="text-h6 text-primary q-mb-xs">
                <q-icon name="quiz" class="q-mr-sm" />
                {{ observation.conceptName }}
              </div>
              <div class="text-caption text-grey-6">Completed on {{ formattedDate }}</div>
            </div>
            <div class="col-auto">
              <q-btn flat round icon="visibility" color="primary" size="md" @click="$emit('preview', observation)">
                <q-tooltip>View Full Questionnaire</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
        <CompletedQuestionnaireView v-if="questionnaireData" :results="questionnaireData" :completion-date="observation.date" />
        <div v-else class="questionnaire-loading">
          <q-spinner size="24px" color="primary" />
          <span class="q-ml-sm text-caption text-grey-6">Loading questionnaire...</span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CompletedQuestionnaireView from 'src/components/questionnaire/CompletedQuestionnaireView.vue'

const props = defineProps({
  observation: {
    type: Object,
    required: true,
  },
  questionnaireData: {
    type: Object,
    default: null,
  },
})

defineEmits(['preview'])

const formattedDate = computed(() => {
  if (!props.observation.date) return 'Unknown date'
  return new Date(props.observation.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})
</script>

<style lang="scss" scoped>
.questionnaire-item {
  .questionnaire-card {
    border-radius: 8px;
    border-left: 4px solid $purple-6;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  .questionnaire-header-row {
    .questionnaire-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: $grey-6;
    }
  }
}
</style>

