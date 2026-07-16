<template>
  <q-page>
    <div class="page-container">
      <!-- Header -->
      <PageHeader :title="$t('study.researchStudySearch')" :subtitle="$t('study.pageSubtitle')">
        <div class="text-caption text-grey-6">
          {{ hasSearched ? $t('study.totalStudiesFound', { count: studyStore.totalStudies }) : $t('study.totalStudiesFound', { count: studyStore.researchStats.totalStudies }) }}
        </div>
        <q-btn color="primary" icon="add" :label="$t('study.newStudy')" @click="onCreateStudy" />
      </PageHeader>

      <!-- Intelligent Study Search -->
      <div class="row justify-center q-mb-md">
        <div class="col-12">
          <q-card flat bordered class="search-card">
            <q-card-section class="q-pa-md">
              <q-input v-model="searchQuery" outlined dense :placeholder="$t('study.searchPlaceholder')" class="smart-search" @update:model-value="onSearchChange" debounce="300">
                <template v-slot:prepend>
                  <q-icon name="search" color="primary" />
                </template>
                <template v-slot:append>
                  <q-btn v-if="searchQuery" flat round dense icon="close" @click="clearSearch" />
                  <q-btn flat round dense icon="tune" @click="showAdvancedSearch = !showAdvancedSearch">
                    <q-tooltip>{{ $t('study.advancedFilters') }}</q-tooltip>
                  </q-btn>
                </template>
              </q-input>

              <!-- Search Suggestions -->
              <div v-if="searchSuggestions.length > 0" class="q-mt-sm">
                <div class="text-caption text-grey-6 q-mb-xs">{{ $t('study.detectedLabel') }}</div>
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
                <div class="text-subtitle2 q-mb-md">{{ $t('study.advancedResearchFilters') }}</div>
                <div class="row q-gutter-md justify-center">
                  <div class="col-12 col-md-4">
                    <q-select v-model="filters.researchCategory" :options="researchCategories" :label="$t('study.researchCategory')" outlined dense clearable emit-value map-options />
                  </div>
                  <div class="col-12 col-md-4">
                    <q-select
                      v-model="filters.clinicalScale"
                      :options="clinicalScales"
                      :label="$t('study.clinicalScale')"
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
                    <q-select v-model="filters.studyStatus" :options="studyStatusOptions" :label="$t('study.studyStatus')" outlined dense clearable emit-value map-options />
                  </div>
                </div>
                <div class="row justify-end q-mt-md">
                  <q-btn flat :label="$t('study.resetFilters')" @click="resetFilters" class="q-mr-sm" />
                  <q-btn color="primary" :label="$t('study.applyFilters')" @click="applyFilters" />
                </div>
              </q-card-section>
            </q-slide-transition>
          </q-card>
        </div>
      </div>

      <!-- Compact stats + research category chips (one slim block) -->
      <div v-if="!searchQuery && !hasActiveFilters" class="compact-overview q-mb-md">
        <div class="row items-center q-col-gutter-sm">
          <div class="col-auto compact-stat text-primary">
            <q-icon name="biotech" size="16px" />
            <strong>{{ studyStore.researchStats.totalStudies }}</strong> {{ $t('study.totalStudies') }}
          </div>
          <div class="col-auto compact-stat text-secondary">
            <q-icon name="psychology" size="16px" />
            <strong>{{ studyStore.researchStats.neurologicalStudies }}</strong> {{ $t('study.neurologicalStudies') }}
          </div>
          <div class="col-auto compact-stat text-positive">
            <q-icon name="healing" size="16px" />
            <strong>{{ studyStore.researchStats.strokeStudies }}</strong> {{ $t('study.strokeResearch') }}
          </div>
          <div class="col-auto compact-stat text-info">
            <q-icon name="timeline" size="16px" />
            <strong>{{ studyStore.researchStats.activeStudies }}</strong> {{ $t('study.activeStudies') }}
          </div>
          <q-space />
          <div class="col-auto row items-center">
            <span class="text-caption text-grey-6 q-mr-sm">{{ $t('study.researchCategories') }}:</span>
            <q-chip
              v-for="category in researchCategories"
              :key="category.value"
              clickable
              outline
              square
              size="sm"
              :color="category.color"
              :icon="studyStore.getCategoryIcon(category.label)"
              @click="searchByCategory(category)"
            >
              {{ category.label }} ({{ getCategoryCount(category.value) }})
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Study List / Search Results -->
      <div>
        <div class="row items-center justify-between q-mb-md">
          <div class="row items-center q-gutter-sm">
            <div class="text-h6">
              {{ searchQuery || hasActiveFilters ? $t('study.researchResults') : $t('study.allStudies') }}
              <span class="text-caption text-grey-6 q-ml-sm">({{ $t('study.totalStudiesFound', { count: studyStore.totalStudies }) }})</span>
            </div>
            <!-- Active filters as removable chips + reset -->
            <template v-if="activeFilterChips.length > 0">
              <q-chip v-for="chip in activeFilterChips" :key="chip.key" removable outline dense size="sm" color="primary" :icon="chip.icon" @remove="removeFilter(chip.key)">
                {{ chip.label }}
              </q-chip>
              <q-btn flat dense size="sm" color="grey-7" icon="clear_all" :label="$t('study.resetFilters')" @click="clearSearch" />
            </template>
          </div>
          <div class="row items-center q-gutter-sm">
            <q-btn-toggle v-model="viewMode" :options="viewModeOptions" toggle-color="primary" color="grey-3" text-color="grey-7" size="sm" unelevated />
          </div>
        </div>

        <!-- Loading -->
        <div v-if="studyStore.loading" class="text-center q-py-xl">
          <q-spinner color="primary" size="48px" />
          <div class="text-grey-6 q-mt-md">{{ $t('study.searchingStudies') }}</div>
        </div>

        <!-- Card View -->
        <div v-else-if="viewMode === 'cards'" class="study-cards-grid">
          <q-card v-for="study in studyStore.sortedStudies" :key="study.id" flat bordered class="study-card cursor-pointer" @click="onSelectStudy(study)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap q-gutter-sm">
                <q-icon :name="getCategoryIcon(study.category)" :color="getCategoryColor(study.category)" size="24px" />
                <div class="col study-card-info">
                  <div class="text-weight-medium study-card-name">{{ study.name }}</div>
                  <div class="text-caption text-grey-6 study-card-meta">
                    {{ study.category }} · {{ study.patientCount }} {{ $t('study.patients') }}
                    <template v-if="enrollmentBadge(study)"> · {{ enrollmentBadge(study) }}</template>
                  </div>
                </div>
                <q-chip v-if="openAuditCount(study)" color="negative" text-color="white" size="sm" dense icon="flag">
                  {{ openAuditCount(study) }}
                  <q-tooltip>{{ $t('study.audit.openAudits') }}</q-tooltip>
                </q-chip>
                <q-chip :color="getStatusColor(study.status)" text-color="white" size="sm" dense>
                  {{ study.status }}
                </q-chip>
                <q-btn flat round dense size="sm" color="secondary" icon="analytics" @click.stop="onViewAnalytics(study)">
                  <q-tooltip>{{ $t('study.analytics') }}</q-tooltip>
                </q-btn>
              </div>
              <div v-if="study.description" class="text-caption text-grey-7 study-card-description q-mt-xs">{{ study.description }}</div>
            </q-card-section>
          </q-card>
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
                <q-chip v-if="openAuditCount(props.row)" color="negative" text-color="white" size="sm" icon="flag">
                  {{ openAuditCount(props.row) }}
                  <q-tooltip>{{ $t('study.audit.openAudits') }}</q-tooltip>
                </q-chip>
                <q-chip :color="getStatusColor(props.row.status)" text-color="white" size="sm">
                  {{ props.row.status }}
                </q-chip>
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <q-btn flat dense icon="visibility" @click.stop="onViewStudy(props.row)">
                  <q-tooltip>{{ $t('study.viewStudy') }}</q-tooltip>
                </q-btn>
                <q-btn flat dense icon="analytics" @click.stop="onViewAnalytics(props.row)">
                  <q-tooltip>{{ $t('study.analytics') }}</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </div>

        <!-- No Results -->
        <div v-if="!studyStore.loading && studyStore.sortedStudies.length === 0" class="text-center q-py-xl">
          <q-icon :name="hasSearched ? 'biotech' : 'search_off'" size="64px" color="grey-5" />
          <div class="text-h6 text-grey-6 q-mt-md">
            {{ hasSearched ? $t('study.noStudiesFound') : $t('study.searchForStudies') }}
          </div>
          <div class="text-body2 text-grey-6 q-mt-sm">{{ $t('study.trySearchingBy') }}</div>
          <q-btn v-if="hasSearched" color="primary" :label="$t('study.clearSearch')" @click="clearSearch" class="q-mt-md" />
          <q-btn v-else color="primary" :label="$t('study.browseCategories')" @click="showAdvancedSearch = true" class="q-mt-md" />
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="studyStore.sortedStudies.length > 0" class="row justify-center q-mt-lg">
        <q-pagination v-model="pagination.page" :max="Math.ceil(studyStore.totalStudies / pagination.rowsPerPage)" direction-links boundary-links color="primary" @update:model-value="loadStudies" />
      </div>

      <!-- Create Study Dialog -->
      <CreateStudyDialog v-model="showCreateStudyDialog" @study-created="onStudyCreated" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotify } from 'src/composables/useNotify'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useStudyStore } from 'src/stores/study-store'
