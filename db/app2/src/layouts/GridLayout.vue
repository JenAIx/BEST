<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Custom Header for Data Grid -->
    <q-header elevated class="bg-white text-dark">
      <q-toolbar class="q-py-sm">
        <!-- Data Grid Editor Title and Info -->
        <div class="header-content">
          <div class="text-h6 flex items-center">
            <q-icon name="table_view" size="24px" color="primary" class="q-mr-sm" />
            Data Grid Editor
            <q-chip color="primary" text-color="white" size="sm" class="q-ml-sm" v-if="gridInfo"> {{ gridInfo.patientCount }} patients • {{ gridInfo.observationCount }} observations </q-chip>
            <div class="text-caption text-grey-6 q-ml-sm">Click any cell to edit • Changes auto-save • Use Tab/Enter to navigate</div>
          </div>
        </div>

        <!-- Back to Selection Button -->
        <q-btn flat icon="arrow_back" label="Back to Selection" @click="exitDataGrid" class="q-ml-auto">
          <q-tooltip>Back to Patient Selection</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- Page Container -->
    <q-page-container>
      <!-- Router View -->
      <router-view />
    </q-page-container>

    <!-- Footer Container - This will hold the GridFooter -->
    <q-footer elevated class="bg-white">
      <GridFooter />
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useDataGridStore } from 'src/stores/data-grid-store'
import GridFooter from 'src/components/datagrid/GridFooter.vue'

const $q = useQuasar()
const router = useRouter()
const dataGridStore = useDataGridStore()

// Grid information for header
const gridInfo = computed(() => {
  const patientData = dataGridStore?.patientData || []
  const observationConcepts = dataGridStore?.observationConcepts || []

  if (patientData.length === 0 && observationConcepts.length === 0) {
    return null
  }

  return {
    patientCount: patientData.length,
    observationCount: observationConcepts.length,
  }
})

const exitDataGrid = () => {
  // Check if there are unsaved changes
  if (dataGridStore?.hasUnsavedChanges) {
    $q.dialog({
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Are you sure you want to go back?',
      cancel: true,
      persistent: true,
    }).onOk(() => {
      // Keep stored patient selection for reopen capability
      // Don't clear - just navigate back
      router.push('/data-grid')
    })
  } else {
    // No unsaved changes, navigate directly
    // Keep stored patient selection for reopen capability
    // Don't clear - just navigate back

    $q.notify({
      type: 'info',
      message: 'Returned to Patient Selection',
      position: 'top',
    })

    router.push('/data-grid')
  }
}
</script>

<style lang="scss" scoped>
.q-layout {
  min-height: 100vh;
}

.header-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .text-h6 {
    font-weight: 600;
    letter-spacing: -0.025em;
  }
}

// Header styling
.q-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  .q-toolbar {
    padding: 0 16px;
  }
}

// Footer styling
.q-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: white;
  min-height: 70px; // Match GridFooter height
}

// Responsive adjustments
@media (max-width: 768px) {
  .header-content {
    .text-h6 {
      font-size: 1rem;
    }

    .text-caption {
      font-size: 0.7rem;
    }

    .q-chip {
      font-size: 0.7rem;
    }
  }
}
</style>
