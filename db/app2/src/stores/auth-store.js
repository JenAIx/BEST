/**
 * Authentication Store
 *
 * Manages user authentication state, login/logout functionality,
 * and protected route access control for the BEST medical system.
 *
 * Features:
 * - User login/logout with database validation
 * - Session persistence in localStorage
 * - Role-based access control (admin, physician, nurse, etc.)
 * - JWT token management (future implementation)
 * - Auto-logout on inactivity
 */

import { defineStore } from 'pinia'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAuthenticated: false,
    lastActivity: null,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    rememberMe: false,
    loginError: null,
    selectedDatabase: null,
  }),

  getters: {
    currentUser: (state) => state.user,

    userName: (state) => state.user?.NAME_CHAR || state.user?.USER_CD || '',

    userRole: (state) => state.user?.COLUMN_CD || '',

    isAdmin: (state) => state.user?.COLUMN_CD === 'admin',

    isPhysician: (state) => state.user?.COLUMN_CD === 'physician',

    isNurse: (state) => state.user?.COLUMN_CD === 'nurse',

    hasRole: (state) => (role) => {
      if (!state.user) return false
      return state.user.COLUMN_CD === role
    },

    canAccessRoute: (state) => (route) => {
      if (!state.isAuthenticated) return false

      // Admin can access everything
      if (state.user?.COLUMN_CD === 'admin') return true

      // Route-specific permissions
      const routePermissions = {
        '/admin': ['admin'],
        '/users': ['admin'],
        '/concepts': ['admin', 'physician'],
        '/cql': ['admin', 'physician'],
        '/import': ['admin', 'physician', 'nurse'],
        '/export': ['admin', 'physician', 'nurse'],
        '/patients': ['admin', 'physician', 'nurse'],
        '/visits': ['admin', 'physician', 'nurse'],
        '/observations': ['admin', 'physician', 'nurse'],
        '/dashboard': ['admin', 'physician', 'nurse', 'research'],
      }

      const allowedRoles = routePermissions[route] || []
      return allowedRoles.includes(state.user?.COLUMN_CD)
    },

    sessionExpired: (state) => {
      if (!state.lastActivity) return false
      const now = Date.now()
      return now - state.lastActivity > state.sessionTimeout
    },
  },

  actions: {
    /**
     * Initialize auth state from localStorage
     */
    async initAuth() {
      const savedAuth = localStorage.getItem('auth')
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth)
          if (!this.isSessionExpired(authData.lastActivity)) {
            // Set initial auth state from localStorage
            this.user = authData.user
            this.isAuthenticated = true
            this.lastActivity = Date.now()
            this.selectedDatabase = authData.selectedDatabase

            // Reconnect to database if needed
            const dbStore = useDatabaseStore()
            if (this.selectedDatabase && !dbStore.isConnected.value) {
              await dbStore.initializeDatabase(this.selectedDatabase)
            }

            // CRITICAL: Refresh user data from database to get latest changes
            // This ensures we get the latest NAME_CHAR and other updated fields
            if (this.user && this.user.USER_CD) {
              try {
                const userRepo = dbStore.getUserRepository()
                const freshUser = await userRepo.findByUserCode(this.user.USER_CD)
                if (freshUser) {
                  const loggingStore = useLoggingStore()
                  loggingStore.debug('AuthStore', 'Refreshed user data from database', {
                    freshUser,
                  })
                  this.user = freshUser
                  // Save the refreshed data back to localStorage
                  this.saveAuth()
                }
              } catch (error) {
                const loggingStore = useLoggingStore()
                loggingStore.error('AuthStore', 'Failed to refresh user data', error)
                // Continue with cached data if refresh fails
              }
            }
          } else {
            this.clearAuth()
          }
        } catch (error) {
          const loggingStore = useLoggingStore()
          loggingStore.error('AuthStore', 'Failed to restore auth session', error)
          this.clearAuth()
        }
      }
    },

    /**
     * Login user with credentials
     * @param {Object} credentials - { username, password, database }
     * @returns {Promise<boolean>} - Success status
     */
    async login(credentials) {
      const loggingStore = useLoggingStore()
      const timer = loggingStore.startTimer('User Login')

      try {
        this.loginError = null
        loggingStore.info('AuthStore', `Login attempt for user: ${credentials.username}`, {
          username: credentials.username,
          database: credentials.database,
          rememberMe: credentials.rememberMe,
        })

        // Connect to selected database
        const dbStore = useDatabaseStore()
        if (!dbStore.isConnected.value || dbStore.databasePath.value !== credentials.database) {
          loggingStore.debug('AuthStore', 'Initializing database connection', {
            database: credentials.database,
          })
          await dbStore.initializeDatabase(credentials.database)
        }

        // Validate user credentials
        const userRepo = dbStore.getUserRepository()
        const user = await userRepo.findByUserCode(credentials.username)

        if (!user) {
          this.loginError = 'Invalid username or password'
          loggingStore.warn('AuthStore', 'Login failed: User not found', {
            username: credentials.username,
          })
          return false
        }

        // Check password (in real app, this should be hashed)
        if (user.PASSWORD_CHAR !== credentials.password) {
          this.loginError = 'Invalid username or password'
          loggingStore.warn('AuthStore', 'Login failed: Invalid password', {
            username: credentials.username,
          })
          return false
        }

        // Check if user is active (skip for now since ACTIVE_FLG column doesn't exist)
        // if (user.ACTIVE_FLG !== 'Y') {
        //   this.loginError = 'User account is inactive'
        //   loggingStore.warn('AuthStore', 'Login failed: User account inactive', { username: credentials.username })
        //   return false
        // }

        // Set authentication state
        this.user = user
        this.isAuthenticated = true
        this.lastActivity = Date.now()
        this.selectedDatabase = credentials.database
        this.rememberMe = credentials.rememberMe || false

        // Save to localStorage if remember me is checked
        if (this.rememberMe) {
          this.saveAuth()
          loggingStore.debug('AuthStore', 'Authentication saved to localStorage')
        }

        const duration = timer.end()
        loggingStore.success('AuthStore', `Login successful for user: ${credentials.username}`, {
          username: credentials.username,
          userId: user.USER_ID,
          role: user.COLUMN_CD,
          database: credentials.database,
          duration: `${duration.toFixed(2)}ms`,
        })

        // Log user action
        loggingStore.logUserAction('LOGIN', {
          username: credentials.username,
          userId: user.USER_ID,
          database: credentials.database,
        })

        return true
      } catch (error) {
        timer.end()
        loggingStore.error('AuthStore', 'Login failed with error', error, {
          username: credentials.username,
          database: credentials.database,
        })
        this.loginError = 'Login failed. Please check your database connection.'
        return false
      }
    },

    /**
     * Logout current user
     */
    async logout() {
      const loggingStore = useLoggingStore()
      const username = this.user?.USER_CD || 'unknown'
      const userId = this.user?.USER_ID || null

      loggingStore.info('AuthStore', `Logout initiated for user: ${username}`, {
        username,
        userId,
      })

      // Log user action
      loggingStore.logUserAction('LOGOUT', {
        username,
        userId,
      })

      this.user = null
      this.isAuthenticated = false
      this.lastActivity = null
      this.loginError = null
      this.clearAuth()

      loggingStore.debug('AuthStore', 'Authentication cleared from localStorage')

      // Optionally disconnect from database
      const dbStore = useDatabaseStore()
      if (dbStore.isConnected.value) {
        await dbStore.closeDatabase()
      }

      loggingStore.success('AuthStore', `Logout completed for user: ${username}`)
    },

    /**
     * Update last activity timestamp
     */
    updateActivity() {
      this.lastActivity = Date.now()
      if (this.rememberMe) {
        this.saveAuth()
      }
    },

    /**
     * Check if session is expired
     * @param {number} lastActivity - Last activity timestamp
     * @returns {boolean}
     */
    isSessionExpired(lastActivity) {
      if (!lastActivity) return true
      const now = Date.now()
      return now - lastActivity > this.sessionTimeout
    },

    /**
     * Save auth state to localStorage
     */
    saveAuth() {
      const authData = {
        user: this.user,
        lastActivity: this.lastActivity,
        selectedDatabase: this.selectedDatabase,
      }
      localStorage.setItem('auth', JSON.stringify(authData))
    },

    /**
     * Clear auth data from localStorage
     */
    clearAuth() {
      localStorage.removeItem('auth')
    },

    /**
     * Set selected database
     * @param {string} database - Database file path
     */
    setSelectedDatabase(database) {
      this.selectedDatabase = database
    },

    /**
     * Update user profile information
     * @param {Object} profileData - Profile data to update
     * @returns {Promise<boolean>} - Success status
     */
    async updateProfile(profileData) {
      const loggingStore = useLoggingStore()
      const username = this.user?.USER_CD || 'unknown'
      const userId = this.user?.USER_ID || null

      try {
        loggingStore.info('AuthStore', `Profile update initiated for user: ${username}`, {
          username,
          userId,
          updateData: profileData,
        })

        if (!this.isAuthenticated || !this.user) {
          throw new Error('User not authenticated')
        }

        // Get database store
        const dbStore = useDatabaseStore()

        // Debug: Log current database path
        loggingStore.debug('AuthStore', 'Current database path:', {
          databasePath: dbStore.databasePath,
          isConnected: dbStore.isConnected,
          canPerformOperations: dbStore.canPerformOperations,
        })

        // Prepare update data
        const updateData = {}
        if (profileData.name) {
          updateData.NAME_CHAR = profileData.name
        }
        updateData.UPDATE_DATE = new Date().toISOString()

        // Use transaction to ensure changes are committed
        const commands = [
          {
            sql: `UPDATE USER_MANAGEMENT SET NAME_CHAR = ?, UPDATE_DATE = ? WHERE USER_ID = ?`,
            params: [updateData.NAME_CHAR, updateData.UPDATE_DATE, userId],
          },
        ]

        const transactionResult = await dbStore.executeTransaction(commands)

        loggingStore.debug('AuthStore', 'Transaction result:', { transactionResult })

        // Verify the change was actually made by querying the database
        const verifyResult = await dbStore.executeQuery('SELECT NAME_CHAR, UPDATE_DATE FROM USER_MANAGEMENT WHERE USER_ID = ?', [userId])
        loggingStore.debug('AuthStore', 'Verification query result:', { verifyResult })

        // Check if transaction was successful
        // ElectronConnection.transaction returns an array of results
        if (transactionResult && Array.isArray(transactionResult) && transactionResult.length > 0) {
          // Update local user state
          this.user = { ...this.user, ...updateData }

          // CRITICAL: Always save updated auth state to localStorage
          // Otherwise on refresh, old data will be loaded from localStorage
          this.saveAuth()
          loggingStore.debug('AuthStore', 'Updated user data saved to localStorage')

          loggingStore.success('AuthStore', `Profile updated successfully for user: ${username}`, {
            username,
            userId,
            updateData,
          })

          // Log user action
          loggingStore.logUserAction('PROFILE_UPDATE', {
            username,
            userId,
            updateData,
          })

          return true
        } else {
          throw new Error('Failed to update user in database')
        }
      } catch (error) {
        loggingStore.error('AuthStore', 'Profile update failed', error, {
          username,
          userId,
          updateData: profileData,
        })
        throw error
      }
    },

    /**
     * Update user password
     * @param {string} newPassword - New password
     * @returns {Promise<boolean>} - Success status
     */
    async updatePassword(newPassword) {
      const loggingStore = useLoggingStore()
      const username = this.user?.USER_CD || 'unknown'
      const userId = this.user?.USER_ID || null

      try {
        loggingStore.info('AuthStore', `Password update initiated for user: ${username}`, {
          username,
          userId,
        })

        if (!this.isAuthenticated || !this.user) {
          throw new Error('User not authenticated')
        }

        if (!newPassword || newPassword.length < 5) {
          throw new Error('Password must be at least 5 characters long')
        }

        // Get database store and update user password
        const dbStore = useDatabaseStore()

        // Use transaction to ensure changes are committed
        const commands = [
          {
            sql: `UPDATE USER_MANAGEMENT SET PASSWORD_CHAR = ?, UPDATE_DATE = ? WHERE USER_ID = ?`,
            params: [newPassword, new Date().toISOString(), userId],
          },
        ]

        const transactionResult = await dbStore.executeTransaction(commands)

        if (transactionResult && Array.isArray(transactionResult) && transactionResult.length > 0) {
          // Update local user state
          this.user = { ...this.user, PASSWORD_CHAR: newPassword }

          // Save updated auth state
          this.saveAuth()
          loggingStore.debug('AuthStore', 'Updated password saved to localStorage')

          loggingStore.success('AuthStore', `Password updated successfully for user: ${username}`, {
            username,
            userId,
          })

          // Log user action
          loggingStore.logUserAction('PASSWORD_UPDATE', {
            username,
            userId,
          })

          return true
        } else {
          throw new Error('Failed to update password in database')
        }
      } catch (error) {
        loggingStore.error('AuthStore', 'Password update failed', error, {
          username,
          userId,
        })
        throw error
      }
    },

    /**
     * Reset user password (legacy method - now redirects to updatePassword)
     * @returns {Promise<boolean>} - Success status
     */
    async resetPassword() {
      const loggingStore = useLoggingStore()
      const username = this.user?.USER_CD || 'unknown'
      const userId = this.user?.USER_ID || null

      try {
        loggingStore.info('AuthStore', `Password reset initiated for user: ${username}`, {
          username,
          userId,
        })

        if (!this.isAuthenticated || !this.user) {
          throw new Error('User not authenticated')
        }

        // For now, just log the action since we don't have email functionality
        // In a real app, this would send a password reset email
        loggingStore.info('AuthStore', `Password reset requested for user: ${username}`, {
          username,
          userId,
        })

        // Log user action
        loggingStore.logUserAction('PASSWORD_RESET_REQUEST', {
          username,
          userId,
        })

        return true
      } catch (error) {
        loggingStore.error('AuthStore', 'Password reset failed', error, {
          username,
          userId,
        })
        throw error
      }
    },

    /**
     * Check if user has permission for specific action
     * @param {string} action - Action to check
     * @returns {boolean}
     */
    hasPermission(action) {
      if (!this.isAuthenticated) return false

      // Define action permissions
      const actionPermissions = {
        create_patient: ['admin', 'physician', 'nurse'],
        edit_patient: ['admin', 'physician', 'nurse'],
        delete_patient: ['admin'],
        create_visit: ['admin', 'physician', 'nurse'],
        edit_visit: ['admin', 'physician', 'nurse'],
        delete_visit: ['admin', 'physician'],
        create_observation: ['admin', 'physician', 'nurse'],
        delete_observation: ['admin', 'physician'],
        manage_users: ['admin'],
        manage_concepts: ['admin', 'physician'],
        manage_cql: ['admin', 'physician'],
        export_data: ['admin', 'physician', 'nurse'],
        import_data: ['admin', 'physician'],
      }

      const allowedRoles = actionPermissions[action] || []
      return this.isAdmin || allowedRoles.includes(this.userRole)
    },
  },
})
