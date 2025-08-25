<template>
    <q-card class="observation-card" :class="{ 'editing-card': isEditing }"
        :data-value-type="observation.VALTYPE_CD || 'T'" flat bordered>
        <q-card-section class="q-pa-sm">
            <!-- Edit Mode Form -->
            <div v-if="isEditing" class="edit-form">
                <div class="row items-center q-mb-sm">
                    <ValueTypeIcon :value-type="observation.VALTYPE_CD || 'T'" size="20px" variant="default" />
                    <div class="text-weight-medium text-grey-8 q-ml-sm">
                        {{ getConceptName(observation) }}
                    </div>
                </div>

                <div class="q-gutter-sm">
                    <q-input v-model="editForm.startDate" label="Date" type="date" outlined dense class="q-mb-sm" />

                    <!-- Dynamic Value Input based on value type -->
                    <div class="value-input-section">
                        <!-- Numeric Value -->
                        <div v-if="valueInputType === 'numeric'">
                            <q-input v-model.number="editForm.nvalNum" label="Numeric Value" type="number" outlined
                                dense class="q-mb-sm" step="any">
                                <template v-slot:prepend>
                                    <q-icon name="numbers" />
                                </template>
                            </q-input>
                        </div>

                        <!-- Date Value -->
                        <div v-else-if="valueInputType === 'date'">
                            <q-input v-model="editForm.tvalChar" label="Date Value" type="date" outlined dense
                                class="q-mb-sm">
                                <template v-slot:prepend>
                                    <q-icon name="event" />
                                </template>
                            </q-input>
                        </div>

                        <!-- Selection Value (for F and S types) -->
                        <div v-else-if="valueInputType === 'selection'">
                            <q-select v-model="editForm.tvalChar" :options="getSelectionOptions()" label="Select Value"
                                outlined dense emit-value map-options :loading="loadingSelectionOptions"
                                class="q-mb-sm">
                                <template v-slot:prepend>
                                    <q-icon name="list" />
                                </template>
                                <template v-slot:hint v-if="selectionOptions.length > 0">
                                    {{ selectionOptions.length }} option(s) available
                                </template>
                            </q-select>
                        </div>

                        <!-- Text Value (default) -->
                        <div v-else>
                            <q-input v-model="editForm.tvalChar" label="Text Value" outlined dense class="q-mb-sm">
                                <template v-slot:prepend>
                                    <q-icon name="text_fields" />
                                </template>
                            </q-input>
                        </div>
                    </div>
                </div>

                <div class="row justify-end q-gutter-xs q-mt-sm">
                    <q-btn flat dense icon="check" color="positive" size="sm" @click="saveChanges">
                        <q-tooltip>Save Changes</q-tooltip>
                    </q-btn>
                    <q-btn flat dense icon="close" color="negative" size="sm" @click="cancelEdit">
                        <q-tooltip>Cancel</q-tooltip>
                    </q-btn>
                </div>
            </div>

            <!-- Normal View Mode -->
            <div v-else>
                <div class="row items-start q-gutter-sm">
                    <!-- Value Type Icon -->
                    <div class="col-auto">
                        <ValueTypeIcon :value-type="observation.VALTYPE_CD || 'T'" size="24px" variant="default" />
                    </div>

                    <!-- Content -->
                    <div class="col">
                        <div class="text-weight-medium text-grey-9 observation-name">
                            {{ getConceptName(observation) }}
                        </div>

                        <!-- Value Display -->
                        <div class="observation-value q-mt-xs">
                            <!-- File Display for R type -->
                            <div v-if="observation.VALTYPE_CD === 'R' && observation.TVAL_CHAR" class="file-display">
                                <div class="file-hover-area file-value-display text-primary"
                                    @mouseenter="showHoverButton = true" @mouseleave="showHoverButton = false"
                                    @click="openFilePreview">
                                    {{ getTvalDisplay(observation) }}
                                    <q-tooltip class="bg-grey-9 text-white">
                                        <span v-if="getTvalDisplay(observation).length > 30">
                                            {{ getTvalDisplay(observation) }}<br />
                                        </span>
                                        <small>Click to preview file</small>
                                    </q-tooltip>

                                    <!-- Hover Button -->
                                    <div v-if="showHoverButton" class="file-hover-button">
                                        <q-btn flat round dense icon="visibility" color="primary" size="sm"
                                            @click="openFilePreview">
                                            <q-tooltip>Preview file</q-tooltip>
                                        </q-btn>
                                    </div>
                                </div>
                            </div>
                            <!-- Standard Value Display for other types -->
                            <div v-else-if="observation.TVAL_CHAR" class="text-primary text-weight-medium">
                                {{ getTvalDisplay(observation) }}
                            </div>
                            <div v-else-if="observation.NVAL_NUM" class="text-primary text-weight-medium">
                                {{ observation.NVAL_NUM }}
                                <span class="text-grey-6">{{ getUnitDisplay(observation) }}</span>
                            </div>
                            <div v-else class="text-grey-5 text-italic">
                                No value recorded
                            </div>
                        </div>

                        <!-- Metadata -->
                        <div class="row items-center justify-between q-mt-xs">
                            <div class="text-caption text-grey-6">
                                {{ formatDate(observation.START_DATE) }}
                            </div>
                            <q-chip v-if="observation.CATEGORY_CHAR" size="xs" color="grey-3" text-color="grey-7" dense>
                                {{ observation.CATEGORY_CHAR }}
                            </q-chip>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="card-actions">
                    <!-- Info Button -->
                    <q-btn flat round dense icon="info" color="primary" size="sm">
                        <q-tooltip class="bg-grey-9 text-white" style="max-width: 400px; white-space: pre-wrap;">
                            {{ formatObservationTooltip(observation) }}
                        </q-tooltip>
                    </q-btn>

                    <!-- Edit and Delete Buttons -->
                    <q-btn v-if="observation.VALTYPE_CD !== 'R'" flat round dense icon="edit" color="primary" size="sm"
                        @click="startEdit">
                        <q-tooltip>Edit Observation</q-tooltip>
                    </q-btn>
                    <q-btn flat round dense icon="delete" color="negative" size="sm" @click="confirmDelete">
                        <q-tooltip>Delete Observation</q-tooltip>
                    </q-btn>
                </div>
            </div>
        </q-card-section>

        <!-- File Preview Dialog -->
        <FilePreviewDialog v-if="observation.VALTYPE_CD === 'R' && observation.TVAL_CHAR" v-model="showFileDialog"
            :observation-id="observation.OBSERVATION_ID" :file-info="JSON.parse(observation.TVAL_CHAR)"
            :concept-name="getConceptName(observation)" :upload-date="observation.START_DATE" />
    </q-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ValueTypeIcon from 'components/shared/ValueTypeIcon.vue'
