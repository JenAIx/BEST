<template>
  <q-page class="q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div class="text-h4">{{ $t('patient.patientSearch') }}</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">
          {{ hasSearched ? `${totalPatients} patients found` : `${totalAvailablePatients} total patients` }}
        </div>
        <q-btn color="primary" icon="person_add" :label="$t('patient.addPatient')" @click="onAddPatient" />
      </div>
    </div>

    <!-- Intelligent Search -->
    <div class="row justify-center q-mb-lg">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card flat bordered class="search-card">
          <q-card-section class="q-pa-lg">
            <div class="text-center q-mb-md">
              <q-icon name="search" size="32px" color="primary" />
              <div class="text-h6 q-mt-sm">{{ $t('patient.smartSearch') }}</div>
              <div class="text-caption text-grey-6">{{ $t('patient.searchHint') }}</div>
            </div>

            <q-input v-model="searchQuery" outlined dense :placeholder="$t('patient.searchPlaceholder')" class="smart-search" @update:model-value="onSearchChange" debounce="300">
              <template v-slot:prepend>
                <q-icon name="psychology" color="primary" />
              </template>
              <template v-slot:append>
                <q-btn v-if="searchQuery" flat round dense icon="close" @click="clearSearch" />
                <q-btn flat round dense icon="tune" @click="showAdvancedSearch = !showAdvancedSearch">
                  <q-tooltip>{{ $t('patient.advancedFilters') }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>

            <!-- Search Suggestions -->
            <div v-if="searchSuggestions.length > 0" class="q-mt-sm">
              <div class="text-caption text-grey-6 q-mb-xs">{{ $t('patient.detected') }}:</div>
              <div class="row q-gutter-xs">
                <q-chip v-for="suggestion in searchSuggestions" :key="suggestion.type" :color="suggestion.color" text-color="white" size="sm" :icon="suggestion.icon">
                  {{ suggestion.label }}
                </q-chip>
              </div>
            </div>
          </q-card-section>

          <!-- Advanced Search -->
          <q-slide-transition>
            <q-card-section v-show="showAdvancedSearch" class="bg-grey-1">
              <div class="text-subtitle2 q-mb-md">Advanced Filters</div>
              <div class="row q-gutter-md justify-center">
                <div class="col-8">
                  <q-range v-model="filters.ageRange" :min="0" :max="120" label label-always color="primary" />
                  <div class="text-caption text-grey-6">Age Range: {{ filters.ageRange.min }} - {{ filters.ageRange.max }}</div>
                </div>
                <div class="col-12 col-md-5">
                  <q-select v-model="filters.sex" :options="sexOptions" label="Gender" outlined dense clearable emit-value map-options />
                </div>
                <div class="col-12 col-md-5">
                  <q-select v-model="filters.vitalStatus" :options="vitalStatusOptions" label="Status" outlined dense clearable emit-value map-options />
                </div>

                <div class="col-12 col-md-5">
                  <q-select
                    v-model="filters.location"
                    :options="locationOptions"
                    label="Location"
                    outlined
                    dense
                    clearable
                    emit-value
                    map-options
                    use-input
                    input-debounce="300"
                    @filter="filterLocations"
                  />
                </div>

                <div class="col-12 col-md-6">
                  <q-select v-model="filters.studies" :options="studyOptions" :label="$t('study.studies')" outlined dense clearable multiple emit-value map-options :loading="loadingStudies">
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption>{{ scope.opt.subtitle }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </div>
              </div>
              <div class="row justify-end q-mt-md">
                <q-btn flat label="Reset" @click="resetFilters" class="q-mr-sm" />
                <q-btn color="primary" label="Apply Filters" @click="applyFilters" />
              </div>
            </q-card-section>
          </q-slide-transition>
        </q-card>
      </div>
    </div>

    <!-- Recent Patients (when no search) -->
    <div v-if="!searchQuery && !hasActiveFilters" class="q-mb-lg">
      <div class="text-h6 q-mb-md">Recent Patients</div>
      <div class="row q-gutter-md justify-center">
        <div v-for="patient in recentPatients" :key="patient.PATIENT_NUM" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card flat bordered class="patient-card cursor-pointer" @mouseenter="hoveredPatient = patient.PATIENT_NUM" @mouseleave="hoveredPatient = null">
            <q-card-section class="q-pa-md" @click="onSelectPatient(patient)">
              <div class="row items-center q-gutter-md">
                <PatientAvatar :patient="patient" size="48px" />
                <div class="col">
                  <div class="text-weight-medium">{{ getPatientName(patient) }}</div>
                  <div class="text-caption text-grey-6">{{ patient.PATIENT_CD }}</div>
                  <div class="text-caption text-grey-6">{{ getPatientAge(patient) }} • {{ getPatientGender(patient) }}</div>
                </div>
              </div>
            </q-card-section>
            <!-- Delete Button (outside card-section to prevent click interference) -->
            <div v-if="hoveredPatient === patient.PATIENT_NUM" class="patient-delete-btn-overlay">
              <AppRemoveConfirmationButton
                @remove-confirmed="confirmDeletePatient(patient)"
              />
            </div>
            <q-tooltip class="bg-grey-9 text-white" style="max-width: 400px; white-space: pre-wrap">
              {{ formatPatientRawData(patient) }}
            </q-tooltip>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery || hasActiveFilters">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">
          Search Results
          <span class="text-caption text-grey-6 q-ml-sm">({{ totalPatients }} found)</span>
        </div>
        <div class="row items-center q-gutter-sm">
          <q-btn-toggle v-model="viewMode" :options="viewModeOptions" toggle-color="primary" color="grey-3" text-color="grey-7" size="sm" unelevated />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center q-py-xl">
        <q-spinner color="primary" size="48px" />
        <div class="text-grey-6 q-mt-md">Searching patients...</div>
      </div>

      <!-- Card View -->
      <div v-else-if="viewMode === 'cards'" class="row q-gutter-md justify-center">
        <div v-for="patient in patients" :key="patient.PATIENT_NUM" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card flat bordered class="patient-card cursor-pointer" @mouseenter="hoveredPatient = patient.PATIENT_NUM" @mouseleave="hoveredPatient = null">
            <q-card-section class="q-pa-md" @click="onSelectPatient(patient)">
              <div class="row items-start q-gutter-md">
                <PatientAvatar :patient="patient" size="48px" />
                <div class="col">
                  <div class="text-weight-medium text-body1">{{ getPatientName(patient) }}</div>
                  <div class="text-caption text-grey-6 q-mt-xs">{{ patient.PATIENT_CD }}</div>
                  <div class="text-caption text-grey-6">{{ getPatientAge(patient) }} • {{ getPatientGender(patient) }}</div>
                  <div v-if="patient.STATECITYZIP_PATH" class="text-caption text-grey-6">
                    <q-icon name="location_on" size="12px" class="q-mr-xs" />
                    {{ patient.STATECITYZIP_PATH }}
                  </div>
                </div>
              </div>
            </q-card-section>
            <!-- Delete Button (outside card-section to prevent click interference) -->
            <div v-if="hoveredPatient === patient.PATIENT_NUM" class="patient-delete-btn-overlay">
              <AppRemoveConfirmationButton
                @remove-confirmed="confirmDeletePatient(patient)"
              />
            </div>
            <q-tooltip class="bg-grey-9 text-white" style="max-width: 400px; white-space: pre-wrap">
              {{ formatPatientRawData(patient) }}
            </q-tooltip>
          </q-card>
        </div>
      </div>

      <!-- Table View -->
      <div v-else-if="viewMode === 'table'">
        <q-table :rows="patients" :columns="tableColumns" row-key="PATIENT_NUM" flat bordered :rows-per-page-options="[10, 25, 50]" class="patient-table" @row-click="onTableRowClick">
          <template v-slot:body-cell-avatar="props">
            <q-td :props="props">
              <PatientAvatar :patient="props.row" size="32px" />
            </q-td>
          </template>

          <template v-slot:body-cell-name="props">
            <q-td :props="props" class="cursor-pointer">
              <div class="text-weight-medium">{{ getPatientName(props.row) }}</div>
              <div class="text-caption text-grey-6">{{ props.row.PATIENT_CD }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-demographics="props">
            <q-td :props="props">
              <div>{{ getPatientAge(props.row) }}</div>
              <div class="text-caption text-grey-6">{{ getPatientGender(props.row) }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip :color="getStatusColor(props.row)" text-color="white" size="sm">
                {{ getStatusLabel(props.row) }}
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-location="props">
            <q-td :props="props">
              <div v-if="props.row.STATECITYZIP_PATH" class="text-caption">
                <q-icon name="location_on" size="12px" class="q-mr-xs" />
                {{ props.row.STATECITYZIP_PATH }}
              </div>
              <div v-else class="text-grey-5">-</div>
            </q-td>
          </template>

          <template v-slot:body-cell-created="props">
            <q-td :props="props">
              <div class="text-caption">{{ formatDate(props.row.CREATED_AT) }}</div>
            </q-td>
          </template>
        </q-table>
      </div>

      <!-- No Results -->
      <div v-if="!loading && patients.length === 0" class="text-center q-py-xl">
        <q-icon :name="hasSearched ? 'search_off' : 'people'" size="64px" color="grey-5" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{ hasSearched ? 'No patients found' : `${totalAvailablePatients} patients available` }}
        </div>
        <div class="text-body2 text-grey-6 q-mt-sm">
          <!-- prettier-ignore -->
          {{ hasSearched ? 'Try adjusting your search terms or filters'
                        : 'Use the search above to find specific patients' }}
        </div>
        <q-btn v-if="hasSearched" color="primary" label="Clear Search" @click="clearSearch" class="q-mt-md" />
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="patients.length > 0" class="row justify-center q-mt-lg">
      <q-pagination v-model="pagination.page" :max="Math.ceil(totalPatients / pagination.rowsPerPage)" direction-links boundary-links color="primary" @update:model-value="loadPatients" />
    </div>

    <!-- Create Patient Dialog -->
    <CreatePatientDialog v-model="showCreatePatientDialog" @patient-created="onPatientCreated" />

    <!-- Delete Patient Dialog -->
    <DeletePatientDialog
      ref="deletePatientDialog"
      @deleted="onPatientDeleted"
      @cancel="onDeleteCancelled"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useStudyStore } from 'src/stores/study-store'
import PatientAvatar from '../components/shared/PatientAvatar.vue'
import CreatePatientDialog from '../components/patient/CreatePatientDialog.vue'
import DeletePatientDialog from '../components/patient/DeletePatientDialog.vue'
import AppRemoveConfirmationButton from '../components/shared/AppRemoveConfirmationButton.vue'

const notify = useNotify()
const router = useRouter()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const studyStore = useStudyStore()

// State
const patients = ref([])
const recentPatients = ref([])
const totalPatients = ref(0)
const totalAvailablePatients = ref(0)
const loading = ref(false)
const searchQuery = ref('')
const showAdvancedSearch = ref(false)
const viewMode = ref('cards')
const hasSearched = ref(false)

// Dialog state
const showCreatePatientDialog = ref(false)

// Delete dialog states
const deletePatientDialog = ref(null)

// Hover state
const hoveredPatient = ref(null)

// Filters
const filters = ref({
  sex: null,
  vitalStatus: null,
  ageRange: { min: 20, max: 80 },
  location: '',
  studies: [],
})

// Search intelligence
const searchSuggestions = ref([])

// Pagination
const pagination = ref({
  page: 1,
  rowsPerPage: 12,
})

// Options
const viewModeOptions = [
  { label: 'Cards', value: 'cards', icon: 'view_module' },
  { label: 'Table', value: 'table', icon: 'view_list' },
]

const tableColumns = [
  {
    name: 'avatar',
    label: '',
    field: 'avatar',
    align: 'center',
    style: 'width: 50px',
  },
  {
    name: 'name',
    required: true,
    label: 'Patient',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'demographics',
    label: 'Age / Gender',
    field: 'demographics',
    align: 'left',
    sortable: false,
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center',
    sortable: true,
  },
  {
    name: 'location',
    label: 'Location',
    field: 'location',
    align: 'left',
    sortable: false,
  },
  {
    name: 'created',
    label: 'Created',
    field: 'created',
    align: 'left',
    sortable: true,
  },
]

// Dynamic filter options loaded from database
const sexOptions = ref([])
const vitalStatusOptions = ref([])
const locationOptions = ref([])
const studyOptions = ref([])
const loadingStudies = ref(false)

// Computed
const hasActiveFilters = computed(() => {
  return (
    filters.value.sex ||
    filters.value.vitalStatus ||
    filters.value.ageRange.min > 20 || // Changed from 0 to 20 (new default)
    filters.value.ageRange.max < 80 || // Changed from 120 to 80 (new default)
    (filters.value.location && filters.value.location.trim()) ||
    (filters.value.studies && filters.value.studies.length > 0)
  )
})

// Methods
const loadPatients = async () => {
  loading.value = true
  hasSearched.value = true
  try {
    if (!dbStore.canPerformOperations) {
      throw new Error('Database not available')
    }

    // Get enrolled patient IDs from selected studies FIRST (before building criteria)
    let enrolledPatientNums = null
    if (filters.value.studies && filters.value.studies.length > 0) {
      const studyRepo = dbStore.getRepository('study')
      enrolledPatientNums = new Set()

      // Get all enrolled patients from selected studies
      for (const studyId of filters.value.studies) {
        try {
          const enrolledPatients = await studyRepo.getEnrolledPatients(studyId)
          enrolledPatients.forEach((p) => enrolledPatientNums.add(p.PATIENT_NUM))
        } catch (error) {
          console.error(`Failed to get enrolled patients for study ${studyId}:`, error)
        }
      }

      // If no patients enrolled in selected studies, return empty results
      if (enrolledPatientNums.size === 0) {
        patients.value = []
        totalPatients.value = 0
        return
      }
    }

    const criteria = buildSearchCriteria()

    // If studies are selected, add patient ID filter to criteria
    // This ensures the repository filters at the database level for correct pagination
    if (enrolledPatientNums && enrolledPatientNums.size > 0) {
      criteria.patientNums = Array.from(enrolledPatientNums)
    }

    const result = await dbStore.getPatientsPaginated(pagination.value.page, pagination.value.rowsPerPage, criteria)

    patients.value = result.patients || []
    totalPatients.value = result.pagination?.totalCount || 0
  } catch (error) {
    console.error('Failed to load patients:', error)
    notify.error('Failed to load patients')
  } finally {
    loading.value = false
  }
}

const loadRecentPatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const result = await dbStore.getPatientsPaginated(1, 8, {
      options: {
        orderBy: 'UPDATE_DATE_WITH_FALLBACK',
        orderDirection: 'DESC',
      },
    })

    recentPatients.value = result.patients || []
  } catch (error) {
    console.error('Failed to load recent patients:', error)
  }
}

const loadTotalAvailablePatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const stats = await dbStore.getPatientStatistics()
    totalAvailablePatients.value = stats.totalPatients || 0
  } catch (error) {
    console.error('Failed to load total available patients:', error)
  }
}

const loadFilterOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    await conceptStore.initialize()

    // Load options from concept store
    const [sexOpts, statusOpts] = await Promise.all([conceptStore.getConceptOptions('gender'), conceptStore.getConceptOptions('vital_status')])

    sexOptions.value = sexOpts
    vitalStatusOptions.value = statusOpts

    // Load location options from database (not a concept, just location data)
    const locationResult = await dbStore.executeQuery(`
            SELECT DISTINCT STATECITYZIP_PATH
            FROM patient_list
            WHERE STATECITYZIP_PATH IS NOT NULL AND STATECITYZIP_PATH != ''
            ORDER BY STATECITYZIP_PATH
            LIMIT 50
        `)

    if (locationResult.success) {
      locationOptions.value = locationResult.data.map((row) => ({
        label: row.STATECITYZIP_PATH,
        value: row.STATECITYZIP_PATH,
      }))
    }

    // Load study options
    await loadStudyOptions()
  } catch (error) {
    console.error('Failed to load filter options:', error)
    // Use fallback options from concept store
    sexOptions.value = conceptStore.getFallbackOptions('gender')
    vitalStatusOptions.value = conceptStore.getFallbackOptions('vital_status')
  }
}

const loadStudyOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loadingStudies.value = true
    await studyStore.loadStudies()

    studyOptions.value = studyStore.studies.map((study) => ({
      label: study.name,
      value: study.id,
      subtitle: `${study.category || 'N/A'} • ${study.patientCount || 0} patients`,
    }))
  } catch (error) {
    console.error('Failed to load study options:', error)
    studyOptions.value = []
  } finally {
    loadingStudies.value = false
  }
}

const buildSearchCriteria = () => {
  const criteria = {}

  // Apply search query
  if (searchQuery.value && searchQuery.value.trim()) {
    criteria.searchTerm = searchQuery.value.trim()
  }

  // Apply gender filter - use the actual code from database
  if (filters.value.sex) {
    criteria.SEX_CD = filters.value.sex
  }

  // Apply vital status filter - use the actual code from database
  if (filters.value.vitalStatus) {
    criteria.VITAL_STATUS_CD = filters.value.vitalStatus
  }

  // Apply location filter
  if (filters.value.location && filters.value.location.trim()) {
    criteria.location = filters.value.location.trim()
  }

  // Apply age range filter - use proper format for repository
  // Apply filter if range differs from default (20-80)
  if (filters.value.ageRange.min !== 20 || filters.value.ageRange.max !== 80) {
    criteria.ageRange = {
      min: filters.value.ageRange.min,
      max: filters.value.ageRange.max,
    }
  }

  return criteria
}

