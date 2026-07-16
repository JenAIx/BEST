<template>
  <div class="smart-button-container" :style="fabStyle">
    <q-tooltip>{{ $t('smartButton.tooltip') }}</q-tooltip>
    <q-badge v-if="unreadMessages > 0" color="red" floating rounded class="fab-unread-badge">{{ unreadMessages }}</q-badge>
    <q-fab icon="smart_toy" :direction="fabDirection" color="accent" :disable="draggingFab" v-touch-pan.prevent.mouse="moveFab">
      <q-fab-action
        v-for="plugin in registeredPlugins"
        :key="plugin.id"
        @click="plugin.isDisabled ? null : openPlugin(plugin.id)"
        :color="plugin.isDisabled ? 'grey' : plugin.color"
        :icon="plugin.icon"
        :disable="draggingFab || plugin.isDisabled"
      >
        <q-badge v-if="plugin.id === 'notes' && unreadMessages > 0" color="red" floating rounded>{{ unreadMessages }}</q-badge>
        <q-tooltip>{{ plugin.isDisabled ? plugin.disabledReason : plugin.tooltip }}</q-tooltip>
      </q-fab-action>
    </q-fab>
  </div>

  <!-- Plugin Windows: floating, non-modal cards (background stays interactive),
       draggable via their title bar. Several plugins can be open at once,
       but at most ONE window per plugin. -->
  <q-card
    v-for="win in openWindows"
    :key="win.id"
    class="plugin-window"
    :style="windowStyleFor(win)"
    @mousedown="bringToFront(win)"
  >
    <q-card-section class="row items-center q-pb-none plugin-window-header" v-touch-pan.prevent.mouse="(ev) => moveWindow(win, ev)">
      <div class="text-h6">{{ win.config.nameKey ? $t(win.config.nameKey) : win.config.name || 'Plugin' }}</div>
      <q-space />
      <q-btn icon="minimize" flat round dense @click="minimizePlugin(win)">
        <q-tooltip>{{ $t('smartButton.minimize') }}</q-tooltip>
      </q-btn>
      <q-btn icon="close" flat round dense @click="closePlugin(win)">
        <q-tooltip>{{ $t('smartButton.close') }}</q-tooltip>
      </q-btn>
    </q-card-section>

    <q-card-section>
      <component
        :is="win.config.component"
        :ref="(el) => setWindowRef(win.id, el)"
        @close="closePlugin(win)"
        v-bind="win.config.config || {}"
        :initial-state="win.initialState"
        :context="win.context"
      />
    </q-card-section>
  </q-card>

  <!-- Mini Plugins Container -->
  <div v-if="miniPlugins.length > 0" class="mini-plugins-container">
    <div v-for="(plugin, index) in miniPlugins" :key="plugin.id" class="mini-plugin-card" :style="getMiniPluginStyle(index)">
      <q-card flat bordered class="mini-card" @click="expandPlugin(plugin.id)">
        <q-card-section class="row items-center q-pa-sm">
          <q-icon :name="plugin.icon" :color="plugin.color" size="md" />
          <div class="mini-plugin-title text-caption q-ml-sm">
            {{ plugin.nameKey ? $t(plugin.nameKey) : plugin.name }}
          </div>
          <q-space />
          <q-btn icon="close" size="sm" flat round dense @click.stop="closeMiniPlugin(plugin.id)" @mouseover.stop @mouseout.stop>
            <q-tooltip>{{ $t('smartButton.close') }}</q-tooltip>
          </q-btn>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { pluginManager } from './plugins'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { usePluginStateStore } from 'src/stores/plugin-state-store'
import { useNoteStore } from 'src/stores/note-store'

defineOptions({
  name: 'SmartButton',
})

const { t } = useI18n()
const localSettingsStore = useLocalSettingsStore()
const pluginStateStore = usePluginStateStore()
const noteStore = useNoteStore()
const fabPos = ref([18, 18])

// Unread-messages badge on the FAB (refreshed periodically, best-effort)
const unreadMessages = computed(() => noteStore.unreadMessagesCount)
let unreadTimer = null

onMounted(() => {
  noteStore.refreshUnreadCount()
  unreadTimer = setInterval(() => noteStore.refreshUnreadCount(), 60000)
})

// Computed style for FAB positioning
const fabStyle = computed(() => ({
  position: 'fixed',
  bottom: fabPos.value[1] + 'px',
  right: fabPos.value[0] + 'px',
  zIndex: 2000,
}))
const draggingFab = ref(false)
const miniPlugins = ref([]) // Array of minimized plugins

// Open plugin windows: several plugins can float at once, but at most ONE
// window per plugin id. Shape: { id, config, initialState, context, pos, z }
const openWindows = ref([])
// Component instances per window (non-reactive; for getState on minimize)
const windowRefs = new Map()
let zCounter = 3000

const setWindowRef = (id, el) => {
  if (el) windowRefs.set(id, el)
  else windowRefs.delete(id)
}

