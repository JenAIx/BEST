<template>
  <div class="patient-visits-summary">
    <!-- Summary Header -->
    <div class="summary-header q-mb-md">
      <div class="row items-center justify-between">
        <div class="col-auto">
          <div class="text-h6 text-primary">
            <q-icon name="event" class="q-mr-sm" />
            {{ $t('patient.visitsObservationsSummary') }}
          </div>
          <div class="text-caption text-grey-6 q-mt-xs">
            {{ visits.length }} {{ visits.length === 1 ? $t('visit.visit') : $t('visit.visits') }} • {{ totalObservations }} {{ totalObservations === 1 ? $t('visit.observation') : $t('visit.observations') }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn color="primary" icon="event" :label="$t('patient.editVisits')" @click="goToVisitsPage" unelevated>
            <q-tooltip>{{ $t('patient.editVisitsTooltip') }}</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>

    <!-- No Visits State -->
    <div v-if="visits.length === 0" class="no-visits-state text-center q-py-xl">
      <q-icon name="event_busy" size="64px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-md">{{ $t('visit.noVisitsRecorded') }}</div>
      <div class="text-body2 text-grey-5 q-mb-md">{{ $t('visit.startByCreating') }}</div>
      <q-btn color="primary" icon="add" :label="$t('visit.createFirstVisit')" @click="goToVisitsPage" unelevated>
        <q-tooltip>{{ $t('visit.startByCreating') }}</q-tooltip>
      </q-btn>
    </div>

    <!-- Visits List -->
    <div v-else class="visits-list">
      <div v-for="visit in sortedVisits" :key="visit.id" class="visit-summary-item q-mb-md">
        <q-card flat bordered class="visit-card">
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="col">
                <div class="visit-header-row q-mb-sm">
                  <div class="visit-date-info">
                    <q-icon name="event" size="18px" color="primary" class="q-mr-xs" />
                    <span class="text-weight-medium">{{ formatVisitDate(visit.date) }}</span>
                    <q-chip v-if="visit.status && visit.status !== 'Unknown'" :color="getStatusColor(visit.status)" text-color="white" size="sm" class="q-ml-sm">
                      {{ getStatusLabel(visit.status) }}
                    </q-chip>
                  </div>
                </div>

                <div class="visit-details row q-gutter-md q-mt-sm">
                  <div class="col-auto">
                    <div class="detail-item">
                      <q-icon :name="getVisitTypeIcon(visit.visitType)" size="14px" class="q-mr-xs text-grey-6" />
                      <span class="text-body2">{{ getVisitTypeLabel(visit.visitType) }}</span>
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="detail-item">
                      <q-icon name="assignment" size="14px" class="q-mr-xs text-grey-6" />
                      <span class="text-body2">{{ visit.observationCount || 0 }} {{ visit.observationCount === 1 ? $t('visit.observation') : $t('visit.observations') }}</span>
                    </div>
                  </div>
                  <div v-if="visit.location" class="col-auto">
                    <div class="detail-item">
                      <q-icon name="place" size="14px" class="q-mr-xs text-grey-6" />
                      <span class="text-body2">{{ visit.location }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="visit.notes" class="visit-notes q-mt-sm">
                  <q-icon name="note" size="14px" class="q-mr-xs text-grey-5" />
                  <span class="text-body2 text-grey-7">{{ truncateNotes(visit.notes) }}</span>
                </div>
              </div>

              <div class="col-auto q-ml-md">
                <q-btn flat round icon="visibility" color="primary" size="md" @click="viewVisitSummary(visit)">
                  <q-tooltip>View Visit Summary</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Visit Summary Dialog -->
    <VisitSummaryDialog v-model="showVisitSummaryDialog" :visit="selectedVisitForSummary" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePatientStore } from 'src/stores/patient-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useLoggingStore } from 'src/stores/logging-store'
import VisitSummaryDialog from '../visits/VisitSummaryDialog.vue'
import { getVisitTypeLabel, getVisitTypeIcon } from 'src/shared/utils/medical-utils'

const router = useRouter()
const patientStore = usePatientStore()
const visitStore = useVisitStore()
const observationStore = useObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('PatientVisitsSummary')

// State
const showVisitSummaryDialog = ref(false)
const selectedVisitForSummary = ref(null)

// Computed properties from stores
const patient = computed(() => patientStore.selectedPatient)
const visits = computed(() => visitStore.visits)
const observations = computed(() => observationStore.allObservations)

// Sort visits by date (newest first)
const sortedVisits = computed(() => {
  return [...visits.value].sort((a, b) => {
    const dateA = new Date(a.date || 0)
    const dateB = new Date(b.date || 0)
    return dateB - dateA
  })
})

// Calculate total observations
const totalObservations = computed(() => {
  return observations.value.length
})

// Methods
const formatVisitDate = (dateStr) => {
  if (!dateStr) return 'Unknown date'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const truncateNotes = (notes) => {
  if (!notes) return ''
  if (notes.length <= 100) return notes
  return notes.substring(0, 100) + '...'
}

const getStatusLabel = (status) => {
  // Simple status label mapping
  const statusMap = {
    A: 'Active',
    C: 'Completed',
    I: 'Inactive',
    X: 'Cancelled',
    P: 'Pending',
  }
  return statusMap[status] || status || 'Unknown'
}

const getStatusColor = (status) => {
  const colorMap = {
    A: 'negative', // Active
    C: 'positive', // Completed
    I: 'grey', // Inactive
    X: 'grey', // Cancelled
    P: 'warning', // Pending
  }
  return colorMap[status] || 'grey'
}

const viewVisitSummary = async (visit) => {
  logger.logUserAction('visit_summary_viewed_from_patient_page', {
    visitId: visit.id,
    visitType: visit.visitType,
    visitDate: visit.date,
    patientId: patient.value?.PATIENT_CD || patient.value?.id,
  })

  // Ensure observations are loaded for this visit
  if (visitStore.selectedVisit?.id !== visit.id) {
    try {
      await visitObservationService.selectVisitAndLoadObservations(visit)
    } catch (error) {
      logger.error('Failed to load visit observations for summary', error, {
        visitId: visit.id,
      })
    }
  }

  selectedVisitForSummary.value = visit
  showVisitSummaryDialog.value = true
}

const goToVisitsPage = () => {
  if (!patient.value) {
    logger.error('Cannot navigate to visits page - no patient loaded')
    return
  }

  // Use PATIENT_CD for consistency with PatientPage navigation
  const patientId = patient.value.PATIENT_CD || patient.value.id

  logger.logUserAction('navigate_to_visits_from_summary', {
    patientId,
    visitCount: visits.value.length,
    observationCount: observations.value.length,
  })

  router.push(`/visits/${patientId}`)
}
</script>

<style lang="scss" scoped>
.patient-visits-summary {
  padding: 1rem;
}

.summary-header {
  padding: 1rem;
  background: $grey-1;
  border-radius: 8px;
  border-left: 4px solid $primary;
}

.visits-list {
  max-height: 600px;
  overflow-y: auto;
}

.visit-summary-item {
  .visit-card {
    border-radius: 8px;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
  }

  .visit-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .visit-date-info {
    display: flex;
    align-items: center;
    font-size: 1rem;
  }

  .visit-details {
    .detail-item {
      display: flex;
      align-items: center;
      color: $grey-7;
    }
  }

  .visit-notes {
    padding: 0.5rem;
    background: $grey-1;
    border-radius: 4px;
    border-left: 3px solid $primary;
    display: flex;
    align-items: flex-start;
    font-style: italic;
  }
}

.no-visits-state {
  background: $grey-1;
  border-radius: 8px;
  border: 2px dashed $grey-3;
}

@media (max-width: 768px) {
  .summary-header {
    .row {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
  }

  .visit-details {
    flex-direction: column;
    gap: 0.5rem !important;
  }
}
</style>

