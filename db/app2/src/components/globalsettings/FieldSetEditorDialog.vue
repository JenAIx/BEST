<template>
  <AppDialog v-model="localShow" title="Edit Field Set" subtitle="Configure observation concepts for visits" size="lg" persistent :show-ok="false" cancel-label="Close" @cancel="onCancel">
    <div class="fieldset-editor">
      <!-- Description Field -->
      <q-input v-model="localFieldSetData.description" label="Description" outlined dense class="q-mb-md" placeholder="Enter field set description..." />

      <!-- Icon Selection -->
      <q-select v-model="localFieldSetData.icon" :options="iconOptions" label="Icon" outlined dense class="q-mb-md" clearable emit-value map-options />

      <!-- Concepts Section -->
      <div class="concepts-section q-mb-md">
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1">Observation Concepts</div>
          <q-btn color="primary" icon="add" label="Add Concept" dense @click="showConceptSearch = true" />
        </div>

        <!-- Concept Chips -->
        <div class="concept-chips">
          <q-chip
            v-for="conceptCode in localFieldSetData.concepts"
            :key="conceptCode"
            removable
            dense
            @remove="removeConcept(conceptCode)"
            color="grey-3"
            text-color="grey-8"
            class="q-mr-xs q-mb-xs concept-chip"
          >
            <q-item class="q-pa-none">
              <q-item-section>
                <q-item-label class="text-weight-medium concept-name">
                  {{ getResolvedConceptName(conceptCode) }}
                </q-item-label>
                <q-item-label caption class="concept-details">
                  <div class="row items-center q-gutter-xs">
                    <span class="text-caption concept-code">{{ conceptCode }}</span>
                    <ValueTypeIcon :value-type="getConceptValueType(conceptCode)" size="20px" variant="minimal" :show-tooltip="false" />
                  </div>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-chip>

          <div v-if="localFieldSetData.concepts.length === 0" class="text-grey-5 text-center q-pa-md">No concepts added yet. Click "Add Concept" to get started.</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="row justify-end q-gutter-sm">
        <q-btn flat color="grey-7" label="Cancel" @click="onCancel" />
        <q-btn color="primary" label="Save Field Set" @click="onSave" :loading="saving" />
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
  </AppDialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
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
</script>

<style lang="scss" scoped>
.fieldset-editor {
  .concepts-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background-color: #fafafa;

    .concept-chips {
      min-height: 60px;
      padding: 8px;
      border: 1px dashed #ccc;
      border-radius: 4px;
      background-color: white;

      .concept-chip {
        min-width: 200px;
        max-width: 280px;

        .q-item {
          min-height: auto;
          padding: 8px 12px;

          .q-item__section {
            padding: 0;
          }

          .concept-name {
            font-size: 0.9rem;
            line-height: 1.2;
            margin-bottom: 2px;
          }

          .concept-details {
            font-size: 0.75rem;
            line-height: 1.1;

            .concept-code {
              font-family: 'Courier New', monospace;
              font-weight: 500;
            }
          }
        }
      }
    }
  }

  .search-results {
    max-height: 400px;
    overflow-y: auto;
  }
}

// Dark mode support
.body--dark {
  .concepts-section {
    border-color: #555;
    background-color: #2a2a2a;

    .concept-chips {
      border-color: #666;
      background-color: #1a1a1a;
    }
  }
}
</style>
