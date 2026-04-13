<template>
  <div class="questionnaire-selector">
    <q-card flat bordered>
      <q-card-section>
        <!-- Header with count -->
        <div class="row items-center q-mb-md">
          <div class="text-h6">{{ $t('questionnaire.selectQuestionnaire') }}</div>
          <q-space />
          <q-chip v-if="!loading && questionnaires.length > 0" outline color="grey-7" size="sm" icon="quiz">
            {{ filteredQuestionnaires.length }}<span v-if="filterText" class="text-grey-5">&nbsp;/ {{ questionnaires.length }}</span>
          </q-chip>
        </div>

        <!-- Search / Filter -->
        <q-input
          v-if="questionnaires.length > 0"
          v-model="filterText"
          outlined
          dense
          clearable
          placeholder="Filter..."
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="search" color="grey-5" />
          </template>
        </q-input>

        <!-- Loading State -->
        <div v-if="loading" class="text-center q-pa-lg">
          <q-spinner-dots size="50px" color="primary" />
          <div class="text-body2 q-mt-md text-grey-6">{{ $t('questionnaire.loadingQuestionnaires') }}</div>
        </div>

        <!-- Error State -->
        <q-banner v-else-if="error" class="bg-red-1 text-red q-mb-md" rounded>
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          {{ error }}
          <template v-slot:action>
            <q-btn flat color="red" :label="$t('common.retry')" @click="loadQuestionnaires" />
          </template>
        </q-banner>

        <!-- Empty State -->
        <div v-else-if="!questionnaires || questionnaires.length === 0" class="text-center q-pa-lg">
          <q-icon name="quiz" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">{{ $t('questionnaire.noQuestionnairesAvailable') }}</div>
          <div class="text-body2 text-grey-5">{{ $t('questionnaire.noQuestionnairesLoaded') }}</div>
          <q-btn color="primary" :label="$t('common.refresh')" @click="loadQuestionnaires" class="q-mt-md" />
        </div>

        <!-- No filter results -->
        <div v-else-if="filteredQuestionnaires.length === 0" class="text-center q-pa-lg">
          <q-icon name="search_off" size="48px" color="grey-4" />
          <div class="text-body1 text-grey-6 q-mt-sm">Keine Treffer für "{{ filterText }}"</div>
        </div>

        <!-- Questionnaire List -->
        <template v-else>
          <!-- Pinned section -->
          <div v-if="pinnedItems.length > 0" class="q-mb-sm">
            <div class="text-caption text-grey-5 text-weight-medium q-mb-xs q-pl-sm">ANGEPINNT</div>
            <q-list bordered separator class="rounded-borders">
              <q-item
                v-for="questionnaire in pinnedItems"
                :key="'pin-' + questionnaire.code"
                clickable
                v-ripple
                @click="selectQuestionnaire(questionnaire.code)"
                :data-cy="`questionnaire-${questionnaire.code}`"
                class="quest-item quest-item--pinned"
              >
                <q-item-section avatar>
                  <q-avatar color="primary" text-color="white" icon="quiz" size="40px" />
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ questionnaire.title }}</q-item-label>
                  <q-item-label caption class="text-grey-6 ellipsis-2-lines">{{ questionnaire.description }}</q-item-label>
                </q-item-section>

                <q-item-section side>
                  <div class="row items-center no-wrap q-gutter-xs">
                    <q-btn flat round dense size="sm" icon="push_pin" color="primary" @click.stop="togglePin(questionnaire.code)">
                      <q-tooltip>Loslösen</q-tooltip>
                    </q-btn>
                    <q-icon name="arrow_forward_ios" color="grey-4" size="16px" />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Unpinned section -->
          <div v-if="unpinnedItems.length > 0">
            <div v-if="pinnedItems.length > 0" class="text-caption text-grey-5 text-weight-medium q-mb-xs q-pl-sm">ALLE</div>
            <q-list bordered separator class="rounded-borders">
              <q-item
                v-for="questionnaire in unpinnedItems"
                :key="questionnaire.code"
                clickable
                v-ripple
                @click="selectQuestionnaire(questionnaire.code)"
                :data-cy="`questionnaire-${questionnaire.code}`"
                class="quest-item"
              >
                <q-item-section avatar>
                  <q-avatar color="grey-3" text-color="grey-7" icon="quiz" size="40px" />
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ questionnaire.title }}</q-item-label>
                  <q-item-label caption class="text-grey-6 ellipsis-2-lines">{{ questionnaire.description }}</q-item-label>
                </q-item-section>

                <q-item-section side>
                  <div class="row items-center no-wrap q-gutter-xs">
                    <q-btn flat round dense size="sm" icon="push_pin" color="grey-4" @click.stop="togglePin(questionnaire.code)">
                      <q-tooltip>Anpinnen</q-tooltip>
                    </q-btn>
                    <q-icon name="arrow_forward_ios" color="grey-4" size="16px" />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </template>

        <!-- Refresh Button -->
        <div v-if="questionnaires && questionnaires.length > 0" class="text-center q-mt-md">
          <q-btn flat color="grey-7" icon="refresh" label="Aktualisieren" @click="loadQuestionnaires" :loading="loading" size="sm" />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuestionnaireStore } from '../../stores/questionnaire-store.js'
