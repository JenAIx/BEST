<template>
  <q-card 
    class="dashboard-card" 
    :class="{ 'clickable': clickable }"
    @click="handleClick"
  >
    <q-card-section class="text-center card-content">
      <!-- Icon -->
      <q-icon 
        :name="icon" 
        :size="iconSize" 
        :color="iconColor" 
        class="card-icon"
      />
      
      <!-- Title -->
      <div class="text-h6 q-mt-sm card-title">{{ title }}</div>
      
      <!-- Subtitle/Description -->
      <div class="text-caption text-grey-6 q-mt-xs card-subtitle">
        {{ subtitle }}
      </div>
      
      <!-- Optional Value Display (for stats cards) -->
      <div v-if="value !== undefined" class="text-h3 q-mt-sm" :class="valueColor">
        {{ value }}
      </div>
      
      <!-- Optional Value Label -->
      <div v-if="valueLabel" class="text-caption text-grey-6 q-mt-xs">
        {{ valueLabel }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  icon: {
    type: String,
    required: true
  },
  iconSize: {
    type: String,
    default: '48px'
  },
  iconColor: {
    type: String,
    default: 'primary'
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  value: {
    type: [String, Number],
    default: undefined
  },
  valueLabel: {
    type: String,
    default: ''
  },
  clickable: {
    type: Boolean,
    default: false
  },
  route: {
    type: String,
    default: ''
  },
  action: {
    type: Function,
    default: null
  }
})

// Emits
const emit = defineEmits(['click'])

// Computed
const valueColor = computed(() => {
  if (props.valueColor) return props.valueColor
  if (props.iconColor === 'positive') return 'text-positive'
  if (props.iconColor === 'warning') return 'text-warning'
  if (props.iconColor === 'negative') return 'text-negative'
  if (props.iconColor === 'info') return 'text-info'
  if (props.iconColor === 'accent') return 'text-accent'
  return 'text-primary'
})

// Methods
const handleClick = () => {
  if (!props.clickable) return
  
  emit('click')
  
  if (props.action) {
    props.action()
  }
}
</script>

<style lang="scss" scoped>
.dashboard-card {
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
  
  &.clickable {
    cursor: pointer;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }
  }
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
}

.card-icon {
  margin-bottom: 8px;
}

.card-title {
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 4px;
}

.card-subtitle {
  line-height: 1.3;
  opacity: 0.8;
}

// Ensure consistent height across all cards
:deep(.q-card__section) {
  height: 100%;
}
</style>