const analyzeSearchQuery = (query) => {
  const suggestions = []

  // Age detection
  const ageMatch = query.match(/\b(\d{1,3})\b/)
  if (ageMatch) {
    const age = parseInt(ageMatch[1])
    if (age >= 0 && age <= 120) {
      suggestions.push({
        type: 'age',
        label: `Age: ${age}`,
        icon: 'cake',
        color: 'orange',
      })
    }
  }

  // Birth year detection
  const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    suggestions.push({
      type: 'birthYear',
      label: `Born: ${yearMatch[1]}`,
      icon: 'event',
      color: 'blue',
    })
  }

  // Gender detection
  if (/\b(male|man|m)\b/i.test(query)) {
    suggestions.push({
      type: 'gender',
      label: 'Male',
      icon: 'male',
      color: 'blue',
    })
  } else if (/\b(female|woman|f)\b/i.test(query)) {
    suggestions.push({
      type: 'gender',
      label: 'Female',
      icon: 'female',
      color: 'pink',
    })
  }

  // ID pattern detection
  if (/\b[A-Z]\d+\b/.test(query)) {
    suggestions.push({
      type: 'id',
      label: 'Patient ID',
      icon: 'badge',
      color: 'green',
    })
  }

  // Name detection (basic)
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(query)) {
    suggestions.push({
      type: 'name',
      label: 'Full Name',
      icon: 'person',
      color: 'purple',
    })
  }

  return suggestions
}

