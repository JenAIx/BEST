<template>
  <q-dialog v-model="dialogVisible" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">SNOMED-CT Search</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="localSearchQuery"
          outlined
          dense
          label="Search SNOMED concepts"
          class="q-mb-md"
          @keyup.enter="search"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-btn
              flat
              dense
              icon="search"
              @click="search"
              :loading="searching"
            />
          </template>
        </q-input>

        <div v-if="searching" class="text-center q-pa-md">
          <q-spinner color="primary" size="40px" />
          <div class="q-mt-sm">Searching SNOMED-CT...</div>
        </div>

        <q-list v-else-if="searchResults.length > 0" bordered separator>
          <q-item
            v-for="result in searchResults"
            :key="result.code"
            clickable
            @click="selectConcept(result)"
          >
            <q-item-section>
              <q-item-label>{{ result.display }}</q-item-label>
              <q-item-label caption>{{ result.code }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="arrow_forward" />
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else-if="searched && searchResults.length === 0" class="text-center q-pa-md text-grey-6">
          No results found
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="onCancel" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const $q = useQuasar()

const localSearchQuery = ref('')
const searching = ref(false)
const searched = ref(false)
const searchResults = ref([])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const search = async () => {
  if (!localSearchQuery.value || localSearchQuery.value.length < 3) {
    $q.notify({
      type: 'warning',
      message: 'Please enter at least 3 characters to search',
      position: 'top'
    })
    return
  }

  searching.value = true
  searched.value = true

  try {
    // TODO: Implement actual SNOMED-CT API search
    // For now, return mock data
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    searchResults.value = [
      {
        code: '73211009',
        display: 'Diabetes mellitus'
      },
      {
        code: '38341003',
        display: 'Hypertensive disorder'
      },
      {
        code: '233604007',
        display: 'Pneumonia'
      }
    ].filter(item => 
      item.display.toLowerCase().includes(localSearchQuery.value.toLowerCase()) ||
      item.code.includes(localSearchQuery.value)
    )
  } catch (error) {
    console.error('SNOMED search failed:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to search SNOMED-CT',
      position: 'top'
    })
  } finally {
    searching.value = false
  }
}

const selectConcept = (concept) => {
  emit('select', concept)
  dialogVisible.value = false
}

const onCancel = () => {
  dialogVisible.value = false
}

watch(() => props.searchQuery, (newQuery) => {
  localSearchQuery.value = newQuery
  if (newQuery) {
    search()
  }
}, { immediate: true })

watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    // Reset when dialog closes
    searchResults.value = []
    searched.value = false
  }
})
</script>
