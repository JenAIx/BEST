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
    <ExcelLikeEditor v-else :patient-ids="selectedPatientIds" />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import ExcelLikeEditor from 'src/components/datagrid/ExcelLikeEditor.vue'

// Note: This component does not use visit-observation-store because:
// 1. It handles multiple patients simultaneously (visit-observation-store is single-patient focused)
// 2. It requires a different data structure optimized for grid/spreadsheet editing
// 3. The ExcelLikeEditor component has its own specialized data loading and caching logic

const router = useRouter()
const localSettings = useLocalSettingsStore()

// Computed properties
const selectedPatientIds = computed(() => {
  const ids = localSettings.getDataGridSelectedPatients()
  console.log('Retrieved patient IDs from localStorage:', ids)
  // Ensure they are clean strings
  return ids.map((id) => String(id))
})

const hasPatientSelection = computed(() => {
  return selectedPatientIds.value.length > 0
})

// Methods
const goToSelection = () => {
  router.push('/data-grid')
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
}

.no-selection-state {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $grey-1;
}
</style>
