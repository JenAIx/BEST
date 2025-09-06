/**
 * Study Store
 *
 * Manages research studies state and operations.
 * Part of the MVC refactoring to separate concerns.
 *
 * Uses database integration with STUDY_DIMENSION and STUDY_PATIENT_LOOKUP tables
 * for full CRUD operations and real-time data management.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'

export const useStudyStore = defineStore('study', () => {
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('StudyStore')

  // State
  const studies = ref([])
  const selectedStudy = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const totalStudies = ref(0)
  const researchStats = ref({
    totalStudies: 0,
    neurologicalStudies: 0,
    strokeStudies: 0,
    activeStudies: 0,
  })


  // Getters
  const hasStudies = computed(() => studies.value.length > 0)

  const selectedStudyId = computed(() => selectedStudy.value?.id)

  const sortedStudies = computed(() => {
    return [...studies.value].filter(s => s).sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created))
  })

  const activeStudies = computed(() => {
    return studies.value.filter((study) => study && study.status === 'active')
  })

  const completedStudies = computed(() => {
    return studies.value.filter((study) => study && study.status === 'completed')
  })

  const studiesByCategory = computed(() => {
    const categories = {}
    studies.value.forEach((study) => {
      if (study && study.category) {
        if (!categories[study.category]) {
          categories[study.category] = []
        }
        categories[study.category].push(study)
      }
    })
    return categories
  })

  const studyOptions = computed(() => {
    return studies.value.filter(s => s).map((study) => ({
      label: study.name,
      value: study.id,
      subtitle: `${study.category} • ${study.patientCount}/${study.targetPatientCount || 'N/A'} patients`,
      icon: getCategoryIcon(study.category),
      color: getCategoryColor(study.category),
    }))
  })

  const searchResults = computed(() => {
    return (query, filters = {}) => {
      if (!query && !Object.keys(filters).length) {
        return sortedStudies.value
      }

      let results = [...studies.value].filter(s => s)

      // Apply text search
      if (query) {
        const searchTerm = query.toLowerCase()
        results = results.filter(
          (study) =>
            study.name?.toLowerCase().includes(searchTerm) ||
            study.category?.toLowerCase().includes(searchTerm) ||
            study.description?.toLowerCase().includes(searchTerm) ||
            study.principalInvestigator?.toLowerCase().includes(searchTerm) ||
            study.concepts?.some((concept) => concept?.toLowerCase().includes(searchTerm)),
        )
      }

      // Apply filters
      if (filters.category) {
        results = results.filter((study) => study && study.category === filters.category)
      }

      if (filters.status) {
        results = results.filter((study) => study && study.status === filters.status)
      }

      if (filters.patientCountMin !== undefined || filters.patientCountMax !== undefined) {
        results = results.filter((study) => {
          if (!study) return false
          const min = filters.patientCountMin || 0
          const max = filters.patientCountMax || Infinity
          return study.patientCount >= min && study.patientCount <= max
        })
      }

      return results.sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created))
    }
  })

  // Helper functions
  const getCategoryIcon = (category) => {
    const icons = {
      'Neurological Assessment': 'psychology',
      'Clinical Scales': 'timeline',
      'Stroke Research': 'healing',
      'Psychological Assessment': 'sentiment_satisfied',
      'Imaging Studies': 'image',
      'Laboratory Research': 'science',
    }
    return icons[category] || 'biotech'
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Neurological Assessment': 'primary',
      'Clinical Scales': 'secondary',
      'Stroke Research': 'positive',
      'Psychological Assessment': 'info',
      'Imaging Studies': 'warning',
      'Laboratory Research': 'negative',
    }
    return colors[category] || 'grey'
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'positive',
      completed: 'info',
      planning: 'warning',
      'on-hold': 'negative',
    }
    return colors[status] || 'grey'
  }

  // Actions
  const setSelectedStudy = (study) => {
    if (!study) {
      selectedStudy.value = null
      return
    }

    logger.info('Setting selected study', { studyId: study.id })

    // Ensure we're using the study object from our store
    const storeStudy = studies.value.find((s) => s.id === study.id)
    if (storeStudy) {
      selectedStudy.value = storeStudy
    } else {
      logger.warn('Study not found in store', { studyId: study.id })
      selectedStudy.value = study
    }
  }

  const clearSelectedStudy = () => {
    selectedStudy.value = null
  }

  const clearStudies = () => {
    studies.value = []
    selectedStudy.value = null
    error.value = null
    totalStudies.value = 0
  }

  const loadStudies = async (options = {}) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Loading studies', { options })

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      const studyRepo = dbStore.getRepository('study')
      const allStudies = await studyRepo.findAll()

      studies.value = allStudies
      totalStudies.value = allStudies.length

      // Update research stats
      updateResearchStats()

      logger.success('Studies loaded', { count: studies.value.length })

      return studies.value
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load studies', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadStudyById = async (studyId) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Loading study by ID', { studyId })

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      const studyRepo = dbStore.getRepository('study')
      const study = await studyRepo.findById(studyId)

      if (!study) {
        throw new Error(`Study with ID ${studyId} not found`)
      }

      // Ensure study is in our store
      const existingIndex = studies.value.findIndex((s) => s.id === studyId)
      if (existingIndex >= 0) {
        studies.value[existingIndex] = study
      } else {
        studies.value.push(study)
      }

      selectedStudy.value = study

      logger.success('Study loaded', { studyId, studyName: study.name })

      return study
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load study', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createStudy = async (studyData) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Creating new study', { studyName: studyData.name })

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      const studyRepo = dbStore.getRepository('study')
      const newStudy = await studyRepo.create(studyData)

      // Add to store
      studies.value.push(newStudy)
      totalStudies.value++

      // Update stats
      updateResearchStats()

      logger.success('Study created', { studyId: newStudy.id, studyName: newStudy.name })

      return newStudy
    } catch (err) {
      error.value = err.message
      logger.error('Failed to create study', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateStudy = async (studyId, updateData) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Updating study', { studyId, updateData })

      const studyIndex = studies.value.findIndex((s) => s.id === studyId)
      if (studyIndex === -1) {
        throw new Error(`Study with ID ${studyId} not found`)
      }

      // For now, update mock data - replace with database operation later
      const updatedStudy = {
        ...studies.value[studyIndex],
        ...updateData,
        updated: new Date().toISOString().split('T')[0],
      }

      studies.value[studyIndex] = updatedStudy

      // Update selected study if it's the one being updated
      if (selectedStudy.value?.id === studyId) {
        selectedStudy.value = updatedStudy
      }

      logger.success('Study updated', { studyId, studyName: updatedStudy.name })

      return updatedStudy
    } catch (err) {
      error.value = err.message
      logger.error('Failed to update study', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteStudy = async (studyId) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Deleting study', { studyId })

      const studyIndex = studies.value.findIndex((s) => s.id === studyId)
      if (studyIndex === -1) {
        throw new Error(`Study with ID ${studyId} not found`)
      }

      const studyToDelete = studies.value[studyIndex]

      // For now, remove from mock data - replace with database operation later
      studies.value.splice(studyIndex, 1)
      totalStudies.value--

      // Clear selection if this study was selected
      if (selectedStudy.value?.id === studyId) {
        selectedStudy.value = null
      }

      // Update stats
      updateResearchStats()

      logger.success('Study deleted', { studyId, studyName: studyToDelete.name })

      return studyToDelete
    } catch (err) {
      error.value = err.message
      logger.error('Failed to delete study', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const searchStudies = async (query, filters = {}) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Searching studies', { query, filters })

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      const studyRepo = dbStore.getRepository('study')
      const searchCriteria = {}

      // Don't add name search when we're filtering by category
      // The query contains the category name, but we only want to filter by category
      if (query && !filters.researchCategory) {
        searchCriteria.name = query
      }

      if (filters.researchCategory) {
        // Try to find the actual category name from the slug
        const categories = Object.keys(studies.value.reduce((acc, study) => {
          if (study && study.category) acc[study.category] = true
          return acc
        }, {}))

        let categoryName = filters.researchCategory

        // If it's a slug, try to convert it back to the original name
        const matchingCategory = categories.find(category =>
          category.toLowerCase().replace(/\s+/g, '-') === filters.researchCategory
        )

        if (matchingCategory) {
          categoryName = matchingCategory
        } else if (categories.includes(filters.researchCategory)) {
          // Direct match
          categoryName = filters.researchCategory
        }

        searchCriteria.category = categoryName
        logger.info('Filtering by category', { 
          original: filters.researchCategory, 
          matched: categoryName,
          query: query,
          searchCriteria: searchCriteria
        })
      }

      if (filters.studyStatus) {
        searchCriteria.status = filters.studyStatus
      }

      logger.info('Final search criteria', { searchCriteria, query, filters })
      const results = await studyRepo.search(searchCriteria)

      // Update store with search results
      studies.value = results
      totalStudies.value = results.length

      logger.success('Studies searched', { query, resultCount: results.length })

      return results
    } catch (err) {
      error.value = err.message
      logger.error('Failed to search studies', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateResearchStats = () => {
    const total = studies.value.length
    const neurological = studies.value.filter((s) => s && s.category === 'Neurological Assessment').length
    const stroke = studies.value.filter((s) => s && s.category && s.category.includes('Stroke')).length
    const active = studies.value.filter((s) => s && s.status === 'active').length

    researchStats.value = {
      totalStudies: total,
      neurologicalStudies: neurological,
      strokeStudies: stroke,
      activeStudies: active,
    }

    logger.debug('Research stats updated', researchStats.value)
  }

  const loadResearchStats = async () => {
    try {
      if (!dbStore.canPerformOperations) return

      const studyRepo = dbStore.getRepository('study')
      const stats = await studyRepo.getStatistics()

      researchStats.value = {
        totalStudies: stats.totalStudies || 0,
        neurologicalStudies: stats.studiesByCategory?.find(c => c.CATEGORY_CHAR === 'Neurological Assessment')?.count || 0,
        strokeStudies: stats.studiesByCategory?.find(c => c.CATEGORY_CHAR?.includes('Stroke'))?.count || 0,
        activeStudies: stats.studiesByStatus?.find(s => s.STATUS_CD === 'active')?.count || 0
      }

      logger.debug('Research stats loaded from database', researchStats.value)
    } catch (error) {
      logger.error('Failed to load research stats:', error)
    }
  }

  const getStudyAnalytics = async (studyId) => {
    try {
      const study = studies.value.find((s) => s.id === studyId)
      if (!study) {
        throw new Error(`Study with ID ${studyId} not found`)
      }

      // Mock analytics data - replace with real calculations later
      const analytics = {
        patientProgress: Math.min((study.patientCount / (study.targetPatientCount || study.patientCount)) * 100, 100),
        completionRate: study.status === 'completed' ? 100 : Math.random() * 100,
        dataQuality: Math.random() * 100,
        timeline: {
          startDate: study.startDate,
          endDate: study.endDate,
          daysElapsed: study.startDate ? Math.floor((new Date() - new Date(study.startDate)) / (1000 * 60 * 60 * 24)) : 0,
          daysRemaining: study.endDate ? Math.floor((new Date(study.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        },
      }

      logger.info('Study analytics generated', { studyId, analytics })

      return analytics
    } catch (err) {
      logger.error('Failed to get study analytics', err)
      throw err
    }
  }

  // Initialize store with mock data
  const initialize = async () => {
    try {
      logger.info('Initializing study store')
      await loadStudies()
      logger.success('Study store initialized')
    } catch (err) {
      logger.error('Failed to initialize study store', err)
    }
  }

  // Auto-initialize when store is created
  initialize()

  return {
    // State
    studies,
    selectedStudy,
    loading,
    error,
    totalStudies,
    researchStats,

    // Getters
    hasStudies,
    selectedStudyId,
    sortedStudies,
    activeStudies,
    completedStudies,
    studiesByCategory,
    studyOptions,
    searchResults,

    // Actions
    setSelectedStudy,
    clearSelectedStudy,
    clearStudies,
    loadStudies,
    loadStudyById,
    createStudy,
    updateStudy,
    deleteStudy,
    searchStudies,
    getStudyAnalytics,
    updateResearchStats,
    loadResearchStats,

    // Helpers
    getCategoryIcon,
    getCategoryColor,
    getStatusColor,
  }
})

// Store is ready - data will be loaded when needed
