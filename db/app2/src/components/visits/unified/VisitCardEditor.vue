<template>
  <!-- Inline edit mode of a unified visit card: split layout with the
       observation data left and a compact field-group sidebar right.
       Reuses the ObservationFieldSet editing chain unchanged; the visit MUST
       be the globally selected visit (the panels read
       observationStore.observations). -->
  <div class="visit-card-editor">
    <div v-if="loadingFieldSets" class="editor-loading">
      <q-spinner size="28px" color="primary" />
    </div>

    <template v-else>
      <!-- LEFT: observation data per active field group -->
      <div class="editor-main">
        <template v-for="fieldSet in activeFieldSetsList" :key="`${visit.id}-${fieldSet.id}`">
          <VisitQuestionnaireSection
            v-if="fieldSet.id === 'questionnaires'"
            :visit="visit"
            :patient="patient"
            :field-set="fieldSet"
            :questionnaires="visitQuestionnaires"
            @add-questionnaire="showAddDialog = true"
            @fill-questionnaire="onFillQuestionnaire"
            @view-questionnaire="onViewQuestionnaire"
            @remove-questionnaire="onRemoveQuestionnaire"
          />
          <ObservationFieldSet v-else :field-set="fieldSet" :visit="visit" :patient="patient" :previous-visits="previousVisits" :existing-observations="getFieldSetObservations(fieldSet.id)" />
        </template>

        <!-- Observations outside every configured field group -->
        <ObservationFieldSet
          v-if="uncategorizedFieldSet"
          :key="`${visit.id}-uncategorized`"
          :field-set="uncategorizedFieldSet"
          :visit="visit"
          :patient="patient"
          :previous-visits="previousVisits"
          :existing-observations="uncategorizedObservations"
        />

        <div v-if="activeFieldSetsList.length === 0 && !uncategorizedFieldSet" class="editor-empty text-grey-6">
          <q-icon name="category" size="28px" class="q-mb-xs" />
          <div class="text-caption">{{ $t('visit.noFieldGroupsActive') }}</div>
        </div>
      </div>

      <!-- RIGHT: field groups + add affordances (sticky) -->
      <aside class="editor-sidebar">
        <div class="sidebar-sticky">
          <div class="sidebar-title">{{ $t('visit.fieldGroups') }}</div>

          <!-- Groups on this visit: active (displayed) on top, hidden
               data-bearing ones greyed beneath — values are never lost by
               unchecking, so they stay here instead of "more groups" -->
          <q-list dense>
            <q-item v-for="fs in activeFieldSetsList" :key="fs.id" tag="label" dense class="sidebar-item">
              <q-item-section side>
                <q-checkbox dense size="sm" :model-value="true" @update:model-value="toggleFieldSet(fs.id)" />
              </q-item-section>
              <q-item-section avatar class="sidebar-icon">
                <q-icon :name="fs.icon || 'category'" size="16px" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="ellipsis sidebar-label">{{ fs.name }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge v-if="countFor(fs.id) > 0" rounded color="primary" :label="countFor(fs.id)" />
              </q-item-section>
            </q-item>

            <q-item v-for="fs in hiddenVisitGroups" :key="fs.id" tag="label" dense class="sidebar-item sidebar-item--inactive">
              <q-item-section side>
                <q-checkbox dense size="sm" :model-value="false" @update:model-value="toggleFieldSet(fs.id)" />
              </q-item-section>
              <q-item-section avatar class="sidebar-icon">
                <q-icon name="visibility_off" size="15px" color="grey-6" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="ellipsis sidebar-label">{{ fs.name }}</q-item-label>
                <q-tooltip>{{ $t('visit.fieldGroupHidden') }}</q-tooltip>
              </q-item-section>
              <q-item-section side>
                <q-badge rounded color="grey-5" :label="countFor(fs.id)" />
              </q-item-section>
            </q-item>

            <div v-if="activeFieldSetsList.length === 0 && hiddenVisitGroups.length === 0" class="text-caption text-grey-6 q-px-sm q-py-xs">{{ $t('visit.noFieldGroupsActive') }}</div>
          </q-list>

          <!-- Groups NOT on this visit: add via + (shows up as active panel;
               without entered values it disappears again on the next load) -->
          <template v-if="inactiveFieldSetsAll.length > 0">
            <div class="sidebar-subtitle">{{ $t('visit.fieldGroupsInactive') }}</div>
            <q-input v-model="fieldSetFilter" dense outlined clearable :placeholder="$t('visit.fieldGroupsFilter')" class="sidebar-filter">
              <template v-slot:prepend>
                <q-icon name="search" size="14px" />
              </template>
            </q-input>
            <div class="inactive-scroll">
              <q-list dense>
                <q-item v-for="fs in inactiveFieldSets" :key="fs.id" dense clickable class="sidebar-item sidebar-item--inactive" @click="toggleFieldSet(fs.id)">
                  <q-item-section side>
                    <q-btn flat round dense size="xs" icon="add" color="primary">
                      <q-tooltip>{{ $t('visit.fieldGroupAdd') }}</q-tooltip>
                    </q-btn>
                  </q-item-section>
                  <q-item-section avatar class="sidebar-icon">
                    <q-icon :name="fs.icon || 'category'" size="16px" color="grey-6" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="ellipsis sidebar-label">{{ fs.name }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <div v-if="fieldSetFilter && inactiveFieldSets.length === 0" class="text-caption text-grey-6 q-pa-sm">
                {{ $t('visit.compactSearchNoResults', { term: fieldSetFilter }) }}
              </div>
            </div>
          </template>

          <q-separator spaced />

          <q-btn outline color="primary" icon="add" class="full-width" no-caps :label="$t('observation.addObservation')" data-cy="editor-add-observation" @click="showAddCustomDialog = true" />
          <q-btn flat color="primary" icon="quiz" class="full-width q-mt-sm" no-caps :label="$t('visit.addQuestionnaire')" data-cy="editor-add-questionnaire" @click="showAddDialog = true" />
          <q-btn flat color="primary" icon="upload_file" class="full-width q-mt-sm" no-caps :label="$t('visit.uploadAddFile')" data-cy="editor-add-file" @click="fileInput?.click()" />
          <input ref="fileInput" type="file" :accept="UPLOAD_ACCEPTED_TYPES" class="hidden-file-input" @change="onFileInputChange" />
        </div>
      </aside>
    </template>

    <!-- Dialogs (teleported) -->
    <CustomObservationDialog v-model="showAddCustomDialog" :visit="visit" :patient="patient" field-set-name="Custom" field-set-id="custom" @questionnaire-added="onQuestionnaireAddedFromSearch" />

    <!-- Same upload flow as the drop zone: category suggestion + confirm
         dialog (the editing visit is the store-selected one → preselected) -->
    <FileUploadConfirmDialog v-model="showUploadConfirm" :file-data="pendingFile" @saved="onFileSaved" />

    <AddQuestionnaireToVisitDialog v-model="showAddDialog" :existing-questionnaire-codes="existingQuestionnaireCodes" :visit-type-code="visitTypeCode" @questionnaire-selected="onQuestionnaireSelected" />

    <VisitQuestionnaireFillDialog
      v-if="activeQuestionnaire"
      v-model="showFillDialog"
      :visit="visit"
      :patient="patient"
      :questionnaire-code="activeQuestionnaire.questionnaireCode"
      :observation-id="activeQuestionnaire.observationId"
      :observation-blob="activeQuestionnaire.observationBlob"
      :is-completed="activeQuestionnaire.isCompleted"
      @questionnaire-completed="onQuestionnaireCompleted"
      @close="onQuestionnaireFillClose"
    />
  </div>
</template>

<script setup>
import { ref, computed, toRef, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotify } from 'src/composables/useNotify'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useVisitFieldSets } from 'src/composables/useVisitFieldSets'
import { useVisitQuestionnaires } from 'src/composables/useVisitQuestionnaires'
import { useUncategorizedObservations } from 'src/composables/useUncategorizedObservations'
import { extractVisitType } from 'src/shared/utils/visit-labels.js'
import ObservationFieldSet from '../ObservationFieldSet.vue'
import VisitQuestionnaireSection from '../VisitQuestionnaireSection.vue'
import CustomObservationDialog from '../CustomObservationDialog.vue'
import AddQuestionnaireToVisitDialog from '../AddQuestionnaireToVisitDialog.vue'
import VisitQuestionnaireFillDialog from '../VisitQuestionnaireFillDialog.vue'
import FileUploadConfirmDialog from '../FileUploadConfirmDialog.vue'

defineOptions({
  name: 'VisitCardEditor',
})

const props = defineProps({
  visit: { type: Object, required: true },
  patient: { type: Object, required: true },
})

const emit = defineEmits(['uploaded', 'groups-changed'])

const observationStore = useObservationStore()
const visitRef = toRef(props, 'visit')
const patientRef = toRef(props, 'patient')

// Field groups (shared extraction from VisitDataEntry)
const {
  availableFieldSets,
  activeFieldSets,
  activeFieldSetsList,
  loadingFieldSets,
  loadFieldSets,
  activateFieldSetsForVisitType,
  activateFieldSetsWithData,
  toggleFieldSet,
  ensureQuestionnaireFieldSetActive,
  getFieldSetObservations,
  getFieldSetObservationCount,
} = useVisitFieldSets()

// Questionnaires (Q-type) on this visit
const {
  visitQuestionnaires,
  existingQuestionnaireCodes,
  activeQuestionnaire,
  showFillDialog,
  showAddDialog,
  onQuestionnaireSelected,
  onFillQuestionnaire,
  onViewQuestionnaire,
  onQuestionnaireCompleted,
  onQuestionnaireFillClose,
  onRemoveQuestionnaire,
} = useVisitQuestionnaires(visitRef, patientRef, { onAdded: () => ensureQuestionnaireFieldSetActive() })

// Observations that no configured field group claims
const { uncategorizedObservations, uncategorizedFieldSet } = useUncategorizedObservations(observationStore, availableFieldSets, visitRef)

const previousVisits = computed(() => visitObservationService.getPreviousVisits())
const visitTypeCode = computed(() => extractVisitType(props.visit) || '')

const showAddCustomDialog = ref(false)

const countFor = (fieldSetId) => (fieldSetId === 'questionnaires' ? visitQuestionnaires.value.length : getFieldSetObservationCount(fieldSetId))

// Sidebar in three tiers: active (displayed panels) on top, hidden
// data-bearing groups of THIS visit beneath (unchecking never discards
// values), and "more groups" (not on the visit) below with a + to add
const fieldSetFilter = ref('')

const hiddenVisitGroups = computed(() => availableFieldSets.value.filter((fs) => !activeFieldSets.value.includes(fs.id) && countFor(fs.id) > 0))

const inactiveFieldSetsAll = computed(() => availableFieldSets.value.filter((fs) => !activeFieldSets.value.includes(fs.id) && countFor(fs.id) === 0))

const inactiveFieldSets = computed(() => {
  const term = fieldSetFilter.value?.trim().toLowerCase()
  if (!term) return inactiveFieldSetsAll.value
  return inactiveFieldSetsAll.value.filter((fs) => fs.name.toLowerCase().includes(term))
})

const onQuestionnaireAddedFromSearch = async (data) => {
  await onQuestionnaireSelected({ code: data.code, title: data.title, shortTitle: data.shortTitle })
}

// ---- File upload (same flow/limits as the VisitFileUploadArea drop zone) ----
const { t } = useI18n()
const notify = useNotify()

const UPLOAD_ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp,.mp4,.mov,.webm,.mkv,.avi'
const UPLOAD_MAX_SIZE_MB = 50 // matches the uploadRawData DB guard

const fileInput = ref(null)
const pendingFile = ref(null)
const showUploadConfirm = ref(false)

const onFileInputChange = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = '' // allow re-selecting the same file
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!UPLOAD_ACCEPTED_TYPES.includes(`.${ext}`)) {
    notify.error(t('visit.uploadUnsupportedType', { ext }))
    return
  }
  if (file.size > UPLOAD_MAX_SIZE_MB * 1024 * 1024) {
    notify.error(t('visit.uploadTooLarge', { max: UPLOAD_MAX_SIZE_MB }))
    return
  }

  const arrayBuffer = await file.arrayBuffer()
  pendingFile.value = {
    fileInfo: { filename: file.name, size: file.size, ext },
    blob: new Uint8Array(arrayBuffer),
    originalFile: file,
  }
  showUploadConfirm.value = true
}

