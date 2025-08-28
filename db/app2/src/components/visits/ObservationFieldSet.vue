<template>
  <div class="field-set-section">
    <div class="field-set-header cursor-pointer" @click="collapsed = !collapsed">
      <div class="field-set-title">
        <q-icon :name="fieldSet.icon" size="24px" class="q-mr-sm" />
        {{ fieldSet.name }}
        <!-- Show observation counts when collapsed -->
        <div v-if="collapsed && observationCount > 0" class="observation-badges q-ml-sm">
          <q-badge v-if="filledObservationCount > 0" :label="filledObservationCount" color="positive" class="observation-count-badge">
            <q-tooltip>{{ filledObservationCount }} filled observation{{ filledObservationCount > 1 ? 's' : '' }}</q-tooltip>
          </q-badge>
          <q-badge v-if="unfilledObservationCount > 0" :label="unfilledObservationCount" color="grey-5" class="observation-count-badge unfilled-badge">
            <q-tooltip>{{ unfilledObservationCount }} unfilled observation{{ unfilledObservationCount > 1 ? 's' : '' }}</q-tooltip>
          </q-badge>
        </div>
      </div>
      <q-icon name="expand_more" size="20px" class="expand-icon" :class="{ 'rotate-180': !collapsed }">
        <q-tooltip>{{ collapsed ? 'Expand' : 'Collapse' }}</q-tooltip>
      </q-icon>
    </div>

    <q-slide-transition>
      <div v-show="!collapsed" class="field-set-content">
        <!-- Filled Observations Grid -->
        <div class="observation-grid">
          <!-- Medication Fields - Render one field per observation, not per concept -->
          <MedicationField
            v-for="observation in medicationObservations"
            :key="`medication-${observation.observationId || observation.tempId}`"
            :concept="{ code: observation.conceptCode, name: 'Current Medication', valueType: 'M' }"
            :visit="visit"
            :patient="patient"
            :existing-observation="observation"
            :previous-value="getPreviousValue(observation.conceptCode)"
            @observation-updated="onObservationUpdated"
            @clone-requested="onCloneRequested"
          />

          <!-- Regular Observation Fields - Render each unique observation only once -->
          <ObservationField
            v-for="observationWithConcept in filledObservationsWithConcepts"
            :key="`obs-${observationWithConcept.observation.observationId}`"
            :concept="observationWithConcept.concept"
            :visit="visit"
            :patient="patient"
            :existing-observation="observationWithConcept.observation"
            :previous-value="getPreviousValue(observationWithConcept.concept.code)"
            @observation-updated="onObservationUpdated"
            @clone-requested="onCloneRequested"
          />
        </div>

        <!-- Unfilled Observations - Compact Chips -->
        <div v-if="unfilledConcepts.length > 0" class="unfilled-observations">
          <div class="unfilled-section-header">
            <q-icon name="add_circle_outline" size="16px" class="q-mr-xs" />
            <span class="section-title">Available Observations</span>
            <q-badge :label="unfilledConcepts.length" color="grey-5" class="q-ml-sm" />
          </div>
          <div class="unfilled-chips">
            <q-chip
              v-for="concept in unfilledConcepts"
              :key="`unfilled-${concept.code}`"
              clickable
              outline
              icon="add"
              :label="concept.name"
              color="grey-6"
              text-color="grey-7"
              class="unfilled-chip"
              @click="createObservationFromChip(concept)"
            >
              <q-tooltip>Click to add {{ concept.name }}, {{ concept }}</q-tooltip>
            </q-chip>
          </div>
        </div>

        <!-- Add custom observation -->
        <div class="add-custom-observation">
          <q-btn
            flat
            icon="add"
            :label="props.fieldSet.id === 'medications' ? 'Add Medication' : 'Add Custom Observation'"
            @click="props.fieldSet.id === 'medications' ? addEmptyMedication() : (showAddCustomDialog = true)"
            class="full-width"
            style="border: 2px dashed #ccc"
          />
        </div>
      </div>
    </q-slide-transition>

    <!-- Custom Observation Dialog Component -->
    <CustomObservationDialog
      v-model="showAddCustomDialog"
      :visit="visit"
      :patient="patient"
      :field-set-name="fieldSet.name"
      :field-set-id="fieldSet.id"
      @observation-added="onCustomObservationAdded"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import ObservationField from './ObservationField.vue'
