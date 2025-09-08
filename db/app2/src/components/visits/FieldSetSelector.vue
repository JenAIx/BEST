<template>
  <div class="field-set-selector">
    <div class="field-set-header">
      <div class="field-set-title-section">
        <h4 class="field-set-title">Observation Categories</h4>
        <q-chip :color="overallStats.color" :text-color="overallStats.textColor" size="md" class="q-ml-md overall-stats-chip" outline>
          <q-icon name="analytics" size="16px" class="q-mr-xs" />
          {{ overallStats.percentage }}% Complete ({{ overallStats.filled }}/{{ overallStats.total }})<span v-if="overallStats.uncategorizedCount > 0" class="uncategorized-note">
            (uncategorized {{ overallStats.uncategorizedCount }})</span
          >

          <q-tooltip class="stats-tooltip">
            <div class="stats-details">
              <div class="stats-header">📊 Overall Visit Progress</div>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">Active Categories:</span>
                  <span class="stat-value">{{ overallStats.activeCategories }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Total Concepts:</span>
                  <span class="stat-value">{{ overallStats.total }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Completed:</span>
                  <span class="stat-value">{{ overallStats.filled }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Progress:</span>
                  <span class="stat-value">{{ overallStats.percentage }}%</span>
                </div>
              </div>
              <q-linear-progress :value="overallStats.percentage / 100" :color="overallStats.color" class="q-mt-md" size="12px" rounded />

              <!-- Category breakdown in same order as chips below -->
              <div v-if="overallStats.categoryDetails.length > 0" class="category-breakdown">
                <div class="breakdown-header">Categories (in display order):</div>
                <div v-for="category in overallStats.categoryDetails" :key="category.id" class="category-item" :class="{ 'uncategorized-item': category.isUncategorized }">
                  <div class="category-info">
                    <q-icon :name="category.icon" size="14px" class="category-icon" :class="{ 'uncategorized-icon': category.isUncategorized }" />
                    <span class="category-name" :class="{ 'uncategorized-name': category.isUncategorized }">
                      {{ category.name }}
                    </span>
                  </div>
                  <div class="category-progress">
                    <span v-if="!category.isUncategorized" class="progress-text"> {{ category.observationCount }}/{{ category.conceptCount }} </span>
                    <span v-else class="progress-text uncategorized-count"> {{ category.observationCount }} observations </span>
                    <span v-if="!category.isUncategorized" class="progress-percent" :class="{ 'progress-complete': category.percentage === 100 }"> ({{ category.percentage }}%) </span>
                    <span v-else class="uncategorized-label"> (needs categorization) </span>
                  </div>
                </div>
              </div>
            </div>
          </q-tooltip>
        </q-chip>
      </div>
      <div class="header-actions">
        <q-btn flat icon="settings" label="Configure" @click="emit('show-config')" size="sm" />
        <q-btn flat round :icon="isCollapsed ? 'expand_more' : 'expand_less'" @click="isCollapsed = !isCollapsed" size="sm" class="collapse-btn">
          <q-tooltip>{{ isCollapsed ? 'Show all categories' : 'Hide categories' }}</q-tooltip>
        </q-btn>
      </div>
    </div>

    <q-slide-transition>
      <div v-show="!isCollapsed" class="field-set-chips expanded">
        <!-- Active Field Sets (Left Side) -->
        <div class="active-field-sets">
          <q-chip
            v-for="fieldSet in activeFieldSetsList"
            :key="`active-${fieldSet.id}`"
            selected
            @click="emit('toggle-field-set', fieldSet.id)"
            color="primary"
            text-color="white"
            clickable
            class="field-set-chip active-chip"
          >
            <q-icon :name="fieldSet.icon" class="q-mr-xs" />
            {{ fieldSet.name }}
            <q-badge v-if="getFieldSetObservationCount(fieldSet.id) > 0" color="white" text-color="primary" class="q-ml-xs">
              {{ getFieldSetObservationCount(fieldSet.id) }}
            </q-badge>
          </q-chip>
        </div>

        <!-- Inactive Field Sets (Right Side - Limited) -->
        <div class="inactive-field-sets">
          <q-chip
            v-for="fieldSet in visibleInactiveFieldSets"
            :key="`inactive-${fieldSet.id}`"
            @click="emit('toggle-field-set', fieldSet.id)"
            :color="getFieldSetObservationCount(fieldSet.id) > 0 ? 'blue-2' : 'grey-4'"
            :text-color="getFieldSetObservationCount(fieldSet.id) > 0 ? 'blue-9' : 'grey-8'"
            clickable
            :class="['field-set-chip', 'inactive-chip', { 'has-observations': getFieldSetObservationCount(fieldSet.id) > 0 }]"
          >
            <q-icon :name="fieldSet.icon" class="q-mr-xs" />
            {{ fieldSet.name }}
            <q-badge v-if="getFieldSetObservationCount(fieldSet.id) > 0" color="primary" text-color="white" class="q-ml-xs">
              {{ getFieldSetObservationCount(fieldSet.id) }}
            </q-badge>
          </q-chip>

          <!-- More Inactive Categories Dropdown -->
          <q-btn v-if="hiddenInactiveFieldSets.length > 0" flat round dense icon="more_horiz" color="grey-6" class="more-categories-btn" size="sm">
            <q-tooltip>
              {{ hiddenInactiveFieldSets.length }} more categories
              <span v-if="hiddenInactiveFieldSets.some((fs) => getFieldSetObservationCount(fs.id) > 0)">
                <br />({{ hiddenInactiveFieldSets.filter((fs) => getFieldSetObservationCount(fs.id) > 0).length }} with observations)
              </span>
            </q-tooltip>
            <q-menu auto-close>
              <q-list style="min-width: 200px">
                <q-item v-for="fieldSet in hiddenInactiveFieldSets" :key="`hidden-${fieldSet.id}`" clickable @click="emit('toggle-field-set', fieldSet.id)" class="hidden-field-set-item">
                  <q-item-section avatar>
                    <q-icon :name="fieldSet.icon" color="grey-6" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ fieldSet.name }}</q-item-label>
                    <q-item-label v-if="getFieldSetObservationCount(fieldSet.id) > 0" caption> {{ getFieldSetObservationCount(fieldSet.id) }} observations </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge v-if="getFieldSetObservationCount(fieldSet.id) > 0" color="primary" rounded>
                      {{ getFieldSetObservationCount(fieldSet.id) }}
                    </q-badge>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </div>
    </q-slide-transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// State for collapse/expand functionality
const isCollapsed = ref(false)

const props = defineProps({
  availableFieldSets: {
    type: Array,
    required: true,
  },
  activeFieldSets: {
    type: Array,
    required: true,
  },
  getFieldSetObservationCount: {
    type: Function,
    required: true,
  },
  overallStats: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggle-field-set', 'show-config'])

// overallStats is passed as a prop

// Field set organization computed properties
const activeFieldSetsList = computed(() => {
  return props.availableFieldSets.filter((fs) => props.activeFieldSets.includes(fs.id))
})

const inactiveFieldSetsList = computed(() => {
  return props.availableFieldSets.filter((fs) => !props.activeFieldSets.includes(fs.id))
})

const visibleInactiveFieldSets = computed(() => {
  // Adaptive count: 5 inactive if 0 active, 4 if 1 active, etc., minimum 2
  const maxInactive = Math.max(2, 5 - props.activeFieldSets.length)

  // Sort inactive categories - prioritize those with observations
  const sortedInactive = [...inactiveFieldSetsList.value].sort((a, b) => {
    const aObsCount = props.getFieldSetObservationCount(a.id)
    const bObsCount = props.getFieldSetObservationCount(b.id)

    // Categories with observations first
    if (aObsCount > 0 && bObsCount === 0) return -1
    if (aObsCount === 0 && bObsCount > 0) return 1

    // If both have observations, sort by count (descending)
    if (aObsCount > 0 && bObsCount > 0) {
      return bObsCount - aObsCount
    }

    // If neither has observations, sort alphabetically
    return a.name.localeCompare(b.name)
  })

  return sortedInactive.slice(0, maxInactive)
})

const hiddenInactiveFieldSets = computed(() => {
  const maxInactive = Math.max(2, 5 - props.activeFieldSets.length)

  // Use the same sorting logic for hidden categories
  const sortedInactive = [...inactiveFieldSetsList.value].sort((a, b) => {
    const aObsCount = props.getFieldSetObservationCount(a.id)
    const bObsCount = props.getFieldSetObservationCount(b.id)

    if (aObsCount > 0 && bObsCount === 0) return -1
    if (aObsCount === 0 && bObsCount > 0) return 1
    if (aObsCount > 0 && bObsCount > 0) return bObsCount - aObsCount
    return a.name.localeCompare(b.name)
  })

  return sortedInactive.slice(maxInactive)
})
</script>

<style lang="scss" scoped>
.field-set-selector {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.field-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.collapse-btn {
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.field-set-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.field-set-title {
  font-size: 1.25rem;
  font-weight: 500;
  color: $grey-8;
  margin: 0;
}

.overall-stats-chip {
  font-weight: 600;
  transition: all 0.3s ease;
  border: 2px solid currentColor !important;
  min-height: 36px;

  .uncategorized-note {
    color: $grey-6;
    font-weight: 500;
    font-size: 0.85em;
    opacity: 0.8;
    margin-left: 4px;
  }

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  // Ensure visibility with strong colors
  &.q-chip--outline {
    background: rgba(255, 255, 255, 0.9) !important;
  }
}

.stats-tooltip {
  .stats-details {
    min-width: 280px;
    padding: 12px;

    .stats-header {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      color: white;
      text-align: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;

      .stat-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;

        .stat-label {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .stat-value {
          color: white;
          font-weight: 600;
        }
      }
    }

    .category-breakdown {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);

      .breakdown-header {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .category-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        font-size: 12px;

        .category-info {
          display: flex;
          align-items: center;
          gap: 6px;

          .category-icon {
            color: rgba(255, 255, 255, 0.8);
            flex-shrink: 0;
          }

          .category-name {
            color: rgba(255, 255, 255, 0.9);
            font-weight: 500;
          }
        }

        .category-progress {
          display: flex;
          gap: 4px;
          align-items: center;

          .progress-text {
            color: rgba(255, 255, 255, 0.8);
            font-family: monospace;
            font-size: 11px;

            &.uncategorized-count {
              color: #ff9800;
              font-weight: 600;
            }
          }

          .progress-percent {
            color: rgba(255, 255, 255, 0.7);
            font-size: 10px;

            &.progress-complete {
              color: #4caf50;
              font-weight: 600;
            }
          }

          .uncategorized-label {
            color: #ff9800;
            font-size: 10px;
            font-style: italic;
          }
        }
      }

      .uncategorized-item {
        background: rgba(255, 152, 0, 0.1);
        border-radius: 4px;
        padding: 2px 4px;

        .uncategorized-icon {
          color: #ff9800 !important;
        }

        .uncategorized-name {
          color: #ff9800 !important;
          font-weight: 600;
        }
      }
    }
  }
}

.field-set-chips {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  min-height: 50px;
}

.active-field-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
  align-items: flex-start;
}

.inactive-field-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

.field-set-chip {
  border-radius: 20px;
  transition: all 0.3s ease;
  min-height: 36px;
  font-weight: 500;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &.active-chip {
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
    border: 2px solid rgba(25, 118, 210, 0.2);

    &:hover {
      box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
    }
  }

  &.inactive-chip {
    opacity: 0.8;

    &:hover {
      opacity: 1;
      transform: translateY(-1px) scale(1.02);
    }

    &.has-observations {
      opacity: 0.95;
      border: 1px solid rgba(25, 118, 210, 0.3) !important;

      &:hover {
        opacity: 1;
        border-color: rgba(25, 118, 210, 0.5) !important;
        box-shadow: 0 3px 10px rgba(25, 118, 210, 0.2);
      }
    }
  }
}

.more-categories-btn {
  margin-left: 0.25rem;
  opacity: 0.7;
  transition: all 0.3s ease;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }
}

.hidden-field-set-item {
  transition: background 0.2s ease;

  &:hover {
    background: rgba(25, 118, 210, 0.1);
  }
}

@media (max-width: 768px) {
  .field-set-chips {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .active-field-sets,
  .inactive-field-sets {
    justify-content: flex-start;
  }

  .inactive-field-sets {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  .header-actions {
    gap: 0.5rem;
  }
}
</style>
