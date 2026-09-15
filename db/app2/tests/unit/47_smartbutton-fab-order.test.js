/**
 * SmartButton FAB: notes sits next to the button, AI tools are hidden
 * while no OpenAI key is configured (components/smartbtn/plugins/fab-order.js).
 */
import { describe, it, expect } from 'vitest'
import { orderFabPlugins } from '../../src/components/smartbtn/plugins/fab-order.js'

const plugins = [
  { id: 'calculator' },
  { id: 'notes' },
  { id: 'unit-converter' },
  { id: 'bmi-calculator' },
  { id: 'ask-ai', requiresApiKey: 'openai' },
  { id: 'rewrite', requiresApiKey: 'openai' },
]

describe('orderFabPlugins', () => {
  it('puts notes first and keeps the registration order of the rest', () => {
    expect(orderFabPlugins(plugins, { hasOpenAIKey: true }).map((p) => p.id)).toEqual(['notes', 'calculator', 'unit-converter', 'bmi-calculator', 'ask-ai', 'rewrite'])
  })

  it('hides the AI tools without an API key', () => {
    expect(orderFabPlugins(plugins, { hasOpenAIKey: false }).map((p) => p.id)).toEqual(['notes', 'calculator', 'unit-converter', 'bmi-calculator'])
    expect(orderFabPlugins(plugins).map((p) => p.id)).not.toContain('ask-ai')
  })

  it('is stable and tolerant', () => {
    expect(orderFabPlugins([])).toEqual([])
    expect(orderFabPlugins(null)).toEqual([])
    expect(orderFabPlugins([{ id: 'x' }, { id: 'y' }]).map((p) => p.id)).toEqual(['x', 'y'])
  })
})
