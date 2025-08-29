<template>
  <div class="grid-footer">
    <div class="footer-container">
      <!-- Status Section -->
      <div class="footer-section status-section">
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

      <!-- Vertical Separator -->
      <div class="footer-separator"></div>

      <!-- Statistics Section -->
      <div class="footer-section stats-section" v-if="statistics">
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

        <!-- Vertical Separator -->
        <div class="stat-separator"></div>

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
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  margin: 0;
  padding: 0;
}

.footer-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 50px;
}

// Status Section (Left)
.footer-section.status-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 0 0 auto;

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

// Main Vertical Separator
.footer-separator {
  width: 1px;
  height: 32px;
  background: #e0e0e0;
  margin: 0 16px;
}

// Statistics Section (Right)
.footer-section.stats-section {
  background: #f0f8ff;
  border-radius: 8px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 0 0 auto;

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

  // Mini separator between stats groups
  .stat-separator {
    width: 1px;
    height: 20px;
    background: #d0d0d0;
    margin: 0 8px;
  }
}

// Responsive adjustments
@media (max-width: 1024px) {
  .footer-container {
    padding: 10px 16px;
    gap: 12px;
  }

  .footer-section.stats-section {
    gap: 16px;
    padding: 6px 12px;
  }

  .footer-section.status-section {
    gap: 12px;
    padding: 6px 10px;
  }
}

@media (max-width: 768px) {
  .footer-container {
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
  }

  .footer-separator {
    width: 80%;
    height: 1px;
    margin: 4px 0;
  }

  .footer-section.status-section,
  .footer-section.stats-section {
    justify-content: center;
    width: 100%;
  }

  .footer-section.stats-section {
    flex-wrap: wrap;
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .footer-section.stats-section .stat-item .stat-label {
    display: none; // Hide labels on very small screens
  }

  .footer-section.stats-section {
    gap: 8px;
  }
}
</style>
