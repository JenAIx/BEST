<template>
  <!-- Unified visits view: compact card layout + timeline rail. Header and
       upload area stay fixed, only the card list scrolls. Self-contained:
       no navigation to the legacy entry tab. -->
  <div class="unified-view">
    <div class="unified-container">
      <!-- Fixed three-column grid: nav left, cards middle (constant width in
           every state), editor tools right. Below 1000px the edit tools
           replace the nav in the single side column. -->
      <div class="unified-body" :class="{ 'unified-body--editing': editingVisitId !== null }">
        <div class="unified-side">
          <VisitQuickNav v-if="!coldLoading && navEntries.length > 0" class="unified-nav" :entries="navEntries" :active="activeNav" @select-visit="navToVisit" @select-group="navToGroup" />
        </div>

        <div class="unified-main">
          <!-- Fixed header row above the card list: filter left, expand-all +
               new visit right. Hidden while editing — the sticky card header
               takes over. -->
          <div v-if="editingVisitId === null" class="unified-header row items-center q-gutter-sm">
            <q-input v-model="searchTerm" dense outlined clearable :placeholder="$t('visit.compactSearchPlaceholder')" class="unified-search" debounce="200" data-cy="unified-search">
              <template v-slot:prepend>
                <q-icon name="search" size="18px" />
              </template>
            </q-input>
            <q-space />
            <q-btn
              flat
              round
              dense
              :icon="allVisibleExpanded ? 'unfold_less' : 'unfold_more'"
              color="grey-7"
              :disable="!!searchTerm || visibleVisits.length === 0"
              data-cy="unified-expand-toggle"
              @click="toggleExpandAll"
            >
              <q-tooltip>{{ allVisibleExpanded ? $t('visit.collapseAll') : $t('visit.expandAll') }}</q-tooltip>
            </q-btn>
            <q-btn color="primary" icon="add" :label="$t('visit.newVisit')" data-cy="unified-new-visit" @click="showNewVisitDialog = true" />
          </div>

          <!-- Scroll area: notes strip + visit cards. The spinner only shows
               on a COLD load — background refreshes (autosave exit, clone,
               upload) must never unmount the list/editor or reset scroll -->
          <div ref="scrollArea" class="unified-scroll">
            <PatientNotesStrip v-if="!coldLoading" :patient-num="patientNum" />

            <div v-if="listState === 'loading'" class="state-block">
              <q-spinner-grid size="50px" color="primary" />
              <div class="text-h6 q-mt-md">{{ $t('visit.loadingVisits') }}</div>
            </div>

            <div v-if="listState === 'empty'" class="state-block">
              <q-icon name="event_busy" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-sm">{{ $t('visit.noVisitsRecorded') }}</div>
              <div class="text-body2 text-grey-5 q-mb-md">{{ $t('visit.startByCreating') }}</div>
              <q-btn color="primary" icon="add" :label="$t('visit.createFirstVisit')" @click="showNewVisitDialog = true" />
            </div>

            <div v-if="listState === 'noResults'" class="state-block text-grey-6">
              <q-icon name="search_off" size="32px" class="q-mb-xs" />
              <div class="text-caption">{{ $t('visit.compactSearchNoResults', { term: searchTerm }) }}</div>
            </div>

            <div v-if="listState === 'ready'" class="unified-list">
              <VisitUnifiedCard
                v-for="visit in visibleVisits"
                :key="visit.id"
                :visit="visit"
                :categorized-observations="observationsForVisit(visit.id)"
                :observation-count="observationCountFor(visit)"
                :expanded="isExpanded(visit)"
                :editing="isEditing(visit.id)"
                :type-meta="typeMeta(visit)"
                :status-meta="statusMeta(visit)"
                @toggle="toggleCard(visit)"
                @edit="enterEditMode(visit)"
                @edit-meta="editVisitMeta(visit)"
                @finish="stopEditing"
                @clone="confirmClone(visit)"
                @delete="confirmDelete(visit)"
                @preview-file="previewFile"
                @preview-questionnaire="previewQuestionnaire"
              >
                <!-- Inline edit mode: split layout, mounted only for the editing card -->
                <template #editor>
                  <VisitCardEditor v-if="editingStoreVisit" :visit="editingStoreVisit" :patient="patient" @uploaded="onDataChanged" @groups-changed="editorGroups = $event" />
                </template>
              </VisitUnifiedCard>
            </div>
          </div>
        </div>

        <!-- Editor tools target (teleported from VisitCardEditor) -->
        <div v-if="editingVisitId !== null" id="unified-edit-sidebar" class="unified-edit-rail"></div>
      </div>

      <!-- File upload (drop zone, fixed below the scroll area; hidden while
           editing — irrelevant there and steals vertical space) -->
      <VisitFileUploadArea v-if="!coldLoading && editingVisitId === null" @uploaded="onDataChanged" />
    </div>

    <!-- Dialogs -->
    <NewVisitDialog v-model="showNewVisitDialog" :patient="patient" @created="onVisitCreated" />

    <EditVisitDialog v-if="selectedVisitForEdit" v-model="showEditVisitDialog" :patient="patient" :visit="selectedVisitForEdit" @visitUpdated="onVisitUpdated" />

    <FilePreviewDialog
      v-if="selectedFileObservation"
      v-model="showFilePreview"
      :observation-id="selectedFileObservation.observationId"
      :file-info="selectedFileObservation.fileInfo"
      :concept-name="selectedFileObservation.conceptName"
      :upload-date="selectedFileObservation.date"
    />

    <QuestionnairePreviewDialog
      v-if="selectedQuestionnaireObservation"
      v-model="showQuestionnairePreview"
      :observation-id="selectedQuestionnaireObservation.observationId"
      :concept-name="selectedQuestionnaireObservation.conceptName"
      :completion-date="selectedQuestionnaireObservation.date"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useVisitLabels } from 'src/composables/useVisitLabels'
