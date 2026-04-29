<template>
  <AppDialog v-model="localShow" title="Edit Visit Type" subtitle="Configure visit type metadata and associated field sets" size="lg" :show-ok="false" cancel-label="Close" @cancel="onCancel">
    <div class="visit-type-editor">
      <!-- Basic Information -->
      <div class="basic-info-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md">Basic Information</div>

        <!-- Name Field -->
        <q-input
          v-model="localVisitTypeData.label"
          label="Display Name"
          outlined
          dense
          class="q-mb-md"
          placeholder="Enter visit type display name..."
          :rules="[(val) => !!val || 'Display name is required']"
        />

        <!-- Icon and Color Selection -->
        <div class="icon-color-selection q-mb-md">
          <div class="icon-preview">
            <q-icon :name="localVisitTypeData.icon || 'event'" size="24px" :color="localVisitTypeData.color || 'primary'" class="q-mr-sm" />
            <span class="text-caption">{{ localVisitTypeData.label || 'Preview' }}</span>
          </div>

          <div class="selection-controls">
            <q-select v-model="localVisitTypeData.icon" :options="iconOptions" label="Icon" outlined dense clearable emit-value map-options class="icon-select" />

            <q-select v-model="localVisitTypeData.color" :options="colorOptions" label="Color" outlined dense clearable emit-value map-options class="color-select" />
          </div>
        </div>
      </div>

      <!-- Field Sets Section -->
      <div class="fieldsets-section q-mb-md">
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1">Associated Field Sets</div>
          <q-btn color="primary" icon="add" label="Add Field Set" dense @click="showFieldSetSearch = true" />
        </div>

        <div class="text-caption text-grey-6 q-mb-md">Configure which field sets are available and active by default for this visit type</div>

        <!-- Field Set List -->
        <div class="fieldset-list">
          <draggable
            v-if="localVisitTypeData.fieldSets.length > 0"
            v-model="localVisitTypeData.fieldSets"
            item-key="id"
            handle=".drag-handle"
            :animation="200"
            ghost-class="sortable-ghost"
            chosen-class="sortable-chosen"
            drag-class="sortable-drag"
            :force-fallback="true"
            fallback-class="sortable-fallback"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element: fieldSet }">
              <q-item :key="fieldSet.id" clickable class="fieldset-item">
                <!-- Drag Handle -->
                <q-item-section avatar>
                  <div class="drag-handle-container">
                    <q-icon name="drag_indicator" class="drag-handle" />
                    <q-icon :name="fieldSet.icon || 'category'" size="20px" :color="fieldSet.active ? 'primary' : 'grey-5'" />
                  </div>
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-weight-medium">
                    {{ fieldSet.name }}
                  </q-item-label>
                  <q-item-label caption class="text-grey-6">
                    {{ fieldSet.description }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <div class="fieldset-controls">
                    <q-toggle v-model="fieldSet.active" color="primary" size="sm" @update:model-value="onFieldSetActiveToggle(fieldSet)" />
                    <q-btn flat round dense size="sm" icon="delete" color="negative" @click="removeFieldSet(fieldSet.id)">
                      <q-tooltip>Remove field set</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>

                <!-- Tooltip -->
                <q-tooltip>
                  <div class="fieldset-tooltip-content">
                    <div class="tooltip-name">{{ fieldSet.name }}</div>
                    <div class="tooltip-description">{{ fieldSet.description }}</div>
                    <div class="tooltip-status">
                      {{ fieldSet.active ? 'Active by default' : 'Available but not active' }}
                    </div>
                  </div>
                </q-tooltip>
              </q-item>
            </template>
          </draggable>

          <div v-else class="text-grey-5 text-center q-pa-md">No field sets associated yet. Click "Add Field Set" to get started.</div>
        </div>
      </div>
    </div>

    <!-- Field Set Search Dialog -->
    <q-dialog v-model="showFieldSetSearch" persistent>
      <q-card style="min-width: 600px">
        <q-card-section>
          <div class="text-h6">Add Field Sets</div>
          <div class="text-caption text-grey-6 q-mb-md">Select field sets to associate with this visit type</div>

          <!-- Available Field Sets -->
          <div v-if="availableFieldSets.length > 0" class="available-fieldsets">
            <q-list>
              <q-item v-for="fieldSet in availableFieldSets" :key="fieldSet.id" clickable @click="addFieldSet(fieldSet)" :class="{ 'bg-grey-1': isFieldSetSelected(fieldSet.id) }">
                <q-item-section avatar>
                  <q-icon :name="fieldSet.icon || 'category'" color="primary" />
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ fieldSet.name }}</q-item-label>
                  <q-item-label caption>
                    {{ fieldSet.description }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <q-icon v-if="isFieldSetSelected(fieldSet.id)" name="check_circle" color="positive" />
                  <q-icon v-else name="add" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div v-else class="text-grey-5 text-center q-pa-md">No field sets available to add</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="grey-7" label="Close" @click="showFieldSetSearch = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <template #actions>
      <q-btn color="primary" label="Save Visit Type" @click="onSave" :loading="saving" :disable="!isFormValid" />
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import draggable from 'vuedraggable'
import AppDialog from '../shared/AppDialog.vue'

const notify = useNotify()
const globalSettingsStore = useGlobalSettingsStore()

// Props
const props = defineProps({
  modelValue: Boolean,
  visitTypeData: {
    type: Object,
    default: () => ({
      label: '',
      icon: null,
      color: null,
      fieldSets: [],
    }),
  },
  visitTypeCode: String,
})

// Emits
const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Local state
const localShow = ref(false)
const saving = ref(false)
const showFieldSetSearch = ref(false)
const allFieldSets = ref([])

// Icon options for visit types
const iconOptions = [
  { label: 'Health Check', value: 'health_and_safety' },
  { label: 'Follow-up', value: 'follow_the_signs' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Consultation', value: 'psychology' },
  { label: 'Procedure', value: 'medical_services' },
  { label: 'Surgery', value: 'healing' },
  { label: 'Therapy', value: 'self_improvement' },
  { label: 'Vaccination', value: 'vaccines' },
  { label: 'Screening', value: 'search' },
  { label: 'Lab Work', value: 'science' },
  { label: 'Imaging', value: 'camera_alt' },
  { label: 'Appointment', value: 'event' },
  { label: 'Visit', value: 'local_hospital' },
  { label: 'Assessment', value: 'assessment' },
  { label: 'Monitoring', value: 'monitor_heart' },
]

// Color options for visit types
const colorOptions = [
  { label: 'Primary', value: 'primary' },
  { label: 'Secondary', value: 'secondary' },
  { label: 'Accent', value: 'accent' },
  { label: 'Positive', value: 'positive' },
  { label: 'Negative', value: 'negative' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' },
  { label: 'Dark', value: 'dark' },
]

// Reactive visit type data
const localVisitTypeData = ref({
  label: '',
  icon: null,
  color: null,
  fieldSets: [],
})

// Computed
const isFormValid = computed(() => {
  return localVisitTypeData.value.label.trim().length > 0
})

const availableFieldSets = computed(() => {
  const selectedIds = new Set(localVisitTypeData.value.fieldSets.map((fs) => fs.id))
  return allFieldSets.value.filter((fs) => !selectedIds.has(fs.id))
})

// Watch for external model changes
watch(
  () => props.modelValue,
  async (newValue) => {
    localShow.value = newValue
    if (newValue && props.visitTypeData) {
      // Parse the visit type data
      localVisitTypeData.value = {
        label: props.visitTypeData.label || '',
        icon: props.visitTypeData.icon || null,
        color: props.visitTypeData.color || null,
        fieldSets: props.visitTypeData.fieldSets || [],
      }

      // Load available field sets
      await loadFieldSets()
    }
  },
)

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})

// Methods
const loadFieldSets = async () => {
  try {
    const fieldSets = await globalSettingsStore.getFieldSetOptions()
    allFieldSets.value = fieldSets || []
  } catch (error) {
    console.error('Failed to load field sets:', error)
    notify.error('Failed to load field sets', { caption: error.message })
  }
}

const isFieldSetSelected = (fieldSetId) => {
  return localVisitTypeData.value.fieldSets.some((fs) => fs.id === fieldSetId)
}

const addFieldSet = (fieldSet) => {
  if (isFieldSetSelected(fieldSet.id)) {
    notify.warning('Field set already added to visit type')
    return
  }

  // Add field set with default active state
  localVisitTypeData.value.fieldSets.push({
    id: fieldSet.id,
    name: fieldSet.name,
    description: fieldSet.description,
    icon: fieldSet.icon,
    active: false, // Not active by default
  })

  notify.success(`Added "${fieldSet.name}" to visit type`)
}

const removeFieldSet = (fieldSetId) => {
  const index = localVisitTypeData.value.fieldSets.findIndex((fs) => fs.id === fieldSetId)
  if (index > -1) {
    const removedFieldSet = localVisitTypeData.value.fieldSets[index]
    localVisitTypeData.value.fieldSets.splice(index, 1)

    notify.info(`Removed "${removedFieldSet.name}" from visit type`)
  }
}

const onFieldSetActiveToggle = (fieldSet) => {
  const status = fieldSet.active ? 'active by default' : 'available but not active'
  notify.info(`"${fieldSet.name}" is now ${status}`)
}

const onSave = async () => {
  if (!isFormValid.value) {
    notify.warning('Please fill in all required fields')
    return
  }

  saving.value = true
  try {
    // Convert to JSON format for storage
    const jsonData = {
      label: localVisitTypeData.value.label,
      icon: localVisitTypeData.value.icon,
      color: localVisitTypeData.value.color,
      fieldSets: localVisitTypeData.value.fieldSets,
    }

    emit('save', {
      label: localVisitTypeData.value.label,
      jsonData: JSON.stringify(jsonData, null, 2),
    })

    localShow.value = false
  } catch (error) {
    console.error('Failed to save visit type:', error)
    notify.error('Failed to save visit type', { caption: error.message })
  } finally {
    saving.value = false
  }
}

const onCancel = () => {
  emit('cancel')
  localShow.value = false
}

const onDragStart = () => {
  document.body.classList.add('dragging-fieldset')
}

const onDragEnd = () => {
  document.body.classList.remove('dragging-fieldset')
}

// Initialize on mount
onMounted(async () => {
  await loadFieldSets()
})
</script>

<style lang="scss" scoped>
.visit-type-editor {
  .basic-info-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background-color: #fafafa;
  }

  .icon-color-selection {
    display: flex;
    align-items: flex-start;
    gap: 16px;

    .icon-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 120px;
      padding: 16px 12px;
      background: rgba(25, 118, 210, 0.05);
      border: 1px solid rgba(25, 118, 210, 0.2);
      border-radius: 8px;
      transition: all 0.2s ease;

      .q-icon {
        margin-bottom: 8px;
      }

      &:hover {
        background: rgba(25, 118, 210, 0.1);
        border-color: rgba(25, 118, 210, 0.3);
      }
    }

    .selection-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;

      .icon-select,
      .color-select {
        min-width: 200px;
      }
    }
  }

  .fieldsets-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background-color: #fafafa;

    .fieldset-list {
      min-height: 60px;
      border: 1px dashed #ccc;
      border-radius: 4px;
      background-color: white;
      overflow: hidden;

      .fieldset-item {
        padding: 8px 16px;
        min-height: 64px;
        transition: all 0.2s ease;
        cursor: grab;

        &:hover {
          background-color: #f5f5f5;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .q-item__section--avatar {
          min-width: 40px;
          padding-right: 12px;
        }

        .drag-handle-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fieldset-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      /* Drag feedback styles */
      .fieldset-item.sortable-ghost {
        opacity: 0.3;
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        border: 2px dashed #2196f3;
        border-radius: 8px;
        transform: scale(0.98);
      }

      .fieldset-item.sortable-chosen {
        cursor: grabbing !important;
        transform: rotate(2deg) scale(1.02);
        box-shadow: 0 8px 25px rgba(33, 150, 243, 0.3);
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #2196f3;
        border-radius: 8px;
        z-index: 1000;
      }

      .fieldset-item.sortable-drag {
        background: linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%);
        box-shadow: 0 12px 35px rgba(33, 150, 243, 0.4);
        border: 2px solid #2196f3;
        border-radius: 12px;
        transform: rotate(5deg) scale(1.05);
        z-index: 2000;
      }
    }
  }

  .available-fieldsets {
    max-height: 400px;
    overflow-y: auto;
  }
}

