<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="template-selector-dialog" style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="assignment_turned_in" class="q-mr-sm" color="primary" />
          Choose Visit Template
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="closeDialog" />
      </q-card-section>

      <q-card-section>
        <p class="text-body2 text-grey-6 q-mb-lg">
          Select a template to pre-configure observation categories and streamline your workflow
        </p>
        
        <div v-if="loadingTemplates" class="loading-state">
          <q-spinner-dots size="40px" color="primary" />
          <div class="text-body2 text-grey-6 q-mt-sm">Loading templates...</div>
        </div>
        
        <div v-else class="template-options">
          <div class="template-grid">
            <q-card
              v-for="template in availableTemplates"
              :key="template.id"
              @click="selectTemplate(template)"
              class="template-option"
              :class="`template-${template.color || 'primary'}`"
              flat
              bordered
            >
              <q-card-section class="template-content">
                <div class="template-icon">
                  <q-icon :name="template.icon || 'assignment'" size="32px" />
                </div>
                <div class="template-name">{{ template.name }}</div>
                <div class="template-type">{{ template.type || 'routine' }}</div>
              </q-card-section>
              
                                <q-tooltip class="bg-dark text-white" anchor="bottom middle" self="top middle">
                    <div class="template-tooltip">
                      <div class="tooltip-title">{{ template.name }}</div>
                      <div class="tooltip-description">{{ getTemplateDescription(template) }}</div>
                      <div class="tooltip-fieldsets">
                        <strong>Categories:</strong> {{ getTemplateFieldSets(template).join(', ') }}
                      </div>
                    </div>
                  </q-tooltip>
            </q-card>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none">
        <q-btn flat color="grey-7" label="Skip Template" @click="closeDialog" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useQuasar } from 'quasar'
import { getTemplateFieldSets, getTemplateDescription } from 'src/shared/utils/template-utils'

const emit = defineEmits(['template-selected'])

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()
const localSettings = useLocalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitTemplateSelector')

// State
const showDialog = ref(false)
const loadingTemplates = ref(false)
const availableTemplates = ref([])

// Methods
const openDialog = async () => {
  showDialog.value = true
  await loadTemplates()
}

const closeDialog = () => {
  showDialog.value = false
}

const loadTemplates = async () => {
  try {
    loadingTemplates.value = true

    // Load templates from global settings
    const templates = await globalSettingsStore.getVisitTemplateOptions()

    if (templates && templates.length > 0) {
      availableTemplates.value = templates
      logger.info('Visit templates loaded', { count: templates.length })
    } else {
      logger.warn('No visit templates available')
    }
  } catch (error) {
    logger.error('Failed to load visit templates', error)
    $q.notify({
      type: 'warning',
      message: 'Failed to load visit templates',
      position: 'top',
    })
  } finally {
    loadingTemplates.value = false
  }
}

const selectTemplate = (template) => {
  try {
    logger.info('Template selected', { templateId: template.id, templateName: template.name })
    
    // Save template selection to local settings
    localSettings.setSetting('visits.lastUsedTemplate', template.id)
    
    // Emit the selected template
    emit('template-selected', template)
    
    // Close dialog
    closeDialog()
    
    $q.notify({
      type: 'positive',
      message: `Applied "${template.name}" template`,
      position: 'top',
    })
    
  } catch (error) {
    logger.error('Failed to select template', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to apply template',
      position: 'top',
    })
  }
}

// Expose methods to parent
defineExpose({
  openDialog
})

// Auto-load templates on mount
onMounted(async () => {
  await loadTemplates()
})
</script>

<style lang="scss" scoped>
.template-selector-dialog {
  border-radius: 16px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.template-option {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 12px;
  border: 2px solid transparent;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  
  &.template-primary:hover {
    border-color: $primary;
  }
  
  &.template-secondary:hover {
    border-color: $secondary;
  }
  
  &.template-negative:hover {
    border-color: $negative;
  }
  
  &.template-warning:hover {
    border-color: $warning;
  }
  
  &.template-info:hover {
    border-color: $info;
  }
}

.template-content {
  text-align: center;
  padding: 1.5rem 1rem;
}

.template-icon {
  margin-bottom: 1rem;
  color: $primary;
}

.template-name {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  color: $grey-8;
}

.template-type {
  font-size: 0.8rem;
  color: $grey-6;
  text-transform: capitalize;
}

.template-tooltip {
  max-width: 280px;
  
  .tooltip-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .tooltip-description {
    margin-bottom: 0.75rem;
    opacity: 0.9;
  }
  
  .tooltip-fieldsets {
    font-size: 0.875rem;
    opacity: 0.8;
  }
}

.loading-state {
  text-align: center;
  padding: 3rem 1rem;
}

// Responsive design
@media (max-width: 768px) {
  .template-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  
  .template-content {
    padding: 1rem 0.75rem;
  }
  
  .template-icon {
    margin-bottom: 0.75rem;
  }
  
  .template-name {
    font-size: 0.875rem;
  }
  
  .template-type {
    font-size: 0.75rem;
  }
}
</style>
