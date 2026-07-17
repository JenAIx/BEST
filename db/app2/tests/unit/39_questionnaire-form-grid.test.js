/**
 * @vitest-environment jsdom
 *
 * Tests for QuestionnaireFormGrid.vue — the questionnaires group in the
 * unified card editor, rendered in the CRF form-grid look:
 *   - one tile per questionnaire (completed → view, pending → fill)
 *   - score / fill hint / progress bar
 *   - dashed add tile
 *   - remove goes through a confirm dialog before emitting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

let dialogOnOk = null
const dialogMock = vi.fn(() => ({
  onOk: (cb) => {
    dialogOnOk = cb
    return { onCancel: () => {} }
  },
}))

vi.mock('quasar', () => ({
  useQuasar: () => ({ dialog: dialogMock }),
}))

const { default: QuestionnaireFormGrid } = await import('src/components/visits/unified/QuestionnaireFormGrid.vue')

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'de',
  messages: {
    de: {
      visit: {
        completed: 'Abgeschlossen',
        addQuestionnaire: 'Fragebogen hinzufügen',
        removeQuestionnaire: 'Fragebogen entfernen',
        removeQuestionnaireConfirm: '„{title}“ wirklich entfernen?',
        questionnaireFill: 'Ausfüllen',
        questionnaireScore: 'Score: {score}',
      },
      observation: { questionnaire: 'Fragebogen' },
      common: { cancel: 'Abbrechen', delete: 'Löschen' },
    },
  },
})

const completedQ = {
  observationId: 1,
  title: 'Beck Depression Inventory',
  shortTitle: 'BDI-II',
  questionnaireCode: 'BDI',
  isCompleted: true,
  score: 12,
  progress: null,
}

const pendingQ = {
  observationId: 2,
  title: 'Montreal Cognitive Assessment',
  shortTitle: 'MoCA',
  questionnaireCode: 'MOCA',
  isCompleted: false,
  score: null,
  progress: 0.5,
}

function makeWrapper(questionnaires = [completedQ, pendingQ]) {
  return mount(QuestionnaireFormGrid, {
    props: {
      fieldSet: { id: 'questionnaires', name: 'Fragebögen', icon: 'quiz' },
      questionnaires,
    },
    global: { plugins: [i18n] },
  })
}

describe('QuestionnaireFormGrid', () => {
  beforeEach(() => {
    dialogMock.mockClear()
    dialogOnOk = null
  })

  it('renders one tile per questionnaire plus the add tile, with completed count', () => {
    const wrapper = makeWrapper()
    expect(wrapper.findAll('.field-quest')).toHaveLength(3) // 2 entries + add tile
    expect(wrapper.find('.form-group-count').text()).toBe('(1/2)')
    expect(wrapper.find('.form-group').attributes('data-group-name')).toBe('Fragebögen')
  })

  it('shows score for completed and fill hint + progress for pending', () => {
    const wrapper = makeWrapper()
    const tiles = wrapper.findAll('.field-quest')
    expect(tiles[0].text()).toContain('Score: 12')
    expect(tiles[0].classes()).toContain('field-quest--completed')
    expect(tiles[1].text()).toContain('Ausfüllen')
    expect(tiles[1].classes()).toContain('field-quest--pending')
    expect(tiles[1].find('.field-quest-progress').exists()).toBe(true)
    expect(tiles[0].find('.field-quest-progress').exists()).toBe(false)
  })

  it('click emits view for completed, fill for pending', async () => {
    const wrapper = makeWrapper()
    const tiles = wrapper.findAll('.field-quest')
    await tiles[0].trigger('click')
    await tiles[1].trigger('click')
    expect(wrapper.emitted('view-questionnaire')[0][0]).toEqual(completedQ)
    expect(wrapper.emitted('fill-questionnaire')[0][0]).toEqual(pendingQ)
  })

  it('the add tile emits add-questionnaire', async () => {
    const wrapper = makeWrapper([])
    expect(wrapper.find('.form-group-count').text()).toBe('(0/0)')
    await wrapper.find('.field-quest--add').trigger('click')
    expect(wrapper.emitted('add-questionnaire')).toHaveLength(1)
  })

  it('remove asks for confirmation and only emits on OK', async () => {
    const wrapper = makeWrapper()
    await wrapper.find('.field-delete').trigger('click')
    expect(dialogMock).toHaveBeenCalledTimes(1)
    expect(dialogMock.mock.calls[0][0].message).toContain('Beck Depression Inventory')
    expect(wrapper.emitted('remove-questionnaire')).toBeUndefined() // not yet

    dialogOnOk()
    expect(wrapper.emitted('remove-questionnaire')[0][0]).toEqual(completedQ)
  })
})
