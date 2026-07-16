<template>
  <q-page class="export-page">
    <div class="page-container">
      <PageHeader :title="$t('export.exportData')" :subtitle="$t('export.pageSubtitle')" />

      <!-- Patient Data Explorer -->
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ $t('export.patientDataExport') }}</div>
          <div class="text-caption text-grey-6 q-mt-xs">{{ $t('export.selectPatientsHint') }}</div>
        </q-card-section>

        <q-separator />

        <!-- Filters -->
        <q-card-section>
          <div class="row q-col-gutter-md items-end">
            <div class="col-12 col-md-4">
              <q-input v-model="filters.search" :label="$t('export.searchByNameOrId')" outlined dense clearable debounce="300" :placeholder="$t('export.searchPatientsPlaceholder')">
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.gender" :options="genderOptions" :label="$t('patient.gender')" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-2">
              <q-select v-model="filters.status" :options="statusOptions" :label="$t('export.vitalStatus')" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-2">
              <q-toggle v-model="filters.onlyMine" :label="$t('visits.onlyMyPatients')" size="sm" dense color="primary" class="text-grey-7">
                <q-tooltip>{{ $t('visits.onlyMyPatientsHint') }}</q-tooltip>
              </q-toggle>
            </div>
            <div class="col-12 col-md-1 text-right">
              <q-btn round flat icon="clear_all" color="grey-7" @click="clearFilters" size="md">
                <q-tooltip>{{ $t('export.clearAllFilters') }}</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Patient Count Info + Selection Controls -->
          <div class="row q-mt-sm items-center justify-between">
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
            <div v-if="selectedPatients.length === 0">
              <q-btn flat dense size="sm" color="primary" icon="done_all" :label="$t('export.selectAllFiltered')" :loading="selectingAll" @click="selectAllFiltered" />
            </div>
          </div>
        </q-card-section>

        <!-- Selection Actions -->
        <q-card-section v-if="selectedPatients.length > 0" class="q-pt-none">
          <div class="row q-col-gutter-sm items-center">
            <div class="col-auto">
              <q-btn color="primary" icon="download" label="Export Selected" @click="showExportDialog = true" :loading="isExporting" />
            </div>
            <div class="col-auto">
              <q-btn flat color="grey-7" icon="clear" label="Clear Selection" @click="clearSelection" />
            </div>
            <div class="col-auto text-caption text-grey-6">{{ selectedPatients.length }} patient{{ selectedPatients.length !== 1 ? 's' : '' }} selected</div>
          </div>
        </q-card-section>

        <!-- Patient Cards (click to select) -->
        <q-card-section>
          <div v-if="loading" class="q-pa-md text-center">
            <q-spinner color="primary" size="32px" />
          </div>

          <template v-else-if="tableData.length > 0">
            <div class="patient-cards-grid">
              <PatientCard v-for="patient in tableData" :key="patient.id" :patient="patient" :selected="isPatientSelected(patient)" @select="toggleSelection" @changed="loadTableData" />
            </div>
            <div class="row justify-center q-mt-md">
              <q-pagination v-model="pagination.page" :max="totalPages" :max-pages="7" direction-links boundary-links size="sm" @update:model-value="loadTableData" />
            </div>
          </template>

          <div v-else class="q-pa-lg text-center text-grey-6">
            <q-icon name="person_off" size="48px" class="q-mb-sm" />
            <div>{{ $t('visit.noPatientsFound') }}</div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Export Dialog -->
    <ExportDialog v-model="showExportDialog" :selected-patients="selectedPatients" :is-exporting="isExporting" @export="onExportDialogConfirm" @cancel="onExportDialogCancel" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import ExportService from 'src/core/services/export-service.js'
import ExportDialog from 'src/components/export/ExportDialog.vue'
import PatientCard from 'src/components/shared/PatientCard.vue'
import PageHeader from 'src/components/shared/PageHeader.vue'

const notify = useNotify()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()

// Data state
const loading = ref(false)
const totalPatients = ref(0)
const selectedPatients = ref([])
const exportService = ref(null)
const showExportDialog = ref(false)
const isExporting = ref(false)

