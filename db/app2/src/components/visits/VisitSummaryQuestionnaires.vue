<template>
  <div v-if="questionnaireObservations.length > 0" class="questionnaires-section q-mt-xl">
    <div class="section-header q-mb-md">
      <h6 class="text-h6 text-primary q-my-none">
        <q-icon name="quiz" class="q-mr-sm" />
        Questionnaires & Surveys
        <span class="text-grey-6 text-body2 q-ml-sm">({{ questionnaireObservations.length }} {{ questionnaireObservations.length === 1 ? 'questionnaire' : 'questionnaires' }})</span>
      </h6>
    </div>

    <div class="questionnaires-list">
      <VisitSummaryQuestionnaireItem
        v-for="obs in questionnaireObservations"
        :key="obs.observationId"
        :observation="obs"
        :questionnaire-data="loadedQuestionnaires[obs.observationId]"
        @preview="$emit('preview-questionnaire', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import VisitSummaryQuestionnaireItem from './VisitSummaryQuestionnaireItem.vue'

defineProps({
  questionnaireObservations: {
    type: Array,
    required: true,
  },
  loadedQuestionnaires: {
    type: Object,
    required: true,
  },
})

defineEmits(['preview-questionnaire'])
</script>

<style lang="scss" scoped>
.questionnaires-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid $purple-3;

  .section-header {
    border-bottom: 1px solid $grey-4;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
}
</style>