const onSearchChange = () => {
  searchSuggestions.value = analyzeSearchQuery(searchQuery.value)
  pagination.value.page = 1
  if (searchQuery.value || hasActiveFilters.value) {
    loadPatients()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchSuggestions.value = []
  hasSearched.value = false
  patients.value = []
  totalPatients.value = 0
  resetFilters()
}

const resetFilters = () => {
  filters.value = {
    sex: null,
    vitalStatus: null,
    ageRange: { min: 20, max: 80 },
    location: '',
    studies: [],
  }
}

const applyFilters = () => {
  pagination.value.page = 1
  loadPatients()
}

const filterLocations = (val, update) => {
  if (val === '') {
    update(() => {
      // Show all locations when no filter
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    locationOptions.value = locationOptions.value.filter((v) => v.label.toLowerCase().indexOf(needle) > -1)
  })
}

// Patient helper methods
const getPatientName = (patient) => {
  // Extract name from PATIENT_BLOB or use PATIENT_CD as fallback
  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      if (blob.name) return blob.name
      if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
    } catch {
      // Fallback to PATIENT_CD
    }
  }
  return patient.PATIENT_CD || 'Unknown Patient'
}

const getPatientGender = (patient) => {
  // Use resolved concept name if available, otherwise fall back to code
  if (patient.SEX_RESOLVED) {
    return patient.SEX_RESOLVED
  }
  return patient.SEX_CD || 'Unknown'
}

