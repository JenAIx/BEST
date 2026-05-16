<template>
  <div class="editable-cell" :class="cellClasses" @click="onCellClick" @keydown="onKeyDown" tabindex="0">
    <!-- Display Mode -->
    <div v-if="!isEditing" class="cell-display">
      <!-- File Display for R type -->
      <div v-if="valueType === 'R' && displayValue" class="file-display">
        <div class="file-info">
          <div class="file-type">{{ getFileType() }}</div>
          <div class="file-name">{{ getFileName() }}</div>
          <div class="file-size">{{ getFileSize() }}</div>
        </div>
        <q-btn flat round dense icon="visibility" size="xs" color="primary" @click.stop="openFilePreview" class="preview-btn">
          <q-tooltip>Preview file</q-tooltip>
        </q-btn>
      </div>

      <!-- Standard Display for other types -->
      <div v-else-if="displayValue" class="cell-value" :title="displayValue">
        {{ displayValue }}
        <span v-if="unitDisplay" class="cell-unit">{{ unitDisplay }}</span>
      </div>

      <!-- 3-state numeric: VALUEFLAG_CD='NV' = patient was assessed and explicitly
           has no value (e.g. drug not taken). Distinct visual to separate from
           "not yet assessed" (which has no observation at all). See CLAUDE.md. -->
      <div
        v-else-if="valueType === 'N' && valueFlag === 'NV'"
        class="cell-no-value"
        title="Erfasst — kein Wert (nicht eingenommen / nicht zutreffend)"
      >
        <q-icon name="block" size="14px" color="grey-6" />
      </div>

      <!-- Empty Cell -->
      <div v-else class="cell-empty">
        <q-icon name="add" size="12px" color="grey-5" />
      </div>

      <!-- Status indicators -->
      <div v-if="hasUnsavedChanges" class="cell-status">
        <q-icon name="edit" size="10px" color="orange-6" />
      </div>
      <div v-else-if="isSaving" class="cell-status">
        <q-spinner size="10px" color="primary" />
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-else class="cell-edit">
      <!-- Numeric Input — with optional NV-toggle for the 3-state pattern
           (CLAUDE.md "3-state pattern for numerics"). Click the side button
           to flip between entering a numeric value and marking the cell as
           "assessed but explicitly no value" (e.g. drug not taken). -->
      <div v-if="valueType === 'N'" class="cell-edit-numeric">
        <q-input
          v-if="!editFlagNV"
          ref="editInput"
          v-model.number="editValue"
          type="number"
          dense
          borderless
          class="cell-input numeric-input"
          @blur="saveEdit"
          @keydown.enter="saveEdit"
          @keydown.escape="cancelEdit"
          @keydown.tab="saveAndNavigate"
          step="any"
        />
        <div v-else class="nv-placeholder" @click.stop="toggleEditFlag">— nicht eingenommen —</div>
        <q-btn
          flat
          dense
          round
          size="xs"
          :icon="editFlagNV ? 'block' : 'do_disturb_alt'"
          :color="editFlagNV ? 'primary' : 'grey-5'"
          class="nv-toggle"
          @click.stop="toggleEditFlag"
        >
          <q-tooltip>
            {{ editFlagNV ? 'Wert eingeben (NV entfernen)' : 'Als "nicht eingenommen / kein Wert" markieren' }}
          </q-tooltip>
        </q-btn>
      </div>

      <!-- Date Input -->
      <q-input
        v-else-if="valueType === 'D'"
        ref="editInput"
        v-model="editValue"
        type="date"
        dense
        borderless
        class="cell-input date-input"
        @blur="saveEdit"
        @keydown.enter="saveEdit"
        @keydown.escape="cancelEdit"
        @keydown.tab="saveAndNavigate"
      />

      <!-- Selection Input (for F and S types) -->
      <q-select
        v-else-if="valueType === 'F' || valueType === 'S'"
        ref="editInput"
        v-model="editValue"
        :options="selectionOptions"
        dense
        borderless
        emit-value
        map-options
        class="cell-input selection-input"
        @blur="saveEdit"
        @keydown.enter="saveEdit"
        @keydown.escape="cancelEdit"
        @keydown.tab="saveAndNavigate"
        :loading="loadingOptions"
        behavior="menu"
      />

      <!-- Text Input (default) -->
      <q-input
        v-else
        ref="editInput"
        v-model="editValue"
        dense
        borderless
        class="cell-input text-input"
        @blur="saveEdit"
        @keydown.enter="saveEdit"
        @keydown.escape="cancelEdit"
        @keydown.tab="saveAndNavigate"
      />
    </div>

    <!-- File Preview Dialog -->
    <FilePreviewDialog
      v-if="valueType === 'R' && props.observationId"
      v-model="showFilePreview"
      :observation-id="props.observationId"
      :file-info="getFileInfoForDialog()"
      :concept-name="getConceptName()"
      :upload-date="getUploadDate()"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'

