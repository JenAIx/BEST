<template>
  <!-- Another user changed data shown on this page while an edit is in
       progress. Auto-reload would throw the edit away, so we ask instead.
       (Without an edit in progress the page reloads silently.) -->
  <q-banner v-if="show" dense rounded class="stale-data-banner bg-warning text-dark q-mb-sm" data-cy="stale-data-banner">
    <template v-slot:avatar>
      <q-icon name="sync_problem" color="dark" />
    </template>
    {{ $t('freshness.remoteChange') }}
    <template v-slot:action>
      <q-btn flat dense no-caps color="dark" icon="refresh" :label="$t('common.refresh')" data-cy="stale-data-refresh" @click="$emit('refresh')" />
    </template>
  </q-banner>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
})
defineEmits(['refresh'])
</script>

<style scoped>
.stale-data-banner {
  font-size: 13px;
}
</style>
