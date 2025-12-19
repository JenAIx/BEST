<template>
  <div class="patient-header q-mb-md">
    <div class="row items-center q-gutter-sm">
      <q-avatar size="32px" color="primary" text-color="white">
        {{ patientInitials }}
      </q-avatar>
      <div class="patient-info">
        <div class="patient-name">{{ patientName }}</div>
        <div class="patient-details text-caption text-grey-6">
          <div class="patient-basic">{{ patientBasicDetails }}</div>
          <div v-if="patientBirthdate || patientGender" class="patient-extended">
            <span v-if="patientBirthdate">{{ $t('patient.born') }}: {{ patientBirthdate }}</span>
            <span v-if="patientBirthdate && patientGender" class="q-mx-xs">•</span>
            <span v-if="patientGender">{{ patientGender }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePatientStore } from 'src/stores/patient-store'

const props = defineProps({
  patient: {
    type: Object,
    default: null,
  },
})

const patientStore = usePatientStore()

const patient = computed(() => props.patient || patientStore.selectedPatient)

const patientName = computed(() => {
  if (!patient.value) return 'Unknown Patient'

  if (patient.value.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.value.PATIENT_BLOB)
      if (blob.name) return blob.name
      if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
    } catch {
      // Fallback to PATIENT_CD
    }
  }
  return patient.value.PATIENT_CD || 'Unknown Patient'
})

const patientInitials = computed(() => {
  const name = patientName.value
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const patientBasicDetails = computed(() => {
  if (!patient.value) return ''

  const details = []

  // Patient ID
  if (patient.value.PATIENT_CD) {
    details.push(`ID: ${patient.value.PATIENT_CD}`)
  }

  // Age
  if (patient.value.AGE_IN_YEARS) {
    details.push(`${patient.value.AGE_IN_YEARS} years`)
  } else if (patient.value.BIRTH_DATE) {
    const birthYear = new Date(patient.value.BIRTH_DATE).getFullYear()
    const currentYear = new Date().getFullYear()
    details.push(`${currentYear - birthYear} years`)
  }

  return details.join(' • ')
})

const patientBirthdate = computed(() => {
  if (!patient.value) return ''

  if (patient.value.BIRTH_DATE) {
    return new Date(patient.value.BIRTH_DATE).toLocaleDateString()
  }

  // Check PATIENT_BLOB for birthdate
  if (patient.value.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.value.PATIENT_BLOB)
      if (blob.birthDate) {
        return new Date(blob.birthDate).toLocaleDateString()
      }
      if (blob.dateOfBirth) {
        return new Date(blob.dateOfBirth).toLocaleDateString()
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return ''
})

const patientGender = computed(() => {
  if (!patient.value) return ''

  if (patient.value.SEX_RESOLVED) {
    return patient.value.SEX_RESOLVED
  }

  if (patient.value.SEX_CD) {
    // Map common codes to readable text
    const genderMap = {
      M: 'Male',
      F: 'Female',
      U: 'Unknown',
      O: 'Other',
    }
    return genderMap[patient.value.SEX_CD] || patient.value.SEX_CD
  }

  // Check PATIENT_BLOB for gender
  if (patient.value.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.value.PATIENT_BLOB)
      if (blob.gender) {
        return blob.gender
      }
      if (blob.sex) {
        return blob.sex
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return ''
})
</script>

<style lang="scss" scoped>
.patient-header {
  background: $grey-1;
  border-radius: 8px;
  padding: 12px 16px;
  border-left: 4px solid $secondary;

  .patient-info {
    .patient-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: $grey-9;
      line-height: 1.2;
    }

    .patient-details {
      font-size: 0.8rem;
      line-height: 1.3;
    }
  }
}
</style>

