<template>
  <!-- Edit rendering of one field group as a CRF-style form grid: every
       field-set concept is a labeled field (filled or empty — empty ones
       create the observation on first input), content decides the width.
       Reuses ObservationValueEditor per value type; save/create payloads
       share the exact legacy semantics via observation-display.js. -->
  <div class="form-group" :data-group-name="fieldSet.name">
    <div class="form-group-head">
      <q-icon :name="fieldSet.icon || 'category'" size="16px" />
      <span>{{ fieldSet.name }}</span>
      <span class="form-group-count">({{ filledCount }}/{{ fields.length }})</span>
    </div>

    <div class="form-grid">
      <div
        v-for="field in fields"
        :key="field.key"
        class="form-field"
        :class="[`form-field--${fieldSpan(field)}`, { 'form-field--blank': isBlankFormField(field) }]"
        :style="{ '--tv': valueTypeHex(field.concept.valueType) }"
      >
        <div class="field-label">
          <span class="field-dot"></span>
          <span class="ellipsis">{{ shortConceptName(field.concept.name) }}</span>
          <q-btn v-if="field.obs" flat round dense size="xs" icon="close" class="field-delete" tabindex="-1" @click.stop="confirmDelete(field)">
            <q-tooltip>{{ $t('observation.deleteObservation') }}</q-tooltip>
          </q-btn>
          <q-tooltip :delay="350" max-width="360px">
            <div class="field-tooltip">
              {{ field.concept.name }}
              <div class="field-tooltip-code">{{ field.concept.code }}</div>
            </div>
          </q-tooltip>
        </div>

        <!-- R (file): click opens the media-details dialog (title/description
             into the TVAL_CHAR envelope, preview from there) -->
        <div v-if="field.concept.valueType === 'R'" class="field-file" @click="openFileDetails(field.obs)">
          <q-icon :name="getFileIcon(field.obs?.fileInfo?.ext)" size="15px" :color="getFileColor(field.obs?.fileInfo?.ext)" />
          <span class="ellipsis">{{ field.obs?.fileInfo?.title || field.obs?.fileInfo?.filename || field.obs?.displayValue }}</span>
          <span v-if="fileNameDiffers(field.obs)" class="field-file-name ellipsis">{{ field.obs.fileInfo.filename }}</span>
          <span v-if="field.obs?.fileInfo?.size" class="field-file-size">{{ formatFileSize(field.obs.fileInfo.size) }}</span>
        </div>

        <!-- M (medication): compact summary line, click opens the structured
             medication dialog (drug/dosage/frequency/route/instructions) -->
        <div v-else-if="field.concept.valueType === 'M'" class="field-medication" @click="openMedicationEdit(field)">
          <q-icon name="medication" size="15px" :color="field.obs ? 'purple-7' : 'grey-6'" />
          <span v-if="medicationSummary(field)" class="ellipsis">{{ medicationSummary(field) }}</span>
          <span v-else class="field-medication-add ellipsis">{{ $t('visit.addMedication') }}</span>
        </div>

        <ObservationValueEditor v-else :row-data="field.row" :concept="field.concept" :visit="visit" :patient="patient" @value-changed="onValueChanged" @save-requested="onSaveRequested" />

        <!-- Save feedback overlay: check for ~2.5s, then an undo button for
             another ~7.5s that restores the pre-save value (legacy revert) -->
        <div v-if="feedbackFor(field.key) === 'saved'" class="save-feedback save-feedback--ok">
          <q-icon name="check_circle" size="16px" color="positive" />
        </div>
        <q-btn v-else-if="feedbackFor(field.key) === 'revert' && field.obs" flat round dense size="xs" icon="undo" color="orange-8" class="save-feedback" tabindex="-1" @click.stop="revertField(field)">
          <q-tooltip>{{ $t('observation.revertTooltip', { value: revertValueLabel(field) }) }}</q-tooltip>
        </q-btn>
      </div>
    </div>

    <FileDetailsDialog v-if="fileToEdit" v-model="showFileDetails" :observation="fileToEdit" @saved="onFileDetailsSaved" />

    <MedicationEditDialog
      v-if="medicationField"
      v-model="showMedicationDialog"
      :medication-data="medicationDialogData"
      :observation-id="medicationField.obs?.observationId ?? null"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @save="onMedicationSave"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useMedicationsStore } from 'src/stores/medications-store'
import { useNotify } from 'src/composables/useNotify'
import { useMedicationOptions } from 'src/composables/useMedicationOptions'
import { visitObservationService } from 'src/services/visit-observation-service'
import { getFileIcon, getFileColor, formatFileSize } from 'src/shared/utils/medical-utils.js'
import {
  shortConceptName,
  tileSpan,
  valueTypeHex,
  buildObservationUpdate,
  buildNewObservationData,
  buildFormFields,
  isBlankFormField,
  parseMedicationObservation,
  formatMedicationSummary,
} from 'src/shared/utils/observation-display.js'
import ObservationValueEditor from '../ObservationValueEditor.vue'
import FileDetailsDialog from './FileDetailsDialog.vue'
import MedicationEditDialog from '../MedicationEditDialog.vue'