import { useVisitActions } from 'src/composables/useVisitActions'
import { useSingleVisitEdit } from 'src/composables/useSingleVisitEdit'
import { groupObservationsByFieldSets, filterObservations } from 'src/shared/utils/file-category'
import { isBlankObservation } from 'src/shared/utils/observation-display.js'
import { toggleExpanded, allExpanded, expandAll, collapseAll } from 'src/shared/utils/expand-state.js'
import { formatDate } from 'src/shared/utils/medical-utils.js'
import VisitUnifiedCard from './VisitUnifiedCard.vue'
import VisitCardEditor from './VisitCardEditor.vue'
import VisitQuickNav from './VisitQuickNav.vue'
import PatientNotesStrip from '../PatientNotesStrip.vue'
import VisitFileUploadArea from '../VisitFileUploadArea.vue'
import NewVisitDialog from '../NewVisitDialog.vue'
import EditVisitDialog from '../../patient/EditVisitDialog.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'
import QuestionnairePreviewDialog from 'src/components/shared/QuestionnairePreviewDialog.vue'

defineOptions({
  name: 'VisitTimelineUnified',
})

const props = defineProps({
  patient: { type: Object, required: true },
  selectedVisit: { type: Object, default: null },
})

const visitStore = useVisitStore()
const observationStore = useObservationStore()
const logger = useLoggingStore().createLogger('VisitTimelineUnified')

const patientNum = computed(() => props.patient?.PATIENT_NUM ?? props.patient?.rawData?.PATIENT_NUM ?? null)

// Store state (loading is a plain boolean in the visit store). Only a COLD
// load (no data yet) may swap the UI for a spinner — visitStore.loading also
// flips on every background refresh and would unmount list + editor
const visits = computed(() => visitStore.visits)
const sortedVisits = computed(() => visitStore.sortedVisits)
const coldLoading = computed(() => visitStore.loading && visitStore.visits.length === 0)

// ONE explicit state for the list area — the template only compares against
// it instead of chaining conditions
const listState = computed(() => {
  if (coldLoading.value) return 'loading'
  if (visits.value.length === 0) return 'empty'
  if (visibleVisits.value.length === 0) return 'noResults'
  return 'ready'
})

// ---- Labels (resolved once per distinct code, sync lookup for the cards) ----
const { resolveAll, typeMeta, statusMeta } = useVisitLabels()
watch(sortedVisits, (list) => resolveAll(list), { immediate: true })

// ---- Search / grouping ----
// Read cards group like the editor: field groups first (concept match beats
// category claim), remainder by observation category
const globalSettingsStore = useGlobalSettingsStore()
const fieldSetDefs = ref([])

onMounted(async () => {
  try {
    fieldSetDefs.value = (await globalSettingsStore.getFieldSetOptions()) || []
    // Same dynamic fallback as the editor: without the seeded questionnaires
    // field set, Q observations would group under the raw category name
    if (!fieldSetDefs.value.some((fs) => fs.id === 'questionnaires')) {
      fieldSetDefs.value.push({ id: 'questionnaires', name: 'Fragebögen', icon: 'quiz', concepts: ['CUSTOM: QUESTIONNAIRE'], categories: [] })
    }
  } catch (error) {
    logger.error('Failed to load field set definitions', error)
  }
})