import MedicationField from './MedicationField.vue'
import CustomObservationDialog from './CustomObservationDialog.vue'

const props = defineProps({
  fieldSet: {
    type: Object,
    required: true,
  },
  visit: {
    type: Object,
    required: true,
  },
  patient: {
    type: Object,
    required: true,
  },
  previousVisits: {
    type: Array,
    default: () => [],
  },
  existingObservations: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['observation-updated', 'clone-from-previous'])

const $q = useQuasar()
const visitStore = useVisitObservationStore()
const loggingStore = useLoggingStore()
const conceptStore = useConceptResolutionStore()
const logger = loggingStore.createLogger('ObservationFieldSet')

// State
const collapsed = ref(false)
const showAddCustomDialog = ref(false)
const removedConcepts = ref(new Set()) // Track concepts removed by user
const resolvedConceptData = ref(new Map()) // Cache for resolved concept data (names, valueType, unit)

// Component mounted
onMounted(async () => {
  logger.info('ObservationFieldSet mounted', {
    fieldSetId: props.fieldSet?.id,
    fieldSetName: props.fieldSet?.name,
    visitId: props.visit?.id,
    patientId: props.patient?.id,
    existingObservationsCount: props.existingObservations?.length || 0,
    fieldSetConceptsCount: props.fieldSet?.concepts?.length || 0,
    fieldSetConcepts: props.fieldSet?.concepts,
  })

  // Resolve concept names for all concepts in the field set
  await resolveFieldSetConceptNames()
})

// Resolve concept names using concept resolution store
const resolveFieldSetConceptNames = async () => {
  if (!props.fieldSet?.concepts?.length) return

  try {
    logger.debug('Resolving concept names for field set', {
      fieldSetId: props.fieldSet.id,
      conceptCount: props.fieldSet.concepts.length,
    })

    // Resolve all concepts in batch for better performance
    const conceptMap = await conceptStore.resolveBatch(props.fieldSet.concepts, {
      context: 'observation',
      table: 'CONCEPT_DIMENSION',
      column: 'CONCEPT_CD',
    })

    // Update the reactive map with full concept data
    for (const [conceptCode, resolved] of conceptMap) {
      resolvedConceptData.value.set(conceptCode, {
        label: resolved.label || conceptCode,
        valueType: resolved.valueType,
        unit: resolved.unit,
      })
    }

    logger.success('Concept names resolved successfully', {
      fieldSetId: props.fieldSet.id,
      resolvedCount: conceptMap.size,
    })
  } catch (error) {
    logger.error('Failed to resolve concept names', error, {
      fieldSetId: props.fieldSet.id,
      conceptCount: props.fieldSet.concepts?.length || 0,
    })
  }
}

// Computed
const fieldSetConcepts = computed(() => {
  // Convert field set concepts to detailed concept objects, filtering out removed ones
  return (
    props.fieldSet.concepts
      ?.filter((conceptCode) => !removedConcepts.value.has(conceptCode)) // Filter out removed concepts
      ?.map((conceptCode) => {
        const [system, code] = conceptCode.split(':')
        const resolvedData = resolvedConceptData.value.get(conceptCode)
        return {
          code: conceptCode,
          system,
          localCode: code,
          name: resolvedData?.label || getConceptName(conceptCode),
          valueType: resolvedData?.valueType || getConceptValueType(conceptCode),
          unit: resolvedData?.unit || getConceptUnit(conceptCode),
        }
      }) || []
  )
})

const observationCount = computed(() => {
  return props.existingObservations?.length || 0
})

// Count filled vs unfilled observations
const filledObservationCount = computed(() => {
  if (!props.existingObservations) return 0
  return props.existingObservations.filter((obs) => {
    const value = obs.originalValue || obs.value || obs.tval_char || obs.nval_num
    return value !== null && value !== undefined && value !== ''
  }).length
})

const unfilledObservationCount = computed(() => {
  return observationCount.value - filledObservationCount.value
})

// Medication observations - for medications, we render one field per observation (not per concept)
const medicationObservations = computed(() => {
  if (props.fieldSet.id !== 'medications') return []

  logger.debug('Computing medication observations', {
    fieldSetId: props.fieldSet.id,
    visitId: props.visit.id,
    existingObservationsCount: props.existingObservations?.length || 0,
  })

  // Get all medication observations for the current encounter only
  const medObservations =
    props.existingObservations?.filter((obs) => {
      // Must match the current visit's encounter number
      const encounterMatch = obs.encounterNum === props.visit.id || obs.ENCOUNTER_NUM === props.visit.id

      // Must be a medication observation
      const isMedication = obs.conceptCode === 'LID: 52418-1' || obs.valTypeCode === 'M' || (obs.conceptCode && obs.conceptCode.includes('52418'))

      return encounterMatch && isMedication
    }) || []

  // Sort medications by category and then by creation date
  medObservations.sort((a, b) => {
    const categoryA = a.category || a.CATEGORY_CHAR || 'ZZZZZ'
    const categoryB = b.category || b.CATEGORY_CHAR || 'ZZZZZ'

    // Primary sort by category
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB)
    }

    // Secondary sort by date (newest first for medications)
    const dateA = new Date(a.startDate || a.START_DATE || a.date || 0)
    const dateB = new Date(b.startDate || b.START_DATE || b.date || 0)
    return dateB - dateA
  })

  logger.debug('Filtered medication observations', {
    visitId: props.visit.id,
    medicationObservationsCount: medObservations.length,
    medicationObservations: medObservations.map((obs) => ({
      id: obs.observationId,
      encounterNum: obs.encounterNum || obs.ENCOUNTER_NUM,
      conceptCode: obs.conceptCode,
      category: obs.category || obs.CATEGORY_CHAR,
      value: obs.originalValue || obs.value,
    })),
  })

  return medObservations
})

