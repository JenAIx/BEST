/**
 * Logging Store
 * 
 * Pinia store that provides reactive access to logging functionality
 * and integrates the logging service with the Vue.js application.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import loggingService, { createLogger } from '../core/services/logging-service.js'

export const useLoggingStore = defineStore('logging', () => {
  // State
  const isLoggingEnabled = ref(true)
  const currentLogLevel = ref(loggingService.getLogLevelName(loggingService.logLevel))
  const logs = ref([])
  const stats = ref({})
  
  // Getters
  const recentLogs = computed(() => logs.value.slice(-50))
  const errorLogs = computed(() => logs.value.filter(log => log.level === 'ERROR'))
  const warningLogs = computed(() => logs.value.filter(log => log.level === 'WARN'))
  const hasErrors = computed(() => errorLogs.value.length > 0)
  const hasWarnings = computed(() => warningLogs.value.length > 0)
  
  const logStats = computed(() => ({
    total: logs.value.length,
    errors: errorLogs.value.length,
    warnings: warningLogs.value.length,
    ...stats.value
  }))
  
  // Actions
  const refreshLogs = () => {
    logs.value = loggingService.getRecentLogs(100)
    stats.value = loggingService.getStats()
  }
  
  const clearLogs = () => {
    loggingService.clearLogs()
    refreshLogs()
  }
  
  const setLogLevel = (level) => {
    loggingService.logLevel = loggingService.levels[level] || loggingService.levels.INFO
    currentLogLevel.value = level
    loggingService.info('LoggingStore', `Log level changed to ${level}`)
  }
  
  const toggleLogging = () => {
    isLoggingEnabled.value = !isLoggingEnabled.value
    loggingService.info('LoggingStore', `Logging ${isLoggingEnabled.value ? 'enabled' : 'disabled'}`)
  }
  
  const exportLogs = () => {
    const exported = loggingService.exportLogs()
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `app-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    loggingService.success('LoggingStore', 'Logs exported successfully')
  }
  
  // Convenience logging methods that update the store
  const debug = (context, message, data) => {
    if (isLoggingEnabled.value) {
      loggingService.debug(context, message, data)
      refreshLogs()
    }
  }
  
  const info = (context, message, data) => {
    if (isLoggingEnabled.value) {
      loggingService.info(context, message, data)
      refreshLogs()
    }
  }
  
  const success = (context, message, data) => {
    if (isLoggingEnabled.value) {
      loggingService.success(context, message, data)
      refreshLogs()
    }
  }
  
  const warn = (context, message, data) => {
    if (isLoggingEnabled.value) {
      loggingService.warn(context, message, data)
      refreshLogs()
    }
  }
  
  const error = (context, message, err, data) => {
    if (isLoggingEnabled.value) {
      loggingService.error(context, message, err, data)
      refreshLogs()
    }
  }
  
  const logUserAction = (action, details) => {
    if (isLoggingEnabled.value) {
      loggingService.logUserAction(action, details)
      refreshLogs()
    }
  }
  
  const logNavigation = (from, to, method) => {
    if (isLoggingEnabled.value) {
      loggingService.logNavigation(from, to, method)
      refreshLogs()
    }
  }
  
  const startTimer = (label) => {
    return loggingService.startTimer(label)
  }
  
  // Initialize
  refreshLogs()
  
  return {
    // State
    isLoggingEnabled,
    currentLogLevel,
    logs,
    stats,
    
    // Getters
    recentLogs,
    errorLogs,
    warningLogs,
    hasErrors,
    hasWarnings,
    logStats,
    
    // Actions
    refreshLogs,
    clearLogs,
    setLogLevel,
    toggleLogging,
    exportLogs,
    
    // Logging methods
    debug,
    info,
    success,
    warn,
    error,
    logUserAction,
    logNavigation,
    startTimer,
    
    // Service access
    createLogger: (context) => createLogger(context),
    service: loggingService
  }
})
