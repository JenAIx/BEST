<template>
  <q-card :class="cardClasses" flat @click="selectPatient">
    <q-card-section class="patient-card-content">
      <q-avatar :size="variant === 'recent' ? '40px' : '36px'" :color="variant === 'recent' ? 'primary' : 'secondary'" text-color="white">
        {{ patientInitials }}
      </q-avatar>
      <div class="patient-info">
        <div class="patient-name">{{ patient.name }}</div>
        <div class="patient-id">{{ patient.id }}</div>
        <div class="patient-meta">
          <template v-if="variant === 'recent'">
            <q-icon name="event" size="12px" class="q-mr-xs" />
            {{ patient.lastVisit || 'No visits' }}
          </template>
          <template v-else>
            <span v-if="patient.age">Age: {{ patient.age }}</span>
            <span v-if="patient.age && patient.visitCount > 0"> • </span>
            <span v-if="patient.visitCount > 0">{{ patient.visitCount }} visits</span>
            <span v-if="!patient.age && patient.visitCount === 0">No additional info</span>
          </template>
        </div>
      </div>
      <q-icon name="chevron_right" :color="variant === 'recent' ? 'white' : 'grey-5'" />
    </q-card-section>

    <!-- Hover overlay for recent patients -->
    <div v-if="variant === 'recent'" class="hover-overlay"></div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
  variant: {
    type: String,
    default: 'search', // 'recent' or 'search'
    validator: (value) => ['recent', 'search'].includes(value),
  },
})

const emit = defineEmits(['select'])

// Computed
const patientInitials = computed(() => {
  return props.patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const cardClasses = computed(() => {
  return [
    'patient-card',
    `patient-card--${props.variant}`,
    {
      'patient-card--recent': props.variant === 'recent',
      'patient-card--search': props.variant === 'search',
    },
  ]
})

// Methods
const selectPatient = () => {
  emit('select', props.patient)
}
</script>

<style lang="scss" scoped>
.patient-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  &--recent {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    .patient-info {
      color: white;
    }

    .patient-meta {
      color: rgba(255, 255, 255, 0.8);
    }

    &:hover .hover-overlay {
      opacity: 1;
    }
  }

  &--search {
    background: white;
    border: 1px solid $grey-3;

    &:hover {
      border-color: $primary;
      box-shadow: 0 4px 16px rgba($primary, 0.15);
    }
  }
}

.patient-card-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  position: relative;
  z-index: 2;
}

.patient-info {
  flex: 1;

  .patient-name {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
    line-height: 1.2;
  }

  .patient-id {
    font-size: 0.875rem;
    opacity: 0.8;
    margin-bottom: 0.25rem;
    font-family: 'Roboto Mono', monospace;
  }

  .patient-meta {
    font-size: 0.75rem;
    opacity: 0.7;
    display: flex;
    align-items: center;
    line-height: 1.3;
  }
}

.hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

// Animation for card appearance
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.patient-card {
  animation: fadeInUp 0.5s ease-out;
}

// Stagger animation for multiple cards
.patient-card:nth-child(1) {
  animation-delay: 0.1s;
}

.patient-card:nth-child(2) {
  animation-delay: 0.2s;
}

.patient-card:nth-child(3) {
  animation-delay: 0.3s;
}

.patient-card:nth-child(4) {
  animation-delay: 0.4s;
}

.patient-card:nth-child(5) {
  animation-delay: 0.5s;
}
</style>