const onFileSaved = async (payload) => {
  pendingFile.value = null
  // Show the new R observation in the panels; the container refreshes counts
  await visitObservationService.selectVisitAndLoadObservations(props.visit)
  emit('uploaded', payload)
}

// Report the rendered panel list to the container's quick navigation
// (names match the data-group-name anchors on the panels)
watch(
  [activeFieldSetsList, uncategorizedFieldSet],
  ([activeList, uncategorized]) => {
    const groups = activeList.map((fs) => ({ name: fs.name, icon: fs.icon }))
    if (uncategorized) groups.push({ name: uncategorized.name, icon: uncategorized.icon })
    emit('groups-changed', groups)
  },
  { immediate: true },
)

onMounted(async () => {
  await loadFieldSets()
  await activateFieldSetsForVisitType(props.visit)
  // Read/edit parity: also show groups the visit type doesn't list but that
  // carry data on this visit (e.g. Vital Signs on a Stroke-Lipid visit)
  activateFieldSetsWithData()
  if (visitQuestionnaires.value.length > 0) await ensureQuestionnaireFieldSetActive()
})
</script>

<style lang="scss" scoped>
.visit-card-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
  padding: 12px 16px 16px;
  background: $grey-1;
  border-radius: 0 0 8px 8px;
}

.editor-loading {
  grid-column: 1 / -1;
  text-align: center;
  padding: 24px;
}

