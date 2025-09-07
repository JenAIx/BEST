<template>
  <q-btn
    v-if="isEmptyObservation"
    flat
    round
    :icon="buttonIcon"
    size="sm"
    :color="buttonColor"
    :disabled="buttonDisabled"
    :loading="duplicating"
    @click="handleClick"
    :class="buttonClass"
  >
    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 5]">
      {{ tooltipText }}
    </q-tooltip>
  </q-btn>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useObservationStore } from 'src/stores/observation-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  conceptCode: {
    type: String,
    required: true,
  },
  patientNum: {
    type: [String, Number],
    required: true,
  },
  currentStartDate: {
    type: String,
    required: true,
  },
  currentValue: {
    type: [String, Number],
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['duplicate-value'])

const observationStore = useObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('DuplicatePreviousValueButton')

// State
const duplicating = ref(false)
const previousValue = ref(null)
const loadingPreviousValue = ref(false)

// Check if this is an empty observation
const isEmptyObservation = computed(() => {
  const value = props.currentValue
  
  // Consider empty if:
  // - null or undefined
  // - empty string
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  
  return false
})

// Button configuration based on whether previous value exists
const buttonIcon = computed(() => {
  if (loadingPreviousValue.value) return 'refresh'
  return previousValue.value ? 'content_copy' : 'info'
})

const buttonColor = computed(() => {
  if (loadingPreviousValue.value) return 'grey-6'
  return previousValue.value ? 'secondary' : 'info'
})

const buttonDisabled = computed(() => {
  // Don't disable the info button - users should be able to hover/click for tooltip
  if (!previousValue.value && !loadingPreviousValue.value) return false
  // Only disable the duplicate button when loading or when disabled prop is true
  return props.loading || props.disabled || loadingPreviousValue.value
})

const buttonClass = computed(() => {
  const baseClass = 'duplicate-btn'
  if (previousValue.value) return `${baseClass} actionable`
  return `${baseClass} info-only`
})

// Tooltip text based on whether previous value exists
const tooltipText = computed(() => {
  if (loadingPreviousValue.value) {
    return 'Loading previous value...'
  }
  
  if (previousValue.value) {
    const value = formatValueForTooltip(previousValue.value.value)
    const date = new Date(previousValue.value.visitDate).toLocaleDateString()
    return `Click to duplicate from ${date}: ${value}`
  }
  
  return 'No historic value found for this observation'
})

// Format value for display in tooltip
const formatValueForTooltip = (value) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string' && value.length > 30) {
    return value.substring(0, 27) + '...'
  }
  return String(value)
}

// Load previous value for this concept using observation store
const loadPreviousValue = async () => {
  try {
    loadingPreviousValue.value = true
    
    logger.debug('Searching for previous observation via store', {
      conceptCode: props.conceptCode,
      patientNum: props.patientNum,
      beforeVisitDate: props.currentStartDate,
    })

    // Use observation store method instead of direct database query
    const previousObservation = await observationStore.findPreviousObservation({
      conceptCode: props.conceptCode,
      patientNum: props.patientNum,
      beforeDate: props.currentStartDate
    })
    
    if (previousObservation) {
      previousValue.value = previousObservation
      
      logger.success('Found previous observation via store', {
        conceptCode: props.conceptCode,
        value: previousObservation.value,
        visitDate: previousObservation.visitDate,
        observationId: previousObservation.observationId,
      })
    } else {
      previousValue.value = null
      logger.info('No previous observation found via store', {
        conceptCode: props.conceptCode,
        patientNum: props.patientNum,
        beforeVisitDate: props.currentStartDate,
      })
    }
    
  } catch (error) {
    logger.error('Failed to find previous observation via store', error, {
      conceptCode: props.conceptCode,
      patientNum: props.patientNum,
    })
    previousValue.value = null
  } finally {
    loadingPreviousValue.value = false
  }
}

// Handle button click - duplicate if value available, otherwise do nothing
const handleClick = async () => {
  // Only duplicate if previous value exists
  if (!previousValue.value) {
    logger.debug('Info button clicked - no previous value to duplicate', {
      conceptCode: props.conceptCode,
    })
    return
  }
  
  try {
    duplicating.value = true
    
    logger.info('Duplicating previous value', {
      conceptCode: props.conceptCode,
      previousValue: previousValue.value.value,
      fromVisitDate: previousValue.value.visitDate,
    })
    
    emit('duplicate-value', {
      conceptCode: props.conceptCode,
      value: previousValue.value.value,
      unit: previousValue.value.unit,
      valueType: previousValue.value.valueType,
      fromVisit: {
        encounterNum: previousValue.value.encounterNum,
        date: previousValue.value.visitDate,
      },
    })
    
  } catch (error) {
    logger.error('Failed to duplicate previous value', error)
  } finally {
    duplicating.value = false
  }
}

// Load previous value on mount
onMounted(async () => {
  if (isEmptyObservation.value) {
    await loadPreviousValue()
  }
})
</script>

<style lang="scss" scoped>
.duplicate-btn {
  transition: all 0.2s ease;
  
  &.actionable {
    &:hover {
      transform: scale(1.05);
    }
  }
  
  &.info-only {
    cursor: default;
    opacity: 0.6;
    
    &:hover {
      // No transform for info-only buttons
      background-color: transparent;
    }
  }
  
  &.q-btn--disabled {
    opacity: 0.5;
  }
}
</style>