defineOptions({
  name: 'ObservationFormGrid',
})

const props = defineProps({
  fieldSet: { type: Object, required: true },
  visit: { type: Object, required: true },
  patient: { type: Object, required: true },
  // Transformed observations of THIS visit matched to this field set
  existingObservations: { type: Array, default: () => [] },
})

const $q = useQuasar()
const { t } = useI18n()
const conceptStore = useConceptResolutionStore()
const notify = useNotify()
const logger = useLoggingStore().createLogger('ObservationFormGrid')

// Field-set concept metadata (label/valueType/unit) — resolved once per mount
const resolvedConcepts = ref(new Map())

onMounted(async () => {
  const codes = props.fieldSet.concepts || []
  if (codes.length === 0) return
  try {
    resolvedConcepts.value = await conceptStore.resolveBatch(codes, { context: 'observation' })
  } catch (error) {
    logger.error('Failed to resolve field-set concepts', error)
  }
})

// Unsaved input per field key (ObservationValueEditor emits value-changed
// on typing, save-requested on blur/Enter/selection)
const pendingValues = ref(new Map())

// Every field-set concept becomes a field (filled or empty — a deleted
// observation leaves its slot as an empty field); observations the group
// claimed by category only are appended after and vanish with their row
const fields = computed(() =>
  buildFormFields({
    conceptCodes: props.fieldSet.concepts || [],
    resolvedConcepts: resolvedConcepts.value,
    observations: props.existingObservations || [],
    pendingValues: pendingValues.value,
  }),
)

const filledCount = computed(() => fields.value.filter((field) => field.obs).length)

// Width by content: numbers small (side by side), text wide, files medium
const fieldSpan = (field) => tileSpan({ valueType: field.concept.valueType, displayValue: String(field.row.value ?? '') })

const onValueChanged = (rowData, newValue) => {
  pendingValues.value.set(rowData.key, newValue)
}

const onSaveRequested = async (rowData) => {
  const field = fields.value.find((f) => f.key === rowData.key)
  if (!field) return
  const value = pendingValues.value.has(rowData.key) ? pendingValues.value.get(rowData.key) : rowData.currentValue
  if (value === undefined || value === field.row.originalValue) return

  try {
    if (field.obs) {
      const previousValue = field.row.originalValue
      const updateData = buildObservationUpdate(field.concept.valueType, value)
      await visitObservationService.updateObservation(field.obs.observationId, updateData, { skipReload: true })
      // Mirror into the store object so a re-render shows the saved value
      if (field.obs.rawData) {
        field.obs.rawData.NVAL_NUM = updateData.NVAL_NUM ?? null
        field.obs.rawData.TVAL_CHAR = updateData.TVAL_CHAR ?? null
        field.obs.rawData.VALUEFLAG_CD = null
      }
      scheduleFeedback(field.key, previousValue, true)
    } else {
      // Empty field → first input creates the observation (service reloads)
      await visitObservationService.createObservation(
        buildNewObservationData({
          patientNum: props.patient.PATIENT_NUM,
          encounterNum: props.visit.id,
          concept: field.concept,
          value,
          visitDate: props.visit.date,
        }),
      )
      scheduleFeedback(field.key, null, false)
    }
    pendingValues.value.delete(rowData.key)
  } catch (error) {
    logger.error('Failed to save observation', error, { conceptCode: field.concept.code })
    notify.error(t('observation.saveFailed'))
  }
}

// ---- Save feedback + revert window (legacy recordRecentSave/revertRow) ----
const SAVED_MS = 2500 // check icon
const REVERT_MS = 7500 // then undo button — 10s window in total

const recentSaves = ref(new Map()) // key → { previousValue, phase, t1, t2 }

const bumpRecentSaves = () => {
  recentSaves.value = new Map(recentSaves.value)
}

const clearFeedback = (key) => {
  const entry = recentSaves.value.get(key)
  if (!entry) return
  clearTimeout(entry.t1)
  clearTimeout(entry.t2)
  recentSaves.value.delete(key)
  bumpRecentSaves()
}

const scheduleFeedback = (key, previousValue, revertable) => {
  clearFeedback(key)
  const entry = { previousValue, phase: 'saved', t1: null, t2: null }
  entry.t1 = setTimeout(() => {
    if (!revertable) {
      clearFeedback(key)
      return
    }
    entry.phase = 'revert'
    bumpRecentSaves()
    entry.t2 = setTimeout(() => clearFeedback(key), REVERT_MS)
  }, SAVED_MS)
  recentSaves.value.set(key, entry)
  bumpRecentSaves()
}

