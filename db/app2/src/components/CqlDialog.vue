<template>
  <BaseEntityDialog
    v-model="dialogVisible"
    :mode="mode"
    :entity="localFormData"
    entity-name="CQL Rule"
    icon="code"
    :size="mode === 'edit' ? 'xl' : 'md'"
    :loading="isSaving || loading"
    :custom-validator="validateForm"
    @submit="handleSubmit"
    @cancel="handleCancel"
  >
    <template #default="{ formData, isEditMode }">
      <!-- Basic Information -->
      <div v-if="isEditMode" class="q-mb-lg">
        <div class="text-subtitle1 q-mb-md">Basic Information</div>
      </div>

      <div :class="isEditMode ? 'row q-gutter-md' : ''">
        <div :class="isEditMode ? 'col-12 col-md' : ''">
          <q-input
            v-model="formData.CODE_CD"
            outlined
            dense
            label="Code *"
            :rules="[(val) => !!val || 'Code is required']"
            :hint="isEditMode ? null : 'Unique identifier for the CQL rule'"
            :readonly="isEditMode"
          />
        </div>

        <div :class="isEditMode ? 'col-12 col-md' : ''">
          <q-input v-model="formData.NAME_CHAR" outlined dense label="Name *" :rules="[(val) => !!val || 'Name is required']" :hint="isEditMode ? null : 'Descriptive name for the CQL rule'" />
        </div>

        <div :class="isEditMode ? 'col-12 col-md' : ''">
          <q-input v-model="formData.CQL_BLOB" outlined dense label="Description" :hint="isEditMode ? null : 'Optional description of what this rule does'" />
        </div>
      </div>

      <!-- CQL Template/Editor -->
      <div v-if="!isEditMode" class="q-mt-lg">
        <div class="text-caption text-grey-6 q-mb-sm">Initial CQL Template</div>
        <q-input v-model="cqlTemplate" type="textarea" outlined rows="8" readonly class="cql-template" />
        <div class="text-caption text-grey-6 q-mt-xs">This template will be created as the starting point for your CQL rule.</div>
      </div>

      <!-- CQL Editor for Edit Mode -->
      <template v-if="isEditMode">
        <q-separator class="q-my-lg" />

        <div class="row q-gutter-md">
          <div class="col-12">
            <div class="text-subtitle1 q-mb-md">CQL Definition</div>
            <div class="row q-gutter-md q-mb-md">
              <div class="col-auto">
                <q-btn color="primary" icon="play_arrow" label="Test CQL" @click="testCQL" :loading="testing" />
              </div>
              <div class="col-auto">
                <q-btn color="secondary" icon="help_outline" label="CQL Help" @click="showCQLHelp" />
              </div>
              <div class="col-auto">
                <q-btn color="accent" icon="content_copy" label="Copy Template" @click="copyTemplate" />
              </div>
            </div>

            <!-- CQL Editor -->
            <div class="cql-editor-container">
              <q-input
                v-model="formData.CQL_TEXT"
                type="textarea"
                outlined
                rows="12"
                class="cql-editor"
                placeholder="Enter your CQL definition here..."
                :rules="[(val) => !!val || 'CQL definition is required']"
              />
            </div>

            <!-- Test Results -->
            <div v-if="testResults" class="q-mt-md">
              <q-card flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">Test Results</div>
                  <pre class="test-results">{{ testResults }}</pre>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>
      </template>
    </template>
  </BaseEntityDialog>

  <!-- CQL Test Dialog -->
  <CqlTestDialog v-model="showTestDialog" :cqlRule="cqlStore.selectedRule" @cancel="onTestCancelled" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import BaseEntityDialog from './shared/BaseEntityDialog.vue'
import CqlTestDialog from './CqlTestDialog.vue'
import { useCqlStore } from 'src/stores/cql-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { stringify_char, unstringify_char } from 'src/shared/utils/sql-tools.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value),
  },
  cqlRule: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:modelValue', 'saved', 'cancelled'])

const $q = useQuasar()
const cqlStore = useCqlStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CqlDialog')

// State
const showTestDialog = ref(false)
const testResults = ref(null)
const localFormData = ref({})
const loading = ref(false)

// Use store state
const isSaving = computed(() => cqlStore.saving)
const testing = computed(() => cqlStore.testing)

// CQL Template
const cqlTemplate = computed(() => {
  const code = localFormData.value.CODE_CD || 'MyRule'
  const name = localFormData.value.NAME_CHAR || 'My CQL Rule'

  return `library ${code} version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

context Patient

define "${name}":
  // Your CQL logic here
  // Example: Check if patient has a specific condition
  exists([Condition: "Diabetes"]) or
  exists([Observation: "HbA1c"] O where O.value > 6.5)

define "Inclusion Criteria":
  // Define inclusion criteria
  AgeInYears() >= 18

define "Exclusion Criteria":
  // Define exclusion criteria
  false

define "Is Eligible":
  "Inclusion Criteria" and not "Exclusion Criteria"
`
})

// Computed
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => {
    if (value) {
      // Clear any previous errors when opening dialog
      cqlStore.clearError()
      testResults.value = null
    }
    emit('update:modelValue', value)
  },
})

// Methods
const validateForm = (formData, isEditMode) => {
  if (!formData.CODE_CD || formData.CODE_CD.trim() === '') return false
  if (!formData.NAME_CHAR || formData.NAME_CHAR.trim() === '') return false

  if (isEditMode) {
    if (!formData.CQL_TEXT || formData.CQL_TEXT.trim() === '') return false
  }

  return true
}