import CreateStudyDialog from '../components/studies/CreateStudyDialog.vue'
import PageHeader from 'src/components/shared/PageHeader.vue'

const router = useRouter()
const notify = useNotify()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const studyStore = useStudyStore()

// Local component state
const searchQuery = ref('')
const showAdvancedSearch = ref(false)
const viewMode = ref('cards')
const hasSearched = ref(false)
const showCreateStudyDialog = ref(false)

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
const viewModeOptions = computed(() => [
  { label: t('study.cards'), value: 'cards', icon: 'view_module' },
  { label: t('study.table'), value: 'table', icon: 'view_list' },
])

// Computed research categories based on actual data
const researchCategories = computed(() => {
  const categories = Object.keys(studyStore.studiesByCategory)
  return categories.map((category) => ({
    label: category,
    value: category.toLowerCase().replace(/\s+/g, '-'),
    color: getCategoryColor(category),
  }))
})

const studyStatusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Planning', value: 'planning' },
  { label: 'On Hold', value: 'on-hold' },
]

const tableColumns = computed(() => [
  {
    name: 'name',
    required: true,
    label: t('study.studyName'),
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'category',
    label: t('study.researchCategory'),
    field: 'category',
    align: 'left',
    sortable: true,
  },
  {
    name: 'patientCount',
    label: t('study.patients'),
    field: 'patientCount',
    align: 'center',
    sortable: true,
  },
  {
    name: 'status',
    label: t('study.status'),
    field: 'status',
    align: 'center',
    sortable: true,
  },
  {
    name: 'created',
    label: t('study.created'),
    field: 'created',
    align: 'left',
    sortable: true,
  },
  {
    name: 'actions',
    label: t('study.actions'),
    field: 'actions',
    align: 'center',
  },
])

