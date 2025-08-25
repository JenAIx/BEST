<template>
  <q-page class="data-grid-page">
    <div class="q-pa-md">
      <div class="text-h4 q-mb-md flex items-center">
        <q-icon name="grid_on" size="32px" color="primary" class="q-mr-sm" />
        Data Grid
      </div>

      <!-- Patient Selection Card -->
      <q-card style="height: calc(100vh - 200px)">
        <q-card-section>
          <div class="row items-center justify-between">
            <div>
              <div class="text-h6">Patient Selection</div>
              <div class="text-caption text-grey-6 q-mt-xs">Select patients for multi-observation editing in Excel-like interface</div>
            </div>
            <div v-if="hasStoredSelection" class="q-gutter-sm">
              <q-btn color="primary" icon="table_view" label="Continue with Stored Selection" @click="goToDataGrid" :loading="loadingStoredSelection" />
              <q-btn flat color="grey-7" icon="clear" label="Clear Stored" @click="clearStoredSelection" />
            </div>
          </div>
        </q-card-section>

        <q-separator v-if="hasStoredSelection" />

        <!-- Stored Selection Info -->
        <q-card-section v-if="hasStoredSelection" class="q-pt-none">
          <q-banner class="bg-blue-1 text-blue-8" rounded>
            <template v-slot:avatar>
              <q-icon name="info" color="blue" />
            </template>
            <div class="text-body2">
              <strong>{{ storedPatientIds.length }} patients</strong> from previous session available.
              <div class="text-caption q-mt-xs">Last used: {{ formatStoredDate() }}</div>
            </div>
          </q-banner>
        </q-card-section>

        <q-separator />

        <!-- Filters -->
        <q-card-section>
          <div class="row q-col-gutter-md items-end">
            <div class="col-12 col-md-4">
              <q-input v-model="filters.search" label="Search by name or Patient ID" outlined dense clearable debounce="300" placeholder="Search patients...">
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.gender" :options="genderOptions" label="Gender" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.status" :options="statusOptions" label="Vital Status" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-2 text-right">
              <q-btn round flat icon="clear_all" color="grey-7" @click="clearFilters" size="md">
                <q-tooltip>Clear all filters</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Patient Count Info -->
          <div class="row q-mt-sm">
            <div class="col-12">
              <div class="text-caption text-grey-6 q-px-sm">
                <q-icon name="people" size="14px" class="q-mr-xs" />
                <span class="q-mr-md"
                  >Total: <strong>{{ totalPatients }}</strong></span
                >
                <span v-if="hasActiveFilters"
                  >• Filtered: <strong>{{ pagination.rowsNumber }}</strong></span
                >
                <span v-if="selectedPatients.length > 0" class="text-primary">
                  • Selected: <strong>{{ selectedPatients.length }}</strong>
                </span>
              </div>
            </div>
          </div>
        </q-card-section>

        <!-- Selection Actions -->
        <q-card-section v-if="selectedPatients.length > 0" class="q-pt-none">
          <div class="row q-col-gutter-sm items-center">
            <div class="col-auto">
              <q-btn color="primary" icon="table_view" label="Open Data Grid" @click="openDataGrid" :loading="isNavigating" />
            </div>
            <div class="col-auto">
              <q-btn flat color="grey-7" icon="clear" label="Clear Selection" @click="clearSelection" />
            </div>
            <div class="col-auto text-caption text-grey-6">{{ selectedPatients.length }} patient{{ selectedPatients.length !== 1 ? 's' : '' }} selected</div>
          </div>
        </q-card-section>

        <!-- Data Table -->
        <q-card-section class="q-pa-none">
          <q-table
            :rows="tableData"
            :columns="tableColumns"
            row-key="id"
            v-model:pagination="pagination"
            :loading="loading"
            @request="onTableRequest"
            flat
            bordered
            selection="multiple"
            v-model:selected="selectedPatients"
            class="data-grid-table"
          >
            <!-- Custom header for selection column -->
            <template v-slot:header-selection="scope">
              <q-checkbox v-model="scope.selected" />
            </template>

            <!-- Custom body for selection column -->
            <template v-slot:body-selection="scope">
              <q-checkbox :model-value="scope.selected" @update:model-value="scope.selected = $event" />
            </template>

            <!-- Custom body for name column to show patient info -->
            <template v-slot:body-cell-name="props">
              <q-td :props="props">
                <div class="flex items-center">
                  <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
                    {{ getPatientInitials(props.row.name) }}
                  </q-avatar>
                  <div>
                    <div class="text-weight-medium">{{ props.row.name }}</div>
                    <div class="text-caption text-grey-6">ID: {{ props.row.id }}</div>
                  </div>
                </div>
              </q-td>
            </template>

            <!-- Custom body for visits/observations column -->
            <template v-slot:body-cell-visits_observations="props">
              <q-td :props="props">
                <div class="visits-obs-display">
                  <div class="text-weight-medium">{{ props.row.visitsObsDisplay }}</div>
                  <div class="text-caption text-grey-6">
                    <q-icon name="event" size="12px" class="q-mr-xs" />visits
                    <span class="q-mx-xs">•</span>
                    <q-icon name="assignment" size="12px" class="q-mr-xs" />obs
                  </div>
                </div>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const $q = useQuasar()
