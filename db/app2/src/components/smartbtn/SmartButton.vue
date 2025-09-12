<template>
  <div class="smart-button-container" :style="fabStyle">
    <q-tooltip>{{ $t('smartButton.tooltip') }}</q-tooltip>
    <q-fab icon="smart_toy" :direction="fabDirection" color="accent" :disable="draggingFab" v-touch-pan.prevent.mouse="moveFab">
      <q-fab-action
        v-for="plugin in registeredPlugins"
        :key="plugin.id"
        @click="plugin.isDisabled ? null : openPlugin(plugin.id)"
        :color="plugin.isDisabled ? 'grey' : plugin.color"
        :icon="plugin.icon"
        :disable="draggingFab || plugin.isDisabled"
      >
        <q-tooltip>{{ plugin.isDisabled ? plugin.disabledReason : plugin.tooltip }}</q-tooltip>
      </q-fab-action>
    </q-fab>
  </div>

  <!-- Plugin Dialog -->
  <q-dialog v-model="pluginDialog" :persistent="activePluginConfig?.config?.persistent || false">
    <q-card :style="{ minWidth: activePluginConfig?.config?.minWidth || '300px', maxWidth: activePluginConfig?.config?.maxWidth || '500px' }">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ activePluginConfig?.name || 'Plugin' }}</div>
        <q-space />
        <q-btn icon="minimize" flat round dense @click="minimizePlugin" :disable="loadingPlugin">
          <q-tooltip>{{ $t('smartButton.minimize') }}</q-tooltip>
        </q-btn>
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div v-if="loadingPlugin" class="text-center q-pa-md">
          <q-spinner color="primary" size="2em" />
          <div class="q-mt-sm">{{ $t('smartButton.loadingPlugin') }}</div>
        </div>
        <component
          ref="activePluginComponent"
          :is="activePluginConfig?.component"
          v-else-if="activePluginConfig"
          @close="closePlugin"
          v-bind="activePluginConfig?.config || {}"
          :initial-state="activePluginConfig?.initialState"
          :context="visitContext"
        />
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- Mini Plugins Container -->
  <div v-if="miniPlugins.length > 0" class="mini-plugins-container">
    <div v-for="(plugin, index) in miniPlugins" :key="plugin.id" class="mini-plugin-card" :style="getMiniPluginStyle(index)">
      <q-card flat bordered class="mini-card" @click="expandPlugin(plugin.id)">
        <q-card-section class="row items-center q-pa-sm">
          <q-icon :name="plugin.icon" :color="plugin.color" size="md" />
          <div class="mini-plugin-title text-caption q-ml-sm">
            {{ plugin.name }}
          </div>
          <q-space />
          <q-btn icon="close" size="sm" flat round dense @click.stop="closeMiniPlugin(plugin.id)" @mouseover.stop @mouseout.stop>
            <q-tooltip>Close</q-tooltip>
          </q-btn>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import { pluginManager } from './plugins'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { usePluginStateStore } from 'src/stores/plugin-state-store'

defineOptions({
  name: 'SmartButton',
})

const localSettingsStore = useLocalSettingsStore()
const pluginStateStore = usePluginStateStore()
const fabPos = ref([18, 18])

// Computed style for FAB positioning
const fabStyle = computed(() => ({
  position: 'fixed',
  bottom: fabPos.value[1] + 'px',
  right: fabPos.value[0] + 'px',
  zIndex: 2000,
}))
const draggingFab = ref(false)
const pluginDialog = ref(false)
const activePluginId = ref(null)
const activePluginConfig = ref(null)
const loadingPlugin = ref(false)
const miniPlugins = ref([]) // Array of minimized plugins
const activePluginComponent = ref(null) // Reference to the active plugin component instance
const visitContext = ref({ hasContext: false }) // Reactive visit context

// Get registered plugins with disabled state
const registeredPlugins = computed(() => {
  return pluginManager.getPlugins().map((plugin) => {
    let tooltip = plugin.tooltip

    // Handle dynamic tooltip for Ask AI plugin
    if (plugin.id === 'ask-ai') {
      tooltip = localSettingsStore.hasOpenAIApiKey() ? 'Ask AI Assistant' : 'AI Assistant (API Key Required)'
    }

    return {
      ...plugin,
      isDisabled: plugin.isDisabled ? plugin.isDisabled() : false,
      disabledReason: plugin.disabledReason ? plugin.disabledReason() : null,
      tooltip: typeof tooltip === 'function' ? tooltip() : tooltip,
    }
  })
})