const feedbackFor = (key) => recentSaves.value.get(key)?.phase || null

const revertValueLabel = (field) => {
  const entry = recentSaves.value.get(field.key)
  const value = entry?.previousValue
  return value === '' || value === null || value === undefined ? '∅' : String(value)
}

const revertField = async (field) => {
  const entry = recentSaves.value.get(field.key)
  if (!entry || !field.obs) return
  try {
    const updateData = buildObservationUpdate(field.concept.valueType, entry.previousValue ?? '')
    await visitObservationService.updateObservation(field.obs.observationId, updateData, { skipReload: true })
    if (field.obs.rawData) {
      field.obs.rawData.NVAL_NUM = updateData.NVAL_NUM ?? null
      field.obs.rawData.TVAL_CHAR = updateData.TVAL_CHAR ?? null
      field.obs.rawData.VALUEFLAG_CD = null
    }
    pendingValues.value.delete(field.key)
    clearFeedback(field.key)
  } catch (error) {
    logger.error('Failed to revert observation', error, { conceptCode: field.concept.code })
    notify.error(t('observation.saveFailed'))
  }
}

onUnmounted(() => {
  for (const entry of recentSaves.value.values()) {
    clearTimeout(entry.t1)
    clearTimeout(entry.t2)
  }
})

const confirmDelete = (field) => {
  $q.dialog({
    title: t('observation.deleteObservation'),
    message: t('observation.deleteObservationConfirm', { name: shortConceptName(field.concept.name) }),
    cancel: t('common.cancel'),
    persistent: true,
    ok: { label: t('common.delete'), color: 'negative' },
  }).onOk(async () => {
    try {
      await visitObservationService.deleteObservation(field.obs.observationId)
      pendingValues.value.delete(field.key)
    } catch (error) {
      logger.error('Failed to delete observation', error, { conceptCode: field.concept.code })
      notify.error(t('observation.saveFailed'))
    }
  })
}

// R-file details (title/description + preview)
const fileToEdit = ref(null)
const showFileDetails = ref(false)

const openFileDetails = (obs) => {
  if (!obs) return
  fileToEdit.value = obs
  showFileDetails.value = true
}

// Show the filename alongside only when a custom title differs from it
const fileNameDiffers = (obs) => {
  const info = obs?.fileInfo || {}
  return Boolean(info.title && info.filename && info.title !== info.filename)
}

// Mirror the saved envelope into the CURRENT store object (the store may
// have replaced the array entry with a copy — always re-locate by id)
const onFileDetailsSaved = ({ envelope, serialized }) => {
  const id = fileToEdit.value?.observationId
  if (id == null) return
  const targets = [fileToEdit.value, (props.existingObservations || []).find((o) => o.observationId === id)]
  for (const obs of targets) {
    if (!obs) continue
    if (obs.rawData) obs.rawData.TVAL_CHAR = serialized
    obs.fileInfo = { ...envelope }
  }
}

// ---- M (medication) fields: structured edit via MedicationEditDialog ----
const medicationsStore = useMedicationsStore()
const { frequencyOptions, routeOptions, loadMedicationOptions, getFrequencyLabel, getRouteLabel } = useMedicationOptions()

// Load frequency/route lookups only when this group actually shows M fields
const medicationOptionsLoaded = ref(false)
watch(
  fields,
  (list) => {
    if (medicationOptionsLoaded.value) return
    if (list.some((field) => field.concept.valueType === 'M')) {
      medicationOptionsLoaded.value = true
      loadMedicationOptions()
    }
  },
  { immediate: true },
)

const medicationSummary = (field) => {
  if (!field.obs) return ''
  const medication = parseMedicationObservation(field.obs)
  return formatMedicationSummary(medication, {
    frequencyLabel: getFrequencyLabel(medication.frequency),
    routeLabel: getRouteLabel(medication.route),
  })
}

const medicationField = ref(null)
const medicationDialogData = ref({})
const showMedicationDialog = ref(false)

const openMedicationEdit = (field) => {
  medicationField.value = field
  medicationDialogData.value = field.obs ? parseMedicationObservation(field.obs) : { drugName: '', dosage: null, dosageUnit: 'mg', frequency: '', route: '', instructions: '' }
  showMedicationDialog.value = true
}

