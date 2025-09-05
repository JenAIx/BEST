/**
 * User Store
 *
 * Manages user state and operations following MVC architecture.
 * Handles CRUD operations, validation, and caching for system users.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'

export const useUserStore = defineStore('user', () => {
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('UserStore')

  // State
  const users = ref([])
  const selectedUser = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const searchQuery = ref('')
  const pagination = ref({
    sortBy: 'NAME_CHAR',
    descending: false,
    page: 1,
    rowsPerPage: 10,
    rowsNumber: 0,
  })

  // Cache for role options
  const roleOptions = ref([])

  // User-Patient associations state
  const userPatientAssociations = ref([])
  const associationsPagination = ref({
    sortBy: 'USER_ID',
    descending: false,
    page: 1,
    rowsPerPage: 10,
    rowsNumber: 0,
  })
  const associationsSearchQuery = ref('')

  // Getters
  const totalUsers = computed(() => pagination.value.rowsNumber)

  const hasUsers = computed(() => users.value.length > 0)

  const filteredUsers = computed(() => {
    if (!searchQuery.value) return users.value
    const query = searchQuery.value.toLowerCase()
    return users.value.filter((user) => user.USER_CD?.toLowerCase().includes(query) || user.NAME_CHAR?.toLowerCase().includes(query) || user.COLUMN_CD?.toLowerCase().includes(query))
  })

  const getUserById = computed(() => {
    return (userId) => users.value.find((user) => user.USER_ID === userId)
  })

  const getUserByCode = computed(() => {
    return (userCode) => users.value.find((user) => user.USER_CD === userCode)
  })

  // Role helpers
  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'red'
      case 'physician':
        return 'blue'
      case 'nurse':
        return 'green'
      case 'research':
        return 'purple'
      default:
        return 'grey'
    }
  }

  const getUserInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Association getters
  const totalAssociations = computed(() => associationsPagination.value.rowsNumber)
  const hasAssociations = computed(() => userPatientAssociations.value.length > 0)

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

  const loadUsers = async (forcePage = null) => {
    loading.value = true
    error.value = null

    try {
      logger.info('Loading users', {
        page: forcePage || pagination.value.page,
        pageSize: pagination.value.rowsPerPage,
        search: searchQuery.value,
      })

      const userRepo = dbStore.getUserRepository()
      if (!userRepo) {
        throw new Error('User repository not available')
      }

      // For now, load all users (can be enhanced with pagination later)
      const allUsers = await userRepo.findAll()
      let filteredUsers = allUsers || []

      // Apply search filter if provided
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filteredUsers = filteredUsers.filter((user) => user.USER_CD?.toLowerCase().includes(query) || user.NAME_CHAR?.toLowerCase().includes(query) || user.COLUMN_CD?.toLowerCase().includes(query))
      }

      // Apply sorting
      if (pagination.value.sortBy) {
        filteredUsers.sort((a, b) => {
          const aVal = a[pagination.value.sortBy] || ''
          const bVal = b[pagination.value.sortBy] || ''

          if (aVal < bVal) return pagination.value.descending ? 1 : -1
          if (aVal > bVal) return pagination.value.descending ? -1 : 1
          return 0
        })
      }

      users.value = filteredUsers
      pagination.value.rowsNumber = filteredUsers.length

      logger.success('Users loaded', {
        count: users.value.length,
        total: pagination.value.rowsNumber,
      })
    } catch (err) {
      error.value = err.message || 'Failed to load users'
      logger.error('Failed to load users', err)
      users.value = []
      pagination.value.rowsNumber = 0
    } finally {
      loading.value = false
    }
  }

  const getUser = async (userId) => {
    try {
      logger.info('Getting user', { userId })

      const userRepo = dbStore.getUserRepository()
      if (!userRepo) {
        throw new Error('User repository not available')
      }

      const user = await userRepo.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      logger.success('User retrieved', { userId, userCode: user.USER_CD })
      return user
    } catch (err) {
      error.value = err.message || 'Failed to get user'
      logger.error('Failed to get user', err)
      throw err
    }
  }

  const createUser = async (userData) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Creating user', { userCode: userData.USER_CD })

      const userRepo = dbStore.getUserRepository()
      if (!userRepo) {
        throw new Error('User repository not available')
      }

      // Validate required fields
      if (!userData.USER_CD || !userData.NAME_CHAR) {
        throw new Error('User code and name are required')
      }

      // Check if user already exists
      const existing = users.value.find((u) => u.USER_CD === userData.USER_CD)
      if (existing) {
        throw new Error('User with this code already exists')
      }

      // Create the user
      const newUser = await userRepo.create(userData)

      // Add to local state
      users.value.unshift(newUser)
      pagination.value.rowsNumber += 1

      logger.success('User created', { userId: newUser.USER_ID, userCode: newUser.USER_CD })
      return newUser
    } catch (err) {
      error.value = err.message || 'Failed to create user'
      logger.error('Failed to create user', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const updateUser = async (userId, updates) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Updating user', { userId, updates: Object.keys(updates) })

      const userRepo = dbStore.getUserRepository()
      if (!userRepo) {
        throw new Error('User repository not available')
      }

      // If updating USER_CD, check for duplicates
      if (updates.USER_CD) {
        const existing = users.value.find((u) => u.USER_CD === updates.USER_CD && u.USER_ID !== userId)
        if (existing) {
          throw new Error('User with this code already exists')
        }
      }

      const updatedUser = await userRepo.updateUser(userId, updates)

      // Update local state
      const index = users.value.findIndex((user) => user.USER_ID === userId)
      if (index !== -1) {
        users.value[index] = { ...users.value[index], ...updatedUser, ...updates }
      }

      // Update selected user if it's the one being updated
      if (selectedUser.value?.USER_ID === userId) {
        selectedUser.value = { ...selectedUser.value, ...updatedUser, ...updates }
      }

      logger.success('User updated', { userId })
      return updatedUser
    } catch (err) {
      error.value = err.message || 'Failed to update user'
      logger.error('Failed to update user', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const deleteUser = async (userId) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Deleting user', { userId })

      const userRepo = dbStore.getUserRepository()
      if (!userRepo) {
        throw new Error('User repository not available')
      }

      await userRepo.delete(userId)

      // Remove from local state
      const index = users.value.findIndex((user) => user.USER_ID === userId)
      if (index !== -1) {
        users.value.splice(index, 1)
        pagination.value.rowsNumber -= 1
      }

      // Clear selected user if it was deleted
      if (selectedUser.value?.USER_ID === userId) {
        selectedUser.value = null
      }

      logger.success('User deleted', { userId })
    } catch (err) {
      error.value = err.message || 'Failed to delete user'
      logger.error('Failed to delete user', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const updatePassword = async (userId, newPassword) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Updating user password', { userId })

      const userRepo = dbStore.getUserRepository()
      if (!userRepo) {
        throw new Error('User repository not available')
      }

      if (!newPassword || newPassword.length < 5) {
        throw new Error('Password must be at least 5 characters long')
      }

      await userRepo.updateUser(userId, {
        PASSWORD_CHAR: newPassword,
      })

      logger.success('User password updated', { userId })
    } catch (err) {
      error.value = err.message || 'Failed to update password'
      logger.error('Failed to update password', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const setSelectedUser = (user) => {
    selectedUser.value = user
    logger.info('Selected user', { userId: user?.USER_ID, userCode: user?.USER_CD })
  }

  const clearSelectedUser = () => {
    selectedUser.value = null
    logger.info('Cleared selected user')
  }

  const refreshUsers = async () => {
    await loadUsers()
  }

  // Load role options from database
  const loadRoleOptions = async () => {
    try {
      logger.info('Loading role options')

      const result = await dbStore.executeQuery(`
        SELECT DISTINCT COLUMN_CD
        FROM USER_MANAGEMENT
        WHERE COLUMN_CD IS NOT NULL
        ORDER BY COLUMN_CD
      `)

      if (result.success) {
        roleOptions.value = result.data.map((row) => ({
          label: row.COLUMN_CD,
          value: row.COLUMN_CD,
          color: getRoleColor(row.COLUMN_CD),
        }))
      }

      logger.success('Role options loaded', { count: roleOptions.value.length })
    } catch (err) {
      logger.error('Failed to load role options', err)
      // Fallback to default roles
      roleOptions.value = [
        { label: 'Admin', value: 'admin', color: 'red' },
        { label: 'Physician', value: 'physician', color: 'blue' },
        { label: 'Nurse', value: 'nurse', color: 'green' },
        { label: 'Research', value: 'research', color: 'purple' },
      ]
    }
  }

  // Get user statistics
  const getUserStatistics = async () => {
    try {
      logger.info('Getting user statistics')

      const result = await dbStore.executeQuery(`
        SELECT
          COUNT(*) as totalUsers,
          COUNT(CASE WHEN COLUMN_CD = 'admin' THEN 1 END) as adminCount,
          COUNT(CASE WHEN COLUMN_CD = 'physician' THEN 1 END) as physicianCount,
          COUNT(CASE WHEN COLUMN_CD = 'nurse' THEN 1 END) as nurseCount,
          COUNT(CASE WHEN COLUMN_CD = 'research' THEN 1 END) as researchCount,
          COUNT(CASE WHEN UPDATE_DATE >= datetime('now', '-30 days') THEN 1 END) as recentlyUpdated
        FROM USER_MANAGEMENT
      `)

      if (result.success && result.data.length > 0) {
        const stats = result.data[0]
        logger.success('User statistics retrieved', stats)
        return stats
      }

      return null
    } catch (err) {
      error.value = err.message || 'Failed to get user statistics'
      logger.error('Failed to get user statistics', err)
      throw err
    }
  }

  // Validate user data
  const validateUserData = (userData) => {
    const errors = []

    if (!userData.USER_CD || userData.USER_CD.trim() === '') {
      errors.push('User code is required')
    }

    if (!userData.NAME_CHAR || userData.NAME_CHAR.trim() === '') {
      errors.push('User name is required')
    }

    if (userData.USER_CD && userData.USER_CD.length < 3) {
      errors.push('User code must be at least 3 characters long')
    }

    if (userData.PASSWORD_CHAR && userData.PASSWORD_CHAR.length < 5) {
      errors.push('Password must be at least 5 characters long')
    }

    return errors
  }

  // User-Patient Association Methods
  const loadUserPatientAssociations = async (forcePage = null) => {
    loading.value = true
    error.value = null

    try {
      logger.info('Loading user-patient associations', {
        page: forcePage || associationsPagination.value.page,
        pageSize: associationsPagination.value.rowsPerPage,
        search: associationsSearchQuery.value,
      })

      const offset = (forcePage || associationsPagination.value.page - 1) * associationsPagination.value.rowsPerPage

      let whereClause = ''
      const params = []

      if (associationsSearchQuery.value) {
        whereClause = `WHERE (upl.NAME_CHAR LIKE ? OR upl.USER_PATIENT_BLOB LIKE ? OR um.NAME_CHAR LIKE ? OR um.USER_CD LIKE ? OR pd.PATIENT_CD LIKE ?)`
        const searchTerm = `%${associationsSearchQuery.value}%`
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM USER_PATIENT_LOOKUP upl
        LEFT JOIN USER_MANAGEMENT um ON upl.USER_ID = um.USER_ID
        LEFT JOIN PATIENT_DIMENSION pd ON upl.PATIENT_NUM = pd.PATIENT_NUM
        ${whereClause}
      `
      const countResult = await dbStore.executeQuery(countQuery, params)
      associationsPagination.value.rowsNumber = countResult.success ? countResult.data[0].count : 0

      // Get paginated data
      const dataQuery = `
        SELECT upl.*, um.NAME_CHAR as USER_NAME, um.USER_CD, pd.PATIENT_CD
        FROM USER_PATIENT_LOOKUP upl
        LEFT JOIN USER_MANAGEMENT um ON upl.USER_ID = um.USER_ID
        LEFT JOIN PATIENT_DIMENSION pd ON upl.PATIENT_NUM = pd.PATIENT_NUM
        ${whereClause}
        ORDER BY ${associationsPagination.value.sortBy} ${associationsPagination.value.descending ? 'DESC' : 'ASC'}
        LIMIT ? OFFSET ?
      `
      const dataResult = await dbStore.executeQuery(dataQuery, [...params, associationsPagination.value.rowsPerPage, offset])

      userPatientAssociations.value = dataResult.success ? dataResult.data : []

      logger.success('User-Patient associations loaded', {
        count: userPatientAssociations.value.length,
        total: associationsPagination.value.rowsNumber,
        associations: userPatientAssociations.value,
      })
    } catch (err) {
      error.value = err.message || 'Failed to load user-patient associations'
      logger.error('Failed to load user-patient associations', err)
      userPatientAssociations.value = []
      associationsPagination.value.rowsNumber = 0
    } finally {
      loading.value = false
    }
  }

  const createUserPatientAssociation = async (associationData) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Creating user-patient association', associationData)

      // Extract primitive values from objects if needed
      const userId = typeof associationData.USER_ID === 'object' ? associationData.USER_ID?.USER_ID : associationData.USER_ID
      const patientNum = typeof associationData.PATIENT_NUM === 'object' ? associationData.PATIENT_NUM?.PATIENT_NUM : associationData.PATIENT_NUM
      const nameChar = associationData.NAME_CHAR || null
      const userPatientBlob = associationData.USER_PATIENT_BLOB || null

      logger.info('Extracted values', { userId, patientNum, nameChar, userPatientBlob })

      // Validate required fields
      if (!userId || !patientNum) {
        throw new Error('User ID and Patient Number are required')
      }

      // Check for existing association
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM USER_PATIENT_LOOKUP
        WHERE USER_ID = ? AND PATIENT_NUM = ?
      `
      const checkResult = await dbStore.executeQuery(checkQuery, [userId, patientNum])

      if (checkResult.success && checkResult.data[0].count > 0) {
        throw new Error('This user-patient association already exists')
      }

      // Create new association
      const insertQuery = `
        INSERT INTO USER_PATIENT_LOOKUP (USER_ID, PATIENT_NUM, NAME_CHAR, USER_PATIENT_BLOB, UPDATE_DATE, IMPORT_DATE)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `

      const insertResult = await dbStore.executeCommand(insertQuery, [userId, patientNum, nameChar, userPatientBlob])

      if (!insertResult.success) {
        throw new Error(insertResult.error || 'Failed to create association')
      }

      logger.success('User-Patient association created', {
        userId: associationData.USER_ID,
        patientNum: associationData.PATIENT_NUM,
        insertResult,
      })

      // Reload associations to show the new one
      await loadUserPatientAssociations()
    } catch (err) {
      error.value = err.message || 'Failed to create user-patient association'
      logger.error('Failed to create user-patient association', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const updateUserPatientAssociation = async (associationId, updates) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Updating user-patient association', { associationId, updates })

      // Extract primitive values from objects if needed
      const userId = typeof updates.USER_ID === 'object' ? updates.USER_ID?.USER_ID : updates.USER_ID
      const patientNum = typeof updates.PATIENT_NUM === 'object' ? updates.PATIENT_NUM?.PATIENT_NUM : updates.PATIENT_NUM
      const nameChar = updates.NAME_CHAR || null
      const userPatientBlob = updates.USER_PATIENT_BLOB || null

      const updateQuery = `
        UPDATE USER_PATIENT_LOOKUP
        SET USER_ID = ?, PATIENT_NUM = ?, NAME_CHAR = ?, USER_PATIENT_BLOB = ?, UPDATE_DATE = datetime('now')
        WHERE USER_PATIENT_ID = ?
      `

      const updateResult = await dbStore.executeCommand(updateQuery, [userId, patientNum, nameChar, userPatientBlob, associationId])

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update association')
      }

      logger.success('User-Patient association updated', { associationId })

      // Reload associations to show the changes
      await loadUserPatientAssociations()
    } catch (err) {
      error.value = err.message || 'Failed to update user-patient association'
      logger.error('Failed to update user-patient association', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const deleteUserPatientAssociation = async (associationId) => {
    saving.value = true
    error.value = null

    try {
      logger.info('Deleting user-patient association', { associationId })

      const deleteQuery = `DELETE FROM USER_PATIENT_LOOKUP WHERE USER_PATIENT_ID = ?`
      const deleteResult = await dbStore.executeCommand(deleteQuery, [associationId])

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete association')
      }

      // Remove from local state
      const index = userPatientAssociations.value.findIndex((assoc) => assoc.USER_PATIENT_ID === associationId)
      if (index !== -1) {
        userPatientAssociations.value.splice(index, 1)
        associationsPagination.value.rowsNumber -= 1
      }

      logger.success('User-Patient association deleted', { associationId })
    } catch (err) {
      error.value = err.message || 'Failed to delete user-patient association'
      logger.error('Failed to delete user-patient association', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const setAssociationsSearchQuery = (query) => {
    associationsSearchQuery.value = query
    associationsPagination.value.page = 1 // Reset to first page when searching
  }

  const clearAssociationsSearch = () => {
    associationsSearchQuery.value = ''
    associationsPagination.value.page = 1
  }

  const setAssociationsPagination = (newPagination) => {
    associationsPagination.value = { ...associationsPagination.value, ...newPagination }
  }

  // Initialize
  const initialize = async () => {
    logger.info('Initializing user store')
    await Promise.all([loadUsers(), loadRoleOptions()])
  }

  return {
    // State
    users,
    selectedUser,
    loading,
    saving,
    error,
    searchQuery,
    pagination,
    roleOptions,

    // Association state
    userPatientAssociations,
    associationsPagination,
    associationsSearchQuery,

    // Getters
    totalUsers,
    hasUsers,
    filteredUsers,
    getUserById,
    getUserByCode,
    getRoleColor,
    getUserInitials,
    totalAssociations,
    hasAssociations,

    // Actions
    clearError,
    setSearchQuery,
    clearSearch,
    setPagination,
    loadUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    updatePassword,
    setSelectedUser,
    clearSelectedUser,
    refreshUsers,
    loadRoleOptions,
    getUserStatistics,
    validateUserData,
    initialize,

    // Association actions
    loadUserPatientAssociations,
    createUserPatientAssociation,
    updateUserPatientAssociation,
    deleteUserPatientAssociation,
    setAssociationsSearchQuery,
    clearAssociationsSearch,
    setAssociationsPagination,
  }
})
