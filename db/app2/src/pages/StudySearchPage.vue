<template>
  <q-page class="q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div class="text-h4">Research Study Search</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">
          {{ hasSearched ? `${studyStore.totalStudies} studies found` : `${studyStore.researchStats.totalStudies} total studies` }}
        </div>
        <q-btn color="primary" icon="add" label="New Study" @click="onCreateStudy" />
      </div>
    </div>

    <!-- Intelligent Study Search -->
    <div class="row justify-center q-mb-lg">
      <div class="col-12 col-md-10 col-lg-8">
        <q-card flat bordered class="search-card">
          <q-card-section class="q-pa-lg">
            <div class="text-center q-mb-md">
              <q-icon name="biotech" size="32px" color="primary" />
              <div class="text-h6 q-mt-sm">Research Study Search</div>
              <div class="text-caption text-grey-6">Search studies by name, category, or clinical concepts</div>
            </div>

            <q-input
              v-model="searchQuery"
              outlined
              dense
              placeholder="Try: 'Stroke', 'Fugl-Meyer', 'Neurological Assessment', 'Box and Block'..."
              class="smart-search"
              @update:model-value="onSearchChange"
              debounce="300"
            >
              <template v-slot:prepend>
                <q-icon name="search" color="primary" />
              </template>
              <template v-slot:append>
                <q-btn v-if="searchQuery" flat round dense icon="close" @click="clearSearch" />
                <q-btn flat round dense icon="tune" @click="showAdvancedSearch = !showAdvancedSearch">
                  <q-tooltip>Advanced Filters</q-tooltip>
                </q-btn>
              </template>
            </q-input>

            <!-- Search Suggestions -->
            <div v-if="searchSuggestions.length > 0" class="q-mt-sm">
              <div class="text-caption text-grey-6 q-mb-xs">Detected:</div>
              <div class="row q-gutter-xs">
                <q-chip v-for="suggestion in searchSuggestions" :key="suggestion.type" :color="suggestion.color" text-color="white" size="sm" :icon="suggestion.icon">
                  {{ suggestion.label }}
                </q-chip>
              </div>
            </div>
          </q-card-section>

          <!-- Advanced Search -->
          <q-slide-transition>
            <q-card-section v-show="showAdvancedSearch" class="bg-grey-1">
              <div class="text-subtitle2 q-mb-md">Advanced Research Filters</div>
              <div class="row q-gutter-md justify-center">
                <div class="col-12 col-md-4">
                  <q-select v-model="filters.researchCategory" :options="researchCategories" label="Research Category" outlined dense clearable emit-value map-options />
                </div>
                <div class="col-12 col-md-4">
                  <q-select
                    v-model="filters.clinicalScale"
                    :options="clinicalScales"
                    label="Clinical Scale"
                    outlined
                    dense
                    clearable
                    emit-value
                    map-options
                    use-input
                    input-debounce="300"
                    @filter="filterClinicalScales"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-select v-model="filters.studyStatus" :options="studyStatusOptions" label="Study Status" outlined dense clearable emit-value map-options />
                </div>
              </div>
              <div class="row justify-end q-mt-md">
                <q-btn flat label="Reset" @click="resetFilters" class="q-mr-sm" />
                <q-btn color="primary" label="Apply Filters" @click="applyFilters" />
              </div>
            </q-card-section>
          </q-slide-transition>
        </q-card>
      </div>
    </div>

    <!-- Quick Research Stats -->
    <div v-if="!searchQuery && !hasActiveFilters" class="q-mb-lg">
      <div class="row q-col-gutter-md justify-center">
        <div class="col-12 col-sm-6 col-md-3">
          <q-card flat bordered class="stat-card cursor-pointer" @click="showAllStudies">
            <q-card-section class="text-center">
              <q-icon name="biotech" size="32px" color="primary" class="q-mb-sm" />
              <div class="text-h5 text-primary">{{ studyStore.researchStats.totalStudies }}</div>
              <div class="text-caption text-grey-6">Total Studies</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-card flat bordered class="stat-card">
            <q-card-section class="text-center">
              <q-icon name="psychology" size="32px" color="secondary" class="q-mb-sm" />
              <div class="text-h5 text-secondary">{{ studyStore.researchStats.neurologicalStudies }}</div>
              <div class="text-caption text-grey-6">Neurological</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-card flat bordered class="stat-card">
            <q-card-section class="text-center">
              <q-icon name="healing" size="32px" color="positive" class="q-mb-sm" />
              <div class="text-h5 text-positive">{{ studyStore.researchStats.strokeStudies }}</div>
              <div class="text-caption text-grey-6">Stroke Research</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-card flat bordered class="stat-card">
            <q-card-section class="text-center">
              <q-icon name="timeline" size="32px" color="info" class="q-mb-sm" />
              <div class="text-h5 text-info">{{ studyStore.researchStats.activeStudies }}</div>
              <div class="text-caption text-grey-6">Active Studies</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Research Categories Overview -->
    <div v-if="!searchQuery && !hasActiveFilters" class="q-mb-lg">
      <div class="text-h6 q-mb-md">Research Categories</div>
      <div class="row q-gutter-md justify-center">
        <div v-for="category in researchCategories" :key="category.value" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card flat bordered class="category-card cursor-pointer" @click="searchByCategory(category)">
            <q-card-section class="q-pa-md text-center">
              <q-icon :name="studyStore.getCategoryIcon(category.label)" size="24px" :color="category.color" class="q-mb-sm" />
              <div class="text-weight-medium">{{ category.label }}</div>
              <div class="text-caption text-grey-6">{{ getCategoryCount(category.value) }} studies</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery || hasActiveFilters">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">
          Research Results
          <span class="text-caption text-grey-6 q-ml-sm">({{ studyStore.totalStudies }} found)</span>
        </div>
        <div class="row items-center q-gutter-sm">
          <q-btn-toggle v-model="viewMode" :options="viewModeOptions" toggle-color="primary" color="grey-3" text-color="grey-7" size="sm" unelevated />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="studyStore.loading" class="text-center q-py-xl">
        <q-spinner color="primary" size="48px" />
        <div class="text-grey-6 q-mt-md">Searching research studies...</div>
      </div>

      <!-- Card View -->
      <div v-else-if="viewMode === 'cards'" class="row q-gutter-md justify-center">
        <div v-for="study in studyStore.sortedStudies" :key="study.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card flat bordered class="study-card cursor-pointer" @click="onSelectStudy(study)">
            <q-card-section class="q-pa-md">
              <div class="row items-start q-gutter-md">
                <q-icon :name="getCategoryIcon(study.category)" :color="getCategoryColor(study.category)" size="32px" />
                <div class="col">
                  <div class="text-weight-medium text-body1">{{ study.name }}</div>
                  <div class="text-caption text-grey-6 q-mt-xs">{{ study.category }}</div>
                  <div class="text-caption text-grey-6">{{ study.patientCount }} patients</div>
                </div>
                <q-chip :color="getStatusColor(study.status)" text-color="white" size="sm">
                  {{ study.status }}
                </q-chip>
              </div>
              <div class="q-mt-sm">
                <div class="text-caption text-grey-7">{{ study.description }}</div>
              </div>
            </q-card-section>
            <q-card-actions class="q-pa-sm">
              <q-btn flat dense color="primary" icon="visibility" @click.stop="onViewStudy(study)">
                <q-tooltip>View Study</q-tooltip>
              </q-btn>
              <q-space />
              <q-btn flat dense color="secondary" icon="analytics" @click.stop="onViewAnalytics(study)">
                <q-tooltip>Analytics</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
      </div>

      <!-- Table View -->
      <div v-else-if="viewMode === 'table'">
        <q-table :rows="studyStore.sortedStudies" :columns="tableColumns" row-key="id" flat bordered :rows-per-page-options="[10, 25, 50]" class="study-table" @row-click="onTableRowClick">
          <template v-slot:body-cell-category="props">
            <q-td :props="props">
              <q-chip :color="getCategoryColor(props.row.category)" text-color="white" size="sm" :icon="getCategoryIcon(props.row.category)">
                {{ props.row.category }}
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip :color="getStatusColor(props.row.status)" text-color="white" size="sm">
                {{ props.row.status }}
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn flat dense icon="visibility" @click.stop="onViewStudy(props.row)">
                <q-tooltip>View Study</q-tooltip>
              </q-btn>
              <q-btn flat dense icon="analytics" @click.stop="onViewAnalytics(props.row)">
                <q-tooltip>Analytics</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </div>

      <!-- No Results -->
      <div v-if="!studyStore.loading && studyStore.sortedStudies.length === 0" class="text-center q-py-xl">
        <q-icon :name="hasSearched ? 'biotech' : 'search_off'" size="64px" color="grey-5" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{ hasSearched ? 'No studies found' : 'Search for research studies' }}
        </div>
        <div class="text-body2 text-grey-6 q-mt-sm">Try searching by research category, clinical scale, or specific concepts</div>
        <q-btn v-if="hasSearched" color="primary" label="Clear Search" @click="clearSearch" class="q-mt-md" />
        <q-btn v-else color="primary" label="Browse Categories" @click="showAdvancedSearch = true" class="q-mt-md" />
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="studyStore.sortedStudies.length > 0" class="row justify-center q-mt-lg">
      <q-pagination v-model="pagination.page" :max="Math.ceil(studyStore.totalStudies / pagination.rowsPerPage)" direction-links boundary-links color="primary" @update:model-value="loadStudies" />
    </div>

    <!-- Create Study Dialog -->
    <CreateStudyDialog v-model="showCreateStudyDialog" @study-created="onStudyCreated" />

    <!-- Study Details Dialog -->
    <StudyDetailsDialog v-model="showStudyDetailsDialog" :study="selectedStudy" @edit="onEditStudy" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useStudyStore } from 'src/stores/study-store'
