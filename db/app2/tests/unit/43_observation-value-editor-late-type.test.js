/**
 * @vitest-environment jsdom
 *
 * Regression test for the empty-dropdown bug in the unified edit grid
 * (bugfix/cannot_use_dropdown_observat):
 *
 * Blank form-grid fields mount with valueType 'T' because
 * ObservationFormGrid resolves the field-set concept types asynchronously
 * (resolveBatch in onMounted). When resolution completes, the SAME
 * ObservationValueEditor instance (v-for key = concept code, no remount)
 * receives the real type (e.g. 'F' for STROKE_LIPID:V1:NEW_MED). The editor
 * used to load its select options only in onMounted — so a late 'T' → 'F'
 * flip rendered a q-select with zero options: clickable but empty.
 *
 * The fix loads options via a watcher on the effective value type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const getFindingOptionsMock = vi.fn()
const getSelectionOptionsMock = vi.fn()
vi.mock('src/stores/concept-resolution-store', () => ({
  useConceptResolutionStore: () => ({
    getFindingOptions: getFindingOptionsMock,
    getSelectionOptions: getSelectionOptionsMock,
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

vi.mock('src/components/shared/FilePreviewDialog.vue', () => ({
  default: { name: 'FilePreviewDialog', template: '<div />' },
}))
vi.mock('src/components/shared/QuestionnairePreviewDialog.vue', () => ({
  default: { name: 'QuestionnairePreviewDialog', template: '<div />' },
}))

const { default: ObservationValueEditor } = await import('src/components/visits/ObservationValueEditor.vue')

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const CONCEPT_CODE = 'STROKE_LIPID:V1:NEW_MED'

const YES_NO = [
  { label: 'Yes', value: 'SCTID: 373066001' },
  { label: 'No', value: 'SCTID: 373067005' },
]

function makeProps(valueType) {
  return {
    rowData: {
      id: CONCEPT_CODE,
      key: CONCEPT_CODE,
      observationId: null,
      conceptCode: CONCEPT_CODE,
      valueType,
      currentValue: '',
      originalValue: '',
      value: '',
    },
    concept: { code: CONCEPT_CODE, name: 'New medication prescribed at V1', valueType, unit: null },
    visit: { id: 2154 },
    patient: { PATIENT_NUM: 920 },
  }
}

describe('ObservationValueEditor — select options for late-resolved value types', () => {
  beforeEach(() => {
    getFindingOptionsMock.mockReset().mockResolvedValue(YES_NO)
    getSelectionOptionsMock.mockReset().mockResolvedValue(YES_NO)
  })

  it("loads finding options when the type flips 'T' → 'F' after mount (blank field, concepts resolve late)", async () => {
    const wrapper = mount(ObservationValueEditor, {
      props: makeProps('T'),
      global: { plugins: [i18n] },
    })
    await flushPromises()

    // Mounted as text — no dropdown, no options loaded yet
    expect(getFindingOptionsMock).not.toHaveBeenCalled()
    expect(wrapper.find('.finding-input').exists()).toBe(false)

    // resolveBatch delivered: the form grid rebuilds the field with the real type
    await wrapper.setProps(makeProps('F'))
    await flushPromises()

    expect(wrapper.find('.finding-input').exists()).toBe(true)
    expect(getFindingOptionsMock).toHaveBeenCalledWith(CONCEPT_CODE)
    expect(wrapper.vm.selectionOptions).toEqual(YES_NO)
  })

  it("loads selection options when the type flips 'T' → 'S' after mount", async () => {
    const wrapper = mount(ObservationValueEditor, {
      props: makeProps('T'),
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.setProps(makeProps('S'))
    await flushPromises()

    expect(wrapper.find('.selection-input').exists()).toBe(true)
    expect(getSelectionOptionsMock).toHaveBeenCalledWith(CONCEPT_CODE)
    expect(wrapper.vm.selectionOptions).toEqual(YES_NO)
  })

  it("still loads options immediately when the type is known at mount (filled field)", async () => {
    const wrapper = mount(ObservationValueEditor, {
      props: makeProps('F'),
      global: { plugins: [i18n] },
    })
    await flushPromises()

    expect(getFindingOptionsMock).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.selectionOptions).toEqual(YES_NO)
  })
})