const props = defineProps({
  value: {
    type: [String, Number],
    default: '',
  },
  valueType: {
    type: String,
    default: 'T',
  },
  conceptCode: {
    type: String,
    required: true,
  },
  patientId: {
    type: String,
    required: true,
  },
  encounterNum: {
    type: [String, Number],
    required: true,
  },
  observationId: {
    type: [String, Number],
    default: null,
  },
  // OBSERVATION_FACT.VALUEFLAG_CD for the cell. Currently used for 'NV' = the
  // patient was assessed but explicitly has no numeric value (e.g. drug not
  // taken). Distinct from "not assessed" (cell has no observation at all).
  valueFlag: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['update', 'save', 'error', 'edit-recorded'])

const notify = useNotify()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('EditableCell')

// Local state
const isEditing = ref(false)
const editValue = ref('')
const originalValue = ref('')
const isSaving = ref(false)
const hasUnsavedChanges = ref(false)
const editInput = ref(null)
// Local edit-time mirror of OBSERVATION_FACT.VALUEFLAG_CD for the 3-state pattern.
// `true` = the editor is set to "NV" (assessed, explicitly no value). Reset to
// the cell's current state every time we enter edit mode.
const editFlagNV = ref(false)

// Selection options for F and S type observations
const selectionOptions = ref([])
const loadingOptions = ref(false)

// File preview state for R type observations
const showFilePreview = ref(false)

// Computed properties
const displayValue = computed(() => {
  if (hasUnsavedChanges.value && !isEditing.value) {
    // For S/F types, convert the code value back to display value
    if ((props.valueType === 'F' || props.valueType === 'S') && editValue.value && selectionOptions.value.length > 0) {
      const matchingOption = selectionOptions.value.find((option) => option.value === editValue.value)
      return matchingOption ? matchingOption.label : editValue.value
    }
    return editValue.value
  }

  // The value should already be resolved for S and F types from ExcelLikeEditor
  return props.value || ''
})

const unitDisplay = computed(() => {
  // This could be enhanced to show units for numeric values
  return ''
})

const cellClasses = computed(() => ({
  'is-editing': isEditing.value,
  'has-value': !!displayValue.value,
  'has-changes': hasUnsavedChanges.value,
  'is-saving': isSaving.value,
  'has-no-value-flag': props.valueFlag === 'NV' && !displayValue.value,
  [`value-type-${props.valueType.toLowerCase()}`]: true,
}))

// Methods
const onCellClick = () => {
  // For R type (file) observations, open preview instead of edit mode
  if (props.valueType === 'R') {
    openFilePreview()
  } else {
    startEdit()
  }
}

const startEdit = async () => {
  if (isEditing.value) return

  isEditing.value = true
  originalValue.value = props.value || ''
  // Mirror the current 3-state-numeric flag into the editor so NV cells open
  // in NV-mode (and a click on the side toggle switches to value-entry mode).
  editFlagNV.value = props.valueType === 'N' && props.valueFlag === 'NV'

  // Load selection options for F and S types
  if (props.valueType === 'F' || props.valueType === 'S') {
    await loadSelectionOptions()

    // For S/F types, we need to find the code value that corresponds to the current display value
    if (props.value && selectionOptions.value.length > 0) {
      // Find the option where the label matches the current display value
      const matchingOption = selectionOptions.value.find((option) => option.label === props.value)
      if (matchingOption) {
        // Use the code value for editing
        editValue.value = matchingOption.value
      } else {
        // If no match found, use the original value (might be a code)
        editValue.value = props.value
      }
    } else {
      editValue.value = props.value || ''
    }
  } else {
    // For other types, use the value directly
    editValue.value = props.value || ''
  }

  // Focus the input after DOM update
  await nextTick()
  if (editInput.value) {
    if (editInput.value.focus) {
      editInput.value.focus()
    } else if (editInput.value.$el && editInput.value.$el.focus) {
      editInput.value.$el.focus()
    }
  }
}

const loadSelectionOptions = async () => {
  try {
    loadingOptions.value = true
    const options = await conceptStore.getSelectionOptions(props.conceptCode)
    selectionOptions.value = options
  } catch (error) {
    logger.error('Failed to load selection options', error)
    // Fallback options
    selectionOptions.value = [
      { label: 'Yes', value: 'Yes' },
      { label: 'No', value: 'No' },
      { label: 'Unknown', value: 'Unknown' },
    ]
  } finally {
    loadingOptions.value = false
  }
}

/**
 * Toggle the editor between numeric-value mode and "NV" (no value / explicitly
 * absent) mode. Clears the numeric value when flipping into NV so the next
 * save persists the NV state cleanly.
 */
const toggleEditFlag = () => {
  if (props.valueType !== 'N') return
  editFlagNV.value = !editFlagNV.value
  if (editFlagNV.value) {
    editValue.value = ''
  }
  hasUnsavedChanges.value = true
}

const saveEdit = async () => {
  if (!isEditing.value) return

  // 3-state numeric: detect "no change" against the cell's pre-edit state.
  // For numeric+NV we compare both the numeric value AND the NV-flag intent.
  const startedAsNV = props.valueType === 'N' && props.valueFlag === 'NV'
  if (
    editValue.value === originalValue.value &&
    (props.valueType !== 'N' || editFlagNV.value === startedAsNV)
  ) {
    cancelEdit()
    return
  }

  // Snapshot pre-edit state for undo recording. originalValue is in the
  // same representation as displayValue (label for S/F, raw for others).
  const oldValueForUndo = originalValue.value

  try {
    isSaving.value = true

    // For S/F types, emit the resolved display value for proper display
    let emitValue = editValue.value
    if ((props.valueType === 'F' || props.valueType === 'S') && selectionOptions.value.length > 0) {
      const matchingOption = selectionOptions.value.find((option) => option.value === editValue.value)
      if (matchingOption) {
        emitValue = matchingOption.label // Emit display value for S/F types
      }
    }

    // Emit update event to parent
    emit('update', {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
      conceptCode: props.conceptCode,
      value: emitValue,
      observationId: props.observationId,
      valueType: props.valueType,
    })

    // Save to database — returns the resulting observationId (existing on
    // UPDATE, new on INSERT) so undo can target it later.
    const savedObservationId = await saveToDatabase()

    // Mark as saved
    hasUnsavedChanges.value = false
    isEditing.value = false

    emit('save', {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
      conceptCode: props.conceptCode,
      value: editValue.value,
    })

    emit('edit-recorded', {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
      conceptCode: props.conceptCode,
      oldValue: oldValueForUndo,
      newValue: emitValue,
      observationId: savedObservationId,
      valueType: props.valueType,
    })
  } catch (error) {
    logger.error('Failed to save cell', error)
    emit('error', error)

    notify.error(`Failed to save: ${error.message}`, { position: 'top-right', timeout: 3000 })
  } finally {
    isSaving.value = false
  }
}

const saveToDatabase = async () => {
  try {
    // 3-state numeric: an empty value AND the NV-toggle off (= user cleared
    // the cell without explicitly marking it as "not taken") means "this
    // observation should no longer exist". Delete the row instead of writing
    // a half-NULL one. Only meaningful if there *is* an existing obs to delete.
    const isNumericEmptyClear =
      props.valueType === 'N' && !editFlagNV.value && (editValue.value === '' || editValue.value == null)
    if (props.observationId && isNumericEmptyClear) {
      await deleteObservation()
      return null
    }
    if (props.observationId) {
      await updateObservation()
      return props.observationId
    }
    // Create new observation, return its new id
    return await createObservation()
  } catch (error) {
    logger.error('Database save error', error)
    throw error
  }
}

const deleteObservation = async () => {
  const result = await dbStore.executeQuery(
    'DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?',
    [props.observationId],
  )
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete observation')
  }
}

