<template>
  <q-page class="feedback-page">
    <div class="page-container">
      <!-- Page Header -->
      <PageHeader :title="$t('feedback.title')" :subtitle="$t('feedback.subtitle')" />

      <div class="row q-col-gutter-lg">
        <!-- Feedback Form Card -->
        <div class="col-12 col-lg-6">
          <q-card class="feedback-form-card">
            <q-card-section>
              <div class="text-h6 text-grey-8 q-mb-md">
                <q-icon name="rate_review" size="24px" class="q-mr-sm" />
                {{ $t('feedback.giveFeedback') }}
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <q-form @submit="onSubmitFeedback" class="q-gutter-md">
                <!-- Title Field -->
                <q-input
                  v-model="feedbackForm.title"
                  :label="$t('feedback.titleLabel')"
                  :placeholder="$t('feedback.titlePlaceholder')"
                  outlined
                  clearable
                  :rules="[(val) => (val && val.trim().length > 0) || $t('feedback.titleRequired'), (val) => (val && val.length <= 100) || $t('feedback.titleMaxLength')]"
                >
                  <template v-slot:prepend>
                    <q-icon name="title" />
                  </template>
                </q-input>

                <!-- Description Field -->
                <q-input
                  v-model="feedbackForm.description"
                  :label="$t('feedback.descriptionLabel')"
                  :placeholder="$t('feedback.descriptionPlaceholder')"
                  type="textarea"
                  outlined
                  clearable
                  rows="4"
                  :rules="[(val) => (val && val.trim().length > 0) || $t('feedback.descriptionRequired'), (val) => (val && val.length <= 1000) || $t('feedback.descriptionMaxLength')]"
                >
                  <template v-slot:prepend>
                    <q-icon name="description" />
                  </template>
                </q-input>

                <!-- Rating Field -->
                <div class="q-mb-md">
                  <div class="text-body1 q-mb-sm">{{ $t('feedback.ratingLabel') }}</div>
                  <q-btn-toggle v-model="feedbackForm.rating" toggle-color="primary" :options="ratingOptions" spread no-caps unelevated class="rating-toggle" />
                  <div v-if="ratingError" class="text-negative q-mt-sm text-caption">
                    {{ $t('feedback.ratingRequired') }}
                  </div>
                </div>

                <!-- Submit Button -->
                <div class="row justify-end q-mt-lg">
                  <q-btn type="submit" :label="$t('feedback.submitFeedback')" color="primary" icon="send" :loading="feedbackStore.isLoading" :disable="!isFormValid" unelevated class="submit-btn" />
                </div>
              </q-form>
            </q-card-section>
          </q-card>
        </div>

        <!-- Statistics Card -->
        <div class="col-12 col-lg-6">
          <q-card class="statistics-card q-mb-md">
            <q-card-section>
              <div class="text-h6 text-grey-8 q-mb-md">
                <q-icon name="analytics" size="24px" class="q-mr-sm" />
                {{ $t('feedback.statistics') }}
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="row q-col-gutter-md">
                <div class="col-4">
                  <div class="stat-item">
                    <div class="text-h4 text-primary">{{ statistics.total }}</div>
                    <div class="text-caption text-grey-6">{{ $t('feedback.totalFeedback') }}</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="stat-item">
                    <div class="text-h4 text-positive">{{ statistics.positive }}</div>
                    <div class="text-caption text-grey-6">{{ $t('feedback.positiveFeedback') }}</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="stat-item">
                    <div class="text-h4 text-negative">{{ statistics.negative }}</div>
                    <div class="text-caption text-grey-6">{{ $t('feedback.negativeFeedback') }}</div>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Quick Info Card -->
          <q-card class="info-card">
            <q-card-section>
              <div class="text-h6 text-grey-8 q-mb-md">
                <q-icon name="info" size="24px" class="q-mr-sm" />
                {{ $t('feedback.info') }}
              </div>
              <div class="text-body2 text-grey-7">
                {{ $t('feedback.infoText') }}
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Recent Feedback Section -->
      <div class="row q-mt-lg">
        <div class="col-12">
          <q-card class="recent-feedback-card">
            <q-card-section>
              <div class="row items-center">
                <div class="col">
                  <div class="text-h6 text-grey-8">
                    <q-icon name="history" size="24px" class="q-mr-sm" />
                    {{ $t('feedback.recentFeedback') }}
                  </div>
                </div>
                <div class="col-auto">
                  <q-btn flat round icon="refresh" color="grey-7" @click="loadFeedbackData" :loading="feedbackStore.isLoading" size="sm">
                    <q-tooltip>{{ $t('common.refresh') }}</q-tooltip>
                  </q-btn>
                </div>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-pa-none">
              <!-- Loading State -->
              <div v-if="feedbackStore.isLoading && feedbackStore.recentFeedbacks.length === 0" class="q-pa-lg text-center">
                <q-spinner color="primary" size="32px" />
                <div class="q-mt-sm text-grey-6">{{ $t('feedback.loadingFeedback') }}</div>
              </div>

              <!-- Feedback List -->
              <div v-else-if="feedbackStore.recentFeedbacks.length > 0" class="row q-col-gutter-md q-pa-md">
                <div v-for="feedback in feedbackStore.recentFeedbacks" :key="feedback.id" class="col-12 col-md-6 col-lg-4">
                  <q-card class="feedback-item-card" bordered flat>
                    <q-card-section>
                      <div class="row items-start no-wrap">
                        <div class="col">
                          <div class="text-subtitle1 text-weight-medium q-mb-xs">
                            {{ feedback.title }}
                          </div>
                          <div class="text-body2 text-grey-7 q-mb-sm feedback-description">
                            {{ feedback.description }}
                          </div>
                        </div>
                        <div class="col-auto q-ml-md">
                          <q-icon :name="feedback.rating === 'thumbs_up' ? 'thumb_up' : 'thumb_down'" :color="feedback.rating === 'thumbs_up' ? 'positive' : 'negative'" size="20px" />
                        </div>
                      </div>
                    </q-card-section>

                    <q-separator />

                    <q-card-section class="q-py-sm">
                      <div class="row items-center justify-between">
                        <div class="col">
                          <div class="text-caption text-grey-6">
                            {{ formatDate(feedback.createdAt) }}
                          </div>
                        </div>
                        <div v-if="isAdmin" class="col-auto">
                          <q-btn flat round icon="delete" size="sm" color="negative" @click="confirmDeleteFeedback(feedback)">
                            <q-tooltip>{{ $t('feedback.deleteFeedback') }}</q-tooltip>
                          </q-btn>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="q-pa-lg text-center text-grey-6">
                <q-icon name="feedback" size="48px" class="q-mb-sm" />
                <div>{{ $t('feedback.noFeedback') }}</div>
                <div class="text-caption">{{ $t('feedback.noFeedbackHint') }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="showDeleteDialog" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ $t('feedback.deleteFeedbackTitle') }}</div>
        </q-card-section>

        <q-card-section>
          <div class="text-body1">
            {{ $t('feedback.deleteFeedbackMessage') }}
            <strong>"{{ feedbackToDelete?.title }}"</strong>?
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" color="primary" v-close-popup />
          <q-btn :label="$t('common.delete')" color="negative" @click="deleteFeedback" :loading="feedbackStore.isLoading" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedbackStore } from 'src/stores/feedback-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useNotify } from 'src/composables/useNotify'
