/**
 * Levodopa Equivalence Calculator Plugin for SmartButton
 * Calculate total Levodopa Equivalent Dose (LED) for Parkinson's medications
 */

import LevodopaCalculatorWidget from '../LevodopaCalculatorWidget.vue'

const LevodopaCalculatorPlugin = {
  id: 'levodopa-calculator',
  name: 'Levodopa Calculator',
  icon: 'medication',
  color: 'purple',
  tooltip: 'Levodopa Equivalence Calculator',
  component: LevodopaCalculatorWidget,
  config: {
    persistent: false,
    maxWidth: '800px',
    minWidth: '600px'
  }
}

export default LevodopaCalculatorPlugin

