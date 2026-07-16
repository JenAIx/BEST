<template>
  <div class="compact-summary">
    <div v-for="visit in sortedVisits" :key="visit.id" class="visit-block q-mb-md">
      <!-- Visit header (click selects the visit like the timeline does) -->
      <div class="visit-block-header row items-center q-gutter-sm" @click="$emit('visit-selected', visit)">
        <q-icon name="event" color="primary" size="20px" />
        <span class="visit-date">{{ formatDate(visit.date) }}</span>
        <q-chip v-if="visit.visitType" dense size="sm" color="blue-1" text-color="primary">{{ getVisitTypeLabel(visit.visitType) }}</q-chip>
        <q-chip v-if="visit.status" dense size="sm" :color="visit.status === 'A' ? 'green-1' : 'grey-3'" :text-color="visit.status === 'A' ? 'positive' : 'grey-7'">
          {{ visit.status === 'A' ? $t('visit.active') : visit.status }}
        </q-chip>
        <q-space />
        <span class="text-caption text-grey-6">{{ $t('visit.observationCount', { count: observationsForVisit(visit.id).flatMap((c) => c.observations).length }) }}</span>
        <q-icon name="chevron_right" color="grey-5" size="18px" />
      </div>

      <!-- Per-visit results (reuses the compact summary table incl. file/questionnaire previews) -->
      <div v-if="observationsForVisit(visit.id).length > 0" class="visit-block-body">
        <VisitSummaryObservations :categorized-observations="observationsForVisit(visit.id)" @preview-file="previewFile" @preview-questionnaire="previewQuestionnaire" />
      </div>
      <div v-else class="visit-block-empty text-caption text-grey-6">{{ $t('visit.noObservationsShort') }}</div>
    </div>

    <!-- File Preview Dialog -->
    <FilePreviewDialog
      v-if="selectedFileObservation"
      v-model="showFilePreview"
      :observation-id="selectedFileObservation.observationId"
      :file-info="selectedFileObservation.fileInfo"
      :concept-name="selectedFileObservation.conceptName"
      :upload-date="selectedFileObservation.date"
    />

    <!-- Questionnaire Preview Dialog -->
    <QuestionnairePreviewDialog
      v-if="selectedQuestionnaireObservation"
      v-model="showQuestionnairePreview"
      :observation-id="selectedQuestionnaireObservation.observationId"
      :concept-name="selectedQuestionnaireObservation.conceptName"
      :completion-date="selectedQuestionnaireObservation.date"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { groupObservationsByVisit } from 'src/shared/utils/file-category'
import { formatDate, getVisitTypeLabel } from 'src/shared/utils/medical-utils.js'
import VisitSummaryObservations from './VisitSummaryObservations.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'
import QuestionnairePreviewDialog from 'src/components/shared/QuestionnairePreviewDialog.vue'

defineOptions({
  name: 'VisitCompactSummary',
})

defineEmits(['visit-selected'])

const visitStore = useVisitStore()
const observationStore = useObservationStore()

const sortedVisits = computed(() => visitStore.sortedVisits)

// encounterNum → categorized observation groups (all patient observations
// are already loaded page-wide by visit-observation-service)
const groupedByVisit = computed(() => groupObservationsByVisit(observationStore.allObservations))

const observationsForVisit = (visitId) => groupedByVisit.value.get(visitId) || []

// Preview dialogs (same wiring as VisitSummaryDialog)
const selectedFileObservation = ref(null)
const showFilePreview = ref(false)
const selectedQuestionnaireObservation = ref(null)
const showQuestionnairePreview = ref(false)

const previewFile = (observation) => {
  selectedFileObservation.value = observation
  showFilePreview.value = true
}

const previewQuestionnaire = (observation) => {
  selectedQuestionnaireObservation.value = observation
  showQuestionnairePreview.value = true
}
</script>

<style lang="scss" scoped>
.visit-block {
  background: white;
  border: 1px solid $grey-4;
  border-radius: 8px;
  overflow: hidden;
}

.visit-block-header {
  padding: 10px 16px;
  background: $grey-2;
  border-bottom: 1px solid $grey-4;
  cursor: pointer;

  &:hover {
    background: $blue-1;
  }

  .visit-date {
    font-weight: 600;
    color: $grey-9;
  }
}

.visit-block-body {
  padding: 12px 16px 4px;

  // Denser than the dialog version
  :deep(.category-section) {
    margin-bottom: 16px !important;
  }

  :deep(.category-header h6) {
    font-size: 0.95rem;
  }
}

.visit-block-empty {
  padding: 10px 16px;
}
</style>