const testCQL = () => {
  // Set the current rule data for testing
  const testRule = {
    CQL_ID: props.cqlRule?.CQL_ID,
    CODE_CD: localFormData.value.CODE_CD,
    NAME_CHAR: localFormData.value.NAME_CHAR,
    CQL_BLOB: localFormData.value.CQL_BLOB,
    CQL_CHAR: stringify_char(localFormData.value.CQL_TEXT), // Convert line breaks for storage format
    JSON_CHAR: props.cqlRule?.JSON_CHAR, // Keep compiled JSON if available
  }
  cqlStore.setSelectedRule(testRule)
  showTestDialog.value = true
}

const onTestCancelled = () => {
  showTestDialog.value = false
  cqlStore.clearSelectedRule()
}

const showCQLHelp = () => {
  $q.dialog({
    title: 'CQL Help',
    message: `CQL (Clinical Quality Language) is a domain-specific language for expressing clinical quality logic.

Common CQL Elements:
• define: Creates a named expression
• exists(): Checks if data exists
• where: Filters data based on conditions
• and/or/not: Boolean operators
• [ResourceType]: Queries FHIR resources

Example Patterns:
• Check for condition: exists([Condition: "Diabetes"])
• Filter observations: [Observation: "Blood Pressure"] O where O.value > 140
• Age check: AgeInYears() >= 18
• Date ranges: [Encounter] E where E.period during "Measurement Period"`,
    html: true,
    ok: { label: 'Got it', color: 'primary' },
  })
}

const copyTemplate = async () => {
  try {
    await copyToClipboard(cqlTemplate.value)
    $q.notify({
      type: 'positive',
      message: 'CQL template copied to clipboard',
      position: 'top',
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to copy template',
      position: 'top',
    })
  }
}

const handleSubmit = async ({ mode, data, changes }) => {
  try {
    if (mode === 'create') {
      // Prepare create data with initial template
      const cqlData = {
        CODE_CD: data.CODE_CD,
        NAME_CHAR: data.NAME_CHAR,
        CQL_CHAR: stringify_char(cqlTemplate.value),
        CQL_BLOB: data.CQL_BLOB || null,
      }

      await cqlStore.createCqlRule(cqlData)

      $q.notify({
        type: 'positive',
        message: 'CQL rule created successfully',
        position: 'top',
      })

      emit('saved', { mode: 'create', rule: cqlData })
      dialogVisible.value = false
    } else {
      // Edit mode - prepare update data
      const updates = {}

      if (changes.NAME_CHAR) {
        updates.NAME_CHAR = data.NAME_CHAR
      }

      if (changes.CQL_BLOB !== undefined) {
        updates.CQL_BLOB = data.CQL_BLOB
      }

      if (changes.CQL_TEXT) {
        updates.CQL_CHAR = stringify_char(data.CQL_TEXT)
      }

      if (Object.keys(updates).length > 0) {
        await cqlStore.updateCqlRule(props.cqlRule.CQL_ID, updates)

        $q.notify({
          type: 'positive',
          message: 'CQL rule updated successfully',
          position: 'top',
        })

        emit('saved', { mode: 'edit', rule: { ...props.cqlRule, ...data } })
        dialogVisible.value = false
      }
    }
  } catch (error) {
    logger.error(`Failed to ${mode} CQL rule`, error)
    $q.notify({
      type: 'negative',
      message: error.message || cqlStore.error || `Failed to ${mode} CQL rule`,
      position: 'top',
    })
  }
}

const handleCancel = () => {
  testResults.value = null
  emit('cancelled')
}

// Initialize CQL data for edit mode
watch(
  () => props.cqlRule,
  async (newRule) => {
    if (props.mode === 'edit' && newRule && newRule.CQL_ID) {
      loading.value = true
      try {
        // Load complete CQL rule data from store
        const fullRule = await cqlStore.getCqlRule(newRule.CQL_ID)

        // Transform CQL data to match form fields
        localFormData.value = {
          CODE_CD: fullRule.CODE_CD || '',
          NAME_CHAR: fullRule.NAME_CHAR || '',
          CQL_BLOB: fullRule.CQL_BLOB || '',
          CQL_TEXT: unstringify_char(fullRule.CQL_CHAR) || '',
        }

        logger.info('Loaded CQL rule for editing', {
          cqlId: fullRule.CQL_ID,
          hasText: !!fullRule.CQL_CHAR,
        })
      } catch (error) {
        logger.error('Failed to load CQL rule for editing', error)
        $q.notify({
          type: 'negative',
          message: 'Failed to load CQL rule data',
          position: 'top',
        })
        // Fallback to provided data
        localFormData.value = {
          CODE_CD: newRule.CODE_CD || '',
          NAME_CHAR: newRule.NAME_CHAR || '',
          CQL_BLOB: newRule.CQL_BLOB || '',
          CQL_TEXT: unstringify_char(newRule.CQL_CHAR) || '',
        }
      } finally {
        loading.value = false
      }
    } else {
      localFormData.value = {
        CODE_CD: '',
        NAME_CHAR: '',
        CQL_BLOB: '',
        CQL_TEXT: '',
      }
    }
  },
  { immediate: true, deep: true },
)
</script>

<style lang="scss" scoped>
.cql-template {
  font-family: 'Courier New', Courier, monospace;
  background-color: #f5f5f5;
}

.cql-editor-container {
  width: calc(100% - 50px);
  .cql-editor {
    font-family: 'Courier New', Courier, monospace;

    :deep(textarea) {
      font-family: 'Courier New', Courier, monospace;
      line-height: 1.5;
    }
  }
}

.test-results {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
