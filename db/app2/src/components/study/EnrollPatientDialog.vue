<template>
  <AppInputDialog
    v-model="dialogModel"
    :title="$t('study.enrollPatient')"
    :ok-label="$t('study.enroll')"
    :cancel-label="$t('common.cancel')"
    :loading="enrolling"
    :disabled="!selectedPatient || !enrollmentData.enrollmentDate"
    :persistent="true"
    @ok="handleEnroll"
    @cancel="handleCancel"
  >
    <!-- Patient Search Input -->
    <div class="q-mb-md">
      <q-input
        v-model="patientSearchQuery"
        :label="$t('patient.selectPatient')"
        :placeholder="$t('study.enterPatientIdOrName')"
        outlined
        dense
        :loading="searching"
        debounce="300"
        @update:model-value="onSearchInput"
        @keydown.enter.prevent="selectFirstSuggestion"
      >
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
        <template v-slot:append v-if="patientSearchQuery">
          <q-btn flat round dense icon="close" @click="clearSearch" />
        </template>
      </q-input>

      <!-- Search Suggestions -->
      <div v-if="patientSearchQuery && suggestions.length > 0" class="suggestions-container q-mt-sm">
        <q-list bordered separator class="rounded-borders">
          <q-item
            v-for="(patient, index) in suggestions"
            :key="patient.PATIENT_NUM"
            clickable
            v-ripple
            :class="{ 'bg-blue-1': selectedSuggestionIndex === index }"
            @click="selectPatient(patient)"
            @mouseenter="selectedSuggestionIndex = index"
          >
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" size="32px">
                {{ getPatientInitials(patient) }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ getPatientName(patient) }}</q-item-label>
              <q-item-label caption>
                {{ patient.PATIENT_CD }}
                <span v-if="getPatientAge(patient)"> • {{ getPatientAge(patient) }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="arrow_forward" color="grey-6" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Selected Patient Display -->
      <div v-if="selectedPatient && !patientSearchQuery" class="selected-patient q-mt-sm">
        <q-card flat bordered class="bg-blue-1">
          <q-card-section class="row items-center">
            <q-avatar color="primary" text-color="white" size="40px" class="q-mr-md">
              {{ getPatientInitials(selectedPatient) }}
            </q-avatar>
            <div class="col">
              <div class="text-subtitle1">{{ getPatientName(selectedPatient) }}</div>
              <div class="text-caption text-grey-7">
                {{ selectedPatient.PATIENT_CD }}
                <span v-if="getPatientAge(selectedPatient)"> • {{ getPatientAge(selectedPatient) }}</span>
              </div>
            </div>
            <q-btn flat round dense icon="close" @click="clearSelectedPatient" />
          </q-card-section>
        </q-card>
      </div>

      <!-- No Results -->
      <div v-if="patientSearchQuery && suggestions.length === 0 && !searching" class="q-mt-sm text-center text-grey-6">
        <q-icon name="person_off" size="24px" class="q-mr-xs" />
        <span class="text-caption">{{ $t('study.noPatientsFound') }}</span>
      </div>
    </div>

    <!-- Enrollment Date -->
    <q-input
      v-model="enrollmentData.enrollmentDate"
      :label="$t('study.enrollmentDate')"
      outlined
      dense
      type="date"
      :model-value="enrollmentData.enrollmentDate || defaultEnrollmentDate"
    />
  </AppInputDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useNotify } from 'src/composables/useNotify'
import AppInputDialog from 'src/components/shared/AppInputDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  enrolledPatientNums: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'enroll', 'cancel'])

const { t } = useI18n()
const dbStore = useDatabaseStore()
const notify = useNotify()
// State
const patientSearchQuery = ref('')
const searching = ref(false)
const suggestions = ref([])
const selectedPatient = ref(null)
const selectedSuggestionIndex = ref(-1)
const enrollmentData = ref({
  enrollmentDate: new Date().toISOString().split('T')[0],
})
const enrolling = ref(false)

// Computed
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const defaultEnrollmentDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

// Methods
const onSearchInput = async () => {
  if (!patientSearchQuery.value.trim()) {
    suggestions.value = []
    selectedSuggestionIndex.value = -1
    return
  }

  try {
    searching.value = true
    if (!dbStore.canPerformOperations) return

    const patientRepo = dbStore.getRepository('patient')
    if (!patientRepo) {
      throw new Error('Patient repository not available')
    }

    // Build search criteria (matching SmartSearch.vue pattern)
    const criteria = {
      searchTerm: patientSearchQuery.value.trim(),
      options: {
        orderBy: 'PATIENT_CD',
        orderDirection: 'ASC',
      },
    }

    const result = await patientRepo.getPatientsPaginated(1, 10, criteria)

    // Filter out already enrolled patients
    const enrolledSet = new Set(props.enrolledPatientNums)
    
    suggestions.value = (result.patients || [])
      .filter((p) => !enrolledSet.has(p.PATIENT_NUM))
      .slice(0, 10) // Limit to 10 suggestions
  } catch (error) {
    console.error('Failed to search patients:', error)
    suggestions.value = []
    notify.error(t('study.failedToSearchPatients'))
  } finally {
    searching.value = false
  }
}

const selectPatient = (patient) => {
  selectedPatient.value = patient
  patientSearchQuery.value = ''
  suggestions.value = []
  selectedSuggestionIndex.value = -1
}

const selectFirstSuggestion = () => {
  if (suggestions.value.length > 0) {
    selectPatient(suggestions.value[0])
  }
}

const clearSearch = () => {
  patientSearchQuery.value = ''
  suggestions.value = []
  selectedSuggestionIndex.value = -1
}

const clearSelectedPatient = () => {
  selectedPatient.value = null
  enrollmentData.value.enrollmentDate = defaultEnrollmentDate.value
}

const handleEnroll = async () => {
  if (!selectedPatient.value) return

  enrolling.value = true
  try {
    emit('enroll', {
      patientNum: selectedPatient.value.PATIENT_NUM,
      enrollmentDate: enrollmentData.value.enrollmentDate,
    })
  } finally {
    enrolling.value = false
  }
}

const handleCancel = () => {
  clearSearch()
  clearSelectedPatient()
  emit('cancel')
}

// Helper methods
const getPatientName = (patient) => {
  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      if (blob.name) return blob.name
      if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
    } catch {
      // Fallback to PATIENT_CD
    }
  }
  return patient.PATIENT_CD || t('patient.unknownPatient')
}

const getPatientAge = (patient) => {
  if (patient.AGE_IN_YEARS) return `${patient.AGE_IN_YEARS} ${t('common.years')}`
  if (patient.BIRTH_DATE) {
    const birthYear = new Date(patient.BIRTH_DATE).getFullYear()
    const currentYear = new Date().getFullYear()
    return `${currentYear - birthYear} ${t('common.years')}`
  }
  return null
}

const getPatientInitials = (patient) => {
  const name = getPatientName(patient)
  if (name === patient.PATIENT_CD) {
    return name.substring(0, 2).toUpperCase()
  }
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Reset when dialog opens
watch(dialogModel, (newValue) => {
  if (newValue) {
    clearSearch()
    clearSelectedPatient()
    enrollmentData.value.enrollmentDate = defaultEnrollmentDate.value
  }
})
</script>

<style lang="scss" scoped>
.suggestions-container {
  max-height: 300px;
  overflow-y: auto;
  border-radius: 4px;
}

.selected-patient {
  .q-card {
    border-left: 4px solid $primary;
  }
}
</style>

