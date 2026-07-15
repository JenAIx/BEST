/**
 * Data Grid Store
 * Manages state and operations for the data grid editor functionality
 * Handles cell operations, change tracking, and grid-specific utilities
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useAuthStore } from './auth-store'
import { useLocalSettingsStore } from './local-settings-store'
import { useLoggingStore } from './logging-store'
import { getPatientInitials, formatDate } from 'src/shared/utils/medical-utils'
import {
  getCellClass,
  hasRowChanges,
  getCellValue,
  getCellObservationId,
  getCellValueFlag,
  getPatientNameFromGridData,
  cleanPatientIds,
  createChangeKey,
  getDefaultViewOptions,
  validateViewOptions,
  buildVisitTypeLockMap,
  isCellVisitTypeLocked,
} from 'src/shared/utils/grid-utils'

export const useDataGridStore = defineStore('dataGrid', () => {
  const dbStore = useDatabaseStore()
  const authStore = useAuthStore()
  const localSettings = useLocalSettingsStore()
  const logger = useLoggingStore().createLogger('DataGridStore')

  // State
  const loading = ref(false)
  const savingAll = ref(false)
  const patientData = ref([])
  const observationConcepts = ref([])
  const tableRows = ref([])
  const pendingChanges = ref(new Map())
  const lastUpdateTime = ref(new Date().toLocaleTimeString())

  // Undo/redo: each entry is a recorded cell edit with both old and new value.
  // Once a cell is saved (DB write done by EditableCell), an entry is pushed
  // here; undo/redo replay the same UPDATE OBSERVATION_FACT path via
  // applyCellValue. We deliberately keep stack state local — no persistence —
  // so a refresh resets history.
  const undoStack = ref([])
  const redoStack = ref([])
  const MAX_UNDO_HISTORY = 100

  // View options
  const viewOptions = ref(getDefaultViewOptions())

  // Column visibility state (Map<columnCode, visible>)
  const columnVisibility = ref(new Map())

  // Column order state (Array<columnCode>)
  const columnOrder = ref([])

  // Audit filter: when active, the grid only shows columns + rows that
  // contain at least one cell with VALUEFLAG_CD = 'AUDIT'. Toggled from
  // the GridFooter chip.
  const auditFilterActive = ref(false)

  // Visit-type lock: concept↔visit-type mapping derived from CODE_LOOKUP
  // (visit types → field sets → concepts/categories). Loaded once per grid
  // load; null until loaded. See isCellLocked / viewOptions.visitTypeLockActive.
  const visitTypeLockMap = ref(null)

  // Visit-type display metadata (label/icon/color per CODE_CD), built from the
  // same CODE_LOOKUP query as the lock map — one query serves both the lock
  // and the per-row visit-type chip in the editor.
  const visitTypeMeta = ref(new Map())

  // Memo for isCellLocked: the verdict only depends on (visitTypeCode,
  // concept.code, concept.category) and the loaded lock map. Non-reactive on
  // purpose; cleared whenever the lock map reloads.
  const lockVerdictCache = new Map()

  // Getters
  const totalObservations = computed(() => {
    return tableRows.value.reduce((total, row) => {
      return total + Object.keys(row.observations || {}).length
    }, 0)
  })

  const hasUnsavedChanges = computed(() => {
    return pendingChanges.value.size > 0
  })

  const unsavedChangesCount = computed(() => {
    return pendingChanges.value.size
  })

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  // Set of concept codes that have at least one AUDIT cell across all rows.
  // Used by the audit filter and by the row-level filter computed below.
  const conceptCodesWithOpenAudit = computed(() => {
    const codes = new Set()
    for (const row of tableRows.value || []) {
      for (const [code, obs] of Object.entries(row.observations || {})) {
        if (obs?.valueFlag === 'AUDIT') codes.add(code)
      }
    }
    return codes
  })

  // Visible observation concepts based on column visibility, order, and the
  // optional audit filter.
  const getVisibleObservationConcepts = computed(() => {
    const allConcepts = observationConcepts.value || []

    // If no visibility state exists, start from all columns
    let visibleConcepts = allConcepts
    if (columnVisibility.value && columnVisibility.value.size > 0) {
      try {
        visibleConcepts = allConcepts.filter((concept) => {
          return columnVisibility.value.get(concept.code) !== false
        })
      } catch (error) {
        logger.warn('Error filtering visible concepts in store', error)
        return allConcepts
      }
    }

    // Audit filter: keep only columns that have at least one AUDIT cell.
    if (auditFilterActive.value) {
      const auditCodes = conceptCodesWithOpenAudit.value
      visibleConcepts = visibleConcepts.filter((c) => auditCodes.has(c.code))
    }

    // If we have a custom column order, use it to sort the visible concepts
    if (columnOrder.value && columnOrder.value.length > 0) {
      const orderMap = new Map(columnOrder.value.map((code, index) => [code, index]))
      return [...visibleConcepts].sort((a, b) => {
        const aIndex = orderMap.get(a.code) ?? 999
        const bIndex = orderMap.get(b.code) ?? 999
        return aIndex - bIndex
      })
    }

    return visibleConcepts
  })

  // Rows that should be shown given the current filter. When the audit filter
  // is active, only rows that contain at least one AUDIT cell are returned;
  // otherwise the unfiltered tableRows are returned. Components that want to
  // honour the audit filter should iterate this instead of tableRows directly.
  const getVisibleTableRows = computed(() => {
    if (!auditFilterActive.value) return tableRows.value || []
    return (tableRows.value || []).filter((row) =>
      Object.values(row.observations || {}).some((obs) => obs?.valueFlag === 'AUDIT'),
    )
  })

  // Statistics computation
  const statistics = computed(() => {
    try {
      const totalObservations = observationConcepts.value?.length || 0
      const visibleObservations = getVisibleObservationConcepts.value?.length || 0
      const hiddenObservations = totalObservations - visibleObservations

      // Calculate cell statistics
      const rows = tableRows.value || []
      const visibleConcepts = getVisibleObservationConcepts.value || []

      let totalCells = 0
      let filledCells = 0
      let openAuditsCount = 0

      rows.forEach((row) => {
        visibleConcepts.forEach((concept) => {
          totalCells++
          try {
            const cellValue = getCellValue(row, concept)
            // Consider a cell filled if it has a non-empty value
            if (cellValue !== null && cellValue !== undefined && cellValue !== 'NULL' && (typeof cellValue === 'string' ? cellValue.trim() !== '' : String(cellValue).trim() !== '')) {
              filledCells++
            }
            if (getCellValueFlag(row, concept) === 'AUDIT') {
              openAuditsCount++
            }
          } catch (error) {
            logger.warn('Error getting cell value for statistics', { row, concept, error })
            // Count as empty cell
          }
        })
      })

      const filledCellsPercentage = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0

      return {
        totalObservations,
        visibleObservations,
        hiddenObservations,
        totalCells,
        filledCells,
        filledCellsPercentage,
        openAuditsCount,
      }
    } catch (error) {
      logger.warn('Error calculating statistics', error)
      return {
        totalObservations: 0,
        visibleObservations: 0,
        hiddenObservations: 0,
        totalCells: 0,
        filledCells: 0,
        filledCellsPercentage: 0,
        openAuditsCount: 0,
      }
    }
  })

  // Utility functions
  const getPatientName = getPatientNameFromGridData

  // Enhanced cell utility functions with pending changes context
  const getCellClassWithContext = (row, concept) => {
    return getCellClass(row, concept)
  }

  const hasRowChangesWithContext = (row) => {
    return hasRowChanges(row, observationConcepts.value)
  }

  // Data loading
  const loadGridData = async (patientIds) => {
    try {
      loading.value = true
      const cleanedIds = cleanPatientIds(patientIds)
      logger.info('Loading grid data for patients', { patientIds: cleanedIds, count: cleanedIds.length })

      // Load the visit-type lock map alongside (non-fatal on failure)
      const lockMapPromise = loadVisitTypeLockData()

      // Load patient data using the database store (access-filtered:
      // inaccessible IDs from stored selections are dropped)
      const patients = await dbStore.loadBatchPatientData(cleanedIds)
      patientData.value = patients

      // Load observation data ONLY for the patients that passed the access
      // filter — otherwise observations of inaccessible patients would be
      // synthesized into grid rows by processObservationDataForGrid.
      const accessibleIds = patients.map((entry) => String(entry.patient.PATIENT_CD))
      const observations = accessibleIds.length > 0 ? await dbStore.loadBatchObservationData(accessibleIds) : []

      // Process the data for grid display
      const processed = dbStore.processObservationDataForGrid(observations, patients)
      
      // Merge with existing concepts to preserve manually added concepts
      const existingConcepts = Array.isArray(observationConcepts.value) ? [...observationConcepts.value] : []
      const newConceptsFromData = processed.observationConcepts || []
      
      // Create a map of existing concepts by code
      const existingConceptMap = new Map(existingConcepts.map(c => [c.code, c]))
      
      // Add new concepts from data (they will overwrite existing ones if they have the same code)
      newConceptsFromData.forEach(concept => {
        existingConceptMap.set(concept.code, concept)
      })
      
      // Convert back to array
      observationConcepts.value = Array.from(existingConceptMap.values())
      
      // Update table rows, but preserve observations for manually added concepts
      const updatedRows = processed.tableRows || []
      
      // For each existing row, merge observations from processed data with existing observations
      // This ensures manually added concepts (with empty observations) are preserved
      if (tableRows.value && tableRows.value.length > 0) {
        updatedRows.forEach((newRow) => {
          const existingRow = tableRows.value.find(r => 
            r.patientId === newRow.patientId && r.encounterNum === newRow.encounterNum
          )
          if (existingRow && existingRow.observations) {
            // Merge existing observations with new ones
            newRow.observations = {
              ...existingRow.observations,
              ...newRow.observations
            }
          }
        })
      }
      
      tableRows.value = updatedRows

      // Initialize column visibility for any new concepts that were merged
      // Note: columnVisibility should already be loaded from initialize(), but ensure it exists
      if (!columnVisibility.value) {
        columnVisibility.value = new Map()
      }
      
      // Only add visibility for new concepts (preserve existing settings)
      let hasNewConcepts = false
      observationConcepts.value.forEach((concept) => {
        if (concept && concept.code && !columnVisibility.value.has(concept.code)) {
          columnVisibility.value.set(concept.code, true) // Default to visible for new concepts
          hasNewConcepts = true
        }
      })
      
      // Only save if we added new concepts (avoid overwriting on every load)
      if (hasNewConcepts) {
        const visibilityObject = Object.fromEntries(columnVisibility.value)
        localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)
      }

      // Lock map should be in place before the grid renders locked cells
      await lockMapPromise

      lastUpdateTime.value = new Date().toLocaleTimeString()

      logger.success('Grid data loaded successfully', {
        patients: patients.length,
        observations: observations.length,
        concepts: observationConcepts.value.length,
        rows: updatedRows.length,
      })
    } catch (error) {
      logger.error('Failed to load grid data', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Event handlers
  const handleCellUpdate = (data) => {
    const { patientId, encounterNum, conceptCode, value, observationId, valueFlag, startDate } = data
    const key = createChangeKey(patientId, encounterNum, conceptCode)

    logger.debug('Handling cell update', { key, value, observationId, valueFlag, startDate })

    // Track the change
    pendingChanges.value.set(key, {
      patientId,
      encounterNum,
      conceptCode,
      value,
      observationId,
      timestamp: new Date(),
    })

    // Update the local data — propagate observationId so subsequent edits
    // know the observation already exists (otherwise EditableCell would try
    // to INSERT again instead of UPDATE). valueFlag and startDate are
    // mirrored too so the 3-state NV cell and the per-observation-date
    // workflow render correctly after a save without waiting for a full
    // grid reload.
    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row) {
      if (!row.observations[conceptCode]) {
        row.observations[conceptCode] = {}
      }
      row.observations[conceptCode].value = value
      if (observationId != null) {
        row.observations[conceptCode].observationId = observationId
      }
      if (valueFlag !== undefined) {
        row.observations[conceptCode].valueFlag = valueFlag
      }
      if (startDate !== undefined) {
        row.observations[conceptCode].startDate = startDate
      }
    }
  }

  // Undo/redo support — record a completed cell edit so it can be replayed.
  // Called by EditableCell after a successful save (UPDATE or INSERT). Old/new
  // values come from the cell's pre-edit and post-edit state. observationId is
  // captured AFTER any INSERT, so undo can target the same row via UPDATE.
  const recordEdit = (entry) => {
    if (!entry || entry.oldValue === entry.newValue) return
    undoStack.value.push(entry)
    if (undoStack.value.length > MAX_UNDO_HISTORY) undoStack.value.shift()
    redoStack.value = []
  }

  // Persist a value into a specific cell — used by undo/redo and fill-down.
  // Mirrors EditableCell's UPDATE path; never deletes observations. If
  // observationId is missing, only the local view updates (the value would
  // need INSERT, which is the EditableCell's job on initial creation).
  const applyCellValue = async ({ patientId, encounterNum, conceptCode, value, observationId, valueType }) => {
    // 1. Update local state immediately for snappy UX
    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row) {
      if (!row.observations[conceptCode]) row.observations[conceptCode] = {}
      row.observations[conceptCode].value = value
    }

    // 2. Persist to DB if we have an observationId. value can be empty/null —
    // we set TVAL_CHAR/NVAL_NUM to null, observation row stays.
    if (observationId != null) {
      const updates = {}
      if (valueType === 'N') {
        updates.NVAL_NUM = value === null || value === '' ? null : Number(value)
        updates.TVAL_CHAR = null
      } else {
        updates.TVAL_CHAR = value === null || value === '' ? null : String(value)
        updates.NVAL_NUM = null
      }
      // Stamp the current user as last editor
      updates.PROVIDER_ID = authStore.providerId
      const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ')
      const params = [...Object.values(updates), observationId]
      const sql = `UPDATE OBSERVATION_FACT SET ${setClause}, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?`
      const result = await dbStore.executeQuery(sql, params)
      if (!result.success) {
        throw new Error(result.error || 'Failed to update observation')
      }
    }
    lastUpdateTime.value = new Date().toLocaleTimeString()
  }

  // Audit / NV workflow -----------------------------------------------------
  //
  // setObservationFlag flips OBSERVATION_FACT.VALUEFLAG_CD for an existing
  // observation row. Used by the EditableCell context-menu to mark a cell
  // 'AUDIT' (needs review), resolve it to 'CONFIRMED', mark it 'NV' (the
  // 3-state "Erfasst – kein Wert" — see CLAUDE.md §3) or clear back to null.
  //
  // For 'NV' the value cells (NVAL_NUM, TVAL_CHAR) are also cleared, so the
  // SQL update is wider and mirrors what EditableCell.updateObservation does
  // when the user toggles into NV via the inline side button. Empty cells
  // (observationId == null) are silently ignored.
  const setObservationFlag = async (payload) => {
    const { patientId, encounterNum, conceptCode, observationId, flag } = payload || {}
    if (observationId == null) {
      logger.warn('setObservationFlag called without observationId — skipped', { payload })
      return
    }

    const clearValue = flag === 'NV'
    const sql = clearValue
      ? 'UPDATE OBSERVATION_FACT SET VALUEFLAG_CD = ?, NVAL_NUM = NULL, TVAL_CHAR = NULL, PROVIDER_ID = ?, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?'
      : 'UPDATE OBSERVATION_FACT SET VALUEFLAG_CD = ?, PROVIDER_ID = ?, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?'
    const result = await dbStore.executeQuery(sql, [flag, authStore.providerId, observationId])
    if (!result.success) {
      throw new Error(result.error || 'Failed to update VALUEFLAG_CD')
    }

    // Mirror the flag (and possibly the cleared value) into local state so the
    // cell re-renders without a reload.
    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row && row.observations[conceptCode]) {
      row.observations[conceptCode].valueFlag = flag
      if (clearValue) {
        row.observations[conceptCode].value = ''
      }
    }

    lastUpdateTime.value = new Date().toLocaleTimeString()
    logger.info('Observation flag updated', { observationId, flag })
  }

  // deleteObservationFromGrid hard-deletes the OBSERVATION_FACT row and
  // clears the local cell. Mirrors EditableCell's "clear numeric without NV"
  // path (saveToDatabase line 412-416) but reachable from the right-click
  // menu so the user can wipe text/finding/selection cells too.
  const deleteObservationFromGrid = async (payload) => {
    const { patientId, encounterNum, conceptCode, observationId } = payload || {}
    if (observationId == null) {
      logger.warn('deleteObservationFromGrid called without observationId — skipped', { payload })
      return
    }

    const sql = 'DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?'
    const result = await dbStore.executeQuery(sql, [observationId])
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete observation')
    }

    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row && row.observations[conceptCode]) {
      // Keep the cell shell with valueType so the user can still INSERT a new
      // value via direct edit; just blank the value/observationId/flag.
      row.observations[conceptCode].observationId = null
      row.observations[conceptCode].value = ''
      row.observations[conceptCode].valueFlag = null
    }

    // Drop any pending change so the deleted cell doesn't try to save again.
    pendingChanges.value.delete(createChangeKey(patientId, encounterNum, conceptCode))

    lastUpdateTime.value = new Date().toLocaleTimeString()
    logger.info('Observation deleted from grid', { observationId })
  }

  const toggleAuditFilter = () => {
    auditFilterActive.value = !auditFilterActive.value
    logger.debug('Audit filter toggled', { active: auditFilterActive.value })
  }

  // Per-observation date workflow ------------------------------------------
  //
  // OBSERVATION_FACT.START_DATE defaults to the parent visit's START_DATE on
  // insert (set by EditableCell.createObservation), but can diverge — e.g. a
  // lab whose draw date is a few days before/after the visit. The right-click
  // "Datum bearbeiten" menu calls this action; "Auf Visitendatum
  // zurücksetzen" calls the same action with startDate=row.visitDate.
  //
  // Update-only (observationId required). New observations still get their
  // initial date from the visit via the existing EditableCell create path.
  const setObservationStartDate = async (payload) => {
    const { patientId, encounterNum, conceptCode, observationId, startDate } = payload || {}
    if (observationId == null) {
      logger.warn('setObservationStartDate called without observationId — skipped', { payload })
      return
    }
    if (!startDate) {
      throw new Error('setObservationStartDate requires a non-empty startDate')
    }

    const sql = 'UPDATE OBSERVATION_FACT SET START_DATE = ?, PROVIDER_ID = ?, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?'
    const result = await dbStore.executeQuery(sql, [startDate, authStore.providerId, observationId])
    if (!result.success) {
      throw new Error(result.error || 'Failed to update observation START_DATE')
    }

    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row && row.observations[conceptCode]) {
      row.observations[conceptCode].startDate = startDate
    }

    lastUpdateTime.value = new Date().toLocaleTimeString()
    logger.info('Observation start date updated', { observationId, startDate })
  }

  const undo = async () => {
    if (!canUndo.value) return
    const entry = undoStack.value.pop()
    try {
      await applyCellValue({ ...entry, value: entry.oldValue })
      redoStack.value.push(entry)
      logger.debug('Undo applied', { conceptCode: entry.conceptCode })
    } catch (error) {
      // Restore stack on failure so user can retry
      undoStack.value.push(entry)
      logger.error('Undo failed', error)
      throw error
    }
  }

  const redo = async () => {
    if (!canRedo.value) return
    const entry = redoStack.value.pop()
    try {
      await applyCellValue({ ...entry, value: entry.newValue })
      undoStack.value.push(entry)
      logger.debug('Redo applied', { conceptCode: entry.conceptCode })
    } catch (error) {
      redoStack.value.push(entry)
      logger.error('Redo failed', error)
      throw error
    }
  }

  const clearUndoHistory = () => {
    undoStack.value = []
    redoStack.value = []
  }

  const handleCellSave = async (data) => {
    const { patientId, encounterNum, conceptCode } = data
    const key = createChangeKey(patientId, encounterNum, conceptCode)

    try {
      // Remove from pending changes
      pendingChanges.value.delete(key)

      // Update last save time
      lastUpdateTime.value = new Date().toLocaleTimeString()

      logger.debug('Cell saved successfully', { key })
    } catch (error) {
      logger.error('Cell save error', error)
    }
  }

  const handleCellError = (error) => {
    // Caller (ExcelLikeEditor) is responsible for surfacing the error to the user.
    logger.error('Cell error', error)
  }

  // Batch operations. Returns { savedCount, errorCount }; the caller decides
  // how to surface the result to the user (notify, toast, etc.).
  const saveAllChanges = async () => {
    if (!hasUnsavedChanges.value) return { savedCount: 0, errorCount: 0 }

    savingAll.value = true
    logger.info('Starting batch save of all changes', { changeCount: pendingChanges.value.size })

    const changes = Array.from(pendingChanges.value.values())
    let savedCount = 0
    let errorCount = 0

    try {
      for (const change of changes) {
        try {
          // Here you would typically call the database store to save the observation
          // For now, we'll just clear the pending changes
          const key = createChangeKey(change.patientId, change.encounterNum, change.conceptCode)
          pendingChanges.value.delete(key)
          savedCount++

          logger.debug('Change saved', { key, value: change.value })
        } catch (error) {
          logger.error('Failed to save change', error, { change })
          errorCount++
        }
      }

      lastUpdateTime.value = new Date().toLocaleTimeString()

      if (errorCount === 0) {
        logger.success('All changes saved successfully', { savedCount })
      } else {
        logger.warn('Some changes failed to save', { savedCount, errorCount })
      }

      return { savedCount, errorCount }
    } finally {
      savingAll.value = false
    }
  }

  const refreshData = async (patientIds) => {
    logger.info('Refreshing grid data')
    await loadGridData(patientIds)
    lastUpdateTime.value = new Date().toLocaleTimeString()
  }

  const clearPendingChanges = () => {
    const changeCount = pendingChanges.value.size
    pendingChanges.value.clear()
    logger.info('Cleared pending changes', { changeCount })
  }

  // View options management
  const updateViewOptions = (newOptions) => {
    viewOptions.value = validateViewOptions({ ...viewOptions.value, ...newOptions })
    // Save to local settings
    localSettings.setSetting('dataGrid.viewOptions', viewOptions.value)
    logger.debug('Updated view options', { newOptions, validated: viewOptions.value })
  }

  const loadViewOptions = () => {
    const savedOptions = localSettings.getSetting('dataGrid.viewOptions')
    if (savedOptions) {
      viewOptions.value = { ...viewOptions.value, ...savedOptions }
      logger.debug('Loaded saved view options', { savedOptions })
    }
  }

  // Visit-type lock -----------------------------------------------------------
  //
  // Loads visit types + field sets from CODE_LOOKUP and derives, per visit
  // type, the set of concept codes/categories its field sets claim. Failure is
  // non-fatal: without the map no cell ever renders locked.
  const loadVisitTypeLockData = async () => {
    try {
      const lookupSql = "SELECT CODE_CD, NAME_CHAR, LOOKUP_BLOB FROM CODE_LOOKUP WHERE TABLE_CD = 'VISIT_DIMENSION' AND COLUMN_CD = ?"
      const [visitTypesResult, fieldSetsResult] = await Promise.all([
        dbStore.executeQuery(lookupSql, ['VISIT_TYPE_CD']),
        dbStore.executeQuery(lookupSql, ['FIELD_SET_CD']),
      ])
      if (!visitTypesResult.success || !fieldSetsResult.success) {
        throw new Error(visitTypesResult.error || fieldSetsResult.error || 'CODE_LOOKUP query failed')
      }
      visitTypeLockMap.value = buildVisitTypeLockMap(visitTypesResult.data, fieldSetsResult.data)
      lockVerdictCache.clear()

      // Derive display metadata from the same rows (label/icon/color chips)
      const meta = new Map()
      for (const row of visitTypesResult.data) {
        let label = row.NAME_CHAR || row.CODE_CD
        let icon = null
        let color = null
        if (row.LOOKUP_BLOB) {
          try {
            const blob = typeof row.LOOKUP_BLOB === 'string' ? JSON.parse(row.LOOKUP_BLOB) : row.LOOKUP_BLOB
            if (blob?.label) label = blob.label
            if (blob?.icon) icon = blob.icon
            if (blob?.color) color = blob.color
          } catch {
            // ignore malformed blob - fall back to NAME_CHAR
          }
        }
        meta.set(row.CODE_CD, { label, icon, color })
      }
      visitTypeMeta.value = meta

      logger.debug('Visit-type lock map loaded', {
        visitTypes: visitTypeLockMap.value.byVisitType.size,
        claimedConcepts: visitTypeLockMap.value.claimedConcepts.size,
      })
    } catch (error) {
      visitTypeLockMap.value = null
      lockVerdictCache.clear()
      logger.error('Failed to load visit-type lock data — lock disabled', error)
    }
  }

  // Whether a cell is locked under the visit-type lock (viewOptions toggle).
  // Memoized per (visitType, concept) — the template asks several times per
  // cell on every re-render, so repeated Set lookups are cached away.
  const isCellLocked = (row, concept) => {
    if (!viewOptions.value.visitTypeLockActive) return false
    if (!row || !concept || row.isPlaceholder || !row.visitTypeCode) return false
    const key = `${row.visitTypeCode}|${concept.code}|${concept.category || ''}`
    let verdict = lockVerdictCache.get(key)
    if (verdict === undefined) {
      verdict = isCellVisitTypeLocked(visitTypeLockMap.value, row, concept)
      lockVerdictCache.set(key, verdict)
    }
    return verdict
  }

  // Column visibility management
  const updateColumnVisibility = (columnCode, visible) => {
    logger.info('Updating column visibility in store', { columnCode, visible })

    // Safety check - ensure columnVisibility is initialized
    if (!columnVisibility.value) {
      columnVisibility.value = new Map()
    }

    // Update the visibility state
    columnVisibility.value.set(columnCode, visible)

    // Save to local settings for persistence
    const visibilityObject = Object.fromEntries(columnVisibility.value)
    localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)

    logger.debug('Column visibility updated', { columnCode, visible, totalColumns: columnVisibility.value.size })
  }

  // Column order management
  const updateColumnOrder = (newOrder) => {
    logger.info('Updating column order in store', { newOrder })

    if (!Array.isArray(newOrder)) {
      logger.warn('Invalid column order provided, must be an array', { newOrder })
      return
    }

    // Update the column order state
    columnOrder.value = [...newOrder]

    // Save to local settings for persistence
    localSettings.setSetting('dataGrid.columnOrder', columnOrder.value)

    logger.debug('Column order updated', { orderCount: columnOrder.value.length })
  }

  const loadColumnVisibility = () => {
    const savedVisibility = localSettings.getSetting('dataGrid.columnVisibility')
    if (savedVisibility && typeof savedVisibility === 'object') {
      columnVisibility.value = new Map(Object.entries(savedVisibility))
      logger.debug('Loaded saved column visibility', { savedVisibility })
    }
  }

  const loadColumnOrder = () => {
    const savedOrder = localSettings.getSetting('dataGrid.columnOrder')
    if (savedOrder && Array.isArray(savedOrder)) {
      columnOrder.value = [...savedOrder]
      logger.debug('Loaded saved column order', { savedOrder })
    }
  }

  const initializeColumnVisibility = () => {
    try {
      const concepts = observationConcepts.value || []
      if (!columnVisibility.value) {
        columnVisibility.value = new Map()
      }

      concepts.forEach((concept) => {
        if (concept && concept.code && !columnVisibility.value.has(concept.code)) {
          columnVisibility.value.set(concept.code, true) // Default to visible
        }
      })

      // Save to local settings
      const visibilityObject = Object.fromEntries(columnVisibility.value)
      localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)

      logger.debug('Initialized column visibility for concepts', { conceptCount: concepts.length })
    } catch (error) {
      logger.warn('Error initializing column visibility', error)
    }
  }

  const initializeColumnOrder = () => {
    try {
      const concepts = observationConcepts.value || []
      const conceptCodes = new Set(concepts.map(c => c.code))

      // If no order exists, initialize with all concepts
      if (!columnOrder.value || columnOrder.value.length === 0) {
        columnOrder.value = concepts.map((concept) => concept.code)
        localSettings.setSetting('dataGrid.columnOrder', columnOrder.value)
        logger.debug('Initialized column order for concepts', { conceptCount: concepts.length })
      } else {
        // Merge new concepts into existing order (append at end)
        const existingOrderSet = new Set(columnOrder.value)
        const newConcepts = concepts
          .filter(c => c.code && !existingOrderSet.has(c.code))
          .map(c => c.code)
        
        if (newConcepts.length > 0) {
          columnOrder.value = [...columnOrder.value, ...newConcepts]
          localSettings.setSetting('dataGrid.columnOrder', columnOrder.value)
          logger.debug('Merged new concepts into column order', { 
            existingCount: columnOrder.value.length - newConcepts.length,
            newCount: newConcepts.length 
          })
        }
        
        // Remove concepts that no longer exist
        const filteredOrder = columnOrder.value.filter(code => conceptCodes.has(code))
        if (filteredOrder.length !== columnOrder.value.length) {
          columnOrder.value = filteredOrder
          localSettings.setSetting('dataGrid.columnOrder', columnOrder.value)
          logger.debug('Removed obsolete concepts from column order', { 
            removed: columnOrder.value.length - filteredOrder.length 
          })
        }
      }
    } catch (error) {
      logger.warn('Error initializing column order', error)
    }
  }

  const showAllColumns = () => {
    const concepts = observationConcepts.value || []
    concepts.forEach((concept) => {
      if (concept && concept.code) {
        columnVisibility.value.set(concept.code, true)
      }
    })

    // Save to local settings
    const visibilityObject = Object.fromEntries(columnVisibility.value)
    localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)

    logger.info('Showed all columns', { columnCount: concepts.length })
  }

  const hideAllColumns = () => {
    const concepts = observationConcepts.value || []
    concepts.forEach((concept) => {
      if (concept && concept.code) {
        columnVisibility.value.set(concept.code, false)
      }
    })

    // Save to local settings
    const visibilityObject = Object.fromEntries(columnVisibility.value)
    localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)

    logger.info('Hid all columns', { columnCount: concepts.length })
  }

  const resetColumnOrder = () => {
    // Reset all columns to visible
    const concepts = observationConcepts.value || []
    concepts.forEach((concept) => {
      if (concept && concept.code) {
        columnVisibility.value.set(concept.code, true)
      }
    })

    // Reset column order to original order
    columnOrder.value = concepts.map((concept) => concept.code)

    // Save to local settings
    const visibilityObject = Object.fromEntries(columnVisibility.value)
    localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)
    localSettings.setSetting('dataGrid.columnOrder', columnOrder.value)

    logger.info('Reset column order - all columns now visible and in original order', { columnCount: concepts.length })
  }

  // Reset functions
  const resetGridData = () => {
    patientData.value = []
    observationConcepts.value = []
    tableRows.value = []
    pendingChanges.value.clear()
    undoStack.value = []
    redoStack.value = []
    lastUpdateTime.value = new Date().toLocaleTimeString()
    logger.info('Grid data reset')
  }

  // Add new concept to grid
  const addConceptToGrid = (concept) => {
    try {
      if (!concept || !concept.CONCEPT_CD || !concept.NAME_CHAR) {
        throw new Error('Invalid concept provided')
      }

      const newConcept = {
        code: concept.CONCEPT_CD,
        name: concept.NAME_CHAR,
        valueType: concept.VALTYPE_CD || 'T',
      }

      // Get current concepts
      const currentConcepts = Array.isArray(observationConcepts.value) ? [...observationConcepts.value] : []

      // Check if concept already exists
      const existingConcept = currentConcepts.find((c) => c.code === concept.CONCEPT_CD)
      if (existingConcept) {
        logger.warn('Attempted to add concept that already exists in grid', {
          conceptCode: concept.CONCEPT_CD,
          conceptName: concept.NAME_CHAR,
        })
        // Return success for existing concepts (idempotent operation)
        return { success: true, conceptCount: currentConcepts.length, rowCount: tableRows.value?.length || 0, alreadyExists: true }
      }

      // Add new concept
      currentConcepts.push(newConcept)
      observationConcepts.value = [...currentConcepts]

      // Get current rows
      const currentRows = Array.isArray(tableRows.value) ? [...tableRows.value] : []

      // Update table rows to include empty observations for this concept
      const updatedRows = currentRows.map((row) => ({
        ...row,
        observations: {
          ...row.observations,
          [concept.CONCEPT_CD]: {
            observationId: null,
            value: '',
            valueType: concept.VALTYPE_CD || 'T',
            unit: concept.UNIT_CD || '',
            originalValue: '',
            resolvedValue: null,
          },
        },
      }))

      tableRows.value = [...updatedRows]

      // Initialize column visibility for the new concept
      if (!columnVisibility.value) {
        columnVisibility.value = new Map()
      }
      columnVisibility.value.set(concept.CONCEPT_CD, true) // Make new column visible by default
      
      // Save visibility to local settings
      const visibilityObject = Object.fromEntries(columnVisibility.value)
      localSettings.setSetting('dataGrid.columnVisibility', visibilityObject)

      logger.info('Concept added to grid via store method', {
        conceptCode: concept.CONCEPT_CD,
        conceptName: concept.NAME_CHAR,
        totalConcepts: currentConcepts.length,
        totalRows: updatedRows.length,
      })

      return { success: true, conceptCount: currentConcepts.length, rowCount: updatedRows.length }
    } catch (error) {
      logger.error('Failed to add concept to grid', error, {
        conceptCode: concept?.CONCEPT_CD,
        conceptName: concept?.NAME_CHAR,
      })
      throw error
    }
  }

  // Initialize function
  const initialize = () => {
    loadViewOptions()
    loadColumnVisibility()
    loadColumnOrder()
    logger.info('DataGridStore initialized')
  }

  return {
    // State
    loading,
    savingAll,
    patientData,
    observationConcepts,
    tableRows,
    pendingChanges,
    lastUpdateTime,
    viewOptions,
    columnVisibility,
    columnOrder,
    auditFilterActive,
    visitTypeLockMap,
    visitTypeMeta,

    // Getters
    totalObservations,
    hasUnsavedChanges,
    unsavedChangesCount,
    canUndo,
    canRedo,
    getVisibleObservationConcepts,
    getVisibleTableRows,
    conceptCodesWithOpenAudit,
    statistics,

    // Utility functions
    getPatientName,
    getPatientInitials,
    formatDate,
    getCellValue,
    getCellObservationId,
    getCellClass: getCellClassWithContext,
    hasRowChanges: hasRowChangesWithContext,

    // Data operations
    loadGridData,
    saveAllChanges,
    refreshData,
    clearPendingChanges,
    addConceptToGrid,

    // Event handlers
    handleCellUpdate,
    handleCellSave,
    handleCellError,

    // Audit workflow
    setObservationFlag,
    deleteObservationFromGrid,
    toggleAuditFilter,
    loadVisitTypeLockData,
    isCellLocked,
    setObservationStartDate,

    // Undo/redo
    recordEdit,
    applyCellValue,
    undo,
    redo,
    clearUndoHistory,

    // View options
    updateViewOptions,
    loadViewOptions,

    // Column visibility management
    updateColumnVisibility,
    loadColumnVisibility,
    initializeColumnVisibility,
    showAllColumns,
    hideAllColumns,
    resetColumnOrder,

    // Column order management
    updateColumnOrder,
    loadColumnOrder,
    initializeColumnOrder,

    // Reset
    resetGridData,

    // Initialize
    initialize,
  }
})