import { logger } from '../../core/services/logging-service.js'

const PINNED_STORAGE_KEY = 'questionnaire-pinned'

const emit = defineEmits(['questionnaire-selected'])

// Store
const questionnaireStore = useQuestionnaireStore()

// State
const loading = ref(false)
const error = ref(null)
const questionnaires = ref([])
const filterText = ref('')
const pinnedCodes = ref(loadPinnedCodes())

// Computed
const filteredQuestionnaires = computed(() => {
  if (!filterText.value) return questionnaires.value
  const term = filterText.value.toLowerCase()
  return questionnaires.value.filter(
    (q) =>
      q.title?.toLowerCase().includes(term) ||
      q.description?.toLowerCase().includes(term) ||
      q.code?.toLowerCase().includes(term) ||
      q.shortTitle?.toLowerCase().includes(term),
  )
})

const pinnedItems = computed(() => {
  return filteredQuestionnaires.value.filter((q) => pinnedCodes.value.has(q.code))
})

const unpinnedItems = computed(() => {
  return filteredQuestionnaires.value.filter((q) => !pinnedCodes.value.has(q.code))
})

// Methods
function loadPinnedCodes() {
  try {
    const stored = localStorage.getItem(PINNED_STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function savePinnedCodes() {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...pinnedCodes.value]))
}

const togglePin = (code) => {
  if (pinnedCodes.value.has(code)) {
    pinnedCodes.value.delete(code)
  } else {
    pinnedCodes.value.add(code)
  }
  // Trigger reactivity
  pinnedCodes.value = new Set(pinnedCodes.value)
  savePinnedCodes()
}

const loadQuestionnaires = async () => {
  loading.value = true
  error.value = null

  try {
    await questionnaireStore.loadQuestionnaires()
    questionnaires.value = questionnaireStore.questionnaireList
    logger.info(`Loaded ${questionnaires.value.length} questionnaires`)
  } catch (err) {
    error.value = `Failed to load questionnaires: ${err.message}`
    logger.error('Error loading questionnaires in selector', err)
  } finally {
    loading.value = false
  }
}

const selectQuestionnaire = (code) => {
  const success = questionnaireStore.setActiveQuestionnaire(code)
  if (success) {
    emit('questionnaire-selected', {
      code,
      questionnaire: questionnaireStore.activeQuestionnaire,
    })
    logger.info(`Selected questionnaire: ${code}`)
  } else {
    error.value = `Failed to load questionnaire: ${code}`
  }
}

// Lifecycle
onMounted(() => {
  loadQuestionnaires()
})
</script>

<style scoped>
.questionnaire-selector {
  max-width: 640px;
  margin: 0 auto;
}

.quest-item {
  min-height: 72px;
  transition: background-color 0.15s ease;
}

.quest-item:hover {
  background-color: rgba(37, 99, 235, 0.04);
}

.quest-item--pinned {
  background-color: rgba(37, 99, 235, 0.02);
}

.ellipsis-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .questionnaire-selector {
    margin: 0;
  }

  .q-card {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}
</style>
