<template>
  <div class="question-input">
    <!-- Number Input -->
    <q-input
      v-if="item.type === 'number'"
      :model-value="modelValue"
      @update:model-value="emit('update:model-value', $event)"
      type="number"
      outlined
      dense
      :placeholder="getPlaceholder()"
      :data-cy="`input-number-${item.id}`"
    />

    <!-- Text Input -->
    <q-input
      v-else-if="item.type === 'text'"
      :model-value="modelValue"
      @update:model-value="emit('update:model-value', $event)"
      type="text"
      outlined
      dense
      :placeholder="getPlaceholder()"
      :data-cy="`input-text-${item.id}`"
    />

    <!-- Radio Options -->
    <q-option-group
      v-else-if="item.type === 'radio'"
      :model-value="modelValue"
      @update:model-value="emit('update:model-value', $event)"
      :options="radioOptions"
      color="primary"
      :data-cy="`input-radio-${item.id}`"
      class="q-mt-sm"
    />

    <!-- Checkbox Options -->
    <q-option-group
      v-else-if="item.type === 'checkbox'"
      :model-value="modelValue || []"
      @update:model-value="emit('update:model-value', $event)"
      :options="checkboxOptions"
      type="checkbox"
      color="primary"
      :data-cy="`input-checkbox-${item.id}`"
      class="q-mt-sm"
    />

    <!-- Slider -->
    <div v-else-if="item.type === 'slider'" class="slider-container">
      <q-slider
        :model-value="modelValue || item.min || 0"
        @update:model-value="emit('update:model-value', $event)"
        :min="item.min || 0"
        :max="item.max || 100"
        :step="item.step || 1"
        :label="true"
        color="primary"
        :data-cy="`input-slider-${item.id}`"
      />
      <div class="slider-labels row justify-between q-mt-xs text-caption">
        <span>{{ item.min || 0 }}</span>
        <span>{{ item.max || 100 }}</span>
      </div>
    </div>

    <!-- Date Input -->
    <q-input
      v-else-if="item.type === 'date'"
      :model-value="modelValue"
      @update:model-value="emit('update:model-value', $event)"
      outlined
      dense
      :data-cy="`input-date-${item.id}`"
    >
      <template v-slot:prepend>
        <q-icon name="event" class="cursor-pointer">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-date
              :model-value="modelValue"
              @update:model-value="emit('update:model-value', $event)"
              mask="DD.MM.YYYY"
            >
              <div class="row items-center justify-end">
                <q-btn v-close-popup label="Close" color="primary" flat />
              </div>
            </q-date>
          </q-popup-proxy>
        </q-icon>
      </template>
    </q-input>

    <!-- Date Year Only -->
    <q-input
      v-else-if="item.type === 'date_year'"
      :model-value="modelValue"
      @update:model-value="emit('update:model-value', $event)"
      type="number"
      outlined
      dense
      placeholder="YYYY"
      :min="1900"
      :max="new Date().getFullYear() + 10"
      :data-cy="`input-year-${item.id}`"
    />

    <!-- Time Input -->
    <q-input
      v-else-if="item.type === 'time'"
      :model-value="modelValue"
      @update:model-value="emit('update:model-value', $event)"
      outlined
      dense
      mask="##:##"
      placeholder="HH:MM"
      :data-cy="`input-time-${item.id}`"
    >
      <template v-slot:prepend>
        <q-icon name="access_time" class="cursor-pointer">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-time
              :model-value="modelValue"
              @update:model-value="emit('update:model-value', $event)"
              format24h
            >
              <div class="row items-center justify-end">
                <q-btn v-close-popup label="Close" color="primary" flat />
              </div>
            </q-time>
          </q-popup-proxy>
        </q-icon>
      </template>
    </q-input>

    <!-- Multiple Radio (Matrix questions) -->
    <div v-else-if="item.type === 'multiple_radio'" class="multiple-radio-container">
      <div v-if="item.options && item.options.questions && item.options.answers" class="multiple-radio-matrix">
        <div 
          v-for="(question, qIndex) in item.options.questions" 
          :key="`question-${qIndex}`"
          class="matrix-row q-mb-md"
        >
          <div class="matrix-question q-mb-sm text-weight-medium">
            {{ question.label || question.tag }}
          </div>
          <q-option-group
            :model-value="(modelValue && modelValue[qIndex]) || null"
            @update:model-value="updateMultipleRadio(qIndex, $event)"
            :options="item.options.answers"
            color="primary"
            :data-cy="`input-matrix-${item.id}-${qIndex}`"
            inline
          />
        </div>
      </div>
    </div>

    <!-- Image Display (read-only) -->
    <div v-else-if="item.type === 'image'" class="image-container">
      <div v-if="item.value && Array.isArray(item.value)">
        <img
          v-for="(img, imgIndex) in item.value"
          :key="`img-${imgIndex}`"
          :src="`img/${img}`"
          :alt="`Image ${imgIndex + 1}`"
          :style="`width: ${item.width || 300}px; max-width: 100%`"
          class="q-ma-sm"
        />
      </div>
    </div>

    <!-- Separator (display only) -->
    <div v-else-if="item.type === 'separator'" class="separator">
      <q-separator class="q-my-md" />
    </div>

    <!-- Textbox (display only) -->
    <div v-else-if="item.type === 'textbox'" class="textbox">
      <div class="text-body2 q-pa-md bg-blue-grey-1 rounded-borders">
        <span v-html="item.content || item.label"></span>
      </div>
    </div>

    <!-- Unsupported Type -->
    <div v-else class="unsupported-type">
      <q-banner class="bg-orange-1 text-orange-8">
        <template v-slot:avatar>
          <q-icon name="warning" />
        </template>
        Unsupported question type: {{ item.type }}
      </q-banner>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  modelValue: {
    type: [String, Number, Array, Boolean],
    default: null
  }
})

const emit = defineEmits(['update:model-value'])

// Computed properties for options
const radioOptions = computed(() => {
  if (!props.item.options) return []
  
  return props.item.options.map(option => ({
    label: option.label,
    value: option.value
  }))
})

const checkboxOptions = computed(() => {
  if (!props.item.options) return []
  
  return props.item.options.map(option => ({
    label: option.label,
    value: option.value
  }))
})

// Methods
const getPlaceholder = () => {
  if (props.item.placeholder) return props.item.placeholder
  if (props.item.type === 'number') return 'Enter a number'
  if (props.item.type === 'text') return 'Enter text'
  return ''
}

const updateMultipleRadio = (questionIndex, value) => {
  const currentValues = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  
  // Ensure array is large enough
  while (currentValues.length <= questionIndex) {
    currentValues.push(null)
  }
  
  currentValues[questionIndex] = value
  emit('update:model-value', currentValues)
}
</script>

<style scoped>
.question-input {
  width: 100%;
}

.slider-container {
  padding: 0 1rem;
}

.slider-labels {
  color: #666;
  font-size: 0.75rem;
}

.multiple-radio-container {
  width: 100%;
}

.multiple-radio-matrix {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
  background: #fafafa;
}

.matrix-row {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 1rem;
}

.matrix-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0 !important;
}

.matrix-question {
  color: #333;
}

.image-container img {
  display: block;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.separator {
  margin: 1rem 0;
}

.textbox {
  margin: 0.5rem 0;
}

.unsupported-type {
  margin: 0.5rem 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .multiple-radio-matrix {
    padding: 0.5rem;
  }
  
  .slider-container {
    padding: 0 0.5rem;
  }
}
</style>
