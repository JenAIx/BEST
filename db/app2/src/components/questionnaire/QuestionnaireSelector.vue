<template>
  <div class="questionnaire-selector">
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6 q-mb-md">Select Questionnaire</div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center q-pa-lg">
          <q-spinner-dots size="50px" color="primary" />
          <div class="text-body2 q-mt-md text-grey-6">Loading questionnaires...</div>
        </div>

        <!-- Error State -->
        <q-banner v-else-if="error" class="bg-red-1 text-red q-mb-md">
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          {{ error }}
          <template v-slot:action>
            <q-btn flat color="red" label="Retry" @click="loadQuestionnaires" />
          </template>
        </q-banner>

        <!-- Empty State -->
        <div v-else-if="!questionnaires || questionnaires.length === 0" class="text-center q-pa-lg">
          <q-icon name="quiz" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No Questionnaires Available</div>
          <div class="text-body2 text-grey-5">No questionnaires have been loaded into the system yet.</div>
          <q-btn color="primary" label="Refresh" @click="loadQuestionnaires" class="q-mt-md" />
        </div>

        <!-- Questionnaire List -->
        <q-list v-else bordered separator>
          <q-item
            v-for="questionnaire in questionnaires"
            :key="questionnaire.code"
            clickable
            v-ripple
            @click="selectQuestionnaire(questionnaire.code)"
            :data-cy="`questionnaire-${questionnaire.code}`"
          >
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" icon="quiz" />
            </q-item-section>

            <q-item-section>
              <q-item-label class="text-weight-medium">{{ questionnaire.title }}</q-item-label>
              <q-item-label caption class="text-grey-6">
                {{ questionnaire.description }}
              </q-item-label>
              <q-item-label caption class="text-grey-5"> Code: {{ questionnaire.code }} </q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-icon name="arrow_forward_ios" color="grey-4" />
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Refresh Button -->
        <div v-if="questionnaires && questionnaires.length > 0" class="text-center q-mt-md">
          <q-btn flat color="primary" icon="refresh" label="Refresh List" @click="loadQuestionnaires" :loading="loading" />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuestionnaireStore } from '../../stores/questionnaire-store.js'
import { logger } from '../../core/services/logging-service.js'

const emit = defineEmits(['questionnaire-selected'])

// Store
const questionnaireStore = useQuestionnaireStore()

// State
const loading = ref(false)
const error = ref(null)

// Computed
const questionnaires = ref([])

// Methods
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
  max-width: 600px;
  margin: 0 auto;
}

.q-item {
  min-height: 80px;
}

.q-item:hover {
  background-color: #f5f5f5;
}

.q-avatar {
  font-size: 1.2rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
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
