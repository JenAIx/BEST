<template>
    <div class="q-mb-lg">
        <!-- Visit Header -->
        <div class="visit-header q-mb-md" :class="{ 'cursor-pointer': visitGroup.observations.length > 0 }"
            @click="visitGroup.observations.length > 0 ? toggleVisitExpansion() : null"
            @mouseenter="hoveredVisit = true" @mouseleave="hoveredVisit = false">
            <div class="row items-center q-gutter-md">
                <q-avatar color="primary" text-color="white" size="40px">
                    {{ visitGroup.encounterNum }}
                </q-avatar>

                <!-- Status Chip -->
                <div class="col-auto text-center" v-if="visitGroup.visit?.ACTIVE_STATUS_CD">
                    <q-chip :color="getStatusColor(visitGroup.visit.ACTIVE_STATUS_CD)" text-color="white" size="xs">
                        {{ getStatusLabel(visitGroup.visit.ACTIVE_STATUS_CD) }}
                    </q-chip>
                </div>

                <div class="col">
                    <div class="text-h6 text-primary">
                        {{ formatDate(visitGroup.visitDate) }}
                        <span v-if="visitGroup.visit?.END_DATE"> - {{ formatDate(visitGroup.visit.END_DATE)
                            }}</span>
                        <!-- Visit Notes inline -->
                        <span v-if="visitGroup.visit?.VISIT_BLOB" class="visit-notes-inline q-ml-md">
                            <q-icon name="notes" size="16px" class="q-mr-xs" />
                            <span class="text-body2 text-grey-7">
                                <span v-if="visitGroup.visit.VISIT_BLOB.length <= 60">
                                    {{ visitGroup.visit.VISIT_BLOB }}
                                </span>
                                <span v-else>
                                    <span v-if="!isNotesExpanded">
                                        {{ visitGroup.visit.VISIT_BLOB.substring(0, 60) }}...
                                        <q-btn flat dense size="xs" color="primary" @click.stop="toggleNotesExpansion"
                                            class="q-ml-xs">
                                            more
                                        </q-btn>
                                    </span>
                                    <span v-else>
                                        {{ visitGroup.visit.VISIT_BLOB }}
                                        <q-btn flat dense size="xs" color="primary" @click.stop="toggleNotesExpansion"
                                            class="q-ml-xs">
                                            less
                                        </q-btn>
                                    </span>
                                </span>
                            </span>
                        </span>
                    </div>
                    <div class="text-caption text-grey-6">
                        Visit {{ visitGroup.encounterNum }} • {{ visitGroup.observations.length }} observations
                        <span v-if="visitGroup.visit?.LOCATION_CD"> • {{ visitGroup.visit.LOCATION_CD }}</span>
                    </div>
                </div>

                <!-- Hover Action Buttons -->
                <div v-if="hoveredVisit" class="visit-actions q-mr-md">
                    <q-btn flat round icon="add" size="md" color="positive" @click.stop="openCreateObservationDialog"
                        class="q-mr-sm">
                        <q-tooltip>Add observation</q-tooltip>
                    </q-btn>
                    <q-btn flat round icon="edit" size="md" color="primary" @click.stop="openEditVisitDialog"
                        class="q-mr-sm">
                        <q-tooltip>Edit visit</q-tooltip>
                    </q-btn>
                    <q-btn flat round icon="delete" size="md" color="negative" @click.stop="confirmDeleteVisit"
                        class="q-mr-sm">
                        <q-tooltip>Delete visit</q-tooltip>
                    </q-btn>
                </div>

                <!-- Observations Count -->
                <q-chip
                    :color="visitGroup.observations.length === 0 ? 'grey' : visitGroup.observations.length > 10 ? 'orange' : visitGroup.observations.length > 5 ? 'blue' : 'green'"
                    text-color="white" size="sm">
                    {{ visitGroup.observations.length }}
                </q-chip>

                <q-btn v-if="visitGroup.observations.length > 0" flat round dense
                    :icon="isExpanded ? 'expand_less' : 'expand_more'" color="primary" size="sm">
                    <q-tooltip>
                        {{ isExpanded ? 'Collapse' : 'Expand' }} visit
                    </q-tooltip>
                </q-btn>
                <div v-else class="text-caption text-grey-5 q-ml-sm">
                    No observations to expand
                </div>
            </div>
            <q-separator class="q-mt-md" />
        </div>

        <!-- Observations Grid -->
        <q-slide-transition>
            <div v-show="isExpanded">
                <!-- No observations message -->
                <div v-if="visitGroup.observations.length === 0" class="text-center q-py-lg">
                    <q-icon name="science_off" size="48px" color="grey-4" />
                    <div class="text-body2 text-grey-6 q-mt-sm">No observations recorded for this visit
                    </div>
                    <div class="text-caption text-grey-5">
                        Visit from {{ formatDate(visitGroup.visitDate) }}
                        <span v-if="visitGroup.endDate"> to {{ formatDate(visitGroup.endDate) }}</span>
                    </div>
                </div>

                <!-- Observations Grid -->
                <div v-else class="observations-grid">
                    <ObservationCard v-for="observation in visitGroup.observations" :key="observation.OBSERVATION_ID"
                        :observation="observation" @updated="$emit('observationUpdated')"
                        @deleted="$emit('observationDeleted')" />
                </div>
            </div>
        </q-slide-transition>

        <!-- Edit Visit Dialog -->
        <EditVisitDialog v-model="showEditVisitDialog" :patient="patient" :visit="visitGroup"
            @visitUpdated="onVisitUpdated" />

        <!-- Create Observation Dialog -->
        <CreateObservationDialog v-model="showCreateObservationDialog" :patient="patient" :visit="visitGroup"
            @observationCreated="onObservationCreated" />

        <!-- Delete Confirmation Dialogs -->
        <AppDialog v-model="showDeleteConfirmDialog" :title="deleteDialogTitle" :message="deleteDialogMessage" size="md"
            persistent ok-label="Delete" ok-color="negative" cancel-label="Cancel" @ok="onDeleteConfirmed"
            @cancel="onDeleteCancelled" />

        <AppDialog v-model="showDeleteWarningDialog" title="Visit Has Observations" :message="deleteWarningMessage"
            size="md" persistent ok-label="Delete All" ok-color="negative" cancel-label="Cancel"
            @ok="onDeleteWarningConfirmed" @cancel="onDeleteWarningCancelled" />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ObservationCard from './ObservationCard.vue'