// Computed
const hasActiveFilters = computed(() => {
  return filters.value.researchCategory || filters.value.clinicalScale || filters.value.studyStatus || filters.value.patientCount.min > 1 || filters.value.patientCount.max < 1000
})

// Active search/filter state as removable chips next to the results heading
const activeFilterChips = computed(() => {
  const chips = []
  if (searchQuery.value) {
    chips.push({ key: 'search', icon: 'search', label: `"${searchQuery.value}"` })
  }
  if (filters.value.researchCategory) {
    const category = researchCategories.value.find((c) => c.value === filters.value.researchCategory)
    chips.push({ key: 'researchCategory', icon: 'category', label: category?.label || filters.value.researchCategory })
  }
  if (filters.value.clinicalScale) {
    const scale = clinicalScales.value.find((c) => c.value === filters.value.clinicalScale)
    chips.push({ key: 'clinicalScale', icon: 'biotech', label: scale?.label || filters.value.clinicalScale })
  }
  if (filters.value.studyStatus) {
    const status = studyStatusOptions.find((o) => o.value === filters.value.studyStatus)
    chips.push({ key: 'studyStatus', icon: 'flag', label: status?.label || filters.value.studyStatus })
  }
  return chips
})

const removeFilter = (key) => {
  pagination.value.page = 1
  if (key === 'search') {
    searchQuery.value = ''
    searchSuggestions.value = []
    loadStudies()
  } else {
    // Filter watch reloads the list (shows all studies when nothing is left)
    filters.value[key] = null
  }
}