import FilePreviewDialog from 'components/shared/FilePreviewDialog.vue'

const props = defineProps({
    observation: {
        type: Object,
        required: true
    }
})

const emit = defineEmits(['updated', 'deleted'])

const $q = useQuasar()
const conceptStore = useConceptResolutionStore()
const dbStore = useDatabaseStore()
const logger = useLoggingStore().createLogger('ObservationCard')

// Local state
const isEditing = ref(false)
const editForm = ref({
    startDate: '',
    nvalNum: null,
    tvalChar: ''
})

// Selection options state for 'F' type observations
const selectionOptions = ref([])
const loadingSelectionOptions = ref(false)

// File-related state for 'R' type observations
const showHoverButton = ref(false)
const showFileDialog = ref(false)

// Computed properties
const valueInputType = computed(() => {
    const valtype = props.observation.VALTYPE_CD
    switch (valtype) {
        case 'N': return 'numeric'
        case 'D': return 'date'
        case 'F': return 'selection' // Finding type should use selection
        case 'S': return 'selection'
        case 'R': return 'file' // Raw data type should show file info
        case 'T':
        case 'A':
        default:
            return 'text'
    }
})

// Helper methods
const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString()
}

const getConceptName = (observation) => {
    // Prefer resolved name from view
    if (observation.CONCEPT_NAME_CHAR) {
        return observation.CONCEPT_NAME_CHAR
    }

    // Fallback to concept store resolution
    if (observation.CONCEPT_CD) {
        const resolved = conceptStore.getResolved(observation.CONCEPT_CD)
        if (resolved?.label) {
            return resolved.label
        }
    }

    return observation.CONCEPT_CD || 'Unknown Concept'
}

const getTvalDisplay = (observation) => {
    // For file type (R), parse and display file info
    if (observation.VALTYPE_CD === 'R' && observation.TVAL_CHAR) {
        try {
            const fileInfo = JSON.parse(observation.TVAL_CHAR)
            return `${fileInfo.filename} (${formatFileSize(fileInfo.size)})`
        } catch {
            return observation.TVAL_CHAR
        }
    }

    // Prefer resolved text value from view
    if (observation.TVAL_RESOLVED) {
        return observation.TVAL_RESOLVED
    }

    // Fallback to concept store resolution if TVAL_CHAR looks like a concept code
    if (observation.TVAL_CHAR) {
        const resolved = conceptStore.getResolved(observation.TVAL_CHAR)
        if (resolved?.label) {
            return resolved.label
        }
        return observation.TVAL_CHAR
    }

    return 'N/A'
}

