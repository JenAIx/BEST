<template>
    <AppInputDialog v-model="dialogVisible" title="Create New User" ok-label="Create User" cancel-label="Cancel"
        :loading="isSaving" :disabled="!isFormValid" @ok="onSubmit" @cancel="onCancel">
        <q-form @submit.prevent="onSubmit" class="q-gutter-md">
            <!-- Username Field -->
            <q-input v-model="formData.username" label="Username" outlined dense :rules="[
                val => !!val || 'Username is required',
                val => val.length >= 3 || 'Username must be at least 3 characters',
                val => /^[a-zA-Z0-9_]+$/.test(val) || 'Username can only contain letters, numbers, and underscores'
            ]" @update:model-value="onFieldChange" hint="Login username (letters, numbers, underscores only)" />

            <!-- Display Name Field -->
            <q-input v-model="formData.name" label="Display Name" outlined dense :rules="[
                val => !!val || 'Display name is required'
            ]" @update:model-value="onFieldChange" hint="Full name displayed in the interface" />

            <!-- Password Field -->
            <q-input v-model="formData.password" label="Password" type="password" outlined dense :rules="[
                val => !!val || 'Password is required',
                val => val.length >= 5 || 'Password must be at least 5 characters'
            ]" @update:model-value="onFieldChange" />

            <!-- Confirm Password Field -->
            <q-input v-model="formData.confirmPassword" label="Confirm Password" type="password" outlined dense :rules="[
                val => !!val || 'Please confirm the password',
                val => val === formData.password || 'Passwords do not match'
            ]" @update:model-value="onFieldChange" />

            <!-- Role Field -->
            <q-select v-model="formData.role" label="Role" outlined dense :options="roleOptions" :rules="[
                val => !!val || 'Role is required'
            ]" @update:model-value="onFieldChange" />

            <!-- User Blob Field -->
            <q-input v-model="formData.userBlob" label="Description" outlined dense type="textarea" rows="3"
                hint="Optional description or notes about the user" @update:model-value="onFieldChange" />

            <!-- Requirements -->
            <div class="text-caption text-grey-6">
                <div>Requirements:</div>
                <div>• Username: 3+ characters, letters/numbers/underscores only</div>
                <div>• Password: 5+ characters</div>
                <div>• All fields except description are required</div>
            </div>
        </q-form>
    </AppInputDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppInputDialog from 'components/shared/AppInputDialog.vue'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Form state
const formData = ref({
    username: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: '',
    userBlob: ''
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
    set: (value) => {
        emit('update:modelValue', value)
        if (!value) {
            // Clear form when dialog is closed
            resetForm()
        }
    }
})

// Computed properties
const isFormValid = computed(() => {
    return formData.value.username.trim() !== '' &&
        formData.value.username.length >= 3 &&
        /^[a-zA-Z0-9_]+$/.test(formData.value.username) &&
        formData.value.name.trim() !== '' &&
        formData.value.password.length >= 5 &&
        formData.value.password === formData.value.confirmPassword &&
        formData.value.role !== ''
})

// Methods
const onFieldChange = () => {
    // This will trigger the computed properties
}

const resetForm = () => {
    formData.value = {
        username: '',
        name: '',
        password: '',
        confirmPassword: '',
        role: '',
        userBlob: ''
    }
}

const onCancel = () => {
    dialogVisible.value = false
    emit('cancel')
}

const onSubmit = async () => {
    if (!isFormValid.value) return

    isSaving.value = true
    try {
        const userData = {
            USER_CD: formData.value.username,
            NAME_CHAR: formData.value.name,
            PASSWORD_CHAR: formData.value.password,
            COLUMN_CD: formData.value.role,
            USER_BLOB: formData.value.userBlob || null
        }

        emit('save', userData)

        // Form will be cleared when dialog closes
        dialogVisible.value = false
    } catch {
        // Error handling is done in parent component
    } finally {
        isSaving.value = false
    }
}
</script>
