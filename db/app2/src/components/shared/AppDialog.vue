<template>
  <q-dialog
    v-model="dialogModel"
    :persistent="persistent"
    :maximized="maximized"
    :full-width="fullWidth"
    :full-height="fullHeight"
    :position="position"
    :transition-show="transitionShow"
    :transition-hide="transitionHide"
  >
    <q-card :class="cardClasses" :style="cardStyle">
      <!-- Header -->
      <q-card-section v-if="title || $slots.header" class="app-dialog__header">
        <div class="row items-center">
          <div class="col">
            <slot name="header">
              <div class="text-h6">{{ title }}</div>
              <div v-if="subtitle" class="text-caption text-grey-6">{{ subtitle }}</div>
            </slot>
          </div>
          <div v-if="showClose" class="col-auto">
            <q-btn icon="close" flat round dense @click="onClose" />
          </div>
        </div>
      </q-card-section>

      <q-separator v-if="showHeaderSeparator && (title || $slots.header)" />

      <!-- Content -->
      <q-card-section class="app-dialog__content" :class="contentClasses">
        <slot>
          <div v-if="message" v-html="message"></div>
        </slot>
      </q-card-section>

      <q-separator v-if="showActionsSeparator && (showActions || $slots.actions)" />

      <!-- Actions -->
      <q-card-actions v-if="showActions || $slots.actions" :align="actionsAlign" class="app-dialog__actions">
        <slot name="actions">
          <q-btn v-if="showCancel" :label="cancelLabel" :color="cancelColor" flat @click="onCancel" />
          <q-btn v-if="showOk" :label="okLabel" :color="okColor" unelevated @click="onOk" />
        </slot>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
/**
 * AppDialog Component
 *
 * A flexible dialog component that follows the BEST design system.
 * Can be used for confirmations, forms, information display, etc.
 *
 * Props:
 * - modelValue: Boolean to control dialog visibility
 * - title: Dialog title
 * - subtitle: Optional subtitle
 * - message: HTML content for simple dialogs
 * - size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
 * - persistent: Prevent closing on backdrop click
 * - showClose: Show close button in header
 * - showActions: Show action buttons
 * - showCancel: Show cancel button
 * - showOk: Show OK button
 * - okLabel: Label for OK button
 * - cancelLabel: Label for cancel button
 * - okColor: Color for OK button
 * - cancelColor: Color for cancel button
 * - actionsAlign: Alignment for actions ('left', 'center', 'right', 'between', 'around', 'evenly')
 */

import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: String,
  subtitle: String,
  message: String,
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg', 'xl', 'full'].includes(value),
  },
  persistent: Boolean,
  maximized: Boolean,
  fullWidth: Boolean,
  fullHeight: Boolean,
  position: {
    type: String,
    default: 'standard',
    validator: (value) => ['standard', 'top', 'right', 'bottom', 'left'].includes(value),
  },
  showClose: {
    type: Boolean,
    default: true,
  },
  showActions: {
    type: Boolean,
    default: true,
  },
  showCancel: {
    type: Boolean,
    default: true,
  },
  showOk: {
    type: Boolean,
    default: true,
  },
  okLabel: {
    type: String,
    default: 'OK',
  },
  cancelLabel: {
    type: String,
    default: 'Cancel',
  },
  okColor: {
    type: String,
    default: 'primary',
  },
  cancelColor: {
    type: String,
    default: 'grey-7',
  },
  actionsAlign: {
    type: String,
    default: 'right',
  },
  showHeaderSeparator: {
    type: Boolean,
    default: true,
  },
  showActionsSeparator: {
    type: Boolean,
    default: true,
  },
  contentPadding: {
    type: Boolean,
    default: true,
  },
  transitionShow: {
    type: String,
    default: 'scale',
  },
  transitionHide: {
    type: String,
    default: 'scale',
  },
})

const emit = defineEmits(['update:modelValue', 'ok', 'cancel', 'close'])

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Card classes
const cardClasses = computed(() => {
  return [
    'app-dialog',
    `app-dialog--${props.size}`,
    {
      'app-dialog--full': props.size === 'full',
    },
  ]
})

// Card style
const cardStyle = computed(() => {
  if (props.size === 'full') return {}

  const sizes = {
    sm: { width: '400px', maxWidth: '90vw' },
    md: { width: '560px', maxWidth: '90vw' },
    lg: { width: '720px', maxWidth: '90vw' },
    xl: { width: '960px', maxWidth: '90vw' },
  }

  return sizes[props.size] || sizes.md
})

// Content classes
const contentClasses = computed(() => {
  return {
    'q-pa-none': !props.contentPadding,
  }
})

// Methods
const onOk = () => {
  emit('ok')
  dialogModel.value = false
}

const onCancel = () => {
  emit('cancel')
  dialogModel.value = false
}

const onClose = () => {
  emit('close')
  dialogModel.value = false
}
</script>

<style lang="scss" scoped>
.app-dialog {
  border-radius: 12px;
  overflow: hidden;

  &__header {
    background-color: $grey-1;
    padding: 20px 24px;
  }

  &__content {
    padding: 24px;
    max-height: 70vh;
    overflow-y: auto;

    // Custom scrollbar
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: $grey-2;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: $grey-5;
      border-radius: 4px;

      &:hover {
        background: $grey-6;
      }
    }
  }

  &__actions {
    padding: 16px 24px;
    background-color: $grey-1;
  }

  // Size variations
  &--full {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    margin: 0;
    border-radius: 0;

    .app-dialog__content {
      max-height: calc(100vh - 140px);
    }
  }
}

// Dark mode support
.body--dark {
  .app-dialog {
    &__header {
      background-color: $dark;
    }

    &__actions {
      background-color: $dark;
    }
  }
}
</style>
