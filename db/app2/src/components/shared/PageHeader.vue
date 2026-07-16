<template>
  <div class="page-header q-mb-md">
    <div class="row items-center justify-between">
      <div class="col page-header-text">
        <h1 class="text-h4 q-ma-none page-header-title">
          {{ title }}
          <q-tooltip anchor="bottom left" self="top left">{{ route.fullPath }}</q-tooltip>
        </h1>
        <span v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</span>
      </div>
      <div class="col-auto header-actions row items-center q-gutter-md">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

/**
 * Standard page header (Questionnaires design, inline variant): h1 title with
 * the subtitle smaller and dimmer on the same line (wraps below on narrow
 * screens), actions via default slot on the right. Hovering the title shows
 * the current route path as a debugging aid (replaces the old breadcrumb bar).
 */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})

const route = useRoute()
</script>

<style lang="scss" scoped>
.page-header {
  background: white;
  padding: 1.25rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-header-text {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 12px;
  min-width: 0;
}

.page-header-title {
  cursor: help;
}

.page-header-subtitle {
  font-size: 0.85rem;
  color: $grey-6;
  line-height: 1.3;
}

@media (max-width: 768px) {
  .page-header {
    padding: 1rem;
  }
}
</style>
