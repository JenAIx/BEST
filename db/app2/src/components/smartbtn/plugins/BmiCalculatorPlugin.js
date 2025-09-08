/**
 * BMI Calculator Plugin for SmartButton
 * Calculate BMI and provide health category
 */

import BmiCalculatorWidget from '../BmiCalculatorWidget.vue'

const BmiCalculatorPlugin = {
  id: 'bmi-calculator',
  name: 'BMI Calculator',
  icon: 'monitor_weight',
  color: 'orange',
  tooltip: 'BMI Calculator',
  component: BmiCalculatorWidget,
  config: {
    persistent: false,
    maxWidth: '400px'
  }
}

export default BmiCalculatorPlugin