import CreateStudyDialog from '../components/studies/CreateStudyDialog.vue'
import StudyDetailsDialog from '../components/studies/StudyDetailsDialog.vue'

const $q = useQuasar()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const studyStore = useStudyStore()

// Local component state
const searchQuery = ref('')
const showAdvancedSearch = ref(false)
const viewMode = ref('cards')
const hasSearched = ref(false)
const showCreateStudyDialog = ref(false)
const showStudyDetailsDialog = ref(false)
const selectedStudy = ref(null)

// Search intelligence
const searchSuggestions = ref([])

// Filters
const filters = ref({
  researchCategory: null,
  clinicalScale: null,
  studyStatus: null,
  conceptType: null,
  patientCount: { min: 1, max: 1000 },
})

// Pagination
const pagination = ref({
  page: 1,
  rowsPerPage: 12,
})

// Options
const viewModeOptions = [
  { label: 'Cards', value: 'cards', icon: 'view_module' },
  { label: 'Table', value: 'table', icon: 'view_list' },
]

// Computed research categories based on actual data
const researchCategories = computed(() => {
  const categories = Object.keys(studyStore.studiesByCategory)
  return categories.map(category => ({
    label: category,
    value: category.toLowerCase().replace(/\s+/g, '-'),
    color: getCategoryColor(category)
  }))
})

const studyStatusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Planning', value: 'planning' },
  { label: 'On Hold', value: 'on-hold' },
]

const tableColumns = [
  {
    name: 'name',
    required: true,
    label: 'Study Name',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'category',
    label: 'Category',
    field: 'category',
    align: 'left',
    sortable: true,
  },
  {
    name: 'patientCount',
    label: 'Patients',
    field: 'patientCount',
    align: 'center',
    sortable: true,
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center',
    sortable: true,
  },
  {
    name: 'created',
    label: 'Created',
    field: 'created',
    align: 'left',
    sortable: true,
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'center',
  },
]

// Computed
const hasActiveFilters = computed(() => {
  return filters.value.researchCategory || filters.value.clinicalScale || filters.value.studyStatus || filters.value.patientCount.min > 1 || filters.value.patientCount.max < 1000
})

// Methods
const loadStudies = async () => {
  hasSearched.value = true
  try {
    await studyStore.searchStudies(searchQuery.value, filters.value)
  } catch (error) {
    console.error('Failed to load studies:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load studies',
      position: 'top',
    })
  }
}

const analyzeSearchQuery = (query) => {
  const suggestions = []

  // Category detection
  const categories = {
    neurological: /\b(neurological|neurology|neuro)\b/i,
    scales: /\b(scale|assessment|clinical|test)\b/i,
    stroke: /\b(stroke|ischemic|hemorrhagic)\b/i,
    psychological: /\b(psychological|psychology|mental|depression|anxiety)\b/i,
  }

  for (const [category, regex] of Object.entries(categories)) {
    if (regex.test(query)) {
      const categoryNames = {
        neurological: 'Neurological Assessment',
        scales: 'Clinical Scales',
        stroke: 'Stroke Research',
        psychological: 'Psychological Assessment',
      }
      suggestions.push({
        type: 'category',
        label: categoryNames[category],
        icon: 'category',
        color: 'primary',
      })
      break
    }
  }

  // Specific test detection
  if (/\b(fugl.?meyer|fma)\b/i.test(query)) {
    suggestions.push({
      type: 'test',
      label: 'Fugl-Meyer Assessment',
      icon: 'biotech',
      color: 'secondary',
    })
  }

  if (/\b(box.?block|bbt)\b/i.test(query)) {
    suggestions.push({
      type: 'test',
      label: 'Box and Block Test',
      icon: 'sports_baseball',
      color: 'positive',
    })
  }

  return suggestions
}

