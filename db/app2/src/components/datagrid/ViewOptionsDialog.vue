<template>
  <AppDialog
    v-model="dialogVisible"
    title="Column Management"
    subtitle="Customize your data grid view and manage observation columns"
    size="md"
    :persistent="true"
    :show-actions="false"
    :content-padding="false"
  >
    <div class="column-management-content">
            <div class="panel-header">
              <q-icon name="view_column" size="20px" color="secondary" class="q-mr-sm" />
              <span class="text-h6">Column Management</span>
              <q-chip :label="`${visibleColumns} / ${totalColumns} visible`" color="secondary" text-color="white" size="sm" class="q-ml-md" />
            </div>

            <!-- Column Controls -->
            <div class="column-controls q-pa-md">
              <div class="row items-center q-gutter-sm">
                <q-btn flat icon="visibility" label="Show All" color="positive" @click="showAllColumns" :disable="visibleColumns === totalColumns" />
                <q-btn flat icon="visibility_off" label="Hide All" color="negative" @click="hideAllColumns" :disable="visibleColumns === 0" />
                <q-btn flat icon="shuffle" label="Reset Order" color="primary" @click="resetColumnOrder" />
              </div>
            </div>

            <!-- Column List -->
            <div class="column-list">
              <div v-if="localColumns.length === 0" class="empty-state">
                <q-icon name="view_column" />
                <div class="q-mt-md">
                  <div class="text-h6 q-mb-sm">No columns available</div>
                  <div class="text-body2 text-grey-6 q-mb-md">Add observations to your data grid to see columns here</div>

                </div>
              </div>

              <draggable
                v-else
                v-model="localColumns"
                item-key="code"
                handle=".drag-handle"
                :animation="200"
                ghost-class="sortable-ghost"
                chosen-class="sortable-chosen"
                drag-class="sortable-drag"
                @end="onColumnReorder"
              >
                <template #item="{ element: column }">
                  <div class="column-item" :class="{ 'column-hidden': !column.visible }">
                    <!-- Drag Handle -->
                    <q-icon name="drag_indicator" class="drag-handle text-grey-5 q-mr-sm" style="cursor: grab" />

                    <!-- Move Buttons -->
                    <div class="move-buttons">
                      <q-btn flat dense round icon="vertical_align_top" size="xs" class="move-btn" @click="moveColumnToTop(column.code)" :disable="isFirstColumn(column.code)" />
                      <q-btn flat dense round icon="vertical_align_bottom" size="xs" class="move-btn" @click="moveColumnToBottom(column.code)" :disable="isLastColumn(column.code)" />
                    </div>

                    <!-- Column Info -->
                    <div class="column-info">
                      <div class="column-name">{{ column.name }}</div>
                      <div class="column-meta">
                        <span class="value-type-badge" :class="`value-type-${column.valueType}`">{{ column.valueType }}</span>
                        <span class="text-grey-6">{{ column.observationCount || 0 }} observations</span>
                      </div>
                    </div>

                    <!-- Visibility Toggle -->
                    <q-btn
                      flat
                      dense
                      round
                      :icon="column.visible ? 'visibility' : 'visibility_off'"
                      :class="['visibility-btn', column.visible ? 'visible' : 'hidden']"
                      @click="toggleColumnVisibility(column.code)"
                    />
                  </div>
                </template>
              </draggable>

              <!-- Add New Observation Button -->
              <div v-if="localColumns.length > 0" class="q-pa-md text-center">
                <div class="row justify-center">

                </div>
              </div>
            </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <div class="text-caption text-grey-6">Changes are applied instantly • Drag or use top/bottom buttons to reorder</div>
        
      </div>
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import AppDialog from 'src/components/shared/AppDialog.vue'
import draggable from 'vuedraggable'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  viewOptions: {
    type: Object,
    default: () => ({}),
  },
  observationConcepts: {
    type: Array,
    default: () => [],
  },
  columnVisibility: {
    type: Object,
    default: () => ({}),
    validator: (value) => value !== null && value !== undefined,
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'update:viewOptions', 'update:columnVisibility', 'update:columnOrder'])

// Local state
const localOptions = ref({ ...props.viewOptions })
const localColumns = ref([])
const dialogVisible = ref(false)

// Computed
const totalColumns = computed(() => localColumns.value.length)
const visibleColumns = computed(() => localColumns.value.filter((col) => col.visible).length)

// Methods
const toggleColumnVisibility = (columnCode) => {
  const columnIndex = localColumns.value.findIndex((col) => col.code === columnCode)
  if (columnIndex !== -1) {
    const newVisibility = !localColumns.value[columnIndex].visible
    localColumns.value[columnIndex].visible = newVisibility

    // Re-sort columns to move hidden ones to the end
    localColumns.value = sortColumnsByVisibility(localColumns.value)

    // Emit individual column visibility update for single column changes
    emit('update:columnVisibility', columnCode, newVisibility)
  }
}

const showAllColumns = () => {
  localColumns.value.forEach((col) => {
    col.visible = true
  })
  localColumns.value = sortColumnsByVisibility(localColumns.value)

  const updatedVisibility = {}
  localColumns.value.forEach((col) => {
    updatedVisibility[col.code] = true
  })
  emit('update:columnVisibility', updatedVisibility)
}