import PageHeader from 'src/components/shared/PageHeader.vue'

const notify = useNotify()
const { t } = useI18n()
const feedbackStore = useFeedbackStore()
const authStore = useAuthStore()

// Auth state
const isAdmin = computed(() => authStore.isAdmin)

// Form data
const feedbackForm = reactive({
  title: '',
  description: '',
  rating: null,
})

// Form validation
const ratingError = ref(false)

const isFormValid = computed(() => {
  return feedbackForm.title?.trim().length > 0 && feedbackForm.description?.trim().length > 0 && feedbackForm.rating !== null
})

// Rating options
const ratingOptions = computed(() => [
  {
    label: t('feedback.thumbsUp'),
    value: 'thumbs_up',
    icon: 'thumb_up',
  },
  {
    label: t('feedback.thumbsDown'),
    value: 'thumbs_down',
    icon: 'thumb_down',
  },
])

// Statistics
const statistics = ref({
  total: 0,
  positive: 0,
  negative: 0,
})

// Delete dialog
const showDeleteDialog = ref(false)
const feedbackToDelete = ref(null)

// Methods
const onSubmitFeedback = async () => {
  try {
    ratingError.value = false

    // Validate form
    if (!feedbackForm.rating) {
      ratingError.value = true
      return
    }

    // Submit feedback
    await feedbackStore.createFeedback({
      title: feedbackForm.title.trim(),
      description: feedbackForm.description.trim(),
      rating: feedbackForm.rating,
    })

    notify.success(t('feedback.feedbackSubmitted'))

    // Reset form
    feedbackForm.title = ''
    feedbackForm.description = ''
    feedbackForm.rating = null

    // Reload statistics
    await loadStatistics()
  } catch (error) {
    console.error('Failed to submit feedback:', error)
    notify.error(t('feedback.feedbackError'), { timeout: 5000 })
  }
}

const confirmDeleteFeedback = (feedback) => {
  feedbackToDelete.value = feedback
  showDeleteDialog.value = true
}

const deleteFeedback = async () => {
  try {
    if (!feedbackToDelete.value) return

    await feedbackStore.deleteFeedback(feedbackToDelete.value.id)

    notify.success(t('feedback.feedbackDeleted'))

    showDeleteDialog.value = false
    feedbackToDelete.value = null

    // Reload statistics
    await loadStatistics()
  } catch (error) {
    console.error('Failed to delete feedback:', error)
    notify.error(t('feedback.deleteError'), { timeout: 5000 })
  }
}

const loadFeedbackData = async () => {
  try {
    await Promise.all([feedbackStore.loadFeedbacks(), loadStatistics()])
  } catch (error) {
    console.error('Failed to load feedback data:', error)
    notify.error(t('feedback.loadError'), { timeout: 5000 })
  }
}

const loadStatistics = async () => {
  try {
    const stats = await feedbackStore.getFeedbackStatistics()
    statistics.value = stats
  } catch (error) {
    console.error('Failed to load statistics:', error)
    statistics.value = { total: 0, positive: 0, negative: 0 }
  }
}

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return t('common.unknown')
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (error) {
    console.error('Error formatting date:', error)
    return t('common.unknown')
  }
}

// Initialize
onMounted(async () => {
  await loadFeedbackData()
})
</script>

<style lang="scss" scoped>
.feedback-form-card {
  .rating-toggle {
    width: 100%;

    :deep(.q-btn) {
      flex: 1;
      border-radius: 8px;
      padding: 12px;

      &.q-btn--active {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
    }
  }

  .submit-btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
  }
}

.stat-item {
  text-align: center;
  padding: 16px 8px;
  background-color: $grey-1;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.recent-feedback-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.feedback-item-card {
  transition: all 0.2s ease;
  border-radius: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .feedback-description {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
  }
}

// Animation for new feedback cards
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feedback-item-card {
  animation: slideInUp 0.3s ease-out;
}
</style>