const onMedicationSave = async (medicationData) => {
  const field = medicationField.value
  if (!field) return
  try {
    if (field.obs) {
      const result = await medicationsStore.updateMedication({ observationId: field.obs.observationId, medicationData })
      // Mirror into the store object (same invariant as every other save)
      if (field.obs.rawData) {
        field.obs.rawData.TVAL_CHAR = result.drugName
        field.obs.rawData.NVAL_NUM = result.dosage
        field.obs.rawData.UNIT_CD = result.dosageUnit
        field.obs.rawData.OBSERVATION_BLOB = result.observationBlob
      }
      field.obs.displayValue = result.drugName
      field.obs.value = result.drugName
      field.obs.numericValue = result.dosage
      field.obs.unit = result.dosageUnit
      scheduleFeedback(field.key, null, false)
    } else {
      // Empty field → create against the field-set concept, then reload the
      // visit observations so the new row fills the slot
      await medicationsStore.createMedication({
        patientNum: props.patient.PATIENT_NUM,
        visitId: props.visit.id,
        conceptCode: field.concept.code,
        visitDate: props.visit.date,
        medicationData,
      })
      await visitObservationService.selectVisitAndLoadObservations(props.visit)
      scheduleFeedback(field.key, null, false)
    }
  } catch (error) {
    logger.error('Failed to save medication', error, { conceptCode: field.concept.code })
    notify.error(t('observation.saveFailed'))
  }
}
</script>

<style lang="scss" scoped>
.form-group {
  background: white;
  border: 1px solid $grey-4;
  border-radius: 8px;
  padding: 8px 12px 10px;
}

.form-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $primary;
  font-weight: 600;
  font-size: 0.85rem;
  border-bottom: 1px solid $grey-4;
  padding-bottom: 4px;
  margin-bottom: 8px;

  .form-group-count {
    color: $grey-6;
    font-weight: 400;
    font-size: 0.75rem;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px 10px;
}

.form-field {
  position: relative; // anchor for the save/revert feedback overlay
  min-width: 0;

  &--m {
    grid-column: span 2;
  }

  &--full {
    grid-column: 1 / -1;
  }

  // Blank fields (no value yet, or value deleted while the concept stays in
  // the field set) step back visually; hover/focus restores full presence
  &--blank {
    opacity: 0.55;
    transition: opacity 0.15s ease;

    &:hover,
    &:focus-within {
      opacity: 1;
    }
  }
}

// Sits over the right edge of the input (left of select carets)
.save-feedback {
  position: absolute;
  right: 28px;
  bottom: 6px;
  z-index: 3;

  &--ok {
    pointer-events: none;
    line-height: 1;
    animation: feedback-in 0.15s ease;
  }
}

@keyframes feedback-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-feedback--ok {
    animation: none;
  }
}

.field-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  color: $grey-7;
  line-height: 1.3;
  margin-bottom: 2px;
  min-width: 0;

  .field-dot {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: var(--tv, $grey-5);
  }

  .field-delete {
    opacity: 0;
    transition: opacity 0.15s ease;
    color: $grey-6;
  }
}

.form-field:hover .field-delete {
  opacity: 1;
}

.field-tooltip {
  font-size: 0.75rem;

  .field-tooltip-code {
    color: $blue-3;
    font-family: monospace;
    font-size: 0.68rem;
    margin-top: 2px;
  }
}

.field-file {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid $grey-4;
  border-radius: 5px;
  padding: 5px 9px;
  font-size: 0.82rem;
  cursor: pointer;
  min-width: 0;

  .field-file-name {
    flex-shrink: 1;
    font-size: 0.68rem;
    color: $grey-6;
    max-width: 40%;
  }

  .field-file-size {
    flex-shrink: 0;
    font-size: 0.68rem;
    font-style: italic;
    color: $grey-6;
  }

  &:hover {
    background: $blue-1;
    border-color: $primary;
  }
}

// Medication field — same box language as the file field, purple accent
.field-medication {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid $grey-4;
  border-radius: 5px;
  padding: 5px 9px;
  font-size: 0.82rem;
  cursor: pointer;
  min-width: 0;

  .field-medication-add {
    color: $grey-6;
  }

  &:hover {
    background: $blue-1;
    border-color: $primary;
  }
}

// The legacy editor carries min-width: 200px for table cells — inside a
// grid cell it MUST shrink with the cell, otherwise inputs overlap the
// neighboring column
.form-field :deep(.observation-value-editor) {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.form-field :deep(.q-field),
.form-field :deep(.q-select) {
  min-width: 0;
  max-width: 100%;
}

// Dense inputs inside the grid cells
.form-field :deep(.q-field--outlined .q-field__control) {
  min-height: 34px;
  padding: 0 8px;
}

.form-field :deep(.q-field__marginal) {
  height: 34px;
}

.form-field :deep(.q-field--auto-height .q-field__native) {
  min-height: 32px;
  padding-top: 4px;
  padding-bottom: 4px;
}

@media (max-width: 480px) {
  .form-field--m {
    grid-column: 1 / -1;
  }
}
</style>
