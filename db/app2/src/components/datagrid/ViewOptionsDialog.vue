<template>
  <q-dialog v-model="dialogVisible" persistent maximized>
    <q-card class="view-options-dialog">
      <!-- Header -->
      <q-card-section class="dialog-header">
        <div class="row items-center justify-between">
          <div class="col">
            <div class="text-h5 text-weight-bold flex items-center">
              <q-icon name="settings" size="28px" color="primary" class="q-mr-sm" />
              View Options & Column Management
            </div>
            <div class="text-body2 text-grey-6 q-mt-xs">Customize your data grid view and manage observation columns</div>
          </div>
          <div class="col-auto">
            <q-btn flat round icon="close" color="grey-7" @click="dialogVisible = false" />
          </div>
        </div>
      </q-card-section>

      <!-- Content -->
      <q-card-section class="dialog-content q-pa-none" style="height: calc(100% - 180px)">
        <div class="view-options-container">
          <!-- Left Panel: General Options -->
          <div class="options-panel">
            <div class="panel-header">
              <q-icon name="tune" size="20px" color="primary" class="q-mr-sm" />
              <span class="text-h6">General Options</span>
            </div>

            <q-list class="options-list">
              <q-item>
                <q-item-section avatar>
                  <q-icon name="visibility" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-medium">Show Empty Cells</q-item-label>
                  <q-item-label caption>Display cells even when no observation exists</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="localOptions.showEmptyCells" @update:model-value="updateOption('showEmptyCells', $event)" color="primary" />
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="compress" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-medium">Compact View</q-item-label>
                  <q-item-label caption>Reduce cell padding for more data on screen</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="localOptions.compactView" @update:model-value="updateOption('compactView', $event)" color="primary" />
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="edit" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-medium">Highlight Changes</q-item-label>
                  <q-item-label caption>Show visual indicators for unsaved changes</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="localOptions.highlightChanges" @update:model-value="updateOption('highlightChanges', $event)" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Right Panel: Column Management -->
          <div class="columns-panel">
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
                <q-btn flat icon="refresh" label="Reset Order" color="grey-7" @click="resetColumnOrder" />
              </div>
            </div>

            <!-- Column List -->
            <div class="columns-list">
              <div class="columns-list-header">
                <div class="text-subtitle1 text-weight-medium">Observation Columns</div>
                <div class="text-caption text-grey-6">Use top/bottom buttons or drag to reorder • Click eye to toggle visibility • Hidden columns auto-move to end</div>
              </div>
              <q-scroll-area class="fit" v-if="localColumns.length > 0">
                <q-list class="columns-list-content">
                  <div
                    v-for="(column, index) in localColumns"
                    :key="column.code"
                    class="column-item"
                    :class="{
                      'column-hidden': !column.visible,
                      'drag-over': dragOverIndex === index,
                      dragging: draggedIndex === index,
                    }"
                    draggable="true"
                    @dragstart="onDragStart($event, index)"
                    @dragend="onDragEnd($event)"
                    @dragover="onDragOver($event, index)"
                    @dragleave="onDragLeave()"
                    @drop="onDrop($event, index)"
                  >
                    <!-- Drag Handle -->
                    <div class="drag-handle">
                      <q-icon name="drag_indicator" size="20px" color="grey-5" />
                    </div>

                    <!-- Column Info -->
                    <div class="column-info flex-1">
                      <div class="column-name text-weight-medium">
                        {{ column.name }}
                      </div>
                      <div class="column-code text-caption text-grey-6">
                        <q-chip :label="column.valueType" size="sm" color="blue-grey-2" text-color="grey-8" dense />
                        {{ column.code }}
                      </div>
                    </div>

                    <!-- Column Actions -->
                    <div class="column-actions">
                      <!-- Move to Top/Bottom Buttons -->
                      <div class="move-buttons">
                        <q-btn flat round icon="vertical_align_top" size="xs" color="grey-6" :disable="index === 0" @click="moveColumnToTop(index)" class="move-btn">
                          <q-tooltip>Move to top</q-tooltip>
                        </q-btn>
                        <q-btn flat round icon="vertical_align_bottom" size="xs" color="grey-6" :disable="index === localColumns.length - 1" @click="moveColumnToBottom(index)" class="move-btn">
                          <q-tooltip>Move to bottom</q-tooltip>
                        </q-btn>
                      </div>

                      <!-- Visibility Toggle -->
                      <q-btn
                        flat
                        round
                        :icon="column.visible ? 'visibility' : 'visibility_off'"
                        :color="column.visible ? 'positive' : 'grey-5'"
                        size="sm"
                        @click="toggleColumnVisibility(column.code)"
                        class="visibility-btn"
                      >
                        <q-tooltip>{{ column.visible ? 'Hide column' : 'Show column' }}</q-tooltip>
                      </q-btn>
                    </div>
                  </div>
                </q-list>
              </q-scroll-area>
              <div v-else class="text-center q-pa-xl text-grey-5">
                <div class="empty-state">
                  <q-icon name="view_column" size="64px" class="q-mb-md" />
                  <div class="text-h6 q-mb-sm">No columns available</div>
                  <div class="text-body2 text-grey-6 q-mb-md">Add observations to your data grid to see columns here</div>
                  <q-btn flat color="primary" icon="add" label="Add New Observation" @click="$emit('add-observation')" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <!-- Footer -->
      <q-card-actions class="dialog-footer justify-between">
        <div class="text-caption text-grey-6">Changes are applied instantly • Drag or use top/bottom buttons to reorder</div>
        <div class="q-gutter-sm">
          <q-btn flat label="Cancel" color="grey-7" @click="dialogVisible = false" />
          <q-btn label="Apply & Close" color="primary" @click="dialogVisible = false" />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

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
const emit = defineEmits(['update:modelValue', 'update:viewOptions', 'update:columnVisibility', 'update:columnOrder', 'add-observation'])