// Create unique observation-concept pairs to avoid duplicates
const filledObservationsWithConcepts = computed(() => {
  const result = []
  const processedObservationIds = new Set()

  // Filter observations for the current encounter (visit) only
  const currentEncounterObservations =
    props.existingObservations?.filter((obs) => {
      // Must match the current visit's encounter number
      const encounterMatch = obs.encounterNum === props.visit.id || obs.ENCOUNTER_NUM === props.visit.id

      // Exclude medications (handled separately)
      const notMedication = obs.valTypeCode !== 'M' && !obs.conceptCode?.includes('52418')

      return encounterMatch && notMedication
    }) || []

  logger.debug('Filtered observations for current encounter', {
    visitId: props.visit.id,
    totalObservations: props.existingObservations?.length || 0,
    currentEncounterObservations: currentEncounterObservations.length,
    encounterObservations: currentEncounterObservations.map((obs) => ({
      id: obs.observationId,
      encounterNum: obs.encounterNum || obs.ENCOUNTER_NUM,
      conceptCode: obs.conceptCode,
      category: obs.category || obs.CATEGORY_CHAR,
    })),
  })

  // For each observation, find the best matching concept
  for (const observation of currentEncounterObservations) {
    // Skip if we've already processed this observation
    if (processedObservationIds.has(observation.observationId)) {
      continue
    }

    // Find the best matching concept for this observation
    const matchingConcept = findBestMatchingConcept(observation)

    if (matchingConcept) {
      result.push({
        observation,
        concept: matchingConcept,
      })
      processedObservationIds.add(observation.observationId)

      logger.debug('Paired observation with concept', {
        observationId: observation.observationId,
        observationConceptCode: observation.conceptCode,
        matchedConceptCode: matchingConcept.code,
        value: observation.originalValue || observation.value,
        category: observation.category || observation.CATEGORY_CHAR,
      })
    }
  }

  // Sort by category for better organization
  result.sort((a, b) => {
    const categoryA = a.observation.category || a.observation.CATEGORY_CHAR || 'ZZZZZ' // Put unknown categories at the end
    const categoryB = b.observation.category || b.observation.CATEGORY_CHAR || 'ZZZZZ'

    // Primary sort by category
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB)
    }

    // Secondary sort by concept name for same category
    const conceptNameA = a.concept.name || a.concept.code
    const conceptNameB = b.concept.name || b.concept.code
    return conceptNameA.localeCompare(conceptNameB)
  })

  logger.debug('filledObservationsWithConcepts computed', {
    visitId: props.visit.id,
    totalObservations: currentEncounterObservations.length,
    pairedObservations: result.length,
    processedIds: Array.from(processedObservationIds),
    categoriesFound: [...new Set(result.map((item) => item.observation.category || item.observation.CATEGORY_CHAR))],
  })

  return result
})

