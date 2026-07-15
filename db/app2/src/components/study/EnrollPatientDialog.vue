<template>
  <AppInputDialog
    v-model="dialogModel"
    :title="$t('study.enrollPatient')"
    :ok-label="$t('study.enroll')"
    :cancel-label="$t('common.cancel')"
    :loading="enrolling"
    :disabled="selectedPatients.length === 0 || !enrollmentData.enrollmentDate"
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
      <div v-if="patientSearchQuery && visibleSearchSuggestions.length > 0" class="suggestions-container q-mt-sm">
        <q-list bordered separator class="rounded-borders">
          <q-item
            v-for="(patient, index) in visibleSearchSuggestions"
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

      <!-- Selected patients (chips; X puts them back into the list) -->
      <div v-if="selectedPatients.length > 0" class="q-mt-sm">
        <div class="text-caption text-grey-6 q-mb-xs">{{ $t('study.selectedForEnrollment', { count: selectedPatients.length }) }}</div>
        <div class="row q-gutter-xs">
          <q-chip v-for="patient in selectedPatients" :key="patient.PATIENT_NUM" removable dense color="primary" text-color="white" icon="person" @remove="removeSelected(patient)">
            {{ getPatientName(patient) }}
          </q-chip>
        </div>
      </div>

      <!-- No Results -->
      <div v-if="patientSearchQuery && visibleSearchSuggestions.length === 0 && !searching" class="q-mt-sm text-center text-grey-6">
        <q-icon name="person_off" size="24px" class="q-mr-xs" />
        <span class="text-caption">{{ $t('study.noPatientsFound') }}</span>
      </div>

      <!-- Suggestions: patients not enrolled in any study (newest first, capped) -->
      <div v-if="!patientSearchQuery && visibleUnassignedSuggestions.length > 0" class="q-mt-sm">
        <div class="text-caption text-grey-6 q-mb-xs">
          <q-icon name="lightbulb" size="14px" class="q-mr-xs" />
          {{ $t('study.unassignedSuggestions') }}
        </div>
        <div class="suggestion-cards">
          <PatientCard v-for="patient in visibleUnassignedSuggestions" :key="patient.PATIENT_NUM" :patient="patient" @select="selectPatient" />
        </div>
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
import PatientCard from 'src/components/shared/PatientCard.vue'

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
const selectedPatients = ref([])
const selectedSuggestionIndex = ref(-1)

// Selected patients disappear from both lists (saves space); removing the
// chip puts them back
const isSelected = (patient) => selectedPatients.value.some((p) => p.PATIENT_NUM === patient.PATIENT_NUM)
const visibleSearchSuggestions = computed(() => suggestions.value.filter((p) => !isSelected(p)))
const visibleUnassignedSuggestions = computed(() => unassignedSuggestions.value.filter((p) => !isSelected(p)))
const enrollmentData = ref({
  enrollmentDate: new Date().toISOString().split('T')[0],
})
const enrolling = ref(false)
const unassignedSuggestions = ref([])

// Suggested candidates: accessible patients enrolled in NO study,
// newest first, capped — keeps the list small and relevant.
const SUGGESTION_LIMIT = 10
const loadUnassignedSuggestions = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const numsResult = await dbStore.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_NUM NOT IN (SELECT PATIENT_NUM FROM STUDY_PATIENT_LOOKUP)')
    const enrolledSet = new Set(props.enrolledPatientNums)
    const nums = (numsResult.success ? numsResult.data : []).map((row) => row.PATIENT_NUM).filter((num) => !enrolledSet.has(num))
    if (nums.length === 0) {
      unassignedSuggestions.value = []
      return
    }

    // Access-filtered, newest first
    const result = await dbStore.getPatientsPaginated(1, SUGGESTION_LIMIT, {
      patientNums: nums,
      options: { orderBy: 'UPDATE_DATE_WITH_FALLBACK', orderDirection: 'DESC' },
    })
    const patients = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((p) => p.PATIENT_NUM))

    unassignedSuggestions.value = patients.map((p) => ({
      ...p,
      id: p.PATIENT_CD,
      name: getPatientName(p),
      age: p.AGE_IN_YEARS ?? null,
      owner: accessMap.get(p.PATIENT_NUM)?.ownerUserCd || null,
      isPublic: accessMap.get(p.PATIENT_NUM)?.isPublic || false,
    }))
  } catch (error) {
    console.error('Failed to load unassigned patient suggestions:', error)
    unassignedSuggestions.value = []
  }
}

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

    // Build search criteria (matching SmartSearch.vue pattern)
    const criteria = {
      searchTerm: patientSearchQuery.value.trim(),
      options: {
        orderBy: 'PATIENT_CD',
        orderDirection: 'ASC',
      },
    }

    // dbStore wrapper applies user access control (regular users: own + public)
    const result = await dbStore.getPatientsPaginated(1, 10, criteria)

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
  if (!isSelected(patient)) {
    selectedPatients.value = [...selectedPatients.value, patient]
  }
  patientSearchQuery.value = ''
  suggestions.value = []
  selectedSuggestionIndex.value = -1
}

const removeSelected = (patient) => {
  selectedPatients.value = selectedPatients.value.filter((p) => p.PATIENT_NUM !== patient.PATIENT_NUM)
}

const selectFirstSuggestion = () => {
  if (visibleSearchSuggestions.value.length > 0) {
    selectPatient(visibleSearchSuggestions.value[0])
  }
}

const clearSearch = () => {
  patientSearchQuery.value = ''
  suggestions.value = []
  selectedSuggestionIndex.value = -1
}

const clearSelectedPatients = () => {
  selectedPatients.value = []
  enrollmentData.value.enrollmentDate = defaultEnrollmentDate.value
}

const handleEnroll = async () => {
  if (selectedPatients.value.length === 0) return

  enrolling.value = true
  try {
    emit('enroll', {
      patientNums: selectedPatients.value.map((p) => p.PATIENT_NUM),
      enrollmentDate: enrollmentData.value.enrollmentDate,
    })
  } finally {
    enrolling.value = false
  }
}

const handleCancel = () => {
  clearSearch()
  clearSelectedPatients()
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
    clearSelectedPatients()
    enrollmentData.value.enrollmentDate = defaultEnrollmentDate.value
    loadUnassignedSuggestions()
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

.suggestion-cards {
  display: grid;
  gap: 0.4rem;
  max-height: 300px;
  overflow-y: auto;
}
</style>

