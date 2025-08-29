<template>
  <div class="grid-footer">
    <!-- Status Bar Section -->
    <div class="status-section">
      <div class="status-container">
        <div class="status-item">
          <q-icon :name="hasUnsavedChanges ? 'edit' : 'check_circle'" :color="hasUnsavedChanges ? 'warning' : 'positive'" size="16px" class="q-mr-xs" />
          <span :class="hasUnsavedChanges ? 'text-warning' : 'text-positive'">
            {{ hasUnsavedChanges ? `${unsavedChangesCount} unsaved changes` : 'All changes saved' }}
          </span>
        </div>

        <div class="status-item">
          <q-icon name="access_time" size="16px" color="grey-6" class="q-mr-xs" />
          <span class="text-grey-6">Updated: {{ lastUpdateTime }}</span>
        </div>
      </div>
    </div>

    <!-- Statistics Section -->
    <div class="stats-section" v-if="statistics">
      <div class="stats-container">
        <div class="stat-item">
          <q-icon name="table_chart" size="14px" color="primary" />
          <span class="stat-value">{{ statistics.totalObservations }}</span>
          <span class="stat-label">cols</span>
        </div>

        <div class="stat-item">
          <q-icon name="visibility" size="14px" color="secondary" />
          <span class="stat-value">{{ statistics.visibleObservations }}</span>
          <span class="stat-label">visible</span>
        </div>

        <div class="stat-item" v-if="statistics.hiddenObservations > 0">
          <q-icon name="visibility_off" size="14px" color="grey-6" />
          <span class="stat-value">{{ statistics.hiddenObservations }}</span>
          <span class="stat-label">hidden</span>
        </div>

        <div class="stat-item">
          <q-icon name="check_circle" size="14px" color="positive" />
          <span class="stat-value">{{ statistics.filledCellsPercentage }}%</span>
          <span class="stat-label">filled</span>
        </div>

        <div class="stat-item">
          <q-icon name="analytics" size="14px" color="info" />
          <span class="stat-value">{{ statistics.totalCells }}</span>
          <span class="stat-label">cells</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDataGridStore } from 'src/stores/data-grid-store'

// Use store directly for reactive data
const dataGridStore = useDataGridStore()

// Reactive computed properties from store
const hasUnsavedChanges = computed(() => dataGridStore?.hasUnsavedChanges || false)
const unsavedChangesCount = computed(() => dataGridStore?.unsavedChangesCount || 0)
const lastUpdateTime = computed(() => dataGridStore?.lastUpdateTime || '')
const statistics = computed(() => dataGridStore?.statistics || null)
</script>

<style lang="scss" scoped>
.grid-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

// Status Section
.status-section {
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.status-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  max-width: 1200px;
  margin: 0 auto;

  .status-item {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    gap: 4px;

    span {
      font-weight: 500;
    }
  }
}

// Statistics Section
.stats-section {
  background: white;
}

.stats-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;

    .stat-value {
      font-weight: 600;
      color: #2c3e50;
    }

    .stat-label {
      color: #7f8c8d;
      text-transform: lowercase;
      font-weight: 500;
    }
  }
}

// Responsive adjustments
@media (max-width: 1024px) {
  .stats-container {
    gap: 16px;
    padding: 6px 12px;
  }

  .status-container {
    padding: 6px 12px;
  }
}

@media (max-width: 768px) {
  .grid-footer {
    flex-direction: column;
  }

  .status-container {
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .stats-container {
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .stats-container .stat-item .stat-label {
    display: none; // Hide labels on very small screens
  }

  .stats-container {
    gap: 8px;
  }
}
</style>
