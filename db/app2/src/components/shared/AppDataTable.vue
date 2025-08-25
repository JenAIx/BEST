<template>
  <div class="app-data-table">
    <!-- Table Header Actions -->
    <div v-if="showHeader" class="app-data-table__header q-mb-md">
      <div class="row items-center q-col-gutter-md">
        <div class="col-12 col-md-4">
          <q-input
            v-if="searchable"
            v-model="searchQuery"
            outlined
            dense
            placeholder="Search..."
            debounce="300"
            @update:model-value="onSearch"
          >
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
            <template v-slot:append>
              <q-icon 
                v-if="searchQuery" 
                name="close" 
                @click="searchQuery = ''; onSearch('')" 
                class="cursor-pointer" 
              />
            </template>
          </q-input>
        </div>
        
        <div class="col-12 col-md-8 text-right">
          <slot name="header-actions">
            <q-btn
              v-if="exportable"
              icon="download"
              label="Export"
              color="primary"
              flat
              dense
              class="q-mr-sm"
              @click="onExport"
            />
            <q-btn
              v-if="refreshable"
              icon="refresh"
              label="Refresh"
              color="primary"
              flat
              dense
              @click="onRefresh"
            />
          </slot>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div v-if="showFilters && filters.length > 0" class="app-data-table__filters q-mb-md">
      <q-card flat bordered>
        <q-card-section>
          <div class="row q-col-gutter-sm">
            <div 
              v-for="filter in filters" 
              :key="filter.field"
              :class="`col-12 col-md-${filter.cols || 3}`"
            >
              <component
                :is="getFilterComponent(filter.type)"
                v-model="filterValues[filter.field]"
                :label="filter.label"
                :options="filter.options"
                :multiple="filter.multiple"
                :clearable="filter.clearable !== false"
                outlined
                dense
                @update:model-value="onFilterChange"
              />
            </div>
            <div class="col-12 col-md-auto">
              <q-btn
                label="Clear Filters"
                color="grey-7"
                flat
                dense
                @click="clearFilters"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Data Table -->
    <q-table
      ref="tableRef"
      v-model:pagination="paginationModel"
      v-model:selected="selectedModel"
      :rows="filteredRows"
      :columns="computedColumns"
      :row-key="rowKey"
      :selection="selection"
      :loading="loading"
      :filter="searchQuery"
      :grid="grid"
      :hide-header="hideHeader"
      :hide-bottom="hideBottom"
      :flat="flat"
      :bordered="bordered"
      :square="square"
      :separator="separator"
      :wrap-cells="wrapCells"
      :virtual-scroll="virtualScroll"
      :virtual-scroll-sticky-size-start="48"
      :rows-per-page-options="rowsPerPageOptions"
      class="app-data-table__table"
      @request="onRequest"
    >
      <!-- Custom Column Headers -->
      <template v-slot:header="props">
        <q-tr :props="props">
          <q-th v-if="selection" auto-width>
            <q-checkbox 
              v-model="props.selected" 
              :indeterminate="props.partialSelected"
            />
          </q-th>
          <q-th
            v-for="col in props.cols"
            :key="col.name"
            :props="props"
            :class="getHeaderClass(col)"
          >
            <div class="row items-center no-wrap">
              <div>{{ col.label }}</div>
              <q-icon
                v-if="col.sortable"
                :name="getSortIcon(col)"
                size="16px"
                class="q-ml-xs"
              />
            </div>
          </q-th>
          <q-th v-if="hasActions" auto-width>
            Actions
          </q-th>
        </q-tr>
      </template>

      <!-- Custom Body Cells -->
      <template v-slot:body="props">
        <q-tr :props="props" @click="onRowClick(props.row)">
          <q-td v-if="selection" auto-width>
            <q-checkbox v-model="props.selected" />
          </q-td>
          <q-td
            v-for="col in props.cols"
            :key="col.name"
            :props="props"
            :class="getCellClass(col, props.row)"
          >
            <slot :name="`body-cell-${col.name}`" :props="props" :value="col.value">
              {{ formatCellValue(col, props.row) }}
            </slot>
          </q-td>
          <q-td v-if="hasActions" auto-width>
            <slot name="body-cell-actions" :props="props">
              <q-btn
                icon="more_vert"
                flat
                round
                dense
                size="sm"
              >
                <q-menu>
                  <q-list dense>
                    <slot name="row-actions" :row="props.row">
                      <q-item clickable v-close-popup @click="$emit('edit', props.row)">
                        <q-item-section avatar>
                          <q-icon name="edit" />
                        </q-item-section>
                        <q-item-section>Edit</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="$emit('delete', props.row)">
                        <q-item-section avatar>
                          <q-icon name="delete" color="negative" />
                        </q-item-section>
                        <q-item-section>Delete</q-item-section>
                      </q-item>
                    </slot>
                  </q-list>
                </q-menu>
              </q-btn>
            </slot>
          </q-td>
        </q-tr>
      </template>

      <!-- Loading -->
      <template v-slot:loading>
        <q-inner-loading showing color="primary" />
      </template>

      <!-- No Data -->
      <template v-slot:no-data>
        <div class="full-width row flex-center text-grey-6 q-pa-xl">
          <q-icon name="sentiment_dissatisfied" size="48px" class="q-mr-sm" />
          <span class="text-body1">{{ noDataLabel }}</span>
        </div>
      </template>

      <!-- Bottom Row for Selection Info -->
      <template v-if="selection && selected.length > 0" v-slot:bottom-row>
        <q-tr>
          <q-td colspan="100%" class="text-left">
            <div class="row items-center">
              <div class="col">
                {{ selected.length }} {{ selected.length === 1 ? 'item' : 'items' }} selected
              </div>
              <div class="col-auto">
                <slot name="selection-actions" :selected="selected">
                  <q-btn
                    label="Delete Selected"
                    color="negative"
                    size="sm"
                    flat
                    @click="$emit('delete-selected', selected)"
                  />
                </slot>
              </div>
            </div>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