.editor-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;

  // Denser panels without touching ObservationFieldSet itself — visually
  // aligned with the compact read view (VisitSummaryObservations) so the
  // jump between read and edit mode stays small
  :deep(.field-set-section) {
    border-radius: 8px;
    box-shadow: none;
    border: 1px solid $grey-4;
  }

  :deep(.field-set-header) {
    padding: 8px 12px;
    background: white;
    border-bottom: 1px solid $grey-4;

    .field-set-title {
      font-size: 1rem;
      color: $primary;
    }
  }

  :deep(.field-set-content) {
    padding: 8px 12px;
  }

  // Table look of the compact view: grey header row, zebra rows, blue hover,
  // small type badges instead of large colored avatars
  :deep(.observations-table) {
    font-size: 0.9rem;

    thead th {
      background: $grey-2;
      font-weight: 600;
      color: $grey-8;
      border-bottom: 2px solid $grey-4;
      padding: 8px;
    }

    tbody td {
      padding: 6px 8px;
      border-bottom: 1px solid $grey-3;
    }

    tbody tr:nth-child(even) {
      background: $grey-1;
    }

    tbody tr:hover {
      background: $blue-1;
    }

    .type-cell .q-avatar {
      font-size: 22px !important;

      .q-icon {
        font-size: 13px !important;
      }
    }
  }
}

