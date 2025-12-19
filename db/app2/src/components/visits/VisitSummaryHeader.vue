<template>
  <div class="visit-header q-mb-lg">
    <div class="text-h5 text-primary q-mb-sm">
      <q-icon name="event" class="q-mr-sm" />
      Visit Summary Report
    </div>
    <div class="visit-meta-info">
      <div class="row q-gutter-lg">
        <div class="col-auto"><strong>Date:</strong> {{ formattedDate }}</div>
        <div class="col-auto"><strong>Type:</strong> {{ visitTypeLabel }}</div>
        <div class="col-auto"><strong>Total Observations:</strong> {{ totalObservations }}</div>
        <div v-if="questionnaireCount > 0" class="col-auto">
          <strong>Questionnaires:</strong> {{ questionnaireCount }}
        </div>
      </div>
      <div v-if="visit.notes" class="visit-notes q-mt-md"><strong>Notes:</strong> {{ visit.notes }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getVisitTypeLabel, formatDateVerbose } from 'src/shared/utils/medical-utils.js'

const props = defineProps({
  visit: {
    type: Object,
    required: true,
  },
  totalObservations: {
    type: Number,
    default: 0,
  },
  questionnaireCount: {
    type: Number,
    default: 0,
  },
})

const formattedDate = computed(() => {
  return formatDateVerbose(props.visit?.date)
})

const visitTypeLabel = computed(() => {
  return getVisitTypeLabel(props.visit?.type)
})
</script>

<style lang="scss" scoped>
.visit-header {
  border-bottom: 2px solid $primary;
  padding-bottom: 1rem;

  .visit-meta-info {
    font-size: 0.95rem;
    line-height: 1.4;

    .visit-notes {
      background: $grey-1;
      padding: 12px 16px;
      border-radius: 4px;
      border-left: 3px solid $primary;
      font-style: italic;
    }
  }
}

@media (max-width: 768px) {
  .visit-header .visit-meta-info .row {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>

