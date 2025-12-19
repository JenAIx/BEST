<template>
  <div v-if="categorizedObservations.length > 0" class="observations-section">
    <div v-for="category in categorizedObservations" :key="category.name" class="category-section q-mb-xl">
      <!-- Category Header -->
      <div class="category-header q-mb-md">
        <h6 class="text-h6 text-primary q-my-none">
          <q-icon :name="getCategoryIcon(category.name)" class="q-mr-sm" />
          {{ category.name }}
          <span class="text-grey-6 text-body2 q-ml-sm">({{ category.observations.length }} observations)</span>
        </h6>
      </div>

      <!-- Category Table -->
      <q-markup-table separator="horizontal" flat bordered class="category-table">
        <thead>
          <tr>
            <th class="text-center type-col">Type</th>
            <th class="text-left concept-col">Concept</th>
            <th class="text-left value-col">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="obs in category.observations" :key="obs.observationId" class="observation-row">
            <td class="text-center">
              <q-badge :color="getValueTypeColor(obs.valueType)" :label="obs.valueType" class="value-type-badge" />
            </td>
            <td class="text-left concept-name">
              {{ obs.conceptName }}
            </td>
            <td class="text-left observation-value">
              <!-- Questionnaire Values -->
              <div v-if="obs.valueType === 'Q'" class="questionnaire-value">
                <q-icon name="quiz" size="16px" color="deep-purple" class="q-mr-xs" />
                <span class="questionnaire-name">{{ obs.displayValue || 'Questionnaire' }}</span>
                <q-btn flat round dense icon="visibility" size="xs" color="deep-purple" @click="$emit('preview-questionnaire', obs)" class="action-btn q-ml-sm">
                  <q-tooltip>View Questionnaire Results</q-tooltip>
                </q-btn>
              </div>

              <!-- Regular Values -->
              <div v-else-if="obs.valueType !== 'R' && obs.valueType !== 'Q'" class="value-display">
                <span class="value-text">{{ obs.displayValue || 'No value' }}</span>
                <span v-if="obs.unit" class="value-unit text-grey-5 q-ml-xs">{{ obs.unit }}</span>
              </div>

              <!-- File Values -->
              <div v-else-if="obs.valueType === 'R' && obs.fileInfo" class="file-value">
                <q-icon :name="getFileIcon(obs.fileInfo.filename)" :color="getFileColor(obs.fileInfo.filename)" size="16px" class="q-mr-xs" />
                <span class="file-name">{{ obs.fileInfo.filename }}</span>
                <span class="file-size text-caption text-grey-6 q-ml-xs"> ({{ formatFileSize(obs.fileInfo.size) }}) </span>
                <q-btn flat round dense icon="visibility" size="xs" color="primary" @click="$emit('preview-file', obs)" class="action-btn q-ml-sm">
                  <q-tooltip>Preview File</q-tooltip>
                </q-btn>
              </div>

              <!-- No file state -->
              <span v-else-if="obs.valueType === 'R'" class="text-grey-6 text-italic"> No file attached </span>
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </div>
  </div>

  <!-- No observations state -->
  <div v-else class="no-observations">
    <q-icon name="assignment" size="48px" color="grey-4" />
    <div class="text-h6 text-grey-6 q-mt-sm">No observations recorded</div>
    <div class="text-body2 text-grey-5">This visit has no recorded observations yet.</div>
  </div>
</template>

<script setup>
import { getValueTypeColor, getCategoryIcon, getFileIcon, getFileColor, formatFileSize } from 'src/shared/utils/medical-utils.js'

defineProps({
  categorizedObservations: {
    type: Array,
    required: true,
  },
})

defineEmits(['preview-questionnaire', 'preview-file'])
</script>

<style lang="scss" scoped>
.category-section {
  page-break-inside: avoid;

  .category-header {
    border-bottom: 1px solid $grey-4;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
}

.category-table {
  font-size: 0.9rem;

  // Column widths for better layout
  .type-col {
    width: 15%;
    min-width: 100px;
  }

  .concept-col {
    width: 40%;
    min-width: 200px;
  }

  .value-col {
    width: 45%;
    min-width: 200px;
  }

  thead th {
    background: $grey-2;
    font-weight: 600;
    color: $grey-8;
    padding: 12px 8px;
    border-bottom: 2px solid $grey-4;
  }

  tbody td {
    padding: 10px 8px;
    vertical-align: top;
    border-bottom: 1px solid $grey-3;
  }

  .observation-row {
    &:hover {
      background: $blue-1;
    }

    &:nth-child(even) {
      background: $grey-1;

      &:hover {
        background: $blue-1;
      }
    }
  }

  .concept-name {
    font-weight: 500;
    color: $grey-8;
    line-height: 1.3;
  }

  .value-type-badge {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .observation-value {
    .value-display {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .value-text {
      font-weight: 500;
      color: $grey-9;
      word-break: break-word;
    }

    .value-unit {
      font-size: 0.85rem;
      font-weight: 400;
      font-style: italic;
    }

    .questionnaire-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      .questionnaire-name {
        font-weight: 500;
        color: $deep-purple-8;
      }
    }

    .file-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      .file-name {
        font-weight: 500;
        color: $grey-8;
      }

      .file-size {
        font-size: 0.8rem;
      }
    }
  }

  .action-btn {
    min-width: auto;
  }
}

.no-observations {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background: $grey-1;
  border-radius: 8px;
  border: 2px dashed $grey-3;
}

// Print styles for PDF export
@media print {
  .category-table {
    border-collapse: collapse !important;

    thead th,
    tbody td {
      border: 1px solid #000 !important;
      padding: 8px !important;
    }

    thead th {
      background: #f5f5f5 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .observation-row:nth-child(even) {
      background: #fafafa !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }

  .category-section {
    page-break-inside: avoid;
    margin-bottom: 2rem !important;
  }

  .category-header {
    page-break-after: avoid;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .category-table {
    font-size: 0.8rem;

    .type-col {
      min-width: 80px;
    }

    .concept-col {
      min-width: 150px;
    }

    .value-col {
      min-width: 120px;
    }

    thead th,
    tbody td {
      padding: 8px 4px;
    }
  }
}
</style>