/**
 * AppDataTable Component
 * 
 * A feature-rich data table component that extends Quasar's q-table
 * with additional functionality like filters, search, export, etc.
 * 
 * Features:
 * - Built-in search functionality
 * - Configurable filters
 * - Row selection (single/multiple/none)
 * - Custom cell formatting
 * - Export functionality
 * - Row actions
 * - Responsive design
 * - Virtual scrolling for large datasets
 */

import { ref, computed } from 'vue'
import { exportFile, useQuasar } from 'quasar'

const props = defineProps({
  // Data
  rows: {
    type: Array,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  
  // Selection
  selection: {
    type: String,
    default: 'none',
    validator: (v) => ['single', 'multiple', 'none'].includes(v)
  },
  selected: {
    type: Array,
    default: () => []
  },
  
  // Features
  searchable: {
    type: Boolean,
    default: true
  },
  filterable: {
    type: Boolean,
    default: true
  },
  exportable: {
    type: Boolean,
    default: true
  },
  refreshable: {
    type: Boolean,
    default: true
  },
  
  // Filters configuration
  filters: {
    type: Array,
    default: () => []
  },
  
  // Pagination
  pagination: {
    type: Object,
    default: () => ({
      sortBy: null,
      descending: false,
      page: 1,
      rowsPerPage: 10
    })
  },
  rowsPerPageOptions: {
    type: Array,
    default: () => [5, 10, 20, 50, 100]
  },
  
  // Display options
  showHeader: {
    type: Boolean,
    default: true
  },
  showFilters: {
    type: Boolean,
    default: true
  },
  hideHeader: Boolean,
  hideBottom: Boolean,
  flat: Boolean,
  bordered: {
    type: Boolean,
    default: true
  },
  square: Boolean,
  separator: {
    type: String,
    default: 'horizontal'
  },
  wrapCells: Boolean,
  grid: Boolean,
  virtualScroll: Boolean,
  
  // Other
  loading: Boolean,
  noDataLabel: {
    type: String,
    default: 'No data available'
  },
  hasActions: Boolean,
  clickableRows: Boolean
})

const emit = defineEmits([
  'update:selected',
  'update:pagination',
  'request',
  'search',
  'filter',
  'export',
  'refresh',
  'row-click',
  'edit',
  'delete',
  'delete-selected'
])

const $q = useQuasar()

// Refs
const tableRef = ref()
const searchQuery = ref('')
const filterValues = ref({})

// Models
const selectedModel = computed({
  get: () => props.selected,
  set: (val) => emit('update:selected', val)
})

const paginationModel = computed({
  get: () => props.pagination,
  set: (val) => emit('update:pagination', val)
})

// Computed
const computedColumns = computed(() => {
  return props.columns.map(col => ({
    ...col,
    sortable: col.sortable !== false,
    align: col.align || 'left',
    field: col.field || col.name
  }))
})

const filteredRows = computed(() => {
  let rows = [...props.rows]
  
  // Apply filters
  Object.entries(filterValues.value).forEach(([field, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      const filter = props.filters.find(f => f.field === field)
      if (filter && filter.filterFn) {
        rows = rows.filter(row => filter.filterFn(row, value))
      } else {
        // Default filter logic
        rows = rows.filter(row => {
          const cellValue = row[field]
          if (Array.isArray(value)) {
            return value.includes(cellValue)
          }
          return cellValue === value
        })
      }
    }
  })
  
  return rows
})

// Methods
const getFilterComponent = (type) => {
  const components = {
    select: 'q-select',
    date: 'q-input',
    daterange: 'q-date',
    text: 'q-input',
    number: 'q-input'
  }
  return components[type] || 'q-input'
}

const onSearch = (value) => {
  emit('search', value)
}

const onFilterChange = () => {
  emit('filter', filterValues.value)
}

const clearFilters = () => {
  filterValues.value = {}
  onFilterChange()
}

const onRequest = (props) => {
  emit('request', props)
}

const onRefresh = () => {
  emit('refresh')
}

const onRowClick = (row) => {
  if (props.clickableRows) {
    emit('row-click', row)
  }
}

const onExport = () => {
  const content = [
    computedColumns.value.map(col => col.label).join(','),
    ...filteredRows.value.map(row => 
      computedColumns.value.map(col => {
        const value = row[col.field]
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      }).join(',')
    )
  ].join('\r\n')
  
  const status = exportFile(
    'table-export.csv',
    content,
    'text/csv'
  )
  
  if (status === true) {
    $q.notify({
      type: 'positive',
      message: 'Table exported successfully',
      position: 'top'
    })
  } else {
    $q.notify({
      type: 'negative',
      message: 'Export failed',
      position: 'top'
    })
  }
  
  emit('export')
}

const formatCellValue = (col, row) => {
  const value = col.value !== undefined ? col.value : row[col.field]
  
  if (col.format) {
    return col.format(value, row)
  }
  
  // Default formatting
  if (value === null || value === undefined) {
    return '-'
  }
  
  if (col.type === 'date' && value) {
    return new Date(value).toLocaleDateString()
  }
  
  if (col.type === 'datetime' && value) {
    return new Date(value).toLocaleString()
  }
  
  if (col.type === 'currency' && typeof value === 'number') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }
  
  if (col.type === 'percent' && typeof value === 'number') {
    return `${(value * 100).toFixed(2)}%`
  }
  
  return value
}

