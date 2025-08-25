<template>
  <q-dialog v-model="localShow" persistent>
    <q-card style="min-width: 800px; max-width: 1200px; width: 90vw; max-height: 90vh">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Edit CQL Rule</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section class="q-pa-md" style="max-height: calc(90vh - 120px); overflow-y: auto">
        <!-- Basic Information -->
        <div class="row q-gutter-md q-mb-lg">
          <div class="col-12">
            <div class="text-subtitle1 q-mb-md">Basic Information</div>
            <div class="row q-gutter-md">
              <div class="col-12 col-md-4">
                <q-input v-model="formData.CODE_CD" outlined dense label="Code *" :rules="[(val) => !!val || 'Code is required']" />
              </div>
              <div class="col-12 col-md-4">
                <q-input v-model="formData.NAME_CHAR" outlined dense label="Name *" :rules="[(val) => !!val || 'Name is required']" />
              </div>
              <div class="col-12 col-md-4">
                <q-input v-model="formData.CQL_BLOB" outlined dense label="Description" />
              </div>
            </div>
          </div>
        </div>

        <q-separator class="q-my-lg" />

        <!-- CQL Editor -->
        <div class="row q-gutter-md">
          <div class="col-12">
            <div class="row items-center q-mb-md">
              <div class="text-subtitle1">CQL Rule Editor</div>
              <q-space />
              <q-btn v-if="hasChanges || !formData.JSON_CHAR" round icon="refresh" color="primary" @click="compileRule" :loading="compiling">
                <q-tooltip>Compile CQL to JSON/ELM</q-tooltip>
              </q-btn>
            </div>

            <!-- Mode Toggle -->
            <div class="q-mb-md">
              <q-btn-toggle v-model="editorMode" :options="editorModeOptions" color="primary" toggle-color="primary" />
            </div>

            <!-- CQL Source Editor -->
            <div v-show="editorMode === 'CQL_CHAR'" class="q-mb-md">
              <q-input v-model="formData.CQL_CHAR" type="textarea" outlined label="CQL Source Code" rows="15" class="cql-editor" @update:model-value="onCqlChange" />
            </div>

            <!-- JSON/ELM Viewer -->
            <div v-show="editorMode === 'JSON_CHAR'" class="q-mb-md">
              <q-input v-model="formData.JSON_CHAR" type="textarea" outlined label="Compiled JSON/ELM (Read-only)" rows="15" readonly class="json-viewer" />
            </div>
          </div>
        </div>

        <!-- Test Section -->
        <q-separator class="q-my-lg" />

        <div class="row q-gutter-md">
          <div class="col-12">
            <div class="text-subtitle1 q-mb-md">Test Parameters</div>

            <div class="row items-center q-mb-md">
              <q-btn color="secondary" icon="play_arrow" label="Run Test" @click="runTest" :loading="testing" :disable="!canTest" />
            </div>

            <q-table :rows="testParameters" :columns="testColumns" row-key="id" dense flat bordered>
              <template v-slot:body-cell-value="props">
                <q-td :props="props">
                  <q-input v-model="props.row.value" dense borderless :type="props.row.type === 'number' ? 'number' : props.row.type === 'date' ? 'date' : 'text'" />
                </q-td>
              </template>

              <template v-slot:body-cell-type="props">
                <q-td :props="props">
                  <q-select v-model="props.row.type" :options="typeOptions" dense borderless emit-value map-options />
                </q-td>
              </template>

              <template v-slot:body-cell-result="props">
                <q-td :props="props">
                  <div v-if="props.row.result" class="text-center">
                    <q-icon :name="props.row.result.check ? 'check_circle' : 'error'" :color="props.row.result.check ? 'positive' : 'negative'" size="sm" />
                    <q-tooltip>{{ JSON.stringify(props.row.result.data) }}</q-tooltip>
                  </div>
                </q-td>
              </template>
            </q-table>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" @click="onCancel" />
        <q-btn color="primary" label="Save" :loading="saving" :disable="!isFormValid" @click="onSave" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useLoggingStore } from 'src/stores/logging-store'
import cql from 'cql-execution'
import { unstringify_json, stringify_json, unstringify_char, stringify_char } from 'src/shared/utils/sql-tools.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  cqlRule: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const $q = useQuasar()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CqlEditDialog')

// State
const localShow = ref(false)
const formData = ref({
  CODE_CD: '',
  NAME_CHAR: '',
  CQL_BLOB: '',
  CQL_CHAR: '',
  JSON_CHAR: '',
})
const editorMode = ref('CQL_CHAR')
const hasChanges = ref(false)
const compiling = ref(false)
const testing = ref(false)
const saving = ref(false)

// Test parameters
const testParameters = ref([
  { id: 1, value: 12, type: 'number', result: null },
  { id: 2, value: '10', type: 'string', result: null },
  { id: 3, value: '2010-10-10', type: 'date', result: null },
])

