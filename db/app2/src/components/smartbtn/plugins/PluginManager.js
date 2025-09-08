/**
 * Plugin Manager for SmartButton
 * Manages registration and lifecycle of SmartButton plugins
 */

class PluginManager {
  constructor() {
    this.plugins = new Map()
    this.activePlugin = null
  }

  /**
   * Register a new plugin
   * @param {Object} plugin - Plugin configuration
   * @param {string} plugin.id - Unique plugin identifier
   * @param {string} plugin.name - Display name for the plugin
   * @param {string} plugin.icon - Icon name for the FAB action
   * @param {string} plugin.color - Color for the FAB action
   * @param {Object} plugin.component - Vue component for the plugin
   * @param {string} plugin.tooltip - Tooltip text for the FAB action
   * @param {Object} plugin.config - Additional plugin configuration
   */
  register(plugin) {
    if (!plugin.id || !plugin.name || !plugin.component) {
      throw new Error('Plugin must have id, name, and component')
    }

    const pluginConfig = {
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon || 'extension',
      color: plugin.color || 'primary',
      tooltip: plugin.tooltip || plugin.name,
      component: plugin.component,
      config: plugin.config || {},
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
}

// Create a singleton instance
const pluginManager = new PluginManager()

export default pluginManager
