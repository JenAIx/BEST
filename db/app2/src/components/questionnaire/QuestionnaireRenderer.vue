<template>
  <div v-if="questionnaire" class="questionnaire-renderer">
    <q-card flat class="questionnaire-form">
      <!-- Header -->
      <q-card-section class="questionnaire-header">
        <div class="row items-center no-wrap">
          <div class="col">
            <div class="text-h6" data-cy="questionnaire-title">{{ questionnaire.title }}</div>
            <div v-if="questionnaire.description" class="text-subtitle2 text-grey-7">{{ questionnaire.description }}</div>
          </div>
          <div v-if="showDebugActions" class="col-auto">
            <q-btn flat round icon="more_vert" data-cy="debug-menu">
              <q-menu>
                <q-list>
                  <q-item clickable @click="randomFill" data-cy="random-fill">
                    <q-item-section>Random Fill</q-item-section>
                  </q-item>
                  <q-item clickable @click="clearAll" data-cy="clear-all">
                    <q-item-section>Clear All</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </div>
      </q-card-section>

      <!-- Manual/Instructions -->
      <q-card-section v-if="questionnaire.manual" class="questionnaire-manual">
        <div v-html="questionnaire.manual" class="text-body2"></div>
      </q-card-section>

      <!-- Patient ID Field -->
      <q-card-section v-if="showPatientField">
        <q-input
          v-model="patientId"
          label="Patient ID"
          hint="Enter patient identifier"
          outlined
          dense
          :rules="[(val) => !!val || 'Patient ID is required']"
          :disable="patientIdDisabled"
          data-cy="patient-id"
        />
      </q-card-section>

      <!-- Questions -->
      <q-card-section class="questionnaire-items">
        <q-list bordered separator>
          <q-item v-for="(item, index) in questionnaire.items" :key="`item-${item.id || index}`" class="questionnaire-item" :data-cy="`question-${item.id || index}`">
            <q-item-section>
              <!-- Question Label -->
              <q-item-label class="question-label">
                <span v-html="item.label"></span>
                <span v-if="item.force !== false" class="text-red">*</span>
              </q-item-label>

              <!-- Question Caption -->
              <q-item-label v-if="item.caption" caption>
                <span v-html="item.caption"></span>
              </q-item-label>

              <!-- Question Input -->
              <q-item-label class="question-input q-mt-sm">
                <QuestionInput :item="item" :model-value="getResponse(getItemId(item))" @update:model-value="updateResponse(getItemId(item), $event)" />
              </q-item-label>

              <!-- Validation Error -->
              <q-item-label v-if="showValidation && !isItemValid(item)" class="text-red text-caption q-mt-xs"> This field is required </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- Submit Section -->
      <q-card-section v-if="showSubmitButton" class="questionnaire-actions text-center">
        <q-btn color="primary" label="Submit Questionnaire" @click="onSubmit" :loading="submitting" :disable="!isValid" size="lg" data-cy="submit-questionnaire" />
      </q-card-section>

      <!-- Validation Summary -->
      <q-card-section v-if="showValidation && !isValid" class="validation-summary">
        <q-banner class="bg-red-1 text-red">
          <template v-slot:avatar>
            <q-icon name="warning" />
          </template>
          Please complete all required fields before submitting.
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuestionnaireStore } from '../../stores/questionnaire-store.js'
import { useLoggingStore } from '../../stores/logging-store.js'
import QuestionInput from './QuestionInput.vue'