// Options
const editorModeOptions = [
  { label: 'CQL', value: 'CQL_CHAR' },
  { label: 'JSON/ELM', value: 'JSON_CHAR' },
]

const typeOptions = [
  { label: 'Number', value: 'number' },
  { label: 'String', value: 'string' },
  { label: 'Date', value: 'date' },
]

const testColumns = [
  { name: 'id', label: 'Nr.', field: 'id', align: 'center', style: 'width: 50px' },
  { name: 'value', label: 'Value', field: 'value', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'center', style: 'width: 120px' },
  { name: 'result', label: 'Result', field: 'result', align: 'center', style: 'width: 100px' },
]

// Computed
const isFormValid = computed(() => {
  return formData.value.CODE_CD && formData.value.NAME_CHAR
})

const canTest = computed(() => {
  return formData.value.JSON_CHAR && !testing.value
})

// Watchers
watch(
  () => props.modelValue,
  (newVal) => {
    localShow.value = newVal
    if (newVal && props.cqlRule) {
      loadRule()
    }
  },
)

watch(localShow, (newVal) => {
  if (!newVal) {
    emit('update:modelValue', false)
  }
})

// Methods
const loadRule = () => {
  if (props.cqlRule) {
    formData.value = {
      ...props.cqlRule,
      CQL_CHAR: props.cqlRule.CQL_CHAR ? unstringify_char(props.cqlRule.CQL_CHAR) : '',
      JSON_CHAR: props.cqlRule.JSON_CHAR ? unstringify_json(props.cqlRule.JSON_CHAR) : '',
    }
  }
  hasChanges.value = false
  resetTestResults()
}

const onCqlChange = () => {
  hasChanges.value = true
}

const resetTestResults = () => {
  testParameters.value.forEach((param) => {
    param.result = null
  })
}

const compileRule = async () => {
  if (!formData.value.CQL_CHAR) {
    $q.notify({
      type: 'negative',
      message: 'CQL source code is required for compilation',
    })
    return
  }

  compiling.value = true
  try {
    // Call CQL compilation API (localhost:8082)
    const response = await fetch('http://localhost:8082/cql/translator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cql',
        Accept: 'application/elm+json',
      },
      body: formData.value.CQL_CHAR,
    })

    if (!response.ok) {
      throw new Error(`Compilation failed: ${response.statusText}`)
    }

    const compiledJson = await response.json()
    const newJsonString = JSON.stringify(compiledJson)

    if (formData.value.JSON_CHAR !== newJsonString) {
      formData.value.JSON_CHAR = newJsonString
      hasChanges.value = true
      $q.notify({
        type: 'positive',
        message: 'CQL compiled successfully',
      })
      resetTestResults()
    } else {
      $q.notify({
        type: 'info',
        message: 'JSON/ELM is unchanged',
      })
    }
  } catch (error) {
    logger.error('Compilation error', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to compile CQL',
    })
  } finally {
    compiling.value = false
    hasChanges.value = false
  }
}

const runTest = async () => {
  if (!canTest.value) return

  testing.value = true
  try {
    const lib = JSON.parse(formData.value.JSON_CHAR)

    for (const param of testParameters.value) {
      try {
        const result = await executeCqlTest(lib, param.value)
        param.result = result.data
      } catch (error) {
        param.result = {
          check: false,
          data: { error: error.message },
        }
      }
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Test execution failed: ' + error.message,
    })
  } finally {
    testing.value = false
  }
}

const executeCqlTest = async (lib, value) => {
  const cqlLibrary = new cql.Library(lib)
  const patientSource = new cql.PatientSource([])
  const codeService = new cql.CodeService([])
  const parameters = { VALUE: value }
  const executor = new cql.Executor(cqlLibrary, codeService, parameters)

  const result = await executor.exec(patientSource, null)

  if (result && result.unfilteredResults && Object.keys(result.unfilteredResults).length > 0) {
    const data = result.unfilteredResults
    let check = true
    Object.keys(data).forEach((key) => {
      if (data[key] === false) {
        check = false
      }
    })
    return { success: true, data: { check, data } }
  } else {
    return { success: true, data: { data: result, check: false } }
  }
}

const onSave = async () => {
  if (!isFormValid.value) return

  saving.value = true
  try {
    const saveData = {
      ...formData.value,
      CQL_CHAR: formData.value.CQL_CHAR ? stringify_char(formData.value.CQL_CHAR) : null,
      JSON_CHAR: formData.value.JSON_CHAR ? stringify_json(formData.value.JSON_CHAR) : null,
      UPDATE_DATE: new Date().toISOString(),
    }

    emit('save', saveData)
  } finally {
    saving.value = false
  }
}

const onCancel = () => {
  localShow.value = false
  emit('cancel')
}
</script>

<style lang="scss" scoped>
.cql-editor :deep(.q-field__control textarea) {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.4;
}

.json-viewer :deep(.q-field__control textarea) {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.3;
  background-color: #f5f5f5;
}
</style>