const searchTerm = ref('')

// Read mode hides observations that were merely created without a value —
// NV rows ("explicitly no value") stay visible as ∅ tiles. Blank rows are
// still editable: the form grid shows every field-set concept anyway.
const groupedByVisit = computed(() =>
  groupObservationsByFieldSets(
    filterObservations(
      observationStore.allObservations.filter((obs) => !isBlankObservation(obs)),
      searchTerm.value,
    ),
    fieldSetDefs.value,
  ),
)

const observationsForVisit = (visitId) => groupedByVisit.value.get(visitId) || []

const matchedCount = (visitId) => observationsForVisit(visitId).flatMap((category) => category.observations).length

// Edit mode is a focus mode: only the visit being edited is shown.
// Otherwise: while searching only visits with matching results are shown.
const visibleVisits = computed(() => {
  if (editingVisitId.value != null) return sortedVisits.value.filter((visit) => isEditing(visit.id))
  if (!searchTerm.value) return sortedVisits.value
  return sortedVisits.value.filter((visit) => observationsForVisit(visit.id).length > 0)
})

// Header count: the visit query's count is the source of truth; while
// searching the number of matches is more useful
const observationCountFor = (visit) => (searchTerm.value ? matchedCount(visit.id) : visit.observationCount || 0)

// ---- Expand state (session-local, default: everything collapsed) ----
const expandedIds = ref(new Set())

// Searching force-expands matches WITHOUT touching the user's state —
// clearing the search restores the previous expand state for free
const isExpanded = (visit) => (searchTerm.value ? true : expandedIds.value.has(visit.id))

const toggleCard = async (visit) => {
  // Collapsing the editing card means "done" (autosave model, nothing to lose)
  if (isEditing(visit.id)) {
    await stopEditing()
    expandedIds.value = collapseAll(expandedIds.value, [visit.id])
    return
  }
  if (searchTerm.value) return // cards are pinned open while searching
  expandedIds.value = toggleExpanded(expandedIds.value, visit.id)
}

const allVisibleExpanded = computed(() =>
  allExpanded(
    visibleVisits.value.map((visit) => visit.id),
    expandedIds.value,
  ),
)

const toggleExpandAll = () => {
  const ids = visibleVisits.value.map((visit) => visit.id)
  expandedIds.value = allVisibleExpanded.value ? collapseAll(expandedIds.value, ids) : expandAll(expandedIds.value, ids)
}

// Reset per patient (encounter ids must not leak between patients);
// a visit selected elsewhere (e.g. legacy tabs) starts expanded
watch(patientNum, () => {
  expandedIds.value = new Set()
  searchTerm.value = ''
  editingVisitId.value = null // no cross-patient edit state
})

watch(
  () => props.selectedVisit?.id,
  (id) => {
    if (id != null) expandedIds.value = expandAll(expandedIds.value, [id])
  },
  { immediate: true },
)

// ---- Visit actions (clone/delete with confirm, edit dialog) ----
const { confirmClone, confirmDelete, buildVisitForEdit } = useVisitActions({
  getPatientNum: () => patientNum.value,
})

// ---- Inline edit mode (at most one visit at a time) ----
const { editingVisitId, isEditing, startEditing, stopEditing } = useSingleVisitEdit({
  // Always edit the store's full copy (rawData/visitType parsed from VISIT_BLOB)
  resolveVisit: (visit) => visitStore.visits.find((v) => v.id === visit.id) || visit,
  // The panels read observationStore.observations → select BEFORE the editor mounts
  selectVisit: (visit) => visitObservationService.selectVisitAndLoadObservations(visit),
  onEnter: (visit) => {
    expandedIds.value = expandAll(expandedIds.value, [visit.id])
  },
  // Autosaves write with skipReload → refresh the read cards on exit. The
  // grace delay lets an in-flight blur-autosave (mousedown on "Fertig" fires
  // blur → save and click → exit as parallel chains) commit before we read
  onExit: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await onDataChanged()
  },
})

const editingStoreVisit = computed(() => (editingVisitId.value == null ? null : visitStore.visits.find((v) => v.id === editingVisitId.value) || null))

// Recovery: if the editing visit vanishes from the store (failed refresh,
// patient-switch race), leave focus mode instead of showing a dead end
watch(editingStoreVisit, (visit) => {
  if (editingVisitId.value != null && !visit) {
    editingVisitId.value = null
  }
})

