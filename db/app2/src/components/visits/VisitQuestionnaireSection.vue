<template>
  <div v-if="visit" class="field-set-section">
    <!-- Collapsible Header (matching ObservationFieldSet pattern) -->
    <div class="field-set-header cursor-pointer" @click="collapsed = !collapsed">
      <div class="field-set-title">
        <q-icon :name="fieldSet?.icon || 'quiz'" size="24px" class="q-mr-sm" />
        {{ fieldSet?.name || 'Fragebögen' }}
        <!-- Observation counts -->
        <div v-if="questionnaires.length > 0" class="observation-badges q-ml-sm">
          <q-badge :label="completedCount" :color="allComplete ? 'positive' : 'warning'" class="observation-count-badge" :title="`${completedCount} abgeschlossen / ${questionnaires.length} gesamt`" />
          <q-badge v-if="incompleteCount > 0" :label="incompleteCount" color="amber-6" class="observation-count-badge unfilled-badge" :title="`${incompleteCount} ausstehend`" />
        </div>
      </div>
      <q-icon name="expand_more" size="20px" class="expand-icon" :class="{ 'rotate-180': !collapsed }" />
    </div>

    <q-slide-transition>
      <div v-show="!collapsed" class="field-set-content">
        <!-- Questionnaire Cards -->
        <div v-if="questionnaires.length > 0" class="questionnaire-cards">
          <q-card
            v-for="q in questionnaires"
            :key="q.observationId"
            flat
            bordered
            class="questionnaire-card cursor-pointer q-mb-sm"
            :class="statusClass(q)"
            @click="onQuestionnaireClick(q)"
          >
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <q-icon
                  :name="q.isCompleted ? 'check_circle' : 'pending'"
                  :color="q.isCompleted ? 'positive' : 'warning'"
                  size="24px"
                  class="q-mr-sm"
                />
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ q.title }}</div>
                  <div class="text-caption text-grey-6">
                    {{ q.shortTitle || q.questionnaireCode }}
                    <span v-if="q.isCompleted && q.score !== null" class="q-ml-sm text-weight-medium">
                      Score: {{ q.score }}
                    </span>
                  </div>
                </div>
                <q-chip
                  :color="q.isCompleted ? 'positive' : 'amber-6'"
                  text-color="white"
                  size="sm"
                  dense
                  :icon="q.isCompleted ? 'lock' : 'edit'"
                >
                  {{ q.isCompleted ? 'Abgeschlossen' : 'Ausfüllen' }}
                </q-chip>
                <!-- Delete button: visible on card hover -->
                <div class="remove-button-container q-ml-xs" @click.stop>
                  <AppRemoveConfirmationButton :loading="q._deleting" @remove-confirmed="onRemoveQuestionnaire(q)" @remove-cancelled="() => {}" />
                </div>
              </div>

              <q-linear-progress
                v-if="!q.isCompleted && q.progress !== null"
                :value="q.progress"
                :color="q.progress < 0.5 ? 'negative' : q.progress < 1 ? 'warning' : 'positive'"
                class="q-mt-xs"
                rounded
                size="4px"
              />
            </q-card-section>
          </q-card>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-observations">
          <q-icon name="quiz" size="48px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-sm">Noch keine Fragebögen</div>
          <div class="text-body2 text-grey-5">Fügen Sie einen Fragebogen hinzu</div>
        </div>

        <!-- Add Questionnaire Button -->
        <div class="add-questionnaire-section q-mt-sm">
          <q-btn flat icon="add" label="Fragebogen hinzufügen" color="purple" size="sm" class="full-width add-questionnaire-btn" @click.stop="emit('add-questionnaire')" />
        </div>
      </div>
    </q-slide-transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppRemoveConfirmationButton from 'src/components/shared/AppRemoveConfirmationButton.vue'

const props = defineProps({
  visit: {
    type: Object,
    default: null,
  },
  patient: {
    type: Object,
    default: null,
  },
  fieldSet: {
    type: Object,
    default: () => ({ icon: 'quiz', name: 'Fragebögen' }),
  },
  questionnaires: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['add-questionnaire', 'fill-questionnaire', 'view-questionnaire', 'remove-questionnaire'])

// State
const collapsed = ref(false)

// Computed
const completedCount = computed(() => props.questionnaires.filter((q) => q.isCompleted).length)
const incompleteCount = computed(() => props.questionnaires.filter((q) => !q.isCompleted).length)
const allComplete = computed(() => props.questionnaires.length > 0 && completedCount.value === props.questionnaires.length)

// Methods
const statusClass = (q) => ({
  'status-complete': q.isCompleted,
  'status-incomplete': !q.isCompleted,
})

const onQuestionnaireClick = (q) => {
  if (q.isCompleted) {
    emit('view-questionnaire', q)
  } else {
    emit('fill-questionnaire', q)
  }
}

const onRemoveQuestionnaire = (q) => {
  emit('remove-questionnaire', q)
}
</script>

<style lang="scss" scoped>
.field-set-section {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.field-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  user-select: none;

  &:hover {
    .expand-icon {
      color: $primary;
    }
  }
}

.field-set-title {
  display: flex;
  align-items: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: $grey-8;
}

.expand-icon {
  transition: transform 0.3s ease, color 0.2s ease;
  color: $grey-6;
}

.rotate-180 {
  transform: rotate(180deg);
}

.observation-badges {
  display: flex;
  gap: 4px;
}

.observation-count-badge {
  font-size: 0.75rem;
  min-width: 20px;
  text-align: center;
}

.field-set-content {
  padding-top: 0.5rem;
}

.questionnaire-card {
  border-radius: 8px;
  transition: all 0.2s ease;

  .remove-button-container {
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .remove-button-container {
      opacity: 1;
    }
  }

  &.status-incomplete {
    border-left: 3px solid $amber-6;
    background: rgba($amber-1, 0.3);
  }

  &.status-complete {
    border-left: 3px solid $positive;
    background: rgba($positive, 0.03);
  }
}

.empty-observations {
  text-align: center;
  padding: 2rem 1rem;
}

.add-questionnaire-section {
  .add-questionnaire-btn {
    border: 2px dashed $grey-4;
    border-radius: 8px;
    transition: all 0.2s ease;

    &:hover {
      border-color: $purple;
      background: rgba($purple, 0.05);
    }
  }
}
</style>