// Unfilled concepts - concepts that don't have any existing observations
const unfilledConcepts = computed(() => {
  const filledConceptCodes = new Set(filledObservationsWithConcepts.value.map((item) => item.concept.code))

  return fieldSetConcepts.value.filter((concept) => {
    // Skip medications as they are handled differently
    if (concept.valueType === 'M') return false

    // Check if this concept is already paired with an observation
    return !filledConceptCodes.has(concept.code)
  })
})

// Methods
const findBestMatchingConcept = (observation) => {
  const obsConceptCode = observation.conceptCode

  // Find all potential matching concepts
  const matches = fieldSetConcepts.value.filter((concept) => {
    // Skip medications
    if (concept.valueType === 'M') return false

    // 1. Exact match (highest priority)
    if (concept.code === obsConceptCode) return true

    // 2. Extract numeric codes and compare (e.g., "LOINC:8867-4" vs "LID: 8867-4")
    const conceptMatch = concept.code.match(/[:\s]([0-9-]+)$/)
    const obsMatch = obsConceptCode.match(/[:\s]([0-9-]+)$/)
    if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) return true

    return false
  })

  if (matches.length === 0) {
    logger.warn('No matching concept found for observation', {
      observationId: observation.observationId,
      obsConceptCode,
      availableConcepts: fieldSetConcepts.value.map((c) => c.code),
    })
    return null
  }

  // Prefer exact matches first, then numeric matches
  const exactMatch = matches.find((concept) => concept.code === obsConceptCode)
  if (exactMatch) {
    return exactMatch
  }

  // Return the first numeric match
  return matches[0]
}

const getConceptName = (conceptCode) => {
  // Fallback: extract the code part after the colon if no database name is available
  // All concept names should come from CONCEPT_DIMENSION.NAME_CHAR via concept resolution
  const parts = conceptCode.split(':')
  return parts.length > 1 ? parts[1] : conceptCode
}

const getConceptValueType = (conceptCode) => {
  // Fallback logic - all value types should come from CONCEPT_DIMENSION.VALTYPE_CD
  // This is only used when database resolution fails

  // Basic heuristics for common patterns
  if (conceptCode.includes('52418')) return 'M' // Medication concept
  if (conceptCode.includes('8480') || conceptCode.includes('8462') || conceptCode.includes('8867') || conceptCode.includes('8310') || conceptCode.includes('9279') || conceptCode.includes('2708')) {
    return 'N' // Common vital signs are numeric
  }

  return 'T' // Default to text
}

const getConceptUnit = (conceptCode) => {
  // Fallback logic - all units should come from CONCEPT_DIMENSION.UNIT_CD
  // This is only used when database resolution fails

  // Basic heuristics for common vital signs
  if (conceptCode.includes('8480') || conceptCode.includes('8462')) return 'mmHg'
  if (conceptCode.includes('8867')) return 'bpm'
  if (conceptCode.includes('8310')) return '°C'
  if (conceptCode.includes('9279')) return '/min'
  if (conceptCode.includes('2708')) return '%'

  return '' // No unit by default
}

// Legacy function - replaced by filledObservationsWithConcepts approach
// const getExistingObservations = (conceptCode) => {
//   // This function has been replaced with a more precise matching approach
//   // to prevent duplicate observations from being displayed
// }

// Note: getExistingObservation (singular) has been replaced with getExistingObservations (plural)
// to properly handle multiple observations with the same concept code