/* Enhanced drag handle styling */
.drag-handle {
  color: #9e9e9e;
  cursor: grab;
  transition: all 0.2s ease;
  border-radius: 4px;
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

body.dragging-fieldset .drag-handle {
  color: #2196f3;
  background: rgba(33, 150, 243, 0.15);
  padding: 4px;
}

// Dark mode support
.body--dark {
  .basic-info-section,
  .fieldsets-section {
    border-color: #555;
    background-color: #2a2a2a;
  }

  .icon-color-selection {
    .icon-preview {
      background: rgba(100, 181, 246, 0.05);
      border-color: rgba(100, 181, 246, 0.2);

      &:hover {
        background: rgba(100, 181, 246, 0.1);
        border-color: rgba(100, 181, 246, 0.3);
      }
    }
  }

  .fieldset-list {
    border-color: #666;
    background-color: #1a1a1a;

    .fieldset-item:hover {
      background-color: #2a2a2a;
    }

    .fieldset-item.sortable-ghost {
      background: linear-gradient(135deg, #1e3a5f 0%, #2a4a7a 100%);
      border-color: #64b5f6;
    }

    .fieldset-item.sortable-chosen {
      background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
      border-color: #64b5f6;
    }

    .fieldset-item.sortable-drag {
      background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
      border-color: #64b5f6;
    }
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

  body.dragging-fieldset .drag-handle {
    color: #64b5f6;
    background: rgba(100, 181, 246, 0.15);
    padding: 4px;
  }
}
</style>
