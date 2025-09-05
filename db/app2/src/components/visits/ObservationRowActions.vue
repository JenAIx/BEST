<template>
  <div class="action-buttons">
    <!-- For medications -->
    <template v-if="row.isMedication">
      <!-- Remove Button for medications -->
      <div class="remove-button-container">
        <AppRemoveConfirmationButton :loading="row.saving" @remove-confirmed="$emit('remove-row', row)" @remove-cancelled="() => {}" />
      </div>
    </template>

    <!-- For regular observations -->
    <template v-else>
      <!-- Save Button - only show if changed -->
      <q-btn v-if="row.hasChanges" flat round icon="save" size="sm" color="primary" :loading="row.saving" @click="$emit('save-row', row)" class="save-btn">
        <q-tooltip>Save changes</q-tooltip>
      </q-btn>

      <!-- Cancel Button - only show if changed -->
      <q-btn v-if="row.hasChanges" flat round icon="close" size="sm" color="grey-6" :disabled="row.saving" @click="$emit('cancel-changes', row)" class="cancel-btn">
        <q-tooltip>Cancel changes</q-tooltip>
      </q-btn>

      <!-- Remove Button - show on hover -->
      <div v-if="!row.hasChanges" class="remove-button-container">
        <AppRemoveConfirmationButton :loading="row.saving" @remove-confirmed="$emit('remove-row', row)" @remove-cancelled="() => {}" />
      </div>

      <!-- Clone Button - show if previous value exists -->
      <q-btn v-if="row.previousValue" flat round icon="content_copy" size="sm" color="secondary" :disabled="row.saving" @click="$emit('clone-from-previous', row)" class="clone-btn">
        <q-tooltip>Clone from previous visit</q-tooltip>
      </q-btn>
    </template>
  </div>
</template>

<script setup>
import AppRemoveConfirmationButton from 'src/components/shared/AppRemoveConfirmationButton.vue'

defineProps({
  row: {
    type: Object,
    required: true,
  },
})

defineEmits(['save-row', 'cancel-changes', 'remove-row', 'clone-from-previous'])
</script>

<style lang="scss" scoped>
.action-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: center;

  .save-btn {
    background: rgba($primary, 0.1);
    border: 1px solid $primary;

    &:hover {
      background: $primary;
      color: white;
    }
  }

  .cancel-btn:hover {
    background: rgba($grey-6, 0.1);
  }

  .remove-button-container {
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .clone-btn {
    background: rgba($secondary, 0.1);
    border: 1px solid $secondary;

    &:hover {
      background: $secondary;
      color: white;
    }
  }
}
</style>
