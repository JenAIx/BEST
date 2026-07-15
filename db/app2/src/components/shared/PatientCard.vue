<template>
  <q-card class="patient-card" :class="{ 'patient-card--selected': selected }" flat bordered @click="selectPatient">
    <!-- Owner badge (top right, ellipsis overflow, full text in tooltip) -->
    <div v-if="patient.owner || patient.isPublic" class="owner-badge">
      <q-icon :name="patient.isPublic ? 'public' : 'person'" size="10px" />
      <span v-if="patient.owner" class="owner-badge-text">{{ patient.owner }}</span>
      <q-tooltip>
        <template v-if="patient.owner">{{ $t('patient.owner') }}: {{ patient.owner }}</template>
        <template v-if="patient.owner && patient.isPublic"> · </template>
        <template v-if="patient.isPublic">{{ $t('patient.publicAccess') }}</template>
      </q-tooltip>
    </div>

    <q-card-section class="patient-card-content">
      <q-avatar size="34px" color="primary" text-color="white">
        <template v-if="hasRealName">{{ patientInitials }}</template>
        <q-icon v-else name="person" size="19px" />
      </q-avatar>
      <div class="patient-info">
        <div class="patient-name">{{ patient.name }}</div>
        <div class="patient-meta">
          <span class="meta-facts">{{ metaFacts }}</span>
          <span v-if="patient.lastVisit" class="meta-time">
            <q-icon name="schedule" size="11px" />
            {{ patient.lastVisit }}
          </span>
        </div>
      </div>
      <q-icon name="chevron_right" size="16px" class="chevron" />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const { t } = useI18n()

// Patients without a name in PATIENT_BLOB fall back to their PATIENT_CD as
// "name" — don't fake initials from digits and don't repeat the ID in the meta line.
const hasRealName = computed(() => !!props.patient.name && props.patient.name !== props.patient.id)

const patientInitials = computed(() => {
  return (props.patient.name || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const metaFacts = computed(() => {
  const parts = []
  if (hasRealName.value && props.patient.id) parts.push(props.patient.id)
  const age = props.patient.age
  if (age !== null && age !== undefined && age !== '' && !Number.isNaN(Number(age))) {
    parts.push(`${age} ${t('patient.yearsShort')}`)
  }
  if (props.patient.visitCount > 0) {
    parts.push(t('patient.visitCountShort', { n: props.patient.visitCount }, props.patient.visitCount))
  }
  if (props.patient.observationCount > 0) {
    parts.push(`${props.patient.observationCount} ${t('patient.obsShort')}`)
  }
  return parts.join(' · ')
})

const selectPatient = () => {
  emit('select', props.patient)
}
</script>

<style lang="scss" scoped>
.patient-card {
  position: relative;
  border: 1px solid $grey-3;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  animation: card-fade-in 0.3s ease-out;

  &:hover {
    border-color: $primary;
    box-shadow: 0 2px 10px rgba($primary, 0.12);

    .chevron {
      color: $primary;
    }
  }

  &--selected {
    border-color: $primary;
    background: rgba($primary, 0.05);

    .chevron {
      color: $primary;
    }
  }
}

.patient-card-content {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;

  .q-avatar {
    font-size: 0.7rem;
    font-weight: 600;
    flex: 0 0 auto;
  }
}

.patient-info {
  flex: 1;
  min-width: 0;

  .patient-name {
    font-weight: 600;
    font-size: 0.9rem;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .patient-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.72rem;
    color: $grey-6;
    line-height: 1.4;

    .meta-facts {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-time {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      color: $grey-5;
    }
  }
}

.chevron {
  color: $grey-5;
  flex: 0 0 auto;
  transition: color 0.2s ease;
}

.owner-badge {
  position: absolute;
  top: 4px;
  right: 6px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 45%;
  padding: 0 5px;
  border-radius: 7px;
  font-size: 0.6rem;
  line-height: 1.5;
  background: $grey-2;
  color: $grey-7;

  .owner-badge-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@keyframes card-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