// Dynamic FAB direction based on screen position
const fabDirection = computed(() => {
  const windowHeight = window.innerHeight
  const fabY = fabPos.value[1]
  return fabY > windowHeight / 2 ? 'down' : 'up'
})

// Compute mini plugin positioning
const getMiniPluginStyle = (index) => ({
  bottom: `${10 + index * 60}px`,
})

const moveFab = (ev) => {
  draggingFab.value = ev.isFirst !== true && ev.isFinal !== true

  // Calculate new position
  const newX = fabPos.value[0] - ev.delta.x
  const newY = fabPos.value[1] - ev.delta.y

  // Get viewport dimensions
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // FAB button dimensions (approximate)
  const fabSize = 56 // Standard FAB size
  const margin = 8 // Minimum margin from edges
  const leftDrawerMargin = 50 // Extra margin for left drawer

  // Constrain X position (left and right edges)
  const minX = 0
  const maxX = viewportWidth - fabSize - leftDrawerMargin
  const constrainedX = Math.max(minX, Math.min(maxX, newX))

  // Constrain Y position (bottom edge)
  const minY = margin
  const maxY = viewportHeight - fabSize - margin
  const constrainedY = Math.max(minY, Math.min(maxY, newY))

  fabPos.value = [constrainedX, constrainedY]
}

// Handle window resize to update FAB direction and ensure it stays in bounds
const handleResize = () => {
  // Get current viewport dimensions
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // FAB button dimensions (approximate)
  const fabSize = 56
  const margin = 8
  const leftDrawerMargin = 50 // Extra margin for left drawer

  // Constrain current position to new viewport bounds
  const minX = leftDrawerMargin
  const maxX = viewportWidth - fabSize - leftDrawerMargin
  const constrainedX = Math.max(minX, Math.min(maxX, fabPos.value[0]))

  const minY = margin
  const maxY = viewportHeight - fabSize - margin
  const constrainedY = Math.max(minY, Math.min(maxY, fabPos.value[1]))

  fabPos.value = [constrainedX, constrainedY]
}

window.addEventListener('resize', handleResize)

const openPlugin = async (pluginId, overrideConfig = null, componentState = null) => {
  try {
    loadingPlugin.value = true
    activePluginId.value = pluginId

    // Capture current selection and focused editable element before opening dialog
    const captureSelectionContext = () => {
      try {
        const selection = window.getSelection ? window.getSelection() : null
        const selectedText = selection ? selection.toString() : ''
        const activeEl = document.activeElement

        let selectionStart = null
        let selectionEnd = null
        let isEditable = false
        let tagName = ''

        if (activeEl) {
          tagName = activeEl.tagName
          if (activeEl.tagName === 'TEXTAREA' || (activeEl.tagName === 'INPUT' && (!activeEl.type || activeEl.type === 'text' || activeEl.type === 'search')) || activeEl.isContentEditable) {
            isEditable = true
            if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
              selectionStart = activeEl.selectionStart
              selectionEnd = activeEl.selectionEnd
            }
          }
        }

        window.__smartRewriteContext = {
          selectedText,
          selectionStart,
          selectionEnd,
          isEditable,
          tagName,
          timestamp: Date.now(),
        }
        // Store element separately to avoid serialization issues
        window.__smartRewriteElement = isEditable ? activeEl : null
      } catch (e) {
        console.warn('Failed to capture selection context', e)
      }
    }

    // Capture visit/observation context for plugins
    const captureVisitContext = async () => {
      try {
        // Import the context service dynamically to avoid circular dependencies
        const { pluginContextService } = await import('src/services/plugin-context-service')
        const context = pluginContextService.getContext()

        // Store context both globally and reactively
        window.__smartVisitContext = context
        visitContext.value = context

        console.debug('Captured visit context:', context)
      } catch (e) {
        console.warn('Failed to capture visit context:', e)
        const fallbackContext = { hasContext: false, message: 'Failed to load context' }
        window.__smartVisitContext = fallbackContext
        visitContext.value = fallbackContext
      }
    }

    captureSelectionContext()

    // Capture visit context for context-aware plugins
    await captureVisitContext()

    // Lazy load the plugin component
    const plugin = await pluginManager.loadPlugin(pluginId)

    // Apply override config and component state if provided (for state restoration)
    if (overrideConfig || componentState) {
      activePluginConfig.value = {
        ...plugin,
        config: overrideConfig ? { ...plugin.config, ...overrideConfig } : plugin.config,
        initialState: componentState, // Pass component state for restoration
      }
    } else {
      activePluginConfig.value = plugin
    }

    pluginDialog.value = true

    // Wait for dialog and component to be fully rendered
    await nextTick()
    // Additional small delay to ensure component is fully initialized
    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch (error) {
    console.error('Failed to load plugin:', error)
    // You could show a user-friendly error message here
  } finally {
    loadingPlugin.value = false
  }
}