const props = defineProps({
  questionnaire: {
    type: Object,
    required: true,
  },
  showPatientField: {
    type: Boolean,
    default: true,
  },
  showSubmitButton: {
    type: Boolean,
    default: true,
  },
  showDebugActions: {
    type: Boolean,
    default: false,
  },
  patientIdDisabled: {
    type: Boolean,
    default: false,
  },
  initialPatientId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['submit', 'validation-change'])

// Store
const questionnaireStore = useQuestionnaireStore()
const loggingStore = useLoggingStore()

// State
const patientId = ref(props.initialPatientId)
const showValidation = ref(false)
const submitting = ref(false)

// Computed
const isValid = computed(() => {
  if (props.showPatientField && !patientId.value) return false

  const requiredItems = props.questionnaire.items.filter((item) => item.force !== false && item.type !== 'separator' && item.type !== 'textbox' && item.id)

  return requiredItems.every((item) => isItemValid(item))
})

// Methods
const getItemId = (item) => {
  // For multiple_radio questions, item.id is an array, use the first element
  if (item.type === 'multiple_radio' && Array.isArray(item.id)) {
    return item.id[0] || item.id
  }
  return item.id
}

const getResponse = (itemId) => {
  return questionnaireStore.getResponse(itemId)
}

const updateResponse = (itemId, value) => {
  questionnaireStore.updateResponse(itemId, value)
}

const isItemValid = (item) => {
  if (item.force === false) return true
  if (!item.id) return true

  const itemId = getItemId(item)
  const response = getResponse(itemId)

  // For multiple_radio, check if array has at least one non-null/undefined value
  // Note: 0 is a valid value (e.g., "Nein" = 0), so we only check for null/undefined
  if (item.type === 'multiple_radio' && Array.isArray(response)) {
    return response.some((value) => value !== null && value !== undefined)
  }

  // For other types, 0 is also a valid value, only exclude null, undefined, and empty string
  return response !== undefined && response !== null && response !== ''
}

const onSubmit = async () => {
  showValidation.value = true

  if (!isValid.value) {
    return
  }

  submitting.value = true

  try {
    const results = questionnaireStore.calculateResults()

    emit('submit', {
      patientId: patientId.value,
      results: results,
    })
  } catch (error) {
    loggingStore.error('QuestionnaireRenderer', 'Error during questionnaire submission', error, {
      patientId: patientId.value,
      questionnaireTitle: props.questionnaire?.title,
      hasResults: !!questionnaireStore.calculateResults(),
    })
  } finally {
    submitting.value = false
  }
}

const randomFill = () => {
  questionnaireStore.randomFill()
  if (props.showPatientField && !patientId.value) {
    patientId.value = `TEST_${Date.now()}`
  }
}

const clearAll = () => {
  if (props.questionnaire.items) {
    props.questionnaire.items.forEach((item) => {
      if (item.id) {
        const itemId = getItemId(item)
        if (item.type === 'multiple_radio' && Array.isArray(item.id)) {
          // Reset to array of nulls for multiple_radio
          questionnaireStore.updateResponse(itemId, new Array(item.id.length).fill(null))
        } else {
          questionnaireStore.updateResponse(itemId, null)
        }
      }
    })
  }
  if (!props.patientIdDisabled) {
    patientId.value = ''
  }
  showValidation.value = false
}

// Watch for validation changes
watch(
  isValid,
  (newValue) => {
    emit('validation-change', newValue)
  },
  { immediate: true },
)

// Watch for patient ID changes
watch(
  () => props.initialPatientId,
  (newValue) => {
    patientId.value = newValue
  },
)
</script>

<style scoped>
.questionnaire-renderer {
  max-width: 800px;
  margin: 0 auto;
}

.questionnaire-form {
  margin-bottom: 2rem;
}

.questionnaire-header {
  border-bottom: 1px solid #e0e0e0;
}

.questionnaire-manual {
  background-color: #f5f5f5;
  border-left: 4px solid #1976d2;
}

.questionnaire-item {
  padding: 1rem;
}

.question-label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.question-input {
  margin-top: 0.5rem;
}

.questionnaire-actions {
  padding: 2rem 1rem;
  border-top: 1px solid #e0e0e0;
}

.validation-summary {
  padding-top: 0;
}

/* Deep selector for HTML content */
:deep(.question-label span) {
  line-height: 1.4;
}

:deep(.questionnaire-manual span) {
  line-height: 1.5;
}
</style>
