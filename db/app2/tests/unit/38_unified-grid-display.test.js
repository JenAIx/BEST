/**
 * Tests for the unified-timeline grid integration helpers
 * (src/shared/utils/observation-display.js + questionnaire-display.js):
 *
 * - isBlankObservation: read mode hides merely-created rows, keeps NV/Q/R
 * - buildFormFields: field-set concepts keep their slot when the
 *   observation is deleted; category-claimed extras vanish with their row
 * - isBlankFormField: edit-mode dimming for blank fields
 * - parseMedicationObservation / formatMedicationSummary: M-type storage
 *   convention (TVAL=drug, NVAL=dose, UNIT, BLOB=frequency/route/…)
 * - parseQuestionnaireObservation: pending/completed/score/progress
 */

import { describe, it, expect } from 'vitest'
import { isBlankObservation, buildFormFields, isBlankFormField, canAddMedication, fieldSetCompletion, parseMedicationObservation, formatMedicationSummary } from '../../src/shared/utils/observation-display.js'
import { parseQuestionnaireObservation } from '../../src/shared/utils/questionnaire-display.js'

const obsOf = (over = {}) => ({
  observationId: 1,
  conceptCode: 'LID: 2947-0',
  conceptName: 'Natrium',
  valueType: 'N',
  displayValue: '140',
  unit: 'mmol/l',
  rawData: { NVAL_NUM: 140, TVAL_CHAR: null, VALUEFLAG_CD: null },
  ...over,
})

describe('isBlankObservation (read mode hides created-without-value rows)', () => {
  it('blank: no value at all (the transform yields "No value" / empty)', () => {
    expect(isBlankObservation(obsOf({ displayValue: 'No value', rawData: { NVAL_NUM: null, VALUEFLAG_CD: null } }))).toBe(true)
    expect(isBlankObservation(obsOf({ valueType: 'T', displayValue: '', rawData: { TVAL_CHAR: '', VALUEFLAG_CD: null } }))).toBe(true)
    expect(isBlankObservation(obsOf({ displayValue: null, rawData: {} }))).toBe(true)
    expect(isBlankObservation(null)).toBe(true)
  })

  it('not blank: real values, including numeric zero', () => {
    expect(isBlankObservation(obsOf())).toBe(false)
    expect(isBlankObservation(obsOf({ displayValue: '0', rawData: { NVAL_NUM: 0, VALUEFLAG_CD: null } }))).toBe(false)
    expect(isBlankObservation(obsOf({ valueType: 'S', displayValue: 'Ischämisch' }))).toBe(false)
  })

  it('NV-flagged rows stay visible — "explicitly no value" is information', () => {
    expect(isBlankObservation(obsOf({ displayValue: 'No value', rawData: { NVAL_NUM: null, VALUEFLAG_CD: 'NV' } }))).toBe(false)
    // flag mirrored into local grid state instead of rawData
    expect(isBlankObservation(obsOf({ displayValue: null, rawData: {}, valueFlag: 'NV' }))).toBe(false)
  })

  it('Q and R rows are never blank (pending fills / files are content)', () => {
    expect(isBlankObservation(obsOf({ valueType: 'Q', displayValue: null }))).toBe(false)
    expect(isBlankObservation(obsOf({ valueType: 'R', displayValue: null }))).toBe(false)
  })

  it('M rows without a drug name are blank', () => {
    expect(isBlankObservation(obsOf({ valueType: 'M', displayValue: '', rawData: { TVAL_CHAR: '' } }))).toBe(true)
    expect(isBlankObservation(obsOf({ valueType: 'M', displayValue: 'ASS', rawData: { TVAL_CHAR: 'ASS' } }))).toBe(false)
  })
})