const closePlugin = (isMinimizing = false) => {
  // Only clean up stored instance when closing permanently (not when minimizing)
  if (activePluginId.value && !isMinimizing) {
    pluginStateStore.removePluginState(activePluginId.value)
  }

  pluginDialog.value = false
  activePluginId.value = null
  activePluginConfig.value = null

  // Reset context when closing (but not when minimizing)
  if (!isMinimizing) {
    visitContext.value = { hasContext: false }
  }
}

const minimizePlugin = async () => {
  if (activePluginConfig.value) {
    // Wait for next tick to ensure component is fully rendered
    await nextTick()

    // Get component state before minimizing (if the component instance exposes it)
    let componentState = {}

    // Try to access the component instance
    const componentRef = activePluginComponent.value

    if (componentRef && typeof componentRef.getState === 'function') {
      try {
        componentState = componentRef.getState() || {}
      } catch (e) {
        console.warn(`Failed to get component state for ${activePluginConfig.value.id}:`, e)
      }
    }

    // Store the current plugin state in the store
    pluginStateStore.savePluginState(activePluginConfig.value.id, {
      config: { ...activePluginConfig.value.config },
      componentState,
    })

    // Prevent duplicate mini plugins
    if (!miniPlugins.value.some((p) => p.id === activePluginConfig.value.id)) {
      miniPlugins.value.push({ ...activePluginConfig.value })
    }
    closePlugin(true) // Pass true to indicate we're minimizing, not closing permanently
  }
}

const expandPlugin = (pluginId) => {
  if (miniPlugins.value.some((p) => p.id === pluginId)) {
    miniPlugins.value = miniPlugins.value.filter((p) => p.id !== pluginId)

    // Check if we have stored state for this plugin in the store
    const storedState = pluginStateStore.restorePluginState(pluginId)

    if (storedState && storedState.componentState) {
      // Restore the plugin with stored configuration and component state
      openPlugin(pluginId, storedState.config, storedState.componentState)
    } else {
      // No stored state, open normally
      openPlugin(pluginId)
    }
  }
}

const closeMiniPlugin = (pluginId) => {
  miniPlugins.value = miniPlugins.value.filter((p) => p.id !== pluginId)
  // Clean up stored state when mini plugin is permanently closed
  pluginStateStore.removePluginState(pluginId)
}

// Cleanup event listeners
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  // Clear all stored plugin states when component is destroyed
  pluginStateStore.clearAllPluginStates()
})
</script>

<style lang="scss" scoped>
.mini-plugins-container {
  position: fixed;
  left: 10px;
  bottom: 10px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-plugin-card {
  position: absolute;
  left: 0;
  transition: all 0.3s ease;
  animation: slideInLeft 0.3s ease-out;

  &:hover {
    transform: translateX(5px);
  }
}

.mini-card {
  min-width: 200px;
  max-width: 250px;
  height: 50px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.98);
    transform: translateX(8px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .q-card__section {
    padding: 8px 12px;
    height: 100%;
    display: flex;
    align-items: center;
  }
}

.mini-plugin-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  flex: 1;
  margin: 0 8px;
}

// Dark theme support
.dark .mini-card {
  background: rgba(33, 33, 33, 0.95);
  color: #ffffff;

  &:hover {
    background: rgba(45, 45, 45, 0.98);
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