const getPatientAge = (patient) => {
  if (patient.AGE_IN_YEARS) return `${patient.AGE_IN_YEARS} years`
  if (patient.BIRTH_DATE) {
    const birthYear = new Date(patient.BIRTH_DATE).getFullYear()
    const currentYear = new Date().getFullYear()
    return `${currentYear - birthYear} years`
  }
  return 'Age unknown'
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

const getStatusColor = (patient) => {
  const statusCode = patient.VITAL_STATUS_CD
  if (!statusCode) return 'grey'

  // Use concept store for consistent color resolution
  const resolved = conceptStore.getResolved(statusCode)
  return resolved?.color || 'grey'
}

const getStatusLabel = (patient) => {
  const resolved = patient.VITAL_STATUS_RESOLVED
  const code = patient.VITAL_STATUS_CD

  // Prefer resolved text from database
  if (resolved) return resolved

  // Use concept store for fallback resolution
  const conceptResolved = conceptStore.getResolved(code)
  return conceptResolved?.label || conceptStore.getFallbackLabel(code) || 'Unknown'
}

const formatPatientRawData = (patient) => {
  if (!patient) return 'No data available'

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string' && value.trim() === '') return '""'
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return '[Object]'
      }
    }
    return String(value)
  }

  const lines = []
  lines.push('=== Patient Data with Resolved Concepts ===\n')

  // Group concept pairs (code + resolved) together
  const conceptPairs = [
    ['SEX_CD', 'SEX_RESOLVED'],
    ['VITAL_STATUS_CD', 'VITAL_STATUS_RESOLVED'],
    ['LANGUAGE_CD', 'LANGUAGE_RESOLVED'],
    ['RACE_CD', 'RACE_RESOLVED'],
    ['MARITAL_STATUS_CD', 'MARITAL_STATUS_RESOLVED'],
    ['RELIGION_CD', 'RELIGION_RESOLVED'],
  ]

  // Show concept pairs first
  lines.push('--- Resolved Concepts ---')
  for (const [codeField, resolvedField] of conceptPairs) {
    if (patient[codeField] || patient[resolvedField]) {
      lines.push(`${codeField}: ${formatValue(patient[codeField])}`)
      if (patient[resolvedField]) {
        lines.push(`  ↳ ${resolvedField}: ${formatValue(patient[resolvedField])}`)
      }
    }
  }

  lines.push('\n--- All Other Fields ---')

  // Show remaining fields
  const usedFields = new Set([...conceptPairs.flat()])
  const remainingKeys = Object.keys(patient)
    .filter((key) => !usedFields.has(key))
    .sort()

  for (const key of remainingKeys) {
    const value = patient[key]
    lines.push(`${key}: ${formatValue(value)}`)
  }

  return lines.join('\n')
}

