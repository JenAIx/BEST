<template>
  <div class="timeline-view">
    <div class="timeline-container">
      <div class="timeline-header">
        <h3 class="timeline-title">Visit Timeline</h3>
        <q-btn color="primary" icon="add" label="New Visit" @click="createNewVisit" />
      </div>

      <div v-if="loading" class="loading-state">
        <q-spinner-grid size="50px" color="primary" />
        <div class="text-h6 q-mt-md">Loading visits...</div>
      </div>

      <div v-else-if="visits.length === 0" class="no-visits">
        <q-icon name="event_busy" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">No visits recorded</div>
        <div class="text-body2 text-grey-5 q-mb-md">Start by creating a new visit</div>
        <q-btn color="primary" icon="add" label="Create First Visit" @click="createNewVisit" />
      </div>

      <div v-else class="timeline-list">
        <VisitTimelineItem
          v-for="(visit, index) in sortedVisits"
          :key="visit.id"
          :visit="visit"
          :is-last="index === sortedVisits.length - 1"
          :is-selected="selectedVisit?.id === visit.id"
          @select="selectVisit"
          @edit="editVisit"
          @view="viewVisit"
          @duplicate="duplicateVisit"
          @delete="deleteVisit"
        />
      </div>
    </div>

    <!-- New Visit Dialog -->
    <NewVisitDialog v-model="showNewVisitDialog" :patient="patient" @created="onVisitCreated" />

    <!-- Visit Summary Dialog -->
    <VisitSummaryDialog v-model="showVisitSummary" :visit="selectedVisitForView" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import VisitTimelineItem from './VisitTimelineItem.vue'
import NewVisitDialog from './NewVisitDialog.vue'
import VisitSummaryDialog from './VisitSummaryDialog.vue'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
  selectedVisit: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['visit-selected', 'visit-edited', 'visits-updated'])

const $q = useQuasar()
const dbStore = useDatabaseStore()

// State
const loading = ref(false)
const visits = ref([])
const showNewVisitDialog = ref(false)
const showVisitSummary = ref(false)
const selectedVisitForView = ref(null)