const router = useRouter()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const localSettings = useLocalSettingsStore()

// Data state
const loading = ref(false)
const totalPatients = ref(0)
const selectedPatients = ref([])
const isNavigating = ref(false)
const loadingStoredSelection = ref(false)

// Filters
const filters = ref({
  search: '',
  gender: null,
  status: null,
})

// Dynamic filter options loaded from concept store
const genderOptions = ref([])
const statusOptions = ref([])

// Pagination
const pagination = ref({
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
  sortBy: 'id',
  descending: false,
})

// Table configuration
const tableColumns = [
  {
    name: 'id',
    label: 'Patient ID',
    field: (row) => row.id,
    align: 'left',
    sortable: true,
  },
  {
    name: 'name',
    label: 'Name',
    field: (row) => row.name,
    align: 'left',
    sortable: true,
  },
  {
    name: 'age',
    label: 'Age',
    field: 'age',
    align: 'center',
    sortable: true,
  },
  {
    name: 'gender',
    label: 'Gender',
    field: 'gender',
    align: 'center',
  },
  {
    name: 'lastVisit',
    label: 'Created',
    field: 'lastVisit',
    align: 'left',
    sortable: true,
  },
  {
    name: 'status',
    label: 'Vital Status',
    field: 'status',
    align: 'center',
  },
  {
    name: 'visits_observations',
    label: 'Visits/Obs',
    field: 'visitsObsDisplay',
    align: 'center',
    sortable: false,
  },
]

const tableData = ref([])

// Computed properties
const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.gender || filters.value.status
})

const storedPatientIds = computed(() => {
  return localSettings.getDataGridSelectedPatients()
})

const hasStoredSelection = computed(() => {
  return localSettings.hasDataGridSelectedPatients()
})

