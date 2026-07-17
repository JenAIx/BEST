/**
 * @vitest-environment jsdom
 *
 * Rendering tests for ObservationTileGrid.vue (unified timeline read mode):
 *   - M tiles show the classic prescription notation "Aspirin 100mg 1-0-0 p.o."
 *   - pending questionnaires are clearly marked (amber class, fill hint,
 *     progress bar), completed ones show their score
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

vi.mock('src/composables/useMedicationOptions', () => ({
  useMedicationOptions: () => ({
    loadMedicationOptions: vi.fn(),
    getFrequencyAbbreviation: (code) => ({ qd: '1-0-0', bid: '1-0-1' })[code] || code,
    getRouteAbbreviation: (code) => ({ po: 'p.o.' })[code] || code,
  }),
}))

const { default: ObservationTileGrid } = await import('src/components/visits/unified/ObservationTileGrid.vue')

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'de',
  messages: {
    de: { visit: { questionnaireFill: 'Ausfüllen', questionnaireScore: 'Score: {score}' } },
  },
})

const medicationObs = {
  observationId: 1,
  conceptCode: 'LID: 52418-1',
  conceptName: 'Current medication, Name',
  valueType: 'M',
  displayValue: 'Aspirin',
  rawData: {
    TVAL_CHAR: 'Aspirin',
    NVAL_NUM: 100,
    UNIT_CD: 'mg',
    OBSERVATION_BLOB: JSON.stringify({ drugName: 'Aspirin', dosage: 100, dosageUnit: 'mg', frequency: 'qd', route: 'po' }),
  },
}

const pendingQuestObs = {
  observationId: 2,
  conceptCode: 'CUSTOM: QUESTIONNAIRE',
  conceptName: 'Questionnaire',
  valueType: 'Q',
  displayValue: 'MoCA',
  rawData: { OBSERVATION_BLOB: JSON.stringify({ _status: 'pending', _questionnaireCode: 'MOCA', _savedResponses: { a: 1, b: '' }, title: 'MoCA' }) },
}

const completedQuestObs = {
  observationId: 3,
  conceptCode: 'CUSTOM: QUESTIONNAIRE',
  conceptName: 'Questionnaire',
  valueType: 'Q',
  displayValue: 'BDI',
  rawData: { OBSERVATION_BLOB: JSON.stringify({ questionnaire_code: 'BDI', title: 'Beck Depression Inventory', results: [{ value: 12 }] }) },
}

function makeWrapper(observations) {
  return mount(ObservationTileGrid, {
    props: { categorizedObservations: [{ name: 'Medications', observations }] },
    global: { plugins: [i18n] },
  })
}

describe('ObservationTileGrid (read tiles)', () => {
  it('M tile renders the prescription notation with resolved abbreviations', () => {
    const wrapper = makeWrapper([medicationObs])
    expect(wrapper.find('.obs-tile .tile-value').text()).toContain('Aspirin 100mg 1-0-0 p.o.')
  })

  it('pending questionnaire tile is marked incomplete with fill hint + progress', () => {
    const wrapper = makeWrapper([pendingQuestObs])
    const tile = wrapper.find('.obs-tile')
    expect(tile.classes()).toContain('obs-tile--pending')
    expect(tile.text()).toContain('Ausfüllen')
    expect(tile.find('.tile-progress').exists()).toBe(true)
  })

  it('completed questionnaire tile shows the score, no pending styling', () => {
    const wrapper = makeWrapper([completedQuestObs])
    const tile = wrapper.find('.obs-tile')
    expect(tile.classes()).not.toContain('obs-tile--pending')
    expect(tile.text()).toContain('Score: 12')
    expect(tile.find('.tile-progress').exists()).toBe(false)
  })
})
