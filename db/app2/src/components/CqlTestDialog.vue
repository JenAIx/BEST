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
                    <div class="text-body2 text-grey-7">
                        <strong>Code:</strong> {{ cqlRule?.CODE_CD || 'N/A' }}
                    </div>
                    <div class="text-body2 text-grey-7">
                        <strong>Name:</strong> {{ cqlRule?.NAME_CHAR || 'N/A' }}
                    </div>
                    <div v-if="cqlRule?.CQL_BLOB" class="text-body2 text-grey-7">
                        <strong>Description:</strong> {{ cqlRule.CQL_BLOB }}
                    </div>
                </div>

                <q-separator class="q-my-md" />

                <!-- Test Parameters -->
                <div class="q-mb-md">
                    <div class="text-subtitle2 q-mb-md">Test Parameters</div>

                    <div class="row q-gutter-md">
                        <div class="col">
                            <q-input v-model="testValue" outlined dense label="Test Value"
                                placeholder="Enter value to test..." :type="getInputType()"
                                :rules="[val => !!val || 'Value is required']" />
                        </div>
                        <div class="col-auto">
                            <q-select v-model="valueType" outlined dense :options="valueTypeOptions" label="Value Type"
                                emit-value map-options style="min-width: 120px" />
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
                                        <q-icon :name="result.success ? 'check_circle' : 'error'"
                                            :color="result.success ? 'positive' : 'negative'" size="md" />
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
                                            <pre
                                                class="text-caption">{{ JSON.stringify(result.details, null, 2) }}</pre>
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
import cql from 'cql-execution'
import { unstringify_json } from 'src/utils/sql-tools.js'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    cqlRule: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'cancel'])

// State
const localShow = ref(false)
const testValue = ref('')
const valueType = ref('string')
const testing = ref(false)
const testResults = ref([])
const errorMessage = ref('')

// Options
const valueTypeOptions = [
    { label: 'Text', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Date', value: 'date' }
]

// Computed
const canRunTest = computed(() => {
    return testValue.value && props.cqlRule && props.cqlRule.JSON_CHAR
})

// Watchers
watch(() => props.modelValue, (newVal) => {
    localShow.value = newVal
    if (newVal) {
        resetForm()
    }
})

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
    testing.value = false
}

const getInputType = () => {
    switch (valueType.value) {
        case 'number': return 'number'
        case 'date': return 'date'
        default: return 'text'
    }
}

const runTest = async () => {
    if (!canRunTest.value) return

    testing.value = true
    errorMessage.value = ''
    testResults.value = []

    try {
        // Convert test value based on type
        let processedValue = testValue.value
        if (valueType.value === 'number') {
            processedValue = parseFloat(testValue.value)
            if (isNaN(processedValue)) {
                throw new Error('Invalid number format')
            }
        }

        // Execute CQL rule
        const result = await executeCqlRule(props.cqlRule, processedValue)

        if (result.success) {
            testResults.value = [{
                success: result.data.check,
                description: result.data.check
                    ? 'CQL rule validation passed'
                    : 'CQL rule validation failed',
                details: result.data.data
            }]
        } else {
            errorMessage.value = result.error || 'Unknown error occurred'
        }

    } catch (error) {
        console.error('CQL test error:', error)
        errorMessage.value = error.message || 'Failed to execute CQL rule'
    } finally {
        testing.value = false
    }
}

const executeCqlRule = async (rule, value) => {
    try {
        // Check if rule has compiled JSON
        if (!rule.JSON_CHAR) {
            return {
                success: false,
                error: 'CQL rule has no compiled JSON. Please compile the rule first.'
            }
        }

        // Parse the JSON_CHAR using the unstringify_json utility
        let lib
        try {
            // Convert single quotes to double quotes and parse
            const jsonString = unstringify_json(rule.JSON_CHAR)
            lib = JSON.parse(jsonString)
        } catch (error) {
            return {
                success: false,
                error: 'Invalid JSON format in CQL rule: ' + error.message
            }
        }

        // Execute CQL using the cql-execution library
        return await executeCqlWithLibrary(lib, value)

    } catch (error) {
        return {
            success: false,
            error: error.message || 'CQL execution failed'
        }
    }
}

const executeCqlWithLibrary = async (lib, value) => {
    try {
        // Validate payload
        if (!lib || typeof lib !== "object") {
            return { success: false, error: "Invalid CQL library format" }
        }

        // Initialize CQL library
        let cqlLibrary
        try {
            cqlLibrary = new cql.Library(lib)
        } catch (err) {
            return {
                success: false,
                error: "Failed to initialize CQL library: " + (err.message || err)
            }
        }

        // Set up CQL execution environment
        const patientSource = new cql.PatientSource([])
        const codeService = new cql.CodeService([])
        const executionDateTime = null

        // Create parameters object - CQL rules expect a VALUE parameter
        const parameters = { VALUE: value }

        // Create executor
        const executor = new cql.Executor(cqlLibrary, codeService, parameters)

        // Execute CQL
        try {
            const result = await executor.exec(patientSource, executionDateTime)

            if (result && result.unfilteredResults && Object.keys(result.unfilteredResults).length > 0) {
                const data = result.unfilteredResults

                // Check if all results are true (following the old logic)
                let check = true
                Object.keys(data).forEach((key) => {
                    if (data[key] === false) {
                        check = false
                    }
                })

                return {
                    success: true,
                    data: { check, data }
                }
            } else {
                return {
                    success: true,
                    data: { data: result, check: false }
                }
            }
        } catch (execError) {
            return {
                success: false,
                error: execError.message || execError.toString()
            }
        }

    } catch (error) {
        return {
            success: false,
            error: "CQL execution error: " + (error.message || error)
        }
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
