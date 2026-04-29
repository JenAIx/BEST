/**
 * Data Grid Store
 * Manages state and operations for the data grid editor functionality
 * Handles cell operations, change tracking, and grid-specific utilities
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLocalSettingsStore } from './local-settings-store'
import { useLoggingStore } from './logging-store'
import { getPatientInitials, formatDate } from 'src/shared/utils/medical-utils'
import {
  getCellClass,
  hasRowChanges,
  getCellValue,
  getCellObservationId,
  getPatientNameFromGridData,
  cleanPatientIds,
  createChangeKey,
  getDefaultViewOptions,
  validateViewOptions,
} from 'src/shared/utils/grid-utils'

export const useDataGridStore = defineStore('dataGrid', () => {
  const dbStore = useDatabaseStore()
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

  // Visible observation concepts based on column visibility and order
  const getVisibleObservationConcepts = computed(() => {
    const allConcepts = observationConcepts.value || []

    // If no visibility state exists, show all columns
    if (!columnVisibility.value || columnVisibility.value.size === 0) {
      return allConcepts
    }

    try {
      // First filter by visibility
      const visibleConcepts = allConcepts.filter((concept) => {
        // If no visibility state exists for this column, default to visible
        return columnVisibility.value.get(concept.code) !== false
      })

      // If we have a custom column order, use it to sort the visible concepts
      if (columnOrder.value && columnOrder.value.length > 0) {
        const orderMap = new Map(columnOrder.value.map((code, index) => [code, index]))

        return visibleConcepts.sort((a, b) => {
          const aIndex = orderMap.get(a.code) ?? 999
          const bIndex = orderMap.get(b.code) ?? 999
          return aIndex - bIndex
        })
      }

      // No custom order, return visible concepts as-is
      return visibleConcepts
    } catch (error) {
      logger.warn('Error filtering visible concepts in store', error)
      return allConcepts // Fallback to showing all concepts
    }
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

      rows.forEach((row) => {
        visibleConcepts.forEach((concept) => {
          totalCells++
          try {
            const cellValue = getCellValue(row, concept)
            // Consider a cell filled if it has a non-empty value
            if (cellValue !== null && cellValue !== undefined && cellValue !== 'NULL' && (typeof cellValue === 'string' ? cellValue.trim() !== '' : String(cellValue).trim() !== '')) {
              filledCells++
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

      // Load patient data using the database store
      const patients = await dbStore.loadBatchPatientData(cleanedIds)
      patientData.value = patients

      // Load observation data
      const observations = await dbStore.loadBatchObservationData(cleanedIds)

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
    const { patientId, encounterNum, conceptCode, value, observationId } = data
    const key = createChangeKey(patientId, encounterNum, conceptCode)

    logger.debug('Handling cell update', { key, value, observationId })

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
    // to INSERT again instead of UPDATE).
    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row) {
      if (!row.observations[conceptCode]) {
        row.observations[conceptCode] = {}
      }
      row.observations[conceptCode].value = value
      if (observationId != null) {
        row.observations[conceptCode].observationId = observationId
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

  // INSERT a fresh OBSERVATION_FACT row from a value-only context. Used by
  // applyCellValue when fill-down (or future bulk ops) target a cell that
  // doesn't have an observation yet. Mirrors EditableCell.createObservation
  // but with simpler defaults — keeping the duplication contained until a
  // shared cell-write service is justified.
  const createCellObservation = async ({ patientId, encounterNum, conceptCode, value, valueType }) => {
    const patientResult = await dbStore.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?', [patientId])
    if (!patientResult.success || !patientResult.data.length) {
      throw new Error(`Patient not found: ${patientId}`)
    }
    const patientNum = patientResult.data[0].PATIENT_NUM

    const visitResult = await dbStore.executeQuery('SELECT START_DATE FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?', [encounterNum])
    const startDate = visitResult.success && visitResult.data.length > 0 ? visitResult.data[0].START_DATE : new Date().toISOString().split('T')[0]

    const observationData = {
      PATIENT_NUM: patientNum,
      ENCOUNTER_NUM: encounterNum,
      CONCEPT_CD: conceptCode,
      VALTYPE_CD: valueType,
      START_DATE: startDate,
      CATEGORY_CHAR: 'CLINICAL',
      PROVIDER_ID: 'SYSTEM',
      LOCATION_CD: 'DATAGRID',
      SOURCESYSTEM_CD: 'DATAGRID_EDITOR',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }
    if (valueType === 'N') {
      observationData.NVAL_NUM = parseFloat(value) || 0
    } else {
      observationData.TVAL_CHAR = String(value)
    }

    const observationRepo = dbStore.getRepository('observation')
    const result = await observationRepo.createObservation(observationData)
    if (!result || !result.OBSERVATION_ID) {
      throw new Error('Failed to create observation - no ID returned')
    }
    return result.OBSERVATION_ID
  }

  // Persist a value into a specific cell — used by undo/redo and fill-down.
  // UPDATE path when observationId is known; INSERT path when it isn't and
  // the new value is non-empty. Observation rows are never deleted —
  // clearing a value just nulls TVAL_CHAR/NVAL_NUM.
  const applyCellValue = async ({ patientId, encounterNum, conceptCode, value, observationId, valueType }) => {
    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row) {
      if (!row.observations[conceptCode]) row.observations[conceptCode] = {}
      row.observations[conceptCode].value = value
    }

    let resolvedObservationId = observationId
    if (observationId != null) {
      const updates = {}
      if (valueType === 'N') {
        updates.NVAL_NUM = value === null || value === '' ? null : Number(value)
        updates.TVAL_CHAR = null
      } else {
        updates.TVAL_CHAR = value === null || value === '' ? null : String(value)
        updates.NVAL_NUM = null
      }
      const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ')
      const params = [...Object.values(updates), observationId]
      const sql = `UPDATE OBSERVATION_FACT SET ${setClause}, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?`
      const result = await dbStore.executeQuery(sql, params)
      if (!result.success) {
        throw new Error(result.error || 'Failed to update observation')
      }
    } else if (value !== null && value !== undefined && value !== '') {
      // No observation yet, but we want to write a value — create it.
      resolvedObservationId = await createCellObservation({ patientId, encounterNum, conceptCode, value, valueType })
      if (row && row.observations[conceptCode]) {
        row.observations[conceptCode].observationId = resolvedObservationId
      }
    }
    lastUpdateTime.value = new Date().toLocaleTimeString()
    return resolvedObservationId
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

    // Getters
    totalObservations,
    hasUnsavedChanges,
    unsavedChangesCount,
    canUndo,
    canRedo,
    getVisibleObservationConcepts,
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
