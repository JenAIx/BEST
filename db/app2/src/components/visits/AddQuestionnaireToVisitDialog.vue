<template>
  <AppDialog v-model="showDialog" title="Fragebogen zur Visite hinzufügen" size="md" persistent @close="onClose">
    <template #header>
      <div class="text-h6">
        <q-icon name="quiz" class="q-mr-sm" color="primary" />
        Fragebogen zur Visite hinzufügen
      </div>
      <div class="text-caption text-grey-6 q-mt-xs">
        Wählen Sie einen Fragebogen aus, der dieser Visite hinzugefügt werden soll
      </div>
    </template>

    <!-- Search -->
    <div class="search-section q-mb-md">
      <q-input v-model="searchTerm" placeholder="Fragebogen suchen..." outlined dense clearable>
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner-dots size="40px" color="primary" />
      <div class="text-body2 q-mt-md text-grey-6">Fragebögen werden geladen...</div>
    </div>

    <template v-else>
      <!-- Suggested Questionnaires -->
      <div v-if="suggestedQuestionnaires.length > 0 && !searchTerm" class="q-mb-md">
        <div class="text-caption text-weight-bold text-purple q-mb-xs q-px-sm">
          <q-icon name="star" size="14px" class="q-mr-xs" />
          Empfohlen für diesen Visitentyp
        </div>
        <q-list bordered separator class="questionnaire-list suggested-list">
          <q-item
            v-for="q in suggestedQuestionnaires"
            :key="'suggested-' + q.code"
            clickable
            v-ripple
            @click="selectQuestionnaire(q)"
            :class="{ 'already-added': isAlreadyAdded(q.code) }"
          >
            <q-item-section avatar>
              <q-avatar :color="isAlreadyAdded(q.code) ? 'grey-4' : 'deep-purple'" text-color="white" icon="quiz" />
            </q-item-section>

            <q-item-section>
              <q-item-label class="text-weight-medium">
                {{ q.title }}
                <q-chip size="xs" color="purple-1" text-color="purple" dense class="q-ml-sm">Empfohlen</q-chip>
              </q-item-label>
              <q-item-label caption class="text-grey-6">{{ q.description }}</q-item-label>
              <q-item-label caption class="text-grey-5">Code: {{ q.code }}</q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-chip v-if="isAlreadyAdded(q.code)" size="sm" color="grey-4" text-color="grey-7" icon="check">
                Bereits hinzugefügt
              </q-chip>
              <q-icon v-else name="add_circle" color="deep-purple" size="24px" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Separator -->
      <div v-if="suggestedQuestionnaires.length > 0 && !searchTerm && remainingQuestionnaires.length > 0" class="text-caption text-grey-6 q-mb-xs q-px-sm">
        Alle Fragebögen
      </div>

      <!-- Remaining / All Questionnaires -->
      <div v-if="displayedQuestionnaires.length > 0" class="questionnaire-list">
        <q-list bordered separator>
          <q-item
            v-for="q in displayedQuestionnaires"
            :key="q.code"
            clickable
            v-ripple
            @click="selectQuestionnaire(q)"
            :class="{ 'already-added': isAlreadyAdded(q.code) }"
          >
            <q-item-section avatar>
              <q-avatar :color="isAlreadyAdded(q.code) ? 'grey-4' : 'purple'" text-color="white" icon="quiz" />
            </q-item-section>

            <q-item-section>
              <q-item-label class="text-weight-medium">{{ q.title }}</q-item-label>
              <q-item-label caption class="text-grey-6">{{ q.description }}</q-item-label>
              <q-item-label caption class="text-grey-5">Code: {{ q.code }}</q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-chip v-if="isAlreadyAdded(q.code)" size="sm" color="grey-4" text-color="grey-7" icon="check">
                Bereits hinzugefügt
              </q-chip>
              <q-icon v-else name="add_circle" color="primary" size="24px" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Empty State -->
      <div v-if="filteredQuestionnaires.length === 0" class="text-center q-pa-lg">
        <q-icon name="quiz" size="48px" color="grey-4" />
        <div class="text-body1 text-grey-6 q-mt-md">Keine Fragebögen gefunden</div>
      </div>
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useQuestionnaireStore } from 'src/stores/questionnaire-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from 'src/components/shared/AppDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  existingQuestionnaireCodes: {
    type: Array,
    default: () => [],
  },
  visitTypeCode: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'questionnaire-selected'])