// Get registered plugins with disabled state (labels resolved via i18n)
const registeredPlugins = computed(() => {
  return pluginManager.getPlugins().map((plugin) => {
    let tooltip = plugin.tooltipKey ? t(plugin.tooltipKey) : plugin.tooltip

    // Handle dynamic tooltip for Ask AI plugin
    if (plugin.id === 'ask-ai') {
      tooltip = localSettingsStore.hasOpenAIApiKey() ? t('smartButton.plugins.askAi.tooltip') : t('smartButton.plugins.askAi.tooltipNoKey')
    }

    return {
      ...plugin,
      isDisabled: plugin.isDisabled ? plugin.isDisabled() : false,
      disabledReason: plugin.disabledReason ? plugin.disabledReason() : null,
      tooltip: typeof tooltip === 'function' ? tooltip() : tooltip,
    }
  })
})

// --- Plugin window positioning (floating cards, draggable via title bar) ---

// Cascade new windows from the top-right, offset per open window
const defaultWindowPos = (win) => {
  const approxWidth = parseInt(win.config?.config?.maxWidth) || 480
  const index = openWindows.value.length
  const x = Math.max(16, window.innerWidth - approxWidth - 40 - index * 32)
  const y = 90 + index * 32
  return [x, y]
}

const windowStyleFor = (win) => ({
  position: 'fixed',
  top: `${win.pos[1]}px`,
  left: `${win.pos[0]}px`,
  zIndex: win.z,
  minWidth: win.config?.config?.minWidth || '300px',
  maxWidth: win.config?.config?.maxWidth || '500px',
})

const bringToFront = (win) => {
  win.z = ++zCounter
}

const moveWindow = (win, ev) => {
  const newX = win.pos[0] + ev.delta.x
  const newY = win.pos[1] + ev.delta.y

  // Keep the title bar reachable: clamp within the viewport
  const margin = 8
  const maxX = window.innerWidth - 120
  const maxY = window.innerHeight - 48
  win.pos = [Math.max(margin - 60, Math.min(maxX, newX)), Math.max(margin, Math.min(maxY, newY))]
}

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
    // At most one window per plugin: re-opening brings it to the front
    const existing = openWindows.value.find((w) => w.id === pluginId)
    if (existing) {
      bringToFront(existing)
      return
    }

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

        // Keep the global copy for plugins that read it directly
        window.__smartVisitContext = context
        return context
      } catch (e) {
        console.warn('Failed to capture visit context:', e)
        const fallbackContext = { hasContext: false, message: 'Failed to load context' }
        window.__smartVisitContext = fallbackContext
        return fallbackContext
      }
    }

    captureSelectionContext()

    // Capture visit context for context-aware plugins (per window)
    const context = await captureVisitContext()

    // Lazy load the plugin component
    const plugin = await pluginManager.loadPlugin(pluginId)

    // Apply override config if provided (for state restoration)
    const config = overrideConfig ? { ...plugin, config: { ...plugin.config, ...overrideConfig } } : plugin

    const win = {
      id: pluginId,
      config,
      initialState: componentState,
      context,
      pos: [0, 0],
      z: ++zCounter,
    }
    win.pos = defaultWindowPos(win)
    openWindows.value.push(win)

    // Wait for the window and component to be fully rendered
    await nextTick()
  } catch (error) {
    console.error('Failed to load plugin:', error)
  }
}

const closePlugin = (win, isMinimizing = false) => {
  openWindows.value = openWindows.value.filter((w) => w.id !== win.id)
  windowRefs.delete(win.id)

  // Only clean up stored instance when closing permanently (not when minimizing)
  if (!isMinimizing) {
    pluginStateStore.removePluginState(win.id)
  }
}

const minimizePlugin = async (win) => {
  // Get component state before minimizing (if the component instance exposes it)
  let componentState = {}
  const componentRef = windowRefs.get(win.id)

  if (componentRef && typeof componentRef.getState === 'function') {
    try {
      componentState = componentRef.getState() || {}
    } catch (e) {
      console.warn(`Failed to get component state for ${win.id}:`, e)
    }
  }

  // Store the current plugin state in the store
  pluginStateStore.savePluginState(win.id, {
    config: { ...win.config.config },
    componentState,
  })

  // Prevent duplicate mini plugins
  if (!miniPlugins.value.some((p) => p.id === win.id)) {
    miniPlugins.value.push({ ...win.config })
  }
  closePlugin(win, true) // Minimizing, not closing permanently
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
  if (unreadTimer) clearInterval(unreadTimer)
  // Clear all stored plugin states when component is destroyed
  pluginStateStore.clearAllPluginStates()
})
</script>

<style lang="scss" scoped>
.fab-unread-badge {
  z-index: 2001;
}

.plugin-window {
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);

  .plugin-window-header {
    cursor: move;
    user-select: none;
  }
}

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
