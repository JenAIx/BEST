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
          <div class="sidebar-title row items-center">
            <span>{{ $t('visit.fieldGroups') }}</span>
            <q-space />
            <q-btn flat round dense size="sm" icon="edit_calendar" color="grey-7" data-cy="editor-edit-meta" @click="$emit('edit-meta')">
              <q-tooltip>{{ $t('visit.editVisit') }}</q-tooltip>
            </q-btn>
          </div>

          <q-list dense>
            <q-item v-for="fs in availableFieldSets" :key="fs.id" tag="label" dense class="sidebar-item">
              <q-item-section side>
                <q-checkbox dense size="sm" :model-value="activeFieldSets.includes(fs.id)" @update:model-value="toggleFieldSet(fs.id)" />
              </q-item-section>
              <q-item-section avatar class="sidebar-icon">
                <q-icon :name="fs.icon || 'category'" size="16px" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="ellipsis sidebar-label">{{ fs.name }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge v-if="countFor(fs.id) > 0" rounded color="primary" :label="countFor(fs.id)" />
              </q-item-section>
            </q-item>
          </q-list>

          <q-separator spaced />

          <q-btn outline color="primary" icon="add" class="full-width" no-caps :label="$t('observation.addObservation')" data-cy="editor-add-observation" @click="showAddCustomDialog = true" />
          <q-btn flat color="primary" icon="quiz" class="full-width q-mt-sm" no-caps :label="$t('visit.addQuestionnaire')" data-cy="editor-add-questionnaire" @click="showAddDialog = true" />
        </div>
      </aside>
    </template>

    <!-- Dialogs (teleported) -->
    <CustomObservationDialog v-model="showAddCustomDialog" :visit="visit" :patient="patient" field-set-name="Custom" field-set-id="custom" @questionnaire-added="onQuestionnaireAddedFromSearch" />

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
import { ref, computed, toRef, onMounted } from 'vue'
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

defineOptions({
  name: 'VisitCardEditor',
})

const props = defineProps({
  visit: { type: Object, required: true },
  patient: { type: Object, required: true },
})

defineEmits(['edit-meta'])

const observationStore = useObservationStore()
const visitRef = toRef(props, 'visit')
const patientRef = toRef(props, 'patient')

// Field groups (shared extraction from VisitDataEntry)
const { availableFieldSets, activeFieldSets, activeFieldSetsList, loadingFieldSets, loadFieldSets, activateFieldSetsForVisitType, toggleFieldSet, ensureQuestionnaireFieldSetActive, getFieldSetObservations, getFieldSetObservationCount } =
  useVisitFieldSets()

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

const onQuestionnaireAddedFromSearch = async (data) => {
  await onQuestionnaireSelected({ code: data.code, title: data.title, shortTitle: data.shortTitle })
}

onMounted(async () => {
  await loadFieldSets()
  await activateFieldSetsForVisitType(props.visit)
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

  // Denser panels without touching ObservationFieldSet itself
  :deep(.field-set-section) {
    border-radius: 8px;
    box-shadow: none;
    border: 1px solid $grey-4;
  }

  :deep(.field-set-header) {
    padding: 8px 12px;

    .field-set-title {
      font-size: 0.95rem;
    }
  }

  :deep(.field-set-content) {
    padding: 8px 12px;
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
    top: 8px;
    background: white;
    border: 1px solid $grey-4;
    border-radius: 8px;
    padding: 8px;
    max-height: calc(100vh - 140px);
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
  }

  .sidebar-icon {
    min-width: 24px;
    padding-right: 4px;
  }

  .sidebar-label {
    font-size: 0.85rem;
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
