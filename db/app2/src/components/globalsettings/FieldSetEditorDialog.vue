<template>
  <AppDialog v-model="localShow" title="Edit Field Set" subtitle="Configure observation concepts for visits" size="lg" :show-ok="false" cancel-label="Close" @cancel="onCancel">
    <div class="fieldset-editor">
      <!-- Description Field -->
      <q-input v-model="localFieldSetData.description" label="Description" outlined dense class="q-mb-md" placeholder="Enter field set description..." />

      <!-- Icon Selection -->
      <div class="icon-selection q-mb-md">
        <div class="icon-preview">
          <q-icon :name="localFieldSetData.icon || 'category'" size="24px" color="primary" class="q-mr-sm" />
          <span class="text-caption text-grey-6">Selected Icon</span>
        </div>
        <q-select v-model="localFieldSetData.icon" :options="iconOptions" label="Icon" outlined dense clearable emit-value map-options class="icon-select" />
      </div>

      <!-- Concepts Section -->
      <div class="concepts-section q-mb-md">
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1">Observation Concepts</div>
          <q-btn color="primary" icon="add" label="Add Concept" dense @click="showConceptSearch = true" />
        </div>

        <!-- Concept List -->
        <div class="concept-list">
          <draggable
            v-if="localFieldSetData.concepts.length > 0"
            v-model="localFieldSetData.concepts"
            item-key="conceptCode"
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
            <template #item="{ element: conceptCode }">
              <q-item :key="conceptCode" clickable @click="removeConcept(conceptCode)" class="concept-item">
                <!-- Drag Handle -->
                <q-item-section avatar>
                  <div class="drag-handle-container">
                    <q-icon name="drag_indicator" class="drag-handle" />
                    <ValueTypeIcon :value-type="getConceptValueType(conceptCode)" size="24px" variant="minimal" :show-tooltip="false" />
                  </div>
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-weight-medium">
                    {{ getResolvedConceptName(conceptCode) }}
                  </q-item-label>
                  <q-item-label caption class="text-grey-6">
                    {{ conceptCode }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <q-btn flat round dense icon="delete" color="negative" @click.stop="removeConcept(conceptCode)" size="sm">
                    <q-tooltip>Remove concept</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </template>
          </draggable>

          <div v-else class="text-grey-5 text-center q-pa-md">No concepts added yet. Click "Add Concept" to get started.</div>
        </div>
      </div>
    </div>

    <!-- Concept Search Dialog -->
    <q-dialog v-model="showConceptSearch" persistent>
      <q-card style="min-width: 600px">
        <q-card-section>
          <div class="text-h6">Search Concepts</div>
          <div class="text-caption text-grey-6 q-mb-md">Find and add observation concepts to this field set</div>

          <!-- Search Input -->
          <q-input v-model="searchTerm" outlined dense placeholder="Search concepts by name or code..." @update:model-value="onSearchInput" debounce="300" class="q-mb-md">
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
            <template v-slot:append>
              <q-icon v-if="searchTerm" name="close" @click="clearSearch" class="cursor-pointer" />
            </template>
          </q-input>

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="search-results">
            <q-list>
              <q-item v-for="concept in searchResults" :key="concept.CONCEPT_CD" clickable @click="addConcept(concept)" :class="{ 'bg-grey-1': isConceptSelected(concept.CONCEPT_CD) }">
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ concept.NAME_CHAR }}</q-item-label>
                  <q-item-label caption>
                    <div class="row items-center q-gutter-sm">
                      <q-badge :label="concept.VALTYPE_CD" size="sm" color="primary" />
                      <span>{{ concept.CONCEPT_CD }}</span>
                      <span v-if="concept.CONCEPT_PATH" class="text-grey-6">• {{ concept.CONCEPT_PATH }}</span>
                    </div>
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon v-if="isConceptSelected(concept.CONCEPT_CD)" name="check_circle" color="positive" />
                  <q-icon v-else name="add" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div v-else-if="searchTerm && !searching" class="text-grey-5 text-center q-pa-md">No concepts found matching "{{ searchTerm }}"</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="grey-7" label="Cancel" @click="showConceptSearch = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <template #actions>
      <q-btn color="primary" label="Save Field Set" @click="onSave" :loading="saving" />
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import draggable from 'vuedraggable'
import AppDialog from '../shared/AppDialog.vue'
import ValueTypeIcon from '../shared/ValueTypeIcon.vue'

