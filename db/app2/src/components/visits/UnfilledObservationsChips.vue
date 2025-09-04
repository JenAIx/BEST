<template>
  <div v-if="unfilledConcepts.length > 0" class="unfilled-observations">
    <div class="unfilled-section-header">
      <q-icon name="add_circle_outline" size="16px" class="q-mr-xs" />
      <span class="section-title">Available Observations</span>
      <q-badge :label="unfilledConcepts.length" color="grey-5" class="q-ml-sm" />
    </div>
    <div class="unfilled-chips">
      <q-chip
        v-for="concept in unfilledConcepts"
        :key="`unfilled-${concept.code}`"
        clickable
        outline
        icon="add"
        :label="concept.name"
        color="grey-6"
        text-color="grey-7"
        class="unfilled-chip"
        @click="$emit('create-observation', concept)"
      >
        <q-tooltip>Click to add {{ concept.name }}</q-tooltip>
      </q-chip>
    </div>
  </div>
</template>

<script setup>
defineProps({
  unfilledConcepts: {
    type: Array,
    required: true,
  },
})

defineEmits(['create-observation'])
</script>

<style lang="scss" scoped>
.unfilled-observations {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed $grey-4;

  .unfilled-section-header {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
    color: $grey-6;

    .section-title {
      font-size: 0.875rem;
      font-weight: 500;
    }
  }

  .unfilled-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;

    .unfilled-chip {
      transition: all 0.2s ease;
      cursor: pointer;
      font-size: 0.75rem;

      &:hover {
        background-color: rgba($primary, 0.08);
        border-color: $primary;
        color: $primary;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba($primary, 0.15);
      }
    }
  }
}
</style>
