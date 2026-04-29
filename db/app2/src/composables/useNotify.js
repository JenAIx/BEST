/**
 * useNotify
 *
 * Thin wrapper around `$q.notify` so pages and components stop importing
 * `useQuasar` just to call notify, and so we have one place to standardise
 * defaults (position, timeout) and add behaviour later (e.g. dedup, throttle).
 *
 * Stores must NEVER call this — they throw and let the caller decide whether
 * to surface the error to the user.
 *
 * Usage:
 *   const notify = useNotify()
 *   notify.success(t('settings.profileUpdatedSuccess'))
 *   notify.error(err.message)
 */

import { useQuasar } from 'quasar'

const DEFAULT_OPTIONS = {
  position: 'top',
  timeout: 3000,
}

export function useNotify() {
  const $q = useQuasar()

  const make = (type) => (message, opts = {}) =>
    $q.notify({ ...DEFAULT_OPTIONS, type, message, ...opts })

  return {
    success: make('positive'),
    error: make('negative'),
    warning: make('warning'),
    info: make('info'),
  }
}
