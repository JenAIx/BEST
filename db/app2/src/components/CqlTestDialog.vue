<template>
  <q-dialog v-model="localShow" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Test CQL Rule</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-xs">CQL Rule Information</div>
          <div class="text-body2 text-grey-7"><strong>Code:</strong> {{ cqlRule?.CODE_CD || 'N/A' }}</div>
          <div class="text-body2 text-grey-7"><strong>Name:</strong> {{ cqlRule?.NAME_CHAR || 'N/A' }}</div>
          <div v-if="cqlRule?.CQL_BLOB" class="text-body2 text-grey-7"><strong>Description:</strong> {{ cqlRule.CQL_BLOB }}</div>
        </div>

        <q-separator class="q-my-md" />

        <!-- Test Parameters -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-md">Test Parameters</div>

          <div class="row q-gutter-md">
            <div class="col">
              <q-input v-model="testValue" outlined dense label="Test Value" placeholder="Enter value to test..." :type="getInputType()" :rules="[(val) => !!val || 'Value is required']" />
            </div>
            <div class="col-auto">
              <q-select v-model="valueType" outlined dense :options="valueTypeOptions" label="Value Type" emit-value map-options style="min-width: 120px" />
            </div>
          </div>
        </div>

        <!-- Test Results -->
        <div v-if="testResults.length > 0" class="q-mb-md">
          <div class="text-subtitle2 q-mb-md">Test Results</div>

          <div v-for="(result, index) in testResults" :key="index" class="q-mb-sm">
            <q-card flat bordered>
              <q-card-section class="q-pa-md">
                <div class="row items-center q-gutter-md">
                  <div class="col-auto">
                    <q-icon :name="result.success ? 'check_circle' : 'error'" :color="result.success ? 'positive' : 'negative'" size="md" />
                  </div>
                  <div class="col">
                    <div class="text-weight-medium">
                      {{ result.success ? 'PASS' : 'FAIL' }}
                    </div>
                    <div class="text-caption text-grey-6">
                      {{ result.description }}
                    </div>
                  </div>
                </div>

                <!-- Detailed Results -->
                <div v-if="result.details" class="q-mt-md">
                  <q-expansion-item dense icon="info" label="View Details" class="text-grey-7">
                    <div class="q-pa-md bg-grey-1">
                      <pre class="text-caption">{{ JSON.stringify(result.details, null, 2) }}</pre>
                    </div>
                  </q-expansion-item>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="errorMessage" class="q-mb-md">
          <q-banner class="bg-negative text-white">
            <template v-slot:avatar>
              <q-icon name="error" />
            </template>
            {{ errorMessage }}
          </q-banner>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Close" @click="onCancel" />
        <q-btn color="primary" label="Run Test" :loading="testing" :disable="!canRunTest" @click="runTest" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useCqlStore } from 'src/stores/cql-store'
import { useLoggingStore } from 'src/stores/logging-store'

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

const emit = defineEmits(['update:modelValue', 'cancel'])

const cqlStore = useCqlStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CqlTestDialog')

// State
const localShow = ref(false)
const testValue = ref('')
const valueType = ref('string')
const testResults = ref([])
const errorMessage = ref('')

// Use store state for testing
const testing = computed(() => cqlStore.testing)

// Options
const valueTypeOptions = [
  { label: 'Text', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
]

// Computed
const canRunTest = computed(() => {
  return testValue.value && props.cqlRule && props.cqlRule.JSON_CHAR
})

// Watchers
watch(
  () => props.modelValue,
  (newVal) => {
    localShow.value = newVal
    if (newVal) {
      resetForm()
    }
  },
)

watch(localShow, (newVal) => {
  if (!newVal) {
    emit('update:modelValue', false)
  }
})

// Methods
const resetForm = () => {
  testValue.value = ''
  valueType.value = 'string'
  testResults.value = []
  errorMessage.value = ''
  // Clear store error as well
  cqlStore.clearError()
}

const getInputType = () => {
  switch (valueType.value) {
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    default:
      return 'text'
  }
}

const runTest = async () => {
  if (!canRunTest.value) return

  errorMessage.value = ''
  testResults.value = []

  try {
    // Use store to test CQL rule
    const result = await cqlStore.testCqlRule(props.cqlRule, testValue.value, valueType.value)

    if (result.success) {
      testResults.value = [
        {
          success: result.data.check,
          description: result.data.check ? 'CQL rule validation passed' : 'CQL rule validation failed',
          details: result.data.data,
        },
      ]
    } else {
      errorMessage.value = result.error || 'Unknown error occurred'
    }
  } catch (error) {
    logger.error('CQL test error', error)
    errorMessage.value = error.message || cqlStore.error || 'Failed to execute CQL rule'
  }
}

const onCancel = () => {
  localShow.value = false
  emit('cancel')
}
</script>

<style lang="scss" scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
  margin: 0;
}
</style>
