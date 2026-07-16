<template>
  <div class="page-header q-mb-lg">
    <div class="row items-center justify-between">
      <div>
        <h1 class="text-h4 q-ma-none page-header-title">
          {{ title }}
          <q-tooltip anchor="bottom left" self="top left">{{ route.fullPath }}</q-tooltip>
        </h1>
        <p v-if="subtitle" class="text-body1 text-grey-6 q-ma-none">{{ subtitle }}</p>
      </div>
      <div class="header-actions row items-center q-gutter-md">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

/**
 * Standard page header (Questionnaires design): h1 title + grey subtitle,
 * actions via default slot on the right. Hovering the title shows the
 * current route path as a debugging aid (replaces the old breadcrumb bar).
 */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})

const route = useRoute()
</script>

<style lang="scss" scoped>
.page-header-title {
  cursor: help;
  display: inline-block;
}
</style>
