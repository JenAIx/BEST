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
            <q-btn flat round icon="arrow_back" color="white" @click="deselectPatient" class="back-btn" />
            <q-avatar size="48px" color="white" text-color="primary" class="q-mr-md">
              {{ getPatientInitials(selectedPatient.name) }}
            </q-avatar>
            <div class="patient-header-info">
              <h2 class="patient-name">{{ selectedPatient.name }}</h2>
              <div class="patient-details">
                <span>{{ selectedPatient.id }}</span>
                <span class="separator">•</span>
                <span>Age: {{ selectedPatient.age || 'Unknown' }}</span>
                <span class="separator">•</span>
                <span>{{ visits.length }} visits</span>
              </div>
            </div>
          </div>
          <div class="patient-header-right">
            <q-btn-group flat>
              <q-btn
                :color="viewMode === 'timeline' ? 'white' : 'grey-4'"
                :text-color="viewMode === 'timeline' ? 'primary' : 'white'"
                icon="timeline"
                label="Timeline"
                @click="viewMode = 'timeline'"
              />
              <q-btn :color="viewMode === 'entry' ? 'white' : 'grey-4'" :text-color="viewMode === 'entry' ? 'primary' : 'white'" icon="edit" label="Data Entry" @click="viewMode = 'entry'" />
            </q-btn-group>
          </div>
        </div>
      </div>

      <!-- Timeline View -->
      <VisitTimeline v-if="viewMode === 'timeline'" :patient="selectedPatient" :selected-visit="selectedVisit" @visit-selected="onVisitSelected" @visit-edited="onVisitEdited" />

      <!-- Data Entry View -->
      <VisitDataEntry v-if="viewMode === 'entry'" :patient="selectedPatient" :initial-visit="selectedVisit" @visit-created="onVisitCreated" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { getPatientInitials } from 'src/shared/utils/medical-utils'
import PatientSelector from 'src/components/visits/PatientSelector.vue'
import VisitTimeline from 'src/components/visits/VisitTimeline.vue'
import VisitDataEntry from 'src/components/visits/VisitDataEntry.vue'

const visitStore = useVisitObservationStore()

// Local state
const viewMode = ref('timeline')

// Computed properties from store
const selectedPatient = computed(() => visitStore.selectedPatient)
const selectedVisit = computed(() => visitStore.selectedVisit)
const visits = computed(() => visitStore.visits)

// Methods
const onPatientSelected = async (patient) => {
  await visitStore.setSelectedPatient(patient)
  viewMode.value = 'timeline'
}

const deselectPatient = () => {
  visitStore.clearPatient()
  viewMode.value = 'timeline'
}

const onVisitSelected = async (visit) => {
  await visitStore.setSelectedVisit(visit)
}

const onVisitEdited = async (visit) => {
  await visitStore.setSelectedVisit(visit)
  viewMode.value = 'entry'
}

const onVisitCreated = async (newVisit) => {
  // Store handles adding the visit, just need to select it and switch mode
  await visitStore.setSelectedVisit(newVisit)
  viewMode.value = 'entry'
}

// Helper methods - getPatientInitials is now imported from medical-utils

// Initialize store
onMounted(() => {
  visitStore.initialize()
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
