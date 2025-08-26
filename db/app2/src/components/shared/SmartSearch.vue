<template>
  <div class="smart-search">
    <!-- Search Input -->
    <q-input
      ref="searchInputRef"
      v-model="searchQuery"
      dense
      outlined
      placeholder="Search patients: P001, John Doe..."
      class="smart-search__input"
      bg-color="grey-1"
      @focus="onFocus"
      @blur="onBlur"
      @keyup.enter="onEnterSearch"
      @keyup.escape="clearSearch"
    >
      <template v-slot:prepend>
        <q-icon name="search" color="grey-6" />
      </template>
      <template v-slot:append>
        <q-btn v-if="searchQuery" flat round dense icon="close" size="sm" @click="clearSearch" class="q-mr-xs">
          <q-tooltip>Clear search</q-tooltip>
        </q-btn>
        <q-btn v-if="searchQuery" flat round dense icon="arrow_forward" size="sm" color="primary" @click="onEnterSearch">
          <q-tooltip>Search</q-tooltip>
        </q-btn>
      </template>
    </q-input>

    <!-- Search Overlay -->
    <div v-if="showSearchOverlay" class="smart-search__overlay" @click="clearSearch">
      <div class="smart-search__results" @click.stop>
        <!-- Loading State -->
        <div v-if="isSearching" class="text-center q-pa-xl">
          <q-spinner-dots size="40px" color="primary" />
          <div class="text-grey-6 q-mt-md">Searching patients...</div>
        </div>

        <!-- Search Results -->
        <div v-else-if="searchResults.length > 0" class="q-pa-md">
          <div class="text-h6 q-mb-md text-grey-8">
            <q-icon name="people" class="q-mr-sm" />
            Found {{ searchResults.length }} patient{{ searchResults.length > 1 ? 's' : '' }}
          </div>

          <q-list separator>
            <q-item v-for="patient in searchResults" :key="patient.id" clickable v-ripple @click="selectPatient(patient)" class="search-result-item">
              <q-item-section avatar>
                <PatientAvatar :patient="patient" size="40px" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-medium"> {{ patient.firstName }} {{ patient.lastName }} </q-item-label>
                <q-item-label caption class="text-grey-6"> ID: {{ patient.patientId }} • DOB: {{ formatDate(patient.dateOfBirth) }} </q-item-label>
                <q-item-label caption class="text-grey-7" v-if="patient.email">
                  {{ patient.email }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-icon name="arrow_forward_ios" color="grey-5" size="16px" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- No Results -->
        <div v-else-if="searchQuery && !isSearching" class="text-center q-pa-xl">
          <q-icon name="search_off" size="48px" color="grey-4" class="q-mb-md" />
          <div class="text-h6 text-grey-6 q-mb-sm">No patients found</div>
          <div class="text-grey-7">Try searching by patient ID (P001) or name (John Doe)</div>
          <q-btn flat color="primary" label="Advanced Search" class="q-mt-md" @click="goToAdvancedSearch" />
        </div>

        <!-- Search Tips -->
        <div v-else class="text-center q-pa-xl">
          <q-icon name="lightbulb" size="48px" color="amber-6" class="q-mb-md" />
          <div class="text-h6 text-grey-8 q-mb-sm">Smart Patient Search</div>
          <div class="text-grey-7 q-mb-md">Start typing to search for patients by:</div>
          <div class="search-tips">
            <div class="search-tip">
              <q-chip color="primary" text-color="white" size="sm">
                <q-icon name="badge" size="16px" class="q-mr-xs" />
                Patient ID
              </q-chip>
              <span class="q-ml-sm text-grey-7">P001, 12345</span>
            </div>
            <div class="search-tip">
              <q-chip color="secondary" text-color="white" size="sm">
                <q-icon name="person" size="16px" class="q-mr-xs" />
                Full Name
              </q-chip>
              <span class="q-ml-sm text-grey-7">John Doe, Jane Smith</span>
            </div>
            <div class="search-tip">
              <q-chip color="accent" text-color="white" size="sm">
                <q-icon name="email" size="16px" class="q-mr-xs" />
                Email
              </q-chip>
              <span class="q-ml-sm text-grey-7">john@example.com</span>
            </div>
          </div>
        </div>

        <!-- Close Button -->
        <div class="smart-search__close">
          <q-btn round flat icon="close" size="sm" @click="clearSearch" class="bg-white shadow-2">
            <q-tooltip>Close search</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLoggingStore } from 'src/stores/logging-store'
import PatientAvatar from './PatientAvatar.vue'

const router = useRouter()
const $q = useQuasar()
const dbStore = useDatabaseStore()
const visitStore = useVisitObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('SmartSearch')

// Refs
const searchInputRef = ref(null)
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref([])
const isFocused = ref(false)
const debounceTimer = ref(null)

// Computed
const showSearchOverlay = computed(() => {
  return isFocused.value && searchQuery.value.length > 0
})

// Emit events
const emit = defineEmits(['search-active', 'search-cleared'])

// Methods
const onFocus = () => {
  isFocused.value = true
  if (searchQuery.value) {
    emit('search-active', true)
  }
}

const onBlur = () => {
  // Delay to allow clicks on results
  setTimeout(() => {
    isFocused.value = false
    if (!searchQuery.value) {
      emit('search-active', false)
    }
  }, 200)
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
  isFocused.value = false
  emit('search-active', false)
  searchInputRef.value?.blur()
}

const onEnterSearch = () => {
  if (searchResults.value.length === 1) {
    selectPatient(searchResults.value[0])
  } else if (searchResults.value.length > 1) {
    goToAdvancedSearch()
  } else {
    performSearch()
  }
}