const hideAllColumns = () => {
  localColumns.value.forEach((col) => {
    col.visible = false
  })
  localColumns.value = sortColumnsByVisibility(localColumns.value)

  const updatedVisibility = {}
  localColumns.value.forEach((col) => {
    updatedVisibility[col.code] = false
  })
  emit('update:columnVisibility', updatedVisibility)
}

const resetColumnOrder = () => {
  // Reset to original order based on observationConcepts
  if (props.observationConcepts && props.observationConcepts.length > 0) {
    const columns = props.observationConcepts.map((concept) => ({
      code: concept.code,
      name: concept.name,
      valueType: concept.valueType,
      visible: props.columnVisibility && props.columnVisibility[concept.code] !== false,
      observationCount: concept.observationCount || 0,
    }))

    localColumns.value = sortColumnsByVisibility(columns)
    emitColumnOrder()
  }
}

const moveColumnToTop = (columnCode) => {
  const currentIndex = localColumns.value.findIndex((col) => col.code === columnCode)
  if (currentIndex > 0) {
    const columnToMove = localColumns.value.splice(currentIndex, 1)[0]
    localColumns.value.unshift(columnToMove)
    emitColumnOrder()
  }
}

const moveColumnToBottom = (columnCode) => {
  const currentIndex = localColumns.value.findIndex((col) => col.code === columnCode)
  if (currentIndex < localColumns.value.length - 1) {
    const columnToMove = localColumns.value.splice(currentIndex, 1)[0]
    localColumns.value.push(columnToMove)
    emitColumnOrder()
  }
}

const isFirstColumn = (columnCode) => {
  return localColumns.value.findIndex((col) => col.code === columnCode) === 0
}

const isLastColumn = (columnCode) => {
  return localColumns.value.findIndex((col) => col.code === columnCode) === localColumns.value.length - 1
}

const onColumnReorder = () => {
  emitColumnOrder()
}

const emitColumnOrder = () => {
  const columnOrder = localColumns.value.map((col) => col.code)
  emit('update:columnOrder', columnOrder)
}

const sortColumnsByVisibility = (columns) => {
  return [...columns].sort((a, b) => {
    if (a.visible && !b.visible) return -1
    if (!a.visible && b.visible) return 1
    return 0
  })
}

// Watchers
// Removed the watcher that emits full visibility object - individual column changes
// are now handled by emitting individual updates in toggleColumnVisibility
// Batch operations like showAllColumns/hideAllColumns still emit the full object

watch(
  () => props.observationConcepts,
  (newConcepts) => {
    if (newConcepts && newConcepts.length > 0) {
      const columns = newConcepts.map((concept) => ({
        code: concept.code,
        name: concept.name,
        valueType: concept.valueType,
        visible: props.columnVisibility && props.columnVisibility[concept.code] !== false, // Use prop or default to visible
        observationCount: concept.observationCount || 0,
      }))

      // Sort columns: visible first, hidden last
      localColumns.value = sortColumnsByVisibility(columns)
    } else {
      localColumns.value = []
    }
  },
  { immediate: true },
)

// Sync dialog visibility with prop
watch(
  () => props.modelValue,
  (newValue) => {
    dialogVisible.value = newValue
  },
  { immediate: true },
)

watch(dialogVisible, (newValue) => {
  emit('update:modelValue', newValue)
})

// Lifecycle
onMounted(() => {
  // Initialize local options
  localOptions.value = { ...props.viewOptions }
})
</script>

<style scoped>
.column-management-content {
  min-height: 500px;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  display: flex;
  align-items: center;
}

.column-controls {
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.column-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.column-item {
  border-bottom: 1px solid #f0f0f0;
  padding: 12px 16px;
  transition: all 0.2s ease;
  cursor: grab;
  min-height: 60px;
  display: flex;
  align-items: center;
}

.column-item:hover {
  background-color: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.column-item.sortable-ghost {
  opacity: 0.4;
  background: #e3f2fd;
}

.column-item.sortable-chosen {
  cursor: grabbing;
  transform: rotate(2deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.column-item.sortable-drag {
  background: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  transform: rotate(5deg);
}

.column-info {
  flex: 1;
  min-width: 0;
}

.column-name {
  font-weight: 500;
  color: #1976d2;
  margin-bottom: 2px;
}

.column-meta {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-type-badge {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

.value-type-n {
  background: #e8f5e8;
  color: #2e7d32;
}

.value-type-t {
  background: #e3f2fd;
  color: #1565c0;
}

.value-type-d {
  background: #fff3e0;
  color: #ef6c00;
}

.move-buttons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-right: 8px;
}

.move-btn {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  border-radius: 4px;
}

.visibility-btn {
  width: 32px;
  height: 32px;
  min-height: 32px;
  border-radius: 6px;
  margin-left: 8px;
}

.visibility-btn.visible {
  background: #e8f5e8;
  color: #2e7d32;
}

.visibility-btn.hidden {
  background: #ffebee;
  color: #c62828;
}

.dialog-footer {
  padding: 20px 0;
  text-align: center;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.empty-state .q-icon {
  font-size: 64px;
  color: #ccc;
  margin-bottom: 16px;
}
</style>