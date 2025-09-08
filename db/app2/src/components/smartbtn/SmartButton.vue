<template>
  <q-page-sticky position="bottom-right" :offset="fabPos">
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
        @click="openPlugin(plugin.id)" 
        :color="plugin.color" 
        :icon="plugin.icon" 
        :disable="draggingFab"
      >
        <q-tooltip>{{ plugin.tooltip }}</q-tooltip>
      </q-fab-action>
    </q-fab>
  </q-page-sticky>

  <!-- Plugin Dialog -->
  <q-dialog v-model="pluginDialog" :persistent="activePluginConfig?.config?.persistent || false">
    <q-card :style="{ minWidth: activePluginConfig?.config?.minWidth || '300px', maxWidth: activePluginConfig?.config?.maxWidth || '500px' }">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ activePluginConfig?.name || 'Plugin' }}</div>
        <q-space />
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
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { pluginManager } from './plugins'

defineOptions({
  name: 'SmartButton'
})

const fabPos = ref([18, 18])
const draggingFab = ref(false)
const pluginDialog = ref(false)
const activePluginId = ref(null)
const activePluginConfig = ref(null)
const loadingPlugin = ref(false)

// Get registered plugins
const registeredPlugins = computed(() => pluginManager.getPlugins())

// Dynamic FAB direction based on screen position
const fabDirection = computed(() => {
  const windowHeight = window.innerHeight
  const fabY = fabPos.value[1]
  return fabY > windowHeight / 2 ? 'down' : 'up'
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
  // Trigger reactivity update for fabDirection
  fabPos.value = [...fabPos.value]
}

window.addEventListener('resize', handleResize)

const openPlugin = async (pluginId) => {
  try {
    loadingPlugin.value = true
    activePluginId.value = pluginId
    
    // Lazy load the plugin component
    const plugin = await pluginManager.loadPlugin(pluginId)
    activePluginConfig.value = plugin
    
    pluginManager.setActivePlugin(pluginId)
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
  pluginManager.clearActivePlugin()
}

// Cleanup event listeners
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
// Custom styling for the smart button if needed
</style>