import EditVisitDialog from './EditVisitDialog.vue'
import CreateObservationDialog from './CreateObservationDialog.vue'
import AppDialog from '../shared/AppDialog.vue'

const props = defineProps({
    visitGroup: {
        type: Object,
        required: true
    },
    isExpanded: {
        type: Boolean,
        default: false
    },
    patient: {
        type: Object,
        required: true
    }
})

const emit = defineEmits([
    'toggleExpansion',
    'observationUpdated',
    'observationDeleted',
    'visitUpdated'
])

const $q = useQuasar()
const conceptStore = useConceptResolutionStore()
const databaseStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitItem')

// Local state
const hoveredVisit = ref(false)
const isNotesExpanded = ref(false)

// Dialog states
const showEditVisitDialog = ref(false)
const showCreateObservationDialog = ref(false)

// Delete dialog states
const showDeleteConfirmDialog = ref(false)
const showDeleteWarningDialog = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteWarningMessage = ref('')

// Methods
const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString()
}

const toggleVisitExpansion = () => {
    emit('toggleExpansion', props.visitGroup.encounterNum)
}

const toggleNotesExpansion = () => {
    isNotesExpanded.value = !isNotesExpanded.value
}

// Status resolution functions
const getStatusColor = (statusCode) => {
    const cache = conceptStore.cache
    const resolved = cache[statusCode]
    return resolved?.data?.color || 'grey'
}

const getStatusLabel = (statusCode) => {
    const cache = conceptStore.cache
    const resolved = cache[statusCode]
    return resolved?.data?.label || conceptStore.getFallbackLabel(statusCode)
}

// Visit action methods
const openEditVisitDialog = () => {
    showEditVisitDialog.value = true
}

const openCreateObservationDialog = () => {
    showCreateObservationDialog.value = true
}

const confirmDeleteVisit = () => {
    const visitData = props.visitGroup.visit || props.visitGroup
    const visitDate = formatDate(visitData.START_DATE)

    // Set up first confirmation dialog
    deleteDialogTitle.value = 'Delete Visit'
    deleteDialogMessage.value = `Are you sure you want to delete visit <strong>${props.visitGroup.encounterNum}</strong> from <strong>${visitDate}</strong>?`

    // Show first confirmation dialog
    showDeleteConfirmDialog.value = true
}

// Dialog event handlers
const onDeleteConfirmed = () => {
    const observationCount = props.visitGroup.observations?.length || 0

    // Check if visit has observations
    if (observationCount > 0) {
        // Set up warning dialog
        deleteWarningMessage.value = `This visit contains <strong>${observationCount}</strong> observation${observationCount > 1 ? 's' : ''}. Deleting the visit will also delete all associated observations.<br><br><strong>This action cannot be undone.</strong>`

        // Show warning dialog
        showDeleteWarningDialog.value = true
    } else {
        // No observations, proceed with deletion
        performDeleteVisit()
    }
}

