<template>
  <q-page-sticky position="bottom-right" :offset="fabPos">
    <q-fab
      icon="smart_toy"
      direction="up"
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
        <component 
          :is="activePluginConfig?.component" 
          v-if="activePluginConfig"
          @close="closePlugin"
          v-bind="activePluginConfig?.config || {}"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { pluginManager } from './plugins'

defineOptions({
  name: 'SmartButton'
})

const fabPos = ref([18, 18])
const draggingFab = ref(false)
const pluginDialog = ref(false)
const activePluginId = ref(null)

// Get registered plugins
const registeredPlugins = computed(() => pluginManager.getPlugins())

// Get active plugin configuration
const activePluginConfig = computed(() => {
  return activePluginId.value ? pluginManager.getPlugin(activePluginId.value) : null
})

const moveFab = (ev) => {
  draggingFab.value = ev.isFirst !== true && ev.isFinal !== true

  fabPos.value = [
    fabPos.value[0] - ev.delta.x,
    fabPos.value[1] - ev.delta.y
  ]
}

const openPlugin = (pluginId) => {
  activePluginId.value = pluginId
  pluginManager.setActivePlugin(pluginId)
  pluginDialog.value = true
}

const closePlugin = () => {
  pluginDialog.value = false
  activePluginId.value = null
  pluginManager.clearActivePlugin()
}
</script>

<style lang="scss" scoped>
// Custom styling for the smart button if needed
</style>
