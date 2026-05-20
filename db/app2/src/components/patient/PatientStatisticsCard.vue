<template>
  <q-card class="full-height">
    <q-card-section class="full-height">
      <div class="text-h6 q-mb-md">{{ $t('patient.statistics') }}</div>
      <div class="info-list">
        <div class="info-row">
          <span class="info-label">{{ $t('patient.totalVisits') }}</span>
          <span class="info-value">{{ visits.length }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('patient.totalObservations') }}</span>
          <span class="info-value">{{ observations.length }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('patient.created') }}</span>
          <span class="info-value">{{ formatDate(patient.CREATED_AT) }}</span>
        </div>
        <div v-if="patient.UPDATED_AT !== patient.CREATED_AT" class="info-row">
          <span class="info-label">{{ $t('patient.updated') }}</span>
          <span class="info-value">{{ formatDate(patient.UPDATED_AT) }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  patient: {
    type: Object,
    required: true,
  },
  visits: {
    type: Array,
    default: () => [],
  },
  observations: {
    type: Array,
    default: () => [],
  },
})

const formatDate = (dateStr) => {
  if (!dateStr) return t('common.unknown')
  return new Date(dateStr).toLocaleDateString()
}
</script>

<style lang="scss" scoped>
.full-height {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.info-label {
  flex: 0 0 auto;
  color: $grey-7;
  white-space: nowrap;
}

.info-value {
  flex: 1 1 auto;
  text-align: right;
  word-break: break-word;
}
</style>
