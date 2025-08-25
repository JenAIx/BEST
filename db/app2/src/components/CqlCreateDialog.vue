<template>
    <q-dialog v-model="localShow" persistent>
        <q-card style="min-width: 500px; max-width: 600px">
            <q-card-section class="row items-center q-pb-none">
                <div class="text-h6">Create CQL Rule</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section class="q-pa-md">
                <q-form @submit="onSave" class="q-gutter-md">
                    <q-input v-model="formData.CODE_CD" outlined dense label="Code *"
                        :rules="[val => !!val || 'Code is required']" hint="Unique identifier for the CQL rule" />

                    <q-input v-model="formData.NAME_CHAR" outlined dense label="Name *"
                        :rules="[val => !!val || 'Name is required']" hint="Descriptive name for the CQL rule" />

                    <q-input v-model="formData.CQL_BLOB" outlined dense label="Description"
                        hint="Optional description of what this rule does" />

                    <div class="q-mt-lg">
                        <div class="text-caption text-grey-6 q-mb-sm">
                            Initial CQL Template
                        </div>
                        <q-input v-model="cqlTemplate" type="textarea" outlined rows="8" readonly
                            class="cql-template" />
                        <div class="text-caption text-grey-6 q-mt-xs">
                            This template will be created as the starting point for your CQL rule.
                        </div>
                    </div>
                </q-form>
            </q-card-section>

            <q-card-actions align="right" class="q-pa-md">
                <q-btn flat label="Cancel" @click="onCancel" />
                <q-btn color="primary" label="Create Rule" :loading="saving" :disable="!isFormValid" @click="onSave" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { stringify_char } from 'src/utils/sql-tools.js'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// State
const localShow = ref(false)
const saving = ref(false)
const formData = ref({
    CODE_CD: '',
    NAME_CHAR: '',
    CQL_BLOB: ''
})

// Computed
const isFormValid = computed(() => {
    return formData.value.CODE_CD && formData.value.NAME_CHAR
})

const cqlTemplate = computed(() => {
    const code = formData.value.CODE_CD || 'MyRule'
    return `library ${code} version '1'

parameter VALUE default 10

context Unfiltered

define AGE: VALUE > 0 and VALUE < 200`
})

// Watchers
watch(() => props.modelValue, (newVal) => {
    localShow.value = newVal
    if (newVal) {
        resetForm()
    }
})

watch(localShow, (newVal) => {
    if (!newVal) {
        emit('update:modelValue', false)
    }
})

// Methods
const resetForm = () => {
    formData.value = {
        CODE_CD: '',
        NAME_CHAR: '',
        CQL_BLOB: ''
    }
    saving.value = false
}

const onSave = async () => {
    if (!isFormValid.value) return

    saving.value = true
    try {
        const saveData = {
            ...formData.value,
            CQL_CHAR: stringify_char(cqlTemplate.value),
            JSON_CHAR: null, // Will be compiled later
            UPDATE_DATE: new Date().toISOString(),
            IMPORT_DATE: new Date().toISOString(),
            UPLOAD_ID: 1
        }

        emit('save', saveData)
    } finally {
        saving.value = false
    }
}

const onCancel = () => {
    localShow.value = false
    emit('cancel')
}
</script>

<style lang="scss" scoped>
.cql-template :deep(.q-field__control textarea) {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.4;
    background-color: #f9f9f9;
}
</style>