// Data loading methods
const loadTableData = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loading.value = true
    const patientRepo = dbStore.getRepository('patient')

    // Build filter criteria
    const criteria = {}

    if (filters.value.search && filters.value.search.trim()) {
      criteria.searchTerm = filters.value.search.trim()
    }

    if (filters.value.gender) {
      const genderCode = conceptStore.getCodeFromLabel(filters.value.gender, 'gender')
      if (genderCode) {
        criteria.SEX_CD = genderCode
      }
    }

    if (filters.value.status) {
      const statusCode = conceptStore.getCodeFromLabel(filters.value.status, 'vital_status')
      if (statusCode) {
        criteria.VITAL_STATUS_CD = statusCode
      }
    }

    // Add sorting options
    const sortOptions = {
      orderBy:
        pagination.value.sortBy === 'id'
          ? 'PATIENT_CD'
          : pagination.value.sortBy === 'name'
            ? 'PATIENT_CD'
            : pagination.value.sortBy === 'age'
              ? 'AGE_IN_YEARS'
              : pagination.value.sortBy === 'lastVisit'
                ? 'CREATED_AT'
                : 'PATIENT_CD',
      orderDirection: pagination.value.descending ? 'DESC' : 'ASC',
    }

    // Use server-side pagination with sorting
    const result = await patientRepo.getPatientsPaginated(pagination.value.page, pagination.value.rowsPerPage, {
      ...criteria,
      options: sortOptions,
    })

    // Get visit and observation counts for each patient
    const patientIds = (result.patients || []).map((p) => p.PATIENT_CD)
    const visitsObsCounts = await getVisitsAndObservationCounts(patientIds)

    tableData.value = (result.patients || []).map((patient) => {
      const counts = visitsObsCounts[patient.PATIENT_CD] || { visits: 0, observations: 0 }
      return {
        id: patient.PATIENT_CD,
        name: getPatientName(patient),
        age: patient.AGE_IN_YEARS || 'Unknown',
        gender: patient.SEX_RESOLVED || patient.SEX_CD || 'Unknown',
        lastVisit: formatDate(patient.CREATED_AT),
        status: patient.VITAL_STATUS_RESOLVED || patient.VITAL_STATUS_CD || 'Unknown',
        visitCount: counts.visits,
        observationCount: counts.observations,
        visitsObsDisplay: `${counts.visits}/${counts.observations}`,
        // Store original patient data
        originalData: patient,
      }
    })

    // Update pagination with total count from server
    pagination.value.rowsNumber = result.pagination?.totalCount || 0
  } catch (error) {
    console.error('Failed to load table data:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load table data',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const getVisitsAndObservationCounts = async (patientIds) => {
  if (!patientIds.length) return {}

  try {
    const placeholders = patientIds.map(() => '?').join(',')

    // Get visit counts
    const visitQuery = `
            SELECT pd.PATIENT_CD, COUNT(vd.ENCOUNTER_NUM) as visit_count
            FROM PATIENT_DIMENSION pd
            LEFT JOIN VISIT_DIMENSION vd ON pd.PATIENT_NUM = vd.PATIENT_NUM
            WHERE pd.PATIENT_CD IN (${placeholders})
            GROUP BY pd.PATIENT_CD
        `

    // Get observation counts
    const obsQuery = `
            SELECT pd.PATIENT_CD, COUNT(of.OBSERVATION_ID) as obs_count
            FROM PATIENT_DIMENSION pd
            LEFT JOIN OBSERVATION_FACT of ON pd.PATIENT_NUM = of.PATIENT_NUM
            WHERE pd.PATIENT_CD IN (${placeholders})
            GROUP BY pd.PATIENT_CD
        `

    const [visitResult, obsResult] = await Promise.all([dbStore.executeQuery(visitQuery, patientIds), dbStore.executeQuery(obsQuery, patientIds)])

    const counts = {}

    // Initialize all patient IDs with zero counts
    patientIds.forEach((id) => {
      counts[id] = { visits: 0, observations: 0 }
    })

    // Process visit counts
    if (visitResult.success && visitResult.data) {
      visitResult.data.forEach((row) => {
        if (counts[row.PATIENT_CD]) {
          counts[row.PATIENT_CD].visits = row.visit_count || 0
        }
      })
    }

    // Process observation counts
    if (obsResult.success && obsResult.data) {
      obsResult.data.forEach((row) => {
        if (counts[row.PATIENT_CD]) {
          counts[row.PATIENT_CD].observations = row.obs_count || 0
        }
      })
    }

    return counts
  } catch (error) {
    console.error('Failed to get visits and observation counts:', error)
  }

  return {}
}

const loadTotalPatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const patientRepo = dbStore.getRepository('patient')
    const patientStats = await patientRepo.getPatientStatistics()
    totalPatients.value = patientStats.totalPatients || 0
  } catch (error) {
    console.error('Failed to load total patients:', error)
  }
}

// Load filter options from concept store
const loadFilterOptions = async () => {
  try {
    await conceptStore.initialize()

    // Load gender and status options
    const [genderOpts, statusOpts] = await Promise.all([conceptStore.getConceptOptions('gender'), conceptStore.getConceptOptions('vital_status')])

    genderOptions.value = genderOpts
    statusOptions.value = statusOpts
  } catch (error) {
    console.error('Failed to load filter options:', error)
    // Use fallback options
    genderOptions.value = conceptStore.getFallbackOptions('gender')
    statusOptions.value = conceptStore.getFallbackOptions('vital_status')
  }
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
  return patient.PATIENT_CD || 'Unknown Patient'
}

const getPatientInitials = (name) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

const formatStoredDate = () => {
  const lastUsed = localSettings.getSetting('dataGrid.lastUsed')
  if (!lastUsed) return 'Unknown'
  return new Date(lastUsed).toLocaleString()
}

