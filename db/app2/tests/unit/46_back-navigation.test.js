/**
 * Back navigation must always have a way out (shared/utils/navigation.js).
 * Regression for "lande auf einer Unterseite und komme nicht mehr zurück":
 * after a session timeout the guard sends the user to /login?redirect=…,
 * the login page forwards to the sub-page, and "back" bounced to the login
 * page which forwarded again — an endless loop. Deep links / restarts on a
 * sub-page had no history entry at all.
 */
import { describe, it, expect, vi } from 'vitest'
import { resolveBackTarget, goBackOr } from '../../src/shared/utils/navigation.js'

describe('resolveBackTarget', () => {
  it('goes back to a real previous page', () => {
    expect(resolveBackTarget({ back: '/dashboard', fallback: '/visits', samePrefixes: ['/visits'] })).toEqual({ action: 'back' })
    expect(resolveBackTarget({ back: '/studies/4', fallback: '/visits', samePrefixes: ['/visits'] })).toEqual({ action: 'back' })
  })

  it('falls back when there is no history', () => {
    expect(resolveBackTarget({ back: null, fallback: '/visits' })).toEqual({ action: 'push', to: '/visits' })
    expect(resolveBackTarget({ back: undefined, fallback: '/dashboard' })).toEqual({ action: 'push', to: '/dashboard' })
    expect(resolveBackTarget({ back: '', fallback: '/dashboard' })).toEqual({ action: 'push', to: '/dashboard' })
  })

  it('never returns to login / 403 (they redirect forward again)', () => {
    expect(resolveBackTarget({ back: '/login?redirect=/visits/1', fallback: '/visits' })).toEqual({ action: 'push', to: '/visits' })
    expect(resolveBackTarget({ back: '/login', fallback: '/visits' })).toEqual({ action: 'push', to: '/visits' })
    expect(resolveBackTarget({ back: '/403?message=x', fallback: '/dashboard' })).toEqual({ action: 'push', to: '/dashboard' })
    // but a route that merely starts with the same letters is fine
    expect(resolveBackTarget({ back: '/logins-report', fallback: '/x' })).toEqual({ action: 'back' })
  })

  it('leaves the section instead of shuffling between its sub-pages', () => {
    expect(resolveBackTarget({ back: '/visits/10002506', fallback: '/visits', samePrefixes: ['/visits'] })).toEqual({ action: 'push', to: '/visits' })
    expect(resolveBackTarget({ back: '/visits', fallback: '/visits', samePrefixes: ['/visits'] })).toEqual({ action: 'push', to: '/visits' })
    expect(resolveBackTarget({ back: '/data-grid/editor', fallback: '/data-grid', samePrefixes: ['/data-grid'] })).toEqual({ action: 'push', to: '/data-grid' })
  })
})

describe('goBackOr', () => {
  const makeRouter = (back) => ({ options: { history: { state: { back } } }, back: vi.fn(), push: vi.fn() })

  it('calls router.back() for a real previous page', () => {
    const router = makeRouter('/dashboard')
    goBackOr(router, '/visits', ['/visits'])
    expect(router.back).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('pushes the fallback for login / no history / same section', () => {
    for (const back of ['/login?redirect=/visits/1', null, '/visits/1']) {
      const router = makeRouter(back)
      goBackOr(router, '/visits', ['/visits'])
      expect(router.back).not.toHaveBeenCalled()
      expect(router.push).toHaveBeenCalledWith('/visits')
    }
  })

  it('tolerates a router without history state', () => {
    const router = { options: {}, back: vi.fn(), push: vi.fn() }
    goBackOr(router, '/dashboard')
    expect(router.push).toHaveBeenCalledWith('/dashboard')
  })
})
