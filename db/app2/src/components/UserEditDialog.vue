<template>
    <AppInputDialog v-model="dialogVisible" title="Edit User" ok-label="Save Changes" cancel-label="Cancel"
        :loading="isSaving" :disabled="!isFormValid" @ok="onSubmit" @cancel="onCancel">
        <q-form @submit.prevent="onSubmit" class="q-gutter-md">
            <!-- Display Name Field -->
            <q-input v-model="formData.name" label="Display Name" outlined dense :rules="[
                val => !!val || 'Display name is required'
            ]" @update:model-value="onFieldChange" />

            <!-- Username Field (readonly) -->
            <q-input v-model="formData.username" label="Username" outlined dense readonly
                hint="Username cannot be changed" />

            <!-- Role Field -->
            <q-select v-model="formData.role" label="Role" outlined dense :options="roleOptions" :rules="[
                val => !!val || 'Role is required'
            ]" @update:model-value="onFieldChange" />

            <!-- User Blob Field -->
            <q-input v-model="formData.userBlob" label="Description" outlined dense type="textarea" rows="3"
                hint="Optional description or notes about the user" @update:model-value="onFieldChange" />
        </q-form>
    </AppInputDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppInputDialog from 'components/shared/AppInputDialog.vue'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    user: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Form state
const formData = ref({
    name: '',
    username: '',
    role: '',
    userBlob: '',
    originalName: '',
    originalRole: '',
    originalUserBlob: ''
})

const isSaving = ref(false)

const roleOptions = [
    { label: 'Administrator', value: 'admin' },
    { label: 'Physician', value: 'physician' },
    { label: 'Nurse', value: 'nurse' },
    { label: 'Research', value: 'research' }
]

const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Computed properties
const isFormValid = computed(() => {
    return formData.value.name.trim() !== '' &&
        formData.value.role !== ''
})

const hasChanges = computed(() => {
    return formData.value.name !== formData.value.originalName ||
        formData.value.role !== formData.value.originalRole ||
        formData.value.userBlob !== formData.value.originalUserBlob
})

// Methods
const onFieldChange = () => {
    // This will trigger the computed properties
}

const onCancel = () => {
    dialogVisible.value = false
    emit('cancel')
}

const onSubmit = async () => {
    if (!isFormValid.value || !hasChanges.value) return

    isSaving.value = true
    try {
        const updateData = {}

        if (formData.value.name !== formData.value.originalName) {
            updateData.NAME_CHAR = formData.value.name
        }

        if (formData.value.role !== formData.value.originalRole) {
            updateData.COLUMN_CD = formData.value.role
        }

        if (formData.value.userBlob !== formData.value.originalUserBlob) {
            updateData.USER_BLOB = formData.value.userBlob
        }

        emit('save', updateData)

        // Update original values after successful save
        formData.value.originalName = formData.value.name
        formData.value.originalRole = formData.value.role
        formData.value.originalUserBlob = formData.value.userBlob

        dialogVisible.value = false
    } catch {
        // Error handling is done in parent component
    } finally {
        isSaving.value = false
    }
}

// Watch for user prop changes and initialize form
watch(() => props.user, (newUser) => {
    if (newUser && Object.keys(newUser).length > 0) {
        formData.value.name = newUser.NAME_CHAR || ''
        formData.value.username = newUser.USER_CD || ''
        formData.value.role = newUser.COLUMN_CD || ''
        formData.value.userBlob = newUser.USER_BLOB || ''

        // Store original values
        formData.value.originalName = newUser.NAME_CHAR || ''
        formData.value.originalRole = newUser.COLUMN_CD || ''
        formData.value.originalUserBlob = newUser.USER_BLOB || ''
    }
}, { immediate: true })
</script>