// Actions
const onSelectPatient = (patient) => {
  // Navigate to patient details page (same as DashboardPage)
  router.push({ path: `/patient/${patient.PATIENT_CD}` })
  notify.success(`Selected patient: ${getPatientName(patient)}`)
}

const onTableRowClick = (evt, row) => {
  onSelectPatient(row)
}

const onAddPatient = () => {
  showCreatePatientDialog.value = true
}

const onPatientCreated = async (createdPatient) => {
  // Refresh patient data
  await Promise.all([loadRecentPatients(), loadTotalAvailablePatients()])

  // If we're currently searching, refresh search results
  if (searchQuery.value || hasActiveFilters.value) {
    await loadPatients()
  }

  notify.success(`Patient ${createdPatient.PATIENT_CD} created successfully!`, {
    timeout: 3000,
    actions: [
      {
        label: 'View Patient',
        color: 'white',
        handler: () => {
          router.push({ path: `/patient/${createdPatient.PATIENT_CD}` })
        },
      },
    ],
  })
}

// Patient deletion methods
// Prevent double-call of confirmDeletePatient
let isDeleting = false

const confirmDeletePatient = (patient) => {
  // Prevent double execution
  if (isDeleting) return
  
  isDeleting = true
  
  if (deletePatientDialog.value) {
    const patientName = getPatientName(patient)
    deletePatientDialog.value.show(patient, patientName)
  }
  
  // Reset flag after a short delay
  setTimeout(() => {
    isDeleting = false
  }, 500)
}

const onPatientDeleted = async () => {
  // Refresh patient data
  await Promise.all([loadRecentPatients(), loadTotalAvailablePatients()])

  // If we're currently searching, refresh search results
  if (searchQuery.value || hasActiveFilters.value) {
    await loadPatients()
  }
}

const onDeleteCancelled = () => {
  // No cleanup needed
}

// Initialize
onMounted(async () => {
  loadRecentPatients()
  loadTotalAvailablePatients()
  loadFilterOptions()

  // Preload common concepts for better performance
  if (dbStore.canPerformOperations) {
    try {
      // Preload common status and gender codes
      const [statusResult, genderResult] = await Promise.all([
        dbStore.executeQuery(`
                    SELECT DISTINCT VITAL_STATUS_CD
                    FROM patient_list
                    WHERE VITAL_STATUS_CD IS NOT NULL
                    LIMIT 10
                `),
        dbStore.executeQuery(`
                    SELECT DISTINCT SEX_CD
                    FROM patient_list
                    WHERE SEX_CD IS NOT NULL
                    LIMIT 10
                `),
      ])

      const conceptsToPreload = []

      if (statusResult.success) {
        conceptsToPreload.push(...statusResult.data.map((row) => row.VITAL_STATUS_CD).filter(Boolean))
      }

      if (genderResult.success) {
        conceptsToPreload.push(...genderResult.data.map((row) => row.SEX_CD).filter(Boolean))
      }

      if (conceptsToPreload.length > 0) {
        await conceptStore.resolveBatch(conceptsToPreload, { context: 'patient_search' })
      }
    } catch (error) {
      console.error('Failed to preload concepts:', error)
    }
  }
})

// Watch for filter changes
watch(
  () => filters.value,
  () => {
    if (hasActiveFilters.value) {
      pagination.value.page = 1
      loadPatients()
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.search-card {
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.smart-search {
  :deep(.q-field__control) {
    border-radius: 12px;
    font-size: 16px;
  }
}

.patient-card {
  border-radius: 12px;
  transition: all 0.2s ease;
  height: 100px;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.patient-delete-btn-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  animation: fadeInRight 0.3s ease;
  z-index: 10;
  pointer-events: all;
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(10px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.patient-table {
  :deep(.q-table__top) {
    padding: 12px 16px;
  }

  :deep(.q-table tbody tr) {
    cursor: pointer;

    &:hover {
      background-color: rgba(25, 118, 210, 0.04);
    }
  }

  :deep(.q-table th) {
    font-weight: 600;
    color: #1976d2;
  }
}
</style>
