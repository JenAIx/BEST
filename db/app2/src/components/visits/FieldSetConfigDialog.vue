<template>
  <q-dialog v-model="dialogModel" persistent>
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="text-h6">Configure Observation Categories</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-list>
          <q-item v-for="fieldSet in availableFieldSets" :key="fieldSet.id">
            <q-item-section avatar>
              <q-icon :name="fieldSet.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ fieldSet.name }}</q-item-label>
              <q-item-label caption>{{ fieldSet.description }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="fieldSetConfig[fieldSet.id]" :true-value="true" :false-value="false" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="cancel" />
        <q-btn color="primary" label="Save" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  availableFieldSets: {
    type: Array,
    required: true,
  },
  activeFieldSets: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Local state
const fieldSetConfig = ref({})

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Initialize config when dialog opens
watch(
  () => props.modelValue,
  (show) => {
    if (show) {
      // Reset config to current active field sets
      fieldSetConfig.value = {}
      props.availableFieldSets.forEach((fs) => {
        fieldSetConfig.value[fs.id] = props.activeFieldSets.includes(fs.id)
      })
    }
  },
)

// Methods
const save = () => {
  const selectedFieldSets = Object.keys(fieldSetConfig.value).filter((key) => fieldSetConfig.value[key])

  emit('save', selectedFieldSets)
  dialogModel.value = false
}

const cancel = () => {
  emit('cancel')
  dialogModel.value = false
}
</script>

<style lang="scss" scoped>
// Styles are minimal since this is a simple dialog
</style>