const performSearch = async () => {
  if (!searchQuery.value.trim()) return

  isSearching.value = true
  try {
    const patientRepo = dbStore.getRepository('patient')
    if (!patientRepo) {
      throw new Error('Patient repository not available')
    }

    // Build search criteria
    const criteria = {
      searchTerm: searchQuery.value.trim(),
      options: {
        orderBy: 'PATIENT_CD',
        orderDirection: 'ASC',
      },
    }

    const result = await patientRepo.getPatientsPaginated(1, 10, criteria)
    searchResults.value = (result.patients || []).map((patient) => ({
      id: patient.PATIENT_NUM,
      patientId: patient.PATIENT_CD,
      firstName: getPatientFirstName(patient),
      lastName: getPatientLastName(patient),
      dateOfBirth: getPatientDateOfBirth(patient),
      email: getPatientEmail(patient),
      sexResolved: patient.SEX_RESOLVED,
      sexCode: patient.SEX_CD,
    }))
  } catch (error) {
    logger.error('Search error', error)
    $q.notify({
      type: 'negative',
      message: 'Search failed. Please try again.',
      position: 'top',
    })
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const selectPatient = async (patient) => {
  try {
    // Transform patient data for the visit-observation-store
    const visitPatient = {
      id: patient.patientId,
      name: `${patient.firstName} ${patient.lastName}`,
      age: calculatePatientAge(patient.dateOfBirth),
      gender: patient.sexResolved || patient.sexCode,
      PATIENT_NUM: patient.id, // This is the actual PATIENT_NUM from the database
    }

    // Set the patient in the visit-observation-store
    await visitStore.setSelectedPatient(visitPatient)

    // Log the selection
    logger.logUserAction('patient_selected_from_search', {
      patientId: patient.patientId,
      patientName: visitPatient.name,
      searchQuery: searchQuery.value,
      resultPosition: searchResults.value.findIndex((p) => p.id === patient.id) + 1,
    })

    // Navigate to visits page
    router.push(`/visits/${visitPatient.id}`)
    clearSearch()

    $q.notify({
      type: 'positive',
      message: `Selected patient: ${visitPatient.name}`,
      position: 'top',
      icon: 'person',
      timeout: 2000,
    })
  } catch (error) {
    logger.error('Failed to select patient from search', error, {
      patientId: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
    })

    $q.notify({
      type: 'negative',
      message: 'Failed to select patient. Please try again.',
      position: 'top',
      timeout: 3000,
    })
  }
}

const goToAdvancedSearch = () => {
  router.push({
    path: '/patients',
    query: { search: searchQuery.value },
  })
  clearSearch()
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return dateString
  }
}

const calculatePatientAge = (dateOfBirth) => {
  if (!dateOfBirth) return null
  try {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age > 0 ? age : null
  } catch {
    return null
  }
}

// Helper functions to extract patient data from PATIENT_BLOB
const getPatientFirstName = (patient) => {
  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      return blob.firstName || blob.name?.split(' ')[0] || ''
    } catch {
      // Fallback
    }
  }
  return patient.PATIENT_CD?.split('_')[0] || 'Unknown'
}

const getPatientLastName = (patient) => {
  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      return blob.lastName || blob.name?.split(' ').slice(1).join(' ') || ''
    } catch {
      // Fallback
    }
  }
  return patient.PATIENT_CD?.split('_')[1] || ''
}

const getPatientDateOfBirth = (patient) => {
  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      return blob.dateOfBirth || blob.birthDate || ''
    } catch {
      // Fallback
    }
  }
  return ''
}

const getPatientEmail = (patient) => {
  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      return blob.email || ''
    } catch {
      // Fallback
    }
  }
  return ''
}

// Watch for search query changes
watch(searchQuery, (newQuery) => {
  if (newQuery.trim().length > 0) {
    emit('search-active', true)
    // Debounce search
    clearTimeout(debounceTimer.value)
    debounceTimer.value = setTimeout(() => {
      performSearch()
    }, 300)
  } else {
    emit('search-active', false)
    searchResults.value = []
    clearTimeout(debounceTimer.value)
  }
})

// Expose methods for parent component
defineExpose({
  focus: () => {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  },
  clear: clearSearch,
})
</script>

<style lang="scss" scoped>
.smart-search {
  position: relative;
  width: 100%;
  max-width: 400px;

  &__input {
    :deep(.q-field__control) {
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    :deep(.q-field--focused .q-field__control) {
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }
  }

  &__overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    backdrop-filter: blur(2px);
  }

  &__results {
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    max-width: 600px;
    width: 90vw;
    max-height: 70vh;
    overflow-y: auto;
    position: relative;

    // Custom scrollbar
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: $grey-2;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: $grey-5;
      border-radius: 4px;

      &:hover {
        background: $grey-6;
      }
    }
  }

  &__close {
    position: absolute;
    top: 16px;
    right: 16px;
  }
}

.search-result-item {
  border-radius: 12px;
  margin: 8px;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(25, 118, 210, 0.04);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.search-tips {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.search-tip {
  display: flex;
  align-items: center;
  justify-content: center;
}

// Dark mode support
.body--dark {
  .smart-search {
    &__results {
      background: $dark;
      color: white;
    }
  }

  .search-result-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

// Mobile responsiveness
@media (max-width: 600px) {
  .smart-search {
    &__overlay {
      padding-top: 5vh;
    }

    &__results {
      width: 95vw;
      max-height: 80vh;
      border-radius: 12px;
    }
  }

  .search-tips {
    .search-tip {
      flex-direction: column;
      gap: 4px;
    }
  }
}
</style>
