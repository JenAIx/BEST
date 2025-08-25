<template>
    <q-avatar :color="patientColor" text-color="white" :size="size">
        <q-icon :name="genderIcon" :size="iconSize" />
    </q-avatar>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    patient: {
        type: Object,
        required: true
    },
    size: {
        type: String,
        default: '48px'
    }
})

// Computed icon size based on avatar size
const iconSize = computed(() => {
    const sizeNum = parseInt(props.size)
    if (sizeNum >= 64) return '32px'
    if (sizeNum >= 48) return '28px'
    if (sizeNum >= 40) return '24px'
    return '20px'
})

// Gender-specific color logic
const patientColor = computed(() => {
    const resolvedGender = props.patient.SEX_RESOLVED?.toLowerCase() ||
        props.patient.sexResolved?.toLowerCase()
    const sexCode = props.patient.SEX_CD?.toUpperCase() ||
        props.patient.sexCode?.toUpperCase()

    // Map by resolved gender name (more reliable)
    if (resolvedGender) {
        switch (resolvedGender) {
            case 'male':
                return 'blue-6'
            case 'female':
                return 'pink-6'
            case 'transsexual':
            case 'transgender':
                return 'purple-6'
            case 'intersex':
                return 'teal-6'
            default:
                return 'grey-6'
        }
    }

    // Fallback to code mapping
    switch (sexCode) {
        case 'M':
        case 'SCTID: 248153007': // Male
            return 'blue-6'
        case 'F':
        case 'SCTID: 248152002': // Female
            return 'pink-6'
        case 'O':
        case 'SCTID: 407374003': // Transsexual
            return 'purple-6'
        case 'SCTID: 32570691000036108': // Intersex
            return 'teal-6'
        default:
            return 'grey-6'
    }
})

// Gender-specific icon logic
const genderIcon = computed(() => {
    const resolvedGender = props.patient.SEX_RESOLVED?.toLowerCase() ||
        props.patient.sexResolved?.toLowerCase()
    const sexCode = props.patient.SEX_CD?.toUpperCase() ||
        props.patient.sexCode?.toUpperCase()

    // Map by resolved gender name (more reliable)
    if (resolvedGender) {
        switch (resolvedGender) {
            case 'male':
                return 'male'
            case 'female':
                return 'female'
            case 'transsexual':
            case 'transgender':
                return 'transgender'
            case 'intersex':
                return 'wc' // Neutral gender icon
            default:
                return 'person'
        }
    }

    // Fallback to code mapping
    switch (sexCode) {
        case 'M':
        case 'SCTID: 248153007': // Male
            return 'male'
        case 'F':
        case 'SCTID: 248152002': // Female
            return 'female'
        case 'O':
        case 'SCTID: 407374003': // Transsexual
            return 'transgender'
        case 'SCTID: 32570691000036108': // Intersex
            return 'wc'
        default:
            return 'person'
    }
})
</script>

<style lang="scss" scoped>
// Add any custom avatar styling here if needed
.q-avatar {
    transition: all 0.2s ease;
}
</style>
