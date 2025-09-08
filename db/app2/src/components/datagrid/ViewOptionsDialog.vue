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
    <div class="column-management-content non-selectable">
      <!-- Compact Header with Controls -->
      <div class="compact-header">
        <div class="header-left">
          <q-icon name="view_column" size="18px" color="secondary" />
          <span class="text-subtitle1 q-ml-xs">Column Management</span>
        </div>
        <div class="header-center">
          <q-chip :label="`${visibleColumns}/${totalColumns}`" color="secondary" text-color="white" size="sm" dense />
        </div>
        <div class="header-right">
          <q-btn-group flat>
            <q-btn flat dense icon="visibility" size="sm" color="positive" @click="showAllColumns" :disable="visibleColumns === totalColumns">
              <q-tooltip>Show All</q-tooltip>
            </q-btn>
            <q-btn flat dense icon="visibility_off" size="sm" color="negative" @click="hideAllColumns" :disable="visibleColumns === 0">
              <q-tooltip>Hide All</q-tooltip>
            </q-btn>
            <q-btn flat dense icon="shuffle" size="sm" color="primary" @click="resetColumnOrder">
              <q-tooltip>Reset Order</q-tooltip>
            </q-btn>
          </q-btn-group>
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
          :force-fallback="true"
          fallback-class="sortable-fallback"
          @start="onDragStart"
          @end="onDragEnd"
          @move="onDragMove"
        >
          <template #item="{ element: column }">
            <div class="column-item" :class="{ 'column-hidden': !column.visible }">
              <!-- Drag Handle -->
              <q-icon name="drag_indicator" class="drag-handle q-mr-sm" />

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
                  <span class="text-grey-6">{{ column.code }}</span>
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
            <q-btn flat icon="add" label="Add Observation" color="primary" @click="showAddObservationDialog = true" class="add-observation-btn">
              <q-tooltip>Add a new observation column to the grid</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <div class="text-caption text-grey-6">Changes are applied instantly • Drag to reorder columns</div>
      </div>
    </div>
  </AppDialog>

  <!-- Add Observation Dialog -->
  <AddObservationDialog v-model="showAddObservationDialog" :existing-concepts="localColumns" @concept-added="onConceptAdded" />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import AppDialog from 'src/components/shared/AppDialog.vue'
import draggable from 'vuedraggable'
import AddObservationDialog from 'src/components/datagrid/AddObservationDialog.vue'

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

// Composables
const $q = useQuasar()

// Local state
const localOptions = ref({ ...props.viewOptions })
const localColumns = ref([])
const dialogVisible = ref(false)
const showAddObservationDialog = ref(false)

// Computed
const totalColumns = computed(() => localColumns.value.length)
const visibleColumns = computed(() => localColumns.value.filter((col) => col.visible).length)

// Methods
const toggleColumnVisibility = (columnCode) => {
  const columnIndex = localColumns.value.findIndex((col) => col.code === columnCode)
  if (columnIndex !== -1) {
    const newVisibility = !localColumns.value[columnIndex].visible
    localColumns.value[columnIndex].visible = newVisibility

    // If hiding a column, move it to the end of the list
    if (!newVisibility) {
      const columnToMove = localColumns.value.splice(columnIndex, 1)[0]
      localColumns.value.push(columnToMove)
      emitColumnOrder()
    }

    // Emit individual column visibility update for single column changes
    emit('update:columnVisibility', columnCode, newVisibility)
  }
}

