/**
 * Plugin Manager for SmartButton
 * Manages registration and lifecycle of SmartButton plugins
 */

import { markRaw } from 'vue'

class PluginManager {
  constructor() {
    this.plugins = new Map()
    this.activePlugin = null
    this.pluginInstances = new Map() // Store component instances for state preservation
  }

  /**
   * Register a new plugin
   * @param {Object} plugin - Plugin configuration
   * @param {string} plugin.id - Unique plugin identifier
   * @param {string} plugin.name - Display name for the plugin
   * @param {string} plugin.icon - Icon name for the FAB action
   * @param {string} plugin.color - Color for the FAB action
   * @param {Function|Object} plugin.component - Vue component or lazy loader function for the plugin
   * @param {string} plugin.tooltip - Tooltip text for the FAB action
   * @param {Object} plugin.config - Additional plugin configuration
   */
  register(plugin) {
    if (!plugin.id || !plugin.name) {
      throw new Error('Plugin must have id and name')
    }

    const pluginConfig = {
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon || 'extension',
      color: plugin.color || 'primary',
      tooltip: plugin.tooltip || plugin.name,
      component: plugin.component, // Can be component or lazy loader function
      config: plugin.config || {},
      loaded: false, // Track if component has been loaded
      ...plugin
    }

    this.plugins.set(plugin.id, pluginConfig)
    console.log(`Plugin registered: ${plugin.name}`)
  }

  /**
   * Unregister a plugin
   * @param {string} pluginId - Plugin identifier
   */
  unregister(pluginId) {
    if (this.plugins.has(pluginId)) {
      this.plugins.delete(pluginId)
      console.log(`Plugin unregistered: ${pluginId}`)
    }
  }

  /**
   * Get all registered plugins
   * @returns {Array} Array of plugin configurations
   */
  getPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * Get a specific plugin by ID
   * @param {string} pluginId - Plugin identifier
   * @returns {Object|null} Plugin configuration or null if not found
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null
  }

  /**
   * Lazy load a plugin component
   * @param {string} pluginId - Plugin identifier
   * @returns {Promise<Object>} Plugin configuration with loaded component
   */
  async loadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    // If already loaded, return the plugin
    if (plugin.loaded) {
      return plugin
    }

    // If component is a function (lazy loader), call it
    if (typeof plugin.component === 'function') {
      try {
        const component = await plugin.component()
        // Use markRaw to prevent Vue from making the component reactive
        plugin.component = markRaw(component)
        plugin.loaded = true
        console.log(`Plugin component loaded: ${plugin.name}`)
      } catch (error) {
        console.error(`Failed to load plugin component: ${plugin.name}`, error)
        throw error
      }
    } else {
      // Component is already loaded (direct import) - mark as raw to be safe
      plugin.component = markRaw(plugin.component)
      plugin.loaded = true
    }

    return plugin
  }

  /**
   * Set the active plugin
   * @param {string} pluginId - Plugin identifier
   */
  setActivePlugin(pluginId) {
    this.activePlugin = pluginId
  }

  /**
   * Get the active plugin
   * @returns {Object|null} Active plugin configuration or null
   */
  getActivePlugin() {
    return this.activePlugin ? this.getPlugin(this.activePlugin) : null
  }

  /**
   * Clear the active plugin
   */
  clearActivePlugin() {
    this.activePlugin = null
  }

  /**
   * Check if a plugin is active
   * @param {string} pluginId - Plugin identifier
   * @returns {boolean} True if plugin is active
   */
  isActive(pluginId) {
    return this.activePlugin === pluginId
  }

  /**
   * Store a plugin instance for state preservation
   * @param {string} pluginId - Plugin identifier
   * @param {Object} instanceData - Instance data to store (component props, state, etc.)
   */
  storePluginInstance(pluginId, instanceData) {
    this.pluginInstances.set(pluginId, {
      config: instanceData.config || {},
      componentState: instanceData.componentState || {},
      storedAt: Date.now()
    })
    console.log(`Plugin instance stored: ${pluginId}`)
  }

  /**
   * Retrieve a stored plugin instance
   * @param {string} pluginId - Plugin identifier
   * @returns {Object|null} Stored instance data or null if not found
   */
  getStoredPluginInstance(pluginId) {
    const instance = this.pluginInstances.get(pluginId)
    if (instance) {
      console.log(`Plugin instance retrieved: ${pluginId}`)
      return instance
    }
    return null
  }

  /**
   * Check if a plugin has a stored instance
   * @param {string} pluginId - Plugin identifier
   * @returns {boolean} True if instance exists
   */
  hasStoredInstance(pluginId) {
    return this.pluginInstances.has(pluginId)
  }

  /**
   * Remove a stored plugin instance
   * @param {string} pluginId - Plugin identifier
   */
  removeStoredInstance(pluginId) {
    if (this.pluginInstances.has(pluginId)) {
      this.pluginInstances.delete(pluginId)
      console.log(`Plugin instance removed: ${pluginId}`)
    }
  }

  /**
   * Clear all stored plugin instances
   */
  clearAllStoredInstances() {
    this.pluginInstances.clear()
    console.log('All stored plugin instances cleared')
  }

  /**
   * Get all stored instance IDs
   * @returns {Array} Array of plugin IDs with stored instances
   */
  getStoredInstanceIds() {
    return Array.from(this.pluginInstances.keys())
  }
}

// Create a singleton instance
const pluginManager = new PluginManager()

export default pluginManager
