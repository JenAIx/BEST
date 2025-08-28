<template>
  <AppDialog
    v-model="localShow"
    :title="`Select Visit for ${patientName}`"
    subtitle="Choose an existing visit to attach the questionnaire"
    size="lg"
    persistent
    ok-label="Select Visit"
    @ok="onConfirm"
    @cancel="onCancel"
  >
    <!-- Loading State -->
    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner-dots size="50px" color="primary" />
      <div class="text-body2 q-mt-md text-grey-6">Loading visits...</div>
    </div>

    <!-- No Visits Found -->
    <div v-else-if="visits.length === 0" class="text-center q-pa-lg">
      <q-icon name="event_busy" size="64px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-md">No visits found</div>
      <div class="text-body2 text-grey-5 q-mt-sm">
        No existing visits found for this patient.<br/>
        Please create a visit first or select a different patient.
      </div>
    </div>

    <!-- Visit List -->
    <q-list v-else bordered separator class="visit-list">
      <q-item
        v-for="visit in visits"
        :key="visit.ENCOUNTER_NUM"
        clickable
        v-ripple
        @click="selectVisit(visit)"
        :class="{ 'selected': selectedVisit?.ENCOUNTER_NUM === visit.ENCOUNTER_NUM }"
        class="visit-item"
      >
        <q-item-section side>
          <q-radio
            :model-value="selectedVisit?.ENCOUNTER_NUM"
            :val="visit.ENCOUNTER_NUM"
            color="primary"
            @update:model-value="() => selectVisit(visit)"
          />
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">
            {{ formatVisitDate(visit.START_DATE) }}
          </q-item-label>
          <q-item-label caption class="q-mt-xs">
            <q-icon name="location_on" size="14px" class="q-mr-xs" />
            {{ visit.LOCATION_CD || 'Location not specified' }}
          </q-item-label>
          <q-item-label v-if="visit.visitNotes" caption class="q-mt-xs text-grey-7">
            <q-icon name="notes" size="14px" class="q-mr-xs" />
            {{ visit.visitNotes }}
          </q-item-label>
        </q-item-section>

        <q-item-section side top>
          <q-badge 
            :color="getVisitStatusColor(visit.ACTIVE_STATUS_CD)"
            :label="getVisitStatusLabel(visit.ACTIVE_STATUS_CD)"
            class="q-mb-sm"
          />
          <div class="text-caption text-grey-6">
            ID: {{ visit.ENCOUNTER_NUM }}
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useDatabaseStore } from '../../stores/database-store.js'
import { logger } from '../../core/services/logging-service.js'
import AppDialog from '../shared/AppDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  patient: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'visit-selected', 'cancel'])

// Store
const dbStore = useDatabaseStore()

// State
const localShow = ref(false)
const loading = ref(false)
const visits = ref([])
const selectedVisit = ref(null)

// Computed
const patientName = computed(() => {
  if (props.patient.name) return props.patient.name
  if (props.patient.firstName && props.patient.lastName) {
    return `${props.patient.firstName} ${props.patient.lastName}`
  }
  return props.patient.PATIENT_CD || 'Unknown Patient'
})



// Methods
const loadVisits = async () => {
  if (!props.patient?.PATIENT_NUM) return

  loading.value = true
  try {
    const result = await dbStore.executeQuery(
      `SELECT ENCOUNTER_NUM, PATIENT_NUM, ACTIVE_STATUS_CD, START_DATE, END_DATE, 
              LOCATION_CD, VISIT_BLOB
       FROM VISIT_DIMENSION 
       WHERE PATIENT_NUM = ? 
       ORDER BY START_DATE DESC
       LIMIT 20`,
      [props.patient.PATIENT_NUM]
    )

    if (result.success) {
      visits.value = result.data.map(visit => {
        // Try to parse VISIT_BLOB for additional info
        let additionalInfo = {}
        try {
          if (visit.VISIT_BLOB) {
            additionalInfo = JSON.parse(visit.VISIT_BLOB)
          }
        } catch {
          // Ignore parsing errors
        }
        
        return {
          ...visit,
          ...additionalInfo
        }
      })
      
      logger.info('Loaded visits for patient', { 
        patientNum: props.patient.PATIENT_NUM, 
        visitCount: visits.value.length 
      })
    }
  } catch (error) {
    logger.error('Failed to load visits', error)
    visits.value = []
  } finally {
    loading.value = false
  }
}

const selectVisit = (visit) => {
  selectedVisit.value = visit
}

const formatVisitDate = (dateString) => {
  if (!dateString) return 'Unknown Date'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

const getVisitStatusLabel = (status) => {
  const statusMap = {
    'A': 'Active',
    'C': 'Completed', 
    'S': 'Scheduled',
    'X': 'Cancelled'
  }
  return statusMap[status] || status || 'Unknown'
}

const getVisitStatusColor = (status) => {
  const colorMap = {
    'A': 'green',
    'C': 'blue',
    'S': 'orange', 
    'X': 'red'
  }
  return colorMap[status] || 'grey'
}

const onCancel = () => {
  localShow.value = false
  emit('cancel')
}

const onConfirm = () => {
  if (!selectedVisit.value) {
    // Show notification if no visit is selected
    return
  }
  
  logger.info('Selected existing visit for questionnaire', { 
    encounterNum: selectedVisit.value.ENCOUNTER_NUM,
    patientNum: props.patient.PATIENT_NUM 
  })
  emit('visit-selected', selectedVisit.value)
  localShow.value = false
}

// Watch for dialog visibility changes
watch(() => props.modelValue, (newValue) => {
  localShow.value = newValue
  if (newValue) {
    loadVisits()
    selectedVisit.value = null // Reset selection
  }
})

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>

<style scoped>
.visit-list {
  border-radius: 8px;
  overflow: hidden;
}

.visit-item {
  transition: all 0.2s ease;
  min-height: 80px;
}

.visit-item:hover {
  background-color: #f5f5f5;
}

.visit-item.selected {
  background-color: #e3f2fd;
  border-left: 4px solid #1976d2;
}

.visit-item.selected:hover {
  background-color: #e3f2fd;
}

/* Icon spacing */
.q-item-label .q-icon {
  vertical-align: middle;
}
</style>