describe('buildFormFields (delete semantics of the edit grid)', () => {
  const resolved = new Map([['LID: 2947-0', { label: 'Natrium', valueType: 'N', unit: 'mmol/l' }]])

  it('a field-set concept with observation fills its slot', () => {
    const fields = buildFormFields({ conceptCodes: ['LID: 2947-0'], resolvedConcepts: resolved, observations: [obsOf()] })
    expect(fields).toHaveLength(1)
    expect(fields[0].obs).not.toBeNull()
    expect(fields[0].row.value).toBe(140)
  })

  it('deleting the observation keeps the slot as an EMPTY field', () => {
    // post-delete state: concept still configured, observation gone
    const fields = buildFormFields({ conceptCodes: ['LID: 2947-0'], resolvedConcepts: resolved, observations: [] })
    expect(fields).toHaveLength(1)
    expect(fields[0].obs).toBeNull()
    expect(fields[0].concept.name).toBe('Natrium')
    expect(isBlankFormField(fields[0])).toBe(true)
  })

  it('category-claimed extras are appended and vanish with their observation', () => {
    const extra = obsOf({ observationId: 9, conceptCode: 'SCTID: 271649006', conceptName: 'Systolic BP', displayValue: '120', rawData: { NVAL_NUM: 120 } })
    const withExtra = buildFormFields({ conceptCodes: ['LID: 2947-0'], resolvedConcepts: resolved, observations: [obsOf(), extra] })
    expect(withExtra).toHaveLength(2)
    expect(withExtra[1].key).toBe('SCTID: 271649006#9') // concept + row id → unique
    expect(withExtra[1].concept.code).toBe('SCTID: 271649006')

    // post-delete: the extra observation is gone → its field disappears entirely
    const afterDelete = buildFormFields({ conceptCodes: ['LID: 2947-0'], resolvedConcepts: resolved, observations: [obsOf()] })
    expect(afterDelete).toHaveLength(1)
    expect(afterDelete.map((f) => f.key)).toEqual(['LID: 2947-0'])
  })

  it('matches concepts fuzzily (numeric code) and keeps duplicates as extras with UNIQUE keys', () => {
    const fuzzy = obsOf({ conceptCode: 'LID:2947-0' })
    const duplicate = obsOf({ observationId: 2, displayValue: '138', rawData: { NVAL_NUM: 138 } })
    const fields = buildFormFields({ conceptCodes: ['LID: 2947-0'], resolvedConcepts: resolved, observations: [fuzzy, duplicate] })
    expect(fields).toHaveLength(2)
    expect(fields[0].obs.observationId).toBe(2) // the EXACT code wins the slot
    expect(fields[1].obs.observationId).toBe(1) // fuzzy variant appended as extra
    // same concept twice (e.g. several medications) → v-for keys must differ,
    // the concept code stays intact for saves
    expect(new Set(fields.map((f) => f.key)).size).toBe(2)
    expect(fields[1].row.conceptCode).toBe('LID:2947-0')

    // a lone fuzzy row still fills the slot
    const only = buildFormFields({ conceptCodes: ['LID: 2947-0'], resolvedConcepts: resolved, observations: [fuzzy] })
    expect(only).toHaveLength(1)
    expect(only[0].obs.observationId).toBe(1)
  })

  it('exact matches claim their slot before fuzzy ones (regardless of row order)', () => {
    const symptoms = obsOf({ observationId: 1, conceptCode: 'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS', valueType: 'T', displayValue: 'sdfe', rawData: { TVAL_CHAR: 'sdfe' } })
    const intolerance = obsOf({ observationId: 2, conceptCode: 'STROKE_LIPID:STATIN_INTOLERANCE', valueType: 'F', displayValue: 'No', rawData: { TVAL_CHAR: 'SCTID: 373067005' } })
    // symptoms first in the array — with naive first-match it would land in
    // the STATIN_INTOLERANCE slot (substring containment)
    const fields = buildFormFields({
      conceptCodes: ['STROKE_LIPID:STATIN_INTOLERANCE', 'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS'],
      resolvedConcepts: new Map(),
      observations: [symptoms, intolerance],
    })
    expect(fields[0].obs.observationId).toBe(2)
    expect(fields[1].obs.observationId).toBe(1)
  })

  it('pending (unsaved) input overrides the stored value', () => {
    const fields = buildFormFields({
      conceptCodes: ['LID: 2947-0'],
      resolvedConcepts: resolved,
      observations: [obsOf()],
      pendingValues: new Map([['LID: 2947-0', '145']]),
    })
    expect(fields[0].row.value).toBe('145')
    expect(fields[0].row.originalValue).toBe(140)
  })
})