const getHeaderClass = (col) => {
  return {
    'cursor-pointer': col.sortable,
    [`text-${col.align}`]: true
  }
}

const getCellClass = (col, row) => {
  const classes = {
    [`text-${col.align}`]: true
  }
  
  if (col.classes) {
    if (typeof col.classes === 'function') {
      classes[col.classes(row)] = true
    } else {
      classes[col.classes] = true
    }
  }
  
  return classes
}

const getSortIcon = (col) => {
  if (paginationModel.value.sortBy !== col.name) {
    return 'unfold_more'
  }
  return paginationModel.value.descending ? 'arrow_downward' : 'arrow_upward'
}
</script>

<style lang="scss" scoped>
.app-data-table {
  &__table {
    // Sticky header
    :deep(thead tr:first-child th) {
      background-color: $grey-1;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    
    // Hover effect
    :deep(tbody tr) {
      transition: background-color 0.2s ease;
      
      &:hover {
        background-color: $grey-1;
      }
    }
    
    // Selected row
    :deep(tbody tr.selected) {
      background-color: rgba($primary, 0.1);
    }
  }
  
  // Clickable rows
  &__table.clickable-rows {
    :deep(tbody tr) {
      cursor: pointer;
    }
  }
}

// Dark mode
.body--dark {
  .app-data-table {
    &__table {
      :deep(thead tr:first-child th) {
        background-color: $dark;
      }
      
      :deep(tbody tr:hover) {
        background-color: rgba(255, 255, 255, 0.05);
      }
    }
  }
}
</style>