// Leaving the view (tab switch) while editing: refresh the patient-wide list
onBeforeUnmount(() => {
  if (editingVisitId.value != null && patientNum.value != null) {
    observationStore.loadAllObservationsForPatient(patientNum.value)
  }
})

// Visit metadata (date/type/status) — reachable from the 3-dot menu in read
// mode and from the pencil in the editing card's header
const showEditVisitDialog = ref(false)
const selectedVisitForEdit = ref(null)

const editVisitMeta = (visit) => {
  const full = visitStore.visits.find((v) => v.id === visit.id) || visit
  selectedVisitForEdit.value = buildVisitForEdit(full)
  showEditVisitDialog.value = true
}

const onVisitUpdated = async () => {
  await onDataChanged()
  // Keep the editor working on the fresh store copy
  const visit = editingStoreVisit.value
  if (visit) {
    try {
      await visitObservationService.selectVisitAndLoadObservations(visit)
    } catch (error) {
      logger.error('Failed to re-select visit after metadata update', error)
    }
  }
}

// ---- New visit: created → straight into edit mode ----
const showNewVisitDialog = ref(false)

const onVisitCreated = async (newVisit) => {
  try {
    // Dialog payload has no visitType/rawData — reload and use the store copy
    await onDataChanged()
    const id = newVisit?.id ?? newVisit?.ENCOUNTER_NUM
    const full = id != null ? visitStore.visits.find((v) => v.id === id) : null
    if (full) await startEditing(full)
  } catch (error) {
    logger.error('Failed to refresh after visit creation', error)
  }
}

// ---- Shared refresh: visits AND patient-wide observations (card bodies) ----
const onDataChanged = async () => {
  if (patientNum.value == null) return
  try {
    await visitStore.loadVisitsForPatient(patientNum.value)
    await observationStore.loadAllObservationsForPatient(patientNum.value)
  } catch (error) {
    logger.error('Failed to refresh visits/observations', error)
  }
}

// ---- Quick navigation (left column) + scroll spy ----
const scrollArea = ref(null)
const activeNav = ref(null)
const editorGroups = ref([]) // reported by VisitCardEditor while editing

const navEntries = computed(() => {
  if (editingVisitId.value != null) {
    const visit = editingStoreVisit.value
    if (!visit) return []
    return [{ visitId: visit.id, label: formatDate(visit.date), sublabel: typeMeta(visit).label, expanded: true, groups: editorGroups.value }]
  }
  // No nav while everything is collapsed; once something is expanded, ALL
  // visits are listed — collapsed ones as muted one-liners, so the other
  // visits stay reachable (click expands + jumps)
  if (!visibleVisits.value.some((visit) => isExpanded(visit))) return []
  return visibleVisits.value.map((visit) => ({
    visitId: visit.id,
    label: formatDate(visit.date),
    sublabel: typeMeta(visit).label,
    expanded: isExpanded(visit),
    groups: isExpanded(visit) ? observationsForVisit(visit.id).map((group) => ({ name: group.name, icon: group.icon })) : [],
  }))
})

