<template>
  <q-dialog v-model="dialogVisible" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center">
        <div class="text-h6">Select Concept Path</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Current Path Display -->
        <div class="q-mb-md">
          <q-input v-model="selectedPath" label="Selected Path" outlined dense readonly hint="Click on path segments below to navigate" />
        </div>

        <!-- Path Navigation -->
        <div class="q-mb-md">
          <q-breadcrumbs separator="\" class="text-grey-8">
            <q-breadcrumbs-el
              v-for="(segment, index) in pathSegments"
              :key="index"
              :label="segment || 'Root'"
              :class="{ 'cursor-pointer text-primary': index < pathSegments.length - 1 }"
              @click="navigateToSegment(index)"
            />
          </q-breadcrumbs>
        </div>

        <!-- Search Field -->
        <q-input v-model="searchQuery" outlined dense placeholder="Search path segments..." debounce="300" @update:model-value="loadPathOptions" class="q-mb-md">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer" />
          </template>
        </q-input>

        <!-- Path Options -->
        <q-list class="bordered" style="max-height: 300px; overflow-y: auto">
          <q-item-label header v-if="!loading && pathOptions.length > 0"> Available Path Segments </q-item-label>

          <q-item v-for="option in pathOptions" :key="option.path" clickable v-ripple @click="selectPath(option.path)">
            <q-item-section avatar>
              <q-icon :name="getPathIcon(option.path)" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ getPathSegment(option.path) }}</q-item-label>
              <q-item-label caption>{{ option.path }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="option.count" :label="option.count" color="grey" />
            </q-item-section>
          </q-item>

          <q-item v-if="loading">
            <q-item-section>
              <q-skeleton type="text" />
            </q-item-section>
          </q-item>

          <q-item v-if="!loading && pathOptions.length === 0">
            <q-item-section>
              <q-item-label class="text-grey-6 text-center"> No path segments found </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Manual Path Entry -->
        <q-expansion-item icon="edit" label="Manual Path Entry" class="q-mt-md">
          <q-card>
            <q-card-section>
              <q-input
                v-model="manualPath"
                label="Enter Path Manually"
                outlined
                dense
                placeholder="\LOINC\CHEM\Bld\"
                hint="Path must start and end with backslash (\)"
                :rules="[(val) => !!val || 'Path is required', (val) => val.startsWith('\\') || 'Path must start with \\', (val) => val.endsWith('\\') || 'Path must end with \\']"
              />
              <div class="q-mt-sm">
                <q-btn flat label="Use Manual Path" color="primary" :disable="!isValidManualPath" @click="useManualPath" />
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey" v-close-popup />
        <q-btn flat label="Select Path" color="primary" :disable="!selectedPath" @click="confirmSelection" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

const dbStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('PathPickerDialog')

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  currentPath: {
    type: String,
    default: '\\',
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// State
const selectedPath = ref('')
const searchQuery = ref('')
const manualPath = ref('')
const pathOptions = ref([])
const loading = ref(false)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    if (!value) {
      // Reset state when dialog closes
      searchQuery.value = ''
      manualPath.value = ''
    }
  },
})

const pathSegments = computed(() => {
  if (!selectedPath.value) return ['']
  return selectedPath.value.split('\\').filter((segment) => segment !== '')
})

const isValidManualPath = computed(() => {
  return manualPath.value && manualPath.value.startsWith('\\') && manualPath.value.endsWith('\\')
})

// Methods
const loadPathOptions = async () => {
  loading.value = true
  try {
    const conceptRepo = dbStore.getRepository('concept')
    if (!conceptRepo) return

    let query = ''
    if (searchQuery.value) {
      // Search for paths containing the search term
      query = `
        SELECT DISTINCT CONCEPT_PATH, COUNT(*) as count
        FROM CONCEPT_DIMENSION 
        WHERE CONCEPT_PATH LIKE '%${searchQuery.value}%'
        GROUP BY CONCEPT_PATH
        ORDER BY CONCEPT_PATH
        LIMIT 50
      `
    } else {
      // Get child paths of current selected path
      const currentLevel = selectedPath.value || '\\'
      const depth = currentLevel.split('\\').length - 1

      query = `
        SELECT DISTINCT CONCEPT_PATH, COUNT(*) as count
        FROM CONCEPT_DIMENSION 
        WHERE CONCEPT_PATH LIKE '${currentLevel}%'
        AND LENGTH(CONCEPT_PATH) - LENGTH(REPLACE(CONCEPT_PATH, '\\', '')) = ${depth + 1}
        GROUP BY CONCEPT_PATH
        ORDER BY CONCEPT_PATH
        LIMIT 50
      `
    }

    const result = await conceptRepo.connection.executeQuery(query)
    if (result.success && result.data) {
      pathOptions.value = result.data.map((row) => ({
        path: row.CONCEPT_PATH,
        count: row.count,
      }))
    } else {
      pathOptions.value = []
    }
  } catch (error) {
    logger.error('Failed to load path options', error)
    pathOptions.value = []
  } finally {
    loading.value = false
  }
}

const selectPath = (path) => {
  selectedPath.value = path
}

const navigateToSegment = (index) => {
  if (index < pathSegments.value.length - 1) {
    const segments = pathSegments.value.slice(0, index + 1)
    selectedPath.value = '\\' + segments.join('\\') + '\\'
    loadPathOptions()
  }
}

const getPathSegment = (path) => {
  const segments = path.split('\\').filter((s) => s !== '')
  return segments[segments.length - 1] || 'Root'
}

const getPathIcon = (path) => {
  const pathLower = path.toLowerCase()
  if (pathLower.includes('loinc')) return 'science'
  if (pathLower.includes('icd')) return 'medical_services'
  if (pathLower.includes('snomed')) return 'healing'
  if (pathLower.includes('admin')) return 'admin_panel_settings'
  if (pathLower.includes('chem')) return 'biotech'
  if (pathLower.includes('demog')) return 'person'
  return 'folder'
}

const clearSearch = () => {
  searchQuery.value = ''
  loadPathOptions()
}

const useManualPath = () => {
  if (isValidManualPath.value) {
    selectedPath.value = manualPath.value
  }
}

const confirmSelection = () => {
  if (selectedPath.value) {
    emit('save', selectedPath.value)
    dialogVisible.value = false
  }
}

// Initialize
watch(
  () => props.currentPath,
  (newPath) => {
    selectedPath.value = newPath || '\\'
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (isVisible) => {
    if (isVisible) {
      loadPathOptions()
    }
  },
)

onMounted(() => {
  if (props.modelValue) {
    loadPathOptions()
  }
})
</script>

<style lang="scss" scoped>
.bordered {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.q-breadcrumbs-el {
  &.cursor-pointer:hover {
    text-decoration: underline;
  }
}
</style>
