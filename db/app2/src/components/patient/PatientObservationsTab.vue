<template>
    <div>
        <!-- Toolbar -->
        <div class="q-mb-md">
            <q-card flat bordered>
                <q-card-section class="q-pa-sm">
                    <div class="row items-center q-gutter-md">
                        <!-- Filter Controls - only show when there are observations or visits -->
                        <template v-if="hasObservationsOrVisits">
                            <div class="col-auto">
                                <q-input v-model="filterText" outlined dense placeholder="Filter observations..."
                                    clearable style="min-width: 200px">
                                    <template v-slot:prepend>
                                        <q-icon name="search" />
                                    </template>
                                </q-input>
                            </div>

                            <div class="col-auto">
                                <q-select v-model="filterCategory" :options="categoryOptions" outlined dense clearable
                                    label="Category" emit-value map-options style="min-width: 150px" />
                            </div>

                            <div class="col-auto">
                                <q-select v-model="filterValueType" :options="valueTypeOptions" outlined dense clearable
                                    label="Value Type" emit-value map-options style="min-width: 120px" />
                            </div>

                            <!-- Sort Control -->
                            <div class="col-auto">
                                <div class="sort-control">
                                    <q-btn flat icon="grid_view" size="md" class="sort-button">
                                        <q-tooltip>Sort observations within visits</q-tooltip>
                                        <q-menu anchor="bottom right" self="top right">
                                            <q-list style="min-width: 200px">
                                                <q-item-label header>Sort observations by:</q-item-label>
                                                <q-item clickable v-close-popup @click="setSortMode('date')"
                                                    :class="{ 'bg-blue-1': sortMode === 'date' }">
                                                    <q-item-section avatar>
                                                        <q-icon name="schedule" />
                                                    </q-item-section>
                                                    <q-item-section>
                                                        <q-item-label>Date (Default)</q-item-label>
                                                        <q-item-label caption>Most recent first</q-item-label>
                                                    </q-item-section>
                                                    <q-item-section side v-if="sortMode === 'date'">
                                                        <q-icon name="check" />
                                                    </q-item-section>
                                                </q-item>
                                                <q-item clickable v-close-popup @click="setSortMode('category')"
                                                    :class="{ 'bg-blue-1': sortMode === 'category' }">
                                                    <q-item-section avatar>
                                                        <q-icon name="category" />
                                                    </q-item-section>
                                                    <q-item-section>
                                                        <q-item-label>Category</q-item-label>
                                                        <q-item-label caption>Group by category</q-item-label>
                                                    </q-item-section>
                                                    <q-item-section side v-if="sortMode === 'category'">
                                                        <q-icon name="check" />
                                                    </q-item-section>
                                                </q-item>
                                                <q-item clickable v-close-popup @click="setSortMode('alphabetical')"
                                                    :class="{ 'bg-blue-1': sortMode === 'alphabetical' }">
                                                    <q-item-section avatar>
                                                        <q-icon name="sort_by_alpha" />
                                                    </q-item-section>
                                                    <q-item-section>
                                                        <q-item-label>Alphabetical</q-item-label>
                                                        <q-item-label caption>By concept name A-Z</q-item-label>
                                                    </q-item-section>
                                                    <q-item-section side v-if="sortMode === 'alphabetical'">
                                                        <q-icon name="check" />
                                                    </q-item-section>
                                                </q-item>
                                                <q-item clickable v-close-popup @click="setSortMode('valtype')"
                                                    :class="{ 'bg-blue-1': sortMode === 'valtype' }">
                                                    <q-item-section avatar>
                                                        <q-icon name="data_usage" />
                                                    </q-item-section>
                                                    <q-item-section>
                                                        <q-item-label>Value Type</q-item-label>
                                                        <q-item-label caption>Group by data type</q-item-label>
                                                    </q-item-section>
                                                    <q-item-section side v-if="sortMode === 'valtype'">
                                                        <q-icon name="check" />
                                                    </q-item-section>
                                                </q-item>
                                            </q-list>
                                        </q-menu>
                                    </q-btn>

                                    <!-- Sort Mode Indicator -->
                                    <q-icon :name="getSortIcon(sortMode)" size="12px" class="sort-indicator-icon" />
                                </div>
                            </div>
                        </template>

                        <q-space />

                        <!-- Visit Controls - always show -->
                        <div class="col-auto">
                            <q-btn flat dense icon="add" size="md" @click="showCreateVisitDialog = true"
                                class="create-visit-btn" color="primary">
                                <q-tooltip>Create new visit</q-tooltip>
                            </q-btn>

                            <q-btn v-if="hasObservationsOrVisits" flat dense :icon="toggleIcon" size="md"
                                @click="toggleAllVisits" class="toggle-visits-btn q-ml-sm">
                                <q-tooltip>{{ toggleTooltip }}</q-tooltip>
                            </q-btn>
                        </div>
                    </div>
                </q-card-section>
            </q-card>
        </div>

        <!-- No Data State -->
        <div v-if="!hasObservationsOrVisits" class="text-center q-py-xl">
            <q-icon name="science_off" size="64px" color="grey-5" />
            <div class="text-h6 text-grey-6 q-mt-md">No visits or observations found</div>
            <div class="text-body2 text-grey-6 q-mb-md">This patient has no recorded visits or observations yet.</div>
            <q-btn color="primary" icon="add" label="Create First Visit" @click="showCreateVisitDialog = true"
                unelevated>
                <q-tooltip>Create a new visit to start recording observations</q-tooltip>
            </q-btn>
        </div>

        <!-- Observations Display -->
        <div v-else-if="hasObservationsOrVisits">
            <VisitItem v-for="visitGroup in groupedObservations" :key="visitGroup.encounterNum"
                :visit-group="visitGroup" :patient="patient" :is-expanded="isVisitExpanded(visitGroup.encounterNum)"
                @toggle-expansion="toggleVisitExpansion" @observation-updated="onObservationUpdated"
                @observation-deleted="onObservationDeleted" @visit-updated="onVisitUpdated" />

        </div>

        <!-- Create Visit Dialog -->
        <CreateVisitDialog v-model="showCreateVisitDialog" :patient="patient" @visitCreated="onVisitCreated" />


    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import CreateVisitDialog from './CreateVisitDialog.vue'
