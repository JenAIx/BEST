/**
 * @vitest-environment jsdom
 *
 * Tests for the new `redirectOnCreate` prop on CreatePatientDialog.
 *
 * Default behaviour: after a successful create the dialog calls
 *   router.push(`/visits/${PATIENT_CD}`)
 * which is the right thing for the Dashboard / PatientSelector call sites
 * but wrong for the data-grid editor (the user expects to stay in the grid
 * and see the new patient appear as a row).
 *
 * Strategy: mock the database store + router, mount the dialog, fill the
 * minimal required form fields, submit, and assert on router.push +
 * `patientCreated` emit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

vi.mock('quasar', () => ({
  useQuasar: () => ({ notify: vi.fn() }),
}))

const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

const createPatientMock = vi.fn()
const findPatientByCodeMock = vi.fn().mockResolvedValue(null)
vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    createPatient: createPatientMock,
    findPatientByCode: findPatientByCodeMock,
    canPerformOperations: true,
    isConnected: true,
  }),
}))

vi.mock('src/stores/concept-resolution-store', () => ({
  useConceptResolutionStore: () => ({
    resolveConceptName: vi.fn().mockResolvedValue(''),
    getCachedConceptOptions: vi.fn().mockReturnValue([]),
    initialize: vi.fn().mockResolvedValue(undefined),
    getFallbackOptions: vi.fn().mockReturnValue([]),
    loadConceptOptions: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('src/stores/global-settings-store', () => ({
  useGlobalSettingsStore: () => ({
    getDefaultSourceSystem: vi.fn().mockResolvedValue('TEST_SYSTEM'),
    getDefaultCategory: vi.fn().mockResolvedValue('General'),
    getValueTypeOptions: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      debug: vi.fn(), success: vi.fn(),
    }),
  }),
}))

const { default: CreatePatientDialog } = await import('src/components/patient/CreatePatientDialog.vue')

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const mountDialog = (propsOverride = {}) =>
  mount(CreatePatientDialog, {
    props: { modelValue: true, ...propsOverride },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

describe('CreatePatientDialog redirectOnCreate prop', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPushMock.mockReset()
    createPatientMock.mockReset()
    createPatientMock.mockResolvedValue({
      PATIENT_CD: 'TEST_GRID_001',
      PATIENT_NUM: 4242,
    })
    findPatientByCodeMock.mockClear()
    findPatientByCodeMock.mockResolvedValue(null)
  })

  it('default (true): router.push is called after a successful create', async () => {
    const wrapper = mountDialog() // default redirectOnCreate = true
    await flushPromises()

    // Drive the save handler directly — the form rendering matters less
    // than the post-save branching being tested here.
    wrapper.vm.formData.PATIENT_CD = 'TEST_GRID_001'
    await nextTick()
    await wrapper.vm.handleSubmit()
    await flushPromises()

    expect(createPatientMock).toHaveBeenCalledOnce()
    expect(routerPushMock).toHaveBeenCalledOnce()
    expect(routerPushMock.mock.calls[0][0]).toBe('/visits/TEST_GRID_001')

    const emitted = wrapper.emitted('patientCreated') || []
    expect(emitted.length).toBe(1)
    expect(emitted[0][0]).toMatchObject({ PATIENT_CD: 'TEST_GRID_001', PATIENT_NUM: 4242 })
  })

  it('redirectOnCreate=false: router.push is NOT called, emit still fires', async () => {
    const wrapper = mountDialog({ redirectOnCreate: false })
    await flushPromises()

    wrapper.vm.formData.PATIENT_CD = 'TEST_GRID_001'
    await nextTick()
    await wrapper.vm.handleSubmit()
    await flushPromises()

    expect(createPatientMock).toHaveBeenCalledOnce()
    expect(routerPushMock).not.toHaveBeenCalled()

    const emitted = wrapper.emitted('patientCreated') || []
    expect(emitted.length).toBe(1)
    expect(emitted[0][0]).toMatchObject({ PATIENT_CD: 'TEST_GRID_001' })
  })
})
