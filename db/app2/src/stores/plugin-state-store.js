import { defineStore } from 'pinia'

export const usePluginStateStore = defineStore('pluginState', {
  state: () => ({
    pluginStates: {} // { pluginId: { config, componentState, minimizedAt } }
  }),

  getters: {
    getPluginState: (state) => (pluginId) => {
      return state.pluginStates[pluginId] || null
    },

    hasPluginState: (state) => (pluginId) => {
      return !!state.pluginStates[pluginId]
    }
  },

  actions: {
    savePluginState(pluginId, { config = {}, componentState = {} }) {
      this.pluginStates[pluginId] = {
        config,
        componentState,
        minimizedAt: Date.now()
      }
      console.log(`Plugin state saved in store: ${pluginId}`)
    },

    restorePluginState(pluginId) {
      const state = this.pluginStates[pluginId]
      if (state) {
        console.log(`Plugin state restored from store: ${pluginId}`)
        return state
      }
      return null
    },

    removePluginState(pluginId) {
      if (this.pluginStates[pluginId]) {
        delete this.pluginStates[pluginId]
        console.log(`Plugin state removed from store: ${pluginId}`)
      }
    },

    clearAllPluginStates() {
      this.pluginStates = {}
      console.log('All plugin states cleared from store')
    }
  }
})
