import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLocalSettingsStore = defineStore('localSettings', () => {
  // Storage key for localStorage
  const STORAGE_KEY = 'best-medical-local-settings'

  // Default settings
  const defaultSettings = {
    patientObservations: {
      sortMode: 'category', // Default to category sorting
    },
    dataGrid: {
      selectedPatientIds: [], // Store selected patient IDs for Data Grid
      lastUsed: null, // Timestamp of last usage
    },
    databases: {
      customPaths: {
        // Custom folder paths for each database type
        // Key format: database name, Value: custom folder path (null = use default)
        production: null,
        development: null,
        demo: null,
      },
      lastUpdated: null, // Timestamp of last database path update
    },
  }

  // Reactive settings state
  const settings = ref({ ...defaultSettings })

  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedSettings = JSON.parse(stored)
        // Merge with defaults to ensure all properties exist
        settings.value = {
          ...defaultSettings,
          ...parsedSettings,
          patientObservations: {
            ...defaultSettings.patientObservations,
            ...(parsedSettings.patientObservations || {}),
          },
          dataGrid: {
            ...defaultSettings.dataGrid,
            ...(parsedSettings.dataGrid || {}),
          },
          databases: {
            ...defaultSettings.databases,
            ...(parsedSettings.databases || {}),
            customPaths: {
              ...defaultSettings.databases.customPaths,
              ...(parsedSettings.databases?.customPaths || {}),
            },
          },
        }
      }
    } catch (error) {
      console.warn('Failed to load local settings from localStorage:', error)
      settings.value = { ...defaultSettings }
    }
  }

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (error) {
      console.warn('Failed to save local settings to localStorage:', error)
    }
  }

  // Watch for changes and auto-save
  watch(settings, saveSettings, { deep: true })

  // Patient Observations specific getters and setters
  const getPatientObservationsSortMode = () => {
    return settings.value.patientObservations.sortMode
  }

  const setPatientObservationsSortMode = (sortMode) => {
    settings.value.patientObservations.sortMode = sortMode
  }

  // Generic getter/setter for future extensibility
  const getSetting = (path, defaultValue = null) => {
    const keys = path.split('.')
    let current = settings.value

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return defaultValue
      }
    }

    return current
  }

  const setSetting = (path, value) => {
    const keys = path.split('.')
    let current = settings.value

    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    // Set the final value
    current[keys[keys.length - 1]] = value
  }

  // Reset to defaults
  const resetSettings = () => {
    settings.value = { ...defaultSettings }
  }

  // Reset specific section
  const resetPatientObservationsSettings = () => {
    settings.value.patientObservations = { ...defaultSettings.patientObservations }
  }

  // Data Grid specific getters and setters
  const getDataGridSelectedPatients = () => {
    return settings.value.dataGrid.selectedPatientIds || []
  }

  const setDataGridSelectedPatients = (patientIds) => {
    settings.value.dataGrid.selectedPatientIds = patientIds
    settings.value.dataGrid.lastUsed = new Date().toISOString()
  }

  const clearDataGridSelectedPatients = () => {
    settings.value.dataGrid.selectedPatientIds = []
    settings.value.dataGrid.lastUsed = null
  }

  const hasDataGridSelectedPatients = () => {
    return settings.value.dataGrid.selectedPatientIds && settings.value.dataGrid.selectedPatientIds.length > 0
  }

  // Reset Data Grid settings
  const resetDataGridSettings = () => {
    settings.value.dataGrid = { ...defaultSettings.dataGrid }
  }

  // Database Path specific getters and setters
  const getDatabaseCustomPaths = () => {
    return settings.value.databases.customPaths || {}
  }

  const getDatabaseCustomPath = (databaseName) => {
    return settings.value.databases.customPaths?.[databaseName] || null
  }

  const setDatabaseCustomPath = (databaseName, customPath) => {
    if (!settings.value.databases.customPaths) {
      settings.value.databases.customPaths = {}
    }
    settings.value.databases.customPaths[databaseName] = customPath
    settings.value.databases.lastUpdated = new Date().toISOString()
  }

  const clearDatabaseCustomPath = (databaseName) => {
    if (settings.value.databases.customPaths) {
      settings.value.databases.customPaths[databaseName] = null
      settings.value.databases.lastUpdated = new Date().toISOString()
    }
  }

  const hasDatabaseCustomPaths = () => {
    const customPaths = settings.value.databases.customPaths || {}
    return Object.values(customPaths).some((path) => path !== null && path !== undefined)
  }

  // Build complete database path with custom folder
  const buildDatabasePath = (databaseName, defaultFilename) => {
    const customPath = getDatabaseCustomPath(databaseName)
    if (customPath) {
      // Ensure the custom path ends with a separator
      const normalizedPath = customPath.endsWith('/') || customPath.endsWith('\\') ? customPath : customPath + '/'
      return normalizedPath + defaultFilename
    }
    // Return default path
    return `./database/${defaultFilename}`
  }

  // Reset Database settings
  const resetDatabaseSettings = () => {
    settings.value.databases = { ...defaultSettings.databases }
  }

  // Initialize store
  const initialize = () => {
    loadSettings()
  }

  return {
    // State
    settings,

    // General methods
    initialize,
    loadSettings,
    saveSettings,
    resetSettings,
    getSetting,
    setSetting,

    // Patient Observations specific methods
    getPatientObservationsSortMode,
    setPatientObservationsSortMode,
    resetPatientObservationsSettings,

    // Data Grid specific methods
    getDataGridSelectedPatients,
    setDataGridSelectedPatients,
    clearDataGridSelectedPatients,
    hasDataGridSelectedPatients,
    resetDataGridSettings,

    // Database Path specific methods
    getDatabaseCustomPaths,
    getDatabaseCustomPath,
    setDatabaseCustomPath,
    clearDatabaseCustomPath,
    hasDatabaseCustomPaths,
    buildDatabasePath,
    resetDatabaseSettings,
  }
})
