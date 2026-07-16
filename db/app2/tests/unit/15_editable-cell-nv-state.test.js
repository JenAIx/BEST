/**
 * @vitest-environment jsdom
 *
 * Unit tests for the 3-state numeric edit flow in EditableCell.vue.
 *
 * The 3-state pattern (CLAUDE.md "3-state pattern for numerics") needs four
 * distinct state transitions to round-trip cleanly through the cell editor:
 *
 *   1. value → value     UPDATE sets NVAL_NUM, clears VALUEFLAG_CD
 *   2. value → NV        UPDATE sets NVAL_NUM=NULL, VALUEFLAG_CD='NV'
 *   3. NV → value        UPDATE sets NVAL_NUM=<n>, clears VALUEFLAG_CD
 *   4. value → cleared   DELETE the observation row (back to "not assessed")
 *
 * We mount EditableCell with stubbed stores and inspect the SQL fired against
 * dbStore.executeQuery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

vi.mock('quasar', () => ({
  useQuasar: () => ({ notify: vi.fn() }),
}))

const executeQueryMock = vi.fn()
const createObservationMock = vi.fn().mockResolvedValue({ OBSERVATION_ID: 999 })
vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    getRepository: () => ({
      createObservation: createObservationMock,
    }),
  }),
}))

vi.mock('src/stores/concept-resolution-store', () => ({
  useConceptResolutionStore: () => ({ initialize: vi.fn() }),
}))

vi.mock('src/stores/global-settings-store', () => ({
  useGlobalSettingsStore: () => ({
    getDefaultSourceSystem: vi.fn().mockResolvedValue('TEST_SYSTEM'),
    getDefaultCategory: vi.fn().mockResolvedValue('Stroke'),
  }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
    }),
  }),
}))

const { default: EditableCell } = await import('src/components/datagrid/EditableCell.vue')

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function makeWrapper(propsOverride = {}) {
  return mount(EditableCell, {
    props: {
      value: '',
      valueType: 'N',
      conceptCode: 'STROKE_LIPID:DRUG:ATORVASTATIN',
      patientId: '20015823',
      encounterNum: 42,
      observationId: 100,
      valueFlag: null,
      ...propsOverride,
    },
    global: { plugins: [i18n] },
  })
}

describe('EditableCell 3-state numeric edit flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockResolvedValue({ success: true, data: [{ PATIENT_NUM: 1, START_DATE: '2026-01-01' }] })
    createObservationMock.mockClear()
    createObservationMock.mockResolvedValue({ OBSERVATION_ID: 999 })
  })

  it('value → value: UPDATE sets NVAL_NUM and clears VALUEFLAG_CD', async () => {
    const wrapper = makeWrapper({ value: 40, observationId: 100, valueFlag: null })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    // Edit
    wrapper.vm.editValue = 80
    await wrapper.vm.saveEdit()
    await flushPromises()

    const updateCall = executeQueryMock.mock.calls.find((c) => /UPDATE OBSERVATION_FACT/.test(c[0]))
    expect(updateCall).toBeTruthy()
    const [sql, params] = updateCall
    expect(sql).toContain('NVAL_NUM = ?')
    expect(sql).toContain('TVAL_CHAR = ?')
    expect(sql).toContain('VALUEFLAG_CD = ?')
    // NVAL_NUM=80, TVAL_CHAR=null, VALUEFLAG_CD=null, observationId=100
    expect(params).toEqual([80, null, null, 'SYSTEM', 100])
  })

  it('value → NV: UPDATE clears NVAL_NUM and sets VALUEFLAG_CD=NV', async () => {
    const wrapper = makeWrapper({ value: 40, observationId: 100, valueFlag: null })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    wrapper.vm.toggleEditFlag() // flip into NV mode
    await wrapper.vm.saveEdit()
    await flushPromises()

    const updateCall = executeQueryMock.mock.calls.find((c) => /UPDATE OBSERVATION_FACT/.test(c[0]))
    expect(updateCall).toBeTruthy()
    const [, params] = updateCall
    expect(params).toEqual([null, null, 'NV', 'SYSTEM', 100])
  })

  it('NV → value: UPDATE sets NVAL_NUM and clears VALUEFLAG_CD', async () => {
    const wrapper = makeWrapper({ value: '', observationId: 100, valueFlag: 'NV' })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    // Toggle out of NV mode and enter a value
    wrapper.vm.toggleEditFlag()
    wrapper.vm.editValue = 40
    await wrapper.vm.saveEdit()
    await flushPromises()

    const updateCall = executeQueryMock.mock.calls.find((c) => /UPDATE OBSERVATION_FACT/.test(c[0]))
    expect(updateCall).toBeTruthy()
    const [, params] = updateCall
    expect(params).toEqual([40, null, null, 'SYSTEM', 100])
  })

  it('value → cleared: DELETE the observation row', async () => {
    const wrapper = makeWrapper({ value: 40, observationId: 100, valueFlag: null })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    wrapper.vm.editValue = '' // clear the cell
    await wrapper.vm.saveEdit()
    await flushPromises()

    const deleteCall = executeQueryMock.mock.calls.find((c) => /DELETE FROM OBSERVATION_FACT/.test(c[0]))
    expect(deleteCall).toBeTruthy()
    expect(deleteCall[1]).toEqual([100])
  })

  it('NV → NV (no change): does not write to DB', async () => {
    const wrapper = makeWrapper({ value: '', observationId: 100, valueFlag: 'NV' })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    // No state change — just blur
    await wrapper.vm.saveEdit()
    await flushPromises()

    const updateCall = executeQueryMock.mock.calls.find((c) => /UPDATE|DELETE/.test(c[0]))
    expect(updateCall).toBeFalsy()
  })

  it('emit("update") payload carries the new valueFlag so the grid mirrors it locally', async () => {
    // Regression: without valueFlag in the emit, handleCellUpdate would
    // leave row.observations[code].valueFlag stale (null) even though
    // VALUEFLAG_CD='NV' was persisted — the cell would render empty until
    // a full reload.
    const wrapper = makeWrapper({ value: 40, observationId: 100, valueFlag: null })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    wrapper.vm.toggleEditFlag() // flip into NV — fires saveEdit internally
    await flushPromises()

    const updateEvents = wrapper.emitted('update') || []
    expect(updateEvents.length).toBeGreaterThanOrEqual(1)
    // The pre-save emit (or the post-save one for INSERT) must include valueFlag='NV'
    expect(updateEvents.some((args) => args[0]?.valueFlag === 'NV')).toBe(true)
  })

  it('value → value: emit("update") payload carries valueFlag=null (clears stale flag)', async () => {
    const wrapper = makeWrapper({ value: '', observationId: 100, valueFlag: 'NV' })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    wrapper.vm.toggleEditFlag() // out of NV
    wrapper.vm.editValue = 40
    await wrapper.vm.saveEdit()
    await flushPromises()

    const updateEvents = wrapper.emitted('update') || []
    expect(updateEvents.length).toBeGreaterThanOrEqual(1)
    // After flipping out of NV and entering a value, the emit must clear valueFlag
    expect(updateEvents[0][0]?.valueFlag).toBeNull()
  })

  it('empty → NV: toggleEditFlag auto-commits via INSERT (no blur trigger possible)', async () => {
    // The q-input is unmounted when the editor flips into NV mode, so the
    // user's only path to commit is via toggleEditFlag itself. Regression
    // for the bug where clicking the inline NV button on an empty cell
    // left the editor in NV-mode but never wrote to the DB.
    const wrapper = makeWrapper({
      value: '',
      observationId: null, // empty cell
      valueFlag: null,
    })

    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    // Flip into NV via the inline toggle — this MUST persist.
    wrapper.vm.toggleEditFlag()
    await flushPromises()

    // Patient + visit lookups happen via executeQuery; the actual INSERT
    // goes through the observation repository.
    expect(createObservationMock).toHaveBeenCalledOnce()
    const obs = createObservationMock.mock.calls[0][0]
    expect(obs.NVAL_NUM).toBeNull()
    expect(obs.VALUEFLAG_CD).toBe('NV')
    expect(obs.VALTYPE_CD).toBe('N')
    expect(obs.CONCEPT_CD).toBe('STROKE_LIPID:DRUG:ATORVASTATIN')
  })

  it('NV state shows the placeholder and the toggle is highlighted', async () => {
    const wrapper = makeWrapper({ value: '', observationId: 100, valueFlag: 'NV' })
    await wrapper.find('.editable-cell').trigger('click')
    await nextTick()
    expect(wrapper.find('.nv-placeholder').exists()).toBe(true)
    expect(wrapper.vm.editFlagNV).toBe(true)
  })
})
