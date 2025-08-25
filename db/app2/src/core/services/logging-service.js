/**
 * Logging Service
 *
 * Centralized logging system for the BEST medical application.
 * Provides structured logging with different levels, context tracking,
 * and optional persistence for debugging and audit trails.
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error, success)
 * - Context-aware logging with component/store identification
 * - Structured log format with timestamps and metadata
 * - Console output with color coding
 * - Optional log persistence to database/file
 * - Performance timing utilities
 * - Error tracking and reporting
 */

class LoggingService {
  constructor() {
    // Log levels hierarchy - must be defined first
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      SUCCESS: 2,
      WARN: 3,
      ERROR: 4,
    }

    this.logLevel = this.getLogLevel()
    this.logs = []
    this.maxLogs = 1000 // Keep last 1000 logs in memory
    this.context = null
    this.sessionId = this.generateSessionId()
    this.startTime = Date.now()

    // Console colors for different log levels
    this.colors = {
      DEBUG: '#6B7280', // Gray
      INFO: '#3B82F6', // Blue
      SUCCESS: '#10B981', // Green
      WARN: '#F59E0B', // Amber
      ERROR: '#EF4444', // Red
    }

    this.init()
  }

  /**
   * Initialize the logging service
   */
  init() {
    this.info('LoggingService', 'Logging service initialized', {
      sessionId: this.sessionId,
      logLevel: this.getLogLevelName(this.logLevel),
      timestamp: new Date().toISOString(),
    })

    // Set up global error handler
    this.setupGlobalErrorHandler()
  }

  /**
   * Get current log level from environment or default
   */
  getLogLevel() {
    // Handle both Node.js and browser environments
    let envLevel = 'INFO'

    try {
      // Try to access process.env (available in Node.js/Electron main process)
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
        envLevel = process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO'
      } else if (typeof window !== 'undefined' && window.location) {
        // Browser/Electron renderer fallback - check for development indicators
        const isDevelopment =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.port !== '' ||
          window.location.protocol === 'file:'
        envLevel = isDevelopment ? 'DEBUG' : 'INFO'
      } else {
        // Default fallback for other environments (like tests)
        envLevel = 'INFO'
      }
    } catch {
      // Fallback to INFO if any error occurs
      envLevel = 'INFO'
    }

    return this.levels[envLevel] || this.levels.INFO
  }

  /**
   * Get log level name from numeric value
   */
  getLogLevelName(level) {
    return Object.keys(this.levels).find((key) => this.levels[key] === level) || 'INFO'
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Set logging context (component/store name)
   */
  setContext(context) {
    this.context = context
    return this
  }

  /**
   * Create a new logger instance with context
   */
  createLogger(context) {
    const logger = Object.create(this)
    logger.context = context
    return logger
  }

  /**
   * Core logging method
   */
  log(level, context, message, data = null, error = null) {
    // Check if log level should be output
    if (this.levels[level] < this.logLevel) {
      return
    }

    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      context: context || this.context || 'App',
      message,
      data,
      error: error ? this.serializeError(error) : null,
      sessionId: this.sessionId,
      uptime: Date.now() - this.startTime,
    }

    // Add to memory logs
    this.addToMemoryLogs(logEntry)

    // Output to console
    this.outputToConsole(logEntry)

    // Persist if needed (async, don't block)
    this.persistLog(logEntry).catch(() => {
      // Silent fail for persistence
    })

    return logEntry
  }

  /**
   * Debug level logging
   */
  debug(context, message, data = null) {
    return this.log('DEBUG', context, message, data)
  }

  /**
   * Info level logging
   */
  info(context, message, data = null) {
    return this.log('INFO', context, message, data)
  }

  /**
   * Success level logging
   */
  success(context, message, data = null) {
    return this.log('SUCCESS', context, message, data)
  }

  /**
   * Warning level logging
   */
  warn(context, message, data = null) {
    return this.log('WARN', context, message, data)
  }

  /**
   * Error level logging
   */
  error(context, message, error = null, data = null) {
    return this.log('ERROR', context, message, data, error)
  }

  /**
   * Performance timing utilities
   */
  startTimer(label) {
    const timer = {
      label,
      startTime: performance.now(),
      context: this.context,
    }

    return {
      end: () => {
        const duration = performance.now() - timer.startTime
        this.debug(timer.context, `Timer: ${label}`, {
          duration: `${duration.toFixed(2)}ms`,
          label,
        })
        return duration
      },
    }
  }

  /**
   * Log API calls
   */
  logApiCall(method, url, status, duration, data = null) {
    const level = status >= 400 ? 'ERROR' : status >= 300 ? 'WARN' : 'INFO'
    this.log(level, 'API', `${method} ${url}`, {
      method,
      url,
      status,
      duration: `${duration}ms`,
      ...data,
    })
  }

  /**
   * Log database operations
   */
  logDbOperation(operation, table, duration, recordCount = null, error = null) {
    const level = error ? 'ERROR' : 'DEBUG'
    this.log(
      level,
      'Database',
      `${operation} on ${table}`,
      {
        operation,
        table,
        duration: `${duration}ms`,
        recordCount,
        success: !error,
      },
      error,
    )
  }

  /**
   * Log user actions
   */
  logUserAction(action, details = null) {
    this.info('UserAction', action, {
      action,
      timestamp: new Date().toISOString(),
      ...details,
    })
  }

  /**
   * Log navigation events
   */
  logNavigation(from, to, method = 'router') {
    this.debug('Navigation', `${from} → ${to}`, {
      from,
      to,
      method,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Add log entry to memory storage
   */
  addToMemoryLogs(logEntry) {
    this.logs.push(logEntry)

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * Output log entry to console with formatting
   */
  outputToConsole(logEntry) {
    const { timestamp, level, context, message, data, error } = logEntry
    const color = this.colors[level]
    const timeStr = new Date(timestamp).toLocaleTimeString()

    // Create formatted message
    const prefix = `%c[${timeStr}] ${level} [${context}]`
    const style = `color: ${color}; font-weight: bold;`

    // Choose console method based on level
    const consoleMethod =
      level === 'ERROR'
        ? 'error'
        : level === 'WARN'
          ? 'warn'
          : level === 'SUCCESS'
            ? 'info'
            : level === 'DEBUG'
              ? 'debug'
              : 'log'

    // Output main message
    console[consoleMethod](prefix, style, message)

    // Output data if present
    if (data) {
      console.groupCollapsed(`%c📊 Data`, `color: ${color}`)
      console.table ? console.table(data) : console.log(data)
      console.groupEnd()
    }

    // Output error if present
    if (error) {
      console.groupCollapsed(`%c❌ Error Details`, `color: ${this.colors.ERROR}`)
      console.error(error)
      console.groupEnd()
    }
  }

  /**
   * Serialize error object for logging
   */
  serializeError(error) {
    if (!error) return null

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
      details: error.details || null,
    }
  }

  /**
   * Persist log entry (override in subclasses for specific storage)
   */
  async persistLog(logEntry) {
    // Default implementation - could save to database, file, or external service
    // For now, we'll just store in localStorage for debugging (browser only)
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = JSON.parse(localStorage.getItem('app_logs') || '[]')
        stored.push(logEntry)

        // Keep only last 100 logs in localStorage
        const trimmed = stored.slice(-100)
        localStorage.setItem('app_logs', JSON.stringify(trimmed))
      }
    } catch {
      // Silent fail for localStorage
    }
  }

  /**
   * Set up global error handler
   */
  setupGlobalErrorHandler() {
    // Only set up browser-specific error handlers in browser environment
    if (typeof window !== 'undefined') {
      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.error('Global', 'Unhandled promise rejection', event.reason, {
          type: 'unhandledrejection',
          promise: event.promise,
        })
      })

      // Handle global errors
      window.addEventListener('error', (event) => {
        this.error('Global', 'Global error', event.error, {
          type: 'error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        })
      })
    } else if (typeof process !== 'undefined') {
      // Handle Node.js unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        this.error('Global', 'Unhandled promise rejection', reason, {
          type: 'unhandledRejection',
          promise: promise,
        })
      })

      // Handle Node.js uncaught exceptions
      process.on('uncaughtException', (error) => {
        this.error('Global', 'Uncaught exception', error, {
          type: 'uncaughtException',
        })
      })
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count = 50) {
    return this.logs.slice(-count)
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level) {
    return this.logs.filter((log) => log.level === level)
  }

  /**
   * Get logs by context
   */
  getLogsByContext(context) {
    return this.logs.filter((log) => log.context === context)
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = []
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_logs')
    }
    this.info('LoggingService', 'All logs cleared')
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      logLevel: this.getLogLevelName(this.logLevel),
      totalLogs: this.logs.length,
      logs: this.logs,
    }
  }

  /**
   * Get logging statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {},
      byContext: {},
      sessionId: this.sessionId,
      uptime: Date.now() - this.startTime,
    }

    // Count by level
    Object.keys(this.levels).forEach((level) => {
      stats.byLevel[level] = this.logs.filter((log) => log.level === level).length
    })

    // Count by context
    this.logs.forEach((log) => {
      stats.byContext[log.context] = (stats.byContext[log.context] || 0) + 1
    })

    return stats
  }
}

// Create singleton instance
const loggingService = new LoggingService()

export default loggingService

// Export convenience methods for direct use
export const logger = loggingService
export const createLogger = (context) => loggingService.createLogger(context)
export const debug = (context, message, data) => loggingService.debug(context, message, data)
export const info = (context, message, data) => loggingService.info(context, message, data)
export const success = (context, message, data) => loggingService.success(context, message, data)
export const warn = (context, message, data) => loggingService.warn(context, message, data)
export const error = (context, message, err, data) =>
  loggingService.error(context, message, err, data)