const onSearchChange = () => {
  searchSuggestions.value = analyzeSearchQuery(searchQuery.value)
  pagination.value.page = 1
  if (searchQuery.value || hasActiveFilters.value) {
    loadStudies()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchSuggestions.value = []
  hasSearched.value = false
  resetFilters()
}

const showAllStudies = async () => {
  // Clear search and filters
  searchQuery.value = ''
  searchSuggestions.value = []
  resetFilters()

  // Set hasSearched to true to show the study list
  hasSearched.value = true

  // Load all studies
  try {
    await studyStore.searchStudies('', {})
  } catch (error) {
    console.error('Failed to load all studies:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load studies',
      position: 'top',
    })
  }
}

const resetFilters = () => {
  filters.value = {
    researchCategory: null,
    clinicalScale: null,
    studyStatus: null,
    conceptType: null,
    patientCount: { min: 1, max: 1000 },
  }
}

const applyFilters = () => {
  pagination.value.page = 1
  loadStudies()
}

const searchByCategory = (category) => {
  // Use the category label directly since it matches the database values
  const categoryName = category.label

  // Check if this category exists in our studies
  const categories = studyStore.studiesByCategory
  if (categories[categoryName] && categories[categoryName].length > 0) {
    filters.value.researchCategory = categoryName.toLowerCase().replace(/\s+/g, '-')
    // Don't set searchQuery when filtering by category - it causes name+category search
    searchQuery.value = ''
    applyFilters()
  } else {
    console.warn(`Category "${categoryName}" not found in studies`, categories)
  }
}

const getCategoryIcon = (category) => {
  const icons = {
    'Neurological Assessment': 'psychology',
    'Clinical Scales': 'timeline',
    'Stroke Research': 'healing',
    'Psychological Assessment': 'sentiment_satisfied',
    'Imaging Studies': 'image',
    'Laboratory Research': 'science',
  }
  return icons[category] || 'biotech'
}

const getCategoryColor = (category) => {
  const colors = {
    'Neurological Assessment': 'primary',
    'Clinical Scales': 'secondary',
    'Stroke Research': 'positive',
    'Psychological Assessment': 'info',
    'Imaging Studies': 'warning',
    'Laboratory Research': 'negative',
  }
  return colors[category] || 'grey'
}