const showAllColumns = () => {
  localColumns.value.forEach((col) => {
    col.visible = true
  })
  // Preserve user's drag order - no automatic sorting

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
  // Preserve user's drag order - no automatic sorting

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

    localColumns.value = columns
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

const onDragStart = () => {
  // Add visual feedback when drag starts
  document.body.classList.add('dragging-column')
}

const onDragEnd = () => {
  // Clean up visual feedback when drag ends
  document.body.classList.remove('dragging-column')
  emitColumnOrder()
}

const onDragMove = (evt) => {
  // Enhanced drop zone feedback - allow all moves for now
  const { relatedContext } = evt
  if (relatedContext && relatedContext.element) {
    // You can add custom logic here for move validation
    return true
  }
  return true
}

const emitColumnOrder = () => {
  const columnOrder = localColumns.value.map((col) => col.code)
  emit('update:columnOrder', columnOrder)
}

const onConceptAdded = (concept) => {
  // The concept has already been added to the grid by the dialog
  // We just need to update our local columns list to reflect the change
  const newColumn = {
    code: concept.code,
    name: concept.name,
    valueType: concept.valueType,
    visible: true,
    observationCount: 0,
  }

  localColumns.value.push(newColumn)

  $q.notify({
    type: 'positive',
    message: `Column "${concept.name}" added successfully`,
    position: 'top',
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

      // Preserve original order from props
      localColumns.value = columns
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

.compact-header {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
}

.header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.header-center {
  display: flex;
  justify-content: center;
  flex: 0 0 auto;
}

.header-right {
  display: flex;
  justify-content: flex-end;
  flex: 1;
}

.column-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.column-item {
  border-bottom: 1px solid #f0f0f0;
  padding: 12px 6px;
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

/* Enhanced drag feedback styles */
.column-item.sortable-ghost {
  opacity: 0.3;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border: 2px dashed #2196f3;
  border-radius: 8px;
  transform: scale(0.98);
  position: relative;
}

.column-item.sortable-ghost::before {
  content: 'Drop here';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #1976d2;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  pointer-events: none;
}

.column-item.sortable-chosen {
  cursor: grabbing !important;
  transform: rotate(3deg) scale(1.02);
  box-shadow: 0 8px 25px rgba(33, 150, 243, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 2px solid #2196f3;
  border-radius: 8px;
  z-index: 1000;
  transition: all 0.2s ease;
}

.column-item.sortable-drag {
  background: linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%);
  box-shadow: 0 12px 35px rgba(33, 150, 243, 0.4);
  border: 2px solid #2196f3;
  border-radius: 12px;
  transform: rotate(8deg) scale(1.05);
  z-index: 2000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sortable-fallback {
  background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
  box-shadow: 0 15px 40px rgba(33, 150, 243, 0.5);
  border: 3px solid #1976d2;
  border-radius: 12px;
  transform: rotate(5deg) scale(1.03);
  opacity: 0.9;
}

/* Global drag state styles */
body.dragging-column .column-item:not(.sortable-chosen):not(.sortable-ghost) {
  transition: all 0.2s ease;
  opacity: 0.7;
}

body.dragging-column .column-item:hover:not(.sortable-chosen) {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%);
  border: 2px dashed #2196f3;
  border-radius: 8px;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
}

body.dragging-column .column-item:hover:not(.sortable-chosen)::after {
  content: '';
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #2196f3, #21cbf3);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(33, 150, 243, 0.6);
}

/* Enhanced drag handle styling */
.drag-handle {
  color: #9e9e9e;
  cursor: grab;
  transition: all 0.2s ease;
  padding: 4px;
  border-radius: 4px;
  position: relative;
}

.drag-handle:hover {
  color: #2196f3;
  background: rgba(33, 150, 243, 0.1);
  transform: scale(1.1);
}

.drag-handle:active {
  cursor: grabbing;
  color: #1976d2;
  background: rgba(33, 150, 243, 0.2);
  transform: scale(0.95);
}

body.dragging-column .drag-handle {
  color: #2196f3;
  background: rgba(33, 150, 243, 0.15);
}

/* Pulse animation for drag handle when dragging */
@keyframes drag-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

body.dragging-column .column-item:not(.sortable-chosen) .drag-handle {
  animation: drag-pulse 1.5s ease-in-out infinite;
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

.add-observation-btn {
  border: 2px dashed #1976d2;
  border-radius: 8px;
  padding: 8px 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: #1565c0;
    background: rgba(25, 118, 210, 0.05);
    transform: translateY(-1px);
  }
}
</style>