const getPreviousValue = (conceptCode) => {
  // Get the most recent value from previous visits
  if (!props.previousVisits.length) return null

  // Look through previous visits for this concept
  // This is a placeholder implementation - in a real scenario, we would
  // need to load and cache observation data for previous visits

  // For now, we acknowledge the conceptCode parameter to satisfy ESLint
  // and return null since the actual previous value lookup is handled
  // by the clone functionality in the parent components
  logger.debug('Looking for previous value for concept', { conceptCode })

  return null
}

const onObservationUpdated = (data) => {
  // Handle removal of empty medication fields
  if (data.remove && data.conceptCode) {
    removedConcepts.value.add(data.conceptCode)
    logger.info('Concept removed from UI', {
      conceptCode: data.conceptCode,
      fieldSetId: props.fieldSet.id,
    })
  }

  emit('observation-updated', data)
}

const onCloneRequested = (data) => {
  emit('clone-from-previous', data)
}

// Method to restore a removed concept (if needed for "undo" functionality)
// Currently unused - for future implementation
// const restoreRemovedConcept = (conceptCode) => {
//   removedConcepts.value.delete(conceptCode)
//   logger.info('Concept restored to UI', {
//     conceptCode,
//     fieldSetId: props.fieldSet.id,
//   })
// }

const addEmptyMedication = async () => {
  try {
    // Create empty medication observation with LID: 52418-1
    // The visit store will automatically set PROVIDER_ID, SOURCESYSTEM_CD, and CATEGORY_CHAR from the concept
    const observationData = {
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: 'LID: 52418-1', // Use the specific medication concept
      VALTYPE_CD: 'M', // Medication type
      TVAL_CHAR: '', // Empty drug name initially
      NVAL_NUM: null, // No dosage initially
      UNIT_CD: null, // No unit initially
      OBSERVATION_BLOB: null, // No complex data initially
      START_DATE: new Date().toISOString().split('T')[0],
      LOCATION_CD: 'VISITS_PAGE',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
      // Note: PROVIDER_ID, SOURCESYSTEM_CD, and CATEGORY_CHAR will be set automatically by the store
    }

    // Use visit store to create observation - it handles patient lookup and state updates
    await visitStore.createObservation(observationData)

    // Emit update to refresh the field set
    emit('observation-updated', {
      conceptCode: 'LID: 52418-1',
      value: '',
      added: true,
    })

    logger.info('Empty medication added successfully', {
      conceptCode: 'LID: 52418-1',
      patientId: props.patient.id,
      visitId: props.visit.id,
    })

    $q.notify({
      type: 'positive',
      message: 'Empty medication slot added',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to add empty medication', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add medication',
      position: 'top',
    })
  }
}

const onCustomObservationAdded = (data) => {
  logger.info('Custom observation added', {
    conceptCode: data.conceptCode,
    value: data.value,
    unit: data.unit,
    fieldSetId: props.fieldSet.id,
  })

  // Emit the observation update to parent
  emit('observation-updated', data)
}

