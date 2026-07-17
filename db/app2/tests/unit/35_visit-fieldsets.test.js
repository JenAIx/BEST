/**
 * Tests for the useVisitFieldSets composable (extracted from VisitDataEntry):
 * loading, visit-type activation (field + VISIT_BLOB paths, intersection with
 * available sets), toggling with persistence, and the questionnaires
 * pseudo-field-set bootstrap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const getFieldSetOptionsMock = vi.fn()
const getFieldSetsForVisitTypeMock = vi.fn()
const clearCacheMock = vi.fn()
const setSettingMock = vi.fn()
const getFieldSetObservationsMock = vi.fn(() => [])

vi.mock('src/stores/global-settings-store', () => ({
  useGlobalSettingsStore: () => ({
    getFieldSetOptions: getFieldSetOptionsMock,
    getFieldSetsForVisitType: getFieldSetsForVisitTypeMock,
    clearCache: clearCacheMock,
  }),
}))

vi.mock('src/stores/observation-store', () => ({
  useObservationStore: () => ({
    getFieldSetObservations: getFieldSetObservationsMock,
    observations: [],
  }),
}))

vi.mock('src/stores/local-settings-store', () => ({
  useLocalSettingsStore: () => ({
    getSetting: () => null,
    setSetting: setSettingMock,
  }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}))

const { useVisitFieldSets } = await import('src/composables/useVisitFieldSets')

const AVAILABLE = [
  { id: 'lipid_labor', name: 'Laboratory', concepts: [], categories: ['Laboratory'] },
  { id: 'lipid_drugs', name: 'Lipid Medications', concepts: [], categories: [] },
  { id: 'vitals', name: 'Vital Signs', concepts: [], categories: ['Vital Signs'] },
]

describe('useVisitFieldSets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFieldSetOptionsMock.mockResolvedValue([...AVAILABLE])
  })

  const setup = async () => {
    const fs = useVisitFieldSets()
    await fs.loadFieldSets()
    return fs
  }

  it('loads available field sets from global settings', async () => {
    const fs = await setup()
    expect(fs.availableFieldSets.value).toHaveLength(3)
    expect(fs.loadingFieldSets.value).toBe(false)
  })

  it('activates the visit type sets intersected with available sets', async () => {
    const fs = await setup()
    getFieldSetsForVisitTypeMock.mockResolvedValue(['lipid_labor', 'lipid_drugs', 'unknown_set'])

    await fs.activateFieldSetsForVisitType({ id: 1, visitType: 'stroke_lipid_v1' })

    expect(clearCacheMock).toHaveBeenCalled()
    expect(getFieldSetsForVisitTypeMock).toHaveBeenCalledWith('stroke_lipid_v1', true)
    expect(fs.activeFieldSets.value).toEqual(['lipid_labor', 'lipid_drugs']) // unknown dropped
    expect(setSettingMock).toHaveBeenCalledWith('visits.activeFieldSets', ['lipid_labor', 'lipid_drugs'])
  })

  it('extracts the visit type from VISIT_BLOB when the field is missing', async () => {
    const fs = await setup()
    getFieldSetsForVisitTypeMock.mockResolvedValue(['vitals'])

    await fs.activateFieldSetsForVisitType({
      id: 2,
      rawData: { VISIT_BLOB: JSON.stringify({ visitType: 'stroke_lipid_v0' }) },
    })

    expect(getFieldSetsForVisitTypeMock).toHaveBeenCalledWith('stroke_lipid_v0', true)
    expect(fs.activeFieldSets.value).toEqual(['vitals'])
  })

  it('leaves activation untouched for missing type, broken blob or empty config', async () => {
    const fs = await setup()
    fs.activeFieldSets.value = ['vitals']

    await fs.activateFieldSetsForVisitType(null)
    await fs.activateFieldSetsForVisitType({ id: 3 }) // no type at all
    await fs.activateFieldSetsForVisitType({ id: 4, rawData: { VISIT_BLOB: '{kaputt' } })

    getFieldSetsForVisitTypeMock.mockResolvedValue([])
    await fs.activateFieldSetsForVisitType({ id: 5, visitType: 'routine' })

    getFieldSetsForVisitTypeMock.mockResolvedValue(['only_unknown'])
    await fs.activateFieldSetsForVisitType({ id: 6, visitType: 'routine' })

    expect(fs.activeFieldSets.value).toEqual(['vitals'])
    expect(setSettingMock).not.toHaveBeenCalled()
  })

  it('toggleFieldSet adds/removes and persists', async () => {
    const fs = await setup()
    fs.toggleFieldSet('vitals')
    expect(fs.activeFieldSets.value).toEqual(['vitals'])
    expect(fs.activeFieldSetsList.value.map((s) => s.id)).toEqual(['vitals'])

    fs.toggleFieldSet('vitals')
    expect(fs.activeFieldSets.value).toEqual([])
    expect(setSettingMock).toHaveBeenCalledTimes(2)
  })

  it('ensureQuestionnaireFieldSetActive adds the pseudo set and activates it', async () => {
    const fs = await setup()
    getFieldSetOptionsMock.mockResolvedValue([...AVAILABLE]) // refresh still has no questionnaires

    await fs.ensureQuestionnaireFieldSetActive()

    const pseudo = fs.availableFieldSets.value.find((s) => s.id === 'questionnaires')
    expect(pseudo).toBeTruthy()
    expect(pseudo.concepts).toEqual(['CUSTOM: QUESTIONNAIRE'])
    expect(fs.activeFieldSets.value).toContain('questionnaires')

    // idempotent
    setSettingMock.mockClear()
    await fs.ensureQuestionnaireFieldSetActive()
    expect(fs.availableFieldSets.value.filter((s) => s.id === 'questionnaires')).toHaveLength(1)
    expect(setSettingMock).not.toHaveBeenCalled()
  })

  it('getFieldSetObservations delegates to the observation store with available sets', async () => {
    const fs = await setup()
    getFieldSetObservationsMock.mockReturnValue([{ observationId: 1 }])
    expect(fs.getFieldSetObservations('lipid_labor')).toHaveLength(1)
    expect(getFieldSetObservationsMock).toHaveBeenCalledWith('lipid_labor', fs.availableFieldSets.value)
    expect(fs.getFieldSetObservationCount('lipid_labor')).toBe(1)
    expect(fs.getFieldSetObservations(null)).toEqual([])
  })
})