const getStatusColor = (status) => {
  const colors = {
    active: 'positive',
    completed: 'info',
    planning: 'warning',
    'on-hold': 'negative',
  }
  return colors[status] || 'grey'
}

const getCategoryCount = (categoryValue) => {
  // Get real count from study store
  const categories = studyStore.studiesByCategory

  // Try to match by converting slug back to original category name
  const matchingCategory = Object.keys(categories).find(category =>
    category.toLowerCase().replace(/\s+/g, '-') === categoryValue
  )

  if (matchingCategory) {
    return categories[matchingCategory].length
  }

  // Fallback: try direct match with category names
  if (categories[categoryValue]) {
    return categories[categoryValue].length
  }

  return 0
}

// Action handlers
const onSelectStudy = (study) => {
  studyStore.setSelectedStudy(study)
  selectedStudy.value = study
  showStudyDetailsDialog.value = true
}

const onTableRowClick = (evt, row) => {
  onSelectStudy(row)
}

const onViewStudy = (study) => {
  onSelectStudy(study)
}

const onViewAnalytics = async (study) => {
  try {
    const analytics = await studyStore.getStudyAnalytics(study.id)
    $q.notify({
      type: 'info',
      message: `Analytics: ${study.name} - Progress: ${analytics.patientProgress.toFixed(1)}%`,
      position: 'top',
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to load study analytics',
      position: 'top',
    })
  }
}

const onCreateStudy = () => {
  showCreateStudyDialog.value = true
}

const onStudyCreated = async (createdStudy) => {
  // The study store will automatically update its state
  // Refresh search results if we're currently searching
  if (searchQuery.value || hasActiveFilters.value) {
    await loadStudies()
  }

  $q.notify({
    type: 'positive',
    message: `Study "${createdStudy.name}" created successfully!`,
    position: 'top',
    timeout: 3000,
  })
}

const onEditStudy = (study) => {
  // Handle study editing
  $q.notify({
    type: 'info',
    message: `Edit study: ${study.name} - Coming soon!`,
    position: 'top',
  })
}

// Clinical scales data - replace with database query
const clinicalScales = ref([
  { label: 'Fugl-Meyer Assessment', value: 'fma' },
  { label: 'Box and Block Test', value: 'bbt' },
  { label: 'Montreal Cognitive Assessment', value: 'moca' },
  { label: 'Mini-Mental State Exam', value: 'mmse' },
  { label: 'DNMSQuest', value: 'dnms' },
])

const filterClinicalScales = (val, update) => {
  if (val === '') {
    update(() => {
      // Show all scales when no filter
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    clinicalScales.value = clinicalScales.value.filter((v) => v.label.toLowerCase().indexOf(needle) > -1)
  })
}

// Initialize
onMounted(async () => {
  // Preload clinical scales
  if (dbStore.canPerformOperations) {
    try {
      await conceptStore.initialize()
    } catch (error) {
      console.error('Failed to load clinical scales:', error)
    }
  }
})

// Watch for filter changes
watch(
  () => filters.value,
  () => {
    if (hasActiveFilters.value) {
      pagination.value.page = 1
      loadStudies()
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.search-card {
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.smart-search {
  :deep(.q-field__control) {
    border-radius: 12px;
    font-size: 16px;
  }
}

.stat-card {
  border-radius: 12px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.category-card {
  border-radius: 12px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.study-card {
  border-radius: 12px;
  transition: all 0.2s ease;
  height: 200px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.study-table {
  :deep(.q-table__top) {
    padding: 12px 16px;
  }

  :deep(.q-table tbody tr) {
    cursor: pointer;

    &:hover {
      background-color: rgba(25, 118, 210, 0.04);
    }
  }

  :deep(.q-table th) {
    font-weight: 600;
    color: #1976d2;
  }
}
</style>