const createObservationFromChip = async (concept) => {
  try {
    logger.info('Creating observation from chip', {
      conceptCode: concept.code,
      conceptName: concept.name,
      resolvedName: resolvedConceptData.value.get(concept.code)?.label,
      fieldSetId: props.fieldSet.id,
    })

    // Get default values from global settings store if available
    const observationData = {
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: concept.code,
      VALTYPE_CD: concept.valueType,
      START_DATE: new Date().toISOString().split('T')[0],
      LOCATION_CD: 'VISITS_PAGE',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
      // Initialize with empty values based on type
      TVAL_CHAR: concept.valueType === 'N' ? null : '',
      NVAL_NUM: concept.valueType === 'N' ? null : null,
      UNIT_CD: concept.unit || null,
      OBSERVATION_BLOB: null,
    }

    // Use visit store to create observation - it handles patient lookup and state updates
    await visitStore.createObservation(observationData)

    // Emit update to refresh the field set
    emit('observation-updated', {
      conceptCode: concept.code,
      value: concept.valueType === 'N' ? null : '',
      added: true,
    })

    logger.success('Observation created from chip successfully', {
      conceptCode: concept.code,
      conceptName: concept.name,
      patientId: props.patient.id,
      visitId: props.visit.id,
    })

    const displayName = resolvedConceptData.value.get(concept.code)?.label || concept.name
    $q.notify({
      type: 'positive',
      message: `${displayName} observation added`,
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to create observation from chip', error, {
      conceptCode: concept.code,
      conceptName: concept.name,
      errorMessage: error.message,
      errorStack: error.stack,
    })

    // Check for specific error types and provide appropriate messages
    const displayName = resolvedConceptData.value.get(concept.code)?.label || concept.name
    let errorMessage = `Failed to add ${displayName}`
    let errorDetails = ''

    if (error.message?.includes('FOREIGN KEY constraint failed') || error.message?.includes('Concept not found')) {
      errorMessage = `Concept "${displayName}" not found in database`
      errorDetails = `The concept code "${concept.code}" needs to be added to the CONCEPT_DIMENSION table before observations can be created.`

      logger.warn('Concept missing from database', {
        conceptCode: concept.code,
        conceptName: concept.name,
        suggestion: 'Add concept to CONCEPT_DIMENSION table or update field set configuration',
      })
    } else if (error.message?.includes('SQLITE_CONSTRAINT')) {
      errorMessage = `Database constraint error`
      errorDetails = `There was a database constraint violation when trying to create the observation. This may be due to missing reference data.`
    } else if (error.message?.includes('Failed to create entity')) {
      errorMessage = `Failed to create observation`
      errorDetails = `The observation could not be saved to the database. Please check the database configuration.`
    }

    // Show user-friendly error notification
    $q.notify({
      type: 'negative',
      message: errorMessage,
      caption: errorDetails,
      position: 'top',
      timeout: 6000, // Show longer for error messages
      actions: [
        {
          label: 'Dismiss',
          color: 'white',
          handler: () => {},
        },
      ],
    })

    // For missing concepts, also show a dialog with more information
    if (error.message?.includes('FOREIGN KEY constraint failed') || error.message?.includes('Concept not found')) {
      $q.dialog({
        title: 'Concept Not Found',
        message: `The concept "${displayName}" (${concept.code}) is not available in the database.`,
        html: true,
        ok: {
          label: 'OK',
          color: 'primary',
        },
      }).onOk(() => {
        logger.info('User acknowledged missing concept dialog', {
          conceptCode: concept.code,
          conceptName: concept.name,
          resolvedName: displayName,
        })
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.field-set-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.field-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: $grey-1;
  border-bottom: 1px solid $grey-3;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: $grey-2;

    .expand-icon {
      color: $primary;
      transform: scale(1.1);
    }
  }

  .field-set-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: $grey-8;
    display: flex;
    align-items: center;

    .observation-badges {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    .observation-count-badge {
      font-size: 0.75rem;
      font-weight: 500;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;

      &.unfilled-badge {
        opacity: 0.8;
        border: 1px solid $grey-4;
      }
    }
  }

  .expand-icon {
    color: $grey-6;
    transition: all 0.3s ease;
  }
}

.field-set-content {
  padding: 1.5rem;
}

.observation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;

  // For medication fields with col-12 class, make them span full width
  :deep(.medication-field.col-12) {
    grid-column: 1 / -1;
  }
}

.unfilled-observations {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed $grey-4;

  .unfilled-section-header {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
    color: $grey-6;

    .section-title {
      font-size: 0.875rem;
      font-weight: 500;
    }
  }

  .unfilled-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;

    .unfilled-chip {
      transition: all 0.2s ease;
      cursor: pointer;
      font-size: 0.75rem;

      &:hover {
        background-color: rgba($primary, 0.08);
        border-color: $primary;
        color: $primary;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba($primary, 0.15);

        :deep(.q-icon) {
          color: $primary;
        }
      }

      &:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba($primary, 0.1);
      }

      :deep(.q-chip__content) {
        padding: 4px 8px;
      }

      :deep(.q-icon) {
        font-size: 14px;
        margin-right: 4px;
        transition: color 0.2s ease;
      }
    }
  }
}

.add-custom-observation {
  margin-top: 1rem;

  .q-btn {
    color: $grey-6;
    transition: all 0.3s ease;

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
}

.expand-icon.rotate-180 {
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .field-set-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .observation-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