const $q = useQuasar()
const questionnaireStore = useQuestionnaireStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('AddQuestionnaireToVisitDialog')

// State
const loading = ref(false)
const searchTerm = ref('')
const suggestedCodes = ref([])

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const filteredQuestionnaires = computed(() => {
  const list = questionnaireStore.questionnaireList
  if (!searchTerm.value) return list

  const term = searchTerm.value.toLowerCase()
  return list.filter(
    (q) =>
      q.title?.toLowerCase().includes(term) ||
      q.description?.toLowerCase().includes(term) ||
      q.code?.toLowerCase().includes(term),
  )
})

const suggestedQuestionnaires = computed(() => {
  if (!suggestedCodes.value.length) return []
  return questionnaireStore.questionnaireList.filter((q) => suggestedCodes.value.includes(q.code))
})

const remainingQuestionnaires = computed(() => {
  if (!suggestedCodes.value.length) return questionnaireStore.questionnaireList
  const suggestedSet = new Set(suggestedCodes.value)
  return questionnaireStore.questionnaireList.filter((q) => !suggestedSet.has(q.code))
})

const displayedQuestionnaires = computed(() => {
  if (searchTerm.value) return filteredQuestionnaires.value
  return remainingQuestionnaires.value
})

// Methods
const isAlreadyAdded = (code) => {
  return props.existingQuestionnaireCodes.includes(code)
}

const selectQuestionnaire = (q) => {
  if (isAlreadyAdded(q.code)) {
    $q.notify({
      type: 'warning',
      message: `"${q.title}" ist bereits in dieser Visite vorhanden`,
      position: 'top',
      timeout: 2000,
    })
    return
  }

  logger.info('Questionnaire selected for visit', { code: q.code, title: q.title })
  emit('questionnaire-selected', q)
  showDialog.value = false
}

const onClose = () => {
  searchTerm.value = ''
  showDialog.value = false
}

const loadQuestionnaires = async () => {
  if (questionnaireStore.questionnaireList.length > 0) return

  loading.value = true
  try {
    await questionnaireStore.loadQuestionnaires()
    logger.info('Questionnaires loaded', { count: questionnaireStore.questionnaireList.length })
  } catch (error) {
    logger.error('Failed to load questionnaires', error)
    $q.notify({ type: 'negative', message: 'Fragebögen konnten nicht geladen werden', position: 'top' })
  } finally {
    loading.value = false
  }
}

// Load when dialog opens
watch(showDialog, async (val) => {
  if (val) {
    loadQuestionnaires()
    searchTerm.value = ''
    if (props.visitTypeCode) {
      suggestedCodes.value = await globalSettingsStore.getSuggestedQuestionnairesForVisitType(props.visitTypeCode)
      logger.debug('Loaded suggested questionnaires', { visitType: props.visitTypeCode, codes: suggestedCodes.value })
    } else {
      suggestedCodes.value = []
    }
  }
})
</script>

<style lang="scss" scoped>
.questionnaire-list {
  max-height: 400px;
  overflow-y: auto;

  .q-item {
    min-height: 72px;
    transition: all 0.2s ease;

    &:hover {
      background: rgba($primary, 0.05);
    }

    &.already-added {
      opacity: 0.6;
      background: $grey-1;
    }
  }
}

.suggested-list {
  max-height: 300px;
}

.search-section {
  position: sticky;
  top: 0;
  z-index: 1;
  background: white;
}
</style>
