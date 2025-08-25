<template>
    <q-dialog v-model="dialogVisible" persistent>
        <q-card style="min-width: 400px; max-width: 600px">
            <q-card-section class="row items-center">
                <div class="text-h6">{{ title }}</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section>
                <!-- Search Field -->
                <q-input v-model="searchQuery" outlined dense placeholder="Search options..." debounce="300"
                    @update:model-value="filterOptions">
                    <template v-slot:prepend>
                        <q-icon name="search" />
                    </template>
                    <template v-slot:append>
                        <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer" />
                    </template>
                </q-input>

                <!-- Options List -->
                <q-list class="q-mt-md" style="max-height: 400px; overflow-y: auto">
                    <q-item v-for="option in filteredOptions" :key="option.value || option.label" clickable v-ripple
                        @click="selectOption(option)" :class="{ 'bg-blue-1': selectedOption?.value === option.value }">
                        <q-item-section>
                            <q-item-label>{{ option.label }}</q-item-label>
                            <q-item-label v-if="option.description" caption>
                                {{ option.description }}
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-icon v-if="selectedOption?.value === option.value" name="check" color="primary" />
                        </q-item-section>
                    </q-item>
                </q-list>

                <div v-if="filteredOptions.length === 0" class="text-center text-grey-6 q-pa-md">
                    No options found
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat label="Cancel" color="grey" v-close-popup />
                <q-btn flat label="Select" color="primary" :disable="!selectedOption" @click="confirmSelection" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: 'Select Option'
    },
    options: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// State
const searchQuery = ref('')
const selectedOption = ref(null)

const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => {
        emit('update:modelValue', value)
        if (!value) {
            // Reset state when dialog closes
            searchQuery.value = ''
            selectedOption.value = null
        }
    }
})

const filteredOptions = computed(() => {
    if (!searchQuery.value) {
        return props.options
    }

    const query = searchQuery.value.toLowerCase()
    return props.options.filter(option =>
        option.label.toLowerCase().includes(query) ||
        (option.description && option.description.toLowerCase().includes(query)) ||
        (option.value && option.value.toString().toLowerCase().includes(query))
    )
})

// Methods
const selectOption = (option) => {
    selectedOption.value = option
}

const confirmSelection = () => {
    if (selectedOption.value) {
        emit('save', selectedOption.value)
        dialogVisible.value = false
    }
}

const clearSearch = () => {
    searchQuery.value = ''
}

const filterOptions = () => {
    // This method is called when search query changes
    // The actual filtering is done in the computed property
}

// Watch for options changes and reset selection
watch(() => props.options, () => {
    selectedOption.value = null
})
</script>

<style lang="scss" scoped>
.q-item {
    border-radius: 4px;
    margin-bottom: 2px;
}

.q-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
}
</style>
