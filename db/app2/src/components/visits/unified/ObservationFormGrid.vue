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
      <div v-for="field in fields" :key="field.key" class="form-field" :class="`form-field--${fieldSpan(field)}`" :style="{ '--tv': valueTypeHex(field.concept.valueType) }">
        <div class="field-label">
          <span class="field-dot"></span>
          <span class="ellipsis">{{ shortConceptName(field.concept.name) }}</span>
          <q-btn v-if="field.obs" flat round dense size="xs" icon="close" class="field-delete" @click.stop="confirmDelete(field)">
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
          <span v-if="field.obs?.fileInfo?.size" class="field-file-size">{{ formatFileSize(field.obs.fileInfo.size) }}</span>
        </div>

        <ObservationValueEditor v-else :row-data="field.row" :concept="field.concept" :visit="visit" :patient="patient" @value-changed="onValueChanged" @save-requested="onSaveRequested" />
      </div>
    </div>

    <FileDetailsDialog v-if="fileToEdit" v-model="showFileDetails" :observation="fileToEdit" @saved="onFileDetailsSaved" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useNotify } from 'src/composables/useNotify'
import { visitObservationService } from 'src/services/visit-observation-service'
import { matchesConceptCode } from 'src/shared/utils/file-category.js'
import { getFileIcon, getFileColor, formatFileSize } from 'src/shared/utils/medical-utils.js'
import { shortConceptName, tileSpan, valueTypeHex, buildObservationUpdate, buildNewObservationData } from 'src/shared/utils/observation-display.js'
import ObservationValueEditor from '../ObservationValueEditor.vue'
import FileDetailsDialog from './FileDetailsDialog.vue'

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

const editValueOf = (obs) => {
  if (!obs) return ''
  if (obs.valueType === 'N') return obs.rawData?.NVAL_NUM ?? ''
  // Coded values (S/F/A) need the CODE for the select, not the display label
  return obs.rawData?.TVAL_CHAR ?? obs.displayValue ?? ''
}

const makeField = (code, meta, obs) => {
  const concept = {
    code,
    name: meta?.label || obs?.conceptName || code,
    valueType: obs?.valueType || meta?.valueType || 'T',
    unit: obs?.unit || meta?.unit || null,
  }
  const current = editValueOf(obs)
  const value = pendingValues.value.has(code) ? pendingValues.value.get(code) : current
  return {
    key: code,
    concept,
    obs: obs || null,
    row: {
      id: code,
      key: code,
      observationId: obs?.observationId ?? null,
      conceptCode: code,
      valueType: concept.valueType,
      currentValue: value,
      originalValue: current,
      value,
    },
  }
}

// Every field-set concept becomes a field (filled or empty); observations the
// group claimed by category (not listed in concepts[]) are appended after
const fields = computed(() => {
  const observations = props.existingObservations || []
  const used = new Set()
  const out = []

  for (const code of props.fieldSet.concepts || []) {
    const obs = observations.find((o) => !used.has(o.observationId) && matchesConceptCode(o.conceptCode, [code]))
    if (obs) used.add(obs.observationId)
    out.push(makeField(code, resolvedConcepts.value.get(code), obs))
  }

  for (const obs of observations) {
    if (used.has(obs.observationId)) continue
    out.push(makeField(obs.conceptCode, { label: obs.conceptName, valueType: obs.valueType, unit: obs.unit }, obs))
  }

  return out
})

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
      const updateData = buildObservationUpdate(field.concept.valueType, value)
      await visitObservationService.updateObservation(field.obs.observationId, updateData, { skipReload: true })
      // Mirror into the store object so a re-render shows the saved value
      if (field.obs.rawData) {
        field.obs.rawData.NVAL_NUM = updateData.NVAL_NUM ?? null
        field.obs.rawData.TVAL_CHAR = updateData.TVAL_CHAR ?? null
        field.obs.rawData.VALUEFLAG_CD = null
      }
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
    }
    pendingValues.value.delete(rowData.key)
  } catch (error) {
    logger.error('Failed to save observation', error, { conceptCode: field.concept.code })
    notify.error(t('observation.saveFailed'))
  }
}

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

// Mirror the saved envelope into the (store-owned) observation so tiles and
// tooltips update without a reload
const onFileDetailsSaved = ({ envelope, serialized }) => {
  const obs = fileToEdit.value
  if (!obs) return
  if (obs.rawData) obs.rawData.TVAL_CHAR = serialized
  obs.fileInfo = { ...envelope }
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
  min-width: 0;

  &--m {
    grid-column: span 2;
  }

  &--full {
    grid-column: 1 / -1;
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