// Filters
const filters = ref({
  search: '',
  gender: null,
  status: null,
  onlyMine: false,
})

// Dynamic filter options loaded from concept store
const genderOptions = ref([])
const statusOptions = ref([])

// Pagination
const pagination = ref({
  page: 1,
  rowsPerPage: 24,
  rowsNumber: 0,
  sortBy: 'id',
  descending: false,
})

const totalPages = computed(() => Math.max(1, Math.ceil(pagination.value.rowsNumber / pagination.value.rowsPerPage)))

const tableData = ref([])

// Computed properties
const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.gender || filters.value.status || filters.value.onlyMine
})

// Shared filter criteria for the card list and "select all".
// Returns null when the "only mine" scope matches nothing.
const buildCriteria = async () => {
  const criteria = {}

  if (filters.value.search && filters.value.search.trim()) {
    criteria.searchTerm = filters.value.search.trim()
  }

  if (filters.value.gender) {
    // The filter value is already the code (from options loader)
    criteria.SEX_CD = filters.value.gender
  }

  if (filters.value.status) {
    // The filter value is already the code (from options loader)
    criteria.VITAL_STATUS_CD = filters.value.status
  }

  // "Only my patients": prefilter by direct assignments to the current user
  if (filters.value.onlyMine) {
    const { useAuthStore } = await import('src/stores/auth-store')
    const currentUserId = useAuthStore().currentUser?.USER_ID
    if (currentUserId !== undefined && currentUserId !== null) {
      const lookupRepo = dbStore.getRepository('userPatientLookup')
      const mineNums = await lookupRepo.getPatientNumsAssignedTo(currentUserId)
      if (mineNums.length === 0) return null
      criteria.patientNums = mineNums
    }
  }

  return criteria
}

// Map a raw patient row to the standard PatientCard shape (raw row kept for export)
const mapPatientForCard = (patient, accessMap) => ({
  id: patient.PATIENT_CD,
  name: getPatientName(patient),
  age: patient.AGE_IN_YEARS ?? null,
  gender: patient.SEX_RESOLVED || patient.SEX_CD || 'Unknown',
  lastVisit: formatDate(patient.CREATED_AT),
  status: patient.VITAL_STATUS_RESOLVED || patient.VITAL_STATUS_CD || 'Unknown',
  owner: accessMap.get(patient.PATIENT_NUM)?.ownerUserCd || null,
  isPublic: accessMap.get(patient.PATIENT_NUM)?.isPublic || false,
  // Store original patient data for export
  originalData: patient,
})

// Data loading methods
const loadTableData = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loading.value = true

    const criteria = await buildCriteria()
    if (criteria === null) {
      tableData.value = []
      pagination.value.rowsNumber = 0
      return
    }

    // Add sorting options
    const sortOptions = {
      orderBy:
        pagination.value.sortBy === 'id'
          ? 'PATIENT_CD'
          : pagination.value.sortBy === 'name'
            ? 'PATIENT_CD' // Use PATIENT_CD for name sorting as fallback
            : pagination.value.sortBy === 'age'
              ? 'AGE_IN_YEARS'
              : pagination.value.sortBy === 'lastVisit'
                ? 'CREATED_AT'
                : 'PATIENT_CD',
      orderDirection: pagination.value.descending ? 'DESC' : 'ASC',
    }

    // Use server-side pagination with sorting.
    // dbStore wrapper applies user access control (regular users: own + public)
    const result = await dbStore.getPatientsPaginated(pagination.value.page, pagination.value.rowsPerPage, {
      ...criteria,
      options: sortOptions,
    })

    const patients = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((patient) => patient.PATIENT_NUM))
    tableData.value = patients.map((patient) => mapPatientForCard(patient, accessMap))

    // Update pagination with total count from server
    pagination.value.rowsNumber = result.pagination?.totalCount || 0
  } catch (error) {
    console.error('Failed to load table data:', error)
    notify.error('Failed to load table data')
  } finally {
    loading.value = false
  }
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

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