.editor-empty {
  text-align: center;
  padding: 24px 12px;
  background: white;
  border: 1px dashed $grey-4;
  border-radius: 8px;
}

.editor-sidebar {
  min-width: 0;

  .sidebar-sticky {
    position: sticky;
    top: 56px; // below the pinned visit header of the editing card
    background: white;
    border: 1px solid $grey-4;
    border-radius: 8px;
    padding: 8px;
    max-height: calc(100vh - 190px);
    overflow-y: auto;
  }

  .sidebar-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: $grey-8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 4px 6px;
  }

  .sidebar-item {
    padding: 2px 4px;
    min-height: 32px;

    &--inactive .sidebar-label {
      color: $grey-7;
    }
  }

  .sidebar-subtitle {
    font-size: 0.7rem;
    font-weight: 600;
    color: $grey-6;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 4px 4px;
  }

  .sidebar-filter {
    padding: 0 4px 4px;

    :deep(.q-field__control) {
      height: 30px;
    }

    :deep(.q-field__marginal) {
      height: 30px;
    }
  }

  .inactive-scroll {
    max-height: 220px;
    overflow-y: auto;
  }

  .sidebar-icon {
    min-width: 24px;
    padding-right: 4px;
  }

  .sidebar-label {
    font-size: 0.85rem;
  }

  .hidden-file-input {
    display: none;
  }
}

// Narrow: stack, field groups first
@media (max-width: 900px) {
  .visit-card-editor {
    grid-template-columns: 1fr;
  }

  .editor-sidebar {
    order: -1;

    .sidebar-sticky {
      position: static;
      max-height: none;
    }
  }
}
</style>
