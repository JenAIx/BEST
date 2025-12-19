<template>
  <q-card class="full-height">
    <q-card-section class="full-height">
      <div class="text-h6 q-mb-md">{{ $t('patient.statistics') }}</div>
      <div class="q-gutter-sm">
        <div class="row">
          <div class="col-6 text-grey-6">{{ $t('patient.totalVisits') }}:</div>
          <div class="col-6">{{ visits.length }}</div>
        </div>
        <div class="row">
          <div class="col-6 text-grey-6">{{ $t('patient.totalObservations') }}:</div>
          <div class="col-6">{{ observations.length }}</div>
        </div>
        <div class="row">
          <div class="col-6 text-grey-6">{{ $t('patient.created') }}:</div>
          <div class="col-6">{{ formatDate(patient.CREATED_AT) }}</div>
        </div>
        <div v-if="patient.UPDATED_AT !== patient.CREATED_AT" class="row">
          <div class="col-6 text-grey-6">{{ $t('patient.updated') }}:</div>
          <div class="col-6">{{ formatDate(patient.UPDATED_AT) }}</div>
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
</style>