// Event handlers
const clearFilters = async () => {
  filters.value = {
    search: '',
    gender: null,
    status: null,
    onlyMine: false,
  }
  pagination.value.page = 1
  pagination.value.sortBy = 'id'
  pagination.value.descending = false
  await loadTableData()
  notify.info('Filters cleared')
}

// Card selection (click toggles membership)
const isPatientSelected = (patient) => selectedPatients.value.some((p) => p.id === patient.id)

const toggleSelection = (patient) => {
  if (isPatientSelected(patient)) {
    selectedPatients.value = selectedPatients.value.filter((p) => p.id !== patient.id)
  } else {
    selectedPatients.value = [...selectedPatients.value, patient]
  }
}

// Select every patient matching the current filters (not just the page)
const selectingAll = ref(false)
const selectAllFiltered = async () => {
  try {
    selectingAll.value = true
    const criteria = await buildCriteria()
    if (criteria === null) {
      selectedPatients.value = []
      return
    }
    const result = await dbStore.getPatientsPaginated(1, 10000, criteria)
    const patients = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((patient) => patient.PATIENT_NUM))
    selectedPatients.value = patients.map((patient) => mapPatientForCard(patient, accessMap))
    notify.info(`${selectedPatients.value.length} patients selected`)
  } catch (error) {
    console.error('Failed to select all patients:', error)
    notify.error('Failed to select all patients')
  } finally {
    selectingAll.value = false
  }
}

const clearSelection = () => {
  selectedPatients.value = []
  notify.info('Selection cleared')
}

const onExportDialogConfirm = async (exportOptions) => {
  if (selectedPatients.value.length === 0) {
    notify.warning('No patients selected for export')
    return
  }

  try {
    isExporting.value = true

    await performExport(selectedPatients.value, exportOptions)

    // Close dialog on success
    showExportDialog.value = false
  } catch (error) {
    console.error('Export failed:', error)
    notify.error(`Export failed: ${error.message}`)
  } finally {
    isExporting.value = false
  }
}

const onExportDialogCancel = () => {
  showExportDialog.value = false
}

const performExport = async (patients, exportOptions) => {
  // Initialize export service if not already done
  if (!exportService.value) {
    await initializeExportService()
  }

  const { format, includeVisits, includeObservations } = exportOptions

  notify.info(`Starting ${format.toUpperCase()} export of ${patients.length} patients...`)

  // Perform the export
  const exportResult = await exportService.value.exportPatients(patients, format, {
    includeVisits,
    includeObservations,
  })

  // Download the file
  exportService.value.downloadExportedData(exportResult)

  notify.success(`✅ Export Complete: ${patients.length} patients exported to ${format.toUpperCase()}`, {
    caption: `File: ${exportResult.filename} (${(exportResult.size / 1024).toFixed(2)} KB)`,
    timeout: 6000,
    actions: [
      {
        label: 'View Details',
        color: 'white',
        handler: () => {
          console.log('Export result:', exportResult)
          notify.info('Export details logged to console')
        },
      },
    ],
  })
}

// Initialize export service
const initializeExportService = async () => {
  try {
    if (!dbStore.canPerformOperations) {
      throw new Error('Database not ready for export operations')
    }

    exportService.value = new ExportService(dbStore)
    await exportService.value.initialize()

    console.log('Export service initialized successfully')
  } catch (error) {
    console.error('Failed to initialize export service:', error)
    throw error
  }
}

// Initialize data
const initializeExportPage = async () => {
  if (!dbStore.canPerformOperations) {
    console.log('Database not ready, skipping export page initialization')
    return
  }

  loading.value = true
  try {
    await Promise.all([loadFilterOptions(), loadTotalPatients(), loadTableData(), initializeExportService()])
  } catch (error) {
    console.error('Failed to initialize export page:', error)
    notify.error('Failed to load export page data')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Wait for database to be ready and initialize page
  if (dbStore.canPerformOperations) {
    await initializeExportPage()
  } else {
    // Wait for database connection
    const unwatch = dbStore.$subscribe((mutation, state) => {
      if (state.isConnected && state.isInitialized) {
        initializeExportPage()
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
.patient-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .patient-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
