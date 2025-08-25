<template>
  <div class="log-viewer">
    <!-- Header with controls -->
    <div class="log-viewer__header">
      <div class="row items-center justify-between q-mb-md">
        <div class="col-auto">
          <h6 class="q-ma-none">Application Logs</h6>
          <div class="text-caption text-grey-6">
            {{ logStats.total }} total logs • {{ logStats.errors }} errors • {{ logStats.warnings }} warnings
          </div>
        </div>
        
        <div class="col-auto">
          <div class="row q-gutter-sm">
            <!-- Log level filter -->
            <q-select
              v-model="selectedLevel"
              :options="levelOptions"
              label="Level"
              dense
              outlined
              style="min-width: 120px"
              @update:model-value="filterLogs"
            />
            
            <!-- Context filter -->
            <q-select
              v-model="selectedContext"
              :options="contextOptions"
              label="Context"
              dense
              outlined
              clearable
              style="min-width: 150px"
              @update:model-value="filterLogs"
            />
            
            <!-- Actions -->
            <q-btn
              icon="refresh"
              dense
              outline
              @click="refreshLogs"
              :loading="isRefreshing"
            >
              <q-tooltip>Refresh logs</q-tooltip>
            </q-btn>
            
            <q-btn
              icon="download"
              dense
              outline
              @click="exportLogs"
            >
              <q-tooltip>Export logs</q-tooltip>
            </q-btn>
            
            <q-btn
              icon="clear_all"
              dense
              outline
              color="negative"
              @click="confirmClearLogs"
            >
              <q-tooltip>Clear all logs</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Log entries -->
    <div class="log-viewer__content">
      <q-virtual-scroll
        :items="filteredLogs"
        separator
        :virtual-scroll-item-size="80"
        style="max-height: 500px"
      >
        <template v-slot="{ item, index }">
          <q-item
            :key="index"
            class="log-entry"
            :class="`log-entry--${item.level.toLowerCase()}`"
            clickable
            @click="toggleLogDetails(index)"
          >
            <q-item-section side class="log-entry__timestamp">
              <div class="text-caption">
                {{ formatTime(item.timestamp) }}
              </div>
            </q-item-section>
            
            <q-item-section side class="log-entry__level">
              <q-chip
                :color="getLevelColor(item.level)"
                text-color="white"
                size="sm"
                dense
              >
                {{ item.level }}
              </q-chip>
            </q-item-section>
            
            <q-item-section side class="log-entry__context">
              <q-chip
                color="grey-6"
                text-color="white"
                size="sm"
                dense
                outline
              >
                {{ item.context }}
              </q-chip>
            </q-item-section>
            
            <q-item-section class="log-entry__message">
              <div class="text-body2">{{ item.message }}</div>
              <div v-if="item.data && !expandedLogs.includes(index)" class="text-caption text-grey-6">
                Click to view details
              </div>
            </q-item-section>
            
            <q-item-section side>
              <q-icon
                :name="expandedLogs.includes(index) ? 'expand_less' : 'expand_more'"
                size="sm"
              />
            </q-item-section>
          </q-item>
          
          <!-- Expanded details -->
          <q-slide-transition>
            <div v-show="expandedLogs.includes(index)" class="log-entry__details q-pa-md bg-grey-1">
              <div v-if="item.data" class="q-mb-md">
                <div class="text-weight-medium q-mb-xs">Data:</div>
                <pre class="log-data">{{ JSON.stringify(item.data, null, 2) }}</pre>
              </div>
              
              <div v-if="item.error" class="q-mb-md">
                <div class="text-weight-medium q-mb-xs text-negative">Error:</div>
                <div class="text-body2 text-negative">{{ item.error.message }}</div>
                <pre v-if="item.error.stack" class="log-error">{{ item.error.stack }}</pre>
              </div>
              
              <div class="text-caption text-grey-6">
                Session: {{ item.sessionId }} • 
                Uptime: {{ formatDuration(item.uptime) }}
              </div>
            </div>
          </q-slide-transition>
        </template>
      </q-virtual-scroll>
      
      <!-- Empty state -->
      <div v-if="filteredLogs.length === 0" class="text-center q-pa-lg text-grey-6">
        <q-icon name="info" size="3rem" class="q-mb-md" />
        <div class="text-h6">No logs found</div>
        <div class="text-body2">
          {{ selectedLevel !== 'ALL' || selectedContext ? 'Try adjusting your filters' : 'No logs have been generated yet' }}
        </div>
      </div>
    </div>
    
    <!-- Clear confirmation dialog -->
    <q-dialog v-model="showClearDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Clear All Logs</div>
        </q-card-section>
        
        <q-card-section>
          Are you sure you want to clear all logs? This action cannot be undone.
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn label="Cancel" flat v-close-popup />
          <q-btn label="Clear" color="negative" @click="clearLogs" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLoggingStore } from '../../stores/logging-store.js'