const updateObservation = async () => {
  const updates = {}

  if (props.valueType === 'N') {
    if (editFlagNV.value) {
      // 3-state "not taken / no value" — clear numeric, set VALUEFLAG_CD='NV'.
      updates.NVAL_NUM = null
      updates.TVAL_CHAR = null
      updates.VALUEFLAG_CD = 'NV'
    } else {
      updates.NVAL_NUM = editValue.value === '' || editValue.value == null ? null : editValue.value
      updates.TVAL_CHAR = null
      // Explicitly clear any pre-existing NV flag when a real value is entered.
      updates.VALUEFLAG_CD = null
    }
  } else {
    updates.TVAL_CHAR = editValue.value
    updates.NVAL_NUM = null // Clear numeric value for text
  }

  const setClause = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(', ')
  const values = Object.values(updates)
  values.push(props.observationId)

  const updateQuery = `UPDATE OBSERVATION_FACT SET ${setClause}, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?`
  const result = await dbStore.executeQuery(updateQuery, values)

  if (!result.success) {
    throw new Error(result.error || 'Failed to update observation')
  }
}

const createObservation = async () => {
  // First, get the PATIENT_NUM from PATIENT_CD
  const patientLookupQuery = 'SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?'
  const patientResult = await dbStore.executeQuery(patientLookupQuery, [props.patientId])

  if (!patientResult.success || !patientResult.data.length) {
    throw new Error(`Patient not found: ${props.patientId}`)
  }

  const patientNum = patientResult.data[0].PATIENT_NUM

  // Get the visit's start date to use as observation date
  const visitQuery = 'SELECT START_DATE FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?'
  const visitResult = await dbStore.executeQuery(visitQuery, [props.encounterNum])

  const visitStartDate = visitResult.success && visitResult.data.length > 0 ? visitResult.data[0].START_DATE : new Date().toISOString().split('T')[0] // fallback to today

  // Get default values from global settings
  const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('DATAGRID_EDITOR')
  const defaultCategory = await globalSettingsStore.getDefaultCategory('CLINICAL')

  // Prepare observation data using repository pattern
  const observationData = {
    PATIENT_NUM: patientNum,
    ENCOUNTER_NUM: props.encounterNum,
    CONCEPT_CD: props.conceptCode,
    VALTYPE_CD: props.valueType,
    START_DATE: visitStartDate, // Use visit date, not current timestamp
    CATEGORY_CHAR: defaultCategory,
    PROVIDER_ID: 'SYSTEM',
    LOCATION_CD: 'DATAGRID',
    SOURCESYSTEM_CD: defaultSourceSystem,
    INSTANCE_NUM: 1,
    UPLOAD_ID: 1,
  }

  // Set the value based on type
  if (props.valueType === 'N') {
    if (editFlagNV.value) {
      // 3-state "not taken / no value" - persist as VALUEFLAG_CD='NV' with no numeric value.
      observationData.NVAL_NUM = null
      observationData.VALUEFLAG_CD = 'NV'
    } else {
      observationData.NVAL_NUM = parseFloat(editValue.value) || 0
    }
  } else {
    observationData.TVAL_CHAR = String(editValue.value)
  }

  // Use the observation repository to create the observation
  const observationRepo = dbStore.getRepository('observation')
  const result = await observationRepo.createObservation(observationData)

  if (!result || !result.OBSERVATION_ID) {
    throw new Error('Failed to create observation - no ID returned')
  }

  // For S/F types, emit the resolved display value for proper display
  let emitValue = editValue.value
  if ((props.valueType === 'F' || props.valueType === 'S') && selectionOptions.value.length > 0) {
    const matchingOption = selectionOptions.value.find((option) => option.value === editValue.value)
    if (matchingOption) {
      emitValue = matchingOption.label // Emit display value for S/F types
    }
  }

  // Update the observation ID for future updates
  emit('update', {
    patientId: props.patientId,
    encounterNum: props.encounterNum,
    conceptCode: props.conceptCode,
    value: emitValue,
    observationId: result.OBSERVATION_ID,
    valueType: props.valueType,
  })

  return result.OBSERVATION_ID
}

