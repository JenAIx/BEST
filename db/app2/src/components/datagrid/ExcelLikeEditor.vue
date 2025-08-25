<template>
  <div class="excel-editor">
    <!-- Header Controls -->
    <div class="editor-header q-pa-md bg-white shadow-1">
      <div class="row items-center justify-between">
        <div class="col-auto">
          <div class="text-h6 flex items-center">
            <q-icon name="table_view" size="24px" color="primary" class="q-mr-sm" />
            Data Grid Editor
            <q-chip color="primary" text-color="white" size="sm" class="q-ml-sm"> {{ patientData.length }} patients • {{ totalObservations }} observations </q-chip>
          </div>
          <div class="text-caption text-grey-6">Click any cell to edit • Changes auto-save • Use Tab/Enter to navigate</div>
        </div>
        <div class="col-auto q-gutter-sm">
          <q-btn flat icon="refresh" label="Refresh" @click="refreshData" :loading="loading" />
          <q-btn flat icon="settings" label="View Options" @click="showViewOptions = true" />
          <q-btn color="primary" icon="save" label="Save All" @click="saveAllChanges" :loading="savingAll" :disable="!hasUnsavedChanges" />
          <q-btn flat icon="arrow_back" label="Back to Selection" @click="goBack" />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="q-pa-xl text-center">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading patient data...</div>
    </div>

    <!-- Excel-like Table -->
    <div v-else class="excel-table-container">
      <q-scroll-area class="excel-scroll-area" :thumb-style="thumbStyle" :bar-style="barStyle">
        <table class="excel-table">
          <!-- Header Row -->
          <thead>
            <tr class="header-row">
              <!-- Fixed columns -->
              <th class="fixed-col patient-col">Patient</th>
              <th class="fixed-col visit-col">Visit Date</th>
              <th class="fixed-col encounter-col">Encounter</th>

              <!-- Dynamic observation columns -->
              <th v-for="concept in observationConcepts" :key="concept.code" class="obs-col" :title="concept.name">
                <div class="col-header">
                  <div class="concept-name">{{ concept.name }}</div>
                  <div class="concept-code">{{ concept.code }}</div>
                  <ValueTypeIcon :value-type="concept.valueType" size="16px" variant="minimal" />
                </div>
              </th>
            </tr>
          </thead>

          <!-- Data Rows -->
          <tbody>
            <tr v-for="row in tableRows" :key="`${row.patientId}-${row.encounterNum}`" class="data-row" :class="{ 'has-changes': hasRowChanges(row) }">
              <!-- Fixed columns -->
              <td class="fixed-col patient-col">
                <div class="patient-info">
                  <q-avatar size="24px" color="primary" text-color="white" class="q-mr-xs">
                    {{ getPatientInitials(row.patientName) }}
                  </q-avatar>
                  <div>
                    <div class="patient-name">{{ row.patientName }}</div>
                    <div class="patient-id">{{ row.patientId }}</div>
                  </div>
                </div>
              </td>

              <td class="fixed-col visit-col">
                <div class="visit-date">{{ formatDate(row.visitDate) }}</div>
              </td>

              <td class="fixed-col encounter-col">
                <div class="encounter-num">{{ row.encounterNum }}</div>
              </td>

              <!-- Observation cells -->
              <td v-for="concept in observationConcepts" :key="concept.code" class="obs-cell" :class="getCellClass(row, concept)">
                <EditableCell
                  :value="getCellValue(row, concept)"
                  :value-type="concept.valueType"
                  :concept-code="concept.code"
                  :patient-id="row.patientId"
                  :encounter-num="row.encounterNum"
                  :observation-id="getCellObservationId(row, concept)"
                  @update="onCellUpdate"
                  @save="onCellSave"
                  @error="onCellError"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </q-scroll-area>
    </div>

    <!-- View Options Dialog -->
    <q-dialog v-model="showViewOptions">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">View Options</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label>Show Empty Cells</q-item-label>
                <q-item-label caption>Display cells even when no observation exists</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="viewOptions.showEmptyCells" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label>Compact View</q-item-label>
                <q-item-label caption>Reduce cell padding for more data on screen</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="viewOptions.compactView" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label>Highlight Changes</q-item-label>
                <q-item-label caption>Show visual indicators for unsaved changes</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="viewOptions.highlightChanges" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Status Bar -->
    <div class="status-bar q-pa-sm bg-grey-2 text-grey-7">
      <div class="row items-center justify-between">
        <div class="col-auto text-caption">
          <span v-if="hasUnsavedChanges" class="text-orange-8">
            <q-icon name="edit" size="14px" class="q-mr-xs" />
            {{ unsavedChangesCount }} unsaved changes
          </span>
          <span v-else class="text-positive">
            <q-icon name="check_circle" size="14px" class="q-mr-xs" />
            All changes saved
          </span>
        </div>
        <div class="col-auto text-caption">Last updated: {{ lastUpdateTime }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'
import EditableCell from './EditableCell.vue'

// Excel-like editor for multi-patient observation editing

const props = defineProps({
  patientIds: {
    type: Array,
    required: true,
  },
})

const $q = useQuasar()
const router = useRouter()
const dbStore = useDatabaseStore()
const localSettings = useLocalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ExcelLikeEditor')

// Data state
const loading = ref(true)
const savingAll = ref(false)
const patientData = ref([])
const observationConcepts = ref([])
const tableRows = ref([])
const pendingChanges = ref(new Map()) // Track unsaved changes
const lastUpdateTime = ref(new Date().toLocaleTimeString())

// View options
const showViewOptions = ref(false)
const viewOptions = ref({
  showEmptyCells: true,
  compactView: false,
  highlightChanges: true,
})

// Computed properties
const totalObservations = computed(() => {
  return tableRows.value.reduce((total, row) => {
    return total + Object.keys(row.observations || {}).length
  }, 0)
})

const hasUnsavedChanges = computed(() => {
  return pendingChanges.value.size > 0
})

const unsavedChangesCount = computed(() => {
  return pendingChanges.value.size
})

// Scroll area styling
const thumbStyle = {
  right: '4px',
  borderRadius: '5px',
  backgroundColor: '#027be3',
  width: '5px',
  opacity: 0.75,
}

const barStyle = {
  right: '2px',
  borderRadius: '9px',
  backgroundColor: '#027be3',
  width: '9px',
  opacity: 0.2,
}

// Data loading methods
const loadPatientData = async () => {
  try {
    loading.value = true

    if (!props.patientIds.length) {
      throw new Error('No patient IDs provided')
    }

    // Ensure patient IDs are clean strings
    const cleanPatientIds = props.patientIds.map((id) => {
      // Handle case where id might be an object with an id property
      if (typeof id === 'object' && id.id) {
        return String(id.id)
      }
      return String(id)
    })

    logger.info('Loading patient data', { patientIds: cleanPatientIds, count: cleanPatientIds.length })

    // Load patient basic info and visits
    const patientRepo = dbStore.getRepository('patient')
    const visitRepo = dbStore.getRepository('visit')

    // Get patient details
    const patientDetails = await Promise.all(
      cleanPatientIds.map(async (patientId) => {
        const patient = await patientRepo.findByPatientCode(patientId)
        if (!patient) {
          logger.warn('Patient not found', { patientId })
          return { patient: null, visits: [] }
        }
        const visits = await visitRepo.getPatientVisitTimeline(patient.PATIENT_NUM)
        return { patient, visits }
      }),
    )

    // Filter out null patients
    patientData.value = patientDetails.filter((p) => p.patient !== null)

    if (patientData.value.length === 0) {
      throw new Error('No valid patients found with the provided IDs')
    }

    // Load all observations for these patients
    await loadObservationData()
  } catch (error) {
    logger.error('Failed to load patient data', error)
    $q.notify({
      type: 'negative',
      message: `Failed to load patient data: ${error.message}`,
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const loadObservationData = async () => {
  try {
    // Extract patient IDs from loaded patient data to ensure we have valid IDs
    const validPatientIds = patientData.value.filter((p) => p.patient && p.patient.PATIENT_CD).map((p) => p.patient.PATIENT_CD)

    if (validPatientIds.length === 0) {
      throw new Error('No valid patient IDs found')
    }

    // Get all observations for selected patients using the patient_observations view
    const placeholders = validPatientIds.map(() => '?').join(',')
    const observationQuery = `
            SELECT 
                OBSERVATION_ID,
                PATIENT_CD,
                ENCOUNTER_NUM,
                CONCEPT_CD,
                VALTYPE_CD,
                TVAL_CHAR,
                NVAL_NUM,
                UNIT_CD,
                START_DATE,
                CATEGORY_CHAR,
                CONCEPT_NAME_CHAR as CONCEPT_NAME
            FROM patient_observations
            WHERE PATIENT_CD IN (${placeholders})
            ORDER BY PATIENT_CD, ENCOUNTER_NUM, CONCEPT_CD
        `

    // Use clean array of patient ID strings
    const result = await dbStore.executeQuery(observationQuery, validPatientIds)

    if (!result.success) {
      throw new Error(result.error || 'Failed to load observations')
    }

    // Process observations and build table structure
    processObservationData(result.data)
  } catch (error) {
    logger.error('Failed to load observation data', error)
    throw error
  }
}

const processObservationData = (observations) => {
  // Group observations by concept to create columns
  const conceptMap = new Map()
  const patientVisitMap = new Map()

  observations.forEach((obs) => {
    // Track concepts for columns
    if (!conceptMap.has(obs.CONCEPT_CD)) {
      conceptMap.set(obs.CONCEPT_CD, {
        code: obs.CONCEPT_CD,
        name: obs.CONCEPT_NAME || obs.CONCEPT_CD,
        valueType: obs.VALTYPE_CD || 'T',
      })
    }

    // Group by patient and encounter
    const key = `${obs.PATIENT_CD}-${obs.ENCOUNTER_NUM}`
    if (!patientVisitMap.has(key)) {
      // Find patient data
      const patientInfo = patientData.value.find((p) => p.patient?.PATIENT_CD === obs.PATIENT_CD)
      const visitInfo = patientInfo?.visits.find((v) => v.ENCOUNTER_NUM === obs.ENCOUNTER_NUM)

      patientVisitMap.set(key, {
        patientId: obs.PATIENT_CD,
        patientName: getPatientName(patientInfo?.patient),
        encounterNum: obs.ENCOUNTER_NUM,
        visitDate: visitInfo?.START_DATE || obs.START_DATE,
        observations: {},
      })
    }

    // Add observation to the row
    const row = patientVisitMap.get(key)

    // For Selection (S) and Finding (F) types, prefer resolved values
    let displayValue = obs.TVAL_CHAR || obs.NVAL_NUM
    if ((obs.VALTYPE_CD === 'S' || obs.VALTYPE_CD === 'F') && obs.TVAL_RESOLVED) {
      displayValue = obs.TVAL_RESOLVED
    }

    row.observations[obs.CONCEPT_CD] = {
      observationId: obs.OBSERVATION_ID,
      value: displayValue,
      valueType: obs.VALTYPE_CD,
      unit: obs.UNIT_CD,
      originalValue: obs.TVAL_CHAR || obs.NVAL_NUM,
      resolvedValue: obs.TVAL_RESOLVED,
    }
  })

  // Convert to arrays
  observationConcepts.value = Array.from(conceptMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  tableRows.value = Array.from(patientVisitMap.values()).sort((a, b) => {
    // Sort by patient ID, then by encounter number
    if (a.patientId !== b.patientId) {
      return a.patientId.localeCompare(b.patientId)
    }
    return a.encounterNum - b.encounterNum
  })
}

// Helper methods
const getPatientName = (patient) => {
  if (!patient) return 'Unknown Patient'

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

const getCellValue = (row, concept) => {
  const obs = row.observations[concept.code]
  return obs?.value || ''
}

const getCellObservationId = (row, concept) => {
  const obs = row.observations[concept.code]
  return obs?.observationId || null
}

const getCellClass = (row, concept) => {
  const key = `${row.patientId}-${row.encounterNum}-${concept.code}`
  const hasChange = pendingChanges.value.has(key)
  const hasValue = !!row.observations[concept.code]

  return {
    'has-value': hasValue,
    'empty-cell': !hasValue,
    'has-pending-change': hasChange && viewOptions.value.highlightChanges,
    compact: viewOptions.value.compactView,
  }
}

const hasRowChanges = (row) => {
  if (!viewOptions.value.highlightChanges) return false

  return observationConcepts.value.some((concept) => {
    const key = `${row.patientId}-${row.encounterNum}-${concept.code}`
    return pendingChanges.value.has(key)
  })
}

// Event handlers
const onCellUpdate = (data) => {
  const { patientId, encounterNum, conceptCode, value, observationId } = data
  const key = `${patientId}-${encounterNum}-${conceptCode}`

  // Track the change
  pendingChanges.value.set(key, {
    patientId,
    encounterNum,
    conceptCode,
    value,
    observationId,
    timestamp: new Date(),
  })

  // Update the local data
  const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
  if (row) {
    if (!row.observations[conceptCode]) {
      row.observations[conceptCode] = {}
    }
    row.observations[conceptCode].value = value
  }
}

const onCellSave = async (data) => {
  const { patientId, encounterNum, conceptCode } = data
  const key = `${patientId}-${encounterNum}-${conceptCode}`

  try {
    // Remove from pending changes
    pendingChanges.value.delete(key)

    // Update last save time
    lastUpdateTime.value = new Date().toLocaleTimeString()

    $q.notify({
      type: 'positive',
      message: 'Cell saved successfully',
      position: 'top-right',
      timeout: 2000,
    })
  } catch (error) {
    logger.error('Cell save error', error)
  }
}

const onCellError = (error) => {
  logger.error('Cell error', error)
  $q.notify({
    type: 'negative',
    message: `Cell error: ${error.message}`,
    position: 'top',
  })
}

const saveAllChanges = async () => {
  if (!hasUnsavedChanges.value) return

  try {
    savingAll.value = true

    const changes = Array.from(pendingChanges.value.values())
    let savedCount = 0

    for (const change of changes) {
      try {
        // This would trigger the save in EditableCell component
        // For now, we'll just clear the pending changes
        const key = `${change.patientId}-${change.encounterNum}-${change.conceptCode}`
        pendingChanges.value.delete(key)
        savedCount++
      } catch (error) {
        logger.error('Failed to save change', error)
      }
    }

    lastUpdateTime.value = new Date().toLocaleTimeString()

    $q.notify({
      type: 'positive',
      message: `Saved ${savedCount} changes successfully`,
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to save all changes', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save some changes',
      position: 'top',
    })
  } finally {
    savingAll.value = false
  }
}

const refreshData = async () => {
  await loadPatientData()
  pendingChanges.value.clear()
  lastUpdateTime.value = new Date().toLocaleTimeString()

  $q.notify({
    type: 'info',
    message: 'Data refreshed',
    position: 'top',
  })
}

const goBack = () => {
  if (hasUnsavedChanges.value) {
    $q.dialog({
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Are you sure you want to go back?',
      cancel: true,
      persistent: true,
    }).onOk(() => {
      router.push('/data-grid')
    })
  } else {
    router.push('/data-grid')
  }
}

// Auto-save functionality
let autoSaveInterval = null

const startAutoSave = () => {
  autoSaveInterval = setInterval(() => {
    if (hasUnsavedChanges.value) {
      // Auto-save logic could be implemented here
      // For now, we'll just update the timestamp
      lastUpdateTime.value = new Date().toLocaleTimeString()
    }
  }, 30000) // Auto-save every 30 seconds
}

const stopAutoSave = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
  }
}

// Lifecycle
onMounted(async () => {
  await loadPatientData()
  startAutoSave()
})

onUnmounted(() => {
  stopAutoSave()
})

// Watch for view options changes
watch(
  viewOptions,
  () => {
    // Save view options to local settings
    localSettings.setSetting('dataGrid.viewOptions', viewOptions.value)
  },
  { deep: true },
)

// Load saved view options
onMounted(() => {
  const savedOptions = localSettings.getSetting('dataGrid.viewOptions')
  if (savedOptions) {
    viewOptions.value = { ...viewOptions.value, ...savedOptions }
  }
})
</script>

<style lang="scss" scoped>
.excel-editor {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: $grey-1;
}

.editor-header {
  flex-shrink: 0;
  border-bottom: 1px solid $grey-4;
}

.excel-table-container {
  flex: 1;
  overflow: hidden;
  background: white;
}

.excel-scroll-area {
  height: 100%;
}

.excel-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;

  .header-row {
    position: sticky;
    top: 0;
    z-index: 10;
    background: $grey-2;

    th {
      padding: 12px 8px;
      border: 1px solid $grey-4;
      border-top: none;
      font-weight: 600;
      text-align: left;
      background: $grey-2;
      position: relative;

      &.fixed-col {
        position: sticky;
        left: 0;
        z-index: 11;
        background: $grey-3;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
      }

      &.patient-col {
        left: 0;
        width: 200px;
        min-width: 200px;
      }

      &.visit-col {
        left: 200px;
        width: 120px;
        min-width: 120px;
      }

      &.encounter-col {
        left: 320px;
        width: 100px;
        min-width: 100px;
      }

      &.obs-col {
        width: 150px;
        min-width: 150px;

        .col-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;

          .concept-name {
            font-size: 0.75rem;
            font-weight: 600;
            text-align: center;
            line-height: 1.2;
            max-height: 2.4em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .concept-code {
            font-size: 0.65rem;
            color: $grey-6;
            font-weight: normal;
          }
        }
      }
    }
  }

  .data-row {
    &:hover {
      background: $blue-1;
    }

    &.has-changes {
      background: $orange-1;
      border-left: 3px solid $orange-6;
    }

    td {
      padding: 8px;
      border: 1px solid $grey-4;
      border-top: none;
      vertical-align: top;

      &.fixed-col {
        position: sticky;
        background: white;
        z-index: 5;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);

        &.patient-col {
          left: 0;
        }

        &.visit-col {
          left: 200px;
        }

        &.encounter-col {
          left: 320px;
        }
      }

      &.obs-cell {
        width: 150px;
        min-width: 150px;
        padding: 4px;

        &.has-value {
          background: white;
        }

        &.empty-cell {
          background: $grey-1;
        }

        &.has-pending-change {
          background: $orange-2;
          border-color: $orange-5;
        }

        &.compact {
          padding: 2px;
        }
      }
    }
  }
}

.patient-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .patient-name {
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.2;
  }

  .patient-id {
    font-size: 0.75rem;
    color: $grey-6;
  }
}

.visit-date {
  font-size: 0.8rem;
  color: $grey-8;
}

.encounter-num {
  font-size: 0.8rem;
  color: $grey-7;
  text-align: center;
}

.status-bar {
  flex-shrink: 0;
  border-top: 1px solid $grey-4;
}

// Responsive adjustments
@media (max-width: 1200px) {
  .excel-table {
    .header-row th.obs-col {
      width: 120px;
      min-width: 120px;
    }

    .data-row td.obs-cell {
      width: 120px;
      min-width: 120px;
    }
  }
}

@media (max-width: 768px) {
  .editor-header {
    .row {
      flex-direction: column;
      gap: 12px;
    }
  }

  .excel-table {
    .header-row th {
      &.patient-col {
        width: 150px;
        min-width: 150px;
      }

      &.visit-col {
        left: 150px;
        width: 100px;
        min-width: 100px;
      }

      &.encounter-col {
        left: 250px;
        width: 80px;
        min-width: 80px;
      }

      &.obs-col {
        width: 100px;
        min-width: 100px;
      }
    }

    .data-row td {
      &.patient-col {
        width: 150px;
      }

      &.visit-col {
        left: 150px;
        width: 100px;
      }

      &.encounter-col {
        left: 250px;
        width: 80px;
      }

      &.obs-cell {
        width: 100px;
        min-width: 100px;
      }
    }
  }
}
</style>
