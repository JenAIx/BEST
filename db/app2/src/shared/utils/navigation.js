/**
 * Back navigation with a guaranteed way out.
 *
 * `router.back()` alone dead-ends in two situations we hit in the app:
 *   - no history entry (deep link, app restart on a sub-page)
 *   - the previous entry is a page that immediately redirects forward again
 *     (login with ?redirect=…, 403) — pressing "back" bounces the user
 *     straight back to where they were, an endless loop
 * `goBackOr()` falls back to an explicit route in both cases (and when the
 * previous entry belongs to the same section, where "back" would merely
 * shuffle between sub-pages).
 */

// Pages that forward the user somewhere else — never "return" to them
export const NON_RETURNABLE_PREFIXES = ['/login', '/403', '/public']

/**
 * Pure decision: where should "back" go?
 * @param {{back: string|null|undefined, fallback: string, samePrefixes?: string[]}} opts
 * @returns {{action: 'back'} | {action: 'push', to: string}}
 */
export function resolveBackTarget({ back, fallback, samePrefixes = [] }) {
  const target = back == null ? '' : String(back)
  const matches = (prefix) => target === prefix || target.startsWith(prefix + '/') || target.startsWith(prefix + '?') || target.startsWith(prefix + '#')
  if (!target) return { action: 'push', to: fallback }
  if (NON_RETURNABLE_PREFIXES.some(matches)) return { action: 'push', to: fallback }
  if (samePrefixes.some(matches)) return { action: 'push', to: fallback }
  return { action: 'back' }
}

/**
 * Go back if the previous history entry is a real page; otherwise navigate
 * to `fallback`. `samePrefixes` lists route prefixes of the current section
 * (e.g. ['/visits']) — "back" into the same section is replaced by the
 * fallback so the user leaves the section with one click.
 */
export function goBackOr(router, fallback, samePrefixes = []) {
  const back = router?.options?.history?.state?.back ?? null
  const target = resolveBackTarget({ back, fallback, samePrefixes })
  if (target.action === 'back') return router.back()
  return router.push(target.to)
}