const cancelEdit = () => {
  isEditing.value = false
  // For S/F types, we need to convert back to the code value for consistency
  if (props.valueType === 'F' || props.valueType === 'S') {
    if (originalValue.value && selectionOptions.value.length > 0) {
      const matchingOption = selectionOptions.value.find((option) => option.label === originalValue.value)
      if (matchingOption) {
        editValue.value = matchingOption.value
      } else {
        editValue.value = originalValue.value
      }
    } else {
      editValue.value = originalValue.value
    }
  } else {
    editValue.value = originalValue.value
  }
  hasUnsavedChanges.value = false
}

const saveAndNavigate = (event) => {
  event.preventDefault()
  saveEdit()
    .then(() => {
      // Navigate to next cell (could be enhanced with proper navigation logic)
      const nextCell = findNextCell()
      if (nextCell) {
        nextCell.focus()
      }
    })
    .catch(() => {
      /* intentionally ignored */
    })
}

const findNextCell = () => {
  // Simple navigation logic - find next editable cell
  const currentCell = editInput.value?.$el || editInput.value
  if (!currentCell) return null

  const table = currentCell.closest('table')
  if (!table) return null

  const cells = Array.from(table.querySelectorAll('.editable-cell'))
  const currentIndex = cells.indexOf(currentCell.closest('.editable-cell'))

  if (currentIndex >= 0 && currentIndex < cells.length - 1) {
    return cells[currentIndex + 1]
  }

  return null
}