describe('isBlankFormField (edit mode dimming)', () => {
  it('blank without observation or with empty value; zero is a value', () => {
    expect(isBlankFormField({ concept: { valueType: 'N' }, obs: null, row: { value: '' } })).toBe(true)
    expect(isBlankFormField({ concept: { valueType: 'T' }, obs: {}, row: { value: '' } })).toBe(true)
    expect(isBlankFormField({ concept: { valueType: 'N' }, obs: {}, row: { value: 0 } })).toBe(false)
  })

  it('R fields are blank only without their observation', () => {
    expect(isBlankFormField({ concept: { valueType: 'R' }, obs: { fileInfo: {} }, row: { value: '' } })).toBe(false)
    expect(isBlankFormField({ concept: { valueType: 'R' }, obs: null, row: { value: '' } })).toBe(true)
  })

  it('M fields are blank without a drug name', () => {
    const filled = { concept: { valueType: 'M' }, obs: { rawData: { TVAL_CHAR: 'ASS' } }, row: { value: 'ASS' } }
    const empty = { concept: { valueType: 'M' }, obs: null, row: { value: '' } }
    expect(isBlankFormField(filled)).toBe(false)
    expect(isBlankFormField(empty)).toBe(true)
  })
})

describe('fieldSetCompletion (subtle group percentage)', () => {
  const filled = (code, over = {}) => obsOf({ conceptCode: code, ...over })
  const blank = (code) => obsOf({ conceptCode: code, displayValue: 'No value', rawData: { NVAL_NUM: null, VALUEFLAG_CD: null } })

  it('duplicate observations of one concept count ONCE (2× HDL)', () => {
    const result = fieldSetCompletion({ conceptCodes: ['LID: 2085-9'], observations: [filled('LID: 2085-9'), filled('LID: 2085-9', { observationId: 2 })] })
    expect(result).toEqual({ filled: 1, total: 1, percent: 100 })
  })

  it('unfilled configured concepts count toward the denominator, blanks do not fill', () => {
    expect(fieldSetCompletion({ conceptCodes: ['A', 'B'], observations: [filled('A')] })).toEqual({ filled: 1, total: 2, percent: 50 })
    expect(fieldSetCompletion({ conceptCodes: ['A', 'B'], observations: [filled('A'), blank('B')] })).toEqual({ filled: 1, total: 2, percent: 50 })
  })

  it('fuzzy matches collapse onto their configured concept', () => {
    expect(fieldSetCompletion({ conceptCodes: ['LID: 2947-0'], observations: [filled('LID:2947-0')] })).toEqual({ filled: 1, total: 1, percent: 100 })
  })

  it('category extras count once per concept on top of the configured set', () => {
    const result = fieldSetCompletion({
      conceptCodes: ['A'],
      observations: [filled('A'), filled('X'), filled('X', { observationId: 5 })],
    })
    expect(result).toEqual({ filled: 2, total: 2, percent: 100 })
  })

  it('NV rows count as filled ("assessed, explicitly no value")', () => {
    const nv = obsOf({ conceptCode: 'A', displayValue: 'No value', rawData: { NVAL_NUM: null, VALUEFLAG_CD: 'NV' } })
    expect(fieldSetCompletion({ conceptCodes: ['A'], observations: [nv] })).toEqual({ filled: 1, total: 1, percent: 100 })
  })

  it('questionnaires count per questionnaire (completed = filled), placeholder concept excluded', () => {
    const completed = { valueType: 'Q', conceptCode: 'CUSTOM: QUESTIONNAIRE', rawData: { OBSERVATION_BLOB: JSON.stringify({ questionnaire_code: 'BDI', results: [{ value: 3 }] }) } }
    const pending = { valueType: 'Q', conceptCode: 'CUSTOM: QUESTIONNAIRE', rawData: { OBSERVATION_BLOB: JSON.stringify({ _status: 'pending', _savedResponses: {} }) } }
    expect(fieldSetCompletion({ conceptCodes: ['CUSTOM: QUESTIONNAIRE'], observations: [completed, pending] })).toEqual({ filled: 1, total: 2, percent: 50 })
  })

  it('empty group → 0/0, percent 0', () => {
    expect(fieldSetCompletion({ conceptCodes: [], observations: [] })).toEqual({ filled: 0, total: 0, percent: 0 })
  })

  it('exact matches beat fuzzy substring collapses (10041940 V1 regression: 5/6 despite all filled)', () => {
    // STATIN_INTOLERANCE_SYMPTOMS contains STATIN_INTOLERANCE as substring —
    // it must fill ITS OWN concept, not collapse onto the prefix concept
    const result = fieldSetCompletion({
      conceptCodes: ['STROKE_LIPID:STATIN_INTOLERANCE', 'STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS'],
      observations: [
        filled('STROKE_LIPID:STATIN_INTOLERANCE_SYMPTOMS', { valueType: 'T', displayValue: 'sdfe' }),
        filled('STROKE_LIPID:STATIN_INTOLERANCE', { observationId: 2, valueType: 'F', displayValue: 'No' }),
      ],
    })
    expect(result).toEqual({ filled: 2, total: 2, percent: 100 })
  })

  it('medications (M) never count — open-ended list has no meaningful ratio', () => {
    const med = (id) => obsOf({ observationId: id, valueType: 'M', conceptCode: 'LID: 52418-1', displayValue: 'Aspirin', rawData: { TVAL_CHAR: 'Aspirin' } })
    // pure medication group → nothing to count, percent hidden via total 0
    expect(fieldSetCompletion({ conceptCodes: ['LID: 52418-1'], observations: [med(1), med(2)] })).toEqual({ filled: 0, total: 0, percent: 0 })
    // mixed group: the M concept leaves the denominator, the rest counts
    expect(fieldSetCompletion({ conceptCodes: ['A', 'LID: 52418-1'], observations: [filled('A'), med(1)] })).toEqual({ filled: 1, total: 1, percent: 100 })
  })
})

