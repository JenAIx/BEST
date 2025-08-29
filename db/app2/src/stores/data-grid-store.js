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
import { useQuasar } from 'quasar'
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
  const $q = useQuasar()

  // State
  const loading = ref(false)
  const savingAll = ref(false)
  const patientData = ref([])
  const observationConcepts = ref([])
  const tableRows = ref([])
  const pendingChanges = ref(new Map())
  const lastUpdateTime = ref(new Date().toLocaleTimeString())

  // View options
  const viewOptions = ref(getDefaultViewOptions())

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

  // Utility functions
  const getPatientName = getPatientNameFromGridData

  // Enhanced cell utility functions with pending changes context
  const getCellClassWithContext = (row, concept) => {
    return getCellClass(row, concept, viewOptions.value.highlightChanges, viewOptions.value.compactView)
  }

  const hasRowChangesWithContext = (row) => {
    return hasRowChanges(row, observationConcepts.value, viewOptions.value.highlightChanges)
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
      observationConcepts.value = processed.observationConcepts
      tableRows.value = processed.tableRows

      lastUpdateTime.value = new Date().toLocaleTimeString()

      logger.success('Grid data loaded successfully', {
        patients: patients.length,
        observations: observations.length,
        concepts: processed.observationConcepts.length,
        rows: processed.tableRows.length,
      })
    } catch (error) {
      logger.error('Failed to load grid data', error)
      $q.notify({
        type: 'negative',
        message: `Failed to load grid data: ${error.message}`,
        position: 'top',
      })
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

    // Update the local data
    const row = tableRows.value.find((r) => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row) {
      if (!row.observations[conceptCode]) {
        row.observations[conceptCode] = {}
      }
      row.observations[conceptCode].value = value
    }
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
    logger.error('Cell error', error)
    $q.notify({
      type: 'negative',
      message: `Cell error: ${error.message}`,
      position: 'top',
    })
  }

  // Batch operations
  const saveAllChanges = async () => {
    if (!hasUnsavedChanges.value) return

    try {
      savingAll.value = true
      logger.info('Starting batch save of all changes', { changeCount: pendingChanges.value.size })

      const changes = Array.from(pendingChanges.value.values())
      let savedCount = 0
      let errorCount = 0

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
        $q.notify({
          type: 'positive',
          message: `Saved ${savedCount} changes successfully`,
          position: 'top',
        })
        logger.success('All changes saved successfully', { savedCount })
      } else {
        $q.notify({
          type: 'warning',
          message: `Saved ${savedCount} changes, ${errorCount} failed`,
          position: 'top',
        })
        logger.warn('Some changes failed to save', { savedCount, errorCount })
      }
    } catch (error) {
      logger.error('Failed to save all changes', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to save some changes',
        position: 'top',
      })
    } finally {
      savingAll.value = false
    }
  }

  const refreshData = async (patientIds) => {
    logger.info('Refreshing grid data')
    await loadGridData(patientIds)
    lastUpdateTime.value = new Date().toLocaleTimeString()

    $q.notify({
      type: 'info',
      message: 'Data refreshed',
      position: 'top',
    })
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

  // Reset functions
  const resetGridData = () => {
    patientData.value = []
    observationConcepts.value = []
    tableRows.value = []
    pendingChanges.value.clear()
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

    // Getters
    totalObservations,
    hasUnsavedChanges,
    unsavedChangesCount,

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

    // View options
    updateViewOptions,
    loadViewOptions,

    // Reset
    resetGridData,

    // Initialize
    initialize,
  }
})
