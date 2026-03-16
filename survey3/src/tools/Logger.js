const LOG_LEVEL = process.env.LOG_LEVEL || 'warn'
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

function log(payload) {
  if (payload.error) {
    console.error('[surveyBEST]', payload.error, payload.data || '')
  } else if (payload.warn) {
    if (LEVELS[LOG_LEVEL] >= LEVELS.warn) {
      console.warn('[surveyBEST]', payload.warn, payload.data || '')
    }
  } else if (payload.debug) {
    if (LEVELS[LOG_LEVEL] >= LEVELS.debug) {
      console.debug('[surveyBEST]', payload.debug, payload.data || '')
    }
  } else if (payload.message) {
    if (LEVELS[LOG_LEVEL] >= LEVELS.info) {
      console.info('[surveyBEST]', payload.message, payload.data || '')
    }
  }
}

export { log }
