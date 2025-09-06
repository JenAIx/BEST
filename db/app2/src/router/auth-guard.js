/**
 * Authentication Route Guard
 *
 * Protects routes that require authentication and specific roles.
 * Redirects unauthenticated users to login page.
 * Checks role-based permissions for admin-only routes.
 */

import { useAuthStore } from 'src/stores/auth-store'

/**
 * Check if user is authenticated
 * @param {Object} to - Target route
 * @param {Object} from - Source route
 * @param {Function} next - Navigation callback
 */
export const requireAuth = (to, from, next) => {
  const authStore = useAuthStore()

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    // Redirect to login with return URL
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
    return
  }

  // Check session expiry
  if (authStore.sessionExpired) {
    authStore.logout()
    next({
      path: '/login',
      query: { redirect: to.fullPath, expired: 'true' },
    })
    return
  }

  // Update activity timestamp
  authStore.updateActivity()

  // Check route-specific permissions
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next({
      path: '/403',
      query: { message: 'Admin access required' },
    })
    return
  }

  if (to.meta.requiresRole) {
    const requiredRoles = Array.isArray(to.meta.requiresRole) ? to.meta.requiresRole : [to.meta.requiresRole]

    const hasRequiredRole = requiredRoles.some((role) => authStore.hasRole(role) || authStore.isAdmin)

    if (!hasRequiredRole) {
      next({
        path: '/403',
        query: { message: 'Insufficient permissions' },
      })
      return
    }
  }

  // All checks passed
  next()
}

/**
 * Redirect authenticated users away from login page
 * @param {Object} to - Target route
 * @param {Object} from - Source route
 * @param {Function} next - Navigation callback
 */
export const redirectIfAuthenticated = (to, from, next) => {
  const authStore = useAuthStore()

  if (authStore.isAuthenticated && !authStore.sessionExpired) {
    // Redirect to dashboard or intended destination
    const redirect = to.query.redirect || '/dashboard'
    next(redirect)
  } else {
    next()
  }
}

/**
 * Global navigation guard to check authentication
 * @param {Object} router - Vue Router instance
 */
export const setupAuthGuard = (router) => {
  router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    // Public routes that don't require authentication
    // const publicRoutes = ['/login', '/about', '/403', '/404']
    // const isPublicRoute = publicRoutes.includes(to.path)

    // If route requires auth and user is not authenticated
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
      return
    }

    // Update activity for authenticated users
    if (authStore.isAuthenticated) {
      authStore.updateActivity()
    }

    next()
  })
}

/**
 * Check if user can access a specific route
 * @param {string} route - Route path to check
 * @returns {boolean}
 */
export const canAccessRoute = (route) => {
  const authStore = useAuthStore()
  return authStore.canAccessRoute(route)
}

/**
 * Check if user has a specific permission
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (permission) => {
  const authStore = useAuthStore()
  return authStore.hasPermission(permission)
}