const getUnitDisplay = (observation) => {
    // Prefer resolved unit from view
    if (observation.UNIT_RESOLVED) {
        return observation.UNIT_RESOLVED
    }

    // Fallback to concept store resolution
    if (observation.UNIT_CD) {
        const resolved = conceptStore.getResolved(observation.UNIT_CD)
        if (resolved?.label) {
            return resolved.label
        }
        return observation.UNIT_CD
    }

    return ''
}

const formatObservationTooltip = (observation) => {
    const lines = []
    lines.push('=== Observation Details ===\n')

    lines.push(`Concept: ${getConceptName(observation)}`)
    lines.push(`Code: ${observation.CONCEPT_CD || 'N/A'}`)
    lines.push(`Date: ${formatDate(observation.START_DATE)}`)
    lines.push(`Category: ${observation.CATEGORY_CHAR || 'N/A'}`)

    if (observation.NVAL_NUM) {
        lines.push(`Numeric Value: ${observation.NVAL_NUM} ${getUnitDisplay(observation)}`)
    }

    if (observation.TVAL_CHAR) {
        lines.push(`Text Value: ${getTvalDisplay(observation)}`)
    }

    lines.push(`\nEncounter: ${observation.ENCOUNTER_NUM}`)
    lines.push(`Provider: ${observation.PROVIDER_ID || 'N/A'}`)
    lines.push(`Location: ${observation.LOCATION_CD || 'N/A'}`)

    if (observation.OBSERVATION_BLOB) {
        lines.push(`\nAdditional Data: Available`)
    }

    lines.push(`\nLast Updated: ${formatDate(observation.UPDATE_DATE)}`)
    lines.push(`Source: ${observation.SOURCESYSTEM_CD || 'N/A'}`)

    return lines.join('\n')
}

// File-related helper methods
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const openFilePreview = () => {
    showFileDialog.value = true
    showHoverButton.value = false
}

// Selection options methods

const getSelectionOptions = () => {
    // Return the fetched options if available, otherwise fallback to common options
    if (selectionOptions.value.length > 0) {
        return selectionOptions.value
    }

    // Fallback options for when no hierarchy options are found
    return [
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' },
        { label: 'Unknown', value: 'Unknown' },
        { label: 'Not Applicable', value: 'N/A' }
    ]
}

// Edit functionality
const startEdit = async () => {
    isEditing.value = true

    // Populate edit form
    editForm.value = {
        startDate: props.observation.START_DATE ? props.observation.START_DATE.split('T')[0] : '',
        nvalNum: props.observation.NVAL_NUM,
        tvalChar: props.observation.TVAL_CHAR || ''
    }

    // Fetch selection options for Finding (F) and Selection (S) type observations
    if (props.observation.VALTYPE_CD === 'F' || props.observation.VALTYPE_CD === 'S') {
        logger.info('Fetching selection options for edit mode', {
            conceptCode: props.observation.CONCEPT_CD,
            valtype: props.observation.VALTYPE_CD
        })

        // Use concept store method which handles caching
        const options = await conceptStore.getSelectionOptions(props.observation.CONCEPT_CD)
        selectionOptions.value = options

        logger.debug('Selection options loaded for edit', {
            conceptCode: props.observation.CONCEPT_CD,
            optionsCount: options.length
        })
    } else {
        // Clear selection options for non-selection observations
        selectionOptions.value = []
    }
}

const cancelEdit = () => {
    isEditing.value = false
    editForm.value = {
        startDate: '',
        nvalNum: null,
        tvalChar: ''
    }
}

const saveChanges = async () => {
    try {
        const updates = {}

        // Check what changed
        if (editForm.value.startDate !== (props.observation.START_DATE ? props.observation.START_DATE.split('T')[0] : '')) {
            updates.START_DATE = editForm.value.startDate
        }

        if (editForm.value.nvalNum !== props.observation.NVAL_NUM) {
            updates.NVAL_NUM = editForm.value.nvalNum
        }

        if (editForm.value.tvalChar !== (props.observation.TVAL_CHAR || '')) {
            updates.TVAL_CHAR = editForm.value.tvalChar
        }

        if (Object.keys(updates).length === 0) {
            $q.notify({
                type: 'info',
                message: 'No changes to save',
                position: 'top'
            })
            cancelEdit()
            return
        }

        // Build update query
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ')
        const values = Object.values(updates)
        values.push(props.observation.OBSERVATION_ID)

        const updateQuery = `UPDATE OBSERVATION_FACT SET ${setClause} WHERE OBSERVATION_ID = ?`
        const result = await dbStore.executeQuery(updateQuery, values)

        if (result.success) {
            $q.notify({
                type: 'positive',
                message: 'Observation updated successfully',
                position: 'top'
            })

            cancelEdit()
            emit('updated')
        } else {
            throw new Error(result.error || 'Failed to update observation')
        }
    } catch (error) {
        logger.error('Error updating observation', error)
        $q.notify({
            type: 'negative',
            message: `Failed to update observation: ${error.message}`,
            position: 'top'
        })
    }
}