describe('parseMedicationObservation', () => {
  it('parses the full blob convention', () => {
    const obs = {
      rawData: {
        TVAL_CHAR: 'ASS',
        NVAL_NUM: 100,
        UNIT_CD: 'mg',
        OBSERVATION_BLOB: JSON.stringify({ drugName: 'ASS', dosage: 100, dosageUnit: 'mg', frequency: 'BID', route: 'PO', instructions: 'Nach dem Essen' }),
      },
    }
    expect(parseMedicationObservation(obs)).toEqual({ drugName: 'ASS', dosage: 100, dosageUnit: 'mg', frequency: 'BID', route: 'PO', instructions: 'Nach dem Essen' })
  })

  it('falls back to the value columns without / with broken blob', () => {
    const noBlob = { rawData: { TVAL_CHAR: 'Ibuprofen', NVAL_NUM: 400, UNIT_CD: 'mg' } }
    expect(parseMedicationObservation(noBlob)).toMatchObject({ drugName: 'Ibuprofen', dosage: 400, dosageUnit: 'mg', frequency: '' })

    const broken = { rawData: { TVAL_CHAR: 'Ibuprofen', OBSERVATION_BLOB: '{not json' } }
    expect(parseMedicationObservation(broken).drugName).toBe('Ibuprofen')
    expect(parseMedicationObservation(null).drugName).toBe('')
  })
})

describe('formatMedicationSummary (classic prescription notation)', () => {
  it('renders "Aspirin 100mg 1-0-0 p.o."', () => {
    const med = { drugName: 'Aspirin', dosage: 100, dosageUnit: 'mg', frequency: 'qd', route: 'po' }
    expect(formatMedicationSummary(med, { frequencyAbbrev: '1-0-0', routeAbbrev: 'p.o.' })).toBe('Aspirin 100mg 1-0-0 p.o.')
  })

  it('raw codes pass through, missing parts are skipped, no drug → empty', () => {
    expect(formatMedicationSummary({ drugName: 'ASS', dosage: null, dosageUnit: 'mg', frequency: 'bid', route: '' })).toBe('ASS bid')
    expect(formatMedicationSummary({ drugName: 'ASS', dosage: 100, dosageUnit: 'mg' })).toBe('ASS 100mg')
    expect(formatMedicationSummary({ drugName: '', dosage: 100 })).toBe('')
    expect(formatMedicationSummary(null)).toBe('')
  })
})