const onKeyDown = (event) => {
  if (!isEditing.value) {
    // For R type (file) observations, open preview on Enter or Space
    if (props.valueType === 'R') {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openFilePreview()
      }
    } else {
      // Start editing on Enter, Space, or any alphanumeric key for other types
      if (event.key === 'Enter' || event.key === ' ' || (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key))) {
        event.preventDefault()
        startEdit()

        // If it's a character key, set it as the initial value
        if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
          editValue.value = event.key
        }
      }
    }
  }
}

// Watch for external value changes
watch(
  () => props.value,
  (newValue) => {
    if (!isEditing.value) {
      editValue.value = newValue || ''
      originalValue.value = newValue || ''
      hasUnsavedChanges.value = false
    }
  },
)

// File-related methods for R type observations
const parseFileInfo = () => {
  if (!props.value || props.valueType !== 'R') return null

  try {
    return JSON.parse(props.value)
  } catch {
    return null
  }
}

const getFileType = () => {
  const info = parseFileInfo()
  if (!info) return 'File'

  if (info.type) return info.type
  if (info.filename) {
    const ext = info.filename.split('.').pop()?.toUpperCase()
    return ext ? `${ext} File` : 'File'
  }
  return 'File'
}

const getFileName = () => {
  const info = parseFileInfo()
  if (!info?.filename) return 'Unknown File'

  // Truncate long filenames
  const name = info.filename
  return name.length > 20 ? `${name.substring(0, 17)}...` : name
}

const getFileSize = () => {
  const info = parseFileInfo()
  if (!info?.size) return ''

  return formatFileSize(info.size)
}

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const openFilePreview = () => {
  showFilePreview.value = true
}

const getFileInfoForDialog = () => {
  const info = parseFileInfo()
  if (!info) return { filename: 'Unknown File', size: 0, ext: '' }

  // Extract file extension for the dialog
  const ext = info.filename ? info.filename.split('.').pop() || '' : ''

  return {
    filename: info.filename || 'Unknown File',
    size: info.size || 0,
    ext: ext,
  }
}

const getConceptName = () => {
  // This would need to be passed from parent or retrieved from concept store
  // For now, return a default value
  return props.conceptCode || 'File Observation'
}

const getUploadDate = () => {
  // This would typically come from the observation's START_DATE
  // For now, return current date as fallback
  return new Date().toISOString()
}

// Watch for edit value changes to track unsaved changes
watch(editValue, (newValue) => {
  if (isEditing.value) {
    hasUnsavedChanges.value = newValue !== originalValue.value
  }
})
</script>

