/**
 * @vitest-environment jsdom
 *
 * Regression tests for StudyMembershipMenuItems + usePatientStudyActions:
 *
 * 1. Unmount survival: the component lives inside q-menu content and is
 *    unmounted the moment v-close-popup fires. A plain defineEmits('changed')
 *    after the awaited DB write is silently dropped on an unmounted instance —
 *    the parent list never refreshed. The fix declares `onChanged` as a
 *    Function prop and captures it in the handler closure BEFORE awaiting.
 *
 * 2. Confirmed change details: onChanged fires only after the DB write
 *    succeeded and carries {type, studyNum, patientNum, status} so parents
 *    can patch the affected card in place instead of reloading the page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

const updateEnrollmentStatusMock = vi.fn()
const getPatientStudiesMock = vi.fn()
const enrollPatientMock = vi.fn().mockResolvedValue({ success: true })
const withdrawPatientMock = vi.fn().mockResolvedValue(true)
const executeQueryMock = vi.fn().mockResolvedValue({
  success: true,
  data: [{ STUDY_NUM: 4, STUDY_CD: 'STROKE_LIPID', NAME_CHAR: 'Stroke Lipid' }],
})

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    updateEnrollmentStatus: updateEnrollmentStatusMock,
    getRepository: () => ({
      getPatientStudies: getPatientStudiesMock,
      enrollPatient: enrollPatientMock,
      withdrawPatient: withdrawPatientMock,
    }),
  }),
}))

vi.mock('src/composables/useNotify', () => ({
  useNotify: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      debug: vi.fn(), success: vi.fn(),
    }),
  }),
}))

const { default: StudyMembershipMenuItems } = await import('src/components/shared/StudyMembershipMenuItems.vue')

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const mountMenu = (onChanged) =>
  mount(StudyMembershipMenuItems, {
    props: { patient: { PATIENT_NUM: 42, id: 'P42' }, onChanged },
    global: { plugins: [i18n] },
  })

describe('StudyMembershipMenuItems — onChanged survives menu close (unmount)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getPatientStudiesMock.mockResolvedValue([
      { STUDY_NUM: 4, NAME_CHAR: 'Stroke Lipid', ENROLLMENT_STATUS_CD: 'active' },
    ])
  })

  it('status change: confirmed detail fires even when the component unmounts mid-write', async () => {
    const changedSpy = vi.fn()
    let resolveWrite
    updateEnrollmentStatusMock.mockReturnValue(new Promise((resolve) => { resolveWrite = resolve }))

    const wrapper = mountMenu(changedSpy)
    await flushPromises()

    const member = wrapper.vm.memberItems[0]
    expect(member).toMatchObject({ studyNum: 4, status: 'active' })

    // Start the status change, then unmount BEFORE the DB write resolves —
    // exactly what v-close-popup does to the menu content.
    const pending = wrapper.vm.onSetStatus(member, 'completed')
    wrapper.unmount()
    resolveWrite(true)
    await pending

    expect(updateEnrollmentStatusMock).toHaveBeenCalledWith(4, [42], 'completed')
    expect(changedSpy).toHaveBeenCalledTimes(1)
    expect(changedSpy).toHaveBeenCalledWith({ type: 'status', studyNum: 4, patientNum: 42, status: 'completed' })
  })

  it('withdraw: confirmed detail fires after unmount too', async () => {
    const changedSpy = vi.fn()
    const wrapper = mountMenu(changedSpy)
    await flushPromises()

    const study = wrapper.vm.studyItems[0]
    expect(study.enrolled).toBe(true)
    const pending = wrapper.vm.onToggleMembership(study)
    wrapper.unmount()
    await pending

    expect(withdrawPatientMock).toHaveBeenCalledWith(4, 42)
    expect(changedSpy).toHaveBeenCalledWith({ type: 'withdraw', studyNum: 4, patientNum: 42, status: 'withdrawn' })
  })

  it('enroll: toggling a non-enrolled study enrolls and reports the detail', async () => {
    getPatientStudiesMock.mockResolvedValue([])
    const changedSpy = vi.fn()
    const wrapper = mountMenu(changedSpy)
    await flushPromises()

    const study = wrapper.vm.studyItems[0]
    expect(study.enrolled).toBe(false)
    await wrapper.vm.onToggleMembership(study)

    expect(enrollPatientMock).toHaveBeenCalledWith(4, 42, expect.objectContaining({ ENROLLMENT_STATUS_CD: 'active' }))
    expect(changedSpy).toHaveBeenCalledWith({ type: 'enroll', studyNum: 4, patientNum: 42, status: 'active' })
  })

  it('status change is a no-op when the status is unchanged', async () => {
    const changedSpy = vi.fn()
    const wrapper = mountMenu(changedSpy)
    await flushPromises()

    await wrapper.vm.onSetStatus(wrapper.vm.memberItems[0], 'active')

    expect(updateEnrollmentStatusMock).not.toHaveBeenCalled()
    expect(changedSpy).not.toHaveBeenCalled()
  })

  it('onChanged does NOT fire when the DB write fails', async () => {
    updateEnrollmentStatusMock.mockRejectedValue(new Error('db down'))
    const changedSpy = vi.fn()
    const wrapper = mountMenu(changedSpy)
    await flushPromises()

    await wrapper.vm.onSetStatus(wrapper.vm.memberItems[0], 'completed')

    expect(changedSpy).not.toHaveBeenCalled()
  })
})
