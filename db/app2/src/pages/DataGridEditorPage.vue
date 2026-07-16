<template>
  <q-page class="data-grid-editor-page">
    <!-- No Patient Selection State -->
    <div v-if="!hasPatientSelection" class="no-selection-state">
      <div class="text-center q-pa-xl">
        <q-icon name="grid_off" size="64px" color="grey-5" class="q-mb-md" />
        <div class="text-h5 text-grey-7 q-mb-sm">{{ $t('dataGrid.noPatientsSelected') }}</div>
        <div class="text-body2 text-grey-6 q-mb-lg">{{ $t('dataGrid.selectPatientsHint') }}</div>
        <q-btn color="primary" icon="arrow_back" :label="$t('dataGrid.goToPatientSelection')" @click="goToSelection" />
      </div>
    </div>

    <!-- Excel-like Editor -->
    <ExcelLikeEditor v-else :patient-ids="selectedPatientIds" />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useDataGridStore } from 'src/stores/data-grid-store'
import ExcelLikeEditor from 'src/components/datagrid/ExcelLikeEditor.vue'

// Note: This component does not use visit-observation-store because:
// 1. It handles multiple patients simultaneously (visit-observation-store is single-patient focused)
// 2. It requires a different data structure optimized for grid/spreadsheet editing
// 3. The ExcelLikeEditor component has its own specialized data loading and caching logic

const router = useRouter()
const localSettings = useLocalSettingsStore()
const dataGridStore = useDataGridStore()

// Computed properties (using store functions)
const selectedPatientIds = computed(() => {
  const ids = localSettings.getDataGridSelectedPatients()
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

// Lifecycle
onMounted(async () => {
  try {
    // Initialize stores
    await localSettings.initialize()
    await dataGridStore.initialize()

    // One-shot: study audit views set this flag before navigating here so the
    // grid opens with the audit filter already active (computeds are reactive,
    // so setting it before/while data loads is safe).
    if (localSettings.consumePendingAuditFilter()) {
      dataGridStore.auditFilterActive = true
    }
  } catch (error) {
    console.error('Failed to initialize stores', error)
    // Show error but let component render (will show no selection state)
  }
})
</script>

<style lang="scss" scoped>
.data-grid-editor-page {
  height: calc(100vh - 200px);
  overflow: hidden;
}

.no-selection-state {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $grey-1;
}
</style>
