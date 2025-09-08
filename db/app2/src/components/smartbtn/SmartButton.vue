<template>
  <div class="smart-button-container" :style="fabStyle">
    <q-tooltip>Smart Button - Click to open plugins</q-tooltip>
    <q-fab
      icon="smart_toy"
      :direction="fabDirection"
      color="accent"
      :disable="draggingFab"
      v-touch-pan.prevent.mouse="moveFab"
    >
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
          <q-tooltip>Minimize to bottom</q-tooltip>
        </q-btn>
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div v-if="loadingPlugin" class="text-center q-pa-md">
          <q-spinner color="primary" size="2em" />
          <div class="q-mt-sm">Loading plugin...</div>
        </div>
        <component
          :is="activePluginConfig?.component"
          v-else-if="activePluginConfig"
          @close="closePlugin"
          v-bind="activePluginConfig?.config || {}"
        />
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- Mini Plugins Container -->
  <div v-if="miniPlugins.length > 0" class="mini-plugins-container">
    <div
      v-for="(plugin, index) in miniPlugins"
      :key="plugin.id"
      class="mini-plugin-card"
      :style="getMiniPluginStyle(index)"
    >
      <q-card
        flat
        bordered
        class="mini-card"
        @click="expandPlugin(plugin.id)"
      >
        <q-card-section class="row items-center q-pa-sm">
          <q-icon :name="plugin.icon" :color="plugin.color" size="md" />
          <div class="mini-plugin-title text-caption q-ml-sm">
            {{ plugin.name }}
          </div>
          <q-space />
          <q-btn
            icon="close"
            size="sm"
            flat
            round
            dense
            @click.stop="closeMiniPlugin(plugin.id)"
            @mouseover.stop
            @mouseout.stop
          >
            <q-tooltip>Close</q-tooltip>
          </q-btn>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { pluginManager } from './plugins'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

defineOptions({
  name: 'SmartButton'
})

const localSettingsStore = useLocalSettingsStore()
const fabPos = ref([18, 18])

// Computed style for FAB positioning
const fabStyle = computed(() => ({
  position: 'fixed',
  bottom: fabPos.value[1] + 'px',
  right: fabPos.value[0] + 'px',
  zIndex: 2000
}))
const draggingFab = ref(false)
const pluginDialog = ref(false)
const activePluginId = ref(null)
const activePluginConfig = ref(null)
const loadingPlugin = ref(false)
const miniPlugins = ref([]) // Array of minimized plugins

// Get registered plugins with disabled state
const registeredPlugins = computed(() => {
  return pluginManager.getPlugins().map(plugin => {
    let tooltip = plugin.tooltip

    // Handle dynamic tooltip for Ask AI plugin
    if (plugin.id === 'ask-ai') {
      tooltip = localSettingsStore.hasOpenAIApiKey()
        ? 'Ask AI Assistant'
        : 'AI Assistant (API Key Required)'
    }

    return {
      ...plugin,
      isDisabled: plugin.isDisabled ? plugin.isDisabled() : false,
      disabledReason: plugin.disabledReason ? plugin.disabledReason() : null,
      tooltip: typeof tooltip === 'function' ? tooltip() : tooltip
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
  bottom: `${10 + index * 60}px`
})

const moveFab = (ev) => {
  draggingFab.value = ev.isFirst !== true && ev.isFinal !== true

  fabPos.value = [
    fabPos.value[0] - ev.delta.x,
    fabPos.value[1] - ev.delta.y
  ]
}

// Handle window resize to update FAB direction
const handleResize = () => {
  // Force reactivity update by creating new reference
  fabPos.value = fabPos.value.slice()
}

window.addEventListener('resize', handleResize)

const openPlugin = async (pluginId) => {
  try {
    loadingPlugin.value = true
    activePluginId.value = pluginId
    
    // Lazy load the plugin component
    const plugin = await pluginManager.loadPlugin(pluginId)
    activePluginConfig.value = plugin

    pluginDialog.value = true
  } catch (error) {
    console.error('Failed to load plugin:', error)
    // You could show a user-friendly error message here
  } finally {
    loadingPlugin.value = false
  }
}

const closePlugin = () => {
  pluginDialog.value = false
  activePluginId.value = null
  activePluginConfig.value = null
}

const minimizePlugin = () => {
  if (activePluginConfig.value) {
    // Prevent duplicate mini plugins
    if (!miniPlugins.value.some(p => p.id === activePluginConfig.value.id)) {
      miniPlugins.value.push({ ...activePluginConfig.value })
    }
    closePlugin()
  }
}

const expandPlugin = (pluginId) => {
  if (miniPlugins.value.some(p => p.id === pluginId)) {
    miniPlugins.value = miniPlugins.value.filter(p => p.id !== pluginId)
    openPlugin(pluginId)
  }
}

const closeMiniPlugin = (pluginId) => {
  miniPlugins.value = miniPlugins.value.filter(p => p.id !== pluginId)
}

// Cleanup event listeners
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.smart-button-container {
  // Container for the FAB button
  // Positioning handled by inline styles
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
