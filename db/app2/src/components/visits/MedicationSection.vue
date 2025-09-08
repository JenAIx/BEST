<template>
  <div v-if="showMedicationSection" class="add-medication">
    <q-btn flat icon="add" label="Add Medication" @click="$emit('add-empty-medication')" class="full-width" style="border: 2px dashed #ccc" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  fieldSetId: {
    type: String,
    required: true,
  },
})

defineEmits(['add-empty-medication'])

const showMedicationSection = computed(() => {
  return props.fieldSetId === 'medications'
})
</script>

<style lang="scss" scoped>
.add-medication {
  margin-top: 1rem;

  .q-btn {
    color: $grey-6;
    transition: all 0.3s ease;

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
}
</style>