const $q = useQuasar()
const conceptStore = useConceptResolutionStore()

// Props
const props = defineProps({
  modelValue: Boolean,
  fieldSetData: {
    type: Object,
    default: () => ({
      description: '',
      icon: null,
      concepts: [],
    }),
  },
  fieldSetCode: String,
})

// Emits
const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Local state
const localShow = ref(false)
const saving = ref(false)
const showConceptSearch = ref(false)
const searchTerm = ref('')
const searchResults = ref([])
const searching = ref(false)

// Icon options for field sets
const iconOptions = [
  { label: 'Medical', value: 'local_hospital' },
  { label: 'Observation', value: 'visibility' },
  { label: 'Assessment', value: 'assessment' },
  { label: 'Lab Results', value: 'science' },
  { label: 'Vital Signs', value: 'monitor_heart' },
  { label: 'Symptoms', value: 'sick' },
  { label: 'Measurements', value: 'straighten' },
  { label: 'Notes', value: 'description' },
  { label: 'Timeline', value: 'timeline' },
  { label: 'Category', value: 'category' },
  { label: 'List', value: 'list' },
  { label: 'Grid', value: 'grid_on' },
  { label: 'Chart', value: 'show_chart' },
  { label: 'Report', value: 'assignment' },
  { label: 'Document', value: 'article' },
  { label: 'Settings', value: 'settings' },
]

// Reactive field set data
const localFieldSetData = ref({
  description: '',
  icon: null,
  concepts: [],
})

// Resolved concept names cache
const resolvedConceptNames = ref(new Map())

// Watch for external model changes
watch(
  () => props.modelValue,
  async (newValue) => {
    localShow.value = newValue
    if (newValue && props.fieldSetData) {
      localFieldSetData.value = { ...props.fieldSetData }

      // Resolve concept names for existing concepts
      if (localFieldSetData.value.concepts && localFieldSetData.value.concepts.length > 0) {
        await loadConceptNames(localFieldSetData.value.concepts)
      }
    }
  },
)

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})

// Initialize concept store
onMounted(async () => {
  try {
    await conceptStore.initialize()
  } catch (error) {
    console.error('Failed to initialize concept store:', error)
  }
})

// Methods
const loadConceptNames = async (conceptCodes) => {
  if (!conceptCodes || conceptCodes.length === 0) return

  try {
    // Resolve concept names in batch
    const resolvedMap = await conceptStore.resolveBatch(conceptCodes, {
      context: 'field_set',
    })

    // Cache the resolved names and value types
    for (const [code, resolved] of resolvedMap) {
      resolvedConceptNames.value.set(code, {
        name: resolved.label || code,
        valueType: resolved.valueType || '',
      })
    }
  } catch (error) {
    console.error('Failed to load concept names:', error)
    // Fallback to using codes as names
    conceptCodes.forEach((code) => {
      resolvedConceptNames.value.set(code, {
        name: code,
        valueType: '',
      })
    })
  }
}

const getResolvedConceptName = (conceptCode) => {
  if (!conceptCode) return conceptCode
  return resolvedConceptNames.value.get(conceptCode)?.name || conceptCode
}

const getConceptValueType = (conceptCode) => {
  if (!conceptCode) return ''
  return resolvedConceptNames.value.get(conceptCode)?.valueType || ''
}

const onSearchInput = async () => {
  if (!searchTerm.value || searchTerm.value.length < 2) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const results = await conceptStore.searchConcepts(searchTerm.value, {
      context: 'field_set',
    })
    searchResults.value = results || []
  } catch (error) {
    console.error('Failed to search concepts:', error)
    searchResults.value = []
    $q.notify({
      type: 'negative',
      message: 'Failed to search concepts',
      caption: error.message,
    })
  } finally {
    searching.value = false
  }
}

const clearSearch = () => {
  searchTerm.value = ''
  searchResults.value = []
}

