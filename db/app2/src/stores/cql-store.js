/**
 * CQL Store
 *
 * Manages CQL rules state and operations following MVC architecture.
 * Handles CRUD operations, pagination, search, and caching for CQL rules.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'

export const useCqlStore = defineStore('cql', () => {
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('CqlStore')

  // State
  const cqlRules = ref([])
  const selectedRule = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const testing = ref(false)
  const error = ref(null)
  const searchQuery = ref('')
  const pagination = ref({
    sortBy: 'CODE_CD',
    descending: false,
    page: 1,
    rowsPerPage: 10,
    rowsNumber: 0,
  })

  // Getters
  const totalRules = computed(() => pagination.value.rowsNumber)

  const hasRules = computed(() => cqlRules.value.length > 0)

  const filteredRules = computed(() => {
    if (!searchQuery.value) return cqlRules.value
    const query = searchQuery.value.toLowerCase()
    return cqlRules.value.filter((rule) => rule.CODE_CD?.toLowerCase().includes(query) || rule.NAME_CHAR?.toLowerCase().includes(query) || rule.CQL_BLOB?.toLowerCase().includes(query))
  })

  const getCqlStatusColor = (rule) => {
    if (rule.CQL_CHAR && rule.JSON_CHAR) return 'green'
    if (rule.CQL_CHAR) return 'orange'
    return 'grey'
  }

  const getCqlStatusLabel = (rule) => {
    if (rule.CQL_CHAR && rule.JSON_CHAR) return 'Ready'
    if (rule.CQL_CHAR) return 'Draft'
    return 'Empty'
  }

  const getCqlStatusTooltip = (rule) => {
    if (rule.CQL_CHAR && rule.JSON_CHAR) return 'CQL rule is complete and ready for execution'
    if (rule.CQL_CHAR) return 'CQL rule has source code but no compiled JSON'
    return 'CQL rule is empty and needs to be configured'
  }

  // Actions
  const clearError = () => {
    error.value = null
  }

  const setSearchQuery = (query) => {
    searchQuery.value = query
    pagination.value.page = 1 // Reset to first page when searching
  }

  const clearSearch = () => {
    searchQuery.value = ''
    pagination.value.page = 1
  }

  const setPagination = (newPagination) => {
    pagination.value = { ...pagination.value, ...newPagination }
  }

  const loadCqlRules = async (forcePage = null) => {
    loading.value = true
    error.value = null

    try {
      logger.info('Loading CQL rules', {
        page: forcePage || pagination.value.page,
        pageSize: pagination.value.rowsPerPage,
        search: searchQuery.value,
      })

      const cqlRepo = dbStore.getRepository('cql')
      if (!cqlRepo) {
        throw new Error('CQL repository not available')
      }

      // Build search criteria
      const criteria = {}
      if (searchQuery.value) {
        criteria.search = String(searchQuery.value)
      }

      // Get paginated results
      const result = await cqlRepo.getCqlRulesPaginated(forcePage || pagination.value.page, pagination.value.rowsPerPage, criteria)

      cqlRules.value = result.rules || []
      pagination.value.rowsNumber = result.pagination?.totalCount || 0

      logger.success('CQL rules loaded', {
        count: cqlRules.value.length,
        total: pagination.value.rowsNumber,
      })
    } catch (err) {
      error.value = err.message || 'Failed to load CQL rules'
      logger.error('Failed to load CQL rules', err)
      cqlRules.value = []
      pagination.value.rowsNumber = 0
    } finally {
      loading.value = false
    }
  }

  const getCqlRule = async (cqlId) => {
    try {
      logger.info('Getting CQL rule', { cqlId })

      const cqlRepo = dbStore.getRepository('cql')
      if (!cqlRepo) {
        throw new Error('CQL repository not available')
      }

      const rule = await cqlRepo.findById(cqlId)
      if (!rule) {
        throw new Error('CQL rule not found')
      }

      logger.success('CQL rule retrieved', { cqlId, code: rule.CODE_CD })
      return rule
    } catch (err) {
      error.value = err.message || 'Failed to get CQL rule'
      logger.error('Failed to get CQL rule', err)
      throw err
    }
  }

  const createCqlRule = async (cqlData) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Creating CQL rule', { code: cqlData.CODE_CD })

      const cqlRepo = dbStore.getRepository('cql')
      if (!cqlRepo) {
        throw new Error('CQL repository not available')
      }

      // Check if rule already exists
      const existing = await cqlRepo.findBy({ CODE_CD: cqlData.CODE_CD })
      if (existing && existing.length > 0) {
        throw new Error('CQL rule with this code already exists')
      }

      // Create the rule
      const newRule = await cqlRepo.create(cqlData)

      // Add to local state
      cqlRules.value.unshift(newRule)
      pagination.value.rowsNumber += 1

      logger.success('CQL rule created', { cqlId: newRule.CQL_ID, code: newRule.CODE_CD })
      return newRule
    } catch (err) {
      error.value = err.message || 'Failed to create CQL rule'
      logger.error('Failed to create CQL rule', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const updateCqlRule = async (cqlId, updates) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Updating CQL rule', { cqlId, updates: Object.keys(updates) })

      const cqlRepo = dbStore.getRepository('cql')
      if (!cqlRepo) {
        throw new Error('CQL repository not available')
      }

      const updatedRule = await cqlRepo.update(cqlId, updates)

      // Update local state
      const index = cqlRules.value.findIndex((rule) => rule.CQL_ID === cqlId)
      if (index !== -1) {
        cqlRules.value[index] = { ...cqlRules.value[index], ...updatedRule }
      }

      // Update selected rule if it's the one being updated
      if (selectedRule.value?.CQL_ID === cqlId) {
        selectedRule.value = { ...selectedRule.value, ...updatedRule }
      }

      logger.success('CQL rule updated', { cqlId })
      return updatedRule
    } catch (err) {
      error.value = err.message || 'Failed to update CQL rule'
      logger.error('Failed to update CQL rule', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const deleteCqlRule = async (cqlId) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Deleting CQL rule', { cqlId })

      const cqlRepo = dbStore.getRepository('cql')
      if (!cqlRepo) {
        throw new Error('CQL repository not available')
      }

      await cqlRepo.delete(cqlId)

      // Remove from local state
      const index = cqlRules.value.findIndex((rule) => rule.CQL_ID === cqlId)
      if (index !== -1) {
        cqlRules.value.splice(index, 1)
        pagination.value.rowsNumber -= 1
      }

      // Clear selected rule if it was deleted
      if (selectedRule.value?.CQL_ID === cqlId) {
        selectedRule.value = null
      }

      logger.success('CQL rule deleted', { cqlId })
    } catch (err) {
      error.value = err.message || 'Failed to delete CQL rule'
      logger.error('Failed to delete CQL rule', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const setSelectedRule = (rule) => {
    selectedRule.value = rule
    logger.info('Selected CQL rule', { cqlId: rule?.CQL_ID, code: rule?.CODE_CD })
  }

  const clearSelectedRule = () => {
    selectedRule.value = null
    logger.info('Cleared selected CQL rule')
  }

  const refreshRules = async () => {
    await loadCqlRules()
  }

  const testCqlRule = async (rule, testValue, valueType = 'string') => {
    testing.value = true
    error.value = null

    try {
      logger.info('Testing CQL rule', { cqlId: rule?.CQL_ID, testValue, valueType })

      if (!rule) {
        throw new Error('No CQL rule provided')
      }

      if (!rule.JSON_CHAR) {
        throw new Error('CQL rule has no compiled JSON. Please compile the rule first.')
      }

      // Convert test value based on type
      let processedValue = testValue
      if (valueType === 'number') {
        processedValue = parseFloat(testValue)
        if (isNaN(processedValue)) {
          throw new Error('Invalid number format')
        }
      }

      // Execute CQL rule
      const result = await executeCqlRule(rule, processedValue)

      logger.success('CQL rule tested', { cqlId: rule.CQL_ID, result })
      return result
    } catch (err) {
      error.value = err.message || 'Failed to test CQL rule'
      logger.error('Failed to test CQL rule', err)
      throw err
    } finally {
      testing.value = false
    }
  }

  const executeCqlRule = async (rule, value) => {
    try {
      // Dynamic import to avoid bundling issues
      const { default: cql } = await import('cql-execution')
      const { unstringify_json, unstringify_char } = await import('src/shared/utils/sql-tools.js')

      // Parse the JSON_CHAR using the unstringify_json utility
      let lib
      try {
        const jsonString = unstringify_json(rule.JSON_CHAR)
        lib = JSON.parse(jsonString)
      } catch (parseError) {
        // If JSON parsing fails, try to use CQL_CHAR as fallback for debugging
        const cqlText = unstringify_char(rule.CQL_CHAR)
        logger.warn('JSON parsing failed, CQL text available', {
          hasJson: !!rule.JSON_CHAR,
          hasCql: !!rule.CQL_CHAR,
          cqlPreview: cqlText?.substring(0, 100) + '...',
        })
        throw new Error('Invalid JSON format in CQL rule: ' + parseError.message)
      }

      // Execute CQL using the cql-execution library
      return await executeCqlWithLibrary(cql, lib, value)
    } catch (err) {
      throw new Error(err.message || 'CQL execution failed')
    }
  }

  const executeCqlWithLibrary = async (cql, lib, value) => {
    try {
      // Validate payload
      if (!lib || typeof lib !== 'object') {
        throw new Error('Invalid CQL library format')
      }

      // Initialize CQL library
      let cqlLibrary
      try {
        cqlLibrary = new cql.Library(lib)
      } catch (err) {
        throw new Error('Failed to initialize CQL library: ' + (err.message || err))
      }

      // Set up CQL execution environment
      const patientSource = new cql.PatientSource([])
      const codeService = new cql.CodeService([])
      const executionDateTime = null

      // Create parameters object - CQL rules expect a VALUE parameter
      const parameters = { VALUE: value }

      // Create executor
      const executor = new cql.Executor(cqlLibrary, codeService, parameters)

      // Execute CQL
      try {
        const result = await executor.exec(patientSource, executionDateTime)

        if (result && result.unfilteredResults && Object.keys(result.unfilteredResults).length > 0) {
          const data = result.unfilteredResults

          // Check if all results are true
          let check = true
          Object.keys(data).forEach((key) => {
            if (data[key] === false) {
              check = false
            }
          })

          return {
            success: true,
            data: { check, data },
          }
        } else {
          return {
            success: true,
            data: { data: result, check: false },
          }
        }
      } catch (execError) {
        throw new Error(execError.message || execError.toString())
      }
    } catch (err) {
      throw new Error('CQL execution error: ' + (err.message || err))
    }
  }

  const getCqlStatistics = async () => {
    try {
      logger.info('Getting CQL statistics')

      const cqlRepo = dbStore.getRepository('cql')
      if (!cqlRepo) {
        throw new Error('CQL repository not available')
      }

      const stats = await cqlRepo.getCqlRuleStatistics()
      logger.success('CQL statistics retrieved', stats)
      return stats
    } catch (err) {
      error.value = err.message || 'Failed to get CQL statistics'
      logger.error('Failed to get CQL statistics', err)
      throw err
    }
  }

  // Initialize
  const initialize = async () => {
    logger.info('Initializing CQL store')
    await loadCqlRules()
  }

  return {
    // State
    cqlRules,
    selectedRule,
    loading,
    saving,
    testing,
    error,
    searchQuery,
    pagination,

    // Getters
    totalRules,
    hasRules,
    filteredRules,
    getCqlStatusColor,
    getCqlStatusLabel,
    getCqlStatusTooltip,

    // Actions
    clearError,
    setSearchQuery,
    clearSearch,
    setPagination,
    loadCqlRules,
    getCqlRule,
    createCqlRule,
    updateCqlRule,
    deleteCqlRule,
    setSelectedRule,
    clearSelectedRule,
    refreshRules,
    testCqlRule,
    getCqlStatistics,
    initialize,
  }
})