import { useLogger } from '../../shared/composables/useLogger.js'

const loggingStore = useLoggingStore()
const logger = useLogger('LogViewer')

// State
const selectedLevel = ref('ALL')
const selectedContext = ref(null)
const expandedLogs = ref([])
const isRefreshing = ref(false)
const showClearDialog = ref(false)

// Computed
const logStats = computed(() => loggingStore.logStats)

const levelOptions = computed(() => [
  { label: 'All Levels', value: 'ALL' },
  { label: 'Debug', value: 'DEBUG' },
  { label: 'Info', value: 'INFO' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Warning', value: 'WARN' },
  { label: 'Error', value: 'ERROR' }
])

const contextOptions = computed(() => {
  const contexts = [...new Set(loggingStore.logs.map(log => log.context))]
  return contexts.map(context => ({ label: context, value: context }))
})

const filteredLogs = computed(() => {
  let logs = loggingStore.recentLogs
  
  if (selectedLevel.value !== 'ALL') {
    logs = logs.filter(log => log.level === selectedLevel.value)
  }
  
  if (selectedContext.value) {
    logs = logs.filter(log => log.context === selectedContext.value)
  }
  
  return logs.reverse() // Show newest first
})

// Methods
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

const getLevelColor = (level) => {
  const colors = {
    DEBUG: 'grey-6',
    INFO: 'blue',
    SUCCESS: 'green',
    WARN: 'orange',
    ERROR: 'red'
  }
  return colors[level] || 'grey'
}

const toggleLogDetails = (index) => {
  const expandedIndex = expandedLogs.value.indexOf(index)
  if (expandedIndex > -1) {
    expandedLogs.value.splice(expandedIndex, 1)
  } else {
    expandedLogs.value.push(index)
  }
  
  logger.logClick('Log Entry', { index, expanded: expandedIndex === -1 })
}

const refreshLogs = async () => {
  isRefreshing.value = true
  logger.logAction('REFRESH_LOGS')
  
  try {
    loggingStore.refreshLogs()
    logger.success('Logs refreshed successfully')
  } catch (error) {
    logger.error('Failed to refresh logs', error)
  } finally {
    isRefreshing.value = false
  }
}

const exportLogs = () => {
  logger.logAction('EXPORT_LOGS')
  loggingStore.exportLogs()
}

const confirmClearLogs = () => {
  showClearDialog.value = true
}

const clearLogs = () => {
  logger.logAction('CLEAR_LOGS')
  loggingStore.clearLogs()
  expandedLogs.value = []
}

const filterLogs = () => {
  expandedLogs.value = []
  logger.logAction('FILTER_LOGS', {
    level: selectedLevel.value,
    context: selectedContext.value
  })
}

// Lifecycle
onMounted(() => {
  logger.logMounted({ component: 'LogViewer' })
  loggingStore.refreshLogs()
})
</script>

<style lang="scss" scoped>
.log-viewer {
  &__header {
    border-bottom: 1px solid $grey-4;
    padding-bottom: 1rem;
  }
  
  &__content {
    margin-top: 1rem;
  }
}

.log-entry {
  &--debug {
    border-left: 3px solid $grey-6;
  }
  
  &--info {
    border-left: 3px solid $blue;
  }
  
  &--success {
    border-left: 3px solid $green;
  }
  
  &--warn {
    border-left: 3px solid $orange;
  }
  
  &--error {
    border-left: 3px solid $red;
    background-color: rgba($red, 0.05);
  }
  
  &__timestamp {
    min-width: 80px;
  }
  
  &__level {
    min-width: 80px;
  }
  
  &__context {
    min-width: 120px;
  }
  
  &__details {
    border-left: 3px solid $grey-4;
  }
}

.log-data, .log-error {
  background: $grey-2;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.log-error {
  background: rgba($red, 0.1);
  color: $red-8;
}
</style>