const isConceptSelected = (conceptCode) => {
  return localFieldSetData.value.concepts.includes(conceptCode)
}

const addConcept = async (concept) => {
  if (isConceptSelected(concept.CONCEPT_CD)) {
    $q.notify({
      type: 'warning',
      message: 'Concept already added to field set',
    })
    return
  }

  // Add concept code to the array
  localFieldSetData.value.concepts.push(concept.CONCEPT_CD)

  // Resolve and cache the concept name
  try {
    const resolved = await conceptStore.resolveConcept(concept.CONCEPT_CD, {
      context: 'field_set',
    })
    resolvedConceptNames.value.set(concept.CONCEPT_CD, {
      name: resolved.label || concept.NAME_CHAR,
      valueType: concept.VALTYPE_CD || '',
    })

    $q.notify({
      type: 'positive',
      message: `Added "${resolved.label || concept.NAME_CHAR}" to field set`,
    })
  } catch (error) {
    console.error('Failed to resolve concept:', error)
    // Use the basic name if resolution fails
    resolvedConceptNames.value.set(concept.CONCEPT_CD, {
      name: concept.NAME_CHAR,
      valueType: concept.VALTYPE_CD || '',
    })
    $q.notify({
      type: 'positive',
      message: `Added "${concept.NAME_CHAR}" to field set`,
    })
  }
}

const removeConcept = (conceptCode) => {
  const index = localFieldSetData.value.concepts.indexOf(conceptCode)
  if (index > -1) {
    localFieldSetData.value.concepts.splice(index, 1)
    const removedName = resolvedConceptNames.value.get(conceptCode) || conceptCode
    $q.notify({
      type: 'info',
      message: `Removed "${removedName}" from field set`,
    })
  }
}

const onSave = async () => {
  if (!localFieldSetData.value.description.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Please enter a description for the field set',
    })
    return
  }

  saving.value = true
  try {
    // Convert to JSON format for storage
    const jsonData = {
      description: localFieldSetData.value.description,
      icon: localFieldSetData.value.icon,
      concepts: localFieldSetData.value.concepts,
    }

    emit('save', {
      description: localFieldSetData.value.description,
      jsonData: JSON.stringify(jsonData, null, 2),
    })

    localShow.value = false
  } catch (error) {
    console.error('Failed to save field set:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save field set',
      caption: error.message,
    })
  } finally {
    saving.value = false
  }
}

const onCancel = () => {
  // Clear resolved names cache
  resolvedConceptNames.value.clear()
  emit('cancel')
  localShow.value = false
}

const onDragStart = () => {
  // Add visual feedback when drag starts
  document.body.classList.add('dragging-concept')
}

