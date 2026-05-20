/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the UI-prep foundation pieces:
 *   1. useNotify() composable
 *   2. auth-store session monitor (start/stop/handleSessionExpired)
 *   3. App.vue top-level error boundary
 *
 * These guard against regressions in the small but load-bearing
 * pieces introduced in 22339a7 — they are deliberately narrow,
 * not exhaustive.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

// ---------------------------------------------------------------------------
// 1. useNotify composable
// ---------------------------------------------------------------------------

const notifyMock = vi.fn()

vi.mock('quasar', () => ({
  useQuasar: () => ({ notify: notifyMock }),
}))

const { useNotify } = await import('src/composables/useNotify')

describe('useNotify composable', () => {
  beforeEach(() => {
    notifyMock.mockClear()
  })

  it('success() forwards to $q.notify with positive type and project defaults', () => {
    const notify = useNotify()
    notify.success('hello')

    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'positive',
        message: 'hello',
        position: 'top',
        timeout: 3000,
      }),
    )
  })

  it('error() merges per-call options like caption and timeout', () => {
    const notify = useNotify()
    notify.error('boom', { caption: 'why', timeout: 7000 })

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'negative',
        message: 'boom',
        caption: 'why',
        timeout: 7000,
        position: 'top', // default still applied
      }),
    )
  })

  it('warning() and info() use the matching Quasar notify types', () => {
    const notify = useNotify()
    notify.warning('careful')
    notify.info('fyi')

    expect(notifyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'warning', message: 'careful' }),
    )
    expect(notifyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'info', message: 'fyi' }),
    )
  })

  it('per-call options can override defaults', () => {
    const notify = useNotify()
    notify.success('long', { timeout: 10000, position: 'bottom' })

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10000, position: 'bottom' }),
    )
  })
})

// ---------------------------------------------------------------------------
// 2. auth-store session monitor
// ---------------------------------------------------------------------------

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    selectDatabase: vi.fn(),
    disconnect: vi.fn(),
    getRepository: vi.fn(),
  }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    }),
  }),
}))

const { useAuthStore } = await import('src/stores/auth-store')

describe('auth-store session monitor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    // Reset hash so each test starts clean
    window.location.hash = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('startSessionMonitor sets _sessionMonitorId', () => {
    const store = useAuthStore()
    expect(store._sessionMonitorId).toBeNull()

    store.startSessionMonitor()
    expect(store._sessionMonitorId).not.toBeNull()

    store.stopSessionMonitor()
  })

  it('startSessionMonitor is idempotent — second call does not replace the interval', () => {
    const store = useAuthStore()
    store.startSessionMonitor()
    const firstId = store._sessionMonitorId

    store.startSessionMonitor()
    expect(store._sessionMonitorId).toBe(firstId)

    store.stopSessionMonitor()
  })

  it('stopSessionMonitor clears the id', () => {
    const store = useAuthStore()
    store.startSessionMonitor()
    expect(store._sessionMonitorId).not.toBeNull()

    store.stopSessionMonitor()
    expect(store._sessionMonitorId).toBeNull()
  })

  it('handleSessionExpired calls logout and bounces to /login?expired=true', async () => {
    const store = useAuthStore()
    const logoutSpy = vi.spyOn(store, 'logout').mockResolvedValue()

    await store.handleSessionExpired()

    expect(logoutSpy).toHaveBeenCalled()
    expect(window.location.hash).toBe('#/login?expired=true')
  })

  it('the monitor tick triggers handleSessionExpired when the session has elapsed', async () => {
    const store = useAuthStore()
    const expiredSpy = vi.spyOn(store, 'handleSessionExpired').mockResolvedValue()

    // Authenticated, lastActivity older than 30 min default sessionTimeout
    store.isAuthenticated = true
    store.lastActivity = Date.now() - 31 * 60 * 1000

    store.startSessionMonitor()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(expiredSpy).toHaveBeenCalled()
    store.stopSessionMonitor()
  })
})

// ---------------------------------------------------------------------------
// 3. App.vue error boundary
// ---------------------------------------------------------------------------

vi.mock('src/components/smartbtn/SmartButton.vue', () => ({
  default: { name: 'SmartButton', template: '<div />' },
}))

const App = (await import('src/App.vue')).default

const buildI18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: {
        common: { reload: 'Reload', goHome: 'Go Home' },
        errors: {
          unexpectedTitle: 'Unexpected error',
          unexpectedHint: 'Something went wrong, please reload.',
          detail: 'Detail',
        },
      },
    },
  })

describe('App.vue error boundary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the fallback UI when a descendant throws', async () => {
    const ThrowingChild = {
      name: 'ThrowingChild',
      setup() {
        throw new Error('boom from child')
      },
      template: '<div>never rendered</div>',
    }

    const wrapper = mount(App, {
      global: {
        plugins: [buildI18n()],
        stubs: {
          'router-view': ThrowingChild,
          'q-btn': {
            props: ['label'],
            template: '<button @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
          },
          'q-icon': true,
          'q-card': { template: '<div><slot /></div>' },
          'q-card-section': { template: '<div><slot /></div>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Unexpected error')
    expect(wrapper.text()).toContain('boom from child')
    expect(wrapper.find('.error-boundary').exists()).toBe(true)
  })

  it('clicking "Go Home" dismisses the boundary and sets the dashboard hash', async () => {
    const ThrowingChild = {
      name: 'ThrowingChild',
      setup() {
        throw new Error('boom')
      },
      template: '<div />',
    }

    const wrapper = mount(App, {
      global: {
        plugins: [buildI18n()],
        stubs: {
          'router-view': ThrowingChild,
          'q-btn': {
            props: ['label'],
            template: '<button @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
          },
          'q-icon': true,
          'q-card': { template: '<div><slot /></div>' },
          'q-card-section': { template: '<div><slot /></div>' },
        },
      },
    })

    await flushPromises()
    expect(wrapper.find('.error-boundary').exists()).toBe(true)

    // Find the "Go Home" button — it's the flat one (second button)
    const buttons = wrapper.findAll('button')
    const goHomeBtn = buttons.find((b) => b.text().includes('Go Home'))
    expect(goHomeBtn).toBeDefined()

    await goHomeBtn.trigger('click')
    await flushPromises()

    expect(window.location.hash).toBe('#/dashboard')
  })
})