const scrollToSelector = async (selector) => {
  await nextTick()
  const el = scrollArea.value?.querySelector(selector)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const navToVisit = (visitId) => {
  if (editingVisitId.value == null && !expandedIds.value.has(visitId) && !searchTerm.value) {
    expandedIds.value = expandAll(expandedIds.value, [visitId])
  }
  scrollToSelector(`[data-visit-id="${visitId}"]`)
}

const navToGroup = ({ visitId, group }) => {
  if (editingVisitId.value == null && !expandedIds.value.has(visitId) && !searchTerm.value) {
    expandedIds.value = expandAll(expandedIds.value, [visitId])
  }
  scrollToSelector(`[data-visit-id="${visitId}"] [data-group-name="${CSS.escape(group)}"]`)
}

// Entering edit mode keeps the section the user was looking at: remember the
// scroll spy's active group and jump there once the editor panels exist
// (they mount async after field-set activation — retry briefly)
const scrollToGroupWhenReady = async (visitId, group) => {
  const selector = `[data-visit-id="${visitId}"] [data-group-name="${CSS.escape(group)}"]`
  for (let attempt = 0; attempt < 20; attempt++) {
    await nextTick()
    const el = scrollArea.value?.querySelector(selector)
    if (el && el.offsetHeight > 0) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const enterEditMode = async (visit) => {
  const targetGroup = activeNav.value?.visitId === visit.id ? activeNav.value.group : null
  await startEditing(visit)
  if (targetGroup) await scrollToGroupWhenReady(visit.id, targetGroup)
}

// Scroll spy: the last visit/group anchor above the threshold line is active
let spyTicking = false
const onSpyScroll = () => {
  if (spyTicking) return
  spyTicking = true
  requestAnimationFrame(() => {
    spyTicking = false
    const container = scrollArea.value
    if (!container) return
    const threshold = container.getBoundingClientRect().top + 80
    let current = null
    let last = null
    for (const card of container.querySelectorAll('[data-visit-id]')) {
      const visitId = Number(card.dataset.visitId)
      if (card.getBoundingClientRect().top <= threshold) current = { visitId, group: null }
      for (const section of card.querySelectorAll('[data-group-name]')) {
        const rect = section.getBoundingClientRect()
        if (rect.height === 0) continue
        last = { visitId, group: section.dataset.groupName }
        if (rect.top <= threshold) current = last
      }
    }
    // At the very bottom the last section can never cross the top threshold —
    // treat "scrolled to the end" as "last entry active"
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 4
    activeNav.value = atBottom && last ? last : current
  })
}

// Re-measure and re-run the spy when the entry set or card contents change
// size (expand/collapse, mode flips, editor panels mounting, data reloads) —
// otherwise the active highlight is stale until the first scroll
watch(
  [navEntries, groupedByVisit],
  async () => {
    await nextTick()
    requestAnimationFrame(onSpyScroll)
  },
  { immediate: true },
)

onMounted(() => {
  scrollArea.value?.addEventListener('scroll', onSpyScroll, { passive: true })
  window.addEventListener('resize', onSpyScroll, { passive: true })
})

onBeforeUnmount(() => {
  scrollArea.value?.removeEventListener('scroll', onSpyScroll)
  window.removeEventListener('resize', onSpyScroll)
})

// ---- Preview dialogs (same wiring as the compact summary) ----
const selectedFileObservation = ref(null)
const showFilePreview = ref(false)
const selectedQuestionnaireObservation = ref(null)
const showQuestionnairePreview = ref(false)

const previewFile = (observation) => {
  selectedFileObservation.value = observation
  showFilePreview.value = true
}

const previewQuestionnaire = (observation) => {
  selectedQuestionnaireObservation.value = observation
  showQuestionnairePreview.value = true
}
</script>

<style lang="scss" scoped>
// Header + upload area fixed, only the card list scrolls (the pattern from
// .timeline-view--compact, applied permanently)
.unified-view {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem;
  background: $grey-1;
}

.unified-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}

// Fixed three-column grid: both side columns are ALWAYS reserved, so the
// middle column keeps a constant width in every state (collapsed overview,
// expanded read mode, edit mode)
.unified-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 200px;
  gap: 16px;
}

.unified-side {
  grid-column: 1;
  grid-row: 1;
  min-height: 0;
  overflow: hidden;

  .unified-nav {
    width: 100%;
    height: 100%;
  }
}

// Header row + scroll area — the header always sits exactly above the cards
.unified-main {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

// Editor tools (teleported from VisitCardEditor)
.unified-edit-rail {
  grid-column: 3;
  grid-row: 1;
  min-height: 0;
  overflow-y: auto;
}

// Small screens: one side column only — while editing the tools replace
// the quick navigation there
@media (max-width: 1000px) {
  .unified-body {
    grid-template-columns: 170px minmax(0, 1fr);
  }

  .unified-edit-rail {
    grid-column: 1;
  }

  .unified-body--editing .unified-side {
    display: none;
  }
}

.unified-header {
  flex-shrink: 0;
  margin-bottom: 1rem;
}

.unified-search {
  width: 260px;

  :deep(.q-field__control) {
    background: white;
  }
}

.unified-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;

  // Jump targets clear the (sticky) headers when scrolled to
  :deep([data-visit-id]) {
    scroll-margin-top: 8px;
  }

  :deep([data-group-name]) {
    scroll-margin-top: 12px;
  }

  :deep(.visit-block--editing [data-group-name]) {
    scroll-margin-top: 64px; // below the pinned visit header
  }
}

// Timeline rail: one unbroken vertical line, dots come from the cards
.unified-list {
  position: relative;
  padding-left: 34px;

  &::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 20px;
    bottom: 20px;
    width: 2px;
    background: $grey-4;
  }
}

.state-block {
  text-align: center;
  padding: 3rem 1rem;
}
</style>
