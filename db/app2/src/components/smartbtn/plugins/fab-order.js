/**
 * Which plugins the SmartButton FAB shows, and in which order.
 *
 * - Plugins with `requiresApiKey: 'openai'` (AI tools) are hidden entirely
 *   while no key is configured — no greyed-out actions.
 * - Quasar lays FAB actions out column-reverse (direction up) / column
 *   (down), so the FIRST entry always sits right next to the button. Notes
 *   (the most used plugin, carries the unread badge) goes first; everything
 *   else keeps its registration order.
 */
export const FAB_FIRST = ['notes']

export function orderFabPlugins(plugins, { hasOpenAIKey = false } = {}) {
  const rank = (plugin) => {
    const i = FAB_FIRST.indexOf(plugin.id)
    return i === -1 ? FAB_FIRST.length : i
  }
  return (plugins || [])
    .filter((plugin) => !(plugin.requiresApiKey === 'openai' && !hasOpenAIKey))
    .map((plugin, index) => ({ plugin, index }))
    .sort((a, b) => rank(a.plugin) - rank(b.plugin) || a.index - b.index)
    .map(({ plugin }) => plugin)
}
