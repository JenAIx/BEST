<template>
  <q-btn
    :class="buttonClasses"
    :color="computedColor"
    :text-color="computedTextColor"
    :size="size"
    :loading="loading"
    :disable="disabled"
    :icon="icon"
    :icon-right="iconRight"
    :round="round"
    :rounded="rounded"
    :flat="flat"
    :outline="outline"
    :unelevated="unelevated"
    :dense="dense"
    :no-caps="noCaps"
    v-bind="$attrs"
  >
    <template v-if="$slots.default">
      <slot />
    </template>
    <template v-else-if="label">
      {{ label }}
    </template>

    <template v-if="$slots.loading" v-slot:loading>
      <slot name="loading" />
    </template>
  </q-btn>
</template>

<script setup>
/**
 * AppButton Component
 * 
 * A wrapper around Quasar's q-btn that implements the BEST design system.
 * Provides consistent styling and behavior across the application.
 * 
 * Props:
 * - variant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
 * - size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * - All standard q-btn props are supported
 */

import { computed } from 'vue'

const props = defineProps({
  // Custom variant prop for semantic styling
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'success', 'warning', 'danger'].includes(value)
  },
  
  // Override Quasar props with defaults
  label: String,
  icon: String,
  iconRight: String,
  size: {
    type: String,
    default: 'md'
  },
  loading: Boolean,
  disabled: Boolean,
  round: Boolean,
  rounded: Boolean,
  flat: Boolean,
  outline: Boolean,
  unelevated: {
    type: Boolean,
    default: true
  },
  dense: Boolean,
  noCaps: {
    type: Boolean,
    default: true
  },
  
  // Allow custom color override
  color: String,
  textColor: String
})

// Computed color based on variant
const computedColor = computed(() => {
  if (props.color) return props.color
  
  const variantColors = {
    primary: 'primary',
    secondary: 'grey-7',
    success: 'positive',
    warning: 'warning',
    danger: 'negative'
  }
  
  return variantColors[props.variant] || 'primary'
})

// Computed text color
const computedTextColor = computed(() => {
  if (props.textColor) return props.textColor
  if (props.flat || props.outline) return computedColor.value
  return 'white'
})

// Button classes
const buttonClasses = computed(() => {
  return [
    'app-button',
    `app-button--${props.variant}`,
    `app-button--${props.size}`,
    {
      'app-button--rounded': props.rounded,
      'app-button--loading': props.loading
    }
  ]
})
</script>

<style lang="scss" scoped>
.app-button {
  font-weight: 500;
  letter-spacing: 0.025em;
  transition: all 0.2s ease;
  
  // Size variations
  &--xs {
    font-size: 0.75rem;
    padding: 4px 12px;
  }
  
  &--sm {
    font-size: 0.875rem;
    padding: 6px 16px;
  }
  
  &--md {
    font-size: 1rem;
    padding: 8px 20px;
  }
  
  &--lg {
    font-size: 1.125rem;
    padding: 10px 24px;
  }
  
  &--xl {
    font-size: 1.25rem;
    padding: 12px 28px;
  }
  
  // Rounded style
  &--rounded {
    border-radius: 9999px;
  }
  
  // Hover effects
  &:not([disabled]):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:not([disabled]):active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
}

// Disable hover effects for flat and outline buttons
.app-button.q-btn--flat,
.app-button.q-btn--outline {
  &:not([disabled]):hover {
    transform: none;
    box-shadow: none;
  }
}
</style>
