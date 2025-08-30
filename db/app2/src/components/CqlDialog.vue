<template>
  <BaseEntityDialog
    v-model="dialogVisible"
    :mode="mode"
    :entity="cqlRule"
    entity-name="CQL Rule"
    icon="code"
    :size="mode === 'edit' ? 'xl' : 'md'"
    :loading="isSaving"
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
          <q-input
            v-model="formData.NAME_CHAR"
            outlined
            dense
            label="Name *"
            :rules="[(val) => !!val || 'Name is required']"
            :hint="isEditMode ? null : 'Descriptive name for the CQL rule'"
          />
        </div>
        
        <div :class="isEditMode ? 'col-12 col-md' : ''">
          <q-input
            v-model="formData.CQL_BLOB"
            outlined
            dense
            label="Description"
            :hint="isEditMode ? null : 'Optional description of what this rule does'"
          />
        </div>
      </div>

      <!-- CQL Template/Editor -->
      <div v-if="!isEditMode" class="q-mt-lg">
        <div class="text-caption text-grey-6 q-mb-sm">Initial CQL Template</div>
        <q-input
          v-model="cqlTemplate"
          type="textarea"
          outlined
          rows="8"
          readonly
          class="cql-template"
        />
        <div class="text-caption text-grey-6 q-mt-xs">
          This template will be created as the starting point for your CQL rule.
        </div>
      </div>

      <!-- CQL Editor for Edit Mode -->
      <template v-if="isEditMode">
        <q-separator class="q-my-lg" />
        
        <div class="row q-gutter-md">
          <div class="col-12">
            <div class="text-subtitle1 q-mb-md">CQL Definition</div>
            <div class="row q-gutter-md q-mb-md">
              <div class="col-auto">
                <q-btn
                  color="primary"
                  icon="play_arrow"
                  label="Test CQL"
                  @click="testCQL"
                  :loading="testing"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  color="secondary"
                  icon="help_outline"
                  label="CQL Help"
                  @click="showCQLHelp"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  color="accent"
                  icon="content_copy"
                  label="Copy Template"
                  @click="copyTemplate"
                />
              </div>
            </div>
            
            <!-- CQL Editor -->
            <div class="cql-editor-container">
              <q-input
                v-model="formData.CQL_TEXT"
                type="textarea"
                outlined
                rows="20"
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
  <CqlTestDialog
    v-model="showTestDialog"
    :cql-code="localFormData.CODE_CD"
    :cql-text="localFormData.CQL_TEXT"
    @tested="onTestCompleted"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import BaseEntityDialog from './shared/BaseEntityDialog.vue'
import CqlTestDialog from './CqlTestDialog.vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { stringify_char } from 'src/shared/utils/sql-tools.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value)
  },
  cqlRule: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'saved', 'cancelled'])

const $q = useQuasar()
const dbStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CqlDialog')

// State
const isSaving = ref(false)
const testing = ref(false)
const showTestDialog = ref(false)
const testResults = ref(null)
const localFormData = ref({})

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
  set: (value) => emit('update:modelValue', value)
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
  showTestDialog.value = true
}

const onTestCompleted = (results) => {
  testResults.value = results
  showTestDialog.value = false
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
    ok: { label: 'Got it', color: 'primary' }
  })
}

const copyTemplate = async () => {
  try {
    await copyToClipboard(cqlTemplate.value)
    $q.notify({
      type: 'positive',
      message: 'CQL template copied to clipboard',
      position: 'top'
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to copy template',
      position: 'top'
    })
  }
}

const handleSubmit = async ({ mode, data, changes }) => {
  isSaving.value = true
  
  try {
    if (mode === 'create') {
      // Prepare create data with initial template
      const cqlData = {
        TABLE_CD: 'CQL_RULES',
        COLUMN_CD: 'RULE',
        CODE_CD: data.CODE_CD,
        NAME_CHAR: data.NAME_CHAR,
        LOOKUP_BLOB: stringify_char(cqlTemplate.value),
        CQL_BLOB: data.CQL_BLOB || null
      }
      
      // Check if rule already exists
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM CODE_LOOKUP 
        WHERE TABLE_CD = 'CQL_RULES' 
          AND COLUMN_CD = 'RULE' 
          AND CODE_CD = ?
      `
      const checkResult = await dbStore.executeQuery(checkQuery, [data.CODE_CD])
      
      if (checkResult.success && checkResult.data[0].count > 0) {
        throw new Error('CQL rule with this code already exists')
      }
      
      // Create CQL rule
      const insertQuery = `
        INSERT INTO CODE_LOOKUP (
          TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, CQL_BLOB
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
      
      await dbStore.executeCommand(insertQuery, [
        cqlData.TABLE_CD,
        cqlData.COLUMN_CD,
        cqlData.CODE_CD,
        cqlData.NAME_CHAR,
        cqlData.LOOKUP_BLOB,
        cqlData.CQL_BLOB
      ])
      
      $q.notify({
        type: 'positive',
        message: 'CQL rule created successfully',
        position: 'top'
      })
      
      emit('saved', { mode: 'create', rule: cqlData })
      dialogVisible.value = false
      
    } else {
      // Edit mode - prepare update data
      const updates = []
      const params = []
      
      if (changes.NAME_CHAR) {
        updates.push('NAME_CHAR = ?')
        params.push(data.NAME_CHAR)
      }
      
      if (changes.CQL_BLOB !== undefined) {
        updates.push('CQL_BLOB = ?')
        params.push(data.CQL_BLOB)
      }
      
      if (changes.CQL_TEXT) {
        updates.push('LOOKUP_BLOB = ?')
        params.push(stringify_char(data.CQL_TEXT))
      }
      
      if (updates.length > 0) {
        // Add WHERE clause parameters
        params.push('CQL_RULES')
        params.push('RULE')
        params.push(props.cqlRule.CODE_CD)
        
        const updateQuery = `
          UPDATE CODE_LOOKUP 
          SET ${updates.join(', ')}
          WHERE TABLE_CD = ? 
            AND COLUMN_CD = ? 
            AND CODE_CD = ?
        `
        
        await dbStore.executeCommand(updateQuery, params)
        
        $q.notify({
          type: 'positive',
          message: 'CQL rule updated successfully',
          position: 'top'
        })
        
        emit('saved', { mode: 'edit', rule: { ...props.cqlRule, ...data } })
        dialogVisible.value = false
      }
    }
  } catch (error) {
    logger.error(`Failed to ${mode} CQL rule`, error)
    $q.notify({
      type: 'negative',
      message: error.message || `Failed to ${mode} CQL rule`,
      position: 'top'
    })
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  testResults.value = null
  emit('cancelled')
}

// Initialize CQL data for edit mode
watch(() => props.cqlRule, (newRule) => {
  if (props.mode === 'edit' && newRule) {
    // Transform CQL data to match form fields
    localFormData.value = {
      CODE_CD: newRule.CODE_CD || '',
      NAME_CHAR: newRule.NAME_CHAR || '',
      CQL_BLOB: newRule.CQL_BLOB || '',
      CQL_TEXT: newRule.LOOKUP_BLOB || ''
    }
  } else {
    localFormData.value = {
      CODE_CD: '',
      NAME_CHAR: '',
      CQL_BLOB: '',
      CQL_TEXT: ''
    }
  }
}, { immediate: true, deep: true })
</script>

<style lang="scss" scoped>
.cql-template {
  font-family: 'Courier New', Courier, monospace;
  background-color: #f5f5f5;
}

.cql-editor-container {
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