// Computed
const sortedVisits = computed(() => {
  return [...visits.value].sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Methods
const loadVisits = async () => {
  if (!props.patient?.id) return

  try {
    loading.value = true

    const patientRepo = dbStore.getRepository('patient')
    const visitRepo = dbStore.getRepository('visit')

    const patient = await patientRepo.findByPatientCode(props.patient.id)
    if (!patient) return

    const patientVisits = await visitRepo.getPatientVisitTimeline(patient.PATIENT_NUM)

    // Load observation counts for each visit
    const visitsWithCounts = await Promise.all(
      patientVisits.map(async (visit) => {
        const observationCount = await getObservationCount(visit.ENCOUNTER_NUM)
        return {
          id: visit.ENCOUNTER_NUM,
          date: visit.START_DATE,
          type: visit.INOUT_CD === 'E' ? 'emergency' : 'routine',
          notes: visit.VISIT_BLOB ? parseVisitNotes(visit.VISIT_BLOB) : '',
          status: visit.ACTIVE_STATUS_CD || 'completed',
          observationCount,
          location: visit.LOCATION_CD,
          endDate: visit.END_DATE,
        }
      }),
    )

    visits.value = visitsWithCounts
    emit('visits-updated', visits.value)
  } catch (error) {
    console.error('Failed to load visits:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load patient visits',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const getObservationCount = async (encounterNum) => {
  try {
    const query = `
            SELECT COUNT(*) as count
            FROM OBSERVATION_FACT
            WHERE ENCOUNTER_NUM = ?
        `
    const result = await dbStore.executeQuery(query, [encounterNum])
    return result.success && result.data.length > 0 ? result.data[0].count : 0
  } catch (error) {
    console.warn('Failed to get observation count:', error)
    return 0
  }
}

const parseVisitNotes = (visitBlob) => {
  try {
    const parsed = JSON.parse(visitBlob)
    return parsed.notes || parsed.description || ''
  } catch {
    return visitBlob || ''
  }
}

const selectVisit = (visit) => {
  emit('visit-selected', visit)
}

const editVisit = (visit) => {
  emit('visit-edited', visit)
}

const viewVisit = (visit) => {
  selectedVisitForView.value = visit
  showVisitSummary.value = true
}

const createNewVisit = () => {
  showNewVisitDialog.value = true
}

const onVisitCreated = (newVisit) => {
  visits.value.unshift(newVisit)
  emit('visits-updated', visits.value)

  $q.notify({
    type: 'positive',
    message: 'Visit created successfully',
    position: 'top',
  })

  // Auto-select the new visit for editing
  emit('visit-edited', newVisit)
}

const duplicateVisit = async (visit) => {
  try {
    // Get all observations from the original visit
    const query = `
            SELECT *
            FROM OBSERVATION_FACT
            WHERE ENCOUNTER_NUM = ?
        `
    const result = await dbStore.executeQuery(query, [visit.id])

    if (!result.success) {
      throw new Error('Failed to load visit observations')
    }

    const observations = result.data

    $q.dialog({
      title: 'Clone Visit',
      message: `This will create a new visit with ${observations.length} observations from ${formatVisitDate(visit.date)}. Continue?`,
      cancel: true,
      persistent: true,
    }).onOk(async () => {
      // Create new visit first
      const visitRepo = dbStore.getRepository('visit')
      const patientRepo = dbStore.getRepository('patient')

      const patient = await patientRepo.findByPatientCode(props.patient.id)

      const newVisitData = {
        PATIENT_NUM: patient.PATIENT_NUM,
        START_DATE: new Date().toISOString().split('T')[0],
        INOUT_CD: visit.type === 'emergency' ? 'E' : 'O',
        ACTIVE_STATUS_CD: 'A',
        LOCATION_CD: visit.location || 'CLINIC',
        VISIT_BLOB: JSON.stringify({
          notes: `Cloned from visit on ${formatVisitDate(visit.date)}`,
          originalVisit: visit.id,
        }),
      }

      const createdVisit = await visitRepo.createVisit(newVisitData)

      // Clone observations
      const observationRepo = dbStore.getRepository('observation')
      let clonedCount = 0

      for (const obs of observations) {
        try {
          const newObsData = {
            PATIENT_NUM: obs.PATIENT_NUM,
            ENCOUNTER_NUM: createdVisit.ENCOUNTER_NUM,
            CONCEPT_CD: obs.CONCEPT_CD,
            VALTYPE_CD: obs.VALTYPE_CD,
            TVAL_CHAR: obs.TVAL_CHAR,
            NVAL_NUM: obs.NVAL_NUM,
            UNIT_CD: obs.UNIT_CD,
            START_DATE: new Date().toISOString().split('T')[0],
            CATEGORY_CHAR: obs.CATEGORY_CHAR,
            PROVIDER_ID: 'SYSTEM',
            LOCATION_CD: 'CLONED',
            SOURCESYSTEM_CD: 'VISIT_CLONE',
            INSTANCE_NUM: 1,
            UPLOAD_ID: 1,
          }

          await observationRepo.createObservation(newObsData)
          clonedCount++
        } catch (error) {
          console.warn('Failed to clone observation:', error)
        }
      }

      // Reload visits
      await loadVisits()

      $q.notify({
        type: 'positive',
        message: `Visit cloned successfully with ${clonedCount} observations`,
        position: 'top',
      })
    })
  } catch (error) {
    console.error('Failed to duplicate visit:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to clone visit',
      position: 'top',
    })
  }
}

const deleteVisit = async (visit) => {
  $q.dialog({
    title: 'Delete Visit',
    message: `Are you sure you want to delete the visit from ${formatVisitDate(visit.date)}? This will also delete all ${visit.observationCount} observations. This action cannot be undone.`,
    cancel: true,
    persistent: true,
    ok: {
      label: 'Delete',
      color: 'negative',
    },
  }).onOk(async () => {
    try {
      const visitRepo = dbStore.getRepository('visit')
      await visitRepo.delete(visit.id)

      visits.value = visits.value.filter((v) => v.id !== visit.id)
      emit('visits-updated', visits.value)

      $q.notify({
        type: 'positive',
        message: 'Visit deleted successfully',
        position: 'top',
      })
    } catch (error) {
      console.error('Failed to delete visit:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete visit',
        position: 'top',
      })
    }
  })
}

const formatVisitDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Watchers
watch(
  () => props.patient,
  async (newPatient) => {
    if (newPatient) {
      await loadVisits()
    }
  },
  { immediate: true },
)

// Lifecycle
onMounted(async () => {
  if (props.patient) {
    await loadVisits()
  }
})
</script>

<style lang="scss" scoped>
.timeline-view {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: $grey-1;
}

.timeline-container {
  max-width: 1000px;
  margin: 0 auto;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;

  .timeline-title {
    font-size: 1.5rem;
    font-weight: 400;
    color: $grey-8;
    margin: 0;
  }
}

.loading-state,
.no-visits {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.timeline-list {
  position: relative;
}

@media (max-width: 768px) {
  .timeline-view {
    padding: 1rem;
  }

  .timeline-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
}
</style>
