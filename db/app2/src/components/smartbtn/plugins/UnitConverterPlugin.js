/**
 * Unit Converter Plugin for SmartButton
 * Convert between different medical units (weight, height, temperature, etc.)
 */

import UnitConverterWidget from '../UnitConverterWidget.vue'

const UnitConverterPlugin = {
  id: 'unit-converter',
  name: 'Unit Converter',
  icon: 'straighten',
  color: 'teal',
  tooltip: 'Unit Converter',
  component: UnitConverterWidget,
  config: {
    persistent: false,
    maxWidth: '450px'
  }
}

export default UnitConverterPlugin
