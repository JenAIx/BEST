<template>
  <div class="timeline-item" :class="{ 'timeline-item--selected': isSelected }" @click="selectVisit">
    <div class="timeline-marker">
      <div class="timeline-dot" :class="statusClass"></div>
      <div v-if="!isLast" class="timeline-line"></div>
    </div>
    <div class="timeline-card">
      <q-card flat bordered class="visit-card">
        <q-card-section>
          <div class="visit-header">
            <div class="visit-date">
              <q-icon name="event" class="q-mr-xs" />
              {{ formattedDate }}
            </div>
            <div class="visit-actions">
              <q-btn flat round icon="visibility" size="sm" color="secondary" @click.stop="viewVisit">
                <q-tooltip>View Visit Summary</q-tooltip>
              </q-btn>
              <q-btn flat round icon="edit" size="sm" color="primary" @click.stop="editVisit">
                <q-tooltip>Edit Visit</q-tooltip>
              </q-btn>
              <q-btn flat round icon="more_vert" size="sm" color="grey-6" @click.stop>
                <q-menu>
                  <q-list>
                    <q-item clickable @click="duplicateVisit">
                      <q-item-section avatar>
                        <q-icon name="content_copy" />
                      </q-item-section>
                      <q-item-section>Clone Visit</q-item-section>
                    </q-item>
                    <q-separator />
                    <q-item clickable @click="deleteVisit">
                      <q-item-section avatar>
                        <q-icon name="delete" color="negative" />
                      </q-item-section>
                      <q-item-section>Delete Visit</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>

          <div class="visit-summary">
            <div class="visit-type">
              <q-icon :name="typeIcon" size="16px" class="q-mr-xs" />
              {{ visitTypeLabel }}
            </div>
            <div class="observation-count">
              <q-icon name="assignment" size="14px" class="q-mr-xs" />
              {{ visit.observationCount || 0 }} observations
            </div>
          </div>

          <div v-if="visit.notes" class="visit-notes">
            {{ visit.notes }}
          </div>

          <!-- Visit metadata -->
          <div class="visit-metadata">
            <div v-if="visit.location" class="metadata-item">
              <q-icon name="place" size="12px" class="q-mr-xs" />
              {{ visit.location }}
            </div>
            <div v-if="visit.endDate" class="metadata-item">
              <q-icon name="schedule" size="12px" class="q-mr-xs" />
              Duration: {{ visitDuration }}
            </div>
          </div>
        </q-card-section>

        <!-- Progress indicator for selected visit -->
        <div v-if="isSelected" class="selection-indicator"></div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visit: {
    type: Object,
    required: true,
  },
  isLast: {
    type: Boolean,
    default: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'edit', 'view', 'duplicate', 'delete'])

// Computed
const formattedDate = computed(() => {
  if (!props.visit.date) return 'Unknown'
  const date = new Date(props.visit.date)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})

const statusClass = computed(() => {
  switch (props.visit.status) {
    case 'active':
    case 'A':
      return 'status-active'
    case 'completed':
    case 'C':
      return 'status-completed'
    case 'cancelled':
    case 'X':
      return 'status-cancelled'
    default:
      return 'status-default'
  }
})

const visitTypeLabel = computed(() => {
  switch (props.visit.type) {
    case 'routine':
      return 'Routine Check-up'
    case 'followup':
      return 'Follow-up'
    case 'emergency':
      return 'Emergency'
    case 'consultation':
      return 'Consultation'
    case 'procedure':
      return 'Procedure'
    default:
      return 'General Visit'
  }
})

const typeIcon = computed(() => {
  switch (props.visit.type) {
    case 'routine':
      return 'health_and_safety'
    case 'followup':
      return 'follow_the_signs'
    case 'emergency':
      return 'emergency'
    case 'consultation':
      return 'psychology'
    case 'procedure':
      return 'medical_services'
    default:
      return 'local_hospital'
  }
})

const visitDuration = computed(() => {
  if (!props.visit.endDate || !props.visit.date) return null

  const start = new Date(props.visit.date)
  const end = new Date(props.visit.endDate)
  const diffHours = Math.abs(end - start) / (1000 * 60 * 60)

  if (diffHours < 1) {
    const diffMinutes = Math.round(diffHours * 60)
    return `${diffMinutes} min`
  } else if (diffHours < 24) {
    return `${Math.round(diffHours)} hours`
  } else {
    const diffDays = Math.round(diffHours / 24)
    return `${diffDays} days`
  }
})

// Methods
const selectVisit = () => {
  emit('select', props.visit)
}

const editVisit = () => {
  emit('edit', props.visit)
}

const viewVisit = () => {
  emit('view', props.visit)
}

const duplicateVisit = () => {
  emit('duplicate', props.visit)
}

const deleteVisit = () => {
  emit('delete', props.visit)
}
</script>

<style lang="scss" scoped>
.timeline-item {
  display: flex;
  margin-bottom: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &--selected {
    .timeline-card {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba($primary, 0.3);
    }
  }

  &:hover:not(&--selected) {
    .timeline-card {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
  }
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 1.5rem;

  .timeline-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;

    &.status-active {
      background: $positive;
      box-shadow: 0 0 0 4px rgba($positive, 0.2);
    }

    &.status-completed {
      background: $primary;
      box-shadow: 0 0 0 4px rgba($primary, 0.2);
    }

    &.status-cancelled {
      background: $negative;
      box-shadow: 0 0 0 4px rgba($negative, 0.2);
    }

    &.status-default {
      background: $grey-5;
      box-shadow: 0 0 0 4px rgba($grey-5, 0.2);
    }
  }

  .timeline-line {
    width: 2px;
    flex: 1;
    background: $grey-3;
    min-height: 2rem;
  }
}

.timeline-card {
  flex: 1;
  transition: all 0.3s ease;
  position: relative;
}

.visit-card {
  border-radius: 12px;
  border: 1px solid $grey-3;
  background: white;
  position: relative;
  overflow: hidden;
}

.visit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  .visit-date {
    font-weight: 600;
    color: $primary;
    display: flex;
    align-items: center;
    font-size: 0.95rem;
  }

  .visit-actions {
    display: flex;
    gap: 0.25rem;
  }
}

.visit-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;

  .visit-type {
    font-weight: 500;
    color: $grey-8;
    display: flex;
    align-items: center;
    font-size: 0.9rem;
  }

  .observation-count {
    font-size: 0.8rem;
    color: $grey-6;
    display: flex;
    align-items: center;
  }
}

.visit-notes {
  font-size: 0.875rem;
  color: $grey-7;
  line-height: 1.4;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: $grey-1;
  border-radius: 8px;
  border-left: 3px solid $primary;
}

.visit-metadata {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid $grey-2;

  .metadata-item {
    font-size: 0.75rem;
    color: $grey-6;
    display: flex;
    align-items: center;
  }
}

.selection-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(to bottom, $primary, $secondary);
  border-radius: 0 2px 2px 0;
}

// Animation for timeline items
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.timeline-item {
  animation: slideInRight 0.5s ease-out;
}

// Stagger animation for multiple items
.timeline-item:nth-child(1) {
  animation-delay: 0.1s;
}

.timeline-item:nth-child(2) {
  animation-delay: 0.2s;
}

.timeline-item:nth-child(3) {
  animation-delay: 0.3s;
}

.timeline-item:nth-child(4) {
  animation-delay: 0.4s;
}

.timeline-item:nth-child(5) {
  animation-delay: 0.5s;
}

@media (max-width: 768px) {
  .timeline-marker {
    margin-right: 1rem;
  }

  .visit-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .visit-metadata {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
