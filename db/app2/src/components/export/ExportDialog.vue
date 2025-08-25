<template>
    <AppDialog v-model="dialogModel" title="Export Patient Data" subtitle="Choose export format and options" size="md"
        :persistent="false" :show-actions="false" :show-close="true" @close="onCancel">
        <div class="export-dialog">
            <!-- Patient Selection Summary -->
            <div class="export-summary q-mb-lg">
                <q-icon name="people" size="24px" color="primary" class="q-mr-sm" />
                <span class="text-h6">{{ selectedCount }} patients selected</span>
            </div>

            <!-- Format Selection -->
            <div class="format-selection q-mb-lg">
                <div class="text-subtitle1 q-mb-md">Export Format</div>

                <q-option-group v-model="selectedFormat" :options="formatOptions" color="primary" type="radio"
                    class="format-options" />
            </div>

            <!-- Export Options -->
            <div class="export-options q-mb-lg">
                <div class="text-subtitle1 q-mb-md">Include Data</div>

                <div class="row q-col-gutter-md">
                    <div class="col-6">
                        <q-checkbox v-model="includeVisits" label="Visits" color="primary"
                            :disable="!canToggleVisits" />
                    </div>
                    <div class="col-6">
                        <q-checkbox v-model="includeObservations" label="Observations" color="primary"
                            :disable="!canToggleObservations" />
                    </div>
                </div>

                <div class="text-caption text-grey-6 q-mt-sm">
                    <q-icon name="info" size="14px" class="q-mr-xs" />
                    Patient demographics are always included
                </div>
            </div>

            <!-- Format Description -->
            <div class="format-description q-mb-lg">
                <q-card flat bordered class="bg-grey-1">
                    <q-card-section class="q-pa-md">
                        <div class="text-subtitle2 q-mb-xs">{{ formatDescription.title }}</div>
                        <div class="text-body2 text-grey-7">{{ formatDescription.description }}</div>
                        <div v-if="formatDescription.features" class="q-mt-sm">
                            <div class="text-caption text-grey-6">Features:</div>
                            <ul class="text-caption text-grey-6 q-ma-none q-pl-md">
                                <li v-for="feature in formatDescription.features" :key="feature">{{ feature }}</li>
                            </ul>
                        </div>
                    </q-card-section>
                </q-card>
            </div>

            <!-- Action Buttons -->
            <div class="row q-col-gutter-sm">
                <div class="col">
                    <q-btn flat color="grey-7" label="Cancel" class="full-width" @click="onCancel" />
                </div>
                <div class="col">
                    <q-btn color="primary" label="Export" icon="download" class="full-width" :loading="isExporting"
                        @click="onExport" />
                </div>
            </div>
        </div>
    </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppDialog from 'src/components/shared/AppDialog.vue'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    selectedPatients: {
        type: Array,
        default: () => []
    },
    isExporting: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'export', 'cancel'])

// Dialog model
const dialogModel = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Export configuration
const selectedFormat = ref('csv')
const includeVisits = ref(true)
const includeObservations = ref(true)

// Format options
const formatOptions = [
    {
        label: 'CSV (Comma-Separated Values)',
        value: 'csv',
        icon: 'table_chart',
        description: 'Spreadsheet-compatible format with concept headers'
    },
    {
        label: 'JSON (JavaScript Object Notation)',
        value: 'json',
        icon: 'code',
        description: 'Structured data format with complete metadata'
    },
    {
        label: 'HL7 FHIR (Clinical Document)',
        value: 'hl7',
        icon: 'medical_services',
        description: 'Healthcare interoperability standard'
    }
]

// Computed properties
const selectedCount = computed(() => props.selectedPatients.length)

const canToggleVisits = computed(() => true)
const canToggleObservations = computed(() => true)

const formatDescription = computed(() => {
    const descriptions = {
        csv: {
            title: 'CSV Export',
            description: 'Creates a spreadsheet-compatible file with two header rows: human-readable descriptions and concept codes.',
            features: [
                'Compatible with Excel, Google Sheets',
                'Two-row header system',
                'Concept code mapping',
                'Flat data structure'
            ]
        },
        json: {
            title: 'JSON Export',
            description: 'Exports data as structured JSON with complete metadata and hierarchical organization.',
            features: [
                'Hierarchical data structure',
                'Complete metadata included',
                'Programming-friendly format',
                'Preserves all relationships'
            ]
        },
        hl7: {
            title: 'HL7 FHIR Export',
            description: 'Creates a Clinical Document Architecture (CDA) compliant document for healthcare interoperability.',
            features: [
                'Healthcare standard compliance',
                'Clinical document format',
                'Interoperability focused',
                'Digital signature support'
            ]
        }
    }

    return descriptions[selectedFormat.value] || descriptions.csv
})

// Methods
const onExport = () => {
    const exportOptions = {
        format: selectedFormat.value,
        includeVisits: includeVisits.value,
        includeObservations: includeObservations.value
    }

    emit('export', exportOptions)
}

const onCancel = () => {
    emit('cancel')
    dialogModel.value = false
}

// Reset form when dialog opens
watch(() => props.modelValue, (newValue) => {
    if (newValue) {
        // Reset to defaults when dialog opens
        selectedFormat.value = 'csv'
        includeVisits.value = true
        includeObservations.value = true
    }
})
</script>

<style lang="scss" scoped>
.export-dialog {
    .export-summary {
        display: flex;
        align-items: center;
        padding: 16px;
        background-color: $blue-1;
        border-radius: 8px;
        border-left: 4px solid $primary;
    }

    .format-options {
        :deep(.q-radio) {
            margin-bottom: 12px;

            .q-radio__label {
                font-weight: 500;
            }
        }
    }

    .format-description {
        .q-card {
            border: 1px solid $grey-4;
        }
    }
}

// Dark mode support
.body--dark {
    .export-dialog {
        .export-summary {
            background-color: rgba($primary, 0.1);
        }

        .format-description .q-card {
            background-color: $dark;
            border-color: $grey-8;
        }
    }
}
</style>
