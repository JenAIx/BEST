/**
 * Plugin exports and registration
 */

import pluginManager from './PluginManager.js'

// Register plugins with lazy loading
pluginManager.register({
  id: 'calculator',
  name: 'Calculator',
  icon: 'calculate',
  color: 'blue',
  tooltip: 'Basic Calculator',
  component: () => import('./CalcPlugin.js').then(module => module.default.component)
})

pluginManager.register({
  id: 'notes',
  name: 'Notes',
  icon: 'note',
  color: 'green',
  tooltip: 'Quick Notes',
  component: () => import('./NotesPlugin.js').then(module => module.default.component)
})

pluginManager.register({
  id: 'unit-converter',
  name: 'Unit Converter',
  icon: 'swap_horiz',
  color: 'orange',
  tooltip: 'Convert Units',
  component: () => import('./UnitConverterPlugin.js').then(module => module.default.component)
})

pluginManager.register({
  id: 'bmi-calculator',
  name: 'BMI Calculator',
  icon: 'monitor_weight',
  color: 'purple',
  tooltip: 'Calculate BMI',
  component: () => import('./BmiCalculatorPlugin.js').then(module => module.default.component)
})

pluginManager.register({
  id: 'levodopa-calculator',
  name: 'Levodopa Calculator',
  icon: 'medication',
  color: 'purple',
  tooltip: 'Levodopa Equivalence Calculator',
  component: () => import('./LevodopaCalculatorPlugin.js').then(module => module.default.component),
  config: {
    minWidth: '600px',
    maxWidth: '800px'
  }
})

pluginManager.register({
  id: 'ask-ai',
  name: 'Ask AI',
  icon: 'smart_toy',
  color: 'accent',
  tooltip: 'Ask AI Assistant',
  component: () => import('./AskAIPlugin.js').then(module => module.default.component),
  config: {
    minWidth: '500px',
    maxWidth: '600px'
  }
})

export { pluginManager }
export { default as CalcPlugin } from './CalcPlugin.js'
export { default as NotesPlugin } from './NotesPlugin.js'
export { default as UnitConverterPlugin } from './UnitConverterPlugin.js'
export { default as BmiCalculatorPlugin } from './BmiCalculatorPlugin.js'
export { default as LevodopaCalculatorPlugin } from './LevodopaCalculatorPlugin.js'
export { default as AskAIPlugin } from './AskAIPlugin.js'