// Local state
const localOptions = ref({ ...props.viewOptions })
const localColumns = ref([])
const draggedIndex = ref(null)
const dragOverIndex = ref(null)
const dialogVisible = ref(props.modelValue)

// Computed
const totalColumns = computed(() => localColumns.value.length)
const visibleColumns = computed(() => localColumns.value.filter((col) => col.visible).length)

// Methods
const updateOption = (key, value) => {
  localOptions.value = { ...localOptions.value, [key]: value }
  emit('update:viewOptions', localOptions.value)
}

const toggleColumnVisibility = (columnCode) => {
  const columnIndex = localColumns.value.findIndex((col) => col.code === columnCode)
  if (columnIndex !== -1) {
    const newVisibility = !localColumns.value[columnIndex].visible
    localColumns.value[columnIndex].visible = newVisibility

    // Re-sort columns to move hidden ones to the end
    localColumns.value = sortColumnsByVisibility(localColumns.value)

    emit('update:columnVisibility', columnCode, newVisibility)
  }
}

const showAllColumns = () => {
  localColumns.value.forEach((column) => {
    if (!column.visible) {
      column.visible = true
      emit('update:columnVisibility', column.code, true)
    }
  })
}

const hideAllColumns = () => {
  localColumns.value.forEach((column) => {
    if (column.visible) {
      column.visible = false
      emit('update:columnVisibility', column.code, false)
    }
  })
}

const resetColumnOrder = () => {
  // Reset to original order based on observation concepts
  const resetColumns = props.observationConcepts.map((concept) => ({
    code: concept.code,
    name: concept.name,
    valueType: concept.valueType,
    visible: true, // Reset all to visible
    observationCount: concept.observationCount || 0,
  }))

  // Apply visibility-based sorting (all will be visible, so no change needed)
  localColumns.value = sortColumnsByVisibility(resetColumns)

  emit(
    'update:columnOrder',
    localColumns.value.map((col) => col.code),
  )
}

// Drag and Drop Methods
const onDragStart = (event, index) => {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/html', event.target.outerHTML)
  event.target.style.opacity = '0.5'
}

const onDragEnd = (event) => {
  event.target.style.opacity = '1'
  draggedIndex.value = null
  dragOverIndex.value = null
}

const onDragOver = (event, index) => {
  event.preventDefault()
  dragOverIndex.value = index
}

const onDragLeave = () => {
  dragOverIndex.value = null
}

const onDrop = (event, dropIndex) => {
  event.preventDefault()

  const dragIndex = draggedIndex.value
  if (dragIndex === null || dragIndex === dropIndex) return

  // Reorder the columns array
  const newColumns = [...localColumns.value]
  const draggedItem = newColumns.splice(dragIndex, 1)[0]

  // Insert at drop position, but respect visibility sorting
  let actualDropIndex = dropIndex

  // If dragging a visible column, don't allow dropping after hidden columns
  if (draggedItem.visible) {
    const firstHiddenIndex = newColumns.findIndex((col) => !col.visible)
    if (firstHiddenIndex !== -1 && dropIndex >= firstHiddenIndex) {
      actualDropIndex = firstHiddenIndex
    }
  }
  // If dragging a hidden column, don't allow dropping before visible columns
  else {
    const firstHiddenIndex = newColumns.findIndex((col) => !col.visible)
    if (firstHiddenIndex !== -1 && dropIndex < firstHiddenIndex) {
      actualDropIndex = firstHiddenIndex
    }
  }

  newColumns.splice(actualDropIndex, 0, draggedItem)

  localColumns.value = newColumns

  // Emit the new column order
  const newOrder = newColumns.map((col) => col.code)
  emit('update:columnOrder', newOrder)

  // Reset drag state
  draggedIndex.value = null
  dragOverIndex.value = null
}