describe('canAddMedication (add-another-medication tile)', () => {
  const medField = (obs) => ({ concept: { valueType: 'M' }, obs })
  const numField = (obs) => ({ concept: { valueType: 'N' }, obs })

  it('shows once every M slot is filled', () => {
    expect(canAddMedication([medField({ observationId: 1 }), numField(null)])).toBe(true)
    expect(canAddMedication([medField({ observationId: 1 }), medField({ observationId: 2 })])).toBe(true)
  })

  it('hidden while an empty M slot exists (the slot IS the add affordance) or without M fields', () => {
    expect(canAddMedication([medField(null)])).toBe(false)
    expect(canAddMedication([medField({ observationId: 1 }), medField(null)])).toBe(false)
    expect(canAddMedication([numField({ observationId: 1 })])).toBe(false)
    expect(canAddMedication([])).toBe(false)
  })
})

describe('parseQuestionnaireObservation', () => {
  it('pending blob → progress from saved responses', () => {
    const obs = {
      observationId: 7,
      value: 'MoCA',
      rawData: {
        OBSERVATION_BLOB: JSON.stringify({
          _status: 'pending',
          _questionnaireCode: 'MOCA',
          _savedResponses: { q1: 1, q2: '', q3: null, q4: 'x' },
          title: 'Montreal Cognitive Assessment',
          short_title: 'MoCA',
        }),
      },
    }
    const parsed = parseQuestionnaireObservation(obs)
    expect(parsed.isCompleted).toBe(false)
    expect(parsed.progress).toBe(0.5)
    expect(parsed.questionnaireCode).toBe('MOCA')
    expect(parsed.title).toBe('Montreal Cognitive Assessment')
    expect(parsed.shortTitle).toBe('MoCA')
    expect(parsed.score).toBeNull()
  })

  it('completed blob → score from the first result', () => {
    const obs = {
      observationId: 8,
      value: 'BDI',
      rawData: { OBSERVATION_BLOB: JSON.stringify({ questionnaire_code: 'BDI', title: 'Beck Depression Inventory', short_title: 'BDI-II', results: [{ value: 12 }] }) },
    }
    const parsed = parseQuestionnaireObservation(obs)
    expect(parsed.isCompleted).toBe(true)
    expect(parsed.score).toBe(12)
    expect(parsed.questionnaireCode).toBe('BDI')
    expect(parsed.progress).toBeNull()
  })

  it('no blob or broken blob → completed legacy entry, title from TVAL', () => {
    expect(parseQuestionnaireObservation({ observationId: 9, value: 'PHQ-9', rawData: {} })).toMatchObject({ isCompleted: true, title: 'PHQ-9', score: null })
    expect(parseQuestionnaireObservation({ observationId: 10, value: 'PHQ-9', rawData: { OBSERVATION_BLOB: '{broken' } }).isCompleted).toBe(true)
  })

  it('memoizes per observation object and re-parses when the blob changes', () => {
    const obs = { observationId: 11, value: 'MoCA', rawData: { OBSERVATION_BLOB: JSON.stringify({ _status: 'pending', _savedResponses: {} }) } }
    const first = parseQuestionnaireObservation(obs)
    expect(parseQuestionnaireObservation(obs)).toBe(first) // same reference, no re-parse

    obs.rawData.OBSERVATION_BLOB = JSON.stringify({ questionnaire_code: 'MOCA', results: [{ value: 27 }] })
    const reparsed = parseQuestionnaireObservation(obs)
    expect(reparsed).not.toBe(first)
    expect(reparsed.isCompleted).toBe(true)
    expect(reparsed.score).toBe(27)
  })
})