import VisitItem from './VisitItem.vue'

const props = defineProps({
    patient: {
        type: Object,
        required: true
    },
    observations: {
        type: Array,
        default: () => []
    },
    visits: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['updated'])

const conceptStore = useConceptResolutionStore()
const localSettingsStore = useLocalSettingsStore()

// Reactive state
const filterText = ref('')
const filterCategory = ref(null)
const filterValueType = ref(null)

// Sort state - initialize from store
const sortMode = ref('date')

// Collapsible visits state
const expandedVisits = ref(new Set())

// Create visit dialog state
const showCreateVisitDialog = ref(false)



// Computed properties
const hasObservationsOrVisits = computed(() => {
    const hasObservations = props.observations && props.observations.length > 0
    const hasVisits = props.visits && props.visits.length > 0
    return hasObservations || hasVisits
})

const filteredObservations = computed(() => {
    let filtered = [...props.observations]

    // Text filter
    if (filterText.value) {
        const searchTerm = filterText.value.toLowerCase()
        filtered = filtered.filter(obs =>
            (obs.CONCEPT_NAME_CHAR && obs.CONCEPT_NAME_CHAR.toLowerCase().includes(searchTerm)) ||
            (obs.CONCEPT_CD && obs.CONCEPT_CD.toLowerCase().includes(searchTerm)) ||
            (obs.TVAL_CHAR && obs.TVAL_CHAR.toLowerCase().includes(searchTerm)) ||
            (obs.CATEGORY_CHAR && obs.CATEGORY_CHAR.toLowerCase().includes(searchTerm))
        )
    }

    // Category filter
    if (filterCategory.value) {
        filtered = filtered.filter(obs => obs.CATEGORY_CHAR === filterCategory.value)
    }

    // Value type filter
    if (filterValueType.value) {
        if (filterValueType.value === 'numeric') {
            filtered = filtered.filter(obs => obs.NVAL_NUM !== null && obs.NVAL_NUM !== undefined)
        } else if (filterValueType.value === 'text') {
            filtered = filtered.filter(obs => obs.TVAL_CHAR)
        } else if (filterValueType.value === 'empty') {
            filtered = filtered.filter(obs => !obs.NVAL_NUM && !obs.TVAL_CHAR)
        } else {
            // Filter by VALTYPE_CD (A, D, F, N, R, S, T)
            filtered = filtered.filter(obs => obs.VALTYPE_CD === filterValueType.value)
        }
    }

    return filtered
})

const categoryOptions = computed(() => {
    const categories = [...new Set(props.observations.map(obs => obs.CATEGORY_CHAR).filter(Boolean))]
    return categories.map(cat => ({ label: cat, value: cat }))
})

const groupedObservations = computed(() => {
    // Start with all visits as the base
    const groups = props.visits.map(visit => ({
        encounterNum: visit.ENCOUNTER_NUM,
        visitDate: visit.START_DATE,
        endDate: visit.END_DATE,
        visit: visit, // Include full visit object for status and location
        observations: []
    }))

    // Add observations to their respective visits
    filteredObservations.value.forEach(obs => {
        const group = groups.find(g => g.encounterNum === obs.ENCOUNTER_NUM)
        if (group) {
            group.observations.push(obs)
        }
    })

    // Sort groups by visit start date (most recent first) and observations within each group by selected sort mode
    return groups
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
        .map(group => ({
            ...group,
            observations: sortObservations(group.observations, sortMode.value)
        }))
})

const valueTypeOptions = [
    { label: 'Answer (A)', value: 'A' },
    { label: 'Date (D)', value: 'D' },
    { label: 'Finding (F)', value: 'F' },
    { label: 'Numeric (N)', value: 'N' },
    { label: 'Raw Text (R)', value: 'R' },
    { label: 'Selection (S)', value: 'S' },
    { label: 'Text (T)', value: 'T' },
    { label: '--- Data Types ---', value: '', disable: true },
    { label: 'Has Numeric Values', value: 'numeric' },
    { label: 'Has Text Values', value: 'text' },
    { label: 'Empty Values', value: 'empty' }
]

// Initialize concept store and preload concepts when component mounts
onMounted(async () => {
    // Initialize stores
    await conceptStore.initialize()
    await localSettingsStore.initialize()

    // Load sort mode from settings store
    sortMode.value = localSettingsStore.getPatientObservationsSortMode()

    // Preload concepts from current observations
    if (props.observations && props.observations.length > 0) {
        await preloadObservationConcepts()
    }
})

// Watch for changes in observations and preload new concepts
watch(() => props.observations, async (newObservations) => {
    if (newObservations && newObservations.length > 0) {
        await preloadObservationConcepts()
    }
}, { deep: true })

// Preload all unique concepts from observations
const preloadObservationConcepts = async () => {
    const conceptsToResolve = new Set()

    props.observations.forEach(obs => {
        // Add concept codes that might need resolution
        if (obs.CONCEPT_CD && !obs.CONCEPT_NAME_CHAR) {
            conceptsToResolve.add(obs.CONCEPT_CD)
        }
        if (obs.TVAL_CHAR && !obs.TVAL_RESOLVED) {
            conceptsToResolve.add(obs.TVAL_CHAR)
        }
        if (obs.UNIT_CD && !obs.UNIT_RESOLVED) {
            conceptsToResolve.add(obs.UNIT_CD)
        }
    })

    if (conceptsToResolve.size > 0) {
        await conceptStore.resolveBatch([...conceptsToResolve], { context: 'patient_observations' })
    }
}



// Sorting functions
const sortObservations = (observations, mode) => {
    const sorted = [...observations]

    switch (mode) {
        case 'date':
            return sorted.sort((a, b) => new Date(b.START_DATE) - new Date(a.START_DATE))

        case 'category':
            return sorted.sort((a, b) => {
                const catA = a.CATEGORY_CHAR || 'ZZZ' // Put empty categories at end
                const catB = b.CATEGORY_CHAR || 'ZZZ'
                if (catA === catB) {
                    // Secondary sort by date within same category
                    return new Date(b.START_DATE) - new Date(a.START_DATE)
                }
                return catA.localeCompare(catB)
            })

        case 'alphabetical':
            return sorted.sort((a, b) => {
                const nameA = a.CONCEPT_NAME_CHAR || a.CONCEPT_CD || 'ZZZ'
                const nameB = b.CONCEPT_NAME_CHAR || b.CONCEPT_CD || 'ZZZ'
                if (nameA === nameB) {
                    // Secondary sort by date within same name
                    return new Date(b.START_DATE) - new Date(a.START_DATE)
                }
                return nameA.localeCompare(nameB)
            })

        case 'valtype':
            return sorted.sort((a, b) => {
                const typeA = a.VALTYPE_CD || 'T' // Default to Text type
                const typeB = b.VALTYPE_CD || 'T'
                if (typeA === typeB) {
                    // Secondary sort by date within same type
                    return new Date(b.START_DATE) - new Date(a.START_DATE)
                }
                return typeA.localeCompare(typeB)
            })

        default:
            return sorted.sort((a, b) => new Date(b.START_DATE) - new Date(a.START_DATE))
    }
}

const setSortMode = (mode) => {
    sortMode.value = mode
    // Save to local settings store
    localSettingsStore.setPatientObservationsSortMode(mode)
}

// Sort indicator helpers
const getSortIcon = (mode) => {
    switch (mode) {
        case 'date': return 'schedule'
        case 'category': return 'category'
        case 'alphabetical': return 'sort_by_alpha'
        case 'valtype': return 'data_usage'
        default: return 'schedule'
    }
}

















// Visit expansion methods
const toggleVisitExpansion = (encounterNum) => {
    const newExpanded = new Set(expandedVisits.value)
    if (newExpanded.has(encounterNum)) {
        newExpanded.delete(encounterNum)
    } else {
        newExpanded.add(encounterNum)
    }
    expandedVisits.value = newExpanded
}

const isVisitExpanded = (encounterNum) => {
    return expandedVisits.value.has(encounterNum)
}

const expandAllVisits = () => {
    // Only expand visits that have observations
    const encountersWithObservations = new Set(
        groupedObservations.value
            .filter(group => group.observations.length > 0)
            .map(group => group.encounterNum)
    )
    expandedVisits.value = encountersWithObservations
}

const collapseAllVisits = () => {
    expandedVisits.value = new Set()
}

// Smart toggle functionality
const hasExpandedVisits = computed(() => {
    return expandedVisits.value.size > 0
})

const toggleIcon = computed(() => {
    return hasExpandedVisits.value ? 'expand_less' : 'expand_more'
})

const toggleTooltip = computed(() => {
    return hasExpandedVisits.value ? 'Collapse all expanded visits' : 'Expand all visits with observations'
})

const toggleAllVisits = () => {
    if (hasExpandedVisits.value) {
        collapseAllVisits()
    } else {
        expandAllVisits()
    }
}





// Event handlers
const onObservationUpdated = () => {
    // Emit to parent to reload observations
    emit('updated')
}

const onObservationDeleted = () => {
    // Emit to parent to reload observations
    emit('updated')
}

const onVisitUpdated = () => {
    // Emit to parent to reload visits and observations
    emit('updated')
}

// Event handler for visit creation
const onVisitCreated = async (createdVisit) => {
    // Emit to parent to reload visits and observations
    emit('updated')

    // Wait a bit for the parent to reload data, then expand the new visit
    if (createdVisit && createdVisit.ENCOUNTER_NUM) {
        setTimeout(() => {
            const newExpanded = new Set(expandedVisits.value)
            newExpanded.add(createdVisit.ENCOUNTER_NUM)
            expandedVisits.value = newExpanded
        }, 200) // Small delay to ensure data is reloaded
    }
}

// Start with all visits collapsed by default
// (Removed auto-expansion - users can manually expand visits as needed)

// Watch for visits changes and resolve status codes
watch(() => props.visits, async (newVisits) => {
    if (newVisits && newVisits.length > 0) {
        // Get all unique status codes
        const uniqueStatusCodes = [...new Set(newVisits.map(visit => visit.ACTIVE_STATUS_CD).filter(Boolean))]

        // Resolve them in batch with context
        await conceptStore.resolveBatch(uniqueStatusCodes, {
            context: 'status',
            table: 'VISIT_DIMENSION',
            column: 'ACTIVE_STATUS_CD'
        })
    }
}, { immediate: true, deep: true })


</script>

<style lang="scss" scoped>
.edit-mode-item {
    transition: all 0.3s ease;

    &:hover {
        background-color: rgba(25, 118, 210, 0.04);
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



// Sort control styling
.sort-control {
    display: flex;
    align-items: center;
    gap: 4px;

    .sort-button {
        min-height: 36px;
        padding: 8px 12px;
    }

    .sort-indicator-icon {
        opacity: 0.6;
        color: #666;
    }
}

// Visit toggle button styling
.toggle-visits-btn {
    min-height: 36px;
    padding: 8px 12px;
}

// Create visit button styling
.create-visit-btn {
    min-height: 36px;
    padding: 8px 12px;

    &:hover {
        background-color: rgba(25, 118, 210, 0.08);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(25, 118, 210, 0.2);
    }
}



// Sort menu styling
.q-menu {
    .q-item {
        transition: all 0.2s ease;

        &:hover {
            background-color: rgba(25, 118, 210, 0.08);
        }

        &.bg-blue-1 {
            background-color: rgba(25, 118, 210, 0.12);

            .q-item-label {
                font-weight: 500;
            }
        }
    }

    .q-item-label[header] {
        color: #1976d2;
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
}
</style>
