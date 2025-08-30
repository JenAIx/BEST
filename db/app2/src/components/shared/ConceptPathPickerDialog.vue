<template>
  <q-dialog v-model="dialogVisible" persistent>
    <q-card style="min-width: 500px; max-width: 700px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Select Concept Path</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="searchPath"
          outlined
          dense
          label="Search paths"
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <q-tree
          :nodes="pathNodes"
          node-key="path"
          v-model:selected="selectedPath"
          selected-color="primary"
          default-expand-all
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="onCancel" />
        <q-btn 
          color="primary" 
          label="Select" 
          @click="onSelect"
          :disable="!selectedPath"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  currentPath: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const searchPath = ref('')
const selectedPath = ref(null)

// Sample path nodes - in real implementation, load from database
const pathNodes = ref([
  {
    label: 'LOINC',
    path: '\\LOINC',
    children: [
      {
        label: 'CHEM',
        path: '\\LOINC\\CHEM',
        children: [
          { label: 'Bld', path: '\\LOINC\\CHEM\\Bld' },
          { label: 'Urine', path: '\\LOINC\\CHEM\\Urine' }
        ]
      },
      {
        label: 'VITALS',
        path: '\\LOINC\\VITALS'
      }
    ]
  },
  {
    label: 'SNOMED-CT',
    path: '\\SNOMED-CT',
    children: [
      { label: 'Disorders', path: '\\SNOMED-CT\\Disorders' },
      { label: 'Procedures', path: '\\SNOMED-CT\\Procedures' }
    ]
  },
  {
    label: 'CUSTOM',
    path: '\\CUSTOM'
  }
])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const onSelect = () => {
  if (selectedPath.value) {
    emit('select', selectedPath.value)
    dialogVisible.value = false
  }
}

const onCancel = () => {
  dialogVisible.value = false
}

watch(() => props.currentPath, (newPath) => {
  selectedPath.value = newPath
}, { immediate: true })
</script>
