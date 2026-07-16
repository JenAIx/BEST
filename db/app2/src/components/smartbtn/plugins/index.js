/**
 * Plugin exports and registration
 *
 * Display strings are i18n keys (nameKey/tooltipKey under smartButton.plugins.*),
 * resolved at render time in SmartButton.vue so the FAB, dialog title and
 * mini-cards follow the active locale.
 */

import pluginManager from './PluginManager.js'

// Register plugins with lazy loading
pluginManager.register({
  id: 'calculator',
  name: 'Calculator',
  nameKey: 'smartButton.plugins.calculator.name',
  icon: 'calculate',
  color: 'blue',
  tooltipKey: 'smartButton.plugins.calculator.tooltip',
  component: () => import('./CalcPlugin.js').then((module) => module.default.component),
})

pluginManager.register({
  id: 'notes',
  name: 'Notes',
  nameKey: 'smartButton.plugins.notes.name',
  icon: 'note',
  color: 'green',
  tooltipKey: 'smartButton.plugins.notes.tooltip',
  component: () => import('./NotesPlugin.js').then((module) => module.default.component),
  config: {
    minWidth: '420px',
    maxWidth: '560px',
  },
})

pluginManager.register({
  id: 'unit-converter',
  name: 'Unit Converter',
  nameKey: 'smartButton.plugins.unitConverter.name',
  icon: 'swap_horiz',
  color: 'orange',
  tooltipKey: 'smartButton.plugins.unitConverter.tooltip',
  component: () => import('./UnitConverterPlugin.js').then((module) => module.default.component),
})

pluginManager.register({
  id: 'bmi-calculator',
  name: 'BMI Calculator',
  nameKey: 'smartButton.plugins.bmiCalculator.name',
  icon: 'monitor_weight',
  color: 'purple',
  tooltipKey: 'smartButton.plugins.bmiCalculator.tooltip',
  component: () => import('./BmiCalculatorPlugin.js').then((module) => module.default.component),
})

pluginManager.register({
  id: 'levodopa-calculator',
  name: 'Levodopa Calculator',
  nameKey: 'smartButton.plugins.levodopaCalculator.name',
  icon: 'medication',
  color: 'purple',
  tooltipKey: 'smartButton.plugins.levodopaCalculator.tooltip',
  component: () => import('./LevodopaCalculatorPlugin.js').then((module) => module.default.component),
  config: {
    minWidth: '600px',
    maxWidth: '800px',
  },
})

pluginManager.register({
  id: 'ask-ai',
  name: 'Ask AI',
  nameKey: 'smartButton.plugins.askAi.name',
  icon: 'smart_toy',
  color: 'accent',
  tooltipKey: 'smartButton.plugins.askAi.tooltip',
  component: () => import('./AskAIPlugin.js').then((module) => module.default.component),
  config: {
    minWidth: '500px',
    maxWidth: '600px',
  },
})

pluginManager.register({
  id: 'rewrite',
  name: 'Rewrite',
  nameKey: 'smartButton.plugins.rewrite.name',
  icon: 'edit',
  color: 'teal',
  tooltipKey: 'smartButton.plugins.rewrite.tooltip',
  component: () => import('./RewritePlugin.js').then((module) => module.default.component),
  config: {
    minWidth: '600px',
    maxWidth: '800px',
  },
})

export { pluginManager }
export { default as CalcPlugin } from './CalcPlugin.js'
export { default as NotesPlugin } from './NotesPlugin.js'
export { default as UnitConverterPlugin } from './UnitConverterPlugin.js'
export { default as BmiCalculatorPlugin } from './BmiCalculatorPlugin.js'
export { default as LevodopaCalculatorPlugin } from './LevodopaCalculatorPlugin.js'
export { default as AskAIPlugin } from './AskAIPlugin.js'
export { default as RewritePlugin } from './RewritePlugin.js'