// Delete functionality
const confirmDelete = () => {
    $q.dialog({
        title: 'Delete Observation',
        message: `Are you sure you want to delete this observation: "${getConceptName(props.observation)}"?`,
        cancel: true,
        persistent: true,
        color: 'negative'
    }).onOk(async () => {
        await deleteObservation()
    })
}

const deleteObservation = async () => {
    try {
        const deleteQuery = 'DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?'
        const result = await dbStore.executeQuery(deleteQuery, [props.observation.OBSERVATION_ID])

        if (result.success) {
            $q.notify({
                type: 'positive',
                message: 'Observation deleted successfully',
                position: 'top'
            })

            emit('deleted', props.observation.OBSERVATION_ID)
        } else {
            throw new Error(result.error || 'Failed to delete observation')
        }
    } catch (error) {
        logger.error('Error deleting observation', error)
        $q.notify({
            type: 'negative',
            message: `Failed to delete observation: ${error.message}`,
            position: 'top'
        })
    }
}
</script>

<style lang="scss" scoped>
.observation-card {
    position: relative;
    transition: all 0.3s ease;
    border-radius: 8px;
    overflow: hidden;
    animation: fadeInUp 0.5s ease-out;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

        .card-actions {
            opacity: 1;
            transform: scale(1);
            pointer-events: auto;
            background: rgba(255, 255, 255, 0.95);
        }
    }

    &.editing-card {
        border: 2px solid #1976d2;
        background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
        transform: scale(1.02);
        box-shadow: 0 6px 20px rgba(25, 118, 210, 0.2);

        .card-actions {
            opacity: 1;
            transform: scale(1);
            pointer-events: auto;
            background: rgba(255, 255, 255, 0.95);
        }
    }

    // Value type specific styling
    &[data-value-type="N"] {
        border-left: 4px solid #26a69a; // Teal for numeric
    }

    &[data-value-type="T"] {
        border-left: 4px solid #8d6e63; // Brown for text
    }

    &[data-value-type="D"] {
        border-left: 4px solid #ff9800; // Orange for date
    }

    &[data-value-type="F"] {
        border-left: 4px solid #4caf50; // Green for finding
    }

    &[data-value-type="A"] {
        border-left: 4px solid #2196f3; // Blue for answer
    }

    &[data-value-type="R"] {
        border-left: 4px solid #9c27b0; // Purple for raw text
    }

    &[data-value-type="S"] {
        border-left: 4px solid #3f51b5; // Indigo for selection
    }
}

.observation-name {
    font-size: 0.875rem;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    min-height: 1.5em;
    display: flex;
    align-items: center;
}

.card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    transform: scale(0.8);
    pointer-events: none;
    transition: all 0.3s ease;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 20px;
    backdrop-filter: blur(4px);
    padding: 4px;
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
        background: rgba(255, 255, 255, 0.95);
        transform: scale(1.05);
    }
}

.edit-form {
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(25, 118, 210, 0.2);

    .q-input {
        background: rgba(255, 255, 255, 0.9);
        border-radius: 4px;
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

// File display and hover styles
.file-display {
    position: relative;

    .file-hover-area {
        position: relative;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s ease;

        &:hover {
            background-color: rgba(25, 118, 210, 0.08);
        }

        // Special styling for file values (R type)
        &.file-value-display {
            font-size: 0.75rem; // Smaller font size than standard text
            font-weight: 400; // Normal weight instead of medium
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: calc(100% - 40px); // Leave space for hover button
            padding-right: 40px; // Ensure text doesn't overlap button area
            cursor: pointer; // Make it clear the filename is clickable

            &:hover {
                background-color: rgba(25, 118, 210, 0.12); // Slightly stronger hover effect
                text-decoration: underline; // Underline on hover to indicate clickability
            }
        }
    }

    .file-hover-button {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        animation: fadeIn 0.2s ease-out;
        z-index: 10;
    }
}



@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@media (max-width: 480px) {
    .observation-card {
        .q-card-section {
            padding: 8px !important;
        }

        .file-display {
            .file-hover-area.file-value-display {
                font-size: 0.7rem; // Even smaller on mobile
                max-width: calc(100% - 35px); // Less space for button on mobile
                padding-right: 35px;
            }

            .file-hover-button {
                right: 4px;
            }
        }
    }
}
</style>
