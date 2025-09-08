/**
 * useLogger Composable
 *
 * Vue composable that provides easy access to logging functionality
 * in Vue components. Automatically sets the component name as context.
 */

import { getCurrentInstance } from 'vue'
import { useLoggingStore } from '../../stores/logging-store.js'

export function useLogger(customContext = null) {
  const instance = getCurrentInstance()
  const loggingStore = useLoggingStore()

  // Determine context from component name or use custom context
  const context = customContext || instance?.type?.name || instance?.type?.__name || 'Component'

  // Create logger methods with automatic context
  const logger = {
    debug: (message, data) => loggingStore.debug(context, message, data),
    info: (message, data) => loggingStore.info(context, message, data),
    success: (message, data) => loggingStore.success(context, message, data),
    warn: (message, data) => loggingStore.warn(context, message, data),
    error: (message, err, data) => loggingStore.error(context, message, err, data),

    // User action logging
    logAction: (action, details) =>
      loggingStore.logUserAction(action, {
        component: context,
        ...details,
      }),

    // Navigation logging
    logNavigation: (from, to, method) => loggingStore.logNavigation(from, to, method),

    // Performance timing
    startTimer: (label) => loggingStore.startTimer(`${context}: ${label}`),

    // Component lifecycle logging
    logMounted: (data) => loggingStore.debug(context, 'Component mounted', data),
    logUnmounted: (data) => loggingStore.debug(context, 'Component unmounted', data),
    logUpdated: (data) => loggingStore.debug(context, 'Component updated', data),

    // Form logging
    logFormSubmit: (formName, data) => loggingStore.info(context, `Form submitted: ${formName}`, data),
    logFormError: (formName, error, data) => loggingStore.error(context, `Form error: ${formName}`, error, data),
    logFormValidation: (formName, isValid, errors) =>
      loggingStore.debug(context, `Form validation: ${formName}`, {
        isValid,
        errors,
      }),

    // API logging helpers
    logApiCall: (method, url, status, duration, data) => {
      const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info'
      loggingStore[level](context, `API ${method} ${url}`, {
        method,
        url,
        status,
        duration: `${duration}ms`,
        ...data,
      })
    },

    // Data loading logging
    logDataLoad: (dataType, count, duration) =>
      loggingStore.info(context, `Loaded ${dataType}`, {
        dataType,
        count,
        duration: `${duration}ms`,
      }),
    logDataError: (dataType, error) => loggingStore.error(context, `Failed to load ${dataType}`, error),

    // UI interaction logging
    logClick: (element, data) => loggingStore.debug(context, `Clicked: ${element}`, data),
    logInput: (field, value) => loggingStore.debug(context, `Input changed: ${field}`, { field, value }),
    logSelection: (item, data) => loggingStore.debug(context, `Selected: ${item}`, data),

    // Context and store access
    context,
    store: loggingStore,
  }

  return logger
}

// Export convenience function for non-component usage
export function createComponentLogger(componentName) {
  return useLogger(componentName)
}
