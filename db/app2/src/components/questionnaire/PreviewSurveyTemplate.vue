<template>
  <div v-if="questionnaire" class="preview-survey">
    <!-- Header -->
    <div class="survey-header q-mb-lg">
      <div class="text-h5 text-weight-bold q-mb-sm">{{ questionnaire.title }}</div>
      <div v-if="questionnaire.short_title" class="text-subtitle1 text-grey-7 q-mb-sm">
        Short Title: {{ questionnaire.short_title }}
      </div>
      <div v-if="questionnaire.description" class="text-body1 text-grey-8 q-mb-md">
        {{ questionnaire.description }}
      </div>
      
      <!-- Survey Info -->
      <div class="survey-info">
        <q-chip 
          v-if="questionnaire.items?.length"
          dense 
          color="primary" 
          text-color="white" 
          icon="quiz"
          class="q-mr-sm"
        >
          {{ questionnaire.items.length }} Questions
        </q-chip>
        <q-chip 
          v-if="questionnaire.results?.method"
          dense 
          color="secondary" 
          text-color="white" 
          icon="calculate"
          class="q-mr-sm"
        >
          Method: {{ questionnaire.results.method }}
        </q-chip>
        <q-chip 
          v-if="questionnaire.results?.max_score"
          dense 
          color="positive" 
          text-color="white" 
          icon="star"
        >
          Max Score: {{ questionnaire.results.max_score }}
        </q-chip>
      </div>
    </div>

    <!-- Manual/Instructions -->
    <div v-if="questionnaire.manual" class="survey-manual q-mb-lg">
      <q-card flat bordered class="bg-blue-1">
        <q-card-section>
          <div class="text-subtitle2 text-weight-medium q-mb-sm">
            <q-icon name="info" class="q-mr-sm" />
            Instructions
          </div>
          <div v-html="questionnaire.manual" class="text-body2"></div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Questions Preview -->
    <div class="survey-questions">
      <div class="text-h6 q-mb-md">Questions Preview</div>
      
      <q-list bordered separator class="rounded-borders">
        <q-item
          v-for="(item, index) in questionnaire.items"
          :key="`preview-item-${item.id || index}`"
          class="preview-question-item"
        >
          <q-item-section>
            <!-- Question Number and Label -->
            <q-item-label class="question-header">
              <div class="row items-start no-wrap">
                <div class="col-auto">
                  <q-badge 
                    color="grey-6" 
                    :label="index + 1" 
                    class="q-mr-sm question-number"
                  />
                </div>
                <div class="col">
                  <span v-html="item.label" class="text-weight-medium"></span>
                  <span v-if="item.force !== false" class="text-red q-ml-xs">*</span>
                </div>
              </div>
            </q-item-label>
            
            <!-- Question Caption -->
            <q-item-label v-if="item.caption" caption class="q-mt-sm q-ml-lg">
              <span v-html="item.caption" class="text-grey-7"></span>
            </q-item-label>

            <!-- Question Type Preview -->
            <q-item-label class="question-preview q-mt-sm q-ml-lg">
              <div class="preview-input-container">
                <!-- Number Input Preview -->
                <div v-if="item.type === 'number'" class="preview-input">
                  <q-input 
                    outlined 
                    dense 
                    readonly 
                    :placeholder="getPreviewPlaceholder(item)"
                    class="preview-field"
                  />
                  <div class="input-type-label">Number Input</div>
                </div>

                <!-- Text Input Preview -->
                <div v-else-if="item.type === 'text'" class="preview-input">
                  <q-input 
                    outlined 
                    dense 
                    readonly 
                    :placeholder="getPreviewPlaceholder(item)"
                    class="preview-field"
                  />
                  <div class="input-type-label">Text Input</div>
                </div>

                <!-- Radio Options Preview -->
                <div v-else-if="item.type === 'radio'" class="preview-input">
                  <div class="preview-radio-options">
                    <div 
                      v-for="(option, optIndex) in getRadioOptions(item)"
                      :key="optIndex"
                      class="preview-radio-option"
                    >
                      <q-radio 
                        :model-value="null"
                        :val="option.value"
                        :label="option.label"
                        disable
                        color="primary"
                      />
                    </div>
                  </div>
                  <div class="input-type-label">Radio Selection ({{ getRadioOptions(item).length }} options)</div>
                </div>

                <!-- Checkbox Options Preview -->
                <div v-else-if="item.type === 'checkbox'" class="preview-input">
                  <div class="preview-checkbox-options">
                    <div 
                      v-for="(option, optIndex) in getCheckboxOptions(item)"
                      :key="optIndex"
                      class="preview-checkbox-option"
                    >
                      <q-checkbox 
                        :model-value="false"
                        :label="option.label"
                        disable
                        color="primary"
                      />
                    </div>
                  </div>
                  <div class="input-type-label">Checkbox Selection ({{ getCheckboxOptions(item).length }} options)</div>
                </div>

                <!-- Slider Preview -->
                <div v-else-if="item.type === 'slider'" class="preview-input">
                  <q-slider
                    :model-value="getSliderDefault(item)"
                    :min="item.min || 0"
                    :max="item.max || 100"
                    :step="item.step || 1"
                    disable
                    color="primary"
                    class="q-mt-md"
                  />
                  <div class="slider-labels q-mt-sm">
                    <span class="text-caption">{{ item.min || 0 }}</span>
                    <span class="text-caption float-right">{{ item.max || 100 }}</span>
                  </div>
                  <div class="input-type-label">Slider ({{ item.min || 0 }} - {{ item.max || 100 }})</div>
                </div>

                <!-- Date Input Preview -->
                <div v-else-if="item.type === 'date'" class="preview-input">
                  <q-input 
                    outlined 
                    dense 
                    readonly 
                    placeholder="Select date..."
                    class="preview-field"
                  >
                    <template v-slot:append>
                      <q-icon name="event" />
                    </template>
                  </q-input>
                  <div class="input-type-label">Date Picker</div>
                </div>

                <!-- Time Input Preview -->
                <div v-else-if="item.type === 'time'" class="preview-input">
                  <q-input 
                    outlined 
                    dense 
                    readonly 
                    placeholder="Select time..."
                    class="preview-field"
                  >
                    <template v-slot:append>
                      <q-icon name="access_time" />
                    </template>
                  </q-input>
                  <div class="input-type-label">Time Picker</div>
                </div>

                <!-- Multiple Radio Preview -->
                <div v-else-if="item.type === 'multiple-radio'" class="preview-input">
                  <div class="preview-multiple-radio">
                    <div 
                      v-for="(group, groupIndex) in item.groups"
                      :key="groupIndex"
                      class="radio-group q-mb-md"
                    >
                      <div class="text-subtitle2 q-mb-sm">{{ group.label }}</div>
                      <div class="row">
                        <div 
                          v-for="(option, optIndex) in group.options"
                          :key="optIndex"
                          class="col-auto q-mr-md"
                        >
                          <q-radio 
                            :model-value="null"
                            :val="option.value"
                            :label="option.label"
                            disable
                            color="primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="input-type-label">Multiple Radio Groups ({{ item.groups?.length }} groups)</div>
                </div>

                <!-- Unknown Type -->
                <div v-else class="preview-input">
                  <q-card flat bordered class="bg-grey-2">
                    <q-card-section>
                      <div class="text-center text-grey-6">
                        <q-icon name="help" size="24px" />
                        <div class="text-caption q-mt-sm">Unknown question type: {{ item.type }}</div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Results Configuration -->
    <div v-if="questionnaire.results" class="survey-results q-mt-lg">
      <div class="text-h6 q-mb-md">Scoring Configuration</div>
      <q-card flat bordered class="bg-grey-1">
        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-md-6">
              <div class="text-subtitle2 text-weight-medium">Method</div>
              <div class="text-body2">{{ questionnaire.results.method || 'Not specified' }}</div>
            </div>
            <div class="col-md-6">
              <div class="text-subtitle2 text-weight-medium">Maximum Score</div>
              <div class="text-body2">{{ questionnaire.results.max_score || 'Not specified' }}</div>
            </div>
          </div>
          <div v-if="questionnaire.results.ranges" class="q-mt-md">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Score Ranges</div>
            <div class="score-ranges">
              <q-chip
                v-for="(range, index) in questionnaire.results.ranges"
                :key="index"
                dense
                outline
                :color="getScoreRangeColor(index)"
                class="q-mr-sm q-mb-sm"
              >
                {{ range.label }}: {{ range.min }}-{{ range.max }}
              </q-chip>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>

  <!-- No Questionnaire State -->
  <div v-else class="text-center q-pa-lg">
    <q-icon name="quiz" size="64px" color="grey-4" />
    <div class="text-h6 text-grey-6 q-mt-md">No questionnaire data</div>
    <div class="text-body2 text-grey-5">Please provide valid questionnaire JSON</div>
  </div>
