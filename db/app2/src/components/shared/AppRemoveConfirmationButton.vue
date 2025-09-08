<template>
  <div class="remove-confirmation-container">
    <!-- Single Remove Button -->
    <q-btn v-if="!showRemoveConfirmation" flat round icon="clear" size="xs" color="grey-6" :disabled="disabled" @click="showConfirmation">
      <q-tooltip>Remove</q-tooltip>
    </q-btn>

    <!-- Remove Confirmation Buttons -->
    <div v-else class="remove-confirmation-buttons">
      <q-btn flat round icon="clear" size="xs" color="grey-6" @click="cancelRemove" class="cancel-remove-btn" :disabled="loading">
        <q-tooltip>Cancel</q-tooltip>
      </q-btn>
      <q-btn flat round icon="check" size="xs" color="negative" @click="confirmRemove" class="confirm-remove-btn" :loading="loading" :disabled="loading">
        <q-tooltip>Confirm Remove</q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  autoHideTimeout: {
    type: Number,
    default: 5000, // Auto-hide confirmation after 5 seconds
  },
})

const emit = defineEmits(['remove-confirmed', 'remove-cancelled'])

// Internal state
const showRemoveConfirmation = ref(false)
const removeConfirmationTimeout = ref(null)

// Methods
const showConfirmation = () => {
  showRemoveConfirmation.value = true

  // Auto-hide confirmation after timeout
  if (props.autoHideTimeout > 0) {
    removeConfirmationTimeout.value = setTimeout(() => {
      cancelRemove()
    }, props.autoHideTimeout)
  }
}

const confirmRemove = () => {
  clearConfirmationTimeout()
  showRemoveConfirmation.value = false
  emit('remove-confirmed')
}

const cancelRemove = () => {
  clearConfirmationTimeout()
  showRemoveConfirmation.value = false
  emit('remove-cancelled')
}

const clearConfirmationTimeout = () => {
  if (removeConfirmationTimeout.value) {
    clearTimeout(removeConfirmationTimeout.value)
    removeConfirmationTimeout.value = null
  }
}

// Cleanup on unmount
onUnmounted(() => {
  clearConfirmationTimeout()
})

// Expose methods for parent component if needed
defineExpose({
  showConfirmation,
  cancelRemove,
  isShowingConfirmation: () => showRemoveConfirmation.value,
})
</script>

<style lang="scss" scoped>
.remove-confirmation-container {
  display: flex;
  align-items: center;
}

.remove-confirmation-buttons {
  display: flex;
  gap: 0.125rem;
  padding: 1px;
  background: rgba($negative, 0.08);
  border-radius: 12px;
  border: 1px solid rgba($negative, 0.15);
  animation: slideIn 0.2s ease;

  .confirm-remove-btn {
    transition: all 0.15s ease;

    &:hover {
      background: $negative;
      color: white;
      transform: scale(1.05);
    }
  }

  .cancel-remove-btn {
    transition: all 0.15s ease;

    &:hover {
      background: rgba($grey-6, 0.1);
      transform: scale(1.05);
    }
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(6px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}
</style>
