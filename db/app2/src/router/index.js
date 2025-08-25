import { defineRouter } from '#q-app/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes'
import loggingService from '../core/services/logging-service.js'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  // Add navigation logging
  Router.beforeEach((to, from, next) => {
    const timer = loggingService.startTimer('Route Navigation')
    
    loggingService.logNavigation(from.path || 'initial', to.path, 'router')
    loggingService.debug('Router', `Navigating from ${from.path || 'initial'} to ${to.path}`, {
      from: from.path,
      to: to.path,
      params: to.params,
      query: to.query
    })
    
    // Store timer in route meta for afterEach hook
    to.meta = to.meta || {}
    to.meta._navigationTimer = timer
    
    next()
  })

  Router.afterEach((to, from) => {
    // Complete navigation timing
    if (to.meta?._navigationTimer) {
      const duration = to.meta._navigationTimer.end()
      loggingService.info('Router', `Navigation completed: ${to.path}`, {
        from: from.path,
        to: to.path,
        duration: `${duration.toFixed(2)}ms`
      })
    }
  })

  Router.onError((error) => {
    loggingService.error('Router', 'Navigation error', error, {
      currentRoute: Router.currentRoute.value.path
    })
  })

  return Router
})
