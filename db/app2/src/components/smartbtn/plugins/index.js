/**
 * Plugin exports and registration
 */

import pluginManager from './PluginManager.js'
import CalcPlugin from './CalcPlugin.js'
import NotesPlugin from './NotesPlugin.js'
import UnitConverterPlugin from './UnitConverterPlugin.js'
import BmiCalculatorPlugin from './BmiCalculatorPlugin.js'

// Register default plugins
pluginManager.register(CalcPlugin)
pluginManager.register(NotesPlugin)
pluginManager.register(UnitConverterPlugin)
pluginManager.register(BmiCalculatorPlugin)

export { pluginManager }
export { default as CalcPlugin } from './CalcPlugin.js'
export { default as NotesPlugin } from './NotesPlugin.js'
export { default as UnitConverterPlugin } from './UnitConverterPlugin.js'
export { default as BmiCalculatorPlugin } from './BmiCalculatorPlugin.js'
