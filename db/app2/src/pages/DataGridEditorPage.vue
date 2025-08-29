<template>
  <q-page class="data-grid-editor-page">
    <!-- No Patient Selection State -->
    <div v-if="!hasPatientSelection" class="no-selection-state">
      <div class="text-center q-pa-xl">
        <q-icon name="grid_off" size="64px" color="grey-5" class="q-mb-md" />
        <div class="text-h5 text-grey-7 q-mb-sm">No Patients Selected</div>
        <div class="text-body2 text-grey-6 q-mb-lg">Please select patients from the Data Grid selection page to start editing.</div>
        <q-btn color="primary" icon="arrow_back" label="Go to Patient Selection" @click="goToSelection" />
      </div>
    </div>

    <!-- Excel-like Editor -->
    <ExcelLikeEditor v-else :patient-ids="selectedPatientIds" @statistics-update="handleStatisticsUpdate" @status-update="handleStatusUpdate" />

    <!-- Combined Footer -->
    <GridFooter
      v-if="hasPatientSelection"
      :has-unsaved-changes="status.hasUnsavedChanges"
      :unsaved-changes-count="status.unsavedChangesCount"
      :last-update-time="status.lastUpdateTime"
      :statistics="statistics"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import ExcelLikeEditor from 'src/components/datagrid/ExcelLikeEditor.vue'
import GridFooter from 'src/components/datagrid/GridFooter.vue'

// Note: This component does not use visit-observation-store because:
// 1. It handles multiple patients simultaneously (visit-observation-store is single-patient focused)
// 2. It requires a different data structure optimized for grid/spreadsheet editing
// 3. The ExcelLikeEditor component has its own specialized data loading and caching logic

const router = useRouter()
const localSettings = useLocalSettingsStore()

// Statistics state
const statistics = ref(null)

// Status state
const status = ref({
  hasUnsavedChanges: false,
  unsavedChangesCount: 0,
  lastUpdateTime: '',
})

// Computed properties (using store functions)
const selectedPatientIds = computed(() => {
  const ids = localSettings.getDataGridSelectedPatients()
  console.log('Retrieved patient IDs from localStorage:', ids)
  // Ensure they are clean strings
  return ids.map((id) => String(id))
})

const hasPatientSelection = computed(() => {
  return localSettings.hasDataGridSelectedPatients()
})

// Methods
const goToSelection = () => {
  router.push('/data-grid')
}

const handleStatisticsUpdate = (newStatistics) => {
  statistics.value = newStatistics
}

const handleStatusUpdate = (newStatus) => {
  status.value = { ...status.value, ...newStatus }
}

// Lifecycle
onMounted(() => {
  // Initialize local settings
  localSettings.initialize()

  // If no patients selected, redirect to selection page
  if (!hasPatientSelection.value) {
    // Don't redirect immediately, let the user see the message
    // They can click the button to go back
  }
})
</script>

<style lang="scss" scoped>
.data-grid-editor-page {
  height: 100vh;
  overflow: hidden;
  padding-bottom: 70px; // Account for fixed footer
}

.no-selection-state {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $grey-1;
}
</style>