<style lang="scss" scoped>
.editable-cell {
  position: relative;
  min-height: 32px;
  width: 100%;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(25, 118, 210, 0.04);
  }

  &:focus {
    outline: 2px solid $primary;
    outline-offset: -2px;
  }

  &.is-editing {
    cursor: text;
    background-color: white;
    box-shadow: inset 0 0 0 2px $primary;
  }

  &.has-changes {
    background-color: $orange-1;
    border-left: 3px solid $orange-5;
  }

  &.is-saving {
    opacity: 0.7;
  }

  // Value type specific styling
  &.value-type-n {
    text-align: right;
  }

  &.value-type-d {
    font-family: monospace;
    font-size: 0.8rem;
  }

  &.value-type-f,
  &.value-type-s {
    .cell-display {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &.value-type-r {
    cursor: pointer; // Different cursor for file cells

    &:hover {
      background-color: rgba(156, 39, 176, 0.08); // Purple tint on hover
    }

    .file-display {
      cursor: pointer;
    }
  }
}

.cell-display {
  padding: 6px 8px;
  min-height: 32px;
  display: flex;
  align-items: center;
  position: relative;

  .cell-value {
    flex: 1;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    line-height: 1.2;
    display: inline-block;

    .cell-unit {
      color: $grey-6;
      font-size: 0.75rem;
      margin-left: 4px;
    }
  }

  .cell-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $grey-5;
    font-style: italic;
    font-size: 0.75rem;
    opacity: 0;
    transition: opacity 0.2s ease;

    .editable-cell:hover & {
      opacity: 1;
    }
  }

  // 3-state numeric: "assessed but no value" (VALUEFLAG_CD='NV').
  // Visible by default (always-on, not just on hover) so the user can tell at a
  // glance that this is recorded data, not a blank cell.
  .cell-no-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.55;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 2px;
    margin: 2px;

    .editable-cell:hover & {
      opacity: 0.9;
    }
  }

  .cell-status {
    position: absolute;
    top: 2px;
    right: 2px;
    z-index: 1;
  }
}

.cell-edit {
  padding: 2px;
  height: 100%;
  min-width: 200px;

  // Numeric editor with the 3-state NV-toggle button to the right.
  .cell-edit-numeric {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
    width: 100%;

    .cell-input {
      flex: 1;
    }

    .nv-placeholder {
      flex: 1;
      font-size: 0.75rem;
      color: $grey-7;
      font-style: italic;
      text-align: center;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.03);
    }

    .nv-toggle {
      flex: 0 0 auto;
    }
  }

  .cell-input {
    height: 100%;
    width: 100%;

    :deep(.q-field__control) {
      height: 28px;
      min-height: 28px;
      padding: 0 6px;
    }

    :deep(.q-field__native) {
      font-size: 0.875rem;
      line-height: 1.2;
      padding: 0;
    }
    
    &.text-input {
      min-width: 200px;
      width: 100%;
      
      :deep(.q-field__control) {
        min-width: 200px;
      }
      
      :deep(.q-field__native) {
        min-width: 200px;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &.numeric-input {
      :deep(.q-field__native) {
        text-align: right;
      }
    }

    &.date-input {
      :deep(.q-field__native) {
        font-family: monospace;
        font-size: 0.8rem;
      }
    }

    &.selection-input {
      :deep(.q-field__control) {
        cursor: pointer;
      }
    }
  }
}

// Animation for cell state changes
@keyframes cellSaved {
  0% {
    background-color: $positive;
  }

  100% {
    background-color: transparent;
  }
}

.editable-cell.cell-saved {
  animation: cellSaved 0.5s ease-out;
}

// Responsive adjustments
// File display styles
.file-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 2px 4px;

  .file-info {
    flex: 1;
    min-width: 0; // Allow shrinking

    .file-type {
      font-size: 0.65rem;
      font-weight: 600;
      color: $primary;
      line-height: 1;
    }

    .file-name {
      font-size: 0.7rem;
      color: $grey-8;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 0.6rem;
      color: $grey-6;
      line-height: 1;
    }
  }

  .preview-btn {
    flex-shrink: 0;
    margin-left: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover .preview-btn {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .editable-cell {
    min-height: 28px;

    .cell-display {
      padding: 4px 6px;
      min-height: 28px;

      .cell-value {
        font-size: 0.8rem;
      }
    }

    .cell-edit {
      .cell-input {
        :deep(.q-field__control) {
          height: 24px;
          min-height: 24px;
          padding: 0 4px;
        }

        :deep(.q-field__native) {
          font-size: 0.8rem;
        }
      }
    }

    .file-display {
      .file-info {
        .file-type {
          font-size: 0.6rem;
        }

        .file-name {
          font-size: 0.65rem;
        }

        .file-size {
          font-size: 0.55rem;
        }
      }
    }
  }
}
</style>
