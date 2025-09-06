/**
 * Study Store
 *
 * Manages research studies state and operations.
 * Part of the MVC refactoring to separate concerns.
 *
 * Note: Currently uses mock data. Database integration will be added later
 * by importing and using the database store for real CRUD operations.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLoggingStore } from './logging-store'

export const useStudyStore = defineStore('study', () => {
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

  // Mock data - replace with database queries later
  const mockStudies = [
    {
      id: 1,
      name: 'Post-Stroke Motor Recovery Study',
      category: 'Neurological Assessment',
      description: 'Longitudinal study of motor function recovery after ischemic stroke',
      status: 'active',
      patientCount: 45,
      targetPatientCount: 50,
      created: '2024-01-15',
      updated: '2024-01-20',
      principalInvestigator: 'Dr. Sarah Johnson',
      concepts: ['Fugl-Meyer Assessment', 'Box and Block Test'],
      progress: 90,
      startDate: '2024-01-15',
      endDate: null,
      funding: 'NIH Grant #12345',
      collaborators: ['Dr. Michael Chen', 'Dr. Lisa Wong'],
      notes: 'Phase 2 clinical trial focusing on rehabilitation outcomes',
    },
    {
      id: 2,
      name: 'Cognitive Function in Stroke Patients',
      category: 'Clinical Scales',
      description: 'Assessment of cognitive impairment and recovery patterns',
      status: 'active',
      patientCount: 32,
      targetPatientCount: 40,
      created: '2024-02-01',
      updated: '2024-02-10',
      principalInvestigator: 'Dr. Robert Martinez',
      concepts: ['Montreal Cognitive Assessment', 'Mini-Mental State Exam'],
      progress: 80,
      startDate: '2024-02-01',
      endDate: null,
      funding: 'Internal Research Fund',
      collaborators: ['Dr. Emily Davis'],
      notes: 'Multi-center study with standardized assessment protocols',
    },
    {
      id: 3,
      name: 'Dystonia Non-Motor Symptoms Research',
      category: 'Psychological Assessment',
      description: 'Investigation of non-motor symptoms in dystonia patients',
      status: 'planning',
      patientCount: 0,
      targetPatientCount: 25,
      created: '2024-02-15',
      updated: '2024-02-15',
      principalInvestigator: 'Dr. Jennifer Lee',
      concepts: ['DNMSQuest', 'Quality of Life Scales'],
      progress: 10,
      startDate: null,
      endDate: null,
      funding: 'Pending approval',
      collaborators: [],
      notes: 'Pilot study to validate new assessment tools',
    },
    {
      id: 4,
      name: 'Advanced Imaging in Stroke Recovery',
      category: 'Imaging Studies',
      description: 'Functional MRI analysis of brain plasticity after stroke',
      status: 'active',
      patientCount: 18,
      targetPatientCount: 30,
      created: '2024-01-20',
      updated: '2024-01-25',
      principalInvestigator: 'Dr. David Kim',
      concepts: ['fMRI Analysis', 'Diffusion Tensor Imaging'],
      progress: 60,
      startDate: '2024-01-20',
      endDate: null,
      funding: 'NSF Grant #67890',
      collaborators: ['Dr. Maria Rodriguez', 'Dr. James Wilson'],
      notes: 'Advanced neuroimaging techniques for rehabilitation research',
    },
    {
      id: 5,
      name: 'Biomarker Discovery in Stroke',
      category: 'Laboratory Research',
      description: 'Identification of novel biomarkers for stroke prognosis',
      status: 'completed',
      patientCount: 120,
      targetPatientCount: 120,
      created: '2023-06-01',
      updated: '2024-01-15',
      principalInvestigator: 'Dr. Amanda Taylor',
      concepts: ['Protein Analysis', 'Genetic Markers'],
      progress: 100,
      startDate: '2023-06-01',
      endDate: '2024-01-15',
      funding: 'Multiple grants',
      collaborators: ['Dr. Christopher Brown', 'Dr. Rachel Green'],
      notes: 'Completed biomarker discovery phase, moving to validation studies',
    },
  ]

  // Getters
  const hasStudies = computed(() => studies.value.length > 0)

  const selectedStudyId = computed(() => selectedStudy.value?.id)

  const sortedStudies = computed(() => {
    return [...studies.value].sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created))
  })

  const activeStudies = computed(() => {
    return studies.value.filter((study) => study.status === 'active')
  })

  const completedStudies = computed(() => {
    return studies.value.filter((study) => study.status === 'completed')
  })

  const studiesByCategory = computed(() => {
    const categories = {}
    studies.value.forEach((study) => {
      if (!categories[study.category]) {
        categories[study.category] = []
      }
      categories[study.category].push(study)
    })
    return categories
  })

  const studyOptions = computed(() => {
    return studies.value.map((study) => ({
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

      let results = [...studies.value]

      // Apply text search
      if (query) {
        const searchTerm = query.toLowerCase()
        results = results.filter(
          (study) =>
            study.name.toLowerCase().includes(searchTerm) ||
            study.category.toLowerCase().includes(searchTerm) ||
            study.description.toLowerCase().includes(searchTerm) ||
            study.principalInvestigator?.toLowerCase().includes(searchTerm) ||
            study.concepts?.some((concept) => concept.toLowerCase().includes(searchTerm)),
        )
      }

      // Apply filters
      if (filters.category) {
        results = results.filter((study) => study.category === filters.category)
      }

      if (filters.status) {
        results = results.filter((study) => study.status === filters.status)
      }

      if (filters.patientCountMin !== undefined || filters.patientCountMax !== undefined) {
        results = results.filter((study) => {
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

      // For now, use mock data - replace with database queries later
      studies.value = [...mockStudies]
      totalStudies.value = mockStudies.length

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

      // For now, use mock data - replace with database query later
      const study = mockStudies.find((s) => s.id === studyId)

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

      // For now, create mock study - replace with database operation later
      const newStudy = {
        id: Date.now(), // Mock ID generation
        ...studyData,
        created: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0],
        patientCount: 0,
        progress: 0,
        status: studyData.status || 'planning',
      }

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

      const results = searchResults.value(query, filters)

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
    const neurological = studies.value.filter((s) => s.category === 'Neurological Assessment').length
    const stroke = studies.value.filter((s) => s.category.includes('Stroke')).length
    const active = studies.value.filter((s) => s.status === 'active').length

    researchStats.value = {
      totalStudies: total,
      neurologicalStudies: neurological,
      strokeStudies: stroke,
      activeStudies: active,
    }

    logger.debug('Research stats updated', researchStats.value)
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

    // Helpers
    getCategoryIcon,
    getCategoryColor,
    getStatusColor,
  }
})
