<template>
  <q-page class="visits-page">
    <!-- Patient Selection Mode -->
    <PatientSelector v-if="!selectedPatient" @patient-selected="onPatientSelected" />

    <!-- Patient Visits View -->
    <div v-else class="visits-view-container">
      <!-- Patient Header -->
      <div class="patient-header">
        <div class="patient-header-content">
          <div class="patient-header-left">
            <q-btn flat round icon="arrow_back" color="white" @click="deselectPatient" class="back-btn">
              <q-tooltip>Back to visits list</q-tooltip>
            </q-btn>
            <q-avatar size="48px" color="white" text-color="primary" class="q-mr-md patient-avatar-clickable" @click="showPatientData">
              {{ getPatientInitials(selectedPatient.name) }}
              <q-tooltip>{{ $t('visit.viewPatientData') }}</q-tooltip>
            </q-avatar>
            <div class="patient-header-info">
              <h2 class="patient-name">{{ selectedPatient.name }}</h2>
              <div class="patient-details">
                <span>{{ selectedPatient.id }}</span>
                <span class="separator">•</span>
                <span>{{ $t('patient.age') }}: {{ selectedPatient.age || $t('common.unknown') }}</span>
                <span class="separator">•</span>
                <span>{{ visits.length }} {{ $t('visit.visits').toLowerCase() }}</span>
              </div>
            </div>
          </div>
          <div class="patient-header-right">
            <q-btn-group flat>
              <q-btn
                :color="viewMode === 'timeline' ? 'white' : 'grey-4'"
                :text-color="viewMode === 'timeline' ? 'primary' : 'white'"
                icon="timeline"
                :label="$t('visit.timeline')"
                @click="viewMode = 'timeline'"
              />
              <q-btn
                :color="viewMode === 'entry' ? 'white' : 'grey-4'"
                :text-color="viewMode === 'entry' ? 'primary' : 'white'"
                icon="edit"
                :label="$t('visit.dataEntry')"
                @click="viewMode = 'entry'"
              />
              <q-btn
                :color="viewMode === 'patient' ? 'white' : 'grey-4'"
                :text-color="viewMode === 'patient' ? 'primary' : 'white'"
                icon="person"
                :label="$t('visit.patientData')"
                @click="viewMode = 'patient'"
              />
            </q-btn-group>
            <q-btn flat round icon="delete" color="white" class="q-ml-md" @click="confirmDeletePatient">
              <q-tooltip>{{ $t('patient.deletePatientTooltip') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <!-- Timeline View -->
      <VisitTimeline v-if="viewMode === 'timeline'" :patient="selectedPatient" :selected-visit="selectedVisit" @visit-selected="onVisitSelected" @visit-edited="onVisitEdited" />

      <!-- Data Entry View -->
      <VisitDataEntry v-if="viewMode === 'entry'" :patient="selectedPatient" :initial-visit="selectedVisit" @visit-created="onVisitCreated" />

      <!-- Patient Data View -->
      <PatientDataView
        v-if="viewMode === 'patient' && patientRawData"
        :patient="patientRawData"
        :visits="visits"
        :observations="observations"
        @updated="onPatientUpdated"
      />

      <DeletePatientDialog ref="deletePatientDialog" @deleted="onPatientDeleted" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePatientStore } from 'src/stores/patient-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { getPatientInitials } from 'src/shared/utils/medical-utils'
import PatientSelector from 'src/components/visits/PatientSelector.vue'
import VisitTimeline from 'src/components/visits/VisitTimeline.vue'
import VisitDataEntry from 'src/components/visits/VisitDataEntry.vue'
import PatientDataView from 'src/components/visits/PatientDataView.vue'
import DeletePatientDialog from 'src/components/patient/DeletePatientDialog.vue'

const route = useRoute()
const router = useRouter()
const patientStore = usePatientStore()
const visitStore = useVisitStore()
const observationStore = useObservationStore()
const localSettings = useLocalSettingsStore()

// Local state
const viewMode = ref('timeline')
const deletePatientDialog = ref(null)

// Computed properties from stores
const selectedPatient = computed(() => patientStore.selectedPatient)
const selectedVisit = computed(() => visitStore.selectedVisit)
const visits = computed(() => visitStore.visits)
const observations = computed(() => observationStore.allObservations)
const patientRawData = computed(() => selectedPatient.value?.rawData || selectedPatient.value)

// Helper: Add patient to recent patients list
const addToRecentPatients = (patientId) => {
  if (!patientId) return

  try {
    const recent = localSettings.getSetting('visits.recentPatients') || []
    // Only add if not already present, then move to front
    const filtered = recent.filter((id) => id !== patientId)
    const updatedRecent = [patientId, ...filtered].slice(0, 10)
    localSettings.setSetting('visits.recentPatients', updatedRecent)
  } catch (error) {
    console.error('Failed to add patient to recent patients:', error)
  }
}

// Methods
const onPatientSelected = async (patient) => {
  // PatientSelector already navigates and adds to recent patients, so we just need to ensure the patient is loaded
  if (patient.id !== selectedPatient.value?.id) {
    // Initialize service if needed
    visitObservationService.initialize()
    // Load patient with all data
    await visitObservationService.loadPatientWithData(patient.id)
    viewMode.value = 'timeline'
  }
}

const deselectPatient = () => {
  visitObservationService.clearAllData()
  viewMode.value = 'timeline'
  // Go back to where the user came from (e.g. a study's enrolled-patients
  // list or the dashboard); default to the visits patient list.
  const previous = router.options.history.state?.back
  if (previous && !String(previous).startsWith('/visits')) {
    router.back()
  } else {
    router.push('/visits')
  }
}

const showPatientData = () => {
  if (!selectedPatient.value) return
  viewMode.value = 'patient'
}

const confirmDeletePatient = () => {
  if (!selectedPatient.value) return
  const raw = patientRawData.value
  deletePatientDialog.value?.show(raw, selectedPatient.value.name)
}

const onPatientDeleted = async () => {
  const deletedId = selectedPatient.value?.PATIENT_CD || selectedPatient.value?.id
  if (deletedId) {
    const recent = localSettings.getSetting('visits.recentPatients') || []
    const cleaned = recent.filter((id) => id !== deletedId)
    if (cleaned.length !== recent.length) {
      localSettings.setSetting('visits.recentPatients', cleaned)
    }
  }
  visitObservationService.clearAllData()
  viewMode.value = 'timeline'
  router.push('/visits')
}

const onPatientUpdated = async () => {
  const patientId = selectedPatient.value?.PATIENT_CD || selectedPatient.value?.id
  if (patientId) {
    await visitObservationService.loadPatientWithData(patientId)
  }
}

const onVisitSelected = async (visit) => {
  await visitObservationService.selectVisitAndLoadObservations(visit)
  // Switch to data entry view when a visit is clicked
  viewMode.value = 'entry'
}

const onVisitEdited = async (visit) => {
  // First reload visits to ensure we have the latest data with rawData
  if (selectedPatient.value) {
    await visitStore.loadVisitsForPatient(selectedPatient.value.PATIENT_NUM)
  }

  // Then find and select the visit from the store (which has complete data)
  const fullVisitData = visitStore.visits.find((v) => v.id === visit.id)
  if (fullVisitData) {
    await visitObservationService.selectVisitAndLoadObservations(fullVisitData)
  } else {
    // Fallback to the provided visit if not found in store
    await visitObservationService.selectVisitAndLoadObservations(visit)
  }

  viewMode.value = 'entry'
}

const onVisitCreated = async (newVisit) => {
  // First reload visits to ensure we have the latest data with rawData
  if (selectedPatient.value) {
    await visitStore.loadVisitsForPatient(selectedPatient.value.PATIENT_NUM)
  }

  // Then find and select the visit from the store (which has complete data)
  const fullVisitData = visitStore.visits.find((v) => v.id === newVisit.id)
  if (fullVisitData) {
    await visitObservationService.selectVisitAndLoadObservations(fullVisitData)
  } else {
    // Fallback to the provided visit if not found in store
    await visitObservationService.selectVisitAndLoadObservations(newVisit)
  }

  viewMode.value = 'entry'
}

// Load patient from route parameter
const loadPatientFromRoute = async () => {
  const patientId = route.params.patientId
  if (!patientId) return

  // Check if patient is already loaded and matches route
  const currentPatientId = selectedPatient.value?.PATIENT_CD || selectedPatient.value?.id

  if (patientId === currentPatientId) {
    // Patient is already loaded and matches route
    // Save to recent patients and set view mode
    addToRecentPatients(patientId)
    viewMode.value = route.query.view === 'patient' ? 'patient' : 'timeline'
    return
  }

  // Patient not loaded yet or different patient, load it
  try {
    // Initialize service if needed
    visitObservationService.initialize()

    // Load patient with all data using the service
    const loadedPatient = await visitObservationService.loadPatientWithData(patientId)

    if (loadedPatient) {
      // Save patient to recent patients when loaded from route
      addToRecentPatients(patientId)
      // ?view=patient opens the patient-data view directly (context menu)
      viewMode.value = route.query.view === 'patient' ? 'patient' : 'timeline'
    } else {
      // Patient not found, redirect to visits list
      router.push('/visits')
    }
  } catch (error) {
    console.error('Failed to load patient from route:', error)
    router.push('/visits')
  }
}

// Watch for route changes
watch(
  () => route.params.patientId,
  (newPatientId) => {
    if (newPatientId) {
      loadPatientFromRoute()
    }
  },
)

// Initialize and load patient if route has patientId
onMounted(async () => {
  await loadPatientFromRoute()
})
</script>

<style lang="scss" scoped>
.visits-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.visits-view-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: white;
}

.patient-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.patient-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.patient-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.patient-avatar-clickable {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
}

.patient-header-info {
  .patient-name {
    font-size: 1.75rem;
    font-weight: 300;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.5px;
  }

  .patient-details {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    opacity: 0.9;

    .separator {
      opacity: 0.6;
    }
  }
}

@media (max-width: 768px) {
  .patient-header {
    padding: 1rem;
  }

  .patient-header-content {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .patient-header-left {
    width: 100%;
  }
}
</style>
