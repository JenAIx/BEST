/**
 * Calculator Plugin for SmartButton
 * Defines the calculator as a plugin
 */

import Calculator from '../Calc.vue'

const CalcPlugin = {
  id: 'calc',
  name: 'Calculator',
  icon: 'calculate',
  color: 'primary',
  tooltip: 'Calculator',
  component: Calculator,
  config: {
    persistent: true,
    maxWidth: '400px'
  }
}

export default CalcPlugin