</template>

<script setup>
defineProps({
  questionnaire: {
    type: Object,
    default: null
  }
})

// Helper methods
const getPreviewPlaceholder = (item) => {
  if (item.placeholder) return item.placeholder
  if (item.type === 'number') return 'Enter a number...'
  if (item.type === 'text') return 'Enter text...'
  return `${item.type} input`
}

const getRadioOptions = (item) => {
  if (item.options && Array.isArray(item.options)) {
    return item.options.map(opt => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt }
      } else if (typeof opt === 'object' && opt.label && opt.value !== undefined) {
        return { label: opt.label, value: opt.value }
      }
      return { label: String(opt), value: opt }
    })
  }
  return []
}

const getCheckboxOptions = (item) => {
  return getRadioOptions(item) // Same logic for checkboxes
}

const getSliderDefault = (item) => {
  const min = item.min || 0
  const max = item.max || 100
  return Math.floor((min + max) / 2)
}

const getScoreRangeColor = (index) => {
  const colors = ['green', 'orange', 'red', 'blue', 'purple']
  return colors[index % colors.length]
}
</script>

<style lang="scss" scoped>
.preview-survey {
  max-width: 100%;
  
  .survey-header {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 1rem;
    
    .survey-info {
      margin-top: 1rem;
    }
  }
  
  .preview-question-item {
    padding: 1.5rem 1rem;
    
    .question-number {
      font-size: 0.75rem;
      min-width: 24px;
      height: 24px;
    }
    
    .preview-input-container {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 0.5rem;
      
      .preview-input {
        position: relative;
        
        .input-type-label {
          font-size: 0.75rem;
          color: #666;
          margin-top: 0.5rem;
          font-style: italic;
        }
        
        .preview-field {
          opacity: 0.7;
        }
        
        .preview-radio-options,
        .preview-checkbox-options {
          .preview-radio-option,
          .preview-checkbox-option {
            margin-bottom: 0.5rem;
          }
        }
        
        .preview-multiple-radio {
          .radio-group {
            background: white;
            border-radius: 4px;
            padding: 0.75rem;
            border: 1px solid #e0e0e0;
          }
        }
        
        .slider-labels {
          display: flex;
          justify-content: space-between;
        }
      }
    }
  }
  
  .score-ranges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>
