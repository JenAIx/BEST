<template>
  <q-page class="export-page">
    <div class="q-pa-md">
      <div class="text-h4 q-mb-md">Export Data</div>

      <!-- Patient Data Explorer -->
      <q-card>
        <q-card-section>
          <div class="text-h6">Patient Data Export</div>
          <div class="text-caption text-grey-6 q-mt-xs">Select patients and configure export options</div>
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
              <q-btn color="primary" icon="download" label="Export Selected" @click="showExportDialog = true" :loading="isExporting" />
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
            class="export-table"
          >
            <!-- Custom header for selection column -->
            <template v-slot:header-selection="scope">
              <q-checkbox v-model="scope.selected" />
            </template>

            <!-- Custom body for selection column -->
            <template v-slot:body-selection="scope">
              <q-checkbox :model-value="scope.selected" @update:model-value="scope.selected = $event" />
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>

    <!-- Export Dialog -->
    <ExportDialog v-model="showExportDialog" :selected-patients="selectedPatients" :is-exporting="isExporting" @export="onExportDialogConfirm" @cancel="onExportDialogCancel" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import ExportService from 'src/core/services/export-service.js'
import ExportDialog from 'src/components/export/ExportDialog.vue'

const $q = useQuasar()
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
]

const tableData = ref([])

// Computed properties
const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.gender || filters.value.status
})

// Data loading methods
const loadTableData = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loading.value = true
    const patientRepo = dbStore.getRepository('patient')

    // Build filter criteria - need to map resolved names back to codes
    const criteria = {}

    if (filters.value.search && filters.value.search.trim()) {
      criteria.searchTerm = filters.value.search.trim()
    }

    if (filters.value.gender) {
      // Use concept store to get code from label
      const genderCode = conceptStore.getCodeFromLabel(filters.value.gender, 'gender')
      if (genderCode) {
        criteria.SEX_CD = genderCode
      }
    }

    if (filters.value.status) {
      // Use concept store to get code from label
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
            ? 'PATIENT_CD' // Use PATIENT_CD for name sorting as fallback
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

    tableData.value = (result.patients || []).map((patient) => ({
      id: patient.PATIENT_CD,
      name: getPatientName(patient),
      age: patient.AGE_IN_YEARS || 'Unknown',
      gender: patient.SEX_RESOLVED || patient.SEX_CD || 'Unknown',
      lastVisit: formatDate(patient.CREATED_AT),
      status: patient.VITAL_STATUS_RESOLVED || patient.VITAL_STATUS_CD || 'Unknown',
      // Store original patient data for export
      originalData: patient,
    }))

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

const onExportDialogConfirm = async (exportOptions) => {
  if (selectedPatients.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'No patients selected for export',
      position: 'top',
    })
    return
  }

  try {
    isExporting.value = true

    await performExport(selectedPatients.value, exportOptions)

    // Close dialog on success
    showExportDialog.value = false
  } catch (error) {
    console.error('Export failed:', error)
    $q.notify({
      type: 'negative',
      message: `Export failed: ${error.message}`,
      position: 'top',
    })
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

  $q.notify({
    type: 'info',
    message: `Starting ${format.toUpperCase()} export of ${patients.length} patients...`,
    position: 'top',
  })

  // Perform the export
  const exportResult = await exportService.value.exportPatients(patients, format, {
    includeVisits,
    includeObservations,
  })

  // Download the file
  exportService.value.downloadExportedData(exportResult)

  $q.notify({
    type: 'positive',
    message: `✅ Export Complete: ${patients.length} patients exported to ${format.toUpperCase()}`,
    caption: `File: ${exportResult.filename} (${(exportResult.size / 1024).toFixed(2)} KB)`,
    position: 'top',
    timeout: 6000,
    actions: [
      {
        label: 'View Details',
        color: 'white',
        handler: () => {
          console.log('Export result:', exportResult)
          $q.notify({
            type: 'info',
            message: 'Export details logged to console',
            position: 'top',
          })
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
    $q.notify({
      type: 'negative',
      message: 'Failed to load export page data',
      position: 'top',
    })
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
.export-page {
  background-color: $grey-1;
  min-height: calc(100vh - 50px);
}

.export-table {
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
</style>