// Move column to top/bottom methods
const moveColumnToTop = (index) => {
  if (index === 0) return

  const newColumns = [...localColumns.value]
  const item = newColumns.splice(index, 1)[0] // Remove item from current position

  // Find the first hidden column position to insert before it
  const firstHiddenIndex = newColumns.findIndex((col) => !col.visible)
  const insertPosition = firstHiddenIndex === -1 ? 0 : firstHiddenIndex

  newColumns.splice(insertPosition, 0, item) // Insert before first hidden column

  localColumns.value = newColumns

  // Emit the new column order
  const newOrder = newColumns.map((col) => col.code)
  emit('update:columnOrder', newOrder)

  // Add visual feedback
  addMovementFeedback()
}

const moveColumnToBottom = (index) => {
  if (index === localColumns.value.length - 1) return

  const newColumns = [...localColumns.value]
  const item = newColumns.splice(index, 1)[0] // Remove item from current position
  newColumns.push(item) // Add to end

  localColumns.value = newColumns

  // Emit the new column order
  const newOrder = newColumns.map((col) => col.code)
  emit('update:columnOrder', newOrder)

  // Add visual feedback
  addMovementFeedback()
}

// Sort columns by visibility (visible first, hidden last)
const sortColumnsByVisibility = (columns) => {
  return [...columns].sort((a, b) => {
    // Visible columns come first
    if (a.visible && !b.visible) return -1
    if (!a.visible && b.visible) return 1

    // If both have same visibility, maintain current order
    return 0
  })
}

// Visual feedback for column movements
const addMovementFeedback = () => {
  // Could add subtle animations or notifications here
  // For now, just ensure smooth visual updates
}

// Watchers
watch(
  () => props.viewOptions,
  (newOptions) => {
    localOptions.value = { ...newOptions }
  },
  { deep: true },
)

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
.view-options-dialog {
  min-height: 80vh;
  max-height: 90vh;
  animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
}

.dialog-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.view-options-container {
  display: flex;
  height: 100%;
  min-height: 500px;
}

.options-panel {
  width: 350px;
  border-right: 1px solid #e0e0e0;
  background: #fafafa;
}

.columns-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  display: flex;
  align-items: center;
}

.options-list {
  padding: 0;
}

.options-list .q-item {
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s ease;
}

.options-list .q-item:hover {
  background-color: rgba(0, 123, 255, 0.05);
}

.column-controls {
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.columns-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.columns-list-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: white;
}

.columns-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.column-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
  margin: 4px 8px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  min-height: 60px;
}

.column-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(25, 118, 210, 0.05), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.column-item:hover::before {
  opacity: 1;
}

.column-item:hover {
  background: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.column-item.column-hidden {
  opacity: 0.6;
  background: #f5f5f5;
  border-left: 3px solid #9e9e9e;
}

/* Visual styling for column organization */

.column-item.drag-over {
  border: 2px dashed #1976d2;
  background: rgba(25, 118, 210, 0.1);
}

.column-item.dragging {
  opacity: 0.5;
  transform: rotate(5deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.drag-handle {
  margin-right: 12px;
  cursor: move;
  display: flex;
  align-items: center;
  color: #9e9e9e;
  transition: all 0.3s ease;
  padding: 4px;
  border-radius: 4px;
}

.drag-handle:hover {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  transform: scale(1.1);
}

.column-item:hover .drag-handle {
  opacity: 1;
  color: #1976d2;
}

.column-info {
  flex: 1;
}

.column-name {
  font-size: 14px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.column-code {
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.column-meta {
  display: flex;
  align-items: center;
}

.column-actions {
  margin-left: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
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
  opacity: 0.7;
  transition: all 0.2s ease;
}

.move-btn:hover:not(.q-btn--disabled) {
  opacity: 1;
  transform: scale(1.15);
  background-color: rgba(25, 118, 210, 0.15);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.move-btn.q-btn--disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.column-item:hover .move-btn:not(.q-btn--disabled) {
  opacity: 1;
  color: #1976d2;
}

/* Enhanced styling for move buttons */
.move-btn {
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.move-btn:not(.q-btn--disabled):active {
  transform: scale(0.95);
  transition-duration: 0.1s;
}

.visibility-btn {
  width: 32px;
  height: 32px;
  min-height: 32px;
}

.column-actions .q-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.column-actions .q-btn:hover {
  transform: scale(1.1);
}

.column-actions .q-btn.positive:hover {
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.column-actions .q-btn.negative:hover {
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .view-options-container {
    flex-direction: column;
  }

  .options-panel {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .columns-panel {
    width: 100%;
  }
}

/* Empty State Styling */
.empty-state {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .dialog-header {
    padding: 16px;
  }

  .panel-header {
    padding: 16px;
  }

  .column-item {
    padding: 8px 12px;
    min-height: 50px;
  }

  .move-buttons {
    gap: 1px;
  }

  .move-btn {
    width: 20px;
    height: 20px;
    min-height: 20px;
  }

  .visibility-btn {
    width: 28px;
    height: 28px;
    min-height: 28px;
  }

  .dialog-footer {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
  }

  .dialog-footer .q-gutter-sm {
    justify-content: center;
  }

  .empty-state .q-icon {
    font-size: 48px;
  }
}
</style>