// Event handlers
const onTableRequest = async (props) => {
  // Update pagination state
  pagination.value.page = props.pagination.page
  pagination.value.rowsPerPage = props.pagination.rowsPerPage
  pagination.value.sortBy = props.pagination.sortBy
  pagination.value.descending = props.pagination.descending

  // Load data with new pagination/sorting
  await loadTableData()
}

const clearFilters = async () => {
  filters.value = {
    search: '',
    gender: null,
    status: null,
  }
  pagination.value.page = 1
  pagination.value.sortBy = 'id'
  pagination.value.descending = false
  await loadTableData()
  $q.notify({
    type: 'info',
    message: 'Filters cleared',
    position: 'top',
  })
}

const clearSelection = () => {
  selectedPatients.value = []
  $q.notify({
    type: 'info',
    message: 'Selection cleared',
    position: 'top',
  })
}

const clearStoredSelection = () => {
  localSettings.clearDataGridSelectedPatients()
  $q.notify({
    type: 'info',
    message: 'Stored patient selection cleared',
    position: 'top',
  })
}

const openDataGrid = async () => {
  if (selectedPatients.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Please select at least one patient',
      position: 'top',
    })
    return
  }

  try {
    isNavigating.value = true

    // Store selected patient IDs
    const patientIds = selectedPatients.value.map((p) => p.id)
    localSettings.setDataGridSelectedPatients(patientIds)

    $q.notify({
      type: 'positive',
      message: `Opening Data Grid with ${patientIds.length} patients...`,
      position: 'top',
    })

    // Navigate to the data grid editor
    router.push('/data-grid/editor')
  } catch (error) {
    console.error('Failed to open data grid:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to open data grid',
      position: 'top',
    })
  } finally {
    isNavigating.value = false
  }
}

const goToDataGrid = async () => {
  try {
    loadingStoredSelection.value = true

    $q.notify({
      type: 'positive',
      message: `Opening Data Grid with ${storedPatientIds.value.length} stored patients...`,
      position: 'top',
    })

    // Navigate to the data grid editor with stored selection
    router.push('/data-grid/editor')
  } catch (error) {
    console.error('Failed to open data grid:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to open data grid',
      position: 'top',
    })
  } finally {
    loadingStoredSelection.value = false
  }
}

// Initialize data
const initializeDataGridPage = async () => {
  if (!dbStore.canPerformOperations) {
    console.log('Database not ready, skipping data grid page initialization')
    return
  }

  loading.value = true
  try {
    await Promise.all([loadFilterOptions(), loadTotalPatients(), loadTableData()])
  } catch (error) {
    console.error('Failed to initialize data grid page:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load data grid page data',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Initialize local settings
  localSettings.initialize()

  // Wait for database to be ready and initialize page
  if (dbStore.canPerformOperations) {
    await initializeDataGridPage()
  } else {
    // Wait for database connection
    const unwatch = dbStore.$subscribe((mutation, state) => {
      if (state.isConnected && state.isInitialized) {
        initializeDataGridPage()
        unwatch()
      }
    })
  }
})

// Watch for filter changes to reload table data automatically
watch(
  filters,
  async () => {
    if (dbStore.canPerformOperations) {
      pagination.value.page = 1 // Reset to first page when filters change
      await loadTableData()
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.data-grid-page {
  background-color: $grey-1;
  min-height: calc(100vh - 50px);
}

.data-grid-table {
  :deep(.q-table tbody tr) {
    transition: background-color 0.2s ease;

    &:hover {
      background-color: $grey-2;
    }
  }

  :deep(.q-table__top) {
    padding: 12px 16px;
  }

  :deep(.q-checkbox) {
    .q-checkbox__inner {
      font-size: 18px;
    }
  }
}

// Enhanced styling for patient cards in table
:deep(.q-td) {
  .q-avatar {
    font-size: 0.75rem;
    font-weight: 600;
  }
}

// Styling for visits/observations display
.visits-obs-display {
  text-align: center;

  .text-weight-medium {
    font-size: 0.9rem;
    color: $primary;
  }

  .text-caption {
    font-size: 0.7rem;
    white-space: nowrap;
  }
}
</style>