// Methods
const loadStudies = async () => {
  hasSearched.value = true
  try {
    await studyStore.searchStudies(searchQuery.value, filters.value)
    await loadStudyBadges()
  } catch (error) {
    console.error('Failed to load studies:', error)
    notify.error('Failed to load studies')
  }
}

// Per-study badges: enrollment progress ("x/y abgeschlossen") + open audits.
// One batch query each — no per-study N+1.
const enrollmentCounts = ref(new Map())
const auditCounts = ref(new Map())

const loadStudyBadges = async () => {
  const studyIds = studyStore.studies.filter((s) => s).map((s) => s.id)
  if (!studyIds.length) {
    enrollmentCounts.value = new Map()
    auditCounts.value = new Map()
    return
  }
  try {
    const [statusMap, auditMap] = await Promise.all([dbStore.getEnrollmentStatusCountsForStudies(studyIds), dbStore.getOpenAuditCountsForStudies(studyIds)])
    enrollmentCounts.value = statusMap
    auditCounts.value = auditMap
  } catch (error) {
    console.error('Failed to load study badges:', error)
  }
}

const enrollmentBadge = (study) => {
  const counts = enrollmentCounts.value.get(study.id)
  if (!counts) return ''
  const enrolled = counts.active + counts.completed
  if (!enrolled) return ''
  return t('study.completedBadge', { completed: counts.completed, enrolled })
}

const openAuditCount = (study) => auditCounts.value.get(study.id) || 0

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
  // Always reload — an emptied query must bring back the full list
  loadStudies()
}

const clearSearch = () => {
  searchQuery.value = ''
  searchSuggestions.value = []
  hasSearched.value = false
  pagination.value.page = 1
  // resetFilters replaces the filters object — the watcher reloads the full list
  resetFilters()
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
  const matchingCategory = Object.keys(categories).find((category) => category.toLowerCase().replace(/\s+/g, '-') === categoryValue)

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
  router.push(`/studies/${study.id}`)
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
    notify.info(`Analytics: ${study.name} - Progress: ${analytics.patientProgress.toFixed(1)}%`)
  } catch {
    notify.error('Failed to load study analytics')
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

  notify.success(`Study "${createdStudy.name}" created successfully!`, { timeout: 3000 })
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

    // Show all studies right away — no search/category click needed
    try {
      await studyStore.searchStudies('', {})
      await loadStudyBadges()
    } catch (error) {
      console.error('Failed to load studies:', error)
    }
  }
})

// Watch for filter changes — always reload: removing the last filter
// must bring back the unfiltered "all studies" list
watch(
  () => filters.value,
  () => {
    pagination.value.page = 1
    loadStudies()
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.smart-search {
  :deep(.q-field__control) {
    font-size: 15px;
  }
}

.compact-overview {
  .compact-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    white-space: nowrap;
  }
}

.study-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .study-cards-grid {
    grid-template-columns: 1fr;
  }
}

.study-card {
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: $primary;
    box-shadow: 0 2px 10px rgba($primary, 0.12);
  }

  .study-card-info {
    min-width: 0;
  }

  .study-card-name {
    font-size: 0.9rem;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .study-card-meta {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .study-card-description {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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