const onDragEnd = () => {
  // Clean up visual feedback when drag ends
  document.body.classList.remove('dragging-concept')
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
</script>

<style lang="scss" scoped>
.fieldset-editor {
  .icon-selection {
    display: flex;
    align-items: center;
    gap: 16px;

    .icon-preview {
      display: flex;
      align-items: center;
      min-width: 120px;
      padding: 8px 12px;
      background: rgba(25, 118, 210, 0.05);
      border: 1px solid rgba(25, 118, 210, 0.2);
      border-radius: 8px;
      transition: all 0.2s ease;

      .q-icon {
        color: #1976d2;
      }

      &:hover {
        background: rgba(25, 118, 210, 0.1);
        border-color: rgba(25, 118, 210, 0.3);
      }
    }

    .icon-select {
      flex: 1;
      min-width: 200px;
    }
  }

  .concepts-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background-color: #fafafa;

    .concept-list {
      min-height: 60px;
      border: 1px dashed #ccc;
      border-radius: 4px;
      background-color: white;
      overflow: hidden;

      .concept-item {
        padding: 8px 16px;
        min-height: 56px;
        transition: all 0.2s ease;
        cursor: grab;

        &:hover {
          background-color: #f5f5f5;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .q-item__section--avatar {
          min-width: 32px;
          padding-right: 12px;
          display: flex;
          align-items: center;
        }

        .drag-handle-container {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .q-item__section--side {
          padding-left: 8px;
        }
      }

      /* Enhanced drag feedback styles */
      .concept-item.sortable-ghost {
        opacity: 0.3;
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        border: 2px dashed #2196f3;
        border-radius: 8px;
        transform: scale(0.98);
        position: relative;
      }

      .concept-item.sortable-ghost::before {
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

      .concept-item.sortable-chosen {
        cursor: grabbing !important;
        transform: rotate(3deg) scale(1.02);
        box-shadow: 0 8px 25px rgba(33, 150, 243, 0.3);
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #2196f3;
        border-radius: 8px;
        z-index: 1000;
        transition: all 0.2s ease;
      }

      .concept-item.sortable-drag {
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
    }
  }

  .search-results {
    max-height: 400px;
    overflow-y: auto;
  }

  /* Global drag state styles */
  body.dragging-concept .concept-item:not(.sortable-chosen):not(.sortable-ghost) {
    transition: all 0.2s ease;
    opacity: 0.7;
  }

  body.dragging-concept .concept-item:hover:not(.sortable-chosen) {
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%);
    border: 2px dashed #2196f3;
    border-radius: 8px;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
  }

  body.dragging-concept .concept-item:hover:not(.sortable-chosen)::after {
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
    border-radius: 4px;
    position: relative;
  }

  .drag-handle:hover {
    color: #2196f3;
    background: rgba(33, 150, 243, 0.1);
    padding: 4px;
    transform: scale(1.1);
  }

  .drag-handle:active {
    cursor: grabbing;
    color: #1976d2;
    background: rgba(33, 150, 243, 0.2);
    padding: 4px;
    transform: scale(0.95);
  }

  body.dragging-concept .drag-handle {
    color: #2196f3;
    background: rgba(33, 150, 243, 0.15);
    padding: 4px;
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

  body.dragging-concept .concept-item:not(.sortable-chosen) .drag-handle {
    animation: drag-pulse 1.5s ease-in-out infinite;
  }
}

// Dark mode support
.body--dark {
  .icon-selection {
    .icon-preview {
      background: rgba(100, 181, 246, 0.05);
      border-color: rgba(100, 181, 246, 0.2);

      .q-icon {
        color: #64b5f6;
      }

      &:hover {
        background: rgba(100, 181, 246, 0.1);
        border-color: rgba(100, 181, 246, 0.3);
      }
    }
  }

  .concepts-section {
    border-color: #555;
    background-color: #2a2a2a;

    .concept-list {
      border-color: #666;
      background-color: #1a1a1a;

      .concept-item:hover {
        background-color: #2a2a2a;
      }

      .concept-item.sortable-ghost {
        background: linear-gradient(135deg, #1e3a5f 0%, #2a4a7a 100%);
        border-color: #64b5f6;
      }

      .concept-item.sortable-ghost::before {
        color: #90caf9;
      }

      .concept-item.sortable-chosen {
        background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
        border-color: #64b5f6;
      }

      .concept-item.sortable-drag {
        background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
        border-color: #64b5f6;
      }

      .sortable-fallback {
        background: linear-gradient(135deg, #1a1a1a 0%, #1e3a5f 100%);
        border-color: #90caf9;
      }
    }
  }

  body.dragging-concept .concept-item:hover:not(.sortable-chosen) {
    background: linear-gradient(135deg, #1e3a5f 0%, #2a4a7a 50%);
    border-color: #64b5f6;
  }

  body.dragging-concept .concept-item:hover:not(.sortable-chosen)::after {
    background: linear-gradient(90deg, #64b5f6, #90caf9);
    box-shadow: 0 0 8px rgba(100, 181, 246, 0.6);
  }

  .drag-handle {
    color: #bbb;
  }

  .drag-handle:hover {
    color: #64b5f6;
    background: rgba(100, 181, 246, 0.1);
    padding: 4px;
  }

  .drag-handle:active {
    color: #90caf9;
    background: rgba(100, 181, 246, 0.2);
    padding: 4px;
  }

  body.dragging-concept .drag-handle {
    color: #64b5f6;
    background: rgba(100, 181, 246, 0.15);
    padding: 4px;
  }
}
</style>