const onDeleteCancelled = () => {
    // Dialog closed, no action needed
}

const onDeleteWarningConfirmed = () => {
    performDeleteVisit()
}

const onDeleteWarningCancelled = () => {
    // Dialog closed, no action needed
}

// Perform the actual visit deletion
const performDeleteVisit = async () => {
    const visitData = props.visitGroup.visit || props.visitGroup

    const loadingDialog = $q.dialog({
        title: 'Deleting Visit',
        message: 'Please wait while the visit is being deleted...',
        progress: true,
        persistent: true,
        ok: false,
        cancel: false
    })

    try {
        // Get visit repository
        const visitRepository = databaseStore.getRepository('visit')
        if (!visitRepository) {
            throw new Error('Visit repository not available')
        }

        // Delete the visit (cascade delete will handle observations)
        await visitRepository.delete(visitData.ENCOUNTER_NUM)

        loadingDialog.hide()

        $q.notify({
            type: 'positive',
            message: `Visit ${visitData.ENCOUNTER_NUM} deleted successfully`,
            position: 'top',
            timeout: 3000,
            actions: [
                {
                    icon: 'close',
                    color: 'white',
                    handler: () => { /* dismiss */ }
                }
            ]
        })

        // Clean up state
        showDeleteConfirmDialog.value = false
        showDeleteWarningDialog.value = false

        // Small delay to ensure database operation completes
        await new Promise(resolve => setTimeout(resolve, 100))

        // Emit to parent to reload data
        emit('visitUpdated')

    } catch (error) {
        loadingDialog.hide()
        logger.error('Error deleting visit', error)

        // Clean up state on error
        showDeleteConfirmDialog.value = false
        showDeleteWarningDialog.value = false

        $q.notify({
            type: 'negative',
            message: `Failed to delete visit: ${error.message}`,
            position: 'top',
            timeout: 5000,
            actions: [
                {
                    icon: 'close',
                    color: 'white',
                    handler: () => { /* dismiss */ }
                }
            ]
        })
    }
}

// Event handlers for dialogs
const onVisitUpdated = () => {
    emit('visitUpdated')
}

const onObservationCreated = () => {
    emit('observationUpdated')
}
</script>

<style lang="scss" scoped>
.visit-header {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    transition: all 0.3s ease;

    &.cursor-pointer {
        user-select: none;

        &:hover {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
    }

    // Style for empty visits (non-clickable)
    &:not(.cursor-pointer) {
        opacity: 0.7;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);

        .text-h6 {
            color: #6c757d !important;
        }
    }

    .visit-notes-inline {
        font-style: italic;
        display: inline-flex;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.04);
        padding: 4px 8px;
        border-radius: 12px;
        border: 1px solid rgba(25, 118, 210, 0.2);

        .q-icon {
            color: rgba(25, 118, 210, 0.7);
        }

        .text-body2 {
            font-size: 0.85rem;
            line-height: 1.3;
        }

        .q-btn {
            min-height: auto;
            padding: 2px 6px;
            font-size: 0.75rem;
            text-transform: none;
        }
    }

    .q-avatar {
        box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
    }

    .text-h6 {
        font-weight: 600;
        letter-spacing: -0.025em;
    }
}

.observations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

// Visit actions styling
.visit-actions {
    display: flex;
    align-items: center;
    animation: fadeInRight 0.3s ease;

    .q-btn {
        transition: all 0.2s ease;
        min-height: 40px;
        min-width: 40px;

        &:hover {
            transform: translateY(-1px) scale(1.1);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
        }

        // Enhanced button styling for better visibility
        &.text-positive {
            background-color: rgba(76, 175, 80, 0.1);

            &:hover {
                background-color: rgba(76, 175, 80, 0.2);
            }
        }

        &.text-primary {
            background-color: rgba(25, 118, 210, 0.1);

            &:hover {
                background-color: rgba(25, 118, 210, 0.2);
            }
        }

        &.text-negative {
            background-color: rgba(244, 67, 54, 0.1);

            &:hover {
                background-color: rgba(244, 67, 54, 0.2);
            }
        }
    }
}

@keyframes fadeInRight {
    from {
        opacity: 0;
        transform: translateX(10px);
    }

    to {
        opacity: 1;
        transform: translateX(0);
    }
}

// Animation for new cards
.observation-card {
    animation: fadeInUp 0.5s ease-out;
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

// Responsive adjustments
@media (max-width: 768px) {
    .observations-grid {
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .visit-header {
        padding: 12px;
    }
}

@media (max-width: 480px) {
    .observations-grid {
        gap: 8px;
    }

    .observation-card {
        .q-card-section {
            padding: 8px !important;
        }
    }
}
</style>
